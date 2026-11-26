#!/usr/bin/env bash
# Everything CI checks, locally, in order, stopping at the first failure:
#   typecheck, lint, unit tests, integration tests (real local database; fails if it isn't running), production build.
#   bash scripts/verify.sh            # all of the above
#   bash scripts/verify.sh --browser  # also the browser suite with the AI and food mocks (scripts/e2e-mocked.sh)
set -euo pipefail
cd "$(dirname "$0")/.."
run() { printf '\n== %s\n' "$1"; shift; "$@"; }
run "typecheck" npm run typecheck
run "lint" npm run lint
run "unit tests" npm run test:unit
run "integration tests (local Supabase required)" env REQUIRE_TEST_STACK=1 npm run test:integration
run "production build" npm run build
if [ "${1:-}" = "--browser" ]; then run "browser suite (mocked AI and food lookups)" bash scripts/e2e-mocked.sh; fi
printf '\nAll checks passed.\n'
