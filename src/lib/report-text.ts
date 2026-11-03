import "server-only";
import { markdownToPlain, parseMarkdown } from "@/core/parser/markdown";

/** Plain-text bullets of a summary written as a Markdown list (or its paragraphs). */
export function summaryPoints(markdown: string | null, limit = Infinity): string[] {
  if (!markdown) return [];
  const tree = parseMarkdown(markdown);
  const points: string[] = [];
  for (const node of tree.children) {
    if (node.type === "list") {
      for (const item of node.children) {
        const text = markdownToPlain(
          markdown
            .slice(item.position!.start.offset, item.position!.end.offset)
            .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ""),
        );
        if (text) points.push(text);
      }
    } else if (node.type === "paragraph") {
      points.push(
        markdownToPlain(markdown.slice(node.position!.start.offset, node.position!.end.offset)),
      );
    }
    if (points.length >= limit) break;
  }
  return points.slice(0, limit);
}

/** Plain text of a Markdown field, for excerpts. */
export function excerpt(markdown: string | null): string | null {
  return markdown ? markdownToPlain(markdown) : null;
}
