# First-workout activation

Launch-critical item 1 (2026-11-03). Two parts: **measuring** activation on the server, and **shortening** the new
member's path from sign-up to a first completed set and a finished workout. Every number below was measured by an
automated browser test on local builds. There are no production retention figures yet: the app has not launched, and
none are invented here.

## 1. What is measured, and how

### Events (migration `20261103000051_activation_events.sql`)

| Event | Recorded when | Source |
| --- | --- | --- |
| `workout_started` | the server first stores the workout (the logger saves it once the member does something, so just opening and leaving records nothing) | `sync` (draft save) or `finish` (a workout logged entirely offline) |
| `set_completed` | the server first sees a completed set in it | `sync`, or `finish` when the whole workout was logged offline (then the time is the finish) |
| `workout_completed` | it is finished and saved | `finish` |
| `workout_abandoned` | it is discarded while still in progress | `discard` |

Account creation and onboarding come from columns that already exist: `profiles.created_at` and
`profiles.onboarding_completed_at`.

- **Server-validated.** Rows are written only by database triggers on `workout_sessions`, from the workouts the
  server itself stores. Clients cannot insert, change or delete them (row level security; the recording function is
  not callable by members). A workout's claimed start time is clamped to the two days before the server first saw it.
- **No duplicates by construction.** There is one row per (member, event, workout); a retried save or finish is a
  no-op.
- **Privacy.** Timestamps only. No exercises, weights, notes or device data, and nothing leaves the database.
  Members can read their own rows, which are part of their data export (`USER_TABLES`), and the rows are deleted with
  the account.
- **Workouts from before the migration** are backfilled as `workout_started` and `workout_completed`
  (source `backfill`). When their first sets were completed is unknown, so nothing is recorded for that.
- A finished workout later deleted from history keeps its events: the member did train that day. Deleting the whole
  account records nothing.

### Metrics (admin only: `admin_activation_metrics(from, to)`; the admin dashboard shows the last 30 days)

- **New members** are accounts created in the window. For them, the summary counts how many finished onboarding,
  started a first workout, completed a first set, and completed a first workout.
- **Median minutes** for each step: sign-up → onboarding done, onboarding → first workout started, first workout
  started → first set, sign-up → first set, and sign-up → first workout completed.
- **Return activity** counts members who trained (started or finished a workout) on day 1, day 7 and day 14 after
  sign-up, plus anywhere in days 1–7. Days are the member's own calendar days, in their time zone. A member counts as
  "eligible" only once that day is over, so a three-day-old account is never counted as a day-7 drop-off.
- **Abandonment** reports workouts started; workouts discarded; workouts left "in progress" and untouched for 24 hours
  or more; and members whose *first* workout was abandoned.
- **Returning members** are older accounts that completed a workout in the window, reported separately from new
  members.
- With only a few new accounts, these aggregates describe individuals. The admin page says so.

Tests: `tests/integration/activation-events.test.ts` (6 tests):
- once-only recording, with repeated saves and a retried finish;
- the offline-finish path;
- discard versus deleting a finished workout;
- members can't write, change or delete events;
- admin-only access;
- account deletion with a workout in progress.

The cross-account isolation test also covers the table.

## 2. What changed for a new member

| Before | After |
| --- | --- |
| 14 onboarding screens, with sex, age, height and weight on 4 separate screens | 11 screens. The four are one **About you** screen with the same questions, labels and checks; every answer is still saved |
| The plan page's only Start button was at the bottom, below the calorie budget and Week 1 | A **Today's workout** card at the top: name, week and day, minutes, exercise count, the first exercise, and one **Start Today's Workout** button. "Go to Home" stays as the secondary action at the bottom |
| Home's button read "Start workout" | **Start Today's Workout** when a session is due today. "Start workout early" for a session planned later, and "Start workout" with no program, are unchanged |
| A first-time exercise showed only "Target 3 × 8–10 · RPE 7" | Exercises the member has never logged, and that have no coach target, also show: "First time: start light. Use a weight, or an easier version, that leaves at least 3 reps in reserve. Your next session builds from what you log." Timed and distance exercises get their own wording |
| After the workout, "Up next" showed the next session | It also shows **Program progress**, e.g. "1 of 36 sessions done", with a bar |

Already in place, and checked: the logger opens with the day's exercises loaded and the first set's reps
pre-filled, so one tap completes it. The starter program never assigns a working weight without maxes the member
entered: the onboarding program has none, so it gives RPE targets only (`starterProgramInput`, `maxesKg: {}`).

## 3. Before and after, measured

`e2e/first-workout-activation.spec.ts`, 3 runs per build, on the same machine one after the other, Pixel 7 viewport. The
persona is a brand-new member who has never trained, with dumbbells only. The measurement runs from the first question
of onboarding (after sign-up and email confirmation, which are the same in both builds) to the first completed set and
to the finished workout. "Taps" counts real clicks; "typed" counts fields typed into. Times are the app's own latency
with an automated user who answers instantly. **They are not human timings.**

| Stage | Before (median ms · taps · typed) | After |
| --- | --- | --- |
| Onboarding done | 1,928 · 19 · 4 | 1,594 · 16 · 4 |
| Logger open | 2,617 · 20 · 4 | 2,384 · 17 · 4 |
| **First completed set** | **3,001 · 21 · 4** | **2,695 · 18 · 4** |
| Workout finished | 3,724 · 23 · 4 | 3,617 · 20 · 4 |

| Check (held on every run) | Before | After |
| --- | --- | --- |
| Start button visible without scrolling | **no** | yes |
| First set visible when the logger opens | yes | yes |
| First-time starting tip shown | no | yes |
| "Up next" shown after the workout | yes | yes |
| Program progress shown | no | yes |

Raw results: `docs/activation/measurements/activation-before.json`, `activation-after.json`. The time ranges overlap
(first set: before 2.8–4.3 s, after 2.5–3.4 s over 3 runs). The firm differences are the tap counts, the screens and
the scroll that is no longer needed.

How "before" was run: the commit before these changes (`bef841c`) was built in a separate worktree and served on port
3000. The spec was copied in, and the old onboarding helper was used. Port 3000 matters: the sign-up confirmation email
links to the configured site address. An earlier attempt with the old build on another port confirmed its accounts on
the new build, so its numbers were discarded.

## 4. Open items

- **Privacy policy wording:** the policy lists "workouts" among the activity data collected, but doesn't spell out
  these workout timestamps or what they're used for. The policy is a counsel placeholder whose text is hash-pinned for
  re-acceptance (`src/lib/legal/versions.ts`), so it was not edited here. Owner/counsel: add a sentence before launch.
- Real retention (day 1, 7, 14) can only be read once real members exist. The function and the admin card are ready.
