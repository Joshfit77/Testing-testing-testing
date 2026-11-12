# Android readiness (branch `claude/android-hardening`, PR #4; Google Play section updated on `claude/free-pro-membership`)

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
- Product: one Play subscription `ngf_pro` (Pro All Access) with base plans `monthly` ($19.99) and `yearly` ($149.99). RevenueCat reports them as `ngf_pro:monthly` / `ngf_pro:yearly`, which the app matches by default (`storeProductIds`, tested). No Plus product is created. A monthly↔yearly change passes the old product id so Play replaces the subscription.
- Live billing stays off: `REVENUECAT_ALLOW_SANDBOX=false` and `REVENUECAT_ALLOW_TEST_STORE=false` by default; no Play products exist yet. Owner steps: create the subscription and base plans in Play Console, the RevenueCat Play app with its service-account credentials, licence testers, then sandbox-test purchase, restore, switch, cancel, expiry and refund on a device.

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
6. Notifications: reminder and sleep alarm with the app in the background, with "Alarms & reminders" both allowed and not allowed (Android 14+).
7. Play Billing sandbox (once products exist).
8. Backup check: Settings → Google → Backup shows no app data for Narrow Gate Fitness after a backup; a device-to-device transfer does not carry the session.

## Google Play submission (updated 2026-10-26, branch `claude/free-pro-membership`)

### Requirements checked against the project

| Requirement (Google Play, current) | Project | Status |
|---|---|---|
| New apps and updates target Android 16 (API 36) from 2026-08-31 | `targetSdkVersion = 36`, `compileSdkVersion = 36`, `minSdkVersion = 26` | ✓ |
| Android App Bundle, signed with an upload key (Play App Signing) | `android-play.yml` builds `bundleRelease`; signs with `ANDROID_UPLOAD_*` secrets when you add them | ✓ workflow; ✗ upload key (yours) |
| Increasing `versionCode` per upload | Set from the workflow run number | ✓ |
| 16 KB memory-page support for native libraries | Checked on every bundle build: all 16 native libraries zip-aligned, and every 64-bit library's LOAD segments ≥16 KB (ML Kit barcode, CameraX, AndroidX graphics) | ✓ CI run 40326693973 |
| Health Connect: only the data types used, declared in Play Console's Health apps form | 5 read types (steps, sleep, heart rate, HRV, respiratory rate); 43 others removed | ✓ code; ✗ declaration (yours) |
| Location: no background location; foreground service for recording | No `ACCESS_BACKGROUND_LOCATION` (the workflow fails if one is merged in); `FOREGROUND_SERVICE_LOCATION` with an ongoing notification | ✓ code; ✗ foreground-service declaration with a short video (yours) |
| Final merged permissions (CI run 40326693973) | INTERNET, CAMERA, fine/coarse location, FOREGROUND_SERVICE(_LOCATION), POST_NOTIFICATIONS, VIBRATE, RECEIVE_BOOT_COMPLETED, WAKE_LOCK, SCHEDULE_EXACT_ALARM, ACCESS_NETWORK_STATE, BILLING, and the 5 Health Connect reads | ✓ as intended |
| Exact alarms (sleep smart alarm) | `SCHEDULE_EXACT_ALARM` comes from the notifications plugin; on Android 14+ it's off until the member allows it, so the alarm must fall back gracefully (device test) | ✓ code; ✗ device test |
| Backups exclude private data | `allowBackup=false` and exclusion rules | ✓ |
| Account deletion inside the app and from a web link | In-app (Profile › Delete account) and on the website after sign-in | ✓ in app; ✗ give Play the web URL |
| New personal developer accounts: closed test with ≥12 testers opted in for 14 days before production | — | ✗ yours (organization accounts are reported to be exempt) |

### Data safety form (draft answers from the code; confirm before submitting)

Everything is encrypted in transit (HTTPS). Members can request deletion (in the app and on the website). No data is sold or used for advertising; there are no ad, analytics or crash-reporting SDKs. Service providers acting for the app (Supabase hosting, Anthropic for AI after consent, Stripe, RevenueCat, Google Play) are processing, which Play does not count as sharing.

| Data type (Play category) | Collected | Optional? | Purpose |
|---|---|---|---|
| Name, email address (Personal info) | Yes | Required | Account management |
| Precise location (Location) | Yes, only while recording a GPS run or walk | Optional (Pro) | App functionality |
| Health info: sleep, heart rate, HRV, respiratory rate, weight, measurements (Health and fitness) | Yes | Optional | App functionality, personalization |
| Fitness info: workouts, steps, runs (Health and fitness) | Yes | Required for core use | App functionality, personalization |
| Photos: progress photos and Body Scan (Photos and videos) | Yes, stored privately; meal photos are analysed and not stored | Optional | App functionality |
| Other user-generated content: prayer journal, notes, AI coach messages (App activity) | Yes | Optional | App functionality |
| Purchase history (Financial info) | Yes | Optional | App functionality (membership) |
| Political or religious beliefs (Personal info) | Faith features are optional; journal text may reveal beliefs | Optional | App functionality |
| Device or other IDs | Not by the app's own code; RevenueCat and Google Play Billing use their own identifiers — confirm against RevenueCat's Data safety guidance | — | — |

### Store listing and App content

- App name (≤30 characters), short description (≤80), full description (≤4,000); no price or "free/Pro" claims that differ from the in-app offer.
- High-res icon 512×512 PNG, feature graphic 1024×500, at least 2 phone screenshots (the opening, Train, Food, Run, Faith and the membership screen are good candidates; capture from a real device or emulator).
- Privacy policy URL (the same one shown inside Health Connect), content rating questionnaire, target audience 18+ (the app requires 18+), "contains ads: no", app access instructions with a reviewer test account, Health apps declaration, foreground-service declaration, Data safety form, and the account-deletion web URL.

## Remaining before Play submission

1. Your Google Play developer account (personal accounts: the 12-tester, 14-day closed test).
2. Upload key: create it in Android Studio or with `keytool`, keep it safe, add the four `ANDROID_UPLOAD_*` secrets in GitHub (never in chat), enrol in Play App Signing.
3. A deployed HTTPS site; then run Actions › Android Play bundle with `edition: online` and your `server_url`, download the `.aab`, upload it to an internal or closed test track yourself.
4. Play Console: the subscription `ngf_pro` with `monthly` $19.99 and `yearly` $149.99 base plans, licence testers, RevenueCat Play app with service-account credentials.
5. App content forms above, store listing assets.
6. Device testing on an Android phone (list above) and the Play Billing sandbox run.
7. Optional: a native notification for the rest timer (in-page only today).
