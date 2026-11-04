import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

/**
 * End-to-end smoke tests against a local dev server, signed in as a dedicated
 * Clerk test user (see tests/e2e/global.setup.ts). Requires .env.local.
 */
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  // The dev server compiles each route on its first visit, and parallel workers compete
  // for it, so a first navigation can take several seconds.
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/ },
    {
      name: "desktop",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        storageState: "playwright/.auth/user.json",
      },
    },
    {
      name: "mobile",
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"], storageState: "playwright/.auth/user.json" },
    },
  ],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
