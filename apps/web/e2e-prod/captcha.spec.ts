import { createHash } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { need, prodEnv } from "./support/env";

/**
 * The sign-in captcha (Cloudflare Turnstile), checked as configuration since a
 * bot cannot solve the real thing (that is its job). Sign-in breaks for
 * everyone if any link of this chain is wrong:
 *   the site's public key → a Cloudflare widget that allows the site's domain
 *   → that widget's secret → the secret Supabase Auth checks tokens with.
 * Secrets are compared through their SHA-256 and never printed.
 */

const env = prodEnv();
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

/** The Turnstile site key the deployed sign-in page ships (public by design). */
async function deployedSiteKey(request: APIRequestContext): Promise<string> {
  const html = await (await request.get("/sign-in")).text();
  const chunks = [...new Set(html.match(/\/_next\/static\/[^"']+\.js/g) ?? [])];
  for (const chunk of chunks) {
    const key = (await (await request.get(chunk)).text()).match(/0x4[A-Za-z0-9_-]{18,}/)?.[0];
    if (key) return key;
  }
  throw new Error("No Turnstile site key in the deployed sign-in page: is NEXT_PUBLIC_TURNSTILE_SITE_KEY set on Vercel?");
}

/** The Cloudflare widget behind a site key, with its secret. */
async function widget(request: APIRequestContext, siteKey: string) {
  const res = await request.get(
    `https://api.cloudflare.com/client/v4/accounts/${need("CLOUDFLARE_ACCOUNT_ID")}/challenges/widgets/${siteKey}`,
    { headers: { Authorization: `Bearer ${need("CLOUDFLARE_API_TOKEN")}` } },
  );
  expect(res.status(), "Cloudflare API: widget lookup").toBe(200);
  const { result } = await res.json();
  return result as { domains: string[]; secret?: string; mode: string };
}

test("Supabase refuses a sign-in code request that carries no captcha token", async ({ request }) => {
  // example.invalid can never receive mail; the request is refused before any lookup.
  const res = await request.post(`${env.supabaseUrl}/auth/v1/otp`, {
    headers: { apikey: need("PROD_SUPABASE_PUBLISHABLE_KEY"), "Content-Type": "application/json" },
    data: { email: "nobody@example.invalid", create_user: false },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error_code).toBe("captcha_failed");
});

test("the site's captcha key is a Cloudflare widget that allows the site's domain", async ({ request }) => {
  const siteKey = await deployedSiteKey(request);
  const w = await widget(request, siteKey);
  const host = new URL(env.siteUrl).hostname;
  // A widget domain also covers its subdomains.
  expect(w.domains.some((d) => host === d || host.endsWith(`.${d}`)), `widget domains: ${w.domains.join(", ")}`).toBe(true);
});

test("the widget's secret is live", async ({ request }) => {
  const w = await widget(request, await deployedSiteKey(request));
  expect(w.secret, "Cloudflare returned no secret for the widget").toBeTruthy();
  // A made-up token with a valid secret is refused as a bad *response*;
  // with a wrong secret, as a bad *secret*.
  const res = await request.post("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    form: { secret: w.secret!, response: "not-a-real-token" },
  });
  const codes: string[] = (await res.json())["error-codes"] ?? [];
  expect(codes).not.toContain("invalid-input-secret");
});

test("Supabase checks captcha tokens with that widget's secret", async ({ request }) => {
  const res = await request.get(`https://api.supabase.com/v1/projects/${env.projectRef}/config/auth`, {
    headers: { Authorization: `Bearer ${need("SUPABASE_ACCESS_TOKEN")}` },
  });
  expect(res.status(), "Supabase Management API: auth config").toBe(200);
  const auth = await res.json();
  expect(auth.security_captcha_enabled).toBe(true);
  expect(auth.security_captcha_provider).toBe("turnstile");

  const supabaseSecret: unknown = auth.security_captcha_secret;
  test.skip(
    typeof supabaseSecret !== "string" || supabaseSecret === "" || supabaseSecret.includes("*"),
    "The Management API did not return the captcha secret, so it cannot be compared with the widget's.",
  );
  const w = await widget(request, await deployedSiteKey(request));
  expect(sha(supabaseSecret as string), "Supabase's captcha secret is not the widget's secret").toBe(sha(w.secret ?? ""));
});
