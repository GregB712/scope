/**
 * Display formatting. One locale for the whole interface keeps dates consistent
 * between server and client renders.
 */
export const LOCALE = "en-GB";

/** Calendar dates (`YYYY-MM-DD`) are formatted in UTC so they never shift a day. */
const asUtcDate = (date: string) => new Date(`${date}T00:00:00Z`);

export function formatLongDate(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(asUtcDate(date));
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(asUtcDate(date));
}

export function formatDayMonth(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(asUtcDate(date));
}

export function formatWeekday(date: string, style: "long" | "short" = "short"): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: style, timeZone: "UTC" }).format(
    asUtcDate(date),
  );
}

export function formatMonthYear(month: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(asUtcDate(`${month}-01`));
}

/** "08:16" in the report's own time zone (falls back to UTC). */
export function formatTime(instant: Date, timeZone: string | null): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timeZone ?? "UTC",
  }).format(instant);
}

export function formatDateTime(instant: Date, timeZone: string | null = "UTC"): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timeZone ?? "UTC",
  }).format(instant);
}

/** "Athens" from "Europe/Athens". */
export function cityOf(timeZone: string | null): string | null {
  if (!timeZone || !timeZone.includes("/")) return timeZone;
  return timeZone.split("/").pop()!.replace(/_/g, " ");
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

export function formatRelative(instant: Date, now: Date = new Date()): string {
  const seconds = Math.round((instant.getTime() - now.getTime()) / 1000);
  if (Math.abs(seconds) < 60) return "just now";
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString(LOCALE)} ${count === 1 ? one : many}`;
}
