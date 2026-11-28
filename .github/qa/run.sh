#!/usr/bin/env bash
# Adversarial QA on a pull request: builds the PR's app against a local
# Supabase, lets one headless Claude Code session try to break what the PR
# changes, then collects the test files it proposes. Posting the comment is
# done by the workflow (.github/workflows/qa-adverse.yml); this script never
# talks to GitHub.
#
# Environment: QA_DIR (scratch folder, outside the repo), BASE_SHA, PR,
# QA_MODEL, QA_EFFORT, QA_BUDGET_USD, ANTHROPIC_API_KEY.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
ROOT="$PWD"
: "${QA_DIR:?}" "${BASE_SHA:?}"
mkdir -p "$QA_DIR/out" "$QA_DIR/proposals"
APP_PORT=3300
# The session's edits are undone at the end, so start from a clean checkout
# (CI's is): local work would be mixed up with the session's.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "::error::run.sh needs a checkout without uncommitted changes."
  exit 1
fi
untracked_before="$QA_DIR/untracked-before.txt"
git ls-files --others --exclude-standard | sort > "$untracked_before"

# ---------------------------------------------------------- app + Supabase
SQUAD_DIR="$QA_DIR" bash .github/squad/supabase-up.sh
# shellcheck disable=SC1091
. "$QA_DIR/supabase.env"
echo "::group::build the PR's app"
npm run build --workspace apps/web
echo "::endgroup::"
(cd apps/web && npm run start -- -p "$APP_PORT" > "$QA_DIR/app.log" 2>&1 &)
for _ in $(seq 60); do curl -sf "http://127.0.0.1:${APP_PORT}" > /dev/null && break; sleep 2; done
curl -sf "http://127.0.0.1:${APP_PORT}" > /dev/null || { echo "::error::the app did not start"; tail -50 "$QA_DIR/app.log"; exit 1; }

# -------------------------------------------------------------- the role
prompt="$QA_DIR/system-prompt.md"
text="$(cat .github/qa/role.md)"
text="${text//\$QA_OUT/$QA_DIR/out}"
text="${text//\$QA_DIR/$QA_DIR}"
text="${text//\$BASE_SHA/$BASE_SHA}"
text="${text//\$APP_URL/http://127.0.0.1:$APP_PORT}"
text="${text//\$APP_PORT/$APP_PORT}"
printf '%s\n' "$text" > "$prompt"

echo "::group::adversarial QA"
# The session sees no GitHub token: it works on files, the running app and
# the local Supabase only.
env -u GH_TOKEN -u GITHUB_TOKEN -u SQUAD_GH_TOKEN -u CI \
  claude -p "Try to break pull request #${PR}, then write your report." \
    --model "${QA_MODEL:-opus}" \
    --effort "${QA_EFFORT:-high}" \
    --append-system-prompt-file "$prompt" \
    --dangerously-skip-permissions \
    --max-budget-usd "${QA_BUDGET_USD:-6}" \
    --output-format json \
    > "$QA_DIR/run.json" 2> "$QA_DIR/stderr.log" || true
echo "::endgroup::"
pkill -f "next start" || true
jq -r '"cost $" + ((.total_cost_usd // 0) | tostring) + ", turns " + ((.num_turns // 0) | tostring)' "$QA_DIR/run.json" 2>/dev/null || true

# ------------------------------------------------------- collect proposals
# Only new test files count; anything else the session touched is undone.
# Files that were already untracked before the session are left alone.
created=$(git ls-files --others --exclude-standard | sort | comm -13 "$untracked_before" -)
while read -r f; do
  [[ -n "$f" ]] || continue
  if [[ "$f" =~ (\.spec\.ts|\.test\.tsx?|\.test\.sql)$ ]]; then
    mkdir -p "$QA_DIR/proposals/$(dirname "$f")"
    cp "$f" "$QA_DIR/proposals/$f"
  fi
  rm -f -- "$f"
done <<< "$created"
if ! git diff --quiet; then
  echo "::warning::the QA session modified tracked files; those changes were undone:"
  git diff --stat
  git diff --name-only -z | xargs -0 git checkout -q --
fi

report="$QA_DIR/out/report.json"
if ! jq -e '.findings | type == "array"' "$report" > /dev/null 2>&1; then
  reason=$(jq -r '.result // "no output"' "$QA_DIR/run.json" 2>/dev/null || echo "no output")
  jq -n --arg r "${reason:0:400}" '{summary: ("Le QA adverse n’a pas produit de rapport : " + $r), findings: [], failed: true}' > "$report"
fi
cp "$report" "$QA_DIR/proposals/report.json"
node "$ROOT/.github/qa/comment.mjs" "$report" "$QA_DIR/proposals" > "$QA_DIR/comment.md"
