import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createClerkClient } from "@clerk/backend";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { neon } from "@neondatabase/serverless";
import { test as setup } from "@playwright/test";
import { DEFAULT_TOPICS } from "../../src/core/topics/defaults";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export const E2E_EMAIL = "scope-e2e+clerk_test@example.com";
export const E2E_NEWSROOM = "e2e-desk";

setup("prepare test user, newsroom and session", async ({ page }) => {
  setup.setTimeout(180_000);
  await clerkSetup();

  // 1. A dedicated Clerk test user in the development instance.
  const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  const existing = await clerkClient.users.getUserList({ emailAddress: [E2E_EMAIL] });
  const user =
    existing.data[0] ??
    (await clerkClient.users.createUser({
      emailAddress: [E2E_EMAIL],
      skipPasswordRequirement: true,
      firstName: "E2E",
    }));

  // 2. A newsroom fed by the local fixtures folder, synced through the real pipeline.
  const sql = neon(process.env.DATABASE_URL!);
  const [newsroom] = await sql`
    insert into newsrooms (owner_id, name, slug, description, timezone)
    values (${user.id}, 'Global Intelligence', ${E2E_NEWSROOM}, 'Daily briefing on markets, technology and world events.', 'Europe/Athens')
    on conflict (owner_id, slug) do update set name = excluded.name, description = excluded.description
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

  // 3. Sign in with a one-time ticket and keep the session for the other projects.
  const token = await clerkClient.signInTokens.createSignInToken({
    userId: user.id,
    expiresInSeconds: 600,
  });
  await page.goto("/");
  await clerk.signIn({ page, signInParams: { strategy: "ticket", ticket: token.token } });
  await page.context().storageState({ path: "playwright/.auth/user.json" });
});
