import GithubSlugger from "github-slugger";

/**
 * URL-safe slug for names and file names: lowercase ASCII words joined by `-`.
 * Accents are folded ("Économie" becomes "economie").
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Slug for a report, derived from its file name without the extension. */
export function reportSlugFromFileName(fileName: string): string {
  return slugify(fileName.replace(/\.(md|markdown)$/i, "")) || "report";
}

/**
 * Heading anchors. Uses GitHub's algorithm with duplicate suffixes, so the parser
 * (table of contents, story anchors) and the renderer (heading ids) agree as long
 * as both feed headings in document order to their own slugger instance.
 */
export function createHeadingSlugger(): (text: string) => string {
  const slugger = new GithubSlugger();
  return (text) => slugger.slug(text);
}
