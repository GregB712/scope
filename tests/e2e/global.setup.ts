import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createClerkClient } from "@clerk/backend";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { neon } from "@neondatabase/serverless";
import { type Browser, test as setup } from "@playwright/test";
import { DEFAULT_TOPICS } from "../../src/core/topics/defaults";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

/** The admin test user. Its email must be listed in ADMIN_EMAILS in .env.local. */
export const E2E_EMAIL = "scope-e2e+clerk_test@example.com";
/** A reader: signed in, not an admin. */
export const E2E_READER_EMAIL = "scope-e2e-reader+clerk_test@example.com";
export const E2E_NEWSROOM = "e2e-desk";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

/** A dedicated Clerk test user in the development instance (+clerk_test emails are verified). */
async function testUser(email: string, firstName: string) {
  const existing = await clerkClient.users.getUserList({ emailAddress: [email] });
  return (
    existing.data[0] ??
    (await clerkClient.users.createUser({
      emailAddress: [email],
      skipPasswordRequirement: true,
      firstName,
    }))
  );
}

/** Signs in with a one-time ticket in a fresh context and saves that session. */
async function saveSession(browser: Browser, userId: string, path: string) {
  const context = await browser.newContext({ baseURL: setup.info().project.use.baseURL });
  const page = await context.newPage();
  const token = await clerkClient.signInTokens.createSignInToken({ userId, expiresInSeconds: 600 });
  await page.goto("/");
  await clerk.signIn({ page, signInParams: { strategy: "ticket", ticket: token.token } });
  await context.storageState({ path });
  await context.close();
}

setup("prepare test users, newsroom and sessions", async ({ browser }) => {
  setup.setTimeout(180_000);
  await clerkSetup();
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .toLowerCase()
    .split(",")
    .map((e) => e.trim());
  if (!admins.includes(E2E_EMAIL)) {
    throw new Error(`Add ${E2E_EMAIL} to ADMIN_EMAILS in .env.local to run the e2e tests.`);
  }

  // 1. An admin and a reader.
  const user = await testUser(E2E_EMAIL, "E2E");
  const reader = await testUser(E2E_READER_EMAIL, "Reader");

  // 2. A newsroom fed by the local fixtures folder, synced through the real pipeline.
  const sql = neon(process.env.DATABASE_URL!);
  const [newsroom] = await sql`
    insert into newsrooms (owner_id, name, slug, description, timezone)
    values (${user.id}, 'Global Intelligence', ${E2E_NEWSROOM}, 'Daily briefing on markets, technology and world events.', 'Europe/Athens')
    on conflict (slug) do update set name = excluded.name, description = excluded.description
    returning id`;
  const topicCount =
    await sql`select count(*)::int as n from topics where newsroom_id = ${newsroom!.id}`;
  if (topicCount[0]!.n === 0) {
    for (const [i, t] of DEFAULT_TOPICS.entries()) {
      const slug = t.name
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-");
      await sql`insert into topics (newsroom_id, name, slug, aliases, position) values (${newsroom!.id}, ${t.name}, ${slug}, ${t.aliases}, ${i})`;
    }
  }
  await sql`
    insert into sources (newsroom_id, provider, root_ref, root_name)
    values (${newsroom!.id}, 'filesystem', '', 'fixtures')
    on conflict (provider, root_ref) do nothing`;
  execSync(`npm run sync -- --newsroom ${E2E_NEWSROOM}`, { stdio: "ignore" });

  // 3. Keep a signed-in session for each role.
  await saveSession(browser, user.id, "playwright/.auth/user.json");
  await saveSession(browser, reader.id, "playwright/.auth/reader.json");
});
