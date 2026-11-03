/**
 * Exponential backoff with full jitter, honoring a server-provided delay.
 */

export type RetryOptions = {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Whether a failure is worth retrying. */
  isRetryable: (error: unknown) => boolean;
  /** Server-requested delay (Retry-After), if any. */
  retryAfterMs?: (error: unknown) => number | undefined;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= options.attempts || !options.isRetryable(error)) throw error;
      const backoff = Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** (attempt - 1));
      const delay = options.retryAfterMs?.(error) ?? Math.round(random() * backoff);
      await sleep(Math.min(delay, options.maxDelayMs));
    }
  }
}
