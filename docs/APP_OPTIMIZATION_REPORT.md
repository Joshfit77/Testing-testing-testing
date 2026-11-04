# App optimisation and production readiness: 2026-11-04

Branch `claude/faith-discipleship`. This pass followed the member's path through the app: sign up → choose a goal →
start a workout → see the demonstration → log sets → rest → finish → review progress → come back for the next
session. It was implemented and verified, not only suggested. Nothing was merged into `main`, deployed, published
or switched on in production. Pricing ($0 / $19.99 a month / $149.99 a year) is unchanged, and the Faith section
stays free.

Severity scale: **P0** loses data, charges wrongly or gives away Pro; **P1** breaks a headline flow or gives unsafe
training advice; **P2** works but misleads or slows the member; **P3** polish.

## 1. Confirmed issues (with evidence)

| # | Sev | Issue | Where | Evidence | Status |
|---|---|---|---|---|---|
| 1 | P1 | **Reminders, the sleep alarm and the sign-out notification cleanup never finished on a phone.** `plugin()` was an async function that *returned* the Capacitor plugin. A Capacitor plugin is a Proxy that answers every property, `then` included, so the promise machinery called `LocalNotifications.then(resolve, reject)`. Capacitor turned that into a call to a native method that doesn't exist, and `resolve` was never called. | `src/lib/native-notifications.ts:41`, `src/lib/native-alarm.ts:18` | Read in `@capacitor/core` 8.5.3 (`registerPlugin` proxy: `default: return createPluginMethodWrapper(prop)`). New test `tests/unit/capacitor-plugin-thenable.test.ts` uses a proxy that behaves the same way: all 3 cases **hang on the old code** and pass on the fix. It was also the cause of the long-standing "unhandled rejection" in the unit suite. The older tests mocked the plugin with plain objects (no `then`), so they never saw it. **Not yet confirmed on a device.** | Fixed |
| 2 | P1 | **iPad app classed as Android for billing.** iPadOS WebViews report a desktop "Macintosh" user agent, so the old `/iPhone\|iPad\|iPod/` test returned `android`. | `src/server/native.ts` (now `src/lib/native-platform.ts`) | `tests/unit/native-platform.test.ts` (iPad desktop UA → `ios`) | Fixed |
| 3 | P1 | **Custom programs scheduled a "goal" single of up to 150% of today's max** in the test week and on meet day. | `src/lib/domain/custom-programs.ts` (`heavySlot`, meet day) | Programs audit; `tests/unit/program-safety-caps.test.ts` | Fixed: a goal is attempted only up to 105% of today's max; a bigger goal stays a long-term target in the notes |
| 4 | P1 | **Beginner programs prescribed RPE 9, and the block builder overwrote exercises written as submaximal** (e.g. a deadlift kept a point lighter) with the week's RPE. | `src/data/programs.ts` (block builder), `src/lib/domain/program-expansion.ts` | `tests/unit/program-safety-caps.test.ts` (every beginner program ≤ RPE 8.5; deadlift stays under its peers); seed regenerated: 137 rows changed 9 → 8.5 | Fixed |
| 5 | P1 | **The logger pre-filled weights from the latest session of an exercise, whatever today's session was.** A heavy-triples day took the numbers from a volume day, and a deload week took normal-week loads. | `src/lib/domain/previous-performance.ts`, `src/server/services/workouts.ts:437`, `src/app/(app)/train/workout/page.tsx` | `tests/unit/previous-same-session.test.ts` (6 cases); e2e `current-set-card.spec.ts` re-opens the same program day against a real database and sees last time's 95 lb pre-filled | Fixed: prefers the same day of the same program, deload only matches deload, and a deload week shows a notice instead of copying weights |
| 6 | P1 | **(Found while testing the new card) A double tap on the card's Complete button would have completed two sets**, because after the first tap the button moves to the next set and the logger's per-set guard can't see it. Undo pressed straight after completing was also swallowed by that guard. | `src/components/workout/current-set-card.tsx`, `workout-logger.tsx` (`undoSet`) | e2e `current-set-card.spec.ts` double-taps on purpose and checks that set 2 is not ticked; Undo then re-complete works with no wait | Fixed before release |
| 7 | P2 | `DEMO_MODE=true` was honoured anywhere, including a production deployment with live payments. | `src/server/env.ts`, `src/server/demo.ts` | `tests/unit/demo-mode-guard.test.ts` | Fixed: refused on Vercel production and when `STRIPE_LIVE_APPROVED=true`, with a server warning |
| 8 | P2 | **Onboarding took 11 screens before the plan was built**, with weight goal, daily activity and diet in the required path. | `src/components/onboarding/onboarding-questionnaire.tsx` | e2e activation measurement: taps to finish onboarding 19 (original) → 16 (last round) → **10**; to the first completed set 21 → 18 → **12** (4 typed fields throughout) | Fixed: goal, experience, schedule, equipment and about you, then **Build my plan**. Second goal, weight goal, activity, diet and display are optional afterwards ("Personalise more"). The Ready screen says which defaults were assumed. Answers are kept if the page reloads |
| 9 | P2 | **The logger had no focused view of the set to do now.** The rest timer sat in the header, and the completion screen had no sets, reps or exercise counts and didn't explain a partial workout. | `workout-logger.tsx` | e2e `current-set-card.spec.ts` | Fixed (section 4) |
| 10 | P2 | Home put the verse card and reminders above **today's workout**. | `src/app/(app)/home/page.tsx` | Read | Fixed: today's workout is first |
| 11 | P3 | Member-facing demo badges said "awaiting approval" (internal wording, and it implied someone was about to approve them). | `exercise-demo.tsx:80`, `exercise-demo-25d.tsx:38` | Read | Fixed: "still in review". They are still not marked final |
| 12 | P3 | The Bible-assistant demo note described behaviour the demo doesn't have. | `src/components/demo/demo-note.tsx` | Read | Fixed |
| 13 | P3 | The card's reps field read "Reps (reps)". | `current-set-card.tsx` | Screenshot | Fixed |
| 14 | P2 | **(Found reviewing the onboarding change) Saved onboarding answers weren't tied to the account**, so someone else signing up in the same tab would have seen the first person's age and weight. | `onboarding-questionnaire.tsx`, `src/app/onboarding/page.tsx` | e2e `onboarding-plan.spec.ts` "answers survive a reload, but never reach another account" | Fixed: the saved answers carry the account id and anyone else's are discarded |
| 15 | P2 | **(Found in the iPhone screenshots) On the onboarding Ready screen, "Build my plan" ran off the right edge of the phone**, with three buttons in one row. | `onboarding-questionnaire.tsx` | Screenshot at iPhone 14 width; the shared e2e helper now fails if the button isn't fully on screen | Fixed: full-width Build my plan, with Back and Personalise more below |
| 16 | P1 | **(Found by the e2e re-run after #15) "Personalise more" skipped the first optional question.** React reused that button's element as the next screen's Continue (a submit button) during its own click, so the form submitted as well. | `onboarding-questionnaire.tsx` | `onboarding-plan`, `welcome-diets` and `faith-calendar` specs land on the wrong question without the fix and pass with it | Fixed: the two button layouts have separate keys |
| 17 | P3 | (Found in the screenshots) The card cut long exercise names short ("Barbell Back …"), and the rest row was cramped at phone width (its text wrapped one word per line). With the card scrolled away, two "Rest timer" regions were exposed to screen readers. | `current-set-card.tsx` | Screenshots; `training-stage2.spec.ts` strict-mode failure | Fixed: names wrap to two lines; the rest row is two rows with labelled −15s / +15s / Skip rest; the off-screen card's rest row is inert while the header bar shows |

Checked and found sound, so not changed: volume and personal records exclude warm-ups and unfinished sets
(`src/lib/domain/strength.ts:26,46`); finishing is idempotent per workout (`finishWorkout`, safe to retry offline);
drafts persist locally at once and to the server with a delay, and recover after a reload; substitutions, the warm-up
toggle and skip-with-pain all behave. The AI only *proposes* load changes and the member confirms them. Missed
workouts slide forward instead of piling up.

## 2. What changed

- **Current-set card** (`src/components/workout/current-set-card.tsx`): exercise n of N, the set (warm-up and working
  sets counted separately), target, "last time", big weight and reps steppers (±5 lb / ±2.5 kg, ±1 rep), one
  **Complete set** button, then a rest ring with −15 s / +15 s / **Skip rest**, and **Undo** for the set just logged.
  It drives the same draft as the exercise cards, so saving, offline use and recovery are unchanged. While the card is
  on screen the header's rest bar is hidden, so there is only ever one timer.
- **Finish dialog**: titled **Finish early?** when sets remain. It says how many working sets are done, how many
  aren't, and that only completed sets count toward volume, records and badges.
- **Completion screen**: duration, volume, sets (done/planned), exercises (done/planned), reps and new records, a note
  for a partial workout, and a link to the saved session. Records are only "new" against earlier history; a first
  session sets none.
- **Programming safety**: the beginner RPE cap, submaximal RPEs kept, goal singles capped at 105%, "last time" from
  the same program day, and deload weeks not pre-filled.
- **Onboarding**: essentials first, optional questions after, progress saved; see #8.
- **Home**: today's workout first.
- **Native notifications**: the plugin is taken from its module and never returned from an async function; see #1.
- **Demo vs production**: demo mode refuses to run on production or with live payments. The demo itself is unchanged.

Files changed: 27 modified and 11 new (listed in the commit). The database change is data only: the regenerated
`supabase/seed.sql` updates RPE values in place for library programs. There is no schema change and no migration.
To roll back, check out the previous `seed.sql` and re-apply it. A database that already has the seed needs it
re-applied to pick up the safer RPEs.

## 3. Tests

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | Pass |
| ESLint (`npm run lint`) | 0 errors; 4 warnings, all in older demo-crawler scripts not touched here |
| Production build (`next build`) | Pass |
| Unit (`vitest --project unit`) | **161 files, 3,184 tests, all pass, no unhandled errors** (the earlier rejection is gone; see #1) |
| Integration (`vitest --project integration`, local Supabase) | **47 files, 317 tests pass**, 1 skipped (by design) |
| End-to-end (Playwright, Pixel 7 profile, local stack, 124 tests) | Full run: **103 passed, 3 failed, 18 skipped**. The 18 are the demo-mode spec, which needs a server started in demo mode (see the next row). All 3 failures were in the tests: the old onboarding order, a Skip locator that now matches two buttons, and an animation-wait helper that failed on a cancelled animation. All three were fixed. After the later fixes (#14–#17), the 10 affected specs were re-run: 22 of 23 passed. The other was `phone-sweep`, which hit a one-off React hydration error (#418) on `/faith/studies` at one size; that page wasn't changed here, and it passed on re-run (listed under remaining work) |
| Demo-mode e2e (`demo.spec.ts`, demo-mode build, freshly seeded demo data) | **17/17 pass** (iPhone and desktop presenter paths included). A first attempt against demo data seeded in an earlier session failed two journey-day checks: that data is dated by the day it was seeded. Re-seeding fixed it |
| Clean database rebuild (`supabase db reset`: all migrations plus the regenerated `seed.sql`) | Pass; 51 programs, 0 beginner exercises above RPE 8.5 |
| New e2e `current-set-card.spec.ts` | Pass: double tap counts once, rest, Skip rest, Undo, re-complete, Finish early, completion stats, the same day's "last time" with weight pre-filled |
| Activation measurement (`first-workout-activation.spec.ts`) | Pass; numbers in #8, file `docs/activation/measurements/activation-2026-11-04-essentials-first.json` |

**Not run:** anything on a real phone (camera, notifications, Apple Health / Health Connect, GPS outdoors, store
purchases in sandbox), WebKit/iPhone Safari (needs the macOS CI job), live AI calls, and live payments.

Corrections to earlier reports:
- An earlier report in this session said integration passed when `ai-route-limits` was failing (a header-only test
  JPEG was rejected before the quota check). That test was fixed with a real image, and the claim was wrong at the time.
- Commit `c3562fd` says 3,135 unit tests; the run had 3,134.
- During this pass a new test file briefly replaced the existing `tests/unit/demo-mode.test.ts` (15 tests). A per-file
  count comparison caught it, the original was restored, and the new tests live in `demo-mode-guard.test.ts`.

## 4. Visual and workout presentation

The mock-ups were used as a reference for layout and hierarchy only: their photos and metrics were not copied, and
nothing in the app shows sample numbers as the member's own. The card keeps the black-and-gold system (gold border and
glow, display type for the exercise and the numbers). Screenshots at iPhone 14 size are in the scratchpad (see the
summary message); they are of the real app on a local database with a brand-new account.

Exercise demonstrations (limits, stated plainly): most of the 157 exercises use the animated 2D athlete. The 2.5D
video demos exist for only a few, and both kinds are labelled **still in review** until a person signs them off.
Nothing was marked final in this pass.

## 5. Security and payments

- Pro access is decided on the server (entitlements table, RevenueCat and Stripe webhooks with verified signatures and
  idempotent handling). The client's view of the plan is never the authority.
- No web checkout inside the iOS/Android apps; after #2 that now includes iPads.
- Live Stripe stays off unless `STRIPE_LIVE_APPROVED=true`, and demo mode can't run alongside it (#7).
- The AI quota is atomic, row-level security covers all 97 tables, prayer journal entries reach a coach only through
  `share_with_coach`, and no secrets are in the repository.
- Still open (P3): RevenueCat sandbox flags are honoured unless `STRIPE_LIVE_APPROVED` is set, and the Bible AI has
  no admin kill switch.
- **Not tested:** a sandbox purchase, restore and cancellation on a real iPhone/Android through RevenueCat. The code
  paths have unit and integration tests; the store round trip needs a device (`docs/MOBILE_BILLING.md`).

So: the payment design is sound in review and in automated tests, but it has **not** been proven on a device and
should not be described as verified end to end.

## 6. Remaining work

Before a 15-person beta:
1. Device smoke test on one iPhone, one iPad and one Android phone (`docs/BETA_TEST_PLAN.md`), first of all the
   notification fix (#1) and a sandbox purchase.

Before a public paid launch, in addition:
2. Programming (P2): a combined goal can put sessions on the wrong weekday; the starter plan can exceed the days
   chosen (or schedule 7 days with no rest); the mobility goal maps to barbell strength; "pick 1–2" session libraries
   are scheduled as full weeks; custom percentage loads drop the RPE cue; the progression rule checks only top-weight
   sets and lets sets without RPE pass; AI-built plans are validated for shape only; there is no long-break handling.
3. Programming (P3): exercise order in some splits, the hybrid program's date label, the half-marathon peak week,
   `propose_target_load` allowing +15% (unbounded with no history), and no explicit "don't invent history" rule in
   the coach prompt.
4. Security (P3): the two items in section 5.
5. Exercise demonstrations reviewed and signed off.
6. Privacy policy and terms reviewed by counsel; App Store review.
7. WebKit e2e run on the macOS CI job.
8. An intermittent React hydration error (#418) on `/faith/studies`, seen once in `phone-sweep` at 375 pt with the largest
   text and not reproduced on re-run. The page wasn't changed in this pass; the cause is probably in shared app-shell code and still needs finding.

## 7. Ratings

These are judgements from what was built and tested here, not from tester data. None is a 10, because none of these
areas has been tested on a phone or with real members.

| Area | Before | Now | Why |
|---|---|---|---|
| Visual | 8.5 | 8.5 | Same design system, applied consistently to the new card and completion screen; no device or human design review yet |
| Feature breadth | 9 | 9 | Nothing new in scope; this pass was about doing the core well |
| UX | 7 | 7.5 | Onboarding taps cut from 16 to 10, today's workout first, an honest finish-early step, double-tap and Undo fixed. Still unmeasured with people |
| Workout presentation | 6.5 | 7.5 | A focused current-set view with rest, Undo and a full completion summary. Demonstrations are still mostly 2D and in review |

## 8. Launch recommendation

- **15-person beta: yes, through TestFlight and an Android internal track,** once the device smoke test passes (above
  all the notification fix and a sandbox purchase on iPhone and iPad).
- **TestFlight external testing / App Review: after the beta,** with the beta's data-loss and wrong-number reports at zero.
- **Public paid launch: not yet.** Blockers: device verification of payments and notifications, the P2 programming
  items, signed-off exercise demonstrations, legal review and App Store review.
