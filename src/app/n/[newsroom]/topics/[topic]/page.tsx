import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown/markdown";
import { DateLabel } from "@/components/newsroom/date-label";
import { PageHeader, SectionHeading } from "@/components/newsroom/page-header";
import { Pagination } from "@/components/newsroom/pagination";
import { EmptyState } from "@/components/newsroom/states";
import { StoryRow } from "@/components/newsroom/story-row";
import { plural } from "@/lib/format";
import { requireNewsroom } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { listRecentStories } from "@/server/data/stories";
import { getLatestTopicBrief, getTopic } from "@/server/data/topics";

type Props = PageProps<"/n/[newsroom]/topics/[topic]">;
const PAGE_SIZE = 15;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { newsroom: slug, topic: topicSlug } = await params;
  const topic = await getTopic(getDb(), await requireNewsroom(slug), topicSlug);
  return { title: topic?.name ?? "Topic" };
}

export default async function TopicPage({ params, searchParams }: Props) {
  const { newsroom: slug, topic: topicSlug } = await params;
  const newsroom = await requireNewsroom(slug);
  const db = getDb();
  const topic = await getTopic(db, newsroom, topicSlug);
  if (!topic) notFound();

  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [brief, stories] = await Promise.all([
    getLatestTopicBrief(db, newsroom, topic.id),
    listRecentStories(db, newsroom, {
      topicSlug: topic.slug,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
  ]);
  const base = `/n/${newsroom.slug}`;

  return (
    <>
      <PageHeader
        title={topic.name}
        description={topic.description ?? `${plural(stories.total, "story", "stories")} so far.`}
        actions={
          <Link href={`${base}/reports?topic=${topic.slug}`} className="text-ui text-signal">
            Briefings on this topic
          </Link>
        }
      />
      <div className="grid gap-x-16 gap-y-14 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section>
          <SectionHeading>Stories</SectionHeading>
          {stories.items.length ? (
            <ol className="hairline-list">
              {stories.items.map((story) => (
                <li key={story.id}>
                  <StoryRow newsroom={newsroom.slug} story={story} />
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No stories yet" className="py-10">
              Stories appear here when their category matches “{topic.name}”
              {topic.aliases.length ? ` or one of its aliases (${topic.aliases.join(", ")})` : ""}.
            </EmptyState>
          )}
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={stories.total}
            hrefFor={(p) => `${base}/topics/${topic.slug}${p > 1 ? `?page=${p}` : ""}`}
          />
        </section>
        {brief && (
          <aside>
            <SectionHeading
              action={
                <Link
                  href={`${base}/reports/${brief.reportSlug}#${brief.anchor}`}
                  className="text-meta text-signal"
                >
                  In context
                </Link>
              }
            >
              Latest brief
            </SectionHeading>
            <p className="mb-3 text-meta text-ink-tertiary">
              <DateLabel date={brief.reportDate} style="long" />
            </p>
            <Markdown source={brief.markdown} className="text-ui [&]:font-sans" />
          </aside>
        )}
      </div>
    </>
  );
}
