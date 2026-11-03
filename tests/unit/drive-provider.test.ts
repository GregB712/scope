import { describe, expect, it, vi } from "vitest";
import { FOLDER_MIME, type DriveApi, type DriveFile } from "@/server/sources/google-drive/api";
import { parseDriveFolderRef } from "@/server/sources/google-drive/folder-ref";
import { createGoogleDriveProvider } from "@/server/sources/google-drive/provider";
import { SourceError } from "@/server/sources/types";

const folder = (id: string, name: string): DriveFile => ({ id, name, mimeType: FOLDER_MIME });
const md = (id: string, name: string, extra: Partial<DriveFile> = {}): DriveFile => ({
  id,
  name,
  mimeType: "text/markdown",
  createdTime: "2026-11-03T06:22:10.345Z",
  modifiedTime: "2026-11-03T06:22:10.345Z",
  md5Checksum: `md5-${id}`,
  size: "22543",
  ...extra,
});

/** A fake Drive with the reference automation's year/month layout. */
function fakeDrive(overrides: Partial<DriveApi> = {}) {
  const tree: Record<string, DriveFile[]> = {
    root: [
      folder("y2026", "2026"),
      md("readme", "README.md"),
      { id: "doc", name: "Notes", mimeType: "application/vnd.google-apps.document" },
    ],
    y2026: [folder("m11", "11-November"), folder("m10", "10-October")],
    m11: [
      md("f1", "2026-11-03_0816_Global_Intelligence_Briefing.md"),
      md("f2", "2026-11-02_1034_Global_Intelligence_Briefing.md"),
      { id: "sc", name: "shortcut.md", mimeType: "application/vnd.google-apps.shortcut" },
      md("big", "huge.md", { size: String(5 * 1024 * 1024) }),
    ],
    m10: [md("f3", "2026-10-30_0800_Global_Intelligence_Briefing.md", { mimeType: "text/plain" })],
  };
  const api: DriveApi = {
    listChildren: vi.fn(async (id: string, pageToken?: string) => {
      const items = tree[id] ?? [];
      // Paginate the month folder to exercise nextPageToken.
      if (id === "m11" && !pageToken) return { files: items.slice(0, 2), nextPageToken: "p2" };
      if (id === "m11") return { files: items.slice(2) };
      return { files: items };
    }),
    getFile: vi.fn(async (id: string) => ({
      ...folder(id, "Global Intelligence Briefing"),
      owners: [{ emailAddress: "Owner@Example.com" }],
    })),
    downloadFile: vi.fn(async () => new TextEncoder().encode("# Report")),
    ...overrides,
  };
  return api;
}

const noWait = { attempts: 5, baseDelayMs: 1, maxDelayMs: 1, sleep: async () => {} };

const httpError = (status: number, reason?: string, headers: Record<string, string> = {}) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: { status, headers, data: { error: { errors: reason ? [{ reason }] : [] } } },
  });

describe("Google Drive provider: listing", () => {
  it("walks year and month folders, follows pagination, and keeps only Markdown", async () => {
    const provider = createGoogleDriveProvider(fakeDrive(), noWait);
    const { files, skipped } = await provider.listFiles("root");
    expect(files.map((f) => f.path).sort()).toEqual([
      "2026/10-October/2026-10-30_0800_Global_Intelligence_Briefing.md",
      "2026/11-November/2026-11-02_1034_Global_Intelligence_Briefing.md",
      "2026/11-November/2026-11-03_0816_Global_Intelligence_Briefing.md",
      "README.md",
    ]);
    expect(skipped.map((s) => [s.name, s.reason])).toEqual([
      ["shortcut.md", "shortcut"],
      ["huge.md", "file too large"],
    ]);
  });

  it("maps Drive metadata", async () => {
    const provider = createGoogleDriveProvider(fakeDrive(), noWait);
    const { files } = await provider.listFiles("root");
    expect(files.find((f) => f.id === "f1")).toEqual({
      id: "f1",
      name: "2026-11-03_0816_Global_Intelligence_Briefing.md",
      path: "2026/11-November/2026-11-03_0816_Global_Intelligence_Briefing.md",
      mimeType: "text/markdown",
      createdAt: new Date("2026-11-03T06:22:10.345Z"),
      modifiedAt: new Date("2026-11-03T06:22:10.345Z"),
      checksum: "md5-f1",
      size: 22543,
    });
  });

  it("retries rate limits and server errors, then succeeds", async () => {
    const api = fakeDrive();
    const real = api.listChildren;
    let failures = 0;
    api.listChildren = vi.fn(async (...args: Parameters<DriveApi["listChildren"]>) => {
      if (failures++ < 3)
        throw [httpError(429), httpError(503), httpError(403, "userRateLimitExceeded")][
          failures - 1
        ];
      return real(...args);
    });
    const { files } = await createGoogleDriveProvider(api, noWait).listFiles("root");
    expect(files).toHaveLength(4);
  });

  it("honors Retry-After", async () => {
    const api = fakeDrive();
    const real = api.listChildren;
    let failed = false;
    api.listChildren = vi.fn(async (...args: Parameters<DriveApi["listChildren"]>) => {
      if (!failed) {
        failed = true;
        throw httpError(429, undefined, { "retry-after": "7" });
      }
      return real(...args);
    });
    const sleep = vi.fn(async () => {});
    await createGoogleDriveProvider(api, {
      attempts: 3,
      baseDelayMs: 1,
      maxDelayMs: 60_000,
      sleep,
    }).listFiles("root");
    expect(sleep).toHaveBeenCalledWith(7000);
  });

  it("fails fast on non-retryable errors", async () => {
    const listChildren = vi.fn(async () => {
      throw httpError(400, "badRequest");
    });
    const provider = createGoogleDriveProvider(fakeDrive({ listChildren }), noWait);
    await expect(provider.listFiles("root")).rejects.toThrow("HTTP 400");
    expect(listChildren).toHaveBeenCalledTimes(1);
  });

  it("reports an unavailable Drive after exhausting retries", async () => {
    const listChildren = vi.fn(async () => {
      throw httpError(503);
    });
    const provider = createGoogleDriveProvider(fakeDrive({ listChildren }), noWait);
    await expect(provider.listFiles("root")).rejects.toMatchObject({ code: "unavailable" });
    expect(listChildren).toHaveBeenCalledTimes(5);
  });
});

describe("Google Drive provider: root verification", () => {
  it("returns the folder name and lower-cased owner emails", async () => {
    const provider = createGoogleDriveProvider(fakeDrive(), noWait);
    await expect(provider.verifyRoot("root")).resolves.toEqual({
      name: "Global Intelligence Briefing",
      ownerEmails: ["owner@example.com"],
    });
  });

  it("explains missing, unshared, file and trashed roots", async () => {
    const make = (getFile: DriveApi["getFile"]) =>
      createGoogleDriveProvider(fakeDrive({ getFile }), noWait);
    await expect(
      make(async () => {
        throw httpError(404);
      }).verifyRoot("x"),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(make(async () => md("x", "a.md")).verifyRoot("x")).rejects.toMatchObject({
      code: "not_a_folder",
    });
    await expect(
      make(async () => ({ ...folder("x", "Old"), trashed: true })).verifyRoot("x"),
    ).rejects.toBeInstanceOf(SourceError);
  });
});

describe("parseDriveFolderRef", () => {
  const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
  it.each([
    id,
    `https://drive.google.com/drive/folders/${id}`,
    `https://drive.google.com/drive/u/0/folders/${id}?usp=sharing`,
    `https://drive.google.com/open?id=${id}`,
  ])("reads %s", (input) => {
    expect(parseDriveFolderRef(input)).toBe(id);
  });

  it.each(["", "not a folder", "https://example.com/", "abc'; drop"])("rejects %j", (input) => {
    expect(parseDriveFolderRef(input)).toBeNull();
  });
});
