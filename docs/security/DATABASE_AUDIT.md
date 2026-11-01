# Database security audit (Supabase / Postgres)

Branch `security/payment-hardening-prelaunch`, 2026-11-01. The audit was read-only on the database: catalog queries, plus SELECT probes inside `BEGIN READ ONLY` as real test users. Its fixes were applied afterwards in `supabase/migrations/20261101000047_program_builder_enforcement.sql`.

**What "staging" means here.** No hosted Supabase project was available. The audited database is the local Supabase stack (Postgres 17), built from the 43 migration files, and it holds disposable test accounts only. The hosted project must be checked the same way before launch (see "Repeat on the hosted project").

## Result

**0 Critical, 0 High, 1 Medium, 8 Low, 10 Info.**

- **RLS is on everywhere:** all 76 public tables. Write paths were judged from the exact policy text, grants and function bodies, because the brief allowed no writes.
- **No cross-account rows visible:** three test users, each probed across 63 owner-column tables, saw 0 rows belonging to anyone else. Anonymous callers saw 0 member rows.
- **Members can't touch billing or quota:** every billing, entitlement, quota and webhook table is read-own or no access at all.
- **`profiles.role` can't be changed by a member**, and no profile column grants a plan or admin rights.
- **SECURITY DEFINER functions:** all 30 pin `search_path`. Every function that touches money or quotas is service-role only. No member-callable function takes a target user id.
- **Private buckets:** `avatars`, `progress-photos` and `body-scans` are limited to the member's own `<uid>/` folder for every operation. Signed URLs are created with the member's own session.
- **Migrations match the live database:** replaying every migration into an empty Postgres and diffing a 1,950-line normalized catalog snapshot against the live database gave an **empty** diff. The snapshot covered RLS flags, policies, table and column grants, function security, search paths, EXECUTE rights, body hashes, triggers, buckets, constraints and columns. So the migrations in the repository are exactly what is applied locally.
- **The service-role key stays on the server:** 22 call sites were reviewed. Every member id they act on comes from the signed-in session, an admin check, a signature-verified webhook, or the cron secret. None comes from request input. The key is never in a `NEXT_PUBLIC_` variable or a client component. A production build's browser JavaScript contains no secret names or key prefixes; this was checked separately.

## Findings and status

| # | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| M1 | Medium | A Free member could insert a `source='starter'` program with their own token. That insert had no plan check. They could fill it with any weeks, days and exercises, then relabel it `custom` or `ai`. That is the paid builder's result without the plan or its rate limit. | `20261023000024_plan_enforcement.sql:76-87`; `20261016000002_rls_policies.sql:257-282` | **Fixed** (migration 047). Starter programs are now created by the server only (`src/server/services/custom-programs.ts`). `source` can't be changed under a member session. Writing to a member starter program's contents needs Plus/Pro. Tested in `tests/integration/pro-bypass.test.ts`. |
| L1 | Low | A member can repoint `user_programs.program_id` on UPDATE; the paid-program check applies to insert only. Paid prescriptions stay hidden (`can_use_program`). | `…024:70-72`, `…002:141` | Open. Not a data leak; it only creates a bogus enrolment. Suggested trigger in the audit notes. |
| L2 | Low | Six SECURITY DEFINER BEFORE-INSERT triggers check a row's `user_id` before RLS runs. Given another member's UUID, the different error messages reveal whether that member is on Free, has given consent, or is at a limit. | `enforce_free_template_limit`, `enforce_live_gps_plan`, `enforce_wellness_consent`, `enforce_coach_memory_limit`, `enforce_running_goal_limit`, `body_scan_limit` | Open. The fix is a guard, `if auth.uid() is not null and new.user_id is distinct from auth.uid() then return new; end if;`, as migration 039 did for the sleep triggers. Low impact: it needs the victim's UUID. |
| L3 | Low | `has_ai_coach()` ignored `access_revoked_at` (a refunded or disputed period). | `…026:12-30` | **Fixed** (migration 047). |
| L4 | Low | Members could insert their own `proposal` JSON, and `applyProposalAction` didn't filter `role='assistant'`. | `…025:63-69`, `src/server/actions/coach.ts:32` | **Fixed** (migration 047 and `coach.ts`). Tested. |
| L5 | Low | Members write their own `legal_acceptances` rows with unvalidated version, hash and `details`. That weakens them as dispute evidence. | `…045:26-27`, `src/server/legal.ts:40-42` | Open. Suggested fix: a table of valid document versions, and auto-renewal consent written by the service role. |
| L6 | Low | `anon` and `authenticated` held TRUNCATE, REFERENCES and TRIGGER on every table, plus write grants on billing tables that RLS was denying. | default ACL | **Fixed for TRUNCATE/REFERENCES/TRIGGER and billing writes** (migration 047). Broader `anon` write revokes are left for review. |
| L7 | Low | Some foreign keys to another member's rows aren't ownership-checked (for example `body_scans.measurement_id`, `workout_sessions.user_program_id`). Nothing leaks, but they work as an existence check and allow integrity pollution. | catalog `14_fk_cross_owner` | Open. |
| L8 | Low | Definer helpers (`program_of_day`, `program_of_week`, `can_*_program`) can be called over RPC by `anon`. They reveal a day's or week's program id and work as an existence check. | `…002:10-71` | Open. Suggested fix: move them to a non-exposed schema. |
| I1–I10 | Info | FORCE RLS off (normal on Supabase); a few non-definer functions without a pinned search_path; `btree_gist` in `public`; storage UPDATE policies rely on USING (no explicit WITH CHECK); members can set consent timestamps; `parsed.data` spread order in the AI chat route (safe today); `pg_stat_statements` readable; the Supabase CLI's public local demo JWTs in test files (not secrets); `activities.is_private` unused; `profiles.avatar_path` unused. | | Recorded only. |

## Private data categories mapped

| Category | Tables and buckets | Isolation |
|---|---|---|
| Profile | `profiles` (email lives in `auth.users`, which isn't exposed) | Own row only |
| Workouts | `workout_sessions/exercises/sets`, `personal_records`, `workout_templates`(+`_exercises`), `user_programs`, `planned_session_overrides`, `fitness_goals`, private `training_programs` (+ weeks, days, exercises), `exercise_targets`, `training_adjustments`, `training_recommendation_decisions`, `onboarding_answers` | Owner only |
| Body measurements | `weight_entries`, `measurement_entries`, `body_scans`, `body_scan_photos`, bucket `body-scans` | Owner only; uploads need Pro and consent |
| Progress photos | `progress_photos`, bucket `progress-photos` | Owner folder only |
| Nutrition | `meals`, `meal_items`, `foods` (owner), `food_favorites`, `nutrition_goals`, `water_entries`, `nutrition_day_marks`, `recipes` (+ ingredients), meal-plan tables, grocery tables, `supplement_stack`, `supplement_logs` | Owner only |
| Sleep | `sleep_sessions`, `sleep_stages`, `sleep_checkins`, `sleep_import_runs` | Owner only |
| GPS | `activities` (route, splits), `running_goals` | Owner only |
| Recovery | `recovery_checkins`, `daily_steps` | Owner only |
| AI | `ai_conversations`, `ai_messages`, `ai_usage_events` (read own), `coach_memories` | Owner only |
| Faith | `faith_journal_entries`, `discipline_goals`, `discipline_checkins`, `faith_reminders`, `challenge_enrollments/checkins` | Owner only |
| Subscriptions and payment ids | `subscriptions`, `store_subscriptions`, `legacy_plan_terms`, `user_entitlements`, `billing_customers` (read own); `billing_state_versions`, `store_sync_state`, `stripe_events`, `revenuecat_events`, `rate_limit_counters` (no access) | Members never write |

## Automated tests that cover isolation

- `tests/integration/cross-user-isolation.test.ts` (23 tests). For every member-owned table and private bucket, a second member, an admin and an anonymous visitor try to read, change, delete, spoof and attach to the first member's data.
- `tests/integration/rls.test.ts`, `plan-enforcement.test.ts` and `account-security.test.ts`.
- `pro-bypass.test.ts` and `billing-integrity.test.ts` (members can't call billing functions or write billing state).

## Repeat on the hosted project

A migration file in the repository doesn't prove it was applied to the hosted project. Before launch, on the hosted staging project:

1. Run `supabase migration list` against it. Every version through `20261101000047` must be applied.
2. Run the integration suite against it with disposable accounts. Set `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY` and `TEST_SUPABASE_SERVICE_ROLE_KEY`; the tests create and delete their own users.
3. Repeat the catalog snapshot. The queries are in the audit's scratch output; the key checks are `relrowsecurity` on every public table and EXECUTE on the service-role-only functions.
