import { defineConfig, devices } from "@playwright/test";
import { e2eEnv } from "./e2e/support/env";

/**
 * Browser tests: the real app, built and served, against a local Supabase
 * (`supabase start`). They cover what only shows up when every piece runs
 * together — a setting saved in the form builder reaching the guest, a
 * guest's answers landing in the database.
 *
 * Run: `supabase start`, then from apps/web
 *   E2E_SUPABASE_URL=… E2E_SUPABASE_ANON_KEY=… E2E_SUPABASE_SERVICE_ROLE_KEY=… npm run e2e
 * (the three values come from `supabase status -o env`).
 */
const env = e2eEnv();

/** Guests open their link on a phone: their flows run on a phone, the
 *  couple's on desktop, and `couple-*` journeys on both (issue #91). */
const PHONE_FLOWS = /\/(guest|join|invitation)-[^/]*\.spec\.ts$/;
const BOTH = /\/couple-[^/]*\.spec\.ts$/;
const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  // Each test seeds its own wedding, so they could run in parallel; one
  // worker keeps a CI runner's single Next server comfortable.
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // On CI a failed test is retried once so a flaky test shows up as "flaky"
  // rather than "failed"; failOnFlakyTests still turns the run red. A flaky
  // test is a bug of the test or of the app: fix it, never skip it
  // (docs/testing/README.md).
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    // The guest forms skip their step animations under reduced motion, so a
    // test never presses Enter while a step is still sliding away.
    reducedMotion: "reduce",
    // Lets a machine with a preinstalled Chromium use it instead of
    // downloading Playwright's own.
    launchOptions: process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {},
  },
  projects: [
    {
      name: "phone",
      testMatch: [PHONE_FLOWS, BOTH],
      // Chromium with a phone's screen, touch and user agent. A Pixel rather
      // than an iPhone preset: those switch the browser to WebKit.
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "desktop",
      testIgnore: PHONE_FLOWS,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: env.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.anonKey,
    },
  },
});
