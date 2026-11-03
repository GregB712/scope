import type { Link as LinkNode, RootContent } from "mdast";
import { toString } from "mdast-util-to-string";
import { visit } from "unist-util-visit";
import type { TopicMatcher } from "../topics/match";
import { findDate } from "../time";
import { carriersOf, extractPairs, normalizeLabel, storyFieldFor, type StoryField } from "./labels";
import { markdownToPlain, parseMarkdown } from "./markdown";
import type { Link, ParseWarning, ParsedStory } from "./types";

/** Fields that make a labelled block look like a news item rather than, say, metadata. */
const CORE_FIELDS: ReadonlySet<StoryField> = new Set([
  "category",
  "importance",
  "summary",
  "whyItMatters",
]);

const IMPORTANCE_WORDS: Record<string, number> = {
  critical: 10,
  "very high": 9,
  high: 8,
  elevated: 7,
  medium: 5,
  moderate: 5,
  low: 3,
  minor: 2,
};

/** "9/10", "9", "4/5" or "High" to an integer from 1 to 10. */
export function parseImportance(text: string): { value: number; fromWords: boolean } | null {
  const numeric = /(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+))?/.exec(text);
  if (numeric) {
    const value = Number(numeric[1]);
    const scale = numeric[2] ? Number(numeric[2]) : 10;
    if (scale > 0) {
      const scaled = Math.round((value / scale) * 10);
      if (scaled >= 1 && scaled <= 10) return { value: scaled, fromWords: false };
    }
  }
  const normalized = text.toLowerCase();
  const word = Object.keys(IMPORTANCE_WORDS)
    .sort((a, b) => b.length - a.length)
    .find((w) => normalized.includes(w));
  return word ? { value: IMPORTANCE_WORDS[word]!, fromWords: true } : null;
}

/** External links in a Markdown snippet, including bare URLs. */
export function linksIn(markdown: string): Link[] {
  const links: Link[] = [];
  visit(parseMarkdown(markdown), "link", (node: LinkNode, index, parent) => {
    if (!/^https?:\/\//i.test(node.url)) return;
    if (links.some((l) => l.url === node.url)) return;
    let title = toString(node).replace(/\s+/g, " ").trim();
    // A bare URL ("Outlet – Headline: https://...") takes its title from the text before it.
    if ((!title || title === node.url) && parent && index !== undefined) {
      const before = parent.children
        .slice(0, index)
        .map((child) => toString(child))
        .join("")
        .replace(/\s+/g, " ")
        .replace(/[\s:–—-]+$/, "")
        .trim();
      title = before || hostname(node.url);
    }
    links.push({ url: node.url, title });
  });
  return links;
}

type StoryInput = {
  title: string;
  anchor: string;
  content: readonly RootContent[];
  source: string;
  position: number;
  matcher: TopicMatcher;
  warnings: ParseWarning[];
  unmatched: Set<string>;
};

/**
 * Builds a story from a section's own content when that content is a labelled
 * block: at least two distinct known fields, one of them a core field.
 * Returns `null` for anything else (plain prose, lists of links, tables).
 */
export function readStory(input: StoryInput): ParsedStory | null {
  const { title, anchor, content, source, position, matcher, warnings, unmatched } = input;
  const pairs = carriersOf(content).flatMap((carrier) => extractPairs(carrier, source));

  const fields = new Map<StoryField, string[]>();
  const extraFields: Record<string, string> = {};
  for (const pair of pairs) {
    const field = storyFieldFor(pair.label);
    if (field) {
      fields.set(field, [...(fields.get(field) ?? []), pair.value]);
    } else if (pair.value) {
      extraFields[pair.label] = pair.value;
    }
  }
  const known = new Set(fields.keys());
  if (known.size < 2 || ![...known].some((f) => CORE_FIELDS.has(f))) return null;

  const joined = (field: StoryField) => {
    const values = fields.get(field)?.filter(Boolean);
    return values?.length ? values.join("\n\n") : null;
  };
  const plain = (field: StoryField) => {
    const value = joined(field);
    return value ? markdownToPlain(value) : null;
  };

  // Category and topics.
  const categoryRaw = plain("category");
  let topicIds: string[] = [];
  if (categoryRaw) {
    const match = matcher.matchCategory(categoryRaw);
    topicIds = match.topicIds;
    match.unmatched.forEach((phrase) => unmatched.add(phrase));
  } else {
    warnings.push({ code: "story_without_category", message: `"${title}" has no category.` });
  }

  // Importance.
  let importance: number | null = null;
  const importanceText = plain("importance");
  if (importanceText) {
    const parsed = parseImportance(importanceText);
    importance = parsed?.value ?? null;
    if (parsed?.fromWords) {
      warnings.push({
        code: "importance_from_words",
        message: `"${title}": importance "${importanceText}" mapped to ${parsed.value}/10.`,
      });
    }
  }

  // Dates: the label says which date it is.
  let eventDate: string | null = null;
  let publishedDate: string | null = null;
  const dateLines: string[] = [];
  for (const pair of pairs) {
    if (storyFieldFor(pair.label) !== "dates") continue;
    const text = markdownToPlain(pair.value);
    dateLines.push(`${pair.label}: ${text}`);
    const date = findDate(text);
    const label = normalizeLabel(pair.label);
    if (date && /publish|report/.test(label)) publishedDate ??= date;
    if (date && (/event/.test(label) || !/publish|report/.test(label))) eventDate ??= date;
  }

  // Sources: links when present, otherwise the plain list of outlet names.
  const sourcesMarkdown = joined("sources");
  const sourceLinks = sourcesMarkdown ? linksIn(sourcesMarkdown) : [];
  const sourceText =
    sourcesMarkdown && sourceLinks.length === 0 ? markdownToPlain(sourcesMarkdown) : null;

  return {
    position,
    title,
    anchor,
    categoryRaw,
    topicIds,
    importance,
    confidence: plain("confidence"),
    eventDate,
    publishedDate,
    datesText: dateLines.length ? dateLines.join("\n") : null,
    summary: joined("summary"),
    whyItMatters: joined("whyItMatters"),
    implications: joined("implications"),
    whatToWatch: joined("whatToWatch"),
    extraFields,
    sourceLinks,
    sourceText,
  };
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
