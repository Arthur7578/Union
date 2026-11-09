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

test("the couple sees their page as a guest would, and nothing is saved", async ({ page }) => {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea", rsvp: "attending" }] });
  const { error } = await seeded.owner.from("guest_pages").insert({
    wedding_id: seeded.weddingId,
    welcome: { en: "We met at a table too small for everyone." },
    shuttle: { en: "Leaves the station at 3 pm." },
  });
  if (error) throw error;
  const before = await seeded.owner.from("guests").select("welcome_seen_at").eq("id", seeded.guests.lea.id).single();

  await signInAsOwner(page, seeded);
  await page.goto("/guests/modules");
  await page.getByRole("link", { name: "See as a guest" }).click();

  // A first visit: the faire-part, then the page (reduced motion: at its end).
  await page.getByRole("button", { name: "See the rest" }).click();
  await expect(page.getByText("Preview: what your guests see. Nothing is saved.")).toBeVisible();
  await expect(page.locator("#gh-word")).toContainText("We met at a table too small for everyone.");
  // Not Lea, not her yes: a guest who hasn't replied, so no shuttle yet.
  await expect(page.getByText(/\bLea\b/)).toHaveCount(0);
  await expect(page.getByText("Leaves the station at 3 pm.")).toHaveCount(0);

  // Replying goes through the whole form, and writes nothing.
  const card = page.getByRole("article", { name: "Attendance RSVP" });
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("button", { name: "Declined" }).click();
  await page.getByRole("button", { name: /^Send/ }).click();
  await page.getByRole("button", { name: "Back to the invitation" }).click();
  await expect(card.locator(".wp-summary")).toHaveText("Declined");
  const rsvp = await seeded.owner.from("rsvps").select("status").eq("guest_id", seeded.guests.lea.id).single();
  expect(rsvp.data?.status).toBe("attending");
  const after = await seeded.owner.from("guests").select("welcome_seen_at").eq("id", seeded.guests.lea.id).single();
  expect(after.data?.welcome_seen_at).toBe(before.data?.welcome_seen_at);

  await page.getByRole("link", { name: "Close the preview" }).click();
  await expect(page).toHaveURL(/\/guests\/modules$/);
});
