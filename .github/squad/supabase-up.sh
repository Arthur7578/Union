#!/usr/bin/env bash
# Starts the local Supabase the checks and the QA use, the same way CI's e2e
# job does, and writes the variables to $SQUAD_DIR/supabase.env.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

supabase start -x realtime,storage-api,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor,studio,postgres-meta

supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY|DB_URL)=' > "$SQUAD_DIR/supabase.raw.env"
set -a; . "$SQUAD_DIR/supabase.raw.env"; set +a
psql "$DB_URL" -v ON_ERROR_STOP=1 -f apps/web/e2e/support/grants.sql

cat > "$SQUAD_DIR/supabase.env" <<EOF
export DB_URL="$DB_URL"
export E2E_SUPABASE_URL="$API_URL"
export E2E_SUPABASE_ANON_KEY="$ANON_KEY"
export E2E_SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY"
EOF
echo "Local Supabase ready."
