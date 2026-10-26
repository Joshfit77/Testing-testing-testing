#!/usr/bin/env bash
# Runs the interactive demo on this computer: a local Supabase database (Docker) with sample data, and the real app
# built in demo mode (purchases off, AI replies simulated, a Free/Pro switch held on the server).
#
#   npm run demo                         then open http://localhost:3000 (or this computer's address on your Wi-Fi)
#   DEMO_RESET_LOCAL_DB=true npm run demo   wipes the LOCAL database first (needed if you've used it for development)
#
# It never talks to a hosted Supabase project, Stripe, RevenueCat or the AI provider.
set -euo pipefail
cd "$(dirname "$0")/../.."
PORT="${PORT:-3000}"

command -v docker >/dev/null || { echo "Docker is required (it runs the local database)."; exit 1; }
[ -d node_modules ] || npm ci

npx supabase start >/dev/null
eval "$(npx supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
case "$API_URL" in http://127.0.0.1:*|http://localhost:*) ;; *) echo "Refusing: $API_URL is not a local database."; exit 1 ;; esac
if [ "${DEMO_RESET_LOCAL_DB:-}" = "true" ]; then
  echo "Resetting the LOCAL database (only on this computer)…"
  npx supabase db reset >/dev/null
fi

export NEXT_PUBLIC_SUPABASE_URL="$API_URL" NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export DEMO_CREDENTIALS_FILE=".demo-credentials.local"
npx tsx scripts/demo/seed-demo.ts
set -a; . "./$DEMO_CREDENTIALS_FILE"; set +a

# Demo mode: payment keys are ignored, and the AI SDK talks to the app's own scripted stand-in.
export DEMO_MODE=true
export ANTHROPIC_API_KEY="demo-$(node -e 'process.stdout.write(require("crypto").randomBytes(12).toString("hex"))')"
export ANTHROPIC_BASE_URL="http://127.0.0.1:${PORT}/api/demo-ai"
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://localhost:${PORT}}"
# Set to empty (not unset) so values in .env.local are not loaded either.
export STRIPE_SECRET_KEY="" STRIPE_WEBHOOK_SECRET="" REVENUECAT_SECRET_API_KEY="" REVENUECAT_WEBHOOK_AUTH="" REVENUECAT_PUBLIC_KEY_IOS="" REVENUECAT_PUBLIC_KEY_ANDROID=""

npx next build
echo
echo "Narrow Gate Fitness demo: http://localhost:${PORT}"
echo "On a phone on the same Wi-Fi: http://<this computer's IP address>:${PORT}"
echo "Tap 'Explore with sample data' on the welcome screen. The sample account's password is in ${DEMO_CREDENTIALS_FILE} (never commit it)."
exec npx next start -H 0.0.0.0 -p "$PORT"
