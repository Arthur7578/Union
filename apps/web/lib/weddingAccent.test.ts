import { describe, expect, it } from "vitest";
import { WEDDING_ACCENTS, parseWeddingAccent } from "@union/shared";
import { ACCENTS, NEUTRAL_ACCENT, accentVars, V } from "@/lib/theme";

/** WCAG relative luminance contrast between two #RRGGBB colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("parseWeddingAccent", () => {
  it("keeps a preset and turns anything else into the neutral default", () => {
    expect(parseWeddingAccent("terracotta")).toBe("terracotta");
    expect(parseWeddingAccent("#ff0000")).toBeNull();
    expect(parseWeddingAccent(null)).toBeNull();
  });
});

describe("wedding colours", () => {
  it("has shades for every preset the database accepts", () => {
    expect(Object.keys(ACCENTS).sort()).toEqual([...WEDDING_ACCENTS].sort());
  });

  // Every colour a couple can pick keeps the screen readable: white text on
  // the button, the colour as text on its own tint and on the page.
  for (const [key, a] of [["neutral", NEUTRAL_ACCENT], ...Object.entries(ACCENTS)] as const) {
    it(`${key} passes WCAG AA for text`, () => {
      expect(contrast(V.surface, a.deep)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(a.deep, a.soft)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(a.deep, V.ground)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("falls back to the neutral colour when none is picked", () => {
    expect(accentVars(null)["--wa-deep"]).toBe(NEUTRAL_ACCENT.deep);
    expect(accentVars("navy")["--wa-deep"]).toBe(ACCENTS.navy.deep);
  });
});
