import Link from "next/link";
import type { ReportListItem } from "@/server/data/reports";
import { formatTime, formatWeekday, cityOf, plural } from "@/lib/format";
import { summaryPoints } from "@/lib/report-text";
import { cn } from "@/lib/utils";
import { DateLabel } from "./date-label";
import { Highlighted } from "./highlighted";
import { Importance } from "./importance";
import { TopicList } from "./topic-badge";

/**
 * One edition in a list. The headline is the edition's most important story,
 * because every edition shares the same report title.
 */
export function ReportCard({
  newsroom,
  report,
  variant = "row",
  showDate = true,
}: {
  newsroom: string;
  report: ReportListItem;
  variant?: "row" | "tile";
  showDate?: boolean;
}) {
  const href = `/n/${newsroom}/reports/${report.slug}`;
  const headline = report.leadStory ?? report.title;
  const lead = report.snippet ? null : summaryPoints(report.summary, 1)[0];
  const time = report.generatedAt ? formatTime(report.generatedAt, report.timezone) : null;

  return (
    <article
      className={cn(
        "group relative",
        variant === "row" ? "flex gap-5 py-5 sm:gap-8" : "flex h-full flex-col py-5",
      )}
    >
      {variant === "row" && showDate && (
        <div className="w-14 shrink-0 pt-0.5 sm:w-20">
          <DateLabel
            date={report.reportDate}
            style="short"
            className="block text-ui font-semibold"
          />
          <span className="block text-meta text-ink-tertiary">
            {formatWeekday(report.reportDate)}
          </span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        {variant === "tile" && (
          <DateLabel
            date={report.reportDate}
            style="medium"
            className="mb-1 block text-meta text-ink-secondary"
          />
        )}
        <h3 className="font-serif text-[1.25rem] leading-snug font-semibold text-balance">
          {/* The whole card is clickable through this link's pseudo-element. */}
          <Link
            href={href}
            className="transition-colors duration-150 after:absolute after:inset-0 [@media(hover:hover)]:group-hover:text-signal"
          >
            {headline}
          </Link>
        </h3>
        {report.snippet ? (
          <p className="mt-1.5 line-clamp-3 text-ui text-ink-secondary">
            <Highlighted snippet={report.snippet} />
          </p>
        ) : (
          lead && <p className="mt-1.5 line-clamp-2 text-ui text-ink-secondary">{lead}</p>
        )}
        <div className="relative z-10 mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-meta text-ink-tertiary">
          <Importance value={report.topImportance} />
          <span>{report.title}</span>
          {time && (
            <span className="tabular">
              {time} {cityOf(report.timezone)}
            </span>
          )}
          <span>{plural(report.storyCount, "story", "stories")}</span>
        </div>
        {report.topics.length > 0 && (
          <div className="relative z-10 mt-3">
            <TopicList newsroom={newsroom} topics={report.topics} />
          </div>
        )}
      </div>
    </article>
  );
}
