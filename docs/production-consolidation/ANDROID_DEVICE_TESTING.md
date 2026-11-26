# Android device testing

**Status: not started on hardware.** An Android project exists (`android/`), and the compile-only APK workflow was run
on GitHub for this branch (see TEST_RESULTS.md). iOS is the launch platform; Android is secondary.

Use the APK from the Android workflow run (artifact), or a Play internal-testing build. Ideally test on a Pixel with
Android 15/16 and one older device (Android 12–13).

| # | Test | Exact steps | Expected result |
|---|---|---|---|
| 1 | Install and launch | Install the APK; open | Opening screen, then Welcome; no crash |
| 2 | Offline start | Airplane mode; open | The offline page and the offline Bible |
| 3 | Edge-to-edge (Android 15+) | Use both gesture and 3-button navigation | Header not under the status bar; tab bar not under the navigation bar (O-06) |
| 4 | Back button | With a sheet or dialog open, press Back | Closes the sheet. Currently navigates the page underneath (O-07) |
| 5 | Workout logging and rest timer | As iPhone tests 7–12 | Same results |
| 6 | Run with a foreground service | Grant location and notifications; start a run; lock 20 min | A "Recording your run" notification; fixes every 1–5 s; the service gone after Finish. Repeat with notifications denied |
| 7 | Battery saver | Battery Saver on; 20-minute locked run | No gaps longer than 30 s |
| 8 | Health Connect | Steps and sleep → connect | Only 5 read permissions listed; the privacy-policy link opens and matches them (B-16) |
| 9 | Exact alarm | Set the sleep alarm | Note whether exact timing works; the permission isn't declared (O-04) |
| 10 | Barcode scanner | Scan a product | Found and logged |
| 11 | Google Play purchase (internal test track) | Buy monthly; upgrade to yearly | Pro granted; proration handled by Google |
| 12 | Restore after reinstall | Reinstall, sign in, Restore | Pro restored |
| 13 | No backups of app data | Settings → backup | App data excluded (by design) |
| 14 | Keyboard | Inputs at the bottom of the logger | Stay visible |
| 15 | Account deletion | Profile → delete | Deleted; told to cancel the Google Play subscription |
