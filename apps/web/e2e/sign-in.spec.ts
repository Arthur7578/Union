import { expect, test } from "@playwright/test";
import { seedWedding } from "./support/seed";

/**
 * Signing in with an emailed code, through the real form: the email goes to
 * the local Supabase mailbox (Mailpit), the test reads the code there. There
 * is no captcha locally (supabase/config.toml); production's captcha is
 * checked as configuration by e2e-prod/captcha.spec.ts.
 */

const mailpit = (process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324").replace(/\/$/, "");

/** The sign-in code sent to `email`, from the subject "<code> is your Union sign-in code". */
async function codeSentTo(email: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    if (res.ok) {
      const { messages } = (await res.json()) as { messages: Array<{ Subject: string }> };
      const code = messages.map((m) => m.Subject.match(/^(\d{8}) is your Union sign-in code/)?.[1]).find(Boolean);
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No sign-in code reached ${email} in Mailpit (${mailpit}).`);
}

test("an organiser signs in with the code emailed to them and reaches their wedding", async ({ page }) => {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea" }] });

  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(seeded.ownerEmail);
  await page.getByRole("button", { name: "Email me a code" }).click();

  await page.getByLabel("8-digit code").fill(await codeSentTo(seeded.ownerEmail));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/(choose-wedding|today)/);
  if (page.url().includes("choose-wedding")) await page.getByText("Maya & Daniel").click();
  await expect(page).toHaveURL(/\/today/);
});

test("a wrong code keeps the organiser on the sign-in page", async ({ page }) => {
  const seeded = await seedWedding({ household: [{ key: "lea", firstName: "Lea" }] });

  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(seeded.ownerEmail);
  await page.getByRole("button", { name: "Email me a code" }).click();
  const real = await codeSentTo(seeded.ownerEmail);

  await page.getByLabel("8-digit code").fill(real === "00000000" ? "11111111" : "00000000");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByLabel("8-digit code")).toBeVisible();
});
