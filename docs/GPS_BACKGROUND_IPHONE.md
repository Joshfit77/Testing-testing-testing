# Background GPS on a physical iPhone: audit (2026-11-04)

What the run/walk tracker does when the phone is locked or the member leaves the recording screen, what is configured,
what can still go wrong on a real iPhone, and how to test it. **None of the background behaviour below has been
verified on a physical iPhone yet.** Everything marked "checked" was checked in code and in automated tests only.

## How it works

| Layer | What it does | Where |
| --- | --- | --- |
| Native location | `@capacitor-community/background-geolocation` 1.2.26. Its iOS watcher sets `allowsBackgroundLocationUpdates = true`, `showsBackgroundLocationIndicator = true` (the blue status-bar pill), `pausesLocationUpdatesAutomatically = false`, `distanceFilter = none`, and asks for "Always" authorization (iOS first offers "Allow While Using App"). | `src/lib/native/location.ts`, `node_modules/@capacitor-community/background-geolocation/ios` |
| iOS settings | `UIBackgroundModes: location`; `NSLocationWhenInUseUsageDescription` and `NSLocationAlwaysAndWhenInUseUsageDescription` say location is used only during a run or walk the member starts. | `ios/App/App/Info.plist` (checked) |
| The page | Fixes go through one route (`routeFix`) into the track; a 1-second clock detects signal loss; the track is saved on the device every 5 s. Leaving the recording screen mid-recording hands the watcher to a keeper so the recording continues while the member uses the rest of the app (the "Recording walk/run" pill leads back). | `src/components/run/gps-recorder.tsx`, `src/lib/run/live-recording.ts`, `src/lib/domain/gps-track.ts` |
| Browser / web | `navigator.geolocation.watchPosition` only works while the page is visible. The recorder says "keep this screen open"; any time without fixes is a gap, never distance. | same |

## Limitations on a physical iPhone

1. **The page's JavaScript can be paused while the phone is locked.** The app loads the site in a WKWebView. iOS keeps
   the native location manager running (background mode), but the web view's JavaScript, including the 1-second clock
   and the code that receives fixes, can be suspended. The plugin queues fixes and delivers them when JavaScript runs
   again.
   - **Fixed today:** if the clock ran first after an unlock, it saw "no fix for 15 s" and broke the route, so the
     stretch until the first queued fix was not counted. The clock is now suspend-aware (`suspendAwareTicker` in
     `gps-track.ts`): after a pause of more than 5 s it waits 15 s for the queued fixes before calling the signal lost.
     If none arrive, the gap is recorded as before. Tests: `tests/unit/gps-track.test.ts`, "a locked phone".
   - **Not known without a device:** whether the plugin delivers every queued fix or drops some, and whether iOS keeps
     the web view's JavaScript running at all with location in the background (it often does, at a reduced rate).
2. **iOS can end the web view's content process in the background** (memory pressure, a long lock). The page then
   reloads when the app is opened. The saved track (at most 5 s old) is offered as an "unfinished recording", but the
   time between the last save and the reload is a gap. The native watcher from the old page may keep running with
   nobody listening (battery, blue pill) until the app is closed. **Test this on a device** (see below). If it happens,
   the fix is a native-side store of fixes (see 6).
3. **Authorization.** "Allow While Using App" plus the background mode is enough for a recording started on screen.
   "Allow Once" ends when the app is closed. "Don't Allow" is handled (the recorder shows how to open Settings). If
   the member turns off Precise Location, fixes are ~1–3 km accurate and are rejected (> 25 m), so the recorder waits
   for a fix; it should say why (not yet checked on a device).
4. **Low Power Mode and thermal throttling** can reduce the fix rate. Fewer fixes mean a slightly shorter, straighter
   route, never invented distance.
5. **Full reloads end the in-memory recording.** In-app navigation keeps it (the keeper). A pull-to-refresh, a server
   redirect to a full page, or the app being killed ends the watcher; the saved track is offered back.
6. **Plan B if device testing shows dropped points:** `@transistorsoft/capacitor-background-geolocation` stores fixes
   natively (SQLite) and has motion detection. It is free on iOS but needs a paid licence for Android release builds;
   that needs the owner's approval before it is added (`docs/RUN_TRACKING_PLAN.md`).

## Device test (needs a TestFlight build on a physical iPhone)

Do each outdoors, with a known route (a 400 m track or a measured loop), and compare with another GPS watch or app.

| # | Test | Pass when |
| --- | --- | --- |
| 1 | Start a walk, lock the phone for 5 minutes while walking, unlock | Route has no straight-line jump; distance within ~3% of the reference; the blue pill showed while locked |
| 2 | Same with 20 minutes locked | As 1, and the recording is still the same session (no "unfinished recording" offer) |
| 3 | Start, switch to another app (Music) for 5 minutes, return | As 1 |
| 4 | Start, open Workouts in the app, come back via the "Recording" pill | Distance kept growing in the pill; route continuous |
| 5 | Start, force-quit the app, reopen | "Unfinished recording" offered; the blue pill gone after quitting |
| 6 | Deny location, then allow from Settings | Recorder explains and recovers |
| 7 | Precise Location off | Recorder says it is waiting for an accurate fix |
| 8 | Low Power Mode on, 10 minutes | Recording continues; note the fix rate (Diagnostics) |
| 9 | Finish and save; check the route and splits; delete it | Saved once; deleted everywhere |

Record results in `docs/device-testing/` with the iOS version and phone model.
