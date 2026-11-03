/** Output of the deterministic report parser. Pure data, no database types. */

export type ParseWarning = { code: string; message: string };

export type SectionKind =
  | "executive_summary"
  | "top_stories"
  | "topic_brief"
  | "data_snapshot"
  | "radar"
  | "risk"
  | "outlook"
  | "sources"
  | "other";

export type OutlineEntry = { depth: number; text: string; slug: string };

export type Link = { url: string; title: string };

export type ParsedSection = {
  position: number;
  depth: number;
  title: string;
  slug: string;
  kind: SectionKind;
  topicId: string | null;
  /** The section's own content, excluding sub-sections. */
  markdown: string;
};

export type ParsedStory = {
  position: number;
  title: string;
  /** Heading anchor in the rendered report. */
  anchor: string;
  categoryRaw: string | null;
  topicIds: string[];
  importance: number | null;
  confidence: string | null;
  eventDate: string | null;
  publishedDate: string | null;
  datesText: string | null;
  summary: string | null;
  whyItMatters: string | null;
  implications: string | null;
  whatToWatch: string | null;
  extraFields: Record<string, string>;
  sourceLinks: Link[];
  sourceText: string | null;
};

export type ParsedReport = {
  title: string;
  reportDate: string;
  generatedAt: Date | null;
  timezone: string | null;
  researchWindow: { start: Date | null; end: Date | null; text: string } | null;
  summary: string | null;
  plainText: string;
  outline: OutlineEntry[];
  sections: ParsedSection[];
  stories: ParsedStory[];
  /** The report's source list: the Sources section's links, or every external link. */
  sourceLinks: Link[];
  /** topicId to number of stories in that topic (0 when tagged only by frontmatter). */
  topicCounts: Map<string, number>;
  /** Category phrases that matched no configured topic. */
  unmatchedCategories: string[];
  warnings: ParseWarning[];
};
