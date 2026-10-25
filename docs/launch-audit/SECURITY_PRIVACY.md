# Security, privacy and compliance review

Read-only sweep of `claude/testflight-prep` (commit `c541d63`) on 2026-10-25: all 38 migrations, every API route and server action, the AI services and prompts, storage, account export/deletion, native configs, legal pages, the privacy manifest and dependencies. Earlier audits (`docs/SECURITY.md`, `docs/APP_AUDIT.md`) were re-verified against current code rather than trusted. **Fixes marked "done" are on `claude/launch-audit`.**

Not claimed: compliance with HIPAA (the app is not a covered entity or business associate on these facts), the FTC Health Breach Notification Rule, GDPR or Apple's HealthKit policies. Each needs counsel's analysis; the facts they need are in the inventory (§M) and the legal gap list (§L).

## A. Findings

### Confirmed defects

| # | Severity | Finding | Evidence | Failure scenario | Fix | Status |
|---|---|---|---|---|---|---|
| S-1 | High | The AI data-sharing consent (the Apple 5.1.2(i) gate) did not list the Apple Health / Health Connect sleep records and overnight heart rate, HRV and respiratory rate that the coach sends to Anthropic through `get_sleep_summary`, nor what "Ask AI about this food" sends | consent list `src/components/coach/ai-consent-card.tsx:37-45`; tool `src/server/coach/tools.ts:516-518`, `src/server/coach/sleep-summary.ts:44-63`, `:91-113`; food explain `src/server/actions/food-quality.ts:60-74` | A member who connected Apple Health was never told their watch's readings can go to the AI provider; the consent, privacy policy and Apple HealthKit disclosure all rested on an incomplete list | Two bullets added to the consent card; privacy draft updated | **Done** |
| S-2 | High | `docs/LEGAL_REQUIREMENTS.md`, the inventory counsel drafts from, said "there is no GPS tracking", "Not collected: location", health data = steps only, nothing about Body Scan or meal photos | `docs/LEGAL_REQUIREMENTS.md:29`, `:32-35`, `:52` (before) | A privacy policy written from it would be materially false | Document corrected from the inventory below | **Done** |
| S-3 | Medium | Legal pages are placeholders with concrete missing disclosures (GPS, HealthKit vitals, body-scan and meal photos, what the AI receives, Open Food Facts as a processor, retention, contact) | `src/app/legal/privacy/page.tsx`, `terms/page.tsx` | App Store 5.1.1(i) rejection; inaccurate notice | Facts added to the privacy draft; counsel placeholders kept; gap list in §L | **Partly done (counsel)** |
| S-4 | Medium | "Deleting" a run kept its GPS route forever: `deleteActivityAction` only set `deleted_at`; no code hard-deletes; the export returned the route. Follow-up check (2026-10-25): every app read filters `deleted_at is null` (`src/server/services/activities.ts:30,40,68`, `activity-summary.ts`, calendar and nutrition pages), so the only paths that could return a deleted row's route were the export (`select *`) and the owner's own REST access | `src/server/actions/activities.ts:168-186` (before); export `src/server/services/account.ts:98` | A member deletes a run from home; the track stays and reappears in their export | Soft delete now nulls `route`, `splits`, `gps_quality`; migration `20261025000043_deleted_activities_no_route.sql` strips them from rows deleted earlier (irreversible for those rows; apply to a live database only with the owner's approval) and adds check constraint `activities_deleted_no_route` so no deleted row can carry a route by any path; integration test added | **Done** |
| S-5 | Medium | An unfinished GPS recording (raw fixes) stayed in WebView/browser `localStorage` after sign-out; `clearAllDrafts` only removed `ngf.draft.*` keys. Follow-up check: the immediate clean-up ran in the sign-out form's `onSubmit`, while the recorder (still mounted until the page changed) could persist one more fix about a second later | `src/components/run/gps-recorder.tsx:106`, `:147`; `src/lib/drafts.ts:81-85` (before); `src/components/shell/app-shell.tsx:134` | Shared device: the next person could read the previous person's route | `clearAllDrafts` also removes `run.recording.<user>`; the sign-out leaves a per-tab marker (`markDeviceCleanup`) and the login page runs the clean-up again after the recorder is gone (`src/components/platform/device-cleanup.tsx`); account deletion lands on `/?deleted=1` whose `ForgetDeviceData` clears every draft and recording on the device. The new e2e test also found that the profile page's own "Sign out" form never cleared anything (only the tab bar's did); both now use one `SignOutForm` (`src/components/shell/sign-out-form.tsx`). Recovery for a member who stays signed in is unchanged (reload/crash → "Continue recording"). Unit tests (`drafts`, `device-cleanup`) and e2e tests (sign-out during a walk from the profile page; reload while signed in, continue, discard) added | **Done** |
| S-6 | Low | `public.plan_of(uuid)` is `SECURITY DEFINER`, takes any user id, and was executable by `authenticated` through PostgREST RPC | `supabase/migrations/20261023000024_plan_enforcement.sql:12-23`, `:60-61` | Any member could read another member's plan by id (ids are not public, so impact is low) | Migration `20261025000042_plan_of_private.sql` revokes execute; integration test added | **Done** |
| S-7 | Low | `GET /api/account/export` had no rate limit and reads ~60 tables plus signed-URL batches | `src/app/api/account/export/route.ts:10-22` (before) | A script could hammer the database with full exports | 3 per hour per member, `Retry-After` header; unit test `tests/unit/export-route.test.ts` | **Done** |
| S-8 | Low | Android `allowBackup="true"`: WebView storage and cookies can be swept into device/cloud backups | `android/app/src/main/AndroidManifest.xml:4` | Drafts/GPS recording in a cloud backup | `allowBackup="false"` plus `backup_rules.xml` (API ≤ 30) and `data_extraction_rules.xml` (API 31+, cloud backup and device-to-device transfer) | **Done in PR #4** (`claude/android-hardening`; compiled by the APK workflow, not run on a device) |
| S-9 | Low | The Health Connect plugin's manifest declares read and write permissions for all 47 data types; the app reads only steps, sleep, HR, HRV, RR; Play requires justification per declared health permission | `node_modules/@capgo/capacitor-health/android/src/main/AndroidManifest.xml`; `src/lib/native-health.ts:67`, `native-sleep.ts:53` | Play health-declaration friction; over-broad permission surface | 43 unused permissions removed from the merged manifest with `tools:node="remove"` (the five read permissions the app uses stay) | **Done in PR #4** |
| S-10 | Low | The product-explanation prompt injected Open Food Facts name/brand/ingredient text (publicly editable) with no "data, not instructions" guard | `src/lib/food-quality-ai.ts:15-25`, `:62-66` | An edited OFF record could steer the wording of one product's explanation (output is schema-constrained and clipped, so impact is limited) | Guard sentence added to the instructions; unit test asserts it stays | **Done** |

### Observations (no demonstrated failure)

- **O1 Prompt injection surface.** Tool results embed user strings (workout names, meal items, shared journal excerpts, memories) raw in JSON; mitigation is instruction-level (`src/lib/coach/knowledge.ts:38`, `:193`). Blast radius is small: all tools are read-only, each `propose_*` returns a card requiring Confirm and is re-validated server-side (`src/server/actions/coach.ts:109-200`), one proposal per reply, memories need Save, journal text can never become a memory, health terms refused as memories (`src/lib/coach/memory.ts:100-138`), tool inputs are Zod-validated, model refusals handled. Future hardening: delimit tool-result strings.
- **O2** Sleep caps skip when `auth.uid()` is null (service-role inserts); no service-role code writes sleep tables today.
- **O3** Tracked `android/app/capacitor.build.gradle` lacked the background-geolocation, keyboard and RevenueCat plugins (iOS has them) — regenerated with `cap sync android` in PR #4.
- **O4** CSP keeps `'unsafe-inline'` scripts and `img-src https:` (known in `docs/SECURITY.md`).
- **O5** `/api/health` returns the git commit unauthenticated (information only).
- **O6** In-memory rate limiter is per server instance; AI paths are DB-backed (`reserve_ai_usage`), others are not.
- **O7** Admins have no policies on personal tables; the only service-role admin read is plan/status + display name. Journals, photos and health rows are unreachable to admins (verified).
- **O8** `.env.local` holds local demo JWTs only; no live keys anywhere (`sk_live`, `rk_live`, `AKIA`, `-----BEGIN`, `appl_`, `goog_` searched).
- **O9** The generated `ios/App/App/capacitor.config.json` is untracked and must be re-synced with `CAP_SERVER_URL` before archiving (the config refuses placeholders).
- **O10** RevenueCat app user id = account id; the RevenueCat customer is deleted on account deletion.
- **O11** Recovery check-ins are consent-gated in the action but not in RLS (limitation notes are DB-enforced); only the member can insert their own rows, so no third-party harm.

## B. Row Level Security

RLS is enabled on all 72 tables created in `supabase/migrations` (enforced by `tests/unit/rls-coverage.test.ts:39-42`); no views; every policy on a personal table keys on `(select auth.uid())`; `true` policies exist only on four public-catalog tables; anonymous policies only on the catalog. Every function pins `search_path`. "own" = `user_id = auth.uid()`.

| Table(s) | Migration | Select | Insert | Update | Delete | Notes |
|---|---|---|---|---|---|---|
| profiles | 0002:117-125 | own (`id`) | none | own, column-granted | none | `role` not updatable |
| onboarding_answers, fitness_goals, workout_sessions, personal_records, weight_entries, measurement_entries, recovery_checkins, meals, nutrition_goals, water_entries, ai_conversations, faith_journal_entries, discipline_goals | 0002:130-145 | own | own | own | own | |
| user_programs | 0002 + 0024:70-72 | own | own AND `can_use_program` | own | own | plan tier in DB |
| workout_exercises / workout_sets / meal_items | 0002:154-197 | own | own + parent own | own + parent | own | |
| ai_messages | 0002:199-209, 0025:63-71 | own | own, `role='user'`, parent own | `proposal_status` only | own | assistant rows via service role |
| discipline_checkins | 0002:211-219 | own | own + parent | none | own | |
| ai_usage_events | 0002:222-223 | own | none | none | none | service role writes |
| exercises | 0002:228-231 | anon+auth: published or admin | admin | admin | admin | catalog |
| exercise_alternatives, exercise_media, program_categories, feature_flags, content_items | 0002:233-307 | anon+auth (`true` / published) | admin | admin | admin | public catalog |
| training_programs, program_weeks, program_days, program_exercises | 0002:248-275, 0024:65-87 | published/owner/admin; `can_view_program`; exercises need `can_use_program` | owner by source + plan; `can_edit_program` | `can_edit_program` | `can_edit_program` | prescriptions paywalled in DB |
| foods | 0002:285-297, 0004:9-14 | auth: curated or own | own (custom/usda/off) or admin | own/admin | own/admin | not anon-readable |
| billing_customers, subscriptions, user_entitlements, legacy_plan_terms, store_subscriptions | 0002:312-317, 0022, 0023 | own | none | none | none | service role only |
| stripe_events, revenuecat_events | 0002:318, 0023:44-45 | none | none | none | none | RLS on, no policies |
| admin_audit_logs | 0002:321-322 | `is_admin()` | service role | none | none | |
| progress_photos | …02:20-29 | own | own (path must start with uid) | own | own | |
| challenge_enrollments / challenge_checkins | …03:39-63 | own | own (+ parent) | own | own | |
| supplement_stack, supplement_logs, daily_steps | …06:40-69 | own | own | own | own | |
| activities | 0010:55-64 | own | own | own | own | routes private; soft delete now strips the route |
| food_favorites, nutrition_day_marks | 0011, 0012 | own | own | own | own | |
| recipes, recipe_ingredients, meal_plan_settings, meal_plans, meal_plan_entries, grocery_lists, grocery_items | 0012:159-199 + 0024:89-100 | own | own AND `has_plan('plus')` | own | own | |
| workout_templates(+_exercises) | 0013:59-82 | own | own (free-limit trigger) | own | own | |
| faith_reminders, planned_session_overrides | 0020:85-108 (+0024) | own | own (+Plus) | own | own | |
| coach_memories, exercise_targets, training_adjustments, training_recommendation_decisions | 0026:62-85, 0027:55-77 | own | own + `has_ai_coach()` | own (limited columns) | own | |
| meal_plan_drafts | 0028:30-33 | own | none | none | own | service role writes |
| running_goals | 0029:30-34 | own | own (limit trigger) | own | own | |
| body_scans / body_scan_photos | 0031:55-71 | own | own + `can_add_body_scan()` (Pro + consent) | none | own | photo path `<uid>/<scan>/…` |
| sleep_sessions, sleep_stages, sleep_checkins, sleep_import_runs | 0034:97-119, 0035:38-45, 0036:24-29 | own | own + `can_log_sleep()` (wellness consent) | own (sessions, check-ins) | own | |

Functions reviewed (`SECURITY DEFINER`): `is_admin`, `can_view_program`, `can_edit_program`, `program_of_week/day`, `admin_usage_metrics` (admin-checked, counts only), `handle_new_user`, `enforce_wellness_consent`, `plan_of` (fixed), `has_plan`, `can_use_program`, `enforce_free_template_limit`, `reserve_ai_usage` (service role only), `has_ai_coach`, limit triggers, `can_add_body_scan`, `can_log_sleep`. **No table with anonymous access holds personal data.**

## C. Storage buckets

| Bucket | Public | Limits | Policies | Path | Signed URL | Deletion |
|---|---|---|---|---|---|---|
| avatars | private | 2 MB, png/jpeg/webp | own folder | `<uid>/…` | — | emptied at account deletion |
| exercise-media | public | 50 MB, images + mp4/webm | read all; admin writes | `<slug>/…` | — | admin |
| progress-photos | private | 8 MB, jpeg/png/webp | own folder | `<uid>/…` (DB check) | 600 s (3600 s in export) | per-photo; account deletion |
| body-scans | private | 8 MB | own folder; insert needs `can_add_body_scan()`; no update | `<uid>/<scan>/<pose>` | 600 s | per-scan, withdraw-all, account deletion |
| meal photos | no bucket | 5 MB, magic-byte check | — | in memory only | — | never stored |

Uploads go straight to Supabase Storage with the member's session after a canvas re-encode that strips EXIF/GPS (`src/lib/image-compress.ts:26-29`).

## D. API routes and server actions

| Route | Auth | Service role | Validation | Rate limit |
|---|---|---|---|---|
| `GET /api/health` | none (by design) | no | — | — |
| `GET /api/account/export` | cookie session | no (RLS) | — | 3/hour (this branch) |
| `POST /api/ai/chat`, `/api/ai/food-photo` | bearer or cookie + same-origin | metering only | Zod; photo size/sniff | in-memory + DB (`reserve_ai_usage`); photos 20/24 h |
| `GET /api/foods/barcode`, `/search` | cookie | no | code/query bounds | 30/min, 90/min |
| `POST /api/revenuecat/webhook` | shared secret (constant-time) | yes | Zod; 256 KB cap; idempotent; re-fetches subscriber | — |
| `POST /api/stripe/webhook` | Stripe signature | yes | SDK; idempotent | — |
| `GET /api/v1/me`, `/programs`, `/workouts` | bearer/cookie | no | Zod | none |

All 39 server-action files call `requireUser` / `requireOnboardedUser` / `requireAdmin` first and validate input with Zod; the service role appears only in the admin audit log and account deletion. Auth actions give generic responses; redirects go through `safeNextPath`.

## E. Account deletion and export

Deletion (Profile → Privacy & data): typed `DELETE` + password re-check (5 tries / 15 min) → cancel Stripe subscriptions (abort on failure) → empty `avatars`, `progress-photos`, `body-scans` → `auth.admin.deleteUser` (every user-linked column is `on delete cascade`, enforced by `tests/unit/account-coverage.test.ts`) → delete Stripe customer and RevenueCat subscriber (best effort, logged). Export: `GET /api/account/export` returns every owned table (61) with 1-hour links to photos; uses the member's own session. Partial withdrawals exist for wellness notes, AI sharing, Body Scan, meal photos, imported sleep, all sleep, memories.

## F. AI provider data flows (Anthropic)

Models: `claude-haiku-5-5` (fast) and `claude-sonnet-5-5` (smart) by default (`src/lib/coach/routing.ts:15`). Callers: coach chat/plan, AI meal plan, meal photo, product explanation — all behind `ai_data_consent_at` and Pro entitlement. Per turn the coach receives: age, sex, height, bodyweight trend, goals, schedule, equipment, diet, budget/targets, recent food totals, program week, adherence, last 10 workouts, PRs, 7-day steps, latest readiness score, supplements, challenge progress, limitation notes if wellness consent, journal entries only where shared, memories only if enabled, prior turns (≤ 24k chars). On demand via tools: full workout/food history, program week, **sleep summary incl. stages, overnight HR/HRV/RR and device name**. Photos: meal photos only, in memory. No prompt/response logging; messages stored in `ai_messages` until the member deletes them.

## G. Secrets, logging, dependencies

Only `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` reach the client; `@/server/env` is `server-only`. No hard-coded keys; the Stripe live-key guard and RevenueCat sandbox flags are tested. **No analytics, crash or tracking SDK** in `src`, `package.json` or the native projects; `PrivacyInfo.xcprivacy` declares no tracking. Server logs carry error names/codes and ids, never emails, health values, journal text or tokens. SDKs handling personal data: RevenueCat (purchases, account id), `@capgo/capacitor-health` (HealthKit/Health Connect read), background geolocation, barcode scanner (camera; ML Kit on Android), Supabase, Stripe, Anthropic.

## L. Legal pages: remaining gaps for counsel

Privacy draft (facts now present; still needs): date, contact details, "how we use it" wording, DPA list, retention periods (AI messages, metering, webhook event ids, server logs), international transfers (Supabase/Vercel/Anthropic regions), children/18+ statement, CCPA "no sale" and rights, breach-notice statement, Google ML Kit (Android barcode) mention, signed-link mechanism for photos. Terms draft: date, refund and consumer-law terms incl. App Store/Play, acceptable use, limitation of liability, GPS/wearable "estimates, not medical" wording, AI allowance terms, Apple EULA choice. `PrivacyInfo.xcprivacy` is accurate; the App Store Connect privacy answers must match it (Email, Name, Fitness, Health, Other User Content, Purchase History, User ID, Precise Location, Photos — all linked, none for tracking).

## M. Data-flow inventory

| Data category | Collected where | Stored | Processed by | Retention / deletion |
|---|---|---|---|---|
| Account (email, password hash, display name, avatar) | sign-up, profile | Supabase Auth, `profiles`, `avatars` | Supabase; Stripe customer (email); RevenueCat (account id) | until account deletion |
| Training profile (age, sex, height, goals, equipment, diet) | onboarding | `profiles`, `onboarding_answers` | Supabase; Anthropic each coach turn (after consent) | account lifetime, editable |
| Limitation notes (health) | onboarding/profile with wellness consent (DB trigger) | `onboarding_answers.limitations` | Anthropic if consented | deleted on consent withdrawal |
| Workouts, PRs, programs, templates | logger, builder | `workout_*`, `personal_records`, `training_programs`, … | Supabase; Anthropic (last 10 + tools) | account lifetime; member delete |
| Food diary, recipes, plans, favourites, filters | nutrition UI; barcode → Open Food Facts; search → USDA | `meals`, `meal_items`, `foods` (cache), `recipes`, `meal_plan*`, `profiles.food_filters` | Supabase; OFF (barcode); USDA (query); Anthropic (totals, item names, product facts + filters) | account lifetime |
| Meal photos | photo page, separate consent | **not stored** | Anthropic (one request) | discarded |
| Bodyweight, measurements | progress UI, Body Scan | `weight_entries`, `measurement_entries`, `body_scans` | Anthropic (trend) | account lifetime |
| Progress photos, Body Scan photos | device upload (EXIF stripped) | private buckets + rows | Supabase only | per-photo/scan; account deletion |
| Steps | manual or Apple Health / Health Connect | `daily_steps` (daily totals) | Anthropic (7-day average) | account lifetime |
| Sleep sessions, stages, overnight HR/HRV/RR, device name | timer/manual or health platform (wellness consent) | `sleep_sessions`, `sleep_stages`, `sleep_import_runs` | Anthropic only via `get_sleep_summary` | per entry, imported-only, all, account deletion |
| Recovery and sleep check-ins (incl. free text) | wellness consent | `recovery_checkins`, `sleep_checkins` | readiness score to Anthropic; free text never sent | wellness withdrawal / delete-all |
| GPS routes | run recorder (foreground/background) | device `localStorage` while recording (cleared on sign-out, this branch); `activities.route/splits/gps_quality` | Supabase only | removed on delete (this branch); account deletion |
| Faith journal, practices, reminders | faith UI | `faith_journal_entries`, `discipline_*`, `faith_reminders` | Anthropic only for entries marked share | member delete; account deletion |
| AI conversations, proposals, memories, meal-plan drafts | coach UI | `ai_conversations`, `ai_messages`, `coach_memories`, `meal_plan_drafts` | Anthropic (history ≤ 24k chars; memories ≤ 50) | conversation/memory delete; account deletion |
| AI usage metering | server | `ai_usage_events` (kind, model, tokens) | Supabase | account deletion |
| Billing status | Stripe / RevenueCat webhooks | `billing_customers`, `subscriptions`, `store_subscriptions`, `user_entitlements`, `legacy_plan_terms`, event tables | Stripe, RevenueCat, Apple/Google | event ids kept (no personal data); rest cascades |
| Admin audit | admin actions | `admin_audit_logs` | Supabase | actor nulled on admin deletion |
| Device local data | drafts, GPS recording, UI prefs | `localStorage` | device only | cleared on sign-out |

## N. Compliance notes for counsel (facts, not conclusions)

- **FTC Health Breach Notification Rule (as amended 2024):** the app holds sleep, heart-rate-derived and self-reported wellness data from consumers and is not HIPAA-covered; the amended rule reaches health apps and treats unauthorised disclosures as breaches. Counsel should assess applicability and set an incident procedure (notice to individuals/FTC within the rule's timelines). Sources: https://www.venable.com/insights/publications/2024/07/final-changes-to-health-breach-notification , https://jonesday.com/en/insights/2024/07/ftc-issues-final-health-breach-notification-rule .
- **Apple HealthKit (5.1.3):** read-only; not used for advertising or sold; shared with Anthropic only as a coach summary after consent — now disclosed in the consent card and privacy draft.
- **Google Play Health Content and Services / Health Connect:** applies when an Android build is submitted; see APPLE_COMPLIANCE.md "Google Play".
- **Open Food Facts (ODbL):** product data is displayed with a link to the source record; counsel to confirm attribution wording.
