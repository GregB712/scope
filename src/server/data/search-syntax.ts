import { sql, type SQL } from "drizzle-orm";
import { MARK_END, MARK_START } from "@/core/highlight";

export const HIGHLIGHT = `StartSel=${MARK_START}, StopSel=${MARK_END}, MaxWords=28, MinWords=12, ShortWord=3, MaxFragments=1`;

/** `websearch_to_tsquery` accepts any user input without syntax errors. */
export function tsQuery(input: string): SQL {
  return sql`websearch_to_tsquery('english', ${input.slice(0, 200)})`;
}
