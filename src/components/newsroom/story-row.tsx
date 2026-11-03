import Link from "next/link";
import type { StoryListItem } from "@/server/data/stories";
import { excerpt } from "@/lib/report-text";
import { DateLabel } from "./date-label";
import { Importance } from "./importance";
import { TopicList } from "./topic-badge";

export function StoryRow({
  newsroom,
  story,
  showSummary = true,
  showDate = true,
}: {
  newsroom: string;
  story: Pick<StoryListItem, "title" | "anchor" | "importance" | "reportSlug" | "reportDate"> &
    Partial<Pick<StoryListItem, "summary" | "topics">>;
  showSummary?: boolean;
  showDate?: boolean;
}) {
  const summary = showSummary ? excerpt(story.summary ?? null) : null;
  return (
    <article className="group relative py-4">
      <div className="mb-1.5 flex items-center gap-4 text-meta text-ink-tertiary">
        <Importance value={story.importance} />
        {showDate && <DateLabel date={story.reportDate} style="short" />}
      </div>
      <h3 className="font-serif text-title leading-snug font-semibold text-balance">
        <Link
          href={`/n/${newsroom}/reports/${story.reportSlug}#${story.anchor}`}
          className="transition-colors duration-150 after:absolute after:inset-0 [@media(hover:hover)]:group-hover:text-signal"
        >
          {story.title}
        </Link>
      </h3>
      {summary && <p className="mt-1 line-clamp-2 text-ui text-ink-secondary">{summary}</p>}
      {story.topics && story.topics.length > 0 && (
        <div className="relative z-10 mt-2.5">
          <TopicList newsroom={newsroom} topics={story.topics} max={2} />
        </div>
      )}
    </article>
  );
}
