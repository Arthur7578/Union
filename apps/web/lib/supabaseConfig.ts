/**
 * The one place the web app decides which Supabase project it talks to.
 *
 * Browser clients, the public RSVP client and the API routes all import from
 * here so they can never disagree. They used to each carry their own copy of
 * the fallback, and the API routes also honoured a server-only `SUPABASE_URL`
 * the browser cannot see — setting just that variable pointed the routes at
 * one project while the browser stayed on the built-in one, and a session
 * minted by one project is rejected by the other.
 *
 * Only `NEXT_PUBLIC_*` variables are read, on purpose: they are the only ones
 * present on both sides, and they are inlined into the browser bundle at build
 * time. Keep each `process.env.NEXT_PUBLIC_…` access written out literally —
 * indirect access (`process.env[name]`) is not inlined and would leave the
 * browser on the fallback.
 *
 * The defaults are this deployment's own project and its publishable key
 * (safe to ship: it is the key the browser sends anyway), so previews connect
 * without any configuration. Setting the env vars overrides both together.
 */
const DEFAULT_SUPABASE_URL = "https://jriyeblycrzpozjuexvr.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_G0fMYmSyYm4hJWterPh3eg_GLdE92V-";

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

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
