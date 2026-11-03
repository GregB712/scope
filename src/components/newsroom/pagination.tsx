import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Previous/next pagination that preserves the current query string. */
export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const linkClass =
    "pressable inline-flex h-9 items-center gap-1 rounded-(--radius-control) px-3 text-ui text-ink [@media(hover:hover)]:hover:bg-surface";
  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex items-center justify-between border-t border-separator pt-4"
    >
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={linkClass} rel="prev">
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="tabular text-meta text-ink-secondary">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className={cn(linkClass)} rel="next">
          Next <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
