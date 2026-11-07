# Launch audit 2026-11-07 — product areas 1-6

Worktree: `/home/user/Testing-testing-testing/.claude/worktrees/agent-a303e34f814786d8f`, branch `worktree-agent-a303e34f814786d8f`,
based on `claude/faith-discipleship` @ 4bdd1db (59c854e + the lead's docs commit). Areas: (1) onboarding and first-workout
activation, (2) workout logging and training programs, (3) original 2D exercise demonstrations, (4) nutrition and food
tracking, (5) Faith, Bible reading, prayer and discipleship, (6) AI Coach functionality and personalization.

## Environment status at the start of the audit

- `docker info` → "Cannot connect to the Docker daemon at unix:///var/run/docker.sock". Local Supabase at
  http://127.0.0.1:54321 answers nothing (`curl` → `000`). Per the brief I did **not** restart daemons. While this
  lasts, the integration suite (tests/integration, needs local Supabase) and the e2e specs (need a sign-up against
  local Supabase) **cannot run**; the sections below say for each spec whether it ran. Unit tests (vitest, no DB) run.
- Database isolation (RLS) is therefore reviewed from the migration SQL and the existing `tests/integration/rls.test.ts`
  and `cross-user-isolation.test.ts`, not re-executed, unless Supabase comes back during the audit.

## Shared security notes (all six areas)

- Every one of the 100 `create table public.*` statements across the 57 migrations has a matching
  `alter table ... enable row level security` (checked by script over supabase/migrations). Faith/Bible tables get
  per-table `select/insert/update/delete ... using (user_id = (select auth.uid()))` policies (migration 53 lines 689-702).
- `activation_events` (migration 51): members can only `select` their own rows; inserts happen only through
  `security definer` triggers from `workout_sessions` writes; `activation_record` has `execute` revoked from
  anon/authenticated/public.
- Server actions all start with `requireUser()` and use the cookie-bound Supabase client, so RLS applies to every query.

---

## Area 1 — Onboarding and first-workout activation

### Inventory
- Pages: `src/app/(auth)/signup/page.tsx`, `login`, `forgot-password`, `reset-password`; `src/app/onboarding/page.tsx`
  (redirects to /home once `profiles.onboarding_completed_at` is set); `src/app/(app)/plan/*` (plan summary after
  onboarding, `/plan?new=1`); `src/app/(app)/home/page.tsx` with `src/components/home/today-workout-action.tsx`.
- Components: `src/components/auth/auth-forms.tsx`, `accept-terms-form.tsx`;
  `src/components/onboarding/onboarding-questionnaire.tsx` (the live questionnaire: 5 quick + optional steps, draft in
  localStorage keyed by `userId`, step restored), `onboarding-wizard.tsx` (older wizard, used from Profile "rebuild").
- Server actions: `src/server/actions/auth.ts` (signUp/signIn/resend/reset; app-level rate limits via
  `src/server/rate-limit.ts`, `AUTH_RATE_LIMIT_SCALE` only raises limits), `src/server/actions/onboarding.ts`
  (`completeOnboardingAction`, `saveOnboardingAction`), `src/server/actions/legal.ts`, `src/server/legal.ts`.
- Validation: `src/lib/validation/schemas.ts` — `signUpSchema` (age confirmation literal, terms, risk ack),
  `onboardingPlanSchema` (age 18-100, height 90-260 cm, weight 25-400 kg, timeZone), `onboardingSchema`.
- Services: `src/server/services/custom-programs.ts` (`buildAndActivateCustomProgram`), `nutrition-targets.ts`,
  `src/lib/domain/starter-program.ts`, `calorie-budget.ts`, `src/server/services/account.ts` (activation report).
- Routing: `src/middleware.ts`, `src/lib/supabase/middleware.ts` (PROTECTED_PREFIXES incl. /onboarding),
  `src/app/(app)/layout.tsx` (sends unfinished members to /onboarding), `src/app/auth/*` (callback/confirm).
- Tables: `profiles` (onboarding_completed_at, timezone, birth_year, wellness_consent_at), `onboarding_answers`,
  `weight_entries` (unique user_id+recorded_on), `nutrition_goals`, `legal_acceptances`, `legal_document_versions`,
  `activation_events` (migration 51; 56 adds report exclusions), `rate_limit_counters`, `feature_flags` (`signups`).
- Tests: unit `tests/unit/starter-program.test.ts`, `program-generator.test.ts`, `auth-link-routes.test.ts`,
  `auth-email-templates.test.ts`, `launch-routing.test.ts`; integration `onboarding-plan.test.ts`,
  `activation-events.test.ts`, `legal-acceptances.test.ts`, `account-security.test.ts`, `auth-email-links.test.ts`;
  e2e `core-flow.spec.ts`, `first-workout-activation.spec.ts`, `onboarding-plan.spec.ts`, `opening-gate.spec.ts`.

## Area 2 — Workout logging and training programs

### Inventory
- Pages: `src/app/(app)/train/{page,workout,history,history/[id],programs,programs/[slug],build,templates,templates/new,
  templates/[id],exercises,exercises/[slug],exercises/[slug]/history,review,recovery}`.
- Components: `src/components/workout/{workout-logger,current-set-card,exercise-card,exercise-picker,workout-editor,
  template-editor}.tsx`, `src/components/train/{program-builder,program-actions,schedule-preview,training-review}.tsx`.
- Server actions: `src/server/actions/workouts.ts` (syncWorkoutDraft/discard/finish/edit/delete/previousPerformance),
  `programs.ts` (save/start/removeSaved/pauseActive), `custom-programs.ts` (buildCustomProgram), `templates.ts`,
  `plan-schedule.ts`, `adaptive-training.ts`, `recovery.ts`, `rest-alerts.ts`, `progress.ts`.
- Services: `src/server/services/workouts.ts` (saveDraftSnapshot, finishWorkout, records, history),
  `programs.ts`, `custom-programs.ts`, `templates.ts`, `training.ts`, `schedule.ts`, `catalog.ts`,
  `exercise-catalog-items.ts`, `adaptive-training.ts`. API: `src/app/api/v1/workouts/route.ts`, `v1/programs/route.ts`.
- Domain: `src/lib/domain/{workout-draft,workout-templates,previous-performance,exercise-history,exercise-tracking,
  program-generator,program-expansion,program-catalog,program-audit,custom-programs,starter-program,training-schedule,
  strength,strength-ranks,ranks,session-time}.ts`, `src/lib/workout-storage.ts`, `src/data/programs.ts`,
  `src/data/exercises.ts` (157 exercises).
- Validation: `schemas.ts` (`finishWorkoutSchema`/set schema, program builder schema lines 134-177).
- Tables: `workout_sessions` (client_id, status in_progress/completed, draft jsonb), `workout_exercises`, `workout_sets`,
  `personal_records`, `exercise_targets`, `training_programs`, `program_weeks/days/exercises`, `user_programs`,
  `planned_session_overrides`, `workout_templates`, `workout_template_exercises`, `training_adjustments`,
  `training_recommendation_decisions`, `recovery_checkins`, `exercises`, `exercise_alternatives`, `exercise_media`.
  Migrations 1,2,4,13,24,27,30,40,47,48.
- Tests: unit `workout-draft-session`, `workout-fast-logging`, `workout-logger-stage2`, `workout-timers`,
  `workout-discard`, `program-builder`, `program-generator`, `program-library`, `program-safety-caps`,
  `program-catalog`, `custom-programs`, `sport-programs`, `starter-program`; integration `workouts.test.ts`,
  `workout-fast-logging.test.ts`, `custom-programs.test.ts`, `training-stage2.test.ts`, `adaptive-training.test.ts`,
  `edit-safety.test.ts`; e2e `current-set-card`, `fast-logging`, `workout-reliability`, `train-pause`,
  `training-stage2`, `training-review`, `program-builder`, `program-library`.

## Area 3 — Original 2D exercise demonstrations

### Inventory
- Engine: `src/lib/exercise-motion/{index,build,render,skeleton,timeline,athlete,mount,props*,types}.ts` and
  `src/lib/exercise-motion/patterns/*` (procedural 2D athlete, SVG); `src/data/exercise-motions.ts` (per-exercise motion
  definitions), `src/data/exercise-review-notes.ts`.
- Readiness: `src/lib/exercise-demo-readiness.ts` + `src/data/exercise-demo-readiness.json` (reviewed 2026-11-04;
  states animated/poses/placeholder; `ownerApproved: []`; an exercise missing from the file is a placeholder).
- Components: `src/components/train/exercise-demo.tsx` (2D player), `exercise-demo-25d.tsx` + `demo-video.tsx`
  (pre-rendered 2.5D clips, shown only when `status === "approved"`), `exercise-info-dialog.tsx`.
- Assets: `public/exercise-demos/dumbbell-curl/*` (the single 2.5D clip, status "review", equipment check FAIL),
  manifest `src/data/exercise-demos.json`; `src/lib/exercise-demos.ts`, `src/lib/exercise-media.ts`.
- Docs: `docs/EXERCISE_DEMOS_2D.md`, `EXERCISE_DEMOS_2D_STATUS.md`, `EXERCISE_DEMOS_25D.md`, `EXERCISE_ATHLETE_LOOK.md`.
- Tests: unit `exercise-demo-2d`, `exercise-demo-player.test.tsx`, `exercise-demos`, `exercise-motions`,
  `exercise-motion-quality`, `exercise-drills`, `exercise-agility-drills`, `exercise-media`, `exercise-form`;
  e2e `exercise-demo-2d.spec.ts`, `exercise-demo.spec.ts`.
- Catalog check (script over `src/data/exercises.ts` vs the readiness file): 157 catalog slugs, 157 readiness entries,
  all `animated`, 0 missing, 0 extra, 0 owner-approved.

## Area 4 — Nutrition and food tracking

### Inventory
- Pages: `src/app/(app)/nutrition/{page,scanner,product/[code],photo,label,diets,insights,compare,planner,grocery,
  recipes/*,saved-meals,supplements}`.
- Components: `src/components/nutrition/*` (diary-client, food-picker, food-amount, barcode-scanner, food-photo-flow,
  food-photo-consent, label-check, quick-relog, day-mark, diet-picker, recipe-editor, ai-meal-plan, ...).
- Server actions: `nutrition.ts` (logFood, update/deleteMealItem, customFood, favorites, templates, water, diet,
  goals, copyMeals, relog, budget), `nutrition-days.ts`, `food-photo.ts`, `label.ts`, `food-quality.ts`,
  `ai-meal-plan.ts`, `meal-plan.ts`, `recipes.ts`, `grocery.ts`, `supplements.ts`.
- API routes: `api/foods/search`, `api/foods/barcode`, `api/ai/food-photo`, `api/ai/label-photo`.
- Services: `food-database.ts`, `food-resolve.ts`, `open-food-facts.ts` (OFF_API_BASE_URL), `usda-local.ts`,
  `diary-write.ts`, `nutrition-targets.ts`, `food-photo.ts`, `label-photo.ts`, `food-quality.ts`, `image-prep.ts`,
  `personal-search.ts`. Domain: `src/lib/domain/{diary,meals,meal-time,food-units,food-basis,food-search,food-tags,
  food-favorites,food-photo,label-photo,nutrition,nutrition-insights,calorie-budget,diets,dates}.ts`;
  `src/lib/{barcode,open-food-facts,food-iq,food-quality,food-quality-ai,label-analysis,image-compress}.ts`.
- Tables: `foods`, `meals`, `meal_items`, `water_entries`, `nutrition_goals`, `nutrition_day_marks`, `food_favorites`,
  `meal_plans`, `meal_plan_entries`, `meal_plan_settings`, `meal_plan_drafts`, `recipes`, `recipe_ingredients`,
  `grocery_lists/items`, `supplement_stack/logs`, `ai_usage_events`. Migrations 4,5,8,11,12,25,28,32,33.
- Tests: unit `diary`, `meal-time`, `food-units`, `food-basis`, `food-search`, `barcode`, `food-photo`, `food-quality`,
  `food-iq`, `nutrition`, `nutrition-insights`, `nutrition-audit`, `nutrition-score-formula`, `popular-foods`,
  `meal-planner`, `ai-meal-plan`, `meal-plan-notes`; integration `food-amounts`, `food-favorites`, `food-photo`,
  `food-quality`, `barcode-media`, `ai-meal-plan`, `recipes-planner`, `personal-search`, `supplements-steps`;
  e2e `nutrition-diary`, `nutrition-timezone`, `food-amounts`, `food-quality`, `label-check`, `welcome-diets`,
  `recipes-planner`, `supplements-steps`; OFF mock `e2e/off-mock.ts`.

## Area 5 — Faith, Bible reading, prayer and discipleship

### Inventory
- Pages: `src/app/(app)/faith/{page,bible,bible/[book],bible/[book]/[chapter],bible/search,bible/saved,bible/history,
  journal,journal/new,journal/[id],journey,journey/new,journey/schedule,memory,memory/[id],practices,reminders,
  studies,studies/[study],studies/[study]/[lesson],ask}`.
- Components: `src/components/faith/*` (today-card, journal-entry-card, faith-forms, journey-enroll-form,
  journey-checkin, memory-add-form, memory-practice, practices-panel, bible-ask, devotional-content, scripture-notice),
  `src/components/bible/{chapter-reader,offline-bible,scripture-text,search-form}.tsx`.
- Server actions: `faith.ts` (journal save/delete/prayer answered/archive/share, practices, daily goals),
  `journeys.ts` (checkIn/undo/enroll/end), `bible.ts` (reading history, font scale, highlights, bookmarks, notes,
  memory verses), `bible-ai.ts` (askBible, clear history), `studies.ts`, `notifications.ts` (reminders).
- Services/lib: `src/server/services/{faith,journeys,bible,bible-ai}.ts`, `src/server/bible/{plans,text}.ts`,
  `src/lib/bible/*` (books, reference, format, plans, red-letter, reading-display), `src/lib/faith/{dates,
  journey-copy,memory}.ts`, `src/lib/domain/{journal,practices,disciplines,scripture}.ts`, `src/lib/faith-reminders.ts`,
  `src/data/bible/*`, `bsb-passages.json`, `scripture.ts`, `devotionals.ts`, `studies.ts`, `faith-challenges.ts`;
  offline reader `public/bible-offline.html`, `public/bible-offline.js`, `public/sw.js`, `public/bible/*`.
- Tables (migration 20 + 53 + 54 + 55): `faith_journal_entries`, `discipline_goals`, `discipline_checkins`,
  `faith_daily_goals`, `faith_journeys`, `faith_journey_attempts`, `faith_journey_checkins`, `faith_reminders`,
  `faith_reminder_prefs`, `bible_reading_state`, `bible_reading_history`, `bible_highlights`, `bible_bookmarks`,
  `bible_notes`, `scripture_memory`, `bible_study_progress`, `bible_ai_messages`, `bible_ai_usage`,
  `notification_prefs/devices/reminders`.
- Tests: unit `bible-reader`, `bible-offline`, `bible-plans`, `bible-dataset`, `bible-ai`, `faith-memory-challenges`,
  `faith-reminders`, `faith-reminders-dated`, `coach-journal`; integration `faith-features`, `faith-journeys`,
  `faith-calendar`, `bible-ai-helper`, `bible-display-prefs`; e2e `bible-reader`, `faith-journey`, `faith-calendar`,
  `journeys`, `challenge`.

## Area 6 — AI Coach functionality and personalization

### Inventory
- Pages: `src/app/(app)/coach/page.tsx`, `coach/memory/page.tsx`. Components: `src/components/coach/{coach-chat,
  suggestion-card,memory-manager,ai-consent-card,coach-feedback,markdown}.tsx`.
- API: `src/app/api/ai/chat/route.ts` (streaming chat, Anthropic SDK via ANTHROPIC_BASE_URL; e2e mock on
  E2E_ANTHROPIC_MOCK_PORT). Server actions: `coach.ts` (applyProposal, dismissProposal, deleteConversation,
  applyCoachProposal), `coach-memory.ts` (enable/add/update/delete/deleteAll, conversation memory off),
  `coach-feedback.ts`.
- Services/lib: `src/server/services/ai-coach.ts` (quota reservation, provider call), `src/server/coach/{snapshot,
  tools,sleep-summary}.ts`, `src/lib/coach/{context,prompt,tools,memory,routing,knowledge,chat-key}.ts`,
  `src/lib/validation/ai.ts`, `src/server/services/billing.ts`/`plan-summary.ts` (Free/Pro limits).
- Tables: `ai_conversations`, `ai_messages`, `ai_message_feedback`, `ai_usage_events` (migration 25 reservation),
  `coach_memories` (26), `training_adjustments`/`training_recommendation_decisions` (27), `user_entitlements`,
  `subscriptions`. Migrations 25,26,27,44,49,50.
- Tests: unit `coach-context`, `coach-prompt`, `coach-tools`, `coach-memory`, `coach-routing`, `coach-chat-key`,
  `coach-journal`, `coach-feedback.test.tsx`; integration `ai-limits`, `ai-route-limits`, `coach-memory`,
  `coach-feedback`, `coach-provider-limits`, `plan-enforcement`, `pro-bypass`; e2e `coach.spec.ts`.

---

# Results

Legend: **ran** = executed in this audit with the count shown; **not run** = could not be executed here (local Supabase
down, see Environment status); **code review** = conclusion from reading the code, not from executing it.

## Unit suites executed (vitest, no database)

| Batch | Command | Result |
| --- | --- | --- |
| Areas 1-3 (25 files: starter-program, program-generator, auth-link-routes, auth-email-templates, launch-routing, workout-draft-session, workout-fast-logging, workout-logger-stage2, workout-timers, workout-discard, program-builder, program-library, program-safety-caps, program-catalog, custom-programs, sport-programs, exercise-demo-2d, exercise-demo-player, exercise-demos, exercise-motions, exercise-motion-quality, exercise-drills, exercise-agility-drills, exercise-media, exercise-form) | `npx vitest run <files>` | **25 files, 1976 tests passed**, 25.8 s |
| Areas 4-6 (33 files: diary, meal-time, food-units, food-basis, food-search, barcode, food-photo, food-quality, food-iq, nutrition, nutrition-insights, nutrition-audit, nutrition-score-formula, popular-foods, meal-planner, ai-meal-plan, meal-plan-notes, bible-reader, bible-offline, bible-plans, bible-dataset, bible-ai, faith-memory-challenges, faith-reminders, faith-reminders-dated, coach-journal, coach-context, coach-prompt, coach-tools, coach-memory, coach-routing, coach-chat-key, coach-feedback) | `npx vitest run <files>` | **33 files, 425 tests passed**, 13.8 s |
| Regression test added (validation-dates) + diary, nutrition, coach-journal, faith-reminders-dated | `npx vitest run tests/unit/validation-dates.test.ts ...` | **5 files, 41 tests passed** |
| Typecheck after the fix | `npx tsc --noEmit -p .` | exit 0 |
| Lint of changed files | `npx eslint src/lib/validation/schemas.ts tests/unit/validation-dates.test.ts` | clean |

## Integration suites executed (vitest `--project integration`, local Supabase, after it came back at ~23:10 UTC)

Docker and local Supabase were down for the first part of the audit (every check returned `000`); the lead restored
them, and the integration batch for these six areas was then run for real:

| Batch | Command | Result |
| --- | --- | --- |
| 33 files: onboarding-plan, activation-events, legal-acceptances, account-security, auth-email-links, workouts, workout-fast-logging, custom-programs, training-stage2, adaptive-training, edit-safety, food-amounts, food-favorites, food-photo, food-quality, barcode-media, ai-meal-plan, recipes-planner, personal-search, faith-features, faith-journeys, faith-calendar, bible-ai-helper, bible-display-prefs, ai-limits, ai-route-limits, coach-memory, coach-feedback, coach-provider-limits, plan-enforcement, pro-bypass, rls, cross-user-isolation | `npx vitest run --project integration <files>` | **33 files, 194 tests passed, 0 skipped**, 46.9 s |

Every "integration … not run" note in the per-area tables below therefore now reads as **ran, passed** for the files
listed above; the e2e status is given in the e2e section at the end.

## Ad-hoc probes (pure functions, executed)

1. **Validation schemas** (`src/lib/validation/schemas.ts`, scratch vitest, removed after the run):
   - `onboardingPlanSchema`: age 17 → rejected ("adults (18+)"); age 101 → rejected; weight 1000 kg → rejected
     ("Check your weight"); height 50 cm → rejected; age "abc" → rejected; display name 61 chars → rejected;
     time zone "Mars/Olympus" → **accepted by the schema**, but `completeOnboardingAction` only writes it when
     `isValidTimeZone()` is true (onboarding.ts line 128), so the profile keeps its default; no bug.
   - `signUpSchema` without the 18+ confirmation → rejected server-side ("You must be 18 or older").
   - `finishWorkoutSchema`: a completed set with 0 reps → accepted; weight 1000 kg → accepted (cap is 1500);
     1600 kg → rejected; -1 reps → rejected. Records are only computed for `w > 0 && reps > 0`
     (`src/lib/domain/strength.ts:55`), so a 0-rep set never becomes a PR, but a 1000 kg set does become a
     "max weight" record. Finding L-3 below.
   - `logFoodSchema` / `waterSchema` / `weightEntrySchema`: "2026-02-30", "2026-13-01", "0000-00-00" → **accepted**
     (regex only). Verified bug, fixed (B-1).
2. **Starter program over every answer the questionnaire can send** (scratch vitest, removed): all 6 goals × 5
   experience levels × days 1-7 × session 30/45/60/75 × every secondary goal incl. none × no equipment / each single
   equipment item = **209,664 combinations, 0 failures**: every build produced the expected number of weeks, no empty
   day, every exercise slug in the catalog. (The committed `starter-program.test.ts` only sweeps days 2/4/6 at 45 min
   with the equipment presets.) Days outside the program type's range are clamped in `starterProgramInput`.
3. **2D readiness vs catalog** (python over the data files): 157 published exercises, 157 readiness entries, all
   `animated`, 0 missing, 0 extra, `ownerApproved: []`. `tests/unit/exercise-demo-2d.test.ts` asserts the same plus
   "no three.js, no 3D module, page or model files"; a grep for `three`, `gltf`, `glb`, `webgl` in `src/` and
   `package.json` found nothing (the word "3D" appears only in geometry comments of the 2D pose maths).

---

## Area 1 — Onboarding and first-workout activation: findings

### Workflows and failure scenarios
| Scenario | How | Result |
| --- | --- | --- |
| Sign-up → confirm → onboarding → plan → first workout | e2e `core-flow.spec.ts`, `onboarding-plan.spec.ts`, `first-workout-activation.spec.ts` | **not run** (Supabase down); baseline in addendum says core-flow passed on this branch |
| Under-18 / invalid height, weight, age, name | schema probe (above) | rejected server-side, field messages present |
| Onboarding abandoned halfway and resumed | code review `onboarding-questionnaire.tsx` 170-215: answers + step saved to localStorage under the user id, restored on mount; `onboarding-plan.spec.ts` test "answers survive a reload, but never reach another account in the same tab" | behaviour implemented; spec **not run** |
| Server failure during onboarding | code review `completeOnboardingAction`: `onboarding_completed_at` is written **last**; a failure returns an error and leaves the member on the questionnaire | correct |
| Duplicate sign-up (existing e-mail) | code review `signUpAction`: Supabase `signUp` is called with confirmations on; an existing e-mail returns no error and the UI says "Check your inbox" (no enumeration). No test covers it. | **not executed**; recommend an integration test |
| Sign-up rate limits | code review: 5 / 10 min per address, `AUTH_RATE_LIMIT_SCALE` can only raise | server-side |
| First workout started then reloaded | code review `workout-logger.tsx` 265-290: local draft vs server draft (`getServerDraft`), newest wins, discarded ids honoured, stale (> STALE_DRAFT_HOURS) or different-session drafts ask the member; e2e `workout-reliability.spec.ts` | implemented; spec **not run** |
| Activation events | migration 51: triggers only, `activation_record` not executable by members; unique (user, event, workout) | server-validated, idempotent by construction (code review) |

### Bugs / observations
- **L-1 (low, latent, not fixed)**: `saveOnboardingAction` (the Profile → Preferences "rebuild" wizard) sets
  `onboarding_completed_at` *before* building the program (onboarding.ts lines 47-48 vs 77-93). It is only reachable
  once onboarding is already complete (`profile/preferences/page.tsx`), so `firstTime` is false in practice; if the
  wizard were ever wired to first-time onboarding again a build failure would strand the member on /home without a
  program. Suggest moving the completion write after the build, as `completeOnboardingAction` does.
- **L-2 (low, not fixed)**: `completeOnboardingAction` accepts any `timeZone` string ≤ 64 chars and silently keeps UTC
  for an unknown one; the member is never told. `signInAction` later repairs it from the device (profiles still on
  UTC). Acceptable for launch.

### Security / enforcement
- All writes go through the cookie-bound client under RLS; `signups` feature flag and rate limits are server-side.
- Legal acceptances are recorded by a database trigger from the sign-up metadata (auth.ts 51-55).

### Browser-tested vs device
- Nothing in this area needs native hardware. e2e browser coverage exists but **was not executed in this audit**.

### Scores
- Functionality **7/10** — complete flow with plan summary and starter program; probes show the generator never fails for
  any accepted answer; but the browser flow was not re-run here.
- Reliability **7/10** — idempotent writes (weight upsert, program activation), completion written last, draft resume;
  duplicate sign-up path untested.
- Security **8/10** — 18+, terms and risk acknowledgement enforced server-side; rate limits; RLS everywhere; activation
  events trigger-only.

### Launch blockers (ranked)
1. Re-run `core-flow`, `onboarding-plan`, `first-workout-activation` e2e on a working Supabase before launch (not a code
   defect; a verification gap caused by the environment).
2. Add an integration test for a second sign-up with an existing e-mail (expect no second account, no enumeration).

---

## Area 2 — Workout logging and training programs: findings

### Workflows and failure scenarios
| Scenario | How | Result |
| --- | --- | --- |
| Log sets, finish, records, next session | unit batch above (workout-* , program-*: 1976 tests incl. these) | **ran, passed** |
| Finish saved twice on retry | code review `finishWorkout` (services/workouts.ts 205-220): looks up `(user_id, client_id)` (unique index, core schema line 281); a completed session is returned again with its records; a partial first attempt is reused and its exercise rows cleared | idempotent; integration `workouts.test.ts` covers it — **not run** |
| Two finishes at the same instant | code review: second insert hits the unique index → `WorkoutError("db")` → "We couldn't save your workout. It's still on this device" → the retry returns the completed session | safe, one extra tap |
| Set with 0 reps | probe | accepted, counts as a completed set, never a record |
| Set with 1000 kg | probe | accepted (cap 1500 kg), becomes a "max weight" personal record; no plausibility warning in the UI (`grep` found none) — **L-3** |
| Program with a missing exercise | code review `createPrivateProgram` (services/programs.ts 21-27): throws `Unknown exercises: …` before any row is written; `startProgramAction` reports "Couldn't start the program"; workout page catalog is `is_published = true` only, logger falls back to "Exercise" for unknown ids (`workout-logger.tsx` 627/702) | handled; no silent corruption |
| Draft sync while offline | code review: `syncWorkoutDraftAction` failure returns a message and the local copy stays; one in-flight backup at a time so an older snapshot can't overwrite a newer one (logger 241-243) | correct |
| Workout page reload | see Area 1 row | implemented |

### Bugs / observations
- **L-3 (low, not fixed)**: no plausibility guard on logged weight below the hard cap of 1500 kg; a typo of 1000 kg
  becomes a personal record and is used by the estimated-1RM and rank code. Suggest a soft confirmation above, say,
  500 kg (or 3× bodyweight) in `current-set-card.tsx`, not a schema change.
- `finishWorkoutSchema` accepts `startedAt`/`endedAt` in any order and any age; `activation_clamp_start` protects the
  activation metric but not the session's own `started_at`. Low; history sorting only.

### Security / enforcement
- `userProgramId` is re-checked against the caller (services/workouts.ts 222-226); template limit for Free is enforced
  in `templates.ts` via plan (`PLAN_FREE_TEMPLATE_LIMIT`), code review only. `v1/workouts` route authenticates per
  request (`api-auth.ts`).

### Scores
- Functionality **8/10** — large, passing unit coverage; honest fallbacks for unknown exercises.
- Reliability **8/10** — idempotent finish keyed on client id, draft merge rules, offline messaging; integration not re-run.
- Security **8/10** — RLS + ownership checks on program links; nothing trusted from the client about the plan.

### Launch blockers
1. None code-level. Re-run `workouts.test.ts`, `workout-fast-logging.test.ts`, `edit-safety.test.ts` and the
   `current-set-card`/`workout-reliability` e2e when Supabase is back.
2. (Nice to have) L-3 soft confirmation for implausible loads.

---

## Area 3 — Original 2D exercise demonstrations: findings

### Workflows and failure scenarios
| Scenario | How | Result |
| --- | --- | --- |
| Every published exercise has an honest state | data check + `exercise-demo-2d.test.ts` ("has a reviewed readiness for every catalog exercise, and nothing else"; "never treats an unreviewed exercise as finished") | **ran, passed**; 157/157 animated, 0 owner-approved |
| Placeholder never looks finished | code review `exercise-demo.tsx` 188-205: a bordered box with "Demonstration in progress", `data-demo-readiness="placeholder"`, aria-label says to follow the written steps; `poses` state is captioned "Pose frames · animation in progress" | honest; e2e `exercise-demo-2d.spec.ts` "each state is shown honestly, and the 3D page is gone" **not run** |
| No 3D leftovers | unit test + grep | none |
| 2.5D clip gating | `exercise-demos.ts shownDemoAsset`: shown only when `status === "approved"`; the only clip (dumbbell-curl) is `review` with equipment check FAIL | 2D athlete is what members see everywhere |
| Motion quality | `exercise-motion-quality`, `exercise-motions`, `exercise-drills`, `exercise-agility-drills` | **ran, passed** (part of the 1976) |

### Observations
- The readiness file says every exercise is `animated` after the 2026-11-04 review, yet `ownerApproved` is empty. That is
  honest by design (code never approves), but it means launch ships 157 demonstrations the owner has not signed off.
  Not a code bug; a sign-off task.
- Visual correctness of the drawings cannot be judged by automated tests; the review notes in the readiness file are the
  evidence. I did not re-render frames in this audit.

### Scores
- Functionality **8/10** — a complete, consistent state machine with captions and fallbacks for all 157 exercises.
- Reliability **8/10** — pure client-side SVG, no network; player unit tests pass.
- Security **n/a** (static content) — 10/10 for "nothing to attack".
- Accuracy **not scored by me**: depends on the owner's visual sign-off (none recorded).

### Launch blockers
1. Owner sign-off of the 2D demonstrations (`ownerApproved` is empty); the app is honest about this only to developers,
   members see finished-looking animations.

---

## Area 4 — Nutrition and food tracking: findings

### Workflows and failure scenarios
| Scenario | How | Result |
| --- | --- | --- |
| Diary maths, units, meal times, search ranking, barcode normalisation, photo/label parsing | unit batch (425 tests incl. these) | **ran, passed** |
| Food search with no network | code review `api/foods/search/route.ts` 49-69: local USDA search always answers; the remote search is wrapped, sets `remoteError: true`; the OFF client aborts after 8 s and raises `OffUnavailableError` | degrades to local results |
| Barcode not found | code review `lookupBarcode`: OFF 404 → `{status: "not_found"}`; product page shows "Product not found"; scanner shows an offline message when `navigator.onLine === false` | handled |
| Barcode lookup failure | 502 `lookup_failed`; scanner "Lookup failed. Check your connection" | handled |
| Photo flow with the AI failing | code review `api/ai/food-photo/route.ts`: 411/413/400/415 for bad uploads; provider failure → 500 "Something went wrong"; `ai-coach.ts` 512-516 releases the usage reservation on provider errors, so a failed call is not charged | handled; e2e `coach.spec.ts` meal-photo test **not run** |
| Meal logged across midnight in another zone | code review: the diary's "today" is `isoDateInTz(now, profile.timezone)` on the server (nutrition/page.tsx 138); the client sends that `date`, so a meal logged at 00:30 local goes to the member's new day if the page was loaded after midnight; a page left open from before midnight logs to the previous day (the date is visible in the header). `nutrition-timezone.spec.ts` **not run** | acceptable; document |
| Invalid calendar date from a client | probe | **accepted by schema → DB error → generic failure**; fixed (B-1) |
| Logging the same item twice on retry | code review `logFoodAction` 99-102: `meal_items.client_id` unique per user (migration 40), duplicate → success message | idempotent |

### Bugs
- **B-1 (low, fixed in 31a7fd8, regression test added)** — `isoDate` in `src/lib/validation/schemas.ts` validated only the
  shape `\d{4}-\d{2}-\d{2}`, so "2026-02-30" passed `logFoodSchema`, `waterSchema`, `weightEntrySchema`, the journal entry
  date and others, failed at the `date` column, logged a server error and showed "try again". Fix: `.refine(isValidIsoDate)`
  (shared helper from `src/lib/domain/dates.ts`). Test: `tests/unit/validation-dates.test.ts` (4 tests). Two local
  copies of the regex remain in `src/server/actions/progress-photos.ts:16` (not my area) and `src/lib/coach/tools.ts:20`
  (model-supplied dates; a bad one becomes a tool error the model retries) — left as is.

### Security / enforcement
- `nutrition_tracking` feature and AI photo/label routes are gated server-side from the entitlement (barcode route line
  18; `planForAuth` in `api-auth.ts`); OFF requests are server-side only (no key exposure).
- Photo consent is a separate server-recorded flag (`setFoodPhotoConsentAction`).

### Browser-tested vs device
- Barcode camera scanning and photo capture: **needs a physical iPhone/Android**; only the upload/lookup paths are
  browser-testable (and were not re-run here).

### Scores
- Functionality **8/10**, Reliability **7/10** (offline/not-found paths handled; one validation gap fixed; integration
  not re-run), Security **8/10**, Accuracy **not re-assessed** (nutrition-audit and score-formula unit tests pass).

### Launch blockers
1. Re-run `food-amounts`, `food-photo`, `barcode-media`, `food-quality` integration and the `nutrition-*`,
   `label-check`, `food-quality` e2e specs on a live Supabase.
2. Camera/scan on real devices.

---

## Area 5 — Faith, Bible reading, prayer and discipleship: findings

### Workflows and failure scenarios
| Scenario | How | Result |
| --- | --- | --- |
| Reader, plans, offline bundle, dataset integrity, memory challenges, reminders | unit batch | **ran, passed** |
| Bible reader offline | code review `public/sw.js`: `/bible/bsb/*`, `/bible-offline.html|js` served cache-first from `ngf-bible-v1`, navigations under `/faith/bible` fall back to the offline reader; `offline-bible.tsx` downloads shell + text (4.2 MB) with partial/error states and "Finish saving" | implemented; e2e `bible-reader.spec.ts` offline tests **not run** |
| Journey day rollover at midnight in the member's zone | code review migration 53 `faith_journey_check_in_at` 424-482: `v_today := (now() at time zone faith_safe_tz(profile.timezone))::date`; an offline tap for yesterday is accepted only within `faith_offline_grace()`, otherwise `faith_offline_too_late`; closed days raise `faith_day_closed`; undo is today-only | server decides the day; honest errors mapped in `journeys.ts` |
| Prayer-journal privacy (RLS) | migration 53 lines 689-702: per-table own-row policies; `cross-user-isolation.test.ts` "another member cannot read any other member's rows in any user-owned table" and `rls.test.ts` "admins see aggregate metrics but not users' private health or journal data" | **not run** this audit; policies verified by reading |
| Prayer journal never in the AI context | code review: coach snapshot reads `faith_journal_entries` only with `share_with_coach = true` (snapshot.ts 181-188) and `journalEntriesForCoach` filters again; Bible AI reads no journal (bible-ai.ts 27); the `remember` tool is told never to save journal content; `coach-journal.test.ts` **ran, passed** | default-private; opt-in per entry |

### Observations / policy
- **P-1 (policy, not a bug)**: the owner's rule is "Keep private prayer content out of any AI context". The code
  honours it for everything the member has not explicitly shared, and offers a per-entry "Share with AI Coach" switch
  (off by default) that puts a 1-line excerpt into the coach context. If the owner intends *no* journal content ever,
  `setJournalShareAction` and the snapshot query should be removed; otherwise this is a deliberate, consented exception
  and should be named in the privacy policy. Flagging for the owner's decision.
- Reminders and offline check-ins depend on the profile time zone; a member who never set one is on UTC until their
  next sign-in (see L-2).

### Browser-tested vs device
- Service-worker offline reading: browser-testable (e2e exists, not re-run). Native reminder notifications: **needs a
  physical device**.

### Scores
- Functionality **8/10**, Reliability **8/10** (day logic in the database with an offline grace window),
  Security **9/10** (own-row RLS on every table, AI exclusion by default, privileged RPCs with `security definer` and
  `auth.uid()`), Accuracy of Scripture text: dataset tests pass (`bible-dataset.test.ts`), not re-verified by me.

### Launch blockers
1. Owner decision on P-1 (explicit opt-in sharing of journal excerpts with the coach).
2. Re-run `faith-features`, `faith-journeys`, `bible-ai-helper` integration and `bible-reader`/`faith-journey` e2e.

---

## Area 6 — AI Coach functionality and personalization: findings

### Workflows and failure scenarios
| Scenario | How | Result |
| --- | --- | --- |
| Context building, prompt caching blocks, tool schemas, routing, memory parsing, chat key | unit batch (coach-*: part of the 425) | **ran, passed** |
| Free member | code review `ai-coach.ts` 129-131: `chatLimit <= 0` → `not_entitled` ("included with Pro All Access") before any provider call; proposals: `applyProposalAction`/`applyCoachProposalAction` re-check the allowance server-side | server-side |
| Quota exhaustion | `reserve_ai_usage` RPC (migration 25) raises `ai_quota`/`ai_quota_plan`/`ai_rate_limited`; mapped to 429 with a plain message; the in-memory limiter is only a burst guard | cross-instance, durable; `ai-limits.test.ts` "requests sent at the same moment can't overshoot" **not run** |
| Provider failure after reservation | 512-525: reservation released, orphan user message deleted, specific messages for auth/overload/connection | no double charge; e2e "one answer, one charge" **not run** |
| Tool errors | `tools.ts fail()` returns `{error}` with `is_error: true` to the model; unparseable tool input is retried up to 2× (ai-coach.ts 285-292) | handled |
| Proposal applied twice | claim-first update `proposal_status = 'applied' where status = 'proposed'` returning rows; second tap gets "already handled"; failure rolls the status back | idempotent |
| Memory off | snapshot reads `coach_memories` only when `profiles.coach_memory_enabled`; conversation-level `memory_off`; system prompt tells the model not to offer; `addCoachMemoryAction` refuses unless Pro **and** enabled (server) | enforced in data, prompt and action |
| Not configured | e2e "says honestly when the coach isn't configured" **not run**; code maps `AuthenticationError` to `not_configured` | honest |

### Observations
- No bugs found in this area by reading or by unit tests. The e2e coach spec (10 tests) is the real proof of the
  streaming path and could not be run.

### Security / enforcement
- Entitlement checks are server-side in the service and in each action; `ai_usage_events` is written with the service
  role only (members cannot reserve usage: `ai-limits.test.ts` line 50, not run). Prayer content excluded by default.

### Scores
- Functionality **8/10**, Reliability **8/10**, Security **9/10**, Personalization accuracy **not scored** (depends on a
  live model; mock-only here).

### Launch blockers
1. Re-run `coach.spec.ts` (with the Anthropic mock) and `ai-limits`, `ai-route-limits`, `coach-memory`, `pro-bypass`
   integration tests once Supabase is up.

---

## Data isolation check with the service-role REST helper

**Executed** once Supabase was back, as a scratch integration test (removed afterwards; the committed
`cross-user-isolation.test.ts` covers every user-owned table the same way and passed in the batch above). Method: rows
seeded as Alice through the service-role REST endpoint (the same call `e2e/helpers.ts serviceRest/seedRows` makes) in
`workout_sessions`, `meals`, `faith_journal_entries` (body "Private prayer: …"), `ai_conversations`, `coach_memories`;
then Bob, signed in through the anon client (RLS applies):

- Alice sees each of her 5 rows (non-vacuous).
- Bob `select … eq id` and `select … eq user_id=alice` → **0 rows in every table**.
- Bob `update {user_id: bob}` and `delete` by id → **0 rows affected**; Alice's rows still hers.
- Bob `insert` a journal entry or a coach memory with `user_id = alice` → **refused** (policy violation); Alice still
  has exactly one journal entry.
- Result: 4/4 probe tests passed. (`bible_notes` seeding failed on its own check constraint for `book_id`, so that
  table was covered by `cross-user-isolation.test.ts` only.)

## Commits in this worktree
- `72fab90` Audit areas 1-6: inventory and environment status
- `31a7fd8` Validate date fields as real calendar dates (B-1) + regression test `tests/unit/validation-dates.test.ts`
- (this commit) Findings for areas 1-6
