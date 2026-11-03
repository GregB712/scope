import "server-only";
import { drive, type drive_v3 } from "@googleapis/drive";
import { JWT } from "google-auth-library";
import { z } from "zod";

/**
 * The only module that talks to the Google Drive SDK.
 *
 * READ-ONLY BY CONSTRUCTION: it requests the `drive.readonly` scope and exposes
 * three operations built on `files.list` and `files.get`. Nothing in Scope can
 * create, modify, move, share or delete Drive content. A test enforces this
 * (tests/unit/drive-readonly.test.ts).
 */
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

export const FOLDER_MIME = "application/vnd.google-apps.folder";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  modifiedTime?: string;
  md5Checksum?: string;
  size?: string;
  trashed?: boolean;
  owners?: { emailAddress?: string }[];
};

/** Narrow interface the provider depends on; tests substitute a fake. */
export interface DriveApi {
  listChildren(
    folderId: string,
    pageToken?: string,
  ): Promise<{ files: DriveFile[]; nextPageToken?: string }>;
  getFile(fileId: string): Promise<DriveFile>;
  downloadFile(fileId: string): Promise<Uint8Array>;
}

const LIST_FIELDS =
  "nextPageToken, files(id, name, mimeType, createdTime, modifiedTime, md5Checksum, size, trashed)";
const FILE_FIELDS = "id, name, mimeType, trashed, owners(emailAddress)";

const serviceAccountKey = z.object({
  client_email: z.email(),
  private_key: z.string().includes("PRIVATE KEY"),
});

/** Decodes `GOOGLE_SERVICE_ACCOUNT_KEY` (base64 JSON, or raw JSON for convenience). */
export function decodeServiceAccountKey(value: string): { email: string; privateKey: string } {
  const trimmed = value.trim();
  const json = trimmed.startsWith("{") ? trimmed : Buffer.from(trimmed, "base64").toString("utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid base64-encoded JSON.");
  }
  const key = serviceAccountKey.safeParse(parsed);
  if (!key.success) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is missing client_email or private_key.");
  }
  return { email: key.data.client_email, privateKey: key.data.private_key };
}

export function createDriveApi(encodedKey: string): DriveApi {
  const { email, privateKey } = decodeServiceAccountKey(encodedKey);
  const auth = new JWT({ email, key: privateKey, scopes: [DRIVE_SCOPE] });
  const client: drive_v3.Drive = drive({ version: "v3", auth });
  // Retries are handled by the provider's own policy (see ../retry.ts).
  const noRetry = { retry: false };

  return {
    async listChildren(folderId, pageToken) {
      const res = await client.files.list(
        {
          q: `'${folderId.replace(/['\\]/g, "\\$&")}' in parents and trashed = false`,
          fields: LIST_FIELDS,
          pageSize: 1000,
          pageToken,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        },
        noRetry,
      );
      return {
        files: (res.data.files ?? []) as DriveFile[],
        nextPageToken: res.data.nextPageToken ?? undefined,
      };
    },

    async getFile(fileId) {
      const res = await client.files.get(
        { fileId, fields: FILE_FIELDS, supportsAllDrives: true },
        noRetry,
      );
      return res.data as DriveFile;
    },

    async downloadFile(fileId) {
      const res = await client.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { ...noRetry, responseType: "arraybuffer" },
      );
      return new Uint8Array(res.data as unknown as ArrayBuffer);
    },
  };
}

/** The service account's email, shown in Settings so users know whom to share with. */
export function serviceAccountEmail(encodedKey: string): string {
  return decodeServiceAccountKey(encodedKey).email;
}
