#!/usr/bin/env bash
# Stage 3: plan → tests first → code → loop (checks, QA, external reviewer,
# designer review → developer fixes) until nothing blocking is left or the
# round limit is reached. Ends at Arthur's last gate: the preview.
#
# Usage: stage-build.sh feature|bug|fix
source "$(dirname "$0")/lib.sh"

MODE="${1:?feature|bug|fix}"
B="${SQUAD_BUDGET_USD:-8}"
DEV_B="${SQUAD_DEV_BUDGET_USD:-20}"
MAX_ROUNDS="${SQUAD_MAX_ROUNDS:-5}"
APP_PORT=3200
REPORT="$SQUAD_DIR/report.md"
: > "$REPORT"
: > "$SQUAD_DIR/comment.md"

bash "$SQUAD_ROOT/supabase-up.sh"
. "$SQUAD_DIR/supabase.env"

note() { echo "- $*" >> "$REPORT"; }

dev_run() { # dev_run <mode> <task>
  run_role dev "dev-$1" "$DEV_B" "Mode: $1. $2"
  commit_all "wip(#${ISSUE}): developer $1"
}

# ---------------------------------------------------------------- kick-off
case "$MODE" in
  feature)
    run_role tech-lead tech-lead-plan "$B" "Mode: plan. Write the implementation plan for issue #${ISSUE}."
    commit_all "docs: implementation plan for #${ISSUE}"
    add_summary "Tech Lead (plan)" "$(last_out)"
    run_role qa qa-tests-first "$B" "Mode: tests-first. Write the acceptance tests for issue #${ISSUE}."
    commit_all "test: acceptance tests for #${ISSUE}"
    add_summary "QA (tests écrits avant le code)" "$(last_out)"
    dev_run implement "Implement issue #${ISSUE}."
    ;;
  bug)
    run_role qa qa-bug-repro "$B" "Mode: bug-repro. Reproduce the bug in issue #${ISSUE} with a failing test."
    commit_all "test: reproduce #${ISSUE}"
    repro_out=$(last_out)
    add_summary "QA (reproduction)" "$repro_out"
    if [[ "$(jq -r '.reproduced // false' "$repro_out/verdict.json" 2>/dev/null)" != "true" ]]; then
      { echo "## 🐞 Squad — bug non reproduit"; echo; cat "$SQUAD_DIR/comment.md"; echo "**À toi :** précise les étapes dans l'issue, puis retire et remets le label \`squad\`."; } > "$SQUAD_DIR/comment.tmp"
      mv "$SQUAD_DIR/comment.tmp" "$SQUAD_DIR/comment.md"
      set_labels "+squad:needs-human -squad:working"
      set_pr_action none
      exit 0
    fi
    run_role tech-lead tech-lead-plan "$B" "Mode: plan. Issue #${ISSUE} is a bug and a failing test reproduces it. Keep the plan short: root cause, fix, what must not change."
    commit_all "docs: fix plan for #${ISSUE}"
    dev_run implement "Fix the bug in issue #${ISSUE}."
    ;;
  fix)
    { echo "# Arthur's feedback after testing the preview (highest priority)"; echo; cat "$SQUAD_DIR/feedback.md"; } > "$SQUAD_DIR/findings.md"
    dev_run fix "Fix issue #${ISSUE} according to Arthur's feedback."
    ;;
  *) echo "unknown mode $MODE"; exit 2 ;;
esac

# ------------------------------------------------------------- review loop
status="needs-human"
round=0
while (( round < MAX_ROUNDS )); do
  round=$((round + 1))
  echo "## Round ${round}" >> "$REPORT"

  if [[ -s "$SQUAD_DIR/deviation.md" ]]; then
    run_role tech-lead tech-lead-arbitrate "$B" "Mode: arbitrate. The developer asks to deviate from the plan of issue #${ISSUE}."
    commit_all "docs: plan arbitration for #${ISSUE}"
    note "Écart au plan demandé par le dev → tech lead : $(jq -r 'if .accepted then "accepté" else "refusé" end + " — " + (.reason // "")' "$(last_out)/verdict.json" 2>/dev/null || echo "?")"
    mv "$SQUAD_DIR/deviation.md" "$SQUAD_DIR/deviation.round${round}.md"
  fi

  log "checks, round ${round}"
  if ! bash "$SQUAD_ROOT/check.sh"; then
    endlog
    failed=$(grep '^FAILED:' "$SQUAD_DIR/check.log" | tail -1)
    note "Checks rouges (${failed#FAILED: }) → le dev corrige."
    { echo "# Failed checks (round ${round})"; echo; echo '```'; grep -E '^(===|---)' "$SQUAD_DIR/check.log"; echo; tail -n 400 "$SQUAD_DIR/check.log"; echo '```'; } > "$SQUAD_DIR/findings.md"
    dev_run fix "Make every check pass for issue #${ISSUE}."
    continue
  fi
  endlog
  note "Checks verts."

  # The browser tests just built the app against the local Supabase: serve it
  # for the QA's exploration.
  (cd apps/web && npm run start -- -p "$APP_PORT" > "$SQUAD_DIR/app.log" 2>&1 &)
  for _ in $(seq 60); do curl -sf "http://127.0.0.1:${APP_PORT}" > /dev/null && break; sleep 2; done
  export APP_URL="http://127.0.0.1:${APP_PORT}"
  rm -rf "$SQUAD_DIR/screens" && mkdir -p "$SQUAD_DIR/screens"

  run_role qa qa-review "$B" "Mode: review. Review and explore the implementation of issue #${ISSUE}."
  commit_all "test: regression tests for #${ISSUE} (round ${round})"
  qa_json="$(last_out)/review.json"

  log "external reviewer"
  ext_json="$SQUAD_DIR/out/external-round${round}.json"
  node "$SQUAD_ROOT/review-external.mjs" "$ISSUE" "$ext_json"
  jq -r '.error // "ok"' "$ext_json"
  endlog

  design_json=""
  if [[ -f "$SPEC_DIR/design.md" ]]; then
    run_role designer designer-review "$B" "Mode: review. Compare the built feature of issue #${ISSUE} with the design."
    design_json="$(last_out)/review.json"
  fi
  pkill -f "next start" || true

  # Merge the blocking items of the three reviewers.
  {
    echo "# Blocking findings (round ${round})"
    for pair in "QA:$qa_json" "Senior reviewer:$ext_json" "Designer:$design_json"; do
      who="${pair%%:*}"; file="${pair#*:}"
      [[ -n "$file" && -f "$file" ]] || { [[ -n "$file" ]] && echo "- (${who}: pas de rapport produit)"; continue; }
      jq -r --arg who "$who" '.blocking[]? | "- [\($who) \(.id)] \(.what) — où : \(.where // "?") — correction : \(.fix // "?")"' "$file"
    done
  } > "$SQUAD_DIR/findings.md"
  blocking=$(grep -c '^- \[' "$SQUAD_DIR/findings.md" || true)
  missing_reports=$(grep -c 'pas de rapport' "$SQUAD_DIR/findings.md" || true)
  ext_error=$(jq -r '.error // empty' "$ext_json" 2>/dev/null || true)
  note "Revues : ${blocking} point(s) bloquant(s)."
  grep '^- \[' "$SQUAD_DIR/findings.md" | sed 's/^/  /' >> "$REPORT" || true
  [[ -n "$ext_error" ]] && note "⚠️ Le reviewer externe n'a pas pu relire : ${ext_error:0:200}"

  if (( blocking == 0 && missing_reports == 0 )) && [[ -z "$ext_error" ]]; then
    status="ready"
    break
  fi
  if (( round == MAX_ROUNDS )); then break; fi
  if (( blocking == 0 )); then
    # A reviewer failed to report: do not call this clean, try again next round.
    continue
  fi
  dev_run fix "Fix the blocking review findings for issue #${ISSUE}."
done

# ------------------------------------------------------------------ finish
if [[ "$status" == "ready" ]]; then
  dev_run finalize "Finalize issue #${ISSUE}."
  if ! bash "$SQUAD_ROOT/check.sh"; then
    status="needs-human"
    note "Les checks ont échoué après la finalisation."
  fi
fi

nonblocking=$(for f in "$SQUAD_DIR"/out/*/review.json "$SQUAD_DIR"/out/external-round*.json; do
  if [[ -f "$f" ]]; then jq -r '.non_blocking[]? | "- \(.what) (\(.where // "?"))"' "$f" || true; fi
done | sort -u | head -30 || true)
cost=$(jq -s '[.[].total_cost_usd // 0] | add // 0 | . * 100 | round / 100' "$SQUAD_DIR"/out/*/run.json 2>/dev/null || echo "?")

{
  if [[ "$status" == "ready" ]]; then
    echo "## ✅ Squad — prêt pour ton test sur la preview"
  else
    echo "## ⚠️ Squad — besoin de toi"
    echo
    echo "Arrêt après ${round} tour(s) avec des points bloquants ou des checks rouges. Détail ci-dessous et dans les logs du run."
  fi
  echo
  echo "Tours : **${round}** · coût Claude estimé : **\$${cost}** · reviewer externe : \`${REVIEWER_MODEL:-openai/gpt-5.6-sol}\`"
  echo
  cat "$SQUAD_DIR/comment.md"
  echo "### Journal"
  cat "$REPORT"
  echo
  if [[ "$status" != "ready" && -s "$SQUAD_DIR/findings.md" ]]; then
    echo "### Derniers points bloquants"; cat "$SQUAD_DIR/findings.md"; echo
  fi
  if [[ -n "$nonblocking" ]]; then
    echo "<details><summary>Points non bloquants relevés (à trier)</summary>"; echo; echo "$nonblocking"; echo; echo "</details>"; echo
  fi
  echo "**À toi :** teste la preview Vercel sur ton téléphone. Si ça va, merge. Sinon, commente \`/fix <ce qui ne va pas>\` sur cette PR : la squad reprend la boucle."
} > "$SQUAD_DIR/comment.tmp"
mv "$SQUAD_DIR/comment.tmp" "$SQUAD_DIR/comment.md"

if [[ "$status" == "ready" ]]; then
  set_labels "+squad:ready -squad:needs-human -squad:gate-design -squad:working"
  set_pr_action ready
else
  set_labels "+squad:needs-human -squad:ready -squad:gate-design -squad:working"
  set_pr_action draft
fi
