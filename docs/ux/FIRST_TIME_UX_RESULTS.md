# Narrow Gate Fitness: first-time UX results and final integrity audit (November 9, 2026)

Branch `claude/first-time-ux`, against `claude/faith-discipleship` (6c0832f). Nothing is merged, deployed, or connected
to real payments.

This document follows on from `FIRST_TIME_UX_AUDIT.md`, which holds the baseline, the ranked issue list and the
method. Every number below was measured on this branch unless it says otherwise.

How each result was verified is stated with it:
- **Browser-verified:** checked in Chromium at phone size against a local server, using the local database only.
- **Estimate:** a modelled time, not a measurement of a person.
- **Not tested:** needs a phone or a person (§10).

## 1. Summary

- **Production browser suite:** final run on a clean database: 123 passed, 0 failed (§2). The first run had 9 failures, explained in §3:
  - 6 were outdated selectors (letter case);
  - 1 was a test checking at the wrong moment;
  - 1 was an outdated assertion after an intended change;
  - 1 was a real app regression, now fixed.
- **Defects found in this audit and fixed:**
  - The meal planner showed members on the old Plus plan the Pro lock wording on a tool they already pay for.
  - After a one-tap re-log, the food log put "Logged …" and its Undo behind the phone tab bar. This defect was
    confirmed by a test that fails without the fix.
- **New regression tests:**
  - A brand-new member's dashboards start empty and honest.
  - A workout survives connectivity loss, a refused save and backgrounding, checked from a second signed-in browser.
  - The Undo stays clear of the tab bar.
- **Demo reset:** it resets only the sample account. This is proven three ways:
  - an integration test;
  - the command-line reset run against a live new-member account;
  - the in-app Reset spec.
- **Badge branch (PR #9):**
  - The trial merge has no conflicts.
  - The merged tree typechecks, passes 3,501 unit tests and 336 integration tests, builds, and passes the production
    browser suite.
  - Nothing was merged.
- **Performance:** no regression, by alternating A/B runs, including an account with 435 workouts and 7,590 sets.
  Programs has 46% fewer page elements and Exercises 26% fewer.
- **Onboarding to the first workout:** still 19 interactions. A finished, saved first workout takes 39 in total.
  §5 lists the steps that could still go.

## 2. Test results

| Suite | Result | Notes |
|---|---|---|
| Production browser suite, clean database, final app build (`b394120`; later commits change docs and tests only) | **123 passed, 0 failed**, 84 skipped (listed below) | Pixel 7 profile, production server with the local AI and Open Food Facts mocks |
| "Coach isn't configured" (skipped above because the mock AI is on) | 1 passed | Run on a production server with no AI provider |
| Demo-mode browser suite (`E2E_DEMO=1`, one worker) | **42 passed, 0 failed**, 1 skipped (the stage-chart check: the latest sample night has no stages; the same check runs in production in `sleep.spec`) | Includes the five `ux-*` specs, `demo.spec`, `demo-reset.spec` |
| Unit (vitest) | 3,463 passed | |
| Integration (vitest, local database) | 332 passed, 1 skipped | Skipped: the live Open Food Facts test (opt-in, outside network) |
| Typecheck, lint | clean | `tsc --noEmit`; eslint on changed files |
| Badge trial merge (§8) | see §8 | Merged tree only; nothing pushed |

**Skipped in the production suite (84), and why:**
- **39 `device-matrix` tests:** opt-in layout audit across every phone model (`E2E_DEVICE_MATRIX=1`). These ran
  during the earlier launch audit, not in this pass.
- **43 demo-mode tests:** need a demo server. They ran separately; see the demo row above.
- **1 `button-sweep` test:** an opt-in audit tool.
- **1 coach test:** needs a server without an AI provider. It ran separately; see the row above.

## 3. Every failure found, and what it was

| Where | Test | Class | What happened | Resolution |
|---|---|---|---|---|
| Production run 1 | `coach:285`, `core-flow`, `current-set-card`, `journeys:18`, `training-review`, `workout-reliability` | Outdated selector | Home's button became "Start today's workout · 43 min"; the tests matched "Start Today's Workout" case-sensitively | Selectors made case-insensitive (`/^Start (Today's Workout\|workout)/i`); same intent. All six pass |
| Production run 1 | `features:94` | Test order | Asserted "Faith stays free" was on the first screen *after* tapping Yearly, which scrolls | Assertion moved to page load. "Faith stays free" is on the first screen at load: an app pass, not a weakened check |
| Production run 1 | `memberships:59` | **App regression** | The planner's AI summary said "Included with Pro All Access" to legacy Plus members, who own the planner | Wording now "Pro adds AI-arranged plans" (`nutrition/planner/page.tsx`); test unchanged and passing |
| Production run 1 | `training-stage2:13` | Outdated assertion after an intended change | The program card's "Complete: … (80%)" line was removed on purpose (audit TR2) | Card assertion removed; the detail page's "Complete at least 80% of the 18 sessions" assertion stays |
| Demo run | `ux-nutrition:40` (new check) | **App defect** | After a one-tap re-log with four or more recent foods, the Undo sat at y≈787 behind the tab bar (y=783) | `LoggedUndo` scrolls the confirmation into view when it is covered (details below). It failed 1 of 2 runs before the fix and passed 5 of 5 after |
| Demo runs before this audit | `ux-*`, `demo` | Shared test account | Parallel workers changed the one sample account under each other | `playwright.config.ts` runs demo specs on one worker (`E2E_DEMO`) |
| Badge trial merge | `new-member-states` (new in this audit) | Brittle new check | Matched the text "0 / 1 workout", which the badge branch's added progress line also contains | Matches the rank's exact text; passes on both trees |
| UX harness | j15 (Undo a food) | Harness bug | `isVisible({timeout})` does not wait; "Undo" also matched the water card's "Undo last water entry" (a distinct accessible name, not an app issue) | Exact name inside Recent foods, and a real wait |
| UX harness | first-workout count | Harness bug | Tapping Complete set within 700 ms of the last set hit the logger's deliberate double-tap guard (`CARD_DOUBLE_TAP_MS`) | Harness waits for the set counter and 0.75 s; every set then registers on one tap |

**Why the first Undo fix was not enough:**
- The first fix measured the tab bar with `querySelector('nav[aria-label="Main sections"]')`.
- The hidden desktop sidebar has the same label and comes first, with zero size, so the check fell back to the
  window bottom.
- It now measures only the visible bar.
- I found this from a failing run, not by inspection.

No test was skipped, quarantined or loosened to get a pass. Infrastructure caused no failures in the final runs. One
earlier run was disturbed by a leftover server process (`next-server`); the result was discarded and the suite re-run.

## 4. Data integrity

| Check | How | Result |
|---|---|---|
| Demo reset touches only the sample account | `tests/integration/demo-reset-scope.test.ts`: the sample's row is removed and re-seeded; another member's water entry, profile, empty history and sign-in are unchanged | Passes |
| `npm run demo:reset` against a real new-member demo account | A new member created through the app (a saved first workout), plus a marker water entry for each account; then the command | Sample's marker gone, 29 workouts re-seeded. New member's workout, water entry and profile checksum unchanged. Account count unchanged (2) |
| In-app "Reset demo" | `e2e/demo-reset.spec.ts` (demo suite) | Passes |
| Parallel demo tests | Demo specs forced to one worker | No cross-test interference in the final demo run |
| New member's dashboards | `e2e/new-member-states.spec.ts` (production, real sign-up). Checks Home, Faith, Coach, Badges, Overview, Sleep, Recovery, Run, Train, Nutrition and Progress (detail below) | Passes |
| Workout data on connection loss | `e2e/workout-data-preservation.spec.ts`: a set logged offline shows "Saved on device", syncs on reconnect, and appears on a second signed-in browser | Passes |
| A save the server refuses (HTTP 500) | Same spec: the set is kept on the device and the logger's own retry lands it (checked from the second browser) | Passes |
| Backgrounding | Same spec: a weight typed and the page hidden at once is sent within 38 ms (the typing pause alone would wait 2 s) and reaches the account | Passes (browser approximation of app backgrounding) |
| Tab switching and reload mid-workout | `journeys.spec:18` | Passes |
| GPS recovery (leave the recorder, reload, sign out mid-walk) | `gps-run.spec` (8 tests) | Pass (simulated positions; not a device) |
| Journal and manual-food drafts | `journeys.spec` (journal draft; food manual-entry draft) | Pass |
| Undo after logging food (every path) | `ux-nutrition.spec` (re-log, saved meal), `journeys` j15 in all three account states | Pass |

**What the new-member spec checks:**
- Home shows today's workout and 0 workouts this week, with the Bible starting at John 1. There is no "Day N of 40".
- Faith has no journey and offers one.
- The Free coach shows one card with three starter questions built from the member's own plan, plus the price.
- Badges: every rank is "Not started".
- Overview has no trend drawn from nothing.
- Sleep asks for consent first. No sleep score, hours or debt appear.
- Recovery reads "No check-ins yet".
- Run: GPS is marked Pro, and logging by hand is offered.
- No page shows NaN, undefined or null.

Manual sleep logging after consent and Free manual run logging have their own production tests: `sleep.spec` and
`run.spec`. Both pass.

## 5. First-time journey

**Onboarding, from the login screen to the first workout: 19 interactions across 7 screens.** This is the same as the
baseline; onboarding was not changed in this pass.

| Step | Interactions |
|---|---|
| "Start as a new member" | 1 |
| Goal, then Continue | 2 |
| Experience, then Continue | 2 |
| Days, session length, then Continue | 3 |
| Equipment, then Continue | 2 |
| Sex, age, height (ft), height (in), weight, then Continue | 6 |
| "Build my plan" | 1 |
| Start the first workout from the plan screen | 1 |

**To a saved first workout: 39 interactions** (browser-verified, `scripts/ux/onboarding.mjs`). That is the 19 above,
then:
- 6 typed weights, one per exercise; each carries down to the next set;
- 12 taps on Complete set, one per set; reps come prefilled;
- 2 taps to finish: Finish workout, then Finish & save.

The completion screen shows 12 sets, 6 of 6 exercises, and "Up next" with the next session.

**Steps that could still go.** These are proposals, not built, since further redesign was out of scope:
1. **The four Continue taps after single-choice questions** (goal, experience, equipment, days/length). Moving on
   automatically would save 4 interactions.
2. **Height and weight up front.** Sex, age, height and weight could be optional for a first workout, since only
   calorie targets need them. That would save up to 6 interactions, at the cost of target accuracy until they are
   given.
3. **The plan screen's separate start tap.** Starting from Home is already one tap; landing on Home with the workout
   card first would make the plan screen optional.

## 6. Task journeys, three account states

These are interactions (taps plus typed fields); "scr" means scrolls. The run is scripted from Home at
393 × 852 px, with on-device storage cleared before each task. Times in `scripts/ux` are estimates.

| Task | New: before → after | Occasional: before → after | Established: before → after |
|---|---|---|---|
| Start today's workout | 1 → 1 | 1 → 1 | 1 → 1 |
| Log one set | 2 → 2 | 2 → 2 | 1 → 1 |
| Log a familiar food | 5 → 5 (search) | 2 → 2 (one-tap) | 2 → 2 (one-tap) |
| Start outdoor GPS | **blocked**, no free path → **free path offered** first ("Log a run or walk by hand (free)") | 3 → 3 | 3 → 3 |
| Treadmill session | 7, 3 scr → 7, 3 scr | 7, 1 scr → 7, 1 scr | 7, 1 scr → 7, 1 scr |
| Find the Sleep dashboard | 1, 1 scr → 1, 1 scr | 1, 1 scr → 1, 1 scr | 1, 1 scr → 1, 1 scr |
| Log last night's sleep by hand | 5, 2 scr → 5, 2 scr | 3, 2 scr → 3, 2 scr | 3, 2 scr → 3, 2 scr |
| Continue today's Bible reading | 1, 1 scr, **to the 66-book index** → 2, **to John 1** | 1, 1 scr → 1, 1 scr (today's passage) | 1, 1 scr → 1, 1 scr (today's passage) |
| Write a private prayer | 4, 1 scr → 4 (Save on screen) | 4, 1 scr → 4 | 4, 1 scr → 4 |
| Ask the coach a suggested question | **blocked**, disabled chat, no price → one card with beginner questions and the price | 2 → 2 | 2 → 2 |
| Find billing / My Progress / Programs | 2 / 2 / 2 → unchanged | unchanged | unchanged |
| Sleep from Quick add (new) | — → 5 (includes the one-time consent; saved) | — → 3 | — → 3 |
| Undo a food just logged (new) | — → 3 | — → 3 | — → 3 |

**About the sleep rows:** for the occasional and established members, last night is already in the sample data. The
app correctly refuses a second entry for the same night ("This overlaps the sleep you logged…"), so those rows
measure the path to Save. On a fresh new member, Quick add's sleep entry saves.

**Programs and Exercises discoverability:**
- For every member, both are rows on the Train tab's first screen, 2 taps from anywhere, with no scrolling.
- Their lists are now 9.1 and 12.5 screens long (previously 24.4 and 23.9).
- The Programs list shows 3 programs per category with "See all N".
- The Exercises list opens with one-tap muscle chips and "More filters".
- The browser tests cover search, filters kept in the URL, categories, and muscle and difficulty filters
  (`training-stage2.spec`).

## 7. Screens: clean recapture of all routes, three states

These captures were made after a database reset and seed, with the occasional member re-seeded; 90 routes for
established and occasional, 85 for new. The demo-only bar was hidden. There were no error pages, console errors or
failed requests, and no horizontal overflow, in any state.

| | Established, before → after | Occasional | New |
|---|---|---|---|
| Total height (screens, all routes) | 289.7 → 251.3 | 275.9 → 238.5 | (85 routes) |
| Words | 27,688 → 26,853 | 26,121 → 25,354 | 23,208 → 22,029 |
| Controls under 44 px | 469 → 198 | 457 → 202 | 171 → 98 |

**Largest reductions (screens tall):**

| Screen | Before | After |
|---|---|---|
| Programs | 24.4 | 9.1 |
| Exercises | 23.9 | 12.5 |
| Billing | 6.0 | 2.8 |
| Recovery | 5.0 | 2.3 |
| Sleep (established) | 6.1 | 4.1 |
| Meal planner | 3.1 | 1.6 |
| Journey schedule | 10.4 | 8.9 |
| Supplements | 9.3 | 7.9 |

**Grew:**
- Profile, 3.9 → 4.4 screens. It now has the Privacy & permissions list, which gathers 7 privacy controls in one place.
- A few pages by 0.1 to 0.3 screens.

**Before and after comparisons** are in `docs/ux/screenshots/2026-11-09/`:
- new member: Home, Coach, Run, Faith, Sleep;
- established member: Home, Programs, Exercises, Billing, Sleep, Recovery, Nutrition.

## 8. Badge branch (PR #9) compatibility, without merging

- **Trial merge:**
  - `git merge-tree` of `claude/badge-progress` (`eceaf0a`) into this branch gives no conflicts.
  - The only file both branches changed is `e2e/training-stage2.spec.ts`, in different places.
  - None of the badge branch's 29 files were edited here.
- **Merged tree** (built in a scratch worktree on a commit that is on no branch):
  - typecheck is clean;
  - 3,501 unit tests pass;
  - 336 integration tests pass (1 opt-in test skipped);
  - `next build` succeeds;
  - the production browser suite gives 119 passed, 0 failed (run before this audit's last fixes; re-checked below).
- **Re-checked at the final head** (`c460f53` merged with `eceaf0a`; again no conflicts; typecheck clean; build
  succeeds):
  - **Production mode, specs nearest the overlap, 28 tests:** new member, workout data preservation, sleep,
    memberships, features, training, core flow, run, current-set card, workout reliability, journeys. 27 passed on the
    first run. My new `new-member-states` check failed: it matched the text "0 / 1 workout", and the badge branch adds
    its own "0 / 1 workouts" progress line to the Badges page, so the text appeared twice. The check now matches the
    rank's exact text. It passes on both the merged tree and this branch.
  - **Demo mode, 58 tests:** the badge branch's 15 `achievement-progress` tests, `demo`, `demo-reset` and the five
    `ux-*` specs. 57 passed, 0 failed, 1 skipped (the stage-chart check; the sample night has no stages).
  - **Two discarded attempts:** both were my setup errors, not code results.
    - The first started the demo server while a production server still held port 3000, so every demo test ran
      against a non-demo server.
    - The second overlapped with the tail of the first on the shared sample account.

## 9. Performance

**Setup:**
- Old build (6c0832f) against this branch's build.
- Same database and sample data.
- iPhone 15 Pro viewport, CPU slowed 4× (Chrome DevTools throttling, a rough stand-in for a mid-range phone).
- Median of 3 loads per page.
- Long tasks are main-thread tasks over 50 ms during load.

| Page | Load ms | Page elements | JS heap MB | Long-task ms |
|---|---|---|---|---|
| `/home` | 948 → 1048 | 566 → 594 | 5.5 → 5.3 | 505 → 647 |
| `/train/programs` | 1175 → 1124 | **1,946 → 1,045** | 5.9 → 5.5 | 626 → 706 |
| `/train/exercises` | 1075 → 1089 | **2,379 → 1,766** | 6.2 → 6.1 | 457 → 516 |
| `/train/exercises/back-squat` | 988 → 782 | 399 → 392 | 5.6 → 5.7 | 568 → 409 |
| `/train/history` | 873 → 896 | 526 → 526 | 5.5 → 5.6 | 510 → 477 |
| `/progress/overview` | 1141 → 1219 | 990 → 990 | 5.9 → 5.9 | 662 → 692 |
| `/progress/sleep` | 1031 → 970 | 848 → 650 | 5.5 → 5.4 | 622 → 675 |
| `/progress/sleep/history` | 730 → 765 | 898 → 899 | 4.1 → 3.4 | 356 → 404 |
| `/run` | 881 → 905 | 535 → 535 | 5.5 → 5.5 | 538 → 488 |
| `/nutrition` | 1171 → 1077 | 1,268 → 1,217 | 5.8 → 5.8 | 687 → 591 |
| `/faith` | 1287 → 1044 | 1,120 → 1,036 | 5.7 → 5.7 | 687 → 577 |

**Repeated A/B with a large history:**
- The sample's workouts were multiplied to 435 workouts and 7,590 sets, going back to January 2024.
- The two builds were run alternately, 8 loads each (median long-task ms, old → new):

  | Page | Old build | New build |
  |---|---|---|
  | Home | 558 | 569 |
  | Overview | 797 | 784 |
  | Sleep | 723 | 746 |
  | Run | 593 | 584 |

  Load times matched within about 60 ms.
- **Conclusion:** no regression. Single 3-run medians differed by up to about 200 ms in both directions, which is
  noise at this sample size.
- The workout history is paged: about 540 elements whether there are 29 or 435 workouts. Charts did not grow.

**Exercise animation** (5 s of frames, CPU slowed 4×):
- Both builds hold a 50 ms median frame gap, about 20 fps under throttling.
- Frames over 50 ms: 42 before and 31 after on the light data; 30 before and 39 after on the heavy run. The
  difference is noise.
- No regression.

**Home's time to network idle:** this was sometimes 1.2 s later on the new build. Next.js prefetches about 14 linked
screens in the background once the page is idle, and the timing varies from run to run. It does not block interaction.
Left as is.

## 10. Per-change record

Each row gives the original issue, what changed, the benefit, and how it was verified. IDs refer to
`FIRST_TIME_UX_AUDIT.md` §3.

| ID | Original issue | Changed interaction | Member benefit | Verification |
|---|---|---|---|---|
| TR1 (record screen) | Free member's GPS screen was a dead end | Recorder offers "Log a run or walk by hand (free)" first | A new Free member can log a run at once | `ux-train-run.spec`; journey j04 (new) |
| I-2, I-5 | Free coach: disabled chat, veteran prompts, no price | One card: what Pro adds, 3 beginner questions from the member's plan, price, Faith stays free | No dead end; honest price | `ux-home-onboarding-coach-you.spec`, `new-member-states.spec`, `coach.spec`; j10 |
| F1 | "Continue reading" opened the last chapter, not today's passage | Home and Faith link to today's passage (or John 1 with no journey) | The right chapter in one place | `ux-faith.spec`, `new-member-states.spec`; j08 |
| F2 | "Day 33 of 40" for everyone | Day shown only from the member's own journey | No borrowed progress | `new-member-states.spec` (asserts no "Day N of 40") |
| I-1 | Verse of the day as a fragment | Full verse with reference | Readable scripture | `ux-home-…spec`; screenshot `new-home` |
| N2 | No Undo after logging food | Every log path: "Logged X to meal" + Undo of exactly those rows; now kept clear of the tab bar | Mistakes reversible in one tap | `ux-nutrition.spec` (3 tests incl. the tab-bar check), j15 in all states |
| I-3, I-4 | Unlabelled play icon; nutrition above workout | Labelled "Start today's workout · 43 min"; workout card first | Clear primary action | `ux-home-…spec`, `core-flow` and five other specs; screenshot |
| N1 | Diary "Scan barcode" opened the analyser | Opens Add food on its Scan tab | Logging from a scan, not analysis | `ux-nutrition.spec` |
| PS-01 | Sleep led with explanation; last night at the fold | Last night first; explanations folded | Answer on the first screen | `ux-progress-sleep.spec`; 6.1 → 4.1 screens |
| TR2, TR3 | Programs 24.4 / Exercises 23.9 screens | 3 per category + "See all N"; summary clamp; filters folded | Lists scan in a few screens | `ux-train-run.spec`, `training-stage2.spec`; 9.1 / 12.5 screens; −46% / −26% elements |
| TR4 (logger half) | Two gold primaries, six secondaries around Complete set | One primary Complete set; secondaries grouped | One obvious action per set | `current-set-card.spec`, `ux-train-run.spec` |
| N3, N4 | Saved meals buried, default Dinner; Pro locks while logging | Saved meals tab in Add food, meal by time of day; "Pro" tag on Meal photo with "Add food instead" | Faster repeat meals; Free path visible | `ux-nutrition.spec` |
| F3 | Reading couldn't be marked done in the reader | Check-in in the reader | One place to read and record | `ux-faith.spec` |
| PS-02 | Stage chart time labels overlapped | Axis ticks thinned to fit | Readable chart | `sleep.spec` (production, a seeded watch night: labels don't overlap or overflow, added in this audit); `sleep-axis.test.ts`. The demo-mode copy of the check skips because the latest sample night has no stages |
| PS-03 | Check-in and manual log were dead ends before consent | Consent offered on those screens | Logging possible from where the member is | `sleep.spec`, `ux-progress-sleep.spec` |
| F4–F7 | Faith hub repetition; restart rule first; prayer Save below the fold | Hub trimmed; rule after the journey choice; Save on screen | Shorter, calmer start | `ux-faith.spec`; j09 lost its scroll |
| TR6 | Demo subject small; 22 px scrub bar | Larger player and scrub target | Easier to see form | `ux-train-run.spec`, `exercise-demo.spec` |
| TR8 | Weight stepper kept odd decimals | Snaps to the plate step | Sensible weights | `weight-stepper.test.ts`, `current-set-card.spec` |
| I-6, I-8 | Billing 6 screens, Faith-free at the bottom; privacy scattered | Current plan, interval and "Faith stays free" first (2.8 screens); Privacy & permissions list | Plan clear at a glance; one privacy place | `ux-home-…spec`, `features.spec`, `memberships.spec` |
| I-12 | Quick add had no sleep; "Quick workout" ignored today's plan | Sleep tile; today's program workout link | Fewer detours | `ux-home-…spec`; j14 |
| PS-08/09/11 | Nap kept overnight defaults; time-in-bed night scored 100; four bedtime cues | Nap defaults; partial nights left out of the score; one wind-down time everywhere | Honest scores and one cue | `sleep-*` unit tests, `ux-progress-sleep.spec` (nap window) |
| N6–N10 | Long diary/supplements/planner; Add food opened on 25 chips | Trimmed; Popular foods first with labelled search | Less to scroll for a first log | `ux-nutrition.spec` |
| TR10, TR11/PS-05 | Run controls small; y-axis labels clipped | Larger run controls; compact axis ticks | Readable, easier taps | `ux-train-run.spec`, `chart-axis.test.ts` |
| PS-14 | No loading state on 8 progress/sleep routes | Loading boundary for the Progress hub group | Immediate feedback | Route inspection; `phone-sweep.spec` |
| Planner (this audit) | Legacy Plus saw "Included with Pro All Access" | "Pro adds AI-arranged plans" | No false lock message | `memberships.spec:59` |
| Undo position (this audit) | Undo behind the tab bar after a re-log | Scrolls into view when covered | Undo reachable | `ux-nutrition.spec:40` (failed before, 5/5 after) |
| Demo reset (this audit) | `npm run demo:reset` removed every demo account | Resets the sample account in place | Presenters and tests don't lose accounts | Integration test + live CLI check (§4) |

**Not changed in this pass:**
- I-7, I-9, I-13: notifications, profile length, jargon.
- I-10: navigation. It was evaluated and a prototype is recommended first (audit §5).
- The badge-branch items listed in audit §7.

## 11. UX scorecard

| Target | Status | Evidence |
|---|---|---|
| Find and start a workout under 30 s | **Interactions verified; time not measured on people** | 1 tap from Home in all states (estimate about 2.4 s) |
| Log one set in 2–3 interactions | **Met (browser)** | 1–2 interactions; reps prefilled, weight carries down |
| Familiar food under 15 s | **Interactions verified; time not measured** | 2 for returning members (one-tap re-log); 5 for a new member (search) |
| GPS start under 15 s after permission | **Interactions verified (Pro); device not tested** | 3 taps; Free gets a free path. Real GPS needs a phone |
| Sleep dashboard in 2 taps or fewer | **Met (browser)** | 1 tap + 1 scroll |
| Bible reading in 1–2 taps | **Met (browser)** | 1–2 taps, now to the right passage |
| 90%+ unassisted completion | **Not tested** | Needs sessions with real new members |

## 12. Remaining limitations

**Needs a phone:**
- GPS accuracy and screen-locked recording.
- HealthKit and Health Connect import.
- Notification delivery.
- Camera barcode and photo flows.
- Haptics.
- Keyboard and autofill behaviour.
- Restore purchases.
- True app backgrounding: the browser test changes page visibility, which is what iOS and Android report, but not
  process suspension.

**Needs people:**
- Every timed target.
- Unassisted completion.
- Comprehension of the new wording.

**Still to do:**
- Onboarding is still 19 interactions (§5 has three proposals).
- The navigation change (Home/Train/Food/Faith/Progress) is not prototyped.
- The badge-dependent items wait for PR #9.
