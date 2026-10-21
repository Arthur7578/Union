import { expect, test } from "@playwright/test";
import { fairePartCopy, seedWedding, signInAsOwner } from "./support/seed";

/**
 * The invitation card's wording: what the couple writes in the editor, and
 * what a guest then reads when they open their link. Checked end to end, in a
 * real browser, against a real database.
 */

const wedding = {
  event_date: "2027-06-11",
  address_visibility: "area",
  address_area: "Provence",
  address_country: "France",
};

test("the couple rewords the card, sees it in the preview, and the guest reads it", async ({ page }) => {
  const seeded = await seedWedding({
    wedding,
    household: [{ key: "lea", firstName: "Lea", welcomeSeen: false }],
  });

  await signInAsOwner(page, seeded);
  await page.goto("/guests/faire-part");

  // Untouched, the preview shows the default wording filled with the guest's details.
  const back = page.locator(".fp-preview .verso");
  await expect(back).toContainText("Lea,");
  await expect(back).toContainText("in Provence, on June 11, 2027, to celebrate our wedding");

  // Writing a line changes the preview as it is typed.
  await page.getByLabel("Greeting").fill("Dear {{guest_first_name}}, welcome");
  await expect(back).toContainText("Dear Lea, welcome");
  // A field is inserted into the line being written.
  const closing = page.getByLabel("Sign-off");
  await closing.focus();
  await page.getByRole("button", { name: "{{couple}}" }).click();
  await expect(closing).toHaveValue("{{couple}}");
  await closing.fill("");

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  expect(await fairePartCopy(seeded)).toEqual({ greeting: { en: "Dear {{guest_first_name}}, welcome" } });

  // The guest opens their link: the card carries the couple's greeting and the default wording elsewhere.
  await page.context().clearCookies();
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(`/guest/${seeded.guests.lea.token}`);
  const card = page.locator(".verso");
  await expect(card).toContainText("Dear Lea, welcome");
  await expect(card).toContainText("There are moments we especially want to share");
  await expect(card).toContainText("in Provence");
});

test("a group link greets no one by name, and a line with nothing to fill disappears", async ({ page }) => {
  const seeded = await seedWedding({ wedding, household: [{ key: "lea", firstName: "Lea" }] });

  await signInAsOwner(page, seeded);
  await page.goto("/guests/faire-part");
  await page.getByLabel("Previewed as").selectOption("group");
  const back = page.locator(".fp-preview .verso");
  await expect(back).not.toContainText("Lea");
  await expect(page.locator(".fp-preview .greet")).toHaveCount(0);
  // The first line of the back is the opening text, not a stray comma.
  await expect(back.locator("p").first()).toContainText("There are moments");
});
