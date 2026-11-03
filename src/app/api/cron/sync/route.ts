import { isAuthorizedCronRequest } from "@/server/auth/cron";
import { syncAllSources } from "@/server/sync";

// Vercel Hobby allows up to 300 seconds; the sync stops starting files before that.
export const maxDuration = 300;

/** Scheduled synchronization of every enabled source. Invoked by Vercel Cron. */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await syncAllSources("cron");
  return Response.json({ results });
}
