import { createHash } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  newsrooms,
  reportTopics,
  reports,
  sources,
  stories,
  storyTopics,
  syncRunErrors,
  syncRuns,
  topics,
} from "@/server/db/schema";
import type { Database } from "@/server/db/types";
import { SourceError, type RemoteFile, type SourceProvider } from "@/server/sources/types";
import { STALE_RUN_MS } from "@/server/sync/lease";
import { reprocessNewsroom } from "@/server/sync/reprocess";
import { syncSource } from "@/server/sync/run-sync";
import { createTestDb } from "../support/db";
import { SAMPLE_FILE, TEST_TOPICS, readFixture, readSample } from "../support/fixtures";

type FakeFile = { id: string; name: string; path: string; content: string; modifiedAt: Date };

/** In-memory source with download counting and failure injection. */
class FakeSource implements SourceProvider {
  readonly id = "filesystem" as const;
  files = new Map<string, FakeFile>();
  downloads: string[] = [];
  failDownload = new Set<string>();
  failListing = false;

  put(file: Omit<FakeFile, "modifiedAt"> & { modifiedAt?: Date }) {
    this.files.set(file.id, { modifiedAt: new Date("2026-11-03T06:22:10Z"), ...file });
  }
  async verifyRoot() {
    return { name: "Fake", ownerEmails: [] };
  }
  async listFiles() {
    if (this.failListing)
      throw new SourceError("Google Drive is temporarily unavailable.", "unavailable");
    return {
      files: [...this.files.values()].map((f): RemoteFile => ({
        id: f.id,
        name: f.name,
        path: f.path,
        mimeType: "text/markdown",
        createdAt: new Date("2026-11-03T06:22:10Z"),
        modifiedAt: f.modifiedAt,
        checksum: createHash("md5").update(f.content).digest("hex"),
        size: f.content.length,
      })),
      skipped: [],
    };
  }
  async download(file: RemoteFile) {
    this.downloads.push(file.id);
    if (this.failDownload.has(file.id)) throw new Error("connection reset");
    return new TextEncoder().encode(this.files.get(file.id)!.content);
  }
}

let db: Database;
let source: FakeSource;
let ids: { newsroomId: string; sourceId: string };

const run = (overrides: Partial<Parameters<typeof syncSource>[0]> = {}) =>
  syncSource({
    db,
    provider: source,
    source: { id: ids.sourceId, newsroomId: ids.newsroomId, rootRef: "root" },
    newsroomTimeZone: "Europe/Athens",
    trigger: "cli",
    budgetMs: 60_000,
    ...overrides,
  });

const sample = () => ({
  id: "f1",
  name: SAMPLE_FILE,
  path: `2026/11-November/${SAMPLE_FILE}`,
  content: readSample(),
});

beforeEach(async () => {
  ({ db } = await createTestDb());
  source = new FakeSource();
  const [newsroom] = await db
    .insert(newsrooms)
    .values({ ownerId: "user_a", name: "Global desk", slug: "global", timezone: "Europe/Athens" })
    .returning();
  const [src] = await db
    .insert(sources)
    .values({ newsroomId: newsroom!.id, provider: "filesystem", rootRef: "root" })
    .returning();
  await db.insert(topics).values(
    TEST_TOPICS.map((t, i) => ({
      newsroomId: newsroom!.id,
      name: t.name,
      slug: `topic-${i}`,
      aliases: [...t.aliases],
      position: i,
    })),
  );
  ids = { newsroomId: newsroom!.id, sourceId: src!.id };
});

describe("sync: import and idempotency", () => {
  it("imports a report with its stories, sections and topic links", async () => {
    source.put(sample());
    const result = await run();
    expect(result).toMatchObject({
      status: "succeeded",
      counts: { discovered: 1, imported: 1, updated: 0, skipped: 0, failed: 0 },
    });

    const [report] = await db.select().from(reports);
    expect(report).toMatchObject({
      slug: "2026-11-03-0816-global-intelligence-briefing",
      title: "Global Intelligence Briefing",
      reportDate: "2026-11-03",
      sourcePath: `2026/11-November/${SAMPLE_FILE}`,
      rawMarkdown: readSample(),
    });
    expect(await db.select().from(stories)).toHaveLength(7);
    expect(await db.select().from(storyTopics)).toHaveLength(10);
    const counts = await db
      .select({ name: topics.name, storyCount: reportTopics.storyCount })
      .from(reportTopics)
      .innerJoin(topics, eq(topics.id, reportTopics.topicId))
      .orderBy(asc(topics.name));
    expect(counts).toEqual([
      { name: "Artificial Intelligence", storyCount: 2 },
      { name: "Cybersecurity", storyCount: 2 },
      { name: "Global Events & Geopolitics", storyCount: 4 },
      { name: "Stock Market & Global Finance", storyCount: 2 },
    ]);
  });

  it("skips unchanged files on the next run without downloading them", async () => {
    source.put(sample());
    await run();
    source.downloads = [];
    const again = await run();
    expect(again).toMatchObject({
      status: "succeeded",
      counts: { imported: 0, updated: 0, skipped: 1 },
    });
    expect(source.downloads).toEqual([]);
    expect(await db.select().from(reports)).toHaveLength(1);
    expect(await db.select().from(stories)).toHaveLength(7);
  });

  it("keeps same-day editions as separate reports", async () => {
    source.put(sample());
    source.put({
      ...sample(),
      id: "f2",
      name: "2026-11-03_1034_Global_Intelligence_Briefing.md",
      path: "2026/11-November/b.md",
    });
    await run();
    const rows = await db
      .select({ slug: reports.slug, date: reports.reportDate })
      .from(reports)
      .orderBy(asc(reports.slug));
    expect(rows).toEqual([
      { slug: "2026-11-03-0816-global-intelligence-briefing", date: "2026-11-03" },
      { slug: "2026-11-03-1034-global-intelligence-briefing", date: "2026-11-03" },
    ]);
  });

  it("gives same-named files in different folders distinct slugs", async () => {
    source.put({ id: "a", name: "notes.md", path: "2026/notes.md", content: "# A" });
    source.put({ id: "b", name: "notes.md", path: "2027/notes.md", content: "# B" });
    await run();
    const slugs = (await db.select({ slug: reports.slug }).from(reports)).map((r) => r.slug).sort();
    expect(slugs).toEqual(["notes", "notes-2"]);
  });
});

describe("sync: changes", () => {
  it("updates a changed file in place and keeps its slug", async () => {
    source.put(sample());
    await run();
    const [before] = await db.select().from(reports);

    const edited = readSample().replace("Importance:** 9/10", "Importance:** 10/10");
    source.put({ ...sample(), content: edited, modifiedAt: new Date("2026-11-03T07:00:00Z") });
    const result = await run();

    expect(result).toMatchObject({ counts: { imported: 0, updated: 1 } });
    const [after] = await db.select().from(reports);
    expect(after?.id).toBe(before?.id);
    expect(after?.slug).toBe(before?.slug);
    expect(after?.contentHash).not.toBe(before?.contentHash);
    const top = await db
      .select({ importance: stories.importance })
      .from(stories)
      .where(eq(stories.position, 0));
    expect(top[0]?.importance).toBe(10);
    expect(await db.select().from(stories)).toHaveLength(7);
  });

  it("refreshes metadata only when a file moves without content changes", async () => {
    source.put(sample());
    await run();
    source.put({ ...sample(), path: "archive/moved.md", name: "moved.md" });
    source.downloads = [];
    const result = await run();
    expect(result).toMatchObject({ counts: { updated: 0, skipped: 1 } });
    expect(source.downloads).toEqual([]);
    const [row] = await db.select().from(reports);
    expect(row).toMatchObject({ sourcePath: "archive/moved.md", sourceFileName: "moved.md" });
  });

  it("flags files that disappear, keeps the report, and clears the flag when they return", async () => {
    source.put(sample());
    await run();
    source.files.clear();
    const gone = await run();
    expect(gone).toMatchObject({ status: "succeeded", counts: { discovered: 0, missing: 1 } });
    const [flagged] = await db.select().from(reports);
    expect(flagged?.sourceMissingAt).toBeInstanceOf(Date);
    expect(await db.select().from(stories)).toHaveLength(7);

    source.put(sample());
    await run();
    const [back] = await db.select().from(reports);
    expect(back?.sourceMissingAt).toBeNull();
  });
});

describe("sync: failures", () => {
  it("isolates per-file failures and records them", async () => {
    source.put(sample());
    source.put({ id: "bad", name: "bad.md", path: "bad.md", content: "# Bad" });
    source.failDownload.add("bad");
    const result = await run();
    expect(result).toMatchObject({ status: "partial", counts: { imported: 1, failed: 1 } });
    const errors = await db.select().from(syncRunErrors);
    expect(errors).toMatchObject([
      { stage: "download", fileName: "bad.md", message: "connection reset" },
    ]);

    source.failDownload.clear();
    expect(await run()).toMatchObject({ status: "succeeded", counts: { imported: 1, skipped: 1 } });
  });

  it("leaves stored reports untouched when the source cannot be listed", async () => {
    source.put(sample());
    await run();
    source.failListing = true;
    const result = await run();
    expect(result).toMatchObject({
      status: "failed",
      error: "Google Drive is temporarily unavailable.",
    });
    const [row] = await db.select().from(reports);
    expect(row?.sourceMissingAt).toBeNull();
    expect(await db.select().from(stories)).toHaveLength(7);
    const [lastRun] = await db.select().from(syncRuns).orderBy(asc(syncRuns.startedAt)).offset(1);
    expect(lastRun).toMatchObject({ status: "failed" });
  });
});

describe("sync: concurrency and time budget", () => {
  it("lets only one run hold the lease", async () => {
    source.put(sample());
    const [a, b] = await Promise.all([run(), run()]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["already_running", "succeeded"]);
    expect(await db.select().from(reports)).toHaveLength(1);
  });

  it("recovers the lease from a run that never finished", async () => {
    await db.insert(syncRuns).values({
      newsroomId: ids.newsroomId,
      sourceId: ids.sourceId,
      trigger: "cron",
      startedAt: new Date(Date.now() - STALE_RUN_MS - 1000),
    });
    source.put(sample());
    expect(await run()).toMatchObject({ status: "succeeded" });
    const statuses = (await db.select({ status: syncRuns.status }).from(syncRuns))
      .map((r) => r.status)
      .sort();
    expect(statuses).toEqual(["abandoned", "succeeded"]);
  });

  it("stops at the time budget and finishes on the next run", async () => {
    for (let i = 0; i < 5; i++)
      source.put({
        id: `n${i}`,
        name: `note-${i}.md`,
        path: `note-${i}.md`,
        content: `# Note ${i}`,
      });
    let clock = 0;
    const first = await run({ budgetMs: 2, concurrency: 1, now: () => clock++ });
    expect(first).toMatchObject({ status: "partial", budgetExceeded: true });
    if (first.status === "already_running") throw new Error("unexpected");
    expect(first.counts.imported).toBeLessThan(5);

    const second = await run();
    expect(second).toMatchObject({ status: "succeeded" });
    expect(await db.select().from(reports)).toHaveLength(5);
  });
});

describe("re-parsing stored reports", () => {
  it("re-parses outdated reports without downloading", async () => {
    source.put(sample());
    await run();
    await db.update(reports).set({ parserVersion: 0 });
    source.downloads = [];
    const result = await run();
    expect(result).toMatchObject({ counts: { updated: 1 } });
    expect(source.downloads).toEqual([]);
    const [row] = await db.select({ v: reports.parserVersion }).from(reports);
    expect(row?.v).toBeGreaterThan(0);
  });

  it("applies topic changes to stored reports", async () => {
    source.put({
      id: "fb",
      name: "transfers.md",
      path: "transfers.md",
      content: readFixture("generic-football.md"),
    });
    await run();
    expect(await db.select().from(storyTopics)).toHaveLength(0);

    await db.insert(topics).values({
      newsroomId: ids.newsroomId,
      name: "Premier League",
      slug: "premier-league",
      aliases: [],
    });
    const result = await reprocessNewsroom(db, ids.newsroomId);
    expect(result).toEqual({ reprocessed: 1, failed: [] });
    expect(await db.select().from(storyTopics)).toHaveLength(1);
  });
});

describe("sync: logging", () => {
  it("records counts on the run and the source", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    source.put(sample());
    const result = await run();
    if (result.status === "already_running") throw new Error("unexpected");
    const [row] = await db.select().from(syncRuns).where(eq(syncRuns.id, result.runId));
    expect(row).toMatchObject({ status: "succeeded", filesDiscovered: 1, filesImported: 1 });
    expect(row?.finishedAt).toBeInstanceOf(Date);
    const [src] = await db.select().from(sources);
    expect(src?.lastSuccessAt).toBeInstanceOf(Date);
  });
});
