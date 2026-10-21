# shellcheck shell=bash
# Shared helpers for the squad scripts. Source it, do not run it.
#
# Expected environment (set by .github/workflows/squad.yml):
#   ISSUE          issue number the squad works on
#   SQUAD_DIR      scratch folder for this run (outside git), e.g. $RUNNER_TEMP/squad
#   SQUAD_MODEL    Claude model alias or ID for every role (default: opus)
#   SQUAD_EFFORT   effort level (default: high)
#   SQUAD_BUDGET_USD          per role run, safety cap (default: 8)
#   SQUAD_DEV_BUDGET_USD      per developer run (default: 20)
#   ANTHROPIC_API_KEY, OPENROUTER_API_KEY (the latter only for the reviewer)

set -euo pipefail

SQUAD_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SQUAD_ROOT" rev-parse --show-toplevel)"
SPEC_DIR="docs/specs/${ISSUE}"
mkdir -p "$SQUAD_DIR/out" "$SQUAD_DIR/screens" "$REPO_ROOT/$SPEC_DIR"

log() { printf '\n::group::%s\n' "$*"; }
endlog() { printf '::endgroup::\n'; }

# run_role <role-file> <label> <budget-usd> <task prompt>
# Runs one role as a fresh, headless Claude Code session. The role reads and
# writes files; its verdicts land in $SQUAD_OUT (printed on stdout).
run_role() {
  local role="$1" label="$2" budget="$3" task="$4"
  # Numbered folders keep the run order readable in the uploaded artifact.
  local count out
  count=$(find "$SQUAD_DIR/out" -mindepth 1 -maxdepth 1 -type d | wc -l)
  out="$SQUAD_DIR/out/$(printf '%02d' $((count + 1)))-${label}"
  mkdir -p "$out"
  local prompt_file="$out/system-prompt.md"
  # Only our own variables are substituted, so `$` in code samples survives.
  local text
  text="$(cat "$SQUAD_ROOT/roles/_common.md")"$'\n\n'"$(cat "$SQUAD_ROOT/roles/${role}.md")"
  text="${text//\$SQUAD_OUT/$out}"
  text="${text//\$SQUAD_DIR/$SQUAD_DIR}"
  text="${text//\$ISSUE/$ISSUE}"
  text="${text//\$APP_URL/${APP_URL:-(not running)}}"
  printf '%s\n' "$text" > "$prompt_file"

  log "role ${label} (${role})"
  # The role never sees GitHub or OpenRouter credentials: it works on files and
  # the local Supabase only. Pushing and commenting happen in the workflow.
  ( cd "$REPO_ROOT" && env -u GH_TOKEN -u GITHUB_TOKEN -u SQUAD_GH_TOKEN -u OPENROUTER_API_KEY \
      ISSUE="$ISSUE" SQUAD_DIR="$SQUAD_DIR" SQUAD_OUT="$out" \
      claude -p "$task" \
        --model "${SQUAD_MODEL:-opus}" \
        --effort "${SQUAD_EFFORT:-high}" \
        --append-system-prompt-file "$prompt_file" \
        --dangerously-skip-permissions \
        --max-budget-usd "$budget" \
        --output-format json \
        > "$out/run.json" 2> "$out/stderr.log" ) || echo "::warning::role ${label} exited with an error (see artifact ${out##*/})"
  jq -r '"cost $" + ((.total_cost_usd // 0) | tostring) + ", turns " + ((.num_turns // 0) | tostring)' "$out/run.json" 2>/dev/null || true
  endlog
  echo "$out" > "$SQUAD_DIR/last_out"
}

last_out() { cat "$SQUAD_DIR/last_out"; }

# Appends a role's summary to the comment being built for Arthur.
add_summary() {
  local title="$1" out="$2"
  {
    echo "### ${title}"
    if [[ -s "$out/summary.md" ]]; then cat "$out/summary.md"; else echo "_(pas de résumé produit — voir les logs du run)_"; fi
    echo
  } >> "$SQUAD_DIR/comment.md"
}

commit_all() {
  local msg="$1"
  ( cd "$REPO_ROOT" && git add -A && { git diff --cached --quiet || git commit -q -m "$msg"; } )
}

set_labels() { echo "$*" > "$SQUAD_DIR/labels.txt"; }    # e.g. "+squad:gate-design -squad:gate-strategy"
set_pr_action() { echo "$1" > "$SQUAD_DIR/pr_action.txt"; } # draft | ready | none

branch_url() { echo "https://github.com/${GITHUB_REPOSITORY}/blob/squad/${ISSUE}/$1"; }
