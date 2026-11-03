import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/components/markdown/markdown";
import { parseReport } from "@/core/parser";
import { SAMPLE_FILE, TEST_TOPICS, readSample } from "../support/fixtures";

const render = (source: string, stripMasthead = false) =>
  renderToStaticMarkup(<Markdown source={source} stripMasthead={stripMasthead} />);

describe("Markdown renderer", () => {
  const html = render(readSample(), true);

  it("gives every heading the same anchor the parser recorded", () => {
    const parsed = parseReport(readSample(), {
      fileName: SAMPLE_FILE,
      fallbackDate: new Date(),
      fallbackTimeZone: "UTC",
      topics: TEST_TOPICS,
    });
    const ids = [...html.matchAll(/<h[2-6] id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(parsed.outline.map((entry) => entry.slug));
  });

  it("drops the title and metadata block shown in the page header, and nothing else", () => {
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("Research window");
    expect(html).toContain("Americans vote today.");
    expect(html).toContain("Node-RED");
    expect(render(readSample())).toContain("<h1");
  });

  it("renders label lists as label/value rows", () => {
    expect(html).toContain('<ul class="labeled-list">');
    expect(html).toContain('<span class="label">Category</span>');
  });

  it("opens external links safely in a new tab", () => {
    expect(html).toMatch(
      /<a href="https:\/\/securityonline\.info[^"]*" target="_blank" rel="noopener noreferrer">/,
    );
  });

  it("wraps tables for horizontal scrolling", () => {
    expect(html).toContain('<div class="table-scroll"><table>');
  });

  it("never renders raw HTML or script URLs from report content", () => {
    const out = render(
      "Hello <script>alert(1)</script> <img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))",
    );
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img src=x onerror=alert(1)&gt;"); // shown as text, inert
    expect(out).not.toContain("javascript:");
  });

  it("keeps a preamble note while removing metadata", () => {
    const out = render(
      "# T\n**Date:** 2026-11-02\n\n> **Verification note.** Feeds were down.\n\n## A\n\nBody",
      true,
    );
    expect(out).toContain("Verification note.");
    expect(out).not.toContain("2026-11-02");
  });
});
