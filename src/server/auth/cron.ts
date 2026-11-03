import "server-only";
import { timingSafeEqual } from "node:crypto";
import { cronEnv } from "@/env";

/** Constant-time check of `Authorization: Bearer <CRON_SECRET>`. */
export function isAuthorizedCronRequest(authorization: string | null): boolean {
  let secret: string;
  try {
    secret = cronEnv().CRON_SECRET;
  } catch {
    return false; // No secret configured: refuse every request.
  }
  if (!authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
