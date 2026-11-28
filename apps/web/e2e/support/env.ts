/** The local Supabase the browser tests seed and the app talks to. */
export function e2eEnv() {
  const url = process.env.E2E_SUPABASE_URL ?? "";
  const anonKey = process.env.E2E_SUPABASE_ANON_KEY ?? "";
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      "Set E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY and E2E_SUPABASE_SERVICE_ROLE_KEY " +
        "(from `supabase status -o env` after `supabase start`).",
    );
  }
  // These tests create users, weddings and guests with the service role key.
  // Never point them at a hosted project.
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`Browser tests only run against a local Supabase, not ${host}.`);
  }
  return { url, anonKey, serviceRoleKey };
}
