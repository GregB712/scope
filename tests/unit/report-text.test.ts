import { describe, expect, it } from "vitest";
import { summaryParts, summaryPoints } from "@/lib/report-text";

describe("summary text", () => {
  const md =
    "- **Americans vote today.** Control of Congress is on the line.\n- Oil fell *sharply*.\n\nA closing paragraph.";

  it("splits bullets and paragraphs into plain text", () => {
    expect(summaryPoints(md)).toEqual([
      "Americans vote today. Control of Congress is on the line.",
      "Oil fell sharply.",
      "A closing paragraph.",
    ]);
    expect(summaryPoints(null)).toEqual([]);
  });

  it("separates a bold lead sentence", () => {
    expect(summaryParts(md, 2)).toEqual([
      { lead: "Americans vote today.", text: "Control of Congress is on the line." },
      { lead: null, text: "Oil fell sharply." },
    ]);
  });
});
