/**
 * Local synchronization without the web server.
 *
 *   npm run sync                       # every enabled source
 *   npm run sync -- --newsroom <slug>  # sources of one newsroom (any owner)
 *
 * Uses the same service as the cron route and the "Sync now" button. There is
 * no time limit here, so it is also the way to backfill a large archive.
 */
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { newsrooms, sources } from "@/server/db/schema";
import { syncAllSources, syncSourceById } from "@/server/sync";

const NO_LIMIT = 24 * 60 * 60 * 1000;

const { values } = parseArgs({ options: { newsroom: { type: "string" } } });

if (values.newsroom) {
  const rows = await getDb()
    .select({ id: sources.id, rootName: sources.rootName })
    .from(sources)
    .innerJoin(newsrooms, eq(newsrooms.id, sources.newsroomId))
    .where(eq(newsrooms.slug, values.newsroom));
  if (!rows.length) {
    console.error(`No sources found for newsroom "${values.newsroom}".`);
    process.exit(1);
  }
  for (const row of rows) {
    console.log(`Syncing ${row.rootName ?? row.id}...`);
    console.log(JSON.stringify(await syncSourceById(row.id, "cli", null, NO_LIMIT), null, 2));
  }
} else {
  console.log(JSON.stringify(await syncAllSources("cli", NO_LIMIT), null, 2));
}
