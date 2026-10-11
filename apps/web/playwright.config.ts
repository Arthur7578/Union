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
const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  // Each test seeds its own wedding, so they could run in parallel; one
  // worker keeps a CI runner's single Next server comfortable.
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    // The guest forms skip their step animations under reduced motion, so a
    // test never presses Enter while a step is still sliding away.
    reducedMotion: "reduce",
    ...devices["Desktop Chrome"],
    // Lets a machine with a preinstalled Chromium use it instead of
    // downloading Playwright's own.
    launchOptions: process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {},
  },
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
