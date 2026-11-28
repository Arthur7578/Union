// Tests of check.mjs on throwaway git repositories.
// Run: node --test .github/test-discipline/*.test.mjs (CI: test-discipline.yml).
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const CHECK = path.join(import.meta.dirname, "check.mjs");

/** A repo with one screen listed in flows.md; `change` writes the PR's files. */
function prRepo(change) {
  const dir = mkdtempSync(path.join(tmpdir(), "discipline-"));
  const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  const write = (file, text) => {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), text);
  };
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  write("apps/web/app/page.tsx", "export default function Page() { return null; }\n");
  write("apps/web/lib/logic.ts", "export const a = 1;\n");
  write("docs/testing/flows.md", "| Écran |\n|---|\n| `/` |\n");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  const base = git("rev-parse", "HEAD").trim();
  change(write);
  git("add", "-A");
  git("commit", "-q", "-m", "pr");
  const run = spawnSync("node", [CHECK, base, "HEAD"], { cwd: dir, encoding: "utf8", env: { ...process.env, LABELS: "", PR_BODY: "" } });
  return { status: run.status, out: run.stdout + run.stderr };
}

const screenChange = (write) => write("apps/web/app/page.tsx", "export default function Page() { return <p>hi</p>; }\n");
const logicChange = (write) => write("apps/web/lib/logic.ts", "export const a = 2;\n");

test("a screen change with only a test helper changed fails: a helper is not a test", () => {
  const r = prRepo((write) => {
    screenChange(write);
    write("apps/web/e2e/support/seed.ts", "export const seed = 1;\n");
  });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /changes screens/);
});

test("a screen change with a changed browser spec passes", () => {
  const r = prRepo((write) => {
    screenChange(write);
    write("apps/web/e2e/guest-page.spec.ts", 'test("x", async () => {});\n');
  });
  assert.equal(r.status, 0, r.out);
});

test("a logic change with only a mobile app test changed fails: it does not test the web logic", () => {
  const r = prRepo((write) => {
    logicChange(write);
    write("apps/mobile/src/thing.test.ts", 'test("x", () => {});\n');
  });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /changes logic/);
});

test("a logic change with a web or shared unit test changed passes", () => {
  for (const file of ["apps/web/lib/logic.test.ts", "packages/shared/src/logic.test.ts"]) {
    const r = prRepo((write) => {
      logicChange(write);
      write(file, 'test("x", () => {});\n');
    });
    assert.equal(r.status, 0, `${file}\n${r.out}`);
  }
});
