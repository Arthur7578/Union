/**
 * Union design tokens.
 *
 * A single source of truth for colors, spacing, typography and radii.
 * Re-skin here (and the shared components consume it) once the final
 * Claude Design assets are provided — screens read tokens, not raw values.
 */

export const colors = {
  background: "#FBF7F4", // warm ivory
  surface: "#FFFFFF",
  surfaceAlt: "#F3EBE4",
  text: "#2B2724", // near-black espresso
  textMuted: "#8A817C",
  border: "#E7DED6",
  primary: "#B5896F", // warm rose-gold / taupe
  primaryDark: "#9A6F58",
  primaryContrast: "#FFFFFF",
  success: "#4E8D6E",
  successBg: "#E4F0EA",
  danger: "#C0553B",
  dangerBg: "#F7E6E1",
  warning: "#C9962F",
  warningBg: "#F7EED8",
  overlay: "rgba(43, 39, 36, 0.45)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 34,
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

/**
 * Minimum interactive target size (Rule 3: large tap zones for mobile).
 * Apple HIG recommends >= 44pt; we use 48 for comfort.
 */
export const MIN_TOUCH = 48;

export const theme = {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  MIN_TOUCH,
} as const;

export type Theme = typeof theme;
