import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DRIVE_SCOPE, decodeServiceAccountKey } from "@/server/sources/google-drive/api";

const listFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? listFiles(join(dir, e.name))
      : /\.tsx?$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );

describe("Google Drive access is read-only", () => {
  it("requests only the drive.readonly scope", () => {
    expect(DRIVE_SCOPE).toBe("https://www.googleapis.com/auth/drive.readonly");
  });

  it("never calls a Drive method that writes", () => {
    const source = listFiles("src/server/sources/google-drive")
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    const forbidden =
      /\.(create|update|delete|copy|emptyTrash|generateIds|watch|modifyLabels)\s*\(|permissions\.|revisions\.|comments\.|replies\.|drives\./;
    expect(source).not.toMatch(forbidden);
    expect(source).toContain("files.list(");
    expect(source).toContain("files.get(");
  });

  it("imports the Drive SDK in exactly one module", () => {
    const importers = listFiles("src").filter((f) =>
      /from "@googleapis\/drive"|from "googleapis"/.test(readFileSync(f, "utf8")),
    );
    expect(importers).toEqual(["src/server/sources/google-drive/api.ts"]);
  });
});

describe("service account key", () => {
  const json = JSON.stringify({
    client_email: "reader@demo.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
  });

  it("accepts base64 JSON and raw JSON", () => {
    expect(decodeServiceAccountKey(Buffer.from(json).toString("base64")).email).toBe(
      "reader@demo.iam.gserviceaccount.com",
    );
    expect(decodeServiceAccountKey(json).email).toBe("reader@demo.iam.gserviceaccount.com");
  });

  it("rejects malformed keys without echoing them", () => {
    expect(() => decodeServiceAccountKey("bm90IGpzb24=")).toThrow(/not valid base64-encoded JSON/);
    expect(() => decodeServiceAccountKey('{"client_email":"x"}')).toThrow(
      /missing client_email or private_key/,
    );
  });
});
