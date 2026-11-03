import { and, eq, like } from "drizzle-orm";
import { PARSER_VERSION, type ParsedReport } from "@/core/parser";
import { reportSlugFromFileName } from "@/core/slug";
import { reportSections, reportTopics, reports, stories, storyTopics } from "@/server/db/schema";
import type { Database } from "@/server/db/types";
import type { RemoteFile } from "@/server/sources/types";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Columns derived from parsing; rewritten on every import and re-parse. */
function derivedColumns(parsed: ParsedReport) {
  return {
    title: parsed.title,
    reportDate: parsed.reportDate,
    generatedAt: parsed.generatedAt,
    timezone: parsed.timezone,
    researchWindowStart: parsed.researchWindow?.start ?? null,
    researchWindowEnd: parsed.researchWindow?.end ?? null,
    researchWindowText: parsed.researchWindow?.text ?? null,
    summary: parsed.summary,
    sourceLinks: parsed.sourceLinks,
    plainText: parsed.plainText,
    parserVersion: PARSER_VERSION,
    parseWarnings: parsed.warnings,
    outline: parsed.outline,
  };
}

/** A slug unique within the newsroom: the file-name slug, suffixed on collision. */
async function uniqueSlug(tx: Tx, newsroomId: string, fileName: string): Promise<string> {
  const base = reportSlugFromFileName(fileName);
  const taken = new Set(
    (
      await tx
        .select({ slug: reports.slug })
        .from(reports)
        .where(and(eq(reports.newsroomId, newsroomId), like(reports.slug, `${base}%`)))
    ).map((r) => r.slug),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** Replaces sections, stories and topic links of a report with freshly parsed ones. */
async function replaceDerived(tx: Tx, reportId: string, parsed: ParsedReport) {
  await tx.delete(reportSections).where(eq(reportSections.reportId, reportId));
  await tx.delete(stories).where(eq(stories.reportId, reportId)); // cascades story_topics
  await tx.delete(reportTopics).where(eq(reportTopics.reportId, reportId));

  if (parsed.sections.length) {
    await tx.insert(reportSections).values(parsed.sections.map((s) => ({ ...s, reportId })));
  }
  if (parsed.stories.length) {
    const inserted = await tx
      .insert(stories)
      .values(parsed.stories.map(({ topicIds: _topics, ...story }) => ({ ...story, reportId })))
      .returning({ id: stories.id, position: stories.position });
    const links = inserted.flatMap(({ id, position }) =>
      (parsed.stories.find((s) => s.position === position)?.topicIds ?? []).map((topicId) => ({
        storyId: id,
        topicId,
      })),
    );
    if (links.length) await tx.insert(storyTopics).values(links);
  }
  if (parsed.topicCounts.size) {
    await tx
      .insert(reportTopics)
      .values(
        [...parsed.topicCounts].map(([topicId, storyCount]) => ({ reportId, topicId, storyCount })),
      );
  }
}

export type PersistInput = {
  newsroomId: string;
  sourceId: string;
  file: RemoteFile;
  raw: string;
  contentHash: string;
  parsed: ParsedReport;
};

/**
 * Inserts or updates a report keyed by (newsroom, source file) and rewrites its
 * derived rows, atomically. Returns whether the report was new.
 */
export async function persistReport(
  db: Database,
  input: PersistInput,
): Promise<{ id: string; created: boolean }> {
  const { newsroomId, sourceId, file, raw, contentHash, parsed } = input;
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: reports.id })
      .from(reports)
      .where(and(eq(reports.newsroomId, newsroomId), eq(reports.sourceFileId, file.id)));

    const sourceColumns = {
      sourceId,
      sourcePath: file.path,
      sourceFileName: file.name,
      sourceMimeType: file.mimeType,
      sourceCreatedAt: file.createdAt,
      sourceModifiedAt: file.modifiedAt,
      sourceChecksum: file.checksum,
      sourceMissingAt: null,
      rawMarkdown: raw,
      contentHash,
      ...derivedColumns(parsed),
    };

    let id: string;
    if (existing) {
      id = existing.id;
      await tx.update(reports).set(sourceColumns).where(eq(reports.id, id));
    } else {
      const slug = await uniqueSlug(tx, newsroomId, file.name);
      const [row] = await tx
        .insert(reports)
        .values({ newsroomId, sourceFileId: file.id, slug, ...sourceColumns })
        .returning({ id: reports.id });
      id = row!.id;
    }
    await replaceDerived(tx, id, parsed);
    return { id, created: !existing };
  });
}

/** Re-parse path: rewrites only derived data of an existing report. */
export async function rewriteDerived(
  db: Database,
  reportId: string,
  parsed: ParsedReport,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(reports).set(derivedColumns(parsed)).where(eq(reports.id, reportId));
    await replaceDerived(tx, reportId, parsed);
  });
}
