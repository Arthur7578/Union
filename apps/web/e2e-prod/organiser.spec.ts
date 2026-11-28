import { createClient, type Session } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { need, prodEnv } from "./support/env";

/**
 * The organiser's pages in production, signed in as PROD_CHECK_EMAIL.
 *
 * Signing in through the form needs the Turnstile captcha, which a bot cannot
 * pass. Instead the secret key asks Supabase for a one-time sign-in code
 * (admin generateLink: no email is sent), and the publishable key confirms it
 * (`/auth/v1/verify`, which has no captcha). The session then goes into the
 * browser exactly where the app keeps it, as `signInAsOwner` does in CI. The
 * secret key stays in this Node process and never reaches the page.
 *
 * Read-only: each page is opened and looked at, nothing is saved.
 */

const env = prodEnv();
let session: Session;

test.beforeAll(async () => {
  const admin = createClient(env.supabaseUrl, need("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(env.supabaseUrl, need("PROD_SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = need("PROD_CHECK_EMAIL");

  // Supabase can hand back a code it already issued; one fresh attempt covers it.
  for (let attempt = 1; ; attempt++) {
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) throw new Error(`generateLink: ${link.error.message}`);
    const verified = await anon.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "email" });
    if (verified.data.session) {
      session = verified.data.session;
      return;
    }
    if (attempt >= 2) throw new Error(`verifyOtp: ${verified.error?.message ?? "no session"}`);
    await new Promise((r) => setTimeout(r, 61_000));
  }
});

test.afterAll(async () => {
  // Close the session the checks opened, so they don't pile up.
  if (!session) return;
  const anon = createClient(env.supabaseUrl, need("PROD_SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await anon.auth.setSession(session);
  await anon.auth.signOut({ scope: "local" });
});

async function signIn(page: Page) {
  const storageKey = `sb-${env.projectRef}-auth-token`;
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [storageKey, JSON.stringify(session)] as const,
  );
}

/** Every Supabase answer of 400 or more while a page loads. */
function watchSupabase(page: Page) {
  const failures: string[] = [];
  page.on("response", (res) => {
    if (res.url().startsWith(env.supabaseUrl) && res.status() >= 400) {
      failures.push(`${res.request().method()} ${new URL(res.url()).pathname} → ${res.status()}`);
    }
  });
  return failures;
}

const pages = [
  "/today",
  "/guests",
  "/guests/groups",
  "/guests/seating",
  "/guests/forms",
  "/guests/rsvp-form",
  "/guests/page-content",
  "/guests/group-link",
  "/guests/modules",
  "/guests/permissions",
  "/guests/stays",
  "/guests/duplicates",
  "/plan",
  "/plan/budget",
  "/plan/team",
  "/plan/weekend",
  "/vendors",
  "/account",
  "/account/wedding",
];

for (const path of pages) {
  test(`an organiser opens ${path}`, async ({ page }) => {
    await signIn(page);
    const failures = watchSupabase(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    // Still on the page: not sent back to sign in or to set up a wedding.
    await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, "\\/")}(\\?.*)?$`));
    await expect(page.getByText(/permission denied|Something went wrong/i)).toHaveCount(0);
    expect(failures, "Supabase requests that failed").toEqual([]);
  });
}
