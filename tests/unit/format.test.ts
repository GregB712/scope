import { describe, expect, it } from "vitest";
import {
  cityOf,
  formatDayMonth,
  formatLongDate,
  formatRelative,
  formatTime,
  plural,
} from "@/lib/format";

describe("format", () => {
  it("formats calendar dates without time-zone drift", () => {
    expect(formatLongDate("2026-11-03")).toBe("Tuesday, 3 November 2026");
    expect(formatDayMonth("2026-01-01")).toBe("1 Jan");
  });

  it("formats times in the report's zone", () => {
    expect(formatTime(new Date("2026-11-03T06:16:00Z"), "Europe/Athens")).toBe("08:16");
    expect(cityOf("America/New_York")).toBe("New York");
  });

  it("formats relative times and plurals", () => {
    const now = new Date("2026-11-03T12:00:00Z");
    expect(formatRelative(new Date("2026-11-03T10:00:00Z"), now)).toBe("2 hours ago");
    expect(formatRelative(new Date("2026-11-03T11:59:30Z"), now)).toBe("just now");
    expect(plural(1, "report")).toBe("1 report");
    expect(plural(1284, "story", "stories")).toBe("1,284 stories");
  });
});
