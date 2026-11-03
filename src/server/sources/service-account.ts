import "server-only";
import { googleEnv, isGoogleDriveConfigured } from "@/env";
import { serviceAccountEmail } from "./google-drive/api";

/** What Settings shows about the Google setup. The email is not a secret; the key never leaves the server. */
export function googleSetupStatus():
  { state: "missing" } | { state: "invalid"; message: string } | { state: "ready"; email: string } {
  if (!isGoogleDriveConfigured()) return { state: "missing" };
  try {
    return { state: "ready", email: serviceAccountEmail(googleEnv().GOOGLE_SERVICE_ACCOUNT_KEY) };
  } catch (error) {
    return { state: "invalid", message: (error as Error).message };
  }
}
