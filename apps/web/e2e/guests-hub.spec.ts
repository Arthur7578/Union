import { expect, test, type Page } from "@playwright/test";
import { seedWedding, signInAsOwner, type Seeded } from "./support/seed";

/**
 * The couple's Guests hub (/guests): what needs them first, then every
 * module; and the guest list module it leads to (/guests/list). Phone size:
 * web mobile is where couples use Union first.
 */

test.use({ viewport: { width: 390, height: 844 } });

async function seed() {
  return seedWedding({
    household: [
      { key: "lea", firstName: "Lea", rsvp: "attending" },
      { key: "hugo", firstName: "Hugo", rsvp: "declined" },
      { key: "ines", firstName: "Ines" },
      { key: "noe", firstName: "Noe" },
    ],
  });
}

const todo = (page: Page) => page.getByRole("region", { name: "To do" });
const listRows = (page: Page) => page.getByRole("list", { name: "Guest list" }).getByRole("link");

async function remindedAt(seeded: Seeded, keys: string[]) {
  const { data } = await seeded.owner
    .from("guests")
    .select("rsvp_reminder_sent_at")
    .in("id", keys.map((k) => seeded.guests[k].id));
  return (data ?? []).map((r) => r.rsvp_reminder_sent_at);
}

test("the hub opens on where replies stand and what needs the couple, with no list or search", async ({ page }) => {
  const seeded = await seed();
  await signInAsOwner(page, seeded);
  await page.goto("/guests");

  await expect(page.getByRole("heading", { level: 1, name: "Guests" })).toBeVisible();
  await expect(page.getByText("Maya & Daniel")).toBeVisible();
  await expect(page.getByRole("link", { name: "See replies in the guest list" })).toContainText("of 4 have answered");
  await expect(todo(page).getByRole("heading", { name: "2 guests haven't replied yet" })).toBeVisible();

  // The list and its search live in the guest list module, not at the root.
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  for (const stage of ["Who's invited", "Their invitation", "Sending it", "On the day"]) {
    await expect(page.getByRole("heading", { level: 3, name: stage })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /Seating/ })).toHaveAttribute("href", "/guests/seating");
  await expect(page.getByRole("link", { name: /Guest list/ })).toContainText("4 guests");
});

test("without an email sender, nudging opens the couple's mail app and records nothing until they say so", async ({ page }) => {
  const seeded = await seed();
  await signInAsOwner(page, seeded);
  await page.goto("/guests");

  const nudge = todo(page).getByRole("link", { name: "Nudge 2" });
  const href = await nudge.getAttribute("href");
  expect(href).toMatch(/^mailto:\?bcc=/);
  expect(decodeURIComponent(href!)).toContain("ines-");
  expect(decodeURIComponent(href!)).toContain("noe-");

  await nudge.click();
  await expect(todo(page).getByText("Sent? Note them as nudged")).toBeVisible();
  // Opening the mail app is not sending: nobody is marked as nudged yet.
  expect(await remindedAt(seeded, ["ines", "noe"])).toEqual([null, null]);

  // Noting it is optional...
  await todo(page).getByRole("button", { name: "Not now" }).click();
  expect(await remindedAt(seeded, ["ines", "noe"])).toEqual([null, null]);

  // ...and, when they choose to, it marks the guests who were in the email.
  await todo(page).getByRole("link", { name: "Nudge 2" }).click();
  await todo(page).getByRole("button", { name: "Note as nudged" }).click();
  await expect(todo(page).getByText("Noted: 2 guests nudged today.")).toBeVisible();
  expect((await remindedAt(seeded, ["ines", "noe"])).every((v) => v !== null)).toBe(true);
  // The card calms down instead of asking again.
  await expect(todo(page).getByText("You nudged them today. Give them a few days.")).toBeVisible();
  await expect(todo(page).getByRole("link", { name: "Nudge again" })).toBeVisible();
});

test("waiting guests with no email get their own card, which opens just them in the list", async ({ page }) => {
  const seeded = await seed();
  await seeded.owner.from("guests").update({ email: null }).eq("id", seeded.guests.noe.id);
  await signInAsOwner(page, seeded);
  await page.goto("/guests");

  await expect(todo(page).getByRole("heading", { name: "2 guests haven't replied yet" })).toBeVisible();
  await expect(todo(page).getByRole("link", { name: "Nudge 1" })).toBeVisible();
  const card = todo(page).getByRole("article").filter({ hasText: "1 waiting guest has no email" });
  await card.getByRole("link", { name: "See them" }).click();

  await expect(page).toHaveURL(/\/guests\/list\?status=waiting&email=missing$/);
  await expect(listRows(page)).toHaveCount(1);
  await expect(listRows(page).first()).toContainText("Noe");
  await expect(listRows(page).first()).toContainText("No email: send their link");
});

test("the guest list filters by reply, keeps it in the URL, and searches", async ({ page }) => {
  const seeded = await seed();
  await signInAsOwner(page, seeded);
  await page.goto("/guests");

  await page.getByRole("link", { name: "See replies in the guest list" }).click();
  await expect(page).toHaveURL(/\/guests\/list$/);
  await expect(listRows(page)).toHaveCount(4);
  // One person, one answer: singular wording on each row.
  await expect(listRows(page).filter({ hasText: "Hugo" })).toContainText("Can't come");

  await page.getByRole("button", { name: /^Waiting/ }).click();
  await expect(page).toHaveURL(/\/guests\/list\?status=waiting$/);
  await expect(listRows(page)).toHaveCount(2);

  await page.getByRole("button", { name: /^All/ }).click();
  await expect(page).toHaveURL(/\/guests\/list$/);
  await page.getByRole("searchbox", { name: "Find a guest" }).fill("hug");
  await expect(listRows(page)).toHaveCount(1);
  await listRows(page).first().click();
  await expect(page).toHaveURL(new RegExp(`/guests/${seeded.guests.hugo.id}$`));
});

test("a wedding where everyone has answered has nothing to do", async ({ page }) => {
  const seeded = await seedWedding({
    household: [
      { key: "lea", firstName: "Lea", rsvp: "attending" },
      { key: "hugo", firstName: "Hugo", rsvp: "declined" },
    ],
  });
  await signInAsOwner(page, seeded);
  await page.goto("/guests");

  await expect(page.getByText("Everyone has answered.")).toBeVisible();
  await expect(todo(page).getByText("Nothing needs you here right now.")).toBeVisible();
});

test("a wedding with no guests yet is offered both ways to start", async ({ page }) => {
  const seeded = await seedWedding({ household: [] });
  await signInAsOwner(page, seeded);
  await page.goto("/guests");

  await expect(page.getByRole("heading", { level: 2, name: "Start your guest list" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Share the group link" })).toHaveAttribute("href", "/guests/group-link");
});
