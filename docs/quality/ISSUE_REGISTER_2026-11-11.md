# Issue register — finalization pass, 2026-11-11

Branch `claude/finalization-qa` (from `claude/premium-2d-exercise-animations`, which carries the unmerged PR #9 and
PR #10 work). Four read-only code audits were run against this branch; findings already recorded as fixed or accepted
in earlier audit documents were excluded. **No Critical or High defect was found.** Evidence is file and line as read
on the branch; "Status" is updated as fixes land. Nothing here was verified on a physical device.

Severity: M = Medium, L = Low. Status: Open, Fixing, Fixed, Owner decision, Needs sandbox.

## Security, accounts, privacy

| # | Sev | Defect | Evidence | Proposed repair | Status |
|---|---|---|---|---|---|
| S1 | M | Bible study helper sends questions to the AI provider without checking AI-data consent or the AI kill switch | `src/server/actions/bible-ai.ts:9-15`, `src/server/services/bible-ai.ts:72-98` | Check `ai_data_consent_at` and the `ai_coach` flag before any provider call | Fixing |
| S2 | M/L | Anyone who knows a member's email can lock them out of sign-in and password reset (limits keyed on email only) | `src/server/actions/auth.ts:78,108,135` | Key the tight limit on email + IP; higher email-only ceiling | Fixing |
| S3 | L | Email addresses can reach server logs through raw auth error messages | `src/server/actions/auth.ts:63,144`, `src/server/log.ts:16` | Redact inside `logError` | Fixing |
| S4 | L | Sign-out leaves the in-progress workout draft on a shared device | `src/lib/drafts.ts:93`, `src/lib/workout-storage.ts:5` | Clear the workout draft prefixes on sign-out | Fixing |

Checked clean: account deletion (path, typed confirmation plus password, what-is-deleted text, store-subscription
guidance before deletion, cascade of every user table in migrations 044–057, storage buckets, session revocation);
row-level security on migrations 044–057; all 14 API routes authenticate and scope to the session user; secrets;
logging of prayer, journal, health data and tokens.

## Billing, entitlements, AI coach

| # | Sev | Defect | Evidence | Proposed repair | Status |
|---|---|---|---|---|---|
| B1 | M | Google Play billing interval is probably not recognised server-side (RevenueCat reports the base plan in a field the schema drops) | `src/lib/billing/paywall.ts:26-28,47-50`, `src/server/services/store-billing.ts:121`, `src/lib/billing/revenuecat.ts:33-46` | Parse `product_plan_identifier` for Play rows | Needs sandbox (rests on external API behaviour not reproduced) |
| B2 | M | Bible helper answers can be truncated or empty: 700-token cap, no stop-reason handling | `src/lib/bible/ai.ts:104`, `src/server/services/bible-ai.ts:90-103` | Raise the cap; handle `max_tokens` and `refusal` | Fixing |
| B3 | M | Pro access after a failed Stripe renewal is unbounded (runs to the already-advanced period end) | `src/lib/domain/plans.ts:210-221` | Cap `past_due` at a 14-day grace period | Fixing |
| B4 | M/L | A chat turn can outlive the route limit, leaving the request charged and retries blocked for minutes | `src/server/services/ai-coach.ts:85,260`, `src/app/api/ai/chat/route.ts:8,81-90` | Deadline signal, fewer retries, release usage | Fixing |
| B5 | L | GPS upsell hardcodes USD prices, including inside the native app | `src/components/run/gps-recorder.tsx:59-61,492` | Price line from the server, omitted on native | Fixing |
| B6 | L | Legacy yearly Stripe prices are labelled "Monthly" | `src/server/services/billing.ts:95-99` | Real interval or no label | Fixing |
| B7 | L | Membership screen: savings shown as a percentage only; Restore Purchases only on the native paywall; Manage Subscription is instructions-only across platforms | `src/app/(app)/profile/billing/page.tsx`, `web-membership.tsx`, `store-paywall.tsx` | Show the dollar saving; review the cross-platform manage path | Open |

Checked clean: every displayed price is $0 / $19.99 / $149.99 and annual is never shown as a monthly charge; savings
maths (37%); Stripe and RevenueCat webhook verification, idempotency, expiry, cancellation, refund, dispute and
transfer handling; server-side gating of every Pro feature sampled; coach model ids, server-only key, quota and rate
limit under a per-member lock, request idempotency, token caps, history trimming, safety guardrails; all 17 coach
tools are read-only or proposals that need explicit confirmation.

## Nutrition, GPS, health, notifications

| # | Sev | Defect | Evidence | Proposed repair | Status |
|---|---|---|---|---|---|
| N1 | H/M | A finished but unsaved GPS run is deleted from the device 12 hours after it started, despite the app saying it is kept | `src/lib/domain/gps-track.ts:580-582`, `src/components/run/gps-recorder.tsx:193-194` | Exempt finished drafts up to the server's save limit | Fixing |
| N2 | M | GPS-recorded runs cannot be edited at all (notes and effort are promised to stay editable) | `src/app/(app)/run/activities/[id]/edit/page.tsx:20`, `src/server/actions/activities.ts:157` | Notes/effort-only edit path for GPS runs | Fixing |
| N3 | M | Food logging loses the entry (and its retry id) when the save fails offline | `nutrition-client.tsx:313-349`, `diary-client.tsx:57-80`, `quick-relog.tsx:36-39`, `recipe-log-form.tsx:33-37`, `food-photo-flow.tsx:222-241` | Catch, keep the dialog and id, inline retry message | Fixing |
| N4 | M | USDA foods store missing macros as real zeros | `src/server/services/food-database.ts:63-65`, `src/app/api/foods/search/route.ts:60`, `src/server/services/food-resolve.ts:96` | Record them in `basis.missing` | Fixing |
| N5 | L/M | Barcode products re-logged from My foods lose their missing-value flags, sugar, sodium and label serving | `food-resolve.ts:114-137`, `src/lib/domain/food-basis.ts:103-134` | Store the basis on `foods` (schema change) | Open |
| N6 | L/M | A Health sync overwrites a hand-entered step count | `src/server/actions/steps.ts:76-79` | Keep manual days | Fixing |
| N7 | L | Retries of relog, saved-meal, copy-day, recipe and water logging are not idempotent | `src/server/actions/nutrition.ts:329,367,441,482`, `recipes.ts:157` | Client ids where the schema already supports them | Fixing (partial; rest needs schema) |
| N8 | L | Daily calories can differ from the visible rows by 1 kcal | `nutrition.ts:43,78`, `nutrition/page.tsx:133,291` | Round on write | Fixing |

Checked clean: serving and unit maths; kcal vs kJ; barcode unknown / no-nutrition / network-failure / camera-denied
paths (message plus manual entry, no invented values); Nutrition Score wording; GPS distance, pace, pause and jump
filtering; Free view and delete of runs; sleep import duplicates; reminder planner (time zone, quiet hours, pause).

## Training, faith, progress

| # | Sev | Defect | Evidence | Proposed repair | Status |
|---|---|---|---|---|---|
| T1 | M | Offline reading-journey check-ins are silently dropped on a server error, which can cause an undeserved Day-1 restart | `src/components/faith/journey-checkin.tsx:80-92`, `src/server/actions/journeys.ts:29-32` | Keep queued on error, toast on refusals, flush from the app shell | Fixing |
| T2 | M | Body measurements cannot be deleted or corrected | `src/server/actions/progress.ts:46-70` | Delete action and recent-entries list | Fixing |
| T3 | M | Weight entries older than the 8 most recent cannot be deleted | `src/app/(app)/progress/overview/page.tsx:270` | Reach all entries | Fixing |
| T4 | M | Home/Progress streaks cap at about 18 weeks / 120 days while badges use full history | `src/server/services/dashboard.ts:25,28,49-50` | Use full history for streaks | Fixing |
| T5 | M | Shared `ActionButton` has no error path; several delete actions ignore database errors | `src/components/common/action-button.tsx:44-50`, `progress.ts:38-44`, `faith.ts:68-73,162-186` | Return results, toast on failure | Fixing |
| T6 | L/M | Deleting a workout can leave its personal records behind | `src/server/services/workouts.ts:386-392` | Delete the records first; rebuild on not-found | Fixing |
| T7 | L | Workout editor loses unsaved edits on a network failure | `src/components/workout/workout-editor.tsx:79-110` | Catch and keep edits | Fixing |
| T8 | L | First workout: reps prefilled, weight blank, so one tap can log a zero-load set on a barbell lift | `src/lib/domain/workout-draft.ts:110-114`, `src/lib/domain/strength.ts:60-61` | Prompt for weight or prefill a starter load | Owner decision |
| T9 | L | Personal bests table reads only the newest 1,000 record rows | `src/server/services/progress.ts:124-129` | Page the query | Fixing |
| T10 | L | Changing the profile time zone mid-journey reopens a closed day | migration 053 (`faith_journey_check_in_at`), `src/server/actions/profile.ts:35-47` | Snapshot the zone on the journey (schema change, touches the strict rule) | Owner decision |

Checked clean: all five reading-plan lengths cover the whole Bible once with no gaps or duplicates; the strict restart
rule is shown and acknowledged before starting, enforced on the server and in the database, and keeps history; workout
volume, estimated 1RM and personal-record maths; double-tap and finish idempotency; progress-photo deletion removes
the stored file; Bible text comes from the bundled BSB with attribution; every internal link resolves.

## Observations for the owner (not defects)

- Onboarding has five required screens but about ten required inputs (the "About you" screen asks name, sex, age,
  units, height and weight), then lands on the plan page, not directly in the first workout.
- The 40-day challenge itself allows catch-up and has only a manual restart; the strict automatic Day-1 restart
  belongs to the reading journeys. Both behave as documented.
- Prayer journal entries reach the AI coach only when the member flags an entry "share with coach".
