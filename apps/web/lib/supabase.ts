import { createUnionClient, type UnionClient } from "@union/shared";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Anonymous Supabase client for the public RSVP flow. No session is
 * persisted — all access goes through the token-scoped RPC functions
 * `get_invitation` / `submit_rsvp`.
 */
export function getSupabase(): UnionClient {
  return createUnionClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
