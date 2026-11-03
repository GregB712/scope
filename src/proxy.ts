import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Makes the Clerk session available to the app. Authorization is deliberately
 * not done here: every page, layout, route handler and Server Action checks the
 * session and newsroom ownership itself (src/server/auth), as Clerk recommends,
 * so a routing mismatch can never expose protected data.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
