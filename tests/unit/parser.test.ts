import { describe, expect, it } from "vitest";
import { parseReport, type ParsedReport } from "@/core/parser";
import { parseImportance } from "@/core/parser/stories";
import { SAMPLE_FILE, TEST_TOPICS, readFixture, readSample, topicId } from "../support/fixtures";

const context = (fileName: string, topics = TEST_TOPICS) => ({
  fileName,
  fallbackDate: new Date("2026-11-03T06:22:10Z"),
  fallbackTimeZone: "UTC",
  topics,
});

const warningCodes = (report: ParsedReport) => report.warnings.map((w) => w.code);

describe("parseReport: real dossier (2026-11-03)", () => {
  const report = parseReport(readSample(), context(SAMPLE_FILE));

  it("extracts title and metadata", () => {
    expect(report.title).toBe("Global Intelligence Briefing");
    expect(report.reportDate).toBe("2026-11-03");
    expect(report.timezone).toBe("Europe/Athens");
    expect(report.generatedAt?.toISOString()).toBe("2026-11-03T06:16:00.000Z");
    expect(report.warnings).toEqual([]);
  });

  it("extracts the research window and keeps its full text", () => {
    expect(report.researchWindow?.start?.toISOString()).toBe("2026-10-31T22:00:00.000Z");
    expect(report.researchWindow?.end?.toISOString()).toBe("2026-11-03T06:16:00.000Z");
    expect(report.researchWindow?.text).toMatch(/^2026-11-01 00:00 – 2026-11-03 08:16/);
    expect(report.researchWindow?.text).toMatch(/flagged clearly\.$/);
  });

  it("uses the executive summary as the report summary", () => {
    expect(report.summary).toMatch(/^- \*\*Americans vote today\.\*\*/);
    expect(report.summary?.split("\n")).toHaveLength(8);
  });

  it("identifies and classifies every section", () => {
    const kinds = report.sections.filter((s) => s.depth === 3).map((s) => [s.title, s.kind]);
    expect(kinds).toEqual([
      ["Executive Summary", "executive_summary"],
      ["Top Stories", "top_stories"],
      ["Category Intelligence", "other"],
      ["Financial Market Snapshot", "data_snapshot"],
      ["Research Radar", "radar"],
      ["Global Risk Monitor", "risk"],
      ["What to Watch Next", "outlook"],
      ["Sources", "sources"],
    ]);
    const briefs = report.sections.filter((s) => s.kind === "topic_brief");
    expect(briefs.map((s) => s.topicId)).toEqual(TEST_TOPICS.map((t) => t.id));
    expect(report.outline).toHaveLength(report.sections.length);
  });

  it("extracts all seven top stories with their fields", () => {
    expect(report.stories.map((s) => s.importance)).toEqual([9, 8, 8, 8, 8, 7, 7]);
    const [midterms, oil] = report.stories;
    expect(midterms).toMatchObject({
      title: "US midterm elections take place today",
      anchor: "21-us-midterm-elections-take-place-today",
      categoryRaw: "Global Events & Geopolitics",
      topicIds: [topicId("Global Events & Geopolitics")],
      eventDate: "2026-11-03",
      publishedDate: "2026-11-02",
    });
    expect(midterms?.summary).toMatch(/^The United States holds its midterm elections today/);
    expect(midterms?.whyItMatters).toMatch(/^The outcome decides/);
    expect(midterms?.implications).toMatch(/^A divided result/);
    expect(midterms?.whatToWatch).toMatch(/^Results through the night/);
    expect(midterms?.sourceLinks).toEqual([
      {
        url: "https://www.goodreturns.in/news/us-stock-market-today-us-midterm-election-polls-dow-jones-futures-nasdaq-s-p-500-wall-street-outlook-1544809.html",
        title: "Goodreturns – Wall Street outlook Nov 3",
      },
      {
        url: "https://www.aa.com.tr/en/world/morning-briefing-nov-2-2026/4108322",
        title: "Anadolu Agency morning briefing Nov 2",
      },
    ]);
    expect(oil?.topicIds).toEqual([
      topicId("Stock Market & Global Finance"),
      topicId("Global Events & Geopolitics"),
    ]);
  });

  it("keeps unrecognized labels instead of dropping them", () => {
    const nodeRed = report.stories.find((s) => s.title.includes("Node-RED"));
    expect(nodeRed?.extraFields.Fix).toMatch(/^Update Siemens systems/);
    expect(report.stories.at(-1)?.extraFields.Note).toMatch(/company self-reports/);
  });

  it("counts stories per topic", () => {
    expect(Object.fromEntries(report.topicCounts)).toEqual({
      [topicId("Global Events & Geopolitics")]: 4,
      [topicId("Stock Market & Global Finance")]: 2,
      [topicId("Artificial Intelligence")]: 2,
      [topicId("Cybersecurity")]: 2,
    });
    expect(report.unmatchedCategories).toEqual([]);
  });

  it("builds the report source list from the Sources section with readable titles", () => {
    expect(report.sourceLinks).toHaveLength(11);
    expect(report.sourceLinks[0]).toEqual({
      url: "https://hdfcsky.com/news/dow-gains-310-points-as-oil-slumps-8percent-while-tech-losses-pull-sp-500-lower-november-3-2026",
      title: "HDFC Sky – US market report, Nov 3, 2026",
    });
  });

  it("produces searchable plain text without Markdown syntax or URLs", () => {
    expect(report.plainText).toContain("CVE-2026-58115");
    expect(report.plainText).not.toContain("**");
    expect(report.plainText).not.toContain("https://");
  });

  it("does not depend on line endings or a BOM", () => {
    const crlf = "﻿" + readSample().replace(/\n/g, "\r\n");
    const again = parseReport(crlf, context(SAMPLE_FILE));
    expect(again.stories).toEqual(report.stories);
    expect(again.generatedAt).toEqual(report.generatedAt);
  });
});

describe("parseReport: format drift (2026-11-02 style)", () => {
  const report = parseReport(
    readFixture("variant-inline-labels.md"),
    context("2026-11-02_1007_Global_Intelligence_Briefing.md"),
  );

  it("splits several labels on one line", () => {
    expect(report.stories[0]).toMatchObject({
      categoryRaw: "Stock Market & Global Finance",
      importance: 9,
    });
  });

  it("reads combined and alternative date labels", () => {
    expect(report.stories[0]).toMatchObject({
      eventDate: "2026-10-30",
      publishedDate: "2026-10-30",
    });
    expect(report.stories[1]?.datesText).toBe("Event: Q3 2026 earnings season (late October)");
    expect(report.stories[1]?.eventDate).toBeNull();
  });

  it("maps labels with qualifiers and keeps confidence", () => {
    expect(report.stories[0]?.implications).toBe("Intel guided Q4 revenue below consensus.");
    expect(report.stories[1]?.confidence).toBe("Medium (single aggregator)");
  });

  it("keeps plain-text sources when there are no links", () => {
    expect(report.stories[0]?.sourceLinks).toEqual([]);
    expect(report.stories[0]?.sourceText).toBe(
      "La Nación/AP market tally; Business Standard; StockAnalysis.",
    );
  });

  it("maps abbreviated compound categories", () => {
    expect(report.stories[1]?.topicIds).toEqual([
      topicId("Artificial Intelligence"),
      topicId("Stock Market & Global Finance"),
    ]);
  });

  it("matches numbered topic headings and tolerates a preamble blockquote", () => {
    const briefs = report.sections.filter((s) => s.kind === "topic_brief");
    expect(briefs.map((s) => [s.title, s.topicId])).toEqual([
      ["Programming & Software Engineering", topicId("Programming & Software Engineering")],
      ["Cybersecurity", topicId("Cybersecurity")],
    ]);
    expect(report.reportDate).toBe("2026-11-02");
    expect(report.researchWindow?.end?.toISOString()).toBe("2026-11-02T08:07:00.000Z");
  });
});

describe("parseReport: a different automation", () => {
  const report = parseReport(readFixture("generic-football.md"), context("transfers.md", []));

  it("reads YAML frontmatter", () => {
    expect(report.title).toBe("Transfer Window Daily");
    expect(report.reportDate).toBe("2026-08-14");
    expect(report.generatedAt?.toISOString()).toBe("2026-08-14T06:30:00.000Z");
    expect(report.timezone).toBe("Europe/London");
  });

  it("finds stories under any heading names and label vocabulary", () => {
    expect(report.stories.map((s) => [s.title, s.categoryRaw, s.importance])).toEqual([
      ["Striker signs five-year contract", "Premier League", 8],
      ["Loan deal collapses", "La Liga", 6],
    ]);
    expect(report.stories[1]?.whatToWatch).toBe("Whether the league grants an exception.");
    expect(report.sections.find((s) => s.title === "Key Moves")?.kind).toBe("top_stories");
  });

  it("reports unmapped categories and word-based importance", () => {
    expect(report.unmatchedCategories).toEqual(["Premier League", "La Liga"]);
    expect(warningCodes(report)).toContain("importance_from_words");
  });

  it("links stories to user topics when they exist", () => {
    const withTopics = parseReport(
      readFixture("generic-football.md"),
      context("transfers.md", [{ id: "pl", name: "Premier League", aliases: [] }]),
    );
    expect(withTopics.stories[0]?.topicIds).toEqual(["pl"]);
    expect(withTopics.unmatchedCategories).toEqual(["La Liga"]);
  });
});

describe("parseReport: graceful fallback", () => {
  it("handles notes with no headings or metadata", () => {
    const report = parseReport(readFixture("minimal-notes.md"), context("minimal-notes.md"));
    expect(report.title).toBe("Minimal notes");
    expect(report.reportDate).toBe("2026-11-03");
    expect(report.summary).toBe("Some loose notes without any headings or metadata.");
    expect(report.stories).toEqual([]);
    expect(warningCodes(report)).toEqual(["date_from_source", "no_sections", "no_title"]);
  });

  it("handles an empty file", () => {
    const report = parseReport(readFixture("empty.md"), context("empty.md"));
    expect(report.plainText).toBe("");
    expect(warningCodes(report)).toContain("empty_document");
  });

  it("falls back to the file name for date and time", () => {
    const report = parseReport("# Briefing\n\nBody.", {
      ...context("2026-11-04_0730_Briefing.md"),
      fallbackTimeZone: "Europe/Athens",
    });
    expect(report.reportDate).toBe("2026-11-04");
    expect(report.generatedAt?.toISOString()).toBe("2026-11-04T05:30:00.000Z");
    expect(warningCodes(report)).toEqual([
      "date_from_filename",
      "time_from_filename",
      "timezone_assumed",
      "no_sections",
    ]);
  });

  it("does not mistake prose with bold text for a story", () => {
    const report = parseReport(
      "# Notes\n\n## Market wrap\n\nThe **key point:** stocks fell. **Another thing:** bonds rose.",
      context("notes.md"),
    );
    expect(report.stories).toEqual([]);
  });

  it("survives invalid frontmatter", () => {
    const report = parseReport("---\ntitle: [unclosed\n---\n# Real title\n", context("x.md"));
    expect(report.title).toBe("Real title");
    expect(warningCodes(report)).toContain("invalid_frontmatter");
  });
});

describe("parseImportance", () => {
  it.each([
    ["9/10", 9],
    ["8", 8],
    ["4/5", 8],
    ["High", 8],
    ["Critical", 10],
    ["unknown", null],
  ])("%j becomes %j", (text, expected) => {
    expect(parseImportance(text)?.value ?? null).toBe(expected);
  });
});
