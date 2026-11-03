import { z } from "zod";

type Raw = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export type ArchiveParams = {
  q?: string;
  from?: string;
  to?: string;
  month?: string;
  topic?: string;
  minImportance?: number;
  sort: "newest" | "oldest";
  view: "list" | "grid";
  page: number;
};

/** Parses archive filters from the URL, silently dropping anything invalid. */
export function parseArchiveParams(raw: Raw): ArchiveParams {
  const get = (key: string) => first(raw[key])?.trim() || undefined;
  const pick = <T>(schema: z.ZodType<T>, value: unknown) => {
    const result = schema.safeParse(value);
    return result.success ? result.data : undefined;
  };
  const params: ArchiveParams = {
    q: get("q")?.slice(0, 200),
    from: pick(isoDate, get("from")),
    to: pick(isoDate, get("to")),
    month: pick(month, get("month")),
    topic: pick(z.string().regex(/^[a-z0-9-]{1,100}$/), get("topic")),
    minImportance: pick(z.coerce.number().int().min(1).max(10), get("importance")),
    sort: get("sort") === "oldest" ? "oldest" : "newest",
    view: get("view") === "grid" ? "grid" : "list",
    page: pick(z.coerce.number().int().min(1).max(10_000), get("page")) ?? 1,
  };
  if (params.month) {
    const [y, m] = params.month.split("-").map(Number) as [number, number];
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    params.from = `${params.month}-01`;
    params.to = `${params.month}-${String(last).padStart(2, "0")}`;
  }
  return params;
}

/** Rebuilds a query string, omitting defaults and empty values. */
export function toQuery(params: Partial<Record<string, string | number | undefined>>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== null) search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
