import { expect, test } from "@playwright/test";
import { need, prodEnv } from "./support/env";

/**
 * A guest opening their links in production, on a phone, through the real
 * envelope animation. Read-only: nothing is answered or saved.
 */

const env = prodEnv();

test("a guest opens their link, the envelope, and reaches their replies", async ({ page }) => {
  const failures: string[] = [];
  page.on("response", (res) => {
    if (res.url().startsWith(env.supabaseUrl) && res.status() >= 400) failures.push(`${new URL(res.url()).pathname} → ${res.status()}`);
  });
  await page.goto(`/guest/${need("PROD_CHECK_GUEST_TOKEN")}`);

  // A guest who already went past the welcome lands on their hub directly.
  const respond = page.getByRole("button", { name: "Respond to the invitation" });
  if (await page.getByRole("button", { name: "Open the envelope" }).isVisible()) {
    await page.getByRole("button", { name: "Open the envelope" }).tap();
    await respond.tap();
  }
  await expect(page.getByRole("heading", { name: "Your replies" })).toBeVisible();
  expect(failures).toEqual([]);
});

test("a guest opens the group link and reaches the name step", async ({ page }) => {
  await page.goto(`/join/${need("PROD_CHECK_JOIN_CODE")}`);
  await page.getByRole("button", { name: "Open the envelope" }).tap();
  await page.getByRole("button", { name: "Respond to the invitation" }).tap();
  await expect(page.getByRole("heading", { name: "Find your invitation" })).toBeVisible();
});
