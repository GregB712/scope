import { createHash } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { newsrooms, sources, syncRuns, topics } from "@/server/db/schema";
import type { Database } from "@/server/db/types";
import {
  findNewsroom,
  findOwnedNewsroom,
  type AuthorizedNewsroom,
} from "@/server/data/newsroom-access";
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
// Alice is an admin. Bob owns a newsroom but is no longer listed. Carol is a reader.
const emailsByUser = vi.hoisted(() => {
  process.env.ADMIN_EMAILS = "Alice@Example.com, someone-else@example.com";
  return {
    user_alice: [{ emailAddress: "alice@example.com", verification: { status: "verified" } }],
    user_bob: [{ emailAddress: "bob@example.com", verification: { status: "verified" } }],
    // An unverified copy of an admin address must not count.
    user_carol: [
      { emailAddress: "carol@example.com", verification: { status: "verified" } },
      { emailAddress: "someone-else@example.com", verification: { status: "unverified" } },
    ],
  } as Record<string, unknown[]>;
});
const state = vi.hoisted(() => ({ db: null as unknown }));
const syncSourceById = vi.hoisted(() => vi.fn());

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: session.userId }),
  currentUser: async () =>
    session.userId ? { emailAddresses: emailsByUser[session.userId] ?? [] } : null,
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

describe("newsroom lookup", () => {
  it("resolves an owned newsroom only for its owner", async () => {
    expect(await findOwnedNewsroom(db, "user_alice", "alice-desk")).not.toBeNull();
    expect(await findOwnedNewsroom(db, "user_bob", "alice-desk")).toBeNull();
  });

  it("resolves any newsroom by slug for readers", async () => {
    expect((await findNewsroom(db, "alice-desk"))?.id).toBe(alice.id);
    expect(await findNewsroom(db, "missing-desk")).toBeNull();
  });
});

describe("a newsroom handle only reaches its own data", () => {
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

describe("roles: admins edit, everyone signed in reads", () => {
  it("parses ADMIN_EMAILS case-insensitively and ignores unverified addresses", async () => {
    const { isAdmin } = await import("@/server/auth");
    for (const [user, expected] of [
      ["user_alice", true],
      ["user_bob", false],
      ["user_carol", false],
    ] as const) {
      session.userId = user;
      expect(await isAdmin()).toBe(expected);
    }
  });

  it("lets any signed-in reader open a newsroom, and nobody signed out", async () => {
    const { requireNewsroom } = await import("@/server/auth");
    session.userId = "user_carol";
    expect((await requireNewsroom("alice-desk")).id).toBe(alice.id);
    await expect(requireNewsroom("missing-desk")).rejects.toThrow("NEXT_NOT_FOUND");
    session.userId = null;
    await expect(requireNewsroom("alice-desk")).rejects.toThrow("NEXT_REDIRECT");
  });

  it("allows editing only to the owner while they are an admin", async () => {
    const { canEditNewsroom, requireEditableNewsroom } = await import("@/server/auth");
    const cases = [
      ["user_alice", "alice-desk", true],
      ["user_alice", "bob-desk", false], // admin, but not the owner
      ["user_bob", "bob-desk", false], // owner, no longer an admin
      ["user_carol", "alice-desk", false], // reader
    ] as const;
    for (const [user, slug, expected] of cases) {
      session.userId = user;
      expect(await canEditNewsroom(slug)).toBe(expected);
      if (!expected) await expect(requireEditableNewsroom(slug)).rejects.toThrow("NEXT_NOT_FOUND");
    }
  });
});

describe("Server Actions re-check the editor", () => {
  const denied = { ok: false, error: "Only the editor of this newsroom can change it." };

  it("reject signed-out callers", async () => {
    const { syncNowAction } = await import("@/server/actions/sources");
    expect(await syncNowAction("alice-desk", aliceSourceId)).toEqual({
      ok: false,
      error: "Please sign in again.",
    });
  });

  it("reject readers, even though they can read the newsroom", async () => {
    session.userId = "user_carol";
    const { syncNowAction, setSourceEnabledAction, reprocessAction } =
      await import("@/server/actions/sources");
    const { createTopicAction, deleteTopicAction } = await import("@/server/actions/topics");
    const { updateNewsroomAction } = await import("@/server/actions/newsroom");
    expect(await syncNowAction("alice-desk", aliceSourceId)).toEqual(denied);
    expect(await setSourceEnabledAction("alice-desk", aliceSourceId, false)).toEqual(denied);
    expect(await reprocessAction("alice-desk")).toEqual(denied);
    expect(await createTopicAction("alice-desk", { name: "Mine", aliases: [] })).toEqual(denied);
    expect(await deleteTopicAction("alice-desk", aliceTopicId)).toEqual(denied);
    expect(await updateNewsroomAction("alice-desk", { name: "Mine now", timezone: "UTC" })).toEqual(
      denied,
    );
    expect(syncSourceById).not.toHaveBeenCalled();
    expect((await getTopic(db, alice, "cybersecurity"))?.name).toBe("Cybersecurity");
  });

  it("reject an owner who is no longer an admin", async () => {
    session.userId = "user_bob";
    const { updateNewsroomAction } = await import("@/server/actions/newsroom");
    expect(await updateNewsroomAction("bob-desk", { name: "Still mine", timezone: "UTC" })).toEqual(
      denied,
    );
  });

  it("reject another admin's newsroom", async () => {
    session.userId = "user_alice";
    const { updateNewsroomAction } = await import("@/server/actions/newsroom");
    expect(await updateNewsroomAction("bob-desk", { name: "Taken", timezone: "UTC" })).toEqual(
      denied,
    );
  });

  it("let only admins create a newsroom", async () => {
    const { createNewsroomAction } = await import("@/server/actions/newsroom");
    session.userId = "user_carol";
    expect(await createNewsroomAction({ name: "Carol desk", timezone: "UTC" })).toEqual({
      ok: false,
      error: "Only an admin can create a newsroom.",
    });
    session.userId = "user_alice";
    const created = await createNewsroomAction({ name: "Bob desk", timezone: "UTC" });
    // Slugs are unique across the deployment, so Alice's copy of "bob-desk" is renamed.
    expect(created).toEqual({ ok: true, data: { slug: "bob-desk-2" } });
  });

  it("reject another newsroom's source even from the editor's own newsroom", async () => {
    session.userId = "user_alice";
    const { syncNowAction } = await import("@/server/actions/sources");
    const bobSource = await db
      .insert(sources)
      .values({ newsroomId: bob.id, provider: "filesystem", rootRef: "bob-root" })
      .returning();
    expect(await syncNowAction("alice-desk", bobSource[0]!.id)).toEqual({
      ok: false,
      error: "Source not found.",
    });
    expect(syncSourceById).not.toHaveBeenCalled();
  });

  it("allow the editor", async () => {
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
