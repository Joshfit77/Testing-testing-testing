# First-workout quality pass — diagnosis and fixes (28 Oct 2026)

Branch: `claude/workout-experience` (from `claude/interactive-demo`, the integrated app). Nothing merged or deployed.

**How this was produced.** The real app was built in demo mode against a local database and walked at iPhone size
(393 × 852, 2×) by a script that creates an account, confirms the email, answers the 14 onboarding questions, starts
the first session, logs sets, reloads mid-workout, switches tabs, goes offline, substitutes, finishes, and comes back
(`scratchpad: walk/journey.mjs`, 36 screenshots + a video). In parallel, three code audits read the journey end to end
(onboarding → Today; the workout session; navigation, coach, progress). Every "confirmed" item below was either seen
on screen or reproduced by running the code; "suggestion" items were not. Line numbers are from the branch base.

## The ten highest-impact user-facing problems

| # | Problem | Status | Evidence | Root cause |
|---|---|---|---|---|
| 1 | **Every member's "today" is the server's (UTC).** The home date, the food-diary day, the calendar, "completed today" and the first weigh-in all use `profiles.timezone`, which defaults to `'UTC'` and is never set at sign-up or onboarding. A New York member at 8:30 pm sees tomorrow's date and logs dinner on the wrong day. | CONFIRMED (code) · **FIXED** | `supabase/migrations/20261016000001_core_schema.sql:33`, `handle_new_user` trigger; readers `home/page.tsx:49`, `services/schedule.ts:25`, `actions/onboarding.ts:118` | No capture of `Intl.DateTimeFormat().resolvedOptions().timeZone` anywhere but the Profile form. |
| 2 | **Opening the workout screen and leaving leaves a phantom workout.** The logger created a draft on mount and synced it to the server after 2 s even with nothing logged. From then on Home, Train and the floating pill say "Resume workout" forever; the next day's session can't be started without discarding; a draft resumed days later records a multi-day duration on the original date. | CONFIRMED (screen: `recheck/failure.png` shows "Evening workout · 0/0 sets · Synced" produced by just opening the page) · **FIXED** | `workout-logger.tsx:153-171, 209-218`; `today-workout-action.tsx:37-46` | Persistence not gated on any member action; no draft age anywhere. |
| 3 | **Swapping an exercise wiped the sets already done.** Substitute after logging two sets: both come back unticked with blank weights under the new exercise; if not redone they are saved as incomplete (no volume, no records). Same in the history editor. The dialog said only "weights reset". | CONFIRMED (reducer run) · **FIXED** | `workout-draft.ts:304-321`; `workout-editor.tsx:184-191` | `substituteExercise` mapped every set to `completed: false, weightKg: null`. |
| 4 | **Email confirmation (and password reset) could land on the sign-in page instead of onboarding.** The auth callback built its redirect from `request.url`, which is the server's bind address (`http://0.0.0.0:3000` under `next start -H 0.0.0.0`, an internal host behind a proxy); the browser follows it to a host that has no session cookie. The demo on a phone over Wi-Fi hits this on every new sign-up. | CONFIRMED (screen `06-failure.png`; `curl` shows `location: http://0.0.0.0:3000/login`) · **FIXED** | `src/app/auth/callback/route.ts:13,18,21`; `src/app/auth/confirm/route.ts:18,20` | `NextResponse.redirect(new URL(path, url.origin))`. |
| 5 | **The day after a workout was never a rest day.** The scheduler puts the next pending session on *today* unless a session was completed *today*; a member who follows Home trains every day. Combined programs also name days "Mon ·", "Tue ·" while the dates ignore those weekdays. | CONFIRMED (simulation) · **FIXED** (rest day); weekday names: open | `lib/domain/training-schedule.ts:93-94`; `services/schedule.ts:51,64`; `combined-goals.ts:142` | `completedToday` instead of the last completed session's date. |
| 6 | **A failing sync retried in a tight loop.** When the server rejected a snapshot (gym Wi-Fi with no internet behind it, any 5xx), status flipped Saving → Saved on device and the "re-sync" effect fired again immediately, with no back-off: battery and data drain, flickering status. | CONFIRMED (code path) · **FIXED** | `workout-logger.tsx:191-206, 238-240` | The re-sync effect depended on `sync`, which the failed call itself changes. |
| 7 | **A shaky double tap on Done un-did the set while the rest timer kept running; one tap deleted logged work.** Remove set / Remove exercise had no confirmation; tapping the set number silently turned a set into a warm-up (dropping it from volume). | CONFIRMED (screen: `aria-pressed=false` with the timer visible after a 120 ms double tap) · **FIXED** (double tap, removals); warm-up tap: open | `exercise-card.tsx:211-223, 386-404, 158-166` | Toggle with no debounce; no guards on destructive taps. |
| 8 | **No weight guidance and blank sets saved as done.** Weights were never pre-filled (not from last time, not from the set above); each set took 3–5 interactions. A set with no reps and no weight could be ticked and was saved as completed (volume 0, shown as "Bodyweight × 8", counted as a "most reps" record). | CONFIRMED (screens `20`, `36`: every weight field empty; reducer run) · **FIXED** | `workout-draft.ts:250-259, 328-331`; `exercise-card.tsx:211-223`; `strength.ts:60` | Nothing read "last time" into the inputs; `toggleSetComplete` had no readiness check. |
| 9 | **Offline edge cases resurrected or distorted workouts.** Discard while offline cleared the device but left the server's in-progress row, so "Resume workout" brought the discarded workout back. A Finish that failed offline was not queued; retrying an hour later saved an hour-longer workout. | CONFIRMED (code) · **FIXED** | `workout-logger.tsx:762-769, 320, 467`; `services/workouts.ts:65-76` | Discard ignored server failure only when *online*; `endedAt` taken at the retry. |
| 10 | **Numbers that don't agree.** Finish screen 2049.9 lb vs history tile 2050.3 lb for the same workout (kg rounded to a whole number before converting); Home "This week 7 / 3" counted walks and runs against the strength target while My Progress counted workouts; "≈ 0.2 per week" for a member who joined today; a first workout produced up to 18 "personal records" with confetti. | CONFIRMED (screens `30`, `33`; code) · **FIXED** | `train/history/page.tsx:52, 46`; `home/page.tsx:64, 215`; `services/workouts.ts:201-206` | Rounding before conversion; different definitions; first values treated as records. |

### Also found (not in the ten, not fixed here)

- The exercise name in the workout opened in a **new tab** (`target="_blank"`); in the iOS shell Capacitor hands such links to Safari (`WebViewDelegationHandler.swift:334-339`), where the member is not signed in. Fixed on this branch as part of #8's screen work: it now opens in-app with a "Back to workout" link.
- A GPS run stops recording when the member leaves the record screen; no resume indicator (`gps-recorder.tsx:189`). Serious for runners; outside the first-workout flow.
- Finishing the last session of a program dead-ends on "No program yet" (`training.ts:168-170`, `home/page.tsx:143`). The finish screen now says "Program complete"; Home's follow-up is still open.
- Starter programs for "Mobility" and "General health" are barbell strength programs (`starter-program.ts:22-23`); "bodyweight only" members can get box jumps.
- Onboarding answers live only in memory: a refresh or an Android back press restarts at question 1.
- The sign-up form clears every field after a validation error (React 19 form reset; `auth-forms.tsx:77-153`).
- Two daily check-ins (Sleep, Recovery) ask overlapping questions and only one feeds training; the coach is told a different adherence % than the Training review; coach-applied swaps bypass the review's undo history.
- Legal pages are placeholders that members must agree to (launch blocker already recorded in `docs/launch-audit`).
- Terminology: "Plan" means membership, onboarding output and program; "Food" tab vs "Nutrition" card; "template" vs "My workouts".
- `e2e/demo.spec.ts:57` passes against a 404 page (`/run/activities` has no route).

## What changed (this branch)

| Area | Change | Files |
|---|---|---|
| Drafts | A draft is saved (device + server) only after the member does something. A draft last touched ≥ 6 h ago is offered as "Unfinished workout … last used N hours ago, M sets logged: Resume / Discard"; resuming counts the time away as paused, not training, and drops a stale rest timer. | `workout-logger.tsx`, `workout-draft.ts` (`draftAgeHours`, `continueAfterGap`) |
| Logging | Completing a set carries its weight/reps to the next empty set. Empty fields take last time's numbers (target reps stay). A set without reps (or seconds / distance) can't be ticked; the button says what it needs. A second tap within 700 ms is the same tap. | `workout-draft.ts` (`setCanComplete`, `prefillFromPrevious`, carry-down), `exercise-card.tsx`, `workout-logger.tsx` |
| Substitution | Done sets stay logged under the original exercise; the remaining sets move to the replacement (reps kept, weight cleared). The dialog says so. | `workout-draft.ts`, `workout-logger.tsx` |
| Removals | Removing a done set or an exercise with done sets asks first. | `exercise-card.tsx` |
| Sync | Failed sync retries with back-off (5 s → 15 s → 45 s → 2 min); re-sync only on the offline→online change. | `workout-logger.tsx` |
| Finish | End time is when Finish was first tapped (`finishRequestedAt`, persisted; cleared if more work is logged). Summary shows **Up next** (name, week/day, planned date) or **Program complete**, and **Baselines set** for first-time exercises instead of "records". | `workout-draft.ts`, `workout-logger.tsx`, `services/schedule.ts` (`nextSessionSummary`), `actions/workouts.ts`, `services/workouts.ts` (`first`) |
| Discard | Works offline: the server copy is removed on the next visit and never restored meanwhile; the rest notification is cancelled. | `workout-logger.tsx`, `workout-storage.ts` |
| Rest days | The next session is due on the training day after the last completed session (or today if overdue). | `training-schedule.ts`, `services/schedule.ts` |
| Time zone | Captured from the device at onboarding, and at sign-in for profiles still on the default. | `onboarding-questionnaire.tsx`, `actions/onboarding.ts`, `auth-forms.tsx`, `actions/auth.ts`, `schemas.ts`, `dates.ts` |
| Auth links | Callback/confirm redirect to a path, resolved by the browser against the address it used. | `relative-redirect.ts`, `auth/callback`, `auth/confirm` |
| Today card | "Week 1 of 8 · Day 1 of 3 · 44 min · 3 exercises"; "This week" counts workouts (as My Progress does). | `home/page.tsx` |
| Plan page | "Why this program: because your main goal is …, you've trained …, you can train N days a week for about M minutes, you have …" | `plan/page.tsx` |
| History | Volume converted without pre-rounding; per-week rate over the days since the first workout (min. a week). | `train/history/page.tsx` |
| In-workout guide | Exercise name opens the exercise page in-app; its Back returns to the workout. | `exercise-card.tsx`, `train/exercises/[slug]/page.tsx` |

## Tests

- Unit: `tests/unit/workout-draft-session.test.ts` (new, 10), `tests/unit/training-schedule.test.ts` (rest-day cases) — full unit suite 2,665 passing.
- Integration (local Supabase): 185 passing, 1 skipped (`tests/integration/workouts.test.ts` covers finish idempotency, records, program advance).
- Type check and lint: clean.
- E2E: `e2e/workout-reliability.spec.ts` (new) and `e2e/core-flow.spec.ts` (updated expectations) — results recorded below once run against the rebuilt demo.

## Not tested here

- A physical iPhone (TestFlight build): opening, notifications at the end of rest while locked, iOS keyboard, Safari audio. The scheduled "Rest complete" notification still ignores the Sound/Vibrate settings.
- Two devices editing the same draft.
- Real email delivery outside the local Mailpit.
