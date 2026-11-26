# Test results

Every figure below comes from an actual run. Nothing was skipped, disabled or weakened to get a pass. Where a test was
changed, the reason is given (see also BUG_FIX_REGISTER.md).

## Final head: `8fa7c3b5` (all code; later commits are documentation only)

| Suite | Where | Result |
|---|---|---|
| Typecheck, lint, unit tests, production build | GitHub CI run 159 ([link](https://github.com/Joshfit77/Testing-testing-testing/actions/runs/45759142595)) | **Passed** |
| Integration tests (real Postgres, RLS, auth, storage) | GitHub CI run 159 | **Passed** |
| Secret scan (gitleaks, full history), `npm audit --omit=dev --audit-level=high` | GitHub CI run 159 | **Passed** |
| Unit tests (local) | This sandbox | **288 files; 4,919 passed, 1 skipped**, 0 failed |
| Integration tests (local, after `supabase db reset`) | This sandbox | **101 files; 640 passed, 1 skipped**, 0 failed. Run twice with the same result. The skip is `food-quality-live.test.ts`, an opt-in test against the live Open Food Facts service |
| Browser suite (Playwright, `--project mobile`, production build, with AI and food mocks) | This sandbox | **167 passed, 0 failed, 101 skipped**, 14.2 min. The 101 skips are opt-in suites, each gated by an environment switch in the spec: the demo server (`E2E_DEMO`, needs an isolated database), the tap-every-control sweep (`E2E_BUTTON_SWEEP`), the 39-phone-size matrix, and photo fixtures. The same set was skipped in docs/release/TESTFLIGHT_AUDIT_2026-11-23.md, where the sweep and matrix were run separately and passed. The tap sweep was re-run on this head (next row); the size matrix was not |
| Tap every safe control on every main screen (`E2E_BUTTON_SWEEP=1`, with mocks) | This sandbox | **Passed**: 49 screens, 282 controls tapped, 0 findings (15.6 min) |
| Android APK compile (`publish=false`) | GitHub Android APK run 27 ([link](https://github.com/Joshfit77/Testing-testing-testing/actions/runs/45759169700)) | **Passed** |
| iOS (Xcode build, archive contents, Simulator launch, WebKit tests) | GitHub iOS run 109 ([link](https://github.com/Joshfit77/Testing-testing-testing/actions/runs/45759142535)) | **Passed** |
| Fresh install of all 83 migration files | This sandbox (`supabase db reset`) | **Passed** |
| Upgrade from `main` with synthetic data | This sandbox | **Passed**: all data preserved (DATABASE_MIGRATION_REPORT.md) |
| Local load test | This sandbox | PERFORMANCE_REPORT.md: 0 errors up to 100 members / 25 concurrent; 1 redirect in 1,689 at 200 / 50 |

## Earlier runs on this branch (what failed, and why)

| Commit | Run | Result | Cause and action |
|---|---|---|---|
| `c275a808` (start) | Browser suite without the AI/food mocks | 2 failures | Harness problem, not the app: AI tests need the mock servers. Re-run with them: passed |
| `9f6d8866` | GitHub CI 157 | **Failed** | Migration 089's trigger was too broad: it overrode a member's coaching-memory choice when AI consent was off, while the app would still say memory was on. Narrowed to transitions only in `ecdca7d8`. Tests that wrote journal marks directly (bypassing the new rule) now grant the permission first; their checks are unchanged. Isolation and deletion tests place avatars with the service key, because member uploads to the unused avatars bucket are now refused (and the isolation test asserts that refusal) |
| `ecdca7d8`–`29d80ca9` | Browser suite | 163 passed, 1 failed | `e2e/sleep.spec.ts` ran across midnight UTC, so "last night" changed meaning mid-test. Passed on re-run. Logged as O-20 |
| `29d80ca9` | GitHub CI 158 | **Passed** | — |
| Friends merge (before fixes) | Integration | 3 failures | Friends tests predated later safeguards: an admin needs MFA (migration 085), the admin-visible table catalog, and deletion seeds. Fixed, then the 3 suites passed (37/37), and the full integration suite passed on `8fa7c3b5` |
| `8fa7c3b5` | GitHub CI 159 | **Passed** | — |

## Not tested (and why)

| Area | Why | Where it is covered |
|---|---|---|
| Physical iPhone / Android | No device available to this session. Never claimed as passed | IPHONE_DEVICE_TESTING.md, ANDROID_DEVICE_TESTING.md |
| App Store / Play sandbox purchases | Needs store accounts and a device | PAYMENT_VERIFICATION.md (simulated vs sandbox) |
| Stripe test-mode end to end | Needs the owner's Stripe test keys; billing was tested with local stand-ins | PAYMENT_VERIFICATION.md |
| Live AI | Paid service not approved. Every AI path ran against the local mock | AI_COST_ANALYSIS.md |
| Hosted Supabase (`storage.objects` triggers) | Needs a staging project | O-16 |
| Production-scale load, write paths | Local machine only | PERFORMANCE_REPORT.md |
