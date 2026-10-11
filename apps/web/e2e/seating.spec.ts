import { expect, test } from "./support/organiser";

// The organiser's seating plan. The page is one large component with a lot of
// local state, so these specs pin what it does for the organiser (what is
// shown, and what reaches the database) rather than how it is built.

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
});

const seatOf = (supabase: { tables: Record<string, Array<Record<string, unknown>>> }, id: string) =>
  supabase.tables.guests.find((g) => g.id === id)?.seating_table_id ?? null;

test("shows the tables, who is seated and who is still waiting", async ({ page, supabase }) => {
  void supabase;
  await page.goto("/guests/seating");

  await expect(page.getByText("2 of 6 placed")).toBeVisible();
  await expect(page.getByRole("button", { name: "Table Lavender 2/4" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Table Olive" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Head table" })).toBeVisible();

  await expect(page.getByText("4 unassigned")).toBeVisible();
  for (const name of ["Seat Chloé", "Seat David", "Seat Eva", "Seat Farid"]) {
    await expect(page.getByRole("combobox", { name })).toBeVisible();
  }
  // Already-seated guests are not offered for seating again.
  await expect(page.getByRole("combobox", { name: "Seat Ana" })).toHaveCount(0);
});

test("seats a guest from the unassigned list", async ({ page, supabase }) => {
  await page.goto("/guests/seating");

  await page
    .getByRole("combobox", { name: "Seat Chloé" })
    .selectOption({ label: "Table Olive (0/4)" });

  await expect(page.getByRole("button", { name: "Table Olive 1/4" })).toBeVisible();
  await expect(page.getByText("3 unassigned")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Seat Chloé" })).toHaveCount(0);
  expect(seatOf(supabase, "g-chloe")).toBe("t-2");
});

test("unseats a guest from the selected table", async ({ page, supabase }) => {
  await page.goto("/guests/seating");

  await page.getByRole("button", { name: "Table Lavender 2/4" }).click();
  await expect(page.getByText("Ana Costa")).toBeVisible();
  // Unseat Ana (the first guest listed on the table).
  await page.getByRole("button", { name: "Unseat" }).first().click();

  await expect(page.getByText("1 of 6 placed")).toBeVisible();
  await expect(page.getByText("5 unassigned")).toBeVisible();
  const seated = ["g-ana", "g-ben"].filter((id) => seatOf(supabase, id) === "t-1");
  expect(seated).toHaveLength(1);
});

test("seats a whole group at once", async ({ page, supabase }) => {
  await page.goto("/guests/seating");

  await page.getByRole("button", { name: "Table Olive" }).click();
  await page.getByRole("button", { name: /^Friends · \d+/ }).click();

  // The page seats them one by one, then reloads. Every unseated Friend ends
  // at the selected table; Family, already seated elsewhere, is untouched.
  await expect(page.getByRole("button", { name: /^Table Olive \d/ })).toBeVisible();
  await expect.poll(() => seatOf(supabase, "g-farid")).toBe("t-2");
  expect(seatOf(supabase, "g-chloe")).toBe("t-2");
  expect(seatOf(supabase, "g-david")).toBe("t-2");
  expect(seatOf(supabase, "g-farid")).toBe("t-2");
  expect(seatOf(supabase, "g-eva")).toBeNull();
  expect(seatOf(supabase, "g-ana")).toBe("t-1");
});

test("filters the unassigned list as you type", async ({ page }) => {
  await page.goto("/guests/seating");

  await page.getByRole("searchbox", { name: "Search unassigned…" }).fill("eva");

  await expect(page.getByRole("combobox", { name: "Seat Eva" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Seat Chloé" })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Seat David" })).toHaveCount(0);
});

test("adds a table", async ({ page, supabase }) => {
  await page.goto("/guests/seating");

  await page.getByRole("button", { name: "+ Add a table" }).click();
  const add = page.getByRole("button", { name: "Add table" });
  await expect(add).toBeDisabled();

  await page.getByRole("textbox", { name: "Table name" }).fill("Table Sage");
  await page.getByRole("spinbutton", { name: "Seats" }).fill("6");
  await add.click();

  await expect(page.getByRole("button", { name: "Table Sage" })).toBeVisible();
  const created = supabase.tables.seating_tables.find((t) => t.name === "Table Sage");
  expect(created).toMatchObject({ wedding_id: "wedding-1", capacity: 6 });
});

test("deleting a table sends its guests back to unassigned", async ({ page, supabase }) => {
  await page.goto("/guests/seating");

  await page.getByRole("button", { name: "Table Lavender 2/4" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page.getByRole("button", { name: /Table Lavender/ })).toHaveCount(0);
  await expect(page.getByText("6 unassigned")).toBeVisible();
  expect(supabase.tables.seating_tables.map((t) => t.id)).not.toContain("t-1");
  expect(seatOf(supabase, "g-ana")).toBeNull();
});

test("switches to the ceremony view", async ({ page }) => {
  await page.goto("/guests/seating");

  await page.getByRole("tab", { name: "ceremony" }).click();

  await expect(page.getByRole("tab", { name: "ceremony" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tab", { name: "reception" })).toHaveAttribute(
    "aria-selected",
    "false",
  );
});
