/**
 * Highlight markers for full-text search snippets. Private-use characters cannot
 * appear in normal text; the UI splits on them and renders plain text nodes, so
 * snippets never need `dangerouslySetInnerHTML`.
 */
export const MARK_START = "";
export const MARK_END = "";

export function splitHighlights(snippet: string): { text: string; highlighted: boolean }[] {
  const parts: { text: string; highlighted: boolean }[] = [];
  for (const chunk of snippet.split(MARK_START)) {
    const end = chunk.indexOf(MARK_END);
    if (end >= 0) {
      if (end > 0) parts.push({ text: chunk.slice(0, end), highlighted: true });
      const rest = chunk.slice(end + 1).replaceAll(MARK_END, "");
      if (rest) parts.push({ text: rest, highlighted: false });
    } else if (chunk) {
      parts.push({ text: chunk, highlighted: false });
    }
  }
  return parts;
}
