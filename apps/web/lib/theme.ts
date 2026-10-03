/**
 * Union design tokens — ported from the Claude Design assets (Union · iOS).
 * Warm editorial palette: Cormorant Garamond headings + Instrument Sans body,
 * ink #43353A on cream, with a rosewood accent.
 *
 * Used for inline styles across the web app so the whole look can be
 * re-skinned from one place. `T` is the signed-in planning app; `G` is the
 * separate, cooler palette of the public guest-facing pages (RSVP, guest
 * portal, join flow).
 *
 * Convention: a colour used more than once belongs here, not inline. Values
 * are never merged silently — near-duplicates stay distinct tokens (or stay
 * raw) until a design decision collapses them.
 */
export const T = {
  // Ink + text
  ink: "#43353A",
  ink2: "#5C4B50",
  muted: "#6E5E62",
  muted2: "#8A7A7E",
  faint: "#9A8A8F",
  label: "#BBACA5",
  labelInk: "#BBADA6",

  // Surfaces
  bg: "#FAF5F1",
  bgTop: "#F2ECE5",
  bgBottom: "#E7DDD3",
  surface: "#FFFCFA",
  surfaceAlt: "#FBFAF8",
  heroGradient: "linear-gradient(158deg,#F8EDEA 0%,#F2E1E0 100%)",

  // Hairlines
  line: "rgba(67,53,58,.07)",
  line2: "rgba(67,53,58,.09)",
  line3: "rgba(67,53,58,.12)",

  // Accent (rosewood)
  accent: "#B07C82",
  accentInk: "#9A626A",
  accentSoft: "rgba(176,124,130,.13)",
  accentBorder: "rgba(176,124,130,.3)",
  accentPink: "#F2E1E0",

  // Semantic
  green: "#7E9A82",
  greenInk: "#6E8A72",
  greenDeep: "#5E7A63",
  greenBg: "#E7EFE6",
  amber: "#C1895E",
  amberInk: "#B07C48",
  amberBg: "#FBEEE2",
  rose: "#9A7A72",
  roseBg: "#F1E7E3",
  sand: "#A99A90",
  sandBg: "#EFE7DF",
  blueInk: "#5C648A",
  blueBg: "#E4E7EE",
  danger: "#C0553B",
  dangerBg: "#F7E6E1",

  // Glyphs
  chevron: "#CBBCB6",
  stone: "#C1B4AD",

  // Swatch rings — pair with the *Bg tones above (guest groups, seating)
  blushBg: "#EEDCDF",
  ringRose: "#C79BA0",
  ringSage: "#A9C0AC",
  ringAmber: "#DDB27C",
  ringSlate: "#A6ACC0",

  // Type — resolves to the self-hosted next/font families (see app/layout.tsx),
  // with graceful system fallbacks.
  serif:
    "var(--font-serif), 'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  sans: "var(--font-sans), 'Instrument Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
} as const;

/**
 * Guest-facing palette — the public RSVP page, guest portal and join flow.
 * Cream paper and espresso ink, deliberately separate from the app's `T`.
 */
export const G = {
  bg: "#F4F1EA",
  card: "#FCFBFA",
  field: "#FBFBF8",
  ink: "#2B2724",
  ink2: "#4F4742",
  muted: "#8A817C",
  muted2: "#756B65",
  muted3: "#6F655F",
  gold: "#9A7D66",
  border: "#E1DEC3",
  borderInput: "#D8D0C8",
  rosePale: "#FDF2F4",
  okBg: "#EAF5EC",
  errBg: "#FFF1ED",
  errBorder: "#F0C6B9",
  errInk: "#8C3F2F",
} as const;

/** hex + alpha -> rgba() string (for accent tints computed at runtime). */
export function alpha(hex: string, a: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}
