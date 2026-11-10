import { expect, test } from "@playwright/test";
import { seedWedding, signInAsOwner } from "./support/seed";

/**
 * The couple's Guests hub (/guests) and the full list it leads to
 * (/guests/list). Phone size: web mobile is where couples use Union first.
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

test("the hub says how many have answered and lists the latest replies", async ({ page }) => {
  const seeded = await seed();
  await signInAsOwner(page, seeded);
  await page.goto("/guests");

  await expect(page.getByRole("heading", { level: 1, name: "Guests" })).toBeVisible();
  const replies = page.getByRole("heading", { level: 2, name: /2\s*of 4 have answered/ });
  await expect(replies).toBeVisible();

  const latest = page.getByRole("region", { name: "Latest replies" });
  await expect(latest.getByRole("link", { name: /Lea/ })).toContainText("Coming");
  await expect(latest.getByRole("link", { name: /Hugo/ })).toContainText("Can't come");
  await expect(latest.getByRole("link", { name: /Ines/ })).toHaveCount(0);

  // Every guest tool is reachable from the hub, grouped by stage.
  for (const stage of ["Who's invited", "Their invitation", "Sending it", "On the day"]) {
    await expect(page.getByRole("heading", { level: 2, name: stage })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /Seating/ })).toHaveAttribute("href", "/guests/seating");
});

test("an answer in the reply bar opens the list filtered to it", async ({ page }) => {
  const seeded = await seed();
  await signInAsOwner(page, seeded);
  await page.goto("/guests");

  await page.getByRole("link", { name: /Waiting\s*2/ }).click();
  await expect(page).toHaveURL(/\/guests\/list\?status=waiting$/);
  await expect(page.getByRole("button", { name: /Waiting/ })).toHaveAttribute("aria-pressed", "true");
  const rows = page.getByRole("list", { name: "Guest list" }).getByRole("link");
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: "Ines" })).toHaveCount(1);
  await expect(rows.filter({ hasText: "Noe" })).toHaveCount(1);

  // Clearing the filter keeps the URL honest, so back/forward return to it.
  await page.getByRole("button", { name: /^All/ }).click();
  await expect(page).toHaveURL(/\/guests\/list$/);
  await expect(rows).toHaveCount(4);
});

test("searching from the hub lands on the list with the search applied", async ({ page }) => {
  const seeded = await seed();
  await signInAsOwner(page, seeded);
  await page.goto("/guests");

  const find = page.getByRole("searchbox", { name: "Find a guest" });
  await find.fill("hug");
  await find.press("Enter");
  await expect(page).toHaveURL(/\/guests\/list\?q=hug$/);
  await expect(page.getByRole("searchbox", { name: "Find a guest" })).toHaveValue("hug");
  const rows = page.getByRole("list", { name: "Guest list" }).getByRole("link");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Hugo");

  await rows.first().click();
  await expect(page).toHaveURL(new RegExp(`/guests/${seeded.guests.hugo.id}$`));
});

test("a wedding with no guests yet is offered both ways to start", async ({ page }) => {
  const seeded = await seedWedding({ household: [] });
  await signInAsOwner(page, seeded);
  await page.goto("/guests");

  await expect(page.getByRole("heading", { level: 2, name: "Start your guest list" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Share the group link" })).toHaveAttribute("href", "/guests/group-link");
});
