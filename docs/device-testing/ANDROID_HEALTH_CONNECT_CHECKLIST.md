# Android Health Connect checklist: Narrow Gate Fitness

## Purpose

A repeatable physical-device check of how the Android app reads steps and sleep from **Health Connect**: when Health
Connect is missing or out of date, when permissions are granted, partly granted or revoked, how steps and sleep are
imported, what happens in the background, and what the app does when Health Connect is unavailable. It complements the
iPhone script ([`DEVICE_TEST_SCRIPT.md`](DEVICE_TEST_SCRIPT.md), §6 Apple Health) and uses the same fields, evidence
naming, severity scale and retest rules. The other Android device checks (GPS, camera, notifications, Play Billing)
are listed in `docs/launch-audit/ANDROID_READINESS.md` ("Device test list") and are not part of this checklist.

Expected outcomes come from the code on branch `security/payment-hardening-prelaunch`, `android/app/src/main/AndroidManifest.xml`,
the Health plugin's Android sources (`node_modules/@capgo/capacitor-health/android/…`), `docs/WEARABLES.md` and the
November 1 audit (`docs/audit/4-gps-health-ios-performance.md`, rows "Health Connect parity", "Sleep: permission denied
or revoked", "Background health sync").

**Status: No test in this checklist has been run on a physical device yet.** No Android build has run on a device
(`docs/launch-audit/ANDROID_READINESS.md`). Every result field below is empty on purpose; record results in
[`device-test-results.csv`](device-test-results.csv).

## How it works (from the code)

- **Plugin and permissions.** `@capgo/capacitor-health` 8.11.4. The merged manifest keeps only five Health Connect
  permissions, all reads: `READ_STEPS`, `READ_SLEEP`, `READ_HEART_RATE`, `READ_HEART_RATE_VARIABILITY`,
  `READ_RESPIRATORY_RATE`. The 43 others the plugin declares are removed (`tools:node="remove"`). No write permission
  remains, so the app can't write to Health Connect. No background-read permission is declared.
- **Why the app asks.** The plugin's `PermissionsRationaleActivity` (and the Android 14 permission-usage alias) shows
  the privacy policy bundled with the app (`native-shell/privacypolicy.html`, copied to the app's assets as
  `public/privacypolicy.html`) when Health Connect asks why the app wants access.
- **Availability.** The app checks Health Connect's SDK status first. When it isn't available, steps say "Health
  Connect isn't available on this phone. Install or update Health Connect from the Play Store (Android 8 or newer)." and
  sleep says "Health Connect isn't available on this phone. Install or update it from the Play Store." The plugin's own
  reason ("Health Connect needs an update." / "Health Connect is unavailable on this device.") is not shown on Android.
- **Refusals are reported** (unlike Apple Health). Steps refused: "Step access wasn't allowed. Open Health Connect >
  App permissions > Narrow Gate and allow Steps." Sleep refused: "Sleep access wasn't allowed. Open Health Connect > App
  permissions > Narrow Gate and allow Sleep." Heart rate, HRV or respiratory rate refused: the sleep import still runs
  and its message ends with "<series> not allowed on this phone."
- **The permission screen comes back.** The plugin opens Health Connect's permission screen whenever any requested
  type isn't granted (`requestAuthorization`: `granted.containsAll(permissions)`). So after a partial grant, the screen
  is shown again at the next sync, including the automatic one when the sleep hub opens. Android may stop showing it
  after repeated refusals: record what happens.
- **What is read.** Steps: daily totals for the last 7 days (phone's time zone), only when **Sync Health Connect** is
  tapped. Sleep: 14 days of sleep sessions with stages, plus overnight heart rate, HRV (**RMSSD** on Android) and
  respiratory rate.
- **When sleep syncs.** When the Sleep & Recovery hub opens or the app comes back to the front and the last sync is
  more than 30 minutes old, on pull-to-refresh, and on **Sync now**. **No background sync**: nothing runs while the app
  is closed or in the background (no WorkManager job is built; `docs/WEARABLES.md` §3).

## Before you start

### Devices

| Device | Required? | Why | Record |
|---|---|---|---|
| Android 14 or later phone | Required | Health Connect is part of the system | Model, Android version, Health Connect version |
| Android 9–13 phone | Required for DT-AHC-01, 02, 13 | Health Connect is a separate app from the Play Store (`docs/WEARABLES.md` §1) | Model, Android version, Health Connect app version |
| A watch, ring or app that writes steps and sleep (with stages) to Health Connect, with at least two recorded nights: Fitbit / Pixel Watch, Samsung Galaxy Watch (Samsung Health 6.22.5+), or Oura | Required for the sleep cases | The app reads only from Health Connect (`docs/WEARABLES.md` §2) | Device and app versions |
| A computer | Required for DT-AHC-06 | To read the exported `daily_steps` rows | — |

The app's minimum is Android 8 (`minSdkVersion = 26`), and the steps message says "Android 8 or newer", while
`docs/WEARABLES.md` describes Health Connect on Android 9–13 through the app. If an Android 8 phone is available, run
DT-AHC-01 on it and record what happens.

### Accounts

- Account **A** (fresh) and account **B**, as in the iPhone script. Health Connect cases don't need Pro.
- Wellness consent ("Allow sleep logging") is given in DT-AHC-07; before that, the sleep hub shows only the consent card.

### Build to test

| Field | Value |
|---|---|
| Build (versionCode / Play internal-test release, or debug APK) | |
| How it was built (`CAP_SERVER_URL=https://<site> npx cap sync android`, then `./gradlew assembleDebug`, or the Play bundle workflow) | |
| Deployed site address | |
| Deployed commit (`https://<site>/api/health`) | |
| Tester | |
| Android 14+ phone: model, Android version, Health Connect version | |
| Android 9–13 phone: model, Android version, Health Connect app version | |
| Wearable / source app and version | |
| Test dates | |

Only the **online** build loads the real app; the offline APK from the workflow is a limited demo
(`docs/launch-audit/ANDROID_READINESS.md`, device test list item 1).

### Where Health Connect's settings are

- Android 14 and later: Settings → search "Health Connect" (often Settings → Security & privacy → Privacy → Health
  Connect). Its **App permissions** list has Narrow Gate Fitness once the app has asked.
- Android 9–13: the Health Connect app → App permissions.
- Write down the path you used on each phone.

### Evidence, severity and retest rules

As in [`DEVICE_TEST_SCRIPT.md`](DEVICE_TEST_SCRIPT.md) ("How to record evidence", "Severity scale", "Retest rules"):
name files `DT-AHC-<NN>-<letter>.png` (for example `DT-AHC-03-a.png`), keep them in a private folder outside this
repository (they show health data), and use S1 (blocker) to S4 (cosmetic). Another member's health data shown, or a
crash, is S1; a missed or duplicated night, or wrong step totals, is S2; a misleading message is S3; wording is S4.

---

## Health Connect cases (DT-AHC)

#### DT-AHC-01 · Health Connect not installed

- **Preparation:** The Android 9–13 phone with the Health Connect app not installed (or uninstalled). Signed in as A.
  Wellness consent given (see DT-AHC-07 step 1), so the sleep hub shows the source card.
- **Steps:**
  1. Home → My Progress → Steps card → **Sync Health Connect**. Screenshot.
  2. Home → My Progress → Sleep & Recovery. Wait 5 s without tapping; screenshot the card.
  3. Tap **Connect Health Connect**. Screenshot.
- **Expected outcome:** (1) Red text "Health Connect isn't available on this phone. Install or update Health Connect
  from the Play Store (Android 8 or newer)." (2) The card "Connect Health Connect"; the automatic sync on opening fails
  silently (no message). (3) "Health Connect isn't available on this phone. Install or update it from the Play Store."
  No permission screen, no crash. Record the Android version (the "Android 8" claim is checked in the device notes
  above).
- **Source:** `src/lib/native-health.ts` `readRecentSteps`; `src/lib/native-sleep.ts` `readRecentSleep`
  (`Health.isAvailable()`); `src/components/sleep/source-card.tsx` (automatic sync shows no message).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-AHC-01-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-AHC-02 · Health Connect installed but out of date

- **Preparation:** An Android 9–13 phone with an older Health Connect app that needs an update (if none can be found,
  mark Blocked).
- **Steps:** Repeat DT-AHC-01 steps 1 and 3. Then update Health Connect from the Play Store and tap Sync Health Connect
  again.
- **Expected outcome:** Before the update, the same two messages as DT-AHC-01 (the plugin's "Health Connect needs an
  update." is not passed on to the message on Android). After updating, the Health Connect permission screen opens
  (continue as DT-AHC-03).
- **Source:** `node_modules/@capgo/capacitor-health/android/src/main/java/app/capgo/plugin/health/HealthPlugin.kt`
  (`SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED`); `native-health.ts` (Android message without the reason).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-AHC-02-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-AHC-03 · First steps sync: the permission screen

- **Preparation:** Health Connect available (Android 14+, or the app installed on 9–13), never asked by Narrow Gate.
  Steps recorded in Health Connect for the last 7 days.
- **Steps:**
  1. My Progress → Steps → **Sync Health Connect**.
  2. Screenshot the Health Connect permission screen. Allow **Steps**. Return to the app.
- **Expected outcome:** The permission screen for Narrow Gate Fitness asks only for Steps (read). After allowing:
  "Syncing…", then a toast "Synced N days from Health Connect." and today's steps with "· Health Connect". If Health
  Connect holds no steps: "No steps found in Health Connect for the last 7 days. Check that your step-counting app
  writes to Health Connect."
- **Source:** `native-health.ts` (`requestAuthorization({ read: ["steps"] })`, messages);
  `src/components/steps/steps-card.tsx`; `src/server/actions/steps.ts`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-AHC-03-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-AHC-04 · Only the five read permissions; the privacy-policy link

- **Preparation:** DT-AHC-03 done.
- **Steps:**
  1. Health Connect → App permissions → Narrow Gate Fitness. Screenshot the whole list.
  2. Tap the link Health Connect offers to read the app's privacy policy (wording depends on the Android version).
- **Expected outcome:** (1) The list offers only Steps, Sleep, Heart rate, Heart rate variability and Respiratory rate,
  all as **read** access; no write access and no other data types (distance, calories, weight, exercise…). (2) A page
  titled "Privacy Policy" opens, starting "This page explains what Narrow Gate Fitness does with your information,
  including health data from Apple Health and Health Connect." If the link opens nothing or an error, record it (Play
  review requires the rationale).
- **Source:** `android/app/src/main/AndroidManifest.xml` (removals); plugin `AndroidManifest.xml`
  (`PermissionsRationaleActivity`, `VIEW_PERMISSION_USAGE` alias); `PermissionsRationaleActivity.kt` (default
  `file:///android_asset/public/privacypolicy.html`); `native-shell/privacypolicy.html`;
  `docs/launch-audit/ANDROID_READINESS.md` (5 Health Connect reads).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-AHC-04-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-AHC-05 · Steps refused

- **Preparation:** A fresh install, or Steps turned off for Narrow Gate Fitness in Health Connect.
- **Steps:**
  1. Sync Health Connect. On the permission screen, don't allow Steps; go back.
  2. Tap Sync Health Connect again; note whether the permission screen reappears. Repeat until it stops appearing or
     three times.
- **Expected outcome:** "Step access wasn't allowed. Open Health Connect > App permissions > Narrow Gate and allow
  Steps." Nothing is saved; earlier days stay. The permission screen comes back on later taps (the plugin asks whenever
  Steps isn't granted) until Android stops showing it: record how many times. No crash.
- **Source:** `native-health.ts` (Android `readDenied` check); `HealthPlugin.kt` `requestAuthorization`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-AHC-05-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-AHC-06 · Steps match Health Connect

- **Preparation:** Steps allowed and synced.
- **Steps:**
  1. Write down today's number on the Steps card.
  2. In Health Connect (Data and access → Activity → Steps, or the source app) write down the daily totals for today and
     the previous 6 days.
  3. Export the account's data (Profile → Download my data, on the phone or the website) and read the `daily_steps` rows.
- **Expected outcome:** Today's number equals Health Connect's total for today (allowing for steps since the sync).
  Each `daily_steps` row equals Health Connect's daily total for that date, with `source` "health_connect". Days without
  steps have no row. A synced day replaces a hand entry for that day; a day with no steps never overwrites one.
- **Source:** `native-health.ts` (`queryAggregated`, `bucket: "day"`, `aggregation: "sum"`);
  `src/lib/domain/steps.ts` (`stepsByDay`, `syncPayload`); audit row "Steps from Apple Health / Health Connect".
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-AHC-06-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-AHC-07 · Sleep: consent, permission screen, everything allowed

- **Preparation:** Sleep access never asked by Narrow Gate. At least two nights with stages in Health Connect.
- **Steps:**
  1. My Progress → Sleep & Recovery → tick "I agree to store my sleep and wellness information in my account." →
     **Allow sleep logging**.
  2. Wait 5 s without tapping; note whether the permission screen opens by itself. If not, tap **Connect Health
     Connect**.
  3. Screenshot the permission screen. Allow all four. Return.
  4. Open two recent nights; compare with the source app's sleep screens.
- **Expected outcome:** The permission screen may open by itself right after consent (the hub syncs automatically
  when no sync is recorded): record which. It asks to read Sleep, Heart rate, Heart rate variability and Respiratory
  rate. Then "Health Connect: N added."; the card becomes "<device> via Health Connect" with "Last synced just now · N
  new". Nights show stages (light, deep, REM, awake; a session without stages shows as asleep), "Recorded by <device>",
  heart rate "bpm average · min–max", HRV "ms RMSSD · N readings", respiratory rate. Stage totals never exceed the time
  in bed and match the source app (rounding aside).
- **Source:** `src/components/sleep/consent-card.tsx`; `source-card.tsx` (automatic `sync(true)`);
  `native-sleep.ts` (`hrvMethod = "rmssd"` on Android); `src/lib/domain/sleep-import.ts`; `docs/WEARABLES.md` §1.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-AHC-07-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-AHC-08 · Partial permission: sleep only

- **Preparation:** DT-AHC-07 done.
- **Steps:**
  1. Health Connect → App permissions → Narrow Gate Fitness: turn off Heart rate, Heart rate variability and Respiratory
     rate; keep Sleep.
  2. In the app tap **Sync now**. If the permission screen opens, don't allow the three; go back.
  3. Leave the app for more than 30 minutes; open the Sleep hub again. Note whether the permission screen opens again.
  4. Open last night.
- **Expected outcome:** The permission screen reopens at each sync while any of the four isn't granted, including the
  automatic one in step 3 (plugin behaviour): record how often; Android may stop showing it. After going back, the
  import runs and its message ends with "heart rate, heart-rate variability, respiratory rate not allowed on this
  phone."; last night's measurement tiles say "Not recorded"; nothing is estimated. If the screen keeps opening every
  time the hub opens, record it as S3.
- **Source:** `native-sleep.ts` (`vitalsDenied` from `auth.readDenied`); `source-card.tsx` (message with the denied
  series); `HealthPlugin.kt` `requestAuthorization`; `docs/SLEEP_DEVICE_CHECKLIST.md` A12.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-AHC-08-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-AHC-09 · Sleep refused

- **Preparation:** A fresh install with consent given, or Sleep turned off in Health Connect.
- **Steps:** Sleep hub → Connect Health Connect (or Sync now). Don't allow Sleep; go back.
- **Expected outcome:** "Sleep access wasn't allowed. Open Health Connect > App permissions > Narrow Gate and allow
  Sleep." Nothing imported; nights imported earlier stay.
- **Source:** `native-sleep.ts` (`denied.has("sleep")` message).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-AHC-09-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-AHC-10 · All access revoked after importing

- **Preparation:** Steps and sleep imported.
- **Steps:**
  1. Health Connect → App permissions → Narrow Gate Fitness → remove all permissions.
  2. Return to the app (record whether Android restarted it). Sleep hub → Sync now; refuse if asked. Steps → Sync
     Health Connect; refuse if asked.
- **Expected outcome:** The permission screen may open (the plugin asks when access is missing); after refusing:
  "Sleep access wasn't allowed…" and "Step access wasn't allowed…". Everything imported earlier stays. No crash.
- **Source:** `native-sleep.ts`, `native-health.ts`; audit row "Sleep: permission denied or revoked" ("an Android
  refusal names Health Connect > App permissions"); `docs/SLEEP_DEVICE_CHECKLIST.md` A8.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-AHC-10-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-AHC-11 · Re-sync without duplicates; overlap with a hand entry

- **Preparation:** All four sleep types allowed; nights imported.
- **Steps:**
  1. Tap Sync now twice; pull the hub down once.
  2. Sleep settings → Delete imported entries → confirm. Enter a night by hand that overlaps last night. Sync now.
- **Expected outcome:** (1) "Health Connect: 0 added, N already imported." each time; no night twice in history.
  (2) The message includes "1 skipped (overlap an entry you made)"; the hand entry stays as entered.
- **Source:** `src/server/actions/sleep-import.ts` (dedupe on `source_id`, overlap `conflicts`); audit row "Sleep
  import: duplicates on re-sync, overlaps".
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-AHC-11-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-AHC-12 · Background sync limits

- **Preparation:** Sleep connected and allowed; the wearable worn overnight.
- **Steps:**
  1. In the evening tap Sync now; swipe the app away from Recents.
  2. In the morning confirm the night is in Health Connect. Open the app → Sleep hub without tapping; screenshot after
     5 s.
  3. Later, put the app in the background for 40 minutes; bring it back on the Sleep hub.
  4. Walk 500 steps with the app in the background; return to the Steps card without tapping Sync.
- **Expected outcome:** Nothing is imported while the app is closed or in the background. (2) Within a few seconds of
  opening the hub, last night appears ("Last synced just now · 1 new"). (3) Coming back after more than 30 minutes
  syncs by itself. (4) Steps don't change until Sync Health Connect is tapped.
- **Source:** `source-card.tsx` (`STALE_MS`, `visibilitychange`); `steps-card.tsx` (sync on tap only);
  `docs/WEARABLES.md` §3 ("Background sync while the app is closed: Not built"); audit row "Background health sync";
  `AndroidManifest.xml` (no background-read permission).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-AHC-12-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-AHC-13 · Health Connect removed after connecting

- **Preparation:** The Android 9–13 phone, connected with imports (DT-AHC-03 and 07 done on it).
- **Steps:**
  1. Uninstall the Health Connect app.
  2. In Narrow Gate: Sleep hub → Sync now; Steps → Sync Health Connect.
  3. Reinstall Health Connect from the Play Store; open Narrow Gate; Sync now and Sync Health Connect.
- **Expected outcome:** (2) The two "isn't available" messages from DT-AHC-01; imported nights and step days stay.
  (3) Record whether the permissions survived the reinstall (the permission screen opens if they didn't); after
  allowing, syncing works and adds no duplicates.
- **Source:** `native-health.ts`, `native-sleep.ts` (availability check before every read); `sleep-import.ts` dedupe.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-AHC-13-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-AHC-14 · Disconnect, remove imported nights, and nothing written to Health Connect

- **Preparation:** Nights imported.
- **Steps:**
  1. Sleep → **Manage** → Connected devices → **Disconnect** → confirm. Back on the hub, screenshot the card.
  2. Settings → **Switch import on**; Connect Health Connect again.
  3. **Disconnect and remove imported** → confirm.
  4. Health Connect → App permissions (or Data and access) → Narrow Gate Fitness: look for data written by the app.
- **Expected outcome:** (1) "Imports stop and the connection is forgotten. Nights already imported stay unless you
  remove them below."; nights stay; the card shows "Connect Health Connect" with its button disabled (import is
  switched off) and no explanation on the card: record whether that is clear (S3 if not). (2) The button works again.
  (3) Imported nights gone; hand entries stay. (4) Health Connect holds no data from Narrow Gate Fitness; the source
  app's data is unchanged.
- **Source:** `sleep-import.ts` (`disconnectSleepSourceAction`, `setSleepImportEnabledAction`); `source-card.tsx`;
  `AndroidManifest.xml` (no write permissions); `docs/WEARABLES.md` §4.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-AHC-14-a.png`):
- **Severity if failed:**
- **Retest status:**

---

## Summary of all test IDs

Fill in from the CSV after each run. Every result is empty because nothing has been run on a device yet.

| ID | Area | Title | Result | Severity | Retest status | Tester / date / build |
|---|---|---|---|---|---|---|
| DT-AHC-01 | Health Connect | Health Connect not installed |  |  |  |  |
| DT-AHC-02 | Health Connect | Health Connect installed but out of date |  |  |  |  |
| DT-AHC-03 | Health Connect | First steps sync: the permission screen |  |  |  |  |
| DT-AHC-04 | Health Connect | Only the five read permissions; the privacy-policy link |  |  |  |  |
| DT-AHC-05 | Health Connect | Steps refused |  |  |  |  |
| DT-AHC-06 | Health Connect | Steps match Health Connect |  |  |  |  |
| DT-AHC-07 | Health Connect | Sleep: consent, permission screen, everything allowed |  |  |  |  |
| DT-AHC-08 | Health Connect | Partial permission: sleep only |  |  |  |  |
| DT-AHC-09 | Health Connect | Sleep refused |  |  |  |  |
| DT-AHC-10 | Health Connect | All access revoked after importing |  |  |  |  |
| DT-AHC-11 | Health Connect | Re-sync without duplicates; overlap with a hand entry |  |  |  |  |
| DT-AHC-12 | Health Connect | Background sync limits |  |  |  |  |
| DT-AHC-13 | Health Connect | Health Connect removed after connecting |  |  |  |  |
| DT-AHC-14 | Health Connect | Disconnect, remove imported nights, and nothing written to Health Connect |  |  |  |  |

Cases per area: Health Connect (AHC) 14. Total 14.
