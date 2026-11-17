# 03 — Account deletion and data retention: closure pass

Date: 2026-11-17. Branch: `claude/legal-remediation`. Prepared by an engineer, not a lawyer: this records what the
code and the local database do, for the owner and counsel. Nothing here approves legal wording or decides a retention
period.

Evidence base: the code, the 69 migrations (identical to what is applied on the local database), live catalog queries
on the local Supabase stack (`pg_constraint`, `information_schema`, `storage.buckets`, `cron.job`, `auth.*`), and the
new test `tests/integration/account-deletion-closure.test.ts`. No hosted environment was inspected.

## 1. How deletion runs

`deleteAccountAction` (`src/server/actions/profile.ts`) requires DELETE plus the password (5 attempts / 15 min), then
calls `deleteUserAccount` (`src/server/services/account-deletion.ts`):

| Step | What happens | On failure |
|---|---|---|
| 0 | Read the Stripe customer ID (`billing_customers`) | Stop, nothing deleted ("billing") |
| 1 | Cancel every open Stripe subscription (local rows + Stripe's own list) | Stop, nothing deleted ("billing"); also stops when Stripe isn't usable and an open subscription is on record |
| 2 | Empty `<uid>/` in the `avatars`, `progress-photos` and `body-scans` buckets, bucket by bucket | Stop ("storage"): account and all rows remain; files already removed stay removed. Member is told to retry |
| 3 | Delete the auth user → cascades to every personal table and to auth sessions, refresh tokens, identities, MFA, one-time tokens | Stop ("auth"): subscription cancelled, files removed, rows remain. Member is told to retry or contact support |
| 3b (new) | Delete `rate_limit_counters` whose key holds the account ID or the hashed sign-in email | Logged (`account.delete.rate_limits`), deletion still succeeds |
| 4 | Delete the Stripe customer; delete the RevenueCat subscriber | Logged with the customer ID / account ID for manual follow-up; deletion still succeeds |

Afterwards the device that deleted the account clears its drafts, in-progress workout and GPS recording, queued
check-ins, scheduled notifications and the RevenueCat identity (`src/components/platform/forget-device-data.tsx`,
`clearAllDrafts`). Other devices keep their local copies until the app is next opened signed out or removed.

## 2. Data categories

"Test" = assertion in `tests/integration/account-deletion-closure.test.ts` (C), `account-deletion.test.ts` (D),
`account-deletion-billing.test.ts` (B), `cross-user-isolation.test.ts` (I), `tests/unit/account-deletion.test.ts` (U),
`tests/unit/account-coverage.test.ts` (K).

| Category | Where stored | On deletion | Evidence / test | External or retained, and why |
|---|---|---|---|---|
| Profile, onboarding, goals, consents (timestamps) | `profiles`, `onboarding_answers`, `fitness_goals` | Deleted immediately (cascade) | C, D, I, K | — |
| Training: workouts, sets, PRs, templates, programs the member built, enrolments, overrides, targets, adjustments | `USER_TABLES` training tables, incl. `training_programs.owner_id` (its weeks/days/exercises cascade via `program_id`) | Deleted immediately (cascade) | C, I, K | — |
| Body: weight, measurements, recovery, sleep (sessions, stages, check-ins, imports), steps, supplements | `USER_TABLES` (see `src/server/services/account.ts`) | Deleted immediately | C, I, K | — |
| Runs and GPS routes (incl. soft-deleted runs) | `activities`, `running_goals` | Deleted immediately | C, I | — |
| Nutrition, custom foods, favourites, recipes, meal plans, groceries | `USER_TABLES` (see `src/server/services/account.ts`) | Deleted immediately | C, I | — |
| AI Coach conversations, messages, feedback, coaching memories (sealed), usage events, weekly reports, meal-plan drafts | `ai_*`, `coach_memories`, `weekly_reports`, `meal_plan_drafts` | Deleted immediately | C, I | Copies already sent to Anthropic: see below |
| Faith: journal, Bible notes/highlights/bookmarks/history, memory verses, studies, Bible AI messages and usage, journeys, goals, reminders, discipline | `USER_TABLES` (see `src/server/services/account.ts`) | Deleted immediately | C, I | — |
| Habits, challenges, notification reminders/prefs/devices | `USER_TABLES` (see `src/server/services/account.ts`) | Deleted immediately | C, I | — |
| Accountability partners (invites, partnerships on either side, share switches incl. the partner's switch on that partnership, nudges sent or received) | `USER_TABLES` (see `src/server/services/account.ts`) | Deleted immediately (cascade on both member columns and on `partnership_id`) | C (member as `user_a` and as `user_b`) | Partner's account untouched |
| Legal acceptances (Terms/Privacy/ARL records) | `legal_acceptances` | Deleted immediately | C, I | Owner/counsel decision already recorded in the policy draft (California ARL proof does not survive deletion) |
| Billing rows: subscriptions, legacy terms, entitlement, store subscriptions, customer link, billing-state counter, store-sync time | `USER_TABLES` (see `src/server/services/account.ts`) | Deleted immediately | C, I | — |
| Sandbox-tester list: the member's own row | `sandbox_testers.user_id` | Deleted immediately | C | — |
| Sandbox-tester rows the member (as admin) added for others | `sandbox_testers.added_by` | Anonymised (set null); the other person's row stays | C | Staff record of someone else |
| Admin audit entries written by the member (as admin) | `admin_audit_logs.actor_id` | Anonymised (set null); action, entity and details stay | C (details checked: no member ID or email) | Retained: staff accountability record. Retention period: **[OWNER DECISION]** |
| Admin audit entries **about** the member (e.g. `sandbox_tester.add`) | `admin_audit_logs.entity_id` (text, no FK) + `details.note` | **Retained**: keeps the member's account ID and the admin's note | C pins this exactly (the only `public` row naming the member after deletion) | **[OWNER DECISION]**: keep as-is with a period, or anonymise `entity_id`/`details` on deletion. Not changed here |
| Files: avatar, progress photos, Body Scan photos | Storage buckets `avatars`, `progress-photos`, `body-scans` (all private) | Deleted immediately (step 2), before the account | C (no object by owner or `<uid>/` prefix in any bucket), D, I, K (every private bucket is listed) | If removal fails, deletion stops (C, U). The public `exercise-media` bucket holds no member files |
| Auth user, identities, sessions, refresh tokens, MFA factors, one-time tokens, OAuth/WebAuthn rows | `auth.*` | Deleted immediately (cascade from `auth.users`; refresh tokens via `sessions`) | C (catalog: every auth FK cascades except unused `scim_users` set null; refresh tokens and `flow_state` checked), D (old access token and refresh token stop working) | — |
| Supabase Auth audit log (sign-up, sign-in, user_deleted events with account ID and email; IP column empty locally) | `auth.audit_log_entries` (no FK; written by Supabase Auth) | **Retained**; the app never touches it | C (sweep finds it; content limited to auth events) | **[OWNER DECISION]** whether to purge/anonymise on deletion (would need a service-role SQL function in a migration) or switch off database audit logging; **[TO BE CONFIRMED WITH PROVIDER]** hosted retention and whether IP is recorded. **New finding; not disclosed before this pass** |
| Rate-limit counters keyed by account ID (`export:<id>`, `delete-account:<id>`, `ai:<id>`, …) or hashed email (`signin:<hash>`, `…:ip:<hash>`) | `rate_limit_counters` (no FK) | **Deleted immediately (fixed in this pass, step 3b)** | C (4 seeded, 0 after; fails without the fix), U | — |
| Rate-limit counters keyed only by hashed IP | `rate_limit_counters` | Retained until the limiter's probabilistic clean-up (1% of calls deletes rows older than 2 days) | C (left in place) | Not linkable to the account in the database |
| In-memory rate-limit fallback | Server process memory | Lost on restart; windows ≤ 1 h | Code read | Transient |
| Webhook event logs | `stripe_events`, `revenuecat_events` | Retained | C (catalog: no member column; sweep finds no ID) | No account reference; error column holds class/code only (`webhookErrorCode`) |
| Service-wide AI spend | `ai_budget_months`, `ai_budget_alerts` | Retained | C (catalog) | Aggregate, no member reference |
| Late billing events after deletion | Stripe / RevenueCat webhooks | Ignored: unknown member, no rows recreated | C (`syncStoreSubscriber` → null; `userIdForSubscription` with stale metadata → null, no customer link written) | — |
| Stripe customer, payment methods, invoices, charges | Stripe | Customer deleted (best effort, step 4); subscriptions cancelled first | U, B; Stripe calls stubbed in C | **External**: Stripe keeps invoices/charges under its own terms. A failed customer deletion is logged with the customer ID (`account.delete.stripe_customer`) for manual removal; there is no automatic retry |
| RevenueCat subscriber, App Store / Google Play purchase history | RevenueCat; Apple/Google | Subscriber deleted (best effort) | C (failure is logged, deletion still ok) | **External**. Store subscriptions are **not cancelled** (only the member can); Apple/Google records are outside the app's reach. Failure logged with the account ID; no retry |
| AI inputs/outputs sent to Anthropic | Anthropic | Not deletable by the app | Code read (no account ID sent as request metadata; content is whatever was sent) | **External**: **[TO BE CONFIRMED WITH PROVIDER]** Anthropic retention / zero-retention status |
| Server logs | Hosting provider (stdout JSON lines) | Not deleted | `src/server/log.ts`; deletion logs carry the account ID or Stripe customer ID on follow-up failures | **External**: host retention **[TO BE CONFIRMED WITH PROVIDER]** / **[OWNER DECISION]** |
| Error monitoring | None (no SDK). Optional browser reports go to the same server log when `ERROR_REPORTING=on` | — | `src/app/api/client-errors/route.ts` | As server logs |
| Account emails (confirm sign-up, reset password) | Supabase Auth → SMTP provider | Not deletable by the app | `supabase/config.toml` (no production SMTP configured) | **External**: provider not chosen; retention **[TO BE CONFIRMED WITH PROVIDER]** |
| Database backups / point-in-time recovery | Supabase (hosted) | Deleted data persists in backups until they expire | Not knowable from the repository | **[TO BE CONFIRMED WITH PROVIDER]**: what the production plan keeps and for how long; **[OWNER DECISION]** on the stated period. Restoring a backup would bring deleted accounts back unless deletions are replayed; no procedure exists |
| Open Food Facts | OFF servers | Nothing to delete | Barcodes/search text from the server, no identity; product photos load from the device (OFF sees the IP) | External, no account data |
| USDA FoodData Central | USDA | Nothing to delete | Search text only, only if live search is on | External, no account data |
| On-device data | Phone/browser storage | Cleared on the deleting device (`ForgetDeviceData`) | Code read; `tests/unit/device-cleanup.test.tsx`, `drafts.test.tsx` | Display preferences and a random device key stay; other signed-in devices keep their local drafts until cleared |

Scheduled jobs: only `faith-journeys-settle` (`cron.job`). No time-based deletion of any personal data exists.

## 3. Defects fixed

1. **Rate-limit counters outlived the account.** `rate_limit_counters` (migration 046) has no foreign key; keys hold
   the account ID (`export:<id>`, `delete-account:<id>`, `ai:<id>`, `checkout:<id>`, …) or the SHA-256 of the
   sign-in email. Nothing removed them at deletion, and the only clean-up is probabilistic (1% of limiter calls
   deletes rows older than two days), so they could last indefinitely on a quiet server. Fix: step 3b,
   `removeRateLimitCounters` in `src/server/services/account-deletion.ts` (best effort, after the auth user is gone,
   using the email read just before). No migration. Tests: C (fails without the fix: "expected 4 to be 0"), U (order;
   failure logged and non-fatal; not run when the auth step fails).
2. **Storage-failure message overstated.** After a storage failure part-way the member was told "nothing else was
   deleted", but buckets are emptied one by one, so e.g. the avatar may already be gone. Message now: "Your
   subscription was cancelled, but your account and your data still exist (some of your photos may already have
   been removed)." Tests: U (assertion replaced by the accurate one), C (real partial failure: avatar removed, account
   and every row intact).

No foreign key was missing or wrong: of the 94 columns in `public` (91 tables) that reference `auth.users`, 92 cascade; the other two are `admin_audit_logs.actor_id` and
`sandbox_testers.added_by` (set null, staff tables). There are no foreign keys to `profiles`. No migration was added, so `npx supabase migration up` and
`npm run db:bundle` were not needed.

## 4. Recorded, not changed (owner / counsel decisions)

- **Supabase Auth audit log** keeps sign-up/sign-in/deletion events with ID and email after deletion. Options: a
  service-role `security definer` function that deletes or anonymises the member's `auth.audit_log_entries` rows,
  called at step 3b; or switching off database audit logging in the hosted project; or keeping them for a stated
  security-log period.
- **Admin audit entries about a member** keep the account ID and the admin's free-text note. Options: anonymise
  `entity_id`/`details` for `entity_type = 'sandbox_tester'` on deletion, or keep for a stated period.
- Retention periods for every row of Policy Section 7, backups, server logs, Stripe tax/accounting records, and the
  ARL consent record (already flagged in the draft).
- No retry for failed Stripe/RevenueCat customer deletions beyond a log line; a support runbook is needed.

## 5. Privacy Policy draft and public page changes

`docs/legal/PRIVACY_POLICY_DRAFT.md` (banner, attorney notes and placeholders kept; a 2026-11-17 revision note added):

| Where | Before | After |
|---|---|---|
| Version line | `[DRAFT 2026-10-26; factual descriptions revised 2026-11-16]` | `…; deletion and retention facts revised 2026-11-17]` |
| 2.4 | Rate limits use hashes of IP and email | Same, plus: other limits are counted against the account ID; new bullet on the Supabase Auth sign-in audit log [TO BE CONFIRMED WITH PROVIDER: IP, retention] |
| 7, Rate-limit counters | "rows older than two days are removed the next time the limiter runs" (wrong: it is a 1-in-100 chance per call) | Counters with account ID or email hash deleted at account deletion; others removed by an occasional clean-up, can last longer than two days |
| 7, Administrator audit log | "Kept. An entry can contain a member's account ID" | Kept after deletion; entries about a member keep the ID and the admin's note; entries by a deleted admin lose the admin ID. [OWNER DECISION … whether anonymised] |
| 7, new row | — | Sign-in audit log (Supabase Auth): kept after deletion [OWNER DECISION] [TO BE CONFIRMED WITH PROVIDER] |
| 7, Backups | "Held by the database provider" | Deleted data stays until the backup expires; schedule depends on the hosted plan, not in the repo [TO BE CONFIRMED WITH PROVIDER] |
| 8, step 2 | Files removed | Plus: if that fails, deletion stops, account and data remain, some photos may already be removed |
| 8, step 3 | Sign-in account deleted with linked records | Plus sessions and sign-in tokens; counters keyed by account ID/email hash then deleted |
| 8, not deleted | "rate-limit counters containing your account ID, for up to about two days" | Replaced by: counters keyed only by a hashed IP (not linked) until clean-up; added the sign-in audit log; admin audit entries can include an admin's note; backups line adds [TO BE CONFIRMED WITH PROVIDER] |

`src/app/legal/delete-account/page.tsx`: "What is deleted" now names the sign-in account and sessions and states the
order (website subscription cancelled first, nothing deleted if that fails; deletion stops if photos can't all be
removed; Stripe/RevenueCat asked to delete their customer record). "What is not deleted" gains: provider-held records
(Stripe, RevenueCat, Apple, Google); security records (sign-in log, admin audit log) [OWNER DECISION]
[TO BE CONFIRMED WITH PROVIDER]; backups and server logs until they expire [TO BE CONFIRMED WITH PROVIDER].

Not edited (outside this task's files, noted for follow-up): `src/app/legal/privacy/page.tsx` says deletion "removes
your data… from our database"; it should mention the two audit logs once the owner decides. The audit record
`docs/legal-audit-2026-11-16/06_PRIVACY_DATA_FLOW_MAP.md` (§3) repeats the "next time the limiter runs" wording and
does not mention `auth.audit_log_entries`; it is a dated audit and was left as written; this file supersedes it on
those two points.

## 6. What cannot be verified from the repository

- Supabase hosted backups and point-in-time recovery: whether enabled, frequency, retention, and restore procedure.
- Whether the hosted Supabase project writes the auth audit log to the database, records IPs in it, and for how long
  Supabase keeps its own platform/API logs.
- Hosting provider (not confirmed) and its log retention; any log drain.
- Stripe's retention of deleted customers' invoices/charges; RevenueCat's handling of deleted subscribers; Apple and
  Google purchase records.
- Anthropic's retention of API inputs/outputs and any zero-retention arrangement for the owner's account.
- The email (SMTP) provider and its message-log retention.
- Whether deletion behaves the same on the hosted project (tests ran against the local stack only).

## 7. Verification run (2026-11-17, local stack)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint src tests` | exit 0 |
| `npx vitest run --project integration tests/integration/account-deletion-closure.test.ts` | 1 file, 7 tests passed (also confirmed to fail, 3 tests, with step 3b disabled) |
| `npx vitest run --project unit tests/unit/account-coverage.test.ts tests/unit/setup-all-bundle.test.ts` | 2 files, 6 tests passed |
| `npx vitest run --project unit tests/unit/account-deletion.test.ts` | 1 file, 8 tests passed |
| `npx vitest run --project integration` (whole suite) | 82 files passed, 1 skipped (`food-quality-live`, needs live Open Food Facts); 496 tests passed, 1 skipped |

The full-suite run included test files other workers were adding to the same worktree at the time. The closure test
reads the catalog and the `auth`/`storage` schemas with `psql` (`TEST_DB_URL`, default the local CLI database), so CI
needs the `psql` client (present on GitHub's Ubuntu runners).
