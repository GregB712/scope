import { and, eq, isNull, type SQL } from "drizzle-orm";
import { reports } from "@/server/db/schema";
import type { AuthorizedNewsroom } from "./newsroom-access";

/**
 * Reports shown in the app: this newsroom's, whose source file is still in the
 * source folder. A report whose file was removed stays in the database (its
 * original Markdown is preserved) but disappears from every page, and comes back
 * if the file is restored. Sync code does not use this filter.
 */
export function visibleReports(newsroom: AuthorizedNewsroom): SQL {
  return and(eq(reports.newsroomId, newsroom.id), isNull(reports.sourceMissingAt))!;
}
