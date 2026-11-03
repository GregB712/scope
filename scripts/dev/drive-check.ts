/**
 * Live, read-only check of the Google Drive integration (no database writes).
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/dev/drive-check.ts <folder link or ID>
 */
import { parseReport } from "@/core/parser";
import { DEFAULT_TOPICS } from "@/core/topics/defaults";
import { getSourceProvider } from "@/server/sources";
import { parseDriveFolderRef } from "@/server/sources/google-drive/folder-ref";

const folderId = parseDriveFolderRef(process.argv[2] ?? "");
if (!folderId) throw new Error("Pass a Drive folder link or ID.");
const drive = getSourceProvider("google_drive");

const root = await drive.verifyRoot(folderId);
console.log(
  "Root:",
  root.name,
  "| owners exposed:",
  root.ownerEmails.length > 0 ? root.ownerEmails.join(", ") : "none",
);

const { files, skipped } = await drive.listFiles(folderId);
console.log(`Markdown files: ${files.length}, skipped: ${skipped.length}`);
for (const f of files) console.log(`  ${f.path}  md5=${f.checksum?.slice(0, 8)}  ${f.size} B`);

const topics = DEFAULT_TOPICS.map((t, i) => ({ id: `t${i}`, ...t }));
for (const file of files) {
  const raw = new TextDecoder().decode(await drive.download(file));
  const escaped = (raw.match(/\\[#*\-_[\]]/g) ?? []).length;
  const parsed = parseReport(raw, {
    fileName: file.name,
    fallbackDate: file.createdAt ?? new Date(),
    fallbackTimeZone: "Europe/Athens",
    topics,
  });
  console.log(
    `${file.name}: starts ${JSON.stringify(raw.slice(0, 32))}, backslash-escapes=${escaped}, date=${parsed.reportDate}, stories=${parsed.stories.length}, unmapped=${JSON.stringify(parsed.unmatchedCategories)}, warnings=${parsed.warnings.map((w) => w.code).join(",") || "none"}`,
  );
}
