# Run tracking plan

_First written 2026-10-20 (Stage 1B) as a plan. Live GPS recording was built on 2026-10-22 as Stage 4 of the nine-feature build (branch `claude/nine-features`); the status below is current. **Background / locked-screen recording has not been tested on a real iPhone or Android phone.** Until the device checks at the end of this file pass, treat it as "implemented, physical-device testing needed"._

## Status (Stage 4)

> **Update 2026-10-23:** distance is now measured along a Kalman-smoothed track. It uses outlier rejection, a
> standing-still rule, a restart after a bad first fix, a "GPS details" diagnostics panel and a richer route map.
> Measured on controlled traces in `docs/GPS_ACCURACY.md`, which also lists what still needs a real phone. The rules
> below still hold: nothing is counted before a good fix, across a pause or across a signal gap.

**Built and tested in the browser (Playwright with simulated GPS, plus unit and database tests):**
- `/run/record?kind=run|walk`: Start (location is requested only then), "waiting for a GPS fix", live distance, elapsed and moving time, current and average pace, splits per mile or km, Pause / Resume / Finish / Discard, a review screen with the route, effort and notes, then one idempotent save.
- Filtering in `src/lib/domain/gps-track.ts` as described under "Tracking algorithm": accuracy limits, out-of-order fixes, speed caps (run 10 m/s, walk 4 m/s), jitter, a new line after a pause or a 15 s signal gap (time counts, no distance is invented), interpolated splits, Douglas–Peucker simplification to at most 2,000 stored points.
- Crash and tab-close recovery: the recording is kept in local storage on this device and offered back ("Continue" or "Discard") when the page reopens.
- Guided runs: a running day of the member's program (`walk-to-run-beginner` (Free), `5k-training` and `10k-training` (Plus), and the existing run/walk plans) opens as `/run/record?day=…` with timed warm-up, run, walk and cool-down cues (vibration, optional voice). Saving counts the completed intervals in the program and finishes that day.
- Running goals: weekly or monthly distance and target times for 1 mile, 5K, 10K and half marathon (`running_goals`, owner-only, up to 10). The Run overview shows weekly distance and pace charts.
- Activity detail: SVG route map (no map tiles, so no third-party map service), splits and a GPS-quality note. Routes are private (`is_private` defaults to true) and are removed with the account.
- Database (`supabase/migrations/20261024000029_gps_running.sql`): `gps_quality`, `workout_session_id`, size limits on `route` (150 kB) and `splits` (600), and `running_goals` with its limit trigger.

**Fixed along the way:** the site's `Permissions-Policy` header was `geolocation=()`, which made every browser refuse location before asking. It is now `geolocation=(self)` (`src/lib/security-headers.ts`, with a unit test).

**Prepared, not verified on a device:**
- `@capacitor-community/background-geolocation` 1.2.26 is in `package.json`, `android.useLegacyBridge` is set, and the iOS `NSLocation*` strings, `UIBackgroundModes: location` and the Android location and foreground-service permissions are in place. `src/lib/native/location.ts` uses the native watcher when it is present in the app build and the browser's `watchPosition` otherwise. `npx cap sync` and a native build have **not** been run here (no Xcode or Android SDK), so the installed apps don't contain the plugin yet.

**Not built yet:** auto-pause; a "Return to Run" bar on other pages while recording; best efforts inside longer runs (records still use whole activities); map tiles (would need an approved map provider; options, all needing the owner's approval before activation: OpenStreetMap's public tile servers, which forbid heavy app use under their usage policy; MapTiler or Mapbox, each with a free monthly tier and paid use beyond it; or Apple MapKit JS / Google Maps with their own keys and billing); `@capacitor/geolocation` (not needed: the browser API and the background plugin cover both cases).

## What exists after Stage 1B

- `activities` table (`supabase/migrations/20261020000010_activities.sql`), one row per run or walk, owner-only RLS, soft delete (`deleted_at`). Columns that Stage 3 fills: `source = 'gps'`, `route` (jsonb, allowed only when `source = 'gps'`), `splits` (jsonb array), `moving_s` (excludes paused time), `external_id` (wearable or health-app imports).
- The row `id` is generated on the client before the first save. That makes it the stable activity id: retries and double submits save once, and badges or records can key on it.
- Duplicate guards: a unique `(user_id, source, external_id)` for imports, and a unique `(user_id, source, started_at)` for live GPS rows.
- Pure helpers in `src/lib/domain/activities.ts`, unit-tested: unit conversion, pace formatting, `movingSecondsFromSegments` (moving time from un-paused segments), weekly totals in the user's time zone, and personal bests. A self-reported (manual or treadmill) record is flagged separately from a GPS one.
- `/run` hub (Stage 1B): Treadmill/Manual entry, History grouped by week, plus activity detail, edit and delete. Stage 4 replaced the "coming next" card on the Outdoor tab with Outdoor run / Outdoor walk recording.

## Platform inspection (2026-10-20, before Stage 4)

| Item | Finding |
| --- | --- |
| Capacitor | `@capacitor/core`, `ios` and `android` 8.5.3. iOS uses Swift Package Manager (`ios/App/CapApp-SPM/Package.swift`), with deployment target iOS 15.0. |
| App model | The native shells load the deployed Next.js site (`server.url` in `capacitor.config.ts`). Native plugins are reachable from those pages through the Capacitor bridge. Plugins must be added to `package.json` and synced (`npx cap sync`) **and** a new native build must be shipped. A web deploy alone doesn't add them. |
| Installed plugins | app, barcode-scanner, haptics, local-notifications, splash-screen, status-bar, `@capgo/capacitor-health`. **No location plugin.** |
| `ios/App/App/Info.plist` | Has `NSCameraUsageDescription`, `NSHealthShareUsageDescription` and `NSHealthUpdateUsageDescription`. **No `NSLocation*` keys and no `UIBackgroundModes`.** |
| `android/app/src/main/AndroidManifest.xml` | Only `INTERNET` and `CAMERA`. **No location or foreground-service permissions.** `minSdk` 26, `targetSdk` and `compileSdk` 36. |
| Device testing | None possible in this environment (no Android SDK downloads, no Mac or Xcode). |

## Plugins (versions checked on npm 2026-10-20; pin versions at least two weeks old)

| Purpose | Package | Pin | Notes |
| --- | --- | --- | --- |
| Foreground location (screen on, app open), permission prompts | `@capacitor/geolocation` | `8.2.3` (released 2026-10-02; 8.2.4 from 2026-10-16 is too new) | Official plugin, peer `@capacitor/core >=8`, SPM `from: "8.0.0"`, iOS 15. Supports `watchPosition` with `enableHighAccuracy`. On the web it falls back to `navigator.geolocation`. |
| Background / locked-screen location (preferred: free) | `@capacitor-community/background-geolocation` | `1.2.26` (2025-08-28) | MIT. Peer `@capacitor/core >=3`, SPM `from: "7.0.0"` (resolves with 8.x). Its Android manifest merges `ACCESS_FINE/COARSE_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS` and a `foregroundServiceType="location"` service. Needs `android.useLegacyBridge: true` in `capacitor.config.ts`, otherwise updates stop after about 5 minutes in the background. Points are delivered to JavaScript, so the WebView must stay alive. **Verify on a device that a locked iPhone keeps delivering points to the WKWebView.** |
| Background location (alternative: commercial) | `@transistorsoft/capacitor-background-geolocation` | `9.6.0` (2026-09-27) | Peer `@capacitor/core ^8`. License is "CUSTOM": free to evaluate and free on iOS, but **Android release builds need a paid per-app license key** (check current pricing at transistorsoft.com before choosing). Stores locations natively (SQLite) and has motion-activity detection, so it's more robust if the community plugin loses points while the WebView is suspended. |
| Optional audio split announcements | `@capacitor-community/text-to-speech` | `8.0.2` (2026-06-15) | Uses the Web Speech API in the browser. |
| Keep the screen on while the run screen is visible (optional) | `@capacitor-community/keep-awake` | `8.0.1` | Not a substitute for background tracking. |

**Recommendation.** Start with `@capacitor/geolocation` for permission handling and the foreground watch, and the community background plugin for the native background watcher. If device testing shows dropped points on a locked iPhone or on Android after Doze, switch the background watcher to Transistorsoft and budget for its Android license.

## Native configuration (added in Stage 4)

**iOS (`ios/App/App/Info.plist`):**
- `NSLocationWhenInUseUsageDescription`, e.g. "Narrow Gate Fitness uses your location during a run or walk you start, to measure distance, pace and your route."
- `NSLocationAlwaysAndWhenInUseUsageDescription`, e.g. "Allows a run you started to keep recording while your phone is locked. Location is never used when you're not recording."
- `UIBackgroundModes` → `location`. App Review expects visible justification: tracking starts only from an explicit Start, with the blue status-bar indicator (`showsBackgroundLocationIndicator`).
- Request "When In Use" first. Apple allows background updates for a session started in the foreground with When-In-Use plus the background mode, so ask for "Always" only if testing proves it necessary.

**Android (`AndroidManifest.xml`; the plugin merges most of these, list them explicitly for review):**
- `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`.
- `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` (Android 14+), and a `foregroundServiceType="location"` service with an ongoing notification ("Recording your run — tap to return").
- `POST_NOTIFICATIONS` (Android 13+), requested at runtime before starting, so the foreground notification is visible.
- Avoid `ACCESS_BACKGROUND_LOCATION`. A foreground service started while the app is visible doesn't need it, and requesting it triggers a stricter Play policy review.
- Play Console: declare the location foreground-service use and fill the Data safety form (location collected, linked to the account, private by default, deletable).

## Browser and PWA limitations

- `navigator.geolocation.watchPosition` works only while the page is visible. Browsers suspend or heavily throttle background tabs and locked screens, and **no browser or installed PWA offers background location**. The web build must say so plainly: "Keep this screen open; tracking pauses when the screen locks." Gaps must be recorded as gaps, never as invented movement.
- Requires a secure context (HTTPS or localhost) and a user gesture for the first permission prompt.
- Screen Wake Lock (`navigator.wakeLock`) can keep the screen on where supported. It's optional and drains the battery.

## Tracking algorithm

1. **Start.** Request permission when the user taps Start (not before). Show "Waiting for GPS…" until a fix with `accuracy ≤ 20 m` arrives (or let the user start anyway, clearly labelled "weak signal"). Never count distance before the first good fix.
2. **Filtering.** Drop points with `accuracy > 25 m`, duplicate timestamps, or an implied speed above a sanity cap (run 7 m/s ≈ 3:48/mi sustained is already elite; use 10 m/s for runs and 4 m/s for walks). Ignore jitter: moves smaller than `max(3 m, accuracy/2)` while stationary.
3. **Distance.** Haversine between accepted consecutive points within a segment. Optionally use a light Kalman or 1-D smoothing on lat/lng before distance to reduce zig-zag inflation.
4. **Current pace.** Exponentially weighted speed over roughly the last 20–30 s of accepted points, shown as "—" when there's less than 10 s or 20 m of data. Average moving pace = distance ÷ moving time (`paceSecondsPer`).
5. **Pause and resume.** Each Start/Resume opens a segment and each Pause closes it. `moving_s = movingSecondsFromSegments(segments)`, `elapsed_s = finish − start`. The route is stored as a **MultiLineString** (one line per segment), so no line is drawn across a pause.
6. **Lost signal.** If no accepted fix for 15 s, show "GPS signal lost" and start a new segment when the signal returns. The time still counts (the user is moving) but no distance is invented across the gap, and the map shows a gap. Optional auto-pause when speed < 0.5 m/s for 10 s, which the user can turn off.
7. **Splits.** When cumulative distance crosses each mile or km (the user's unit), interpolate the crossing time between the two bracketing points and append `{ index, unit, distance_m, moving_s, elapsed_s }` to `splits`. Optional text-to-speech announcement ("Mile 2, 9 minutes 58 seconds").
8. **Finish.** Stop every watcher and the foreground service **before** saving, then save with the client-generated id (idempotent). The draft lives in local storage so a crash or tab switch can resume it, and the compact "Return to Run" bar (SPEC §15) shows while a session is active.
9. **Privacy.** `is_private` defaults to true. Never send points to the server while recording (store locally, upload once at Finish). Consider trimming the first and last 200 m from any future shared view.
10. **Records and badges.** With GPS splits, the best 1 mi/5K/10K efforts can come from within longer runs (best rolling window over the point stream). Stage 1B counts only whole activities of the matching distance (up to 3% longer), because a manual entry has no intermediate timing. Badges should key on activity `id` and recalculate from live (not deleted) rows.

## Testing plan

- **Unit (CI):** filtering, haversine, segmenting across pauses and outages, split interpolation, current-pace smoothing, with recorded fixtures (GPX traces including a tunnel gap, a pause and noisy points).
- **e2e (browser):** Playwright with `context.setGeolocation` and granted permission to drive a scripted route. Covers record, pause, resume, finish, reopen and delete, plus "permission denied" and "no signal" states. Never asserts background behaviour.
- **Real devices (required, can't be done here):**
  - iPhone: start a run, lock the screen for 10+ minutes while walking, unlock, and check the distance against a known course. Check the blue indicator and that tracking stops at Finish.
  - Android 14+ (e.g. Pixel): same, plus the notification, Doze after 30+ minutes, denying `POST_NOTIFICATIONS`, and "approximate location only".
  - Compare against a reference watch on a measured 400 m track and a 5K route. Report the error percentage.
- Until those pass, checklist rows 7.15–7.26 stay Partial with "not verified on a device".
- Browser e2e for this plan: `e2e/gps-run.spec.ts` (record with pause, review, save once, route and history, goals; guided program run; permission denied). Unit: `tests/unit/gps-track.test.ts`, `tests/unit/run-session.test.ts`. Database: `tests/integration/gps-running.test.ts`.
