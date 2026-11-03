import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { DateLabel } from "@/components/newsroom/date-label";
import { Highlighted } from "@/components/newsroom/highlighted";
import { Importance } from "@/components/newsroom/importance";
import { PageHeader, SectionHeading } from "@/components/newsroom/page-header";
import { SearchField } from "@/components/newsroom/search-field";
import { EmptyState } from "@/components/newsroom/states";
import { TopicBadge } from "@/components/newsroom/topic-badge";
import { plural } from "@/lib/format";
import { requireNewsroom } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { searchNewsroom } from "@/server/data/search";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  params,
  searchParams,
}: PageProps<"/n/[newsroom]/search">) {
  const newsroom = await requireNewsroom((await params).newsroom);
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 200) ?? "";
  const results = await searchNewsroom(getDb(), newsroom, q);
  const base = `/n/${newsroom.slug}`;
  const count = results.reports.length + results.stories.length + results.topics.length;

  return (
    <>
      <PageHeader title="Search" />
      <Form action={`${base}/search`} className="max-w-2xl">
        <SearchField
          defaultValue={q}
          placeholder="Search briefings, stories and topics"
          autoFocus={!q}
        />
      </Form>

      {!q ? (
        <p className="mt-6 text-ui text-ink-secondary">
          Search across every imported briefing. Use quotes for exact phrases, for example “oil
          prices”, and a minus sign to exclude words.
        </p>
      ) : count === 0 ? (
        <EmptyState title={`Nothing found for “${q}”`}>Try fewer or different words.</EmptyState>
      ) : (
        <div className="mt-12 grid gap-x-16 gap-y-14 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-14">
            {results.stories.length > 0 && (
              <section>
                <SectionHeading>Stories</SectionHeading>
                <ul className="hairline-list">
                  {results.stories.map((story) => (
                    <li key={`${story.reportSlug}-${story.anchor}`} className="py-4">
                      <Link
                        href={`${base}/reports/${story.reportSlug}#${story.anchor}`}
                        className="group block"
                      >
                        <span className="flex items-center gap-4 text-meta text-ink-tertiary">
                          <Importance value={story.importance} />
                          <DateLabel date={story.reportDate} />
                        </span>
                        <span className="mt-1 block font-serif text-title font-semibold [@media(hover:hover)]:group-hover:text-signal">
                          {story.title}
                        </span>
                        <span className="mt-1 line-clamp-2 block text-ui text-ink-secondary">
                          <Highlighted snippet={story.snippet} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {results.reports.length > 0 && (
              <section>
                <SectionHeading>Briefings</SectionHeading>
                <ul className="hairline-list">
                  {results.reports.map((report) => (
                    <li key={report.slug} className="py-4">
                      <Link href={`${base}/reports/${report.slug}`} className="group block">
                        <DateLabel
                          date={report.reportDate}
                          style="long"
                          className="text-meta text-ink-tertiary"
                        />
                        <span className="mt-1 block text-title font-semibold [@media(hover:hover)]:group-hover:text-signal">
                          {report.title}
                        </span>
                        <span className="mt-1 line-clamp-3 block text-ui text-ink-secondary">
                          <Highlighted snippet={report.snippet} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <aside>
            <p className="mb-6 text-meta text-ink-secondary" aria-live="polite">
              {plural(count, "result")} for “{q}”
            </p>
            {results.topics.length > 0 && (
              <section>
                <SectionHeading>Topics</SectionHeading>
                <ul className="flex flex-wrap gap-1.5">
                  {results.topics.map((topic) => (
                    <li key={topic.slug}>
                      <TopicBadge newsroom={newsroom.slug} topic={topic} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
