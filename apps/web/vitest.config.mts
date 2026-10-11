import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/** `@/…` is the app's own import prefix (see tsconfig paths); vitest needs to
 *  be told about it separately, and the page tests import through it. */
const appRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: /^@\//, replacement: appRoot }],
  },
  test: {
    // Playwright specs live in e2e/ and run with `npm run test:e2e`.
    exclude: ["**/node_modules/**", "e2e/**"],
    // Server components are awaited and inspected as element trees rather
    // than rendered, so no DOM is needed.
    environment: "node",
  },
});
