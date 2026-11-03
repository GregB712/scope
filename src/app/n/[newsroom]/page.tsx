import type { Metadata } from "next";
import Link from "next/link";
import { EditionList } from "@/components/newsroom/edition-group";
import { SectionHeading } from "@/components/newsroom/page-header";
import { EmptyState } from "@/components/newsroom/states";
import { StoryRow } from "@/components/newsroom/story-row";
import { buttonVariants } from "@/components/ui/button";
import { cityOf, formatDate, formatLongDate, formatTime, plural } from "@/lib/format";
import { summaryParts } from "@/lib/report-text";
import { requireNewsroom } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { getNewsroomStats, getReport, listReports } from "@/server/data/reports";
import { listSources } from "@/server/data/sources";
import { listRecentStories } from "@/server/data/stories";
import { listTopicsWithStats } from "@/server/data/topics";

export const metadata: Metadata = { title: "Today" };

/** The date a week before `date` (YYYY-MM-DD). */
const weekBefore = (date: string) =>
  new Date(Date.parse(`${date}T00:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10);

export default async function TodayPage({ params }: PageProps<"/n/[newsroom]">) {
  const newsroom = await requireNewsroom((await params).newsroom);
  const db = getDb();
  const [stats, recent, sources, topics] = await Promise.all([
    getNewsroomStats(db, newsroom),
    listReports(db, newsroom, { pageSize: 7 }),
    listSources(db, newsroom),
    listTopicsWithStats(db, newsroom),
  ]);
  const base = `/n/${newsroom.slug}`;

  const [latest, ...earlier] = recent.items;
  if (!latest) {
    return sources.length ? (
      <EmptyState
        title="No briefings yet"
        action={
          <Link href={`${base}/settings/source`} className={buttonVariants({ variant: "primary" })}>
            Sync now
          </Link>
        }
      >
        Your source is connected. Run a sync to import the reports in your folder.
      </EmptyState>
    ) : (
      <EmptyState
        title="Connect your briefings"
        action={
          <Link href={`${base}/settings/source`} className={buttonVariants({ variant: "primary" })}>
            Connect Google Drive
          </Link>
        }
      >
        Scope reads the Markdown reports your automation saves to Google Drive. Connect the folder
        to bring them in.
      </EmptyState>
    );
  }

  const [edition, week] = await Promise.all([
    getReport(db, newsroom, latest.slug),
    listRecentStories(db, newsroom, {
      limit: 6,
      since: weekBefore(latest.reportDate),
      minImportance: 7,
    }),
  ]);
  const leadStories = edition?.stories.slice(0, 5) ?? [];
  const points = summaryParts(latest.summary, 5);
  const weekStories = week.items.filter((s) => s.reportSlug !== latest.slug).slice(0, 5);
  const activeTopics = topics
    .filter((t) => t.storyCount > 0)
    .sort(
      (a, b) =>
        (b.lastActivity ?? "").localeCompare(a.lastActivity ?? "") || b.storyCount - a.storyCount,
    );

  return (
    <div className="space-y-20">
      {/* Lead: the latest edition */}
      <section
        aria-labelledby="lead-title"
        className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <div>
          <p className="text-meta font-medium text-ink-secondary">
            <time dateTime={latest.reportDate}>{formatLongDate(latest.reportDate)}</time>
          </p>
          <h1 id="lead-title" className="mt-3 font-serif text-display font-semibold text-balance">
            <Link
              href={`${base}/reports/${latest.slug}`}
              className="transition-colors duration-150 [@media(hover:hover)]:hover:text-signal"
            >
              {latest.leadStory ?? latest.title}
            </Link>
          </h1>
          <p className="mt-3 text-ui text-ink-secondary">
            {latest.title}
            {latest.generatedAt && (
              <>
                , <span className="tabular">{formatTime(latest.generatedAt, latest.timezone)}</span>{" "}
                {cityOf(latest.timezone)} time
              </>
            )}
          </p>

          {points.length > 0 && (
            <ul className="mt-8 space-y-3 font-serif text-[1.125rem] leading-relaxed">
              {points.map((point, i) => (
                <li
                  key={i}
                  className="relative pl-5 before:absolute before:top-[0.7em] before:left-0 before:size-1.5 before:rounded-full before:bg-ink-tertiary"
                >
                  {point.lead && <strong className="font-semibold">{point.lead} </strong>}
                  {point.text}
                </li>
              ))}
            </ul>
          )}

          <Link
            href={`${base}/reports/${latest.slug}`}
            className={buttonVariants({ variant: "primary", className: "mt-8" })}
          >
            Read the briefing
          </Link>
        </div>

        <aside aria-labelledby="top-stories">
          <h2 id="top-stories" className="mb-1 text-meta font-medium text-ink">
            Top stories
          </h2>
          <ol className="hairline-list">
            {leadStories.map((story) => (
              <li key={story.id}>
                <StoryRow
                  newsroom={newsroom.slug}
                  story={{
                    ...story,
                    topics: undefined,
                    reportSlug: latest.slug,
                    reportDate: latest.reportDate,
                  }}
                  showSummary={false}
                  showDate={false}
                />
              </li>
            ))}
          </ol>
        </aside>
      </section>

      {/* The week and the topics */}
      <div className="grid gap-x-16 gap-y-16 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <SectionHeading
            action={
              <Link href={`${base}/reports`} className="text-meta text-signal">
                Archive
              </Link>
            }
          >
            Earlier this week
          </SectionHeading>
          {weekStories.length ? (
            <ol className="hairline-list">
              {weekStories.map((story) => (
                <li key={story.id}>
                  <StoryRow newsroom={newsroom.slug} story={story} />
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-4 text-ui text-ink-secondary">
              No other major stories in the past week.
            </p>
          )}
        </section>

        <section>
          <SectionHeading
            action={
              <Link href={`${base}/topics`} className="text-meta text-signal">
                All topics
              </Link>
            }
          >
            Topics
          </SectionHeading>
          {activeTopics.length ? (
            <ul className="hairline-list">
              {activeTopics.slice(0, 8).map((topic) => (
                <li key={topic.id}>
                  <Link
                    href={`${base}/topics/${topic.slug}`}
                    className="group flex items-baseline justify-between gap-4 py-2.5"
                  >
                    <span className="text-ui [@media(hover:hover)]:group-hover:text-signal">
                      {topic.name}
                    </span>
                    <span className="tabular shrink-0 text-meta text-ink-tertiary">
                      {topic.storyCount}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-ui text-ink-secondary">
              Stories will be grouped here once their categories match your{" "}
              <Link href={`${base}/settings/topics`} className="text-signal">
                topics
              </Link>
              .
            </p>
          )}
        </section>
      </div>

      {/* History */}
      {earlier.length > 0 && (
        <section>
          <SectionHeading
            action={
              <span className="text-meta text-ink-tertiary">
                {plural(stats.reportCount, "briefing")}
                {stats.latestReportDate ? `, latest ${formatDate(stats.latestReportDate)}` : ""}
              </span>
            }
          >
            Earlier editions
          </SectionHeading>
          <EditionList newsroom={newsroom.slug} items={earlier} />
          <Link href={`${base}/reports`} className="mt-4 inline-block text-ui text-signal">
            Browse the archive
          </Link>
        </section>
      )}
    </div>
  );
}
