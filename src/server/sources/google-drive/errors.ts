/**
 * Interprets errors from the Google API client (gaxios) without depending on its types.
 */

type ErrorLike = {
  status?: number;
  code?: number | string;
  response?: {
    status?: number;
    headers?: Headers | Record<string, string | undefined>;
    data?: { error?: { errors?: { reason?: string }[]; message?: string } };
  };
};

export function httpStatus(error: unknown): number | undefined {
  const e = error as ErrorLike;
  const status =
    e?.response?.status ?? e?.status ?? (typeof e?.code === "number" ? e.code : undefined);
  return typeof status === "number" ? status : undefined;
}

export function errorReason(error: unknown): string | undefined {
  return (error as ErrorLike)?.response?.data?.error?.errors?.[0]?.reason;
}

const RATE_LIMIT_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded"]);
const NETWORK_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ENOTFOUND",
  "EPIPE",
]);

/** Retry on network failures, 408, 429, 5xx, and Drive's 403 rate-limit responses. */
export function isRetryableDriveError(error: unknown): boolean {
  const status = httpStatus(error);
  if (status === undefined) {
    const code = (error as ErrorLike)?.code;
    return typeof code === "string" && NETWORK_CODES.has(code);
  }
  if (status === 408 || status === 429 || status >= 500) return true;
  return status === 403 && RATE_LIMIT_REASONS.has(errorReason(error) ?? "");
}

export function retryAfterMs(error: unknown): number | undefined {
  const headers = (error as ErrorLike)?.response?.headers;
  const raw = headers instanceof Headers ? headers.get("retry-after") : headers?.["retry-after"];
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(raw);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}
