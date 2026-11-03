import { afterEach, describe, expect, it, vi } from "vitest";

describe("env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reports the missing variable by name", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { databaseEnv } = await import("@/env");
    expect(() => databaseEnv()).toThrow(/DATABASE_URL/);
  });

  it("never enables the filesystem source in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_FILESYSTEM_SOURCE", "true");
    const { syncEnv } = await import("@/env");
    expect(syncEnv().ENABLE_FILESYSTEM_SOURCE).toBe(false);
  });

  it("applies the default sync time budget", async () => {
    vi.stubEnv("SYNC_TIME_BUDGET_MS", undefined);
    const { syncEnv } = await import("@/env");
    expect(syncEnv().SYNC_TIME_BUDGET_MS).toBe(240_000);
  });
});
