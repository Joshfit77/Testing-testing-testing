# GPS run / walk tracking — physical device test script

Companion to `docs/audit-2026-11-07/gps.md`. Everything in this script **cannot be proved in a browser or in CI**: it needs
the native build (TestFlight on an iPhone, an internal-test APK on Android) installed on a real phone, outdoors. Until
these pass, GPS recording is "browser-tested"; background and locked-screen recording are "not verified".

Record results in `docs/device-testing/<date>-<phone>.md`: phone model, OS version, app build, each step's result, and
the "GPS details" panel figures (counts only; it never shows positions).

## Before you start
- Native build with `@capacitor-community/background-geolocation` synced (`npx cap sync` has never been run in the
  development environment; confirm the plugin is in the build: the recorder's not-started screen must read
  "Native GPS (background recording; …)", not "Browser location (keep this screen open)").
- A Pro All Access account and a Free account.
- A reference: a GPS watch or a second phone with a trusted running app, or a measured 400 m track.
- Airplane-mode knowledge: location works without data; the save needs data.

## A. Permissions (iPhone, then Android)
| # | Steps | Pass when |
| --- | --- | --- |
| A1 | Fresh install. Open /run → Outdoor → Record → Start. | The system location prompt appears only now (never on install or on /run). The wording matches `Info.plist` ("only during a run or walk you start"). |
| A2 | Choose "Don't Allow". | Recorder shows "Location permission is off…" with an **Open Settings** button; tapping it opens this app's Settings page. Time keeps counting; no distance. |
| A3 | Allow in Settings, return. Pause → Discard → Start again. | Fixes arrive; "Waiting for GPS" becomes "Recording" within ~30 s outdoors. |
| A4 | iPhone: Settings › Privacy › Location › Narrow Gate › **Precise Location off**. Start a walk. | Within ~10 fixes the yellow notice "Your device is only sharing an approximate location…" appears; distance stays 0.00; no route drawn. Turn Precise back on: recording proceeds. |
| A5 | iPhone: "Allow Once". Start, lock for 2 min, unlock. | Note whether fixes continued (expected: yes while the app is alive) and whether the next launch prompts again (expected: yes). |
| A6 | Android 13+: deny the notification permission when asked, then start. | Recording still runs; note whether the foreground-service notification is visible (expected hidden). |
| A7 | Android: choose "Approximate" location. | Same behaviour as A4. |

## B. Accuracy outdoors (compare with the reference)
| # | Steps | Pass when |
| --- | --- | --- |
| B1 | 4 laps of a 400 m track, lane 1, running. | 1.60 km ± 2 %; four 400 m-ish splits are not expected (splits are per km/mile) but the 1 km split time is plausible. |
| B2 | Measured 5 km road route. | ± 3 %. GPS details: "Ignored … off-route" under 5 % of readings; "Signal gaps: None". |
| B3 | City walk ≈ 1.5 km with two 2-minute stops at crossings. | ± 8 %; each stop adds < 20 m (watch the distance while stopped); "Readings used … (N while standing still, no distance)". |
| B4 | Stand still 10 minutes in the open. | < 25 m added. |
| B5 | Underpass / tunnel ≥ 20 s. | "GPS signal lost" notice appears after 15 s; after it: "The signal dropped 1 time … (about X m in a straight line)"; the route shows a dashed break; distance did not grow inside. |
| B6 | Walk, then jog > 14 km/h for 30 s, then walk. | The jog stretch is **not** counted for a walk (documented cap 4 m/s). Choose "run" for mixed sessions. Note the behaviour. |

## C. Background, lock screen and interruptions (iPhone first, then Android)
| # | Steps | Pass when |
| --- | --- | --- |
| C1 | Start a walk, lock the phone, walk 5 min, unlock. | Blue location pill (iPhone) / ongoing notification (Android) visible while locked. On unlock: distance includes the locked stretch (± 3 % vs reference), route continuous, **no** "signal dropped" note, GPS details "longest interval" is a few seconds not 300. |
| C2 | Same, 20 minutes locked. | As C1, and still the same session (no "unfinished recording" offer). |
| C3 | Start, switch to Music/Maps for 5 min, return. | As C1. |
| C4 | Start, open Train → a workout in the app, come back via the "Recording walk" pill. | Pill shows distance growing; the recorder resumes seamlessly; one watcher only (location indicator never doubles). |
| C5 | Receive and answer a phone call for 2 min mid-run. | Recording continues; at most a short gap. |
| C6 | Low Power Mode on, 10 minutes recording. | Recording continues; note "Update interval" in GPS details. |
| C7 | Force-quit the app mid-run, reopen within a minute. | "You have an unfinished run from HH:MM" offer; **Continue recording** resumes with a dashed break and the time away counted; the location indicator was gone while quit. |
| C8 | Leave the app quit for > 12 h, reopen. | No offer; the draft was removed. |
| C9 | Let iOS kill the web view in the background (long lock, heavy memory use). | On reopen the page reloads and offers the unfinished recording. **Check the location indicator**: if it stays on without a recorder, report it (known risk, `docs/GPS_BACKGROUND_IPHONE.md` §2). |
| C10 | Battery: 1-hour recording, screen locked. | Note % used. |

## D. Saving, connectivity and plan
| # | Steps | Pass when |
| --- | --- | --- |
| D1 | Finish a walk, review, Save. | Lands on the activity page "Walk saved" with route, splits, GPS note; History shows it once. |
| D2 | Airplane mode (keep Wi-Fi off), finish and Save. | "You're offline. Your recording is kept on this device…". Close the app, reopen → "Your walk from HH:MM wasn't saved yet" → Review and save. With data back, Save works, and History shows it **once**. |
| D3 | Tap Save twice quickly on a slow connection. | One activity. |
| D4 | Save, then kill the app before the page changes; reopen; if the draft is offered, save again. | Still one activity ("Already saved"). |
| D5 | Free account: /run → Outdoor. | "Live GPS recording is included with Pro All Access" lock, no Start button, no location prompt. Manual / treadmill entry works. |
| D6 | Free account that recorded while Pro (lapse): open Record. | The finished recording is kept with the explanation; no Save button. |
| D7 | Delete a saved GPS walk from its page. | Gone from History and from the weekly totals; (support) the row's route/splits are null in the database. |
| D8 | Treadmill entry on the Log tab. | Saves with "Treadmill" badge, no route, "No route: treadmill entries don't have GPS data", and no location prompt at any point. |

## E. Apple Health / Health Connect
The app does **not** write workouts to Apple Health or Health Connect (read-only integration for steps and sleep;
`NSHealthUpdateUsageDescription` says so). Confirm on the device that recording and saving a run creates **no** entry
in Health → Workouts, and that Health's Sharing list for the app shows no write categories. If writing workouts is
wanted, it is a new feature (plugin write permission, idempotency key = activity id, duplicate check by start time)
and needs the owner's approval first.
