import "server-only";
import { withRetry } from "../retry";
import {
  LIMITS,
  SourceError,
  isMarkdownFile,
  type Listing,
  type RemoteFile,
  type RootInfo,
  type SkippedFile,
  type SourceProvider,
} from "../types";
import { FOLDER_MIME, type DriveApi, type DriveFile } from "./api";
import { httpStatus, isRetryableDriveError, retryAfterMs } from "./errors";

const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";

export type RetryPolicy = {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_RETRY: RetryPolicy = { attempts: 5, baseDelayMs: 500, maxDelayMs: 20_000 };

export function createGoogleDriveProvider(
  api: DriveApi,
  retry: RetryPolicy = DEFAULT_RETRY,
): SourceProvider {
  const call = <T>(fn: () => Promise<T>) =>
    withRetry(fn, { ...retry, isRetryable: isRetryableDriveError, retryAfterMs });

  const toSourceError = (error: unknown, what: string): unknown => {
    const status = httpStatus(error);
    if (status === 404)
      return new SourceError(
        `${what} was not found, or is not shared with the service account.`,
        "not_found",
        { cause: error },
      );
    if (status === 401 || status === 403)
      return new SourceError(`Access to ${what} was denied.`, "forbidden", { cause: error });
    if (isRetryableDriveError(error))
      return new SourceError("Google Drive is temporarily unavailable.", "unavailable", {
        cause: error,
      });
    return error;
  };

  async function listAll(folderId: string): Promise<DriveFile[]> {
    const files: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const page = await call(() => api.listChildren(folderId, pageToken));
      files.push(...page.files);
      pageToken = page.nextPageToken;
    } while (pageToken);
    return files;
  }

  return {
    id: "google_drive",

    async verifyRoot(rootRef: string): Promise<RootInfo> {
      let file: DriveFile;
      try {
        file = await call(() => api.getFile(rootRef));
      } catch (error) {
        throw toSourceError(error, "The folder");
      }
      if (file.trashed) throw new SourceError("The folder is in the trash.", "not_found");
      if (file.mimeType !== FOLDER_MIME)
        throw new SourceError("That link is a file, not a folder.", "not_a_folder");
      return {
        name: file.name,
        ownerEmails: (file.owners ?? []).flatMap((o) =>
          o.emailAddress ? [o.emailAddress.toLowerCase()] : [],
        ),
      };
    },

    async listFiles(rootRef: string): Promise<Listing> {
      const files: RemoteFile[] = [];
      const skipped: SkippedFile[] = [];
      const queue: { id: string; path: string; depth: number }[] = [
        { id: rootRef, path: "", depth: 0 },
      ];
      let foldersVisited = 0;

      try {
        while (queue.length) {
          const folder = queue.shift()!;
          if (++foldersVisited > LIMITS.maxFolders) {
            throw new SourceError(
              `More than ${LIMITS.maxFolders} folders below the root.`,
              "invalid",
            );
          }
          for (const item of await listAll(folder.id)) {
            const path = folder.path ? `${folder.path}/${item.name}` : item.name;
            if (item.mimeType === FOLDER_MIME) {
              if (folder.depth + 1 > LIMITS.maxDepth)
                skipped.push({ name: item.name, path, reason: "folder too deep" });
              else queue.push({ id: item.id, path, depth: folder.depth + 1 });
              continue;
            }
            if (item.mimeType === SHORTCUT_MIME) {
              skipped.push({ name: item.name, path, reason: "shortcut" });
              continue;
            }
            if (!isMarkdownFile(item.name, item.mimeType)) continue;
            const size = item.size ? Number(item.size) : null;
            if (size !== null && size > LIMITS.maxFileBytes) {
              skipped.push({ name: item.name, path, reason: "file too large" });
              continue;
            }
            files.push({
              id: item.id,
              name: item.name,
              path,
              mimeType: item.mimeType,
              createdAt: item.createdTime ? new Date(item.createdTime) : null,
              modifiedAt: item.modifiedTime ? new Date(item.modifiedTime) : null,
              checksum: item.md5Checksum ?? null,
              size,
            });
          }
        }
      } catch (error) {
        throw error instanceof SourceError ? error : toSourceError(error, "The folder");
      }
      return { files, skipped };
    },

    async download(file: RemoteFile): Promise<Uint8Array> {
      try {
        return await call(() => api.downloadFile(file.id));
      } catch (error) {
        throw toSourceError(error, `"${file.name}"`);
      }
    },
  };
}
