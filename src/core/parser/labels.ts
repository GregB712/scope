import type { List, ListItem, Paragraph, PhrasingContent, RootContent } from "mdast";
import { toString } from "mdast-util-to-string";
import { endOffset, startOffset } from "./markdown";

/**
 * Extraction of `**Label:** value` pairs, the structure the briefing automation
 * uses for metadata and story fields.
 *
 * A bold run ending in a colon (`**Label:**`, or `**Label**:`) opens a pair when it
 * starts a line. Mid-line it opens a pair only after a separator (`·`, `|`, `;`,
 * `.`, `)`) and only for a known label, so prose like "the **key point:** is..."
 * stays prose. The value runs to the next pair or the end of the carrier, and is
 * returned as the original Markdown.
 */

export type StoryField =
  | "category"
  | "importance"
  | "summary"
  | "whyItMatters"
  | "implications"
  | "whatToWatch"
  | "dates"
  | "confidence"
  | "sources";

export type MetadataField = "date" | "generated" | "researchWindow" | "timezone";

const STORY_LABELS: Record<string, StoryField> = {
  category: "category",
  categories: "category",
  area: "category",
  topic: "category",
  sector: "category",
  importance: "importance",
  "importance score": "importance",
  score: "importance",
  priority: "importance",
  "how important": "importance",
  "what happened": "summary",
  summary: "summary",
  overview: "summary",
  details: "summary",
  "why it matters": "whyItMatters",
  "why this matters": "whyItMatters",
  significance: "whyItMatters",
  implications: "implications",
  consequences: "implications",
  "what to watch": "whatToWatch",
  "what to watch next": "whatToWatch",
  "what to monitor": "whatToWatch",
  "what to monitor next": "whatToWatch",
  watch: "whatToWatch",
  "next steps": "whatToWatch",
  "event date": "dates",
  "event dates": "dates",
  event: "dates",
  published: "dates",
  "published event": "dates",
  "publication date": "dates",
  reported: "dates",
  date: "dates",
  dates: "dates",
  when: "dates",
  confidence: "confidence",
  sources: "sources",
  source: "sources",
  links: "sources",
  references: "sources",
};

const METADATA_LABELS: Record<string, MetadataField> = {
  date: "date",
  "report date": "date",
  generated: "generated",
  "generated at": "generated",
  "research window": "researchWindow",
  window: "researchWindow",
  "coverage window": "researchWindow",
  timezone: "timezone",
  "time zone": "timezone",
};

/** "Implications (financial/technical):" becomes "implications". */
export function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[:/]/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function storyFieldFor(label: string): StoryField | undefined {
  return STORY_LABELS[normalizeLabel(label)];
}

export function metadataFieldFor(label: string): MetadataField | undefined {
  return METADATA_LABELS[normalizeLabel(label)];
}

const isKnownLabel = (label: string) =>
  storyFieldFor(label) !== undefined || metadataFieldFor(label) !== undefined;

export type LabelPair = {
  /** Label as written, without the colon. */
  label: string;
  /** Value as original Markdown. */
  value: string;
};

/** A paragraph that may hold pairs, and where its last value ends. */
export type Carrier = { paragraph: Paragraph; end: number };

/** Paragraphs that can carry labels: direct paragraphs and each list item's lead paragraph. */
export function carriersOf(nodes: readonly RootContent[]): Carrier[] {
  const carriers: Carrier[] = [];
  for (const node of nodes) {
    if (node.type === "paragraph") carriers.push({ paragraph: node, end: endOffset(node) });
    if (node.type === "list") carriers.push(...listCarriers(node));
  }
  return carriers;
}

function listCarriers(list: List): Carrier[] {
  return list.children.flatMap((item: ListItem) => {
    const lead = item.children[0];
    return lead?.type === "paragraph" ? [{ paragraph: lead, end: endOffset(item) }] : [];
  });
}

type Candidate = { label: string; labelStart: number; valueStart: number };

function candidateAt(children: PhrasingContent[], index: number): Candidate | undefined {
  const node = children[index];
  if (node?.type !== "strong") return undefined;
  const text = toString(node).trim();
  if (text.endsWith(":")) {
    return {
      label: text.slice(0, -1).trim(),
      labelStart: startOffset(node),
      valueStart: endOffset(node),
    };
  }
  // `**Label**: value`
  const next = children[index + 1];
  if (next?.type === "text" && next.value.startsWith(":")) {
    return { label: text, labelStart: startOffset(node), valueStart: endOffset(node) + 1 };
  }
  return undefined;
}

function opensPair(candidate: Candidate, carrierStart: number, source: string): boolean {
  if (!candidate.label) return false;
  const before = source.slice(carrierStart, candidate.labelStart).replace(/[ \t]+$/, "");
  if (before === "" || before.endsWith("\n") || before.endsWith("\\")) return true;
  return /[·|;.)]$/.test(before) && isKnownLabel(candidate.label);
}

const cleanValue = (value: string) =>
  value
    .trim()
    .replace(/^:\s*/, "")
    .replace(/\s*[·|;]\s*$/, "")
    .trim();

/** Extracts the label pairs carried by one paragraph. */
export function extractPairs(carrier: Carrier, source: string): LabelPair[] {
  const { paragraph, end } = carrier;
  const carrierStart = startOffset(paragraph);
  const children = paragraph.children;
  const openers: Candidate[] = [];

  for (let i = 0; i < children.length; i++) {
    const candidate = candidateAt(children, i);
    if (candidate && opensPair(candidate, carrierStart, source)) openers.push(candidate);
  }

  return openers.map((opener, i) => {
    const next = openers[i + 1];
    const value = source.slice(opener.valueStart, next ? next.labelStart : end);
    return { label: opener.label, value: cleanValue(value) };
  });
}
