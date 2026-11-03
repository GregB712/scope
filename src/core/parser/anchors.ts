import type { Heading, Root } from "mdast";
import { visit } from "unist-util-visit";
import { createHeadingSlugger } from "../slug";
import { headingText } from "./markdown";

/**
 * Anchor for every heading, in document order. Shared by the parser (table of
 * contents, story anchors) and the renderer (heading ids) so links always resolve.
 */
export function headingAnchors(tree: Root): Map<Heading, string> {
  const anchors = new Map<Heading, string>();
  const slug = createHeadingSlugger();
  visit(tree, "heading", (node: Heading) => {
    anchors.set(node, slug(headingText(node)));
  });
  return anchors;
}
