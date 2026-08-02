import { createUnionClient, type UnionClient } from "@union/shared";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://jriyeblycrzpozjuexvr.supabase.co";

/**
 * Service-role Supabase client — server-only, never import this from a
 * "use client" component or any code bundled to the browser. Required for
 * RPCs that must not be reachable with the public anon key, namely
 * request_guest_otp / request_guest_email_otp: they return a plaintext
 * one-time code to be emailed, and the anon key is the same credential the
 * browser holds, so those RPCs are granted to `service_role` only.
 */
export function getSupabaseAdmin(): UnionClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
  return createUnionClient(SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
