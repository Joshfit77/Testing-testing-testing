# Audit 4: GPS, Apple Health / sleep, Capacitor iOS readiness, performance

Audited 2026-10-31 to 2026-11-01 on branch `worktree-agent-aade4276addd8537d`, based on `fc8d113` (the head of
`claude/exercise-demo-25d`, the checkout the demo was built from). **Nothing here ran on a physical iPhone, Apple
Watch, Android phone, Mac or Xcode.** Native behaviour was checked by reading this repository and the installed plugin
sources in `node_modules`, by unit tests with the Capacitor plugins mocked, by `npx cap copy ios` (which needs no
Xcode), and in Chromium at iPhone size.

How the browser checks were run: the demo on port 3000 refused connections for the whole audit, so it was not
used or restarted. I served the same prebuilt demo build (`OBUHDE9cWORtlESa06TL1`, copied from the main checkout's
`.next`) from my worktree with `next start` on `127.0.0.1:3150` (demo mode, local Supabase), and checked my fixes on
a dev server from my worktree on port 3187. Both are stopped. Evidence (screenshots, logs, scripts) is in the
worktree under `out/audit/`, which is gitignored: `audit-tour.mjs`, `tour.log`, `summary.json`, `verify-fixes.mjs`,
`verify-fixes.json`, `regression-against-old-code.txt` and the `iphone_*`, `ipad_*` and `fix_*` PNGs.

## 1. Findings

| Feature | Status | Verified problem | Fix performed | Remaining blocker |
|---|---|---|---|---|
| GPS distance, pace, moving and elapsed time | PASS | None. The GPS and sleep unit tests pass (13 files, 98 tests at the start of the audit), including `gps-track`, `gps-accuracy` (simulated noise, multipath, 30 s tunnels, pauses, standing still, duplicate and out-of-order fixes, a biased first fix, approximate location), `run-session` and `route-map`. In the browser tour, 20 s at 1.5 m/s read 0.02 mi with a 21 s moving time, consistent with the input. | — | Real-world accuracy needs a phone outdoors (`docs/GPS_ACCURACY.md` plan) |
| GPS: a finished run that wasn't saved | FIXED (P1) | Finishing, then failing to save (offline, expired session) or closing the app on the review screen, then reopening the record page **deleted the run** from the device. Reproduced in the demo build: `before=[status "finished"] after=[] offered=false` (`out/audit/tour.log`). | `689ea4a`: kept and offered back as "Review and save" for 12 h | — |
| GPS: location watcher lifecycle | FIXED (P3) | A watcher that finished starting after Pause, Discard, Finish or leaving the page was kept, so location (and on Android the foreground service) stayed on | `689ea4a` | — |
| GPS: Android "Recording your run" notification | FIXED (P2) | Android 13+ shows the foreground-service notification only with `POST_NOTIFICATIONS`. The location plugin doesn't request it (plugin README), and the app didn't either before starting the watcher | `689ea4a`: asks once before the native watcher starts | Android device test |
| GPS: permission refused | PARTIAL | Browser: the refusal message shows (`out/audit/iphone_gps_denied.png`). In the app there was no way to reach Settings. The recorder also stays in "Waiting for GPS" with the clock running until the member pauses and discards (P3, not fixed). | `689ea4a`: "Open Settings" button in the phone app | Device test; stop the clock on refusal (not fixed) |
| GPS: iOS permission prompts | PARTIAL (P2, not fixed) | The plugin asks for **Always**: `requestAlwaysAuthorization()` when undetermined, and it re-asks after "While Using" (`node_modules/@capacitor-community/background-geolocation/ios/Plugin/Swift/Plugin.swift:126,133-134`), because the app sets `backgroundMessage`. `docs/RUN_TRACKING_PLAN.md` says "When In Use first". Background updates work with When-In-Use plus `UIBackgroundModes`, so App Review may ask why Always is requested. | — | Owner decision: justify Always in review notes, or patch the plugin to not escalate. Device test of the prompts. |
| GPS: locked-screen recording, battery | BLOCKED | Configured: `UIBackgroundModes: location`, `allowsBackgroundLocationUpdates`, the blue indicator, `pausesLocationUpdatesAutomatically = false`, best accuracy (best-for-navigation while charging), no distance filter; Android foreground service with `useLegacyBridge`. Not verifiable here: whether the WKWebView keeps running JavaScript while locked, battery drain, and the effect of the plugin forwarding only the last location of each iOS batch (`Plugin.swift:213`). | — | Physical iPhone and Android outdoors |
| GPS: route persistence and user isolation | PASS | None. Integration tests pass against local Supabase: owner-only RLS, saved once per id or start time, private by default, deleted runs lose their route, removed with the account (`activities`, `gps-running`: 16 tests). Per-member draft key `run.recording.<userId>`, cleared on sign-out (unit `device-cleanup`). | — | — |
| GPS: pause/resume, route map | PASS | None. Browser tour: distance unchanged while paused, line broken at the pause; map, markers and scale bar render (`out/audit/iphone_gps_review.png`) | — | — |
| GPS: save with an expired session | PARTIAL (P3, not fixed) | The recording is kept and offered after signing in again (verified after the fix: `out/audit/fix_gps_after_relogin.png`). The message says "Couldn't reach the server…", not that the member was signed out (`src/components/run/gps-recorder.tsx:310`). | — | Copy change |
| Sleep import: reading from Apple Health / Health Connect | FIXED (P2) | Sleep (limit 2,000) and overnight heart rate (20,000), HRV and breathing (5,000) were read **oldest first** over 14 days. The platform applies the limit after sorting, so a heavy writer (workout heart rate every few seconds) loses the newest nights' measurements first. | `f135802`: newest first | Device test with a real watch |
| Sleep import: duplicates on re-sync, overlaps | PASS | None. Unique `(user_id, source, source_id)` plus an overlap check (`src/server/actions/sleep-import.ts`); unit `sleep-import` (6) and integration `sleep`, `sleep-imports` (12) pass | — | Device re-sync (checklist A4, A10) |
| Sleep: permission denied or revoked, missing data | PASS (mocked) | None in code. New tests: an Android refusal names Health Connect > App permissions; an empty iOS answer points to Health > Sharing (HealthKit never reports read denials); refused vitals are listed and left unrecorded; unavailable platform; plugin errors never throw (`tests/unit/native-sleep.test.ts`) | Tests added in `f135802` | Real HealthKit and Health Connect sheets |
| Sleep: "Enter sleep by hand" | FIXED (P3) | React hydration error #418 on every visit where the member's zone differs from the server's (seen in the demo tour). The zone picker read the device zone during render: the server (UTC) listed `UTC` first, the phone listed it last. | `c4a0d00` | — |
| Sleep score, debt, schedule, energy, readiness | PASS | None. Unit tests pass (`sleep-score`, `sleep-debt`, `sleep-stats`, `sleep-analytics`, `sleep-energy`, `sleep-schedule`, `sleep-training`, `sleep-checkins`, `sleep`; readiness in `nutrition.test.ts`). A missing part is left out of the score, never counted as zero (`src/lib/domain/sleep-score.ts:64-101`). | — | — |
| Steps from Apple Health / Health Connect | PASS (code) | None. One row per day (upsert), days without steps never overwrite a hand entry, ±1 day of zone slack; integration `supplements-steps` passes. A hand entry *is* overwritten by a synced day with steps (by design). | — | Device |
| Background health sync | NOT TESTED | Not built: the plugin has no observer queries (`docs/WEARABLES.md` §3). Sync happens when the app opens or on "Sync now". | — | A native plugin, and a device |
| Health Connect parity | PARTIAL | Same code path; the manifest is trimmed to 5 read permissions; HRV method RMSSD vs SDNN labelled | — | Android device |
| iPhone app offline page | FIXED (P2) | Capacitor loads `server.errorPath` from the app bundle (`localURL/error.html`, `node_modules/@capacitor/ios/Capacitor/Capacitor/CAPInstanceConfiguration.swift:18-23`), so "Try again" (`location.reload()`) reloaded the offline page itself. After opening the app with no connection it stayed offline until force-quit (device plan step 1.4 would fail). | `d385425`: `cap sync/copy` writes `native-shell/server-url.js` (gitignored) and Try again returns to the site. Checked with `CAP_SERVER_URL=… npx cap copy ios` and in Chromium. | Device |
| `npx cap run ios` / `cap build ios` | FIXED (P3) | `ios.scheme` was "Narrow Gate Fitness". The CLI passes it to `xcodebuild -scheme` (`node_modules/@capacitor/cli/dist/ios/run.js:14`), but the project has only the `App` target's scheme (no shared schemes; CI uses `-scheme App`) | `d385425` | — |
| Capacitor config, server URL | PASS / BLOCKED | The app loads the deployed site (`server.url`). Syncing without a real `https://` address stops with an error; the TestFlight job checks `/api/health` and the opening markers (present in `src/app/page.tsx`) | — | **No deployed HTTPS site exists** |
| Info.plist permissions | PASS | Every plugin used has its string: camera (barcode scanner, Body Scan `getUserMedia` video only, meal photo `capture`), Health share/update, location when-in-use and always, background mode location. No microphone use (`audio: false`). `ITSAppUsesNonExemptEncryption = false`. | — | — |
| Entitlements, bundle, version | PASS | HealthKit entitlement; no push, associated domains or background delivery (none used). `com.narrowgatefitness.app`, 1.0.0 (1); the TestFlight job sets the build number from the run number | — | Register the App ID with HealthKit |
| Icons, launch screen | PASS | 1024×1024 RGB icon, no alpha; launch images black with the gold mark, light and dark (sampled). Three unreferenced 2732 PNGs in `Splash.imageset` (Xcode "unassigned children" warning only). | — | — |
| Privacy manifest | PARTIAL | Present and bundled (pbxproj Resources); tracking off; the collected types match the code. The Android Data safety draft lists religious beliefs (journal text), the iOS manifest doesn't (`SensitiveInfo`). | — | Owner and counsel decision |
| Deep and universal links | NOT TESTED | None configured. Confirmation and reset emails link to `NEXT_PUBLIC_SITE_URL/auth/callback`, so on iPhone they open in Safari; the app's web view stays signed out until the member signs in there with the password | — | Device; universal links if wanted |
| iPad | PASS (browser) | `TARGETED_DEVICE_FAMILY = 1,2`, so App Review and screenshots include iPad. No horizontal overflow at 1024 and 1366 px, or in iPhone landscape (`out/audit/ipad_*.png`, `iphone_landscape_*.png`) | — | iPad screenshots for the listing |
| CI workflows (`ios.yml`, `android-apk.yml`, `ci.yml`) | PASS (by reading) | `testflight` checks the secrets, the deployed site and the synced address, archives with automatic signing and an API key, and uploads only when ticked. `ios.yml` runs on pushes to `main`, `claude/sharp-cray-8y0uuv` and `claude/testflight-prep`, not on the current integration branch (P3) | — | macOS runner and secrets |
| Android project (at a glance) | PASS (by reading) | API 36; all 10 plugins wired; 5 Health Connect reads; backups off; no background location; debug signing only | — | Upload key, Play account, device |
| Startup and route size | PARTIAL (P3, not fixed) | Shared first-load JS 101 KB gzip. Heaviest: `/progress/overview` 412 KB, `/nutrition` 370 KB, `/run` 327 KB gzip, mostly recharts (chunk `2337`, 390 KB raw / 116 KB gzip, on 6 routes). The 14 MB `public/anatomy/ecorche.glb` loads only on the 3D demonstration (another owner's area). | — | Lazy-load the charts |
| Server timing, caching, compression | PASS | Local TTFB 62–479 ms over 30 routes (slowest `/train/workout?blank=1`). HTML and JS gzipped, static assets `immutable`, private HTML `no-store`. Each request makes two Supabase Auth calls: `getUser()` in the middleware and again in `requireUser()` (P3). | — | Measure on the hosted stack |
| N+1 queries | PASS | No unbounded per-row queries on hot pages (Home uses one `Promise.all` of 7). Bounded loops only: the sleep import inserts per session (≤200), adaptive training updates per program row | — | — |
| Crashes, console errors, layout (tour of 30 routes at iPhone 15 size) | PASS after fix | 0 page errors except #418 (fixed), no 4xx/5xx apart from the intended 404, no horizontal overflow on any toured route. Two rounds of tab switching: no errors. | `c4a0d00` | Program week tables reported as overflowing in `docs/DEMO.md` were not in my route list |
| Offline (browser) | PASS | Offline banner; a tab tap offline falls back to the service worker's offline page; back online it reloads (`out/audit/iphone_offline_client_nav.png`) | — | — |
| Expired session | PASS | Cookies cleared: a tab tap goes to `/login?next=%2Ftrain` and a full load to `/login?next=%2Frun` | — | — |
| Loading states | PASS | `loading.tsx` on Home, badges, the sleep sub-pages, exercises, history and programs, plus a navigation progress bar | — | — |

## 2. Defects in detail

### D1 (P1, FIXED `689ea4a`): a finished but unsaved run was deleted

- Path: `src/components/run/gps-recorder.tsx:145` at `fc8d113`: `else if (!isResumable(saved.track, Date.now())) localStorage.removeItem(storageKey)`. `isResumable()` (`src/lib/domain/gps-track.ts`) is false for any finished track, so opening the record page threw away a run whose save had failed (offline, server error, expired session) or that was closed on the review screen.
- Evidence: demo build at iPhone size. Record and finish a walk, reload: before `[{"status":"finished"}]`, after `[]`, nothing offered (`out/audit/tour.log`, `iphone_gps_after_reload_finished.png`). A save with an expired session followed by signing back in also lost the run.
- Fix: `isRecoverable()` (any recent draft, finished or not); a finished draft is offered as "Review and save" and reopens the review screen without turning location on.
- Regression tests: `tests/unit/gps-recorder.test.tsx` (3 recovery cases) and `tests/unit/gps-track.test.ts`. They fail on the old code (`out/audit/regression-against-old-code.txt`).
- Retest in a browser after the fix (`out/audit/verify-fixes.json`): offered as "Your walk from 7:55 PM wasn't saved yet", same distance after reopening; after an expired-session save and signing back in it is offered again; nothing is left on the device after "Discard it".

### D2 (P2, FIXED `d385425`): the offline page's "Try again" could never reach the site

- Path: `native-shell/error.html:23` at `fc8d113` (`onclick="location.reload()"`). Capacitor shows `server.errorPath` from inside the bundle on both platforms (iOS `WebViewDelegationHandler.swift:139-160` loads `config.errorPathURL`; Android `BridgeWebViewClient.java:55-57,85-87`). `window.WEBVIEW_SERVER_URL` is the local origin, not the site (`JSExport.swift:19`), so the page had no way back.
- Fix: `capacitor.config.ts` writes `native-shell/server-url.js` (`window.NGF_SERVER_URL = "<address>"`) during `sync/copy/update/run/build` of the online edition. "Try again" goes there, or reloads as before when the file is missing.
- Verified: `CAP_SERVER_URL=https://app.narrowgate-audit.dev npx cap copy ios` wrote the file and copied it to `ios/App/App/public/` next to `error.html`; `cap config` and `CAP_MODE=standalone` write nothing. In Chromium, Try again on the staged page landed on the target address.
- Regression test: `tests/unit/native-shell.test.ts`.

### D3 (P2, FIXED `f135802`): newest nights could lose their measurements

- Path: `src/lib/native-sleep.ts:61,80` at `fc8d113` (`ascending: true` with limits 2,000 / 20,000 / 5,000). The plugin sorts, then applies the limit: iOS `HKSampleQuery(limit:sortDescriptors:)` (`node_modules/@capgo/capacitor-health/ios/Sources/HealthPlugin/Health.swift:907-912`), Android the page size.
- Fix: newest first. `samplesToSessions` and `summarizeVitals` don't depend on order. A truncated oldest night now conflicts with the full night already stored, and is skipped.
- Regression test: `tests/unit/native-sleep.test.ts` (fails on the old code), plus denial, empty-answer, unavailable and error cases.

### D4 (P2, FIXED `689ea4a`): no notification permission request before the Android foreground service

- Path: `src/lib/native/location.ts` `watchLocation()`. The plugin's README requires the app to request `POST_NOTIFICATIONS` itself. Fix: `ensureAndroidNotificationPermission()` (`location.ts:77-91`), asked only when the state is "prompt". Regression test: `tests/unit/native-location.test.ts`.

### D5 (P3, FIXED `689ea4a`): a watcher could outlive a stop

- Path: `gps-recorder.tsx` `beginWatching()` stored the stop function only after `await watchLocation()` (and the wake lock after `await keepScreenOn()`). A stop in between left it running. Fix: a generation counter (`gps-recorder.tsx:171-200`). Regression test: `gps-recorder.test.tsx` "is stopped at once when Pause came while it was still starting" (fails on the old code).

### D6 (P3, FIXED `689ea4a`): no route to Settings after a refusal in the app

- "Open Settings" (the plugin's `openSettings()`) is shown with the "denied" message, only in the phone app (`gps-recorder.tsx:403`). Test: `native-location.test.ts`.

### D7 (P3, FIXED `c4a0d00`): hydration error #418 on "Enter sleep by hand"

- Path: `src/components/sleep/session-form.tsx:38` at `fc8d113` (`deviceZone()` and `Intl.supportedValuesOf()` during render). Node in the container reports zone `UTC`, which isn't in the IANA list, so it went first; Chromium in America/New_York put `UTC` last (`out/audit/zones.mjs`). Seen in the demo tour on `/progress/sleep/log`.
- Fix: the first render uses the account's zone on both sides; the device zone and list are applied after mount. Regression test: `tests/unit/sleep-session-form.test.tsx` renders as a UTC server and hydrates as a New York phone, with no recoverable error. It fails on the old code. Browser retest: zone `America/New_York`, no hydration errors.

### D8 (P3, FIXED `d385425`): `npx cap run ios` used a scheme the project doesn't have

- `capacitor.config.ts:62` at `fc8d113`. Test: `native-shell.test.ts` checks `ios.scheme === "App"` and that the pbxproj has the `App` target.

### Remaining confirmed issues (not fixed)

| # | Priority | Issue | Where | Proposed change |
|---|---|---|---|---|
| R1 | P2 | iOS asks for Always location (prompt, then an escalation prompt); docs and App Review expect When In Use | plugin `Plugin.swift:117-135`; `docs/RUN_TRACKING_PLAN.md` | Decide: keep Always and explain it in review notes ("continues a run the member started while the phone is locked"), or `patch-package` the plugin to call `requestWhenInUseAuthorization()` and skip the escalation (background updates still run with the background mode). Device test either way. |
| R2 | P3 | Saving after the session expired says "Couldn't reach the server" | `gps-recorder.tsx:310` | Mention that the member may need to sign in again |
| R3 | P3 | After a location refusal the recorder stays in "Waiting for GPS" with the clock running | `gps-recorder.tsx` `beginWatching` error path | Pause the track on "denied" |
| R4 | P3 | Charts in first-load JS (`/run` 327 KB, `/progress/overview` 412 KB gzip) | recharts users | `next/dynamic` for chart components below the fold |
| R5 | P3 | Two Supabase Auth round trips per request | `src/lib/supabase/middleware.ts`, `src/server/auth.ts` | Read the claims locally in one of them, once confirmed with the installed `@supabase/ssr` |
| R6 | P3 | Email links open in Safari, not in the app | auth email redirect URLs | Universal links (associated domains), or say so on the "check your inbox" screen |
| R7 | P3 | `ios.yml` doesn't run on pushes to the current integration branch | `.github/workflows/ios.yml:46` | Add the branch that will be deployed |
| R8 | P3 | Stale docs | `docs/INSTALL.md:34` says API key role App Manager (`docs/TESTFLIGHT.md` and automatic signing need Admin); `INSTALL.md:40` says to choose the offline edition for TestFlight (the job builds only the online app); `INSTALL.md:43` names the job `simulator` (it is `compile`); `docs/RUN_TRACKING_PLAN.md` says When-In-Use first and an iOS 15 target (the app is 16.0); `docs/launch-audit/APPLE_COMPLIANCE.md` says the Android project lacks the geolocation and RevenueCat plugins (they are wired) | Edit the docs |

## 3. Counts

- Confirmed defects: **16** (1 P1, 4 P2, 11 P3)
- Repaired, with regression tests and a browser retest where a browser applies: **8** (D1–D8: 1 P1, 3 P2, 4 P3)
- Remaining: **8** (R1 P2; R2–R8 P3)
- Tests added: 5 new files (`gps-recorder`, `native-location`, `native-sleep`, `native-shell`, `sleep-session-form`), 25 tests, plus new assertions in `gps-track`. Full unit suite after the fix commits: 120 files, 2,723 tests; one unrelated test (`program-builder.test.tsx`) timed out under load and passed on its own rerun. `tsc --noEmit` and `eslint` on the changed files: clean. Integration for my area: 34 of 34 pass.

## 4. Launch blockers in this area

For an **internal TestFlight** build on a physical iPhone:

1. **No deployed HTTPS site.** The iPhone app is a shell around `CAP_SERVER_URL`, and nothing is deployed. Needs a Supabase project with the migrations applied, a host, the environment variables (`docs/TESTFLIGHT.md` §1) and the owner's approval to deploy.
2. **No Apple Developer account setup**: the App ID with the HealthKit capability, the App Store Connect app record, and an API key stored as the four repository secrets.
3. No code blocker remains in my area after the fixes above. Before inviting testers, the device plan must still be run: background GPS, the Always/When-In-Use prompts (R1), HealthKit import, the offline retry, and recovering an unsaved run.

For **external TestFlight / App Store**, add: R1 (justify or change), the privacy policy URL and App Privacy answers matching `PrivacyInfo.xcprivacy` (including the religious-beliefs question), iPad screenshots (the app supports iPad), store products in App Store Connect and RevenueCat, and review notes that show the native features (`docs/launch-audit/APPLE_COMPLIANCE.md` #9).

## 5. iPhone: build, install, test, TestFlight, App Store (step by step)

Checked against `capacitor.config.ts`, `ios/`, `.github/workflows/ios.yml` and the Capacitor CLI. None of it has been run.

### A. Deploy the site the app loads (needs the owner's approval)

1. Create the Supabase project, link it and apply the migrations (`npx supabase link`, `npx supabase db push`). Set Authentication > URL configuration to the site's address.
2. Deploy the branch you want testers to see to an HTTPS host, with the variables in `docs/TESTFLIGHT.md` §1 (Stripe test keys, `REVENUECAT_ALLOW_SANDBOX=true` on this test deployment only).
3. Check `https://<site>/api/health` answers, and that the address plays the opening.

### B. Build and install on your own iPhone (a Mac with Xcode)

1. Install the latest Xcode and Node 22. `git clone`, check out the deployed branch, `npm ci`.
2. `CAP_SERVER_URL=https://<site> npx cap sync ios`. This writes `ios/App/App/capacitor.config.json` and, after `d385425`, `native-shell/server-url.js`; it refuses a missing or placeholder address.
3. `npx cap open ios`. In Xcode: target **App** > Signing & Capabilities: tick Automatically manage signing, choose your team, check the bundle ID, and that **HealthKit** and **Background Modes > Location updates** are listed.
4. On the iPhone: connect it with a cable and trust the Mac; turn on Settings > Privacy & Security > Developer Mode (the phone restarts).
5. Choose the iPhone as the destination and press **Run**, or run `npx cap run ios --target <device id>` (works after `d385425`). If iOS asks, trust the developer in Settings > General > VPN & Device Management.
6. Local-only variant: `CAP_SERVER_URL=http://<Mac LAN IP>:3000 CAP_ALLOW_CLEARTEXT=true`. **Unverified:** whether iOS App Transport Security lets the web view load plain HTTP from a LAN address; if you only see the offline page, use an HTTPS tunnel or the deployed site.

### C. Test the native features on the device

Run `docs/launch-audit/IOS_DEVICE_TEST_PLAN.md` and `docs/SLEEP_DEVICE_CHECKLIST.md`, and also:

- **Offline:** airplane mode, open the app (offline page), Wi-Fi on, **Try again**: the app must load.
- **Unsaved run:** finish a run in airplane mode, tap Save (it fails), force-quit, reopen Run > Outdoor: "Your run … wasn't saved yet" > Review and save.
- **Permission prompts:** first Start shows the location prompt; note whether iOS later asks to change to "Always Allow" (R1); refuse, then use the Open Settings button.
- **Locked screen:** a 1 km walk with the screen locked; the blue indicator shows; the route is continuous; tracking stops at Finish.
- **Apple Health:** connect, deny the vitals, Sync now twice (no duplicates), revoke in Health > Sharing, sync again.

### D. Upload to TestFlight

GitHub (no Mac): App Store Connect > Users and Access > Integrations > App Store Connect API, key with the **Admin** role. Add the secrets `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID` and `ASC_KEY_P8_BASE64` in the repository settings. Then Actions > iOS > Run workflow: `job = testflight`, `server_url = https://<site>`, upload **unticked** (archive and sign only). When that passes, run again with upload ticked; it needs the owner's approval.

Xcode instead: Any iOS Device (arm64) > Product > Archive > Distribute App > App Store Connect > Upload. Raise the build number for each upload; the workflow uses the run number.

Then wait for processing in App Store Connect > TestFlight. Export compliance is already answered in Info.plist.

### E. Invite beta testers

- **Internal** (members of your App Store Connect team, up to 100, no review): TestFlight > Internal Testing > + group > add testers > add the build. They install it from the TestFlight app.
- **External**: TestFlight > External Testing > + group. Fill Test Information (what to test, feedback email, beta description, privacy policy URL, the demo account and password for the reviewer), add the build and submit it for Beta App Review. After approval, invite by email or a public link.

### F. Prepare the App Store submission

In the app record: name, subtitle, description, keywords, support URL and privacy policy URL. Screenshots for the largest iPhone size and the 13-inch iPad (the app targets iPad). Then:

- The App Privacy questionnaire, matching `ios/App/App/PrivacyInfo.xcprivacy`.
- The age rating questionnaire (18+ in the terms).
- The subscription group and products, with a review screenshot.
- Review notes: the demo account, how to see Apple Health, background GPS, the barcode scanner and purchases, the location-use justification (R1), and that the faith content is optional.
- Content rights. Then Add for Review; submitting needs the owner's approval.

### G. Blocked by what is missing

| Step | Blocked by |
|---|---|
| A | Hosting and a Supabase project (owner), the owner's approval to deploy |
| B, C | A Mac with Xcode; a paid Apple Developer membership for HealthKit and TestFlight builds (whether a free personal team can sign a HealthKit build is unverified); an iPhone; an Apple Watch or another app writing sleep to Health for C |
| D, E | The membership, the App Store Connect app record, the API key secrets, the owner's approval to upload |
| F | Final privacy policy and terms (counsel), store products, RevenueCat project, screenshots, the owner's approval to submit |

## 6. What I could not verify, and what it would take

1. **Locked-screen GPS on iPhone and Android** (WKWebView delivery, gaps, battery over an hour): a phone outdoors, using `docs/GPS_ACCURACY.md`'s outdoor plan.
2. **Which location prompts iOS shows** with this plugin (R1): a fresh install on an iPhone.
3. **HealthKit and Health Connect** permission sheets, real sample counts against the limits, revocation: an iPhone with an Apple Watch (or Oura, Garmin), and an Android phone with Health Connect.
4. **The offline page fix inside a real WKWebView**, including navigation from the bundle origin back to the site (Capacitor allows the `server.url` host): an iPhone build.
5. **App Transport Security for local cleartext testing** (B6): an iPhone build pointed at a LAN address.
6. **TestFlight, signing and App Review**: the Apple account, secrets and a deployed site; the `testflight` job has never run.
7. **Production performance** (TTFB, Supabase Auth latency, bundle download on cellular): the hosted deployment, measured from a phone.
