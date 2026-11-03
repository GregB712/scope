import type { Metadata } from "next";
import Link from "next/link";
import { EditionList } from "@/components/newsroom/edition-group";
import { FilterBar } from "@/components/newsroom/filter-bar";
import { PageHeader } from "@/components/newsroom/page-header";
import { Pagination } from "@/components/newsroom/pagination";
import { EmptyState } from "@/components/newsroom/states";
import { formatMonthYear, plural } from "@/lib/format";
import { parseArchiveParams, toQuery } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { requireNewsroom } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { listArchiveMonths, listReports } from "@/server/data/reports";
import { listTopics } from "@/server/data/topics";

export const metadata: Metadata = { title: "Archive" };

export default async function ArchivePage({
  params,
  searchParams,
}: PageProps<"/n/[newsroom]/reports">) {
  const newsroom = await requireNewsroom((await params).newsroom);
  const filters = parseArchiveParams(await searchParams);
  const db = getDb();
  const [result, months, topics] = await Promise.all([
    listReports(db, newsroom, { ...filters, pageSize: 20 }),
    listArchiveMonths(db, newsroom),
    listTopics(db, newsroom),
  ]);

  const action = `/n/${newsroom.slug}/reports`;
  const query = (overrides: Record<string, string | number | undefined>) =>
    toQuery({
      q: filters.q,
      month: filters.month,
      from: filters.month ? undefined : filters.from,
      to: filters.month ? undefined : filters.to,
      topic: filters.topic,
      importance: filters.minImportance,
      sort: filters.sort === "oldest" ? "oldest" : undefined,
      view: filters.view === "grid" ? "grid" : undefined,
      ...overrides,
    });

  const years = [...new Set(months.map((m) => m.month.slice(0, 4)))];

  return (
    <>
      <PageHeader
        title="Archive"
        description={`${plural(
          months.reduce((n, m) => n + m.count, 0),
          "briefing",
        )} imported from your source.`}
      />

      <div className="grid gap-10 lg:grid-cols-[11rem_minmax(0,1fr)]">
        {/* Year and month navigation */}
        <nav aria-label="Months" className="order-2 lg:order-1">
          <Link
            href={`${action}${query({ month: undefined, page: undefined })}`}
            aria-current={!filters.month ? "page" : undefined}
            className="mb-4 block text-ui text-ink-secondary aria-[current=page]:font-medium aria-[current=page]:text-ink"
          >
            All months
          </Link>
          <div className="space-y-5 lg:sticky lg:top-24">
            {years.map((year) => (
              <section key={year}>
                <h2 className="mb-1.5 text-meta font-medium text-ink-tertiary">{year}</h2>
                <ul className="flex flex-wrap gap-1.5 lg:block lg:space-y-0.5">
                  {months
                    .filter((m) => m.month.startsWith(year))
                    .map((m) => (
                      <li key={m.month}>
                        <Link
                          href={`${action}${query({ month: m.month, from: undefined, to: undefined, page: undefined })}`}
                          aria-current={filters.month === m.month ? "page" : undefined}
                          className={cn(
                            "flex items-baseline justify-between gap-3 rounded-md py-1 text-ui text-ink-secondary [@media(hover:hover)]:hover:text-ink",
                            "max-lg:rounded-full max-lg:bg-surface max-lg:px-3",
                            "aria-[current=page]:font-medium aria-[current=page]:text-signal",
                          )}
                        >
                          <span>{formatMonthYear(m.month).replace(` ${year}`, "")}</span>
                          <span className="tabular text-meta text-ink-tertiary">{m.count}</span>
                        </Link>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </div>
        </nav>

        <div className="order-1 min-w-0 lg:order-2">
          <FilterBar action={action} params={filters} topics={topics} />

          <p className="mt-8 mb-1 text-meta text-ink-secondary" aria-live="polite">
            {filters.month ? `${formatMonthYear(filters.month)}: ` : ""}
            {plural(result.total, "briefing")}
          </p>

          {result.items.length ? (
            <EditionList newsroom={newsroom.slug} items={result.items} view={filters.view} />
          ) : (
            <EmptyState title="No briefings match">
              Try a broader search, or clear the filters to see the whole archive.
            </EmptyState>
          )}

          <Pagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            hrefFor={(page) => `${action}${query({ page: page > 1 ? page : undefined })}`}
          />
        </div>
      </div>
    </>
  );
}
