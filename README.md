# Narrow Gate Fitness

**ROOTED IN FAITH. BUILT FOR STRENGTH.**

A premium black-and-gold fitness app with training programs, a workout logger, progress analytics, nutrition tracking and an AI coach. It also has an optional Christian faith & discipline section, inspired by Matthew 7:13–14. The app is built for everyone: the faith content is opt-in and never required for training.

One codebase ships three ways:

| Target | How |
| --- | --- |
| **Web + installable PWA** | Next.js app with manifest, icons, service worker and offline page |
| **iOS (App Store)** | Capacitor shell in `ios/` (Swift Package Manager; open in Xcode) |
| **Android (Google Play)** | Capacitor shell in `android/` (open in Android Studio) |

## Features

- **Home dashboard**: today's workout and a Start button, weekly activity, streaks, calorie/protein rings, bodyweight trend, latest PRs, recovery recommendation, AI shortcuts and program recommendations.
- **Auth**: Supabase email/password sign-up with email confirmation, password reset, secure cookie sessions, profile editing, JSON data export and account deletion.
- **Welcome & sign-up**: a welcome page with an email box that carries into sign-up.
- **Onboarding**: adults only (18+). A guided questionnaire, one question per screen with a progress bar: main goal, sex (only for calorie math), age, height (with lb/ft or kg/cm units), current weight, an optional goal weight with a weekly pace (e.g. "Lose 1 lb per week"), activity outside workouts, experience, days per week and session length, equipment, diet style, then name and the optional faith toggle. On finish it saves a bodyweight entry, sets a calorie budget (labelled an estimate) and builds and activates a starter program through the program builder, then shows a "Your plan is ready" summary at `/plan` (budget, maintenance, macros, pace and estimated goal date, program weeks × days × minutes and week 1). Training answers can be edited later in Training preferences.
- **Training**: 157 exercises (instructions, form cues, common mistakes, alternatives, an animated demonstration for every move, optional uploaded demo videos), including strongman implements and gym substitutes (axle, farmer's handles, keg, Zercher and trap-bar carries, sled drags, sandbag loads), combat S&C (air-bike sprints, neck work, med-ball shot puts and scoop tosses, Copenhagen planks) and bodybuilding machine/cable/lengthened-position work plus posing practice. 41 programs across 24 categories, from a free novice linear progression to a 12-week powerlifting peak — including 4-week training-max waves, tiered (heavy/volume/pump) strength, weekly undulating strength, powerbuilding, power-hypertrophy upper/lower and 5-day splits, push/pull/legs, full-body hypertrophy, conjugate, strongman statics & events, MMA fight camp and off-camp strength, a first 5K, an 80/20 half-marathon plan, 50+ strength and a glute-focused program. Every discipline has at least one free program, and programs are listed beginner → advanced. The evidence behind them and a full audit are in `docs/PROGRAM_RESEARCH.md`; `npx tsx scripts/audit-programs.ts [slug]` prints any program's weekly sets per muscle, lift frequency and session length. The Train page groups the library by discipline (Strength & Powerlifting, Strongman, Bodybuilding & Physique, Combat Sports, Endurance & Conditioning, Speed & Agility, General Fitness), each with who it's for and what a week looks like (`src/lib/domain/disciplines.ts`). Each program has a weekly schedule, sets/reps/rest/RPE, progression rules, deloads, warm-ups and cooldowns.
- **Animated exercise demos**: every exercise shows a short looping animation of correct technique — a stylised gold mannequin (side view, front view where clearer) with the equipment drawn, play/pause and 0.5×/1× controls, honouring reduced-motion. They are illustrations generated in-app (`src/lib/exercise-motion/`, definitions in `src/data/exercise-motions.ts`), not filmed video; an uploaded or linked video still takes priority on the exercise page. New catalog exercises get a pattern-based animation automatically. The workout logger loops the current exercise's demo (tap to enlarge) and the library shows still thumbnails. The engine has no React/Node dependencies, so the offline edition can bundle it: `esbuild src/lib/exercise-motion/index.ts --bundle --format=iife --global-name=ExerciseMotion`, then `ExerciseMotion.mountExerciseMotion(el, slug, { autoplay: true })`.
- **Build my program**: a guided builder for 12 program types (strength, powerlifting, bench, deadlift or squat specialization, MMA, cardio, bodybuilding, show prep, strongman, speed, agility). It uses your height, age, bodyweight, goal, experience, schedule, equipment and lifts (a 1RM or a recent best set) to create a periodized plan with real working weights, deloads and peaking. Templates follow how each sport actually trains: strongman gets max-effort overhead/deadlift days and event days with moving events by distance and target time (with substitutes when you lack implements) and a contest week of openers; MMA gets at most three low-soreness S&C days (max strength, power, alactic sprints, glycolytic intervals, 5-minute rounds, neck and rotational work) that taper into fight week; bodybuilding uses full-body, upper/lower, push/pull/legs or body-part splits with 10–20 hard sets per muscle per week scaled by experience, reps-in-reserve targets and specialization; show prep adds LISS, step targets and posing every session; meet prep ends with opener practice and a meet day.
- **Workout logger**: weights, reps, RPE, timed sets with a stopwatch, a rest timer (with native notifications on mobile), pause/resume, substitutions, skip-for-pain, notes, and an idempotent finish. In-progress workouts persist locally and on the server, so they survive reloads and device switches.
- **History & PRs**: edit or delete past workouts. Personal records are recalculated, and volume and frequency are tracked.
- **Progress photos & badges**: private before/after photos with side-by-side compare, and 24 badges for training, strength, consistency, food, faith and milestones (shown when a workout unlocks one).
- **Progress analytics**: bodyweight, workout frequency, volume, squat/bench/deadlift and per-exercise e1RM trends, calorie and macro trends, goals, a PR table and measurements, with 7d / 30d / 90d / 1y filters.
- **Diets**: 13 diet styles (balanced, high protein, low carb, keto, Mediterranean, paleo, vegetarian, vegan, pescatarian, 16:8 intermittent fasting, carnivore, Daniel Fast, DASH) with macro splits, eat/limit lists, sample days, safety notes and a "fits your diet" marker on foods. Calorie targets use the Mifflin-St Jeor equation.
- **Food**: MyFitnessPal-style logging with exact amounts. Search the built-in USDA FoodData Central SR Legacy database (7,448 foods, works offline from any API key; everyday foods shown first with friendly names) or browse it by the 24 USDA food groups, then pick a quantity (1.5, 1 1/2, 3/4) and a unit: grams, ounces, pounds, USDA household measures ("1 cup, chopped"), the package's label serving, or ml / fl oz for drinks, with live calories, macros, fiber, sugar and sodium. Logged entries keep their exact grams and can be edited (amount, unit, meal) later. Daily fiber, sugar and sodium totals say when only some foods had data. Barcode scanning uses the native scanner in the iPhone/Android app and the camera or a typed code on the web, then opens the amount step with the product's label serving (Open Food Facts). Also: 94 built-in common foods, optional USDA API search for branded foods, custom foods, labeled estimates, saved meals and recipes, meal planning, water, adjustable targets and history.
- **Food data sources**: USDA FoodData Central SR Legacy (U.S. Department of Agriculture, Agricultural Research Service; public domain) is bundled in `src/data/usda-foods.json` (built by `scripts/build-food-db.mjs`) and only read on the server. Barcode products come from Open Food Facts (community-contributed data under the Open Database License, ODbL); the app labels them "community data — check the label".
- **Food diary (MyFitnessPal / MyNetDiary style)**: a Goal − Food + Exercise = Remaining strip (exercise is estimated from today's finished workouts at your latest bodyweight), quick add calories and optional macros to any meal, copy a meal or the whole day from yesterday, recent and frequent foods for one-tap re-logging, a weekly summary vs. goal (average, days under/over), a weight-goal card (start, current, goal, progress and estimated goal date) and an "if every day were like today, you'd weigh X in 5 weeks" line. Goal weight, pace and activity can be changed to recalculate the budget; custom targets still override it. Tracking stays a Plus/Pro feature.
- **Supplements** (free on every plan): 24 common supplements with purpose, typical dose, timing, an evidence rating, cautions and a diet-fit note (e.g. whey on a vegan diet suggests plant protein). Users build a personal stack and check it off each day. General education with a third-party-testing and talk-to-your-doctor disclaimer.
- **Steps**: a Home card with today's steps vs. a daily goal (default 8,000, editable 1,000–50,000), a 7-day bar chart and manual entry; a 30-day chart on Progress. In the iPhone/Android app a "Sync Apple Health" / "Sync Health Connect" button reads the last 7 days of step totals (`@capgo/capacitor-health`). On the web a note points to the phone app. Apple Health needs the **HealthKit capability** on the Apple App ID and in Xcode (plus an `NSHealthShareUsageDescription`); Health Connect needs **Android 8+** with the Health Connect app and the `android.permission.health.READ_STEPS` permission declared.
- **AI coach**: a streaming coach backed by Anthropic Claude (Pro: `claude-opus-5-5`, Plus: `claude-sonnet-5-5`, both overridable with `COACH_MODEL_PRO` / `COACH_MODEL_PLUS`; server-side refusal fallbacks on). A cached knowledge base (`src/lib/coach/knowledge.ts`: overload, RPE/RIR, volume landmarks, deloads, lift technique and faults, substitutions, periodization and peaking, strongman, combat S&C, conditioning zones, recovery, nutrition by diet type, supplements with the app's evidence ratings, and safety rules) plus a compact context from the user's own data (goal, budget and today's intake, active program and next workout, recent top sets with e1RM trends, PRs, bodyweight trend, adherence, steps, supplements). Read-only tools (`get_recent_workouts`, `get_exercise_history`, `get_nutrition_summary`, `get_program_week`, `search_exercises`, `get_food_nutrition` over the bundled USDA database, `calculate`) and proposal tools (`propose_exercise_swap`, `propose_nutrition_targets`, `propose_bodyweight_log`) whose changes only apply when the user taps Confirm. Data-based starter questions, live tool-activity indicators, markdown (tables, lists), copy, per-user history, monthly limits and an honest "not configured" state without `ANTHROPIC_API_KEY`. Faith users may get one short KJV verse when it fits; nobody else gets religious content. `COMPACT_COACHING_RULES` is a <2,500-word version for the offline edition. Plan mode (Pro) still drafts whole programs for review.
- **Recovery & mobility**: readiness check-ins (consent-gated), mobility and low-impact routines, rest-day activities, modifications, and the option to skip any painful exercise.
- **Optional Faith & Discipline**: KJV (public-domain) scripture by theme, verse of the day, a private journal, discipline goals with streaks, and the "40 Days Through the Narrow Gate" devotional and training challenge.
- **Subscriptions**: Free / Plus ($7.99/month) / Pro ($14.99/month) / All Access Yearly ($119.99/year, everything in Pro) defaults, configurable by env. Stripe Checkout, Billing Portal, signature-verified idempotent webhooks, and server-side entitlements.
- **Workout reminders**: weekly local notifications in the iPhone/Android app.
- **Polish**: animated pop-ups and sheets, toast notifications, page transitions and a confetti celebration when you finish a workout.
- **Admin**: role-protected pages for exercises (licensed media only), programs and prescriptions, categories, content, subscriptions, feature flags, aggregate metrics and an audit log. Admins never see users' health or journal data.
- **Security**: Postgres Row Level Security on every table, Zod validation on every input, no secrets in client bundles, CSRF-safe server actions plus same-origin checks on cookie-authenticated API routes, and structured error logging that excludes private data.

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui-style components (Radix) · Lucide · Supabase (Postgres, Auth, Storage) · Stripe · Anthropic SDK · Recharts · Zod · Capacitor 8 · Vitest · Playwright.

## Quick start

```bash
npm install
npx supabase start          # local Postgres/Auth/Storage (requires Docker)
npx supabase db reset       # applies migrations + seed (exercises, programs, content)
cp .env.example .env.local  # fill in the values printed by `supabase start`
npm run dev                 # http://localhost:3000
```

Confirmation and reset emails go to the local Mailpit inbox at http://127.0.0.1:54324.

Full instructions, including Stripe, AI, food search, admin bootstrap, deployment and the native builds, are in **[SETUP.md](./SETUP.md)**. Current status and next steps are in **[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)**. The mobile API boundary is described in **[API.md](./API.md)**.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `npm run test:unit` | Pure domain logic and data-integrity tests |
| `npm run test:integration` | Real-database tests (RLS isolation, workout logging, Stripe webhooks, entitlements). Needs local Supabase |
| `npm run test:e2e` | Playwright: auth, onboarding, workout logging, gating, progress, faith. Needs the app and local Supabase |
| `npm run seed:generate` | Regenerate `supabase/seed.sql` from `src/data/*` |
| `npm run icons` | Re-render PWA and native icons and splash screens |
| `npm run cap:sync` / `cap:ios` / `cap:android` | Sync and open the native projects |

## Project layout

```
src/
  app/                 routes (App Router): (auth), (app) shell pages, api/, legal/
  components/          UI primitives (ui/), shell, charts, feature components
  data/                exercise, program and content catalog (source of truth for the seed)
  lib/domain/          pure, unit-tested logic (units, PRs, streaks, nutrition, plans, generator, workout reducer)
  lib/validation/      Zod schemas (forms, API, AI output)
  server/              server-only: auth guards, services, server actions, Stripe, AI, rate limiting
supabase/              migrations (schema, RLS, storage) and generated seed
ios/, android/         Capacitor native projects
tests/                 unit + integration tests; e2e/ Playwright specs
```

## Disclaimer

Narrow Gate Fitness provides general fitness information. It is not medical advice, diagnosis or treatment. The privacy policy and terms are placeholders marked for legal review.
