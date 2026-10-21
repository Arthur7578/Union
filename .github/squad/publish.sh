#!/usr/bin/env bash
# Runs after a stage, with GitHub credentials (the roles never have them):
# pushes the squad branch, opens or updates the PR, posts the comment for
# Arthur and moves the issue's labels.
#
# Usage: publish.sh <stage>   (strategy | design | build)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
STAGE="$1"
BRANCH="squad/${ISSUE}"
: "${GH_TOKEN:?GH_TOKEN is required}"

declare -A COLORS=(
  [squad]=5319e7 [squad:working]=fbca04 [squad:gate-strategy]=0e8a16 [squad:gate-design]=0e8a16
  [squad:ready]=1d76db [squad:needs-human]=d93f0b [squad:stopped]=cccccc
)
for name in "${!COLORS[@]}"; do
  gh label create "$name" --color "${COLORS[$name]}" --force > /dev/null 2>&1 || true
done

# Push. The token in the URL is what lets the push trigger CI and Vercel when
# it is SQUAD_GH_TOKEN (pushes made with the default GITHUB_TOKEN do not
# trigger other workflows).
if [[ -n "$(git log "origin/main..HEAD" --oneline 2>/dev/null)" ]]; then
  git push -q "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" "HEAD:refs/heads/${BRANCH}"
fi

pr=$(gh pr list --head "$BRANCH" --state open --json number --jq '.[0].number // empty')
action=$(cat "$SQUAD_DIR/pr_action.txt" 2>/dev/null || echo none)

if [[ "$action" != "none" && -z "$pr" ]]; then
  title=$(jq -r .title "$SQUAD_DIR/issue.json")
  body=$(cat <<EOF
Travail de la squad pour #${ISSUE}.

- Stratégie, design, critères, plan : \`docs/specs/${ISSUE}/\`
- Prototype (tant que la PR est en brouillon) : \`/squad-proto/${ISSUE}.html\` sur la preview Vercel

Closes #${ISSUE}
EOF
)
  gh pr create --draft --base main --head "$BRANCH" --title "[squad] #${ISSUE} ${title}" --body "$body"
  pr=$(gh pr list --head "$BRANCH" --state open --json number --jq '.[0].number // empty')
fi

if [[ -n "$pr" ]]; then
  is_draft=$(gh pr view "$pr" --json isDraft --jq .isDraft)
  if [[ "$action" == "ready" && "$is_draft" == "true" ]]; then gh pr ready "$pr"; fi
  if [[ "$action" == "draft" && "$is_draft" == "false" ]]; then gh pr ready "$pr" --undo; fi
fi

run_url="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
printf '\n\n<sub>[Logs et sorties de chaque rôle](%s)</sub>\n' "$run_url" >> "$SQUAD_DIR/comment.md"

if [[ "$STAGE" == "build" && -n "$pr" ]]; then
  gh pr comment "$pr" --body-file "$SQUAD_DIR/comment.md"
  status_line=$(head -1 "$SQUAD_DIR/comment.md" | sed 's/^## //')
  gh issue comment "$ISSUE" --body "${status_line} → #${pr}"
else
  gh issue comment "$ISSUE" --body-file "$SQUAD_DIR/comment.md"
fi

# Labels: "+name" adds, "-name" removes.
for change in $(cat "$SQUAD_DIR/labels.txt" 2>/dev/null); do
  name="${change:1}"
  case "$change" in
    +*) gh issue edit "$ISSUE" --add-label "$name" > /dev/null ;;
    -*) gh issue edit "$ISSUE" --remove-label "$name" > /dev/null 2>&1 || true ;;
  esac
done
