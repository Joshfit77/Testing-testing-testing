# Test results

Every figure below comes from an actual run. Nothing was skipped, disabled or weakened to get a pass. Where a test was
changed, the reason is given (see also BUG_FIX_REGISTER.md).

## Final-review head: `8b32c103` and the report commit after it (T-27..T-31)

| Suite | Where | Result |
|---|---|---|
| Typecheck, lint (0 warnings) | This sandbox | **Passed** |
| Unit tests | This sandbox | **302 files; 4,991 passed, 1 skipped**, 0 failed |
| Fresh install of all 89 migrations + `npm run db:verify` | This sandbox | **Passed; 11 of 11 checks ok** (new: exact byte limit, migration 099) |
| Integration tests, `REQUIRE_TEST_STACK=1`, after that fresh install | This sandbox | **103 files (1 skipped); 678 passed, 1 skipped**, 0 failed (the skip is the opt-in live Open Food Facts test) |
| Production build | This sandbox | **Passed** |
| Browser suite with mocks | This sandbox | **168 passed, 0 failed, 101 skipped**, 13.3 min; the opt-in suites behind the skips were run separately (next rows) |
| **Opt-in:** device-size matrix (`E2E_DEVICE_MATRIX=1`) | This sandbox | **39 passed**: 74 phone models, 2,964 screens, **0 problems**, 0 navigation retries (23.2 min) |
| **Opt-in:** demo-server suites (`E2E_DEMO=1`: demo, achievement-progress, demo-reset, 5 UX specs), local database reset for the demo | This sandbox | **58 passed, 0 failed, 0 skipped** (2.8 min) |
| **Opt-in:** coach with no AI provider (separate server, no AI key) | This sandbox | **1 passed** |
| **Opt-in:** tap every control | This sandbox | Passed on `89260c5b` (49 screens, 281 controls, 0 findings); the final-review changes don't touch those screens' controls |
| **Opt-in, not run:** home-background photographs | — | Needs the photographs (`HOME_BACKGROUND_PHOTOS_READY`); they don't exist yet |
| Java run-journal store (JUnit) | This sandbox | **5 of 5 passed** (confirmed deletion) |
| Swift XCTest (backup exclusion, confirmed deletion), Android JVM tests, iOS build | GitHub | See the PR checks on the pushed head |

**Failures met in this round, and what was done:**

| Where | Failure | Cause | Action |
|---|---|---|---|
| `entitlements.test.ts` (new scale test) | 252 events listed for 250 | Window boundaries overlapped by a second, so events on a boundary second were listed twice (never applied twice) | Windows aligned to whole seconds |
| `progress-photo-quota.test.ts` (new burst test) | 1 landed instead of 3 | The test's premise was wrong: reservations count each pending upload as a full 8 MB, so near the limit only one is granted (correct, conservative) | Reservations granted directly in the test so the real-size trigger check decides |
| Coach test without an AI provider | Timed out at sign-up | Harness: an earlier server without the e2e rate-limit setting still held the port | Server restarted with the same setting as the mocked runner: passed |

## Round 3 head: `c71e652f` and the report commit after it (T-01..T-26)

| Suite | Where | Result |
|---|---|---|
| Typecheck, lint (0 warnings) | This sandbox | **Passed** |
| Unit tests | This sandbox | **301 files; 4,982 passed, 1 skipped**, 0 failed |
| Fresh install of all 88 migrations (`supabase db reset`) + `npm run db:verify` | This sandbox | **Passed; 10 of 10 checks ok** (new: reservations required, no photo UPDATE policy) |
| Integration tests, `REQUIRE_TEST_STACK=1`, after that fresh install | This sandbox | **103 files (1 skipped); 670 passed, 1 skipped**, 0 failed (the skip is the opt-in live Open Food Facts test) |
| Production build | This sandbox | **Passed** on `c71e652f` |
| Browser suite with mocks (`npm run test:e2e:mocked`) | This sandbox | **168 passed, 0 failed, 101 skipped** (the opt-in suites, as before), 15.2 min, on `d0a5f7aa` |
| Tap every control (`E2E_BUTTON_SWEEP=1`) | This sandbox | **Passed: 49 screens, 281 controls, 0 findings**, on `89260c5b` |
| Java run-journal store (JUnit, plain `javac`) | This sandbox | **5 of 5 passed** |
| GitHub CI on `ed3c4169` (typecheck, lint, unit, build, integration, secret scan, dependency audit) | GitHub CI run 45907478399 | **Passed** |
| iOS on `ed3c4169`: native unit tests (Swift run journal, XCTest), offline compile, device archive check, full app in the Simulator, WebKit opening/navigation | GitHub iOS run 45907505252 (dispatched; it replaced the push-triggered run 45907473706, cancelled by the workflow's concurrency group) | **Passed** (all jobs) |
| Android APK on `ed3c4169`: native unit tests (run journal, JVM, `testDebugUnitTest`), APK build | GitHub Android APK run 45907502155 (`publish=false`) | **Passed** |
| Load-test script | This sandbox | Smoke runs only (no app server): members created and always removed, including on Ctrl-C mid-setup |

**Failures found during this round, and what was done:**

| Where | Failure | Cause | Action |
|---|---|---|---|
| Sandbox integration (before commit `430e3758`) | Sandbox store tests | `sandboxOk` used before it was computed in the new code | Fixed before commit |
| `account-deletion-closure.test.ts` | New table not in the catalog | `billing_reconcile_state` (096) unregistered | Registered with its reason (T-13) |
| `api-function-surface.test.ts` | 2 new member-callable functions | Reservation functions (097) | Registered with their reasons |
| `store-billing.test.ts` (6 concurrent restores) | Intermittent `deadlock detected` | Real defect in 096 (T-20) | Migration 098; 8 of 8 runs pass, 2 of 4 failed before |
| `storage-upload-reservations.test.ts` | 31 of 60 landed against 30 | Real race introduced while fixing T-24 (two snapshots) | One-statement count, before commit |
| Same file, byte-limit burst | Intermittent | The test assumed no upload lands before all reservations; a landed small file correctly gives room back | Test rewritten to reserve without uploading (exact bound); the rule unchanged |
| `gps-route-memo.test.ts` (new) | Identity assertion | The test assumed every accepted fix adds a point; the track adds points only after enough movement | Test corrected to check that lines change exactly when a point is added |
| `workout-finish-extras.test.ts` (new) | Timeout | A stand-in left an extra waiting on its 8-second limit | Stand-in corrected |

No existing test was weakened or skipped. Existing upload tests now reserve first, as the app does; negative tests
reserve too, so they still fail for their original reason (type, size, plan, consent).

## Round 2 head: `100502d5` and the engagement-package commit after it (O-01..O-20 implemented)

| Suite | Where | Result |
|---|---|---|
| `npm run verify` (typecheck, lint, unit, integration with `REQUIRE_TEST_STACK=1`, production build) | This sandbox | **Passed.** Unit: 296 files, **4,947 passed, 1 skipped**, 0 failed. Integration: as below. Lint: 0 warnings |
| `npm run setup` (with `SKIP_NPM_CI=1`) | This sandbox | **Passed**: 85 migrations, 8/8 database checks ok, `.env.local` written |
| Integration tests, `REQUIRE_TEST_STACK=1`, after a fresh `supabase db reset` | This sandbox | **102 files; 646 passed, 1 skipped**, 0 failed (the skip is the opt-in live Open Food Facts test) |
| Fresh install of all 85 migrations + `scripts/verify-database.sql` | This sandbox | **Passed; 8 of 8 checks ok** |
| Production build | This sandbox | **Passed**; `/.well-known/apple-app-site-association` 200 `application/json` when configured; `assetlinks.json` 404 when not |
| Browser suite (mocked AI and food, phone size) | This sandbox | First run: **166 passed, 2 failed, 101 skipped**. Both failures were in this round's new tests, not the app: an ambiguous locator (the reply text is also in a screen-reader announcement), and a step that didn't reselect the verse after Escape cleared the selection. Both tests corrected; `bible-reader` and `coach` specs re-run through `scripts/e2e-mocked.sh`: **14 passed, 1 skipped (opt-in), 0 failed** |
| Tap every control (`E2E_BUTTON_SWEEP=1`) | This sandbox | **Passed**: 49 screens, 280 controls tapped, 0 findings (the previous run tapped 282; the sweep doesn't log per-screen counts, so the difference isn't identified, though some screens show date-dependent buttons) |
| AI budget reservation benchmark (pgbench, 20 clients, 100,000 synthetic events) | This sandbox | 600–690 reserve+finalize per second, 0 failures (O-17) |
| GitHub CI / iOS / Android APK on the pushed head | GitHub | See the PR checks |



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
| Hosted Supabase (`storage.objects` triggers) | Needs a staging project. No longer blocks: limits hold without the triggers (T-11, T-24) | O-16, R-03 |
| Native recorder behaviour (iOS suspension, app ended, Android service) | Needs a phone; the stores are unit-tested and the projects compile in CI | IPHONE_DEVICE_TESTING.md 15–15c, 26a; ANDROID_DEVICE_TESTING.md 6–6b |
| Production-scale load, write paths | Local machine only | PERFORMANCE_REPORT.md |
