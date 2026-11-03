import type { Element, ElementContent, Root as HastRoot } from "hast";
import type { Root as MdastRoot, RootContent } from "mdast";
import { headingAnchors } from "@/core/parser/anchors";
import { carriersOf, extractPairs, metadataFieldFor } from "@/core/parser/labels";
import { visit } from "unist-util-visit";

/** Heading ids, identical to the parser's anchors (see core/parser/anchors.ts). */
export function remarkHeadingIds() {
  return (tree: MdastRoot) => {
    for (const [heading, id] of headingAnchors(tree)) {
      heading.data = { ...heading.data, hProperties: { ...heading.data?.hProperties, id } };
    }
  };
}

/**
 * Removes what the page header already shows: frontmatter, the leading title,
 * and the `**Date:** / **Generated:** / **Research window:**` block. Any other
 * preamble (for example a verification note) is kept.
 */
export function remarkStripMasthead(source: string) {
  return () => (tree: MdastRoot) => {
    const firstSection = tree.children.findIndex(
      (node, index) =>
        node.type === "heading" && !(index === firstHeadingIndex(tree) && node.depth === 1),
    );
    const preambleEnd = firstSection === -1 ? tree.children.length : firstSection;
    const keep: RootContent[] = [];
    tree.children.forEach((node, index) => {
      if (node.type === "yaml") return;
      if (index === firstHeadingIndex(tree) && node.type === "heading" && node.depth === 1) return;
      if (index < preambleEnd && node.type === "paragraph" && isMetadataParagraph(node, source))
        return;
      keep.push(node);
    });
    // A rule that separated the masthead from the body now leads nothing.
    while (keep[0]?.type === "thematicBreak") keep.shift();
    tree.children = keep;
  };
}

function firstHeadingIndex(tree: MdastRoot) {
  return tree.children.findIndex((node) => node.type === "heading");
}

function isMetadataParagraph(node: RootContent, source: string) {
  const pairs = carriersOf([node]).flatMap((carrier) => extractPairs(carrier, source));
  return pairs.length > 0 && pairs.every((pair) => metadataFieldFor(pair.label));
}

const textOf = (node: ElementContent): string =>
  node.type === "text" ? node.value : "children" in node ? node.children.map(textOf).join("") : "";

const isElement = (node: ElementContent | undefined): node is Element => node?.type === "element";

/** Splits `<li><strong>Label:</strong> value</li>` into label and value, or returns null. */
function splitLabeledItem(li: Element): { label: string; value: ElementContent[] } | null {
  const children = li.children.filter((c) => !(c.type === "text" && !c.value.trim()));
  // Loose lists wrap content in <p>.
  const lead = children[0];
  const inline = isElement(lead) && lead.tagName === "p" ? lead.children : children;
  const rest = isElement(lead) && lead.tagName === "p" ? children.slice(1) : [];
  const strong = inline[0];
  if (!isElement(strong) || strong.tagName !== "strong") return null;

  const strongText = textOf(strong).trim();
  let label: string;
  let value = inline.slice(1);
  if (strongText.endsWith(":")) {
    label = strongText.slice(0, -1).trim();
  } else if (value[0]?.type === "text" && value[0].value.startsWith(":")) {
    label = strongText;
    value = [{ type: "text", value: value[0].value.slice(1) }, ...value.slice(1)];
  } else {
    return null;
  }
  if (!label || label.length > 40) return null;
  if (value[0]?.type === "text")
    value = [{ type: "text", value: value[0].value.trimStart() }, ...value.slice(1)];
  return { label, value: [...value, ...rest] };
}

/** Lists made of `**Label:** value` items render as aligned label/value rows. */
export function rehypeLabeledLists() {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "ul") return;
      const items = node.children.filter(isElement).filter((c) => c.tagName === "li");
      const split = items.map(splitLabeledItem);
      const labeled = split.filter(Boolean).length;
      if (labeled < 2 || labeled < items.length * 0.6) return;

      node.properties = { ...node.properties, className: ["labeled-list"] };
      items.forEach((li, i) => {
        const parts = split[i];
        if (!parts) return;
        li.children = [
          {
            type: "element",
            tagName: "span",
            properties: { className: ["label"] },
            children: [{ type: "text", value: parts.label }],
          },
          {
            type: "element",
            tagName: "div",
            properties: { className: ["value"] },
            children: parts.value,
          },
        ];
      });
    });
  };
}
