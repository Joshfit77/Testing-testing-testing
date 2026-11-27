#!/usr/bin/env bash
# One-command local setup: Node check, dependencies, local Supabase (Docker), all migrations, database checks and a
# local .env.local. Safe to re-run. Touches only this machine: no hosted service, no paid API, no real keys.
#   bash scripts/dev-setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
step() { printf '\n== %s\n' "$*"; }

step "Node"
want=$(cat .nvmrc)
have=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo none)
if [ "$have" != "$want" ]; then echo "Node $want is required (found: $have). Run: nvm install $want && nvm use"; exit 1; fi
echo "Node $(node -v)"

step "Dependencies (npm ci)"
if [ "${SKIP_NPM_CI:-}" = "1" ]; then echo "skipped (SKIP_NPM_CI=1)"; else npm ci --no-audit --no-fund; fi

step "Docker"
if ! docker info >/dev/null 2>&1; then echo "Docker isn't running. Start Docker Desktop (or dockerd) and re-run."; exit 1; fi
echo "Docker is running"

step "Local Supabase (first start downloads images; a few minutes)"
npx supabase start >/dev/null
npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|DB_URL)=' | sed 's/=.*/=<set>/'

step "Database: all migrations and seed (supabase db reset)"
npx supabase db reset >/dev/null
echo "migrations: $(ls supabase/migrations/*.sql | wc -l | tr -d ' ') files applied"

step "Database checks (scripts/verify-database.sql)"
DB_URL=$(npx supabase status -o env 2>/dev/null | sed -n 's/^DB_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')
if command -v psql >/dev/null; then
  out=$(psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f scripts/verify-database.sql)
  echo "$out"
  if echo "$out" | grep -q FAILED; then echo "A database check failed (see above)."; exit 1; fi
else
  echo "psql not installed: skipped (install the PostgreSQL client to run these checks)"
fi

step ".env.local"
if [ -f .env.local ]; then
  echo ".env.local exists: left as it is"
else
  eval "$(npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
  cat > .env.local <<ENV
# Written by scripts/dev-setup.sh for the LOCAL Supabase stack only (these are the CLI's public demo keys).
# Every other setting is optional and documented in .env.example; paid services stay off without keys.
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV
  echo "wrote .env.local (local stack only; git-ignored)"
fi

step "Done"
echo "Start the app:   npm run dev        (http://localhost:3000)"
echo "Verify all:      npm run verify     (typecheck, lint, unit, integration, build)"
echo "Browser suite:   npm run test:e2e:mocked"
