import { z } from "zod";
import { AuthorizationError } from "@/server/auth";
import { SourceError } from "@/server/sources/types";
import { FolderAlreadyBoundError } from "@/server/data/sources";

export type ActionResult<T = undefined> =
  | ({ ok: true } & ([T] extends [undefined] ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Converts expected failures into messages; unexpected ones are logged and hidden. */
export function toActionError(error: unknown): {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string[]>;
} {
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      error: error.issues[0]?.message ?? "Please check the form.",
      fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
    };
  }
  if (
    error instanceof AuthorizationError ||
    error instanceof SourceError ||
    error instanceof FolderAlreadyBoundError
  ) {
    return { ok: false, error: error.message };
  }
  console.error(error);
  return { ok: false, error: "Something went wrong. Please try again." };
}
