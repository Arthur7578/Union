#!/usr/bin/env bash
# Stage 2: designer (flow, states, copy, phone prototype), PM (acceptance
# criteria) and tech lead (feasibility). If the tech lead finds the design
# unfeasible, the designer gets one revision before Arthur sees anything.
# Ends at Arthur's second gate.
source "$(dirname "$0")/lib.sh"

B="${SQUAD_BUDGET_USD:-8}"
extra=""
if [[ -s "$SQUAD_DIR/feedback.md" ]]; then
  extra=" Arthur commented when moving to this stage (or asked for a revision); his comment is in ${SQUAD_DIR}/feedback.md and takes precedence over earlier files."
fi

design_round() {
  local note="$1"
  run_role designer designer "$B" "Mode: spec. Design issue #${ISSUE}.${extra}${note}"
  design_out=$(last_out)
  run_role pm pm "$B" "Write the acceptance criteria for issue #${ISSUE}.${extra}"
  pm_out=$(last_out)
  run_role tech-lead tech-lead-feasibility "$B" "Mode: feasibility. Assess the design of issue #${ISSUE}."
  tl_out=$(last_out)
}

design_round ""
feasible=$(jq -r '.feasible // "unknown"' "$tl_out/verdict.json" 2>/dev/null || echo unknown)
if [[ "$feasible" == "false" ]]; then
  design_round " The tech lead found the previous design not feasible as drawn: read docs/specs/${ISSUE}/feasibility.md and revise the design to address it, keeping the experience as good as possible."
  feasible=$(jq -r '.feasible // "unknown"' "$tl_out/verdict.json" 2>/dev/null || echo unknown)
fi
effort=$(jq -r '.effort // "?"' "$tl_out/verdict.json" 2>/dev/null || echo "?")
commit_all "docs: design, criteria and feasibility for #${ISSUE}"

{
  echo "## 🎨 Squad — design prêt à valider"
  echo
  echo "Faisable : **${feasible}** · effort estimé : **${effort}**"
  echo
  echo "📱 **Prototype sur téléphone** : ouvre la preview Vercel de la PR de cette issue, puis ajoute \`/squad-proto/${ISSUE}.html\` à l'adresse."
  echo
} > "$SQUAD_DIR/comment.md"
add_summary "Product Designer" "$design_out"
add_summary "Product Manager" "$pm_out"
add_summary "Tech Lead (faisabilité)" "$tl_out"
cat >> "$SQUAD_DIR/comment.md" <<EOF
📄 [design.md]($(branch_url "${SPEC_DIR}/design.md")) · [criteria.md]($(branch_url "${SPEC_DIR}/criteria.md")) · [feasibility.md]($(branch_url "${SPEC_DIR}/feasibility.md"))

**À toi :** \`/go\` lance le développement (plan → tests → code → revues, sans toi jusqu'à la fin) · \`/revise <ce qui ne va pas>\` refait cette étape · \`/stop\` abandonne.
EOF

set_labels "+squad:gate-design -squad:gate-strategy -squad:working"
set_pr_action draft
