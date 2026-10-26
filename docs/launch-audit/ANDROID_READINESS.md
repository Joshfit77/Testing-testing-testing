# Android readiness (branch `claude/android-hardening`, PR #4)

Reviewed 2026-10-25. Android is not the first target (internal iPhone TestFlight is), so this records what was hardened now and what a later Android test needs. **No Android build has run on a device.** The audit sandbox has no Android SDK; compilation was verified by the repository's APK workflow on GitHub (run 40228043878, offline edition, `publish` off).

## What changed

| Area | Before | After | File |
|---|---|---|---|
| Backups | `allowBackup="true"`: WebView storage (sign-in session, drafts, a run being recorded with GPS fixes) could be included in device/cloud backups | `allowBackup="false"` plus rules excluding every domain for cloud backup and device-to-device transfer (API ≤ 30 and API 31+) | `android/app/src/main/AndroidManifest.xml`, `res/xml/backup_rules.xml`, `res/xml/data_extraction_rules.xml` |
| Health Connect permissions | 47 read/write permissions merged in from the plugin manifest | Only the five the app reads remain: `READ_STEPS`, `READ_SLEEP`, `READ_HEART_RATE`, `READ_HEART_RATE_VARIABILITY`, `READ_RESPIRATORY_RATE` (43 removed with `tools:node="remove"`) | `AndroidManifest.xml` |
| Native plugins | `capacitor.build.gradle` listed 7 plugins; background geolocation, keyboard and RevenueCat were missing (no GPS background recording, no purchases on Android) | All 10 wired by `cap sync android` | `android/app/capacitor.build.gradle`, `android/capacitor.settings.gradle` |
| APK workflow | Every run replaced the `android-latest` release | Manual runs compile and keep the APK as an artifact; `publish` input (default off) restores the old behaviour; pushes unchanged | `.github/workflows/android-apk.yml` |

Limitation of the backup change: a member who moves to a new phone signs in again; nothing is lost because all data is in the account. Unfinished GPS recordings and unsent drafts on the old phone are not transferred (by design).

## GPS plugin status (Task 5.3)

- Plugin: `@capacitor-community/background-geolocation` 1.2.26, now wired. Its manifest declares the foreground service (`foregroundServiceType="location"`) and the permissions the app also declares: fine/coarse location, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` (API 34+), `POST_NOTIFICATIONS` (API 33+). No `ACCESS_BACKGROUND_LOCATION`: the recording continues in the background through the foreground service (ongoing notification), which is the Play-friendly path.
- `capacitor.config.ts` sets `android.useLegacyBridge: true` for this plugin (updates stop after ~5 minutes otherwise).
- Stop and clean-up: the recorder stops the watcher on finish/discard/unmount (`src/components/run/gps-recorder.tsx`); the foreground service ends with the watcher.
- Battery restrictions: manufacturers' battery optimisers can still kill the service; the device plan asks the tester to check "Unrestricted" battery for the app if a run stops recording. Not verifiable without hardware.

## Google Play Billing (Task 5.4)

- Plugin: `@revenuecat/purchases-capacitor` 13.7.3, now wired. The same code path as iOS: the server reads entitlements from RevenueCat's API and webhook; the app never decides what was bought (`docs/MOBILE_BILLING.md`).
- Product ids expected: `ngf_plus` and `ngf_pro` with `monthly` and `yearly` base plans (configurable). Upgrades pass the old product id so Play replaces the subscription.
- Live billing stays off: `REVENUECAT_ALLOW_SANDBOX=false` and `REVENUECAT_ALLOW_TEST_STORE=false` by default; no Play products exist yet. Owner steps: create the subscriptions in Play Console, the RevenueCat Play app with its service-account credentials, licence testers, then sandbox-test purchase, restore, upgrade, cancel, expiry, refund on a device.

## General checks (Task 5.5)

| Item | Status |
|---|---|
| Camera / barcode scanning | `CAMERA` permission declared; `@capacitor/barcode-scanner` (ML Kit code scanner on Android — Google Play services module; mention in the privacy policy's processors). Device test needed |
| Sleep imports (Health Connect) | Read-only; plugin's rationale activity and Android 14 permission-usage alias come from the plugin manifest. Health Connect app must be installed (Android 14 built in). Device test needed |
| Notifications | `POST_NOTIFICATIONS` declared; local notifications plugin wired; the GPS foreground service posts its own ongoing notification. Device test needed |
| App startup, sign-in, session persistence | Same WebView-loaded site as iOS; cookies persist in the WebView. Device test needed |
| Photos, Body Scan, exercise animations, Scripture, faith features | Web code, unchanged; render in the WebView (Chromium). Device test needed for camera capture |
| Network handling | `server.errorPath` offline page as on iOS |
| App signing | Debug signing only (`android/app/build.gradle`, `minifyEnabled false`). A Play build needs the owner's upload key and Play App Signing; not configured |
| Compilation | APK workflow run 40228043878: `assembleDebug` succeeded; release publish skipped |
| Unit/integration/e2e | Unaffected by this branch (no web code changed); see PR #3's results |

## Device test list (later, on an Android phone)

1. Install the debug APK of the **online** build (sync with `CAP_SERVER_URL=https://<your address> npx cap sync android`, then `./gradlew assembleDebug`); the offline APK from the workflow is not the full app.
2. Opening, navigation, sign-in persistence, offline page.
3. Health Connect: connect, allow only the five read types, import steps and sleep with a watch writing to Health Connect, deny vitals and confirm nothing is estimated, delete imports, disconnect.
4. GPS: permission flow (precise location, notifications), record with the screen off for 20 minutes, pause/resume, signal loss, delete the run, sign out during a run (nothing left for the next member).
5. Camera: barcode scan, progress photo, Body Scan capture.
6. Notifications: reminder and sleep alarm with the app in the background.
7. Play Billing sandbox (once products exist).
8. Backup check: Settings → Google → Backup shows no app data for Narrow Gate Fitness after a backup; a device-to-device transfer does not carry the session.

## Remaining Android items

- Play Console: Health apps declaration, Data safety form (matches `SECURITY_PRIVACY.md` §M), privacy policy URL, content rating, upload key.
- Decide whether to add a native notification for the rest timer (in-page only today).
- Verify the merged manifest in a built APK once the SDK is available locally (`aapt dump permissions`), or add a workflow step that prints it.
