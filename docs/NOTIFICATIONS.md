# Reminders and notifications

Profile → Notifications (`/profile/notifications`) holds every optional reminder in one place, in five groups:
Faith, Workouts, Food & water, Recovery & sleep, and System. Everything is **off** until the member turns it on, one
reminder at a time. There is deliberately no "turn everything on" control. Settings are saved to the **account**, and
the iPhone / Android app delivers them as **local notifications**, even when the app is closed. A web browser can't
remind anyone while the site is closed, and the screen says so.

**Status (2026-11-03):** implemented and tested in code: unit tests, database tests and a browser test at iPhone and
Android phone sizes. **Delivery on a real iPhone or Android phone has not been verified.** The device tests at the end
of this file still have to be run by hand.

## What was reused and what is new

| Reused (unchanged or extended) | New |
| --- | --- |
| Faith reminder kinds, copy, dated DST-safe scheduling, quiet-hours logic (`src/lib/faith-reminders.ts`) | One planner for all reminders (`src/lib/notifications/planner.ts`) |
| `faith_reminders` table | `notification_reminders`, `notification_prefs`, `notification_devices` (migration 055) |
| Capacitor LocalNotifications plugin, permission pattern, rest timer (4201) and sleep alarm (5400–5410), both untouched | Android channels, tap-to-open, resync on open/resume/time-zone change, cancel on completion, sign-out clean-up (`src/lib/native-notifications.ts`) |
| Workout message styles (Friendly / Faith-inspired) from `src/lib/reminders.ts` | Workout, recovery, meal, water, weekly review, training-plan and wind-down reminders (`src/lib/notifications/catalog.ts`) |
| Completion cancel on the Faith tab and journey | The same on Home, Food, and when a workout is finished |

The old device-only workout reminder (`ngf.workoutReminders.v1`) is moved into the account the first time the updated
app opens, once, and only if the account has no workout reminder yet. The old Faith reminders page
(`/faith/reminders`) redirects to the new screen.

## Categories

| Group | Reminder | Repeats | Not sent when | Opens |
| --- | --- | --- | --- | --- |
| Faith | Bible reading | chosen days | today's reading is marked | journey, or the Bible |
| Faith | Prayer | chosen days | today's prayer is marked | journey, or the prayer journal |
| Faith | Evening check-in | chosen days | both reading and prayer are marked | journey, or Faith |
| Faith | Before midnight (strict journey) | chosen days | no strict journey is active, or both are marked | journey |
| Faith | Faith challenge / Fitness goal | chosen days | done today (fitness also when a workout or recovery reminder is already planned that day) | Faith |
| Faith | Devotional / Daily practices / Memory practice | chosen days | (weekly repeating) | Faith / practices / memory |
| Faith | Reading plan progress | once a week | no plan is active | journey |
| Faith | Prayer follow-up | once a week | there are no open prayer requests | prayer journal |
| Workouts | Scheduled workouts | program training days (or chosen days without a program) | today's workout is finished; a rest day | Train |
| Workouts | This week's training plan | once a week | no program is active | Train |
| Workouts | Weekly progress review | once a week | — | My Progress |
| Food & water | Breakfast, Lunch, Dinner, Snacks | chosen days | a meal of that kind is logged today | Food |
| Food & water | Water | every 1–4 hours between two times (max 8 a day) | today's water goal is reached | Food |
| Recovery & sleep | Recovery days | program rest days (or chosen non-workout days) | a workout was done anyway | Recovery |
| Recovery & sleep | Wind down for sleep | chosen days (suggested time: 30 minutes before the bedtime the sleep goal implies) | — | Sleep |

The System group covers:

- Pause all optional reminders.
- Quiet hours, which now apply to every reminder. Existing Faith quiet hours were carried over.
- A daily limit, by default 8 a day.
- A preview of the next 24 hours.
- The member's devices.
- A privacy statement.
- A note that the rest-timer alert and the wake-up alarm are separate.

There is no marketing or promotional notification type, and the database refuses any kind outside the list above.

## Scheduling behaviour

- **Time zone.** Times follow the account's time zone, the same clock as the reading journey's day. Each day's time
  is computed separately, so a reminder stays at the same wall-clock time across daylight-saving changes. A time that
  a spring-forward change skips moves an hour later rather than being lost.
  - Weekly repeating reminders fire by the phone's clock, so they are converted when the phone is in another zone.
  - When the phone's zone differs from the account's, the screen says so and offers "Use <zone>". That also moves the
    reading journey's day.
- **Dated and weekly reminders.** Reminders that depend on what's done are scheduled for specific dates, up to 7 days
  ahead. Weekly ones (devotional, practices, memory, plan progress, prayer follow-up, weekly review, training plan,
  wind-down) repeat by themselves, so they keep arriving even if the app isn't opened for weeks.
- **Completion-aware.**
  - Nothing is scheduled for today once that activity is done.
  - Finishing a workout, logging a meal or water, or marking reading or prayer cancels today's reminder on that phone
    at once. Each notification carries its kind and date.
  - Later days are kept, because they can't be known yet.
- **Recovery instead of workout.** With a program, training days get the workout reminder and rest days get the
  recovery reminder, never both. Without a program, the chosen workout days are used.
- **Limits.**
  - On each day the most important reminders win, up to the daily limit. In order: before midnight, evening check-in,
    reading, prayer, workout/recovery, challenge, meals, wind-down, the weekly ones, the fitness goal, snacks, water.
  - iOS keeps only 64 pending notifications per app. The planner holds at most 55, soonest first, leaving room for the
    sleep alarm and rest timer.
  - Each id is used once, so a rebuild never duplicates a reminder.
- **When the schedule is rebuilt.** On app launch, when the app returns to the foreground after 15 minutes, at once
  after a time-zone or date change, and after saving settings.
  - Android restores pending notifications after a reboot (the plugin's boot receiver).
- **Offline.**
  - If the account can't be reached, the phone keeps what it already has, and those reminders still arrive.
  - Something done on another device, or while offline, only cancels this phone's reminder the next time this phone
    reaches the account. The app does not claim to know about it sooner.
- **Several phones.**
  - Each phone that signs in appears under Devices (a random id, not a hardware id; at most 10 are kept).
  - Each phone can be switched off, so reminders don't arrive twice. The screen points this out when more than one
    phone has been active recently.
  - Phones are not coordinated automatically: the member chooses.
- **When notifications can't be shown** (a web browser, or permission not given):
  - Home shows "Today's reminders" with each item done, upcoming or "Earlier today" (missed).
  - The settings screen shows the permission status and how to allow notifications. The app never re-prompts on its
    own.
- **Permission.** Asked for only when the member saves a reminder that's on, never at launch.

## Privacy safeguards

- Every title and body is fixed text from the catalogue. Nothing the member wrote (prayers, journal, notes) and no
  health detail or amount (weight, calories, meals, water, sleep) ever appears. The unit test
  `tests/unit/notification-copy.test.ts` checks every notification the planner can produce.
- No guilt about food, weight or missed days. Nothing ties a reminder to anyone's salvation or standing before God.
  The wording for reading, prayer and the evening reminder is the owner's.
- Android channels are created as *private*: a secure lock screen shows only that a notification arrived.
- The prayer follow-up only counts open requests on the server. It never reads or sends their text.
- Settings are owner-only (row-level security), included in the data export, and deleted with the account.
- Signing out removes every notification this app scheduled on the phone, sleep alarm and rest timer included. A
  different account signing in on the same phone never inherits the previous member's reminders.

## Physical-device tests still required (DT-NOTIF)

None of these has been run. They need the iPhone app (TestFlight or Xcode) and an Android build.

| ID | Test | Platforms |
| --- | --- | --- |
| DT-NOTIF-01 | Permission: first Save with a reminder on shows the system prompt once; Allow and Don't Allow are each reported on the screen; denying never re-prompts | iPhone, Android 13+ |
| DT-NOTIF-02 | Delivery with the app closed (force-quit) and the phone locked, for one dated reminder and one weekly one | both |
| DT-NOTIF-03 | Lock screen: with "Show previews: When unlocked" (iOS) / "Hide sensitive content" (Android), only the app name appears; with previews on, only the catalogue text | both |
| DT-NOTIF-04 | Tap a reminder (app closed, and app in background): it opens the right screen (journey, Bible, Food, Train, Sleep) | both |
| DT-NOTIF-05 | Complete the activity, then wait past the time: no reminder (reading marked, meal logged, workout finished, water goal reached) | both |
| DT-NOTIF-06 | Travel: change the phone's time zone, reopen: the screen offers the new zone; times follow after "Use …" | both |
| DT-NOTIF-07 | Daylight saving: set the phone's date to the night before a change, schedule a morning reminder, check it fires at the same local time | both |
| DT-NOTIF-08 | Reboot (Android): reminders still arrive after a restart without opening the app | Android |
| DT-NOTIF-09 | Two phones on one account: both deliver; switching one off under Devices stops it after it next opens | both |
| DT-NOTIF-10 | Account switching (DT-SWITCH-04 in the device script) | both |
| DT-NOTIF-11 | Channels: Settings → Apps → Narrow Gate Fitness → Notifications lists the four groups, each switchable | Android |
| DT-NOTIF-12 | Busy day: many reminders on; no day exceeds the daily limit; the sleep alarm still rings | both |
| DT-NOTIF-13 | Inexact delivery on Android: reminders may arrive a few minutes late (no exact-alarm permission is requested); record the delay | Android |
