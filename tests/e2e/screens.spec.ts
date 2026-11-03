import { expect, test } from "@playwright/test";

/**
 * Visual walkthrough: every main screen renders for a signed-in owner, with
 * screenshots for review in test-results/screens/.
 */
const N = "/n/e2e-desk";
const REPORT = `${N}/reports/2026-11-03-0816-global-intelligence-briefing`;

const shot = (name: string, project: string) => `test-results/screens/${project}-${name}.png`;

test("reading view", async ({ page }, info) => {
  await page.goto(REPORT);
  await expect(
    page.getByRole("heading", { level: 1, name: "Global Intelligence Briefing" }),
  ).toBeVisible();
  await expect(
    page.locator('[id="24-top-severity-node-red-flaw-under-active-attack"]'),
  ).toBeVisible();
  await page.screenshot({ path: shot("report", info.project.name), fullPage: false });
  await page.locator('[id="2-top-stories"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: shot("report-stories", info.project.name) });
  await page.locator('[id="4-financial-market-snapshot"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: shot("report-table", info.project.name) });
});

test("today", async ({ page }, info) => {
  await page.goto(N);
  await expect(
    page.getByRole("heading", { level: 1, name: "US midterm elections take place today" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Read the briefing" })).toBeVisible();
  await page.screenshot({ path: shot("today", info.project.name), fullPage: true });
});

test("archive with filters", async ({ page }, info) => {
  await page.goto(`${N}/reports`);
  await expect(page.getByText("1 briefing", { exact: true })).toBeVisible();
  await page.screenshot({ path: shot("archive", info.project.name), fullPage: true });

  await page.goto(`${N}/reports?q=crypto+theft`);
  await expect(page.locator("mark").first()).toBeVisible();

  await page.goto(`${N}/reports?topic=cybersecurity`);
  await expect(page.getByText("1 briefing", { exact: true })).toBeVisible();
  await page.goto(`${N}/reports?importance=9&month=2026-10`);
  await expect(page.getByText("No briefings match")).toBeVisible();
});

test("topics", async ({ page }, info) => {
  await page.goto(`${N}/topics`);
  await expect(page.getByRole("heading", { name: "Cybersecurity" })).toBeVisible();
  await page.screenshot({ path: shot("topics", info.project.name), fullPage: true });
  await page.getByRole("link", { name: "Cybersecurity", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Cybersecurity" })).toBeVisible();
  await expect(page.getByText("Top-severity Node-RED flaw under active attack")).toBeVisible();
  await page.screenshot({ path: shot("topic", info.project.name), fullPage: true });
});

test("search", async ({ page }, info) => {
  await page.goto(`${N}/search?q=oil`);
  await expect(page.getByRole("heading", { name: "Stories" })).toBeVisible();
  await page.screenshot({ path: shot("search", info.project.name), fullPage: true });
});

test("other users' newsrooms are not found", async ({ page }) => {
  const response = await page.goto("/n/someone-elses-desk");
  expect(response?.status()).toBe(404);
});
