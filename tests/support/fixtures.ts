import { readFileSync } from "node:fs";
import { DEFAULT_TOPICS } from "@/core/topics/defaults";
import type { TopicRef } from "@/core/topics/match";

export const SAMPLE_FILE = "2026-11-03_0816_Global_Intelligence_Briefing.md";
export const SAMPLE_PATH = `fixtures/reports/2026/11-November/${SAMPLE_FILE}`;

export const readSample = () => readFileSync(SAMPLE_PATH, "utf8");
export const readFixture = (name: string) => readFileSync(`tests/fixtures/${name}`, "utf8");

/** Default topics with stable fake IDs: "t0" (Programming) ... "t7" (Natural Disasters). */
export const TEST_TOPICS: TopicRef[] = DEFAULT_TOPICS.map((topic, i) => ({
  id: `t${i}`,
  ...topic,
}));
export const topicId = (name: string) => TEST_TOPICS.find((t) => t.name === name)!.id;
