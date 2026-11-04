import Link from "next/link";
import { getDb } from "@/server/db/client";
import { getLatestSyncRun, listSources } from "@/server/data/sources";
import type { AuthorizedNewsroom } from "@/server/auth";
import { cn } from "@/lib/utils";
import { DateLabel } from "./date-label";

/**
 * Quiet status line: when the newsroom last synchronized, or what needs attention.
 * Readers see only when it was last updated; problems and links are for the editor.
 */
export async function SyncStatus({
  newsroom,
  canEdit,
  className,
}: {
  newsroom: AuthorizedNewsroom;
  canEdit: boolean;
  className?: string;
}) {
  const db = getDb();
  const [sources, run] = await Promise.all([
    listSources(db, newsroom),
    getLatestSyncRun(db, newsroom),
  ]);
  const href = `/n/${newsroom.slug}/settings/sync`;
  const base = cn("text-meta", className);

  if (!canEdit) {
    if (!run?.finishedAt || (run.status !== "succeeded" && run.status !== "partial")) return null;
    return (
      <span className={cn(base, "text-ink-tertiary")}>
        Updated <DateLabel instant={run.finishedAt} style="relative" />
      </span>
    );
  }

  if (!sources.length) {
    return (
      <Link href={`/n/${newsroom.slug}/settings/source`} className={cn(base, "text-signal")}>
        Connect a source
      </Link>
    );
  }
  if (!run) return <span className={cn(base, "text-ink-tertiary")}>Not synced yet</span>;
  if (run.status === "running") {
    return (
      <Link href={href} className={cn(base, "text-ink-secondary")}>
        Syncing…
      </Link>
    );
  }
  if (run.status === "failed") {
    return (
      <Link href={href} className={cn(base, "text-warning")}>
        Last sync failed
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={cn(base, "text-ink-tertiary [@media(hover:hover)]:hover:text-ink-secondary")}
    >
      Synced <DateLabel instant={run.finishedAt ?? run.startedAt} style="relative" />
    </Link>
  );
}
