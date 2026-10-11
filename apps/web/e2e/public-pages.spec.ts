import { expect, test } from "@playwright/test";

test("sign-in asks for an email before sending a code", async ({ page }) => {
  await page.goto("/sign-in");
  const email = page.getByRole("textbox", { name: "Email address" });
  const send = page.getByRole("button", { name: "Email me a code" });

  await expect(send).toBeDisabled();
  await email.fill("guest@example.com");
  await expect(send).toBeEnabled();
});

test("the offline fallback page renders", async ({ page }) => {
  await page.goto("/offline");
  await expect(page.getByRole("heading", { level: 1, name: "You're offline" })).toBeVisible();
});

test("an unknown guest link says so and offers the demo", async ({ page }) => {
  await page.goto("/guest/not-a-real-token");
  await expect(page.getByRole("heading", { name: "Invitation not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View demo experience" })).toHaveAttribute(
    "href",
    "/guest/demo",
  );
});
