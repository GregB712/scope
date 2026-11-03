"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { syncNowAction } from "@/server/actions/sources";
import type { SyncResult } from "@/server/sync/run-sync";

function describe(result: SyncResult): string {
  if (result.status === "already_running")
    return "A sync is already running. It will finish on its own.";
  const { counts } = result;
  if (result.status === "failed") return result.error ?? "The sync failed. See the history below.";
  const parts = [
    `${counts.imported} imported`,
    `${counts.updated} updated`,
    `${counts.skipped} unchanged`,
    counts.failed ? `${counts.failed} failed` : null,
    counts.missing ? `${counts.missing} no longer in the folder` : null,
  ].filter(Boolean);
  const tail = result.budgetExceeded ? " More files remain; the next sync continues." : "";
  return `${parts.join(", ")}.${tail}`;
}

/**
 * The label morphs between states with a short blur crossfade, so the change
 * reads as one control updating rather than two swapping (emil-design-eng).
 */
export function SyncNowButton({
  slug,
  sourceId,
  variant = "primary",
}: {
  slug: string;
  sourceId: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [done, setDone] = useState(false);
  const [used, setUsed] = useState(false); // animate label changes, not the first render

  const label = pending ? "Syncing…" : done ? "Synced" : "Sync now";

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant={variant}
        disabled={pending}
        aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            setUsed(true);
            const result = await syncNowAction(slug, sourceId);
            if (!result.ok) {
              setMessage({ text: result.error, tone: "error" });
              return;
            }
            setMessage({
              text: describe(result.data),
              tone: result.data.status === "failed" ? "error" : "ok",
            });
            setDone(true);
            setTimeout(() => setDone(false), 2500);
            router.refresh();
          })
        }
      >
        <span
          key={label}
          className={cn(used && "animate-[label-in_200ms_ease-out] motion-reduce:animate-none")}
        >
          {label}
        </span>
      </Button>
      {message && (
        <p
          role="status"
          className={cn(
            "text-meta",
            message.tone === "error" ? "text-danger" : "text-ink-secondary",
          )}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
