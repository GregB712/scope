import type { Metadata } from "next";
import Link from "next/link";
import { DateLabel } from "@/components/newsroom/date-label";
import { Importance } from "@/components/newsroom/importance";
import { PageHeader } from "@/components/newsroom/page-header";
import { EmptyState } from "@/components/newsroom/states";
import { buttonVariants } from "@/components/ui/button";
import { plural } from "@/lib/format";
import { requireNewsroom } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { latestStoriesByTopic, listTopicsWithStats } from "@/server/data/topics";

export const metadata: Metadata = { title: "Topics" };

export default async function TopicsPage({ params }: PageProps<"/n/[newsroom]/topics">) {
  const newsroom = await requireNewsroom((await params).newsroom);
  const db = getDb();
  const [topics, latest] = await Promise.all([
    listTopicsWithStats(db, newsroom),
    latestStoriesByTopic(db, newsroom, 3),
  ]);
  const base = `/n/${newsroom.slug}`;

  if (!topics.length) {
    return (
      <EmptyState
        title="No topics yet"
        action={
          <Link href={`${base}/settings/topics`} className={buttonVariants({ variant: "primary" })}>
            Set up topics
          </Link>
        }
      >
        Topics group stories by the categories your automation writes, such as Cybersecurity or
        Markets.
      </EmptyState>
    );
  }

  return (
    <>
      <PageHeader
        title="Topics"
        description="The research areas your briefings cover, with their latest stories."
        actions={
          <Link href={`${base}/settings/topics`} className="text-ui text-signal">
            Edit topics
          </Link>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-12 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((topic) => {
          const stories = latest.get(topic.id) ?? [];
          return (
            <section key={topic.id} className="border-t border-separator pt-5 pb-10">
              <h2 className="font-serif text-headline font-semibold">
                <Link
                  href={`${base}/topics/${topic.slug}`}
                  className="[@media(hover:hover)]:hover:text-signal"
                >
                  {topic.name}
                </Link>
              </h2>
              {topic.storyCount > 0 && (
                <p className="mt-1 text-meta text-ink-tertiary">
                  {plural(topic.storyCount, "story", "stories")} in{" "}
                  {plural(topic.reportCount, "briefing")}
                  {topic.lastActivity && (
                    <>
                      , latest <DateLabel date={topic.lastActivity} style="short" />
                    </>
                  )}
                </p>
              )}
              {stories.length ? (
                <ul className="hairline-list mt-3">
                  {stories.map((story) => (
                    <li key={`${story.reportSlug}-${story.anchor}`} className="py-2.5">
                      <Link
                        href={`${base}/reports/${story.reportSlug}#${story.anchor}`}
                        className="group block"
                      >
                        <span className="flex items-center gap-3 text-meta text-ink-tertiary">
                          <Importance value={story.importance} />
                          <DateLabel date={story.reportDate} style="short" />
                        </span>
                        <span className="mt-0.5 block text-ui leading-snug [@media(hover:hover)]:group-hover:text-signal">
                          {story.title}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-ui text-ink-secondary">No stories yet.</p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
