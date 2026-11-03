import { describe, expect, it } from "vitest";
import { createTopicMatcher, normalizeTopicText, splitCategory } from "@/core/topics/match";
import { TEST_TOPICS, topicId } from "../support/fixtures";

const matcher = createTopicMatcher(TEST_TOPICS);

describe("topic matching", () => {
  it("normalizes case, ampersands and punctuation", () => {
    expect(normalizeTopicText("Stock Market & Global-Finance!")).toBe(
      "stock market and global finance",
    );
  });

  it("splits compound categories", () => {
    expect(splitCategory("Stock Market & Global Finance / Geopolitics")).toEqual([
      "Stock Market & Global Finance",
      "Geopolitics",
    ]);
    expect(splitCategory("AI · Finance; Cyber | ML")).toEqual(["AI", "Finance", "Cyber", "ML"]);
  });

  it("matches names, aliases and the parts of an 'X & Y' name", () => {
    expect(matcher.matchCategory("Cybersecurity / Geopolitics").topicIds).toEqual([
      topicId("Cybersecurity"),
      topicId("Global Events & Geopolitics"),
    ]);
    expect(matcher.matchCategory("AI / Finance").topicIds).toEqual([
      topicId("Artificial Intelligence"),
      topicId("Stock Market & Global Finance"),
    ]);
  });

  it("reports parts that match nothing", () => {
    expect(matcher.matchCategory("Space / AI")).toEqual({
      topicIds: [topicId("Artificial Intelligence")],
      unmatched: ["Space"],
    });
  });

  it("ignores section numbering in headings", () => {
    expect(matcher.matchPhrase("3.2 Cybersecurity")).toBe(topicId("Cybersecurity"));
    expect(matcher.matchPhrase("Category Intelligence")).toBeNull();
  });

  it("works with any user-defined topics", () => {
    const football = createTopicMatcher([
      { id: "pl", name: "Premier League", aliases: ["EPL"] },
      { id: "ll", name: "La Liga", aliases: [] },
    ]);
    expect(football.matchCategory("EPL / La Liga").topicIds).toEqual(["pl", "ll"]);
  });
});

describe("topic matching: reworded categories", () => {
  it("matches a category through either half of an 'X & Y' phrase", () => {
    expect(matcher.matchCategory("World events & geopolitics").topicIds).toEqual([
      topicId("Global Events & Geopolitics"),
    ]);
    expect(matcher.matchCategory("Natural disasters & environment").topicIds).toEqual([
      topicId("Natural Disasters & Environmental Events"),
    ]);
    expect(matcher.matchCategory("Medicine & life sciences").topicIds).toEqual([
      topicId("Biomedical & Life Sciences"),
    ]);
    expect(matcher.matchCategory("Sport & leisure")).toEqual({
      topicIds: [],
      unmatched: ["Sport & leisure"],
    });
  });
});
