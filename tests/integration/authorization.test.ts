import { createHash } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { newsrooms, sources, syncRuns, topics } from "@/server/db/schema";
import type { Database } from "@/server/db/types";
import { findOwnedNewsroom, type AuthorizedNewsroom } from "@/server/data/newsroom-access";
import { getReport, listReports } from "@/server/data/reports";
import { searchNewsroom } from "@/server/data/search";
import { getSource, listSyncRuns, setSourceEnabled } from "@/server/data/sources";
import { listRecentStories } from "@/server/data/stories";
import {
  deleteTopic,
  getTopic,
  listTopicsWithStats,
  reorderTopics,
  updateTopic,
} from "@/server/data/topics";
import type { SourceProvider } from "@/server/sources/types";
import { syncSource } from "@/server/sync/run-sync";
import { createTestDb } from "../support/db";
import { SAMPLE_FILE, readSample } from "../support/fixtures";

// ---------------------------------------------------------------------------
// Test doubles for the request context used by Server Actions.
// ---------------------------------------------------------------------------
const session = vi.hoisted(() => ({ userId: null as string | null }));
const state = vi.hoisted(() => ({ db: null as unknown }));
const syncSourceById = vi.hoisted(() => vi.fn());

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: session.userId }),
  currentUser: async () => null,
}));
vi.mock("@/server/db/client", () => ({
  getDb: () => state.db,
  withTransactionalDb: (fn: (db: unknown) => unknown) => fn(state.db),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("@/server/sync", () => ({ syncSourceById }));

let db: Database;
let alice: AuthorizedNewsroom;
let bob: AuthorizedNewsroom;
let aliceSourceId: string;
let aliceTopicId: string;
const aliceReportSlug = "2026-11-03-0816-global-intelligence-briefing";

const singleFile = (content: string): SourceProvider => ({
  id: "filesystem",
  verifyRoot: async () => ({ name: "x", ownerEmails: [] }),
  listFiles: async () => ({
    files: [
      {
        id: "file-a",
        name: SAMPLE_FILE,
        path: SAMPLE_FILE,
        mimeType: "text/markdown",
        createdAt: null,
        modifiedAt: null,
        checksum: createHash("md5").update(content).digest("hex"),
        size: content.length,
      },
    ],
    skipped: [],
  }),
  download: async () => new TextEncoder().encode(content),
});

beforeAll(async () => {
  ({ db } = await createTestDb());
  state.db = db;
  vi.spyOn(console, "info").mockImplementation(() => {});

  for (const [owner, slug] of [
    ["user_alice", "alice-desk"],
    ["user_bob", "bob-desk"],
  ] as const) {
    await db.insert(newsrooms).values({ ownerId: owner, name: slug, slug });
  }
  alice = (await findOwnedNewsroom(db, "user_alice", "alice-desk"))!;
  bob = (await findOwnedNewsroom(db, "user_bob", "bob-desk"))!;

  const [source] = await db
    .insert(sources)
    .values({ newsroomId: alice.id, provider: "filesystem", rootRef: "alice-root" })
    .returning();
  aliceSourceId = source!.id;
  const [topic] = await db
    .insert(topics)
    .values({ newsroomId: alice.id, name: "Cybersecurity", slug: "cybersecurity", aliases: [] })
    .returning();
  aliceTopicId = topic!.id;

  await syncSource({
    db,
    provider: singleFile(readSample()),
    source: { id: aliceSourceId, newsroomId: alice.id, rootRef: "alice-root" },
    newsroomTimeZone: "UTC",
    trigger: "cli",
    budgetMs: 60_000,
  });
});

beforeEach(() => {
  session.userId = null;
  syncSourceById.mockReset();
});

describe("newsroom ownership", () => {
  it("resolves a newsroom only for its owner", async () => {
    expect(await findOwnedNewsroom(db, "user_alice", "alice-desk")).not.toBeNull();
    expect(await findOwnedNewsroom(db, "user_bob", "alice-desk")).toBeNull();
  });
});

describe("data access is scoped to the authorized newsroom", () => {
  it("sanity: Alice sees her own data", async () => {
    expect((await listReports(db, alice)).total).toBe(1);
    expect(await getReport(db, alice, aliceReportSlug)).not.toBeNull();
  });

  it("Bob cannot read Alice's reports, stories, topics or search results", async () => {
    expect((await listReports(db, bob)).total).toBe(0);
    expect(await getReport(db, bob, aliceReportSlug)).toBeNull();
    expect((await listRecentStories(db, bob)).total).toBe(0);
    expect(await listTopicsWithStats(db, bob)).toEqual([]);
    expect(await getTopic(db, bob, "cybersecurity")).toBeNull();
    expect(await searchNewsroom(db, bob, "Node-RED")).toEqual({
      reports: [],
      stories: [],
      topics: [],
    });
  });

  it("Bob cannot read or change Alice's sources and sync history", async () => {
    await db.insert(syncRuns).values({
      newsroomId: alice.id,
      sourceId: aliceSourceId,
      trigger: "cron",
      status: "succeeded",
    });
    expect(await getSource(db, bob, aliceSourceId)).toBeNull();
    expect((await listSyncRuns(db, bob)).items).toEqual([]);
    expect(await setSourceEnabled(db, bob, aliceSourceId, false)).toBe(false);
    expect((await getSource(db, alice, aliceSourceId))?.enabled).toBe(true);
  });

  it("Bob cannot modify Alice's topics by ID", async () => {
    expect(await updateTopic(db, bob, aliceTopicId, { name: "Hijacked", aliases: [] })).toBe(false);
    expect(await deleteTopic(db, bob, aliceTopicId)).toBe(false);
    await reorderTopics(db, bob, [aliceTopicId]);
    expect((await getTopic(db, alice, "cybersecurity"))?.name).toBe("Cybersecurity");
  });
});

describe("Server Actions re-check ownership", () => {
  it("reject signed-out callers", async () => {
    const { syncNowAction } = await import("@/server/actions/sources");
    expect(await syncNowAction("alice-desk", aliceSourceId)).toEqual({
      ok: false,
      error: "Please sign in again.",
    });
  });

  it("reject another user's newsroom", async () => {
    session.userId = "user_bob";
    const { syncNowAction, setSourceEnabledAction } = await import("@/server/actions/sources");
    const { deleteTopicAction } = await import("@/server/actions/topics");
    const { updateNewsroomAction } = await import("@/server/actions/newsroom");
    const denied = { ok: false, error: "You do not have access to this newsroom." };
    expect(await syncNowAction("alice-desk", aliceSourceId)).toEqual(denied);
    expect(await setSourceEnabledAction("alice-desk", aliceSourceId, false)).toEqual(denied);
    expect(await deleteTopicAction("alice-desk", aliceTopicId)).toEqual(denied);
    expect(await updateNewsroomAction("alice-desk", { name: "Mine now", timezone: "UTC" })).toEqual(
      denied,
    );
    expect(syncSourceById).not.toHaveBeenCalled();
  });

  it("reject another newsroom's source even from its own newsroom", async () => {
    session.userId = "user_bob";
    const { syncNowAction } = await import("@/server/actions/sources");
    expect(await syncNowAction("bob-desk", aliceSourceId)).toEqual({
      ok: false,
      error: "Source not found.",
    });
    expect(syncSourceById).not.toHaveBeenCalled();
  });

  it("allow the owner", async () => {
    session.userId = "user_alice";
    syncSourceById.mockResolvedValue({ status: "succeeded" });
    const { syncNowAction } = await import("@/server/actions/sources");
    expect(await syncNowAction("alice-desk", aliceSourceId)).toEqual({
      ok: true,
      data: { status: "succeeded" },
    });
    expect(syncSourceById).toHaveBeenCalledWith(aliceSourceId, "manual", "user_alice");
  });

  it("validate input before touching data", async () => {
    session.userId = "user_alice";
    const { deleteTopicAction } = await import("@/server/actions/topics");
    const result = await deleteTopicAction("alice-desk", "not-a-uuid");
    expect(result.ok).toBe(false);
  });
});

describe("data access: queries", () => {
  it("filters the archive by topic, importance, dates and full text", async () => {
    expect((await listReports(db, alice, { topic: "cybersecurity" })).total).toBe(1);
    expect((await listReports(db, alice, { topic: "nonexistent" })).total).toBe(0);
    expect((await listReports(db, alice, { minImportance: 9 })).total).toBe(1);
    expect((await listReports(db, alice, { minImportance: 10 })).total).toBe(0);
    expect((await listReports(db, alice, { from: "2026-11-04" })).total).toBe(0);
    const hit = await listReports(db, alice, { q: "Node-RED attack" });
    expect(hit.items[0]?.snippet).toContain("");
    expect(hit.items[0]?.leadStory).toBe("US midterm elections take place today");
    expect(hit.items[0]?.topics).toEqual([{ name: "Cybersecurity", slug: "cybersecurity" }]);
  });

  it("searches stories and topics", async () => {
    const results = await searchNewsroom(db, alice, "crypto theft");
    expect(results.stories[0]?.title).toBe("FBI blames North Korea for $6bn+ crypto theft");
    expect((await searchNewsroom(db, alice, "cyber")).topics).toEqual([
      { name: "Cybersecurity", slug: "cybersecurity" },
    ]);
    expect(await searchNewsroom(db, alice, '"unbalanced quote OR')).toBeDefined();
  });
});

describe("data access: correlated aggregates", () => {
  it("counts stories and activity per topic", async () => {
    const [cyber] = await listTopicsWithStats(db, alice);
    expect(cyber).toMatchObject({
      name: "Cybersecurity",
      storyCount: 2,
      reportCount: 1,
      lastActivity: "2026-11-03",
    });
    const list = await listReports(db, alice);
    expect(list.items[0]).toMatchObject({ storyCount: 7, topImportance: 9 });
  });
});
