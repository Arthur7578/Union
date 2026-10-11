import { createUnionClient, type UnionClient } from "@union/shared";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabaseConfig";

/**
 * Anonymous Supabase client for the public RSVP flow. No session is
 * persisted — all access goes through the token-scoped RPC functions
 * `get_invitation` / `submit_rsvp`.
 */
export function getSupabase(): UnionClient {
  return createUnionClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
