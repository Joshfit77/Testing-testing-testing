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
- **Onboarding**: adults only (18+). Asks weight, age, sex (male, female or prefer not to say) and height, then goals, experience, schedule, equipment, preferences, optional consent-gated limitations, diet and units, then generates and activates a personalized starter program. All answers can be edited later.
- **Training**: 125 exercises (instructions, form cues, common mistakes, alternatives, optional demo videos) and 25 programs across 23 categories, including MMA, boxing, grappling and athletic session libraries. Each program has a weekly schedule, sets/reps/rest/RPE, progression rules, deloads, warm-ups and cooldowns.
- **Build my program**: a guided builder for 12 program types (strength, powerlifting, bench, deadlift or squat specialization, MMA, cardio, bodybuilding, show prep, strongman, speed, agility). It uses your height, age, bodyweight, goal, experience, schedule, equipment and lifts (a 1RM or a recent best set) to create a periodized plan with real working weights, deloads and peaking.
- **Workout logger**: weights, reps, RPE, timed sets with a stopwatch, a rest timer (with native notifications on mobile), pause/resume, substitutions, skip-for-pain, notes, and an idempotent finish. In-progress workouts persist locally and on the server, so they survive reloads and device switches.
- **History & PRs**: edit or delete past workouts. Personal records are recalculated, and volume and frequency are tracked.
- **Progress photos & badges**: private before/after photos with side-by-side compare, and 24 badges for training, strength, consistency, food, faith and milestones (shown when a workout unlocks one).
- **Progress analytics**: bodyweight, workout frequency, volume, squat/bench/deadlift and per-exercise e1RM trends, calorie and macro trends, goals, a PR table and measurements, with 7d / 30d / 90d / 1y filters.
- **Diets**: 13 diet styles (balanced, high protein, low carb, keto, Mediterranean, paleo, vegetarian, vegan, pescatarian, 16:8 intermittent fasting, carnivore, Daniel Fast, DASH) with macro splits, eat/limit lists, sample days, safety notes and a "fits your diet" marker on foods. Calorie targets use the Mifflin-St Jeor equation.
- **Food**: 94 built-in common foods, barcode scanning (Open Food Facts), USDA FoodData Central search (values are re-fetched server-side, never invented), custom foods, labeled estimates, saved meals and recipes, meal planning, water, adjustable targets and history.
- **AI coach**: server-side Anthropic Claude calls, safety-scoped coaching, a context built from the user's own data, rate limits and monthly metering, and Zod-validated plan generation with preview and approval before saving. It degrades gracefully when no key is configured.
- **Recovery & mobility**: readiness check-ins (consent-gated), mobility and low-impact routines, rest-day activities, modifications, and the option to skip any painful exercise.
- **Optional Faith & Discipline**: KJV (public-domain) scripture by theme, verse of the day, a private journal, discipline goals with streaks, and the "40 Days Through the Narrow Gate" devotional and training challenge.
- **Subscriptions**: Free / Plus ($9.99/month) / Pro ($30/month) / All Access Yearly ($200/year, everything in Pro) defaults, configurable by env. Stripe Checkout, Billing Portal, signature-verified idempotent webhooks, and server-side entitlements.
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
