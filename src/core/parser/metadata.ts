import { parse as parseYaml } from "yaml";
import { dateInTimeZone, findDate, isValidTimeZone, wallTimeToUtc } from "../time";
import { markdownToPlain } from "./markdown";
import { metadataFieldFor, type LabelPair } from "./labels";
import type { ParseWarning } from "./types";

export type Frontmatter = {
  title?: string;
  date?: string;
  generated?: string;
  timezone?: string;
  topics?: string[];
};

export function readFrontmatter(yamlSource: string, warnings: ParseWarning[]): Frontmatter {
  let data: unknown;
  try {
    data = parseYaml(yamlSource);
  } catch {
    warnings.push({ code: "invalid_frontmatter", message: "YAML frontmatter could not be read." });
    return {};
  }
  if (!data || typeof data !== "object") return {};
  const record = data as Record<string, unknown>;
  const str = (key: string) => {
    const value = record[key];
    if (value instanceof Date) return value.toISOString();
    return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
  };
  const topics = record.topics ?? record.categories ?? record.tags;
  return {
    title: str("title"),
    date: str("date"),
    generated: str("generated") ?? str("generated_at"),
    timezone: str("timezone") ?? str("time_zone"),
    topics: Array.isArray(topics) ? topics.map(String) : undefined,
  };
}

/** `**Date:** / **Generated:** / **Research window:**` values found before the first section. */
export type MetadataBlock = Partial<
  Record<"date" | "generated" | "researchWindow" | "timezone", string>
>;

export function readMetadataBlock(pairs: readonly LabelPair[]): MetadataBlock {
  const block: MetadataBlock = {};
  for (const pair of pairs) {
    const field = metadataFieldFor(pair.label);
    if (field && block[field] === undefined) block[field] = markdownToPlain(pair.value);
  }
  return block;
}

const TIME = /\b(\d{1,2}):(\d{2})\b/;

/** A time zone named in text: "(Europe/Athens)", "Europe/Athens", "UTC" or "GMT". */
export function findTimeZone(text: string): string | null {
  const candidates = [
    ...Array.from(text.matchAll(/\(([^)]+)\)/g), (m) => m[1]!.trim()),
    ...Array.from(text.matchAll(/\b([A-Z][A-Za-z_]+(?:\/[A-Za-z_+-]+)+)\b/g), (m) => m[1]!),
    ...Array.from(text.matchAll(/\b(UTC|GMT)\b/g), (m) => m[1]!),
  ];
  return candidates.find((c) => /\/|^UTC$|^GMT$/.test(c) && isValidTimeZone(c)) ?? null;
}

/** File names produced by the automation: `YYYY-MM-DD_HHMM_Title.md`. */
export function readFileName(fileName: string): { date?: string; time?: string; title?: string } {
  const base = fileName.replace(/\.(md|markdown)$/i, "");
  const match = /^(\d{4}-\d{2}-\d{2})(?:[_ T-](\d{2})(\d{2}))?(?:[_ -]+(.*))?$/.exec(base);
  if (!match) {
    const title = base.replace(/[_-]+/g, " ").trim();
    return { title: title || undefined };
  }
  const title = match[4]?.replace(/[_-]+/g, " ").trim();
  return {
    date: findDate(match[1]!) ?? undefined,
    time: match[2] ? `${match[2]}:${match[3]}` : undefined,
    title: title || undefined,
  };
}

/** An ISO timestamp with an explicit offset or `Z`. */
function parseIsoInstant(text: string): Date | null {
  if (
    !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(text.trim())
  ) {
    return null;
  }
  const date = new Date(text.trim().replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

export type ResolvedDates = {
  reportDate: string;
  generatedAt: Date | null;
  timezone: string | null;
  researchWindow: { start: Date | null; end: Date | null; text: string } | null;
};

export type DateInputs = {
  frontmatter: Frontmatter;
  block: MetadataBlock;
  fileName: string;
  /** When the source file was created; the last-resort report date. */
  fallbackDate: Date;
  /** The newsroom's time zone, used when the report states none. */
  fallbackTimeZone: string;
};

export function resolveDates(input: DateInputs, warnings: ParseWarning[]): ResolvedDates {
  const { frontmatter, block, fileName, fallbackDate, fallbackTimeZone } = input;
  const fromFile = readFileName(fileName);

  // Time zone: explicit field, then any zone named in Generated or the research window.
  const statedZone =
    [frontmatter.timezone, block.timezone].find((z) => z && isValidTimeZone(z.trim()))?.trim() ??
    findTimeZone(block.generated ?? "") ??
    findTimeZone(block.researchWindow ?? "");
  const zone = statedZone ?? fallbackTimeZone;

  // Report date.
  let reportDate = findDate(frontmatter.date ?? "") ?? findDate(block.date ?? "") ?? null;
  if (!reportDate && fromFile.date) {
    reportDate = fromFile.date;
    warnings.push({ code: "date_from_filename", message: "Report date taken from the file name." });
  }
  if (!reportDate) {
    reportDate = dateInTimeZone(fallbackDate, zone);
    warnings.push({
      code: "date_from_source",
      message: "No date found in the report; used the file's creation date.",
    });
  }

  // Generation time.
  let generatedAt: Date | null = null;
  const generatedText = frontmatter.generated ?? block.generated;
  if (generatedText) {
    generatedAt = parseIsoInstant(generatedText);
    if (!generatedAt) {
      const time = TIME.exec(generatedText);
      if (time) {
        const day = findDate(generatedText) ?? reportDate;
        generatedAt = wallTimeToUtc(day, `${time[1]}:${time[2]}`, zone);
      }
    }
  }
  if (!generatedAt && fromFile.time && (fromFile.date ?? reportDate) === reportDate) {
    generatedAt = wallTimeToUtc(reportDate, fromFile.time, zone);
    if (generatedAt) {
      warnings.push({
        code: "time_from_filename",
        message: "Generation time taken from the file name.",
      });
    }
  }
  if (!statedZone && (generatedAt || block.researchWindow)) {
    warnings.push({
      code: "timezone_assumed",
      message: `No time zone stated; assumed ${fallbackTimeZone}.`,
    });
  }

  const researchWindow = block.researchWindow
    ? { ...parseWindow(block.researchWindow, zone), text: block.researchWindow }
    : null;

  return { reportDate, generatedAt, timezone: statedZone ?? null, researchWindow };
}

const ENDPOINT = String.raw`(\d{4}-\d{2}-\d{2})?(?:[ T,]+)?(\d{1,2}:\d{2})?`;
const WINDOW = new RegExp(
  String.raw`(\d{4}-\d{2}-\d{2})(?:[ T,]+(\d{1,2}:\d{2}))?\s*(?:\s[–—-]\s|[–—]|\sto\s|\suntil\s)\s*${ENDPOINT}`,
);

/** "2026-11-01 00:00 – 2026-11-03 08:16 (Europe/Athens)" into UTC start and end. */
export function parseWindow(text: string, zone: string): { start: Date | null; end: Date | null } {
  const match = WINDOW.exec(text);
  if (!match) return { start: null, end: null };
  const [, startDate, startTime, endDateRaw, endTime] = match;
  const endDate = endDateRaw ?? (endTime ? startDate : undefined);
  return {
    start: wallTimeToUtc(startDate!, startTime ?? "00:00", zone),
    end: endDate ? wallTimeToUtc(endDate, endTime ?? "23:59", zone) : null,
  };
}
