import type { ComponentProps } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";
import { normalizeSource } from "@/core/parser/markdown";
import { cn } from "@/lib/utils";
import { rehypeLabeledLists, remarkHeadingIds, remarkStripMasthead } from "./plugins";

const isExternal = (href?: string) => !!href && /^https?:\/\//i.test(href);

const components: Components = {
  a: ({ href, children, node: _node, ...props }) =>
    isExternal(href) ? (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    ) : (
      <a href={href} {...props}>
        {children}
      </a>
    ),
  table: ({ node: _node, ...props }) => (
    <div className="table-scroll">
      <table {...props} />
    </div>
  ),
  img: ({ node: _node, alt, ...props }) => (
    // Report images are remote and arbitrary; next/image would need a domain allowlist.
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt ?? ""} loading="lazy" decoding="async" className="h-auto max-w-full" {...props} />
  ),
};

/**
 * Renders a report's original Markdown as a Server Component. Raw HTML is never
 * rendered (no rehype-raw) and URLs pass react-markdown's default sanitizer.
 */
export function Markdown({
  source,
  stripMasthead = false,
  className,
}: {
  source: string;
  /** Hide the title and metadata block when the page header already shows them. */
  stripMasthead?: boolean;
  className?: string;
} & Pick<ComponentProps<"div">, "id">) {
  const text = normalizeSource(source);
  const remarkPlugins: PluggableList = [
    remarkGfm,
    [remarkFrontmatter, ["yaml"]],
    remarkHeadingIds,
    ...(stripMasthead ? [remarkStripMasthead(text)] : []),
  ];
  return (
    <div className={cn("prose-report", className)}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={[rehypeLabeledLists]}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
