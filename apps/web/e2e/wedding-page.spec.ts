import { expect, test, type Page } from "@playwright/test";
import { answersOf, seedWedding, type Seeded } from "./support/seed";

/**
 * The wedding page (delivery 2): after the faire-part, the parts the couple
 * wrote and left on, then the reply, with "Reply · by …" fixed at the bottom.
 * Phone size, since that is how guests open their link.
 */

test.use({ viewport: { width: 390, height: 844 } });

const meal = {
  id: "q-meal",
  kind: "single" as const,
  title: { en: "Fish or meat?" },
  required: false,
  options: [
    { id: "o-fish", label: { en: "Fish" } },
    { id: "o-meat", label: { en: "Meat" } },
  ],
};

async function seedPage(): Promise<Seeded> {
  const seeded = await seedWedding({ rsvpQuestions: [meal], household: [{ key: "lea", firstName: "Lea" }] });
  const must = <T extends { error: unknown }>(r: T) => {
    if (r.error) throw r.error;
    return r;
  };
  const db = seeded.owner;
  must(
    await db
      .from("weddings")
      .update({
        event_date: "2099-06-12",
        venue_name: "The Olive Farm",
        address_line: "1 Orchard Lane",
        address_postal_code: "84220",
        address_city: "Gordes",
        address_country: "France",
        address_visibility: "full",
      })
      .eq("id", seeded.weddingId),
  );
  must(await db.from("forms").update({ closes_at: "2099-05-12T21:59:59Z" }).eq("id", seeded.forms.rsvp));
  must(
    await db.from("guest_pages").insert({
      wedding_id: seeded.weddingId,
      welcome: { en: "We met at a table too small for everyone.\n\nSo we chose the orchard." },
      dress_code: { en: "Garden elegant" },
      palette: [{ color: "#A4AE8F", name: { en: "Sage" } }],
    }),
  );
  must(
    await db.from("guest_page_moments").insert([
      { wedding_id: seeded.weddingId, day_offset: -1, starts_at: "19:30", title: { en: "Welcome dinner" } },
      { wedding_id: seeded.weddingId, day_offset: 0, starts_at: "16:30", title: { en: "The ceremony" }, place: { en: "Under the olive trees" } },
    ]),
  );
  return seeded;
}

const section = (page: Page, key: string) => page.locator(`#gh-${key}`);

test("a guest reads the couple's page, part by part, and replies from its card", async ({ page }) => {
  const seeded = await seedPage();
  await page.goto(`/guest/${seeded.guests.lea.token}`);

  // Le mot, signed, with the countdown.
  await expect(section(page, "word")).toContainText("We met at a table too small for everyone.");
  await expect(section(page, "word")).toContainText("days before we raise our glasses");

  // Le week-end, day by day, dates from the wedding's.
  const weekend = section(page, "weekend");
  await expect(weekend.getByRole("heading", { name: "Thursday, June 11" })).toBeVisible();
  await expect(weekend.getByRole("region", { name: "Friday, June 12" })).toContainText("The ceremony");

  // Add to my calendar: one file for the ticked moments.
  await weekend.getByRole("button", { name: "Add to my calendar" }).click();
  const sheet = page.getByRole("dialog", { name: "In my calendar" });
  await expect(sheet.getByRole("checkbox")).toHaveCount(2);
  const download = page.waitForEvent("download");
  await sheet.getByRole("button", { name: "Apple Calendar or Outlook" }).click();
  expect((await download).suggestedFilename()).toBe("mariage.ics");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  // La tenue, and the venue from the settings.
  await expect(section(page, "dress")).toContainText("Garden elegant");
  await expect(section(page, "dress").getByRole("list", { name: "The palette" })).toContainText("Sage");
  await expect(section(page, "venue")).toContainText("The Olive Farm");
  // Nothing written: no Questions part.
  await expect(section(page, "faq")).toHaveCount(0);

  // The reply, fixed at the bottom, with the deadline.
  await expect(page.getByRole("button", { name: "Reply · by May 12" })).toBeVisible();

  // A box on the card opens the RSVP on what follows the answer.
  const card = page.getByRole("article", { name: "Attendance RSVP" });
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("button", { name: "Attending" }).click();
  await expect(page.getByRole("heading", { name: "Fish or meat?" })).toBeVisible();
  // The answer given on the card sits at the top, and leads back to it.
  await page.getByRole("button", { name: "Change my answer: Attending" }).click();
  await expect(page.getByRole("heading", { name: /Lea, will you join us/ })).toBeVisible();
  await page.getByRole("button", { name: /Attending/, pressed: true }).click();
  await expect(page.getByRole("heading", { name: "Fish or meat?" })).toBeVisible();
  await page.getByRole("button", { name: /Meat/ }).click();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { name: /See you soon, Lea/ })).toBeVisible();
  expect(await answersOf(seeded, seeded.forms.rsvp, seeded.guests.lea.id)).toEqual({ "q-meal": "o-meat" });
  await page.getByRole("button", { name: "Back to the invitation" }).click();

  // Received: the answer on the card, and on the bottom bar.
  await expect(card.locator(".wp-summary")).toHaveText("Attending");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByText("You'll be with us")).toBeVisible();
  await expect(page.getByRole("button", { name: "Change", exact: true })).toBeVisible();

  // Nothing scrolls sideways on a phone.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("a part the couple turned off is gone, and the chips follow", async ({ page }) => {
  const seeded = await seedPage();
  const { error } = await seeded.owner.from("weddings").update({ guest_modules: { dress: false } }).eq("id", seeded.weddingId);
  if (error) throw error;
  await page.goto(`/guest/${seeded.guests.lea.token}`);
  await expect(section(page, "word")).toBeVisible();
  await expect(section(page, "dress")).toHaveCount(0);
  const chips = page.getByRole("navigation", { name: "Sections" });
  await expect(chips.getByRole("button", { name: "What to wear" })).toHaveCount(0);
  await chips.getByRole("button", { name: "Your reply" }).click();
  await expect(page.getByRole("article", { name: "Attendance RSVP" })).toBeInViewport();
});

test("every part off: the page is the faire-part's names and the reply", async ({ page }) => {
  const seeded = await seedPage();
  const off = { word: false, weekend: false, venue: false, travel: false, dress: false, faq: false };
  const { error } = await seeded.owner.from("weddings").update({ guest_modules: off }).eq("id", seeded.weddingId);
  if (error) throw error;
  await page.goto(`/guest/${seeded.guests.lea.token}`);
  await expect(page.getByRole("article", { name: "Attendance RSVP" })).toBeVisible();
  await expect(page.locator(".gh-section")).toHaveCount(1);
  // One section: no bar of chips that goes nowhere.
  await expect(page.getByRole("navigation", { name: "Sections" })).toHaveCount(0);
});

test("from the faire-part, the rest of the page opens on its first part, without the RSVP", async ({ page }) => {
  const seeded = await seedPage();
  // A guest opening their link for the first time.
  const { error } = await seeded.owner.from("guests").update({ welcome_seen_at: null }).eq("id", seeded.guests.lea.id);
  if (error) throw error;
  await page.goto(`/guest/${seeded.guests.lea.token}`);
  // Reduced motion (as these tests run): the faire-part opens on its end.
  await page.getByRole("button", { name: "See the rest" }).click();
  await expect(section(page, "word")).toBeInViewport();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reply · by May 12" })).toBeVisible();

  // Seen once, the link opens on the page next time.
  await page.reload();
  await expect(section(page, "word")).toBeVisible();
  await expect(page.getByRole("button", { name: "See the rest" })).toHaveCount(0);
});

test("a guest with no email gives it first, then goes on past the answer picked on the card", async ({ page }) => {
  const seeded = await seedPage();
  const { error } = await seeded.owner.from("guests").update({ email: null }).eq("id", seeded.guests.lea.id);
  if (error) throw error;
  await page.goto(`/guest/${seeded.guests.lea.token}`);
  const card = page.getByRole("article", { name: "Attendance RSVP" });
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("button", { name: "Attending" }).click();
  await expect(page.getByRole("heading", { name: "Your email" })).toBeVisible();
  await page.getByRole("textbox").fill("lea@example.test");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Fish or meat?" })).toBeVisible();
});
