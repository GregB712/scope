import { cn } from "@/lib/utils";

/** Placeholder block shaped like the content it stands in for. No shimmer: it is decoration. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("rounded-md bg-surface", className)} />;
}
