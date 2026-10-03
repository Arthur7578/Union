import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// Colours live in lib/theme.ts (see the header there). Hex and rgb()/hsl()
// literals anywhere else — in strings, JSX attributes or template literals
// such as <style> blocks — fail lint so the theme stays the single source.
const COLOUR =
  "(?:#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9A-Za-z_-])|\\b(?:rgb|rgba|hsl|hsla)\\()";
const NO_INLINE_COLOUR = `Use a token from lib/theme.ts (T for the app, G for guest pages) instead of an inline colour — alpha(T.ink, 0.1) for a translucent one. If no token is close, add one there.`;

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
        { selector: `TemplateElement[value.raw=/${COLOUR}/]`, message: NO_INLINE_COLOUR },
      ],
    },
  },
];

export default config;
