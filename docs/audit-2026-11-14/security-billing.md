# Security, privacy, billing and entitlement audit (2026-11-14)

Branch `claude/pro-premium` at `9240ca2`, audited in a separate worktree. Fixes are in commit `7dffa8e` on the worktree
branch (not pushed, not merged). Earlier audit documents (`docs/SECURITY.md`, `docs/audit/1-security-auth.md`,
`docs/launch-audit/SECURITY_PRIVACY.md`, `docs/FULL_APP_AUDIT.md`, `docs/MOBILE_BILLING.md`, `docs/MEMBERSHIPS.md`)
were treated as claims and re-checked against the code and the running local database.

**Result in one paragraph.** No Critical or High defect was found. Row-level isolation, storage isolation and the
server-side Pro gates held up under a fresh check of the live catalog and the existing integration tests. Four defects
were fixed, each with a regression test seen failing before the fix: two Medium (unlimited image decoding for any
signed-in account; an account with an open Stripe subscription could be deleted while the subscription kept
charging) and two Low (a late `invoice.paid` event restored a refunded period; checkout and billing portal had no
rate limit). Twelve items are open: one Medium that depends on production Supabase settings and cannot be checked
here, the rest Low or informational. No committed secret was found in the working tree or in 749 commits of history.
`npm audit --omit=dev` reports 0 advisories.

Two corrections to the brief: the app has **15** API route handlers under `src/app/api` (not 18), plus 3 route
handlers outside it; and the worktree was created at an older commit (`aad49a1`) and was moved to `9240ca2` before any
work.

## 1. Findings

Line numbers are at `9240ca2` unless marked "now", which is the line after the fix in `7dffa8e`.

### Fixed in this audit

| # | Severity | Where | Problem | User impact | Fix | How verified |
|---|---|---|---|---|---|---|
| F1 | Medium | `src/app/api/ai/food-photo/route.ts:26-49`, `src/app/api/ai/label-photo/route.ts:26-48` | The upload (up to 5 MB) was buffered and decoded and re-encoded with sharp (up to 40 megapixels) before the plan, consent or any rate limit was looked at. The plan was read only after the decode. | Any signed-in account, Free included, could make the server do this work as often as it liked: CPU and memory exhaustion of the server functions, at no cost to the caller. Sign-up is open, so this needed no paid account. | New `src/server/services/ai-photo-guard.ts`: both routes now read the plan and refuse with 403 `not_entitled` when the plan has no AI allowance, and apply a per-member limit of 12 uploads a minute (429 with `Retry-After`), before the body is read (now `food-photo/route.ts:28-37`, `label-photo/route.ts:28-37`). No allowance was changed: analyses are still counted and capped where they were. | `tests/integration/ai-photo-upload-guard.test.ts` (4 tests) against the local database with real sessions: before the fix a Free member's undecodable upload got 415 (it was parsed and decoded) and the 13th upload in a minute got 415; after, 403 and 429. `tests/unit/ai-routes-plan.test.ts` gained a case asserting `request.formData()` is never called for a Free member (seen failing with 415 against the old routes). |
| F2 | Medium | `src/server/services/billing.ts:558-559` | `cancelStripeSubscriptionsForUser` returned at once when the Stripe key was empty. `src/server/env.ts:19-24` empties the key when it is unset, when a live key is not approved (`STRIPE_LIVE_APPROVED`), and in demo mode. Account deletion then carried on. | On such a deployment a paying member who deleted their account was told it was deleted while their Stripe subscription kept renewing. The customer link and subscription rows cascade away with the account, so nothing was left to trace the charges by. | The step now looks at the member's records first: an open subscription on record throws `StripeUnavailableError`, which stops the deletion at the billing stage with the existing "nothing was deleted" message; a member with nothing open is deleted as before, and a Stripe customer that can't be removed is logged with its id (now `billing.ts:583-638`). | `tests/integration/account-deletion-billing.test.ts` (4 tests) against the local database. Before the fix `deleteUserAccount` returned `{ ok: true }` for a member with an `active` subscription row; after, `{ ok: false, stage: "billing" }` and the account, subscription and rows are intact. Members with no billing record or only an ended subscription are still deleted. |
| F3 | Low | `src/server/services/billing.ts:441` | After a full refund or a dispute ended a period's access, **any** `invoice.paid` for the subscription with a different invoice id restored it. Stripe delivers events in any order and retries failed deliveries for up to three days, so the payment of an earlier invoice can arrive after a later invoice was refunded. | A refunded or disputed member could get Pro back without paying for a new period. It needs two invoices close together (for example subscribe, then switch to yearly, then refund) and a delayed delivery, so it is unlikely, but nothing prevented it. | `invoiceIsNewerThan` compares Stripe's own `created` time of the paid invoice with that of the refunded one; an invoice that is not newer no longer clears the revocation. When either time can't be read the invoice counts as newer, so a paying member is never left without access over a missing field (now `billing.ts:439-443`, `526-545`). | New case in `tests/integration/entitlements.test.ts` ("a late invoice.paid for an earlier invoice can't restore a refunded period; a newer paid invoice does"): before the fix the plan read `pro` after the late event; after, `free`, and a newer paid invoice restores `pro`. The 12 existing cases in the file still pass. |
| F4 | Low | `src/server/actions/billing.ts:16`, `:58` | `startCheckoutAction` and `openBillingPortalAction` had no rate limit. Each checkout makes four or more Stripe API calls with the account's secret key and inserts a `legal_acceptances` row. | One signed-in account running a script could use up the Stripe request allowance that the webhooks also need (they read subscriptions from Stripe), delaying everyone's plan updates, and grow the consent table without bound. | 10 per 10 minutes per member on each action, checked after form validation and before any Stripe call or consent record (now `actions/billing.ts:35`, `:70`). | `tests/unit/checkout-rate-limit.test.ts` (4 tests): before the fix a refused limiter still redirected to Stripe; after, the action returns an error and neither the price read, the consent record nor the session creation is called. |

### Open: reported, not changed

| # | Severity | Where | Problem | User impact | Proposed fix | Status |
|---|---|---|---|---|---|---|
| O1 | Medium (availability) | `supabase/config.toml:200`, `:208`; `src/server/actions/auth.ts:21-26` | Sign-in, sign-up, confirmation resend and password reset all run in server actions, so Supabase Auth sees the app server's addresses, not the member's. Supabase's own per-address limits (`sign_in_sign_ups = 30` per 5 minutes, `email_sent = 2` per hour in the local config) then apply to all members together. The code comment acknowledges this; no document says what the production project is set to. | At launch, more than about 30 sign-ins and sign-ups in five minutes through one server address would be refused with "Too many attempts", and confirmation or reset emails would stop after the hourly cap. | In the production Supabase dashboard: raise the sign-up/sign-in and token limits to launch volume, configure custom SMTP and its hourly email limit, and consider forwarding the client address if the project supports it. Then load-test sign-in from the deployed server. | **Not verifiable here** (production configuration). Owner action. |
| O2 | Low | `src/lib/supabase/server.ts:11`, `src/lib/supabase/middleware.ts:48`, `src/lib/supabase/client.ts:8` | Session cookies use the `@supabase/ssr` defaults: `SameSite=Lax`, 400 days, no `Secure`, no `HttpOnly`. `HttpOnly` cannot be set while the browser client uploads photos straight to storage. `Secure` simply isn't set. | Mitigated by HSTS (`src/lib/security-headers.ts:78`, two years, sub-domains) on an https deployment. Without `Secure`, a first plain-http request to the host before HSTS is cached could carry the tokens. | Pass `cookieOptions: { secure: true }` to all three clients when the request is https (`x-forwarded-proto` on the server, `location.protocol` in the browser), then run the sign-in e2e specs and a device check. | Not changed: it touches sign-in for every member and could not be exercised end to end here (no browser run allowed on this machine). |
| O3 | Low | `src/server/rate-limit.ts:71-75`, `src/server/actions/demo.ts:35`, `src/server/actions/auth.ts:35-38`, `:70` | The client address is the first entry of `X-Forwarded-For`. Vercel overwrites that header, so it is trustworthy there. On a host that appends instead, the caller chooses it. Sign-up is limited per address only, and with no address header there is no app-level limit at all. | Off Vercel, the per-address limits on sign-in, sign-up, email sending and error reports can be sidestepped by sending a different header each time. Per-email ceilings (100 sign-ins per 15 minutes, 30 emails per hour) and Supabase's own limits still apply. | Decide the hosting platform; if it is not Vercel, read the platform's trusted header (or the last proxy hop) in `clientIp()`. | Not changed: depends on the host. Verified by reading the code. |
| O4 | Low | `src/lib/demo/mode.ts:12`, `src/server/test-overrides.ts:35` | "Production" means `VERCEL_ENV=production` or `STRIPE_LIVE_APPROVED=true`. A production deployment on another host, or one that sells only through the App Store, matches neither. There, `DEMO_MODE=true`, `REVENUECAT_ALLOW_SANDBOX=true`, `REVENUECAT_ALLOW_TEST_STORE=true` and `AUTH_RATE_LIMIT_SCALE` would be honoured. | With `DEMO_MODE=true` on such a server anyone could start a demo account and switch it to Pro; with `REVENUECAT_ALLOW_SANDBOX=true` free sandbox purchases would unlock Pro. Both need the wrong variable to be set as well. | Add one explicit switch (for example `APP_ENV=production`) to `isProductionDeployment` and `demoModeOn`, or confirm in writing that production is always Vercel's production environment. | Owner decision (which hosts count as production). On Vercel production the guard works: `tests/unit/demo-mode-guard.test.ts` and `free-user-direct-actions.test.ts` ("the demo Free/Pro switch does nothing when DEMO_MODE is not set") pass. |
| O5 | Low | `src/server/flags.ts:12`, `:18` | `isFlagEnabled` treats a missing flag, and a failed read of the flags table, as enabled. The kill switches read this way: `signups`, `ai_coach`, `ai_plan_generation`, `food_search`. | If the flags can't be read, a switch the owner turned off behaves as on. The AI money limits are separate and fail closed, so the exposure is sign-ups staying open and AI staying available during a database problem. | Use `isFlagOn` semantics (off when unknown) for the switches the owner uses as brakes, or cache the last good read. | Not changed: it alters behaviour on a fresh database. Verified by reading the code. |
| O6 | Low | `supabase/migrations/20261017000002_progress_photos.sql:39-41` | The progress-photos bucket limits type and size (8 MB) but not how many objects a member may store. Body scans are capped (200); progress photos are not. | One account could fill storage at the project's cost. No other member's data is exposed. | A per-member object cap in the storage insert policy, as body scans have. Needs a migration. | Not changed (a migration for a Low finding was out of bounds). Confirmed in the live policy list. |
| O7 | Low | `src/server/actions/auth.ts:66-95`, `src/server/auth.ts:36` | The age, Terms and risk boxes and the `signups` pause are enforced in the app's sign-up action. The public key lets anyone call Supabase Auth's sign-up directly, which skips both. The app only insists on an acceptance record when `LEGAL_REACCEPT_REQUIRED=true`. | An account created that way has no record of accepting the Terms or confirming age, and a paused sign-up can be bypassed. | Require a current acceptance record before the app opens (send members without one to `/legal/accept`), independent of the re-acceptance switch; pause sign-ups in the Supabase dashboard as well when needed. | Not changed (changes what members see). Verified by reading the code; not executed. |
| O8 | Low (operational) | `src/server/services/billing.ts:439-443` (now) | A full refund ends access but leaves the Stripe subscription running (by design, `billing.ts:499-503`). If the member then changes plan in the billing portal, the resulting invoice (often $0 after proration credit) is a newer paid invoice and restores access. | A refunded member who is left subscribed can regain Pro without a new payment. | Owner procedure: cancel the subscription in Stripe when refunding in full. A code rule ("a $0 update invoice doesn't restore access") was considered and left out: it could also withhold access from a member whose renewal was covered by credit. | Not changed. Reasoned from the code; not executed. |
| O9 | Low | `src/server/services/image-prep.ts:20-26`; `package.json` (no `sharp` entry) | `sharp` is not a direct dependency; it is present as an optional dependency of Next.js (0.35.5 in the lockfile). If it is missing on a host, photos go to the AI provider as uploaded: no metadata stripping, no pixel limit. | On such a host a photo sent by a client that skips the app's own resize would reach the AI provider with its location metadata. | Add `sharp` as a direct dependency, or refuse photos when it can't be loaded. | Not changed (no installs allowed in this audit). On this machine sharp loads; the decode tests pass. |
| O10 | Info | `src/server/actions/admin-sandbox-testers.ts:40-43`; `admin_audit_logs` | Audit entries for the sandbox tester list keep the member's user id in `entity_id` after that member deletes their account. | A bare identifier of a deleted account stays in the admin audit trail. No personal content. | Decide whether the audit trail should keep it; if not, null it on deletion. | Not changed. Confirmed in the live schema (`entity_id` is not a foreign key). |
| O11 | Info | `src/lib/security-headers.ts:46`, `:49`, `:78` | CSP allows inline styles and images from any https origin; HSTS has no `preload`. Scripts are nonce-based with `strict-dynamic`, no `unsafe-inline`. | None demonstrated. | Optional tightening after launch. | Known from earlier audits; re-read, unchanged. |
| O12 | Info | `package-lock.json` (dev tree) | `npm audit` over all dependencies reports 15 advisories: 1 critical (`tar`), 3 high (`@capacitor/assets`, `@capacitor/cli`, the copy of `sharp` 0.32.6 nested under `@capacitor/assets`), 11 moderate. All are build and lint tooling. | Not reachable in production: `npm audit --omit=dev` reports 0. The `sharp` the server loads is the top-level 0.35.5, which the advisory does not cover. The affected tools run on a developer machine or CI over the project's own icons and archives. | Upgrade `@capacitor/assets` and `@capacitor/cli` when convenient. | Reported, not upgraded, as instructed. |

## 2. Row-level isolation

Checked on the running local database with `psql` (catalog queries, not the migration text):

- **106** tables in `public`; row level security is **on for all 106**. No views or materialized views. 325 policies in `public`, 13 on storage objects.
- **9** tables have RLS on and no policy, so only the service role reaches them: `ai_budget_alerts`,
  `ai_budget_months`, `billing_state_versions`, `legal_document_versions`, `rate_limit_counters`, `revenuecat_events`,
  `sandbox_testers`, `store_sync_state`, `stripe_events`.
- Policies with `using (true)`: four, all `SELECT` on public catalog tables (`exercise_alternatives`,
  `exercise_media`, `feature_flags`, `program_categories`). Policies open to `anon`: ten, all `SELECT` on the
  catalog (`content_items`, `exercises`, `training_programs`, `program_weeks`, `program_days`, `program_exercises`
  and the four above), each limited to published rows or by `can_view_program` / `can_use_program`.
- The 16 policies that mention neither `auth.uid()` nor `is_admin()` are all **restrictive** plan checks
  (`has_plan('plus')`, starter-program checks, `can_use_program`) that sit on top of an owner policy; none is
  permissive on its own.
- `profiles`: members may update only listed columns (column grants); `role`, `id`, `created_at`, `updated_at` are
  read-only to them. `user_entitlements`, `subscriptions`, `store_subscriptions`, `billing_customers`,
  `legacy_plan_terms`, `ai_usage_events`, `legal_acceptances` are `SELECT`-only for members.
- **91** tables reference `auth.users` or `profiles`; **87** are in the export and deletion list
  (`USER_TABLES`, `src/server/services/account.ts`) and the other **4** are the documented exclusions. All 91 cascade
  on delete except `admin_audit_logs.actor_id` and `sandbox_testers.added_by`, which are set to null.
- **SECURITY DEFINER functions: 61** (16 of them trigger functions), every one with a fixed `search_path`. Twenty
  non-trigger functions are executable by the service role only. Those callable by members identify the caller with
  `auth.uid()` (or refuse non-admins inside: `admin_usage_metrics`, `admin_activation_metrics`). Trigger functions
  are not callable through the API. `tests/integration/api-function-surface.test.ts` now pins the callable set (15
  for visitors, 34 for members) and calls each service-only function as a member and as a visitor, expecting
  `42501`.
- Neither `anon` nor `authenticated` can create objects in `public`.
- **Storage:** four buckets. `avatars` (private, 2 MB), `progress-photos` (private, 8 MB) and `body-scans` (private,
  8 MB, Pro and consent checked on insert) accept JPEG, PNG and WebP only and are limited to the member's own
  `<user id>/` folder for select, insert, update and delete. `exercise-media` is public to read and admin-only to
  write. There is no food-photo bucket: meal and label photos are held in memory for one request and never stored.
  Private images are shown through signed links (10 minutes; 60 minutes in an export).

### Table by table

Generated from the live catalog. "Policies" is the number of policies; "Commands" the commands they cover.

| Table | RLS | Policies | Commands | Who can reach rows |
|---|---|---|---|---|
| `accountability_invites` | on | 3 | DELETE,INSERT,SELECT | Owner only (`= auth.uid()`) |
| `accountability_nudges` | on | 1 | SELECT | Members of the partnership only (reads); writes through checked functions |
| `accountability_partnerships` | on | 1 | SELECT | Members of the partnership only (reads); writes through checked functions |
| `accountability_shares` | on | 2 | SELECT,UPDATE | Members of the partnership only (reads); writes through checked functions |
| `activation_events` | on | 1 | SELECT | Owner reads own rows; written only by the server (service role) or by checked database functions |
| `activities` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `admin_audit_logs` | on | 1 | SELECT | Admins read; written by the service role only |
| `ai_budget_alerts` | on | 0 | none | Service role only: no policy, so members and visitors read and write nothing |
| `ai_budget_months` | on | 0 | none | Service role only: no policy, so members and visitors read and write nothing |
| `ai_conversations` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `ai_message_feedback` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `ai_messages` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `ai_usage_events` | on | 1 | SELECT | Owner reads own rows; written only by the server (service role) or by checked database functions |
| `bible_ai_messages` | on | 2 | DELETE,SELECT | Owner only (`= auth.uid()`) |
| `bible_ai_usage` | on | 1 | SELECT | Owner reads own rows; written only by the server (service role) or by checked database functions |
| `bible_bookmarks` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `bible_highlights` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `bible_notes` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `bible_reading_history` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `bible_reading_state` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `bible_study_progress` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `billing_customers` | on | 1 | SELECT | Owner reads own rows; written only by the server (service role) or by checked database functions |
| `billing_state_versions` | on | 0 | none | Service role only: no policy, so members and visitors read and write nothing |
| `body_scan_photos` | on | 3 | DELETE,INSERT,SELECT | Owner only (`= auth.uid()`) |
| `body_scans` | on | 3 | DELETE,INSERT,SELECT | Owner only (`= auth.uid()`) |
| `challenge_checkins` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `challenge_enrollments` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `coach_memories` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `content_items` | on | 2 | ALL,SELECT | Public catalog: published rows readable by anyone; own or admin rows otherwise; writes owner/admin |
| `daily_steps` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `discipline_checkins` | on | 3 | DELETE,INSERT,SELECT | Owner only (`= auth.uid()`) |
| `discipline_goals` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `exercise_alternatives` | on | 2 | ALL,SELECT | Public catalog: anyone reads (`using (true)`), only admins write |
| `exercise_media` | on | 2 | ALL,SELECT | Public catalog: anyone reads (`using (true)`), only admins write |
| `exercise_targets` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `exercises` | on | 2 | ALL,SELECT | Public catalog: published rows readable by anyone; own or admin rows otherwise; writes owner/admin |
| `faith_daily_goals` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `faith_journal_entries` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `faith_journey_attempts` | on | 1 | SELECT | Owner reads own rows; written only by the server (service role) or by checked database functions |
| `faith_journey_checkins` | on | 1 | SELECT | Owner reads own rows; written only by the server (service role) or by checked database functions |
| `faith_journeys` | on | 1 | SELECT | Owner reads own rows; written only by the server (service role) or by checked database functions |
| `faith_reminder_prefs` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `faith_reminders` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `feature_flags` | on | 2 | ALL,SELECT | Public catalog: anyone reads (`using (true)`), only admins write |
| `fitness_goals` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `food_favorites` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `foods` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Own rows; shared catalog rows (`owner_id is null`) readable by signed-in members, written by admins |
| `grocery_items` | on | 5 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) plus a restrictive plan check on writes |
| `grocery_lists` | on | 5 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) plus a restrictive plan check on writes |
| `habit_program_checkins` | on | 3 | DELETE,INSERT,SELECT | Owner only (`= auth.uid()`) |
| `habit_program_enrollments` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `legacy_plan_terms` | on | 1 | SELECT | Owner reads own rows; written only by the server (service role) or by checked database functions |
| `legal_acceptances` | on | 1 | SELECT | Owner reads own rows; written only by the server (service role) or by checked database functions |
| `legal_document_versions` | on | 0 | none | Service role only: no policy, so members and visitors read and write nothing |
| `meal_items` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `meal_plan_drafts` | on | 2 | DELETE,SELECT | Owner only (`= auth.uid()`) |
| `meal_plan_entries` | on | 5 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) plus a restrictive plan check on writes |
| `meal_plan_settings` | on | 5 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) plus a restrictive plan check on writes |
| `meal_plans` | on | 5 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) plus a restrictive plan check on writes |
| `meals` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `measurement_entries` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `notification_devices` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `notification_prefs` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `notification_reminders` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `nutrition_day_marks` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `nutrition_goals` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `onboarding_answers` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `personal_records` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `planned_session_overrides` | on | 6 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) plus a restrictive plan check on writes |
| `profiles` | on | 2 | SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `program_categories` | on | 2 | ALL,SELECT | Public catalog: anyone reads (`using (true)`), only admins write |
| `program_days` | on | 4 | ALL,INSERT,SELECT,UPDATE | Public catalog: published rows readable by anyone; own or admin rows otherwise; writes owner/admin |
| `program_exercises` | on | 4 | ALL,INSERT,SELECT,UPDATE | Public catalog: published rows readable by anyone; own or admin rows otherwise; writes owner/admin |
| `program_weeks` | on | 4 | ALL,INSERT,SELECT,UPDATE | Public catalog: published rows readable by anyone; own or admin rows otherwise; writes owner/admin |
| `progress_photos` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `rate_limit_counters` | on | 0 | none | Service role only: no policy, so members and visitors read and write nothing |
| `recipe_ingredients` | on | 5 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) plus a restrictive plan check on writes |
| `recipes` | on | 5 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) plus a restrictive plan check on writes |
| `recovery_checkins` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `revenuecat_events` | on | 0 | none | Service role only: no policy, so members and visitors read and write nothing |
| `running_goals` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `sandbox_testers` | on | 0 | none | Service role only: no policy, so members and visitors read and write nothing |
| `scripture_memory` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `sleep_checkins` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `sleep_import_runs` | on | 3 | DELETE,INSERT,SELECT | Owner only (`= auth.uid()`) |
| `sleep_sessions` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `sleep_stages` | on | 3 | DELETE,INSERT,SELECT | Owner only (`= auth.uid()`) |
| `store_subscriptions` | on | 1 | SELECT | Owner reads own rows; written only by the server (service role) or by checked database functions |
| `store_sync_state` | on | 0 | none | Service role only: no policy, so members and visitors read and write nothing |
| `stripe_events` | on | 0 | none | Service role only: no policy, so members and visitors read and write nothing |
| `subscriptions` | on | 1 | SELECT | Owner reads own rows; written only by the server (service role) or by checked database functions |
| `supplement_logs` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `supplement_stack` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `training_adjustments` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `training_programs` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Public catalog: published rows readable by anyone; own or admin rows otherwise; writes owner/admin |
| `training_recommendation_decisions` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `user_entitlements` | on | 1 | SELECT | Owner reads own rows; written only by the server (service role) or by checked database functions |
| `user_programs` | on | 5 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) plus a restrictive plan check on writes |
| `water_entries` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `weekly_reports` | on | 3 | DELETE,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `weight_entries` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `workout_exercises` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `workout_sessions` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `workout_sets` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `workout_template_exercises` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |
| `workout_templates` | on | 4 | DELETE,INSERT,SELECT,UPDATE | Owner only (`= auth.uid()`) |

## 3. Cross-user access tests

`tests/integration/cross-user-isolation.test.ts` seeds one member with a row in every one of the 87 user-owned
tables and a file in every private bucket, then has a second member, an admin and an anonymous visitor try to read,
change, delete, re-own, spoof and attach to them through the public API. That covers every category in the brief:

| Data | Tables and buckets probed | Result |
|---|---|---|
| Workouts | `workout_sessions`, `workout_exercises`, `workout_sets`, `personal_records`, `workout_templates` | No read or write by another member |
| Food logs | `meals`, `meal_items`, `foods`, `water_entries`, `recipes`, `meal_plans`, `grocery_lists` and children | Same |
| Prayer journal and faith | `faith_journal_entries`, `bible_notes`, `bible_highlights`, `scripture_memory`, `faith_journeys` and children | Same |
| Progress photos and body scans | `progress_photos`, `body_scans`, `body_scan_photos`; buckets `progress-photos`, `body-scans`, `avatars` (list, sign, download, replace, plant, delete) | Same |
| Health and sleep | `sleep_sessions`, `sleep_stages`, `sleep_checkins`, `recovery_checkins`, `daily_steps`, `weight_entries`, `measurement_entries` | Same |
| GPS routes | `activities` (route stored on the row), `running_goals` | Same |
| AI memory and conversations | `coach_memories`, `ai_conversations`, `ai_messages`, `ai_message_feedback`, `bible_ai_messages` | Same |

It passed here (15 tests in that file, part of the 134 below). Added in this audit:
`tests/integration/api-function-surface.test.ts`, because the existing test called only 7 of the 20 service-only
functions and accepted any error; the new one covers all 20 and requires `42501`. It passed on first run, so it
found no defect; it is a guard for later migrations.

## 4. API routes and server actions

### Route handlers (15 under `src/app/api`, 3 elsewhere)

| Route | Authentication | Authorisation | Input validation | Rate limit |
|---|---|---|---|---|
| `GET /api/account/export` | Cookie session (`getCurrentUser`) | Own rows only, read with the member's session under RLS | None needed (no input) | 3 per hour per member |
| `POST /api/ai/chat` | Bearer token or cookie; cookie requests must be same-origin | Plan read from `user_entitlements` through the authenticating session; AI allowance, consent and budgets in `coachTurn` | Zod (`aiChatRequestSchema`) | AI burst limit and monthly allowance, in the database |
| `POST /api/ai/food-photo` | Bearer or cookie, same-origin | Plan and upload limit **before the body is read** (F1), then consent, allowance, 20 photos a day | Length header required, 5 MB cap, magic-byte sniff, decode and re-encode, 40 MP cap | 12 uploads a minute (new), then the AI limits |
| `POST /api/ai/label-photo` | Same | Same | Same | Same |
| `GET, POST /api/billing/reconcile` | `Authorization: Bearer $CRON_SECRET`, constant-time; refuses when the secret is unset or shorter than 16 characters | Service role inside; reply holds counts only | None needed | None (secret required) |
| `POST /api/client-errors` | None (public by design; off unless `ERROR_REPORTING=on`) | Writes one redacted log line; always answers 204 | Zod, 4 KB cap, redacted again on the server | 30 per 10 minutes per address (see O3) |
| `GET /api/foods/barcode` | Cookie session | `nutrition_tracking` feature (Free has it) | Code and format bounded | 30 a minute per member |
| `GET /api/foods/search` | Cookie session | Same | Query capped at 80 characters; category and offset bounded | 90 a minute per member |
| `GET /api/health` | None (public) | Returns the app name and commit only | None | None |
| `GET, POST /api/reports/weekly` | `CRON_SECRET`, as reconcile | Service role inside; counts only | None needed | None (secret required) |
| `POST /api/revenuecat/webhook` | Configured `Authorization` value, constant-time; 503 when not configured | Event body never trusted: affected members are re-read from RevenueCat | Zod, 256 KB cap | None (authorised callers only) |
| `POST /api/stripe/webhook` | Stripe signature over the raw body; 503 when not configured | Customer-to-member link recorded by this server is authoritative; metadata is only a hint | Signature, 512 KB cap, shape check | None (signed callers only) |
| `GET /api/v1/me` | Bearer or cookie | Own profile and plan | None needed | None |
| `GET /api/v1/programs` | Bearer or cookie | Published catalog with a `locked` flag from the server-side plan | None needed | None |
| `GET, POST /api/v1/workouts` | Bearer or cookie; `POST` same-origin for cookies | Own rows under RLS | Zod (`finishWorkoutSchema`); `limit` clamped 1 to 100 | None (own rows only; idempotent by client id) |
| `GET /auth/callback` | Exchanges a one-time code | `next` passed through `safeNextPath` | Provider error text never shown | Supabase |
| `GET /auth/confirm` | Verifies a token hash; only `signup`, `recovery`, `email` types | `next` through `safeNextPath` | Type allow-list | Supabase |
| `GET /home/today-workout` | Cookie session | Own data | None needed | None |

No route takes a user id or a plan from the request. `tests/integration/free-user-direct-actions.test.ts` ("a plan
claimed in cookies, the request body or the member's own metadata changes nothing") and `pro-bypass.test.ts` pass.

**Open redirects:** `safeNextPath` (`src/lib/safe-redirect.ts`) is used by sign-in, both auth routes and the
middleware. It accepts only single-slash same-site paths and rejects backslashes, control characters and paths that
resolve to `//host`. No open redirect found.

### Server actions (214 exported actions in 52 files under `src/server/actions`)

Every action was listed with a script and the files without a visible auth call were read by hand.

- **206** call `requireUser`, `requireOnboardedUser` or `requireAdmin`: directly, through a file-local helper
  (`ctx`, `nutritionCtx`, `sleepCtx`, `stepsCtx`, `context`, `parse`, `signedInAndOn`, `requireFaithUser`,
  `loadAccessibleProgram`), or by delegating to an action that does (two form wrappers in `bible.ts`).
- **7** are public by design: `signUpAction`, `signInAction`, `resendConfirmationAction`,
  `requestPasswordResetAction` (all rate-limited per address and per email), `signOutAction`, and `enterDemoAction` /
  `startFreshDemoAction`, which do nothing unless demo mode is on (see O4). `updatePasswordAction` checks the session
  itself (`auth.getUser()`).
- All 14 admin actions call `requireAdmin`; every admin page does too. Writes there go through the admin's own
  session, so the database's `is_admin()` policies are a second check.
- The service role is used in 18 files. In each, the user id comes from the session (or from an admin-only form, or
  from a verified webhook), never from member input.
- Every action that takes input parses it with Zod, except a few that take a single boolean or a fixed enum checked
  by hand.

**Account export** returns the 87 tables, the structure of programs the member built, and signed links to their
photos; coaching memories are decrypted for the member. Verified by the existing test ("the data export returns the
member's rows from every table, and nothing of anyone else's").

**Account deletion** needs the word DELETE and the password (5 tries per 15 minutes). Order: read the Stripe
customer, cancel Stripe subscriptions (now also refused when Stripe can't be used, F2), remove files from the three
private buckets, delete the auth user (all 91 user-linked tables cascade or are nulled), then delete the Stripe
customer and the RevenueCat customer. Verified by the existing tests (every row in every table and every file gone,
the old access token and refresh token dead) and the new F2 test. App Store and Google Play subscriptions cannot be
cancelled by the server; the member must cancel them in their store settings, and the app says so (not re-checked on
a device).

## 5. Entitlements

The plan is read from `user_entitlements` only, which members can read but not write. It is written by
`apply_entitlement` (service role), from stored Stripe and store subscription rows. No client flag is consulted.

| Pro feature | Server-side gate | Database gate | Refusal tested |
|---|---|---|---|
| AI coach, plan generation | `assertAiAllowed` in `src/server/services/ai-coach.ts:143-150` | `reserve_ai_usage` (service only); `has_ai_coach()` on memory and adaptive-training tables | `pro-bypass`, `ai-route-limits`, `entitlements` |
| AI meal photo and label photo | `refusePhotoUpload` (new), then `withAiRequest` | Same | `ai-photo-upload-guard` (new), `ai-route-limits` |
| AI meal plan, product explanation, Bible study helper | `assertFeature` / `withAiRequest` / `bibleAiBlocked` | Same | `free-user-direct-actions`, `bible-ai-helper` |
| Live GPS recording | `src/server/actions/gps-activities.ts:55` | Trigger `enforce_live_gps_plan` on `activities` | `free-user-direct-actions`, `gps-running` |
| Full program library | `loadAccessibleProgram` in `src/server/actions/programs.ts:16-21` | Restrictive `user_programs_visible_program`; `can_use_program` on `program_exercises`; trigger `check_user_program_change` | `plan-enforcement`, `pro-programs` |
| Program builder | `src/server/actions/custom-programs.ts:25` | `training_programs_insert` needs `has_plan`; source locked by trigger | `pro-bypass`, `free-user-direct-actions` |
| Habit programs | `src/server/actions/habit-programs.ts:28` | Plan check on enrolment | `pro-programs` |
| Unlimited saved workouts | `src/server/actions/templates.ts:34` | Trigger `enforce_free_template_limit` | `plan-enforcement`, `free-user-direct-actions` |
| Calendar rescheduling | `src/server/actions/calendar.ts:26`, `:76` | Restrictive plan policies on `planned_session_overrides` | `free-user-direct-actions` |
| Recipes, meal planner, grocery | `assertFeature(…, "meal_planning")` in four action files | Restrictive `has_plan('plus')` on six tables | `plan-enforcement`, `free-user-direct-actions` |
| Food filters and comparisons | `src/server/actions/food-quality.ts:22` | None (a preference only) | `free-user-direct-actions` |
| Strength ranks | `src/server/actions/body-map.ts:17` | None (a preference only) | `free-user-direct-actions` |
| Body Scan | `canUseBodyScan` in `src/server/actions/body-scan.ts` | `can_add_body_scan()` on rows and on the bucket | `body-scans`, `free-user-direct-actions` |
| Sleep analytics, sleep AI coaching | Computed in server pages that return the locked screen for Free (for example `progress/sleep/debt/page.tsx:22`) | None needed: there is no action or API that returns the analysis | Read in code; not executed |
| Weekly reports | Created only by the scheduled job for Pro members (`src/server/services/weekly-reports.ts`) | Members cannot insert reports | `weekly-reports` |

**Demo plan switch.** `setDemoPlanAction` needs demo mode on **and** an account marked `app_metadata.demo` (only
the service role can set that). Demo mode is refused when `VERCEL_ENV=production` or `STRIPE_LIVE_APPROVED=true`.
It is unreachable on Vercel production; see O4 for other hosts.

**Ambiguities to decide (nothing was changed):** a member who drops to Free can still open weekly reports that were
created while they were Pro (`progress/reports/[week]/page.tsx:55-60` has no plan check); Plus (legacy) keeps live
GPS and the paid toolkit without AI, as `docs/MEMBERSHIPS.md` says. Prices in code are $17.99 and $119.99
(`src/lib/domain/plans.ts:108`), unchanged.

## 6. Webhooks

| Topic | Stripe | RevenueCat |
|---|---|---|
| Authenticity | Signature over the raw body, 5-minute tolerance (SDK default) | Configured `Authorization` value, constant-time compare |
| Replay and duplicates | Event id claimed in `stripe_events`; a second delivery is "duplicate", a concurrent one gets 409 | Same in `revenuecat_events` |
| Failed processing | Recorded as `failed`, answered 500, retried by Stripe; a dead worker's lease expires after 120 s | Same |
| Out-of-order events | The subscription is re-read from Stripe on every event and written only if the read is newer (`upsert_stripe_subscription`); revocation ordering fixed in F3 | The whole customer is re-read from RevenueCat; an older snapshot can't replace a newer one (`apply_store_snapshot`) |
| Refunds and disputes | Full refund or dispute of the current period ends access; partial refund doesn't; a won dispute restores it | `refunded_at` ends access at the refund time |
| Expiry, grace, billing issue | `past_due` keeps access for at most 14 days from the start of the unpaid period; `canceled`, `unpaid`, `paused`, `incomplete` give nothing | Access lasts to the later of expiry and the store's grace period; a billing issue inside it reads as `past_due` |
| Transfer and alias | Not applicable; a subscription is never moved to another member (ownership conflict is refused) | Every id in `app_user_id`, `original_app_user_id`, `aliases`, `transferred_from`, `transferred_to` that is one of our members is re-read; anonymous ids are skipped |
| Sandbox purchases | Live keys are ignored until `STRIPE_LIVE_APPROVED=true` | Counted only for allow-listed accounts, or on a non-production deployment with `REVENUECAT_ALLOW_SANDBOX=true` (O4) |
| Account deletion with an active subscription | Cancelled first; deletion stops if that fails (F2). A later event about the deleted member finds no member and changes nothing | The RevenueCat customer is deleted; the store subscription itself keeps billing until the member cancels it in their store settings |
| Safety net | `/api/billing/reconcile` re-reads the stalest open subscriptions and reports failed or stuck events | Same job |

All of this is exercised by `entitlements`, `billing-integrity`, `store-billing` and `subscription-lifecycle`
(55 tests, passing), against local stand-ins for the Stripe and RevenueCat APIs. Nothing reached the real services.

## 7. Secrets and logging

- **Working tree:** the only tracked environment file is `.env.example` (placeholders). `.gitignore` excludes
  `.env*`, signing keys, keystores and service-account files.
- **History:** all 749 commits on every branch were scanned for Stripe live and test keys, webhook secrets, Anthropic
  keys, AWS keys, private-key blocks, GitHub tokens, Slack tokens, Google API keys, JWTs, Supabase secret keys and
  RevenueCat keys. Two matches, both the Google-API-key pattern inside `standalone/index.html` at commits `3d99eb8`
  and `cc6d36c`. Each sits inside a run of more than 400 base64 characters (an embedded image): a false positive,
  not a key. The current file has no match. **No credential needs rotating on this evidence.**
- **Public variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`,
  `NEXT_PUBLIC_ERROR_REPORTING` and three map-tile settings. None is a secret. `src/server/env.ts` and
  `src/lib/supabase/server.ts` import `server-only`; no client component imports them (client components import
  server actions only).
- **Logging:** all server logging goes through `logError` / `logInfo` (`src/server/log.ts`), which write the error
  name, code, status and a scrubbed message (emails, ids, tokens, quoted text and long numbers removed). No call
  passes an email, token, journal text, health value or request body as context. Webhook failures store only an
  error class and code. The four direct `console` calls log fixed text or an error digest.
- The tests use the local Supabase CLI's published demo keys, which are not secrets.

## 8. Rate limiting, uploads and images

| Surface | Limit | Notes |
|---|---|---|
| Sign-in | 20 per 5 min per address; 10 per 15 min per email and address; 100 per 15 min per email | Shared across instances (`rate_limit_hit` in Postgres) |
| Sign-up | 5 per 10 min per address | Per address only (O3) |
| Confirmation resend, password reset | 5 per 15 min per address; 3 per 15 min per email and address; 30 per hour per email | Same answer whether or not the account exists |
| Password update | 10 per 15 min per member | |
| Account deletion | 5 per 15 min per member | Password re-checked |
| AI chat and other AI requests | Burst limit per minute, monthly allowance, in-flight cap, member and global budgets | Reserved in the database before the provider is called |
| AI photo uploads | 12 per minute per member **(new)**, then 20 analyses a day | |
| Food search / barcode | 90 / 30 per minute per member | |
| Export | 3 per hour per member | |
| Store purchase sync | 10 per minute per member | |
| Checkout, billing portal | 10 per 10 minutes per member **(new)** | |
| `/api/v1/*` | None | Own rows only |

If the shared limiter can't reach the database it falls back to a per-instance counter (weaker, never open).

Uploads: AI photos are checked for length, size, magic bytes, a 40-megapixel ceiling and a successful decode, then
re-encoded as JPEG with all metadata removed, and never stored. Progress photos and body scans go from the browser
straight to private buckets that enforce type and size; the server then checks the path is inside the member's
folder and that the object exists. Private images are only ever shown through short-lived signed links. Open point:
O6 (no object count cap for progress photos).

## 9. Dependencies

`npm audit --omit=dev`: **0** advisories across 147 production packages. `npm audit` over everything: 15 (1
critical, 3 high, 11 moderate), all in development tooling (O12). Nothing was installed or upgraded.

## 10. Headers, CSP and sessions

- Every response carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy` limiting camera and location to the app
  and denying the microphone, `Cross-Origin-Opener-Policy: same-origin`, and HSTS on https deployments.
- CSP is set per request by the middleware with a fresh nonce: `script-src 'self' 'nonce-…' 'strict-dynamic'`
  (plus `'unsafe-eval'` in development only), `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`,
  `form-action` limited to the app and Stripe's hosted pages. The two webhook paths and static files skip the
  middleware.
- The middleware validates the session with Supabase Auth on every request (`getUser()`, not the cookie's own
  claims) and refreshes it. Signed-out visits to the 13 signed-in areas go to `/login` with a safe `next`.
- Sign-out revokes the refresh token on every device. Email confirmation is required; passwords need 8 characters
  with a letter and a digit; a password change needs a recent sign-in.
- Cookie flags: O2.
- The service worker caches only static assets and the public Bible text, never a signed-in page or an API reply.
- Native wrappers load an https address only (the config refuses plain http unless a local-testing flag is set);
  Android backups are off.

## 11. Files changed (commit `7dffa8e`)

| File | Change |
|---|---|
| `src/server/services/ai-photo-guard.ts` | New: plan and upload limit before a photo is read (F1) |
| `src/app/api/ai/food-photo/route.ts`, `src/app/api/ai/label-photo/route.ts` | Call the guard before `request.formData()` (F1) |
| `src/server/services/billing.ts` | Deletion refused when an open subscription can't be cancelled (F2); `invoiceIsNewerThan` (F3) |
| `src/server/actions/billing.ts` | Rate limits on checkout and billing portal (F4) |
| `tests/integration/ai-photo-upload-guard.test.ts` | New, 4 tests (F1) |
| `tests/integration/account-deletion-billing.test.ts` | New, 4 tests (F2) |
| `tests/integration/api-function-surface.test.ts` | New, 4 tests (callable database functions) |
| `tests/integration/entitlements.test.ts` | One case added; `fakePayment` can set an invoice's `created` time (F3) |
| `tests/unit/checkout-rate-limit.test.ts` | New, 4 tests (F4) |
| `tests/unit/ai-routes-plan.test.ts` | One case added; the mocked AI service gained `getAiAllowance`, which the routes now call. No existing assertion was changed or removed. |
| `docs/audit-2026-11-14/security-billing.md` | This report |

No migration was written and the shared database schema was not changed. Tests created and removed their own
synthetic accounts.

## 12. Commands run and their results

| Command | Result |
|---|---|
| `psql` catalog queries against `supabase_db_narrow-gate-fitness` (tables, RLS, policies, grants, functions, triggers, foreign keys, buckets) | Figures in section 2 |
| `npm audit --omit=dev --json` | 0 advisories |
| `npm audit --json` | 15 advisories, all development tooling |
| History scan (`git log --all -p -G<patterns>` over 749 commits) | 2 matches, both false positives |
| Baseline before any change: `npx vitest run --project integration` on `rls`, `cross-user-isolation`, `account-security`, `free-user-direct-actions`, `pro-bypass`, `plan-enforcement`, `account-deletion`, `subscription-lifecycle` | 8 files, 62 tests passed |
| `npx vitest run --project integration tests/integration/ai-photo-upload-guard.test.ts` before F1 | 3 failed, 1 passed (415 where 403 and 429 were expected) |
| `npx vitest run --project unit tests/unit/ai-routes-plan.test.ts` against the old routes | 1 failed, 5 passed; after F1: 6 passed |
| `npx vitest run --project integration tests/integration/account-deletion-billing.test.ts` before F2 | 3 failed, 1 passed (deletion returned `ok: true`) |
| `npx vitest run --project integration tests/integration/entitlements.test.ts` before F3 | 1 failed, 12 passed (`pro` where `free` was expected) |
| `npx vitest run --project unit tests/unit/checkout-rate-limit.test.ts` before F4 | 3 failed, 1 passed |
| After all fixes: `npx vitest run --project integration` on the 16 files `ai-photo-upload-guard`, `account-deletion-billing`, `api-function-surface`, `entitlements`, `ai-route-limits`, `food-photo`, `account-deletion`, `billing-integrity`, `store-billing`, `subscription-lifecycle`, `rls`, `cross-user-isolation`, `account-security`, `free-user-direct-actions`, `pro-bypass`, `plan-enforcement` | **16 files, 134 tests passed** |
| `npx vitest run --project unit` (whole unit suite) | **240 files, 4,506 tests passed** |
| `npx tsc --noEmit` | No errors |
| `npx eslint` on the 10 changed source and test files | No findings |

Not run: the other 60 integration files (other auditors' areas), `next build`, Playwright e2e.

## 13. What could not be verified here

- **Production configuration**: Supabase Auth limits, SMTP, password and leaked-password settings, redirect
  allow-list (O1); which environment variables the production host has (`CRON_SECRET`, `REVENUECAT_WEBHOOK_AUTH`,
  `STRIPE_WEBHOOK_SECRET`, absence of `DEMO_MODE` and the sandbox switches); whether production is Vercel's
  production environment (O3, O4).
- **Real purchases**: Apple sandbox and TestFlight purchases, Google Play test purchases, real RevenueCat webhooks
  and transfers, real Stripe checkout, portal, refund and dispute. All billing tests ran against local stand-ins.
- **Deployed behaviour**: response headers and cookies as the host serves them, HSTS, the rate limiter under
  several server instances, the cron schedule for reconciliation and weekly reports.
- **Devices**: session persistence in the iOS and Android WebViews, the deletion screen's store-subscription
  wording, the export download on iPhone.
- **Browser flows**: no e2e spec was run (no server could be started on this machine). After merging, run the
  specs that cover sign-in, Plans and billing, meal-photo and label-photo logging, and account deletion.
- **Hosted Supabase differences**: the callable-function test reads the API's description with the public key; a
  hosted project may not serve it, so that test is for the local stack.
- Findings O5, O7 and O8 were reasoned from the code and not executed.

## 14. Owner actions

1. Set and verify the production Supabase Auth limits and SMTP before inviting testers (O1).
2. Confirm what counts as production, and that `DEMO_MODE`, `REVENUECAT_ALLOW_SANDBOX`, `REVENUECAT_ALLOW_TEST_STORE`
   and `AUTH_RATE_LIMIT_SCALE` are unset there (O4).
3. When refunding a Stripe payment in full, cancel the subscription as well (O8).
4. Decide on O2 (Secure cookie flag), O5, O6, O7 and O9; each has a proposed change above.
5. No credential rotation is needed on the evidence of this audit.
