import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { slugify } from "@/core/slug";
import { createTopicMatcher, splitCategory } from "@/core/topics/match";
import {
  reportSections,
  reportTopics,
  reports,
  stories,
  storyTopics,
  topics,
} from "@/server/db/schema";
import type { Database } from "@/server/db/types";
import type { AuthorizedNewsroom } from "./newsroom-access";

export type TopicInput = { name: string; aliases: string[]; description?: string | null };

export async function listTopics(db: Database, newsroom: AuthorizedNewsroom) {
  return db
    .select()
    .from(topics)
    .where(eq(topics.newsroomId, newsroom.id))
    .orderBy(asc(topics.position), asc(topics.name));
}

export async function listTopicsWithStats(db: Database, newsroom: AuthorizedNewsroom) {
  return db
    .select({
      id: topics.id,
      name: topics.name,
      slug: topics.slug,
      description: topics.description,
      storyCount: sql<number>`(select count(*)::int from ${storyTopics} st where st.topic_id = ${topics}.id)`,
      reportCount: sql<number>`(select count(*)::int from ${reportTopics} rt where rt.topic_id = ${topics}.id)`,
      lastActivity: sql<
        string | null
      >`(select max(r.report_date)::text from ${reportTopics} rt join ${reports} r on r.id = rt.report_id where rt.topic_id = ${topics}.id)`,
    })
    .from(topics)
    .where(eq(topics.newsroomId, newsroom.id))
    .orderBy(asc(topics.position), asc(topics.name));
}

export async function getTopic(db: Database, newsroom: AuthorizedNewsroom, slug: string) {
  const [topic] = await db
    .select()
    .from(topics)
    .where(and(eq(topics.newsroomId, newsroom.id), eq(topics.slug, slug)));
  return topic ?? null;
}

/** The most recent per-topic section ("Category Intelligence" style), if any. */
export async function getLatestTopicBrief(
  db: Database,
  newsroom: AuthorizedNewsroom,
  topicId: string,
) {
  const [row] = await db
    .select({
      markdown: reportSections.markdown,
      anchor: reportSections.slug,
      reportSlug: reports.slug,
      reportDate: reports.reportDate,
    })
    .from(reportSections)
    .innerJoin(reports, eq(reports.id, reportSections.reportId))
    .where(and(eq(reports.newsroomId, newsroom.id), eq(reportSections.topicId, topicId)))
    .orderBy(desc(reports.reportDate), sql`${reports.generatedAt} desc nulls last`)
    .limit(1);
  return row ?? null;
}

/** Latest stories for each of the newsroom's topics, `perTopic` at most. */
export async function latestStoriesByTopic(
  db: Database,
  newsroom: AuthorizedNewsroom,
  perTopic = 3,
) {
  const ranked = db
    .select({
      topicId: storyTopics.topicId,
      title: stories.title,
      anchor: stories.anchor,
      importance: stories.importance,
      reportSlug: reports.slug,
      reportDate: reports.reportDate,
      rank: sql<number>`row_number() over (partition by ${storyTopics.topicId} order by ${reports.reportDate} desc, ${stories.importance} desc nulls last, ${stories.position})`.as(
        "rank",
      ),
    })
    .from(storyTopics)
    .innerJoin(stories, eq(stories.id, storyTopics.storyId))
    .innerJoin(reports, eq(reports.id, stories.reportId))
    .where(eq(reports.newsroomId, newsroom.id))
    .as("ranked");
  const rows = await db
    .select()
    .from(ranked)
    .where(sql`${ranked.rank} <= ${perTopic}`);
  const map = new Map<string, typeof rows>();
  for (const row of rows) map.set(row.topicId, [...(map.get(row.topicId) ?? []), row]);
  return map;
}

async function uniqueTopicSlug(db: Database, newsroomId: string, name: string, exceptId?: string) {
  const base = slugify(name) || "topic";
  const rows = await db
    .select({ id: topics.id, slug: topics.slug })
    .from(topics)
    .where(and(eq(topics.newsroomId, newsroomId), sql`${topics.slug} like ${base + "%"}`));
  const taken = new Set(rows.filter((r) => r.id !== exceptId).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

const cleanAliases = (aliases: string[]) => [
  ...new Set(aliases.map((a) => a.trim()).filter(Boolean)),
];

export async function createTopic(db: Database, newsroom: AuthorizedNewsroom, input: TopicInput) {
  const [last] = await db
    .select({ position: sql<number>`coalesce(max(${topics.position}), -1)::int` })
    .from(topics)
    .where(eq(topics.newsroomId, newsroom.id));
  const [topic] = await db
    .insert(topics)
    .values({
      newsroomId: newsroom.id,
      name: input.name.trim(),
      slug: await uniqueTopicSlug(db, newsroom.id, input.name),
      aliases: cleanAliases(input.aliases),
      description: input.description ?? null,
      position: (last?.position ?? -1) + 1,
    })
    .returning();
  return topic!;
}

export async function createTopics(
  db: Database,
  newsroom: AuthorizedNewsroom,
  inputs: TopicInput[],
) {
  for (const input of inputs) await createTopic(db, newsroom, input);
}

/** Updates a topic of this newsroom. Returns `false` if the topic is not in the newsroom. */
export async function updateTopic(
  db: Database,
  newsroom: AuthorizedNewsroom,
  topicId: string,
  input: TopicInput,
) {
  const updated = await db
    .update(topics)
    .set({
      name: input.name.trim(),
      slug: await uniqueTopicSlug(db, newsroom.id, input.name, topicId),
      aliases: cleanAliases(input.aliases),
      description: input.description ?? null,
    })
    .where(and(eq(topics.id, topicId), eq(topics.newsroomId, newsroom.id)))
    .returning({ id: topics.id });
  return updated.length > 0;
}

export async function deleteTopic(db: Database, newsroom: AuthorizedNewsroom, topicId: string) {
  const deleted = await db
    .delete(topics)
    .where(and(eq(topics.id, topicId), eq(topics.newsroomId, newsroom.id)))
    .returning({ id: topics.id });
  return deleted.length > 0;
}

/** Sets topic order. Ignores IDs that do not belong to the newsroom. */
export async function reorderTopics(
  db: Database,
  newsroom: AuthorizedNewsroom,
  orderedIds: string[],
) {
  if (!orderedIds.length) return;
  const owned = new Set(
    (
      await db
        .select({ id: topics.id })
        .from(topics)
        .where(and(eq(topics.newsroomId, newsroom.id), inArray(topics.id, orderedIds)))
    ).map((r) => r.id),
  );
  let position = 0;
  for (const id of orderedIds) {
    if (!owned.has(id)) continue;
    await db.update(topics).set({ position: position++ }).where(eq(topics.id, id));
  }
}

/** Category phrases written by the automation that match no topic, most frequent first. */
export async function listUnmappedCategories(db: Database, newsroom: AuthorizedNewsroom) {
  const [topicRows, categoryRows] = await Promise.all([
    listTopics(db, newsroom),
    db
      .select({ category: stories.categoryRaw, count: sql<number>`count(*)::int` })
      .from(stories)
      .innerJoin(reports, eq(reports.id, stories.reportId))
      .where(and(eq(reports.newsroomId, newsroom.id), sql`${stories.categoryRaw} is not null`))
      .groupBy(stories.categoryRaw),
  ]);
  const matcher = createTopicMatcher(topicRows);
  const counts = new Map<string, number>();
  for (const { category, count } of categoryRows) {
    for (const phrase of splitCategory(category ?? "")) {
      if (!matcher.matchPhrase(phrase)) counts.set(phrase, (counts.get(phrase) ?? 0) + count);
    }
  }
  return [...counts]
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase));
}
