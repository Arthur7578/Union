// Mutation testing (docs/testing/README.md, layer 4): Stryker changes the
// logic on purpose, one small edit at a time (a `>` becomes `>=`, a condition
// becomes `true`…) and runs the unit tests. A mutant no test catches
// ("survived") marks a line whose tests would not notice a bug.
// Weekly, by .github/workflows/mutation.yml; locally:
//   npm install --no-save --legacy-peer-deps @stryker-mutator/core@10.1.1 @stryker-mutator/vitest-runner@10.1.1
//   npx stryker run
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: "vitest",
  vitest: { configFile: "apps/web/vitest.config.mts", dir: "apps/web" },
  plugins: ["@stryker-mutator/vitest-runner"],
  mutate: [
    "packages/shared/src/**/*.ts",
    "apps/web/lib/**/*.ts",
    "!**/*.test.ts",
    "!**/*.d.ts",
    "!packages/shared/src/database.types.ts",
    "!packages/shared/src/index.ts",
    "!packages/shared/src/supabase.ts",
    "!apps/web/lib/i18n/dictionaries/**",
  ],
  // Only what the unit tests need: the sandbox copy stays small.
  ignorePatterns: ["apps/mobile", "apps/web/.next", "apps/web/e2e", "supabase", "docs", "**/coverage", "reports"],
  coverageAnalysis: "perTest",
  // Static mutants (module-level constants) re-run every test and took 79 %
  // of the time on the first run (2026-11-28) for 3 % of the mutants.
  ignoreStatic: true,
  reporters: ["html", "json", "clear-text", "progress"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  timeoutMS: 20000,
  // A low score is information, not a failure: the weekly job opens an issue.
  thresholds: { high: 80, low: 60, break: null },
};
