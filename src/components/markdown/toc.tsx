"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type TocEntry = { depth: number; text: string; slug: string };

/**
 * Table of contents with the current section highlighted. The highlight changes
 * instantly: it tracks reading, not an action that needs feedback.
 */
export function TableOfContents({
  entries,
  onNavigate,
}: {
  entries: TocEntry[];
  onNavigate?: () => void;
}) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const headings = entries
      .map((entry) => document.getElementById(entry.slug))
      .filter((el): el is HTMLElement => el !== null);
    if (!headings.length) return;
    const observer = new IntersectionObserver(
      (records) => {
        const visible = records
          .filter((r) => r.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [entries]);

  if (!entries.length) return null;
  const minDepth = Math.min(...entries.map((e) => e.depth));

  return (
    <nav aria-label="Contents">
      <ol className="space-y-0.5 text-meta">
        {entries.map((entry) => (
          <li key={entry.slug} style={{ paddingLeft: `${(entry.depth - minDepth) * 0.85}rem` }}>
            <a
              href={`#${entry.slug}`}
              onClick={onNavigate}
              aria-current={active === entry.slug ? "location" : undefined}
              className={cn(
                "block rounded-md py-1 leading-snug text-ink-secondary [@media(hover:hover)]:hover:text-ink",
                entry.depth === minDepth && "font-medium",
                active === entry.slug && "text-signal",
              )}
            >
              <span className="line-clamp-2">{entry.text}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
