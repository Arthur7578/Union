"use client";

import { createUnionClient, type UnionClient } from "@union/shared";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let client: UnionClient | null = null;

/**
 * Browser Supabase client for the couple's planning app. Unlike the public
 * RSVP client (`lib/supabase.ts`), this one persists the session in
 * localStorage and refreshes tokens, so the couple stays signed in.
 *
 * Returns a lazily-created singleton so every hook shares one auth session.
 */
export function getBrowserSupabase(): UnionClient {
  if (client) return client;
  client = createUnionClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

/** True when Supabase credentials are configured for this deployment. */
export const supabaseConfigured = Boolean(url && anonKey);
