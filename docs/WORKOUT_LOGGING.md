# Workout logging

How logging a workout works in Narrow Gate Fitness, what was changed on 2026-11-04 to make it faster, and how it is
tested. The goal: open the workout, see last time's numbers already filled in, tap one button per set, rest while the
timer runs, repeat.

## The flow

1. **Open the workout.** The page loads the session (program day, saved template or an empty workout), the member's
   last performance for each exercise and any target loads they accepted from the coach.
2. **Numbers are already there.** Each exercise is filled in once from last time:
   - today's working sets take last time's working sets in order (set 1 → set 1, set 2 → set 2; the last one repeats
     for extra sets); warm-up sets keep their own lighter numbers;
   - a program rep range ("8–10") takes last time's reps when they were inside the range; otherwise the program's
     number stays;
   - an exercise never logged before takes the target the member accepted, if any;
   - in a program deload week, weights are left empty on purpose (the week is lighter);
   - values the member typed are never overwritten, and filling happens only once per exercise, so a weight cleared on
     purpose (bodyweight) does not come back on resume.
3. **One tap: Complete set.** The set is recorded, saved on the phone at once and backed up to the account at once; the
   programmed rest starts; the next set gets the numbers just logged where it has none yet. A second tap within 0.7 s
   is treated as the same tap (a bounce); a deliberate tap after changing a number or using the rest controls always
   counts. **Undo** sits right under the button.
4. **Rest.** The countdown is shown first on the card (−15 s, +15 s, Skip rest). When it runs out the phone beeps or
   vibrates (Profile setting; the native app also notifies when backgrounded) and the card says "Rest over. Set 2 of 3
   is ready."
5. **Adjust only when performance changes.** Large − / + buttons (5 lb or 2.5 kg per tap; 1 rep), or tap the number to
   type it. **Same as last set (155 lb × 8)** copies the last set done on that exercise with one tap; it is shown only
   when the next set differs.
6. **What's next.** "Then: set 3 of 3 · 155 lb × 8" or "Then: Dumbbell Biceps Curl, set 1 of 3"; a progress bar in the
   header counts sets done.
7. **Skip set / Skip exercise.** A skipped set is passed over, not counted, and can be undone (or completed later from
   the exercise card). Skip exercise asks why, with the pain advice.
8. **Finish.** "Finish early?" appears only when sets are still to do, and says how many won't count. Only completed
   sets count toward volume, personal records and badges.

The exercise cards below the current-set card are unchanged: every set, RPE, notes, substitutions, supersets,
warm-up toggles, add/remove set and the per-exercise menu.

## Storage (no database change)

| What | Where |
| --- | --- |
| Workout in progress | `workout_sessions` row with `status = 'in_progress'` and the whole draft as JSON in `draft`, keyed by the device-generated `client_id`. Also kept in the phone's local storage (per account). |
| Finished workout | Same row set to `completed`; `workout_exercises` (one per exercise, with `skipped`/`skip_reason`) and `workout_sets` (one per set, `completed` true or false). |
| Personal records | `personal_records`, worked out from completed working sets on Finish. |
| "Last time" | Read from completed sessions' sets (`getPreviousPerformance`), preferring the same program day. |

The new behaviour adds two optional fields inside the draft JSON only: `skipped` on a set and `prefilled` on an
exercise. Older drafts without them still load. Skipped sets are sent on Finish like any unfinished set
(`completed: false`), so history, records, analytics and the server schema are unchanged.

## Saving and recovery

- Every change is saved on the phone immediately. A completed or skipped set (and Undo) is backed up to the account
  straight away; other edits are backed up 2 seconds after the last change. Going to the background (home button,
  lock, app switch) sends the latest numbers at once.
- Backups go one at a time; a newer one waits for the one on its way, so an older snapshot can never overwrite a newer
  one. Failed backups retry with a growing delay (5 s up to 2 min) and again when the connection returns; offline, the
  header says "Saved on device".
- Reopening the workout (reload, app restart, another device) restores the newest copy. A workout untouched for 6 hours
  or more asks whether to resume or discard; a "Resume" pill shows elsewhere in the app.
- Finish is idempotent per `client_id`: a retry after a lost reply returns the same session and adds nothing.

## Code

- `src/lib/domain/workout-draft.ts`: the pure reducer (`skipSet`, `unskipSet`, `repeatLastSet`, `prefillFromPrevious`
  rules), `afterCurrent` (what comes next), `finishPayload` (what Finish sends).
- `src/components/workout/current-set-card.tsx`: the card.
- `src/components/workout/workout-logger.tsx`: restore, saving and backup, pre-fill, rest alerts, finish.
- `src/components/workout/exercise-card.tsx`: full per-exercise view (skipped sets shown dimmed and announced).

## Tests

- Unit: `tests/unit/workout-fast-logging.test.ts` (pre-fill rules, one-tap completion and rest, Same as last set, skip
  and undo, superset skip, what comes next, reload).
- Integration (local database): `tests/integration/workout-fast-logging.test.ts`: every set backed up and restored
  exactly; done and skipped sets stored; volume counts only completed sets; a retried Finish adds nothing; the next
  workout is filled in from what was stored.
- End to end at phone size: `e2e/fast-logging.spec.ts` (the backup request is sent within 1.5 s of tapping Complete;
  rest +15 s and Skip; Same as last set; Skip set and Undo; reload mid-workout; Finish early; next workout pre-filled
  set by set; Skip exercise; Rest over; layout at 360, 375, 390 and 430 px wide), plus the existing
  `current-set-card`, `workout-reliability`, `core-flow` and `journeys` specs.

## Not verified yet

- On a real iPhone/Android phone: the background backup when the app is sent to the background (the browser
  `visibilitychange`/`pagehide` events are what Capacitor apps receive, but this has only been exercised in Chromium),
  and the rest-over alert while the phone is locked (native notification scheduling was unchanged).
