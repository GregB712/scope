import { createHash } from "node:crypto";

/** SHA-256 (hex) of the exact source bytes. Used to detect content changes. */
export function contentHash(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
