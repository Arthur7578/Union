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
  # Mobbin: only for the roles that benchmark before development. Those stages
  # are short and never run two at a time, which the token rotation needs.
  local mcp_args=()
  if [[ "${STAGE:-}" != "build" && "$role" =~ ^(strategist|designer|pm)$ ]] && mobbin_mcp_config; then
    mcp_args=(--mcp-config "$MOBBIN_MCP_FILE" --strict-mcp-config)
  fi

  # The role never sees GitHub, OpenRouter or Mobbin refresh credentials: it
  # works on files, the local Supabase and, when given, a short-lived Mobbin
  # access token. Pushing and commenting happen in the workflow.
  ( cd "$REPO_ROOT" && env -u GH_TOKEN -u GITHUB_TOKEN -u SQUAD_GH_TOKEN -u OPENROUTER_API_KEY -u MOBBIN_OAUTH \
      ISSUE="$ISSUE" SQUAD_DIR="$SQUAD_DIR" SQUAD_OUT="$out" \
      claude -p "$task" "${mcp_args[@]}" \
        --model "${SQUAD_MODEL:-opus}" \
        --effort "${SQUAD_EFFORT:-high}" \
        --append-system-prompt-file "$prompt_file" \
        --dangerously-skip-permissions \
        --max-budget-usd "$budget" \
        --output-format json \
        > "$out/run.json" 2> "$out/stderr.log" ) || true
  rm -f "$MOBBIN_MCP_FILE"
  jq -r '"cost $" + ((.total_cost_usd // 0) | tostring) + ", turns " + ((.num_turns // 0) | tostring)' "$out/run.json" 2>/dev/null || true
  endlog
  # A role that could not run at all (no API key, API down: no output, no
  # spend) stops the stage, since an empty verdict would mislead Arthur. A
  # role that ran and then hit a limit (budget, turns) only warns: its files
  # are partial, and the next role or the review loop will see it.
  local reason
  reason=$(jq -r '.result // "no output"' "$out/run.json" 2>/dev/null || echo "no output")
  if ! jq -e '.is_error != true' "$out/run.json" > /dev/null 2>&1; then
    if jq -e '(.total_cost_usd // 0) > 0' "$out/run.json" > /dev/null 2>&1; then
      echo "::warning::role ${label} stopped early: ${reason:0:300}"
    else
      echo "::error::role ${label} could not run: ${reason:0:300} (stderr: $(head -c 300 "$out/stderr.log" 2>/dev/null))"
      exit 1
    fi
  fi
  echo "$out" > "$SQUAD_DIR/last_out"
}

last_out() { cat "$SQUAD_DIR/last_out"; }

# ---------------------------------------------------------------- Mobbin
# Mobbin's login gives a new refresh token at every renewal and spends the old
# one, so each new token is written back to the MOBBIN_OAUTH secret at once
# (Arthur authorized this on 2026-10-21). The token is held only in this
# shell's memory (MOBBIN_STATE, not exported), never in a file a role could
# read. Any failure turns Mobbin off for the rest of the run, with a note for
# Arthur; the roles then work without it.
MOBBIN_STATE="${MOBBIN_OAUTH:-}"
MOBBIN_OFF=""
MOBBIN_MCP_FILE="${RUNNER_TEMP:-/tmp}/mobbin-mcp.json"

mobbin_disable() {
  MOBBIN_OFF=1
  echo "::warning::Mobbin off for this run: $1"
  echo "- ⚠️ Mobbin indisponible pour ce run : $1" >> "$SQUAD_DIR/notes.md"
}

# Writes the MCP config for one role run; fails when Mobbin is off.
mobbin_mcp_config() {
  [[ -z "$MOBBIN_OFF" ]] || return 1
  if [[ -z "$MOBBIN_STATE" ]]; then
    MOBBIN_OFF=1 # not set up yet: no warning on every run
    return 1
  fi
  local expires_at now new_state
  expires_at=$(jq -r '.expires_at // 0' <<< "$MOBBIN_STATE" 2> /dev/null || echo 0)
  now=$(($(date +%s) * 1000))
  # Renew only when the access token expires within 10 minutes.
  if ((expires_at - now < 600000)); then
    if ! new_state=$(MOBBIN_OAUTH="$MOBBIN_STATE" node "$SQUAD_ROOT/mobbin-oauth.mjs" refresh 2> "$SQUAD_DIR/mobbin-error.log"); then
      mobbin_disable "renouvellement refusé ($(head -c 200 "$SQUAD_DIR/mobbin-error.log")). Relance le workflow « Mobbin login »."
      return 1
    fi
    MOBBIN_STATE="$new_state"
    echo "::add-mask::$(jq -r .access_token <<< "$MOBBIN_STATE")"
    echo "::add-mask::$(jq -r .refresh_token <<< "$MOBBIN_STATE")"
    if ! GH_TOKEN="${SQUAD_GH_TOKEN:-}" gh secret set MOBBIN_OAUTH --repo "$GITHUB_REPOSITORY" <<< "$MOBBIN_STATE" > /dev/null 2>&1; then
      mobbin_disable "impossible d'enregistrer le nouveau jeton (SQUAD_GH_TOKEN a-t-il la permission Secrets en écriture ?). Relance le workflow « Mobbin login »."
      return 1
    fi
  fi
  jq -n --arg token "$(jq -r .access_token <<< "$MOBBIN_STATE")" \
    '{mcpServers: {Mobbin: {type: "http", url: "https://api.mobbin.com/mcp", headers: {Authorization: ("Bearer " + $token)}}}}' \
    > "$MOBBIN_MCP_FILE"
}

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
