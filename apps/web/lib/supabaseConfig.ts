/**
 * The one place the web app decides which Supabase project it talks to.
 *
 * Browser clients, the public RSVP client and the API routes all import from
 * here so they can never disagree. They used to each carry their own copy of a
 * built-in fallback project, and the API routes also honoured a server-only
 * `SUPABASE_URL` the browser cannot see — setting just that variable pointed
 * the routes at one project while the browser stayed on the built-in one, and a
 * session minted by one project is rejected by the other.
 *
 * There is no built-in fallback any more: the values come from the environment
 * or the app is unconfigured. `npm run build` fails when they are missing
 * (`scripts/check-supabase-env.mjs`), so a deployment cannot ship without
 * them; `supabaseConfigured` below covers `next dev` and anything built
 * elsewhere.
 *
 * Only `NEXT_PUBLIC_*` variables are read, on purpose: they are the only ones
 * present on both sides, and they are inlined into the browser bundle at build
 * time. Keep each `process.env.NEXT_PUBLIC_…` access written out literally —
 * indirect access (`process.env[name]`) is not inlined and would leave the
 * browser without a value.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

/**
 * True when both values are present. Server layouts guard on this to show the
 * "not configured" notice. Keep it here rather than in `supabaseClient`, which
 * is `"use client"`: exported from there, the guard did not fire in the server
 * layouts — with no env set, `/sign-in` still served the normal page and the
 * browser then failed with "Missing Supabase credentials".
 */
export const supabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY,
);
