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
    expect(config.supabaseConfigured).toBe(true);
  });

  it("ignores a server-only SUPABASE_URL the browser could never see", async () => {
    const onlyServerSide = await loadConfig({
      ...unset,
      SUPABASE_URL: "https://server-only.supabase.co",
    });
    expect(onlyServerSide.SUPABASE_URL).toBe("");

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

  it("has no built-in project: nothing set means unconfigured", async () => {
    const config = await loadConfig(unset);
    expect(config.SUPABASE_URL).toBe("");
    expect(config.SUPABASE_PUBLISHABLE_KEY).toBe("");
    expect(config.supabaseConfigured).toBe(false);
  });

  it("is configured only when both the URL and a key are present", async () => {
    const urlOnly = await loadConfig({
      ...unset,
      NEXT_PUBLIC_SUPABASE_URL: "https://mine.supabase.co",
    });
    expect(urlOnly.supabaseConfigured).toBe(false);

    const keyOnly = await loadConfig({
      ...unset,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_mine",
    });
    expect(keyOnly.supabaseConfigured).toBe(false);
  });
});

/**
 * The hardcoded fallback spread from three files to five before anyone
 * noticed, and each copy drifted in precedence from the others. Keep the
 * decision in the one module that owns it.
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
        !/\.test\.(ts|tsx)$/.test(entry.name)
        ? [path]
        : [];
    });
  }

  const files = sourceFiles(webRoot).map((path) => ({
    name: relative(webRoot, path),
    path,
    text: readFileSync(path, "utf8"),
  }));

  it("scans the app's source", () => {
    // Guards the guard: an empty scan would make the checks below pass
    // vacuously if the directory layout ever changed.
    expect(files.length).toBeGreaterThan(20);
  });

  it("hardcodes no project URL or publishable key anywhere", () => {
    const offenders = files
      .filter(({ text }) => /[a-z0-9]{15,}\.supabase\.co|sb_publishable_/.test(text))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  it("reads no Supabase URL or key from process.env outside supabaseConfig", () => {
    // SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY are server-only secrets
    // with no browser counterpart, so they are legitimately read elsewhere.
    const offenders = files
      .filter(({ path }) => path !== configFile)
      .filter(({ text }) =>
        /process\.env\.(NEXT_PUBLIC_)?SUPABASE_(URL|ANON_KEY|PUBLISHABLE_KEY)\b/.test(
          text,
        ),
      )
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  it("guards on supabaseConfigured from the plain config module, never a client one", () => {
    // Imported from the "use client" supabaseClient module, the server layouts'
    // guard silently never fired. A `"use client"` file must not export it.
    const clientModulesExporting = files
      .filter(({ text }) => /^\s*"use client"/.test(text))
      .filter(({ text }) => /export (const|function) supabaseConfigured\b/.test(text))
      .map(({ name }) => name);
    expect(clientModulesExporting).toEqual([]);

    const importers = files.filter(({ text }) => /\bsupabaseConfigured\b/.test(text) && /^import/m.test(text));
    const wrongSource = importers
      .filter(({ text }) =>
        /import\s*\{[^}]*\bsupabaseConfigured\b[^}]*\}\s*from\s*"(?!@\/lib\/supabaseConfig")/.test(text),
      )
      .map(({ name }) => name);
    expect(wrongSource).toEqual([]);
  });
});
