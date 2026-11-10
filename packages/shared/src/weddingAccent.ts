/**
 * The couple's wedding colour (weddings.accent): one of a fixed set of
 * presets, or null for Union's neutral default. Presets rather than a free
 * colour so every one ships with shades that keep text readable; the web
 * app maps each key to its colours (apps/web/lib/theme.ts).
 */
export const WEDDING_ACCENTS = [
  "sage",
  "terracotta",
  "dusty_blue",
  "navy",
  "burgundy",
  "rose",
  "ochre",
  "lilac",
  "black",
] as const;

export type WeddingAccent = (typeof WEDDING_ACCENTS)[number];

/** A stored value as a preset key, or null (the neutral default) for
 *  anything unknown. */
export function parseWeddingAccent(value: string | null | undefined): WeddingAccent | null {
  return (WEDDING_ACCENTS as readonly string[]).includes(value ?? "")
    ? (value as WeddingAccent)
    : null;
}
