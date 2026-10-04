import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CSS_VARS } from "@/lib/theme";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

/** Variables that come from somewhere other than CSS_VARS: next/font sets
 *  these on <html> through the font classNames in app/layout.tsx. */
const PROVIDED_ELSEWHERE = new Set(["--font-serif", "--font-sans"]);

describe("globals.css", () => {
  it("carries no colour literals — colours come from lib/theme.ts", () => {
    const literals = css.match(
      /#[0-9a-fA-F]{3,8}(?![0-9A-Za-z_-])|\b(?:rgb|rgba|hsl|hsla|oklch|color-mix)\(/g,
    );
    expect(literals).toBeNull();
  });

  it("only reads custom properties that are defined", () => {
    const used = new Set(
      [...css.matchAll(/var\((--[a-zA-Z0-9-]+)/g)].map((m) => m[1]),
    );
    const undefinedVars = [...used].filter(
      (name) => !(name in CSS_VARS) && !PROVIDED_ELSEWHERE.has(name),
    );
    expect(undefinedVars).toEqual([]);
  });
});

describe("CSS_VARS", () => {
  it("resolves every variable to a concrete colour", () => {
    for (const [name, value] of Object.entries(CSS_VARS)) {
      expect(value, name).toMatch(/^(#[0-9A-Fa-f]{6}|rgba\([\d.,\s]+\))$/);
    }
  });
});
