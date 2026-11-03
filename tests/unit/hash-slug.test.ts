import { describe, expect, it } from "vitest";
import { contentHash } from "@/core/hash";
import { createHeadingSlugger, reportSlugFromFileName, slugify } from "@/core/slug";

describe("contentHash", () => {
  it("is a stable SHA-256 hex digest", () => {
    expect(contentHash("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("changes with any byte, including line endings", () => {
    expect(contentHash("a\nb")).not.toBe(contentHash("a\r\nb"));
  });

  it("treats strings and their UTF-8 bytes identically", () => {
    expect(contentHash("Ελλάδα –")).toBe(contentHash(new TextEncoder().encode("Ελλάδα –")));
  });
});

describe("slugs", () => {
  it("derives report slugs from file names", () => {
    expect(reportSlugFromFileName("2026-11-03_0816_Global_Intelligence_Briefing.md")).toBe(
      "2026-11-03-0816-global-intelligence-briefing",
    );
    expect(reportSlugFromFileName("###.md")).toBe("report");
  });

  it("folds accents and ampersands", () => {
    expect(slugify("Économie & Société")).toBe("economie-and-societe");
  });

  it("suffixes duplicate heading anchors like GitHub", () => {
    const slug = createHeadingSlugger();
    expect([slug("Sources"), slug("Sources"), slug("2.1 Oil")]).toEqual([
      "sources",
      "sources-1",
      "21-oil",
    ]);
  });
});
