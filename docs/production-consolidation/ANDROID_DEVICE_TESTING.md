# Android device testing

**Status: not started on hardware.** Nothing below has been run on a physical Android device. An Android project exists (`android/`), and the compile-only APK workflow was run
on GitHub for this branch (see TEST_RESULTS.md). iOS is the launch platform; Android is secondary.

Use the APK from the Android workflow run (artifact), or a Play internal-testing build. Ideally test on a Pixel with
Android 15/16 and one older device (Android 12–13).

| # | Test | Exact steps | Expected result |
|---|---|---|---|
| 1 | Install and launch | Install the APK; open | Opening screen, then Welcome; no crash |
| 2 | Offline start | Airplane mode; open | The offline page and the offline Bible |
| 3 | Edge-to-edge (Android 15+) | Use both gesture and 3-button navigation | Header not under the status bar; tab bar not under the navigation bar (O-06) |
| 4 | Back button | With a sheet, dialog or menu open, press Back | Closes the top sheet, dialog or menu (O-07, fixed in code); with none open, goes back a page |
| 5 | Workout logging and rest timer | As iPhone tests 7–12 | Same results |
| 6 | Run with a foreground service | Fresh install; start a run; grant location when asked; lock 20 min. Repeat with location denied, then with notifications denied | The location prompt appears **before** any "Recording your run" notification (permission first). Then a "Recording your run" notification, fixes every 1–5 s, the service gone after Finish. Location denied: nothing starts and a message explains |
| 6a | Run journal after the app is killed | Start a run, lock 5 min, swipe the app away, reopen and open Run | The unfinished run is offered with the route up to the moment the app was killed (native journal in app storage) |
| 6b | Page recreated mid-run | During a run, Developer options → "Don't keep activities" on; switch to other apps for 2 minutes; return | The page comes back and the run continues with the 2 minutes recorded; the app doesn't close |
| 7 | Battery saver | Battery Saver on; 20-minute locked run | No gaps longer than 30 s |
| 8 | Health Connect | Steps and sleep → connect | Only 5 read permissions listed; the privacy-policy link opens and matches them (B-16) |
| 9 | Exact alarm | Set the sleep alarm 2 minutes ahead | Rings on time (SCHEDULE_EXACT_ALARM is declared by the notifications plugin; O-04 corrected). Snooze once: exactly one ring after the snooze time |
| 10 | Barcode scanner | Scan a product | Found and logged |
| 11 | Google Play purchase (internal test track) | Buy monthly; upgrade to yearly | Pro granted; proration handled by Google |
| 12 | Restore after reinstall | Reinstall, sign in, Restore | Pro restored |
| 13 | No backups of app data | Settings → backup | App data excluded (by design) |
| 14 | Keyboard | Inputs at the bottom of the logger | Stay visible |
| 15 | Account deletion | Profile → delete | Deleted; told to cancel the Google Play subscription |
