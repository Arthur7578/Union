import { expect, test } from "@playwright/test";
import { seedWedding, signInAsOwner } from "./support/seed";

/**
 * Guests › Guest experience: the faire-part opens the page, the reply ends
 * it, and in between one switch per part. A part that is on but empty is
 * marked so, and a part turned off is gone for the guest. Phone size.
 */

test.use({ viewport: { width: 390, height: 844 } });

test("the couple turns a part off and their guest no longer sees it", async ({ page }) => {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea" }] });
  const { error } = await seeded.owner.from("guest_page_faq").insert({
    wedding_id: seeded.weddingId,
    sort_order: 0,
    question: { en: "Is there a gift list?" },
    answer: { en: "Your presence is the gift." },
  });
  if (error) throw error;

  await signInAsOwner(page, seeded);
  await page.goto("/guests/modules");

  await expect(page.getByText("Your guest page", { exact: true })).toBeVisible();
  const parts = page.getByRole("group", { name: "The rest of the page" });

  // Written: ready. Not written yet: on, but hidden from guests.
  const questions = parts.getByRole("switch", { name: "Questions" });
  await expect(questions).toHaveAttribute("aria-checked", "true");
  await expect(parts.getByRole("group", { name: "Questions" })).toContainText("Ready");
  await expect(parts.getByRole("group", { name: "Our word" })).toContainText("Empty · hidden from your guests");

  // Every part can go: the faire-part and the reply stay.
  await expect(page.getByText("The faire-part in its envelope")).toBeVisible();
  await expect(page.getByText("Your reply", { exact: true })).toBeVisible();

  await page.goto(`/guest/${seeded.guests.lea.token}`);
  await expect(page.getByText("Is there a gift list?")).toBeVisible();

  await page.goto("/guests/modules");
  await questions.click();
  await expect(questions).toHaveAttribute("aria-checked", "false");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect
    .poll(async () => {
      const { data } = await seeded.owner.from("weddings").select("guest_modules").eq("id", seeded.weddingId).single();
      return data?.guest_modules;
    })
    .toEqual({ faq: false });

  await page.goto(`/guest/${seeded.guests.lea.token}`);
  await expect(page.getByText("Lea", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Is there a gift list?")).toHaveCount(0);
});
