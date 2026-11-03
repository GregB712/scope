import type { Heading, RootContent } from "mdast";
import { visit } from "unist-util-visit";
import { createHeadingSlugger } from "../slug";
import { createTopicMatcher, type TopicRef } from "../topics/match";
import { carriersOf, extractPairs } from "./labels";
import {
  headingText,
  normalizeSource,
  parseMarkdown,
  sliceSource,
  stripNumbering,
  toPlainText,
} from "./markdown";
import { readFileName, readFrontmatter, readMetadataBlock, resolveDates } from "./metadata";
import { classifySection } from "./sections";
import { linksIn, readStory } from "./stories";
import type { ParseWarning, ParsedReport, ParsedSection, ParsedStory } from "./types";

export type { ParsedReport, ParsedSection, ParsedStory } from "./types";

/**
 * Bump when parsing output changes. Reports stored with an older version are
 * re-parsed from their stored Markdown on the next sync, without downloading.
 */
export const PARSER_VERSION = 1;

export type ParseContext = {
  fileName: string;
  /** When the source file was created; the last-resort report date. */
  fallbackDate: Date;
  /** IANA zone used when the report states none. */
  fallbackTimeZone: string;
  topics: readonly TopicRef[];
};

/**
 * Deterministic, never-throwing parse of one report. Whatever cannot be
 * recognized is left out of the structured fields and reported as a warning;
 * the original Markdown is always stored separately by the caller.
 */
export function parseReport(raw: string, context: ParseContext): ParsedReport {
  const warnings: ParseWarning[] = [];
  const source = normalizeSource(raw);
  const tree = parseMarkdown(source);
  const matcher = createTopicMatcher(context.topics);
  const unmatched = new Set<string>();

  if (!source.trim()) {
    warnings.push({ code: "empty_document", message: "The file is empty." });
  }

  // Frontmatter
  const first = tree.children[0];
  const frontmatter = first?.type === "yaml" ? readFrontmatter(first.value, warnings) : {};
  const body = tree.children.filter((node) => node.type !== "yaml");

  // Heading anchors, assigned in document order exactly as the renderer will.
  const slugOf = new Map<Heading, string>();
  const slug = createHeadingSlugger();
  visit(tree, "heading", (node: Heading) => {
    slugOf.set(node, slug(headingText(node)));
  });

  // Title heading: a leading H1.
  const firstHeadingIndex = body.findIndex((node) => node.type === "heading");
  const firstHeading = body[firstHeadingIndex];
  const titleHeading =
    firstHeading?.type === "heading" && firstHeading.depth === 1 ? firstHeading : undefined;

  // Split the body into a preamble and heading-delimited sections.
  const preamble: RootContent[] = [];
  const blocks: { heading: Heading; content: RootContent[] }[] = [];
  for (const node of body) {
    if (node === titleHeading) continue;
    if (node.type === "heading") blocks.push({ heading: node, content: [] });
    else if (blocks.length) blocks[blocks.length - 1]!.content.push(node);
    else preamble.push(node);
  }

  // Metadata
  const metadataPairs = carriersOf(preamble).flatMap((c) => extractPairs(c, source));
  const block = readMetadataBlock(metadataPairs);
  const dates = resolveDates(
    {
      frontmatter,
      block,
      fileName: context.fileName,
      fallbackDate: context.fallbackDate,
      fallbackTimeZone: context.fallbackTimeZone,
    },
    warnings,
  );

  // Sections and stories
  const sections: ParsedSection[] = [];
  const stories: ParsedStory[] = [];
  for (const { heading, content } of blocks) {
    const title = stripNumbering(headingText(heading)) || headingText(heading);
    const anchor = slugOf.get(heading) ?? "";
    const trimmed = dropTrailingRules(content);

    const story = readStory({
      title,
      anchor,
      content: trimmed,
      source,
      position: stories.length,
      matcher,
      warnings,
      unmatched,
    });

    let kind = classifySection(title);
    let topicId: string | null = null;
    if (story) {
      stories.push(story);
      markParentAsTopStories(sections, heading.depth);
    } else {
      topicId = matcher.matchPhrase(title);
      if (topicId) kind = "topic_brief";
    }

    sections.push({
      position: sections.length,
      depth: heading.depth,
      title,
      slug: anchor,
      kind,
      topicId,
      markdown: sliceSource(source, trimmed),
    });
  }
  if (!blocks.length && source.trim()) {
    warnings.push({ code: "no_sections", message: "No section headings found." });
  }

  // Summary: the executive summary, or the opening paragraph of an unstructured note.
  const summary =
    sections.find((s) => s.kind === "executive_summary" && s.markdown)?.markdown ??
    (blocks.length ? null : openingParagraph(preamble, source));

  // Report-level source list.
  const sourcesMarkdown = sections
    .filter((s) => s.kind === "sources")
    .map((s) => s.markdown)
    .join("\n\n");
  const sourceLinks = linksIn(sourcesMarkdown || source);

  // Topics: story counts, plus frontmatter tags.
  const topicCounts = new Map<string, number>();
  for (const story of stories) {
    for (const id of story.topicIds) topicCounts.set(id, (topicCounts.get(id) ?? 0) + 1);
  }
  for (const tag of frontmatter.topics ?? []) {
    const id = matcher.matchPhrase(tag);
    if (id) topicCounts.set(id, topicCounts.get(id) ?? 0);
    else unmatched.add(tag);
  }

  // Title
  let title = frontmatter.title?.trim() || (titleHeading ? headingText(titleHeading) : "");
  if (!title) {
    const fromFile = readFileName(context.fileName).title;
    title = fromFile ? fromFile.charAt(0).toUpperCase() + fromFile.slice(1) : "Untitled report";
    warnings.push({
      code: "no_title",
      message: "No title heading; title taken from the file name.",
    });
  }

  return {
    title,
    ...dates,
    summary,
    plainText: toPlainText(tree).trim(),
    outline: sections.map(({ depth, title: text, slug: s }) => ({ depth, text, slug: s })),
    sections,
    stories,
    sourceLinks,
    topicCounts,
    unmatchedCategories: [...unmatched],
    warnings,
  };
}

function dropTrailingRules(nodes: RootContent[]): RootContent[] {
  let end = nodes.length;
  while (end > 0 && nodes[end - 1]!.type === "thematicBreak") end--;
  return nodes.slice(0, end);
}

/** The nearest enclosing section of a story is a list of stories, whatever it is called. */
function markParentAsTopStories(sections: ParsedSection[], storyDepth: number) {
  for (let i = sections.length - 1; i >= 0; i--) {
    const section = sections[i]!;
    if (section.depth < storyDepth) {
      if (section.kind === "other") section.kind = "top_stories";
      return;
    }
  }
}

function openingParagraph(nodes: readonly RootContent[], source: string): string | null {
  const paragraph = nodes.find((node) => node.type === "paragraph");
  return paragraph ? sliceSource(source, [paragraph]) : null;
}
