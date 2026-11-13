# Pro work on `claude/pro-premium`: implementation report

2026-11-13. Branch `claude/pro-premium`, pushed. **Not merged, not deployed. No live subscription products, prices or
billing were changed.** PR #11 (`claude/rc-verification`) was not touched. No real AI model was called: everything that
involves AI was tested with the local mock provider.

## Owner decisions applied (2026-11-13)

| Decision | Status |
|---|---|
| Programs 38–40 stay Pro; every free Faith feature (incl. the 40-day challenge) stays free | Already the case; unchanged and covered by existing tests |
| Daily recovery check-in stays free; advanced AI recovery insights Pro | Already the case; unchanged |
| #26 becomes a dedicated Aerobic Endurance Builder | **Built**: `aerobic-endurance-builder-8-week` (8 weeks, 3 core days + optional easy days, ≤10% weekly growth, cutback week 4, easier final week; a test keeps it distinct from #22). The old run/walk program stays in the library, unnumbered |
| All programs stay marked not professionally reviewed; nutrition programs flagged for a registered dietitian | Unchanged: every program carries the "not yet reviewed" flag; nutrition habit programs name a registered dietitian |

## Implemented and tested

### Priority 1: AI cost controls (`AI_COST.md` has the full projections)

* **Money budgets enforced in the database before any provider call** (migration 066):
  * a per-member monthly budget, $1.40 by default;
  * a global monthly budget covering every AI feature, including the free Bible helper ($100 by default; `0` switches AI off).
  * Each request holds its expected cost while it runs. When it finishes, the hold is replaced by the real cost, worked out from the provider's usage report. Failed calls give the hold back. A crashed request is closed after 6 minutes and charged at its estimate.
* **Alerts at 50%, 75%, 90% and 100%** of the global budget, each once per month. They go to the server log and, optionally, a webhook (`AI_BUDGET_ALERT_WEBHOOK_URL`). Alerts contain totals only, never member data.
* **Concurrency:** at most 2 requests in flight per member and 20 across the app (`AI_MAX_CONCURRENT`).
* **Request limits:**
  * Chat stops calling tools once one request reaches its cost ceiling ($0.025 on the fast model, $0.40 on the larger one).
  * The existing length limits were reviewed and documented (message 4,000 characters, history 24,000, output caps per feature).
* **Cheaper models by default:** routine requests run on Haiku. Chat switches automatically to the fast model when a member has used 75% of their budget, or the app 90% of the global budget. Plan generation is never downgraded.
* **When a limit is reached, it fails gracefully:** clear messages, each saying that everything else in the app keeps working. Nothing is charged extra, and no non-AI feature is affected.
* **Allowance derived from the economics** (`src/lib/domain/ai-economics.ts`):
  * It uses the $17.99 and $119.99 prices, Stripe at 2.9% + 30¢, and store commission at 15% or 30%.
  * Yearly subscriptions are spread over 12 months, and budgets are enforced month by month.
  * Assumptions: $1.00 of other operating cost per member, and AI capped at 20% of the lowest net (App Store/Play yearly at 30%: $7.00 a month).
* **Changed business rule (stated plainly):** the Pro larger-model share went from **15 to 10 a month**. Plan generations also share this limit, so they are effectively 10 a month. The membership comparison now reads "Up to 10 / month". The 150-request allowance and the prices are unchanged. To restore 15, set `PLAN_PRO_AI_SMART_MONTHLY_LIMIT=15`.

### Priority 2

* **Missed-session rescheduling with approval:**
  * Train shows a card when program sessions came and went since the last workout. This is detected from real workout history, and the member's own moves are respected.
  * Nothing changes until the member taps a choice: train it today, move it to another day, or skip what was missed and stay on the usual days.
  * Skipping is Pro (the same rule as moving sessions), limited to 3 sessions, and confirmed in a dialog first.
  * After a skip, the next session is pinned to its usual day. Workout history is untouched, and a stale or repeated request is refused.
* **30-day sleep summary** on the Sleep & Recovery page, built only from logged nights:
  * It appears once 7 nights are logged. Missing nights are left out, never counted as zero sleep.
  * Recorded and self-reported nights are counted separately, and the card states where figures are estimates and that phones and watches have limits.
  * A change between the two halves of the month is reported only when both halves have data and the change is more than 15 minutes.

### Priority 3

* **Meal-prep batching** (`/nutrition/planner/prep`, Pro):
  * Planned meals are batched by recipe, with amounts scaled for each cook.
  * Prep sessions keep refrigerated food within 4 days, citing the FoodSafety.gov chart. Freezing is optional.
  * Ingredients without nutrition data are labelled, and totals that include them read "at least". No migration.
  * Limitation: freeze choices are kept only in the link.
* **Accountability partners: built, but switched off** (flag `accountability_partners`, off; migration 067).
  * Partners join by single-use, expiring invite codes, up to 3 partners.
  * Each sharing switch can be turned off per partner: workouts in the last 7 days, streak, and program progress.
  * Encouragement is a fixed set of messages only. Food, weight, sleep, photos, journal and AI data are never shared.
  * With the flag off, the page returns 404 and the database refuses actions.
* **Form analysis: not operational.** A pure measurement core exists (rep detection, tempo, range of motion, confidence gating, neutral wording) behind `FORM_ANALYSIS_ENABLED = false`.
  * Nothing in the app imports it.
  * It has been run on synthetic stick-figure data only: no camera, no pose model, no UI. Every threshold is an unvalidated placeholder.

## Test results (this branch, local stack, final commit)

| Suite | Result |
|---|---|
| Typecheck, lint | Clean |
| Unit (`vitest --project unit`) | 230 files, **4,403 passed** |
| Integration (local Supabase, after `supabase db reset` so migrations 001–067 applied from the files) | 66 files, **405 passed**, 1 skipped (pre-existing) |
| E2E, production build, mobile project (mock AI, no real model) | missed-sessions-sleep, meal-prep, coach, pro-programs, program-library, features, memberships: **25 passed, 1 skipped** (a coach test skipped by design) |
| New suites | `ai-economics` (10), `ai-budget` unit (5), `ai-budget` integration (10: caps, alerts, downgrade, concurrency, crash recovery, Bible helper), `missed-sessions` unit (6) + integration (3), `sleep-summary` (5), `meal-prep` (26), `accountability` unit (18) + integration (13), `form-analysis` (42), `program-catalog-aerobic-endurance` (8) |
| Not run here | Demo-mode e2e, the WebKit/iPhone project (browser not installed), anything on a device, a live AI call, the alert webhook against a real Slack channel, accountability e2e |

Fixed along the way:
* Some existing integration tests still assumed a free catalog program. Every catalog program is Pro now, so they were updated.
* The cross-user isolation sweep had not seeded the weekly-report and habit-program tables, so it did not check them. It now seeds them.

## Planned, not built

* Form analysis as a product: camera capture, an on-device pose model, device testing, validation against coach-rated footage, consent and UI (`FORM_ANALYSIS.md`).
* Accountability: an e2e run on a real build, and rate limiting on code guessing (low risk: codes are long, single use and expiring).
* Freeze choices for meal prep saved on the server.
* Per-member accounting of Pro members' Bible-helper spend. It currently counts toward the global budget only.

## Remaining launch blockers

1. **Owner approval** to merge and deploy. Then apply migrations 063–067 to staging, then production (`MIGRATIONS_AND_ROLLBACK.md`). Migration 066 and the app code must go out together.
2. **AI budget settings for launch:**
   * Set `AI_GLOBAL_MONTHLY_BUDGET_USD` (worked example: about $1,300 a month for 1,000 Pro and 5,000 free members).
   * Set `AI_BUDGET_ALERT_WEBHOOK_URL`.
   * Set a spend limit in the Anthropic Console as an independent backstop.
   * Confirm the assumptions: $1.00 other cost per member, 20% AI share, and 30% store commission.
3. **A live AI evaluation run** with a real key and a low spend limit, comparing `ai_usage_events.cost_micros` with Anthropic's usage page. All costs so far are modelled.
4. **Store and Stripe products** at $17.99 / $119.99. This is an owner action; checkout refuses until the products match. Sandbox purchases on iPhone and Android must be tested on devices.
5. **Professional review sign-offs:**
   * a qualified coach for programs 1–32;
   * a physiotherapist for 21 and 29–32;
   * a registered dietitian for the nutrition programs (33–36, 40) and the meal-prep food-safety wording.
6. **Devices:** Health import, GPS, notifications and sleep import (`docs/TESTFLIGHT_INTERNAL_CHECKLIST.md`, `docs/SLEEP_DEVICE_CHECKLIST.md`).
7. **Accountability** stays off until three things are done: the owner decides Free or Pro, the privacy policy is updated, and an e2e test passes.
8. Not done yet:
   * memory field encryption;
   * six exercise groups below their target counts;
   * human review of the exercise demonstrations;
   * refreshed screenshots and an updated clickable demo for the new screens.
