# Where your data lives

_Last updated: 2026-10-20 (Stage 1C). Covers the primary app (Next.js + Supabase, and the Capacitor iPhone/Android shells that load it). The offline single-file edition (`standalone/index.html`) keeps everything in `localStorage` on one device, with no account, sync or export._

The short version: **your account data lives in the database and is the source of truth.** The device keeps only a few convenience copies: unsent form drafts, the in-progress workout, navigation memory and display settings. Those never leave the device, and drafts are removed as soon as you save.

## 1. Synced: Supabase (Postgres + Storage)

Every table below is private to its owner through row-level security (`user_id = auth.uid()`). Administrators can't read health, nutrition, journal, AI or activity data (`tests/integration/rls.test.ts` and the per-feature integration tests check this). Every row is deleted with the account (`on delete cascade`). `tests/unit/account-coverage.test.ts` reads the migrations and fails if a user-linked table is missing from the export or doesn't cascade.

| Area | Tables |
| --- | --- |
| Account & settings | `profiles` (name, units, birth year, height, sex, time zone, step goal, faith toggle, text size, reduce motion, Home scripture), `onboarding_answers` (including the optional secondary goal), `fitness_goals` |
| Training | `user_programs`, `training_programs` (programs you built, plus their `program_weeks` / `program_days` / `program_exercises`), `workout_sessions`, `workout_exercises`, `workout_sets`, `personal_records`, `planned_session_overrides` (sessions you moved on the training calendar; migration `20261021000020`), `workout_templates` + `workout_template_exercises` (saved custom workouts; migration `20261021000013`). Rest-timer alert settings are `profiles.rest_timer_sound` / `rest_timer_vibrate`. The in-progress workout draft (format v2; older v1 drafts are migrated on load) stays on the device and syncs as before |
| Running & walking | `activities` (manual, treadmill and, later, GPS; soft delete with `deleted_at`) |
| Body & recovery | `weight_entries`, `measurement_entries`, `recovery_checkins` (stored only with consent), `progress_photos` (metadata) |
| Food | `foods` (your saved foods and cached USDA/Open Food Facts items), `meals`, `meal_items`, `nutrition_goals`, `water_entries`, `food_favorites` (migration `20261020000011`), `supplement_stack`, `supplement_logs`, and from migration `20261021000012`: `recipes`, `recipe_ingredients`, `meal_plan_settings` (meals per day, budget, allergies, dislikes), `meal_plans`, `meal_plan_entries`, `grocery_lists`, `grocery_items`, `nutrition_day_marks` |
| Steps | `daily_steps` (manual, or synced from Apple Health / Health Connect) |
| AI coach | `ai_conversations`, `ai_messages` (including proposals and whether you applied them), `ai_usage_events` |
| Faith | `faith_journal_entries` (prayer journal: type, answered date and note; sent to the AI coach only for entries where you ticked "Share with AI Coach", off by default), `discipline_goals` (daily practices), `discipline_checkins`, `faith_reminders` (devotional / prayer / practice reminder settings; notifications themselves are scheduled on the phone), `challenge_enrollments`, `challenge_checkins` |
| Billing | `subscriptions`, `user_entitlements`, `billing_customers` (written only by the server from Stripe webhooks) |

**Storage buckets.** `avatars` and `progress-photos` are private, one folder per user (`<user id>/...`). `exercise-media` is a public catalog bucket that only administrators upload to. It holds no personal data.

**When it syncs.** Every save is a server action or API call that writes to the database straight away. Nothing waits in a queue, with one exception: the workout logger (see section 3). Pages read fresh data from the server when they open.

**Recipes** keep a snapshot of each ingredient's nutrition basis (taken from the source on the server when it's added). Logging a serving writes one diary entry with its own per-serving snapshot (`meal_items.source = recipe:<id>`), so editing or deleting the recipe never changes the diary. Meal plan entries are planned meals only; "Log this meal" copies one into the diary. Grocery items from a plan are rebuilt when you build the list again; items you added are kept until you clear them.

**Food favorites** store the food's stable key (`usda:<fdcId>`, `off:<barcode>`, `food:<uuid>`, the same format as `meal_items.source`) plus a snapshot of its name and nutrition basis for display. Logging a favorite always re-reads the nutrition from its source on the server. Only one favorite per food per user is allowed (`unique (user_id, food_key)`). Hand-entered quick adds can't be favorited.

## 2. On this device only (never synced)

All keys start with `ngf.`. Every read and write is wrapped, so a private window or blocked storage just means the feature quietly does nothing.

### localStorage (survives closing the app)

| Key | What | Cleared |
| --- | --- | --- |
| `ngf.draft.<userId>.<form>` | Unsent form drafts (`src/lib/drafts.ts`, `useDraft` in `src/lib/use-draft.ts`): `coach.input.<conversation>` (coach message), `coach.pending` (a message that was mid-send), `faith.journal.new` / `faith.journal.<entryId>`, `food.manual`, `food.custom`, `food.quickadd.<meal>`, `food.recipe.new` / `food.recipe.<id>` (unsaved recipe, including its picked ingredients), `progress.photo` (note + weight, not the image) | On a successful save or send, with "Discard draft", after 30 days, or after account deletion |
| `ngf.workout.draft.<userId>` | The in-progress workout (sets, timers, notes) | When the workout is finished or discarded |
| `ngf.textSize`, `ngf.reduceMotion` | A mirror of your display settings, so the first paint is already the right size (the real values are on `profiles`) | Overwritten on every page load |
| `ngf.sidebar.collapsed` | Desktop sidebar state | Never (not personal) |
| `ngf.workoutReminders.v1` | Workout reminder schedule (iPhone/Android app; the notifications themselves are scheduled natively) | When you change the reminders |

Drafts are namespaced by user id, so on a shared device one account never sees another's draft (unit-tested in `tests/unit/drafts.test.tsx`).

### sessionStorage (this tab or app session only; gone when it closes)

| Key | What |
| --- | --- |
| `ngf.nav.last.<section>` | The last screen and filters you used in each bottom tab (`lastHrefFor` in `src/lib/nav-memory.ts`), so tapping the tab takes you back there. Live workouts and edit forms are never restored this way. |
| `ngf.nav.stack` | In-app history, so Back buttons go back only when the previous screen is in the app and otherwise go to the section root |
| `ngf.scroll.<path?query>` | Scroll position per screen (up to 60), restored on Back/Forward and tab returns (`src/components/shell/scroll-memory.tsx`) |
| `ngf.ui.food.add.*` | Add-food dialog tab, search text and food type |
| `ngf.faithRemindersSynced` | iPhone/Android app only: faith reminders were re-applied on this device this session |

### Service worker cache

`public/sw.js` caches only static build assets, icons and the offline page. Signed-in HTML and API responses are never cached.

### Native (iPhone/Android app)

- Local notifications (rest timer, workout reminders, faith reminders) are scheduled with the OS by `@capacitor/local-notifications`. Faith reminder settings are saved to your account (`faith_reminders`) and re-applied on the phone when the app opens; a web browser can't show them.
- Apple Health / Health Connect: step counts are **read** when you tap sync and then saved to `daily_steps`. Nothing is written back to Health.
- Keyboard: `@capacitor/keyboard` 8.0.6 (`resize: native`). It stores nothing. Run `npx cap sync` and ship a new native build to include it.
- Session cookies live in the WebView's cookie store, as in a browser.

## 3. Offline behaviour

| Works offline | Doesn't |
| --- | --- |
| An open **workout logger**: sets save to the device immediately and sync to the server (`syncWorkoutDraftAction`) when you're back online. There's an offline notice. | Anything else that saves: food, journal, coach, runs, steps, weight and so on. These need a connection. Typed text isn't lost, though: the drafts above keep it, and the coach puts a failed message back in the box with **Try again**. |
| Drafts and the navigation memory (device only) | Opening a page you haven't loaded yet: the offline page is shown |
| | AI coach, food search and barcode lookup (server calls) |

## 4. Export

**Profile → Download my data** (`GET /api/account/export`, `exportUserData` in `src/server/services/account.ts`) returns one JSON file with every table in section 1 (`USER_TABLES`), read with your own session so RLS applies. It also includes:

- `training_program_structure`: the weeks, days and exercises of programs you built.
- `progress_photo_files`: a private download link for each photo, valid for 1 hour. The images aren't embedded in the JSON.

Deliberately not exported: `admin_audit_logs`, which is the administrators' own audit trail (its `actor_id` is set to null if that admin is deleted). Device-only data (section 2) isn't part of the export because the server never has it.

Stage 1C added `supplement_stack`, `supplement_logs`, `daily_steps`, `food_favorites`, `billing_customers` and the custom-program structure to the export. Stage 1B added `activities`. `tests/integration/food-favorites.test.ts` checks the export against a real database.

## 5. Deletion

**Profile → Delete account** (type DELETE) runs `deleteAccountAction`:

1. Cancels any Stripe subscription.
2. Removes every object under `<user id>/` in the `avatars` and `progress-photos` buckets (`removeUserStorage`). Storage objects don't cascade, so this step is needed. A test checks that every private bucket in the migrations is in `USER_STORAGE_BUCKETS`.
3. Deletes the auth user. Every table in section 1 cascades.
4. Signs out and opens `/?deleted=1`, which also clears this device's drafts, workout copy and navigation memory (`ForgetDeviceData`).

It needs `SUPABASE_SERVICE_ROLE_KEY` on the server. Without it the button explains that deletion isn't configured. Single entries (food, journal entries, weights, saved meals, saved foods, programs, conversations, workouts, photos, runs) can be deleted individually, and every one of those asks for confirmation first.
