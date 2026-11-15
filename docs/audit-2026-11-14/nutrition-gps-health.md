# Nutrition, GPS running and health/sleep: audit and repairs (2026-11-14)

Branch `worktree-agent-ac6111a0096112fbe`, based on `claude/pro-premium` at `9240ca2`. The worktree was created at
`aad49a1` (an old commit without the run and sleep code), so it was moved to `9240ca2` before any work.

**Nothing here ran on a phone.** GPS maths was checked on generated traces, health import with the Capacitor plugin
mocked or with records written out in the tests, and the database behaviour against the shared local Supabase stack.
No real food API was called. Playwright was not run (see "E2E specs to run").

Earlier documents (`docs/FOOD_*.md`, `docs/GPS_*.md`, `docs/RUN_TRACKING_PLAN.md`, `docs/SLEEP_METHOD.md`,
`docs/WEARABLES.md`, `docs/audit/3-*.md`, `docs/audit/4-*.md`, `docs/audit-2026-11-07/gps.md`, `sleep.md`) were read as
claims. Where the code agreed with them the row below says "verified"; the seven defects below were not in any of them.

## 1. Findings

Line numbers are in the code as it was at `9240ca2` unless marked "now".

### Fixed

| # | Severity | Where | Problem | User impact | Fix | Verification |
| --- | --- | --- | --- | --- | --- | --- |
| G1 | High | `src/lib/domain/gps-track.ts:291-296` (`addFix`), with `suspendAwareTicker` at `:447-456` | A stretch with no fixes was only turned into a gap by the 1-second clock. When the page's JavaScript was frozen (browser tab hidden or phone locked in the browser/PWA; or the phone app if queued fixes are dropped) the clock did not run, and on return it deliberately waits 15 s for queued fixes. The first fresh fix was then joined to the last one with a straight line. | Distance was invented: 5 minutes away and 750 m further on added 750 m to the run with no gap recorded, contradicting the screen's own text ("any time without a signal is kept as a gap, never guessed"). Pace and splits were wrong with it. | `addFix` now breaks the line when the fix's own timestamp is more than 15 s after the last accepted fix (now `gps-track.ts:296-302`). Fixes queued while locked carry their own seconds-apart times, so they still count. The uncounted straight line is reported as before. | `tests/unit/audit-ngh-gps.test.ts` "a stretch with no fixes is a gap" (5 tests). Before: `expected 840 to be less than 92.8`, `gaps: 0`. After: 270 m, 1 gap, 750 m reported as not counted. The existing locked-phone tests (queued fixes still counted) pass. |
| N1 | High | `src/server/services/progress.ts:87-97` (`getNutritionDaily`) | One unpaged request for every logged food in the range. The API returns at most 1,000 rows (`supabase/config.toml:18`). | A member logging about 12 foods a day passes 1,000 rows in under three months. The 90-day and 1-year calorie/macro charts on Progress (Pro) silently lost rows; in the test the **newest** days read 0 kcal. The 14-day diary summary and the weekly report use the same function (safe at that range, same code). | Paged with a stable order (now `progress.ts:87-112`). | `tests/integration/nutrition-daily-paging.test.ts`: 90 days x 13 foods = 1,170 rows against local Supabase. Before: the last days returned `calories: 0`. After: every day 1,300 kcal / 130 / 72 / 27. |
| N2 | Medium | `src/lib/domain/diets.ts:241-267` (`macroSplitForDiet`), `src/lib/domain/calorie-budget.ts:85-95`; limits in `supabase/migrations/20261016000001_core_schema.sql:442-445` | Protein (g/kg) and the fat minimum (0.6 g/kg) were set from bodyweight with no check against the calorie target or the saved limits. | (a) Heavy members on a low budget got macro targets that add up to more than their calorie target: 100 kg woman, 1,280 kcal, high protein → 220 g protein + 60 g fat = 1,420 kcal. (b) Above about 228 kg (high protein) or 278 kg (fat-loss goal) protein passed 500 g, the database refused the row, and **onboarding ended with "We couldn't save your answers"** before the starter program was built; keto above about 4,470 kcal passed 400 g fat; a budget above 8,000 kcal failed the same way. The form accepts up to 400 kg. | Protein gives way so protein + fat + carbs always fit inside the calories; each macro and the calorie target are clamped to what can be saved (`MACRO_TARGET_MAX`, `MAX_CALORIE_TARGET`). Profiles that were already consistent are unchanged (asserted). | `tests/unit/audit-ngh-nutrition.test.ts` "daily targets": hand case `[220, 60, 0]` → `[185, 60, 0]`; grid of 72,072 profiles. Before: failures such as "balanced 120 kg female … 1360 kcal, macros 1512 kcal"; a probe counted 1,807 of 58,240 profiles over by more than 20 kcal, 9,184 over 500 g protein, 806 over 8,000 kcal. After: none. |
| S1 | Medium | `src/server/actions/sleep-import.ts:131-152` and `:163-166` | A night imported before it was complete (tapping Import at 3 AM, or in the morning before the watch had passed its data to the phone) could never be corrected: read again, it was either "already imported" (same platform id, nothing updated) or "skipped (overlap)" (new id). | The partial night stayed for good: 4 hours instead of 8 in the night view, the sleep score and the sleep-debt estimate, and no stages where the watch had them. The only way out was deleting the night by hand. | An earlier import **from the same platform** that the new record covers from start to end and adds to (10+ minutes longer, or stages where none were stored) is replaced, stages included. A member's own entry, a shorter or shifted record, and a record that would run into another session are still left alone. Message, import card copy and `docs/SLEEP_METHOD.md` updated. | `tests/unit/sleep-import-action.test.ts` "a night imported before it was complete" (5 tests; all 5 failed before). Database side (owner update under RLS, stage replace, overlap still refused with `23P01`): `tests/integration/sleep-stages-paging.test.ts`. The mock was extended to return the columns the action now selects and to apply updates by id; no assertion was weakened. |
| S2 | Low | `src/server/services/sleep.ts:121-126` (`listSleepStages`) | Unpaged; Sleep history asks for the stages of up to 30 recorded nights at once (`progress/sleep/history/page.tsx:55-56`). | A watch writing 40 intervals a night gives 1,200 rows: the newest nights were left out of the stage mix. | Paged. | `tests/integration/sleep-stages-paging.test.ts`. Before: `expected [ Array(1000) ] to have a length of 1200`. After: 1,200 rows, deep/REM/light minutes as worked out by hand. |
| N3 | Low | `src/components/steps/steps-card.tsx:33,39`; `src/app/(app)/progress/overview/page.tsx:293` | Step averages divided by calendar days, so days with nothing recorded counted as zero steps. | Two synced days of 9,000 read "2,571 avg"; three days read "900 a day on average" over 30 days. Missing data shown as a number. | `stepAverage()` averages the days that have a count and says how many ("9,000 avg over 2 days", "no steps recorded yet"). The bars still show empty days as empty. | `tests/unit/audit-ngh-steps-card.test.tsx` (before: `2,571 avg · goal hit 2/7` and `0 avg`), plus `stepAverage` cases in `audit-ngh-nutrition.test.ts`. |
| G2 | Low | `src/components/run/gps-recorder.tsx:364` (`splits: track.splits`) | Only whole splits were saved; the last partial stretch had no row. | The split table of a 3.2 km run showed three rows totalling 12:30 of a 13:20 run. The activity page already knows how to label a short last split (`run-splits.ts`), but the recorder never wrote one. | `splitsForSave()` adds the last stretch (20 m or more) with its own distance and time, so rows add up to moving time. Runs shorter than one split still have no table. Display only: totals, pace and the live recorder are unchanged. | `tests/unit/audit-ngh-gps.test.ts` "splits" (4 tests): sum of rows equals moving time; label "0.86 mi". |

### Open (not changed)

| # | Severity | Where (now) | Problem | Proposed fix |
| --- | --- | --- | --- | --- |
| O1 | Medium, needs a dietitian's rule | `src/lib/domain/diets.ts:248-275` | After N2 the macros fit the calories, but for heavy members on a low budget the "balanced" split is still protein + the fat minimum with **0 g carbs** (120 kg, 1,360 kcal → P 178 / F 72 / C 0), because protein is per kg of total bodyweight. I did not invent a rule. | Cap protein as a share of calories or use an adjusted bodyweight above a BMI threshold; decide with whoever signs off the nutrition copy. |
| O2 | Low | `src/lib/domain/gps-track.ts` `recoverTrack` (`:633-638`), signal gaps | Time with no distance still counts as moving time: after "Continue recording" following a crash, and during signal gaps. Distance is honest; average pace reads slower than run. Reported on 2026-11-07 (B3) as an owner decision, still open. | Pause the recovered track so the member chooses Resume; optionally exclude gaps over a threshold from moving time. |
| O3 | Low | `src/components/nutrition/food-amount.tsx`, `src/lib/open-food-facts.ts:98-125` | Calories that disagree with 4/4/9 are flagged for manual entries (`nutrition-client.tsx:389-390`) and photo estimates (`food-photo-flow.tsx:438`), but not for barcode (community) or USDA items. Nothing is silently "fixed": the source's calories are kept (tested). | A neutral note on the amount step when macros are all listed and differ by more than about 30% ("alcohol, fibre or a data-entry error can cause this; check the label"). |
| O4 | Low | `src/lib/domain/recipes.ts:119-141` (`servingBasis`) | One serving is rounded (whole kcal, 0.1 g) and then multiplied by the servings logged: 1,000 kcal ÷ 3 = 333, x 3 = 999. At most 0.5 kcal and 0.05 g per serving. Diary rows are also whole kcal by design, so the day's total equals the rows on screen. | Keep two more decimals in the stored per-serving basis. |
| O5 | Low | `src/components/nutrition/nutrition-client.tsx:856-906`, `src/lib/domain/diary.ts:204-215` | Water is entered in ml and shown in litres for every member; there is no fl oz display for imperial accounts. Food amounts do offer fl oz (29.5735 ml, tested). No arithmetic error. | Show fl oz / cups for imperial accounts. |
| O6 | Low | `src/server/actions/sleep-import.ts:154,198` | Every night in a 14-day import is stamped with the phone's current time zone, so nights slept elsewhere before a trip are filed and timed in the new zone. Durations are unaffected (epoch maths). | Use the platform's per-sample zone metadata where the plugin exposes it. Needs a device. |
| O7 | Info | `src/lib/domain/run-splits.ts:33` | A last stretch between 98% and 100% of a mile or kilometre is labelled as a whole one ("Mile 2" for 0.99 mi). | Leave, or label by length whenever it is the last row. |
| O8 | Info | `src/app/api/foods/search/route.ts:51-63` | Branded FoodData Central results carry their label serving only as text, so they can be logged in g / oz / lb but not "1 serving". Only when a USDA API key is configured. | Pass `servingSize` into the basis when the unit is g or ml. |
| O9 | For the AI-coach auditor | `src/server/coach/tools.ts:181`, `src/server/coach/snapshot.ts:163` | Range reads of `meal_items` like N1. Not my lane; not verified whether their ranges can pass 1,000 rows. | Page them the same way. |

## 2. What was checked and held

Verified by the hand-computed tests added here unless another source is named.

**Nutrition**

- Serving multiplication, grams, ounces, pounds, fl oz, household units (cup, tbsp, "1 medium"), typed fractions.
- A food with only per-100 g data logs by weight and gets no invented serving; a food with only per-serving data logs
  by servings and gets no invented weight (stored `grams: null`).
- kJ-only sources convert at 4.184; a kcal figure is used as given; a kJ number typed into the kcal field (over 1,000
  per 100 g) is not accepted as kcal; a product with no energy is "no nutrition", never 0 kcal.
- Totals are summed, then rounded (insights, recipes, meal-plan days). The diary's running total rounds at each step,
  which is exact because stored values have one decimal (`core_schema.sql:431-434`).
- Missing data: unlisted macros are "at least" / "—" in the diary, recipes and insights; fiber, sugar and sodium totals
  say how many foods had a value; a week's average divides by logged days.
- Recipes: totals, per-serving and scaling servings. Meal-plan day totals.
- Targets: Mifflin-St Jeor by hand (1,780 and 1,320.25), activity factors, 0.5 kg a week = 550 kcal a day, floors
  1,200 / 1,500 / 1,350, deficit capped at a quarter of maintenance and 1,000 kcal, clamps of the older estimate.
  Copy says "estimate" and "not dietary advice"; I found no medical claim in the target code or the diet cautions.
- Estimates stay labelled: photo items are saved `is_estimate: true`, source `photo`, amount text "(estimated from a
  photo)" (`src/server/actions/food-photo.ts:86-110`); a database match with a photo-estimated amount is also an
  estimate; a label the member checked is "Label", "(from a label you checked)".
- Editing and deleting diary entries: nutrition is recomputed on the server from the stored basis; totals are derived
  on each page load, so there is no stored total to go stale (read, plus existing `food-amounts` integration tests).
- Local day: a diary entry is stored under a calendar date (`meals.eaten_on`), so time zone and DST cannot move it;
  "today" comes from the profile zone. Workouts and runs for the exercise line are fetched a day either side in UTC
  and filtered by local date (`nutrition/page.tsx:181-198, 276-286`).
- Search: every query word must match a word start; exact words, first-segment matches, short and plain forms rank
  first; popular everyday foods come before the rest; deli, fast-food and restaurant entries are pushed down.
  Client requests are debounced and aborted when superseded (`food-picker.tsx:69-90`, `nutrition-client.tsx:265-293`);
  the server caches barcode lookups for a day and rate-limits both routes. Existing `food-search` and `popular-foods`
  unit tests pass; I did not add ranking cases.
- Empty states name the next step: diary ("Use Add food…"), recipes ("Tap New recipe…"), grocery ("No meal plan yet.
  Make a plan first, or add items by hand below"), planner ("Make a plan").

**GPS and cardio**

- Pause and resume add no distance and are excluded from moving time (hand case: 203 s moving of 403 s).
- Whole splits land on each kilometre or mile at the pace run. Pace and unit conversion by hand (5 km in 25:00 =
  5:00 /km = 8:03 /mi).
- Poor-accuracy, out-of-order, stale and impossible-speed fixes are rejected: existing `gps-track`, `gps-accuracy`
  and `gps-audit-edge-cases` tests, all passing after G1.
- Recovery after reload or kill, permission-denied and poor-signal messages, offline save and retry: existing
  `gps-recorder*.test.tsx`, passing.
- Battery-related settings as coded: native watcher `distanceFilter: 0`, `stale: false`; browser
  `enableHighAccuracy`, `maximumAge: 0`, 30 s timeout; wake lock in the browser only; state written to the device
  every 5 s (`src/lib/native/location.ts:92-116`, `gps-recorder.tsx:217`). Battery cost itself is device-only.
- Elevation is not recorded anywhere (no altitude field in `GpsFix`), so there is nothing to check or misreport.
- Manual and treadmill entries never carry a route or splits and are labelled self-reported.

**Free and Pro (rule not changed)**

- Server: `src/server/actions/gps-activities.ts:55` refuses a GPS save without `live_gps`.
- Database: trigger `enforce_live_gps_plan` (`supabase/migrations/20261102000048_low_findings_hardening.sql:52-75`)
  refuses `source = 'gps'` or a route for a plan ranked below `plus`.
- Client: `src/app/(app)/run/record/page.tsx:53` (`canRecord`), `src/app/(app)/run/page.tsx:94` (PRO tag).
- Free keeps: manual and treadmill logging, edit and delete, history, weekly totals, personal bests, goals,
  milestones, and editing notes or deleting a GPS run recorded earlier. None of those actions has a plan check
  (`src/server/actions/activities.ts`). I found no Free function locked by accident.
- One ambiguity to be aware of: the copy says "Pro All Access", while `live_gps` is also in the legacy Plus feature
  list (`src/lib/domain/plans.ts:56-67`) and the trigger's threshold is `plus`. Server, database and client agree
  with each other; the wording simply does not mention legacy Plus.

**Health and sleep**

- Sleep score and sleep debt match `docs/SLEEP_METHOD.md` on hand cases (score 84 from 37.5 + 18.7 + 20 + 8; debt
  sequence 60, 60, 30, 0, 30). A part with no input is left out of the score, never zero.
- In bed versus asleep, efficiency only when detail exists, a night belongs to the local day of getting up, DST nights
  are 9 and 7 real hours, naps stay out of the night.
- Imports invent nothing: a phone's bare record has no stages, onset or wake-ups; overnight measurements exist only
  for series with readings; out-of-range readings are dropped.
- Duplicates: unique `(user_id, source, source_id)` plus the overlap exclusion constraint; the id is stable across
  read order. Steps are one row per day (upsert), hand entries are never overwritten by a sync.
- Disconnect: stops imports and clears the connection; imported nights stay unless the member ticks remove
  (`sleep-import.ts`, `disconnectSleepSourceAction`). The phone's own health data is never written or deleted.
- Not connected: the import card says where import works and offers the timer or hand entry.

## 3. Files changed

Source:
`src/lib/domain/gps-track.ts`, `src/components/run/gps-recorder.tsx`,
`src/server/services/progress.ts`, `src/lib/domain/diets.ts`, `src/lib/domain/calorie-budget.ts`,
`src/lib/domain/steps.ts`, `src/server/services/steps.ts`, `src/components/steps/steps-card.tsx`,
`src/app/(app)/progress/(hub)/page.tsx`, `src/app/(app)/progress/overview/page.tsx`,
`src/server/actions/sleep-import.ts`, `src/lib/domain/sleep-import.ts`, `src/server/services/sleep.ts`,
`src/components/sleep/import-card.tsx`.

Tests (new): `tests/unit/audit-ngh-gps.test.ts` (12), `tests/unit/audit-ngh-nutrition.test.ts` (35),
`tests/unit/audit-ngh-sleep.test.ts` (15), `tests/unit/audit-ngh-steps-card.test.tsx` (3),
`tests/integration/nutrition-daily-paging.test.ts` (2), `tests/integration/sleep-stages-paging.test.ts` (2).
Tests (extended): `tests/unit/sleep-import-action.test.ts` (+5, mock extended).

Docs: `docs/SLEEP_METHOD.md` (the replace rule), this file. No migration.

## 4. Commands and results

| Command | Result |
| --- | --- |
| `npx vitest run --project unit` before any change | 239 files, 4,501 tests passed |
| `npx vitest run --project unit` after the changes | 243 files: 4,570 passed, **1 failed**: `tests/unit/exercise-motion-quality.test.ts` "no joint moves faster than a human joint can" (6.8 s on a loaded shared machine; the run took 347 s against 118 s). Not in this lane and not touched. |
| `npx vitest run --project unit tests/unit/exercise-motion-quality.test.ts` | 13 passed (the failure above did not repeat when run alone) |
| `npx vitest run --project integration` on `sleep-stages-paging`, `nutrition-daily-paging`, `sleep`, `sleep-imports`, `gps-running`, `activities`, `food-amounts`, `recipes-planner`, `onboarding-plan` | 9 files, 48 tests passed |
| `npx tsc --noEmit` | clean |
| `npx eslint` on the 21 changed source and test files | clean |

The full integration suite was not run (shared database, other auditors working), only the files above.

## 5. E2E specs to run after merging

Not run here. No spec was edited: I searched `e2e/` for the strings that changed (the steps average, the import card
sentence, split rows) and found no assertion on them.

- `e2e/gps-run.spec.ts`, `e2e/run.spec.ts` (gap rule, saved splits now include the last partial row)
- `e2e/supplements-steps.spec.ts`, `e2e/ux-progress-sleep.spec.ts`, `e2e/new-member-states.spec.ts` (steps card text)
- `e2e/onboarding-plan.spec.ts`, `e2e/welcome-diets.spec.ts`, `e2e/nutrition-diary.spec.ts` (targets after sign-up)
- `e2e/sleep.spec.ts`, `e2e/missed-sessions-sleep.spec.ts` (sleep pages; import itself is device-only)

## 6. Device-only: not tested here

- Outdoor GPS accuracy, drift and multipath on a real phone; battery use; update rate.
- Background and locked-screen recording on iPhone and Android, and what the location plugin delivers after a lock:
  every fix queued, or only the newest. G1 makes the second case a gap instead of invented distance, but which case
  happens is unknown.
- Location permission prompts (When In Use / Always, Precise off), "Open Settings", the Android recording notification.
- Apple Health and Health Connect authorisation sheets, denial and later revocation, and what the plugin returns then.
- Real sleep samples from an Apple Watch or other wearable: stage intervals, platform ids across re-reads (S1 depends
  on them behaving as modelled), the phone-first-then-watch order, time zones while travelling (O6).
- Step totals from the platform (de-duplication of phone and watch is the plugin's job).
- Camera: barcode scanning with the native scanner, meal photo capture, label photo.
- Live Open Food Facts and USDA FoodData Central responses (only fixtures and written-out products were used).
