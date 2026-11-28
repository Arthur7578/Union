import { expect, test, type Page } from "@playwright/test";
import { seedWedding, type Seeded } from "./support/seed";

/**
 * How a guest arrives (#92): the invitation (faire-part) first, then their
 * hub, through their personal link or the group link; a guest who comes back;
 * links that lead nowhere. Runs on a phone (project "phone").
 */

const hubTitle = (page: Page) => page.getByRole("heading", { level: 1, name: "Maya & Daniel" });
const rsvpHeading = (page: Page) => page.getByRole("heading", { level: 3, name: "Attendance RSVP" });

async function welcomeSeenAt(seeded: Seeded, key: string) {
  const { data, error } = await seeded.owner.from("guests").select("welcome_seen_at").eq("id", seeded.guests[key].id).single();
  if (error) throw error;
  return data.welcome_seen_at as string | null;
}

async function groupCode(seeded: Seeded) {
  const { data, error } = await seeded.owner
    .from("weddings")
    .update({ guest_join_auth_mode: "light" })
    .eq("id", seeded.weddingId)
    .select("join_code")
    .single();
  if (error) throw error;
  return data.join_code as string;
}

test("a guest opening their link for the first time meets the invitation, then their hub", async ({ page }) => {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea", welcomeSeen: false }] });
  await page.goto(`/guest/${seeded.guests.lea.token}`);

  await expect(page.getByRole("heading", { level: 1, name: "Lea, you have received an invitation" })).toBeVisible();
  await expect(rsvpHeading(page)).toBeHidden();
  expect(await welcomeSeenAt(seeded, "lea")).toBeNull();

  await page.getByRole("button", { name: "Respond to the invitation" }).last().click();

  // Responding goes straight to the RSVP, over the wedding page (inert behind
  // it: drawn, but out of the accessibility tree, so found by its markup).
  await expect(page.getByRole("dialog", { name: "Attendance RSVP" })).toBeVisible();
  await expect(page.locator("h1", { hasText: /^Maya\s*&\s*Daniel$/ })).toBeVisible();
  await expect.poll(() => welcomeSeenAt(seeded, "lea")).not.toBeNull();
});

test("a guest who has already opened the invitation goes straight to their hub, and can see it again", async ({ page }) => {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea" }] });
  await page.goto(`/guest/${seeded.guests.lea.token}`);

  await expect(hubTitle(page)).toBeVisible();
  await expect(rsvpHeading(page)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lea, you have received an invitation" })).toHaveCount(0);

  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("menuitem", { name: "See the invitation again" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Lea, you have received an invitation" })).toBeVisible();
});

test("a guest who found their invitation through the group link comes back to it with their own link", async ({ page }) => {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea", welcomeSeen: false }] });
  const code = await groupCode(seeded);

  await page.goto(`/join/${code}`);
  await page.getByRole("button", { name: "Respond to the invitation" }).click();
  await page.getByLabel("First name").fill("Lea");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(new RegExp(`/guest/${seeded.guests.lea.token}$`));

  // Later, from the address bar or a bookmark: the hub, not the welcome again.
  await page.goto(`/guest/${seeded.guests.lea.token}`);
  await expect(hubTitle(page)).toBeVisible();
  await expect(rsvpHeading(page)).toBeVisible();
});

for (const [label, token] of [
  ["an unknown personal link", "00000000-0000-4000-8000-000000000000"],
  ["a personal link that isn't a token at all", "not-a-token"],
]) {
  test(`${label} opens nothing`, async ({ page }) => {
    // A real wedding exists: none of it may show.
    await seedWedding({ household: [{ key: "lea", firstName: "Lea" }] });
    await page.goto(`/guest/${token}`);

    await expect(page.getByRole("heading", { level: 1, name: "Invitation not found" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Maya");
    await expect(page.locator("body")).not.toContainText("Lea");
  });
}

test("a personal link with a letter changed opens nothing", async ({ page }) => {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea" }] });
  const token = seeded.guests.lea.token;
  const altered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
  await page.goto(`/guest/${altered}`);

  await expect(page.getByRole("heading", { level: 1, name: "Invitation not found" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Lea");
});

test("an unknown group link opens nothing", async ({ page }) => {
  await seedWedding({ household: [{ key: "lea", firstName: "Lea" }] });
  await page.goto("/join/nope1234");

  await expect(page.getByRole("heading", { level: 1, name: "Link not found" })).toBeVisible();
  await expect(page.getByLabel("First name")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Maya");
});
