#!/bin/bash
# Prepares a Claude Code cloud session so lint, typecheck, unit tests, the
# build and the SQL tests (`supabase test db`) can all run, as they do in CI.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Workspace dependencies. `npm install` rather than `npm ci` so the cached
# container's node_modules is reused; with an in-sync lockfile it doesn't
# change package-lock.json.
npm install --no-audit --no-fund

# Supabase CLI, pinned to the version CI uses (.github/workflows/ci.yml).
# The tarball is checked against the SHA-256 published in the release's
# checksums.txt, so a different file is never installed.
SUPABASE_VERSION=2.115.0
case "$(uname -m)" in
  x86_64)  arch=amd64; sha=ff099608ce758b625532ef03a61f4c9520b995e94ff6cd5480dc0428cad64cb3 ;;
  aarch64) arch=arm64; sha=02d2dfddf41fb6d03d2f1baf6e0c63b32ecc8c4dfddcbe63f9b11aecd2a9111c ;;
  *)       arch= ;;
esac

if [ -z "$arch" ]; then
  echo "session-start: no pinned Supabase CLI for $(uname -m); skipping" >&2
elif ! supabase --version 2>/dev/null | grep -qx "$SUPABASE_VERSION"; then
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  tarball="supabase_${SUPABASE_VERSION}_linux_${arch}.tar.gz"
  curl -fsSL -o "$tmp/$tarball" \
    "https://github.com/supabase/cli/releases/download/v${SUPABASE_VERSION}/${tarball}"
  echo "$sha  $tmp/$tarball" | sha256sum -c --quiet -
  tar -xzf "$tmp/$tarball" -C "$tmp" supabase
  install -m 0755 "$tmp/supabase" /usr/local/bin/supabase
fi

# `supabase start` runs the local stack in Docker. The daemon isn't started
# in cloud containers by default.
if command -v dockerd >/dev/null 2>&1 && ! docker info >/dev/null 2>&1; then
  nohup dockerd >/tmp/dockerd.log 2>&1 &
  for _ in $(seq 1 30); do
    docker info >/dev/null 2>&1 && break
    sleep 1
  done
  docker info >/dev/null 2>&1 || echo "session-start: dockerd did not start; see /tmp/dockerd.log" >&2
fi
