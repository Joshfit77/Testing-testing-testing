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
