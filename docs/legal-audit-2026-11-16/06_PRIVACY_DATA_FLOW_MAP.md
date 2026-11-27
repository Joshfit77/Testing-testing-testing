# 06 — Privacy data-flow map

Date: 2026-11-16. Branch: `claude/friends-challenges` (commit `3b9bc44`), which contains the TestFlight release
candidate. Prepared for the founder and a US privacy/technology attorney. **Not legal advice**: this file records what
the code and database do and lists questions for counsel.

Sources: the application code under `src/`, the 69 migrations in `supabase/migrations/`, and queries against the local
database (`pg_policies`, `pg_constraint`, `information_schema`, `storage.buckets`, `cron.job`). No hosted
environment was inspected.

## 1. Summary

- **Every personal table is owner-only.** All 112 tables in `public` have row-level security switched on. Of the
  104 columns that link a row to an account, 102 delete the row with the account; the other two are in staff tables
  and are set to null.
- **Administrators have no read access to members' health, food, faith, photo, location or AI data through the app.**
  The only member data an admin policy exposes is the reports queue for Friends (flag off).
- **Third parties that receive personal data from code:** Supabase (everything), Anthropic (AI features, after
  consent), Stripe (email, account ID), RevenueCat (account ID, purchases), Open Food Facts (barcodes), USDA (search
  text, only if a key is set). There is no advertising, analytics or crash-reporting SDK in `package.json`.
- **Nothing expires.** No code deletes old data on a schedule. The one scheduled database job settles Faith journeys.
  Data lasts until the member deletes it or the account.
- **The legal text members actually accept is a placeholder.** The sign-up record stores version
  `2026-10-26-placeholder` of both documents (file 07).
- **The main differences between the documents and the code** are in section 7: AI uses that neither the consent
  card nor the policy lists (Bible study questions, weekly reports, label photos, sleep check-in factors), the
  statement that the database refuses recovery check-ins without consent (it does not; the app does), first-party
  activation events not mentioned, and no mention of sharing between members.
- **Age:** a required "18 or older" box at sign-up and an age field that must be 18 to 100 at onboarding. Nothing
  else. No date of birth, no verification, no under-13 path, and the database accepts any birth year from 1900 to 2100.
- **Not geo-restricted.** No code limits the service to the United States.

## 2. Systems and who receives what

| Recipient | Receives | Sent from | Evidence |
|---|---|---|---|
| **Supabase** (database, sign-in, file storage) | All account data, all logs listed in section 4, photos, AI conversations, billing status | Everywhere | `src/lib/supabase/*` |
| **Hosting provider** (the in-app policy names Vercel; the draft leaves it blank) | Every request to the web server; server log lines | Deployment | `src/app/legal/privacy/page.tsx:61`; `PRIVACY_POLICY_DRAFT.md:145` |
| **Anthropic** | The AI inputs in section 6, only when `profiles.ai_data_consent_at` is set | Server | `src/server/services/ai-coach.ts:469-470, 659-660` |
| **Stripe** | Email address; account ID as `metadata.user_id` and `client_reference_id`; plan and price. Card details go from the member's browser to Stripe directly | Server, at web checkout | `src/server/services/billing.ts:136, 202-204` |
| **RevenueCat** (with Apple / Google) | Account ID as the app user ID; store purchase records. No email is sent by code | Phone app | `src/lib/billing/store-purchases.ts:26-29` |
| **Open Food Facts** | The barcode number only, from the server, with an app User-Agent. Not the member's IP or identity | Server | `src/server/services/open-food-facts.ts:17-21` |
| **USDA FoodData Central** | Food search text (up to 80 characters), from the server, **only if `USDA_API_KEY` is configured** and the `food_search` flag is on. Otherwise search runs on a built-in copy of the USDA data and nothing leaves | Server | `src/app/api/foods/search/route.ts:46-52`; `src/server/services/food-database.ts:93-100` |
| **YouTube (no-cookie domain) / Vimeo** | The member's IP and browser details, if an exercise has an embedded third-party video and the member opens it | Browser | `src/lib/media.ts:19-29`; `src/lib/security-headers.ts:52` |
| **Map tile provider** | None by default. If the owner sets `NEXT_PUBLIC_MAP_TILE_URL`, the provider learns the area of each viewed route | Browser | `src/lib/domain/map-tiles.ts:1-7` |
| **Email delivery** | Sign-up confirmation and password-reset emails are sent by Supabase Auth. No production mail provider is configured in the repository; the app sends no other email | Supabase | `supabase/config.toml:238-258`; `supabase/templates/` |
| **Google ML Kit** (Android barcode scanning) | On-device library; what it reports to Google was not verified | Phone app | `@capacitor/barcode-scanner` |
| **Other members** | Nothing today. With the Friends or Accountability flags on: display name, username and workout figures (file 08) | Database functions | Migrations 067, 076 |

Not present in code: advertising identifiers, analytics SDKs, crash-reporting SDKs, push-notification services, SMS,
marketing email.

## 3. Facts common to every data type

**Account isolation.**
- Row-level security is on for all 112 tables. Nine internal tables have no policy at all, so only the server's
  service role can reach them (`ai_budget_alerts`, `ai_budget_months`, `billing_state_versions`,
  `legal_document_versions`, `rate_limit_counters`, `revenuecat_events`, `sandbox_testers`, `store_sync_state`,
  `stripe_events`).
- Personal tables use `user_id = auth.uid()` for select, insert, update and delete.
- Admin policies exist only on: catalog tables (exercises, programs, content, categories, media), `feature_flags`,
  `admin_audit_logs` (read) and `user_reports` (read and close).
- The admin Subscriptions page uses the service role and shows display name, plan, status and dates for the latest
  200 subscriptions (`src/app/(app)/admin/subscriptions/page.tsx:29-37`). It can look an account up by email
  (`src/server/services/sandbox-testers.ts:46-58`).
- Private storage buckets (`avatars`, `progress-photos`, `body-scans`) allow access only under the folder named
  with the member's own ID. `exercise-media` is public and holds catalog media only.
- Tests: `tests/integration/cross-user-isolation.test.ts` (26 tests: seeds one member in every table in
  `USER_TABLES` and every private bucket, then tries to read, change, delete and spoof as another member, an admin
  and a signed-out visitor); `tests/integration/rls.test.ts` (14); `tests/integration/api-function-surface.test.ts`
  (4: which database functions each role may call); `tests/unit/account-coverage.test.ts` (every user-linked table
  must be in the export list or the documented exclusions). **These were not re-run for this audit**, apart from the
  Friends test (file 08).

**Export** (`src/server/services/account.ts`; route `src/app/api/account/export/route.ts`).
- One JSON file. 93 tables listed in `USER_TABLES` (:22-120), read with the member's own session, 3 exports an hour.
- Coaching memories are decrypted for the member (:153).
- Photos are not in the file; it contains download links valid for one hour for progress photos and Body Scan photos
  (:168-177).
- **Not exported** (:126-134): `admin_audit_logs`, `billing_state_versions`, `store_sync_state`, `sandbox_testers`.
- **Also not in the export:** the avatar image file (only its path, in `profiles`); the sign-in record held by
  Supabase Auth beyond ID and email; anything held by Stripe, RevenueCat or Anthropic; server logs; soft-deleted
  runs are included (without route). Friends gaps are in file 08, F-11.

**Deletion of the account** (`src/server/services/account-deletion.ts:38-90`; action `src/server/actions/profile.ts:97-123`).
- The member types DELETE and re-enters the password. 5 attempts per 15 minutes.
- Order: (1) cancel Stripe subscriptions, and stop if that fails; (2) remove files in the three private buckets;
  (3) delete the sign-in account, which cascades to every personal table; (4) delete the Stripe customer and the
  RevenueCat customer, best effort, failures logged.
- **What survives:**
  - App Store / Google Play subscriptions keep billing until the member cancels them in the store. The screen says so.
  - Stripe's and RevenueCat's own records, if step 4 fails or to the extent those providers retain data.
  - `stripe_events` and `revenuecat_events`: event ID, type and processing status. No account column.
  - `admin_audit_logs`: rows stay. `actor_id` is set to null if the deleted account was the admin. `entity_id` and
    `details` can hold a member's account ID (for example a sandbox-tester entry) and are not removed.
  - `sandbox_testers.added_by` is set to null (the tester row itself cascades).
  - `rate_limit_counters`: keys contain the account ID (for example `export:<id>`). Rows older than two days are
    removed when the limiter next runs (migration `20261101000046_billing_integrity.sql:374`).
  - Server logs at the host: some error lines carry an account ID or Stripe customer ID
    (`account-deletion.ts:78, 86`).
  - Database backups at Supabase.
  - Whatever Anthropic retains of past AI requests under its own terms.
- Tests: `tests/integration/account-deletion.test.ts`, `account-deletion-billing.test.ts`, `e2e/account-deletion.spec.ts`
  (not re-run).

**Retention.** No time-based deletion exists for any personal data type. Stated per type below only where there is
something specific.

**Encryption.** In transit: HTTPS. At rest: whatever Supabase provides. Field-level encryption exists for one thing
only, coaching memories (section 4.11).

## 4. Data-flow map by data type

Each table lists only what is specific to the type. Export, account deletion and isolation follow section 3 unless
a row says otherwise.

### 4.1 Account registration

| | |
|---|---|
| Collected | Email, password, display name; three required unticked boxes: 18 or older, Terms and Privacy Policy, health and AI notice. `src/components/auth/auth-forms.tsx:105-154`; `src/lib/validation/schemas.ts:35-42` |
| Gate | None beyond the boxes. Sign-ups can be paused with the `signups` flag (`src/server/actions/auth.ts:69`) |
| Stored | Supabase Auth (`auth.users`: email, password hash, metadata with display name). `profiles.display_name`. Acceptance records in `legal_acceptances` (4.20). **The age box is not stored anywhere**; only the Terms, Privacy and risk acknowledgments are recorded (`src/lib/legal/versions.ts:39-45`) |
| Processing | Rate limits keyed on a hash of the IP address and of the email (`auth.ts:34-56`). Confirmation email required (`supabase/config.toml:227`). Minimum password length 8 (:183). No multi-factor sign-in in use |
| Third parties | Supabase. Email goes to Stripe only at first web checkout |
| Retention | Until account deletion |

### 4.2 Profile

| | |
|---|---|
| Collected | Age (stored as `birth_year` = current year minus age), sex (male / female / unspecified), height, weight, units, time zone, goals, experience, equipment, schedule, diet type, activity level, goal weight, optional avatar. Onboarding: `src/components/onboarding/onboarding-questionnaire.tsx`; `src/server/actions/onboarding.ts:35, 127` |
| Gate | Age must be 18 to 100 in the form and server schema (`schemas.ts:54, 93, 151`) |
| Stored | `profiles`, `onboarding_answers`, `fitness_goals`, `nutrition_goals`; avatar in private bucket `avatars` |
| Processing | Calorie and macro estimates, program selection |
| Third parties | Supabase. Age, sex, height, goals and schedule go to Anthropic with AI consent (section 6) |
| Note | The member's own session may update `birth_year` and every `*_consent_at` column directly (column grants on `profiles`). The database constraint on `birth_year` is 1900 to 2100, not 18+ |

### 4.3 Workouts

| | |
|---|---|
| Collected | Sessions, exercises, sets (reps, weight, time, effort), skip reasons, notes, personal records, programs, templates, strength ranks, adaptive-training targets and decisions |
| Gate | None (core feature) |
| Stored | `workout_sessions`, `workout_exercises`, `workout_sets`, `personal_records`, `user_programs`, `training_programs` (own), `workout_templates`, `exercise_targets`, `training_adjustments`, `training_recommendation_decisions`, `planned_session_overrides`. Unsent drafts in the device's local storage, namespaced per account (`src/lib/drafts.ts`) |
| Third parties | Supabase. Anthropic with AI consent: last 10 workouts (top set per exercise, skip reasons), records, program, adherence |
| Sharing with members | Counts and streaks only, and only with the Friends or Accountability flags on |

### 4.4 GPS runs and walks

| | |
|---|---|
| Collected | Live location during a recording the member starts; background location if allowed. `src/components/run/gps-recorder.tsx`; iOS strings `ios/App/App/Info.plist:77-80` |
| Gate | Operating-system location permission. Pro plan for live recording. No in-app consent record |
| Stored | `activities`: start time, time zone, distance, times, notes, effort, `route` (simplified to at most 2,000 points, coordinates rounded to 5 decimal places, about 1 metre), `splits`, `gps_quality`. `is_private` is always `true` (`src/server/actions/gps-activities.ts:85`). `running_goals`. Unsaved fixes are kept on the device |
| Processing | Distance, pace, splits. Route drawn from the member's own points with no map tiles by default |
| Third parties | Supabase. Anthropic receives a **running summary** on request (dates, distance, time, effort, source); the route is not part of it (`src/lib/coach/running-summary.ts:12-20`) |
| Retention | Deleting a run sets `deleted_at` and clears `route`, `splits` and `gps_quality` at once (`src/server/actions/activities.ts:211`). A database constraint forbids a deleted row from keeping a route (migration `20261025000043`). **The rest of the row (date, distance, time, notes) stays until account deletion**; no purge |
| Export | Includes soft-deleted rows without route |

### 4.5 Food logs, recipes, planners

| | |
|---|---|
| Collected | Diary items, water, saved meals, recipes, meal plans, grocery lists, supplements, favourites, custom foods, food filters (diet style, allergens, dislikes) |
| Stored | `meals`, `meal_items`, `water_entries`, `foods` (own), `recipes`, `recipe_ingredients`, `meal_plans`, `meal_plan_entries`, `meal_plan_settings`, `meal_plan_drafts`, `grocery_lists`, `grocery_items`, `supplement_stack`, `supplement_logs`, `food_favorites`, `nutrition_day_marks`, `profiles.food_filters` |
| Third parties | Supabase. Open Food Facts: barcode only. USDA: search text if a key is set. Anthropic with AI consent: today's and the last 7 days' totals, targets, supplements; meal-plan settings including allergies and dislikes; for "Ask AI about this food", the product data with goal, diet style, targets and filters |

### 4.6 Food photos and label photos

| | |
|---|---|
| Collected | A photo the member takes or picks. `src/app/(app)/nutrition/photo/page.tsx`, `nutrition/label/page.tsx` |
| Gate | Pro; `ai_data_consent_at` **and** `food_photo_consent_at` (`src/server/services/food-photo.ts:35-52`; `label-photo.ts:18`). Consent screen: `src/components/nutrition/food-photo-consent.tsx` |
| Stored | **Not stored.** The server resizes, strips metadata, sends once and discards (`src/app/api/ai/food-photo/route.ts:18`). Only the items the member confirms are saved to the diary. There is no bucket for food photos |
| Third parties | Anthropic receives the image |
| Retention | None at Narrow Gate. Anthropic's retention: not determinable from code |

### 4.7 Bodyweight and measurements

| | |
|---|---|
| Collected | Weight entries; waist, chest, hips, arm, thigh, body-fat percentage (typed by the member), notes |
| Gate | None |
| Stored | `weight_entries`, `measurement_entries` |
| Third parties | Supabase. Anthropic with AI consent: weights from the last 90 days and the trend. Measurements are not in the AI context |

### 4.8 Progress photos

| | |
|---|---|
| Collected | Photos with date, pose, optional weight and note |
| Gate | **No consent column.** A notice is shown in the upload dialog. Resized and re-encoded on the device, which removes location metadata (`src/lib/image-compress.ts:28`) |
| Stored | Private bucket `progress-photos` (8 MB limit, images only); rows in `progress_photos`. Shown through short-lived signed links |
| Third parties | Supabase only. Not sent to AI |
| Deletion | Per photo (`src/server/actions/progress-photos.ts:80`); all with the account |

### 4.9 Body Scan

| | |
|---|---|
| Collected | Front and side photos (rear optional), optional weight and tape measurements, note |
| Gate | Pro and `profiles.body_scan_consent_at`. Enforced in the database for rows **and** for file uploads (`can_add_body_scan()`, migration `20261024000031_body_scans.sql:12-23, 60, 69, 100`). Consent screen: `src/components/body-scan/consent-card.tsx:10-17` |
| Stored | Private bucket `body-scans`; `body_scans`, `body_scan_photos`; measurements go to the ordinary `measurement_entries` and `weight_entries` |
| Processing | **Storage and side-by-side display only.** No image analysis runs on the photos: no pose model, no landmarks, no template, no body-fat estimate (`docs/BODY_SCAN.md:19-21`). The on-screen "outline" is a fixed drawing (`src/components/body-scan/pose-outline.tsx`). A separate module `src/lib/form-analysis/` computes joint angles from pose keypoints for exercise form; it is marked not operational, is switched off and nothing in `src/app` imports it (`src/lib/form-analysis/index.ts:1-16`) |
| Third parties | Supabase only. Not sent to AI |
| Deletion | Per scan; "withdraw consent" deletes every scan and clears the timestamp (`src/server/actions/body-scan.ts:157-172`) |

### 4.10 Apple Health / Health Connect, sleep, recovery

| | |
|---|---|
| Collected | **Steps** (daily totals). **Sleep** sessions and stages. **Overnight heart rate, heart-rate variability, respiratory rate**, summarised per night, plus the device name. Manual sleep entries and timer. **Sleep check-ins**: restedness, energy, mood, stress, caffeine, alcohol, late meal, exercise timing, screens, disturbances, travel, sleep aid, notes. **Recovery check-ins**: sleep quality, energy, soreness, stress, notes, readiness score. Read only; nothing is written to the health platform (`src/lib/native-health.ts:67`; `src/lib/native-sleep.ts:15, 53`). Workouts are **not** imported from the health platform |
| Gate | Operating-system permission per data type. **Sleep** (sessions and check-ins): `profiles.wellness_consent_at`, enforced by the database policy `can_log_sleep()` on insert and update, and by the app (`src/server/actions/sleep.ts:53-61, 87`; `sleep-import.ts:120`). **Limitation notes**: database trigger `enforce_wellness_consent` on `onboarding_answers`. **Recovery check-ins**: checked in the app only (`src/server/actions/recovery.ts:20-25`); the database policy is owner-only with no consent check. **Steps**: operating-system permission only; no wellness consent |
| Stored | `daily_steps`, `sleep_sessions` (with `hr_*`, `hrv_*`, `rr_*`, `device_name`), `sleep_stages`, `sleep_checkins`, `sleep_import_runs`, `recovery_checkins`, sleep settings on `profiles` |
| Third parties | Supabase. Anthropic with AI consent: steps for 7 days; latest readiness score; on request a sleep summary (durations, stage shares, scores, heart rate, variability and breathing figures, device name, and associations drawn from check-in factors) and a recovery summary (`src/server/coach/sleep-summary.ts`; `src/server/coach/analysis.ts:40-56`). Free-text notes are not selected |
| Withdrawal | Withdrawing wellness consent deletes limitation notes and recovery check-ins. **Sleep data stays** until the member uses "delete imported" or "delete all" (`src/server/actions/profile.ts:60-73`; `sleep.ts:293`; `sleep-import.ts:339`). After withdrawal, sleep is no longer read for AI |

### 4.11 AI coaching

| | |
|---|---|
| Collected | Messages, conversation titles, proposals the coach makes and whether they were applied, coach style, memories |
| Gate | Pro; `ai_data_consent_at` (card: `src/components/coach/ai-consent-card.tsx`). Memory: `coach_memory_enabled` and `coach_memory_consent_at` (`src/server/actions/coach-memory.ts:21-27`); the insert policy requires memory to be on. A global `ai_coach` flag switches all AI off |
| Stored | `ai_conversations`, `ai_messages` (plain text), `coach_memories`, `ai_usage_events` (kind, model, token counts, cost; no content), `meal_plan_drafts`, `weekly_reports` |
| Encryption | Memory text is sealed with AES-256-GCM under `MEMORY_ENCRYPTION_KEY`, bound to the owner's account ID. In production the app refuses to store memories without the key (`src/server/crypto/memory-crypto.ts:5-30`). Conversations are not field-encrypted |
| Third parties | Anthropic: see section 6 |
| Retention | Until the member deletes a conversation (`src/server/actions/coach.ts:92`), a memory, or the account. Withdrawing AI consent stops sending and turns memory off; **past conversations and memories stay** (`profile.ts:75-95`) |

### 4.12 Prayer journal and Faith notes

| | |
|---|---|
| Collected | Journal entries (kind, title, body, scripture reference, answered note), Bible notes, discipline goals and check-ins |
| Gate | `profiles.faith_enabled` (a feature switch, not presented as consent). Per-entry `share_with_coach`, default off (`src/components/faith/faith-forms.tsx:48, 150`) |
| Stored | `faith_journal_entries`, `bible_notes`, `discipline_goals`, `discipline_checkins`. Plain text; not field-encrypted |
| Third parties | Supabase. Anthropic receives an excerpt of an entry **only if** that entry has `share_with_coach = true`, AI consent is given and faith features are on (`src/server/coach/snapshot.ts:182-191`). Bible notes are never read for AI |
| Admin access | None (no admin policy) |

### 4.13 Bible reading, journeys, highlights

| | |
|---|---|
| Collected | Reading position and history (book, chapter, date and time), highlights, bookmarks, memory verses, study progress, journeys and daily check-ins, 40-day challenge progress, Faith reminders, daily goals, Bible study questions to the AI helper |
| Gate | `faith_enabled`. AI helper: Pro and AI consent (`src/server/services/bible-ai.ts:87-93`) |
| Stored | `bible_reading_state`, `bible_reading_history`, `bible_highlights`, `bible_bookmarks`, `scripture_memory`, `bible_study_progress`, `faith_journeys`, `faith_journey_attempts`, `faith_journey_checkins`, `faith_daily_goals`, `faith_reminders`, `faith_reminder_prefs`, `challenge_enrollments`, `challenge_checkins`, `bible_ai_messages`, `bible_ai_usage` |
| Processing | A job every 15 minutes settles due journeys (`cron.job`: `faith-journeys-settle`) |
| Third parties | Supabase. Anthropic receives: Bible study questions and prior turns in that thread (`bible-ai.ts:127-136`); in the coach context, the 40-day challenge name and progress, and whether faith features are on |

### 4.14 Friends, accountability partners, planned challenges

See file 08. Both flags are off. Tables: `social_profiles`, `friend_requests`, `friendships`, `user_blocks`,
`user_reports`, `friend_invites`, `accountability_invites`, `accountability_partnerships`, `accountability_shares`,
`accountability_nudges`. Challenges between members and the activity feed are not built.

### 4.15 Subscriptions and billing

| | |
|---|---|
| Collected | Plan, price ID, status, period end, cancellation and revocation flags (Stripe); store, product, purchase and expiry dates, billing-issue and refund flags, sandbox flag, store transaction ID (RevenueCat) |
| Gate | Web checkout requires a ticked auto-renewal box; the agreed text, price and period are recorded in `legal_acceptances` (`src/server/actions/billing.ts:29, 49`). Store purchases use the store's own sheet; no app-side record |
| Stored | `billing_customers`, `subscriptions`, `store_subscriptions`, `user_entitlements`, `legacy_plan_terms`, `billing_state_versions`, `store_sync_state`, `stripe_events`, `revenuecat_events`, `sandbox_testers` |
| Third parties | Stripe, RevenueCat, Apple, Google (section 2). No card data reaches the app |
| Retention | Rows deleted with the account; webhook event IDs stay. Tax and accounting retention is undecided |

### 4.16 Notification devices and reminders

| | |
|---|---|
| Collected | Reminder choices and times; per device: a device key, platform, label, time zone, permission state, last sync |
| Stored | `notification_reminders`, `notification_prefs`, `notification_devices`, `faith_reminders`. **No push token**: reminders are local notifications scheduled on the phone (migration `20261103000055_notifications.sql:1-7`) |
| Third parties | Supabase only. No marketing notification type exists |

### 4.17 Activation events (first-party analytics)

| | |
|---|---|
| Collected | Four events per workout: started, first set completed, completed, abandoned; each with a timestamp and the workout's ID. Written by database triggers, not by the device |
| Stored | `activation_events` (migration `20261103000051`). Members can read their own; they are in the export |
| Processing | Admin dashboard shows aggregate counts through `admin_usage_metrics` and `admin_activation_metrics` (`src/app/(app)/admin/page.tsx:13-17`). Sandbox testers can be excluded |
| Third parties | None |

### 4.18 Logs and error monitoring

| | |
|---|---|
| Collected | Server: one JSON line per error with scope, error name, code, status, redacted message, and for some scopes an account ID or Stripe customer ID (`src/server/log.ts:9-23`). Browser: error kind, name, redacted message, path pattern, digest; **only if `ERROR_REPORTING=on`** (`src/app/api/client-errors/route.ts:27`) |
| Stored | The host's log stream. Not in the database |
| Third parties | The hosting provider. No log service is connected in code (`docs/ERROR_MONITORING.md:14-20`) |
| Retention | Set by the host; undecided |

### 4.19 Feature feedback

| | |
|---|---|
| Collected | Thumbs rating, optional comment up to 1,000 characters, "safety concern" flag on a coach reply |
| Gate | Flag `coach_feedback` is **off** |
| Stored | `ai_message_feedback` (migration `20261102000050`) |
| Third parties | None |

### 4.20 Legal acceptances

| | |
|---|---|
| Collected | Document (terms, privacy, risk acknowledgment, auto-renewal), version, SHA-256 of the text shown, source (sign-up, re-acceptance, checkout), details (for auto-renewal: plan, price, period), server time |
| Stored | `legal_acceptances`: append-only for members; time set by the database (migration `20261026000045`) |
| Not recorded | IP address, device, the "18 or older" box |
| Retention | **Deleted with the account** (`on delete cascade`). The proof of what a former member agreed to does not survive deletion |

### 4.21 Admin audit logs

| | |
|---|---|
| Collected | Admin's account ID, action, entity type and ID, details, time. Written for catalog edits, flag changes, sandbox-tester changes and report closures (`src/server/actions/admin.ts:31, 299, 311`) |
| Stored | `admin_audit_logs`. Admins can read. Not exported. `actor_id` is set to null if that admin is deleted |
| Not logged | Admin **reads** (subscriptions page, reports queue); anything done in the Supabase dashboard |

### 4.22 User reports

See file 08, F-05 and F-06. Free text; readable by all admins; no retention period; deleted with either account.

## 5. Sensitive categories

### 5.1 Health, fitness and body data

Bodyweight, measurements, body-fat percentage (self-entered), limitation notes, recovery and sleep check-ins
(including alcohol, stress, mood, sleep aids), sleep sessions and stages, overnight heart rate, heart-rate variability
and respiratory rate, steps, workouts, food diary, allergies and diet, supplements, goal weight. Consent mechanisms
that exist: `wellness_consent_at` (limitation notes, recovery check-ins, sleep), `ai_data_consent_at` (sending to
Anthropic), `food_photo_consent_at`, `body_scan_consent_at`. **No consent step exists for:** workouts, food diary,
bodyweight, measurements, steps, supplements, allergies. Each consent is one timestamp on the profile, set to null on
withdrawal: there is no history of consents, no record of the wording shown, and the member's own session can write the
column directly.

### 5.2 Precise location

GPS routes at about 1-metre precision, only during a recording the member starts. Stored with the account. Not sent
to AI or to a map provider by default. No geofencing, no location-based marketing, no location read outside a
recording (stated in code comments and `Info.plist:77-80`; not verified on a device).

### 5.3 Religious practice and belief

`faith_enabled`; prayer journal text; Bible notes, highlights, bookmarks, reading history with times, journeys,
memory verses, challenge progress, Faith reminders; Bible study questions; the "faith" reminder style; the `praying`
encouragement between partners. **Anthropic receives:** shared journal entries (per-entry opt-in), Bible study
questions, challenge progress, and an instruction block that differs depending on whether faith features are on
(`src/lib/coach/prompt.ts:54-59`). Turning on faith features is not presented as consent to process religious data.
The app's name and content are faith-based, so membership itself may indicate belief.

### 5.4 Photos of the body

Progress photos (no consent record) and Body Scan photos (consent record, database-enforced). Private buckets,
owner-only policies, signed links. Never sent to AI. No administrator policy; anyone with the service-role key or
dashboard access could open them.

### 5.5 Children

| Fact | Evidence |
|---|---|
| Sign-up requires ticking "I confirm I am 18 years of age or older" | `auth-forms.tsx:133-134`; `schemas.ts:39` |
| That tick is not stored | Not in `signupAcceptances()` (`versions.ts:39-45`) |
| Onboarding and profile forms reject an age under 18 | `schemas.ts:54, 93, 151`; `onboarding-questionnaire.tsx:268` |
| Age is self-declared; no date of birth, no verification | `onboarding.ts:35` stores `birth_year` only |
| The database accepts any `birth_year` from 1900 to 2100, and a member's own session may update it | `profiles_birth_year_check`; column grants |
| No under-13 handling: no neutral age screen, no blocking of a retry after an under-age answer, no parental-consent flow, no deletion routine for under-age accounts | No such code found |
| A person who enters an age under 18 at onboarding already has an account (email, name, password) | Sign-up precedes onboarding |
| The AI coach's instructions say not to coach anyone who says they are under 18. This depends on the person saying so and on the model following the instruction | `src/lib/coach/knowledge.ts:35` |

## 6. Exactly what is sent to Anthropic

All calls are made from the server with the owner's API key. Every call requires `ai_data_consent_at` and a Pro plan.

**A. Every AI Coach message** (`src/server/coach/snapshot.ts:136-290`; `src/lib/coach/context.ts:236-352`):
- today's date, units; age, sex, height, latest bodyweight;
- goal, experience, goal weight, chosen weekly pace, activity level; days per week, session length; equipment,
  preferred training types;
- limitation notes, only with wellness consent (`snapshot.ts:256`);
- diet type; calorie budget and saved targets; today's intake totals; 7-day averages;
- bodyweight trend (90 days of entries);
- active program with its days and exercises;
- adherence and streaks; last 10 workouts (top set per exercise, skip reasons); best lifts;
- 7 days of steps and the step goal; latest readiness score and date; supplement names;
- 40-day challenge name and progress;
- journal entries marked "Share with AI Coach" (date, kind, title, scripture reference, excerpt), only while faith
  features are on;
- coaching memories, only while memory is on;
- the member's coach-style choice; the conversation so far.

**B. On request by the model, through tools** (`src/lib/coach/tools.ts:159-349`; `src/server/coach/tools.ts`): more
workout and exercise history, a nutrition summary with food names, program weeks, a sleep summary, a running summary,
a recovery summary, lift analysis, and **titles and text of earlier conversations** not marked "memory off"
(`recall_conversations`, `src/server/coach/tools.ts:540-546`).

**C. Other AI features:** AI meal plan (targets, planner settings, allergies, dislikes, notes, dish list); meal photo;
**food-label photo**; "Ask AI about this food"; **Bible study helper** (question and thread history); **weekly
report** (the week's workout, nutrition, running, sleep and bodyweight figures; `src/server/services/weekly-reports.ts:135-150`),
which is generated by a scheduled call when configured (`src/app/api/reports/weekly/route.ts`), not by a member action.

**Not selected for AI by any code path read:** email address, display name, progress photos, Body Scan photos,
unshared journal entries, Bible notes and highlights, GPS routes, body measurements, payment data, free-text sleep
and recovery notes. The member can of course type anything into a message. A unit test exists for this
(`tests/unit/ai-context-privacy.test.ts`; not re-run).

**Not determinable from code:** Anthropic's retention period, whether a zero-retention arrangement applies, and the
contract terms on training.

## 7. Where the code differs from the Privacy Policy draft or the in-app privacy page

"Draft" = `docs/legal/PRIVACY_POLICY_DRAFT.md`. "In-app" = `src/app/legal/privacy/page.tsx`.

| # | The document says | The code does | Evidence |
|---|---|---|---|
| D1 | Draft :100: the database refuses to store limitation notes, recovery check-ins and sleep without wellness consent | True for limitation notes and sleep. **Recovery check-ins are gated in the app only**; the database policy has no consent check | Section 4.10 |
| D2 | Draft :47: Health platform data is read "only after you give wellness consent for sleep data" | Steps are imported on operating-system permission alone | `native-health.ts:67`; no consent check in `src/server/actions/steps.ts` |
| D3 | Draft :113-126 and the AI consent card list what is sent to AI | Not listed: **Bible study questions**, **weekly report** figures sent on a schedule, **food-label photos**, **40-day challenge progress**, **text of earlier conversations**, workout **skip reasons**, sleep check-in factors (caffeine, alcohol, stress and similar) inside the sleep summary, running summary | Section 6 |
| D4 | Draft :21, :71; in-app :49: "no … analytics trackers" | No third-party trackers: correct. A **first-party** activation-event table and an admin metrics dashboard exist and are not mentioned | Section 4.17 |
| D5 | Draft :71: no "crash-reporting SDKs" | Correct as to SDKs. An optional first-party browser error report to the app's own server exists (off by default) and is not mentioned | Section 4.18 |
| D6 | Draft :65, :151; in-app :45, :61: USDA receives food search text | Only if an API key is configured; otherwise search is local. The in-app page also says search text goes to Open Food Facts; **only barcodes do** | Section 2 |
| D7 | Draft §6 and in-app "Processors" list no video hosts | Exercise pages can embed YouTube (no-cookie) or Vimeo players, which receive the viewer's IP | `media.ts:19-29` |
| D8 | Draft :56: local data is "cleared on sign-out" | Draft clearing code exists (`src/lib/drafts.ts:89-117`); behaviour for every local item was **not verified** | — |
| D9 | Draft :40 lists faith content as devotional and challenge progress, reminders and journal entries | Also stored: Bible reading history with times, highlights, bookmarks, notes, memory verses, study progress, journeys, discipline goals and check-ins, Bible study questions and answers | Section 4.13 |
| D10 | Neither document mentions other members | Friends and Accountability (both off) share display name, username and workout figures; reports are read by administrators | File 08 |
| D11 | Draft :223: "no administrator access path to journals, photos or health records" | Correct for app admin policies. Admins do read member reports (free text), display names with subscription status, and can look accounts up by email. Service-role and dashboard access is outside the app | Section 3 |
| D12 | Draft :33-42 does not list | Legal acceptance records, notification device records, weekly reports, habit-program enrollments and check-ins, coach feedback (flag off), admin audit logs, sandbox-tester list | Section 4 |
| D13 | Draft :171: consent records "kept on your profile" | A single timestamp per consent, erased on withdrawal; no history. Legal acceptance records are deleted with the account | Sections 4.20, 5.1 |
| D14 | Draft :212: sign-up "requires you to confirm you are 18+" | True, but the confirmation is not recorded | Section 5.5 |
| D15 | In-app :36: "no AI analyses them" (photos) is said of progress and Body Scan photos | Correct. Body Scan consent card says photos are never sent "to any other company or service"; they are stored at Supabase, a company | `consent-card.tsx:14` |
| D16 | In-app page is an outline with bracketed blanks and no retention, children, security, breach, or state-rights sections | The draft has them; the in-app page is what members accept | File 07 |
| D17 | Draft :163: deleted runs keep "distance and time" | They also keep date, time zone, notes and effort | Section 4.4 |
| D18 | Draft :176: export contains "your data" | Exclusions in section 3 and file 08 F-11 are not described | Section 3 |

## 8. Facts relevant to specific laws (topics for counsel; no conclusions)

**FTC Act section 5 (deception, unfairness).**
- Statements members see today that depend on the facts above: "Our team and admins can't view them" (Body Scan
  card); "never visible to administrators" (onboarding, `onboarding-wizard.tsx:415`); "We do not use advertising or
  analytics trackers" (in-app policy); the AI consent list (D3); "They aren't told" (blocks, file 08 F-03).
- Security statements in the draft (:216-223) and what backs them: section 3.
- The in-app documents are labelled placeholders while sign-up records acceptance of them.

**FTC Health Breach Notification Rule.**
- The app holds identifiable health information from the member and from Apple Health / Health Connect (4.10).
- It discloses some of it to Anthropic on consent, and (flags off) workout figures to other members.
- No incident-response procedure, breach log or notification template exists in the repository.
- No monitoring that would detect unauthorised access was found beyond server error logs.

**Washington My Health My Data Act; Nevada SB 370.**
- No separate consumer-health-data privacy policy exists; the draft notes the need (:203).
- Consent to **collect** exists only for the wellness subset, Body Scan and food photos; not for workouts, weight,
  measurements, food, steps (5.1).
- Consent to **share**: `ai_data_consent_at` covers Anthropic as a whole, not per category. Friends and
  Accountability share workout figures by default once connected (file 08 F-07).
- No signed authorisation flow and no sale of data in code.
- **Geofencing:** none. Location is used only for run recording; no location-triggered messaging.
- No state or residency is collected, so the app cannot tell which members are in Washington or Nevada.

**California CCPA/CPRA; other state privacy laws.**
- Sensitive categories present: health, precise geolocation, religious belief, account credentials, contents of
  messages to the AI. Possibly sex.
- No sale, no cross-context advertising, no third-party trackers in code.
- Rights tooling: export, delete, per-consent withdrawal, item deletion. No "limit use of sensitive information"
  control as such, no appeal process, no authorised-agent process, no request log.
- Member counts and revenue (for thresholds) are business facts not in the repository.
- Contracts with processors: not in the repository.

**COPPA.** Section 5.5. Also: the app's content (fitness, Scripture) is general-audience; nothing is directed to
children in code; no mechanism detects or removes under-13 accounts.

**CAN-SPAM.**
- Only two emails are sent, both by Supabase Auth: confirm sign-up and reset password.
- No marketing email, newsletter, list or unsubscribe mechanism exists.
- The templates contain no postal address (`supabase/templates/`; not read line by line).
- The production sender and mail provider are not configured in the repository.

**Auto-renewal: ROSCA, state laws, FTC "click-to-cancel" rule.** (The current legal status of the FTC rule is for
counsel to confirm; it is not stated here.)
- Web: price on the plan card; an unticked box with the text "I agree that Pro All Access renews automatically at
  {price} per {period} until I cancel, and that I can cancel any time in Manage billing"; the tick is required and
  recorded with price and period (`versions.ts:28-36`; `billing.ts:29, 49`; `billing-buttons.tsx:29-30`).
- Renewal terms shown under the plans for web, iOS and Android (`src/lib/billing/paywall.ts:93-99`).
- Cancellation: web through the Stripe customer portal ("Manage billing"); stores through Apple or Google. "How to
  cancel" section on the billing page (`profile/billing/page.tsx:214-230`).
- Restore purchases and Manage subscription buttons exist in the app and on the web.
- **Not present:** an acknowledgment email from the app after purchase; renewal reminders; a record of consent for
  store purchases; a refund policy (undecided); free trials (none in code; Stripe promotion codes are allowed,
  `billing.ts:205`).
- The auto-renewal consent record is deleted with the account (4.20).
- One sentence on the billing page reads as if deleting the app cancels a web subscription (file 07, I-3).

**Apple HealthKit and Google Health Connect rules.**
- Read-only; types: steps, sleep, heart rate, heart-rate variability, respiratory rate.
- Stored on Supabase; a summary can go to Anthropic with AI consent (4.10, 6).
- Not used for advertising; no advertising code exists.
- Planned: steps from the health platform as a score in challenges between members (file 08, section 9).
- `ios/App/App/PrivacyInfo.xcprivacy` declares no tracking and nine collected data types, all for app
  functionality. It was not compared line by line with the App Store answers.

**Biometric laws (Illinois BIPA and similar) and Body Scan.**
- The Body Scan code **stores photographs and typed measurements. It does not derive a face template, body
  template, scan of face or hand geometry, or any other identifier from the photos.** No image-analysis library is
  in `package.json`.
- Full-body photos include the face unless the member crops it.
- The unused form-analysis module works on pose keypoints, not identity, and is not connected to any screen.
- Meal and label photos go to Anthropic for content recognition; they are not of a person by design.

**Data-breach notification (state laws).**
- Data elements held: email and password hash (at Supabase Auth), name, health and fitness data, precise location,
  religious content, photos. No government ID, no card numbers.
- No state of residence is collected.
- No written procedure in the repository.

**International users and GDPR.**
- No geo-restriction in code: no country check at sign-up, in middleware or at checkout.
- The app supports metric units and every time zone, and cites European food-safety sources in food ratings.
- App Store and Google Play territory selection is an owner setting outside the repository.
- No GDPR elements exist: no legal-basis statements, no representative, no transfer mechanism, no cookie notice.
- Hosting regions for Supabase, the web host and Anthropic are not stated in the repository.

## 9. Could not be verified

- Any hosted environment: actual processors, regions, mail provider, log retention, backups, which environment
  variables are set (`USDA_API_KEY`, `NEXT_PUBLIC_MAP_TILE_URL`, `ERROR_REPORTING`, `MEMORY_ENCRYPTION_KEY`,
  `LEGAL_REACCEPT_REQUIRED`).
- Contracts and data-processing terms with Supabase, Anthropic, Stripe, RevenueCat, the host.
- Anthropic's retention and training terms.
- App Store privacy answers and Google Play Data safety form as submitted.
- Behaviour on a physical device: when location is actually read, what is cleared on sign-out, what ML Kit sends.
- The isolation, deletion and export test suites were read, not re-run (except the Friends test).
- `src/components/friends/friends-panels.tsx`, the email templates and several long components were searched, not
  read line by line.
- Line references were taken from the files on this branch today; a few rows cite a file without a line where the
  line was not individually checked.
