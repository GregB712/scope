import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/server/db/client";
import { findNewsroom } from "@/server/data/newsroom-access";
import { getReport } from "@/server/data/reports";

/** The original Markdown, exactly as imported. Any signed-in reader. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/n/[newsroom]/reports/[report]/raw">,
) {
  const { newsroom: slug, report: reportSlug } = await ctx.params;
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const db = getDb();
  const newsroom = await findNewsroom(db, slug);
  const found = newsroom ? await getReport(db, newsroom, reportSlug) : null;
  if (!found) return new Response("Not found", { status: 404 });
  const fileName = found.report.sourceFileName.replace(/["\\\r\n]/g, "");
  return new Response(found.report.rawMarkdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
