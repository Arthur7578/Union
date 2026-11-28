import { expect, test } from "@playwright/test";
import { seedWedding } from "./support/seed";

/**
 * The faire-part envelope a guest meets first, as it plays on a phone: with
 * its animation (every other test turns motion off), opened with a tap on
 * the seal. Runs in the "phone" project only (see playwright.config.ts).
 */

test.use({ reducedMotion: "no-preference" });

test("on a phone, a guest taps the seal, the card comes out, and they can respond", async ({ page }) => {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea" }] });
  const { data, error } = await seeded.owner
    .from("weddings")
    .update({ guest_join_auth_mode: "light" })
    .eq("id", seeded.weddingId)
    .select("join_code")
    .single();
  if (error) throw error;

  await page.goto(`/join/${data.join_code}`);
  await expect(page.getByRole("heading", { name: /You have received/i })).toBeVisible();

  await page.getByRole("button", { name: "Open the envelope" }).tap();
  // The button is only reachable once the card is out: tap waits for it.
  await page.getByRole("button", { name: "Respond to the invitation" }).tap();
  await expect(page.getByRole("heading", { name: "Find your invitation" })).toBeVisible();
});
