/**
 * Build-time check that the Supabase env vars the app cannot run without are
 * present and well-formed. `check-supabase-env.mjs` runs it as `prebuild`, so
 * a deployment missing them fails to build — and the previous deployment keeps
 * serving — instead of shipping a bundle whose browser code throws "Missing
 * Supabase credentials" on first load.
 *
 * Mirrors `lib/supabaseConfig.ts`, which is what the app reads at runtime:
 * same variables, same precedence (a publishable key wins over the legacy anon
 * key; an empty string counts as unset). `supabaseConfig.test.ts` keeps the two
 * in step. It is a plain `.mjs` because it runs under bare Node, before any
 * TypeScript is compiled.
 *
 * Error text names variables only, never their values.
 */

const URL_VAR = "NEXT_PUBLIC_SUPABASE_URL";
const KEY_VARS = [
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string[]} one human-readable line per problem; empty when fine
 */
export function supabaseEnvProblems(env) {
  /** @type {string[]} */
  const problems = [];

  const url = env[URL_VAR];
  if (!url) {
    problems.push(`${URL_VAR} is not set.`);
  } else if (url !== url.trim()) {
    problems.push(`${URL_VAR} has leading or trailing whitespace.`);
  } else if (!isHttpUrl(url)) {
    problems.push(`${URL_VAR} is not a valid http(s) URL.`);
  }

  const keyVar = KEY_VARS.find((name) => env[name]);
  if (!keyVar) {
    problems.push(
      `Neither ${KEY_VARS[0]} nor ${KEY_VARS[1]} is set (one is required).`,
    );
  } else if (env[keyVar] !== env[keyVar]?.trim()) {
    problems.push(`${keyVar} has leading or trailing whitespace.`);
  }

  return problems;
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @throws {Error} listing every problem, when there are any
 */
export function assertSupabaseEnv(env = process.env) {
  const problems = supabaseEnvProblems(env);
  if (problems.length === 0) return;
  throw new Error(
    [
      "Supabase is not configured for this build:",
      ...problems.map((problem) => `  - ${problem}`),
      "",
      "Set them for the environment being built (Vercel: Project → Settings →",
      "Environment Variables, with this build's environment ticked; locally:",
      "apps/web/.env.local). See apps/web/.env.example.",
    ].join("\n"),
  );
}

/** @param {string} value */
function isHttpUrl(value) {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}
