"use client";

import { createUnionClient, type UnionClient } from "@union/shared";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabaseConfig";

let client: UnionClient | null = null;

/**
 * Browser Supabase client for authenticated organiser and guest flows. Unlike
 * the public RSVP client (`lib/supabase.ts`), this one persists the session in
 * localStorage and refreshes tokens so the verified identity stays signed in.
 *
 * Returns a lazily-created singleton so every hook shares one auth session.
 */
export function getBrowserSupabase(): UnionClient {
  if (client) return client;
  client = createUnionClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

/** Public Auth origin used to validate emailed confirmation URLs before the
 * invitation handoff redirects the browser. */
export const supabaseUrl = SUPABASE_URL;

/** True when Supabase credentials are configured for this deployment. */
export const supabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY,
);
