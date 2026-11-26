import { expect, test } from "@playwright/test";
import { e2eEnv } from "./support/env";

/**
 * What the keepalive job (.github/workflows/supabase-keepalive.yml) relies
 * on, with the same publishable key it holds (role anon): the
 * keepalive_ping() write goes through, and a direct table read does not,
 * which is why the job no longer reads /rest/v1/weddings
 * (20261125120000_anon_least_privilege). No browser: plain HTTP, like the job.
 */

const headers = () => {
  const { anonKey } = e2eEnv();
  return { apikey: anonKey, Authorization: `Bearer ${anonKey}` };
};

test("the keepalive write works with the publishable key", async ({ request }) => {
  const { url } = e2eEnv();
  const first = await request.post(`${url}/rest/v1/rpc/keepalive_ping`, { headers: headers(), data: {} });
  expect(first.status()).toBe(200);
  const second = await request.post(`${url}/rest/v1/rpc/keepalive_ping`, { headers: headers(), data: {} });
  expect(second.status()).toBe(200);

  const [before] = (await first.json()) as Array<{ ping_count: number }>;
  const [after] = (await second.json()) as Array<{ ping_count: number }>;
  expect(after.ping_count).toBe(before.ping_count + 1);
});

test("the publishable key cannot read a table directly", async ({ request }) => {
  const { url } = e2eEnv();
  const read = await request.get(`${url}/rest/v1/weddings?select=id&limit=1`, { headers: headers() });
  expect(read.ok()).toBe(false);
  expect(await read.text()).toContain("permission denied");
});
