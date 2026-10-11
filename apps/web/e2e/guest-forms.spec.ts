import { expect, test } from "@playwright/test";
import { answersOf, formQuestions, seedWedding, signInAsOwner } from "./support/seed";

/**
 * What a couple sets up in the form builder, and what their guests then meet:
 * checked end to end, in a real browser, against a real database.
 */

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

test("a question the couple makes required in the builder can't be skipped by a guest", async ({ page }) => {
  const seeded = await seedWedding({
    rsvpQuestions: [meal],
    household: [{ key: "pat", firstName: "Pat" }],
  });

  // The couple ticks "Required" and saves.
  await signInAsOwner(page, seeded);
  await page.goto(`/guests/forms/${seeded.forms.rsvp}`);
  const required = page.getByRole("checkbox", { name: "Required" });
  await expect(required).toHaveAttribute("aria-checked", "false");
  await required.click();
  await expect(required).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  expect((await formQuestions(seeded, seeded.forms.rsvp))[0].required).toBe(true);

  // The guest can't send without answering it…
  await page.context().clearCookies();
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(`/guest/${seeded.guests.pat.token}`);
  await page.getByRole("button", { name: "Respond to the invitation" }).click();
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: /Attending/ }).click();
  await expect(page.getByRole("heading", { name: "Fish or meat?" })).toBeVisible();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Please answer this question.")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Fish or meat?" })).toBeVisible();
  expect(await answersOf(seeded, seeded.forms.rsvp, seeded.guests.pat.id)).toBeNull();

  // …and once they do, the answer is on record.
  await page.getByRole("button", { name: /Meat/ }).click();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { name: /See you soon, Pat/ })).toBeVisible();
  expect(await answersOf(seeded, seeded.forms.rsvp, seeded.guests.pat.id)).toEqual({ "q-meal": "o-meat" });
});

test("a per-person form is answered for the guest and each relative who is coming, one response each", async ({ page }) => {
  const dish = {
    id: "q-dish",
    kind: "short" as const,
    title: { en: "Any dietary needs?" },
    required: true,
  };
  const seeded = await seedWedding({
    customForms: [{ key: "menu", title: "Menu & preferences", perPerson: true, questions: [dish] }],
    household: [
      { key: "pat", firstName: "Pat", rsvp: "attending" },
      { key: "maureen", firstName: "Maureen", relation: "partner_of", rsvp: "attending" },
      { key: "leah", firstName: "Leah", relation: "parent_of", rsvp: "attending" },
      // Not coming: never asked, never counted.
      { key: "matteo", firstName: "Matteo", relation: "parent_of", rsvp: "declined" },
    ],
  });

  await page.goto(`/guest/${seeded.guests.pat.token}`);
  const card = page.locator("li", { has: page.getByRole("heading", { name: "Menu & preferences" }) });
  await expect(card).toContainText("To do");
  await card.getByRole("button", { name: "Reply", exact: true }).click();
  await page.getByRole("button", { name: "Start" }).click();

  // One step per person, the guest first; relatives in the household's
  // order. Whoever each step is for gets their own answer.
  const answers: Record<string, string> = { "For you": "None", "For Maureen": "Vegetarian", "For Leah": "No nuts" };
  const asked: string[] = [];
  for (let step = 0; step < 3; step++) {
    await expect(page.getByRole("heading", { name: "Any dietary needs?" })).toBeVisible();
    const who = (await page.getByText(/^For /).innerText()).trim();
    asked.push(who);
    await page.getByRole("textbox").fill(answers[who]);
    if (step < 2) {
      await page.keyboard.press("Enter");
      await expect(page.getByText(who, { exact: true })).toHaveCount(0);
    }
  }
  expect(asked[0]).toBe("For you");
  expect([...asked].sort()).toEqual(["For Leah", "For Maureen", "For you"]);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { name: "Thank you!" })).toBeVisible();

  const menu = seeded.forms.menu;
  expect(await answersOf(seeded, menu, seeded.guests.pat.id)).toEqual({ "q-dish": "None" });
  expect(await answersOf(seeded, menu, seeded.guests.maureen.id)).toEqual({ "q-dish": "Vegetarian" });
  expect(await answersOf(seeded, menu, seeded.guests.leah.id)).toEqual({ "q-dish": "No nuts" });
  expect(await answersOf(seeded, menu, seeded.guests.matteo.id)).toBeNull();

  await page.getByRole("button", { name: "Back to the invitation" }).click();
  await expect(card).toContainText("Done");
});
