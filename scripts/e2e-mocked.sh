#!/usr/bin/env bash
# The browser suite as it must be run: against the production build, with the local AI (Anthropic) and food (Open Food
# Facts) mocks. Without the mocks, AI and food tests fail for the wrong reason. Needs `npm run build` and local Supabase.
#   bash scripts/e2e-mocked.sh [extra playwright args, e.g. e2e/coach.spec.ts]
# Optional: E2E_PORT (default 3015). The opt-in suites run with E2E_BUTTON_SWEEP=1 (tap every control) or E2E_DEMO=1.
set -uo pipefail
cd "$(dirname "$0")/.."
P=${E2E_PORT:-3015}; A=$((P + 1000)); O=$((P + 1001))
LOG=$(mktemp -t ngf-e2e-server.XXXXXX)
AUTH_RATE_LIMIT_SCALE=50 ANTHROPIC_API_KEY=e2e-test-key ANTHROPIC_BASE_URL=http://127.0.0.1:$A OFF_API_BASE_URL=http://127.0.0.1:$O \
  npx next start -p "$P" > "$LOG" 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null; pkill -P $SRV 2>/dev/null' EXIT
for _ in $(seq 1 60); do
  sleep 1
  [ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$P/" || true)" = 200 ] && break
  if grep -q EADDRINUSE "$LOG"; then echo "Port $P is in use; set E2E_PORT."; exit 1; fi
done
E2E_BASE_URL=http://localhost:$P E2E_ANTHROPIC_MOCK_PORT=$A E2E_OFF_MOCK_PORT=$O \
  npx playwright test --project mobile --trace off "$@"
