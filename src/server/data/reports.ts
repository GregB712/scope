import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { reportTopics, reports, stories, storyTopics, topics } from "@/server/db/schema";
import type { Database } from "@/server/db/types";
import type { AuthorizedNewsroom } from "./newsroom-access";
import { HIGHLIGHT, tsQuery } from "./search-syntax";

/** Newest first: by date, then generation time, then import order. */
const newestFirst = [
  desc(reports.reportDate),
  sql`${reports.generatedAt} desc nulls last`,
  desc(reports.importedAt),
];
const oldestFirst = [
  asc(reports.reportDate),
  sql`${reports.generatedAt} asc nulls first`,
  asc(reports.importedAt),
];

export type TopicTag = { name: string; slug: string };

export type ReportListItem = {
  id: string;
  slug: string;
  title: string;
  reportDate: string;
  generatedAt: Date | null;
  timezone: string | null;
  summary: string | null;
  sourceMissing: boolean;
  storyCount: number;
  topImportance: number | null;
  leadStory: string | null;
  snippet: string | null;
  topics: TopicTag[];
};

export type ReportFilters = {
  q?: string;
  from?: string;
  to?: string;
  topic?: string;
  minImportance?: number;
  sort?: "newest" | "oldest";
  page?: number;
  pageSize?: number;
};

// Correlated subqueries reference the outer table as `${reports}.id`: inside a select
// list Drizzle renders `${reports.id}` unqualified, which would bind to the inner table.
const storyCount = sql<number>`(select count(*)::int from ${stories} s where s.report_id = ${reports}.id)`;
const topImportance = sql<
  number | null
>`(select max(s.importance)::int from ${stories} s where s.report_id = ${reports}.id)`;
const leadStory = sql<
  string | null
>`(select s.title from ${stories} s where s.report_id = ${reports}.id order by s.importance desc nulls last, s.position limit 1)`;

async function topicsForReports(
  db: Database,
  reportIds: string[],
): Promise<Map<string, TopicTag[]>> {
  const map = new Map<string, TopicTag[]>();
  if (!reportIds.length) return map;
  const rows = await db
    .select({ reportId: reportTopics.reportId, name: topics.name, slug: topics.slug })
    .from(reportTopics)
    .innerJoin(topics, eq(topics.id, reportTopics.topicId))
    .where(inArray(reportTopics.reportId, reportIds))
    .orderBy(desc(reportTopics.storyCount), asc(topics.position));
  for (const row of rows)
    map.set(row.reportId, [...(map.get(row.reportId) ?? []), { name: row.name, slug: row.slug }]);
  return map;
}

export async function listReports(
  db: Database,
  newsroom: AuthorizedNewsroom,
  filters: ReportFilters = {},
): Promise<{ items: ReportListItem[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const query = filters.q?.trim() ? tsQuery(filters.q) : null;

  const conditions: SQL[] = [eq(reports.newsroomId, newsroom.id)];
  if (query) conditions.push(sql`${reports.searchVector} @@ ${query}`);
  if (filters.from) conditions.push(gte(reports.reportDate, filters.from));
  if (filters.to) conditions.push(lte(reports.reportDate, filters.to));
  if (filters.topic) {
    conditions.push(sql`exists (
      select 1 from ${reportTopics} rt join ${topics} t on t.id = rt.topic_id
      where rt.report_id = ${reports.id} and t.newsroom_id = ${newsroom.id} and t.slug = ${filters.topic})`);
  }
  if (filters.minImportance) {
    conditions.push(
      sql`exists (select 1 from ${stories} s where s.report_id = ${reports.id} and s.importance >= ${filters.minImportance})`,
    );
  }

  const rows = await db
    .select({
      id: reports.id,
      slug: reports.slug,
      title: reports.title,
      reportDate: reports.reportDate,
      generatedAt: reports.generatedAt,
      timezone: reports.timezone,
      summary: reports.summary,
      sourceMissingAt: reports.sourceMissingAt,
      storyCount,
      topImportance,
      leadStory,
      snippet: query
        ? sql<string>`ts_headline('english', ${reports.plainText}, ${query}, ${HIGHLIGHT})`
        : sql<null>`null`,
      total: sql<number>`count(*) over ()::int`,
    })
    .from(reports)
    .where(and(...conditions))
    .orderBy(...(filters.sort === "oldest" ? oldestFirst : newestFirst))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const tags = await topicsForReports(
    db,
    rows.map((r) => r.id),
  );
  return {
    items: rows.map(({ total: _total, sourceMissingAt, ...row }) => ({
      ...row,
      sourceMissing: sourceMissingAt !== null,
      topics: tags.get(row.id) ?? [],
    })),
    total: rows[0]?.total ?? 0,
    page,
    pageSize,
  };
}

export type StoryDetail = {
  id: string;
  position: number;
  title: string;
  anchor: string;
  categoryRaw: string | null;
  importance: number | null;
  confidence: string | null;
  eventDate: string | null;
  summary: string | null;
  topics: TopicTag[];
};

export async function getReport(db: Database, newsroom: AuthorizedNewsroom, slug: string) {
  const [report] = await db
    .select()
    .from(reports)
    .where(and(eq(reports.newsroomId, newsroom.id), eq(reports.slug, slug)));
  if (!report) return null;

  const storyRows = await db
    .select({
      id: stories.id,
      position: stories.position,
      title: stories.title,
      anchor: stories.anchor,
      categoryRaw: stories.categoryRaw,
      importance: stories.importance,
      confidence: stories.confidence,
      eventDate: stories.eventDate,
      summary: stories.summary,
    })
    .from(stories)
    .where(eq(stories.reportId, report.id))
    .orderBy(asc(stories.position));
  const storyTags = await topicsForStories(
    db,
    storyRows.map((s) => s.id),
  );
  const reportTags = (await topicsForReports(db, [report.id])).get(report.id) ?? [];

  // Neighbouring editions in reading order. Row comparison keeps ties stable.
  const key = sql`(${reports.reportDate}, coalesce(${reports.generatedAt}, 'epoch'::timestamptz), ${reports.id})`;
  const current = sql`(${report.reportDate}::date, coalesce(${report.generatedAt}::timestamptz, 'epoch'::timestamptz), ${report.id}::uuid)`;
  const neighbour = (direction: "older" | "newer") =>
    db
      .select({
        slug: reports.slug,
        title: reports.title,
        reportDate: reports.reportDate,
        generatedAt: reports.generatedAt,
      })
      .from(reports)
      .where(
        and(
          eq(reports.newsroomId, newsroom.id),
          direction === "older" ? sql`${key} < ${current}` : sql`${key} > ${current}`,
        ),
      )
      .orderBy(direction === "older" ? sql`${key} desc` : sql`${key} asc`)
      .limit(1);
  const [[older], [newer], sameDay] = await Promise.all([
    neighbour("older"),
    neighbour("newer"),
    db
      .select({ slug: reports.slug, generatedAt: reports.generatedAt })
      .from(reports)
      .where(and(eq(reports.newsroomId, newsroom.id), eq(reports.reportDate, report.reportDate)))
      .orderBy(sql`${reports.generatedAt} asc nulls first`, asc(reports.importedAt)),
  ]);

  return {
    report,
    stories: storyRows.map((s) => ({
      ...s,
      topics: storyTags.get(s.id) ?? [],
    })) satisfies StoryDetail[],
    topics: reportTags,
    older: older ?? null,
    newer: newer ?? null,
    editions: sameDay,
  };
}

export async function topicsForStories(
  db: Database,
  storyIds: string[],
): Promise<Map<string, TopicTag[]>> {
  const map = new Map<string, TopicTag[]>();
  if (!storyIds.length) return map;
  const rows = await db
    .select({ storyId: storyTopics.storyId, name: topics.name, slug: topics.slug })
    .from(storyTopics)
    .innerJoin(topics, eq(topics.id, storyTopics.topicId))
    .where(inArray(storyTopics.storyId, storyIds))
    .orderBy(asc(topics.position));
  for (const row of rows)
    map.set(row.storyId, [...(map.get(row.storyId) ?? []), { name: row.name, slug: row.slug }]);
  return map;
}

/** Months that have reports, newest first, for year/month navigation. */
export async function listArchiveMonths(db: Database, newsroom: AuthorizedNewsroom) {
  const month = sql<string>`to_char(${reports.reportDate}, 'YYYY-MM')`;
  return db
    .select({ month, count: sql<number>`count(*)::int` })
    .from(reports)
    .where(eq(reports.newsroomId, newsroom.id))
    .groupBy(month)
    .orderBy(desc(month));
}

export async function getNewsroomStats(db: Database, newsroom: AuthorizedNewsroom) {
  const [row] = await db
    .select({
      reportCount: sql<number>`count(*)::int`,
      latestReportDate: sql<string | null>`max(${reports.reportDate})::text`,
    })
    .from(reports)
    .where(eq(reports.newsroomId, newsroom.id));
  return { reportCount: row?.reportCount ?? 0, latestReportDate: row?.latestReportDate ?? null };
}
