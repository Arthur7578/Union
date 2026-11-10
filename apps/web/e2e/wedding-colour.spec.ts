import { expect, test } from "@playwright/test";
import { seedWedding, signInAsOwner } from "./support/seed";

/**
 * The couple's wedding colour: Union's guest screens stay neutral until the
 * couple picks their colour, then wear it. Phone size, where couples plan.
 */

test.use({ viewport: { width: 390, height: 844 } });

test("a couple without a colour is offered to pick one, and the guest screens then wear it", async ({ page }) => {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea", rsvp: "attending" }] });
  await signInAsOwner(page, seeded);
  await page.goto("/guests");

  // Neutral until they choose.
  const add = page.getByRole("link", { name: "Add", exact: true });
  await expect(add).toHaveCSS("background-color", "rgb(27, 27, 26)");
  await page.getByRole("link", { name: "Choose your wedding colour" }).click();
  await expect(page).toHaveURL(/\/account\/wedding#wedding-colour$/);

  const colours = page.getByRole("radiogroup", { name: "Wedding colour" });
  await expect(colours.getByRole("radio")).toHaveCount(10);
  await expect(colours.getByRole("radio", { name: "Neutral" })).toBeChecked();
  await colours.getByRole("radio", { name: "Terracotta" }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved")).toBeVisible();

  const { data } = await seeded.owner.from("weddings").select("accent").eq("id", seeded.weddingId).single();
  expect(data?.accent).toBe("terracotta");

  await page.goto("/guests");
  // Their names replace the prompt, and the actions take their colour.
  await expect(page.getByText("Maya & Daniel")).toBeVisible();
  await expect(page.getByRole("link", { name: "Choose your wedding colour" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Add", exact: true })).toHaveCSS(
    "background-color",
    "rgb(154, 68, 35)",
  );
});
