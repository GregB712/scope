import type { Heading, Nodes, Root, RootContent } from "mdast";
import { toString } from "mdast-util-to-string";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ["yaml"]);

/** Parses Markdown (CommonMark + GFM + YAML frontmatter) into an mdast tree. */
export function parseMarkdown(text: string): Root {
  return processor.parse(text);
}

/** Removes a UTF-8 BOM and converts CRLF/CR line endings to LF. */
export function normalizeSource(raw: string): string {
  return raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}

type Positioned = { position?: { start: { offset?: number }; end: { offset?: number } } };

export function startOffset(node: Positioned): number {
  return node.position?.start.offset ?? 0;
}

export function endOffset(node: Positioned): number {
  return node.position?.end.offset ?? 0;
}

/** Original Markdown for a run of sibling nodes. */
export function sliceSource(source: string, nodes: readonly Positioned[]): string {
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (!first || !last) return "";
  return source.slice(startOffset(first), endOffset(last)).trim();
}

export function headingText(heading: Heading): string {
  return toString(heading).trim();
}

/** Strips a leading section number such as "2.1 " or "3. " from a heading. */
export function stripNumbering(text: string): string {
  return text.replace(/^\s*\d+(?:\.\d+)*\.?\s+/, "").trim();
}

const BLOCK_PARENTS = new Set([
  "root",
  "blockquote",
  "list",
  "listItem",
  "table",
  "footnoteDefinition",
]);

/**
 * Readable plain text for search: block boundaries become newlines, table cells
 * are separated by spaces, link URLs and code fences' info strings are dropped.
 */
export function toPlainText(node: Nodes): string {
  switch (node.type) {
    case "text":
    case "inlineCode":
    case "code":
      return node.value;
    case "break":
      return "\n";
    case "image":
      return node.alt ?? "";
    case "yaml":
    case "html":
    case "definition":
    case "thematicBreak":
      return "";
    case "link":
      // A bare URL adds nothing searchable.
      if (toString(node) === node.url) return "";
  }
  if (!("children" in node)) return "";
  const children = (node.children as Nodes[]).map(toPlainText);
  if (node.type === "tableRow") return children.join(" ");
  if (BLOCK_PARENTS.has(node.type)) return children.filter(Boolean).join("\n");
  return children.join("");
}

/** Plain text of a Markdown snippet (used for short label values). */
export function markdownToPlain(markdown: string): string {
  return toPlainText(parseMarkdown(markdown)).replace(/\s+/g, " ").trim();
}

export type { Heading, Nodes, Root, RootContent };
