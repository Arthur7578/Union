import { expect, test, type Page } from "@playwright/test";
import { seedWedding, type Seeded } from "./support/seed";

/**
 * The RSVP from the guest's wedding page (#93): yes, no, maybe; a household where each
 * person is answered for; changing an answer. Each test reads the database
 * back as the organiser, to check the answer landed on the right people and
 * nowhere else. Runs on a phone (playwright.config.ts, project "phone").
 */

/** The RSVP card at the end of the wedding page. */
const rsvpCard = (page: Page) => page.getByRole("article", { name: "Attendance RSVP" });

/** Opens the RSVP and starts it: from the reply bar at the bottom of
 *  the page before a reply, from "Change my reply" on the card after one. */
async function openRsvp(page: Page, seeded: Seeded, guestKey: string, mode: "reply" | "edit" = "reply") {
  await page.goto(`/guest/${seeded.guests[guestKey].token}`);
  if (mode === "reply") await page.getByRole("button", { name: "Reply", exact: true }).click();
  else await rsvpCard(page).getByRole("button", { name: "Change my reply" }).click();
  const dialog = page.getByRole("dialog", { name: "Attendance RSVP" });
  await dialog.getByRole("button", { name: "Start", exact: true }).click();
  return dialog;
}

/** Answers one person's question: "<name>, will you join us?" or "Will <name> join us?". */
async function answer(dialog: ReturnType<Page["getByRole"]>, who: RegExp, choice: string) {
  await expect(dialog.getByRole("heading", { level: 2, name: who })).toBeVisible();
  await dialog.getByRole("button", { name: choice, exact: true }).click();
}

/** Answers a household, whatever order it asks in: `choices` maps each
 *  first name to its answer. Checks every person is asked exactly once. */
async function answerAll(dialog: ReturnType<Page["getByRole"]>, choices: Record<string, string>) {
  const asked: string[] = [];
  for (let i = 0; i < Object.keys(choices).length; i++) {
    const heading = dialog.getByRole("heading", { level: 2, name: /will you join us\?|join us\?$/ });
    await expect(heading).toBeVisible();
    const text = (await heading.textContent()) ?? "";
    const name = Object.keys(choices).find((n) => new RegExp(`^(${n}, will you|Will ${n}) join us\\?$`).test(text));
    if (!name) throw new Error(`Unexpected question: ${text}`);
    expect(asked).not.toContain(name);
    asked.push(name);
    await dialog.getByRole("button", { name: choices[name], exact: true }).click();
    if (i < Object.keys(choices).length - 1) await expect(heading).not.toHaveText(text);
  }
}

async function statuses(seeded: Seeded) {
  const { data, error } = await seeded.owner
    .from("rsvps")
    .select("guest_id, status")
    .in("guest_id", Object.values(seeded.guests).map((g) => g.id));
  if (error) throw error;
  const byKey: Record<string, string[]> = {};
  for (const [key, g] of Object.entries(seeded.guests)) {
    byKey[key] = data.filter((r) => r.guest_id === g.id).map((r) => r.status as string);
  }
  return byKey;
}

test("a guest invited alone says they're coming, and only their own answer is recorded", async ({ page }) => {
  const seeded = await seedWedding({
    household: [
      { key: "lea", firstName: "Lea" },
      // Another guest of the same wedding, on another invitation.
      { key: "pat", firstName: "Pat", rsvp: "declined" },
    ],
  });
  const dialog = await openRsvp(page, seeded, "lea");
  await answer(dialog, /^Lea, will you join us\?$/, "Attending");

  await expect(dialog.getByRole("heading", { level: 2, name: "See you soon, Lea!" })).toBeVisible();
  await expect.poll(() => statuses(seeded)).toEqual({ lea: ["attending"], pat: ["declined"] });

  await dialog.getByRole("button", { name: "Back to the invitation" }).click();
  await expect(rsvpCard(page).locator(".wp-summary")).toHaveText(/^Attending$/);
});

test("a guest invited alone can decline", async ({ page }) => {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea" }] });
  const dialog = await openRsvp(page, seeded, "lea");
  await answer(dialog, /^Lea, will you join us\?$/, "Declined");

  await expect.poll(() => statuses(seeded)).toEqual({ lea: ["declined"] });
});

test("a guest can answer maybe when the couple allows it, and not otherwise", async ({ page }) => {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea" }] });

  let dialog = await openRsvp(page, seeded, "lea");
  await expect(dialog.getByRole("button", { name: "Attending", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /not sure/i })).toHaveCount(0);

  const { error } = await seeded.owner.from("weddings").update({ allow_rsvp_maybe: true }).eq("id", seeded.weddingId);
  if (error) throw error;

  dialog = await openRsvp(page, seeded, "lea");
  await answer(dialog, /^Lea, will you join us\?$/, "Not sure yet");
  await expect.poll(() => statuses(seeded)).toEqual({ lea: ["maybe"] });
});

test("a household answers for each person, and each answer lands on the right person", async ({ page }) => {
  const seeded = await seedWedding({
    household: [
      { key: "lea", firstName: "Lea" },
      { key: "sam", firstName: "Sam", relation: "partner_of" },
      { key: "noa", firstName: "Noa", relation: "parent_of" },
      // Same wedding, not on Lea's invitation.
      { key: "pat", firstName: "Pat" },
    ],
  });
  const dialog = await openRsvp(page, seeded, "lea");
  await answerAll(dialog, { Lea: "Attending", Sam: "Declined", Noa: "Attending" });

  await expect(dialog.getByRole("heading", { level: 2, name: "See you soon, Lea!" })).toBeVisible();
  await expect
    .poll(() => statuses(seeded))
    .toEqual({ lea: ["attending"], sam: ["declined"], noa: ["attending"], pat: [] });
});

test("a guest changes their answer, and the new one replaces the old", async ({ page }) => {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea", rsvp: "attending" }] });

  const dialog = await openRsvp(page, seeded, "lea", "edit");
  await answer(dialog, /^Lea, will you join us\?$/, "Declined");

  // One answer per person, the latest.
  await expect.poll(() => statuses(seeded)).toEqual({ lea: ["declined"] });
  await dialog.getByRole("button", { name: "Back to the invitation" }).click();
  await expect(rsvpCard(page).locator(".wp-summary")).toHaveText(/^Declined$/);
});
