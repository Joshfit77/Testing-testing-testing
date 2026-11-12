# Release-candidate verification, 2026-11-12

Branch `claude/rc-verification` (from `claude/finalization-qa`, which carries the unmerged PR #9 and PR #10 work and
the 2D exercise work). Nothing here was merged, deployed, published or charged. Every result below was produced in
the cloud sandbox (local Supabase, production build, Chromium at phone sizes) or in this repository's GitHub Actions
(macOS iOS Simulator, WebKit). **None of it is a physical-iPhone result, and no Apple, Google or RevenueCat sandbox
purchase was made.**

## 1. Recommendation

**Ready for a private TestFlight build, once the owner approves it. Not ready for a public launch.**

- No open Critical or High defect. Four defects found during this pass were fixed with tests: a duplicate-save race
  when a workout was finished twice, the AI-consent check order, water logging offline, and the workout screen at
  200% text.
- What remains for TestFlight is owner work: approve the build, Apple signing secrets, a deployed server URL. See
  `docs/release/` for the steps.
- Public launch needs the items in section 8: real purchases in Apple's and Google's sandboxes, the physical-iPhone
  script, the two owner decisions (T8, T10) and the Medium usability findings.

## 2. Test results on the final commit

| Check | Result | Where |
|---|---|---|
| Typecheck, lint | pass | sandbox |
| Unit | 3,630 passed (201 files) | sandbox |
| Integration (real local Postgres, from `supabase db reset`) | 357 passed, 1 skipped | sandbox |
| Production build | pass | sandbox |
| Browser suite, production build, phone-size Chromium | 125 passed, 0 failed, 99 skipped | sandbox |
| Demo-mode browser suite (8 specs, the 58 demo tests) | 57 passed, 0 failed, 1 skipped | sandbox |
| CI workflow (`ci.yml`) | pass on 927e878; rerun queued on b879ef1 | GitHub Actions |
| iOS: unsigned compile, Release archive check, app in the iOS Simulator (launch, Enter, relaunch, background) | pass on 927e878 | GitHub Actions, macOS |
| iOS: opening and navigation in WebKit | 20 passed, 1 failed on 927e878 (see note); rerun queued on b879ef1 | GitHub Actions |
| Every iPhone size in WebKit (device matrix) | pass on 927e878; rerun queued on b879ef1 | GitHub Actions |

Notes:
- The one skipped demo test (`ux-progress-sleep.spec.ts:47`, stage-chart labels) skips when the newest sample night
  has no sleep stages. The seeded data has none on that night, so there was nothing to check, not a failure.
- The WebKit failure on 927e878 was the navigation test reloading Home before the "hide Verse of the day" setting had
  saved: it waited a fixed 800 ms. The test now waits for the save to answer (b879ef1). Until the rerun passes, that
  check counts as not yet verified in WebKit.

## 3. Branch review

`claude/rc-verification` = `claude/finalization-qa` + the fixes below. The finalization branch was reviewed in
`docs/quality/FINALIZATION_REPORT_2026-11-11.md`. No merge conflicts with `main`'s history were introduced here.
The branch carries about 233 commits that no human has reviewed (PR #9, PR #10, the 2D work and both QA passes).
**A review PR is the owner's call. None was opened.**

Commits added in this pass:

| Commit | Change |
|---|---|
| 322729c / 432bfb9 | Water logging idempotency (migration 058) and the full nutrition basis kept on cached foods (migration 059) |
| 0b6bd2e and the follow-up fix | Physical-iPhone test script, `docs/release/IPHONE_TEST_SCRIPT.md` (85 cases) |
| 93999dd | Evidence tests for subscriptions, isolation, deletion, AI consent, workout persistence |
| 927e878 | Workout finish claimed atomically (migration 060); AI consent checked before the rate limit |
| f3b7800 | Water offline: diary stays, "Couldn't save", retry adds one |
| 2ef0be8 | Workout screen at 200% text |
| b879ef1 | Navigation test waits for the save |

## 4. Issue register

See `docs/quality/ISSUE_REGISTER_2026-11-11.md`.

- **Before this pass:** 29 findings. 24 were counted fixed, with N7 counted although its water part was still open.
- **Now:** 25 are fully fixed (N5 and N7's water part are done).
- **Still open:**
  - B1: the Google Play billing interval, which needs the Play sandbox.
  - B7: membership screen polish.
  - T8: an owner decision on the first lift's weight.
  - T10: an owner decision on the journey time zone.
- **Migrations:** N5 (059), N7 water (058), the new R1 (060), and T10 once it's decided. Each file opens with its
  rollback.

Found and fixed in this pass:

| # | Sev | Defect | Fix | Acceptance (all met) |
|---|---|---|---|---|
| R1 | M | Two finishes of one workout at once saved every set twice | Conditional claim on the session (migration 060); others wait and report "already saved"; a claim older than 2 min can be taken over | 4 simultaneous finishes, with and without a draft: 1 session, 1 exercise, 2 sets, no repeated record type; a later retry adds nothing (`tests/integration/workout-finish-concurrency.test.ts`, 3 tests) |
| R2 | L | An AI request without consent used up the burst rate limit | Consent checked first | `tests/integration/ai-consent.test.ts` (5 tests) |
| U-H2 | H | Water tapped offline replaced the Nutrition page with the error screen and lost the tap | Offline taps aren't sent; "Couldn't save" in place; retry keeps the id | Diary stays; one retry online adds exactly one glass (2.35 → 2.60 L, same after reload); unit test |
| U-H1 | H | At 200% text the workout screen was 545 px wide on a 375 px phone, the name showed one letter per line, the inputs were about 12 px | Name wraps under the picture; weight and reps stack (rem-sized); button rows wrap; set table scrolls in its own box | At 375 px and 200%: page 375 px wide, inputs 128 px, name wraps; 320/375/430 at normal text unchanged |

Usability findings not fixed in this pass. Each has an acceptance criterion so it can be picked up as it stands.
Screenshots are in the sandbox usability folder, not in the repo.

| # | Sev | Finding | Accept when |
|---|---|---|---|
| U-M1 | M | Onboarding is 524–643 px wide at 200% text; Continue is partly off-screen | No sideways scroll at 200% on every onboarding screen |
| U-M2 | M | At 375 and 320 px, "Complete set" is below the bottom bar on first view; at 320 the weight field is too | Weight, reps and Complete set visible without scrolling at 375 × 667 |
| U-M3 | M | After logging a set the rest timer has scrolled 72–121 px above the top | Countdown and Skip rest visible right after logging |
| U-M4 | M | One tap logs a barbell set with no weight (owner decision T8) | A loaded lift asks for weight, or confirms bodyweight, before logging |
| U-M5 | M | Food entries aren't kept offline, but the offline banner says data "keeps saving on this device" | The banner says only workouts are kept, or food is queued |
| U-M6 | M | Weight and reps −/+ buttons are 26 × 44 px | ≥ 44 × 44 px without making the inputs unusable at 320 px |
| U-L1–13 | L | 13 Low items, for example: Continue below the fold on 3 of 5 onboarding screens at 375, a stale offline banner after reconnecting, 4.37:1 contrast on "You're all set", no h1 on the workout screen | Per item |

Checked clean in the same review:
- Workout logging: edits persist across a reload; rest ±30 s and Skip work; the summary volume is correct.
- Workout offline: sets and edits are kept and sync on reconnect.
- Nutrition: search, quick add, water with undo, edit and delete all work, and the totals match after a reload.
- Faith: reading, journey check-in and journal all work.
- Reduced motion is respected.
- axe found no violations on 7 screens.
- Slow 3G: Home loads in 4.2 s, Nutrition in 2.7–4.1 s.

First workout, from the welcome screen to the first logged set: 13 taps and 4 typed fields, about 6–7.5 s when
scripted.

## 5. The 99 skipped browser tests

The 99 skips break down as follows:

- **58 need a demo server.** 41 of them had never been run by any workflow (CI's `demo-preview.yml` runs only
  `demo.spec.ts`). All 58 were run in this pass: 57 passed and 1 skipped because of the data (section 2).
- **41 are opt-in by design:**
  - 39 are the device matrix, which CI's `webkit-matrix` job runs.
  - 1 is the button sweep.
  - 1 is "coach not configured", which only runs against a server started without an AI key.
- **0 skips are unexpected.**

Commands are in the sandbox audit (`skipped-tests.md`). The demo set:
`E2E_DEMO=1 E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/demo.spec.ts e2e/demo-reset.spec.ts e2e/achievement-progress.spec.ts e2e/ux-*.spec.ts --project=mobile`.

Not run in this pass: the button sweep and "coach not configured". Both passed in earlier passes. They're listed so
nobody assumes otherwise.

## 6. Launch matrix

Key:
- **A** = automated test against a real local database or a production build.
- **CI** = GitHub Actions (iOS Simulator or WebKit).
- **Sim** = simulated only: a stand-in for an external service.
- **Dev** = needs a physical iPhone.
- **SB** = needs Apple, Google or RevenueCat sandbox.
- **—** = untested.

| Area | Status | Still needed |
|---|---|---|
| Sign up, sign in, reset, sign out, delete account (rows, files, auth user, sessions revoked) | A | Dev: Keychain/autofill |
| Data isolation (read, write, insert, delete, every user table; storage) | A | — |
| Onboarding and first workout | A, CI (WebKit) | Dev: one-handed use |
| Workout logging, offline, retry and concurrent finish | A | Dev: app killed mid-workout |
| Personal records, volume, program advance | A | — |
| Nutrition: search, barcode (mocked food database), quick add, water, edit, delete, offline | A (barcode lookups via a mock of Open Food Facts) | Dev: real camera scanning |
| Food photo / label photo AI | Sim (mock AI provider) + consent gates A | Live provider run with an approved key |
| AI coach: answers, quotas, consent, safety rules | Sim (mock provider) + A | Live provider evaluation |
| Faith: Bible, journeys (strict restart), journal, prayer privacy | A | T10 decision |
| GPS running | A with recorded traces | Dev: real GPS, background, lock screen |
| Apple Health / Health Connect | Unit tests of the mapping | Dev |
| Sleep | A | Dev: Health import |
| Notifications and reminders | A (planner) | Dev: delivery, deep links |
| Subscription logic (renewal, cancel, expiry, refund, grace, restore, transfer, webhook idempotency, account switch) | A against a RevenueCat stand-in and Stripe test signatures | **SB: every item. Unverified until done.** |
| Prices $0 / $19.99 / $149.99 | A | SB: store-localized display |
| iOS app opens, Enter Narrow Gate, relaunch, background | CI (Simulator) | Dev |
| Layout on every iPhone size | CI (WebKit), A (Chromium) | Dev |
| 200% text | A (workout fixed; onboarding U-M1 open) | Dev: iOS Larger Text |

## 7. Subscription and data-safety evidence

Each behaviour in the RC request has a test reference in the sandbox evidence map, `evidence-map.md`, about 58
behaviours in all. They fall into four groups:

- **Covered by tests that already existed (about 38):** entitlement states, renewal, cancel at period end, expiry,
  refund and chargeback, the 14-day grace, restore and transfer, webhook duplicates, concurrent and out-of-order
  delivery, signature checks, isolation, deletion, offline and retry idempotency, persistence.
- **Covered by tests added in this pass (about 20):**
  - trialing and paused states
  - the renewal date
  - switching store identity between accounts
  - generic update and insert isolation over every table
  - deleted-session tokens
  - AI consent for coach, meal plan, photo and Bible features
  - the concurrent workout finish
- **Not verifiable without a sandbox or a device:**
  - real App Store and Play renewals and notifications
  - the same Apple ID on two accounts, and Restore on a device
  - a native app kill
- **One gap:** retrying the label-photo log is covered only at the database-index level, not at the action level.

## 8. Before a public launch (owner and device work)

1. Run `docs/release/IPHONE_TEST_SCRIPT.md` on a physical iPhone via TestFlight.
2. Apple sandbox and RevenueCat: purchase, renewal, cancel, expiry, refund, Restore, and the same Apple ID on two
   accounts. Do the same for Google Play, which also closes B1.
3. Decide T8 (the first lift's weight, which is U-M4) and T10 (journey time zone policy, needs a migration).
4. Fix U-M1 to U-M6 and B7.
5. Run the AI coach and food photo against the live provider with an approved key, and record the measured cost.
6. Review and merge the branch. This is the owner's decision; nothing has been merged.
