import { expect, test } from "./fixtures";

/**
 * A signed-in reader (not in ADMIN_EMAILS) can read everything the admin
 * publishes, and reach nothing that changes it.
 */
test.use({ storageState: "playwright/.auth/reader.json" });

const N = "/n/e2e-desk";
const REPORT = `${N}/reports/2026-11-03-0816-global-intelligence-briefing`;

test("lands on the published newsroom", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(new RegExp(`${N}$`));
  await expect(page.getByRole("link", { name: "Read the briefing" })).toBeVisible();
});

test("reads reports, topics, search and the original Markdown", async ({ page }) => {
  await page.goto(REPORT);
  await expect(
    page.getByRole("heading", { level: 1, name: "Global Intelligence Briefing" }),
  ).toBeVisible();

  await page.goto(`${N}/topics`);
  await expect(page.getByRole("heading", { level: 1, name: "Topics" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit topics" })).toHaveCount(0);

  await page.goto(`${N}/search?q=oil`);
  await expect(page.getByRole("heading", { name: "Stories" })).toBeVisible();

  const raw = await page.request.get(`${REPORT}/raw`);
  expect(raw.status()).toBe(200);
  expect(await raw.text()).toContain("Global Intelligence Briefing");
});

test("sees no settings and cannot open them", async ({ page }, info) => {
  await page.goto(N);
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: /menu/i }).click();
    await expect(page.getByRole("link", { name: "Archive" }).last()).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  }

  for (const path of [
    `${N}/settings`,
    `${N}/settings/topics`,
    `${N}/settings/source`,
    `${N}/welcome`,
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }

  // Creating a newsroom is for admins: onboarding sends readers home.
  await page.goto("/onboarding");
  await expect(page).toHaveURL(new RegExp(`${N}$`));
});
