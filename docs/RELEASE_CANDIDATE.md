# Release candidate 1 (2026-11-04)

One branch holds the whole app: **`release/rc-2026-11-04`**, cut from `claude/faith-discipleship`. Nothing is merged
into `main`, nothing is deployed, no live payment is possible (Stripe live keys are refused without explicit approval).
This document is the integration record, the security and payment findings, the test results and the backlog. Every
result below was produced in this session unless it says otherwise; anything not run is marked **NOT RUN** with the
reason.

## A. GitHub state

### Which branch is the app

`claude/faith-discipleship` already contains every other development branch except the six listed under "Not
merged". It is 360 commits ahead of `main` and `main` has nothing it lacks (checked with `git rev-list` against every
remote branch on 2026-11-04):

| Branch | Commits it has that the RC lacks | Status |
| --- | --- | --- |
| `main` (2026-10-17, `aad49a1`) | 0 | Older baseline, fully contained |
| `security/payment-hardening-prelaunch` | 0 | Contained (RevenueCat validation, Stripe webhook hardening, sandbox allow-list) |
| `claude/workout-experience` | 0 | Contained (logger fixes, phantom sessions, PR/volume fixes) |
| `claude/3d-in-workout`, `claude/anatomical-3d-exercises` | 0 | Contained (3D showcase, Écorché pipeline, status docs) |
| `claude/stage2-store-billing`, `claude/free-pro-membership`, `claude/stage1-memberships` | 0 | Contained (RevenueCat, Free/Pro, legacy Plus) |
| `claude/launch-audit`, `claude/interactive-demo`, `claude/testflight-prep`, `claude/ios-ci-reliability`, `claude/android-hardening`, `claude/exercise-demo-25d`, `claude/sharp-cray-8y0uuv`, `claude/nine-features`, `claude/app-cleanup`, `claude/badges-*`, `claude/security-nasb-deletion` | 0 | Contained |
| `claude/production-readiness` | 12 | **Not merged, on purpose** (see below) |
| `claude/privacy-policy` | 2 | Same two commits as in production-readiness (complete privacy policy and terms) |
| `claude/animated-opening-demo` | 2 | Two research documents (trademark/patent landscape); no app code |
| `claude/claude-ltp8ut` | 1 | An unrelated website ("The Recipe Therapist") |
| `claude/cool-gauss-hhzt4p`, `claude/new-session-rv5wiw` | 56 / 2 | Pre-September prototypes on a different history; superseded |
| `bsb-bible-data` | 1 (no common history) | Raw BSB source data; the app's Bible dataset was built from it |

### `claude/production-readiness`: why it isn't merged

It was branched from `main` on 2026-10-27 and re-implements, separately, things this line already has and tests:
Free/Pro pricing, RevenueCat store purchases, shared rate limits, AI data consent and the data export. Merging it
would:

- add four migrations dated 2026-10-27 (`shared_rate_limits`, `ai_consent`, `recovery_consent`,
  `store_subscriptions`) that sort **between** this line's `…045_legal_acceptances` and `…046_billing_integrity`
  and create tables this line already defines differently, so the database would no longer build;
- replace newer, tested code paths with older ones.

Its one code fix this line lacked (the iOS arm64 device requirement) was ported earlier (`ed7d993`). What it has that
this line still lacks is **finished legal text**: its privacy policy (524 lines) and terms (387 lines) are complete
drafts, while this line's `src/app/legal/privacy/page.tsx` and `src/app/legal/terms/page.tsx` are fact-checked
outlines with "[to be completed by counsel]" gaps. Its text predates sleep, Health data, the Bible reader, journal
sharing and the new GPS behaviour, so copying it as-is would make the policy inaccurate. It is listed as P0 below as a
source for counsel, not merged.

### Integration matrix (source of truth for each area)

| Area | Source of truth | In the RC | Evidence |
| --- | --- | --- | --- |
| Free / Pro $19.99 / $149.99, legacy Plus | free-pro-membership → payment-hardening | Yes | `APPROVED_PRO_PRICE_CENTS` in `src/lib/domain/plans.ts`; `tests/unit/plans.test.ts` |
| RevenueCat (App Store / Play) | stage2-store-billing → payment-hardening | Yes | `src/app/api/revenuecat/webhook/route.ts`, `src/server/services/store-billing.ts`; `tests/integration/store-billing.test.ts` |
| Stripe web checkout | payment-hardening | Yes (test mode only) | `tests/integration/billing-integrity.test.ts`, `entitlements.test.ts` |
| Server-side Pro enforcement | payment-hardening | Yes | `tests/integration/pro-bypass.test.ts`, `plan-enforcement.test.ts` |
| Workout logging and recovery | workout-experience + 2026-11-04 work | Yes | `tests/unit/workout-fast-logging.test.ts`, `tests/integration/workout-fast-logging.test.ts`, `e2e/fast-logging.spec.ts`, `e2e/workout-reliability.spec.ts` |
| Onboarding (essentials first) and Home order | faith-discipleship (2026-11-04) | Yes | `e2e/onboarding-plan.spec.ts`, `e2e/features.spec.ts` |
| 3D exercise demonstrations | anatomical-3d-exercises / 3d-in-workout | Yes, as a showcase page (`/train/3d`); workouts and the library show the 2D animation | `e2e/exercise-demo-3d.spec.ts`; `docs/anatomy3d/LIBRARY_STATUS.md` |
| GPS runs and walks | faith-discipleship (fix below) | Yes | `e2e/gps-run.spec.ts`, `tests/unit/gps-recorder.test.tsx` |
| Faith: BSB Bible, journeys, prayer journal, red letters | faith-discipleship | Yes | `e2e/bible-reader.spec.ts`, `e2e/faith-journey.spec.ts` |
| Sleep, Health / Health Connect import | nine-features → faith-discipleship | Yes | `e2e/sleep.spec.ts`, `tests/integration/sleep*.test.ts` |
| Legal pages | faith-discipleship (outline) | Outline only | production-readiness has fuller (older) text: P0 |
| CI and iOS checks | ios-ci-reliability + this RC | Yes; now also on `release/**` | `.github/workflows/ci.yml`, `ios.yml` |

Nothing was found overwritten: every branch's commits are ancestors of the RC except the six above.

### Migrations

53 files, unique timestamps, applied in name order; `supabase db reset` builds the whole database from them (run
several times in this session). `supabase/setup-all.sql` (the paste-once script for a new project) **was stale** and
is fixed (see B).

### Deployment and TestFlight workflows

- `ios.yml` "checks" (unsigned Simulator build and tests) now also runs on `release/**`; "testflight" (signed build,
  optional upload) runs only by hand and needs the Apple secrets and a deployed address.
- `ci.yml` now runs on `release/**` and by hand, so the RC gets typecheck, lint, unit, build, integration on a fresh
  Supabase, **gitleaks over the full history** and `npm audit` without a pull request.
- `demo-preview.yml` deploys only the demo to a private Vercel preview (unchanged). Nothing deploys production.

## B. Changes made for this RC

| Commit | Files | Why |
| --- | --- | --- |
| `98a072f`, `4fdf940` | `src/lib/domain/workout-draft.ts`, `src/components/workout/{current-set-card,workout-logger,exercise-card}.tsx`, tests, `docs/WORKOUT_LOGGING.md` | Faster logging: instant backup per set, Same as last set, skip set, smarter pre-fill (see E) |
| `b8bff0e` | `src/lib/run/live-recording.ts` (new), `src/components/run/gps-recorder.tsx`, `src/components/shell/{active-run-pill (new),active-workout-pill,app-shell}.tsx`, `src/lib/drafts.ts`, `tests/unit/gps-recorder.test.tsx`, `e2e/gps-run.spec.ts`, `e2e/exercise-demo-3d.spec.ts` | GPS kept recording only while the Run screen was open (see F/GPS) |
| `0b3a5ab` | `supabase/setup-all.sql`, `tests/unit/setup-all-bundle.test.ts` (new) | Setup script carried 137 old program rows (beginner RPE 9, not 8.5); regenerated, and a test now fails if it drifts |
| `d6e5bf4` | `.github/workflows/ci.yml`, `.github/workflows/ios.yml` | Run CI and the iOS checks on release branches; allow manual CI runs |
| `c14127d`, (this update) | `docs/RELEASE_CANDIDATE.md` | Integration record, findings, results, backlog |
| `528010f` | `.github/workflows/ci.yml` | gitleaks prints rule/file/line/commit of a finding (value redacted) |
| `e227845` | `scripts/perf/progress-overview-load.mjs`, `.gitleaksignore` (new) | No fixed password in the perf script; the one historical finding accepted by fingerprint (see C) |
| `255e150` | 3D removed (167 files, incl. `src/lib/anatomy3d/`, `public/anatomy/`, `/train/3d`, `three` deps); `src/lib/exercise-demo-readiness.ts`, `src/data/exercise-demo-readiness.json`, `src/components/train/exercise-demo.tsx`, `src/components/workout/current-set-card.tsx`, docs | Owner direction: 2D only; honest demo states; form cues, common mistakes and Swap on the workout card (see F) |
| `fe1c296` | `src/lib/domain/gps-track.ts`, `src/lib/run/live-recording.ts`, `src/components/run/gps-recorder.tsx`, error monitoring (`src/instrumentation*.ts`, `/api/client-errors`), `.github/workflows/billing-reconcile.yml`, TestFlight checklist, live-AI plan | Locked-iPhone GPS, dormant monitoring and reconciliation, test plans (see F, I) |
| `45a7017` | `scripts/react-hydration-replay-fix.mjs`, `package.json` hooks, `next.config.ts`, `tests/unit/react-hydration-replay.test.ts`, `docs/HYDRATION_418.md` | Root cause and fix of the intermittent hydration error #418 (a bug in the React build Next 15.5 bundles; see I) |

## C. Security

Checked against the running local stack (Supabase in Docker, the production build of the app), with real requests from
other members, an admin and anonymous visitors, not by reading policies.

| Control | Result | How |
| --- | --- | --- |
| Row-level security on every table | **PASS**: 97 of 97 public tables have RLS on; no views exposed to `anon`/`authenticated` | Live catalog query (`pg_class.relrowsecurity`) |
| Member-to-member isolation | **PASS** | `tests/integration/cross-user-isolation.test.ts`: a row seeded in every user-owned table and file in every private bucket; another member, an admin and an anonymous visitor cannot read, change, delete, write in the owner's name, attach children, or list/sign/replace/delete files |
| Privileged database functions | **PASS** | 8 SECURITY DEFINER functions callable by `anon` were reviewed: each answers only about the caller (`has_plan`, `is_admin`) or needs an unguessable id; `plan_of`, `reserve_ai_usage`, `admin_usage_metrics` refuse members (tested) |
| Stripe webhooks | **PASS** | Forged, unsigned, wrongly signed, oversized, replayed, concurrent and out-of-order events (`billing-integrity.test.ts`) |
| RevenueCat webhooks and purchase validation | **PASS** (server side) | Missing auth header, unknown members, replay (the server asks RevenueCat what the member owns), duplicates, transfers (`store-billing.test.ts`, `billing-integrity.test.ts`) |
| Sandbox purchases | **PASS** | Grant nothing unless the account is on the server-side tester allow-list (by user id) |
| Entitlement enforcement | **PASS** | Forged plan/tier/user fields, expired Pro, direct database writes, program builder via the API (`pro-bypass.test.ts`, `plan-enforcement.test.ts`) |
| AI usage accounting and concurrency | **PASS** (simulated model) | Atomic reservation, per-minute and monthly limits under concurrent requests (`ai-limits.test.ts`, `ai-route-limits.test.ts`, `coach-provider-limits.test.ts`) |
| Rate limiting | **PASS** | 40 simultaneous requests against a limit of 5 let exactly 5 through; window boundary can't double it |
| Admin authorization | **PASS** | Admins see aggregates only, never members' health or journal rows (`rls.test.ts`, isolation sweep) |
| Progress photos and Body Scan | **PASS** | Private buckets, owner-only paths, image types and size limits enforced (isolation sweep, `body-scans.test.ts`, `progress-photos.test.ts`) |
| Prayer journal | **PASS** | Owner-only, not even admins (`faith-calendar.test.ts`); the coach's context reads only entries marked "Share with AI Coach" (`share_with_coach` in `src/server/coach/snapshot.ts`; `faith-features.test.ts`, `tests/unit/coach-journal.test.ts`) |
| Account deletion and export | **PASS** | Export returns every table's rows for the member only; deletion removes every row, file, the RevenueCat customer and the sign-in (`account-deletion.test.ts`, isolation sweep) |
| Secrets in Git history | **PASS after one fix** | A local pattern scan over every commit on every branch (Stripe, Anthropic, OpenAI, AWS, Google, GitHub, Slack, SendGrid, Supabase, RevenueCat, private keys, JWTs) found no credentials, and no `.env`, `.p8`, `.p12` or keystore was ever committed. gitleaks in CI (449 commits, all branches) then found **one** item its generic rule catches: `scripts/perf/progress-overview-load.mjs` line 23 (commit `979b4a7`, 2026-11-03) hard-coded the fixed password the browser tests use for throwaway accounts on the local Supabase stack. It opens nothing beyond a developer's own machine, but it doesn't belong in a script: the script now generates a random password, and `.gitleaksignore` accepts that one historical finding by its exact fingerprint (no history rewrite). gitleaks now passes, and prints rule/file/line/commit (value redacted) if anything is found |
| Environment exposure | **PASS** | Only `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL` and the anon key are public; service-role, Stripe, RevenueCat, Anthropic and cron secrets are server-only (`src/server/env.ts`) |
| Demo mode in production | **PASS** | Refused on `VERCEL_ENV=production` or live Stripe approval even with `DEMO_MODE=true` (`src/lib/demo/mode.ts`, `tests/unit/demo-mode-guard.test.ts`) |
| Apple Health permissions | Code checked; **NOT RUN on a device** | Only read access is requested (`requestAuthorization({ read: … })` for steps in `src/lib/native-health.ts`, sleep and overnight vitals in `src/lib/native-sleep.ts`), when the member connects; nothing is written. Behaviour needs an iPhone |

**Confirmed vulnerabilities fixed in this RC:** none in access control. One privacy issue was introduced and fixed in
the same change: a run kept recording in the background must stop on sign-out; it does (unit and browser tests).

**Remaining concerns:** no external error monitoring (logs only); the billing reconciliation job is not scheduled by
anything in the repo (see I); legal text incomplete.

## D. Payments

| Flow | Implemented | Verified end to end |
| --- | --- | --- |
| Prices shown = prices charged | Yes: one constant; web checkout refuses a Stripe price that differs; the App Store paywall shows Apple's own localized price | Server tests; **not** against real App Store Connect products |
| Apple in-app purchase via RevenueCat | Yes | Server side only (webhook + server re-check). **NOT RUN** on a device: needs App Store Connect products, a RevenueCat project and a sandbox Apple ID |
| Stripe web checkout | Yes (test mode) | Webhooks and entitlements tested; a hosted Checkout session was **not** opened (no Stripe test keys in this environment) |
| No Pro without server verification | Yes | Tested (forged fields, replayed events, direct DB writes) |
| Restore | Yes (RevenueCat TRANSFER moves the subscription) | Server tests |
| Cancellation (access to period end) | Yes | Server tests (Stripe and RevenueCat) |
| Refund revokes | Yes (full refund ends access; partial doesn't; dispute pauses) | Server tests |
| Expiry → Free | Yes | Server tests |
| Grace period | Yes (billing issue keeps access in grace) | Server tests |
| Sandbox can't unlock production | Yes (allow-list by user id) | Server tests |
| Cross-platform | Yes (web + app: the higher plan wins; one platform per subscription, checkout refused if billed through the App Store) | Server tests |
| Duplicate subscriptions and events | Yes | Server tests (exactly-once processing under concurrency) |

## E. Workout system

Present and tested in the RC: no phantom sessions (nothing saved until the member does something); restore after
reload, crash or another device; one tap per set with a bounce guard; previous weights and reps filled in (same
program day preferred, rep ranges respected, deload weeks keep weights empty); Same as last set; skip set and skip
exercise; substitutions (done sets stay with the original); accurate volume (whole units) and personal records from
completed working sets only; rest timer with ±15 s and Skip, alerts, native notification; offline saving with
backoff retry; the backup sent the moment a set is completed and when the app is backgrounded; Finish early counts
only completed sets; completion summary with duration, volume, sets, PRs and "up next".

Still needs attention: the background backup and the rest alert with the phone locked are untested on a real phone.

## F. Exercise demonstrations and GPS

**3D retired, 2D only (2026-11-04, owner direction).** The 3D figure, its showcase page (`/train/3d` now redirects to
the exercise library), its 58 MB of model files (a third-party CC BY-SA anatomy model), tooling, tests and the
`three`/`meshoptimizer` dependencies were removed; the 3D work stays in git history (`20fc052`) and on its remote
branches. Body Scan and every other feature are untouched. Every exercise now uses one original 2D character, the
black-and-gold athlete, in one of three honest states: **animated**, **pose frames** (start and mid-rep stills,
labelled "animation in progress") or a labelled **placeholder** ("demonstration in progress"), always with the
written steps, form cues and common mistakes. Nothing is owner-approved. Details: `docs/EXERCISE_DEMOS_2D.md`;
per-exercise status: `docs/EXERCISE_DEMOS_2D_STATUS.md`. The workout card now shows the form cues, common mistakes
and a Swap button.

**Video demonstrations** (`docs/EXERCISE_DEMOS_STATUS.md`): all 157 stay on the backlog (0 completed, 1 failed, 156
missing). A clip is shown only once the owner approves it; none is.

**GPS:** leaving the Run screen mid-run keeps recording (in-app keeper and "Recording" pill). New today: a
suspend-aware clock, so fixes queued while an iPhone is locked are counted instead of breaking the route
(`docs/GPS_BACKGROUND_IPHONE.md`, unit-tested). **NOT RUN:** anything on a real phone (lock screen, app switching,
calls, battery, outdoor accuracy); GPS is not production-ready until the device tests there pass.

**AI coaching:** covered by tests against a local mock. **Live model responses: NOT RUN** (no key, $0 budget);
`docs/LIVE_AI_TEST_PLAN.md` lists what is needed (a key in a spend-limited workspace and the owner's budget approval)
and the harness's own spend ceiling.

**Operations (new, dormant until the owner switches them on):** scheduled billing reconciliation
(`.github/workflows/billing-reconcile.yml`) and redacted error monitoring (`src/instrumentation.ts`,
`/api/client-errors`); `docs/ERROR_MONITORING.md`.

## G. Test results (this RC)

| Suite | Result |
| --- | --- |
| TypeScript (`tsc --noEmit`) | PASS |
| ESLint | PASS: 0 errors (4 old warnings in demo scripts) |
| Unit (Vitest), after the 2D, ops and hydration commits | **3,198 passed** in three full runs (fewer than before because the 3D tests were removed; new: 2D readiness, GPS lock, error monitoring, hydration regression). One earlier run made while a three-browser load test was saturating the machine had 1 failure that did not repeat in the next three runs; its name was not captured, so it is listed under I |
| Integration against local Supabase (RLS, isolation, payments, AI limits, workouts, faith, sleep…) | **318 passed, 1 skipped** (live Open Food Facts test, needs internet by design) |
| Production build (`npm run build`, clean `.next`) | PASS; the post-build check confirms the hydration fix is in the browser bundle |
| Browser end to end, phone size (Chromium, Pixel 7 profile), on the build above, 130 tests | **112 passed, 0 failed, 18 skipped** (14.4 min). Skipped as before: the 17 demo-mode tests (need a demo server) and the "no AI provider" test (can't run while the AI mock is on). Includes the new 2D demonstration specs, Body Scan, workouts, GPS and the opening gate |
| Phone sweep (`e2e/phone-sweep.spec.ts`: every signed-in screen at 320–440 pt, largest text, reduced motion), three runs in a row after the hydration fix | **3/3 passed** (6.0, 5.8, 5.8 min), no hydration error (a fourth pass inside the full suite also passed) |
| Hydration #418 load test (diagnostic production build, 3 parallel browsers, 4 phone widths, 44 pages, 1,584 page loads each) | **Before the fix: 7 errors** (all through React's replay path). **After: 0 errors**, with 9 loads going through that same path and hydrating cleanly (`docs/HYDRATION_418.md`) |
| GitHub CI (`ci.yml`) on `release/rc-2026-11-04` @ `af109db`, run 41897351503 | **PASS, all jobs**: typecheck, lint, unit tests (incl. the hydration regression test), production build (incl. the post-build fix check), integration tests on a fresh Supabase (`db reset` from the 56 migrations), gitleaks over the full history, `npm audit`. On the previous commit (`1f63528`, run 41892280736) the integration job first failed before any test because port 54324 was already in use on the GitHub runner; its one re-run passed |
| iOS workflow (`ios.yml`) on the RC @ `1f63528`, run 41892280802 | **PASS, all four jobs:** offline-edition compile; unsigned Release device archive checked against App Store Connect's requirements; **the full app in the iOS Simulator** (launch, Enter Narrow Gate, relaunch, return from the background, XCUITest); WebKit opening and navigation tests at iPhone 15 size. (The earlier run, 41857518660, had its macOS jobs cancelled twice for want of a runner; this run got runners.) The signed TestFlight job is skipped unless asked |
| WebKit (iPhone profile) tests | Run by the iOS workflow only (no WebKit here) |
| Physical iPhone | **NOT RUN** (no device) |
| Live AI, real store purchases, real Stripe Checkout | **NOT RUN** (no keys/accounts; $0 budget) |

## H. Release readiness

**Ready for internal beta, and ready for a TestFlight internal build once the owner deploys a staging server.**

- For: one branch with every feature; access control, payments and AI limits verified against real requests on a
  real database; 3,198 unit, 318 integration and the full browser suite passing; the hydration error found and fixed
  at its cause; the iOS app builds, archives and runs in the Simulator on CI for this RC.
- Not "Ready for App Store review": legal pages are outlines; no real device has run purchases, Health, GPS in the
  background, notifications or the camera; live AI unvalidated; error monitoring and the billing reconciliation
  schedule are built but switched off until the owner turns them on.
- Not "public paid launch": all of the above plus real purchase testing and owner approval of the exercise
  demonstrations.

## I. Remaining work

| Pri | Item | Where | Proposed fix | Verify by |
| --- | --- | --- | --- | --- |
| P0 | Legal pages incomplete | `src/app/legal/privacy/page.tsx`, `src/app/legal/terms/page.tsx` | Counsel completes the bracketed parts; `claude/production-readiness` (`src/app/legal/*`) has fuller older text to start from, which must be updated for sleep, Health, Bible/journal sharing and background GPS | Counsel sign-off; `tests/unit/legal-config.test.ts`-style checks for no "[" placeholders |
| P0 | Real-device test pass | `docs/device-testing/DEVICE_TEST_SCRIPT.md` | Run the script on an iPhone via TestFlight: purchases (sandbox), restore, Health, GPS locked/backgrounded/calls, notifications, camera | Results recorded in `docs/device-testing/device-test-results.csv` |
| P0 | Staging deployment | `docs/STAGING_ENVIRONMENT.md` | Owner approves a staging Vercel project + separate Supabase project | `/api/health` returns the RC commit |
| P1 | Billing reconciliation: switch on | `.github/workflows/billing-reconcile.yml` (added, dormant) | Owner: merge to `main` when approved, set variable `BILLING_RECONCILE_URL` and secret `CRON_SECRET` (`docs/ERROR_MONITORING.md`) | Run log shows HTTP 200 with counts |
| P1 | Error monitoring: switch on | `src/instrumentation.ts`, `/api/client-errors` (added, redacted, off by default) | Owner: set `ERROR_REPORTING=on` and `NEXT_PUBLIC_ERROR_REPORTING=on`; point a log drain/alert at `"level":"error"` lines | A forced error appears in the log drain |
| P1 | Live AI evaluation | `docs/LIVE_AI_TEST_PLAN.md` | Owner: key in a spend-limited workspace + budget approval; then `--live --confirm-spend --max-usd 8` | Report in `docs/ai-eval/`, transcripts reviewed by a person |
| P1 | App Store products and RevenueCat project | `docs/TESTFLIGHT_SETUP_GUIDE.md` §5–6 | Create the two Pro products at $19.99/$149.99 and map them in RevenueCat | Sandbox purchase on a device unlocks Pro; refund in sandbox revokes |
| P2 | Health endpoint is liveness only | `src/app/api/health/route.ts` | Add a database check behind the cron secret | Returns 503 when Supabase is down |
| P2 | 2D demonstrations not yet animated | `docs/EXERCISE_DEMOS_2D_STATUS.md` | Fix the motions of the pose-frame and placeholder exercises, launch tier 1 first; owner reviews the athlete look | Promoted per `docs/EXERCISE_DEMOS_2D.md` §6; owner approval per exercise |
| P3 | Exercise videos (157) | `docs/EXERCISE_DEMOS_STATUS.md` | Backlog, after the 2D demos; clips must match the 2D character and need the owner's tools | Owner approval per clip |
| Done | ~~Intermittent React hydration error #418~~ | Root cause: a bug in the React build bundled with Next 15.5 (a replayed element is matched against its own first child), not app code | Fixed in `45a7017` by applying React's upstream fix at install/build time (`docs/HYDRATION_418.md`) | 1,584-load capture: 7 errors before, 0 after; unit regression test; phone sweep, see G |
| P3 | One unit test failed once under heavy machine load | Unknown test (name not captured); passed in the next three full runs | Run the unit suite under CPU load with the JSON reporter to name it, then remove its timing dependence | Unit suite passes under load |
| P3 | Upgrade to Next 16 (owner decision) | `package.json` | Next 16 bundles a React with the hydration fix; then remove `scripts/react-hydration-replay-fix.mjs` and its hooks. A major upgrade: not done without approval | Full test suite on the upgrade branch |
| P3 | Opening animation test is timing-sensitive under heavy load | `e2e/opening-gate.spec.ts` (iPhone 15 Pro Max case) | Wait for the overlay before measuring, or measure while paused | Passes repeatedly under 2 workers |

## TestFlight verification checklist

The full steps are in `docs/TESTFLIGHT.md` and `docs/TESTFLIGHT_SETUP_GUIDE.md`. For this RC:

1. Deploy `release/rc-2026-11-04` to a **staging** project (separate Supabase; Stripe test keys; `STRIPE_LIVE_APPROVED`
   unset; `DEMO_MODE` unset). Confirm `/api/health` shows the RC commit.
2. Run `ios.yml` with job = testflight, the staging address and "upload" ticked (needs owner approval and the Apple
   secrets).
3. On an iPhone: sign up (18+, consents), onboarding (five questions), first workout (pre-filled numbers, one tap per
   set, rest timer, leave and come back, finish early), Same as last set, skip set.
4. Run: start a walk, switch to Home and back, lock the phone for 2 minutes, take a call; check distance and route.
5. Purchases with a sandbox Apple ID on the tester allow-list: buy monthly, restore on a second account, cancel,
   refund via App Store Connect sandbox, let it expire; check Pro turns on and off each time. Then the same purchase
   from an account **not** on the list must grant nothing.
6. Apple Health: connect, deny one type, import a night's sleep and steps.
7. Notifications: rest-timer alert with the screen locked; workout and Faith reminders.
8. Faith: Bible reader offline, journal entry private, journey check-in.
9. Account: export data, delete account; confirm the sign-in no longer works.
10. Record each result in `docs/device-testing/device-test-results.csv`.
