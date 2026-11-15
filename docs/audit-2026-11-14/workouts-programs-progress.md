# Audit 2026-11-14: workout tracking, program library and builder, progress and gamification

Branch `claude/pro-premium` at `9240ca2`, audited in a separate worktree. Scope: `src/components/workout/**`,
`src/server/actions/workouts.ts`, `src/server/services/workouts.ts`, `src/lib/domain/**` (workout, strength, units,
streak, achievements, ranks, programs), `src/data/programs*`, `src/data/program-catalog/**`, the builder, and the
progress pages. Exercise animation data was not touched.

**No Critical or High defect was found.** Six defects were fixed, each with a regression test seen failing before the
fix and passing after. Seven findings are left open with a proposed fix (two of them Medium), because fixing them
safely needs a product or coaching decision, or browser tests that could not be run here.

Earlier documents were treated as claims. Where a claim was re-verified, the test that verifies it is named below.

## 1. Findings

Severity: **Medium** = wrong or lost-looking data, or a core flow that needs a workaround; **Low** = a wrong label,
a misleading number, or an edge case with a small effect.

### Fixed

| ID | Sev | Where (before the fix) | Problem | User impact | Fix | Verified by |
|---|---|---|---|---|---|---|
| W-1 | Medium | `src/components/workout/workout-logger.tsx:331-363` (`pushToServer`) and `:366-383` (persist effect) | A failed in-progress backup schedules a retry (5 s to 120 s). The effect only cleaned the timer up on its debounce path, not after a completed set (`saveNow` returns early), so the retry timer outlived the workout: it still fired after **Discard** and after leaving the screen, sent the old draft, and `saveDraftSnapshot` (which found no row any more) inserted it again as `in_progress`. | A discarded workout came back: "Resume workout" on Home and Train (they read the server's in-progress session) and a resumable workout on the member's other devices. Needs flaky network at the moment of the last set, then a discard. | A `closed` flag and `stopBackups()` (now `workout-logger.tsx:334-347`): no backup is sent, re-sent or saved to the device once the workout is discarded (`:1263`), finished (`:884`) or the screen is unmounted; a refused discard re-opens backups. | `tests/unit/workout-logger-backup-stops.test.tsx` (renders the real logger with fake timers): 2 of its tests failed before (`expected 2 to be 1`), 4 pass now. |
| W-4 | Low | `src/server/services/workouts.ts` `finishWorkout`, completed-retry branch (was lines 211-221) | Saving the workout and moving the program pointer are separate writes. A retry of a finish whose first attempt saved the workout but did not reach `advanceProgram` returned "already completed" and never advanced. | The program stays on the day just done and offers the same session again; the member has to redo or skip it. | The retry branch now repeats `advanceProgram` from the saved session's own `user_program_id` / `program_day_id` (`workouts.ts:219-226`). It only moves a pointer that is still on that day, so repeating is safe. | `tests/integration/workout-audit-2026-11-14.test.ts` "a retried finish (lost reply) completes the program step": failed before (`expected … to match { currentWeek: 1, currentDay: 2 }`), passes now, and a third retry does not double-advance. |
| W-2 | Low | `src/lib/domain/workout-draft.ts:413-452` (`substituteExercise`) | The replacement exercise inherited `noWeightConfirmed` and `prefilled` from the exercise it replaced (`...e`). | (a) After "No added weight" on one exercise, a loaded replacement was logged at no weight without being asked, against owner decision T8 (`src/lib/domain/load.ts:1-5`). (b) The replacement never received its own "last time" numbers. | Both flags are reset on the replacement (`workout-draft.ts:432-433`); the logger's once-per-exercise guard is keyed by card and exercise (`workout-logger.tsx:429`). | `tests/unit/workout-audit-2026-11-14.test.ts` "substituting an exercise starts the replacement clean": 3 tests failed before, pass now. |
| W-3 | Low | `src/components/workout/workout-logger.tsx:666` and `:741` (completion screen) | Record values were printed with `formatWeight` (one decimal) for every weight-like record, including best set volume. Volumes are kilograms × reps converted back. | "Best set volume: 1079.9 lb" for 135 lb × 8 (should be 1,080 lb). The muscle map already rounded it; the completion screen did not. Also "1 reps". | One shared `formatRecordValue` (`src/lib/domain/record-labels.ts:43`), used by the completion screen (`workout-logger.tsx:685`, `:760`) and the muscle map (`src/components/progress/muscle-map.tsx:456`). | `tests/unit/workout-audit-2026-11-14.test.ts` "record values are written the same way everywhere": 2 tests failed before, pass now. |
| P-1 | Low | `src/app/(app)/progress/overview/page.tsx:182-197` | With one session of the lift in the range, the strength trend printed "0 lb over 30 days" (first = last). The tile was also titled "Squat (1RM)" although the value is an Epley estimate; the app's own terms (`record-labels.ts:5-6`) say it is always called "estimated". | "Insufficient data" was shown as a real zero ("no progress") after one workout, and an estimate was presented as a 1RM. | `strengthTrend()` (`src/lib/domain/strength.ts:96`) returns `change: null` for a single session; the page says "1 session in this range. Log it again to see a change." and the title reads "(estimated 1RM)" (`overview/page.tsx:184-203`). | `tests/unit/progress-audit-2026-11-14.test.ts` "strength trend: one session is not a trend": 3 tests failed before, pass now. The page itself was not opened in a browser. |
| B-1 | Low | `src/data/programs.ts` equipment arrays of 12 listed programs (lines 2002, 2053, 2128, 2222, 2248, 2275, 2322, 2501, 2555, 2644, 2790, 2958) | The equipment a program lists did not match the exercises it prescribes: 9 programs prescribe an exercise none of their listed equipment can do, 6 list equipment no exercise uses (details in section 2). | "Equipment needed" on the program page and the "Equipment I have" filter were wrong for these programs (for example Strongman Foundations needs a pull-up bar for hangs and knee raises but did not say so). | The lists were corrected in the source; `supabase/seed.sql` and `supabase/setup-all.sql` were regenerated (12 lines each); the same 12 values were written to the shared local database with `UPDATE … WHERE slug = … AND owner_id IS NULL AND source = 'curated'` (12 × `UPDATE 1`). Only `training_programs.equipment` changed: no slug, id, week, day, exercise, tier or enrollment was touched. No migration was added (Low severity; production takes catalog changes from the idempotent seed, `SETUP.md:118`). | `tests/unit/program-catalog-validation.test.ts`: the two equipment tests failed before, pass now. Source vs local database compared for all 74 programs (equipment, level, weeks, days per week): identical. |

### Open (not fixed), with proposed fix

| ID | Sev | Where | Problem | User impact | Proposed fix | Why not fixed here |
|---|---|---|---|---|---|---|
| P-3 | Medium | `src/app/(app)/train/workout/page.tsx:75` (`isTimed: e.exercise.is_timed`), `src/lib/domain/workout-draft.ts:365-367`, `src/components/workout/current-set-card.tsx:586` | A program exercise prescribed by time on an exercise the catalog does not mark as timed (cat-cow 45 s, kettlebell swings 30 s, burpees 20 s) starts with empty reps and no time. The set cannot be completed until reps are typed: "Enter your reps, then complete the set." | One-tap completion does not work on these sets, and the prescribed time is not what is logged. 11 listed programs are affected; in `full-body-mobility-6-week` and `flexibility-recovery-routines` it is most or all of every session. | Treat a time-only prescription as timed for that workout (`isTimed: is_timed \|\| (duration_seconds != null && !reps)`), and make the history view (`workout-editor.tsx:216-218`, which would print "Bodyweight × 0"), the editor and "repeat workout" render a time-only set on a rep exercise. | The change reaches the logger, history, editor, templates and records, and needs the Playwright suite, which could not be run. The affected programs are pinned in `program-catalog-validation.test.ts`. |
| B-2 | Medium | `src/lib/domain/custom-programs.ts:539` (`slotToExercise`), `:1027` (`meetWeekDays`), main-lift schemes from `:605` | For barbell-specialist types (powerlifting, bench, squat, deadlift, strength) without a barbell, the builder substitutes dumbbell or bodyweight lifts but keeps the heavy low-rep scheme. | A new lifter with dumbbells who picks "Bench: meet prep" gets "Meet Day — Bench: dumbbell bench press 3 × 1"; with no equipment, "Deadlift Day: glute bridge 3 × 4, push-up 3 × 4". The form does warn that substitutes will be used, but singles and triples on these substitutes are not sensible. | A coach's rule: when the chosen exercise cannot be loaded heavily, raise the rep floor (for example 5+ for dumbbells, 8+ for bodyweight) and do not offer meet-prep goals without a barbell. | It changes what the builder prescribes; that is a programming decision, not a data correction. Pinned in `program-builder-matrix.test.ts`. |
| B-4 | Low (needs coach review) | `src/data/programs.ts:2262` (strongman-foundations), `:2516` (mma-off-camp-2-day), `src/data/program-catalog/endurance-mobility.ts:638` (core-strength-stability-8-week) | Three beginner-labelled programs prescribe exercises the exercise catalog rates "advanced": push press and sandbag-to-shoulder; front squat; ab-wheel rollout. | A member who filters for beginner programs gets movements the app itself calls advanced. RPE is already capped at 8.5 for them. | Swap the lift for an intermediate one, or relabel the program; an existing test (`program-safety-caps.test.ts:12-15`) requires strongman-foundations to stay "beginner", so this was an earlier deliberate choice. | Coaching judgment. Pinned as a known list so it cannot grow. |
| B-3 | Low | `src/lib/domain/custom-programs.ts:2235` | A combined strength + running plan may total 7 sessions a week (4 lifting + 3 runs is accepted). | A week with no rest day. No other program or builder path schedules 7 days. | Cap the combined total at 6, or state the missing rest day in the plan text. | Product decision. Pinned in `program-builder-matrix.test.ts`. |
| W-5 | Low | `src/server/services/workouts.ts:211-229` | If a finish is saved on the server but its reply is lost, and the member then logs more sets before retrying, the retry returns the first save: the later sets are not stored and the summary shows the first save's volume. | The extra sets are lost without a message. Needs a lost reply followed by more logging in the same workout. | On a completed retry, compare the payload with the saved session and, if it has more completed sets, apply it as an edit. | Not reproduced in a test here; reported from reading the code. |
| W-6 | Low | `src/lib/validation/schemas.ts:212-217` (`editWorkoutSchema`), `src/server/services/workouts.ts:428` | Finishing requires one completed set; editing does not. A completed workout can be edited down to no completed sets and still counts as a workout for badges, ranks and streaks. | A workout with nothing in it keeps counting. Records and volume are recomputed correctly. | Require one completed set on edit, or tell the member to delete instead. | Product decision (it removes an edit some members may rely on). |
| P-4 | Low | `src/server/services/body-map.ts:46` and `:53` | The muscle map reads at most 1,000 sessions (oldest first) and the newest 500 record rows. | Only for very long histories: more than 1,000 workouts in 12 months, or more than 500 stored records, drops some from the map. | Page both reads like `getPersonalBests` does. | Not reproduced; reported from reading the code. |

Two further notes, not defects: `rebuildRecords` deletes and re-inserts records in two requests
(`workouts.ts:419-424`), so a failure between them leaves an exercise without records until the next edit or delete
rebuilds them; and `advanceProgram` (`src/server/services/training.ts:149-173`) does not check its own write errors
(W-4's fix repairs the result on a retry).

## 2. Program catalog validation

`tests/unit/program-catalog-validation.test.ts` runs over every program in `PROGRAMS`: 74 programs, 64 listed and
10 retired (`src/data/program-retirements.ts`). Retired programs are checked for integrity only (they stay exactly
as their enrolled members have them); listing rules (equipment, level, names) apply to the 64 listed ones.

| Rule | Programs checked | Failing before | Failing now |
|---|---|---|---|
| Every exercise reference exists in the exercise catalog (218 exercises) | 74 | 0 | 0 |
| Sets 1-10, rest 0-600 s, time 5-7200 s, RPE 4-10, reps readable and a plain rep count ≤ 50 | 74 | 0 | 0 |
| Every week has exactly the stored days-per-week, numbered 1…N (the program pointer depends on it), and the stated number of weeks | 74 | 0 | 0 |
| At least one rest day a week (no 7-day week) | 74 | 0 | 0 |
| Weekly hard sets per audited muscle group ≤ 26; sets per session ≤ 24 (beginner) or ≤ 36 | 74 | 0 | 0 |
| A week or day count in the name matches what is stored | 64 | 0 | 0 |
| Every prescribed exercise can be done with the listed equipment | 64 | 9 | 0 (1 documented exception) |
| No listed equipment that no exercise uses | 64 | 6 | 0 (1 documented exception) |
| Beginner programs use no advanced-rated exercise | 64 | 3 | 3 (open, B-4, pinned) |
| Beginner programs never exceed RPE 8.5 | 64 | 0 | 0 |
| Time prescriptions on exercises logged in reps | 64 | 11 | 11 (open, P-3, pinned) |
| No two visible programs near-identical | existing tests `program-catalog.test.ts` ("keeps every pair … below a near-duplicate") and `program-library-cleanup.test.ts`: pass | | |

Highest weekly volume in the library: 23.5 fractional sets for glutes and hamstrings together in
`womens-glute-strength` (a beginner glute specialization; two muscle groups share that figure).

Equipment corrections (B-1):

| Program | Missing (added) | Listed but unused (removed) |
|---|---|---|
| `wave-strength-training-max` | machine (seated leg curl), ab wheel | |
| `powerlifting-base-block` | ab wheel | |
| `squat-specialist` | ab wheel | |
| `conjugate-4-day` | ab wheel | pull-up bar |
| `powerlifting-peaking-12-week` | ab wheel | pull-up bar |
| `strongman-foundations` | cable (face pull), pull-up bar (hanging knee raise, dead hang) | |
| `strongman-4-day-events` | dumbbell (hammer curl, chest-supported row), ab wheel | |
| `boxing-round-ready` | band (band pull-apart, Pallof press) | |
| `mma-fight-conditioning` | rower (20-minute row) | jump rope (only an option in the warm-up) |
| `physique-show-prep` | | pull-up bar |
| `lean-and-conditioned` | | rower (only named as an alternative to the bike) |
| `agility-footwork` | | band |

Documented exceptions: `womens-strength-progression` prescribes a trap-bar deadlift without listing a trap bar (its
note says "Use a conventional deadlift if no trap bar"); `physique-show-prep` keeps the rack for "Back squats work
too". Retired programs with the same kind of mismatch were left alone: `daily-mobility-flow` (dead hang, no pull-up
bar), `combat-conditioning-sessions` (medicine-ball slam, no medicine ball), `athletic-power-development` (Pallof
press, no cable or band).

Programs with time prescriptions on rep-logged exercises (P-3): `busy-schedule-30-minute-workouts`,
`conditioning-intervals-8-week`, `flexibility-recovery-routines`, `full-body-fitness-foundations`,
`full-body-mobility-6-week`, `functional-engine`, `grappling-mat-endurance`, `kettlebell-circuit-intervals`,
`mma-fight-camp-3-day`, `mma-fight-conditioning`, `powerlifting-peaking-12-week`.

## 3. Builder matrix

`tests/unit/program-builder-matrix.test.ts` builds every program type × goal × experience (new, beginner,
intermediate, advanced) × equipment preset (none; dumbbells + bench; home; barbell + rack; full gym) × every
days-per-week the form allows: **2,440 plans**.

| Check | Result |
|---|---|
| Builds without an error | 2,440 of 2,440 |
| Weeks built = weeks asked; every week has the days asked | 0 failures |
| Every exercise exists in the catalog | 0 failures |
| Every exercise can be done with the member's equipment; the plan lists only equipment they own | 0 failures |
| No empty session | 0 failures |
| Beginner plans never exceed RPE 8.5 | 0 failures |
| New and beginner lifters get no advanced-rated movement | 0 failures outside strongman; 24 strongman plans do (log press, yoke, farmer's walk, stones, push press), by design: `anyDifficulty` slots, "the event is the point" |
| At most 6 sessions a week from the form | 0 failures (7 only with a combined goal: B-3) |
| Weekly hard sets, busiest audited group | max 25.5 for new/beginner, 28 for intermediate/advanced |
| Sets in one session | under 26 for new/beginner, under 40 otherwise |
| Sensible content without a barbell for barbell types | not sensible: B-2 (open) |

Single-exercise sessions exist and are expected: cardio days (one run) and meet-week sessions (one lift).

## 4. What was verified in workout tracking (no defect found)

Each line is covered by a test that was run (file in brackets).

- Idempotency: the same finish sent three times saves one session, its sets once and its records once; a retry
  reports the same records, as baselines [`tests/integration/workout-audit-2026-11-14.test.ts`]. Two finishes at the
  same time save once [`tests/integration/workout-finish-concurrency.test.ts`, existing]. A second tap on Done within
  700 ms is the same tap (`workout-logger.tsx:149`, read; the W-1 test had to wait past it).
- Recovery: the draft is written to the device on every change and to the account straight after each completed set
  [`workout-logger-backup-stops.test.tsx`]; a draft is restored from device or server, whichever is newer
  [`tests/unit/workout-local-draft.test.ts`, `workout-two-tabs.test.ts`, existing]. A discarded draft is deleted on
  the server, and discarding never touches a completed workout [`workout-audit-2026-11-14.test.ts` integration].
- Volume: only completed working sets count; warm-ups, unfinished and skipped work add nothing; bodyweight and timed
  sets have no volume (no body weight is invented); drop sets count [`tests/unit/workout-audit-2026-11-14.test.ts`].
  Limits to state: unilateral work is counted as logged (reps are not doubled), and dumbbell loads are whatever the
  member typed (per hand or total is not recorded), which is why dumbbell lifts are not ranked.
- Records: a first-ever set is a baseline, not a PR; an equal set is not a record; warm-ups and unfinished sets
  cannot set one; editing the best set down hands the record back to the earlier session; deleting a session moves
  the baseline to the next one [unit and integration audit tests]. Estimated 1RM is Epley, weight × (1 + reps / 30),
  for 1-12 reps, null beyond; the comment said "1–10" and now states the real limit (`strength.ts:13-18`).
- Units: every half pound from 0.5 to 1,500 lb comes back exactly after storage (225 lb stays 225 lb); kilograms are
  stored exactly to 0.25 kg; the same pounds entered twice never create a record
  [`tests/unit/workout-audit-2026-11-14.test.ts`]. A total in pounds is shown as whole pounds.
- Program progression: completing the pointer's day advances it; a day that is not the pointer's does not; skipping
  missed sessions is conditional on the pointer being where the member saw it
  [`tests/integration/workouts.test.ts`, `missed-sessions.test.ts`, existing; W-4 new].
- Edit and delete: records, session volume, badges and streaks are recomputed from stored sessions, never cached
  [`tests/integration/badge-progress.test.ts` existing; audit integration test].

## 5. What was verified in progress and gamification (no defect found)

- Day of a workout: the member's local day, including across the autumn clock change and either side of midnight;
  two workouts either side of local midnight are a two-day streak [`tests/unit/progress-audit-2026-11-14.test.ts`].
- Streaks: day streak survives until a whole day is missed; week streak is Monday to Sunday and is not broken by a
  week in progress [same file].
- Badges and ranks: derived only from stored sessions and records; removing the 10th workout takes the badge and the
  rank back; one workout can never earn the PR badge; an edited-down session lowers the volume total [same file].
- Strength ranks: "no sets", "sets but no body weight", "below Bronze" (a real value) and a hand-computed Platinum
  are told apart; a set older than 12 months stops counting; a missing region is never counted as zero [same file].
- Leaderboards: there are none in the code (the word appears only in `docs/SPEC.md`). Accountability partners belong
  to another auditor's area.

## 6. Files changed

- `src/components/workout/workout-logger.tsx` (W-1, W-2, W-3)
- `src/lib/domain/workout-draft.ts` (W-2)
- `src/lib/domain/record-labels.ts` (W-3, new `formatRecordValue`)
- `src/components/progress/muscle-map.tsx` (W-3, uses the shared formatter)
- `src/server/services/workouts.ts` (W-4)
- `src/lib/domain/strength.ts` (P-1, new `strengthTrend`; corrected comment on the 1RM estimate)
- `src/app/(app)/progress/overview/page.tsx` (P-1)
- `src/data/programs.ts`, `supabase/seed.sql`, `supabase/setup-all.sql` (B-1)
- New tests: `tests/unit/workout-audit-2026-11-14.test.ts`, `tests/unit/workout-logger-backup-stops.test.tsx`,
  `tests/unit/program-catalog-validation.test.ts`, `tests/unit/program-builder-matrix.test.ts`,
  `tests/unit/progress-audit-2026-11-14.test.ts`, `tests/integration/workout-audit-2026-11-14.test.ts`

No existing test was changed or removed. No migration was added. Local database: 12 `training_programs.equipment`
values updated (section 1, B-1).

## 7. Commands run and their results

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint` on the 8 changed source files and 6 new test files | exit 0, no messages |
| `npx vitest run --project unit` (whole suite, once) | 244 files, 4,565 tests: 4,564 passed, 1 failed. The failure is `tests/unit/exercise-motion-quality.test.ts` ("no joint moves faster than a human joint can"), a 5-second timeout while the machine was busy (it took 8.4 s). It is exercise-animation data, out of this audit's scope and untouched. |
| `npx vitest run --project unit tests/unit/exercise-motion-quality.test.ts` (alone) | 13 of 13 passed |
| `npx vitest run --project unit` on the 5 new unit files | 64 passed (19 + 4 + 13 + 8 + 20) |
| `npx vitest run --project integration` on `workout-audit-2026-11-14`, `workouts`, `workout-finish-concurrency`, `workout-fast-logging`, `drop-sets`, `badge-progress`, `edit-safety`, `training-stage2`, `missed-sessions`, `body-map`, `custom-programs`, `pro-programs` | 12 files, 49 tests, all passed |
| `npx tsx scripts/generate-seed.ts` then `bash scripts/bundle-sql.sh` | seed and bundle regenerated; `git diff --stat`: 12 lines each. Before any change the regenerated seed was byte-identical to the committed one. |

Tests seen failing before their fix: W-1 (2 tests), W-2 (3), W-3 (2), W-4 (1), P-1 (3), B-1 (2).

## 8. Not verified here

- **Playwright e2e**: none were run (no server available to this worktree). No e2e spec asserts on text or behaviour
  changed here (checked by search), so none was edited. To run after merging: `workout-reliability.spec.ts`,
  `workout-data-preservation.spec.ts`, `core-flow.spec.ts`, `current-set-card.spec.ts`, `fast-logging.spec.ts`,
  `drop-sets-repeat.spec.ts`, `first-workout-activation.spec.ts`, `ux-train-run.spec.ts`, `ux-progress-sleep.spec.ts`,
  `body-map.spec.ts`, `achievement-progress.spec.ts`, `program-library.spec.ts`, `pro-programs.spec.ts`,
  `training-stage2.spec.ts`, `program-builder.spec.ts`.
- **In a browser**: the strength-trend tile with one session (P-1) and the completion screen's record lines (W-3)
  were verified through their functions, not by looking at the page.
- **On a phone**: app kill and relaunch mid-workout, the workout surviving in the WebView's storage, rest
  notifications in the background, and discard while offline in the native shell. The logic behind them is covered
  by unit tests with jsdom's storage and fake timers only.
- **Real time zones on a device**: day and streak boundaries were tested with fixed instants and IANA zones in Node,
  not by changing a device's clock.
- **Production data**: the equipment corrections reach production only when the regenerated seed is run there.
- **Programming quality**: the validation checks structure and bounds. It does not show that any program is
  effective, and nothing here should be read as a claim about results.
