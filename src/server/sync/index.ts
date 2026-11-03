import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { syncEnv } from "@/env";
import { withTransactionalDb } from "@/server/db/client";
import { newsrooms, sources, syncRuns } from "@/server/db/schema";
import type { Database } from "@/server/db/types";
import { getSourceProvider } from "@/server/sources";
import { syncSource, type SyncCounts, type SyncResult, type SyncTrigger } from "./run-sync";

const emptyCounts = (): SyncCounts => ({
  discovered: 0,
  imported: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  missing: 0,
});

export type { SyncResult } from "./run-sync";

async function loadSource(db: Database, sourceId: string) {
  const [row] = await db
    .select({
      id: sources.id,
      newsroomId: sources.newsroomId,
      provider: sources.provider,
      rootRef: sources.rootRef,
      timezone: newsrooms.timezone,
    })
    .from(sources)
    .innerJoin(newsrooms, eq(newsrooms.id, sources.newsroomId))
    .where(eq(sources.id, sourceId));
  return row;
}

async function runOne(
  db: Database,
  sourceId: string,
  trigger: SyncTrigger,
  triggeredBy: string | null,
  budgetMs: number,
): Promise<SyncResult> {
  const source = await loadSource(db, sourceId);
  if (!source) throw new Error(`Source ${sourceId} not found.`);

  let provider;
  try {
    provider = getSourceProvider(source.provider);
  } catch (error) {
    // Configuration problems (e.g. a missing Google key) still appear in sync history.
    const message = (error as Error).message;
    const [run] = await db
      .insert(syncRuns)
      .values({
        newsroomId: source.newsroomId,
        sourceId: source.id,
        trigger,
        triggeredBy,
        status: "failed",
        finishedAt: new Date(),
        errorMessage: message,
      })
      .returning({ id: syncRuns.id });
    return {
      status: "failed",
      runId: run!.id,
      counts: emptyCounts(),
      budgetExceeded: false,
      error: message,
    };
  }

  return syncSource({
    db,
    provider,
    source,
    newsroomTimeZone: source.timezone,
    trigger,
    triggeredBy,
    budgetMs,
  });
}

/**
 * Syncs one source. Callers are responsible for authorization: the Server Action
 * checks newsroom ownership before calling this.
 */
export function syncSourceById(
  sourceId: string,
  trigger: SyncTrigger,
  triggeredBy: string | null = null,
  budgetMs = syncEnv().SYNC_TIME_BUDGET_MS,
): Promise<SyncResult> {
  return withTransactionalDb((db) => runOne(db, sourceId, trigger, triggeredBy, budgetMs));
}

/** Syncs every enabled source, least recently synced first, within one shared budget. */
export function syncAllSources(
  trigger: SyncTrigger,
  budgetMs = syncEnv().SYNC_TIME_BUDGET_MS,
): Promise<{ sourceId: string; result: SyncResult | { status: "error"; error: string } }[]> {
  return withTransactionalDb(async (db) => {
    const started = Date.now();
    const enabled = await db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.enabled, true))
      .orderBy(sql`${sources.lastSyncedAt} asc nulls first`, asc(sources.createdAt));

    const results = [];
    for (const { id } of enabled) {
      const remaining = budgetMs - (Date.now() - started);
      if (remaining <= 0) break;
      try {
        results.push({ sourceId: id, result: await runOne(db, id, trigger, null, remaining) });
      } catch (error) {
        // One misconfigured source must not block the others.
        results.push({
          sourceId: id,
          result: { status: "error" as const, error: (error as Error).message },
        });
      }
    }
    return results;
  });
}
