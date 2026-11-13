# Pro work on `claude/pro-premium`: final report

2026-11-13. Not merged, not deployed, no live billing or store changes. PR #11 (`claude/rc-verification`) was not touched.

## What was delivered

* **40-program Pro catalog** (`PROGRAM_CATALOG.md`): 22 new training programs, 10 existing ones adopted with weekly
  milestones and instructions (prescriptions unchanged), 7 habit programs (nutrition, faith and fitness, 90-day
  journey) on a new habit-program system, and the existing 40-day challenge unchanged. All structured programs are Pro
  for new enrollments; members already enrolled keep their program.
* **AI coach and programs**: the coach recommends from the app's own ranking (goal, experience, equipment, schedule,
  preferred training) plus what it knows with consent; a program proposal is only a card, and nothing starts until
  the member taps Start. Switching pauses the old program and keeps its history.
* **Program library**: preview shows milestones and instructions; new program-length filter.
* **Weekly report** every Sunday (local time), Home card, share and delete.
* **Recovery**: one-tap lighter session after a low check-in (that session only).
* **Nutrition**: recipe scaling for any number of servings.
* **Progress photos**: overlay comparison with blend and alignment guides.
* **Membership**: comparison updated to the new rules; prices $17.99 / $119.99 in code only.
* **Exercise library**: 218 exercises with full details, search by aliases and shorthand (`EXERCISE_LIBRARY.md`).
* **Data safety fix**: re-running the seed no longer detaches members' logged workouts from their program days.

## Test results (this branch, local stack)

| Suite | Result |
|---|---|
| Typecheck, lint | Clean |
| Unit (`vitest --project unit`) | 220 files, 4,281 tests passed (run before the last four commits; their own unit tests pass) |
| Integration, affected suites (pro-programs, weekly-reports, plan-enforcement, custom-programs, workouts) | 26 passed |
| E2E, production build, mobile project | pro-programs (4), program-library (1), features (5), memberships, store-billing, recipes-planner, training-review: all passed |
| E2E with the local mock AI (no real model) | coach suite: 10 passed, 1 skipped by design (needs no AI key) |
| Not run here | Demo-mode e2e (needs `npm run demo`), WebKit/iPhone project (browser not installed here), anything on a device |

## Owner decisions needed

1. **Faith & fitness programs (38–40) are Pro** as the brief says, while the Faith section itself, the 40-day challenge,
   journeys and AI Bible study stay free under the existing rule. Confirm.
2. **The daily recovery check-in stays free.** Confirm, or make it Pro.
3. **#26 Aerobic Endurance Builder** is mapped to an existing beginner run/walk program that overlaps #22; build a
   dedicated one?
4. **Professional review** of programs 1–32 (coach; physiotherapist for 21 and 29–32) and 33–36, 40 (registered
   dietitian) before release.
5. **AI spend:** add a global spend cap and alert; the worst case per member exceeds the yearly net (`AI_COST.md`).
6. Form analysis and accountability: approve the plans before any build (`FORM_ANALYSIS.md`).

## Before TestFlight / release

1. Owner approval to merge and deploy.
2. Apply migrations 063–065 and the regenerated seed to staging, then production (`MIGRATIONS_AND_ROLLBACK.md`).
3. Create or update the store and Stripe products at $17.99 / $119.99 (owner action; checkout refuses until they match).
4. Sandbox purchases on iPhone and Android, Health import, GPS and notifications on real devices
   (`docs/TESTFLIGHT_INTERNAL_CHECKLIST.md`, `docs/SLEEP_DEVICE_CHECKLIST.md`).
5. A live AI evaluation run (weekly report write-up, program recommendations) with a real key and spend limit.
6. Professional review sign-offs above.

## Not done

Form analysis, accountability, meal-prep batching, missed-session rescheduling, the 30-day sleep card, memory field
encryption, six exercise groups below target, human review of demonstrations, refreshed screenshots and the clickable
demo for the new screens.
