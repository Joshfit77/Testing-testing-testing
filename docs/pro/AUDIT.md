# Pro master plan: what exists, what was built, what is left

Branch `claude/pro-premium`, 2026-11-13. Each item is classified:

* **Built**: working in the app, covered by automated tests on this branch.
* **Partial**: works, with the named gap.
* **Needs a device**: code exists, but it can only be verified on a real phone or watch; not verified.
* **Not built**: nothing usable yet.

"Verified" below always means automated tests (unit, integration against the local database, e2e in a mobile browser
against a production build). Nothing has been tested on a physical device, with live payments, or with a live AI model.

## Priority 1

| Item | Status | Notes and evidence |
|---|---|---|
| Server-side Pro entitlements | Built | Plan from the database, never the client. New on this branch: structured and habit programs need Pro (actions + RLS), with existing enrollments kept. `tests/integration/pro-programs.test.ts`, `plan-enforcement.test.ts`. |
| Pricing $17.99 / $119.99 | Built (code only) | `APPROVED_PRO_PRICE_CENTS`; checkout refuses until the live Stripe/store price matches. **No store or Stripe product changed.** |
| Membership screen (black and gold, comparison, renewal) | Built | Comparison updated for Pro-only programs, habit programs, weekly reports and the 218-exercise library; renewal and cancellation dates shown. `tests/unit/membership.test.ts`, `e2e/memberships.spec.ts`. |
| AI memory (categories, consent, controls) | Partial | Categories, approval-only saving, edit, delete, forget, export, off switch; withdrawing AI consent now also turns memory off. **Gap:** no field-level encryption beyond the database's encryption at rest. |
| Weekly report (Sunday, local time) | Built | Once per member per week (unique row decides; retries never duplicate or double-charge), never invents metrics (coverage shown), share and delete; AI write-up only with consent and a configured key, otherwise rule-based. New: Home card. **AI write-up not run against a live model.** |
| Sleep dashboard | Partial | Stages in the requested colours (awake grey, REM purple, light/core blue, deep darker blue), trends, debt, schedule. **Gaps:** no 30-day summary card; consistency score lives on the schedule page, not the hub. Apple Health / Health Connect import **needs a device**. |
| Daily recovery check-in | Built | New: after a low or moderate check-in, "Start today's session lighter" (one set fewer, RPE 7 cap, that session only; the program is unchanged). The check-in itself stays free (owner decision pending, below). |

## Priority 2

| Item | Status | Notes |
|---|---|---|
| Program adjustments with approval and history | Partial | Coach and Training review propose load, deload and volume changes; the member accepts, edits or declines; changes are recorded and can be undone. New: program recommendations and approval-only program switches from the coach (history kept). **Gap:** no automatic rescheduling after missed sessions. |
| Nutrition and grocery planning | Partial | Recipes, meal planner, grocery list, AI meal plans with approval. New: scale a recipe to any number of servings. **Gap:** no meal-prep batching suggestions. |
| Progress-photo comparison | Built | Side by side, plus a new overlay with a blend slider and alignment guides. Photos aren't analysed or measured, and the app says so. |
| 40 Pro programs | Built (unverified by professionals) | See `PROGRAM_CATALOG.md`. 32 training programs, 7 habit programs and the existing 40-day challenge. |

## Priority 3

| Item | Status | Notes |
|---|---|---|
| Form analysis | Not built | Design and limits in `FORM_ANALYSIS.md`. Not shipped: a camera feature that judges form needs on-device pose estimation, validation against coached lifts, and clear safety wording. |
| Wearables | Needs a device | HealthKit and Health Connect sleep, steps and workouts are coded; no Apple Watch workout import, no background sync verified (`docs/WEARABLES.md`). |
| Accountability (opt-in) | Not built | Needs an owner decision on sharing scope (partner, group, church) and moderation. |
| Mobility | Built | Programs 29–32 and 15 mobility exercises. Not presented as rehabilitation. |
| UI and Home customization | Built | Home modules reorder and hide; new weekly report module. |
| Security testing | Built for what changed | RLS tests for every new table, including a forged-enrollment attempt; no external penetration test. |
| AI cost controls | Partial | Per-member allowance metered in the database; **no global dollar cap or spend alert** (`AI_COST.md`). |

## Exercise library (Phase 15)

218 exercises (target 200+). Six groups are below the brief's distribution; one demonstration is a labelled placeholder;
no demonstration has had human biomechanics review (`EXERCISE_LIBRARY.md`).

## Rules kept

Faith section, Bible translation, journal privacy and the strict 40-day restart rule are unchanged; new programs have no
restart rule. No live billing, store product, price or deployment change. No member data overwritten (and a seed
problem that would have detached history on re-seed was fixed). The 3D prototype is untouched.
