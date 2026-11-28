#!/usr/bin/env node
// Diff coverage: of the logic lines a PR adds or changes, how many do the unit
// tests run? A global percentage says nothing about what is new; this does.
//
//   node .github/test-discipline/diff-coverage.mjs <base-sha> <head-sha> [lcov]
//
// lcov defaults to apps/web/coverage/lcov.info (vitest run --coverage in
// apps/web). Logic files: the same set as rule 2 of check.mjs. Only lines the
// coverage tool counts as executable are measured.
//
// Environment: MIN_DIFF_COVERAGE (percent, default 80), DIFF_COVERAGE_MODE
// (`warn`, the default, or `block`), LABELS (no-unit skips the threshold),
// GITHUB_STEP_SUMMARY (a table is appended when set).
//
// Starts in `warn`: data-access modules (Supabase calls) are covered by the
// browser tests, not by unit tests, and would trip the threshold. Switch the
// repository variable DIFF_COVERAGE_MODE to `block` once a few weeks of
// reports show the threshold is fair (docs/testing/README.md).

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const [base, head, lcovArg] = process.argv.slice(2);
if (!base || !head) {
  console.error("usage: diff-coverage.mjs <base-sha> <head-sha> [lcov]");
  process.exit(2);
}
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const lcovPath = path.resolve(root, lcovArg ?? "apps/web/coverage/lcov.info");
const lcovDir = path.dirname(path.dirname(lcovPath)); // apps/web
const min = Number(process.env.MIN_DIFF_COVERAGE || 80);
const block = process.env.DIFF_COVERAGE_MODE === "block";
const labels = new Set((process.env.LABELS ?? "").split(",").map((l) => l.trim().toLowerCase()));
const git = (...args) => execFileSync("git", args, { encoding: "utf8", cwd: root, maxBuffer: 64 * 1024 * 1024 });

const isLogic = (f) =>
  /^(packages\/shared\/src\/.*\.ts|apps\/web\/lib\/.*\.tsx?|apps\/web\/app\/.*\.ts)$/.test(f) &&
  !/\.(test|spec)\.(ts|tsx)$/.test(f) &&
  !/(database\.types|\/index|\/supabase)\.ts$/.test(f) &&
  !/\.d\.ts$/.test(f);

// ------------------------------------------- lines added per logic file
const added = new Map(); // repo path → Set(line numbers in head)
let current = null;
for (const line of git("diff", "-U0", `${base}...${head}`).split("\n")) {
  if (line.startsWith("+++ ")) {
    const f = line.slice(4).replace(/^b\//, "");
    current = f !== "/dev/null" && isLogic(f) ? f : null;
    if (current) added.set(current, new Set());
    continue;
  }
  const hunk = current && line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
  if (hunk) {
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    for (let i = 0; i < count; i++) added.get(current).add(start + i);
  }
}
if (![...added.values()].some((s) => s.size)) {
  console.log("Diff coverage: no logic line changed.");
  process.exit(0);
}

// ------------------------------------------------------------ the lcov
if (!existsSync(lcovPath)) {
  console.log(`::error::No coverage report at ${path.relative(root, lcovPath)}: run vitest with --coverage first.`);
  process.exit(1);
}
const hits = new Map(); // repo path → Map(line → count)
let file = null;
for (const line of readFileSync(lcovPath, "utf8").split("\n")) {
  if (line.startsWith("SF:")) {
    file = path.relative(root, path.resolve(lcovDir, line.slice(3)));
    hits.set(file, new Map());
  } else if (line.startsWith("DA:") && file) {
    const [n, count] = line.slice(3).split(",").map(Number);
    hits.get(file).set(n, Math.max(count, hits.get(file).get(n) ?? 0));
  }
}

// -------------------------------------------------------------- report
const rows = [];
let total = 0;
let covered = 0;
for (const [f, lines] of added) {
  const fileHits = hits.get(f);
  // A logic file no test ever loads: every added line counts as missed.
  const executable = fileHits ? [...lines].filter((n) => fileHits.has(n)) : [...lines];
  if (!executable.length) continue;
  const missed = executable.filter((n) => !fileHits || fileHits.get(n) === 0);
  total += executable.length;
  covered += executable.length - missed.length;
  rows.push({ f, executable: executable.length, missed, loaded: Boolean(fileHits) });
}
if (!total) {
  console.log("Diff coverage: the changed logic lines hold no executable code.");
  process.exit(0);
}
const pct = Math.round((covered / total) * 1000) / 10;
const ranges = (ns) =>
  ns
    .sort((a, b) => a - b)
    .reduce((acc, n) => {
      const last = acc[acc.length - 1];
      if (last && n === last[1] + 1) last[1] = n;
      else acc.push([n, n]);
      return acc;
    }, [])
    .map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`))
    .join(", ");

const table = [
  `### Diff coverage: ${pct}% of ${total} changed logic lines run by a unit test (minimum ${min}%)`,
  "",
  "| File | Changed lines | Not run by any test |",
  "|---|---|---|",
  ...rows.map((r) => `| \`${r.f}\` | ${r.executable} | ${r.loaded ? ranges(r.missed) || "—" : "file never loaded by a test"} |`),
  "",
].join("\n");
console.log(table);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, table + "\n");

if (pct < min) {
  if (labels.has("no-unit")) {
    console.log(`::notice::Diff coverage ${pct}% is under ${min}%, allowed by the no-unit label.`);
  } else {
    console.log(
      `::${block ? "error" : "warning"}::Only ${pct}% of the logic lines this PR changes are run by a unit test (minimum ${min}%). ` +
        "Add tests for the lines listed in the job summary, or the label no-unit with a reason in the PR.",
    );
    if (block) process.exit(1);
  }
}
