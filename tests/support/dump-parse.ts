// Dev helper: npx tsx tests/support/dump-parse.ts <file.md>
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseReport } from "../../src/core/parser";
import { DEFAULT_TOPICS } from "../../src/core/topics/defaults";

const file = process.argv[2]!;
const topics = DEFAULT_TOPICS.map((t, i) => ({ id: `t${i}`, ...t }));
const parsed = parseReport(readFileSync(file, "utf8"), {
  fileName: basename(file),
  fallbackDate: new Date("2026-11-03T06:22:10Z"),
  fallbackTimeZone: "UTC",
  topics,
});
const { plainText, sections, stories, ...rest } = parsed;
console.log(
  JSON.stringify(
    {
      ...rest,
      topicCounts: Object.fromEntries(parsed.topicCounts),
      plainTextLength: plainText.length,
    },
    null,
    1,
  ),
);
console.log(
  "SECTIONS",
  sections
    .map(
      (s) =>
        `${s.position} h${s.depth} [${s.kind}${s.topicId ? ":" + s.topicId : ""}] ${s.title} #${s.slug} (${s.markdown.length})`,
    )
    .join("\n"),
);
for (const s of stories)
  console.log(
    "STORY",
    JSON.stringify({
      ...s,
      summary: s.summary?.slice(0, 60),
      whyItMatters: s.whyItMatters?.slice(0, 40),
      implications: s.implications?.slice(0, 40),
      whatToWatch: s.whatToWatch?.slice(0, 40),
    }),
  );
