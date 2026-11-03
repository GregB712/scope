import "server-only";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  LIMITS,
  SourceError,
  isMarkdownFile,
  type Listing,
  type RemoteFile,
  type SourceProvider,
} from "../types";

/**
 * Development-only source that reads Markdown from a local folder. Every path is
 * confined to `allowedRoot`. Files are identified by their path relative to the
 * root, which is stable across runs.
 */
export function createFilesystemProvider(allowedRoot: string): SourceProvider {
  const base = resolve(allowedRoot);

  const resolveRoot = (rootRef: string): string => {
    const target = resolve(base, rootRef || ".");
    const rel = relative(base, target);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new SourceError("The folder must be inside FILESYSTEM_SOURCE_ROOT.", "forbidden");
    }
    return target;
  };

  return {
    id: "filesystem",

    async verifyRoot(rootRef) {
      const root = resolveRoot(rootRef);
      const info = await stat(root).catch(() => null);
      if (!info) throw new SourceError("The folder does not exist.", "not_found");
      if (!info.isDirectory())
        throw new SourceError("That path is a file, not a folder.", "not_a_folder");
      return { name: basename(root) || root, ownerEmails: [] };
    },

    async listFiles(rootRef): Promise<Listing> {
      const root = resolveRoot(rootRef);
      const files: RemoteFile[] = [];
      const skipped: Listing["skipped"] = [];

      const walk = async (dir: string, depth: number) => {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
          const full = join(dir, entry.name);
          const path = relative(root, full).split(sep).join("/");
          if (entry.isDirectory()) {
            if (depth + 1 > LIMITS.maxDepth)
              skipped.push({ name: entry.name, path, reason: "folder too deep" });
            else await walk(full, depth + 1);
            continue;
          }
          if (!entry.isFile() || !isMarkdownFile(entry.name, null)) continue;
          const info = await stat(full);
          if (info.size > LIMITS.maxFileBytes) {
            skipped.push({ name: entry.name, path, reason: "file too large" });
            continue;
          }
          files.push({
            // Relative to the allowed base (not the chosen root) so download() can resolve it.
            id: relative(base, full).split(sep).join("/"),
            name: entry.name,
            path,
            mimeType: "text/markdown",
            createdAt: info.birthtimeMs ? info.birthtime : info.mtime,
            modifiedAt: info.mtime,
            checksum: createHash("md5")
              .update(await readFile(full))
              .digest("hex"),
            size: info.size,
          });
        }
      };

      await walk(root, 0);
      return { files, skipped };
    },

    async download(file) {
      const full = resolve(base, file.id);
      const rel = relative(base, full);
      if (rel.startsWith("..") || isAbsolute(rel))
        throw new SourceError("Invalid file path.", "forbidden");
      return new Uint8Array(await readFile(full));
    },
  };
}
