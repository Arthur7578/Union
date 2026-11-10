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
import type { WeddingAccent } from "@union/shared";
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

/**
 * The wedding's stationery — the art direction of the signed-in guest hub and
 * its question-by-question forms. Ivory cotton paper, olive and sage ink, with
 * lavender and dusty blue as the accents of the paper suite.
 */
export const P = {
  paper: "#F6F3EC",
  paperDeep: "#EEE9DD",
  card: "#FBF9F4",
  ink: "#454A37",
  inkSoft: "#6B705E",
  faint: "#8E9281",
  olive: "#5D6A3E",
  oliveDeep: "#48532F",
  sage: "#A4AE8F",
  sageDeep: "#7E8A67",
  sagePale: "#E4E8DA",
  lavender: "#B8B3D1",
  lavenderPale: "#ECEAF3",
  dustyBlue: "#8EA2C1",
  ivory: "#EFE6D2",
  onOlive: "#F6F3EC",
  error: "#9A4B3A",
} as const;

/** P as CSS custom properties, set on the root of the guest hub so its
 *  stylesheet can read colours without defining any. */
export const GUEST_DA_VARS = {
  "--da-paper": P.paper,
  "--da-paper-deep": P.paperDeep,
  "--da-card": P.card,
  "--da-ink": P.ink,
  "--da-ink-soft": P.inkSoft,
  "--da-faint": P.faint,
  "--da-olive": P.olive,
  "--da-olive-deep": P.oliveDeep,
  "--da-sage": P.sage,
  "--da-sage-deep": P.sageDeep,
  "--da-sage-pale": P.sagePale,
  "--da-lavender": P.lavender,
  "--da-lavender-pale": P.lavenderPale,
  "--da-dusty-blue": P.dustyBlue,
  "--da-ivory": P.ivory,
  "--da-on-olive": P.onOlive,
  "--da-error": P.error,
  "--da-line": alpha(P.ink, 0.16),
  "--da-line-soft": alpha(P.ink, 0.09),
  "--da-shadow": alpha(P.oliveDeep, 0.14),
  "--da-scrim": alpha(P.ink, 0.38),
  "--da-glass": alpha(P.paper, 0.82),
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
/**
 * "Your colours" — the Guests hub and list (/guests, /guests/list). A neutral,
 * premium frame that takes no wedding style of its own; the couple's wedding
 * colour (weddings.accent) is the one colour it wears. See PRODUCT.md,
 * principle 5, and .impeccable/surfaces/ for the direction.
 */
export const V = {
  ground: "#F6F6F4",
  surface: "#FFFFFF",
  ink: "#1B1B1A",
  ink2: "#45443F",
  muted: "#686660",
  track: "#ECECEA",
  cant: "#C9C7C1",
  ring: "#D6D4CE",
} as const;

/** One wedding colour: `base` for fills, `deep` for text and buttons (white
 *  on it and it on `soft` both pass WCAG AA), `soft` for tinted grounds. */
export type AccentShades = { base: string; deep: string; soft: string };

/** Union's own colour when the couple hasn't picked one: graphite. */
export const NEUTRAL_ACCENT: AccentShades = { base: "#55544F", deep: "#1B1B1A", soft: "#ECECEA" };

export const ACCENTS: Record<WeddingAccent, AccentShades> = {
  sage: { base: "#7A9A7E", deep: "#3F6146", soft: "#E6EEE7" },
  terracotta: { base: "#C4673F", deep: "#9A4423", soft: "#F7E6DD" },
  dusty_blue: { base: "#7B97B5", deep: "#3F5F80", soft: "#E5ECF3" },
  navy: { base: "#2E4A72", deep: "#1F3557", soft: "#E2E8F1" },
  burgundy: { base: "#8E2D43", deep: "#74203A", soft: "#F3E1E5" },
  rose: { base: "#D08C96", deep: "#A2525E", soft: "#F8E8EA" },
  ochre: { base: "#C9963A", deep: "#85601A", soft: "#F6EDD9" },
  lilac: { base: "#9C88BE", deep: "#634F8C", soft: "#EEE9F5" },
  // base stays lighter than deep so "Maybe" reads apart from "Coming".
  black: { base: "#8C8B86", deep: "#1B1B1A", soft: "#ECECEA" },
};

export function accentShades(key: WeddingAccent | null): AccentShades {
  return key ? ACCENTS[key] : NEUTRAL_ACCENT;
}

/** The wedding colour as CSS variables, set on a page's root element. The
 *  neutral default is also in CSS_VARS, so the stylesheet always has one. */
export function accentVars(key: WeddingAccent | null): Record<string, string> {
  const a = accentShades(key);
  return {
    "--wa-base": a.base,
    "--wa-deep": a.deep,
    "--wa-soft": a.soft,
    "--wa-focus": alpha(a.deep, 0.18),
    "--wa-shadow": alpha(a.deep, 0.12),
  };
}

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

  // "Your colours" (V): the Guests hub and list, plus the wedding colour's
  // neutral default (pages override --wa-* with the couple's colour).
  "--vc-ground": V.ground,
  "--vc-surface": V.surface,
  "--vc-ink": V.ink,
  "--vc-ink-2": V.ink2,
  "--vc-muted": V.muted,
  "--vc-track": V.track,
  "--vc-ring": V.ring,
  "--vc-line": alpha(V.ink, 0.08),
  "--vc-line-strong": alpha(V.ink, 0.14),
  "--vc-hover": alpha(V.ink, 0.035),
  "--vc-shadow": alpha(V.ink, 0.05),
  "--vc-chrome": alpha(V.ground, 0.92),
  "--wa-base": NEUTRAL_ACCENT.base,
  "--wa-deep": NEUTRAL_ACCENT.deep,
  "--wa-soft": NEUTRAL_ACCENT.soft,
  "--wa-focus": alpha(NEUTRAL_ACCENT.deep, 0.18),
  "--wa-shadow": alpha(NEUTRAL_ACCENT.deep, 0.12),
} as const;
