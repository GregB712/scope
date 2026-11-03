import { asc, eq } from "drizzle-orm";
import { parseReport } from "@/core/parser";
import { newsrooms, reports, topics } from "@/server/db/schema";
import type { Database } from "@/server/db/types";
import { rewriteDerived } from "./persist";

/**
 * Re-parses every stored report of a newsroom from its saved Markdown, without
 * contacting the source. Used after topic changes and parser upgrades.
 */
export async function reprocessNewsroom(
  db: Database,
  newsroomId: string,
): Promise<{ reprocessed: number; failed: { reportId: string; message: string }[] }> {
  const [newsroom] = await db
    .select({ timezone: newsrooms.timezone })
    .from(newsrooms)
    .where(eq(newsrooms.id, newsroomId));
  if (!newsroom) throw new Error("Newsroom not found.");

  const topicRefs = await db
    .select({ id: topics.id, name: topics.name, aliases: topics.aliases })
    .from(topics)
    .where(eq(topics.newsroomId, newsroomId))
    .orderBy(asc(topics.position), asc(topics.name));

  const rows = await db
    .select({
      id: reports.id,
      raw: reports.rawMarkdown,
      fileName: reports.sourceFileName,
      createdAt: reports.sourceCreatedAt,
      importedAt: reports.importedAt,
    })
    .from(reports)
    .where(eq(reports.newsroomId, newsroomId));

  const failed: { reportId: string; message: string }[] = [];
  for (const row of rows) {
    try {
      const parsed = parseReport(row.raw, {
        fileName: row.fileName,
        fallbackDate: row.createdAt ?? row.importedAt,
        fallbackTimeZone: newsroom.timezone,
        topics: topicRefs,
      });
      await rewriteDerived(db, row.id, parsed);
    } catch (error) {
      failed.push({ reportId: row.id, message: (error as Error).message });
    }
  }
  return { reprocessed: rows.length - failed.length, failed };
}
