import { and, eq, lt, sql } from "drizzle-orm";
import { syncRuns } from "@/server/db/schema";
import type { Database } from "@/server/db/types";

/** A run still "running" after this long is assumed killed (function timeout, crash). */
export const STALE_RUN_MS = 15 * 60 * 1000;

function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === "23505") return true;
  }
  return false;
}

export type LeaseRequest = {
  newsroomId: string;
  sourceId: string;
  trigger: "manual" | "cron" | "cli";
  triggeredBy?: string | null;
  now?: Date;
};

/**
 * Starts a sync run, or returns `null` when another run for the source holds the
 * lease. The partial unique index `sync_runs_one_running_per_source` makes this
 * atomic, so overlapping cron deliveries and double clicks resolve to one run.
 */
export async function acquireLease(
  db: Database,
  request: LeaseRequest,
): Promise<{ runId: string } | null> {
  const now = request.now ?? new Date();
  await db
    .update(syncRuns)
    .set({
      status: "abandoned",
      finishedAt: now,
      errorMessage: "The run did not finish (timed out or was interrupted).",
    })
    .where(
      and(
        eq(syncRuns.sourceId, request.sourceId),
        eq(syncRuns.status, "running"),
        lt(syncRuns.startedAt, new Date(now.getTime() - STALE_RUN_MS)),
      ),
    );

  try {
    const [run] = await db
      .insert(syncRuns)
      .values({
        newsroomId: request.newsroomId,
        sourceId: request.sourceId,
        trigger: request.trigger,
        triggeredBy: request.triggeredBy ?? null,
        startedAt: now,
      })
      .returning({ id: syncRuns.id });
    return { runId: run!.id };
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}

/** For tests and diagnostics: is a run currently holding the lease? */
export async function isRunning(db: Database, sourceId: string): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(syncRuns)
    .where(and(eq(syncRuns.sourceId, sourceId), eq(syncRuns.status, "running")));
  return (row?.n ?? 0) > 0;
}
