#!/usr/bin/env bash
# Red on base: a bug fix's new test must fail on main's code and pass on the
# PR. Passing on both means it does not reproduce the bug. Run by the
# `bug-repro` job of test-discipline.yml on PRs labelled `bug`.
#
#   red-on-base.sh <base-sha> <head-sha>
#
# Copies the PR's new or changed tests into a worktree of the base commit and
# runs them there, cheapest layer first (vitest, then pgTAP, then Playwright),
# stopping at the first red one. Needs node_modules installed in the checkout
# and, for pgTAP and Playwright, the local Supabase running (supabase start)
# with E2E_SUPABASE_* set for the browser tests.
#
# Limit: a test can be red on base for a wrong reason (a helper or a column
# the fix adds). The job proves the test is not green on both; the reviewer
# still checks that it fails for the reason the bug describes.
set -uo pipefail

BASE="${1:?base sha}"
HEAD="${2:?head sha}"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT" || exit 1
W="${RUNNER_TEMP:-/tmp}/red-on-base"

substantive() { # changed file with added lines beyond comments and blanks
  git diff -U0 "$BASE...$HEAD" -- "$1" | grep -E '^\+[^+]' | sed 's/^+//' |
    grep -vE '^\s*($|//|/\*|\*|--|#)' > /dev/null
}
pick() { # pick <regex>: changed (not deleted) files matching, with real additions
  git diff --name-only --diff-filter=AMR "$BASE...$HEAD" | grep -E "$1" | while read -r f; do
    substantive "$f" && echo "$f"
  done
}

unit=$(pick '^apps/web/.*\.test\.tsx?$')
db=$(pick '^supabase/tests/database/.*\.sql$')
e2e=$(pick '^apps/web/e2e/.*\.spec\.ts$')

if [[ -z "$unit$db$e2e" ]]; then
  echo "::error::This PR is labelled bug but adds or changes no test. A bug fix starts with a test that reproduces the bug (CLAUDE.md, Tests)."
  exit 1
fi
echo "Tests the PR adds or changes:"; printf '  %s\n' $unit $db $e2e

rm -rf "$W"; git worktree prune
git worktree add -q --detach "$W" "$BASE"
trap 'git -C "$ROOT" worktree remove --force "$W" > /dev/null 2>&1' EXIT

# The PR's versions of its tests (and of the browser-test helpers) on top of
# main's code.
for f in $unit $db $e2e; do mkdir -p "$W/$(dirname "$f")"; git show "$HEAD:$f" > "$W/$f"; done
if [[ -n "$e2e" ]]; then
  git ls-tree -r --name-only "$HEAD" apps/web/e2e/support | while read -r f; do git show "$HEAD:$f" > "$W/$f"; done
fi
for d in node_modules apps/web/node_modules packages/shared/node_modules; do
  [[ -d "$ROOT/$d" && ! -e "$W/$d" ]] && ln -s "$ROOT/$d" "$W/$d"
done

red() {
  echo "✅ Red on main's code ($1), as a reproducing test should be:"
  printf '  %s\n' "${@:2}"
  echo "### Bug reproduced on main ✅" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  echo "Red on the base commit (${1}): \`${*:2}\`" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  exit 0
}

if [[ -n "$unit" ]]; then
  echo "::group::vitest on main's code"
  rel=$(for f in $unit; do echo "${f#apps/web/}"; done)
  # shellcheck disable=SC2086
  (cd "$W/apps/web" && npx vitest run $rel); status=$?
  echo "::endgroup::"
  (( status != 0 )) && red vitest $unit
fi

if [[ -n "$db" ]]; then
  echo "::group::pgTAP on main's schema"
  supabase db reset --workdir "$W" > /dev/null && supabase test db --workdir "$W" $db; status=$?
  echo "::endgroup::"
  (( status != 0 )) && red pgTAP $db
fi

if [[ -n "$e2e" ]]; then
  echo "::group::Playwright on main's app and schema"
  if [[ -z "$db" ]]; then supabase db reset --workdir "$W" > /dev/null; fi
  [[ -n "${DB_URL:-}" ]] && psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f "$W/apps/web/e2e/support/grants.sql"
  rel=$(for f in $e2e; do echo "${f#apps/web/}"; done)
  # shellcheck disable=SC2086
  (cd "$W/apps/web" && CI=1 npx playwright test --retries 0 $rel); status=$?
  echo "::endgroup::"
  (( status != 0 )) && red Playwright $e2e
fi

echo "::error::Every test this PR adds or changes also passes on main's code, so none reproduces the bug. Write a test that fails without the fix (CLAUDE.md, Tests: a bug fix starts with a test that reproduces the bug)."
exit 1
