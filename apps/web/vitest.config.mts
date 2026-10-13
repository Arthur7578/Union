import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

/** `@/…` is the app's own import prefix (see tsconfig paths); vitest needs to
 *  be told about it separately, and the page tests import through it. */
const appRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: /^@\//, replacement: appRoot }],
  },
  test: {
    // Server components are awaited and inspected as element trees rather
    // than rendered, so no DOM is needed.
    environment: "node",
    // Browser tests run under Playwright (`npm run e2e`), not here.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
