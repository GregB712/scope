import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const syncAllSources = vi.fn(async () => [{ sourceId: "s1", result: { status: "succeeded" } }]);
vi.mock("@/server/sync", () => ({ syncAllSources }));

const SECRET = "a-test-secret-of-sufficient-length";

describe("GET /api/cron/sync", () => {
  beforeEach(() => {
    vi.resetModules();
    syncAllSources.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  const call = async (authorization?: string) => {
    const { GET } = await import("@/app/api/cron/sync/route");
    const headers = authorization ? { authorization } : undefined;
    return GET(new Request("http://localhost/api/cron/sync", { headers }));
  };

  it("rejects requests without the secret", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    expect((await call()).status).toBe(401);
    expect((await call(`Bearer wrong-${SECRET}`)).status).toBe(401);
    expect((await call(SECRET)).status).toBe(401);
    expect(syncAllSources).not.toHaveBeenCalled();
  });

  it("refuses everything when no secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
  });

  it("runs the sync with the right secret", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(syncAllSources).toHaveBeenCalledWith("cron");
    expect(await response.json()).toEqual({
      results: [{ sourceId: "s1", result: { status: "succeeded" } }],
    });
  });
});
