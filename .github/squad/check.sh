#!/usr/bin/env bash
# Every deterministic check, in one place: lint, typecheck, unit tests,
# database tests, browser tests. Runs them all (does not stop at the first
# failure) so a developer gets the full list, then exits non-zero if any failed.
#
# Needs the local Supabase from supabase-up.sh. Output: $CHECK_LOG (default
# $SQUAD_DIR/check.log, or ./check.log outside the squad).
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

SQUAD_DIR="${SQUAD_DIR:-.}"
CHECK_LOG="${CHECK_LOG:-$SQUAD_DIR/check.log}"
[[ -f "$SQUAD_DIR/supabase.env" ]] && . "$SQUAD_DIR/supabase.env"
: > "$CHECK_LOG"

failed=()
step() {
  local name="$1"; shift
  echo "=== $name" | tee -a "$CHECK_LOG"
  if "$@" >> "$CHECK_LOG" 2>&1; then
    echo "--- $name: OK" | tee -a "$CHECK_LOG"
  else
    echo "--- $name: FAILED" | tee -a "$CHECK_LOG"
    failed+=("$name")
  fi
}

step lint npm run lint
step typecheck npm run typecheck
step unit npm test
step database supabase test db
step e2e env CI=1 npm run e2e --workspace apps/web

if (( ${#failed[@]} )); then
  echo "FAILED: ${failed[*]}" | tee -a "$CHECK_LOG"
  exit 1
fi
echo "ALL CHECKS PASSED" | tee -a "$CHECK_LOG"
