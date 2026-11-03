import { describe, expect, it } from "vitest";
import { parseArchiveParams, toQuery } from "@/lib/search-params";

describe("archive search params", () => {
  it("parses valid filters and expands a month into a date range", () => {
    expect(
      parseArchiveParams({
        q: " oil ",
        month: "2026-02",
        topic: "cybersecurity",
        importance: "8",
        sort: "oldest",
        view: "grid",
        page: "3",
      }),
    ).toEqual({
      q: "oil",
      from: "2026-02-01",
      to: "2026-02-28",
      month: "2026-02",
      topic: "cybersecurity",
      minImportance: 8,
      sort: "oldest",
      view: "grid",
      page: 3,
    });
  });

  it("drops invalid values instead of failing", () => {
    expect(
      parseArchiveParams({
        from: "yesterday",
        topic: "../x",
        importance: "99",
        page: "-1",
        sort: "random",
      }),
    ).toEqual({
      q: undefined,
      from: undefined,
      to: undefined,
      month: undefined,
      topic: undefined,
      minImportance: undefined,
      sort: "newest",
      view: "list",
      page: 1,
    });
  });

  it("builds compact query strings", () => {
    expect(toQuery({ q: "oil", page: 2, topic: undefined, view: "" })).toBe("?q=oil&page=2");
    expect(toQuery({})).toBe("");
  });
});
