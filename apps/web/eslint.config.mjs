import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// Colours live in lib/theme.ts (see the header there). Colour literals
// anywhere else — in strings, JSX attributes or template literals such as
// <style> blocks — fail lint so the theme stays the single source:
//   * hex, and rgb()/hsl()/lab()/oklch()/color-mix()/color() functions;
//   * named colours (`white`), as a whole value, after solid/dashed/dotted,
//     or in a color/background/border/… declaration inside CSS text.
// Deliberately allowed: `transparent`, `currentColor`, `inherit` (no hue), and
// the words "green"/"blue", which components use as tone keys (tone="green")
// and a literal-only rule cannot tell apart from the CSS colours.
const NAMED =
  "white|black|gr[ae]y|silver|maroon|red|purple|fuchsia|lime|olive|yellow|navy|teal|aqua|orange|pink|brown|gold|beige|ivory|salmon|coral|crimson|tomato|violet|indigo|cyan|magenta";
const COLOUR_FN = "(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color-mix|color)\\(";
const COLOUR = `(?:#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9A-Za-z_-])|\\b${COLOUR_FN})`;
const NAMED_AFTER_BORDER_STYLE = `\\b(?:solid|dashed|dotted)\\s+(?:${NAMED})\\b`;
const NAMED_IN_DECLARATION = `(?:color|background|border[\\w-]*|fill|stroke|outline[\\w-]*|shadow)\\s*:[^;{}]*\\b(?:${NAMED})\\b`;
const NO_INLINE_COLOUR = `Use a token from lib/theme.ts (T for the app, G for guest pages) instead of an inline colour — T.white for white, alpha(T.ink, 0.1) for a translucent one. If no token is close, add one there.`;

const config = [
  { ignores: [".next/", "node_modules/", "public/sw.js"] },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@next/next/no-img-element": "off",
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    ignores: ["lib/theme.ts", "**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=/${COLOUR}/]`, message: NO_INLINE_COLOUR },
        { selector: `Literal[value=/^(?:${NAMED})$/]`, message: NO_INLINE_COLOUR },
        { selector: `Literal[value=/${NAMED_AFTER_BORDER_STYLE}/]`, message: NO_INLINE_COLOUR },
        { selector: `TemplateElement[value.raw=/${COLOUR}/]`, message: NO_INLINE_COLOUR },
        { selector: `TemplateElement[value.raw=/${NAMED_AFTER_BORDER_STYLE}/]`, message: NO_INLINE_COLOUR },
        { selector: `TemplateElement[value.raw=/${NAMED_IN_DECLARATION}/]`, message: NO_INLINE_COLOUR },
      ],
    },
  },
];

export default config;
