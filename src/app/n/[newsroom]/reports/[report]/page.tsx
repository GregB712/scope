import { ArrowLeft, ArrowRight, Download, ExternalLink, ListTree } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown/markdown";
import { TableOfContents } from "@/components/markdown/toc";
import { DateLabel } from "@/components/newsroom/date-label";
import { Importance } from "@/components/newsroom/importance";
import { Notice } from "@/components/newsroom/states";
import { TopicList } from "@/components/newsroom/topic-badge";
import { Sheet } from "@/components/ui/sheet";
import { cityOf, formatDate, formatTime, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireNewsroom } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { getReport } from "@/server/data/reports";
import { listSources } from "@/server/data/sources";

type Props = PageProps<"/n/[newsroom]/reports/[report]">;

async function load(params: Props["params"]) {
  const { newsroom: slug, report: reportSlug } = await params;
  const newsroom = await requireNewsroom(slug);
  const found = await getReport(getDb(), newsroom, reportSlug);
  if (!found) notFound();
  return { newsroom, ...found };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { report } = await load(params);
  return { title: `${report.title}, ${formatDate(report.reportDate)}` };
}

const hostname = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export default async function ReportPage({ params }: Props) {
  const { newsroom, report, stories, topics, older, newer, editions } = await load(params);
  const sources = await listSources(getDb(), newsroom);
  const fromDrive = sources.find((s) => s.id === report.sourceId)?.provider === "google_drive";
  const base = `/n/${newsroom.slug}`;
  const toc = report.outline.filter(
    (entry) => entry.depth <= Math.min(...report.outline.map((e) => e.depth)) + 1,
  );
  const generated = report.generatedAt ? formatTime(report.generatedAt, report.timezone) : null;

  return (
    <>
      <div aria-hidden className="reading-progress fixed inset-x-0 top-14 z-40 h-[2px] bg-signal" />

      <article className="grid grid-cols-1 gap-x-14 xl:grid-cols-[13rem_minmax(0,42rem)_15rem] xl:justify-center">
        {/* Masthead */}
        <header className="xl:col-start-2">
          <p className="text-meta font-medium text-ink-secondary">
            <DateLabel date={report.reportDate} style="long" />
          </p>
          <h1 className="mt-2 font-serif text-display font-semibold text-balance">
            {report.title}
          </h1>

          <dl className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-1.5 text-meta sm:grid-cols-[auto_minmax(0,1fr)]">
            {generated && (
              <>
                <dt className="text-ink-tertiary">Generated</dt>
                <dd className="tabular text-ink-secondary">
                  {generated} {report.timezone ? `${cityOf(report.timezone)} time` : "UTC"}
                </dd>
              </>
            )}
            {report.researchWindowText && (
              <>
                <dt className="text-ink-tertiary">Research window</dt>
                <dd className="text-ink-secondary">{report.researchWindowText}</dd>
              </>
            )}
            {editions.length > 1 && (
              <>
                <dt className="text-ink-tertiary">Editions that day</dt>
                <dd>
                  <ul className="flex flex-wrap gap-1.5">
                    {editions.map((edition) => (
                      <li key={edition.slug}>
                        <Link
                          href={`${base}/reports/${edition.slug}`}
                          aria-current={edition.slug === report.slug ? "page" : undefined}
                          className="tabular rounded-full bg-surface px-2.5 py-0.5 text-ink-secondary aria-[current=page]:bg-ink aria-[current=page]:text-canvas"
                        >
                          {edition.generatedAt
                            ? formatTime(edition.generatedAt, report.timezone)
                            : "Edition"}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </dd>
              </>
            )}
          </dl>

          {topics.length > 0 && (
            <div className="mt-5">
              <TopicList newsroom={newsroom.slug} topics={topics} max={8} />
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-meta">
            {fromDrive && (
              <a
                href={`https://drive.google.com/file/d/${encodeURIComponent(report.sourceFileId)}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-signal"
              >
                <ExternalLink className="size-3.5" aria-hidden /> Open in Google Drive
              </a>
            )}
            <a
              href={`${base}/reports/${report.slug}/raw`}
              className="inline-flex items-center gap-1.5 text-signal"
            >
              <Download className="size-3.5" aria-hidden /> Original Markdown
            </a>
            {toc.length > 0 && (
              <div className="xl:hidden">
                <Sheet
                  side="bottom"
                  title="Contents"
                  trigger={
                    <button type="button" className="inline-flex items-center gap-1.5 text-signal">
                      <ListTree className="size-3.5" aria-hidden /> Contents
                    </button>
                  }
                >
                  <TableOfContents entries={toc} />
                </Sheet>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-2">
            {report.sourceMissingAt && (
              <Notice tone="warning">
                This file is no longer in the source folder. The imported copy is kept here.
              </Notice>
            )}
            {report.parseWarnings.length > 0 && (
              <details className="rounded-(--radius-control) bg-surface px-4 py-3 text-meta text-ink-secondary">
                <summary className="cursor-pointer">
                  Import notes ({report.parseWarnings.length})
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {report.parseWarnings.map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </header>

        {/* Contents, sticky on wide screens */}
        <aside className="hidden xl:col-start-1 xl:row-span-2 xl:row-start-1 xl:block">
          <div className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-2">
            <p className="mb-2 text-meta font-medium text-ink">Contents</p>
            <TableOfContents entries={toc} />
          </div>
        </aside>

        {/* The report */}
        <div className="mt-12 border-t border-separator pt-10 xl:col-start-2">
          <Markdown source={report.rawMarkdown} stripMasthead />
        </div>

        {/* Rail: stories and sources */}
        <aside className="mt-16 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:mt-0">
          <div className="space-y-10 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto">
            {stories.length > 0 && (
              <section>
                <h2 className="mb-2 text-meta font-medium text-ink">In this edition</h2>
                <ol className="hairline-list">
                  {stories.map((story) => (
                    <li key={story.id} className="py-2.5">
                      <a href={`#${story.anchor}`} className="group block">
                        <Importance value={story.importance} className="mb-1" />
                        <span className="block text-meta leading-snug text-ink [@media(hover:hover)]:group-hover:text-signal">
                          {story.title}
                        </span>
                      </a>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {report.sourceLinks.length > 0 && (
              <section>
                <h2 className="mb-2 text-meta font-medium text-ink">
                  Sources <span className="text-ink-tertiary">{report.sourceLinks.length}</span>
                </h2>
                <ul className="space-y-2.5">
                  {report.sourceLinks.map((link) => (
                    <li key={link.url} className="text-meta leading-snug">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block"
                      >
                        <span className="block text-ink-secondary [@media(hover:hover)]:group-hover:text-signal">
                          {link.title}
                        </span>
                        <span className="block text-ink-tertiary">{hostname(link.url)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </aside>
      </article>

      {/* Edition pager */}
      <nav
        aria-label="Other editions"
        className="mx-auto mt-20 grid max-w-[42rem] grid-cols-2 gap-6 border-t border-separator pt-6"
      >
        <EditionLink base={base} edition={older} direction="older" />
        <EditionLink base={base} edition={newer} direction="newer" />
      </nav>
      <p className="sr-only">{plural(stories.length, "story", "stories")} in this edition.</p>
    </>
  );
}

function EditionLink({
  base,
  edition,
  direction,
}: {
  base: string;
  edition: { slug: string; title: string; reportDate: string } | null;
  direction: "older" | "newer";
}) {
  if (!edition) return <span />;
  const Icon = direction === "older" ? ArrowLeft : ArrowRight;
  return (
    <Link
      href={`${base}/reports/${edition.slug}`}
      className={cn("group block", direction === "newer" && "text-right")}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1 text-meta text-ink-tertiary",
          direction === "newer" && "flex-row-reverse",
        )}
      >
        <Icon className="size-3.5" aria-hidden />{" "}
        {direction === "older" ? "Previous edition" : "Next edition"}
      </span>
      <span className="mt-1 block text-ui font-medium [@media(hover:hover)]:group-hover:text-signal">
        <DateLabel date={edition.reportDate} style="medium" />
      </span>
    </Link>
  );
}
