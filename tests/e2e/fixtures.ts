import { clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import { test as base } from "@playwright/test";

/**
 * Every test page carries a Clerk testing token. Clerk refreshes the 60-second
 * session token through its Frontend API, which blocks automated browsers
 * without one; long runs would otherwise be signed out midway.
 */
export const test = base.extend<object, { clerkTesting: void }>({
  clerkTesting: [
    async ({}, provide) => {
      await clerkSetup();
      await provide();
    },
    { scope: "worker", auto: true },
  ],
  context: async ({ context }, provide) => {
    await setupClerkTestingToken({ context });
    await provide(context);
  },
});

export { expect } from "@playwright/test";
