"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { reprocessAction } from "@/server/actions/sources";

/** Re-parses stored Markdown with the current parser and topics. No Drive access. */
export function ReprocessButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await reprocessAction(slug);
            setMessage(
              result.ok
                ? `${result.data.reprocessed} briefings re-processed${result.data.failed ? `, ${result.data.failed} failed` : ""}.`
                : result.error,
            );
            router.refresh();
          })
        }
      >
        {pending ? "Re-processing…" : "Re-process all briefings"}
      </Button>
      {message && (
        <p role="status" className="text-meta text-ink-secondary">
          {message}
        </p>
      )}
    </div>
  );
}
