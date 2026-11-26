import { expect, test } from "@playwright/test";
import { seedWedding, signInAsOwner } from "./support/seed";

/**
 * A signed-in organiser can still do what the anon hardening
 * (20261112120000, 20261125120000) could have broken: add a guest, which goes
 * through create_guest_with_links, and save the guest modules, which a check
 * constraint validates with _guest_modules_valid.
 */

test("an organiser adds a guest and finds them in the list", async ({ page }) => {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea" }] });
  await signInAsOwner(page, seeded);

  await page.goto("/guests/new");
  await page.locator("#fn").fill("Noor");
  await page.locator("#ln").fill("Haddad");
  await page.getByRole("button", { name: "Add guest" }).click();

  await expect(page).toHaveURL(/\/guests$/);
  await expect(page.getByText("Noor Haddad")).toBeVisible();

  const { data, error } = await seeded.owner
    .from("guests")
    .select("first_name, last_name")
    .eq("wedding_id", seeded.weddingId)
    .eq("first_name", "Noor");
  if (error) throw error;
  expect(data).toEqual([{ first_name: "Noor", last_name: "Haddad" }]);
});

test("an organiser turns a guest module off and it is saved", async ({ page }) => {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea" }] });
  await signInAsOwner(page, seeded);

  await page.goto("/guests/modules");
  const faq = page.getByRole("switch", { name: "FAQs" });
  await expect(faq).toHaveAttribute("aria-checked", "true");
  await faq.click();
  await page.getByRole("button", { name: "Save modules" }).click();

  await expect
    .poll(async () => {
      const { data, error } = await seeded.owner
        .from("weddings")
        .select("guest_modules")
        .eq("id", seeded.weddingId)
        .single();
      if (error) throw error;
      return data.guest_modules;
    })
    .toEqual({ faq: false });
  await expect(page.locator(".error")).toHaveCount(0);
});
