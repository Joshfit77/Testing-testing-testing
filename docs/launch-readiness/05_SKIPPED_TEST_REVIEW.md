# 05 · Skipped-test review (2026-11-17)

Every test that the default runs skip: why it is skipped, whether it was run here, the result, and how to test what
cannot be run here. Local stack only: a production build, local Supabase with synthetic accounts, and local stand-ins
for the AI provider and Open Food Facts. Skipped tests are never counted as passes. No assertion was weakened and no
test was deleted.

## 1. Summary

The default browser run skips **101** tests. One unit test and one integration test are also skipped by default.
These 103 tests all sit behind deliberate opt-in guards: a demo server, a long audit, a live network, or photographs
not yet supplied. None is skipped because it is broken.

| Group | Tests | Why skipped by default | Run here? | Result |
|---|---|---|---|---|
| Demo-server specs (`demo`, `achievement-progress`, `ux-*`, `demo-reset`) | 58 | Need the app started in demo mode with the sample account (`E2E_DEMO=1`) | **Yes**, on the release-candidate build | First run: 57 passed, 1 skipped. The skip was a **test defect** (section 3), now fixed: 58 of 58 run and pass |
| `device-matrix` | 39 | Long audit (about 26 min): every main screen on 74 phone models (`E2E_DEVICE_MATRIX=1`) | **Yes**, release candidate | 39 passed; 0 problems in the report |
| `button-sweep` | 1 | Long audit (about 16 min): taps every safe control on every main screen (`E2E_BUTTON_SWEEP=1`) | **Yes**, release candidate | 1 passed: 49 pages, 283 controls, 0 findings |
| `coach` "says honestly when the coach isn't configured" | 1 | Needs the app started **without** an AI provider; the default run starts it with the stand-in | **Yes**, separate server on port 3011 with no AI key | 1 passed |
| `home-backgrounds` (2 browser tests) and the unit test "each picture is a separate WebP file" | 3 | The Home photographs are not supplied yet (`HOME_BACKGROUND_PHOTOS_READY` is off; F10 in the founder items) | **No.** Running them needs the owner's licensed photographs in `public/` and the switch on. Stand-in pictures would test pictures that will never ship | Not run. The opposite check runs and passes in every default run: "no picture is shipped until the owner's photographs are approved" |
| `food-quality-live` (integration) | 1 | Calls the real Open Food Facts service (`OFF_LIVE=1`) | **No.** The host is allowed in this environment, but this session's safety policy refused the live call; it was not worked around | Not run. You can run it (section 5) |

Conditional guards that did **not** skip in these runs: `production-no-demo` (2 guards: skips only on a demo server or
another checkout's build), `faith-journey` (skips only if the AI stand-in's port is already taken), the coach
stand-in guards (skip only without `E2E_ANTHROPIC_MOCK_PORT`), and `ux-progress-sleep` "stage chart" (skips only if
the latest sample night has no stages; see section 3).

## 2. What was run, and the results

Two builds were tested, each on a freshly reset local database, with a fresh production build:

- **Release candidate** `claude/rc-offline-fix` 8ea238f (= `release/testflight-rc-2026-11-15` 56500ff plus the
  offline fix), build `kcTcnmqug6Rxfvye52Kyr`, 68 migrations.
- **Remediation** `claude/legal-remediation` cda6262 (everything in this pass), build `6Rt3QLhny12duGd1BYBso`, 69
  migrations.

### 2.1 Default suites (what every run includes)

| Suite | Release candidate | Remediation |
|---|---|---|
| Type check `npx tsc --noEmit`; lint `npx eslint src tests e2e` | clean; clean | clean; clean |
| Unit `npx vitest run --project unit` | 256 files; **4,713 passed, 0 failed, 1 skipped** | 260 files; **4,741 passed, 0 failed, 1 skipped** |
| Integration `npx vitest run --project integration` | 80 files; **467 passed, 0 failed, 1 skipped** | 84 files; **513 passed, 0 failed, 1 skipped** |
| Browser `npx playwright test --project mobile --workers 2` (stand-ins for the AI provider and Open Food Facts) | 248 tests; **147 passed, 0 failed, 101 skipped** (12.0 min) | 255 tests; **154 passed, 0 failed, 101 skipped** (13.0 min; clean rerun, see 2.4) |

The unit skip in both is the Home photographs test; the integration skip in both is `food-quality-live`. The 101
browser skips are the opt-in groups in section 1, run separately below.

### 2.2 The opt-in groups, run separately

| Group | Release candidate | Remediation |
|---|---|---|
| Demo server (58) | **57 passed, 0 failed, 1 skipped** (the stage-chart test, section 3); with the fixed test: 5 of 5 in its file passed, 3 runs in a row | **58 passed, 0 failed, 0 skipped** (3.0 min) |
| Device matrix (39) | **39 passed, 0 failed**: 74 phone models, 2,964 screens, 0 problems, 0 navigation retries (25.7 min) | **39 passed, 0 failed**: 74 models, 2,964 screens, 0 problems, 0 retries (24.2 min) |
| Button sweep (1) | **1 passed**: 49 pages, 283 controls tapped, 0 findings (15.8 min) | **1 passed**: 49 pages, 285 controls, 0 findings (15.7 min) |
| Coach with no AI provider (1) | **1 passed** | **1 passed** |
| Home photographs (2 browser, 1 unit) | not runnable (missing assets) | not runnable |
| Live Open Food Facts (1 integration) | not run (live network refused here) | not run |

### 2.3 Totals, counting each test once (remediation build)

| Kind | Tests | Passed | Failed | Skipped |
|---|---|---|---|---|
| Unit | 4,742 | 4,741 | 0 | 1 (Home photographs) |
| Integration | 514 | 513 | 0 | 1 (live Open Food Facts) |
| Browser: default 154 + demo 58 + device matrix 39 + button sweep 1 + coach without provider 1 | 255 | 253 | 0 | 2 (Home photographs) |
| **All** | **5,511** | **5,507** | **0** | **4** |

On the release candidate the same groups give: unit 4,713 of 4,714; integration 467 of 468; browser 147 + 57 + 39 + 1
+ 1 = 245 passed of 248, 0 failed, 3 skipped (the 2 Home photograph tests, and the stage-chart test before its fix,
which passes on that build once fixed). The release candidate has fewer tests because it lacks this pass's new tests.

The 4 remaining skips on the remediation build (and the matching skips on the release candidate) are explained in
section 1 and planned in section 4. None is skipped because it fails.

### 2.4 A run that was discarded

The first browser run of the remediation suite reported 148 passed and 6 failed. It was invalid: a release-candidate
server left over from the previous run still held port 3009 (stopping `npx next start` had not stopped its
`next-server` child), so the remediation server failed to start (`EADDRINUSE` in its log) and the remediation tests ran
against the release-candidate build. The six failures were exactly the tests that differ between the two builds
(the reliability fixes, changed wording, the demo action ids). The stale server was stopped, the run script now stops
servers by process and aborts if the port is taken, and the suite was run again (row above). Every other run's server
log was checked: each started on its own port.

## 3. Defect found and fixed (test setup)

| Test | Problem | Fix | Evidence |
|---|---|---|---|
| `e2e/ux-progress-sleep.spec.ts` "the stage chart's time labels don't overlap" | The guard `test.skip(axis.count() === 0, "the latest sample night has no stages")` ran as soon as the URL changed. That is before the night's page has rendered, so it always counted 0 and skipped. The sample night **has** stages (18 recorded; the page draws them and the axis). The test had never really run | Wait for the "Sleep stages" heading before counting (commit cda6262). The assertions are unchanged, and the guard still skips if a night genuinely has no stages | Diagnosed with a temporary probe (deleted): at the moment of the check, the night page's `figure` count was 0; once rendered, `stage-axis` was present. After the fix: 3 of 3 runs passed against the release-candidate build |

No application defect was found by the newly run tests.

## 4. Remaining skips, with a test plan for each

### 4.1 Home photographs (2 browser tests, 1 unit test): missing assets

Blocked on: the seven Home photographs with a licence or model release for each (F10). When supplied:

1. Convert each to WebP, under 150 KB, and place it at the path in `src/lib/home-backgrounds.ts`.
2. Turn `HOME_BACKGROUND_PHOTOS_READY` on.
3. Run `npx vitest run --project unit tests/unit/home-backgrounds.test.ts`. Expect the WebP, size and distinctness
   checks to pass; the "no picture shipped" test then returns early by design.
4. Rebuild and run `npx playwright test --project mobile e2e/home-backgrounds.spec.ts`. Expect all 5 to pass,
   including the two offline tests: the next day's picture is served from the browser cache with the network off.
5. On an iPhone: Home in Airplane Mode the next day still shows a picture.

### 4.2 Live Open Food Facts (1 integration test): live service

Run it yourself (it makes a few free, read-only requests to `world.openfoodfacts.org`; nothing is purchased):

```
OFF_LIVE=1 npx vitest run --project integration tests/integration/food-quality-live.test.ts
```

Expect: real products are read by barcode, with the fields the app relies on. If it fails, record the barcode and the
error. Also scan three real products on a phone (device test DV-08).

### 4.3 What no automated test here covers: hardware, live services and subscriptions

These are not skipped tests; there are no tests for them in this environment. They are listed so that a green suite is
not read as covering them.

| Area | Why it can't run here | Plan |
|---|---|---|
| Physical device: background, lock screen, app kill, low memory, GPS, camera, Apple Health, notifications, native offline launch | Needs an iPhone and an Android phone | `04_RELIABILITY_CLOSURE.md` §5, DV-01 to DV-17; `docs/release/IPHONE_PLAN_2026-11-15.md` |
| Native purchases, restore, refund, renewal, expiry; RevenueCat and App Store Connect setup | Needs sandbox accounts and a device; no real purchase may be made | `02_SUBSCRIPTION_SECURITY_CLOSURE.md` §5, items 1–9 (sandbox only) |
| Live AI behaviour and cost | Every AI test uses a scripted stand-in; a live call costs money | A capped staging key, then the evaluation set in `docs/ai-eval` |
| Hosted environment: keys, cron, backups, logs, email | Nothing hosted is reachable or was touched | Staging checklist in `docs/STAGING_ENVIRONMENT.md` |
| A real service-worker update between two deployed versions | Needs two deployments | Deploy build A to staging, start a workout offline, deploy build B, reopen: every set present |
