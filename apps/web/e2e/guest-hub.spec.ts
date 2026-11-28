import { expect, test, type Page } from "@playwright/test";
import { seedWedding, type Seeded } from "./support/seed";

/**
 * The guest's hub once they're in (#94): the sections follow what the couple
 * turned on, the forms they published are there to answer, and the practical
 * information they wrote reaches the guest. Runs on a phone (project "phone").
 */

const SECTIONS = { forms: "Replies", travel: "Travel", logistics: "Details", faq: "FAQ" } as const;
type Module = keyof typeof SECTIONS;

async function setModules(seeded: Seeded, modules: Partial<Record<Module, boolean>>) {
  const { error } = await seeded.owner.from("weddings").update({ guest_modules: modules }).eq("id", seeded.weddingId);
  if (error) throw error;
}

async function expectSections(page: Page, on: Module[]) {
  const nav = page.getByRole("navigation", { name: "Sections" });
  for (const [module, name] of Object.entries(SECTIONS) as Array<[Module, string]>) {
    const shown = on.includes(module);
    await expect(page.getByRole("region", { name, exact: true }), `${name} region`).toHaveCount(shown ? 1 : 0);
    await expect(nav.getByRole("button", { name, exact: true }), `${name} in the menu`).toHaveCount(shown ? 1 : 0);
  }
}

test("the hub shows every section when the couple hasn't turned any off", async ({ page }) => {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea" }] });
  await page.goto(`/guest/${seeded.guests.lea.token}`);
  await expectSections(page, ["forms", "travel", "logistics", "faq"]);
});

test("a section the couple turns off disappears from the hub and from its menu", async ({ page }) => {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea" }] });

  await setModules(seeded, { travel: false, faq: false });
  await page.goto(`/guest/${seeded.guests.lea.token}`);
  await expectSections(page, ["forms", "logistics"]);

  await setModules(seeded, { logistics: false });
  await page.reload();
  await expectSections(page, ["forms", "travel", "faq"]);
});

test("the forms the couple published are there to answer, and the others are not", async ({ page }) => {
  const seeded = await seedWedding({
    household: [{ key: "lea", firstName: "Lea" }],
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
  const replies = page.getByRole("region", { name: "Replies", exact: true });
  await expect(replies.getByRole("heading", { level: 3, name: "Attendance RSVP" })).toBeVisible();
  const song = replies.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3, name: "Your song for the dance floor" }) });
  await expect(song).toBeVisible();
  await expect(replies).not.toContainText("seating wishes");

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
  const details = page.getByRole("region", { name: "Details", exact: true });
  await expect(details).toContainText("Avignon TGV, then 45 minutes by car.");
  await expect(details).toContainText("Free parking at the farm.");
  await expect(details.getByRole("heading", { name: "Hotel of the Olives" })).toBeVisible();
  await expect(details).toContainText("€120 a night");
  const questions = page.getByRole("region", { name: "FAQ", exact: true });
  await expect(questions).toContainText("Can we bring our dog?");
  // The dress code is answered as a question of its own.
  await expect(questions).toContainText("What is the dress code?");
  await expect(questions).toContainText("Garden party");

  // The couple's own bookkeeping stays theirs.
  await expect(page.locator("body")).not.toContainText("Deposit paid");
  await expect(page.locator("body")).not.toContainText("12 rooms held");
  // Nothing scrolls sideways on a phone.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
