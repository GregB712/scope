"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/newsroom/states";

/** Errors explain what happened and offer the next step; imported reports are never at risk. */
export default function NewsroomError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <EmptyState
      title="This page could not load"
      action={
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
      }
    >
      Scope could not reach its database just now. Your briefings are safe; try again in a moment.
      {error.digest && (
        <span className="mt-2 block text-meta text-ink-tertiary">Reference {error.digest}</span>
      )}
    </EmptyState>
  );
}
