import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newsrooms, reports, sources, syncRuns } from "@/server/db/schema";
import type { Database } from "@/server/db/types";
import { createTestDb } from "../support/db";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(() => close());

async function seed() {
  const [newsroom] = await db
    .insert(newsrooms)
    .values({ ownerId: "user_a", name: "Desk", slug: `desk-${crypto.randomUUID()}` })
    .returning();
  const [source] = await db
    .insert(sources)
    .values({ newsroomId: newsroom!.id, provider: "filesystem", rootRef: crypto.randomUUID() })
    .returning();
  return { newsroom: newsroom!, source: source! };
}

const report = (newsroomId: string, fileId: string, slug: string) => ({
  newsroomId,
  sourceFileId: fileId,
  sourceFileName: `${slug}.md`,
  slug,
  title: "Daily Briefing",
  reportDate: "2026-11-03",
  rawMarkdown: "# Daily Briefing\n\nOil prices fell sharply.",
  plainText: "Daily Briefing Oil prices fell sharply.",
  contentHash: "abc",
  parserVersion: 1,
});

describe("schema", () => {
  it("rejects a second report with the same source file in a newsroom", async () => {
    const { newsroom } = await seed();
    await db.insert(reports).values(report(newsroom.id, "file-1", "a"));
    await expect(db.insert(reports).values(report(newsroom.id, "file-1", "b"))).rejects.toThrow();
  });

  it("maintains a weighted full-text search vector", async () => {
    const { newsroom } = await seed();
    await db.insert(reports).values(report(newsroom.id, "file-2", "c"));
    const rows = await db
      .select({ slug: reports.slug })
      .from(reports)
      .where(sql`${reports.searchVector} @@ websearch_to_tsquery('english', 'oil price')`);
    expect(rows.map((r) => r.slug)).toContain("c");
  });

  it("allows only one running sync per source", async () => {
    const { newsroom, source } = await seed();
    const run = { newsroomId: newsroom.id, sourceId: source.id, trigger: "cron" as const };
    await db.insert(syncRuns).values(run);
    await expect(db.insert(syncRuns).values(run)).rejects.toThrow();
    await db.insert(syncRuns).values({ ...run, status: "succeeded" });
  });

  it("binds a folder to only one newsroom", async () => {
    const a = await seed();
    const b = await seed();
    await expect(
      db.insert(sources).values({
        newsroomId: b.newsroom.id,
        provider: "filesystem",
        rootRef: a.source.rootRef,
      }),
    ).rejects.toThrow();
  });
});
