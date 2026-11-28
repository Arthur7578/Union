import { expect, test, type Page } from "@playwright/test";
import { seedWedding, type Seeded } from "./support/seed";

/**
 * The group link (/join/[code]) the couple shares in a group chat: a guest
 * who isn't signed in types their first name and lands on their own
 * invitation. Signed-out visitors can reach no table (migration
 * 20261125120000_anon_least_privilege), so this checks the whole flow still
 * works through its RPCs alone. Phone size, since that is how guests open it.
 */

test.use({ viewport: { width: 390, height: 844 } });

async function joinCode(seeded: Seeded, mode: "light" | "secure") {
  const { data, error } = await seeded.owner
    .from("weddings")
    .update({ guest_join_auth_mode: mode })
    .eq("id", seeded.weddingId)
    .select("join_code")
    .single();
  if (error) throw error;
  return data.join_code as string;
}

/** The group link always opens on the invitation's welcome first. */
async function openJoinLink(page: Page, code: string) {
  await page.goto(`/join/${code}`);
  await page.getByRole("button", { name: "Respond to the invitation" }).click();
  await expect(page.getByRole("heading", { name: "Find your invitation" })).toBeVisible();
}

async function typeFirstName(page: Page, name: string) {
  await page.getByLabel("First name").fill(name);
  await page.getByRole("button", { name: "Continue" }).click();
}

test("with the name-only link, a guest types their first name and lands on their invitation", async ({ page }) => {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea" }] });
  const code = await joinCode(seeded, "light");

  await openJoinLink(page, code);
  await typeFirstName(page, "Lea");

  await expect(page).toHaveURL(new RegExp(`/guest/${seeded.guests.lea.token}$`));
  // "Respond" carries through: with no part to read, her RSVP opens, in her name.
  const rsvp = page.getByRole("dialog", { name: "Attendance RSVP" });
  await expect(rsvp.getByRole("heading", { level: 2, name: "Lea, will you join us?" })).toBeVisible();
});

test("a name the couple didn't invite opens nothing", async ({ page }) => {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea" }] });
  const code = await joinCode(seeded, "light");

  await openJoinLink(page, code);
  await typeFirstName(page, "Intruder");

  await expect(page.getByRole("heading", { name: "We couldn't find your invitation" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/join/${code}$`));
});

test("with the secure link, a matching name only leads to the email step", async ({ page }) => {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea" }] });
  const code = await joinCode(seeded, "secure");

  await openJoinLink(page, code);
  await typeFirstName(page, "Lea");

  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/join/${code}$`));
});
