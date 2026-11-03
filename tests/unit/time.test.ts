import { describe, expect, it } from "vitest";
import { dateInTimeZone, findDate, isValidTimeZone, wallTimeToUtc } from "@/core/time";

describe("findDate", () => {
  it.each([
    ["2026-11-03 (voting day)", "2026-11-03"],
    ["Friday 30 October 2026 (US cash close)", "2026-10-30"],
    ["October 30, 2026", "2026-10-30"],
    ["Exploitation began ~2026-10-30; warning 2026-11-02", "2026-10-30"],
  ])("finds the date in %j", (text, expected) => {
    expect(findDate(text)).toBe(expected);
  });

  it.each(["Q3 2026 earnings season", "2026-02-30", "no date"])("returns null for %j", (text) => {
    expect(findDate(text)).toBeNull();
  });
});

describe("wallTimeToUtc", () => {
  it("converts Athens winter time (UTC+2)", () => {
    expect(wallTimeToUtc("2026-11-03", "08:16", "Europe/Athens")?.toISOString()).toBe(
      "2026-11-03T06:16:00.000Z",
    );
  });

  it("converts Athens summer time (UTC+3)", () => {
    expect(wallTimeToUtc("2026-07-01", "08:00", "Europe/Athens")?.toISOString()).toBe(
      "2026-07-01T05:00:00.000Z",
    );
  });

  it("handles the day daylight saving ends", () => {
    // Europe/Athens leaves summer time at 04:00 local on 2026-10-25.
    expect(wallTimeToUtc("2026-10-25", "12:00", "Europe/Athens")?.toISOString()).toBe(
      "2026-10-25T10:00:00.000Z",
    );
  });

  it("rejects invalid zones and times", () => {
    expect(wallTimeToUtc("2026-11-03", "08:16", "Mars/Olympus")).toBeNull();
    expect(wallTimeToUtc("2026-11-03", "25:00", "UTC")).toBeNull();
  });
});

describe("time zones", () => {
  it("validates IANA names", () => {
    expect(isValidTimeZone("Europe/Athens")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });

  it("reports the local calendar date", () => {
    const instant = new Date("2026-11-02T23:30:00Z");
    expect(dateInTimeZone(instant, "Europe/Athens")).toBe("2026-11-03");
    expect(dateInTimeZone(instant, "UTC")).toBe("2026-11-02");
  });
});
