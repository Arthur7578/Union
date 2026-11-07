import { expect, test, type Page } from "@playwright/test";
import { seedWedding, signInAsOwner, type Seeded } from "./support/seed";

/**
 * The couple's guest page content (delivery 1 of the wedding page): what the
 * organiser writes in Guests › Guest page content reaches the guest hub, in
 * place of the demo content that used to be written into the code. Phone
 * size, since guests open their link on a phone and organisers mostly do too.
 */

test.use({ viewport: { width: 390, height: 844 } });

async function seedWithDate(): Promise<Seeded> {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea" }] });
  const { error } = await seeded.owner
    .from("weddings")
    .update({ event_date: "2027-06-12", venue_name: "The Olive Farm" })
    .eq("id", seeded.weddingId);
  if (error) throw error;
  return seeded;
}

const card = (page: Page, id: string) => page.locator(`#${id}`);

async function saveCard(page: Page, id: string) {
  await card(page, id).getByRole("button", { name: "Save", exact: true }).click();
  await expect(card(page, id).getByRole("status")).toHaveText("Saved · your guests see it now");
}

test("what the couple writes reaches their guest, and nothing already known is asked again", async ({ page }) => {
  const seeded = await seedWithDate();
  await signInAsOwner(page, seeded);
  await page.goto("/guests/page-content");

  // Already known: shown with its source, not asked.
  const known = page.getByRole("region", { name: "Already known, nothing to type" });
  await expect(known).toContainText("Maya & Daniel");
  await expect(known).toContainText("June 12, 2027");
  await expect(known).toContainText("The Olive Farm");

  // The weekend: one moment on the day, its date computed from the wedding's.
  const weekend = card(page, "pc-weekend");
  await weekend.getByRole("button", { name: "+ Add a moment" }).click();
  await expect(weekend.getByLabel("Day")).toHaveValue("0");
  await expect(weekend.getByLabel("Day").locator("option:checked")).toHaveText("The day · Saturday, June 12");
  await weekend.getByLabel("Time").fill("16:30");
  await weekend.getByLabel("What").fill("The ceremony");
  await weekend.getByLabel("Where").fill("Under the olive trees");
  await saveCard(page, "pc-weekend");

  // Getting there, and the shuttle reserved for a yes.
  const travel = card(page, "pc-travel");
  await travel.getByLabel("By train").fill("Avignon TGV, then 45 minutes by car.");
  await travel.getByLabel("The shuttle").fill("Leaves Avignon TGV at 3 pm.");
  await saveCard(page, "pc-travel");

  // One question of their own.
  const faq = card(page, "pc-faq");
  await faq.getByRole("button", { name: "+ Add a question" }).click();
  await faq.getByLabel("Question", { exact: true }).fill("Is there a gift list?");
  await faq.getByLabel("Answer", { exact: true }).fill("Your presence is the gift.");
  await saveCard(page, "pc-faq");

  // A stay, with the couple's own bookkeeping that guests must not see.
  const { error } = await seeded.owner.from("room_blocks").insert({
    wedding_id: seeded.weddingId,
    name: "Hotel of the Olives",
    price_note: "€120 a night · 10 min away",
    note: "Deposit paid",
    status: "Full",
  });
  if (error) throw error;

  await page.goto(`/guest/${seeded.guests.lea.token}`);
  const day = page.locator("li", { has: page.getByRole("heading", { name: "Saturday, June 12" }) });
  await expect(day).toContainText("16:30");
  await expect(day).toContainText("The ceremony");
  await expect(day).toContainText("Under the olive trees");
  await expect(page.getByText("Avignon TGV, then 45 minutes by car.")).toBeVisible();
  await expect(page.getByText("Is there a gift list?")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hotel of the Olives" })).toBeVisible();
  await expect(page.getByText("€120 a night · 10 min away")).toBeVisible();

  // Never another wedding's demo content, nor the couple's bookkeeping. (The
  // travel board still shows sample posts of its own: not part of this.)
  await expect(page.locator("#gh-logistics, #gh-faq").getByText(/Hood River/)).toHaveCount(0);
  await expect(page.getByText("Deposit paid")).toHaveCount(0);
  // The shuttle waits for a yes.
  await expect(page.getByText("Leaves Avignon TGV at 3 pm.")).toHaveCount(0);

  // Lea says yes: the shuttle shows.
  const rsvp = await seeded.owner.from("rsvps").insert({ guest_id: seeded.guests.lea.id, status: "attending" });
  if (rsvp.error) throw rsvp.error;
  await page.reload();
  await expect(page.getByText("Leaves Avignon TGV at 3 pm.")).toBeVisible();

  // Nothing scrolls sideways on a phone.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("a wedding with nothing written shows its venue and no one else's answers", async ({ page }) => {
  const seeded = await seedWithDate();
  await page.goto(`/guest/${seeded.guests.lea.token}`);
  await expect(page.getByRole("heading", { name: "The venue" })).toBeVisible();
  await expect(page.getByText("The couple hasn't added any questions yet. Something to ask? Write to them directly.")).toBeVisible();
  await expect(page.locator("#gh-logistics, #gh-faq").getByText(/Hood River/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Where to stay" })).toHaveCount(0);
});

test("a question suggested from the guest permissions is saved as the couple's own", async ({ page }) => {
  const seeded = await seedWithDate();
  await signInAsOwner(page, seeded);
  await page.goto("/guests/page-content");

  const faq = card(page, "pc-faq");
  await faq.getByRole("button", { name: "+ Are children invited?" }).click();
  await expect(faq.getByLabel("Question", { exact: true })).toHaveValue("Are children invited?");
  await expect(faq.getByText("Pre-filled from your settings. You can reword it.")).toBeVisible();
  // Used once, the suggestion goes away.
  await expect(faq.getByRole("button", { name: "+ Are children invited?" })).toHaveCount(0);
  await saveCard(page, "pc-faq");

  await page.goto(`/guest/${seeded.guests.lea.token}`);
  await expect(page.getByText("Are children invited?")).toBeVisible();
});
