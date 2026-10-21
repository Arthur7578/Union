#!/usr/bin/env bash
# Collects what the roles need to read about the issue, into $SQUAD_DIR:
#   issue.md       title, body and Arthur's comments (not the squad's own)
#   attachments/   images from those, downloaded so the roles can open them
#   feedback.md    the comment that started this run, without its command
#
# Env: ISSUE, SQUAD_DIR, OWNER, GITHUB_REPOSITORY, GH_TOKEN, COMMENT_BODY
set -euo pipefail

MARK='<!-- union-squad -->'
mkdir -p "$SQUAD_DIR/attachments"

gh issue view "$ISSUE" --repo "$GITHUB_REPOSITORY" --json title,body,labels,comments > "$SQUAD_DIR/issue.json"

# Only the owner's words count as instructions (public repo). The squad posts
# with the owner's token too, so its own comments are told apart by a marker.
jq -r --arg owner "$OWNER" --arg mark "$MARK" '
  "# Issue #\(env.ISSUE): \(.title)\n\n\(.body // "")\n\n## Comments by \($owner)\n" +
  ([.comments[] | select(.author.login == $owner and ((.body // "") | contains($mark) | not)) | "\n---\n\(.body)"] | join("\n"))
' "$SQUAD_DIR/issue.json" > "$SQUAD_DIR/issue.md"

# Images: GitHub's rendered HTML carries image addresses that can be
# downloaded (attachment links in the raw text often need a browser session).
html="$SQUAD_DIR/issue.html"
gh api -H "Accept: application/vnd.github.html+json" "repos/${GITHUB_REPOSITORY}/issues/${ISSUE}" --jq '.body_html // ""' > "$html"
gh api -H "Accept: application/vnd.github.html+json" --paginate "repos/${GITHUB_REPOSITORY}/issues/${ISSUE}/comments" \
  --jq ".[] | select(.user.login == \"${OWNER}\" and ((.body // \"\") | contains(\"${MARK}\") | not)) | .body_html // \"\"" >> "$html"

n=0
images=""
while IFS= read -r src; do
  [[ -n "$src" ]] || continue
  n=$((n + 1))
  tmp="$SQUAD_DIR/attachments/img-$(printf '%02d' "$n")"
  if curl -sSL --max-time 30 -o "$tmp" "$src" 2> /dev/null; then
    mime=$(file -b --mime-type "$tmp" || echo unknown)
    if [[ "$mime" == image/* ]]; then
      mv "$tmp" "$tmp.${mime#image/}"
      images+="- \`$tmp.${mime#image/}\`"$'\n'
      continue
    fi
  fi
  rm -f "$tmp"
  images+="- (could not download: $src)"$'\n'
done < <(grep -oE '<img[^>]+src="[^"]+"' "$html" | sed -E 's/.*src="([^"]+)".*/\1/; s/&amp;/\&/g' | awk '!seen[$0]++')

if [[ -n "$images" ]]; then
  {
    echo
    echo "## Images in the issue and comments"
    echo
    echo "Downloaded for you: open each one with the Read tool before you start."
    echo
    printf '%s' "$images"
  } >> "$SQUAD_DIR/issue.md"
fi
echo "Images: $(find "$SQUAD_DIR/attachments" -type f | wc -l) downloaded"

# The comment that started the run, minus the command itself, is passed on as
# Arthur's feedback. The command can be on any line (often after a quote).
printf '%s' "${COMMENT_BODY:-}" | sed -E 's#^[[:space:]]*/(squad|go|revise|fix)([[:space:]]+|$)##' > "$SQUAD_DIR/feedback.md"
# Nothing but whitespace left: no feedback.
if ! grep -q '[^[:space:]]' "$SQUAD_DIR/feedback.md"; then : > "$SQUAD_DIR/feedback.md"; fi
