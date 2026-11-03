import { describe, expect, it } from "vitest";
import { createFilesystemProvider } from "@/server/sources/filesystem/provider";
import { SAMPLE_FILE } from "../support/fixtures";

const provider = createFilesystemProvider("fixtures/reports");

describe("filesystem provider", () => {
  it("lists Markdown recursively with stable IDs and checksums", async () => {
    const { files } = await provider.listFiles("");
    const sample = files.find((f) => f.name === SAMPLE_FILE);
    expect(sample).toMatchObject({
      id: `2026/11-November/${SAMPLE_FILE}`,
      path: `2026/11-November/${SAMPLE_FILE}`,
      mimeType: "text/markdown",
    });
    expect(sample?.checksum).toMatch(/^[0-9a-f]{32}$/);
  });

  it("downloads files listed from a sub-folder root", async () => {
    const { files } = await provider.listFiles("2026");
    expect(files[0]?.path).toBe(`11-November/${SAMPLE_FILE}`);
    const bytes = await provider.download(files[0]!);
    expect(new TextDecoder().decode(bytes)).toMatch(/^# Global Intelligence Briefing/);
  });

  it("refuses paths outside the allowed root", async () => {
    await expect(provider.verifyRoot("../src")).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      provider.download({
        id: "../../package.json",
        name: "x",
        path: "x",
        mimeType: null,
        createdAt: null,
        modifiedAt: null,
        checksum: null,
        size: null,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});
