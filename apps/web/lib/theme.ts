/**
 * Union design tokens — ported from the Claude Design assets (Union · iOS).
 * Warm editorial palette: Cormorant Garamond headings + Instrument Sans body,
 * ink #43353A on cream, with a rosewood accent.
 *
 * Used for inline styles across the web app so the whole look can be
 * re-skinned from one place. `T` is the signed-in planning app; `G` is the
 * separate cream-and-espresso palette of the public guest-facing pages (RSVP,
 * guest portal, join flow).
 *
 * Convention: no inline hex in app code — a colour belongs here. ESLint
 * (`no-restricted-syntax`, see eslint.config.mjs) fails on hex literals
 * everywhere except this file. Before adding a token, look for an existing one
 * within a few units per channel and use that instead of minting a near-duplicate.
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
  white: "#FFFFFF",
  border: "#E7DED6",
  cream: "#F7F1EC",
  blush: "#F8EDEA",
  heroGradient: "linear-gradient(158deg,#F8EDEA 0%,#F2E1E0 100%)",

  // Warm tan highlight (selected / hovered rows) and the dark scrim behind modals
  tan: "#E0CCB1",
  tanSoft: "rgba(224,204,177,.35)",
  scrim: "#140F0F",

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
  violetInk: "#7A6690",
  violetBg: "#EEE7F0",
  amberDeep: "#9A5B23",
  mauve: "#8A6F74",
  roseSoft: "#C7A9A2",
  danger: "#C0553B",
  dangerBg: "#F7E6E1",

  // Glyphs, dots and inactive icons (chevrons, tab icons, sand swatch ring)
  taupe: "#CBBCB6",

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
  // Faire-Part Envelope & Gold Wax Seal
  forestDark: "#0D1614",
  forestDeep: "#1C2B26",
  forestMid: "#182823",
  forestLight: "#1A2A25",
  forestFlap: "#121E1A",
  goldLight: "#F7E5A9",
  goldAccent: "#D4AF37",
  goldMuted: "#C5A059",
  goldDark: "#8A6D23",
  goldDeep: "#594411",
  goldRim: "#EED48F",
  goldEmblem: "#3B2B0B",
  goldText: "#E6D7B8",
  goldSubtext: "#A3B8B0",
  cardGoldBorder: "#E5D2A8",
  cardGoldSub: "#8C734B",
  cardBgTop: "#FCFAEE",
  cardBgBottom: "#F4EEDD",
  cardInk: "#2C2621",
  cardTitle: "#2B231D",
  cardText: "#4A3E36",
  cardSubtext: "#736356",
  cardNote: "#66574D",
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
  accentLight: "#F7E6E8",
  faint: "#968B84",
  pendingInk: "#B8860B",
  disabledBg: "#F2F2F2",
  disabledInk: "#999999",
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

/**
 * CSS custom properties for the stylesheet. `app/layout.tsx` sets these on
 * <html>, so `globals.css` reads `var(--…)` and carries no colour literals —
 * theme.ts stays the only place a colour is defined (lib/theme.test.ts fails
 * if globals.css reintroduces one or references an undefined variable).
 *
 * The first block is the public RSVP page's vocabulary (the page that renders
 * with the `.card` / `.btn` classes); the guest portal re-declares a few of
 * these locally. The second block is the app shell and form chrome.
 */
export const CSS_VARS = {
  "--bg": T.bg,
  "--surface": T.surface,
  "--text": T.ink,
  "--muted": G.muted,
  "--border": T.border,
  "--primary": T.accent,
  "--primary-dark": T.accentInk,
  "--success": T.greenInk,
  "--success-bg": T.greenBg,
  "--danger": T.danger,
  "--danger-bg": T.dangerBg,

  "--white": T.white,
  "--label": T.label,
  "--bg-top": T.bgTop,
  "--bg-bottom": T.bgBottom,
  "--tabbar-bg": alpha(T.bg, 0.92),
  "--tabbar-line": alpha(T.ink, 0.06),
  "--sidebar-bg": alpha(T.bg, 0.7),
  "--sidebar-line": alpha(T.ink, 0.08),
  "--card-shadow": alpha(G.ink, 0.06),
  "--focus-ring": alpha(T.accent, 0.16),
} as const;
