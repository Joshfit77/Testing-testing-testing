# Sleep & Recovery: how the numbers are worked out

_All calculations are deterministic code in `src/lib/domain/sleep*.ts`, unit-tested, and versioned. Nothing on these
pages is a physiological measurement: the app knows what the member logged (or imported from a health platform) and
nothing more. Sleep quality (the nightly score), sleep shortfall (sleep debt) and predicted daytime energy are three
separate ideas and are shown separately._

## Sessions and nights (`sleep.ts`, calc version 1)

- A **session** is a night or a nap with a bedtime and a getting-up time, optionally when the member thinks they fell
  asleep, their final wake-up, how many times they woke and minutes awake.
- **Time in bed** = getting up − bedtime. **Time asleep** = (final wake-up or getting up) − (fell asleep or bedtime)
  − minutes awake. When none of the optional detail was entered, time asleep equals time in bed and is labelled "in
  bed" everywhere it appears.
- **Time to fall asleep** and **efficiency** (asleep ÷ in bed) exist only when the detail that defines them was
  entered; otherwise they show "Not recorded".
- All arithmetic is on instants (epoch milliseconds), so a daylight-saving change counts the real elapsed time (a
  night across the autumn change is an hour longer, across the spring change an hour shorter) and travel never adds or
  loses time. The time zone a session was logged in is stored and used only to show clock times and to decide the
  **night a session belongs to: the local date the member got up**. Naps are listed under their own date and never
  counted in nightly figures. A night logged as two sessions (woke, got up, went back) is added up.
- Overlapping sessions are refused by the database, whatever their source. Imported records are unique per source.

## Nightly sleep score (`sleep-score.ts`, score version 1)

A 0–100 description of **one night as logged**. Four parts; each is scored only when its inputs exist, the parts that
exist are averaged by weight, and a missing part never lowers the score. The label beside the score always says what
it was based on ("based on duration and timing").

| Part | Weight | Full marks | No marks | In between |
| --- | --- | --- | --- | --- |
| Time asleep vs the member's goal | 50 | at or above the goal | at or below half the goal | linear |
| Sleep efficiency (needs fell-asleep, final wake-up or minutes awake) | 20 | 90% or more | 60% or less | linear |
| Timing vs the member's own usual times (needs 3 earlier nights in the last 14) | 20 | both bedtime and wake time within 30 min of usual | the worse of the two 120 min or more away | linear |
| Wake-ups (needs a count) | 10 | 0 or 1 | 6 or more | linear |

Score = points earned ÷ weights available × 100, rounded. Bands: 80+ "restful", 60–79 "fair", below 60 "rough".
Sleeping past the goal is not penalised. The score is not a diagnosis, is not sleep debt, and does not predict energy.

Why these choices: duration against a personal goal is the one input every entry has, so it carries half the weight;
efficiency and wake-ups are the two self-report signals of a broken night that members can realistically know; timing
against the member's *own* pattern (not a population norm) rewards consistency, which is the most actionable habit.
The thresholds are round numbers chosen for readability, not clinical cut-offs, which is why the score is described
as "by what you logged".

## Typical bedtime and wake time (`sleep-stats.ts`)

With at least 3 nights in the last 14: the **circular median** of bedtimes and of wake times (so 11:30 PM and
12:30 AM average to around midnight), and the average distance from it ("moves ±20 min"). Steadiness: within 30 min
"steady", within 60 "variable", otherwise "irregular". With fewer nights only an invitation to log more is shown.

## Sleep goal

`profiles.sleep_goal_minutes`, 4–12 hours, default 8 hours, set by the member. It is a target they chose, not a
measured need. Goal completion = time asleep ÷ goal, shown uncapped (a long night reads over 100%).

## Estimated sleep debt (`sleep-debt.ts`, debt version 1; Plus)

A rolling estimate over the last 14 nights, kept separate from the nightly score:

- A night under the goal adds its whole shortfall (`goal − asleep`).
- A night over the goal pays back **half** of the extra (`(asleep − goal) × 0.5`), and only against what is still
  owed, so sleeping in never cancels lost sleep hour for hour and the estimate never goes below zero.
- A night with nothing logged changes nothing; it is shown as "not logged", never as zero sleep.
- Trend: the estimate now against the estimate a week earlier (±60 min = rising/falling), once three nights are logged.
- Bands: up to 1 h "on track", up to 3 h "a little behind", beyond that "running a deficit".

The half-rate repayment is a conservative assumption, chosen because recovery sleep does not restore a deficit
one-for-one; it is not a measured recovery rate. The page shows every night's addition and repayment so the total can
be checked by hand.

## Check-ins and patterns (`sleep-checkins.ts`)

Check-ins are optional self-reports (1–5 ratings and yes/no habits). The history page compares nights **with** a
reported habit (caffeine from 2 PM, alcohol, a large late meal, evening screens, evening training, travel, any noted
disturbance) against nights **without** it: average time asleep and average restedness. A comparison is shown only
with at least 3 nights on each side and a difference of 15+ minutes or 0.5+ rating points, and it is always worded as
a pattern in the member's own entries, never as a cause.

## Suggested sleep windows (`sleep-schedule.ts`, schedule version 1; Plus)

Arithmetic on the member's own times, never a circadian measurement:

- **Anchor wake time** = the wake time the member chose to keep, else their typical wake time (needs 3 nights in the
  last 14). Without either, only consistency guidance is shown.
- **Wake-up window** = anchor ± 15 min. **Bedtime window** = (anchor − goal − typical time to fall asleep − 10 min
  to settle) ± 30 min, where the typical time to fall asleep is the median of the entered values, or 15 min when none
  were entered (and the page says so).
- **Gradual adjustment**: when the usual bedtime is more than 30 min from the window's centre, the plan is 15 min a
  night in that direction, with the wake time held fixed.
- **Consistency** 0–100 = 100 × (1 − average spread ÷ 120 min), where the spread is the mean of the bedtime and wake
  spreads. **Weekend shift** = distance between the typical weekday and weekend wake times (3 nights each).

## Estimated daily energy (`sleep-energy.ts`, energy version 1; Plus)

An hour-by-hour sketch, not a measurement. For each hour after waking (t hours since waking): sleep pressure
`100 − 45·t/16`; a slow start `−25·e^−(t/1.6)²`; an early-afternoon dip `−14·e^−((t−7)/1.4)²`; and a wind-down
of up to −24 in the last two hours before the bedtime window. The whole curve is multiplied by a factor that falls
by up to 20% for a short last night (relative to the goal) and up to 20% for an estimated sleep debt of 8 hours, never
below 60%. Peaks are hours within 6 points of the day's maximum; dips are local lows at least 15 below it, excluding
the final wind-down. The four assumptions are printed on the page, and reported energy is shown beside the estimate.

## Habit tips (`sleep-habits.ts`, habits version 1)

Ten plain rules over the last 14 nights and check-ins (wake time moving more than ±45 min; usual bedtime far later
than the window with short sleep; caffeine after 2 PM, evening screens or a large late meal on 3+ check-ins; a weekend
wake shift over an hour; typically more than 30 min to fall asleep; noise/light/temperature disturbances on 2+
nights; 3+ naps with 2+ after 3 PM; an estimated debt over 2 hours). Each tip carries the evidence it came from and
one action; at most three show at a time; dismissed tips stay hidden until restored. None concern medication.

## Wake-up alarm (`sleep-alarm.ts`, alarm version 1)

A fixed time on chosen days, saved to the account and scheduled on the phone as one weekly repeating notification per
day (ids 5401–5407, snooze 5410), with Snooze (one more notification after the chosen minutes) and I'm up (opens the
morning check-in). The "next alarms" list is computed in the profile time zone from the saved settings, so it follows
clock changes. The alarm is only as reliable as the phone's notification scheduler: silent mode, Focus, battery saving
and force-closing the app can stop it, and on Android it is exact only where "Alarms & reminders" is allowed. A smart
window (sounding earlier in light sleep) would need background sleep detection, which does not exist, so no alarm
ever sounds before the set time. Nothing here has been tested on a physical phone.

## Not in this version

Stage intervals are only ever imported; the app never infers them. Automatic detection from motion or sound, the
smart-alarm window and nighttime sound analysis (Phase D) will be documented here if and when they ship.
