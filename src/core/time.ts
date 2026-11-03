/**
 * Date and time helpers with no dependencies beyond `Intl`.
 */

const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}; // prettier-ignore

/** `true` when `timeZone` is a zone `Intl` recognizes (IANA names, `UTC`). */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function isRealDate(y: number, m: number, d: number): boolean {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function toIsoDate(y: number, m: number, d: number): string | null {
  if (!isRealDate(y, m, d)) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Finds the first calendar date in free text and returns it as `YYYY-MM-DD`.
 * Accepts ISO dates, "30 October 2026" and "October 30, 2026" (weekday names allowed).
 */
export function findDate(text: string): string | null {
  const iso = ISO_DATE.exec(text);
  if (iso) return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const dayFirst = /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/.exec(text);
  if (dayFirst) {
    const month = MONTHS[dayFirst[2]!.slice(0, 3).toLowerCase()];
    if (month) return toIsoDate(Number(dayFirst[3]), month, Number(dayFirst[1]));
  }

  const monthFirst = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/.exec(text);
  if (monthFirst) {
    const month = MONTHS[monthFirst[1]!.slice(0, 3).toLowerCase()];
    if (month) return toIsoDate(Number(monthFirst[3]), month, Number(monthFirst[2]));
  }
  return null;
}

/** Offset of `timeZone` from UTC at `instant`, in milliseconds. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * Converts a wall-clock time in an IANA time zone to a UTC `Date`.
 * `date` is `YYYY-MM-DD`, `time` is `HH:MM`. Returns `null` for invalid input.
 */
export function wallTimeToUtc(date: string, time: string, timeZone: string): Date | null {
  const d = ISO_DATE.exec(date);
  const t = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!d || !t || !isValidTimeZone(timeZone)) return null;
  const [y, m, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [h, min] = [Number(t[1]), Number(t[2])];
  if (!isRealDate(y, m, day) || h > 23 || min > 59) return null;

  const naive = Date.UTC(y, m - 1, day, h, min);
  // Two passes settle the offset correctly around daylight-saving transitions.
  let utc = naive - zoneOffsetMs(naive, timeZone);
  utc = naive - zoneOffsetMs(utc, timeZone);
  return new Date(utc);
}

/** Calendar date (`YYYY-MM-DD`) of `instant` as seen in `timeZone`. */
export function dateInTimeZone(instant: Date, timeZone: string): string {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}
