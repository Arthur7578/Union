import expo from "eslint-config-expo/flat.js";

const config = [
  {
    ignores: [
      "node_modules/",
      ".expo/",
      "dist/",
      "web-build/",
      ".next/",
      ".vercel/",
      "**/*.tsbuildinfo",
    ],
  },
  ...expo,
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default config;
