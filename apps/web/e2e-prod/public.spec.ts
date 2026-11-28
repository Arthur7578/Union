import { expect, test } from "@playwright/test";
import { need, prodEnv } from "./support/env";

/**
 * What a signed-out visitor (role anon, the publishable key) can and cannot
 * reach in production. Since 20261125120000_anon_least_privilege anon has no
 * table privilege and guests go through security definer RPCs only; these
 * checks fail if production drifts from that, or if a guest RPC breaks.
 */

const env = prodEnv();
const anonHeaders = () => ({ apikey: need("PROD_SUPABASE_PUBLISHABLE_KEY"), "Content-Type": "application/json" });
const rpc = (name: string) => `${need("PROD_SUPABASE_URL").replace(/\/$/, "")}/rest/v1/rpc/${name}`;

test("a signed-out visitor cannot read a table", async ({ request }) => {
  const res = await request.get(`${env.supabaseUrl}/rest/v1/weddings?select=id&limit=1`, { headers: anonHeaders() });
  expect(res.status(), await res.text()).toBe(401);
  expect((await res.json()).code).toBe("42501");
});

test("the guest link's RPC answers and the page shows that guest's invitation", async ({ request }) => {
  const token = need("PROD_CHECK_GUEST_TOKEN");
  const res = await request.post(rpc("get_invitation"), { headers: anonHeaders(), data: { p_token: token } });
  expect(res.status(), await res.text()).toBe(200);
  const invitation = await res.json();
  const firstName: string = invitation?.guest?.first_name ?? "";
  expect(firstName, "get_invitation returned no guest for PROD_CHECK_GUEST_TOKEN").not.toBe("");

  // The page is built on the server through the same RPC; an unknown token
  // also answers 200, so the guest's own name is what proves it worked.
  const page = await request.get(`/guest/${token}`);
  expect(page.status()).toBe(200);
  const html = await page.text();
  expect(html).toContain(firstName);
  expect(html).not.toMatch(/permission denied/i);
});

test("the group link opens, and a name the couple didn't invite finds nothing", async ({ request }) => {
  const code = need("PROD_CHECK_JOIN_CODE");
  const page = await request.get(`/join/${code}`);
  expect(page.status()).toBe(200);
  expect(await page.text()).not.toMatch(/permission denied/i);

  const res = await request.post(rpc("find_guest_for_join"), {
    headers: anonHeaders(),
    data: { p_join_code: code, p_first_name: "Zzzunknown", p_last_name: null },
  });
  expect(res.status(), await res.text()).toBe(200);
  // rate_limited is the RPC protecting itself, not a failure of the link.
  expect(["not_found", "rate_limited"]).toContain((await res.json()).status);
});

test("an unknown guest token reaches nothing", async ({ request }) => {
  const res = await request.post(rpc("get_invitation"), {
    headers: anonHeaders(),
    data: { p_token: "00000000-0000-0000-0000-000000000000" },
  });
  // Either an error or an empty answer: never a guest.
  const body = res.ok() ? await res.json() : null;
  expect(body?.guest ?? null).toBeNull();
});

test("the keepalive RPC still answers with the publishable key", async ({ request }) => {
  const res = await request.post(rpc("keepalive_ping"), { headers: anonHeaders(), data: {} });
  expect(res.status(), await res.text()).toBe(200);
});
