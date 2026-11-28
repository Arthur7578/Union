#!/usr/bin/env node
// Test discipline: the rules that keep the test bank in step with the product.
// Run by .github/workflows/test-discipline.yml on every PR; method in
// docs/testing/README.md.
//
//   node .github/test-discipline/check.mjs <base-sha> <head-sha>
//
// Environment (all optional):
//   LABELS    comma-separated PR labels (escape hatches: no-e2e, no-unit, no-db-test)
//   PR_BODY   PR description: an escape label needs a line `<label>: <reason>`
//   DRAFT     "true" for a draft PR
//
// Exit code 1 when a rule fails; every failure is printed as a GitHub error.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const [base, head] = process.argv.slice(2);
if (!base || !head) {
  console.error("usage: check.mjs <base-sha> <head-sha>");
  process.exit(2);
}
const labels = new Set((process.env.LABELS ?? "").split(",").map((l) => l.trim().toLowerCase()).filter(Boolean));
const body = process.env.PR_BODY ?? "";
const draft = process.env.DRAFT === "true";
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const git = (...args) => execFileSync("git", args, { encoding: "utf8", cwd: root, maxBuffer: 64 * 1024 * 1024 });

let failed = false;
const error = (msg) => {
  failed = true;
  console.log(`::error::${msg.replace(/\n/g, "%0A")}`);
};
const notice = (msg) => console.log(`::notice::${msg.replace(/\n/g, "%0A")}`);

// ------------------------------------------------------------ the diff
// status per file (A added, M modified, D deleted, R renamed → new path)
const changes = git("diff", "--name-status", "-M", `${base}...${head}`)
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [status, ...paths] = line.split("\t");
    return { status: status[0], file: paths[paths.length - 1] };
  });

/** Added lines of a file that are more than blank lines or comments. */
function substantiveAdditions(file) {
  const diff = git("diff", "-U0", `${base}...${head}`, "--", file);
  return diff
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .map((l) => l.slice(1).trim())
    .filter((l) => l && !/^(\/\/|\/\*|\*|--|#)/.test(l));
}
const touched = (re) => changes.filter((c) => c.status !== "D" && re.test(c.file) && substantiveAdditions(c.file).length > 0);

/** An escape label counts only with a reason in the PR description. */
function escaped(label, what) {
  if (!labels.has(label)) return false;
  const reason = body.split("\n").find((l) => l.toLowerCase().replace(/[`*]/g, "").trim().startsWith(`${label}:`));
  if (!reason || reason.split(":").slice(1).join(":").trim().length < 10) {
    error(`The label ${label} is set but the PR description has no line "${label}: <reason>" (at least 10 characters) saying why this cannot change behaviour.`);
    return true;
  }
  notice(`${what}: allowed by the ${label} label (${reason.trim()}).`);
  return true;
}

const isTest = (f) => /\.(test|spec)\.(ts|tsx|mts)$/.test(f);
const list = (files) => files.map((c) => `  ${c.file}`).join("\n");

// ------------------------------------------------- rule 1: screens → e2e
const ui = touched(/^apps\/web\/(app|components)\/.*\.tsx$/).filter((c) => !isTest(c.file));
const e2e = touched(/^apps\/web\/e2e\/.*\.ts$/);
if (ui.length && !e2e.length && !escaped("no-e2e", "Screens changed without a browser test")) {
  error(
    `This PR changes screens but adds no test code in apps/web/e2e (comments and blank lines do not count). ` +
      `Add or update the browser test of the flow it touches, or add the label no-e2e with a reason.\n${list(ui)}`,
  );
}

// ------------------------------------------ rule 2: logic → unit tests
// Pure logic: the shared package, the web app's lib, and non-component code
// under app/ (route handlers, server actions, helpers).
const logic = touched(/^(packages\/shared\/src\/.*\.ts|apps\/web\/lib\/.*\.tsx?|apps\/web\/app\/.*\.ts)$/).filter(
  (c) => !isTest(c.file) && !/(database\.types|\/index|\/supabase)\.ts$/.test(c.file) && !/\.d\.ts$/.test(c.file),
);
const unit = touched(/\.test\.(ts|tsx)$/);
if (logic.length && !unit.length && !escaped("no-unit", "Logic changed without a unit test")) {
  error(
    `This PR changes logic but adds no unit test code (*.test.ts / *.test.tsx). ` +
      `Add a vitest test for the behaviour it changes, or add the label no-unit with a reason.\n${list(logic)}`,
  );
}

// -------------------------------------- rule 3: migration → pgTAP test
const migrations = changes.filter((c) => c.status === "A" && /^supabase\/migrations\/.*\.sql$/.test(c.file));
const pgtap = touched(/^supabase\/tests\/database\/.*\.sql$/);
if (migrations.length && !pgtap.length && !escaped("no-db-test", "Migration without a database test")) {
  error(
    `This PR adds a migration but no pgTAP test in supabase/tests/database (CLAUDE.md, "Database migrations"). ` +
      `Cover the allowed and the denied path.\n${list(migrations)}`,
  );
}

// ------------------------- rule 4: every screen is in the flow inventory
// Checked on the whole tree, not the diff: the inventory must stay complete.
const FLOWS = "docs/testing/flows.md";
const flowsText = existsSync(path.join(root, FLOWS)) ? readFileSync(path.join(root, FLOWS), "utf8") : "";
if (!flowsText) error(`${FLOWS} is missing: it lists every screen and the tests that cover it.`);

function walk(dir) {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}
const routes = walk("apps/web/app")
  .filter((f) => /\/page\.tsx$/.test(f))
  .map((f) =>
    ("/" + path.dirname(path.relative("apps/web/app", f)))
      .split("/")
      .filter((seg) => !/^\(.*\)$/.test(seg) && seg !== ".")
      .join("/") || "/",
  )
  .map((r) => (r.startsWith("/") ? r : "/" + r));
if (flowsText) {
  const listed = new Set([...flowsText.matchAll(/^\|\s*`([^`]+)`/gm)].map((m) => m[1]));
  const missing = [...new Set(routes)].filter((r) => !listed.has(r)).sort();
  if (missing.length) {
    error(
      `These screens are not in ${FLOWS}. Add a row for each (its flows, the tests that cover them, or "not covered" with an issue):\n` +
        missing.map((r) => `  ${r}`).join("\n"),
    );
  }
  const gone = [...listed].filter((r) => r.startsWith("/") && !routes.includes(r));
  if (gone.length) error(`${FLOWS} lists screens that no longer exist:\n${gone.map((r) => `  ${r}`).join("\n")}`);
}

// ------------------- rule 5: files named in the test maps really exist
const specFiles = existsSync(path.join(root, "docs/specs"))
  ? readdirSync(path.join(root, "docs/specs"))
      .map((d) => `docs/specs/${d}/tests.md`)
      .filter((f) => existsSync(path.join(root, f)))
  : [];
const testMaps = [...specFiles, ...(flowsText ? [FLOWS] : [])];
const testPathRe = /`((?:apps|packages|supabase)\/[^`\s]+\.(?:test\.tsx?|spec\.ts|test\.sql))`/g;
for (const map of testMaps) {
  const text = readFileSync(path.join(root, map), "utf8");
  for (const [, file] of text.matchAll(testPathRe)) {
    if (!existsSync(path.join(root, file))) error(`${map} names ${file}, which does not exist.`);
  }
}

// --------- rule 6: test names quoted in a spec's tests.md really exist
// The table of a tests.md (lines starting with "|") quotes test names, often
// shortened with "…". Each quoted piece of 12 characters or more must appear
// in a test file. Quotes outside the table (design references) are free.
const testFiles = git("ls-files", "*.test.ts", "*.test.tsx", "*.spec.ts", "*.test.sql")
  .split("\n")
  .filter(Boolean);
const normalize = (s) => s.replace(/\\(['"`])/g, "$1").replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
const corpus = normalize(testFiles.map((f) => readFileSync(path.join(root, f), "utf8")).join("\n"));
for (const map of specFiles) {
  const text = readFileSync(path.join(root, map), "utf8")
    .split("\n")
    .filter((l) => l.trimStart().startsWith("|"))
    .join("\n");
  const missing = [];
  for (const [, quoted] of text.matchAll(/"([^"\n]{12,})"/g)) {
    for (const piece of normalize(quoted).split("…").map((p) => p.trim())) {
      if (piece.length >= 12 && !corpus.includes(piece)) missing.push(piece);
    }
  }
  if (missing.length) {
    error(
      `${map} quotes tests that no test file contains (renamed or never written?):\n` +
        [...new Set(missing)].map((m) => `  "${m}"`).join("\n"),
    );
  }
}

// --------------------------------- rule 7: no squad prototype ships
if (!draft && git("ls-tree", "-r", "--name-only", head).split("\n").some((f) => f.startsWith("apps/web/public/squad-proto/"))) {
  error("Remove apps/web/public/squad-proto/ before marking the PR ready: prototypes must not ship.");
}

if (!failed) console.log("Test discipline: all rules pass.");
process.exit(failed ? 1 : 0);
