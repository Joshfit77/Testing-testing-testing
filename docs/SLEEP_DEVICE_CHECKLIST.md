# Sleep & Recovery: physical-device checklist (Stage D4)

Nothing in this list has been run. The cloud environment has no iPhone, Android phone, HealthKit, Health Connect or
notification scheduler, so every native sleep feature is labelled **Implemented, physical-device testing needed**
until someone works through this on real hardware and records the results. Tick each row with the device, OS
version and build number.

## Before you start

- A Capacitor build of the current branch installed on an iPhone (iOS 17+) and an Android phone (Android 13+ with
  Health Connect installed).
- A test account with wellness consent given (Sleep & Recovery > "Allow sleep logging").
- A watch or sleep app that writes sleep to Apple Health / Health Connect, with at least two nights recorded.

## A. Health-platform import (B4 / D1)

| # | Step | Expected |
| --- | --- | --- |
| A1 | Sleep hub > "Connect Apple Health / Health Connect" with permission not yet granted | The system permission sheet asks for Sleep, Heart Rate, Heart Rate Variability and Respiratory Rate (read only). |
| A2 | Deny, then tap import again | A plain message naming where to allow it (Health > Sharing > Apps / Health Connect > App permissions); nothing imported. |
| A3 | Allow and import | "N added, M already there, K overlapped" matches the health app's own list for the last 14 days; nights appear with "Apple Health" / "Health Connect" as the source and stages where the watch recorded them. |
| A4 | Import a second time | 0 added, everything "already there"; no duplicates in history. |
| A5 | Enter a night by hand that overlaps an imported one, then import again | The hand entry stays; the overlapping record is counted as "overlapped", not merged. |
| A6 | Switch import off, then tap import | Button disabled; nothing read. Switch on: works again. |
| A7 | "Delete imported entries" | Imported nights gone, hand entries kept, the health app's own records untouched. |
| A8 | Revoke the permission in the health app, then import | Clear "access wasn't allowed" message, nothing crashes, earlier imports stay. |
| A9 | Wear the watch for one night, open the app in the morning | The hub's source card syncs by itself (last sync older than 30 min), "Last synced just now", last night shows "Recorded by {watch}", the stage bar and the three measurement tiles. Compare the stage totals with the health app's own: they must not exceed it (in-bed envelope not double-counted). |
| A10 | Pull the hub down, and tap Sync now | Each triggers one sync; a second within 30 min adds 0 and no duplicate night appears. |
| A11 | A night where only the phone recorded (no watch) | Night appears without stages ("stage not given"), measurement tiles say "Not recorded"; nothing is invented. |
| A12 | Deny only Heart Rate (Android) | Sleep imports; the card names the series not allowed; HR tile says "Not recorded". iOS: the tile says "Not recorded" (iOS doesn't report read denials). |
| A13 | Settings > Connected devices > Disconnect | Status shows "Not connected", auto-sync stops; nights stay. "Disconnect and remove imported" removes imported nights, hand entries and the health app's records stay. |
| A14 | Nightly report of a recorded night | Hypnogram, stage shares and "Every interval" match the watch app's own; overnight heart rate min/avg/max within the health app's night range; HRV labelled SDNN (iOS) / RMSSD (Android). |
| A15 | AI coach: "how did I sleep last night?" (with AI data consent on) | Reply quotes the recorded figures, names the device, compares only with the member's own nights, suggests no diagnosis and changes nothing. |

## B. Wake-up alarm (D2)

| # | Step | Expected |
| --- | --- | --- |
| B1 | Sleep > Wake-up alarm, notifications not yet allowed; enable, pick a time two minutes ahead, save | System notification permission prompt; then "1 weekly alarm scheduled on this phone" (Android: or the "may sound a few minutes late" note with an "Allow exact alarms" link). |
| B2 | Lock the phone and wait | The notification arrives at the minute (Android: only if exact alarms are allowed), with Snooze and I'm up actions. |
| B3 | Tap Snooze | A second notification arrives after the chosen snooze minutes. |
| B4 | Tap I'm up | The app opens on the morning check-in. |
| B5 | Change days/time and save | The "Next alarms" list and the pending count change accordingly; the previous schedule is gone (no double alarms). |
| B6 | Switch the alarm off and save | "No alarm is scheduled on this phone"; nothing arrives at the old time. |
| B7 | Silent mode / Do Not Disturb / Focus on | Record what the OS does; the settings page already warns these can stop the alarm. |
| B8 | Force-close the app, wait for the time | Record whether the notification still arrives (it should: it is scheduled with the OS). |
| B9 | Reboot the phone before the alarm time | Record whether it still arrives (Android: the plugin re-registers on boot). |
| B10 | Battery use after a week with the alarm on | No measurable change: the alarm is an OS schedule, not a running process. |

## C. Not testable yet (nothing to run)

- Motion/microphone sleep detection and the smart-alarm window (D1 background detection): not built.
- Nighttime sound analysis (D3): design only.

## Recording results

Add a dated section below with device, OS, build, and a line per row (pass / fail / what happened). Only after
every row in A and B passes on both platforms can the plan's "Implemented, physical-device testing needed" labels
change to "Complete and tested".
