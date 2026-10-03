/**
 * `prebuild`: refuse to build without Supabase credentials. See
 * `supabaseEnv.mjs` for what is checked and why.
 *
 * Loads `.env*` files the way `next build` will (via `@next/env`, Next's own
 * loader), so values kept in `apps/web/.env.local` count. Variables already in
 * the environment (Vercel, CI) take precedence, as they do in Next.
 *
 * Note this runs for `npm run build` — what Vercel and CI call. Invoking
 * `next build` directly skips it.
 */
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { assertSupabaseEnv } from "./supabaseEnv.mjs";

// `@next/env` is CommonJS: under bare Node (no bundler) it has no named
// exports, so the `import { loadEnvConfig }` form from Next's docs crashes here.
const { loadEnvConfig } = nextEnv;

loadEnvConfig(fileURLToPath(new URL("..", import.meta.url)));

try {
  assertSupabaseEnv();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
