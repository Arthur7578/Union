import { expect, test, type Page } from "@playwright/test";
import { seedWedding } from "./support/seed";

/**
 * The hub's RSVP card once a guest has replied (#85): a guest invited alone
 * reads their own answer, a household one name per person. Phone size, since
 * that is how guests open their link.
 */

test.use({ viewport: { width: 390, height: 844 } });

/** The RSVP card: the checklist item whose heading is the RSVP's title. */
const rsvpCard = (page: Page) =>
  page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3, name: "Attendance RSVP" }) });

/** The RSVP card's one-line answer. */
const rsvpLine = (page: Page) => rsvpCard(page).locator(".gh-card-meta");

test("a guest invited alone sees their answer, not their name", async ({ page }) => {
  const seeded = await seedWedding({
    household: [
      { key: "lea", firstName: "Lea", rsvp: "attending" },
      // Someone else at the same wedding, not on Lea's invitation.
      { key: "pat", firstName: "Pat", rsvp: "declined" },
    ],
  });
  await page.goto(`/guest/${seeded.guests.lea.token}`);
  await expect(rsvpLine(page)).toHaveText(/^Attending$/);
  const card = rsvpCard(page);
  await expect(card).not.toContainText("Lea");
  await expect(card).not.toContainText("Pat");
});

test("a guest invited alone sees the couple's own wording, in full, on a phone", async ({ page }) => {
  const label = "Unfortunately I won't be able to be with you on that day, so sorry";
  const seeded = await seedWedding({
    rsvpCopy: { label_declined: { en: label } },
    household: [{ key: "lea", firstName: "Lea", rsvp: "declined" }],
  });
  await page.goto(`/guest/${seeded.guests.lea.token}`);
  const line = rsvpLine(page);
  await expect(line).toHaveText(new RegExp(`^${label}$`));
  // Wraps rather than being cut, and the page doesn't scroll sideways.
  expect(await line.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("a household keeps one name per person", async ({ page }) => {
  const seeded = await seedWedding({
    household: [
      { key: "arthur", firstName: "Arthur", rsvp: "attending" },
      { key: "guinevere", firstName: "Guinevere", relation: "partner_of", rsvp: "declined" },
    ],
  });
  await page.goto(`/guest/${seeded.guests.arthur.token}`);
  await expect(rsvpLine(page)).toHaveText(/^Arthur: Attending, Guinevere: Declined$/);
});

test("a guest whose partner hasn't been answered for keeps their name", async ({ page }) => {
  const seeded = await seedWedding({
    household: [
      { key: "arthur", firstName: "Arthur", rsvp: "attending" },
      { key: "guinevere", firstName: "Guinevere", relation: "partner_of" },
    ],
  });
  await page.goto(`/guest/${seeded.guests.arthur.token}`);
  await expect(rsvpLine(page)).toHaveText(/^Arthur: Attending$/);
});
