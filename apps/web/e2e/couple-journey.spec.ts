import { expect, test } from "@playwright/test";
import { seedOrganiser, signInAsOwner } from "./support/seed";

/**
 * The organiser's essential journey (#95): a couple who just signed up sets up
 * their wedding, adds a guest with their partner, takes the guest's link, and
 * that guest lands on their own hub and answers for both. Runs on a phone and
 * on desktop (`couple-*` files run in both projects, playwright.config.ts).
 */

test("a couple sets up their wedding, adds a household, and the guest they invite lands on their hub", async ({
  page,
  browser,
}, testInfo) => {
  const organiser = await seedOrganiser();
  await signInAsOwner(page, { ownerSession: organiser.session });

  // Onboarding.
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { level: 1, name: "Let's set up your wedding" })).toBeVisible();
  const start = page.getByRole("button", { name: "Start planning" });
  await expect(start).toBeDisabled();
  await page.getByLabel("Your name").fill("Maya");
  await page.getByLabel("Partner's name").fill("Daniel");
  await page.getByLabel("Wedding date").fill("2027-06-12");
  await page.getByLabel("Venue (if you have one)").fill("The Olive Farm");
  await start.click();
  await expect(page).toHaveURL(/\/today$/);

  const { data: weddings, error } = await organiser.client
    .from("weddings")
    .select("id, partner_one, partner_two, event_date, venue_name")
    .eq("owner_id", organiser.userId);
  if (error) throw error;
  expect(weddings).toEqual([
    expect.objectContaining({ partner_one: "Maya", partner_two: "Daniel", event_date: "2027-06-12", venue_name: "The Olive Farm" }),
  ]);
  const weddingId = weddings[0].id as string;

  // A guest and their partner, in one go.
  await page.goto("/guests/new");
  await page.getByLabel("First name").first().fill("Noor");
  await page.getByLabel("Last name").first().fill("Haddad");
  await page.getByPlaceholder("Type a name to search or add a partner…").fill("Sami");
  await page.getByRole("button", { name: '+ Add "Sami" as a new guest' }).click();
  await page.getByRole("button", { name: "Add guest" }).click();
  await expect(page).toHaveURL(/\/guests$/);
  await expect(page.getByText("Noor Haddad")).toBeVisible();

  const { data: guests, error: guestsError } = await organiser.client
    .from("guests")
    .select("id, first_name")
    .eq("wedding_id", weddingId);
  if (guestsError) throw guestsError;
  expect(guests.map((g) => g.first_name).sort()).toEqual(["Noor", "Sami"]);
  const noor = guests.find((g) => g.first_name === "Noor")!;
  const sami = guests.find((g) => g.first_name === "Sami")!;

  // The guest's personal link, as the couple copies it.
  await page.goto(`/guests/${noor.id}`);
  await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();
  const path = (await page.getByText(/^\/guest\/[0-9a-f-]{36}$/).textContent())?.trim();
  expect(path, "the invitation link on the guest's page").toBeTruthy();

  // The guest opens it on their own device, signed out.
  const guestContext = await browser.newContext({ ...testInfo.project.use, baseURL: new URL(page.url()).origin });
  const guest = await guestContext.newPage();
  await guest.goto(path!);
  await expect(guest.getByRole("heading", { level: 1, name: "Noor, you have received an invitation" })).toBeVisible();
  await guest.getByRole("button", { name: "Respond to the invitation" }).last().click();
  // The wedding page is behind the RSVP, inert while it is open: drawn, but
  // out of the accessibility tree, so it is found by its markup.
  await expect(guest.locator("h1", { hasText: /^Maya\s*&\s*Daniel$/ })).toBeVisible();

  // Responding from the invitation opens the RSVP on its first question.
  const dialog = guest.getByRole("dialog", { name: "Attendance RSVP" });
  // The couple gave no email: a personal link offers to add one, never requires it.
  await expect(dialog.getByRole("heading", { level: 2, name: "Your email" })).toBeVisible();
  await dialog.getByRole("button", { name: "OK", exact: true }).click();
  // Each person is asked whether they're coming; the default follow-up
  // questions of a new wedding (dietary needs…) are optional and left blank.
  const asked: string[] = [];
  const done = dialog.getByRole("heading", { level: 2, name: "See you soon, Noor!" });
  for (let step = 0; step < 20 && !(await done.isVisible()); step++) {
    const heading = dialog.getByRole("heading", { level: 2 });
    await expect(heading).toBeVisible();
    const text = (await heading.textContent()) ?? "";
    const who = text.match(/^(?:(\w+), will you join us\?|Will (\w+) join us\?)$/);
    if (who) {
      asked.push(who[1] ?? who[2]);
      await dialog.getByRole("button", { name: "Attending", exact: true }).click();
    } else {
      // "OK" moves on; the last question's button is "Send".
      await dialog.getByRole("button", { name: /^(OK|Send)$/ }).click();
    }
    await expect(heading.or(done)).not.toHaveText(text);
  }
  await expect(done).toBeVisible();
  expect(asked).toEqual(["Noor", "Sami"]);

  // The couple sees both answers.
  await expect
    .poll(async () => {
      const { data, error: rsvpError } = await organiser.client
        .from("rsvps")
        .select("guest_id, status")
        .in("guest_id", [noor.id, sami.id]);
      if (rsvpError) throw rsvpError;
      return Object.fromEntries(data.map((r) => [r.guest_id === noor.id ? "Noor" : "Sami", r.status]));
    })
    .toEqual({ Noor: "attending", Sami: "attending" });
  await guestContext.close();
});
