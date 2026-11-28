/**
 * What the production checks need. Every value comes from the environment
 * (GitHub Actions secrets in `.github/workflows/prod-checks.yml`); nothing
 * about the production project is written in the repository except the
 * site's public address.
 *
 * Public by design (the web app ships them):
 *   PROD_SITE_URL              the live site, default https://union-silk.vercel.app
 *   PROD_SUPABASE_URL          the project URL (https://<ref>.supabase.co)
 *   PROD_SUPABASE_PUBLISHABLE_KEY  the publishable key
 *
 * Test fixtures (a guest and a group link of the wedding the checks look at):
 *   PROD_CHECK_GUEST_TOKEN     a guest's personal link token (/guest/<token>)
 *   PROD_CHECK_JOIN_CODE       that wedding's group link code (/join/<code>)
 *   PROD_CHECK_EMAIL           the organiser account the signed-in checks use
 *
 * Secrets (never sent to the browser):
 *   SUPABASE_SECRET_KEY        sb_secret_… (or the legacy service_role key):
 *                              only used to create a one-time sign-in code for
 *                              PROD_CHECK_EMAIL, so the checks skip the captcha
 *   SUPABASE_ACCESS_TOKEN      a Supabase access token that can read the
 *                              project's auth settings (captcha secret)
 *   CLOUDFLARE_API_TOKEN       read access to Turnstile widgets
 *   CLOUDFLARE_ACCOUNT_ID      the Cloudflare account that owns the widget
 */
export function prodEnv() {
  const siteUrl = (process.env.PROD_SITE_URL || "https://union-silk.vercel.app").replace(/\/$/, "");
  const supabaseUrl = (process.env.PROD_SUPABASE_URL ?? "").replace(/\/$/, "");
  return {
    siteUrl,
    supabaseUrl,
    projectRef: supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : "",
    publishableKey: process.env.PROD_SUPABASE_PUBLISHABLE_KEY ?? "",
  };
}

/** A required variable, or a failure that names it. */
export function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}: add it as a GitHub Actions secret (see e2e-prod/support/env.ts).`);
  return value;
}
