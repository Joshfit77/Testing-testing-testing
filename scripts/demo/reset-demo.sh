#!/usr/bin/env bash
# Puts the demo's sample account back to its starting state in a few seconds, while `npm run demo` keeps running in
# another window. Use it between presentations, or after a run-through has changed things (a workout saved, a plan
# switched, a prayer added). The sign-in password stays the same, so the running server keeps working; anyone signed
# in to the sample account (including you) is signed out, so tap "Explore with sample data" again.
#
#   npm run demo:reset
#
# Like the demo itself, it only ever touches the database on this computer, and only demo accounts.
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v docker >/dev/null || { echo "Docker is required (it runs the local database)."; exit 1; }
eval "$(npx supabase status -o env | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')"
case "$API_URL" in http://127.0.0.1:*|http://localhost:*) ;; *) echo "Refusing: $API_URL is not a local database."; exit 1 ;; esac
export NEXT_PUBLIC_SUPABASE_URL="$API_URL" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export DEMO_CREDENTIALS_FILE=".demo-credentials.local"
# Keep the running server's password (it read this file when it started).
if [ -f "$DEMO_CREDENTIALS_FILE" ]; then set -a; . "./$DEMO_CREDENTIALS_FILE"; set +a; fi
npx tsx --conditions=react-server scripts/demo/seed-demo.ts
echo "Demo reset. In the browser: reload, then tap 'Explore with sample data'."
