# Narrow Gate Fitness: project checklist

Last audited: 2026-10-20, against `docs/SPEC.md` (sections 1–16) and `docs/design/reference-five-screens.png`.

Update the statuses at the end of each stage (SPEC §16). A row moves to Working only when code and a test or a recorded manual check support it.

**Scope.** The rows track the primary product: Next.js 15 App Router, Supabase (auth, RLS, `supabase/migrations`), Stripe, the server-side Anthropic coach, and the Capacitor iOS/Android shells that load the deployed site. The offline single-file edition (`standalone/index.html`, generated from a template outside the repo, localStorage only, no accounts) is covered by an **Offline** note under each section.

**How statuses were set.** Each status comes from reading the code, migrations and tests at the audit date. Tests were not re-run during this audit because other agents were editing the tree at the time. Uncommitted work in progress counts as present but is flagged "(uncommitted)". That covers `src/lib/domain/session-time.ts`, `src/lib/domain/program-audit.ts`, `src/lib/exercise-motion/`, `src/lib/coach/`, `src/server/coach/` and the edits to the program templates.

**Statuses:** Working · Partial · Missing · Requires External Setup · Requires Content Review.
**Stages (SPEC §16):** 1 = storage, accounts, navigation, core logging · 2 = training, nutrition and faith flows · 3 = running, progress, body map, ranks, badges · 4 = coaching, wearables, accountability, content.

---

## 1. Visual design

Offline: the same black and gold tokens, with the same oversized uppercase headings. There is no text-size setting.

| ID | Requirement | Status | Evidence | Stage |
|---|---|---|---|---|
| 1.1 | Match the reference: compact layout, imagery, cards, spacing | Partial | Stage 1A: Home, Train, Food, Faith, Profile and My Progress restyled to the reference's compact cards (`MainHeader`, 12–16px radii, charcoal cards). Original SVG artwork `public/illustrations/mountains-sunrise.svg` (Home Scripture card) and `cross-dusk.svg` (Faith hero). Screenshots at 360×740 and 430×932 checked. No photo imagery for workouts/meals (none owned); Run screen belongs to Stage 1B. | 1 |
| 1.2 | Black backgrounds | Working | `--background: #090909` in `src/app/globals.css` | 1 |
| 1.3 | Charcoal cards | Working | `--card: #171717`, `--elevated: #232323` | 1 |
| 1.4 | White text | Working | `--foreground: #ffffff` | 1 |
| 1.5 | Metallic gold accents | Working | `--gold #c9a54c`, plus the `.bg-gold-gradient` and `.text-gold-gradient` utilities | 1 |
| 1.6 | Bronze shadows | Working | `--bronze #8c6a2f` and `--bronze-shadow` tokens, `.shadow-bronze` on primary buttons and the My Progress button (`src/app/globals.css`, `src/components/ui/button.tsx`) | 1 |
| 1.7 | Champagne highlights | Working | `--champagne #f1dfa8`; gold gradient champagne → gold → bronze (`.bg-gold-gradient`, `.text-gold-gradient`, logo, progress ring) | 1 |
| 1.8 | Not bright yellow | Working | The palette is muted gold | 1 |
| 1.9 | Body text about 16px | Working | Tailwind's default 16px base | 1 |
| 1.10 | Secondary text about 14px | Partial | Shell, Home, Train hub, Food top, Faith top, Profile and Progress use 14–15px secondary text; 10–11px sizes removed from those files. About 30 `text-[10px]`/`text-[11px]` uses remain in other components (workout logger, nutrition dialogs, charts). | 1 |
| 1.11 | Headings 24–28px | Working | `MainHeader` and `PageHeader` h1 are 26px (28px on desktop), mixed case, Plus Jakarta Sans. Legacy `font-display uppercase` headings are neutralised globally (`.font-display.uppercase` in `globals.css`). | 1 |
| 1.12 | Controls 44–48px tall | Partial | Button `default`/`icon` 44px; `sm`/`icon-sm` keep a compact look but get a 44px hit area (`after:-inset-1`); Switch has a 44px hit area; dialog close is 44px; header buttons, bottom tabs (64px) and chips on Train/Faith are ≥44px. Not every ad-hoc link across the app is audited. | 1 |
| 1.13 | Readable and balanced for ages 18–60 | Partial | Oswald uppercase removed: Inter body, Plus Jakarta Sans headings, Lora for Scripture. Remaining small labels in untouched components (see 1.10). | 1 |
| 1.14 | Supports system text scaling | Partial | Root size is `100%` (keeps the browser/OS setting) and the text-size preference scales it (`html[data-text-size]`). rem-based sizes in the restyled screens; some px sizes remain elsewhere. WebView text zoom untested on a device. | 1 |
| 1.15 | Supports screen readers | Partial | Skip link, aria-labels, `aria-current` and `sr-only` are in place. There is no automated a11y audit (no axe tests). | 1 |
| 1.16 | Default interface not oversized | Working | Headings 26–28px, body 16px, secondary 14–15px on the main screens (screenshots in Stage 1A report) | 1 |
| 1.17 | Text-size preference in Settings | Working | Profile & Settings → Display & Faith: Default / Large / Extra large (`src/components/profile/display-settings.tsx`), stored in `profiles.text_size` (migration `20261020000009_ui_prefs.sql`), applied before paint from localStorage (`src/app/layout.tsx`); persistence across reload covered by `e2e/navigation.spec.ts` | 1 |
| 1.18 | Consistent icons, typography, radii, spacing and buttons | Partial | Shared `MainHeader`, Button/Input radii (10px controls, 12–16px cards, pill buttons), one icon set. Older sub-pages still carry some ad-hoc styles. | 1 |
| 1.19 | Dashboard values come from real user data | Working | `src/server/services/dashboard.ts`. No illustrative numbers. | 1 |

## 2. Navigation

Offline: still the old nav (`NAV` = Home, Programs, Exercises, Food, Coach, Progress, with Faith under `MORE`); the primary app now has the five tabs.

| ID | Requirement | Status | Evidence | Stage |
|---|---|---|---|---|
| 2.1 | Exactly 5 bottom tabs: Home · Train · Run · Food · Faith | Working | `MAIN_TABS` in `src/components/shell/nav-config.ts` (Home, Train, Run, Food, Faith), `grid-cols-5` bottom bar, More sheet removed; `tests/unit/nav-config.test.ts`, `e2e/navigation.spec.ts` | 1 |
| 2.2 | Run tab | Working | `src/app/(app)/run/page.tsx` (Stage 1B). The Run tab entry in the nav is from Stage 1A. Covered by `e2e/run.spec.ts` | 1 |
| 2.3 | Faith tab always present | Working | Faith is a main tab for every user; `faith_enabled` no longer gates the page or the 40-day challenge actions (`src/server/actions/challenge.ts`). `e2e/challenge.spec.ts`, `e2e/features.spec.ts` | 1 |
| 2.4 | Icon and label visible on every tab | Working | `app-shell.tsx` renders the icon and label | 1 |
| 2.5 | Consistent tab order and position | Working | Static `NAV_ITEMS`. The tab set itself must change (2.1). | 1 |
| 2.6 | Compact gold-outlined "AI Coach" button with chat icon, top right of every main screen | Working | `CoachButton` in `src/components/shell/main-header.tsx`: gold-outlined 34px pill with chat icon and the label "AI Coach", 44px touch target; on Home, Train, Food, Faith, My Progress, calendar, Programs and Profile. Run uses the same component (Stage 1B). `e2e/navigation.spec.ts` | 1 |
| 2.7 | AI Coach button separate from the profile icon and clearly labeled | Working | Separate circular initials button (`ProfileButton`) with an accessible name; `e2e/navigation.spec.ts` | 1 |
| 2.8 | Profile icon opens Profile and Settings | Working | Profile icon → `/profile` (Profile & Settings); `e2e/navigation.spec.ts` | 1 |
| 2.9 | Home → My Progress grouping | Working | Home → My Progress button → `/progress` hub (Overview, Badges, History, Body Map & Ranks placeholder); the Home tab stays active under `/progress` and `/calendar` | 1 |
| 2.10 | My Progress → Overview | Working | `src/app/(app)/progress/page.tsx` | 1 |
| 2.11 | My Progress → Body Map & Ranks | Missing | No route (see §10) | 3 |
| 2.12 | My Progress → Badges | Working | `src/app/(app)/progress/badges/page.tsx` | 1 |
| 2.13 | My Progress → History | Partial | Hub links History to `/train/history` (workouts). Runs/walks history arrives with Stage 1B. | 1 |
| 2.14 | Train → Current Workout | Working | `/train/workout` and `ActiveWorkoutPill` | 1 |
| 2.15 | Train → Programs | Working | Train hub `/train` → Programs `/train/programs` (library and discipline/category filters moved unchanged); `e2e/program-library.spec.ts`, `e2e/navigation.spec.ts` | 1 |
| 2.16 | Train → Exercises | Working | `/train/exercises`, currently also its own bottom tab | 1 |
| 2.17 | Train → Custom Workouts | Working | Stage 2B: Train hub tile "My workouts" → `/train/templates` (build, start, edit, delete saved workouts; empty workout → save as template from the summary). The "not built yet" note is gone. `e2e/training-stage2.spec.ts`. | 2 |
| 2.18 | Train → Workout History | Working | `/train/history`, `/train/history/[id]` | 1 |
| 2.19 | Run → Run/Walk Tracker | Partial | Manual and treadmill entry work (`src/components/run/activity-form.tsx`). Outdoor Run shows an honest "GPS tracking is coming next" card with no Start button. Live tracking is Stage 3 (`docs/RUN_TRACKING_PLAN.md`). | 3 |
| 2.20 | Run → Plans | Partial | `/run` links to the library's First 5K run/walk (couch-to-5K) and Half Marathon 80/20 programs, plus the cardio builder (`/train/build?type=cardio`). There's no 10K program in the library. | 3 |
| 2.21 | Run → Goals | Partial | "Goals & records" on `/run` shows the best 1 mi/5K/10K times (`personalBests` in `src/lib/domain/activities.ts`), with self-reported times flagged. No user-set distance or time goals yet. | 3 |
| 2.22 | Run → History | Working | `/run?tab=history`: grouped by week with run and walk totals, 12-week pages, plus detail, edit and delete. `e2e/run.spec.ts` | 3 |
| 2.23 | Food → Diary | Working | `/nutrition` | 1 |
| 2.24 | Food → Saved Meals | Working | Own screen `/nutrition/saved-meals` (per-serving nutrition with "at least" for gaps, source badges per item, log/plan to any date, confirmed delete); diary keeps "Save as meal". Food tools grid on `/nutrition`. Screenshot at 360 px checked. | 2 |
| 2.25 | Food → Recipes | Working | `/nutrition/recipes` (list + app-made recipes), `/new`, `/[id]`, `/[id]/edit`, `/app/[slug]`. Tables `recipes`, `recipe_ingredients` (migration `20261021000012`). `e2e/recipes-planner.spec.ts` | 2 |
| 2.26 | Food → Meal Planner | Working | `/nutrition/planner`, `src/lib/domain/meal-planner.ts` (deterministic), `src/server/actions/meal-plan.ts`. `tests/unit/meal-planner.test.ts`, `tests/unit/app-recipes.test.ts`, `e2e/recipes-planner.spec.ts` | 2 |
| 2.27 | Food → Grocery List | Working | `/nutrition/grocery`: build from plan for a date range, check off, add own items, clear checked / clear all (`src/lib/domain/grocery.ts`, `src/server/actions/grocery.ts`). `tests/unit/grocery.test.ts`, `e2e/recipes-planner.spec.ts`. No cost estimates (see 8.25). | 2 |
| 2.28 | Food → Nutrition Insights | Working | `/nutrition/insights`: 7-day view with week navigation, per-day calories/macros vs target, average over logged days, not-logged vs logged-as-zero vs complete days, top protein and calorie sources (`src/lib/domain/nutrition-insights.ts`, `tests/unit/nutrition-insights.test.ts`). | 2 |
| 2.29 | Faith → Devotionals | Working | `/faith#devotionals`, `src/data/devotionals.ts` | 2 |
| 2.30 | Faith → Scripture | Working | `/faith`, `src/data/content.ts` | 2 |
| 2.31 | Faith → Prayer Journal | Working | Stage 2C: "Prayer journal" card on Faith plus `/faith/journal` (search, filters: requests / still praying / answered / praise / reflections / shared) and `/faith/journal/[id]` (view, edit, mark answered with date and note, undo, share toggle, confirmed delete). Entry type Reflection / Prayer request / Praise; title, body, optional Scripture; device drafts. Migration `20261021000020_faith_calendar.sql`. `e2e/faith-calendar.spec.ts`, `tests/integration/faith-calendar.test.ts` | 2 |
| 2.32 | Faith → Daily Practices | Working | Stage 2C: choose Scripture reading, prayer, gratitude, fasting, worship, rest/Sabbath or custom practices (`discipline_goals.practice`); check off today or the previous six days; weekly summary in gentle words; month history at `/faith/practices`. `src/lib/domain/practices.ts`, `tests/unit/practices.test.ts`, `e2e/faith-calendar.spec.ts` | 2 |
| 2.33 | Faith → 40-Day Challenge | Working | `src/components/faith/faith-challenge.tsx`, `e2e/challenge.spec.ts` | 2 |
| 2.34 | No duplicate screens; every link opens the same underlying feature | Partial | Coach is now only the header button plus `/coach`; Progress only under Home. Weekly activity uses one service (`getWeeklyActivity`). Still to re-check after Run and Food sub-screens land. | 1 |

## 3. Home

Offline: Home has a greeting, today's workout and summaries. No calendar.

| ID | Requirement | Status | Evidence | Stage |
|---|---|---|---|---|
| 3.1 | Personal greeting | Working | `greeting(hour)` + name in `src/app/(app)/home/page.tsx` | 1 |
| 3.2 | Scripture image card | Working | Image card with original artwork, verse excerpt, reference and BSB; whole card opens `/faith#todays-devotional`; can be hidden in Settings (default on). `e2e/navigation.spec.ts` | 1 |
| 3.3 | Today's workout with Start | Working | Hero card and `startHref` | 1 |
| 3.4 | Resume an in-progress workout from Home | Working | Home and Train show "Resume workout" when a local draft exists or the server has an `in_progress` session (`src/components/home/today-workout-action.tsx`). `e2e/core-flow.spec.ts` (switch to Home mid-workout → Resume → same sets), `e2e/onboarding-plan.spec.ts` | 1 |
| 3.5 | Nutrition summary | Working | Calories eaten / budget with a gold bar, taps to Food; honest locked state on Free | 1 |
| 3.6 | Weekly activity summary | Partial | "This week" card from `getWeeklyActivity(userId, timezone)` (`src/server/services/activity-summary.ts`, `src/lib/domain/activity-week.ts`, `tests/unit/activity-week.test.ts`) with Mon–Sun bars; returns `workouts`, `runs`, `walks` (runs/walks empty until Stage 1B). | 1 |
| 3.7 | Prominent My Progress button | Working | Gold-outlined My Progress button on Home; `e2e/navigation.spec.ts` | 1 |
| 3.8 | Access to the training calendar | Working | Home → Training calendar and Home's "Change the date" link → `/calendar` (month and week views, Today, day panel, Up next). Protected by middleware (`PROTECTED_PREFIXES`). `e2e/navigation.spec.ts`, `e2e/faith-calendar.spec.ts` | 2 |
| 3.9 | Compact AI Coach button | Working | Header AI Coach pill (see 2.6) | 1 |
| 3.10 | Focused overview; detail after tapping a card | Working | Home is greeting, Scripture card, today's workout, nutrition, this week, My Progress, calendar, and a Steps/Supplements/Recovery row. Steps moved to the My Progress hub (`/progress#steps`); PRs, weight chart, recovery and coach prompts live in Progress/Train/Coach. | 1 |
| 3.11 | Calendar combining workouts, runs, walks and rest days | Working | `buildCalendar` (`src/lib/domain/calendar.ts`) merges completed workouts, runs, walks (from `activities`), dated planned program sessions (`src/lib/domain/training-schedule.ts`: next session today, then the program's usual weekdays) and rest days (from today to the last planned session). `tests/unit/calendar.test.ts`, `tests/unit/training-schedule.test.ts` | 2 |
| 3.12 | Reschedule sessions without losing completed history | Partial | Move a planned session to another date on `/calendar` (`movePlannedSessionAction`, table `planned_session_overrides`, owner-only RLS); "Back to <date>" undoes it. Only pending sessions can move; completed workouts are never touched. Home's Today's workout follows the move ("Rest day today", "planned for … (moved)", Start workout early). `tests/unit/training-schedule.test.ts`, `tests/integration/faith-calendar.test.ts`, `e2e/faith-calendar.spec.ts`. **Train's Today's workout card doesn't show the planned date yet** (`src/app/(app)/train/**` belongs to the Train helper; the change is described in the Stage 2C report). | 2 |

## 4. Onboarding and personalization

Offline: has its own onboarding and the program builder.

| ID | Requirement | Status | Evidence | Stage |
|---|---|---|---|---|
| 4.1 | Primary goal | Working | `onboarding_answers.primary_goal`, `onboarding-questionnaire.tsx` | 2 |
| 4.2 | Secondary goal | Partial | Optional "Second goal" step (skippable; includes Train for a 5K) in onboarding and in Profile → Edit onboarding details; `onboarding_answers.secondary_goal`; shown on `/plan`. It is recorded only: the program is still built around the main goal and the AI coach doesn't read it yet (coordinating combined goals, SPEC §4, isn't built). `e2e/faith-calendar.spec.ts` | 2 |
| 4.3 | Training experience | Working | `experience` | 2 |
| 4.4 | Age | Working | Age step. Under-18 block (`e2e/features.spec.ts`). | 2 |
| 4.5 | Relevant body measurements (sex, height, weight, goal weight) | Working | Steps sex/height/weight/target. Migrations `20261017000005`, `20261017000007`. | 2 |
| 4.6 | Available equipment | Working | `equipment[]` | 2 |
| 4.7 | Days available | Working | `days_per_week` | 2 |
| 4.8 | Session duration | Working | `session_minutes` | 2 |
| 4.9 | Dietary preferences | Working | Diet style (13 diets), `src/lib/domain/diets.ts`, `e2e/welcome-diets.spec.ts` | 2 |
| 4.10 | Nutrition goals | Working | Weight goal, pace and activity feed into the budget (`src/lib/domain/calorie-budget.ts`) | 2 |
| 4.11 | Units | Working | Units toggle, `profiles.unit_system` | 2 |
| 4.12 | Optional accessibility preferences | Working | Optional, skippable "Display" onboarding step (text size, reduce motion; applied live, saved to `profiles.text_size` / `reduce_motion`), also in Profile → Edit onboarding details and Profile & Settings. `e2e/faith-calendar.spec.ts`, `e2e/navigation.spec.ts` | 2 |
| 4.13 | Edit answers later | Working | `/profile/preferences` (`OnboardingWizard mode="edit"`) | 2 |
| 4.14 | Preview how changes affect the plan | Working | Stage 2B: builder review step lists what changes from the active program (`planChanges`, `src/lib/domain/plan-preview.ts`); Training preferences has "Change my schedule" with a live before → after preview (days, average session, weeks) before Apply (`src/components/train/schedule-preview.tsx`, `applyScheduleChangeAction`). Unit (`tests/unit/plan-preview.test.ts`) and e2e. The onboarding wizard's own rebuild checkbox (an onboarding component) still rebuilds without a preview. | 2 |
| 4.15 | Fix the 60-minute selection producing a plan labeled ~75 min | Working | Stage 2B: builder, onboarding starter (`buildCustomProgram`) and the legacy preferences generator (`program-generator.ts`) all label days with `estimateSessionMinutes` and fit with `fitSessionToMinutes`; later-week progression can't push past the choice (`maxSessionMinutes`). `tests/unit/session-fit.test.ts`: every type × goal × level at 45/60/75/90 min stays within the choice (meet/contest days exempt and labelled honestly); the builder warns when even the shortest session can't fit (e.g. 20 min of heavy barbell work). | 2 |
| 4.16 | Duration counts sets, rest, warm-ups and transitions | Working | One estimator (`src/lib/domain/session-time.ts`): work + rest + ~1 min set-up/transition per exercise + ramp-up sets before heavy lifts + warm-up/cool-down. The builder's separate `estimateMinutes` and the bodybuilding formula were removed. Unit-tested. | 2 |
| 4.17 | Combined goals (e.g. strength + 5K) on a coordinated schedule | Working | Stage 2B: builder "Add a second goal" (Run a 5K / Conditioning, 2–3 days) for strength and bodybuilding; onboarding's `secondary_goal = run_5k` (or improve_conditioning) with 4+ days builds a combined starter. Run days come from the first-5K/endurance builder; `src/lib/domain/combined-goals.ts` places sessions on weekdays so hard runs are never on/next to heavy leg days (no back-to-back heavy legs; lightest heavy day capped at RPE 7 if needed). Deterministic; `tests/unit/combined-goals.test.ts`. Not in e2e. | 2 |

## 5. Train: programs

Offline: the program library is grouped by discipline (`NGB.disciplineForCategory`) and has a builder. No search or filters.

| ID | Requirement | Status | Evidence | Stage |
|---|---|---|---|---|
| 5.1 | Preserve all existing programs | Working | `src/data/programs.ts` (edits by another agent in progress), `tests/unit/catalog.test.ts`, `supabase/seed.sql` | 2 |
| 5.2 | Searchable program catalog | Working | Stage 2B: text search on `/train/programs` (name, summary, category, equipment, goals; every word prefix-matched), `filterCatalog` in `src/lib/domain/program-catalog.ts`; unit + e2e. | 2 |
| 5.3 | Category: beginner and general fitness | Working | `beginner`, general discipline (`src/lib/domain/disciplines.ts`) | 2 |
| 5.4 | Category: strength and powerlifting | Working | `strength` (4), `powerlifting` (3), `powerbuilding` | 2 |
| 5.5 | Category: bench, squat and deadlift specialization | Working | `bench-press`, `squat-specialization`, `deadlift-specialization` | 2 |
| 5.6 | Category: bodybuilding and muscle building | Working | `hypertrophy` (5), `show-prep` | 2 |
| 5.7 | Category: strongman | Working | `strongman` (2) | 2 |
| 5.8 | Category: MMA, boxing, wrestling and grappling conditioning | Working | `mma-conditioning` (4), `boxing-conditioning`, `grappling-conditioning` | 2 |
| 5.9 | Category: functional fitness, circuits and intervals | Working | `functional-engine`, `lean-and-conditioned`, new `kettlebell-circuit-intervals` (EMOM + 40:20 intervals). Not coach-reviewed (5.32). | 2 |
| 5.10 | Category: athletic speed, agility and explosive power | Working | `speed`, `agility`, `athletic-performance` (2) | 2 |
| 5.11 | Category: endurance and hybrid | Working | `cardiovascular` programs plus new `hybrid-training` category with `hybrid-strength-and-run` (heavy legs Mon, intervals Thu); the builder's combined goals (4.17). | 2 |
| 5.12 | Category: home, dumbbell, band and bodyweight | Working | `home-bodyweight-strength`, new `dumbbell-home-strength` and `band-bodyweight-total-body`; Home also lists any program whose equipment fits a home (`specCategoriesFor`). | 2 |
| 5.13 | Category: calisthenics | Working | New `calisthenics` category: `calisthenics-foundations` (free) and `calisthenics-strength-upper-lower`. Built from existing exercises (no L-sit/handstand demos were invented). | 2 |
| 5.14 | Category: active aging, seated and low-impact | Working | `active-aging-low-impact`, `active-aging-strength-2-day`, new chair-based `seated-strength-mobility`. All flagged for specialist review (5.31). Demos show the standing version of some moves; notes say to do them seated. | 2 |
| 5.15 | Category: mobility, flexibility, warm-ups, cooldowns and recovery | Working | `mobility-flexibility`, `recovery-deload`, `/train/recovery` | 2 |
| 5.16 | The 13 spec categories form the browse structure | Working | `SPEC_CATEGORIES` (13) in `program-catalog.ts`; every library category maps to exactly one (unit-tested); category chips and groups on `/train/programs`. Builder type picker still uses the 7 disciplines. | 2 |
| 5.17 | Program states its goal and experience level | Working | `summary`, `difficulty` on `/train/programs/[slug]` | 2 |
| 5.18 | Program states the equipment needed | Working | Program cards ("Pull-up bar and Resistance bands") and an "Equipment needed" section on the detail page. | 2 |
| 5.19 | Program states its duration in weeks | Working | `duration_weeks` | 2 |
| 5.20 | Program states sessions per week and approximate session length | Working | `days_per_week`, `session_minutes`. Accuracy is covered by 4.15. | 2 |
| 5.21 | Program lists exercises, sets, reps, rest and progression | Working | Program detail page, `progression` text | 2 |
| 5.22 | Program gives substitutions | Working | Alternatives shown per exercise (`exercise_alternatives`) | 2 |
| 5.23 | Program gives lighter-week guidance | Working | Deload weeks, `DELOAD_NOTE`, `noDeloadReason` audit (`src/data/programs.ts`) | 2 |
| 5.24 | Program states its completion requirements | Working | Cards and detail page: "Complete at least 80% of the N sessions — R or more — including the final week" (all sessions for one-week libraries; per-program override field). Detail page shows logged sessions vs required for your run of the program. | 2 |
| 5.25 | Filter: goal | Working | URL filter `goal=`; unit + e2e. | 2 |
| 5.26 | Filter: experience | Working | URL filter `experience=`. | 2 |
| 5.27 | Filter: equipment | Working | "Equipment I have" presets (none, bar, bands, dumbbells, home gym, barbell home gym); a program matches when all it needs is in the set. e2e. | 2 |
| 5.28 | Filter: schedule (days/week) | Working | "Up to N days" (`days=`). e2e. | 2 |
| 5.29 | Filter: session length | Working | "Up to N min" (`minutes=`). e2e. | 2 |
| 5.30 | No near-identical plans under different names | Working | `programSimilarity` (first-week prescription overlap) in `program-audit.ts`; every pair < 0.5 (max 0.28), enforced in `tests/unit/program-catalog.test.ts`. | 2 |
| 5.31 | Flag specialist programming for qualified review before publication | Working | `needsSpecialistReview` / `training_programs.needs_specialist_review` (migration `20261021000013`): show prep, meet prep, combat and active-aging programs, plus built show-prep/MMA/meet-prep programs. UI: "Not yet reviewed by a qualified coach" on cards and detail. No review is claimed. | 2 |
| 5.32 | Specialist programs reviewed (show prep, meet prep, combat, active aging) | Requires Content Review | Needs a qualified coach or physio | 2 |

## 6. Workout player and exercise library

Offline: has a logger with rest timer and vibration, but no supersets or previous performance. Exercise library with search.

| ID | Requirement | Status | Evidence | Stage |
|---|---|---|---|---|
| 6.1 | Log sets, reps and weight | Working | `src/components/workout/exercise-card.tsx`, `e2e/core-flow.spec.ts` | 1 |
| 6.2 | Log duration | Working | Timed sets and the stopwatch in `exercise-card.tsx` | 1 |
| 6.3 | Log distance where applicable | Working | Carries/sleds log weight + distance (m or yd), runs/rows/bikes log time + distance (km or mi) (`src/lib/domain/exercise-tracking.ts`); saved to `workout_sets.distance_m`, shown in history. Unit, integration, e2e. | 2 |
| 6.4 | Previous performance shown beside the current exercise | Working | "Last time: 3×5 @ 225 lb" on each exercise card (`previous-performance.ts`, `getPreviousPerformance`, preloaded and fetched for added exercises). Unit, integration, e2e. | 2 |
| 6.5 | Rest timers | Working | `restRemaining`, ±15 s, skip (`workout-logger.tsx`). Native local notification. | 1 |
| 6.6 | Rest-timer sound or vibration, as an option | Working | "Rest timer alerts" Sound / Vibrate toggles in the logger, saved to `profiles.rest_timer_sound/vibrate`; Web Audio beep and `navigator.vibrate` where supported (not on iPhone Safari, which is said in the UI). Not tested on a device. | 2 |
| 6.7 | Supersets | Working | Draft v2 `supersetId`: link/unlink from the exercise menu or a template; the logger alternates A1, B1, A2… and rests only after the round (longest rest). Unit (ordering, rest, normalisation) and e2e. | 2 |
| 6.8 | Exercise substitutions | Working | `substituteExercise` action, `ExercisePicker` with suggested alternatives | 2 |
| 6.9 | Add exercises | Working | `addExercise` | 1 |
| 6.10 | Remove exercises | Working | `removeExercise` | 1 |
| 6.11 | Reorder exercises | Working | `moveExercise` (Move up/down menu) | 2 |
| 6.12 | Notes | Working | Workout notes and per-exercise notes | 1 |
| 6.13 | Perceived difficulty | Working | Per-set RPE (`workout_sets.rpe`) | 2 |
| 6.14 | Pause and resume | Working | `pause`/`resume` reducer, `pausedSeconds`, e2e | 1 |
| 6.15 | Finish | Working | `finishWorkoutAction` (idempotent, integration-tested) | 1 |
| 6.16 | Discard | Working | Confirm dialog, `discardWorkoutAction` | 1 |
| 6.17 | Session summary | Working | Result screen (duration, volume, records, badges) | 1 |
| 6.18 | Personal records on finish | Working | `detectNewRecords` (`src/lib/domain/strength.ts`), `tests/integration/workouts.test.ts` | 1 |
| 6.19 | Custom workout creation | Working | Template builder from the exercise library: order, sets, reps / time / distance, rest, supersets (`/train/templates/new`). | 2 |
| 6.20 | Saved workout templates | Working | Tables `workout_templates`, `workout_template_exercises` (owner-only RLS, export, cascade; integration-tested); start, edit, delete; save an empty workout as a template afterwards. e2e. | 2 |
| 6.21 | Save completed sets as the session progresses | Working | Saved to local storage immediately, with a debounced server sync (`syncWorkoutDraftAction`, `src/lib/workout-storage.ts`) | 1 |
| 6.22 | Offline logging with later sync | Working | Offline notice, re-sync on `online`. Only the logger works offline; other pages show the offline page. | 1 |
| 6.23 | Exercise library: search by name | Working | `ilike` on `/train/exercises` | 2 |
| 6.24 | Exercise library: muscle group filter | Working | 10 muscle groups (`src/lib/domain/muscle-groups.ts`) mapped to `primary_muscles`; every exercise is in at least one. e2e. | 2 |
| 6.25 | Exercise library: equipment filter | Working | `equipment` select | 2 |
| 6.26 | Exercise library: difficulty filter | Working | `difficulty=` select. e2e. | 2 |
| 6.27 | Clear instructions | Working | Instructions and form cues on `/train/exercises/[slug]` | 2 |
| 6.28 | Common mistakes | Working | `common_mistakes` section | 2 |
| 6.29 | Instruction content expert-reviewed | Requires Content Review | `src/data/exercises.ts` has not been reviewed by a coach | 2 |
| 6.30 | Specific, reviewed demonstration videos or animations | Partial | Animated in-app demos for every exercise are the primary demonstration (uploaded specific videos still win when present). Not expert-reviewed; a few are approximate. | 2 |
| 6.31 | Equipment alternatives | Working | `exercise_alternatives` on the exercise page | 2 |
| 6.32 | Links from an exercise to its performance history | Working | "Your history" on each exercise page → `/train/exercises/[slug]/history`: best set, estimated 1RM trend (chart on Plus/Pro, per-session e1RM listed for everyone), recent sessions linking to history. e2e. | 2 |
| 6.33 | Replace broad YouTube searches with specific demonstrations | Working | The "Watch form videos" button is gone; the animated demo (or an uploaded specific video) is the demonstration, and a small "Search YouTube for more" link remains, labelled as other creators' unreviewed videos. | 2 |
| 6.34 | No invented video assets; nothing labeled expert-reviewed when it isn't | Working | No such labels or assets found | 2 |

## 7. Running and walking

Offline: no running features. Steps can be entered and synced from Health Connect.

| ID | Requirement | Status | Evidence | Stage |
|---|---|---|---|---|
| 7.1 | Run as a dedicated bottom tab | Working | `/run` hub (Stage 1B) with the Run tab in the bottom nav (Stage 1A) | 3 |
| 7.2 | Outdoor Run | Missing | No geolocation code anywhere in `src/` | 3 |
| 7.3 | Outdoor Walk | Partial | Walks can be logged by hand (`kind = 'walk'`) and are totalled separately. No live outdoor walk tracking yet (Stage 3). | 3 |
| 7.4 | Treadmill/manual entry | Working | Run or walk, outdoors or treadmill, date/time, distance (mi/km, optional for a time-only outdoor entry), duration, optional moving time, effort and notes. Zod validation in `src/server/actions/activities.ts`, idempotent client-generated id. Unit-, integration- and e2e-tested. | 3 |
| 7.5 | Miles and kilometers | Working | Stored in metres. Shown in the profile's unit, and the entry form can switch mi/km. `tests/unit/activities.test.ts` | 3 |
| 7.6 | Distance or time goals | Missing | — | 3 |
| 7.7 | Run/walk intervals | Partial | `custom-programs.ts` `first_5k` prescribes run/walk progressions as text. No interval timer. | 3 |
| 7.8 | Beginner, 5K and 10K plans | Partial | The library has First 5K (run/walk) and Half Marathon, linked from `/run`, and a beginner/5K goal exists in the cardio builder. **No 10K plan.** | 3 |
| 7.9 | History and weekly mileage | Working | Weekly run and walk totals in the user's time zone (`weeklyTotals`, unit-tested across time-zone boundaries). This week's totals are on `/run` and in History. Totals recalculate after edit and delete (e2e). | 3 |
| 7.10 | Live: distance | Missing | — | 3 |
| 7.11 | Live: elapsed time | Missing | — | 3 |
| 7.12 | Live: moving time | Missing | — | 3 |
| 7.13 | Live: current pace | Missing | — | 3 |
| 7.14 | Live: average moving pace | Missing | — | 3 |
| 7.15 | Live: GPS route | Missing | — | 3 |
| 7.16 | Live: mile/km splits | Missing | — | 3 |
| 7.17 | Start, Pause, Resume and Finish | Missing | — | 3 |
| 7.18 | Request location when an outdoor session starts | Missing | No location plugin in `package.json`. No `NSLocation*` keys in `ios/App/App/Info.plist`. No location permission in `AndroidManifest.xml`. | 3 |
| 7.19 | Wait for a usable GPS signal | Missing | — | 3 |
| 7.20 | Filter inaccurate readings | Missing | — | 3 |
| 7.21 | Smooth current pace | Missing | — | 3 |
| 7.22 | Visibly handle lost signal; never invent movement | Missing | — | 3 |
| 7.23 | Exclude paused time from moving pace | Partial | Pace always uses `moving_s` (≤ `elapsed_s`, enforced by the DB). `movingSecondsFromSegments` is unit-tested for live tracking. The live pause UI is Stage 3. | 3 |
| 7.24 | No false route segments across pauses or outages | Missing | — | 3 |
| 7.25 | Optional audio split announcements | Missing | — | 3 |
| 7.26 | Background/locked-screen tracking investigated and implemented natively | Partial | Investigated: plugins, versions, Info.plist keys, Android permissions and the foreground service are in `docs/RUN_TRACKING_PLAN.md`. Not implemented, and needs a real device to verify. | 3 |
| 7.27 | Document browser-preview limits for background tracking | Partial | Documented in `docs/RUN_TRACKING_PLAN.md`. The in-app notice comes with live tracking (Stage 3). | 3 |
| 7.28 | Save summaries, routes, splits, notes and records | Partial | `activities` table (`supabase/migrations/20261020000010_activities.sql`) saves summaries and notes, and records are derived. `route` and `splits` columns exist, but nothing writes them until GPS tracking (Stage 3). | 3 |
| 7.29 | Delete runs | Working | Soft delete with a confirmation dialog; weekly totals and records recalculate. `e2e/run.spec.ts`, `tests/integration/activities.test.ts` | 3 |
| 7.30 | Routes private by default | Partial | `is_private default true`, owner-only RLS (integration-tested: other users and admins can't read). No routes are recorded yet. | 3 |
| 7.31 | Stop location tracking when the session ends | Missing | — | 3 |
| 7.32 | Manual activities show no fabricated GPS route | Working | DB check `route is null or source = 'gps'` (integration-tested). The detail page shows "No route: manual entries don't have GPS data" and a Manual entry or Treadmill badge. | 3 |

## 8. Food and nutrition

Offline: has a food diary, search, barcode, water, supplements and planned meals, all stored locally. No meal planner, grocery list or recipe builder (those are in the primary app only, Stage 2A).

| ID | Requirement | Status | Evidence | Stage |
|---|---|---|---|---|
| 8.1 | Calorie and macro targets | Working | `nutrition_goals`, `src/server/services/nutrition-targets.ts`, `updateGoalsAction` | 1 |
| 8.2 | Daily meals and snacks | Working | `meals` and `meal_items`, `/nutrition` | 1 |
| 8.3 | Food search with source information | Working | USDA SR Legacy bundled (`src/data/usda-foods.json`, `src/server/services/usda-local.ts`). Sources labeled (USDA, Open Food Facts, built-in estimates). `meal_items.source`. | 1 |
| 8.4 | Barcode scanning with real product lookup | Requires External Setup | Code complete: Open Food Facts lookup (`src/server/services/open-food-facts.ts`, `src/components/nutrition/barcode-scanner.tsx`), server-side re-read through the shared `resolvePickedFood` (`src/server/services/food-resolve.ts`), now also usable for recipe ingredients (Scan tab in the ingredient picker); macros a label doesn't list are carried as `basis.missing` instead of counting as 0. Tested against a local mock (`e2e/food-amounts.spec.ts`). Live Open Food Facts and a real camera/device need checking outside this environment. | 2 |
| 8.5 | Missing products and denied camera fall back to manual entry | Working | Not-found, denied and cancelled messages with a manual path. `tests/unit/barcode.test.ts`. | 2 |
| 8.6 | Manual food creation | Working | `createCustomFoodAction` | 1 |
| 8.7 | Favorites | Working | Star from search results, the amount step and diary rows; Favorites tab in Add food (`src/components/nutrition/favorite-star.tsx`, `setFoodFavoriteAction`). `food_favorites` table (migration `20261020000011`, owner-only RLS, `unique (user_id, food_key)`, stable `usda:`/`off:`/`food:` keys). `tests/integration/food-favorites.test.ts`, `e2e/journeys.spec.ts` | 1 |
| 8.8 | Recent foods | Working | Recent and frequent lists, `relogItemAction`, `src/lib/domain/diary.ts` | 1 |
| 8.9 | Saved meals | Working | Meal templates (`meals.is_template`), `saveMealTemplateAction`, `logTemplateAction` | 2 |
| 8.10 | Copy a meal | Working | `copyMealsAction` with `mealType` | 2 |
| 8.11 | Copy an entire day | Working | `copyMealsAction` without `mealType`, `e2e/nutrition-diary.spec.ts` | 2 |
| 8.12 | Edit portions | Working | `updateMealItemAction`, `e2e/food-amounts.spec.ts` | 1 |
| 8.13 | Move entries between meals | Working | The amount step changes the meal (`e2e/food-amounts.spec.ts`) | 1 |
| 8.14 | Grams, ounces and food-specific serving units | Working | `src/lib/domain/food-units.ts`, migration `20261019000008_food_amounts.sql` | 1 |
| 8.15 | Water tracking | Working | `water_entries`, `addWaterAction`, `undoWaterAction` | 2 |
| 8.16 | Weekly nutrition summaries | Working | `/nutrition/insights` (calories and macros per day vs targets, averages over logged days, top sources); `/nutrition` keeps its 7-day calorie card and links to it. `tests/unit/nutrition-insights.test.ts` | 2 |
| 8.17 | Recipe: add ingredients and amounts | Working | Recipe builder with the food search, My foods and barcode (`src/components/nutrition/food-picker.tsx`, `recipe-editor.tsx`), amounts in g/oz/lb/household units via `computeAmount`; nutrition snapshotted server-side in the basis format (`saveRecipeAction`). Unsaved edits kept as a device draft (`food.recipe.*`). `e2e/recipes-planner.spec.ts` | 2 |
| 8.18 | Recipe: set servings | Working | `yield_servings` | 2 |
| 8.19 | Recipe: total and per-serving nutrition | Working | `NutrientTable` (total and per serving for calories, macros, fiber, sugar, sodium) from `src/lib/domain/recipes.ts`; `tests/unit/recipes.test.ts`; e2e checks 741 kcal total / 371 per serving. | 2 |
| 8.20 | Recipe: log full or partial servings | Working | `servings` input with 0.25 steps, `logTemplateAction` | 2 |
| 8.21 | Recipe: historical diary values kept when a saved recipe changes | Working | Items are copied into `meal_items` at log time. Templates are immutable (they can only be deleted). | 2 |
| 8.22 | Meal planner uses targets, diet preferences, allergy exclusions, budget and meal frequency | Working | Targets from `nutrition_goals` (the `calorie-budget.ts` budget unless custom) with the budget as fallback; diet style via ingredient tags (`src/lib/domain/food-tags.ts`); allergies and dislikes, meals per day 2–5 and budget low/medium/any in `meal_plan_settings`. Budget tiers are by ingredient type, not prices (stated in the UI). Allergy matching is by ingredient name, not a certified allergen check (stated in the UI). `tests/unit/meal-planner.test.ts`, `tests/unit/app-recipes.test.ts` | 2 |
| 8.23 | Meal planner: swap meals and adjust portions | Working | Swap dialog offers alternatives that fit the meal (`alternativesFor`, re-checked on the server), ± quarter-serving portions, "Log this meal" copies to the diary. `e2e/recipes-planner.spec.ts` | 2 |
| 8.24 | Grocery list that combines compatible ingredients | Working | `mergeGroceries`: weights add as g/oz/lb, volumes as ml/cups/tbsp, counted units only with the same unit; non-convertible amounts stay separate with a note. `tests/unit/grocery.test.ts` | 2 |
| 8.25 | Cost estimates labeled | Missing | No sourced price table: BLS/USDA ERS average retail prices couldn't be fetched from this environment, so no prices are shown. The grocery screen says "No cost estimate" and why; nothing shows $0. Needs a dated, sourced price table (e.g. BLS Average Price Data) added in code. | 2 |
| 8.26 | Planned meals kept separate from meals eaten | Working | `meals.status` planned/logged, `markPlannedEatenAction` | 2 |
| 8.27 | Restaurant search with reliable data | Requires External Setup | Not built. Needs a licensed restaurant nutrition API and its credentials. | 4 |
| 8.28 | Distinguish published values from estimates | Working | `SourceBadge` (USDA / Label (· Open Food Facts) / Estimate / Calculated) on diary rows, search results, the amount step, recipe ingredients and saved-meal items (`src/components/nutrition/source-badge.tsx`). Restaurant data still not available (8.27). | 2 |
| 8.29 | Food swaps with comparable portions and clear nutritional differences | Missing | — | 4 |
| 8.30 | Photo-assisted logging that suggests foods and portions | Missing | — | 4 |
| 8.31 | Photo logging: user confirms before saving | Missing | — | 4 |
| 8.32 | Photo logging: asks about uncertain oils, sauces and ingredients; never presented as exact | Missing | — | 4 |
| 8.33 | Weekly summary distinguishes missing or incomplete logs from zero intake | Working | Day states not logged / logged as zero / logged / complete, with "Mark day complete" and "I ate nothing this day" in the diary (`nutrition_day_marks`, `setDayMarkAction`); averages only over logged days. `tests/unit/nutrition-insights.test.ts` | 2 |
| 8.34 | Missing nutrient data never silently becomes zero | Working | Recipes, saved meals and insights track coverage per nutrient and show "at least X" or "—" (`src/lib/domain/recipes.ts`); missing macros from labels carried as `basis.missing`; a logged recipe serving stores gaps as unknown. `tests/unit/recipes.test.ts` | 2 |
| 8.35 | Supplement logging | Working | `/nutrition/supplements`, `supplement_stack`, `supplement_logs`, `e2e/supplements-steps.spec.ts` | 2 |
| 8.36 | Sourced supplement and nutrition education | Requires Content Review | `src/data/supplements.ts` doses and evidence ratings, and `/nutrition/diets`, need a dietitian review and source citations | 4 |
| 8.37 | No unsupported cleanse or detox claims | Working | No matches in `src/data` | 2 |
| 8.38 | One consistent nutrition calculation system | Working | All food values go through `resolvePickedFood` (server) and `computeAmount`/`nutritionForGrams` (diary, recipes, planner, logged servings); planner targets come from the saved targets produced by `estimateAndSaveTargets`. Unit test checks recipe totals equal the diary maths. The bodyweight fallback for accounts without budget fields remains, behind that one entry point. | 2 |
| 8.39 | Prevent duplicate exercise imports | Partial | No exercise imports exist yet. Steps are upserted per day per source (`src/lib/domain/steps.ts`). | 4 |
| 8.40 | Don't count the same activity twice when adjusting the calorie budget | Working | `exerciseForDay` (`src/lib/domain/exercise-energy.ts`): workouts (MET) + runs/walks (distance or time) + only steps beyond the activity level's baseline and beyond the steps of logged runs/walks. Explained under the budget strip on `/nutrition`. `tests/unit/exercise-energy.test.ts`. Wearable workout imports don't exist yet (8.39). | 2 |

## 9. My Progress

Offline: has a Progress tab with weight, PRs and badges.

| ID | Requirement | Status | Evidence | Stage |
|---|---|---|---|---|
| 9.1 | Prominent Home → My Progress entry | Working | See 3.7 | 1 |
| 9.2 | Overview | Working | `/progress` | 3 |
| 9.3 | Strength & Body Map | Missing | See §10 | 3 |
| 9.4 | Badges | Working | `/progress/badges` | 3 |
| 9.5 | History | Partial | Workouts only (`/train/history`) | 3 |
| 9.6 | Weight trends | Working | Weight log and chart (`src/components/progress/progress-forms.tsx`, `e2e/features.spec.ts`) | 3 |
| 9.7 | Measurements | Working | `measurement_entries` chart (optional) | 3 |
| 9.8 | Optional progress photos | Working | `src/components/progress/progress-photos.tsx`, `tests/integration/progress-photos.test.ts`. Untested on a real camera. | 3 |
| 9.9 | Completed workouts | Working | Training analytics on `/progress` | 3 |
| 9.10 | Running and walking distance | Missing | Only a 30-day steps chart | 3 |
| 9.11 | Personal records | Working | `#records` section | 3 |
| 9.12 | Weekly consistency | Working | Weekly/monthly activity chart, week streak (`src/lib/domain/streak.ts`) | 3 |
| 9.13 | Recent badges | Partial | Only a link to `/progress/badges`. No recent-badge list on the overview. | 3 |
| 9.14 | Current assessed strength rank | Missing | No rank system | 3 |
| 9.15 | Useful empty states | Working | `EmptyState` on goals, records and similar sections | 3 |

## 10. Interactive body map and strength ranks

Offline: none of this section exists.

| ID | Requirement | Status | Evidence | Stage |
|---|---|---|---|---|
| 10.1 | Original front and back muscle diagrams | Missing | No body map anywhere in `src/` | 3 |
| 10.2 | Tappable region: chest | Missing | — | 3 |
| 10.3 | Tappable region: back | Missing | — | 3 |
| 10.4 | Tappable region: shoulders | Missing | — | 3 |
| 10.5 | Tappable region: arms | Missing | — | 3 |
| 10.6 | Tappable region: core | Missing | — | 3 |
| 10.7 | Tappable region: legs, with useful subdivisions | Missing | — | 3 |
| 10.8 | Color muscle groups by rank | Missing | — | 3 |
| 10.9 | Written legend and labels, so the map doesn't rely on color alone | Missing | — | 3 |
| 10.10 | Region shows its current rank | Missing | — | 3 |
| 10.11 | Region shows relevant exercises | Missing | Muscle data exists (`exercises.primary_muscles`) but nothing uses it for this | 3 |
| 10.12 | Region shows personal records | Missing | `personal_records` exists | 3 |
| 10.13 | Region shows performance history | Missing | — | 3 |
| 10.14 | Region shows progress toward the next rank | Missing | — | 3 |
| 10.15 | Region explains how its score is calculated | Missing | — | 3 |
| 10.16 | Exact rank order: Bronze → Silver → Gold → Platinum → Diamond → Disciple | Missing | The only "bronze/silver/gold" in the code are badge tiers (`src/lib/domain/achievements.ts`) | 3 |
| 10.17 | Disciple replaces Titan as the top rank | Missing | No "Titan" exists to replace. Disciple has to be built. | 3 |
| 10.18 | Transparent, configurable, exercise-specific scoring | Missing | — | 3 |
| 10.19 | Account for bodyweight where appropriate | Missing | Bodyweight is logged (`weight_entries`) | 3 |
| 10.20 | Machines and movements not treated as interchangeable | Missing | — | 3 |
| 10.21 | No strength inferred from photos | Missing | Nothing to violate yet; build it as a rule | 3 |
| 10.22 | Thresholds not presented as validated standards | Missing | — | 3 |
| 10.23 | Estimated 1RMs labeled | Partial | PR lists label "Est. 1RM" (`RECORD_LABEL` in Home). Epley is limited to ≤12 reps (`src/lib/domain/strength.ts`). | 3 |
| 10.24 | Provisional scoring rules labeled | Missing | — | 3 |
| 10.25 | "Not assessed" shown when data is insufficient | Missing | — | 3 |
| 10.26 | Overall rank calculation explained, with missing assessments disclosed | Missing | — | 3 |
| 10.27 | Representative scoring, so repeated similar logs don't inflate a rank | Missing | — | 3 |
| 10.28 | Rank thresholds reviewed by a qualified coach | Requires Content Review | Needed once thresholds exist | 3 |

## 11. Badges and achievements

Offline: has a badges screen with its own list.

| ID | Requirement | Status | Evidence | Stage |
|---|---|---|---|---|
| 11.1 | Earned and In Progress filters | Missing | `/progress/badges` groups by category and sorts earned first. No filter. | 3 |
| 11.2 | Original badge artwork | Partial | Lucide icons inside tiered medallions (`src/components/achievements/badge-icon.tsx`) | 3 |
| 11.3 | Names and descriptions | Working | `BADGES` in `src/lib/domain/achievements.ts` | 3 |
| 11.4 | Exact requirements stated | Partial | Descriptions plus targets. Some are vague, e.g. "Beat one of your own records". | 3 |
| 11.5 | Progress toward unlocking | Working | `ProgressBar`, `badgePercent` | 3 |
| 11.6 | Earned dates | Working | Derived `earnedAt` | 3 |
| 11.7 | Tappable badge detail screens | Missing | Cards aren't interactive | 3 |
| 11.8 | Performance ranks kept separate from milestone badges | Partial | No ranks exist yet. The badge tiers reuse Bronze/Silver/Gold names and will collide with the rank ladder. | 3 |
| 11.9 | First Step: first completed workout | Working | `first-workout` "First Step" | 3 |
| 11.10 | Building Momentum: 10 workouts | Partial | Exists as `workouts-10` "Showing Up"; needs renaming | 3 |
| 11.11 | Consistent Effort: 25 workouts | Partial | Exists as `workouts-25` "Committed"; needs renaming | 3 |
| 11.12 | Committed: 50 workouts | Partial | Exists as `workouts-50` "Iron Habit". The name "Committed" is currently on 25. | 3 |
| 11.13 | Century Club: 100 workouts | Partial | Exists as `workouts-100` "Centurion" | 3 |
| 11.14 | First Recorded Best: first supported lift record | Partial | `first-pr` "New Best" counts `prMoments`; its semantics need to match "first supported lift record" | 3 |
| 11.15 | Raising the Bar: improvement over an earlier lift record | Missing | No badge distinguishes an improvement from a first record | 3 |
| 11.16 | Program Finisher: all required program sessions completed | Partial | `program-complete` "Finisher" uses `user_programs.status='completed'`, not a count of required sessions (5.24) | 3 |
| 11.17 | First Mile | Missing | No run data | 3 |
| 11.18 | First 5K | Missing | — | 3 |
| 11.19 | First 10K | Missing | — | 3 |
| 11.20 | Going the Distance: 100 running miles | Missing | — | 3 |
| 11.21 | Walking Strong: 25 walking miles | Missing | — | 3 |
| 11.22 | Faster Than Before | Missing | — | 3 |
| 11.23 | Distinguish run from walk and GPS from manual | Partial | Activities store `kind` and `source`. Weekly totals separate runs from walks, and personal bests flag self-reported (manual/treadmill) vs GPS. Run badges themselves aren't built yet. | 3 |
| 11.24 | Self-reported records not presented as verified | Partial | Nothing claims verification, but there's no explicit "self-reported" label | 3 |
| 11.25 | Increasingly detailed original rank emblems | Missing | — | 3 |
| 11.26 | Disciple: ornate metallic-gold narrow-gate emblem | Missing | — | 3 |
| 11.27 | Stable activity IDs prevent duplicate awards | Working | Badges are derived and never stored. `badgesUnlockedBySession` uses session IDs (`src/server/actions/workouts.ts`, `tests/unit/achievements.test.ts`). | 3 |
| 11.28 | Consistent recalculation after edited or deleted records | Working | Badges are derived on read. PR recalculation is integration-tested (`tests/integration/workouts.test.ts`). | 3 |
| 11.29 | Short, dismissible celebrations | Partial | `src/components/common/celebration.tsx` confetti removes itself but has no dismiss control | 3 |
| 11.30 | Celebrations respect reduced motion | Working | `prefers-reduced-motion` check | 3 |
| 11.31 | Option to disable celebrations | Missing | — | 3 |
| 11.32 | Celebrations never cover active exercise or run controls | Working | Only on the post-finish summary, with `pointer-events-none` | 3 |
| 11.33 | Optional badge sharing with user-approved details | Missing | — | 3 |
| 11.34 | Extra badges (volume, streak, food, faith, photo) kept or retired deliberately | Partial | 20 badges exist. The faith-count badges were retired deliberately in Stage 2C (12.18); the rest are still to be reviewed in Stage 3. | 3 |

## 12. Faith

Offline: Faith sits under More; it has the 40-day challenge and a journal.

| ID | Requirement | Status | Evidence | Stage |
|---|---|---|---|---|
| 12.1 | Faith central: dedicated bottom tab | Working | See 2.3 | 1 |
| 12.2 | Home Scripture card | Working | See 3.2 | 1 |
| 12.3 | Daily Scripture | Working | `scriptureForDate` (`src/data/content.ts`) | 2 |
| 12.4 | Scripture context | Working | A `reflection` per verse | 2 |
| 12.5 | Devotionals | Working | `src/data/devotionals.ts`, `src/components/faith/devotional-content.tsx`, `tests/unit/devotionals.test.ts` | 2 |
| 12.6 | Devotional content reviewed | Requires Content Review | Generated text, not pastor-reviewed | 2 |
| 12.7 | Prayer journal | Working | See 2.31. Private by default; "Share with AI Coach" per entry, off by default; the coach reads only shared entries (`journalEntriesForCoach`, `src/server/coach/snapshot.ts`), proven by `tests/unit/coach-journal.test.ts` | 2 |
| 12.8 | Daily practices | Working | See 2.32. No streaks, scores or comparisons | 2 |
| 12.9 | "40 Days Through the Narrow Gate" challenge | Working | `challenge_enrollments`/`challenge_checkins` (`20261017000003_challenges.sql`), `e2e/challenge.spec.ts` | 2 |
| 12.10 | Catch-up support | Working | Catch-up on missed days (`faith-challenge.tsx`, `src/lib/domain/challenge.ts`) | 2 |
| 12.11 | Recognition of rest | Working | Rest-day check-in is a walk or mobility. Rest devotional (Mark 6:31). | 2 |
| 12.12 | Optional reminders controlled by the user | Partial | Stage 2C: devotional, prayer and practice reminders at `/faith/reminders` (off by default; time and weekdays; saved to `faith_reminders`), scheduled as weekly local notifications in the iPhone/Android app (`syncFaithReminders`, re-applied on app open by `FaithReminderSync`). The web version says plainly that a browser can't deliver them. Workout reminders as before. **Native delivery not tested on a device** (no device here). `tests/unit/faith-reminders.test.ts`, `e2e/faith-calendar.spec.ts` | 2 |
| 12.13 | Licensed or public-domain Bible text | Working | Berean Standard Bible (public domain). All 46 passages come from the official BSB plain-text file (`scripts/extract-bsb.mjs`, `.github/workflows/bsb-text.yml` → `src/data/bsb-passages.json` with the file's SHA-256); `tests/unit/scripture.test.ts` checks every verse, reminder fragment, devotional quotation and the coach's verse list. Attribution with link on Faith and Terms. `docs/SCRIPTURE.md` | 2 |
| 12.14 | Translation identified | Working | `ACTIVE_TRANSLATION` in `src/data/scripture.ts`, "(BSB)" labels, `ScriptureNotice` attribution | 2 |
| 12.15 | Content-review workflow for devotionals | Partial | `content_items.is_published` only. No reviewer or status fields. The static devotionals bypass it. | 4 |
| 12.16 | Generated content never labeled pastor-reviewed | Working | No such labels | 2 |
| 12.17 | Journals private by default | Working | Owner-only RLS (`20261016000002_rls_policies.sql`, `tests/integration/rls.test.ts`, `tests/integration/faith-calendar.test.ts`). Hidden from admins; the coach sees an entry only when the user ticks "Share with AI Coach" (off by default, `tests/unit/coach-journal.test.ts`). | 2 |
| 12.18 | Spiritual maturity not scored (no fitness ranks, prayer counts or leaderboards) | Working | Stage 2C removed the faith badges (`journal-1`, `journal-10`, `discipline-7`, `discipline-30`) and the faith badge category; achievements no longer read journal or practice data. Practices show gentle sentences only (no streaks, points or percentages; `tests/unit/practices.test.ts`, `tests/unit/achievements.test.ts`). No leaderboards. | 2 |

## 13. AI Coach

Offline: the coach screen says it needs the online version.

| ID | Requirement | Status | Evidence | Stage |
|---|---|---|---|---|
| 13.1 | Visible through the compact header button on every main tab | Working | See 2.6 | 1 |
| 13.2 | Dedicated conversation screen | Working | `src/app/(app)/coach/page.tsx`, `src/components/coach/coach-chat.tsx` | 4 |
| 13.3 | Clear way back to the previous screen | Working | `BackButton` on `/coach` (history back, falls back to Home); `e2e/navigation.spec.ts` | 1 |
| 13.4 | Data connected only with the user's permission | Partial | The snapshot covers all users automatically. Only limitations are gated, by wellness consent (`src/server/coach/snapshot.ts`). No per-source toggles. | 4 |
| 13.5 | Connected: goals and preferences | Working | `src/server/coach/snapshot.ts`, `src/lib/coach/context.ts` (uncommitted), `tests/unit/coach-context.test.ts` | 4 |
| 13.6 | Connected: current program | Working | `get_program_week` (`src/server/coach/tools.ts`) | 4 |
| 13.7 | Connected: workout history | Working | `get_recent_workouts`, `get_exercise_history` | 4 |
| 13.8 | Connected: running history | Missing | No run data | 4 |
| 13.9 | Connected: food logs | Working | `get_nutrition_summary` | 4 |
| 13.10 | Connected: progress trends | Partial | Bodyweight is in the snapshot. No measurements or photos (correctly). No trend tool. | 4 |
| 13.11 | Connected: recovery check-ins | Working | Latest readiness in the snapshot | 4 |
| 13.12 | Explain progress | Partial | Prompt and tools exist; no live verification | 4 |
| 13.13 | Suggest substitutions | Working | `propose_exercise_swap`, apply e2e (`e2e/coach.spec.ts`) | 4 |
| 13.14 | Propose meals | Partial | Only `propose_nutrition_targets`. No meal proposals. | 4 |
| 13.15 | Coordinate schedules | Missing | No schedule tool | 4 |
| 13.16 | Weekly reviews | Partial | Only a Home prompt ("Review my consistency this month"). No structured weekly review. | 4 |
| 13.17 | Show proposed changes and require approval before modifying anything | Working | `suggestion-card.tsx`, `applyCoachProposalAction`, `ai_messages.proposal` | 4 |
| 13.18 | Identify missing information rather than invent it | Partial | Stated in the prompt (`src/lib/coach/knowledge.ts`); unverified live | 4 |
| 13.19 | Fix the "Too many requests" failure | Partial | Burst limiter in memory per instance (`src/server/rate-limit.ts`). 429 + `Retry-After` and friendly messages (`src/server/services/ai-coach.ts`). Anthropic `RateLimitError` is mapped. No shared store, and not reproduced live. | 4 |
| 13.20 | Loading state | Working | Streaming activity list | 4 |
| 13.21 | Rate-limit handling in the UI | Partial | Shows the server message. No countdown or auto-retry. | 4 |
| 13.22 | Service-failure handling | Partial | `fail()` paths in `coach-chat.tsx`. e2e covers only "not configured" and a mocked success; no 429/500 e2e. | 4 |
| 13.23 | Retrying | Partial | Manual re-send only | 4 |
| 13.24 | Preserve unsent messages | Working | Coach input is a per-user draft (`useDraft`) that survives navigation and reload. A message that was mid-send is restored unless it was saved. On 429/500 the text goes back in the box with Try again. `e2e/coach.spec.ts` (mock 429 and 500) | 4 |
| 13.25 | API secrets kept server-side | Working | `src/server/env.ts`; the client sees only `NEXT_PUBLIC_*` | 4 |
| 13.26 | Live model access | Requires External Setup | Needs `ANTHROPIC_API_KEY` (models `COACH_MODEL_PRO`/`COACH_MODEL_PLUS`). No live call has been made. | 4 |
| 13.27 | Not presented as a clinician or pastor | Working | `knowledge.ts`: "not a doctor, physiotherapist, dietitian or psychologist"; defers to a pastor | 4 |
| 13.28 | Private journal entries not exposed by default | Working | Journal is excluded from the snapshot and tools | 4 |

## 14. Recovery, education and accountability

Offline: has a recovery page and Health Connect steps. No groups.

| ID | Requirement | Status | Evidence | Stage |
|---|---|---|---|---|
| 14.1 | Optional sleep, energy and soreness check-ins | Working | `recovery_checkins` (sleep, energy, soreness, stress), `src/server/actions/recovery.ts`, `src/components/recovery/checkin-form.tsx`. Requires wellness consent (e2e). | 4 |
| 14.2 | Check-ins presented as self-reported, not a diagnosis | Working | Copy on `/train/recovery`, `src/lib/domain/readiness.ts` | 4 |
| 14.3 | Education: exercise technique | Partial | Exercise pages only. No library. | 4 |
| 14.4 | Education: training principles | Missing | — | 4 |
| 14.5 | Education: nutrition | Partial | `/nutrition/diets`, `/nutrition/supplements` | 4 |
| 14.6 | Education: recovery | Partial | `/train/recovery` | 4 |
| 14.7 | Education: biblical stewardship | Partial | Devotionals only | 4 |
| 14.8 | Education shows sources and actual reviewer attribution | Missing | No source or reviewer fields | 4 |
| 14.9 | Education content reviewed | Requires Content Review | Needs a coach, dietitian and pastor | 4 |
| 14.10 | Private accountability groups for friends or churches | Missing | No groups tables in `supabase/migrations` | 4 |
| 14.11 | Group invitations | Missing | — | 4 |
| 14.12 | Explicit sharing choices | Missing | — | 4 |
| 14.13 | Reporting and blocking tools | Missing | — | 4 |
| 14.14 | Food, measurements, photos, routes and journals private unless deliberately shared | Working | Owner-only RLS on every user table (`tests/integration/rls.test.ts`, `progress-photos.test.ts`). Routes don't exist yet. | 1 |
| 14.15 | Wearables: Apple Health steps | Requires External Setup | `src/lib/native-health.ts` (`@capgo/capacitor-health`). HealthKit entitlement and `NSHealthShareUsageDescription` are present. Needs an Apple Developer App ID capability and a device. | 4 |
| 14.16 | Wearables: Health Connect steps | Partial | Code in `native-health.ts`. `AndroidManifest.xml` has no Health Connect `READ_STEPS` permission or rationale activity. Untested on a device. | 4 |
| 14.17 | Wearable permission controls | Partial | Connect/sync UI on the steps card (`src/components/steps/steps-card.tsx`). No disconnect or revoke UI. | 4 |
| 14.18 | Wearable deduplication | Working | Per-day, per-source steps; no-step days are never written (`tests/unit/steps.test.ts`) | 4 |
| 14.19 | Unavailable APIs and requirements identified honestly | Working | `IMPLEMENTATION_STATUS.md`, in-app "no steps found" guidance | 4 |
| 14.20 | Wearable workouts, runs or heart rate | Missing | Steps only | 4 |

## 15. Smooth navigation and dependable data

Offline: all data in localStorage on one device. No sync, accounts or export.

| ID | Requirement | Status | Evidence | Stage |
|---|---|---|---|---|
| 15.1 | Preserve scroll position | Working | `src/components/shell/scroll-memory.tsx`: per path+query in sessionStorage, restored on Back/Forward and tab returns after content renders. Gives up as soon as you scroll; skips #anchors; instant jump. `e2e/journeys.spec.ts` | 1 |
| 15.2 | Preserve filters | Working | Filters stay in URL params. Tab links return to the last screen and query per section (`lastHrefFor` / `useTabHrefs` in `src/lib/nav-memory.ts`). The Add-food tab, search text and food type are kept per session. `e2e/journeys.spec.ts` | 1 |
| 15.3 | Preserve drafts across tab changes | Working | `useDraft` (`src/lib/use-draft.ts`, localStorage, per user, debounced, cleared on success, "Draft restored" notice). Covers the coach input, journal entry, manual food entry, custom food, quick add and progress-photo note. `tests/unit/drafts.test.tsx`, `e2e/journeys.spec.ts` | 1 |
| 15.4 | Preserve active sessions across tab changes | Working | `src/lib/workout-storage.ts`, `ActiveWorkoutPill`; tab switch + reload e2e in `e2e/journeys.spec.ts` | 1 |
| 15.5 | Predictable Back behavior | Working | In-app history stack (`src/lib/nav-memory.ts`). `BackButton` goes back only within the app, otherwise to the fallback. `BackLink` on detail screens (exercise, program, history, diets, supplements, exercise library) returns to the list you came from, with its filters and scroll, or else opens the parent. Android back uses `history.back`. `e2e/journeys.spec.ts` | 1 |
| 15.6 | No keyboard overlap | Partial | `@capacitor/keyboard` 8.0.6 (`resize: native`, `resizeOnFullScreen`). On the web, `KeyboardAvoidance` uses visualViewport to hide the tab bar and Resume bar, lift bottom sheets and scroll the focused field into view (`src/components/platform/`). Helpers are unit-tested. **Not verified on a device** (needs `npx cap sync` and a native build). | 1 |
| 15.7 | No unexpected layout shifts | Partial | Skeleton `loading.tsx` added for `/calendar` and `/progress/badges`. Charts reserve `h-56`. Mutation routes still use the progress bar (Next 15.5 issue, limitation 2). No automated CLS measurement. | 1 |
| 15.8 | Compact Return to Workout bar | Working | `src/components/shell/active-workout-pill.tsx` | 1 |
| 15.9 | Compact Return to Run bar | Missing | No running | 3 |
| 15.10 | Avoid unnecessary redirects and repeated confirmations | Working | Audited. The middleware now guards `/run`, `/calendar` and `/plan`, so signed-out deep links go to `/login?next=<path+query>` and return there. A signed-in `/login?next=` goes straight to `next`. `tests/unit/protected-routes.test.ts`, `e2e/journeys.spec.ts`. One confirmation per destructive action. | 1 |
| 15.11 | Confirm destructive actions | Working | Audited every delete. Confirms added for diary entries, saved meals, saved foods, journal entries, discipline goals, weight entries, saved programs, coach conversations and admin content/categories (`ActionButton confirmMessage/confirmLabel`, `confirmDialog`). Discard, history delete, photo delete, run delete and account delete were already confirmed. | 1 |
| 15.12 | Account access (sign-up, login, logout) | Working | Supabase auth (`src/app/(auth)`, `e2e/core-flow.spec.ts`) | 1 |
| 15.13 | Hosted accounts in production | Requires External Setup | Needs the owner's Supabase project and keys, a Vercel deploy and `CAP_SERVER_URL` | 1 |
| 15.14 | Saving | Working | Server actions with RLS | 1 |
| 15.15 | Account recovery (password reset) | Working | `/forgot-password`, `/reset-password`, e2e | 1 |
| 15.16 | Synchronization | Partial | Server is the source of truth. Only the workout logger works offline and syncs later; drafts keep typed text when a save fails (`docs/DATA.md`). | 1 |
| 15.17 | Document what is local and what is synced | Working | `docs/DATA.md` (tables, device keys, offline, export, deletion). No in-app explanation yet. | 1 |
| 15.18 | Data export | Working | `/api/account/export` now also covers activities, supplements, steps, favorites, billing customer and custom-program structure. `tests/unit/account-coverage.test.ts` checks coverage against the migrations; `tests/integration/food-favorites.test.ts` | 1 |
| 15.19 | Account deletion | Working | `deleteAccountAction`: cascade (checked against the migrations), private buckets emptied (bucket coverage test), device drafts cleared (`ForgetDeviceData`). Needs `SUPABASE_SERVICE_ROLE_KEY` in production. | 1 |
| 15.20 | Protect private records | Working | RLS (`20261016000002_rls_policies.sql`, `tests/integration/rls.test.ts`) | 1 |
| 15.21 | Secrets kept out of client code | Working | `src/server/env.ts` | 1 |

## 16. Process and completion

| ID | Requirement | Status | Evidence | Stage |
|---|---|---|---|---|
| 16.1 | Persistent checklist with every requirement and a status | Working | This file | 1 |
| 16.2 | Stage-end report: implemented, verified, remaining | Partial | `IMPLEMENTATION_STATUS.md` exists but predates the spec and marks spec-partial items "✅ Done" (e.g. "Workout logger (all listed features)") | 1 |
| 16.3 | Requirements not dropped because they're absent from the mockup | Working | Tracked here | 1 |
| 16.4 | Journey: finish a workout and reopen its saved history | Working | `e2e/core-flow.spec.ts` | 1 |
| 16.5 | Journey: switch tabs during an active session without losing it | Working | `e2e/journeys.spec.ts` (Food/Faith/Run/Home and back, plus reload) | 1 |
| 16.6 | Journey: add, edit, copy and delete food with correct totals | Working | `e2e/journeys.spec.ts` (add 210 → edit 105 → copy +200 → confirmed delete → favorites re-log → reload) | 1 |
| 16.7 | Journey: build and log a recipe serving | Working | `e2e/recipes-planner.spec.ts` (build, check per-serving, log ½ serving, diary total 186, edit recipe leaves the diary entry unchanged) | 2 |
| 16.8 | Journey: record, pause, resume, finish and reopen a run | Missing | No running | 3 |
| 16.9 | Journey: update a record and award the correct badge only once | Partial | Unit and integration coverage of PRs and badges; no end-to-end journey | 3 |
| 16.10 | Journey: edit or delete an activity and recalculate | Partial | `tests/integration/workouts.test.ts` (PR recalculation). Runs: `e2e/run.spec.ts` edits a run, deletes a walk and checks the weekly totals recalculate. Badge recalculation for runs comes with run badges. | 3 |
| 16.11 | Journey: open a muscle region and inspect its rank explanation | Missing | No body map | 3 |
| 16.12 | Journey: save and recover a journal draft | Working | `e2e/journeys.spec.ts` (tab switch + reload restore, cleared on save) | 2 |
| 16.13 | Journey: use the AI Coach and handle a service failure gracefully | Working | `e2e/coach.spec.ts`: mocked success, mocked 429 and 500 (message kept, survives reload, Try again sends it once). No live API run. | 4 |
| 16.14 | Journey: reopen the app and confirm saved data remains | Partial | Browser reload is e2e-tested. Native app relaunch is untested. | 1 |
| 16.15 | Layouts verified on small and large phones | Partial | Playwright uses one mobile viewport. No small or large matrix. | 1 |
| 16.16 | Placeholders, unconnected integrations and unreviewed content not described as finished | Partial | Legal pages are marked placeholders. `IMPLEMENTATION_STATUS.md` overstates several items (see 16.2). | 1 |

## External setup (cross-cutting)

| ID | Requirement | Status | Evidence | Stage |
|---|---|---|---|---|
| X.1 | Supabase project, migrations applied, auth email/SMTP | Requires External Setup | 12 migrations in `supabase/migrations`, `supabase/setup-all.sql` | 1 |
| X.2 | Vercel (or other) deploy and `CAP_SERVER_URL` | Requires External Setup | `capacitor.config.ts` defaults to `app.narrowgatefitness.example` | 1 |
| X.3 | Stripe products and prices, webhook secret | Requires External Setup | `src/app/api/stripe/webhook/route.ts`; `STRIPE_PRICE_*` | 1 |
| X.4 | Store billing (Apple IAP / Google Play Billing) | Requires External Setup | Not built. The native shells hide Stripe checkout. | 4 |
| X.5 | Anthropic API key | Requires External Setup | See 13.26 | 4 |
| X.6 | USDA FDC API key (optional branded search) | Requires External Setup | `USDA_FDC_API_KEY` | 2 |
| X.7 | Apple Developer account: HealthKit capability, signing, TestFlight | Requires External Setup | `.github/workflows/ios.yml` (`testflight` mode needs secrets) | 4 |
| X.8 | Google Play Console: signing, Health Connect declaration | Requires External Setup | `.github/workflows/android-apk.yml` | 4 |
| X.9 | Legal review of privacy policy and terms | Requires Content Review | `src/app/legal/*` are marked placeholders | 1 |

---

## Summary by stage

Counts are taken from the tables above, including the X rows.

| Stage | Working | Partial | Missing | Requires External Setup | Requires Content Review | Total |
|---|---|---|---|---|---|---|
| 1 | 53 | 35 | 14 | 4 | 1 | 107 |
| 2 | 58 | 33 | 30 | 1 | 4 | 126 |
| 3 | 17 | 19 | 81 | 0 | 1 | 118 |
| 4 | 16 | 20 | 13 | 7 | 2 | 58 |
| All | 144 | 107 | 138 | 12 | 8 | 409 |

- **Stage 1.** Storage, auth, RLS, export/delete and core workout logging are solid. Most of the gaps are shell and navigation: the five-tab bar, the header AI Coach button, the profile icon, Home → My Progress, heading sizes and the text-size setting, plus scroll and filter preservation.
- **Stage 2.** The program library and the food diary are broad. Missing: program search and filters, calisthenics, completion requirements, previous performance, supersets, saved workout templates, the meal planner and grocery list, a proper recipe builder, secondary and combined goals. The session-length fix is only partly done.
- **Stage 3.** Running, the body map and ranks are entirely missing. Badges exist but need renaming and the run badges, filters, detail screens and sharing.
- **Stage 4.** The coach is advanced but unverified live and lacks schedule, meal and weekly-review tools. Groups and the education library are missing. Wearables cover steps only and haven't been tested on a device.

## Known decisions and conflicts

1. **Bottom tabs.** The owner earlier asked for Programs and Exercises as bottom tabs, and the current nav (and `tests/unit/nav-config.test.ts`) reflects that. The spec now requires exactly Home · Train · Run · Food · Faith. Programs and Exercises move under Train, Coach moves to the header button, Progress moves under Home → My Progress, and Profile moves to a header icon. The nav test and the offline edition's `NAV` have to change with it.
2. **Faith opt-in vs central.** Faith is currently optional (`profiles.faith_enabled`; hidden nav, Home verse and badges). The spec makes Faith a permanent tab with a Home Scripture card. Decide whether the opt-out survives as a "hide faith content" preference.
3. **Plan gating.** Resolved 2026-10-22: the owner set the final Free / Plus / Pro structure (food logging, barcode and macros are free; Plus has no AI; the coach is Pro). See `docs/MEMBERSHIPS.md` and `docs/APP_AUDIT.md`.
4. **Badge names and tiers.** The existing names (Showing Up, Committed@25, Iron Habit, Centurion, New Best, Finisher) conflict with the spec's list, where Committed is the 50-workout badge. Earned dates are derived, so renaming loses no data. The badge tiers Bronze/Silver/Gold collide with the rank ladder and should be renamed or dropped.
5. **Faith-count badges.** `journal-*` and `discipline-*` reward counts of faith activity, which conflicts with §12 ("not scored through prayer counts"). Remove them or reframe them.
6. **Two session-length estimators.** `session-time.ts` (library) and `custom-programs.ts` `estimateMinutes` / bodybuilding formula (builder). Consolidate on one.
7. **Exercise demos.** The YouTube search button must go once the `exercise-motion` animations are wired in. The animations must not be labeled expert-reviewed until they are.
8. **Body map and ranks.** No body-rank image was supplied, so the design will be original. Thresholds will be labeled provisional.
9. **Offline edition.** It is generated from a template outside the repo, so structural changes such as the 5-tab nav must be made there and regenerated. It can't be fixed in `standalone/index.html` directly.

## Exact blockers (this sandbox)

- **Outbound network.** Most hosts are unreachable, including Open Food Facts, USDA FDC, Stripe, Anthropic, Supabase cloud, Vercel and the Android SDK downloads. Barcode lookup, Stripe checkout and the portal, and the AI coach are tested only against local mocks or not at all.
- **No live AI calls.** Coach answer quality, tool use, rate-limit behavior under real load and refusal fallbacks can't be verified here.
- **No real device.** GPS accuracy, background and locked-screen location, camera barcode scanning, HealthKit/Health Connect, local notifications, haptics and keyboard overlap can't be tested. Running must ship with a "not verified on device" note until it is tested on a phone.
- **No Mac.** iOS builds run only as GitHub Actions simulator compile checks (`.github/workflows/ios.yml`). TestFlight needs the owner's Apple credentials.
- **No owner accounts.** There is no Supabase project, Stripe account, Anthropic key, Vercel project, Apple Developer account or Google Play Console access. Everything marked Requires External Setup waits on these.
- **Content reviewers.** Pastor (devotionals, Scripture check), coach or physio (programs, exercise instructions, rank thresholds), dietitian (supplements, diets, education) and counsel (legal pages) aren't available here.
