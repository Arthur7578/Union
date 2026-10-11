import type { Page } from "@playwright/test";
import { expect, test } from "./support/organiser";

// The organiser's guest groups. See seating.spec.ts for why these assert on
// what the organiser sees and on what reaches the database.

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
});

/** The card of one group: the nearest ancestor of its rename button that also
 *  holds a Delete button. */
const groupCard = (page: Page, name: string) =>
  page
    .getByRole("button", { name: `Rename ${name}` })
    .locator('xpath=ancestor::*[.//button[normalize-space()="Delete"]][1]');

const membersOf = (
  tables: Record<string, Array<Record<string, unknown>>>,
  groupId: string,
) => tables.guest_group_members.filter((m) => m.group_id === groupId).map((m) => m.guest_id);

test("lists the groups, the ungrouped guests and each group's members", async ({ page, supabase }) => {
  void supabase;
  await page.goto("/guests/groups");

  await expect(page.getByText("6 guests · 2 groups")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rename Family" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rename Friends" })).toBeVisible();

  await expect(page.getByText("Ungrouped (1)")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Assign Eva to a group" })).toBeVisible();

  // A guest in two groups is listed under each.
  await expect(page.getByRole("link", { name: /Chloé Dubois/ })).toHaveCount(2);
  await expect(page.getByText("Can't make it")).toBeVisible();
});

test("assigns an ungrouped guest to a group", async ({ page, supabase }) => {
  await page.goto("/guests/groups");

  await page
    .getByRole("combobox", { name: "Assign Eva to a group" })
    .selectOption({ label: "Friends" });

  await expect(page.getByText("Ungrouped")).toHaveCount(0);
  expect(membersOf(supabase.tables, "group-friends")).toContain("g-eva");
});

test("creates a group", async ({ page, supabase }) => {
  await page.goto("/guests/groups");

  await page.getByRole("button", { name: /New group/ }).click();
  const add = page.getByRole("button", { name: "Add", exact: true });
  await expect(add).toBeDisabled();

  await page.getByRole("textbox", { name: "Group name" }).fill("Colleagues");
  await page.getByRole("radio", { name: "Colour Sage" }).check();
  await add.click();

  await expect(page.getByRole("button", { name: "Rename Colleagues" })).toBeVisible();
  expect(supabase.tables.guest_groups.find((g) => g.name === "Colleagues")).toMatchObject({
    wedding_id: "wedding-1",
  });
});

test("renames a group", async ({ page, supabase }) => {
  await page.goto("/guests/groups");

  await page.getByRole("button", { name: "Rename Family" }).click();
  const field = page.getByRole("textbox", { name: "Rename Family" });
  await field.fill("Close family");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("button", { name: "Rename Close family" })).toBeVisible();
  expect(supabase.tables.guest_groups.find((g) => g.id === "group-family")?.name).toBe(
    "Close family",
  );
});

test("deleting a group keeps its guests but removes the membership", async ({ page, supabase }) => {
  await page.goto("/guests/groups");

  await groupCard(page, "Friends").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Delete Friends?")).toBeVisible();
  await page.getByText("Delete Friends?").locator('xpath=ancestor::*[.//button[normalize-space()="Delete"]][1]').getByRole("button", { name: "Delete" }).click();

  await expect(page.getByRole("button", { name: "Rename Friends" })).toHaveCount(0);
  expect(supabase.tables.guest_groups.map((g) => g.id)).toEqual(["group-family"]);
  expect(membersOf(supabase.tables, "group-friends")).toEqual([]);
  expect(supabase.tables.guests).toHaveLength(6);
});

test("changes a group's colour", async ({ page, supabase }) => {
  await page.goto("/guests/groups");

  await groupCard(page, "Family").getByRole("button", { name: "Colour Slate" }).click();

  await expect
    .poll(() => supabase.tables.guest_groups.find((g) => g.id === "group-family")?.color)
    .not.toBeNull();
});

test("moves a group down the list", async ({ page, supabase }) => {
  await page.goto("/guests/groups");

  await page.getByRole("button", { name: "Move Family down" }).click();

  await expect(page.getByRole("button", { name: "Move Family up" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Move Family down" })).toBeDisabled();
  const order = [...supabase.tables.guest_groups]
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    .map((g) => g.id);
  expect(order).toEqual(["group-friends", "group-family"]);
});

test("searches the members of every group", async ({ page }) => {
  await page.goto("/guests/groups");

  await page.getByRole("searchbox", { name: "Search guests" }).fill("okafor");

  await expect(page.getByRole("link", { name: /David Okafor/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Ana Costa/ })).toHaveCount(0);
});
