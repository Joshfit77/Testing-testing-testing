# Train & Run: first-time-user audit

Evidence: `before-{new,occasional,established}/shots/*` and `metrics.json`, plus `before-onboarding/12-first-workout.png`. Shots and crops are listed by file. Nothing was captured for a template detail page or for new-member history/activity detail pages, because the demo accounts have no such rows. Most routes load in about 0.75–1.3 s, and no route showed an error page.
**BB** = BADGE-BRANCH file. Do not edit it now.

## Screens

### /train
- **Purpose:** start today's session. **Primary action:** gold "Start workout". **Understood:** yes. It is the first card, and it turns into "Resume workout" when a draft exists (`TodayWorkoutAction` checks localStorage and the server).
- **Friction:** "Empty workout", "Workout history" and "My workouts" sit behind the collapsed "More training tools" section. Every row description is cut off ("GPS runs and walks, running plans, re…").
- **Metrics:** 1 screen, 0 small targets.
- **Recommendation:** shorten the row subtitles so they fit on one line (for example "GPS or treadmill", "Demos & your history"). Nothing else needs to change.

### /train/programs
- **Purpose:** find a program. **Understood:** partly. The page is 24.4 screens long with 2,250 words and 66 cards (`new/006`).
- **Top of page:** a Free member first sees a Pro upsell card ("Build my program … Included with Pro All Access"). Search, Filters and the category chips come after it.
- **Each card has:**
  - a 112 px artwork band (`h-28`); across 51 cards that is about 5,700 px, roughly 6.7 screens;
  - a category label that repeats the group heading above it;
  - the summary;
  - the meta line;
  - a difficulty badge;
  - an equipment list;
  - "Complete: 15 of 18 sessions (80%)". This is the requirement for finishing the program, but it reads like the member's own progress.
- **Recommendation:** remove the art band, the category label and the "Complete:" line (the detail page already explains completion as "To complete it"). Clamp the summary to 2 lines and equipment to 1 line. Show 3 cards per category with a "See all N" link that reuses the existing chip URL. For Free members, move the builder card below the library.

### /train/programs/powerbuilding-4-day
- **Purpose:** decide whether to start or continue. **Primary action:** "Continue program" (or "Upgrade to unlock"). **Understood:** yes.
- **Problems:**
  - The description is 9 lines of jargon ("lengthened-position", "hard sets").
  - Equipment appears twice, once as a sentence and once as chips.
  - There are 27 small targets: the per-day "Start" is 81×36 and the exercise-name links are 24 px tall (established).
- **Recommendation:** clamp the description behind a "More" control, drop the equipment sentence, and use the default button size for "Start".

### /train/build
- **Pro view:** step 1 of 5 runs 3.7 screens and 507 words because every option carries an "A typical week:" paragraph. Hide that paragraph until the option is selected.
- **Free view** (`new/007`): a lock card whose only action is "See plans". Add "Browse free programs" as a second action. This is the `PlanLocked` call in `build/page.tsx`.

### /train/templates and /train/templates/new
- **Problem:** "New workout" and "Empty workout" sit side by side and do not say how they differ. The editor's button says "Save template", but the screen title says "workout". The superset rule is explained before any exercise has been added.
- **Recommendation:** rename the buttons to "Create saved workout" and "Start empty workout", and the save button to "Save workout". Show the superset note only once there are 2 or more exercises (`template-editor.tsx:227`).
- **Empty states are fine.** "0 of 5 saved workouts on Free" is a clear, calm limit.

### /train/history and /train/history/[id]
- **List:** clear, grouped by month. For a new member, the empty account still shows two stat tiles ("0 lb weight × reps, completed sets"). Hide the tiles until there is at least one workout.
- **Detail:** set rows are readable, with Edit plus a trash icon.
- **Odd weights:** values such as "369.3 lb" and "52.9 lb" come from demo data seeded in kg (DEMO-ONLY as values). Recorded values must stay as they are.

### /train/review
- **Free view:** a clear Pro lock.
- **Pro view, consistency line:** established shows "14 workouts in the last 4 weeks of about 9 planned (78%)". The count uses 28 days, but "planned" and the % use the days since the program started (`adaptive-training.ts:203-209`, `training-review.tsx:205`). "Last workout: 2026-11-07" is a raw ISO date.
- **Small targets:** occasional has 5, including "Why" at 327×16 and "Got it" at 84×36.

### /train/recovery
- **Size:** 4.9 screens and 493 words on a new account. The check-in form comes first, followed by fixed reference text: rest-day activities, General warm-up, General cooldown, and 5 "Exercise modifications" cards.
- **Small target:** the consent checkbox is 20 px (13×20 sample).
- **Recommendation:** put the reference sections inside a collapsed "Guides" section, and wrap the checkbox in a label at least 44 px tall.

### /train/exercises
- **Size:** 23.9 screens, 157 cards and 1,120 words. The list is alphabetical, so a member first sees "5-10-5 Pro Agility Shuttle" and "90/90 Hip Switch".
- **Filters:** four selects plus a separate "Filter" submit button, so every filter change takes 3 taps.
- **Thumbnails:** every one is labelled "DEMO". All 157 demos are `animated`, so the label tells the member nothing.
- **Recommendation:**
  - Replace the muscle select with a row of muscle-group chips, built as links like the program category chips.
  - Move category, difficulty and equipment into a collapsed "More filters".
  - Make each row one line high: name, then muscles · category.
  - Show the label only when a demo is "Poses".

### /train/exercises/back-squat (BB)
- **Order today:** header → history link → demo → caption plus a YouTube line → muscles, equipment and 4 alternatives → "How to do it" → form cues → mistakes. The technique content starts about 1.5 screens down.
- **No Setup/Execution/Mistakes split:** the page does not have it, but the logger's `ExerciseInfoDialog` already does (Setup / Execution / Mistakes tabs).
- **Demo** (`est/016`):
  - The dark athlete fills only about a third of the frame's height, because the controls sit on top of the lower part (`controlsInset: 74` plus 12% padding in `fitCamera`).
  - The scrub bar is 22 px tall ("Position in the movement", 339×22).
  - Play, 1×/0.5× and full screen are 44 px, which is fine.
- **Recommendation:** order the page demo → top 3 cues → Setup/Execution/Mistakes tabs (reuse the dialog's `Segmented`) → a collapsed "Muscles, equipment & alternatives" → history link. The page is BB, so this must wait. The demo sizing is fixable now in `exercise-demo.tsx` and `lib/exercise-motion/mount.ts`, which are not BB.
- **Manual sign-off** (`src/data/exercise-demo-readiness.json`, reviewed 2026-11-04):
  - `ownerApproved` is empty, so all 157 demos still need the owner's sign-off.
  - Coach review is flagged for: thoracic-open-book, conventional-deadlift, sumo-deadlift, front-squat, pull-up, chin-up, dips.
  - `docs/EXERCISE_DEMOS_2D.md` names the weakest reads: three-cone drill, thoracic open book, Pallof press, rear delt fly, hip escape.

### /train/exercises/back-squat/history (BB)
- **Good:** best set, a 1RM chart and recent sessions.
- **Chart axis:** the y-axis labels are cut off ("360 lb" shows as "60 lb") because `YAxis width={52}` in `components/charts/chart-plots.tsx`, which is not BB.
- **New account:** "0 sessions logged" repeats what the empty state already says.

### /train/workout (active logger; `onboarding/12`)
- **Above the fold:** one Complete set button (h-14, gold), the set rows, and weight and reps steppers.
- **Rest timer:** starts automatically when a set is completed (`workout-draft.ts` `toggleSetComplete` → `startRest`). Controls are a 2.5 rem countdown, −30 / +30 / Skip rest (h-12), and a 40 px pause.
- **Drafts:** saved on the device and on the server, flushed on `visibilitychange`, re-synced when back online, with an offline notice and a prompt for stale drafts. All preserved.
- **Substitutions:** carry reps over and keep completed sets. Preserved.
- **Problems:**
  - Header "Finish" uses the same gold primary style as Complete set (BB `workout-logger.tsx:921`).
  - Below Complete set there are 6 more controls: "All sets", Skip set, Next exercise, Exercise info, Substitute, and "Form cues, swap or skip". That last one repeats swap, skip and the Exercise info content.
  - The bottom nav stays visible unless focus mode is turned on.
  - The weight stepper adds exactly ±5 lb or ±2.5 kg with no snapping (`current-set-card.tsx:70`), so a pre-filled 292.1 lb becomes 297.1.
  - "Target 2 × 6-10 · RPE 7.5" is jargon for a member's first workout.
- **Empty logger** (`est/018`): clear.

### Completion summary (inside the logger, BB)
- Shows PRs, then the Next Workout and View Summary buttons, then Up next, then Baselines, and only then "Badge unlocked!" (`workout-logger.tsx:727`). New achievements end up below the fold.

### /run
- **Tabs:** Outdoor Run | Treadmill / Manual | History. The "Outdoor Run" tab also covers walks, and "Treadmill / Manual" wraps onto 2 lines.
- **Free member** (`new/018`):
  - The most prominent element is a gold "Outdoor run PRO" card. Its PRO tag is 10.4 px (tinyText = 2).
  - The only explanation is in a 60-word gray paragraph, and the free path is a text link at the end of it.
  - Tapping the PRO card opens the full GPS screen, and the lock only appears at the bottom.
- **Charts, goals and records:** have no weight-based guidance. Good.
- **Small targets:** 5–7 (History 73×36, remove-goal 31–35×36, mi/km 44×36).

### /run?tab=log
- Fast and clear, but the "Where" control defaults to Outdoors even though the tab is labelled "Treadmill". The form is 4.4 screens long because the overview content follows it.

### /run?tab=history and /run/activities/[id]
- **History:** weekly totals plus list rows. Clear.
- **Activity detail:**
  - The only action is a full-width red "Delete"; GPS activities have no Edit.
  - "4 mi 0:56" on a 3.11 mi run is seed data (DEMO-ONLY): `gps-track.ts newSplits` only writes full splits.
  - "Sample route for the demo" is DEMO-ONLY.

### /run/record?kind=run|walk
- **Problems:**
  - Run versus walk is asked a second time.
  - The "Demo: … sample routes" box is DEMO-ONLY.
  - The browser warning is 3 lines.
  - Pause and Finish (`gps-recorder.tsx:642-676`) are default-height (44 px), not large.
  - GPS status is a small badge plus "GPS ±m" at text-xs.
- **Already in place:** confirm before Finish and Discard, the track saved to localStorage and recoverable, a signal-lost notice, keep-screen-on, and a permission-denied message with Open Settings.
- **Free view:** after "Live GPS … Pro All Access" there is a large "See Pro All Access" button, and the free option is still a small "No GPS? Log … by hand" link.
- **DEVICE:** background recording with the screen locked, permission prompts, and sunlight readability.

## Ranked issues

| ID | Title | Impact | Evidence | Fix (smallest) | Files | Effort | Class |
|---|---|---|---|---|---|---|---|
| TR1 | Free member's main Run choice is a locked PRO card; free path hidden | High | new/018-run.png (tinyText 2, "10.4px PRO"); new/021-run-record | Now: in `gps-recorder` when `!canRecord`, hide the run/walk picker and show a full-width "Log it by hand (free)" button above the upsell. Later (BB): on /run, for Free show "Log a run or walk (free)" as the gold card, make the GPS cards secondary with a 12 px "PRO" tag, and cut the paragraph to "GPS recording is Pro. Logging by hand is free." | components/run/gps-recorder.tsx; app/(app)/run/page.tsx **BB** | S | APP |
| TR2 | Program library is 24 screens | High | new/006 (24.4 scr, 2,250 words, 66 cards) | Remove the art band, category label and "Complete:" line; line-clamp the summary to 2; equipment on 1 line; 3 cards per category plus "See all" | app/(app)/train/programs/page.tsx | S | APP |
| TR3 | Exercise library is 24 screens and filters need a submit | High | new/013 (23.9 scr, 157 cards, 164 interactive) | Muscle chips (links); other selects under "More filters"; one-line rows; drop the "Demo" label when animated | app/(app)/train/exercises/page.tsx | M | APP |
| TR4 | Logger: two gold primaries, 6 secondary controls | High | onboarding/12-first-workout.png | Now: remove the "Form cues, swap or skip" section (its cues are in Exercise info); one row Skip set · Swap · Next. Later (BB): header Finish `variant="secondary"` until all sets are done; focus mode (hides nav) on by default | components/workout/current-set-card.tsx; workout-logger.tsx **BB** | S | APP |
| TR5 | New achievements below the fold on the completion screen | Medium | workout-logger.tsx:580-748 | Move the "Badge unlocked!" section directly after the PR card, above the buttons. Inline JSX, no wrapper route: wait for the branch | workout-logger.tsx **BB** | S | APP |
| TR6 | Demo subject small and dark; scrub bar 22 px | Medium | est/016-exercise.png; smallTargets "339x22 Position in the movement" | Render controls below the canvas (`controlsInset` 0), cut `fitCamera` padBottom to about 6%, scrub height 44 px, lighter stage backdrop or brighter athlete fill | components/train/exercise-demo.tsx; lib/exercise-motion/mount.ts, render.ts | M | APP (final brightness: DEVICE) |
| TR7 | Exercise page buries technique; no Setup/Execution/Mistakes | Medium | est/016-exercise-full.jpg | Reorder: demo → 3 cues → tabs reused from `ExerciseInfoDialog` → collapsed muscles/equipment/alternatives. Must wait for the branch | app/(app)/train/exercises/[slug]/page.tsx **BB** | M | APP |
| TR8 | Weight stepper keeps odd decimals (292.1 → 297.1) | Medium | est/017 "292.1 lb"; current-set-card.tsx:70 | `bump`: snap to the step (`Math.floor/ceil(v/step)*step` when not on the step). Recorded sets and PRs untouched | components/workout/current-set-card.tsx | S | APP |
| TR9 | Review consistency mixes 28-day count with since-start plan | Medium | occ/est 011-train-review-full ("14 … of about 9 planned (78%)") | Return `sessionsInWindow` and `plannedWindow`; show "7 of about 9 planned since you started (78%)"; format the date | lib/domain/adaptive-training.ts; components/train/training-review.tsx | S | APP |
| TR10 | Run Pause/Finish not large; GPS status tiny | Medium | gps-recorder.tsx:548-676 | Sticky bar buttons `h-14 text-lg`; status badge size lg with "GPS good/weak ±m" | components/run/gps-recorder.tsx | S | APP / DEVICE |
| TR11 | 1RM chart y-axis labels cut off | Low | est/017-exercise-history.png | `YAxis width={60}` (or measure) | components/charts/chart-plots.tsx | S | APP |
| TR12 | Recovery: 5 screens of reference; 20 px consent box | Low | new/012 (4.9 scr, smallTarget 13×20) | Put Rest-day / Warm-up / Cooldown / Modifications in a `<details>`; 44 px label row | app/(app)/train/recovery/page.tsx; components/recovery/checkin-form.tsx | S | APP |
| TR13 | Run tabs mislabelled; treadmill entry defaults to Outdoors | Low | est/020-run-tab=log.png | Tabs "Outdoor · Treadmill & log · History". Default `source:"treadmill"` lives in /run page: wait for the branch | components/run/run-tabs.tsx; run/page.tsx **BB** | S | APP |
| TR14 | GPS activity: only action is a red full-width Delete | Low | est/024-activity-full.jpg | `DeleteActivityButton` as outline/ghost, not full width | components/run/delete-activity-button.tsx | S | APP |
| TR15 | Saved-workout labels unclear | Low | new/008, 009 | "Create saved workout" / "Start empty workout" / "Save workout"; superset note only with 2+ exercises | train/templates/page.tsx; components/workout/template-editor.tsx | S | APP |
| TR16 | Program detail small targets, double equipment | Low | est/014 (27 small targets) | Default-size Start; remove the equipment sentence; clamp the description | train/programs/[slug]/page.tsx | S | APP |
| TR17 | Pro locks (builder, review) give no free route | Low | new/007, new/011 | Second action "Browse free programs" | train/build/page.tsx; components/common/plan-locked.tsx | S | APP |
| TR18 | Empty history shows "0 lb" stat tiles | Low | new/010 | Hide the tiles when count is 0 | train/history/page.tsx | S | APP |
| TR19 | Demo notes: "Demo: … sample routes", "Sample route for the demo", partial "4 mi" split | — | new/021, est/024 | none | — | — | DEMO-ONLY |

Fixes possible now without touching BB files: TR1 (partly), TR2, TR3, TR4 (partly), TR6, TR8–TR12, TR13 (partly), TR14–TR18. These must wait for the badge branch: TR5, TR7, the BB halves of TR1/TR4/TR13, and any change to the exercise page order.

## Summary
1. A Free member's first Run choice is a gold "Outdoor run PRO" card they cannot use. The free manual log is a link inside a 60-word paragraph (TR1).
2. Programs (24.4 screens) and Exercises (23.9 screens) are far too long. Removing art bands and the "Complete:" line, plus adding muscle chips and one-line rows, would cut most of the length (TR2, TR3).
3. The logger has one Complete set button, but it competes with a gold Finish and six secondary controls (TR4). Rest timer, drafts, offline handling and substitutions already work well.
4. New badges show up below the fold on the completion screen, and the exercise page buries Setup/Execution/Mistakes. Both are in badge-branch files and must wait (TR5, TR7).
5. The demo figure is small and dark with a 22 px scrub bar (TR6). All 157 demos still need owner sign-off, and 7 are flagged for coach review.
