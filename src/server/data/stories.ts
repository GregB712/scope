import { and, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import { reports, stories, storyTopics, topics } from "@/server/db/schema";
import type { Database } from "@/server/db/types";
import type { AuthorizedNewsroom } from "./newsroom-access";
import { visibleReports } from "./visibility";
import { topicsForStories, type TopicTag } from "./reports";

export type StoryListItem = {
  id: string;
  title: string;
  anchor: string;
  importance: number | null;
  summary: string | null;
  categoryRaw: string | null;
  reportSlug: string;
  reportDate: string;
  topics: TopicTag[];
};

export async function listRecentStories(
  db: Database,
  newsroom: AuthorizedNewsroom,
  options: {
    limit?: number;
    offset?: number;
    topicSlug?: string;
    since?: string;
    minImportance?: number;
  } = {},
): Promise<{ items: StoryListItem[]; total: number }> {
  const conditions: SQL[] = [visibleReports(newsroom)];
  if (options.since) conditions.push(gte(reports.reportDate, options.since));
  if (options.minImportance) conditions.push(gte(stories.importance, options.minImportance));
  if (options.topicSlug) {
    conditions.push(sql`exists (
      select 1 from ${storyTopics} st join ${topics} t on t.id = st.topic_id
      where st.story_id = ${stories.id} and t.newsroom_id = ${newsroom.id} and t.slug = ${options.topicSlug})`);
  }

  const rows = await db
    .select({
      id: stories.id,
      title: stories.title,
      anchor: stories.anchor,
      importance: stories.importance,
      summary: stories.summary,
      categoryRaw: stories.categoryRaw,
      reportSlug: reports.slug,
      reportDate: reports.reportDate,
      total: sql<number>`count(*) over ()::int`,
    })
    .from(stories)
    .innerJoin(reports, eq(reports.id, stories.reportId))
    .where(and(...conditions))
    .orderBy(
      desc(reports.reportDate),
      sql`${reports.generatedAt} desc nulls last`,
      sql`${stories.importance} desc nulls last`,
      stories.position,
    )
    .limit(options.limit ?? 10)
    .offset(options.offset ?? 0);

  const tags = await topicsForStories(
    db,
    rows.map((r) => r.id),
  );
  return {
    items: rows.map(({ total: _total, ...row }) => ({ ...row, topics: tags.get(row.id) ?? [] })),
    total: rows[0]?.total ?? 0,
  };
}
