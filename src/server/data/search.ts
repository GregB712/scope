import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { reports, stories, topics } from "@/server/db/schema";
import type { Database } from "@/server/db/types";
import type { AuthorizedNewsroom } from "./newsroom-access";
import { HIGHLIGHT, tsQuery } from "./search-syntax";

/**
 * Newsroom-wide search over reports, stories and topics. PostgreSQL full-text
 * search today; the single entry point keeps a future engine swap local.
 */
export async function searchNewsroom(
  db: Database,
  newsroom: AuthorizedNewsroom,
  input: string,
  limit = 20,
) {
  const q = input.trim();
  if (!q) return { reports: [], stories: [], topics: [] };
  const query = tsQuery(q);

  const [reportHits, storyHits, topicHits] = await Promise.all([
    db
      .select({
        slug: reports.slug,
        title: reports.title,
        reportDate: reports.reportDate,
        generatedAt: reports.generatedAt,
        snippet: sql<string>`ts_headline('english', ${reports.plainText}, ${query}, ${HIGHLIGHT})`,
        rank: sql<number>`ts_rank_cd(${reports.searchVector}, ${query})`,
      })
      .from(reports)
      .where(and(eq(reports.newsroomId, newsroom.id), sql`${reports.searchVector} @@ ${query}`))
      .orderBy(desc(sql`ts_rank_cd(${reports.searchVector}, ${query})`), desc(reports.reportDate))
      .limit(limit),
    db
      .select({
        title: stories.title,
        anchor: stories.anchor,
        importance: stories.importance,
        reportSlug: reports.slug,
        reportDate: reports.reportDate,
        snippet: sql<string>`ts_headline('english', coalesce(${stories.summary}, ${stories.title}), ${query}, ${HIGHLIGHT})`,
      })
      .from(stories)
      .innerJoin(reports, eq(reports.id, stories.reportId))
      .where(and(eq(reports.newsroomId, newsroom.id), sql`${stories.searchVector} @@ ${query}`))
      .orderBy(desc(sql`ts_rank_cd(${stories.searchVector}, ${query})`), desc(reports.reportDate))
      .limit(limit),
    db
      .select({ name: topics.name, slug: topics.slug })
      .from(topics)
      .where(
        and(
          eq(topics.newsroomId, newsroom.id),
          or(
            ilike(topics.name, `%${escapeLike(q)}%`),
            sql`exists (select 1 from unnest(${topics.aliases}) a where a ilike ${`%${escapeLike(q)}%`})`,
          ),
        ),
      )
      .limit(10),
  ]);
  return { reports: reportHits, stories: storyHits, topics: topicHits };
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
