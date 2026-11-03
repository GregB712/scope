import { describe, expect, it, vi } from "vitest";
import { withRetry } from "@/server/sources/retry";

const base = { attempts: 4, baseDelayMs: 100, maxDelayMs: 1000, random: () => 1 };

describe("withRetry", () => {
  it("backs off exponentially and returns the eventual result", async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    let calls = 0;
    const result = await withRetry(
      async () => {
        if (++calls < 4) throw new Error("flaky");
        return "ok";
      },
      { ...base, isRetryable: () => true, sleep },
    );
    expect(result).toBe("ok");
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([100, 200, 400]);
  });

  it("stops at the attempt limit and on non-retryable errors", async () => {
    const sleep = vi.fn(async () => {});
    const fn = vi.fn(async () => {
      throw new Error("down");
    });
    await expect(withRetry(fn, { ...base, isRetryable: () => true, sleep })).rejects.toThrow(
      "down",
    );
    expect(fn).toHaveBeenCalledTimes(4);
    fn.mockClear();
    await expect(withRetry(fn, { ...base, isRetryable: () => false, sleep })).rejects.toThrow(
      "down",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
