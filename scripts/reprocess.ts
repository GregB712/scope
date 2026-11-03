/**
 * Re-parses every stored report from its saved Markdown (no Drive access).
 * Run after upgrading the parser or bulk-editing topics.
 *
 *   npm run reprocess
 */
import { withTransactionalDb } from "@/server/db/client";
import { newsrooms } from "@/server/db/schema";
import { reprocessNewsroom } from "@/server/sync/reprocess";

await withTransactionalDb(async (db) => {
  for (const newsroom of await db
    .select({ id: newsrooms.id, slug: newsrooms.slug })
    .from(newsrooms)) {
    const result = await reprocessNewsroom(db, newsroom.id);
    console.log(
      `${newsroom.slug}: ${result.reprocessed} re-parsed, ${result.failed.length} failed`,
    );
    for (const failure of result.failed) console.log(`  ${failure.reportId}: ${failure.message}`);
  }
});
