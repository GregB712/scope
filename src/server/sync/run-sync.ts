import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { contentHash } from "@/core/hash";
import { PARSER_VERSION, parseReport } from "@/core/parser";
import type { TopicRef } from "@/core/topics/match";
import { reports, sources, syncRunErrors, syncRuns, topics } from "@/server/db/schema";
import type { Database } from "@/server/db/types";
import { SourceError, type RemoteFile, type SourceProvider } from "@/server/sources/types";
import { acquireLease } from "./lease";
import { persistReport, rewriteDerived } from "./persist";

export type SyncTrigger = "manual" | "cron" | "cli";

export type SyncCounts = {
  discovered: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  missing: number;
};

export type SyncResult =
  | { status: "already_running" }
  | {
      status: "succeeded" | "partial" | "failed";
      runId: string;
      counts: SyncCounts;
      budgetExceeded: boolean;
      error?: string;
    };

export type SyncSourceInput = {
  db: Database;
  provider: SourceProvider;
  source: { id: string; newsroomId: string; rootRef: string };
  newsroomTimeZone: string;
  trigger: SyncTrigger;
  triggeredBy?: string | null;
  /** Stop starting new files after this many milliseconds. */
  budgetMs: number;
  concurrency?: number;
  now?: () => number;
};

type LocalReport = {
  id: string;
  sourceId: string | null;
  sourceFileId: string;
  sourcePath: string | null;
  sourceFileName: string;
  sourceChecksum: string | null;
  sourceModifiedAt: Date | null;
  sourceMissingAt: Date | null;
  contentHash: string;
  parserVersion: number;
};

type Task =
  | { kind: "new" | "changed"; file: RemoteFile; local?: LocalReport }
  | { kind: "stale"; file: RemoteFile; local: LocalReport };

type Stage = "download" | "parse" | "persist";

class StageError extends Error {
  constructor(
    readonly stage: Stage,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
  }
}

function hasChanged(file: RemoteFile, local: LocalReport): boolean {
  if (file.checksum || local.sourceChecksum) return file.checksum !== local.sourceChecksum;
  if (!file.modifiedAt || !local.sourceModifiedAt) return true;
  return file.modifiedAt.getTime() > local.sourceModifiedAt.getTime();
}

/**
 * Reconciles one source with the database. Idempotent: running it again with no
 * remote changes imports and updates nothing. See docs/architecture.md section 5.
 */
export async function syncSource(input: SyncSourceInput): Promise<SyncResult> {
  const { db, provider, source, trigger } = input;
  const now = input.now ?? Date.now;
  const startedAt = now();

  const lease = await acquireLease(db, {
    newsroomId: source.newsroomId,
    sourceId: source.id,
    trigger,
    triggeredBy: input.triggeredBy,
    now: new Date(startedAt),
  });
  if (!lease) return { status: "already_running" };
  const { runId } = lease;

  const counts: SyncCounts = {
    discovered: 0,
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    missing: 0,
  };
  const recordError = (stage: "list" | Stage, message: string, file?: RemoteFile) =>
    db.insert(syncRunErrors).values({
      runId,
      stage,
      message: message.slice(0, 2000),
      sourceFileId: file?.id ?? null,
      fileName: file?.name ?? null,
    });

  // 1. List. On failure nothing else is touched, so imported reports stay intact.
  let remote: RemoteFile[];
  try {
    const listing = await provider.listFiles(source.rootRef);
    remote = listing.files;
  } catch (error) {
    const message =
      error instanceof SourceError ? error.message : `Listing failed: ${(error as Error).message}`;
    await recordError("list", message);
    await finish(db, runId, source.id, "failed", counts, message, startedAt, now);
    return { status: "failed", runId, counts, budgetExceeded: false, error: message };
  }
  counts.discovered = remote.length;

  // 2. Compare with what is stored.
  const local: LocalReport[] = await db
    .select({
      id: reports.id,
      sourceId: reports.sourceId,
      sourceFileId: reports.sourceFileId,
      sourcePath: reports.sourcePath,
      sourceFileName: reports.sourceFileName,
      sourceChecksum: reports.sourceChecksum,
      sourceModifiedAt: reports.sourceModifiedAt,
      sourceMissingAt: reports.sourceMissingAt,
      contentHash: reports.contentHash,
      parserVersion: reports.parserVersion,
    })
    .from(reports)
    .where(eq(reports.newsroomId, source.newsroomId));
  const byFileId = new Map(local.map((r) => [r.sourceFileId, r]));

  const tasks: Task[] = [];
  const metadataOnly: { file: RemoteFile; local: LocalReport }[] = [];
  for (const file of remote) {
    const existing = byFileId.get(file.id);
    if (!existing) tasks.push({ kind: "new", file });
    else if (hasChanged(file, existing)) tasks.push({ kind: "changed", file, local: existing });
    else if (existing.parserVersion < PARSER_VERSION)
      tasks.push({ kind: "stale", file, local: existing });
    else {
      counts.skipped++;
      const moved =
        existing.sourcePath !== file.path ||
        existing.sourceFileName !== file.name ||
        existing.sourceId !== source.id ||
        existing.sourceMissingAt !== null;
      if (moved) metadataOnly.push({ file, local: existing });
    }
  }

  // Unchanged content, new location or reappeared: refresh source metadata only.
  for (const { file, local: existing } of metadataOnly) {
    await db
      .update(reports)
      .set({
        sourceId: source.id,
        sourcePath: file.path,
        sourceFileName: file.name,
        sourceMissingAt: null,
      })
      .where(eq(reports.id, existing.id));
  }

  // 3. Process new, changed and stale files within the time budget.
  const topicRefs: TopicRef[] = await db
    .select({ id: topics.id, name: topics.name, aliases: topics.aliases })
    .from(topics)
    .where(eq(topics.newsroomId, source.newsroomId))
    .orderBy(asc(topics.position), asc(topics.name));

  const parse = (raw: string, file: RemoteFile) =>
    parseReport(raw, {
      fileName: file.name,
      fallbackDate: file.createdAt ?? file.modifiedAt ?? new Date(startedAt),
      fallbackTimeZone: input.newsroomTimeZone,
      topics: topicRefs,
    });

  async function process(task: Task): Promise<void> {
    const { file } = task;
    try {
      if (task.kind === "stale") {
        const [row] = await db
          .select({ raw: reports.rawMarkdown })
          .from(reports)
          .where(eq(reports.id, task.local.id));
        let parsed;
        try {
          parsed = parse(row?.raw ?? "", file);
        } catch (error) {
          throw new StageError("parse", error);
        }
        await rewriteDerived(db, task.local.id, parsed).catch((error) => {
          throw new StageError("persist", error);
        });
        counts.updated++;
        return;
      }

      let bytes: Uint8Array;
      try {
        bytes = await provider.download(file);
      } catch (error) {
        throw new StageError("download", error);
      }
      const hash = contentHash(bytes);

      if (
        task.kind === "changed" &&
        task.local &&
        hash === task.local.contentHash &&
        task.local.parserVersion >= PARSER_VERSION
      ) {
        // Drive touched the file but the bytes are identical.
        await db
          .update(reports)
          .set({
            sourceId: source.id,
            sourcePath: file.path,
            sourceFileName: file.name,
            sourceChecksum: file.checksum,
            sourceModifiedAt: file.modifiedAt,
            sourceMissingAt: null,
          })
          .where(eq(reports.id, task.local.id));
        counts.skipped++;
        return;
      }

      const raw = new TextDecoder("utf-8").decode(bytes);
      let parsed;
      try {
        parsed = parse(raw, file);
      } catch (error) {
        throw new StageError("parse", error);
      }
      const result = await persistReport(db, {
        newsroomId: source.newsroomId,
        sourceId: source.id,
        file,
        raw,
        contentHash: hash,
        parsed,
      }).catch((error) => {
        throw new StageError("persist", error);
      });
      if (result.created) counts.imported++;
      else counts.updated++;
    } catch (error) {
      counts.failed++;
      const stage = error instanceof StageError ? error.stage : "persist";
      const message =
        error instanceof StageError && error.cause instanceof Error
          ? error.cause.message
          : String((error as Error).message ?? error);
      await recordError(stage, message, file);
    }
  }

  let budgetExceeded = false;
  const queue = [...tasks];
  const worker = async () => {
    while (queue.length) {
      if (now() - startedAt > input.budgetMs) {
        budgetExceeded = true;
        return;
      }
      await process(queue.shift()!);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, input.concurrency ?? 3) }, worker));

  // 4. Files gone from the source are flagged, never deleted.
  const remoteIds = new Set(remote.map((f) => f.id));
  const gone = local.filter(
    (r) => r.sourceId === source.id && !remoteIds.has(r.sourceFileId) && r.sourceMissingAt === null,
  );
  if (gone.length) {
    await db
      .update(reports)
      .set({ sourceMissingAt: new Date(now()) })
      .where(
        and(
          inArray(
            reports.id,
            gone.map((r) => r.id),
          ),
          isNull(reports.sourceMissingAt),
        ),
      );
  }
  counts.missing = gone.length;

  const status = budgetExceeded || counts.failed > 0 ? "partial" : "succeeded";
  const message = budgetExceeded
    ? `Time budget reached; ${queue.length} file(s) left for the next run.`
    : null;
  await finish(db, runId, source.id, status, counts, message, startedAt, now);
  return { status, runId, counts, budgetExceeded };
}

async function finish(
  db: Database,
  runId: string,
  sourceId: string,
  status: "succeeded" | "partial" | "failed",
  counts: SyncCounts,
  errorMessage: string | null,
  startedAt: number,
  now: () => number,
) {
  const finishedAt = new Date(now());
  await db
    .update(syncRuns)
    .set({
      status,
      finishedAt,
      errorMessage,
      filesDiscovered: counts.discovered,
      filesImported: counts.imported,
      filesUpdated: counts.updated,
      filesSkipped: counts.skipped,
      filesFailed: counts.failed,
      filesMissing: counts.missing,
    })
    .where(eq(syncRuns.id, runId));
  await db
    .update(sources)
    .set({
      lastSyncedAt: finishedAt,
      ...(status === "succeeded" ? { lastSuccessAt: finishedAt } : {}),
    })
    .where(eq(sources.id, sourceId));
  console.info(
    JSON.stringify({
      event: "sync.finished",
      runId,
      sourceId,
      status,
      durationMs: now() - startedAt,
      ...counts,
    }),
  );
}
