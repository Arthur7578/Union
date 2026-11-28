import { defineConfig, devices } from "@playwright/test";
import { prodEnv } from "./e2e-prod/support/env";

/**
 * Production checks: the live site and the hosted Supabase project, read-only.
 * They catch what CI's local database cannot: a privilege or setting that
 * differs in production, a missing Vercel variable, a captcha key that no
 * longer matches its secret, a paused project.
 *
 * Run by `.github/workflows/prod-checks.yml` (daily, after "Apply branch
 * migrations", and by hand). Locally: set the variables listed in
 * `e2e-prod/support/env.ts`, then from apps/web `npm run e2e:prod`.
 *
 * These tests never seed or delete anything. The one write they cause is the
 * sign-in session the organiser checks open for the test account.
 */
const env = prodEnv();

export default defineConfig({
  testDir: "./e2e-prod",
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // A production check that fails once is retried once before it counts: the
  // network between GitHub and Vercel/Supabase blips now and then.
  retries: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "playwright-report-prod" }]] : "list",
  use: {
    baseURL: env.siteUrl,
    // No traces: they record request headers (the secret key, API tokens, the
    // session) and the failure artifact would publish them. Screenshots only.
    trace: "off",
    screenshot: "only-on-failure",
    launchOptions: process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {},
  },
  projects: [
    // API-only checks (no page), and the organiser's pages on a desktop.
    { name: "desktop", testIgnore: /guest\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    // Guests open their links on a phone.
    { name: "phone", testMatch: /guest\.spec\.ts/, use: { ...devices["Pixel 7"] } },
  ],
});
