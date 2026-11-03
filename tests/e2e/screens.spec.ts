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
