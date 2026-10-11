import { expect, test } from "@playwright/test";

// The `demo` guest link serves a built-in invitation without touching
// Supabase, so the guest's whole journey can be driven in a real browser with
// no seeded data.

test.describe("guest portal (demo link)", () => {
  test("opens the invitation, then answers the RSVP", async ({ page }) => {
    await page.goto("/guest/demo");
    await expect(
      page.getByRole("heading", { level: 1, name: /you have received an invitation/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Respond to the invitation" }).click();
    const rsvp = page.getByRole("dialog", { name: "Attendance RSVP" });
    await expect(
      rsvp.getByRole("heading", { name: "Arthur, will you join us?" }),
    ).toBeVisible();

    await rsvp.getByRole("button", { name: "Attending" }).click();
    await expect(
      rsvp.getByRole("heading", { name: "Any allergies or dietary needs?" }),
    ).toBeVisible();
    await rsvp.getByRole("textbox").fill("Vegetarian");
    await rsvp.getByRole("button", { name: "OK" }).click();

    await expect(
      rsvp.getByRole("heading", { name: "Will Guinevere join us?" }),
    ).toBeVisible();
    await rsvp.getByRole("button", { name: "Attending" }).click();
    await rsvp.getByRole("button", { name: "OK" }).click();

    // Her dietary question is optional: leave it blank.
    await expect(
      rsvp.getByRole("heading", { name: "Any allergies or dietary needs for Guinevere?" }),
    ).toBeVisible();
    await rsvp.getByRole("button", { name: "OK" }).click();

    await expect(
      rsvp.getByRole("heading", { name: "A word for Maya & Daniel?" }),
    ).toBeVisible();
    await rsvp.getByRole("button", { name: "Send" }).click();

    await expect(
      rsvp.getByRole("heading", { name: "See you soon, Arthur!" }),
    ).toBeVisible();
    await rsvp.getByRole("button", { name: "Back to the invitation" }).click();
    await expect(rsvp).toBeHidden();
  });

  test("declining skips the questions meant for guests who come", async ({ page }) => {
    await page.goto("/guest/demo");
    await page.getByRole("button", { name: "Respond to the invitation" }).click();
    const rsvp = page.getByRole("dialog", { name: "Attendance RSVP" });

    await rsvp.getByRole("button", { name: "Declined" }).click();
    await expect(
      rsvp.getByRole("heading", { name: "Any allergies or dietary needs?" }),
    ).toHaveCount(0);
  });

  test("shows the hub sections", async ({ page }) => {
    await page.goto("/guest/demo");
    // "Respond" on the invitation enters the hub with the RSVP open on top.
    await page.getByRole("button", { name: "Respond to the invitation" }).click();
    await page.getByRole("dialog", { name: "Attendance RSVP" }).getByRole("button", { name: "Close" }).click();

    await expect(page.getByText("Demo mode — your replies are simulated.")).toBeVisible();
    for (const name of ["Your replies", "Travel & carsharing", "The details", "Questions & answers"]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    }
    await expect(
      page.getByRole("link", { name: "Open in Google Maps" }),
    ).toHaveAttribute("href", /google\.com\/maps/);
  });

  test("switches language to French", async ({ page }) => {
    await page.goto("/guest/demo");
    await page.getByRole("button", { name: "FR" }).first().click();

    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(
      page.getByRole("heading", { level: 1, name: /tu as reçu une invitation/ }),
    ).toBeVisible();
  });
});
