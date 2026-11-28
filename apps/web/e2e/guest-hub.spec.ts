import { expect, test, type Page } from "@playwright/test";
import { seedWedding, type Seeded } from "./support/seed";

/**
 * The guest's wedding page once they're in (#94, reshaped by the wedding page,
 * #110): the parts follow what the couple turned on and wrote, the forms they
 * published are there to answer, and the practical information they wrote
 * reaches the guest. Runs on a phone (project "phone").
 */

/** Each part of the page, by the name its region and its chip carry. */
const PARTS = {
  word: "Our word",
  weekend: "The weekend",
  venue: "The venue",
  travel: "Carpool",
  dress: "What to wear",
  faq: "Questions",
  reply: "Your reply",
} as const;
type Part = keyof typeof PARTS;

async function setModules(seeded: Seeded, modules: Partial<Record<Exclude<Part, "reply">, boolean>>) {
  const { error } = await seeded.owner.from("weddings").update({ guest_modules: modules }).eq("id", seeded.weddingId);
  if (error) throw error;
}

/** A wedding whose couple wrote something in every part. */
async function seedWritten(): Promise<Seeded> {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea" }] });
  const must = <T extends { error: unknown }>(r: T) => {
    if (r.error) throw r.error;
    return r;
  };
  const db = seeded.owner;
  must(await db.from("weddings").update({ venue_name: "The Olive Farm", address_city: "Gordes" }).eq("id", seeded.weddingId));
  must(
    await db.from("guest_pages").insert({
      wedding_id: seeded.weddingId,
      welcome: { en: "We met at a table too small for everyone." },
      travel_train: { en: "Avignon TGV, then 45 minutes by car." },
      dress_code: { en: "Garden party" },
    }),
  );
  must(
    await db
      .from("guest_page_moments")
      .insert({ wedding_id: seeded.weddingId, day_offset: 0, starts_at: "16:30", title: { en: "The ceremony" } }),
  );
  must(
    await db
      .from("guest_page_faq")
      .insert({ wedding_id: seeded.weddingId, question: { en: "Can we bring our dog?" }, answer: { en: "Sadly not." } }),
  );
  return seeded;
}

async function expectParts(page: Page, on: Part[]) {
  const chips = page.getByRole("navigation", { name: "Sections" });
  for (const [part, name] of Object.entries(PARTS) as Array<[Part, string]>) {
    const shown = on.includes(part);
    await expect(page.getByRole("region", { name, exact: true }), `${name} region`).toHaveCount(shown ? 1 : 0);
    await expect(chips.getByRole("button", { name, exact: true }), `${name} chip`).toHaveCount(shown ? 1 : 0);
  }
}

test("the page shows every part the couple wrote when they haven't turned any off", async ({ page }) => {
  const seeded = await seedWritten();
  await page.goto(`/guest/${seeded.guests.lea.token}`);
  // Carpooling is off until the couple turns it on (its board still shows samples, #109).
  await expectParts(page, ["word", "weekend", "venue", "dress", "faq", "reply"]);
});

test("a part the couple turns off disappears from the page and from its chips", async ({ page }) => {
  const seeded = await seedWritten();

  await setModules(seeded, { weekend: false, faq: false });
  await page.goto(`/guest/${seeded.guests.lea.token}`);
  await expectParts(page, ["word", "venue", "dress", "reply"]);

  await setModules(seeded, { word: false, venue: false, travel: true });
  await page.reload();
  await expectParts(page, ["weekend", "travel", "dress", "faq", "reply"]);
});

test("the forms the couple published are there to answer once the guest is coming, and the others are not", async ({ page }) => {
  const seeded = await seedWedding({
    household: [{ key: "lea", firstName: "Lea", rsvp: "attending" }],
    customForms: [
      {
        key: "song",
        title: "Your song for the dance floor",
        perPerson: false,
        questions: [{ id: "q1", kind: "short", title: { en: "Which song?" }, required: false }],
      },
    ],
  });
  const { error } = await seeded.owner.from("forms").insert({
    wedding_id: seeded.weddingId,
    kind: "custom",
    title: "Draft: seating wishes",
    published: false,
    per_person: false,
    questions: [{ id: "q1", kind: "short", title: { en: "Who with?" }, required: false }],
  });
  if (error) throw error;

  await page.goto(`/guest/${seeded.guests.lea.token}`);
  const reply = page.getByRole("region", { name: "Your reply", exact: true });
  await expect(reply.getByRole("heading", { level: 3, name: "Attendance RSVP" })).toBeVisible();
  const song = reply
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { level: 3, name: "Your song for the dance floor" }) });
  await expect(song).toBeVisible();
  await expect(reply).not.toContainText("seating wishes");

  await song.getByRole("button").first().click();
  await expect(page.getByRole("dialog", { name: "Your song for the dance floor" })).toBeVisible();
});

test("the practical information the couple wrote reaches the guest, and nothing of theirs that is private", async ({ page }) => {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea" }] });
  const page_ = await seeded.owner.from("guest_pages").upsert({
    wedding_id: seeded.weddingId,
    travel_train: { en: "Avignon TGV, then 45 minutes by car." },
    travel_car: { en: "Free parking at the farm." },
    dress_code: { en: "Garden party" },
  });
  if (page_.error) throw page_.error;
  const stay = await seeded.owner.from("room_blocks").insert({
    wedding_id: seeded.weddingId,
    name: "Hotel of the Olives",
    price_note: "€120 a night",
    note: "Deposit paid, 12 rooms held",
    status: "Full",
  });
  if (stay.error) throw stay.error;
  const faq = await seeded.owner.from("guest_page_faq").insert({
    wedding_id: seeded.weddingId,
    question: { en: "Can we bring our dog?" },
    answer: { en: "Sadly not at the venue." },
  });
  if (faq.error) throw faq.error;

  await page.goto(`/guest/${seeded.guests.lea.token}`);
  const venue = page.getByRole("region", { name: "The venue", exact: true });
  await expect(venue).toContainText("Avignon TGV, then 45 minutes by car.");
  await expect(venue).toContainText("Free parking at the farm.");
  await expect(venue.getByText("Hotel of the Olives")).toBeVisible();
  await expect(venue).toContainText("€120 a night");
  await expect(page.getByRole("region", { name: "Questions", exact: true })).toContainText("Can we bring our dog?");
  // The dress code has a part of its own.
  await expect(page.getByRole("region", { name: "What to wear", exact: true })).toContainText("Garden party");

  // The couple's own bookkeeping stays theirs.
  await expect(page.locator("body")).not.toContainText("Deposit paid");
  await expect(page.locator("body")).not.toContainText("12 rooms held");
  // Nothing scrolls sideways on a phone.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
