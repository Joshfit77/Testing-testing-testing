# Issue register — finalization pass, 2026-11-11

Branch `claude/finalization-qa` (from `claude/premium-2d-exercise-animations`, which carries the unmerged PR #9 and
PR #10 work). Four read-only code audits were run against this branch; findings already recorded as fixed or accepted
in earlier audit documents were excluded. **No Critical or High defect was found.** Evidence is file and line as read
on the branch; "Status" is updated as fixes land. Nothing here was verified on a physical device.

Severity: M = Medium, L = Low. Status: Open, Fixing, Fixed, Owner decision, Needs sandbox.

## Security, accounts, privacy

| # | Sev | Defect | Evidence | Proposed repair | Status |
|---|---|---|---|---|---|
| S1 | M | Bible study helper sends questions to the AI provider without checking AI-data consent or the AI kill switch | `src/server/actions/bible-ai.ts:9-15`, `src/server/services/bible-ai.ts:72-98` | Check `ai_data_consent_at` and the `ai_coach` flag before any provider call | Fixed |
| S2 | M/L | Anyone who knows a member's email can lock them out of sign-in and password reset (limits keyed on email only) | `src/server/actions/auth.ts:78,108,135` | Key the tight limit on email + IP; higher email-only ceiling | Fixed |
| S3 | L | Email addresses can reach server logs through raw auth error messages | `src/server/actions/auth.ts:63,144`, `src/server/log.ts:16` | Redact inside `logError` | Fixed |
| S4 | L | Sign-out leaves the in-progress workout draft on a shared device | `src/lib/drafts.ts:93`, `src/lib/workout-storage.ts:5` | Clear the workout draft prefixes on sign-out | Fixed |

Checked clean: account deletion (path, typed confirmation plus password, what-is-deleted text, store-subscription
guidance before deletion, cascade of every user table in migrations 044–057, storage buckets, session revocation);
row-level security on migrations 044–057; all 14 API routes authenticate and scope to the session user; secrets;
logging of prayer, journal, health data and tokens.

## Billing, entitlements, AI coach

| # | Sev | Defect | Evidence | Proposed repair | Status |
|---|---|---|---|---|---|
| B1 | M | Google Play billing interval is probably not recognised server-side (RevenueCat reports the base plan in a field the schema drops) | `src/lib/billing/paywall.ts:26-28,47-50`, `src/server/services/store-billing.ts:121`, `src/lib/billing/revenuecat.ts:33-46` | Parse `product_plan_identifier` for Play rows | Needs sandbox (rests on external API behaviour not reproduced) |
| B2 | M | Bible helper answers can be truncated or empty: 700-token cap, no stop-reason handling | `src/lib/bible/ai.ts:104`, `src/server/services/bible-ai.ts:90-103` | Raise the cap; handle `max_tokens` and `refusal` | Fixed |
| B3 | M | Pro access after a failed Stripe renewal is unbounded (runs to the already-advanced period end) | `src/lib/domain/plans.ts:210-221` | Cap `past_due` at a 14-day grace period | Fixed |
| B4 | M/L | A chat turn can outlive the route limit, leaving the request charged and retries blocked for minutes | `src/server/services/ai-coach.ts:85,260`, `src/app/api/ai/chat/route.ts:8,81-90` | Deadline signal, fewer retries, release usage | Fixed |
| B5 | L | GPS upsell hardcodes USD prices, including inside the native app | `src/components/run/gps-recorder.tsx:59-61,492` | Price line from the server, omitted on native | Fixed |
| B6 | L | Legacy yearly Stripe prices are labelled "Monthly" | `src/server/services/billing.ts:95-99` | Real interval or no label | Fixed |
| B7 | L | Membership screen: savings shown as a percentage only; Restore Purchases only on the native paywall; Manage Subscription is instructions-only across platforms | `src/app/(app)/profile/billing/page.tsx`, `web-membership.tsx`, `store-paywall.tsx` | Show the dollar saving; review the cross-platform manage path | Fixed 2026-11-12: yearly card shows "$89.89 less than 12 monthly payments" (computed from the prices shown, never hard-coded); the website offers Restore purchases (server re-checks the store records) and a direct link to Apple's / Google's subscription page for store-billed members. On iPhone/Android, Manage stays for purchases made in that store only (no links to buy or manage elsewhere, App Store 3.1.1). Prices unchanged: $0 / $19.99 / $149.99 |

Checked clean: every displayed price is $0 / $19.99 / $149.99 and annual is never shown as a monthly charge; savings
maths (37%); Stripe and RevenueCat webhook verification, idempotency, expiry, cancellation, refund, dispute and
transfer handling; server-side gating of every Pro feature sampled; coach model ids, server-only key, quota and rate
limit under a per-member lock, request idempotency, token caps, history trimming, safety guardrails; all 17 coach
tools are read-only or proposals that need explicit confirmation.

## Nutrition, GPS, health, notifications

| # | Sev | Defect | Evidence | Proposed repair | Status |
|---|---|---|---|---|---|
| N1 | H/M | A finished but unsaved GPS run is deleted from the device 12 hours after it started, despite the app saying it is kept | `src/lib/domain/gps-track.ts:580-582`, `src/components/run/gps-recorder.tsx:193-194` | Exempt finished drafts up to the server's save limit | Fixed |
| N2 | M | GPS-recorded runs cannot be edited at all (notes and effort are promised to stay editable) | `src/app/(app)/run/activities/[id]/edit/page.tsx:20`, `src/server/actions/activities.ts:157` | Notes/effort-only edit path for GPS runs | Fixed |
| N3 | M | Food logging loses the entry (and its retry id) when the save fails offline | `nutrition-client.tsx:313-349`, `diary-client.tsx:57-80`, `quick-relog.tsx:36-39`, `recipe-log-form.tsx:33-37`, `food-photo-flow.tsx:222-241` | Catch, keep the dialog and id, inline retry message | Fixed |
| N4 | M | USDA foods store missing macros as real zeros | `src/server/services/food-database.ts:63-65`, `src/app/api/foods/search/route.ts:60`, `src/server/services/food-resolve.ts:96` | Record them in `basis.missing` | Fixed |
| N5 | L/M | Barcode products re-logged from My foods lose their missing-value flags, sugar, sodium and label serving | `food-resolve.ts:114-137`, `src/lib/domain/food-basis.ts:103-134` | Store the basis on `foods` (schema change) | Fixed on `claude/rc-verification` (migration 059) |
| N6 | L/M | A Health sync overwrites a hand-entered step count | `src/server/actions/steps.ts:76-79` | Keep manual days | Fixed |
| N7 | L | Retries of relog, saved-meal, copy-day, recipe and water logging are not idempotent | `src/server/actions/nutrition.ts:329,367,441,482`, `recipes.ts:157` | Client ids where the schema already supports them | Fixed for relog, saved meal, copy day and recipe; water fixed on `claude/rc-verification` (migration 058) |
| N8 | L | Daily calories can differ from the visible rows by 1 kcal | `nutrition.ts:43,78`, `nutrition/page.tsx:133,291` | Round on write | Fixed |

Checked clean: serving and unit maths; kcal vs kJ; barcode unknown / no-nutrition / network-failure / camera-denied
paths (message plus manual entry, no invented values); Nutrition Score wording; GPS distance, pace, pause and jump
filtering; Free view and delete of runs; sleep import duplicates; reminder planner (time zone, quiet hours, pause).

## Training, faith, progress

| # | Sev | Defect | Evidence | Proposed repair | Status |
|---|---|---|---|---|---|
| T1 | M | Offline reading-journey check-ins are silently dropped on a server error, which can cause an undeserved Day-1 restart | `src/components/faith/journey-checkin.tsx:80-92`, `src/server/actions/journeys.ts:29-32` | Keep queued on error, toast on refusals, flush from the app shell | Fixed |
| T2 | M | Body measurements cannot be deleted or corrected | `src/server/actions/progress.ts:46-70` | Delete action and recent-entries list | Fixed |
| T3 | M | Weight entries older than the 8 most recent cannot be deleted | `src/app/(app)/progress/overview/page.tsx:270` | Reach all entries | Fixed |
| T4 | M | Home/Progress streaks cap at about 18 weeks / 120 days while badges use full history | `src/server/services/dashboard.ts:25,28,49-50` | Use full history for streaks | Fixed |
| T5 | M | Shared `ActionButton` has no error path; several delete actions ignore database errors | `src/components/common/action-button.tsx:44-50`, `progress.ts:38-44`, `faith.ts:68-73,162-186` | Return results, toast on failure | Fixed |
| T6 | L/M | Deleting a workout can leave its personal records behind | `src/server/services/workouts.ts:386-392` | Delete the records first; rebuild on not-found | Fixed |
| T7 | L | Workout editor loses unsaved edits on a network failure | `src/components/workout/workout-editor.tsx:79-110` | Catch and keep edits | Fixed |
| T8 | L | First workout: reps prefilled, weight blank, so one tap can log a zero-load set on a barbell lift | `src/lib/domain/workout-draft.ts:110-114`, `src/lib/domain/strength.ts:60-61` | Prompt for weight or prefill a starter load | Fixed: owner decided 2026-11-12 — a loaded lift asks for its weight or an explicit 'no added weight' before a set is logged; no weight is ever invented |
| T9 | L | Personal bests table reads only the newest 1,000 record rows | `src/server/services/progress.ts:124-129` | Page the query | Fixed |
| T10 | L | Changing the profile time zone mid-journey reopens a closed day | migration 053 (`faith_journey_check_in_at`), `src/server/actions/profile.ts:35-47` | Snapshot the zone on the journey (schema change, touches the strict rule) | Fixed (migration 061): owner decided 2026-11-12 — a journey keeps the zone it started in; explicit changes wait for a shared midnight |

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

## Verification after the fixes (2026-11-11, branch `claude/finalization-qa`)

Run in the cloud sandbox against a local Supabase and a production build; none of this is a physical-device result.

| Check | Result |
|---|---|
| Typecheck, lint | pass |
| Unit tests | 3,599 passed (196 files); 73 added with the fixes |
| Integration tests (local database) | 336 passed, 1 skipped |
| Production build | pass |
| Browser suite, phone-size Chromium, production build | 125 passed, 99 skipped (demo-only and device-only specs), 0 failed |

Notes on the run: the first browser run addressed the server as `127.0.0.1`; the AI routes reject an origin that does
not match the configured site address, so seven coach tests failed with `403 forbidden_origin`. Addressed as
`localhost` they pass; the origin check is working as designed. One faith test was updated because the Bible study
helper now (correctly) asks for AI-data consent before the question box appears.

Fixes not exercised end to end here (covered by unit tests and code reading only): the 14-day `past_due` grace through
a real Stripe failed renewal; the chat deadline firing against the real provider; the offline food-logging retry in a
browser; the GPS notes edit against the live-GPS database trigger for a Free member.

Still open at the end of finalization: B1 (needs a Play sandbox), B7, N5, water idempotency in N7, and the owner
decisions T8 and T10.

## Release-candidate verification, 2026-11-12 (branch `claude/rc-verification`)

Reconciliation: 29 findings in the finalization pass. 24 were fixed there (N7 counted as fixed although its water
part was still open). N5 and the water part of N7 are now fixed, so 25 are fully fixed. Still open: B1 (needs a Play
sandbox), B7 (membership screen), T8 and T10 (owner decisions). Schema changes: N5 (migration 059), N7 water
(migration 058), and T10 when it is decided. Each migration states its rollback at the top of the file.

New findings while writing evidence tests for the release candidate:

| # | Sev | Defect | Evidence | Repair | Status |
|---|---|---|---|---|---|
| R1 | M | Two finishes of the same workout at once (double tap, or a retry while the first request is still running) both rewrote the exercises, saving every set twice | `tests/integration/workout-finish-concurrency.test.ts` failed (2 exercises, 4 sets, expected 1 and 2); `src/server/services/workouts.ts` `finishWorkout` | Claim the session with a conditional update before writing (migration 060, additive); other requests wait and report "already saved"; a claim older than two minutes can be taken over | Fixed; 3 integration tests |
| R3 | M | Hiding "Verse of the day" in Customize Home did nothing: the module renders nothing and the Home hero showed the verse whenever the Scripture-card switch was on (found by the WebKit CI run; reproduced in Chromium 3 of 8 runs) | `src/app/(app)/home/page.tsx` hero; `src/lib/layout-prefs.ts` `homeLayout` | The hero verse shows only while the layout keeps the verse module (either setting hides it); Customize's Reset also starts Quick actions hidden, as the saved default does | Fixed; `e2e/navigation.spec.ts` 8 of 8 |
| R2 | L | An AI request from a member who had not allowed AI use was counted against the burst rate limit before it was refused | `tests/integration/ai-consent.test.ts`; `src/server/services/ai-coach.ts` `withAiRequest` | Check consent before the rate limit | Fixed; 5 integration tests |

Acceptance for R1: four simultaneous finishes of one workout, with and without a saved draft, leave one completed
session, one exercise, two sets and no repeated record type; a later retry returns "already saved" and adds nothing.


Usability review at 320, 375 and 430 px and at 200% text (scripted browser, not a person): 2 High, both fixed (U-H1,
workout screen at 200% text; U-H2, water offline). 6 Medium and 13 Low are open. Each Medium has an acceptance
criterion in `docs/quality/RC_VERIFICATION_2026-11-12.md` (section 4); U-M4 is the owner decision T8.
