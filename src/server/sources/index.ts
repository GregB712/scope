import "server-only";
import { googleEnv, syncEnv } from "@/env";
import { createDriveApi } from "./google-drive/api";
import { createGoogleDriveProvider } from "./google-drive/provider";
import { createFilesystemProvider } from "./filesystem/provider";
import { SourceError, type ProviderId, type SourceProvider } from "./types";

export * from "./types";

/** Returns the configured provider, or throws a readable error when it is unavailable. */
export function getSourceProvider(id: ProviderId): SourceProvider {
  if (id === "google_drive") {
    return createGoogleDriveProvider(createDriveApi(googleEnv().GOOGLE_SERVICE_ACCOUNT_KEY));
  }
  const env = syncEnv();
  if (!env.ENABLE_FILESYSTEM_SOURCE || !env.FILESYSTEM_SOURCE_ROOT) {
    throw new SourceError("The local folder source is disabled in this environment.", "forbidden");
  }
  return createFilesystemProvider(env.FILESYSTEM_SOURCE_ROOT);
}
