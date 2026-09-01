import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Sequential, not parallel: every spec shares one dev server and one
  // Postgres instance, so nothing about these tests benefits from workers
  // beyond what AUTH_THROTTLE_LIMIT below already accounts for.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter api start:dev",
      cwd: "../..",
      url: "http://localhost:3001",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      // The real 5/min register+login limit is legitimate production abuse
      // protection, but a full test run registers more users than that in
      // well under a minute — relax it for this spawned instance only.
      env: { AUTH_THROTTLE_LIMIT: "1000" },
    },
    {
      command: "pnpm dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
