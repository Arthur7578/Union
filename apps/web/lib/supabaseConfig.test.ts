import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const webRoot = fileURLToPath(new URL("..", import.meta.url));

/** Re-evaluates the module under a given environment; it reads `process.env`
 *  once at import, like the real bundles do. */
async function loadConfig(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  return import("./supabaseConfig");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("supabaseConfig", () => {
  const unset = {
    NEXT_PUBLIC_SUPABASE_URL: undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    SUPABASE_URL: undefined,
  };

  it("uses the configured project when the public env vars are set", async () => {
    const config = await loadConfig({
      ...unset,
      NEXT_PUBLIC_SUPABASE_URL: "https://mine.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_mine",
    });
    expect(config.SUPABASE_URL).toBe("https://mine.supabase.co");
    expect(config.SUPABASE_PUBLISHABLE_KEY).toBe("sb_publishable_mine");
  });

  it("ignores a server-only SUPABASE_URL the browser could never see", async () => {
    const withServerOnly = await loadConfig({
      ...unset,
      SUPABASE_URL: "https://server-only.supabase.co",
    });
    const withoutIt = await loadConfig(unset);
    expect(withServerOnly.SUPABASE_URL).toBe(withoutIt.SUPABASE_URL);
    expect(withServerOnly.SUPABASE_URL).not.toContain("server-only");

    const withBoth = await loadConfig({
      ...unset,
      SUPABASE_URL: "https://server-only.supabase.co",
      NEXT_PUBLIC_SUPABASE_URL: "https://public.supabase.co",
    });
    expect(withBoth.SUPABASE_URL).toBe("https://public.supabase.co");
  });

  it("prefers the publishable key over the legacy anon key", async () => {
    const both = await loadConfig({
      ...unset,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_new",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "legacy-anon",
    });
    expect(both.SUPABASE_PUBLISHABLE_KEY).toBe("sb_publishable_new");

    const legacyOnly = await loadConfig({
      ...unset,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "legacy-anon",
    });
    expect(legacyOnly.SUPABASE_PUBLISHABLE_KEY).toBe("legacy-anon");
  });

  it("falls back to a usable default project when nothing is set", async () => {
    const config = await loadConfig(unset);
    expect(config.SUPABASE_URL).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co$/);
    expect(config.SUPABASE_PUBLISHABLE_KEY).toMatch(/^sb_publishable_/);
  });
});

/**
 * The hardcoded fallback spread from three files to five before anyone
 * noticed, and each copy drifted in precedence from the others. Keep it to the
 * one module that owns it.
 */
describe("Supabase project selection stays in one place", () => {
  const configFile = join(webRoot, "lib", "supabaseConfig.ts");

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return entry.name === "node_modules" || entry.name === ".next"
          ? []
          : sourceFiles(path);
      }
      return /\.(ts|tsx|mts)$/.test(entry.name) &&
        !/\.test\.(ts|tsx)$/.test(entry.name) &&
        path !== configFile
        ? [path]
        : [];
    });
  }

  const files = sourceFiles(webRoot).map((path) => ({
    name: relative(webRoot, path),
    text: readFileSync(path, "utf8"),
  }));

  it("scans the app's source", () => {
    // Guards the guard: an empty scan would make the checks below pass
    // vacuously if the directory layout ever changed.
    expect(files.length).toBeGreaterThan(20);
  });

  it("hardcodes no project URL or publishable key outside supabaseConfig", () => {
    const offenders = files
      .filter(({ text }) => /[a-z0-9]{15,}\.supabase\.co|sb_publishable_/.test(text))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  it("reads no Supabase URL or key from process.env outside supabaseConfig", () => {
    // SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY are server-only secrets
    // with no browser counterpart, so they are legitimately read elsewhere.
    const offenders = files
      .filter(({ text }) =>
        /process\.env\.(NEXT_PUBLIC_)?SUPABASE_(URL|ANON_KEY|PUBLISHABLE_KEY)\b/.test(
          text,
        ),
      )
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });
});
