# 02 — Subscription security: closure pass

Date: 2026-11-17. Branch: `claude/legal-remediation` (worktree). Scope: Free/Pro authorisation, Stripe and RevenueCat
webhooks, and how billing interacts with account deletion. Builds on `docs/audit-2026-11-14/security-billing.md`
(sections 5–6), `docs/MOBILE_BILLING.md`, `docs/MEMBERSHIPS.md` and
`docs/legal-audit-2026-11-16/09_STORE_COMPLIANCE_CHECKLIST.md`; their claims were re-checked against the code, the live
local catalog (`pg_policies`, `pg_trigger`, `information_schema.column_privileges`, `pg_proc`) and the tests, not
copied.

**Result.** No new defect was found, so no product code was changed. Every Pro feature that the server would act on is
refused by the server for a Free member, and every Pro-only table refuses a Free member's direct write. Two Pro features
are gated only on screen, and in both the server does no Pro work (see 1.4). The new file
`tests/integration/subscription-closure.test.ts` (17 tests) adds the coverage that was missing:

- account deletion run against Stripe and RevenueCat stand-ins;
- webhooks that arrive after the account is deleted;
- webhook ordering, replay, grace, refund and alias cases sent through the real route handlers;
- direct PostgREST writes into each Pro-only table with the member's own JWT, each checked against a Pro control;
- seven Pro server actions that no other test called as a Free member.

Prices ($17.99 / $119.99, `src/lib/domain/plans.ts:108`) and entitlements were not touched. Payments were not enabled.
Nothing reached Stripe, RevenueCat, Apple, Google or an AI provider.

**Not proved here.** Nothing in this document shows that a native purchase, restore, renewal or refund works. See
section 5.

## 1. Free/Pro authorisation, per feature

How the plan is decided: `user_entitlements` is the only source. Members may read their own row but cannot write it
(no insert or update policy; `billing-integrity` "members can't call the billing functions…"). The server reads it with
`getPlanWith` (`src/server/auth.ts:53-56`) and `assertFeature` (`:69-73`). The database reads it with `plan_of()` /
`has_plan()`, which honour `valid_until` (`supabase/migrations/20261023000024_plan_enforcement.sql`; `plan_of` is not
callable by members, `20261025000042_plan_of_private.sql:5`). An entitlement past its `valid_until` counts as Free in
both places with no webhook needed (`subscription-lifecycle` "an entitlement whose end date has passed…").

Abbreviations in the "Tests" column: **SC** = `subscription-closure` (new); FUDA = `free-user-direct-actions`; PB =
`pro-bypass`; PE = `plan-enforcement`.

### 1.1 Gate table

| Pro feature | Database (what a Free JWT is refused) | Server (actions / routes) | UI | Tests |
|---|---|---|---|---|
| **AI coach** (chat, plan generation, proposals) | `reserve_ai_usage` is service-only, so no AI request can be metered by a member. `ai_messages` insert is limited to `role='user'` with no proposal (`20261101000047_program_builder_enforcement.sql:106-107`). `training_programs` with `source='ai'` needs `has_plan('pro')` (same file `:16-17`). | `assertAiAllowed` (`src/server/services/ai-coach.ts:149-153`, `chatLimit<=0` → `not_entitled`), called by `coachTurn` `:467`. `/api/ai/chat` reads the plan through the authenticating session (`src/app/api/ai/chat/route.ts:37-38`). `applyProposalAction` / `applyCoachProposalAction` (`src/server/actions/coach.ts:33`, `:116`). | Coach screen: `entitled = usage.chatLimit > 0` (`src/app/(app)/coach/page.tsx:106`) | PB (forged plan/tier/user fields → 403, no usage), `ai-access`, FUDA, SC (planted assistant reply → 403) |
| **Every other AI path**: meal photo, label photo, AI meal plan, product explanation, Bible helper, weekly-report text, adaptive training, coaching memory | `has_ai_coach()` (`20261101000047_program_builder_enforcement.sql:82`) on `coach_memories`, `exercise_targets`, `training_adjustments`, `training_recommendation_decisions` (`20261024000027_adaptive_training.sql:57,64,74`) | `withAiRequest` → `assertAiAllowed` (`ai-coach.ts:654-661`); photos refused before the body is read (`src/app/api/ai/food-photo/route.ts:29-33`, label-photo `:32`); `assertFeature(meal_planning)` (`src/server/actions/ai-meal-plan.ts:22`); `bibleAiBlocked` (`src/server/services/bible-ai.ts:85-110`); reports only for Pro (`src/server/services/weekly-reports.ts:240`); `requireAdaptive` (`src/server/actions/adaptive-training.ts:16-18`); coach memory (`src/server/actions/coach-memory.ts:17`) | Faith ask page `entitled` (`src/app/(app)/faith/ask/page.tsx:37`); photo buttons hidden for Free | `ai-access` (every entry point, stand-in counts 0 provider calls), `ai-photo-upload-guard`, `ai-route-limits`, `coach-memory`, `adaptive-training`, FUDA, **SC** (`askBibleAction` → `not_entitled`, no usage row; REST inserts into the four `has_ai_coach` tables → 42501, Pro control 201) |
| **Full program library** (structured + habit programs) | Restrictive `user_programs_visible_program` (`20261023000024_plan_enforcement.sql:70-72`); `program_exercises` readable only through `can_use_program`; trigger `check_user_program_change` (`20261102000048_low_findings_hardening.sql:11`); habit enrolment and check-ins need `has_plan('pro')` (`20261113000064_habit_programs.sql:52,65`) | `loadAccessibleProgram` (`src/server/actions/programs.ts:16-21`); `startHabitProgramAction` (`src/server/actions/habit-programs.ts:28`); `setHabitActivityAction` relies on the database and reports its 42501; coach-started programs (`coach.ts:222-227`) | Lock badges (`src/app/(app)/train/programs/page.tsx:326`), habits page (`train/habits/page.tsx:16`) | PE, `pro-programs`, `low-findings` (re-pointing an enrolment), FUDA, **SC** (`startHabitProgramAction`, tick via an earlier enrolment, REST check-in → 42501, Pro control; another Pro program's prescriptions read as `[]`) |
| **Program builder** | `training_programs_insert` needs `has_plan` for `custom`/`ai` (`20261101000047…:16-17`); trigger `lock_training_program_source`; restrictive starter-content policies (`…:58-77`) | `buildCustomProgramAction` (`src/server/actions/custom-programs.ts:25`) | `train/build/page.tsx:18` | PB, PE, FUDA, `custom-programs` |
| **Live GPS** | Trigger `enforce_live_gps_plan` on insert **and** update (`20261026000044_free_pro_memberships.sql:25-51`) | `saveGpsActivityAction` (`src/server/actions/gps-activities.ts:55`) | `run/record/page.tsx:53` (`canRecord`), `run/page.tsx:94` | `gps-running` (insert and turning a manual entry into GPS refused), FUDA |
| **Recipes, meal planner, grocery** | Restrictive `has_plan('plus')` on insert to `recipes`, `recipe_ingredients`, `meal_plans`, `meal_plan_entries`, `meal_plan_settings`, `grocery_lists`, `grocery_items` (`20261023000024_plan_enforcement.sql:92-97`) | `assertFeature(meal_planning)` in each file's `ctx()` (`recipes.ts:28`, `meal-plan.ts:28`, `grocery.ts:19`) | `nutritionPageUser` (`src/components/nutrition/nutrition-page.tsx:15`) on every planner, recipe and grocery page | PE, PB, FUDA, `recipes-planner`, **SC** (REST inserts into `meal_plan_settings`, `grocery_items`, `meal_plan_entries`, `recipe_ingredients` → 42501, Pro control 201; `planAlternativesAction` refused) |
| **Calendar rescheduling** | Restrictive insert **and** update on `planned_session_overrides` (`20261023000024…:103-106`) | `movePlannedSessionAction` / `skipMissedSessionsAction` (`src/server/actions/calendar.ts:26`, `:76`) | `calendar/page.tsx:35` | FUDA, **SC** (REST insert → 42501; REST update of an existing override changes nothing; `skipMissedSessionsAction` refused) |
| **Advanced analytics** (strength progression, muscle map / ranks) | None needed: computed from the member's own rows; the rank preference is only read on the gated page | Server-rendered only for entitled members (`progress/overview/page.tsx:48`, `:82-85`); `setStrengthStandardsAction` (`body-map.ts:17`) | `progress/body-map/page.tsx:16`; exercise history `train/exercises/[slug]/history/page.tsx:56` | FUDA |
| **Weekly report** | No insert policy: no member, Free or Pro, can create one | Created only by the scheduled job for Pro members (`weekly-reports.ts:240`) | `progress/reports/page.tsx:20` | `weekly-reports`, **SC** (REST insert → 403 for Free and Pro) |
| **Progress-photo comparisons** | None: comparison runs in the browser over the member's own photos | **None (UI-only)**: the server does no comparison work | `canCompare` (`src/components/progress/progress-photos.tsx:489-497`) from `progress/overview/page.tsx:316` | Read in code |
| **Advanced sleep** (breakdowns, debt, schedule, energy, history comparisons, sleep-and-training) | None needed: no table holds the analysis | Computed only inside server components for entitled members: `progress/sleep/page.tsx:70,111`, `debt/page.tsx:22`, `energy/page.tsx:22`, `schedule/page.tsx:20`, `history/page.tsx:28,62`, `night/[date]/page.tsx:67,131`, `training/page.tsx:21` (`sleep_ai_coaching`). There is no action or API that returns the analysis. Accepting a sleep-aware suggestion goes through `adaptive-training` (`requireAdaptive`). | Same pages (locked screens) | Read in code |
| **Body Scan** | `can_add_body_scan()` (Pro **and** consent) on rows and on the bucket (`20261024000031_body_scans.sql:12`, `:98`) | `giveBodyScanConsentAction` / `saveBodyScanAction` (`body-scan.ts:19`, `:68`) | `progress/body-scan/page.tsx:27` | `body-scans`, FUDA, **SC** (consent written straight to `profiles` (an allowed column) still yields no scan row or upload; `saveBodyScanAction` refused; Pro control 201) |
| **Food comparisons / filters** | None (a preference; read only on gated pages) | `setFoodFiltersAction` (`food-quality.ts:22`); filters are applied only when `food_comparisons` holds (`nutrition/product/[code]/page.tsx:97`, `scanner/page.tsx:27`) | `nutrition/compare/page.tsx:24` | FUDA |

### 1.2 What a Free member could read or write directly with their own JWT

Checked on the live catalog: every policy, trigger and column grant on the tables above.

- **Write.** Every Pro-only table refuses a new row:
  - permissive or restrictive plan policy → 42501;
  - plan trigger (GPS, templates) → P0001;
  - no insert policy at all (`weekly_reports`, `bible_ai_messages`, `meal_plan_drafts`, all billing tables).
- **Rows from an earlier Pro period stay editable and deletable,** as `docs/MEMBERSHIPS.md` promises: update policies on
  recipes, plans and grocery items have no plan check. This is deliberate. It gives no new Pro capability, because new
  plan rows and new entries are refused.
- **Allowed profile columns.** A Free member can set `body_scan_consent_at`, `food_photo_consent_at`, `food_filters`
  and `strength_standards` directly. None of them opens anything:
  - consent is ANDed with the plan in the database and on the server (tested in SC);
  - filters and ranks are read only behind a server-side plan check.
- **Read.**
  - A Free member can read week and day names of published Pro programs (an intentional preview, PE). They cannot read
    the prescriptions (`program_exercises` → `[]`, PE and SC), another member's anything (`cross-user-isolation`), or
    anyone's plan (`plan_of` revoked).
  - A member who drops to Free keeps reading weekly reports made while they were Pro
    (`progress/reports/[week]/page.tsx`, no plan check). This is open owner decision 1, carried over from the 11-14
    audit.

### 1.3 Server actions with no plan check of their own

`setHabitActivityAction` relies on the database (42501, surfaced as "Ticking off activities is included with Pro"; SC).
`setCoachStyleAction` stores a tone preference that only the gated coach uses. `resetPlannedSessionAction` and the
delete actions are open on every plan by design, so a downgrade never strands data. None of these performs a Pro action
for a Free member.

### 1.4 UI-only gates

The two UI-only gates are progress-photo comparisons and the sleep breakdown text. In both, the server performs no Pro
work, so neither is a defect under this pass's rule. The comparison view is drawn in the browser from photos the member
may already see. The sleep breakdown is rendered on the server only when entitled.

## 2. Webhooks

### 2.1 Stripe (`src/app/api/stripe/webhook/route.ts`, `src/server/services/billing.ts`)

| Topic | Evidence | Tests |
|---|---|---|
| Verification | 503 when not configured (`route.ts:20-21`); missing `stripe-signature` → 400 (`:23-24`); body over 512 KB → 413 before and after reading (`:25-28`); `constructEvent` over the raw body with the 5-minute tolerance (`:30-34`); shape check (`:35-37`) | `entitlements` (unsigned, bad signature), `billing-integrity` (attacker secret, tampered body, expired timestamp, oversized, non-JSON: no event row, no plan) |
| Who the subscription belongs to | The customer→member link recorded by this server is authoritative; metadata naming someone else → `OwnershipConflictError` (`billing.ts:251-273`); stored owner can't be changed (`upsert_stripe_subscription` → `owner_conflict`) | `billing-integrity` (metadata can't move or grant; foreign customer refused) |
| Idempotency / replay | `claim_webhook_event` per event id (`20261101000046_billing_integrity.sql:46`), lease 120 s, `failed` kept for retry (`src/server/services/webhook-events.ts:18-65`); route 409 while busy (`route.ts:40`) | `entitlements`, `billing-integrity` (8 concurrent deliveries → processed once; lease takeover; failure recorded then retried), **SC** (replay of the creation event after cancellation → `duplicate: true`, stays Free) |
| Ordering | Every subscription event re-reads Stripe (`billing.ts:423-434`, `currentSubscription` `:571-580`). The write is ordered by read time (`upsert_stripe_subscription` stale check, migration 046 `:237`). The entitlement is compare-and-set on a version (`apply_entitlement` `:170-200`). | `billing-integrity` (stale read, concurrency convergence, compare-and-set), `entitlements` (late "incomplete"), **SC** (a late "unpaid" snapshot doesn't downgrade a paying member; a late "active" snapshot doesn't revive a cancelled one) |
| Expiry | `valid_until` = period end; `plan_of` treats a past `valid_until` as Free without a webhook | `subscription-lifecycle`, **SC** (cancelled at period end: Pro with `valid_until` = period end; after `customer.subscription.deleted` the member's own REST insert into `recipes` → 42501) |
| Cancel at period end vs immediate | `cancel_at_period_end` stored; status `canceled` ends access at once even if the period end lies ahead | `subscription-lifecycle`, `entitlements` ("immediately cancelled… ends access at once"), **SC** |
| Billing issue / grace | `past_due` keeps access for at most 14 days from the unpaid period's start (`PAST_DUE_GRACE_DAYS`, `src/lib/domain/plans.ts:220`; `billing.ts:318`); `unpaid`, `paused`, `incomplete` give nothing | `tests/unit/plans.test.ts:131-170`, `subscription-lifecycle`, **SC** (integration: 5 days into the unpaid period → Pro with `valid_until` ≈ +9 days; 20 days in → Free) |
| Refund / dispute | Full refund or dispute of the current period's payment revokes (`revokeForCharge` `billing.ts:506-525`); a partial refund or an earlier period's refund doesn't; a won dispute restores; a late `invoice.paid` for an older invoice can't restore (`invoiceIsNewerThan` `:534-544`) | `entitlements` (4 tests) |
| Restore | Not applicable: a subscription is never moved between members | — |
| Safety net | `/api/billing/reconcile` (`CRON_SECRET`) re-reads stale subscriptions | `billing-integrity` |

### 2.2 RevenueCat (`src/app/api/revenuecat/webhook/route.ts`, `src/server/services/store-billing.ts`)

| Topic | Evidence | Tests |
|---|---|---|
| Verification | 503 when not configured (`route.ts:15-17`); `Authorization` compared in constant time over SHA-256 digests (`store-billing.ts:37-43`) **before** the body is read (`route.ts:18`); 256 KB cap (`:19-21`); Zod schema (`:28-29`) | `store-billing` (missing/wrong → 401, bad bodies 400, oversized 413), **SC** (lower-cased, missing the `Bearer ` prefix, doubled space, one character short or long, empty, absent → 401 with no RevenueCat lookup) |
| The body is never trusted | Every event re-reads each affected member from RevenueCat's REST API (`handleRevenueCatEvent` `:105-114`, `syncStoreSubscriber` `:76-97`). Only UUIDs that are profiles are looked up (`:78-80`; `affectedAppUserIds` `src/lib/billing/revenuecat.ts:93-96`). | `billing-integrity` (a replayed purchase claim grants nothing), `store-billing` (non-member id → no lookup) |
| Idempotency / replay | Same claim table (`revenuecat_events`) | `store-billing`, `billing-integrity` (6 concurrent deliveries → once), **SC** (purchase replayed after expiry → `duplicate`, stays Free) |
| Ordering | Whole-customer snapshot ordered by read time (`apply_store_snapshot`, migration 046 `:263-278`); because the server re-reads, the event's own order is irrelevant | `billing-integrity` (older snapshot → `stale`), **SC** (late RENEWAL after EXPIRATION stays Free; late EXPIRATION after a resubscription stays Pro) |
| Expiry | `expires_date` (or grace) → `valid_until`; past → Free | `store-billing` |
| Cancellation | `unsubscribe_detected_at`: access to the period end | `store-billing` |
| Billing issue / grace | Access to the later of expiry and `grace_period_expires_date`; inside it reads as `past_due` (`revenuecat.ts:172-177`) | `store-billing` (in grace → Pro), **SC** (grace run out → Free) |
| Refund | `refunded_at` of the current purchase ends access at the refund time (`revenuecat.ts:165-170`) | `store-billing`, **SC** (refund → Free, and the database refuses the member's next Pro insert) |
| Restore / transfer / alias | All of `app_user_id`, `original_app_user_id`, `aliases`, `transferred_from`, `transferred_to` that are members are re-read; the whole snapshot replaces the member's rows, so a moved purchase stops granting on the old account | `store-billing` (TRANSFER updates both), **SC** (anonymous `app_user_id` with the member as an alias → only the member is read, gets Pro) |
| Sandbox | Counted only for allow-listed testers or on a non-production deployment | `store-billing` "sandbox tester allow-list" (8 tests) |
| Restore button | `syncStorePurchasesAction` takes no member id, re-reads only the session's member, 10/min (`src/server/actions/store-billing.ts:16-29`) | **SC** (nothing on RevenueCat → Free; only this member is looked up; a real purchase on record → Pro) |

### 2.3 The client can never grant itself a plan

- **No member write paths into billing state.** `user_entitlements`, `subscriptions`, `store_subscriptions`,
  `billing_customers`, `legacy_plan_terms` and `sandbox_testers` are SELECT-only or have no policy. `billing_state_versions`,
  `store_sync_state` and the two event tables have no policy at all. (`billing-integrity`, `pro-bypass`.)
- **Billing functions are service-role only.** `apply_entitlement`, `upsert_stripe_subscription`,
  `apply_store_snapshot`, `claim_webhook_event`, `finish_webhook_event`, `rate_limit_hit`, `reserve_ai_usage` and the
  rest (migration 046 `:385-396`). `api-function-surface` calls all 20 as a member and as a visitor and requires
  `42501`.
- **No route or action takes a plan, tier or user id from the request.** A plan claimed in cookies, the body or user
  metadata changes nothing (FUDA, PB).
- **The demo switch is inert.** It needs `DEMO_MODE` and `app_metadata.demo` (FUDA).

## 3. Account deletion vs billing

| Question | Answer and evidence | Tests |
|---|---|---|
| Is Stripe cancelled first, and does deletion stop if that fails? | Yes. `deleteUserAccount` (`src/server/services/account-deletion.ts`, lines as of this pass) does the following in order. **(1)** Reads the customer id (`:50`), and stops if it can't. **(2)** `cancelStripeSubscriptionsForUser` (`:58`; `billing.ts:597-621`) cancels every open subscription in the local table **and** in Stripe's own list for the customer, and stops on any failure; without a usable Stripe key, an open subscription on record also stops it (`:624-638`). **(3)** Storage (`:65`). **(4)** The auth user (`:74`). **(5)** Rate-limit counters (`:81`, added by the parallel deletion pass). **(6)** The Stripe customer and the RevenueCat customer (`:89`, `:99`). | `account-deletion-billing` (no Stripe key), `tests/unit/account-deletion.test.ts`, `account-deletion-closure` (order with stubs), **SC**. Against the Stripe stand-in: both a stored subscription and one known only to Stripe are cancelled while the account still exists; then the customer is deleted. A failing cancel stops everything: account, active subscription and Pro plan remain, and no customer is deleted. |
| Store subscriptions | The app cannot cancel them. Only the RevenueCat customer record is deleted (`store-billing.ts:60-68`). | **SC** (the last RevenueCat call is `DELETE` of the member) |
| Does the wording tell the member? | Yes. In the delete form, always shown: "If you subscribed through the App Store or Google Play, deleting your account doesn't stop those charges: cancel in your iPhone's Settings → your name → Subscriptions, or in Google Play → Payments & subscriptions" (`src/components/profile/profile-forms.tsx:179-182`). A targeted alert is added when the current entitlement comes from a store (`src/app/(app)/profile/page.tsx:61-62`, `:168-173`). | `e2e` per `MOBILE_BILLING.md` (not run here; read in code) |
| Entitlement rows | `user_entitlements`, `subscriptions`, `store_subscriptions`, `billing_customers`, `billing_state_versions`, `store_sync_state` and `legacy_plan_terms` all reference `auth.users` with `on delete cascade` (live `pg_constraint`), and are gone with the account | **SC** (all seven at 0 after deletion) |
| Webhook after deletion | **Stripe:** `customer.subscription.deleted`, `customer.subscription.updated` (an "orphan" still active in Stripe), `checkout.session.completed` and `invoice.paid` naming the deleted id are all answered 200. They write no subscription, customer link, entitlement or version row: `userIdForSubscription` finds no member. **RevenueCat:** RENEWAL, EXPIRATION and TRANSFER naming the deleted id are answered 200 and recorded `processed`, with **no** RevenueCat lookup (`store-billing.ts:78-80`); a lookup would recreate the customer at RevenueCat. The foreign keys make a racing write impossible. | **SC** (two tests). A mutation check (removing the profile guard) made the RevenueCat test fail. |

## 4. Defects

**None found; nothing changed in `src/` or `supabase/`.** Observations, not defects:

| # | Observation | Why not a defect | Suggested follow-up |
|---|---|---|---|
| N1 | The targeted store-billing alert on the deletion screen keys on the entitlement's `source`. A member paying on both web and store (`source = stripe`), or a store subscriber past grace whose store is still retrying, sees only the general text. | The general text naming both stores is always shown in the form. | Optional: key the alert on any `store_subscriptions` row with a future `expires_at`. |
| N2 | A RevenueCat sync can be in flight when the account is deleted. If its RevenueCat GET runs after step 6, RevenueCat recreates an empty customer, and the database write then fails on the foreign key (the event is retried, then ignored). | Nothing in this database survives, and the RevenueCat record is empty. | Note for the deletion runbook. |
| N3 | An orphan Stripe subscription (created after step 2, when the step-6 customer deletion also failed) would keep billing. Its webhooks are ignored, and logged as "Subscription without a known member". | Requires two failures and a race. Deleting a customer in Stripe cancels its subscriptions. | Alert on `billing.sync` "Subscription without a known member" in production logs. |
| N4 | HTTP strips leading and trailing spaces from header values. A RevenueCat `Authorization` value with extra outer spaces is therefore treated as the configured value. | Platform behaviour (RFC 9110 field values); the secret itself must still match exactly. | None. |
| N5 | `FAMILY_SHARED` store purchases are treated like purchases: they grant Pro. | Correct if Family Sharing is switched on in App Store Connect; it is off unless the owner enables it. | Owner decision (section 5). |

Open owner decisions, carried over and not re-opened: (1) Free members keep reading reports made while they were Pro;
(2) a full Stripe refund leaves the subscription running unless the owner cancels it in Stripe (O8 in the 11-14 audit).

## 5. Requires real sandbox testing

Everything above ran against local stand-ins for Stripe's and RevenueCat's REST APIs, with webhooks constructed and
signed in-process. **Native purchases have not been shown to work.** These need real accounts, devices or dashboards:

1. **StoreKit purchase** on an iPhone (sandbox tester on the allow-list): `ngf_pro_monthly` / `ngf_pro_yearly` appear
   at the store's price, purchase unlocks Pro, and the RevenueCat webhook reaches `/api/revenuecat/webhook` with 200.
2. **Google Play Billing purchase** with a licence tester: `ngf_pro:monthly` / `:yearly`, same checks; the merged
   manifest carries `com.android.vending.BILLING`.
3. **Restore purchases** after reinstalling, and on a second Narrow Gate account with the same Apple ID or Google
   account (RevenueCat's transfer behaviour depends on the project's "restore behaviour" setting).
4. **Family Sharing**: whether it is enabled for the products, and that a family member's `FAMILY_SHARED` entitlement
   arrives as expected (N5).
5. **Refunds through Apple / Google**: Apple refund (sandbox or StoreKit testing) and a Play refund or revoke. Check
   that RevenueCat reports `refunded_at` and that access ends.
6. **Renewal timing**: accelerated sandbox renewals, the cancel-at-period-end display, expiry, the billing-retry and
   grace period settings (App Store Connect billing grace period; Play grace and account hold), and
   upgrade/crossgrade timing.
7. **RevenueCat dashboard configuration**:
   - entitlement ids `pro` (and `plus` for legacy only);
   - products attached and offering present;
   - webhook URL and the exact `Authorization` value (= `REVENUECAT_WEBHOOK_AUTH`);
   - App Store Connect API / in-app purchase key and Play service credentials;
   - "transfer" restore behaviour;
   - sandbox events delivered to the same webhook.
8. **Stripe live mode**, once the owner approves it (`STRIPE_LIVE_APPROVED`):
   - live price ids match $17.99 / $119.99;
   - the live webhook endpoint and its secret;
   - the Customer Portal configuration (cancel at period end vs immediately; plan switching);
   - real refund and dispute events;
   - the reconcile cron on the host.
9. **Account deletion on a device** while subscribed: the warning is visible, the Stripe subscription is cancelled in
   the Dashboard, and the App Store subscription keeps billing until it is cancelled in Settings, as the warning says.

## 6. Commands run

| Command | Result |
|---|---|
| `psql` catalog queries (policies, triggers, column grants, functions, foreign keys) | Basis of sections 1–3 |
| `npx vitest run --project integration tests/integration/subscription-closure.test.ts` | 17 passed, 0 failed, 0 skipped |
| Same file, with the profile guard in `syncStoreSubscriber` temporarily removed (`-t "deleted member"`) | 1 failed (as expected), then the file was restored byte for byte |
| `npx tsc --noEmit` | exit 0, no errors |
| `npx eslint src tests` | exit 0, no findings |
| `npx vitest run --project integration` (whole suite, run once after all changes, alongside other workers' uncommitted files in this worktree) | **84 files: 83 passed, 1 skipped; 514 tests: 513 passed, 1 skipped, 0 failed.** The skipped test is `food-quality-live.test.ts` (needs live Open Food Facts network; skipped by design). Skips are not counted as passes. |

Not run (per instructions): `npm run build`, Playwright e2e, `supabase db reset`. Unit suite not re-run (no product code changed).
