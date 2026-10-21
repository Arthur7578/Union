#!/usr/bin/env bash
# Stage 1: the strategist decides whether the issue is worth building as
# written. Ends at Arthur's first gate.
source "$(dirname "$0")/lib.sh"

task="Assess issue #${ISSUE} as the product strategist."
if [[ -s "$SQUAD_DIR/feedback.md" ]]; then
  task+=" Arthur left a comment for you in ${SQUAD_DIR}/feedback.md (extra context, or a revision request if you assessed this issue before). Address it explicitly."
fi

run_role strategist strategist "${SQUAD_BUDGET_USD:-8}" "$task"
out=$(last_out)
commit_all "docs: strategy for #${ISSUE}"

verdict=$(jq -r '.verdict // "inconnu"' "$out/verdict.json" 2>/dev/null || echo "inconnu")
reason=$(jq -r '.reason // ""' "$out/verdict.json" 2>/dev/null || echo "")

{
  echo "## 🧭 Squad — stratégie : **${verdict}**"
  echo
  [[ -n "$reason" ]] && echo "> ${reason}" && echo
} > "$SQUAD_DIR/comment.md"
add_summary "Product Strategist" "$out"
cat >> "$SQUAD_DIR/comment.md" <<EOF
📄 Détail : [strategy.md]($(branch_url "${SPEC_DIR}/strategy.md"))

**À toi :** \`/go\` lance le design · \`/revise <ce qui ne va pas>\` refait cette étape · \`/stop\` abandonne.
EOF

set_labels "+squad:gate-strategy -squad:gate-design -squad:working"
set_pr_action none
