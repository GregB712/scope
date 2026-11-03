import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { sources, syncRunErrors, syncRuns } from "@/server/db/schema";
import type { Database } from "@/server/db/types";
import type { AuthorizedNewsroom } from "./newsroom-access";

export async function listSources(db: Database, newsroom: AuthorizedNewsroom) {
  return db
    .select()
    .from(sources)
    .where(eq(sources.newsroomId, newsroom.id))
    .orderBy(asc(sources.createdAt));
}

export async function getSource(db: Database, newsroom: AuthorizedNewsroom, sourceId: string) {
  const [row] = await db
    .select()
    .from(sources)
    .where(and(eq(sources.id, sourceId), eq(sources.newsroomId, newsroom.id)));
  return row ?? null;
}

export class FolderAlreadyBoundError extends Error {
  constructor() {
    super("This folder is already connected to another newsroom.");
    this.name = "FolderAlreadyBoundError";
  }
}

const isUniqueViolation = (error: unknown): boolean => {
  for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === "23505") return true;
  }
  return false;
};

/** Connects (or re-points) the newsroom's source for a provider. */
export async function bindSource(
  db: Database,
  newsroom: AuthorizedNewsroom,
  input: { provider: "google_drive" | "filesystem"; rootRef: string; rootName: string },
) {
  const [existing] = await db
    .select({ id: sources.id })
    .from(sources)
    .where(and(eq(sources.newsroomId, newsroom.id), eq(sources.provider, input.provider)));
  try {
    if (existing) {
      const [row] = await db
        .update(sources)
        .set({ rootRef: input.rootRef, rootName: input.rootName, enabled: true })
        .where(eq(sources.id, existing.id))
        .returning();
      return row!;
    }
    const [row] = await db
      .insert(sources)
      .values({ newsroomId: newsroom.id, ...input })
      .returning();
    return row!;
  } catch (error) {
    if (isUniqueViolation(error)) throw new FolderAlreadyBoundError();
    throw error;
  }
}

export async function setSourceEnabled(
  db: Database,
  newsroom: AuthorizedNewsroom,
  sourceId: string,
  enabled: boolean,
) {
  const rows = await db
    .update(sources)
    .set({ enabled })
    .where(and(eq(sources.id, sourceId), eq(sources.newsroomId, newsroom.id)))
    .returning({ id: sources.id });
  return rows.length > 0;
}

export async function listSyncRuns(
  db: Database,
  newsroom: AuthorizedNewsroom,
  options: { limit?: number; offset?: number } = {},
) {
  const runs = await db
    .select({
      run: syncRuns,
      total: sql<number>`count(*) over ()::int`,
    })
    .from(syncRuns)
    .where(eq(syncRuns.newsroomId, newsroom.id))
    .orderBy(desc(syncRuns.startedAt))
    .limit(options.limit ?? 20)
    .offset(options.offset ?? 0);
  const ids = runs.map((r) => r.run.id);
  const errors = ids.length
    ? await db
        .select()
        .from(syncRunErrors)
        .where(inArray(syncRunErrors.runId, ids))
        .orderBy(asc(syncRunErrors.createdAt))
    : [];
  return {
    total: runs[0]?.total ?? 0,
    items: runs.map(({ run }) => ({ ...run, errors: errors.filter((e) => e.runId === run.id) })),
  };
}

export async function getLatestSyncRun(db: Database, newsroom: AuthorizedNewsroom) {
  const [row] = await db
    .select()
    .from(syncRuns)
    .where(eq(syncRuns.newsroomId, newsroom.id))
    .orderBy(desc(syncRuns.startedAt))
    .limit(1);
  return row ?? null;
}
