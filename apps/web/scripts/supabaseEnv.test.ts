import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSupabaseEnv, supabaseEnvProblems } from "./supabaseEnv.mjs";

const URL_VAR = "NEXT_PUBLIC_SUPABASE_URL";
const PUBLISHABLE_VAR = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
const ANON_VAR = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

const good = {
  [URL_VAR]: "https://abc.supabase.co",
  [PUBLISHABLE_VAR]: "sb_publishable_abc",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("supabaseEnvProblems", () => {
  it("accepts a URL with a publishable key", () => {
    expect(supabaseEnvProblems(good)).toEqual([]);
  });

  it("accepts the legacy anon key on its own", () => {
    expect(
      supabaseEnvProblems({ [URL_VAR]: good[URL_VAR], [ANON_VAR]: "legacy" }),
    ).toEqual([]);
  });

  it("accepts a local Supabase URL over http", () => {
    expect(
      supabaseEnvProblems({ ...good, [URL_VAR]: "http://127.0.0.1:54321" }),
    ).toEqual([]);
  });

  it("names everything that is missing, in one pass", () => {
    const problems = supabaseEnvProblems({});
    expect(problems).toHaveLength(2);
    expect(problems.join("\n")).toContain(URL_VAR);
    expect(problems.join("\n")).toContain(PUBLISHABLE_VAR);
    expect(problems.join("\n")).toContain(ANON_VAR);
  });

  it("treats an empty string as unset, as the runtime does", () => {
    expect(supabaseEnvProblems({ ...good, [URL_VAR]: "" })).toHaveLength(1);
    expect(
      supabaseEnvProblems({ [URL_VAR]: good[URL_VAR], [PUBLISHABLE_VAR]: "" }),
    ).toHaveLength(1);
  });

  it.each([
    ["no scheme", "abc.supabase.co"],
    ["not a URL", "not a url"],
    ["wrong protocol", "ftp://abc.supabase.co"],
  ])("rejects a URL with %s", (_label, value) => {
    expect(supabaseEnvProblems({ ...good, [URL_VAR]: value })).toEqual([
      `${URL_VAR} is not a valid http(s) URL.`,
    ]);
  });

  it("rejects stray whitespace from a pasted value", () => {
    expect(
      supabaseEnvProblems({ ...good, [URL_VAR]: "https://abc.supabase.co\n" }),
    ).toEqual([`${URL_VAR} has leading or trailing whitespace.`]);
    expect(
      supabaseEnvProblems({ ...good, [PUBLISHABLE_VAR]: " sb_publishable_abc" }),
    ).toEqual([`${PUBLISHABLE_VAR} has leading or trailing whitespace.`]);
  });

  it("checks the key that actually wins, not the one that loses", () => {
    // Publishable wins; a bad anon key behind it is never read.
    expect(
      supabaseEnvProblems({ ...good, [ANON_VAR]: " padded " }),
    ).toEqual([]);
  });

  it("never puts a value in its output", () => {
    const secret = "sb_secret_do_not_print\n";
    const text = [
      ...supabaseEnvProblems({ [URL_VAR]: "ftp://leak.example", [PUBLISHABLE_VAR]: secret }),
    ].join("\n");
    expect(text).not.toContain("leak.example");
    expect(text).not.toContain("do_not_print");
  });
});

describe("assertSupabaseEnv", () => {
  it("does nothing when the environment is fine", () => {
    expect(() => assertSupabaseEnv(good)).not.toThrow();
  });

  it("throws one error listing every problem and where to fix it", () => {
    expect(() => assertSupabaseEnv({})).toThrowError(
      /Supabase is not configured for this build:[\s\S]*NEXT_PUBLIC_SUPABASE_URL is not set[\s\S]*Environment Variables[\s\S]*\.env\.local/,
    );
  });
});

/**
 * The build check and the runtime config are two files that must agree on what
 * "configured" means; if they drifted, a build could pass and ship an app that
 * shows the not-configured notice (or the reverse). Values here are all
 * well-formed, so the only thing varying is presence and precedence.
 */
describe("the build check agrees with the runtime config", () => {
  const combos: Array<Record<string, string | undefined>> = [
    {},
    { [URL_VAR]: "https://abc.supabase.co" },
    { [PUBLISHABLE_VAR]: "k" },
    { [ANON_VAR]: "k" },
    { [URL_VAR]: "https://abc.supabase.co", [PUBLISHABLE_VAR]: "k" },
    { [URL_VAR]: "https://abc.supabase.co", [ANON_VAR]: "k" },
    { [URL_VAR]: "https://abc.supabase.co", [PUBLISHABLE_VAR]: "k", [ANON_VAR]: "k2" },
    { [URL_VAR]: "", [PUBLISHABLE_VAR]: "k" },
    { [URL_VAR]: "https://abc.supabase.co", [PUBLISHABLE_VAR]: "", [ANON_VAR]: "k" },
  ];

  it.each(combos.map((env) => [JSON.stringify(env), env] as const))(
    "%s",
    async (_label, env) => {
      vi.resetModules();
      for (const name of [URL_VAR, PUBLISHABLE_VAR, ANON_VAR]) {
        vi.stubEnv(name, env[name]);
      }
      const { supabaseConfigured } = await import("../lib/supabaseConfig");
      expect(supabaseEnvProblems(env).length === 0).toBe(supabaseConfigured);
    },
  );
});

/** The real `prebuild` script, run as npm runs it. */
describe("check-supabase-env.mjs", () => {
  const script = fileURLToPath(new URL("./check-supabase-env.mjs", import.meta.url));

  function run(env: Record<string, string>) {
    // Blank, not delete: Next's loader never overrides a defined variable, so
    // an `.env.local` on the developer's machine cannot change the result.
    return spawnSync(process.execPath, [script], {
      encoding: "utf8",
      env: {
        ...process.env,
        [URL_VAR]: "",
        [PUBLISHABLE_VAR]: "",
        [ANON_VAR]: "",
        ...env,
      },
    });
  }

  it("fails the build, with the reason on stderr, when nothing is set", () => {
    const result = run({});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Supabase is not configured for this build");
    expect(result.stderr).toContain(URL_VAR);
  });

  it("passes when the values are present", () => {
    const result = run(good);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("is wired in as `prebuild`, which is what `npm run build` triggers", () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts.prebuild).toContain("check-supabase-env.mjs");
  });
});
