import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";

const N = "/n/e2e-desk";
const shot = (name: string, project: string) => `test-results/screens/${project}-${name}.png`;

test("settings pages render", async ({ page }, info) => {
  await page.goto(`${N}/settings`);
  await expect(page.getByLabel("Name")).toHaveValue("Global Intelligence");
  await page.screenshot({ path: shot("settings", info.project.name), fullPage: true });

  await page.goto(`${N}/settings/source`);
  await expect(page.getByText("Scheduled sync on")).toBeVisible();
  await page.screenshot({ path: shot("settings-source", info.project.name), fullPage: true });

  await page.goto(`${N}/settings/sync`);
  await expect(page.getByRole("columnheader", { name: "Imported" })).toBeVisible();
  await page.screenshot({ path: shot("settings-sync", info.project.name), fullPage: true });
});

test("add and delete a topic", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "mutating test runs once");
  await page.goto(`${N}/settings/topics`);
  await page.getByLabel("Name", { exact: true }).last().fill("Space Exploration");
  await page.getByLabel("Also matches (comma separated)").last().fill("Space, NASA");
  await page.getByRole("button", { name: "Add topic" }).click();
  await expect(page.getByText("Also matches: Space, NASA")).toBeVisible();
  await page.screenshot({ path: shot("settings-topics", info.project.name), fullPage: true });

  const row = page.getByRole("listitem").filter({ hasText: "Space Exploration" });
  await row.getByRole("button", { name: "Delete" }).click();
  await row.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText("Space Exploration")).toHaveCount(0);
});

test("onboarding creates a newsroom and imports briefings", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "mutating test runs once");
  const name = `Onboarding ${Date.now()}`;
  try {
    await page.goto("/onboarding");
    await page.getByLabel("Newsroom name").fill(name);
    await page.getByRole("button", { name: "Create newsroom" }).click();
    await expect(page.getByRole("heading", { name: `Set up ${name}` })).toBeVisible();

    await page.getByLabel("Source").selectOption("filesystem");
    await page.getByLabel("Path inside FILESYSTEM_SOURCE_ROOT").fill("2026");
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByText("contains 1 Markdown file")).toBeVisible();
    await page.getByRole("button", { name: "Connect folder" }).click();
    await expect(page.getByText("Connected to")).toBeVisible();

    await page.getByRole("button", { name: "Sync now" }).click();
    await expect(page.getByText("1 briefing imported.")).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: shot("welcome", info.project.name), fullPage: true });

    await page.getByRole("link", { name: "Start reading" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "US midterm elections take place today" }),
    ).toBeVisible();
  } finally {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`delete from newsrooms where name = ${name}`;
  }
});
