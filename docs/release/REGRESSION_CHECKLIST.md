# Release regression checklist

Reusable for every release candidate. Each check is marked with how it is verified:

- **Auto** — covered by a test that runs in CI or in the local release run. The test file is named. These are
  browser, server and database checks: Playwright on Chromium (Pixel 7 emulation), vitest unit tests, and vitest
  integration tests against a local Supabase.
- **iPhone** — must be checked on a physical iPhone with the TestFlight build. The ID points to a row in
  `docs/release/TESTFLIGHT_ACCEPTANCE.md` (TF-…) or `docs/device-testing/DEVICE_TEST_SCRIPT.md` (DT-…).
- **Auto + iPhone** — the logic is tested automatically, but the native behaviour (permissions, background, hardware)
  is only proven on a device.

An Auto check counts for a release only if its test **passed on the exact commit being released**. Record that run in
the release-readiness report. Simulator, browser and mocked results never satisfy an iPhone check.

## How to run the automated part

```
npm run typecheck && npm run lint
npm run test:unit
npx supabase start && npx supabase db reset && npm run test:integration
npm run build
# production e2e: start the production server with ANTHROPIC_BASE_URL=http://127.0.0.1:4777,
# OFF_API_BASE_URL=http://127.0.0.1:4778 and AUTH_RATE_LIMIT_SCALE=50 (the specs start mocks on those ports).
# Both *_MOCK_PORT variables are required: without them the mock-dependent tests skip and the
# "coach isn't configured" test runs against a configured server and fails.
E2E_ANTHROPIC_MOCK_PORT=4777 E2E_OFF_MOCK_PORT=4778 E2E_BASE_URL=http://localhost:3000 npx playwright test --trace off
# demo e2e (server in DEMO_MODE)
E2E_DEMO=1 E2E_BASE_URL=http://localhost:3000 npx playwright test --trace off
```

The CI workflow (`.github/workflows/ci.yml`) runs typecheck, lint, unit, build, integration, gitleaks and npm audit
on every push. The Playwright suites are not in CI. They are run locally for each release, and their result is
written into the readiness report.

---

## Training

| # | Check | Cover | Test / device ID |
|---|---|---|---|
| T1 | A new member signs up, onboards, and reaches today's workout | Auto | `e2e/core-flow`, `e2e/onboarding-plan`, `e2e/first-workout-activation` |
| T2 | Sets log, complete, skip and repeat; "Same as last set"; previous performance shown inline | Auto | `e2e/current-set-card`, `e2e/fast-logging`, unit `drafts`, `workout-draft-session` |
| T3 | A workout survives offline, a refused save and backgrounding; the account copy is checked from a second browser | Auto + iPhone | `e2e/workout-data-preservation`, `e2e/workout-reliability`; DT-OFF-01…05, DT-QUIT-06 |
| T4 | Finishing saves exactly once; history and volume are correct | Auto | integration `workouts`, `workout-fast-logging`; `e2e/core-flow` |
| T5 | Pause, discard and resume a workout | Auto + iPhone | `e2e/train-pause`; DT-DISC-01…04 |
| T6 | Programs, the program builder and the exercise library open and start workouts | Auto | `e2e/program-library`, `e2e/program-builder`, integration `custom-programs` |
| T7 | Training review and adaptive suggestions are approval-only | Auto | `e2e/training-review`, integration `adaptive-training` |
| T8 | 2D exercise demos play, scrub and fall back | Auto | `e2e/exercise-demo-2d`, `e2e/exercise-demo` |
| T9 | Rest timer: notification, sound and vibration at the end, in the foreground, background and when locked | iPhone | DT-REST-01…11 |
| T10 | Number pad and haptic on set entry and completion | iPhone | TF-WO-02, TF-WO-03, TF-HAPTIC-01 |

## GPS

| # | Check | Cover | Test / device ID |
|---|---|---|---|
| G1 | Record → pause → resume → finish saves one run with its route and shows it in history | Auto (mocked geolocation) | `e2e/gps-run`, integration `gps-running`, unit `gps-recorder`, `gps-save-action` |
| G2 | Distance, pace and splits on controlled traces (noise, spikes, gaps, standing still) | Auto (simulated traces) | unit `gps-accuracy`, `gps-track`, `gps-audit-edge-cases` |
| G3 | GPS is Pro-only on the server; Free gets manual logging | Auto | integration `plan-enforcement`, `pro-bypass`; `e2e/memberships` |
| G4 | Treadmill and manual entries save, edit and delete; mi/km | Auto | `e2e/run`, integration `activities` |
| G5 | Deleted routes leave no stored points; local GPS data is cleared on sign-out or account switch | Auto + iPhone | integration `gps-running`, unit `gps-recorder-audit`; DT-SWITCH-01 |
| G6 | Locked screen, background, phone call, Low Power Mode, one hour locked | iPhone | DT-GPS-03…11 |
| G7 | Real-world accuracy on a track and a measured road | iPhone | DT-ROUTE-01, -03, -05 |

## Sleep

| # | Check | Cover | Test / device ID |
|---|---|---|---|
| S1 | Consent before any sleep data; no numbers before anything is recorded | Auto | `e2e/sleep`, `e2e/new-member-states` |
| S2 | Manual logging, check-ins, score, debt and trends (scores are computed, not stored) | Auto | integration `sleep`, `sleep-checkins`; `e2e/sleep`, `e2e/ux-progress-sleep` |
| S3 | Import deduplication and manual-versus-imported precedence | Auto (fixtures) + iPhone | integration `sleep-imports`; DT-HEALTH-07…09 |
| S4 | Pro sleep pages lock on Free with a free next step ("Log last night's sleep") | Auto | `e2e/memberships` |
| S5 | Apple Health permission sheet, revoke, disconnect, nothing written to Health | iPhone | DT-HEALTH-05, -06, -11, -12 |

## Nutrition

| # | Check | Cover | Test / device ID |
|---|---|---|---|
| N1 | Search, log, edit and delete food; grams/oz; serving sizes | Auto | `e2e/nutrition-diary`, `e2e/food-amounts`, integration `food-amounts` |
| N2 | Undo after logging removes exactly the rows added, only the member's own | Auto | `e2e/fast-logging`, unit `nutrition-undo-actions` |
| N3 | Barcode product, Nutrition Score, additives, conflicting or outdated data | Auto (OFF mock) | `e2e/food-quality`, `e2e/label-check`, integration `food-quality` |
| N4 | Recipes, planner, grocery list, saved meals | Auto | `e2e/recipes-planner`, integration `recipes-planner`, `food-favorites` |
| N5 | Meal photo (Pro) estimates and saves idempotently | Auto (mocked AI) + iPhone | integration `food-photo`; TF-FOOD-01 |
| N6 | The native barcode scanner, camera permission, haptic | iPhone | DT-SCAN-01…10, DT-CAM-04/05 |
| N7 | Day boundaries in the member's time zone | Auto | `e2e/nutrition-timezone` |

## Faith

| # | Check | Cover | Test / device ID |
|---|---|---|---|
| F1 | Bible reader: books, chapters, search, highlights, notes, red letters, offline | Auto + iPhone | `e2e/bible-reader`, unit `bible-offline`; TF-FAITH-02/03 |
| F2 | Journeys and the daily reading + prayer rule, including the Day 1 reset | Auto | `e2e/faith-journey`, `e2e/journeys`, integration `faith-journeys` |
| F3 | The prayer journal stays out of AI context unless the member shares an entry | Auto + iPhone | unit `coach-journal`, `coach-memory`; integration `bible-ai-helper`; TF-AI-03 |
| F4 | Prayer text never appears in notifications | Auto + iPhone | unit `notification-planner`; TF-FAITH-04 |
| F5 | One member never sees another's faith data | Auto | integration `cross-user-isolation`, `rls`, `faith-features` |
| F6 | Calendar, challenge and practices | Auto | `e2e/faith-calendar`, `e2e/challenge`, `e2e/ux-faith` |

## Achievements (badges, milestones, personal records)

| # | Check | Cover | Test / device ID |
|---|---|---|---|
| A1 | A new member's badges: all "Not started", the first a single workout away ("0 / 1 workout") | Auto | `e2e/new-member-states`, `e2e/rank-badges` |
| A2 | Badge progress counts from real records only (fitness, food and faith days) | Auto | integration `badge-progress` (#9), unit `achievements` |
| A3 | Exercise milestones and personal records: heaviest lift vs estimated 1RM, bodyweight tracks, holds, runs (GPS + treadmill + manual) | Auto | unit `exercise-milestones`, `e2e/achievement-progress` (#9) |
| A4 | The workout-complete celebration appears once, fits the phone width, and respects Reduce Motion | Auto + iPhone | unit `milestone-celebration` (#9), `e2e/achievement-progress`; TF-WO-05, TF-A11Y-04 |
| A5 | Records survive a downgrade from Pro to Free | Auto + iPhone | integration `plan-enforcement`; TF-IAP-HIST |

## AI Coach

| # | Check | Cover | Test / device ID |
|---|---|---|---|
| C1 | Free: an upsell with starter questions from the member's own plan; no AI call | Auto | `e2e/new-member-states`, `e2e/coach` |
| C2 | Pro: a reply streams; quota is metered atomically; limits are enforced | Auto (mock model) | `e2e/coach`, integration `ai-limits`, `ai-route-limits`, `coach-provider-limits` |
| C3 | Honest messages when the coach isn't configured or the provider fails | Auto | `e2e/coach` |
| C4 | Memory: no health details or prayer text kept; the member can view and delete it | Auto | integration `coach-memory`, unit `coach-memory` |
| C5 | Message times in the member's time zone | Auto | `e2e/coach-timezone` |
| C6 | Live responses on staging: quality, safety redirects, latency | iPhone + owner-enabled live key | TF-AI-01, TF-AI-02 (`docs/LIVE_AI_TEST_PLAN.md`) |

## Billing

| # | Check | Cover | Test / device ID |
|---|---|---|---|
| B1 | Pro is decided on the server only; client-side state cannot unlock it | Auto | integration `pro-bypass`, `entitlements`, `free-user-direct-actions` |
| B2 | Stripe webhooks: ordering, concurrency, refunds, disputes, reconciliation | Auto | integration `billing-integrity`, `store-billing` |
| B3 | RevenueCat: sandbox allow-list, restore and transfer, legacy Plus kept | Auto | integration `store-billing`, `entitlements` |
| B4 | Locked Pro screens offer "See plans" and a free next step (no dead ends) | Auto | `e2e/memberships` |
| B5 | The plans screen shows store prices and renewal terms | Auto + iPhone | `e2e/store-billing`; DT-IAP-01 |
| B6 | Sandbox purchase, cancel, upgrade, expiry, restore, cross-account restore | iPhone | DT-IAP-02…10 |
| B7 | Account deletion warns App Store subscribers; Stripe test subscriptions cancel | Auto + iPhone | integration `account-deletion`; DT-DEL-03/04 |
| B8 | Live Stripe keys are absent; demo builds never charge | Auto | `e2e/production-no-demo`, `e2e/demo` (purchases off) |

---

## Release record

Copy this block into the readiness report for each release.

| Field | Value |
|---|---|
| Commit | |
| Unit / integration / prod e2e / demo e2e | |
| CI run (URL and conclusion) | |
| iPhone checks run / passed (from TESTFLIGHT_ACCEPTANCE.md) | |
| Open Critical / High | |
