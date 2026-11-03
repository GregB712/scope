/**
 * Provider-neutral contract for report sources. Implementations are read-only:
 * they can list, inspect and download, nothing else.
 */

export type ProviderId = "google_drive" | "filesystem";

export type RemoteFile = {
  /** Stable ID within the provider (Drive file ID, or relative path). */
  id: string;
  name: string;
  /** Path below the root, e.g. "2026/11-November/2026-11-03_0816_Briefing.md". */
  path: string;
  mimeType: string | null;
  createdAt: Date | null;
  modifiedAt: Date | null;
  /** Content checksum when the provider offers one (Drive: MD5). */
  checksum: string | null;
  size: number | null;
};

export type SkippedFile = { name: string; path: string; reason: string };

export type Listing = { files: RemoteFile[]; skipped: SkippedFile[] };

export type RootInfo = {
  name: string;
  /** Owner email addresses, when the provider exposes them. */
  ownerEmails: string[];
};

export interface SourceProvider {
  readonly id: ProviderId;
  /** Confirms the root exists and is readable. Throws {@link SourceError} otherwise. */
  verifyRoot(rootRef: string): Promise<RootInfo>;
  /** Complete recursive listing of report files. Throws if the listing cannot be completed. */
  listFiles(rootRef: string): Promise<Listing>;
  download(file: RemoteFile): Promise<Uint8Array>;
}

export class SourceError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "not_a_folder" | "forbidden" | "unavailable" | "invalid",
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "SourceError";
  }
}

/** Limits that protect the sync from unexpected folder contents. */
export const LIMITS = {
  maxDepth: 6,
  maxFileBytes: 2 * 1024 * 1024,
  maxFolders: 2_000,
} as const;

const MARKDOWN_MIME = new Set(["text/markdown", "text/x-markdown"]);

export function isMarkdownFile(name: string, mimeType: string | null): boolean {
  return /\.(md|markdown)$/i.test(name) || (mimeType !== null && MARKDOWN_MIME.has(mimeType));
}
