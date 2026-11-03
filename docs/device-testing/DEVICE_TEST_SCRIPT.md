# Physical-device test script: Narrow Gate Fitness on iPhone

## Purpose

This script turns the November 1 device audit (`docs/audit/4-gps-health-ios-performance.md`) and the earlier plan
(`docs/launch-audit/IOS_DEVICE_TEST_PLAN.md`) into a complete, repeatable test that a tester can run on a real iPhone
with a TestFlight build. Each test case says how to prepare, what to tap, and what the app should do. The expected
outcomes were taken from the code on branch `security/payment-hardening-prelaunch`; each case has a **Source** line
naming the file, function or audit row it comes from. Where the docs and the code disagree, the code was used and the
difference is noted.

Android Health Connect has its own checklist: [`ANDROID_HEALTH_CONNECT_CHECKLIST.md`](ANDROID_HEALTH_CONNECT_CHECKLIST.md).
Results for both go in [`device-test-results.csv`](device-test-results.csv) (one row per test ID).

**Status: No test in this script has been run on a physical device yet.** Every Pass/Fail box, Actual result,
Evidence, Severity and Retest field below is empty on purpose. Fill them in only from a run on a physical device with
the build recorded below. Simulator, browser or CI results do not count, and neither do results remembered from an
earlier build.

### Where the earlier documents are out of date

Found while checking the plan against the code. The cases below follow the code.

| Document | Says | The code does |
|---|---|---|
| `IOS_DEVICE_TEST_PLAN.md` 5.3, `ANDROID_READINESS.md` item 7 | The rest timer is in-page only; no native notification | Schedules a native local notification for the end of each rest (`scheduleRestNotification`, `src/lib/native.ts`; called from `src/components/workout/workout-logger.tsx`). See §1. |
| `IOS_DEVICE_TEST_PLAN.md` 2.1 | Profile → Steps → connect Apple Health | The Steps card with "Sync Apple Health" is on My Progress (`src/app/(app)/progress/page.tsx`, `src/components/steps/steps-card.tsx`) |
| `IOS_DEVICE_TEST_PLAN.md` 7.1 | Export "JSON download opens/shares on iOS" | The app adds no native download or share handling, so what iOS does with the download is not determined by the code (DT-EXP-01) |
| `docs/MOBILE_BILLING.md` | Web subscribers see "Your subscription was purchased outside the App Store" | The text is "Your membership was purchased outside the App Store. Manage it where you subscribed; it works here too." (`src/components/profile/store-paywall.tsx`) |
| `IOS_DEVICE_TEST_PLAN.md` 3.1 | "While Using" first, then "Always" | The plugin asks for Always and escalates from While Using (audit row "GPS: iOS permission prompts", remaining issue R1). DT-GPS-01 records what iOS really shows. |

---

## Before you start

### Devices and OS versions

| Device | Required? | Why | Record |
|---|---|---|---|
| iPhone on the current iOS release | Required | Main test device | Model, iOS version |
| iPhone on iOS 16.x (the app's minimum, `IPHONEOS_DEPLOYMENT_TARGET = 16.0`) | Recommended | Oldest supported system; run at least §1, §2, §4, §10, §13 on it | Model, iOS version |
| Apple Watch (watchOS 9 or later, sleep tracking on) paired with the main iPhone, with at least two recorded nights; or another app that writes sleep to Apple Health (Oura, Garmin, WHOOP) | Required for §6 sleep cases | The app reads sleep only from Apple Health (`docs/WEARABLES.md`) | Watch model, watchOS version or app name |
| A second iPhone signed in to the same sandbox / TestFlight Apple Account | Optional | DT-IAP-09 (restore on another device) | Model, iOS version |
| A computer with a web browser | Required | Web side of DT-OFF-04, DT-DISC-02, DT-SESS-04, DT-IAP-13/14, export inspection | Browser, OS |
| iPad | Optional | The app also targets iPad (`TARGETED_DEVICE_FAMILY = 1,2`); not covered by this script | — |

The Apple Watch and the iPhone should be on the tester's own Apple Account with Health data, because the Health cases
compare the app with the Health app.

### Accounts

| Account | Use |
|---|---|
| **A**, a fresh account created for this run | Most tests. Create it in the app (Start free). The confirmation e-mail link opens in Safari, not in the app (audit remaining issue R6): confirm in Safari, then sign in inside the app with the password. |
| **B**, a second account | Account switching (§12), the restore transfer (DT-IAP-10), privacy checks (DT-PHOTO-05) |
| **C**, a throwaway account | Account deletion (§15) |
| **W**, a website subscriber | DT-IAP-13 and DT-DEL-04: subscribe on the test website with Stripe **test mode** only (test card numbers; the test deployment runs Stripe test keys, `docs/TESTFLIGHT.md` §1) |
| Pro access for A | Live GPS recording, Body Scan, meal photo and photo comparison need Pro All Access. Get it with the sandbox purchase in DT-IAP-02 (run DT-IAP-01 and 02 early). If in-app purchases aren't available yet, run the Pro-only cases with W instead (Stripe test-mode Pro) and say so in Actual result; don't subscribe A on the website, because §13 needs A on Free first. If neither is possible, mark the Pro-only cases Blocked. |
| A sandbox Apple ID for purchases | Purchases in a TestFlight build go through Apple's sandbox and are not charged (`docs/TESTFLIGHT.md` §1). For a development build installed from Xcode, sign in with a Sandbox Apple Account (Settings → App Store → Sandbox Account; `docs/MOBILE_BILLING.md`, "Sandbox test plan"). **Sandbox purchases only unlock Pro for allow-listed testers or when the server's sandbox setting is on; see `docs/MOBILE_BILLING.md`.** Ask the owner which applies to the test deployment and record it below. |
| Owner access | Some cases need the owner to check Supabase (auth users, storage buckets), RevenueCat (webhook deliveries, customers) or Stripe (test dashboard). Those steps say "Owner:". |

> **Do not use a real card anywhere in this script.** In-app purchases: TestFlight or sandbox only. Website: Stripe
> test mode and Stripe's test card numbers only. If an Apple purchase sheet does not say it is a sandbox or TestFlight
> purchase, cancel it and stop the subscription tests.

### Build to test

Fill in once per run. A result is only valid for the build and deployment written here.

| Field | Value |
|---|---|
| TestFlight build number | |
| App version (expected 1.0.0) | |
| Deployed site address (`CAP_SERVER_URL`) | |
| Deployed commit (open `https://<site>/api/health`; it answers `{"data":{"app":"narrow-gate-fitness","commit":"…"}}`) | |
| Sandbox purchases counted for this tester? (owner: allow-listed tester or server sandbox setting) | |
| Tester | |
| Main device model and iOS version | |
| Second device model and iOS version | |
| Apple Watch / sleep source | |
| Test dates | |

The iPhone app is a shell around the deployed website (`docs/TESTFLIGHT.md`). A web-only fix reaches the app when the
site is redeployed, without a new build; a native change (plugins, permissions) needs a new build. Record both the
build number and the deployed commit with every result.

### Materials

- Three packaged foods with barcodes that are in Open Food Facts (one EAN-13, one UPC-A, one EAN-8 if you can find one).
  Write down the digits. The app's own example code is 3017620422003.
- One packaged item that is not in Open Food Facts (a store's own in-store label, for example), one QR code, one
  creased or curved barcode (a can or bottle).
- A measured route: a 400 m running track, and a road route of about 5 km whose length comes from a certified course
  or a map measurement (write down the source). A stopwatch (a watch is fine).
- Access to a tunnel or underpass at least 30 s long on foot, a street among tall buildings, a path under tree cover.
- A computer to open exported files and check image metadata.

### Resetting between tests

- Deleting the app and reinstalling it from TestFlight removes the web view's storage (sign-in, drafts, workout copy)
  and should reset the camera, location and notification permissions so that the first-ask prompts appear again.
  If a prompt doesn't reappear after a reinstall, use Settings → General → Transfer or Reset iPhone → Reset →
  Reset Location & Privacy.
- Apple Health access is managed in the Health app (profile picture → Apps, under Privacy) or in Settings → Health →
  Data Access & Devices. The exact path differs between iOS versions; record the one you used.
- iOS 18 moved app settings to Settings → Apps → Narrow Gate Fitness. Where a step says "Settings → Narrow Gate
  Fitness", use whichever your iOS version has.

### How to record evidence

- Take a screenshot or a screen recording for every case, including passes.
- Name files `<test id>-<letter>.<ext>`, with the letter counting up within a case: `DT-GPS-02-a.png`,
  `DT-GPS-02-b.png`, `DT-REST-03-a.mov`. Use `.png` for screenshots, `.mov`/`.mp4` for recordings, `.json`/`.txt` for
  exported files or notes.
- Put them in a folder per run, `<build number>/<device>/` (for example `14/iPhone15-iOS18.1/`).
- **Keep evidence outside this repository**, in a private shared folder. GPS screenshots show where you ran, Health
  screens show health data, and exports contain account data.
- Write the file names in the case's Evidence field and in the CSV.
- For the GPS and route cases, also write down the numbers asked for (distance, times, GPS details counts) in Actual
  result, so they can be compared later without the screenshots.

### Recording results

- The fields in this file are left blank on purpose. For each run, record results in `device-test-results.csv` (copy
  the row when a case is run on a second device or build), or in a dated copy of this file, not in this file itself.
- Pass: every point of the expected outcome happened. Fail: any point didn't. Blocked: the case couldn't be run (say
  why: no watch, no second device, a store product missing, a prerequisite case failed).
- Where an expected outcome says **not determined by the code** or **record**, there is no fixed answer yet: write down
  exactly what happened. Mark Pass only if the app stayed usable and nothing in the case's pass criteria was broken.

### Severity scale (for failed cases)

| Severity | Meaning | Examples in this app |
|---|---|---|
| **S1 Blocker** | Crash, data loss, another member's data shown, wrong money or entitlement handling, or a core flow unusable. Blocks inviting testers or submitting. | App crashes opening the camera or photo library; a logged workout or a finished run is lost; account B sees A's photos or drafts; a sandbox purchase unlocks nothing although it should, or a deleted account can still sign in |
| **S2 Major** | A feature works only partly or gives a wrong result, with no reasonable workaround | Locked-screen GPS leaves a gap; distance outside the documented tolerance; a rest notification never arrives; Health import misses or duplicates nights; restore doesn't restore |
| **S3 Minor** | Wrong, missing or misleading message, or awkward flow, with a workaround | A message points to the wrong Settings path; the recorder keeps running its clock after a refusal (known R3); a button disabled without explanation |
| **S4 Cosmetic** | Layout, wording or visual issue with no effect on behaviour | Text says "browser" inside the app; truncation; spacing under the notch |

### Retest rules

1. Retest a failed case only on a build or deployment that claims to fix it. Write the new build number and deployed
   commit in Retest status, for example "Build 15 / a1b2c3d: Pass".
2. Never overwrite the original Actual result; add the retest result after it.
3. When a fix touches a section, rerun every case in that section on the new build, not only the failed one.
4. A case that fails at least once in three attempts is a Fail (write how often it failed).
5. A Blocked case is rerun as soon as its blocker is removed; it is not a pass.
6. Cases that failed with S1 or S2 are retested on both the current-iOS iPhone and the iOS 16 iPhone (if available).
7. Native changes (plugins, Info.plist, entitlements) need a new TestFlight build: rerun §1, §2, §4, §5, §6 and §13
   in full on it.

---

## 1. Native rest-timer notifications and sound (DT-REST)

**How it works (from the code).** Ticking a set complete starts a rest countdown under the logger's header (90 s for
an exercise added by hand, 45 s for a timed one; programs set their own), with −15 s, +15 s and Skip. In the iPhone
app, the logger also schedules one local notification (id 4201) for the end of the rest, titled **"Rest complete"**
with **"Time for your next set of <exercise>."**, but only while at least one of the **Rest timer alerts** (Sound,
Vibrate, at the bottom of the logger) is on. Changing the rest (±15 s, Pause, Resume) replaces the notification; Skip,
Finish, Discard or turning both alerts off cancels it. The first time a rest is scheduled, the app asks for notification
permission; if it is refused, the app schedules nothing and says nothing.

Things the code determines that the tester should expect:

- **The notification has no sound.** `scheduleRestNotification` passes no `sound`, and the notifications plugin
  (8.3.1) sets a sound only when one is given. Expect a silent banner. Record whether you'd want a sound (S2/S3
  product decision for the owner).
- **The beep is in the page.** A short 880 Hz beep (0.4 s, Web Audio) plays when the logger sees the rest reach zero,
  which only happens while the page is running, so in the foreground. If the rest ended while the app was in the
  background, the logger notices when you come back and beeps then.
- **"Vibrate" does nothing by itself on iPhone.** It calls `navigator.vibrate`, which the iOS web view doesn't have;
  the app shows "This browser can't vibrate (iPhone Safari doesn't support it); the installed app uses its own
  notification." Ticking a set gives a native haptic tap (Capacitor Haptics).
- **In the foreground the banner appears too.** The plugin presents notifications while the app is open (no
  `presentationOptions` set), so a rest ending on screen gives both the beep and a "Rest complete" banner.

**To start a rest quickly:** Train → Empty workout → Add exercise → pick a non-timed exercise (for example a barbell
lift) → type a weight and reps in set 1 → tap the tick button at the end of the set row. The rest starts at 1:30; tap
−15 s to shorten it.

**Common preparation:** account A signed in; Rest timer alerts **Sound on** and **Vibrate on** unless the case says
otherwise; ringer volume up; Ring/Silent switch on ring; no Focus mode.

#### DT-REST-01 · First rest asks for notification permission; rest ends with the app open

- **Preparation:** Fresh install (notification permission never asked). Signed in as A.
- **Steps:**
  1. Train → Empty workout → Add exercise → choose a non-timed exercise.
  2. Enter a weight and reps in set 1 and tap the set's tick button.
  3. When the iOS notification prompt appears, take a screenshot, then tap **Allow**.
  4. Tap −15 s until the rest shows about 0:30. Keep the logger on screen and wait for zero.
  5. Open Settings → Notifications → Narrow Gate Fitness.
- **Expected outcome:** Ticking the set gives a haptic tap and starts the rest bar (1:30 counting down with a gold
  progress bar, −15 s, +15 s, Skip). The iOS prompt "“Narrow Gate Fitness” Would Like to Send You Notifications"
  appears when this first rest starts, not at launch. At zero: the rest bar disappears, one short beep plays, a
  "Rest complete" banner with "Time for your next set of <exercise name>." appears even though the app is open, and the
  phone does not vibrate. Settings shows notifications allowed for Narrow Gate Fitness.
- **Source:** `src/lib/native.ts` `scheduleRestNotification` (asks when permission isn't granted);
  `src/components/workout/workout-logger.tsx` (scheduling effect on `rest.endsAt`, `beep()`, completion effect);
  `node_modules/@capacitor/local-notifications/ios/.../LocalNotificationsHandler.swift` `willPresent`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-REST-01-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-REST-02 · Rest ends with the app in the background

- **Preparation:** Notifications allowed (DT-REST-01). A workout open in the logger.
- **Steps:**
  1. Start a rest (1:30). Note the time it should end.
  2. Swipe up to the Home Screen and wait until after the end time.
  3. Take a screenshot when the banner arrives; note the time.
  4. Tap the banner (or reopen the app).
- **Expected outcome:** At the end time (within a few seconds) a banner "Rest complete" / "Time for your next set of
  <exercise>." appears, without sound (see the section notes). Exactly one notification. Tapping it brings the app to
  the front on the logger (the app adds no special handling for this notification). Back in the logger, the rest bar
  is gone; the beep may play once on return. The workout's elapsed time kept counting.
- **Source:** `src/lib/native.ts` (`schedule.at` = rest end, no `sound`); `src/lib/native-alarm.ts` (the only
  notification tap listener handles alarm ids only); `workout-logger.tsx` completion effect.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-REST-02-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-REST-03 · Rest ends with the screen locked

- **Preparation:** As DT-REST-02.
- **Steps:**
  1. Start a rest (1:30).
  2. Lock the phone with the side button. Leave it face up.
  3. Wait until after the end time. Note whether the screen lights up and whether there is any sound or vibration.
  4. Screenshot the lock screen. Unlock into the app.
- **Expected outcome:** The "Rest complete" notification is on the lock screen at the end time. It has no sound per
  the code; whether the screen wakes is iOS behaviour (record it). After unlocking, the logger shows no rest bar and
  the workout clock is still running; a late beep may play.
- **Source:** as DT-REST-02; `docs/DATA.md` §2 Native ("Local notifications (rest timer…) are scheduled with the OS").
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-REST-03-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-REST-04 · Notification permission denied

- **Preparation:** Fresh install, or Settings → Notifications → Narrow Gate Fitness → Allow Notifications off.
- **Steps:**
  1. Start a rest. On a fresh install, tap **Don't Allow** at the prompt.
  2. Go to the Home Screen and wait until after the rest end time. Return to the app.
  3. Start another rest, keep the logger on screen and let it end.
  4. Start a third rest; watch for any new prompt.
- **Expected outcome:** No notification arrives at any time. The app shows no message about notifications (the code
  returns silently when permission is refused). The rest bar still counts down and, in the foreground, the beep still
  plays at zero. iOS does not ask again on later rests. Logging is not affected.
- **Source:** `src/lib/native.ts` `scheduleRestNotification` (`if (req.display !== "granted") return;`).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-REST-04-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-REST-05 · Permission re-enabled in Settings

- **Preparation:** State after DT-REST-04 (notifications refused). A rest running in the logger.
- **Steps:**
  1. Leave the rest running. Open Settings → Notifications → Narrow Gate Fitness and turn Allow Notifications on.
  2. Return to the app without force-quitting. Let the running rest end in the background.
  3. Start a new rest and go to the Home Screen until it ends.
- **Expected outcome:** The rest that was already running when you allowed notifications does not notify (it was
  never scheduled). The next rest started after allowing produces a "Rest complete" notification (the app checks the
  permission each time it schedules). No relaunch needed.
- **Source:** `src/lib/native.ts` (`checkPermissions` on every call); `workout-logger.tsx` (scheduling runs when
  `rest.endsAt` changes).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-REST-05-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-REST-06 · Ring/Silent switch on silent

- **Preparation:** Notifications allowed. Ring/Silent switch (or the Action button's Silent mode) set to silent.
- **Steps:**
  1. In Rest timer alerts, turn Sound off and on again (this plays the preview beep). Note whether you hear it.
  2. Start a rest and let it end with the logger on screen. Note whether the beep plays.
  3. Start a rest and let it end in the background.
- **Expected outcome:** The background notification behaves as in DT-REST-02 (it is silent anyway). Whether the
  in-page beep plays with the switch on silent is **not determined by the app's code** (the app sets no audio session
  for its Web Audio beep; WebKit decides): record what happens for the preview and for the rest end.
- **Source:** `workout-logger.tsx` `beep()` and `saveAlerts` (preview beep "which also unlocks audio on iOS").
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-REST-06-a.mov`):
- **Severity if failed:**
- **Retest status:**

#### DT-REST-07 · Do Not Disturb or another Focus

- **Preparation:** Notifications allowed. Turn on Do Not Disturb in Control Centre, with Narrow Gate Fitness not in its
  allowed apps.
- **Steps:**
  1. Start a rest and go to the Home Screen until it ends.
  2. Start another rest and lock the phone until it ends.
  3. Turn Do Not Disturb off and open Notification Centre.
- **Expected outcome:** While the Focus is on, no banner or lock-screen alert interrupts (the notification sets no
  time-sensitive interruption level, so it can't break through a Focus). After turning the Focus off, both "Rest
  complete" notifications are in Notification Centre. The in-app rest timer is unaffected.
- **Source:** `src/lib/native.ts` (no `interruptionLevel` passed); plugin `makeNotificationContent`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-REST-07-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-REST-08 · Rest ends while the app is closed

- **Preparation:** Notifications allowed. A workout with at least one completed set.
- **Steps:**
  1. Start a rest and tap +15 s twice (about 2:00). Note the end time.
  2. Within 10 s, open the app switcher and swipe Narrow Gate Fitness away (force-quit). Lock the phone.
  3. Wait until after the end time; note whether the notification arrives.
  4. Reopen the app. Go to the workout (Home → Resume workout).
- **Expected outcome:** The notification still arrives at the end time (it is scheduled with iOS, not run by the
  page). On reopening: the splash screen, then **no opening animation** (a workout in progress on the device turns it
  off), Home with **Resume workout** and the floating **"Resume: <workout name>"** pill. The logger restores every set;
  no rest bar is shown and no beep plays (the rest ended while the app was closed). The elapsed time includes the time
  the app was closed (a draft less than 6 hours old resumes without asking).
- **Source:** `src/lib/opening.ts` `activityInProgress`; `src/components/shell/active-workout-pill.tsx`;
  `src/components/home/today-workout-action.tsx`; `src/lib/domain/workout-draft.ts` (`STALE_DRAFT_HOURS = 6`,
  `restRemaining`).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-REST-08-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-REST-09 · Adjust, skip, pause and resume a running rest

- **Preparation:** Notifications allowed. A workout in the logger.
- **Steps:**
  1. Start a rest, note its end time, tap +15 s twice, go to the Home Screen and wait. Note when the notification
     arrives and whether a second one arrives.
  2. Return, start a rest, tap **Skip**, go to the Home Screen for 2 minutes.
  3. Return, start a rest, tap the header's Pause button, go to the Home Screen for 2 minutes, return, tap Resume
     (the play button), go to the Home Screen until the rest ends.
- **Expected outcome:** (1) exactly one notification, 30 s after the original end time, none at the original time.
  (2) no notification. (3) none while paused; the rest bar shows the frozen remaining time during the pause; after
  Resume, one notification at the Resume time plus the time that was left.
- **Source:** `src/lib/domain/workout-draft.ts` (`adjustRest`, `clearRest`, `pause`, `resume`); `workout-logger.tsx`
  (re-schedules on every change of `rest.endsAt`, cancels when it is null); `src/lib/native.ts` (cancels id 4201
  before scheduling).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-REST-09-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-REST-10 · Rest timer alerts off, Vibrate only, and saved setting

- **Preparation:** Notifications allowed. A workout in the logger.
- **Steps:**
  1. In Rest timer alerts, tap **Sound on** (it becomes Sound off) and **Vibrate on** (Vibrate off).
  2. Start a rest; let it end once on screen and once in the background.
  3. Turn Vibrate on only (Sound off). Note the text under the buttons. Start a rest; let it end in the background.
  4. Turn Sound on. Note whether the preview beep plays.
  5. Force-quit, reopen, open the logger and look at the two buttons.
- **Expected outcome:** (2) With both off: no beep and no notification; the rest bar still counts down and
  disappears. (3) With Vibrate only: the notification is still scheduled (either alert counts as wanting one); the
  hint "This browser can't vibrate (iPhone Safari doesn't support it); the installed app uses its own notification."
  is shown; no vibration from the page. (4) A short preview beep plays when Sound is turned on. (5) The buttons show the
  last saved state (stored on the profile as `rest_timer_sound` / `rest_timer_vibrate`). If saving fails the button
  goes back and "Couldn't save that setting." (or "You appear to be offline.") appears.
- **Source:** `workout-logger.tsx` (`wantsAlert = alerts.sound || alerts.vibrate`, `saveAlerts`, vibrate hint);
  `src/server/actions/rest-alerts.ts`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-REST-10-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-REST-11 · Finish, discard or sign out while a rest is running

- **Preparation:** Notifications allowed.
- **Steps:**
  1. Start a rest, tap Finish → **Finish & save**, go to the Home Screen until the original end time.
  2. Start a new workout, start a rest, tap **Discard workout** → Discard, go to the Home Screen until the end time.
  3. Start a new workout, start a rest, go to Profile (initials, top right) → **Sign out**, wait until the end time.
- **Expected outcome (updated 2026-11-03):** no notification in any of the three. Finish and Discard cancel it, and
  signing out removes every notification the app scheduled (rest timer, reminders, sleep alarm), so the next person
  never sees the previous member's exercise name.
- **Source:** `workout-logger.tsx` (`cancelRestNotification` on finish and discard);
  `src/components/shell/sign-out-form.tsx` → `clearDeviceNotifications` (`src/lib/native-notifications.ts`).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-REST-11-a.png`):
- **Severity if failed:**
- **Retest status:**

---

## 2. Background and locked-screen GPS (DT-GPS)

**How it works (from the code and the audit).** Live recording needs Pro All Access; on Free the record page shows
"Live GPS recording is included with Pro All Access". In the app the start screen reads "Native GPS (background
recording; not yet verified on a phone)". The native plugin (`@capacitor-community/background-geolocation` 1.2.26)
asks for **Always** authorization and, if it has only While Using, asks to escalate (audit remaining issue R1). It runs
with `UIBackgroundModes: location`, background updates allowed, the blue background-location indicator, no automatic
pausing, best accuracy and no distance filter. iOS delivers locations in batches and the plugin passes on only the last
of each batch. **Not verified anywhere yet:** whether the web view keeps running while the screen is locked, and
battery use (audit row "GPS: locked-screen recording, battery": BLOCKED).

Recording rules (`src/lib/domain/gps-track.ts`): the clock starts at Start; distance starts with the first fix within
20 m; fixes worse than 25 m are ignored; "GPS signal lost" after 15 s without a usable fix; nothing is counted across a
pause or a gap; the recording is kept on the device (`run.recording.<user id>`) at least every 5 s.

**Common preparation:** account A with Pro; outdoors under open sky; battery above 80% (write it down); Location
Services on.

#### DT-GPS-01 · First Start: which location prompts iOS shows

- **Preparation:** Fresh install (or Reset Location & Privacy). Signed in as A with Pro.
- **Steps:**
  1. Run → **Outdoor run**. Read the start screen; take a screenshot.
  2. Tap **Start run**. Screenshot the prompt and copy its text into Actual result.
  3. Tap **Allow While Using App**. Wait for Recording.
  4. Tap Pause, then the trash button, then Discard.
  5. Tap **Start run** again. Screenshot any new prompt (for example "Change to Always Allow?") and choose **Keep Only
     While Using**.
  6. Lock the phone for 2 minutes, unlock, and note any prompt that appears later during this run session.
- **Expected outcome:** No location prompt before Start ("Location is requested only when the member taps Start").
  The first prompt offers Allow Once / Allow While Using App / Don't Allow and shows one of the two purpose strings:
  "Narrow Gate Fitness uses your location only during a run or walk you start, to measure distance, pace and your
  route." or "Lets a run or walk you started keep recording while your phone is locked. Location is never used when
  you're not recording." Record which. Because the plugin requests Always and escalates from While Using, expect iOS
  to offer "Change to Always Allow" at the second Start (step 5) or later in the background: record exactly when, and
  its text. This is known issue R1 (P2, not fixed), which the owner has to decide; the case passes if the prompts
  appear, are readable and don't break recording.
- **Source:** audit row "GPS: iOS permission prompts" and R1;
  `node_modules/@capacitor-community/background-geolocation/ios/Plugin/Swift/Plugin.swift` (`requestAlwaysAuthorization`,
  escalation from `.authorizedWhenInUse`); `ios/App/App/Info.plist`; `src/lib/native/location.ts`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-GPS-01-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-GPS-02 · First fix, recording state and GPS details

- **Preparation:** Location allowed (While Using). Standing outdoors.
- **Steps:**
  1. Run → Outdoor run → Start run. Start a stopwatch.
  2. Note the seconds until the badge changes from "Waiting for GPS" to "Recording".
  3. Open **GPS details** and screenshot it.
  4. Walk for 2 minutes; screenshot the map. Discard the recording.
- **Expected outcome:** Badge "Waiting for GPS" with "No fix yet", then "GPS ±N m"; the notice "Waiting for a good GPS
  fix (within 20 m). Time is running; distance starts with the first good fix."; Time counts from Start. The badge turns
  "Recording" with the first fix within 20 m. GPS details rows: Source "Native GPS (background recording; not yet
  verified on a phone)", Last reading, Accuracy now, Best / worst, Update interval (about 1 s average expected), Readings
  used, Ignored, Signal gaps "None", Speed now. No latitude or longitude is shown anywhere. The map shows the line and
  your current position with an uncertainty ring.
- **Source:** `src/components/run/gps-recorder.tsx` (`GpsDetails`, acquiring notice); `src/lib/domain/gps-track.ts`
  (`FIRST_FIX_ACCURACY_M = 20`, `gpsDiagnostics`); `docs/GPS_ACCURACY.md` (diagnostics show no positions).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-GPS-02-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-GPS-03 · Screen locked for 10 minutes (While Using)

- **Preparation:** Settings → Privacy & Security → Location Services → Narrow Gate Fitness: **While Using the App**,
  Precise Location on. A route you can walk or run continuously for 10 minutes.
- **Steps:**
  1. Start run; wait for Recording. Note Distance and Time.
  2. Lock the phone and move continuously for 10 minutes without stopping. Note roughly how far you went.
  3. Start a screen recording from Control Centre, then unlock and open the app. Keep recording for 10 s.
  4. Continue 1 minute with the screen on. Finish → review. Screenshot the review, the map and GPS details.
- **Expected outcome (the design; the main item never verified):** Recording continued while locked. On unlocking,
  Distance has grown by about the distance moved, with no jump; Time and Moving include the locked period; the badge
  says Recording; no "GPS signal lost" notice; GPS details "Signal gaps: None" for the locked stretch; the route line is
  continuous along your path with no dashed "not counted" join. While the app is in the background, iOS shows the blue
  location indicator in the status bar. **Fail** if the distance stopped while locked, a gap was counted for the locked
  period, or the line jumps straight across the locked stretch.
- **Source:** audit rows "GPS: locked-screen recording, battery" and §5C "Locked screen"; `Info.plist`
  `UIBackgroundModes`; `Plugin.swift` (`allowsBackgroundLocationUpdates`, `showsBackgroundLocationIndicator`,
  `pausesLocationUpdatesAutomatically = false`).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-GPS-03-a.mov`):
- **Severity if failed:**
- **Retest status:**

#### DT-GPS-04 · App in the background and switching apps

- **Preparation:** As DT-GPS-03.
- **Steps:**
  1. Start run; wait for Recording.
  2. Swipe up to the Home Screen; keep moving 3 minutes.
  3. Open another app (Music, or Maps showing your position); use it for 3 minutes while moving.
  4. Switch back through the app switcher. Finish → review.
- **Expected outcome:** As DT-GPS-03: continuous line, no gap, distance kept growing. The blue indicator shows on the
  Home Screen and in the other app. Returning shows the run exactly where it was: no opening animation, no reload.
  Record anything odd if the other app also used location.
- **Source:** as DT-GPS-03; `src/lib/opening.ts` (the opening never plays on returning from the background).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-GPS-04-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-GPS-05 · Incoming phone call during a recording

- **Preparation:** As DT-GPS-03, and someone who can call you.
- **Steps:**
  1. Start run; wait for Recording; keep moving.
  2. Answer an incoming call; talk for 2 minutes while moving; hang up.
  3. Return to the app. Finish → review.
- **Expected outcome:** Recording continues through the call (the call only puts the app in the background); no gap;
  Time continues; the run is on screen when you return. Blocked if no caller is available.
- **Source:** as DT-GPS-03.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-GPS-05-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-GPS-06 · Locked screen with "Always" permission

- **Preparation:** Settings → Location Services → Narrow Gate Fitness → **Always**, Precise on.
- **Steps:** Repeat DT-GPS-03 (10 minutes locked) on the same route.
- **Expected outcome:** Same as DT-GPS-03. Compare with the DT-GPS-03 result and write down any difference (gaps,
  "Update interval" in GPS details, distance). The audit expects background updates to work with While Using plus the
  background mode; if they work only with Always, record that clearly: it decides issue R1.
- **Source:** audit R1 ("Background updates work with When-In-Use plus `UIBackgroundModes`").
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-GPS-06-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-GPS-07 · "Allow Once"

- **Preparation:** Settings → Location Services → Narrow Gate Fitness → **Ask Next Time Or When I Share**.
- **Steps:**
  1. Start run → choose **Allow Once**. Wait for Recording.
  2. Lock the phone for 5 minutes while moving. Unlock. Finish → Save.
  3. Force-quit, reopen, Run → Outdoor run → Start run.
- **Expected outcome:** **Not determined by the app's code** (iOS controls one-time permission). Record whether
  recording continued while locked and whether iOS asked again at step 3. The app must not crash and must show either
  a recording or the refusal message "Location permission is off for this app. Turn it on in your browser or phone
  settings to record a run or walk."
- **Source:** `src/lib/native/location.ts` (`NOT_AUTHORIZED` → "denied"); `gps-recorder.tsx` `ERROR_TEXT`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-GPS-07-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-GPS-08 · Location refused, then allowed from Settings

- **Preparation:** Fresh install, or Location set to **Never** for Narrow Gate Fitness.
- **Steps:**
  1. Start run. On a fresh install tap **Don't Allow**.
  2. Watch the screen for 30 s.
  3. Tap Pause, then the trash button (Discard recording), then Discard.
  4. Look at the start screen; tap **Open Settings**.
  5. In Settings set Location to While Using. Return to the app (note whether iOS restarted it).
  6. Start run.
- **Expected outcome:** After the refusal the recording screen shows "Location permission is off for this app. Turn it
  on in your browser or phone settings to record a run or walk."; the badge stays "Waiting for GPS" and **Time keeps
  running** (known issue R3, not fixed). This screen has no Open Settings button. After discarding, the start screen
  shows the same message with an **Open Settings** button (phone app only), which opens Narrow Gate Fitness in iOS
  Settings. After allowing, Start records normally. The discarded recording is not offered back later. If instead the
  recorder sits on "Waiting for GPS" / "No fix yet" with no message at all, that is a Fail.
- **Source:** audit rows "GPS: permission refused", D6, R3; `gps-recorder.tsx` (Open Settings rendered only on the
  start screen); `src/lib/native/location.ts` `openLocationSettings`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-GPS-08-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-GPS-09 · Approximate location (Precise Location off)

- **Preparation:** Settings → Location Services → Narrow Gate Fitness → While Using, **Precise Location off**.
- **Steps:**
  1. Start run; walk for 2 minutes.
  2. Screenshot the screen and GPS details. Pause → Discard.
  3. Turn Precise Location back on.
- **Expected outcome:** The badge stays "Waiting for GPS"; the warning "Your device is only sharing an approximate
  location (hundreds of metres), which can't measure a run or walk. Turn on Precise Location for this browser or app —
  iPhone: Settings › Privacy & Security › Location Services › your browser › Precise Location. …" appears; Distance stays
  at zero; GPS details show accuracy in the hundreds or thousands of metres and "Readings used 0 of N". (The text says
  "your browser" even in the app: S4 if the owner wants it changed.)
- **Source:** `src/lib/domain/gps-track.ts` `gpsDiagnostics` (`precise_off` when nothing accepted and best accuracy
  ≥ 200 m); `gps-recorder.tsx` `HINT_TEXT.precise_off`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-GPS-09-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-GPS-10 · Low Power Mode, 20 minutes locked

- **Preparation:** Settings → Battery → **Low Power Mode on**. Write down the battery percentage.
- **Steps:**
  1. Start run; wait for Recording; lock the phone.
  2. Move continuously for 20 minutes. Unlock; screenshot the recording screen and GPS details.
  3. Finish → review. Write down the battery percentage.
- **Expected outcome:** As DT-GPS-03: continuous line, no gap counted for the locked period. If the average update
  interval rose above 5 s, the hint "Location updates are arriving slowly (more than 5 seconds apart). Keep this screen
  open and turn off battery or low-power saving for the browser." appears after unlocking; record it and the "Update
  interval" values. Record battery used. No battery target is documented.
- **Source:** `gps-track.ts` `gpsDiagnostics` (`slow_updates` when the mean interval > 5 s over ≥ 5 intervals);
  `gps-recorder.tsx` `HINT_TEXT.slow_updates`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-GPS-10-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-GPS-11 · One hour locked: battery and survival

- **Preparation:** Low Power Mode off. Battery at or near 100% (write it down). Permission as in DT-GPS-03.
- **Steps:**
  1. Start run; wait for Recording; lock the phone.
  2. Stay outdoors and moving (stops allowed) for 60 minutes.
  3. Unlock; screenshot; Finish → Save. Write down the battery percentage and any heat warning.
- **Expected outcome:** The run is still on screen after an hour (iOS didn't end the app; if the app restarted, the
  record page offers "You have an unfinished run…": record that as a Fail). No gaps other than real signal loss. Record
  the battery drop; there is no documented target (the audit lists battery drain as unverified).
- **Source:** audit §6 item 1 ("battery over an hour"); `docs/GPS_ACCURACY.md` "Needs a real phone".
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-GPS-11-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-GPS-12 · Pause and resume

- **Preparation:** On a measured stretch (for example the track) with Recording on.
- **Steps:**
  1. Move 200 m. Tap **Pause**. Note Distance, Moving and Time.
  2. Move another 200 m while paused (optionally go to the Home Screen and check the status bar for the blue indicator).
  3. Return, tap **Resume**, move 200 m. Finish → review.
- **Expected outcome:** While paused: badge "Paused", Distance and Moving don't change, Time keeps running; location is
  switched off (the watcher stops on Pause, so no blue indicator). Resume turns location back on (Waiting for GPS, then
  Recording). The map shows a break at the pause (a faint dashed join, "not counted"). Total distance is about 400 m,
  not 600 m (within the DT-ROUTE tolerances).
- **Source:** `gps-track.ts` `pauseTrack` / `resumeTrack` (a pause always breaks the line); `gps-recorder.tsx`
  (Pause calls `stopWatching`); `IOS_DEVICE_TEST_PLAN.md` 3.4.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-GPS-12-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-GPS-13 · Finish, save and delete a run

- **Preparation:** A recording of at least 1 km.
- **Steps:**
  1. Tap Finish; read the dialog; confirm **Finish**. Go to the Home Screen briefly and check the status bar.
  2. On the review screen choose an effort and type a note. Tap **Save run**.
  3. Check Run history and the weekly totals.
  4. Open the run → delete it → confirm.
- **Expected outcome:** Dialog "Finish this run?" / "You'll review it before saving." After Finish, location is off at
  once (no blue indicator). Review "Run complete" with Distance, Moving time, Avg pace, Total time and the route map
  (start and finish markers, a marker each km or mile). Save opens the run's page with "Run saved." and "Private to you.
  Drawn from your own GPS points…"; no sharing control exists. The run is in history and the weekly totals. After
  deleting, it is gone from history and the totals (its route is removed; see DT-EXP-03).
- **Source:** `gps-recorder.tsx` (`finish`, review screen, `save`); `src/app/(app)/run/activities/[id]/page.tsx`;
  `src/server/actions/activities.ts` (delete clears `route`, `splits`, `gps_quality`); audit row "route persistence and
  user isolation".
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-GPS-13-a.png`):
- **Severity if failed:**
- **Retest status:**

---

## 3. Outdoor route accuracy (DT-ROUTE)

**Tolerances** come from the outdoor plan in `docs/GPS_ACCURACY.md`: a measured track within ±2%; a measured road
route within ±3%; a city walk among tall buildings within ±8%, with a 2-minute stop adding under 20 m; standing still
for 10 minutes under 25 m. In a tunnel, nothing is counted and the straight-line distance across the gap is shown.
These limits were set from simulated traces; this is the first time they meet a real phone.

**How to compare pace.** The app's Avg pace is Moving time ÷ Distance. Moving time counts from Start, including the
"Waiting for GPS" wait and any standing still; only pauses are left out (`movingSecondsAt`). So: tap Start at the
start line, and when the badge turns "Recording" write down the Time shown (T0), then start your stopwatch and go.
Reference pace = stopwatch time ÷ reference distance. App pace for comparison = (Moving time − T0) ÷ app distance. The
pace check uses the same tolerance as the distance check.

**For every case write in Actual result:** reference distance and its source; app distance; error in %; stopwatch
time; Moving time; T0; GPS details "Readings used", "Ignored" and "Signal gaps"; units (km or mi).

Run the cases with the iPhone app (native GPS). Use the same phone for the whole section.

#### DT-ROUTE-01 · Running track, 4 laps in lane 1, screen on

- **Preparation:** A standard 400 m track; lane 1 (4 laps = 1,600 m). Pro, Precise Location on.
- **Steps:**
  1. Stand on the start line. Run → Outdoor run → Start run. Wait for Recording; note T0; start the stopwatch.
  2. Run (or walk) 4 laps in lane 1, keeping the screen on.
  3. Stop the stopwatch on the line; tap Finish → Finish. Screenshot the review, map, splits and GPS details.
- **Expected outcome:** Distance 1,568–1,632 m (1.57–1.63 km; 0.97–1.01 mi). Corrected pace within ±2% of the
  reference. The map traces the oval with no spikes; Signal gaps "None". Splits: one at 1 km in metric; **none in
  imperial**, because 1,600 m is just under a mile (1,609 m).
- **Source:** `docs/GPS_ACCURACY.md` outdoor plan item 1; `gps-track.ts` (`newSplits`, splits per unit).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-ROUTE-01-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-ROUTE-02 · Running track, screen locked the whole time

- **Preparation:** As DT-ROUTE-01.
- **Steps:** As DT-ROUTE-01, but lock the phone right after the badge turns Recording and unlock only on the finish line.
- **Expected outcome:** The same tolerance as DT-ROUTE-01 (1,568–1,632 m). Write down the difference from DT-ROUTE-01.
  A gap or a straight jump across part of the track is a Fail (see DT-GPS-03).
- **Source:** `docs/GPS_ACCURACY.md` outdoor plan items 1 and 6.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-ROUTE-02-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-ROUTE-03 · Measured road route, about 5 km

- **Preparation:** A certified 5 km course, or a route measured with a map tool (write down the tool and the measured
  length). Mostly open sky.
- **Steps:** As DT-ROUTE-01 on the road route. Screenshot each split as it appears, or the splits list at the end.
- **Expected outcome:** Distance within ±3% of the reference (4.85–5.15 km for exactly 5.00 km). Corrected pace within
  ±3%. Splits at each km (5) or mile (3), each with its time.
- **Source:** `docs/GPS_ACCURACY.md` outdoor plan item 2.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-ROUTE-03-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-ROUTE-04 · City walk among tall buildings, with a 2-minute stop

- **Preparation:** About 1.5 km among tall buildings ("urban canyon"), with two road crossings, measured on a map.
- **Steps:**
  1. Run → **Outdoor walk** → Start walk. Wait for Recording.
  2. Walk the route. At one crossing stand still for 2 minutes; write down Distance at the start and end of the stop.
  3. Finish → review. Screenshot GPS details and any hint shown during the walk.
- **Expected outcome:** Distance within ±8% of the reference; the 2-minute stop adds under 20 m. Hints may appear
  ("The GPS signal is weak here…" or "Several readings jumped away from your route and were ignored (tall buildings or
  trees reflect GPS signals).") — record them.
- **Source:** `docs/GPS_ACCURACY.md` outdoor plan item 3; `gps-track.ts` (`STILL_SPEED_MS = 0.55`, outlier gate);
  `gps-recorder.tsx` `HINT_TEXT`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-ROUTE-04-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-ROUTE-05 · Standing still for 10 minutes

- **Preparation:** Outdoors, open sky.
- **Steps:**
  1. Outdoor walk → Start walk. Wait for Recording; note Distance.
  2. Stand still for 10 minutes holding the phone. Screenshot Distance and GPS details. Discard.
- **Expected outcome:** Distance under 25 m after 10 minutes. GPS details "Readings used" mentions readings "while
  standing still, no distance".
- **Source:** `docs/GPS_ACCURACY.md` outdoor plan item 4 (simulated: 5 m mean, 25 m worst).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-ROUTE-05-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-ROUTE-06 · Tunnel or underpass

- **Preparation:** A tunnel or underpass of at least 30 s on foot, on a measured route; write down its length.
- **Steps:**
  1. Start a run or walk before the tunnel; wait for Recording.
  2. Go through the tunnel with the screen on. Note when the warning appears and disappears.
  3. Continue 2 minutes; Finish → review. Screenshot the warning, the review gap note, the map and GPS details.
- **Expected outcome:** About 15 s after the last usable fix: "GPS signal lost. Time keeps running; no distance is added
  until the signal returns." Time keeps running. When fixes return the warning goes and a new line starts. Review:
  "The signal dropped 1 time; no distance was added for those stretches (about N m in a straight line)."; GPS details
  "Signal gaps 1 (≈N m straight-line not counted)"; the map shows a dashed "not counted" join. The total is about the
  reference minus the tunnel length. If no gap appears (iOS may keep reporting positions in a short underpass), write
  down the accuracy values during the tunnel.
- **Source:** `docs/GPS_ACCURACY.md` outdoor plan item 5; `gps-track.ts` (`SIGNAL_LOST_MS = 15_000`, `tick`,
  `uncountedGapM`); `gps-recorder.tsx` review gap note.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-ROUTE-06-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-ROUTE-07 · Under tree cover

- **Preparation:** A measured path of at least 1 km under trees.
- **Steps:** As DT-ROUTE-03 on the tree-covered path.
- **Expected outcome:** **No tolerance is documented for tree cover.** Use the road-route tolerance (±3%) as a
  provisional pass mark and say so in Actual result; the owner sets the real one. For comparison, simulated multipath
  traces read +2.8% on average (+4.4% worst). Record any hints shown.
- **Source:** `docs/GPS_ACCURACY.md` ("Run with multipath spikes"; the outdoor plan has no tree-cover item).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-ROUTE-07-a.png`):
- **Severity if failed:**
- **Retest status:**

---

## 4. Native barcode scanning (DT-SCAN)

**How it works (from the code).** Food → **Scan a product** opens "Narrow Gate Nutrition Score"
(`/nutrition/scanner`). In the app, **Scan barcode** opens the system full-screen scanner (`@capacitor/barcode-scanner`
3.1.2, instruction "Line up the barcode on the package", any symbology). The app accepts a code only if it is an EAN-8,
UPC-A or EAN-13 with a valid check digit; then it opens the product page (`/nutrition/product/<code>`). The food
diary's **Add food → Scan** tab uses the same scanner and shows the result in the dialog. All lookups need the network
(Open Food Facts through the server). Barcode scanning is on every plan.

#### DT-SCAN-01 · First scan: camera prompt and a known product

- **Preparation:** Fresh install (camera never asked). Product 1 (EAN-13).
- **Steps:**
  1. Food → **Scan a product** → **Scan barcode**.
  2. Screenshot the camera prompt; tap **Allow** (or OK).
  3. Point at product 1's barcode. Note how long it takes to read.
- **Expected outcome:** The iOS camera prompt shows "Narrow Gate Fitness uses the camera to scan food barcodes,
  photograph meals for nutrition estimates you confirm, and take progress and Body Scan photos, which are stored
  privately for you only." The full-screen scanner opens with "Line up the barcode on the package" and a cancel
  control. On a read: a haptic tap, "Looking up <code>…", then the product page with the product's name and brand or
  quantity matching the package, and "Add to Food Diary".
- **Source:** `src/lib/native.ts` `scanBarcodeNative`; `src/components/nutrition/barcode-scanner.tsx` `startNative`;
  `src/components/nutrition/quality-client.tsx` `QualityScanner`; `Info.plist` `NSCameraUsageDescription`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SCAN-01-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-SCAN-02 · Several known products and barcode formats

- **Preparation:** Products 1–3 (EAN-13, UPC-A, EAN-8 if available), digits written down.
- **Steps:** For each product: Scan a product → Scan barcode → scan → screenshot the product page. Go back between
  products.
- **Expected outcome:** Each product page shows the right product. Write down the code the app used (in the page
  address or "barcode N") against the printed digits, especially for the UPC-A.
- **Source:** `src/lib/barcode.ts` (`barcodeInputError`, `barcodeLookupCandidates`);
  `src/app/(app)/nutrition/product/[code]/page.tsx`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SCAN-02-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-SCAN-03 · Scan into the food diary and log it

- **Preparation:** Product 1.
- **Steps:**
  1. Food → **Add food** → **Scan** tab → Scan barcode → scan product 1.
  2. Choose an amount and the meal; tap **Log food**.
  3. Look at the diary.
- **Expected outcome:** When the product is found, the dialog moves straight to the amount step ("How much?") for that
  product (Open Food Facts attribution shown). After Log food the entry is in the chosen meal with its name and
  calories.
- **Source:** `barcode-scanner.tsx` `runLookup` (`onFound` on "found"); `src/components/nutrition/nutrition-client.tsx`
  (Scan tab).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SCAN-03-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-SCAN-04 · Unknown product

- **Preparation:** An item whose barcode is not in Open Food Facts.
- **Steps:**
  1. Scan a product → Scan barcode → scan the item.
  2. Add food → Scan tab → scan the same item. Tap **Enter it manually**.
- **Expected outcome:** Nutrition Score: page title "Product not found" with "Barcode N isn't in Open Food Facts yet,
  so there's nothing to show, and nothing is guessed. You can log it yourself from the food diary using the label." and
  "Go to the food diary". Diary: "Barcode N isn't in Open Food Facts yet." with **Enter it manually** (opens manual
  entry) and **Scan another**. Nothing is invented. (A product found without nutrition shows "We found the product but
  it has no nutrition info — enter it manually from the label.")
- **Source:** `src/app/(app)/nutrition/product/[code]/page.tsx`; `barcode-scanner.tsx` (`not_found`, `no_nutrition`).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SCAN-04-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-SCAN-05 · Damaged, curved and badly lit barcodes

- **Preparation:** A creased barcode, a curved one (can or bottle), a glossy one; a dim room.
- **Steps:** Try each barcode three times in normal light and three times in the dim room, from Scan a product. Time
  each attempt (give up after 20 s and cancel). Note whether the scanner offers a light (torch).
- **Expected outcome:** Each attempt either reads the correct product or reads nothing; **never a wrong product**. A
  code that fails the check-digit test is refused with "That code (…) isn't a food product barcode (EAN or UPC). Try
  again or type the numbers." No read-time target is documented: record times and success rate. Note: in the app the
  first code the system scanner returns is used (the in-page scanner's "two identical reads" rule doesn't apply to
  the native scanner).
- **Source:** `barcode-scanner.tsx` `startNative` (single result) and `startCamera` (double-read rule, web only).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SCAN-05-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-SCAN-06 · A code that isn't a food barcode

- **Preparation:** A QR code (or a Code 128 shipping label).
- **Steps:** Scan a product → Scan barcode → scan the QR code.
- **Expected outcome:** "That code (<what the code contains>) isn't a food product barcode (EAN or UPC). Try again or
  type the numbers." No lookup is made. (The message shows the code's whole content; record it if it is long or a web
  address.)
- **Source:** `barcode-scanner.tsx` `startNative` (`barcodeInputError`).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SCAN-06-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-SCAN-07 · Cancel the scanner

- **Preparation:** Camera allowed.
- **Steps:** Scan a product → Scan barcode → tap the scanner's cancel control. Then tap Scan barcode again.
- **Expected outcome:** "Scan cancelled." under the button; nothing looked up; Scan barcode works again.
- **Source:** `src/lib/native.ts` (`OS-PLUG-BARC-0006` → cancelled); `barcode-scanner.tsx`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SCAN-07-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-SCAN-08 · Camera refused, then allowed

- **Preparation:** Fresh install with **Don't Allow** at the first camera prompt, or Settings → Narrow Gate Fitness →
  Camera off.
- **Steps:**
  1. Scan a product → Scan barcode. Screenshot the message.
  2. Tap **Type the barcode instead**, type product 1's digits, **Look up**.
  3. Settings → Narrow Gate Fitness → Camera on. Return to the app; Scan barcode.
- **Expected outcome:** (1) "Camera access is turned off for Narrow Gate. Allow it in your phone's Settings for this
  app, then try again." (If the plugin reports a different error, "The scanner couldn't start. Try again or type the
  barcode." appears instead: record which.) There is no in-app button to Settings for the camera. (2) Typed lookup works.
  (3) The scanner opens and reads.
- **Source:** `src/lib/native.ts` (`OS-PLUG-BARC-0007` → denied); `barcode-scanner.tsx` `startNative`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SCAN-08-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-SCAN-09 · Scanning with no network

- **Preparation:** Food tab loaded; then airplane mode on (Wi-Fi off).
- **Steps:**
  1. Add food → Scan tab → scan product 1. Screenshot. Turn airplane mode off; tap **Try again**.
  2. Airplane mode on again. Scan a product page → Scan barcode → scan product 1. Screenshot. Airplane mode off.
- **Expected outcome:** (1) "You're offline. Connect to the internet to look up products." with Try again and Enter it
  manually; after reconnecting, Try again finds the product. (2) Opening the product page needs the network: expect
  the "You're offline" page (with Try again) or an error page; record which, and that Try again brings the app back.
- **Source:** `barcode-scanner.tsx` `runLookup` (offline message); `native-shell/error.html`; `capacitor.config.ts`
  (`server.errorPath`).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SCAN-09-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-SCAN-10 · Typing the barcode when a scan fails

- **Preparation:** Online.
- **Steps:** Scan a product → **Type the barcode instead**. Look up: (a) product 1's digits with the last digit changed;
  (b) 11 digits; (c) letters; (d) the correct digits.
- **Expected outcome:** (a) "That barcode's check digit doesn't match — re-check the digits." (b) "Enter all 8, 12 or
  13 digits under the barcode." (c) "Barcodes contain digits only." (only spaces and dashes are removed before checking). (d) The
  same product page as scanning.
- **Source:** `src/lib/barcode.ts` `barcodeInputError`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SCAN-10-a.png`):
- **Severity if failed:**
- **Retest status:**

---

## 5. Camera permissions and denied permissions (DT-CAM)

**Every feature that uses the camera or photos:**

| Feature | Where | How it gets the picture | Plan |
|---|---|---|---|
| Barcode scanner | Food → Scan a product; Add food → Scan | Native full-screen scanner (plugin) | All |
| Body Scan | My Progress → Body Scan → new scan | Live camera inside the page (`getUserMedia`, video only), or **Upload a photo** | Pro, plus Body Scan consent |
| Meal photo | Food → Meal photo | **Take a photo** (file input with `capture="environment"`: the system camera), or **Choose from library** | Pro, AI data consent and meal-photo consent |
| Progress photo | Home → My Progress → Overview → Progress photos → Add photo | File input `accept="image/*"`: iOS offers the camera and the photo library | All |

(The administrators' exercise-media upload is not part of this script.)

**From the code and configuration:** one camera permission covers the whole app, so the first feature used asks and
the others don't. `Info.plist` has `NSCameraUsageDescription`, and no photo-library or microphone usage text. The web
view's own camera request and the motion sensor (Body Scan's level) are granted by Capacitor
(`WebViewDelegationHandler.swift` `requestMediaCapturePermissionFor` → `.grant`), so only the iOS system prompt should
appear. Photos picked from the library go through the system picker, which needs no photo-library permission, so no
"Limited access" choice is expected.

#### DT-CAM-01 · First camera use through Body Scan

- **Preparation:** Fresh install (camera never asked). A with Pro.
- **Steps:**
  1. Home → My Progress → Body Scan. Accept the consent card.
  2. Start a new scan; on the front step tap **Open camera**. Screenshot the prompt; tap **Allow**.
  3. Tilt the phone and watch the level badge.
  4. Turn on the 10-second timer, take the photo; tap **Retake**; take it again; **Use this photo**.
  5. Take the side photo; skip the rear (optional) photo. Leave without saving, or save (note which).
- **Expected outcome:** One iOS camera prompt, with the text quoted in DT-SCAN-01; no second "website wants to use the
  camera" prompt; no microphone prompt. A live preview with the head-to-feet outline. The level badge shows "Phone is
  upright" or "Tilt the phone upright (N°)" without any motion-permission prompt. The timer counts down 10 s and
  captures; Retake returns to the camera; the rear photo is optional.
- **Source:** `src/components/body-scan/scan-capture.tsx` (`start`, tilt, `SCAN_TIMER_SECONDS = 10`); `docs/BODY_SCAN.md`;
  `node_modules/@capacitor/ios/Capacitor/Capacitor/WebViewDelegationHandler.swift`; audit row "Info.plist permissions".
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-CAM-01-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-CAM-02 · First camera use through a progress photo

- **Preparation:** Fresh install (camera never asked). Signed in as A.
- **Steps:**
  1. Home → My Progress → Overview → Progress photos → **Add photo** → tap "Take or choose a photo".
  2. Screenshot the menu iOS shows. Choose the camera option; screenshot the prompt; Allow.
  3. Take a photo and confirm it.
- **Expected outcome:** iOS shows a menu with the camera and the photo library (its exact items are iOS's). The camera
  prompt appears once, with the same text. The photo appears as the preview in the dialog with "Tap to change".
- **Source:** `src/components/progress/progress-photos.tsx` `UploadDialog`; `Info.plist`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-CAM-02-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-CAM-03 · One permission for every camera feature

- **Preparation:** Camera allowed once (DT-CAM-01 or DT-CAM-02). Pro.
- **Steps:** Use the barcode scanner, Body Scan Open camera, Meal photo **Take a photo** and progress photo camera, one
  after the other. Then open Settings → Narrow Gate Fitness.
- **Expected outcome:** No further camera prompts. Settings shows Camera on.
- **Source:** iOS per-app permission; `Info.plist` single `NSCameraUsageDescription`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-CAM-03-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-CAM-04 · Camera refused: every feature

- **Preparation:** Fresh install with **Don't Allow** at the first camera prompt, or Settings → Narrow Gate Fitness →
  Camera off. Pro.
- **Steps:** Try each feature's camera, then its library or upload alternative:
  1. Scan a product → Scan barcode.
  2. Body Scan → Open camera; then **Upload a photo**.
  3. Meal photo → **Take a photo**; then **Choose from library**.
  4. Progress photo → camera option; then the photo library option.
- **Expected outcome:** (1) "Camera access is turned off for Narrow Gate. Allow it in your phone's Settings for this
  app, then try again." (2) "Camera permission is off. Allow the camera in your browser or phone settings, or upload a
  photo instead."; Upload a photo works. (3) and (4): what the system camera does after a refusal is **not determined by
  the app's code** (iOS handles it inside the file picker): record it; choosing from the library still works. The app
  never crashes.
- **Source:** `barcode-scanner.tsx`; `scan-capture.tsx` (`NotAllowedError` message);
  `src/components/nutrition/food-photo-flow.tsx` (file inputs); `progress-photos.tsx`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-CAM-04-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-CAM-05 · Camera allowed again in Settings

- **Preparation:** State after DT-CAM-04.
- **Steps:** Settings → Narrow Gate Fitness → Camera on. Return to the app (note whether iOS restarted it). Repeat the
  four camera steps of DT-CAM-04.
- **Expected outcome:** Every camera feature works without reinstalling. Record whether the app restarted after the
  change.
- **Source:** as DT-CAM-04.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-CAM-05-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-CAM-06 · Photo library: no permission prompt, no "limited" access

- **Preparation:** Some photos in the library, including one HEIC from the iPhone camera.
- **Steps:**
  1. Progress photo → photo library option → pick a photo.
  2. Meal photo → Choose from library → pick a photo.
  3. Body Scan → Upload a photo → pick a photo.
  4. Settings → Narrow Gate Fitness: list the rows shown.
- **Expected outcome:** No photo-library permission prompt and no "Limited Access / Select Photos" choice at any point;
  every picked photo appears as a preview. Settings shows no Photos row. **A crash when opening the library is S1**
  (the app has no photo-library usage text, so iOS would end it if it asked for access).
- **Source:** `Info.plist` (no `NSPhotoLibraryUsageDescription`); file inputs in `progress-photos.tsx`,
  `food-photo-flow.tsx`, `scan-capture.tsx`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-CAM-06-a.png`):
- **Severity if failed:**
- **Retest status:**

---

## 6. Apple Health steps and sleep (DT-HEALTH)

**How it works (from the code).**

- **Steps:** Home → My Progress → Steps card → **Sync Apple Health** asks for read access to Steps, reads daily totals
  for the last 7 days (days in the phone's time zone) and saves each day that has steps (one row per day; a synced day
  replaces a hand entry for that day; days with no steps never overwrite anything). Steps sync **only when you tap the
  button**.
- **Sleep:** Home → My Progress → Sleep & Recovery. After **Allow sleep logging**, the source card reads 14 days of
  sleep plus overnight heart rate, heart-rate variability (SDNN on iPhone) and respiratory rate. It syncs by itself
  when the hub opens or the app returns to the front and the last sync is more than 30 minutes old, on pull-to-refresh,
  and on **Sync now**. There is **no background sync** while the app is closed (not built; `docs/WEARABLES.md` §3).
- HealthKit never tells an app that a read was refused: a refusal looks like "no data".
- The app never writes to Health.

**Preparation for the section:** the main iPhone with Steps in Health for the last 7 days and an Apple Watch (or another
sleep source) with at least two nights in Health. Signed in as A.

#### DT-HEALTH-01 · Steps: first sync and the Health sheet

- **Preparation:** Health access never asked for this install.
- **Steps:**
  1. Home → My Progress → Steps card → **Sync Apple Health**.
  2. Screenshot the Health sheet. Turn on Steps; tap Allow.
  3. Screenshot the card and the message.
- **Expected outcome:** The button shows "Syncing…". The Health sheet asks to **read** Steps only (no write rows) and
  shows the text "Narrow Gate Fitness reads your steps, sleep (time asleep and sleep stages) and overnight heart rate…".
  A toast "Synced N days from Apple Health." (N = days with steps in the last 7). The ring shows today's steps with
  "· Apple Health"; the Last 7 days bars are filled.
- **Source:** `src/lib/native-health.ts` `readRecentSteps`; `src/components/steps/steps-card.tsx` `HealthSync`;
  `src/server/actions/steps.ts` `syncStepsAction`; `Info.plist` `NSHealthShareUsageDescription`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-HEALTH-01-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-HEALTH-02 · Steps match the Health app

- **Preparation:** DT-HEALTH-01 done.
- **Steps:**
  1. Tap Sync Apple Health again. Write down today's number on the card.
  2. In the Health app open Steps → D (day) for today and each of the previous 6 days; write down each total.
  3. Get the app's per-day values from Profile → Download my data (the `daily_steps` rows) on a computer (or DT-EXP-01).
- **Expected outcome:** Today's number equals the Health app's total for today (allow for steps taken since the sync).
  Each `daily_steps` row equals the Health app's daily total for that date, with `source` "apple_health". Days without
  steps have no row.
- **Source:** `native-health.ts` (`queryAggregated`, `bucket: "day"`, `aggregation: "sum"`);
  `src/lib/domain/steps.ts` `stepsByDay`, `syncPayload`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-HEALTH-02-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-HEALTH-03 · A hand entry, then a sync

- **Preparation:** Steps allowed.
- **Steps:**
  1. On the Steps card, enter today's steps by hand (a number clearly different from Health's) and save.
  2. Note the label under the number. Tap Sync Apple Health.
- **Expected outcome:** After saving by hand the label says "Entered by hand". After syncing, today's number is
  Health's and the label says "Apple Health" (a synced day with steps replaces a hand entry, by design).
- **Source:** audit row "Steps from Apple Health / Health Connect" ("A hand entry *is* overwritten by a synced day with
  steps (by design)"); `syncStepsAction` (upsert on `user_id, day`).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-HEALTH-03-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-HEALTH-04 · Steps access turned off

- **Preparation:** Steps synced at least once.
- **Steps:**
  1. In the Health app (profile picture → Apps → Narrow Gate Fitness) turn Steps off. Write down the path you used.
  2. In the app tap Sync Apple Health.
- **Expected outcome:** No sheet appears. Red text: "No steps found — check Health > Sharing > Apps > Narrow Gate and
  turn on Steps." Days synced earlier stay. No crash. If the message's path doesn't match your iOS version's Health app,
  record it (S4).
- **Source:** `native-health.ts` (iOS empty result message).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-HEALTH-04-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-HEALTH-05 · Sleep: consent and when the Health sheet appears

- **Preparation:** Sleep access never asked for this install. Wellness consent not yet given.
- **Steps:**
  1. Home → My Progress → Sleep & Recovery. Screenshot the "Before you start" card.
  2. Tick "I agree to store my sleep and wellness information in my account." → **Allow sleep logging**.
  3. Without tapping anything, wait 5 s. Note whether the Health sheet appears by itself.
  4. If it didn't, tap **Connect Apple Health**. Screenshot the sheet. Don't answer yet (continue in DT-HEALTH-06).
- **Expected outcome:** After consent the card "Connect Apple Health" appears ("Sleep, stages and overnight heart rate,
  HRV and breathing from any watch or ring that writes to Apple Health…"). The code syncs automatically when the hub
  opens with no sync recorded, so **the Health sheet may appear on its own** right after consent, before Connect is
  tapped: record which happened. The sheet asks to read Sleep, Heart Rate, Heart Rate Variability and Respiratory Rate,
  with no write rows.
- **Source:** `src/components/sleep/consent-card.tsx`; `src/components/sleep/source-card.tsx` (auto `sync(true)` when no
  `lastSync`); `src/lib/native-sleep.ts` (`requestAuthorization({ read: ["sleep", …SLEEP_VITAL_TYPES] })`).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-HEALTH-05-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-HEALTH-06 · Sleep allowed, measurements refused

- **Preparation:** The sheet from DT-HEALTH-05 open.
- **Steps:**
  1. Turn on Sleep only; leave Heart Rate, HRV and Respiratory Rate off; Allow.
  2. Screenshot the message and the card. Open last night.
- **Expected outcome:** A message "Apple Health: N added." (iOS can't report the refusal, so no "not allowed" text
  appears). Nights appear; last night's tiles for heart rate, HRV and respiratory rate say "Not recorded"; nothing is
  estimated. The card title becomes "<device> via Apple Health" with "Last synced just now · N new".
- **Source:** `native-sleep.ts` (`vitalsDenied` only on Android); `src/server/actions/sleep-import.ts` (message);
  `src/components/sleep/vitals-cards.tsx`; `IOS_DEVICE_TEST_PLAN.md` 2.3.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-HEALTH-06-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-HEALTH-07 · All four allowed: the nights match the Health app

- **Preparation:** DT-HEALTH-06 done.
- **Steps:**
  1. Health app → Apps → Narrow Gate Fitness → turn on all four. In the app tap **Sync now**.
  2. Open two recent nights. Screenshot the stage bar and the three measurement tiles.
  3. In the Health app open Sleep for the same nights (Show More Sleep Data) and Heart Rate; write down asleep time,
     stage times, heart-rate range.
- **Expected outcome:** The message includes "N gained overnight measurements" for nights imported without them.
  Nights show the stage bar (light, deep, REM, awake; Apple's "Core" is light), "Recorded by <watch name>", heart rate
  "bpm average · min–max", HRV "ms SDNN · N readings", respiratory rate. Stage totals never exceed the time in bed and
  agree with the Health app (rounding aside). A night recorded only by the phone shows no stages.
- **Source:** `src/lib/domain/sleep-import.ts` (`samplesToSessions`, `summarizeVitals`); `docs/WEARABLES.md` §1;
  `docs/SLEEP_DEVICE_CHECKLIST.md` A9, A14.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-HEALTH-07-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-HEALTH-08 · Syncing again adds no duplicates

- **Preparation:** DT-HEALTH-07 done.
- **Steps:** Tap Sync now twice; then pull the hub down; open the sleep history.
- **Expected outcome:** Each sync says "Apple Health: 0 added, N already imported." No night appears twice in history.
- **Source:** `sleep-import.ts` (`source_id` dedupe, unique `(user_id, source, source_id)`); audit row "Sleep import:
  duplicates on re-sync".
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-HEALTH-08-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-HEALTH-09 · A night entered by hand that overlaps an imported one

- **Preparation:** Imported nights exist.
- **Steps:**
  1. Sleep → Manage (settings) → **Delete imported entries** → confirm "Delete imported".
  2. Enter a night by hand that overlaps last night's recorded sleep.
  3. Back on the hub, Sync now.
- **Expected outcome:** The deletion confirmation says "Entries you made yourself stay. Your phone's own health records
  are not touched." After syncing, the message includes "1 skipped (overlap an entry you made)"; the hand entry stays
  as entered (not merged); other nights are imported again.
- **Source:** `sleep-import.ts` (`conflicts` count, overlap check); `src/app/(app)/progress/sleep/settings/page.tsx`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-HEALTH-09-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-HEALTH-10 · Overnight: no background sync; sync on opening

- **Preparation:** Sleep connected; watch worn overnight.
- **Steps:**
  1. In the evening tap Sync now, then force-quit the app.
  2. Sleep wearing the watch.
  3. In the morning check the watch's night is in the Health app, then open the app → Sleep & Recovery without
     tapping anything. Screenshot after 5 s.
  4. Later, leave the app in the background for more than 30 minutes and bring it back on the hub.
- **Expected outcome:** Nothing is imported while the app is closed. Within a couple of seconds of opening the hub,
  last night appears and the card shows "Last synced just now · 1 new". Bringing the app back after more than 30
  minutes syncs again by itself.
- **Source:** `source-card.tsx` (`STALE_MS = 30 min`, `visibilitychange`); `docs/WEARABLES.md` §3 (background sync not
  built); audit row "Background health sync: NOT TESTED".
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-HEALTH-10-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-HEALTH-11 · Health access revoked

- **Preparation:** Sleep and steps imported.
- **Steps:** Health app → Apps → Narrow Gate Fitness → **Turn Off All**. In the app: Sleep hub → Sync now; Steps card →
  Sync Apple Health.
- **Expected outcome:** Sleep: "No sleep found in Apple Health for the last 14 days. Check Health > Sharing > Apps >
  Narrow Gate and turn on Sleep." Steps: "No steps found — check Health > Sharing > Apps > Narrow Gate and turn on
  Steps." Earlier nights and days stay. No crash.
- **Source:** `native-sleep.ts`, `native-health.ts` (iOS empty-result messages); audit row "Sleep: permission denied or
  revoked".
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-HEALTH-11-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-HEALTH-12 · Disconnect, remove imported nights, and nothing written to Health

- **Preparation:** Health access back on; nights imported.
- **Steps:**
  1. Sleep → **Manage** → Connected devices → **Disconnect** → confirm. Go back to the hub; screenshot the card.
  2. Settings page → **Switch import on**; hub → Connect Apple Health (nights come back).
  3. Settings → **Disconnect and remove imported** → confirm.
  4. Health app → Browse → Sleep and Steps → data sources: look for Narrow Gate Fitness as a source of any samples.
- **Expected outcome:** (1) Confirmation "Imports stop and the connection is forgotten. Nights already imported stay
  unless you remove them below."; the nights stay; the card shows "Connect Apple Health" with its button **disabled**
  (import is switched off by Disconnect) and no explanation on the card itself: record whether that is clear (S3 if
  not). (2) Switching import on enables the button again. (3) Imported nights are gone; hand entries stay. (4) Narrow
  Gate Fitness has written no data to Health; the Health app's own records are unchanged.
- **Source:** `sleep-import.ts` `disconnectSleepSourceAction` (`sleep_import_enabled: false`),
  `setSleepImportEnabledAction`; `source-card.tsx` (button `disabled={… !status.importEnabled}`); `docs/WEARABLES.md` §4
  ("The phone's health records are never written or deleted by the app").
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-HEALTH-12-a.png`):
- **Severity if failed:**
- **Retest status:**

---

## 7. Progress-photo capture (DT-PHOTO)

**How it works (from the code).** Home → My Progress → Overview → Progress photos → **Add photo**. The photo is resized
on the phone (longest side at most 1,600 px) and re-encoded as JPEG, which removes EXIF data including location; it is
uploaded to the private `progress-photos` bucket under the member's folder and shown through signed links that last 10
minutes. The note and weight typed in the dialog are kept as a draft on the device until the photo is saved; the image
never is. Adding and viewing photos is free; side-by-side comparison is Pro.

#### DT-PHOTO-01 · Take a photo with the camera and save it

- **Preparation:** Camera allowed. Signed in as A.
- **Steps:**
  1. Add photo → "Take or choose a photo" → camera → take a photo → confirm.
  2. Pose Side; leave the date as today; leave weight blank; type a note. Tap **Save photo**; watch the button.
- **Expected outcome:** The dialog "Add progress photo" says "Only you can see your photos. They're resized on this
  device before upload and location data is removed." The date can't be set after today. The button reads "Preparing…",
  "Uploading…", "Saving…", then the dialog closes and the photo is in the grid with its date and pose. A blank weight
  takes that day's logged bodyweight, if any.
- **Source:** `src/components/progress/progress-photos.tsx` (`UploadDialog`, `STAGE_LABEL`);
  `src/server/actions/progress-photos.ts` `saveProgressPhotoAction`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-PHOTO-01-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-PHOTO-02 · Retake before saving; close without saving

- **Preparation:** Camera allowed.
- **Steps:**
  1. Add photo → take a photo → tap the preview ("Tap to change") → take a different one.
  2. Type a weight and a note. Close the dialog without saving. Reopen Add photo.
- **Expected outcome:** (1) The preview changes to the new photo. (2) After reopening, the note and weight are still
  filled in (device draft); no photo is selected; nothing was uploaded and the grid is unchanged.
- **Source:** `progress-photos.tsx` (`useDraft("progress.photo")`, `reset`); `docs/DATA.md` §2 (`progress.photo`:
  "note + weight, not the image").
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-PHOTO-02-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-PHOTO-03 · From the photo library (HEIC and PNG)

- **Preparation:** A HEIC photo from the iPhone camera and a PNG screenshot in the library.
- **Steps:** Add photo → photo library → pick the HEIC → Save photo. Repeat with the PNG.
- **Expected outcome:** Both save and appear in the grid. If the HEIC gives "Couldn't read that image. Try a JPEG or
  PNG photo.", record it (S2: it's the iPhone's default photo format; the dialog says "JPEG, PNG or WebP").
- **Source:** `src/lib/image-compress.ts` (`createImageBitmap`, fallback `<img>`); `progress-photos.tsx` errors.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-PHOTO-03-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-PHOTO-04 · The stored copy is resized and has no location

- **Preparation:** A library photo that has a location (Photos → swipe up on it shows a map) and is larger than
  1,600 px.
- **Steps:**
  1. Save it as a progress photo.
  2. On a computer sign in to the website as A → Profile → Download my data. Within an hour open the link for that
     photo in `progress_photo_files` and download the image.
  3. Check its pixel size and metadata (for example with the computer's file info or `exiftool`).
- **Expected outcome:** A JPEG whose longest side is at most 1,600 px, with no GPS location and no camera EXIF data.
- **Source:** `image-compress.ts` (canvas re-encode "also strips EXIF metadata (including GPS location)");
  `src/lib/domain/progress-photos.ts` (`PHOTO_MAX_DIMENSION = 1600`); `src/server/services/account.ts` (export links,
  1 hour).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-PHOTO-04-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-PHOTO-05 · Only the owner sees the photos

- **Preparation:** A has at least one photo. Account B exists.
- **Steps:**
  1. Sign out; sign in as B → My Progress → Overview → Progress photos.
  2. Sign out; sign in as A → Overview. Leave the screen open and lock the phone for 15 minutes.
  3. Unlock and open a photo without leaving the screen first. Then leave the screen and come back.
- **Expected outcome:** (1) B sees "No photos yet" and nothing of A's. (2) A sees their photos with "Only you can see
  your photos." (3) The image links last 10 minutes, so after 15 minutes an image may not load until the screen is
  opened again: record what happens; coming back to the screen shows the images; no crash.
- **Source:** `src/server/services/progress-photos.ts` (`PHOTO_URL_TTL_SECONDS = 600`); `docs/DATA.md` (owner-only RLS,
  private bucket).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-PHOTO-05-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-PHOTO-06 · Delete a photo

- **Preparation:** A photo saved in DT-PHOTO-01.
- **Steps:** Open a photo → **Delete photo** → read the dialog → **Delete**. Then export (DT-EXP-03).
- **Expected outcome:** Dialog "Delete this photo?" / "It will be permanently removed. This can't be undone." After
  Delete, the viewer closes and the photo is gone from the grid; the export no longer lists it. Owner: the file is gone
  from the `progress-photos` bucket.
- **Source:** `progress-photos.ts` (server) `deleteProgressPhotoAction` (removes the file first, then the row);
  `progress-photos.tsx` `ViewerDialog`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-PHOTO-06-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-PHOTO-07 · Saving with no network

- **Preparation:** Overview open; then airplane mode on.
- **Steps:** Add photo → pick a photo → Save photo. Read the message. Turn airplane mode off and tap Save photo again
  in the same dialog.
- **Expected outcome:** Offline: "Upload failed. Check your connection and try again." (or "You appear to be offline.
  Please try again." if it failed at the last step); nothing is added. Online: one save, exactly one new photo in the
  grid.
- **Source:** `progress-photos.tsx` `submit`; `saveProgressPhotoAction` (a repeated save of the same upload is kept once).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-PHOTO-07-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-PHOTO-08 · Comparison on Pro, locked on Free

- **Preparation:** At least two photos. One account on Pro, one on Free.
- **Steps:** On Pro tap **Compare**, select two photos, Compare. On Free look at the same place.
- **Expected outcome:** Pro: "Select two photos to compare (n/2)", then a side-by-side view. Free: a "Compare with Pro"
  button leading to Plans & billing; adding and viewing photos still works.
- **Source:** `progress-photos.tsx` (`canCompare`); `src/lib/domain/plans.ts`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-PHOTO-08-a.png`):
- **Severity if failed:**
- **Retest status:**

---

## 8. Offline workout persistence (DT-OFF)

**How it works (from the code).** Only the workout logger works offline. Every change is saved on the device at once
(`ngf.workout.draft.<user id>`) and sent to the server 2 s later; the header shows **Synced**, **Saving** or **Saved on
device**. A failed send is retried after 5 s, 15 s, 45 s… (at most every 2 minutes), and at once when the phone says it
is online again. The app itself is a web view on the deployed site: opening it with no network shows the **"You're
offline"** page from the app bundle, whose **Try again** goes back to the site (audit D2). Pages not already open need
the network.

#### DT-OFF-01 · Log sets with no network

- **Preparation:** Online. Signed in as A.
- **Steps:**
  1. Train → Empty workout → add two exercises → complete one set. Wait for "Synced".
  2. Turn on airplane mode (and make sure Wi-Fi is off).
  3. Complete three more sets, change a weight, type a workout note.
- **Expected outcome:** The notice "You're offline. Keep logging — everything is saved on this device and will sync
  when you reconnect." and the header "Saved on device". Every change stays on screen; the rest timer still works;
  nothing blocks logging.
- **Source:** `src/components/workout/workout-logger.tsx` (`pushToServer`, offline `Notice`, sync labels);
  `src/lib/workout-storage.ts`; `docs/DATA.md` §3.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-OFF-01-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-OFF-02 · Force-quit with no network and reopen with no network

- **Preparation:** DT-OFF-01, still in airplane mode.
- **Steps:** Force-quit the app. Reopen it. Screenshot. Tap **Try again** (still offline).
- **Expected outcome:** After the splash: "You're offline" with "Narrow Gate Fitness needs an internet connection. If
  you were logging a workout, it's saved on this device — reopen the workout when you're back online and it will sync."
  and **Try again**. Try again while still offline shows the same page again; no blank screen, no crash.
- **Source:** `native-shell/error.html`; `capacitor.config.ts` (`server.errorPath`); audit D2.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-OFF-02-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-OFF-03 · Reconnect and resume

- **Preparation:** DT-OFF-02.
- **Steps:** Turn airplane mode off. Tap **Try again**. Open the workout (Resume workout). Watch the header for 10 s.
- **Expected outcome:** The app loads without a force-quit (D2 fix). No opening animation (workout in progress). Home
  shows **Resume workout** and the **"Resume: <name>"** pill. The logger shows every set, weight and note from
  DT-OFF-01. The header goes "Saving" → "Synced" within a few seconds. The elapsed time includes the time offline.
- **Source:** audit D2 and §5C "Offline"; `workout-logger.tsx` (restore on mount: newer of device and server copies;
  re-sync on `online`); `src/lib/opening.ts`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-OFF-03-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-OFF-04 · The offline sets reached the account

- **Preparation:** DT-OFF-03 shows "Synced".
- **Steps:** On the computer, sign in to the website as A → Home → Resume workout. Look at the sets. Close the page
  without changing anything.
- **Expected outcome:** The website offers Resume workout for the same workout, and its logger shows the sets logged
  offline on the phone (restored from the server copy).
- **Source:** `src/server/services/workouts.ts` `saveDraftSnapshot`, `getServerDraft`; `today-workout-action.tsx`
  (`serverInProgress`).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-OFF-04-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-OFF-05 · Finish offline, then online: saved exactly once

- **Preparation:** The workout from DT-OFF-03 open on the phone.
- **Steps:**
  1. Airplane mode on. Finish → **Finish & save**. Read the message.
  2. Airplane mode off. Tap **Finish & save** twice quickly.
  3. Open the workout history.
- **Expected outcome:** (1) "You appear to be offline. Your workout is saved on this device — try again when you're
  connected."; the logger stays. (2) One save: the "Workout complete" summary (Duration, volume, any records). (3) The
  history has exactly one copy of this workout with every set. The Resume pill is gone.
- **Source:** `src/lib/domain/workout-draft.ts` `finishFailureMessage`; `workout-logger.tsx` (`saving` disables the
  button); `src/server/services/workouts.ts` `finishWorkout` (an already completed client id is returned, not
  duplicated).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-OFF-05-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-OFF-06 · Wi-Fi with no internet behind it

- **Preparation:** A Wi-Fi network that connects but has no internet (a phone hotspot with mobile data off, or a router
  with its internet cable unplugged). Mobile data off.
- **Steps:**
  1. Start a workout online; then join that Wi-Fi.
  2. Complete three sets over 2 minutes. Watch the header.
  3. Restore the internet. Note how long until "Synced" without touching anything; then complete one more set.
- **Expected outcome:** The header shows "Saved on device"; the offline notice may not appear (the phone still reports
  a connection). Nothing is lost. After the internet returns, "Synced" appears at the next retry (at most about 2
  minutes) or right after the next change. Record the times.
- **Source:** `workout-logger.tsx` `pushToServer` (back-off 5 s × 3, max 120 s; "gym Wi-Fi with no internet behind it").
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-OFF-06-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-OFF-07 · A workout left for 6 hours or more

- **Preparation:** Start a workout and complete two sets. Leave it unfinished for at least 6 hours (don't change the
  phone's clock).
- **Steps:** Open the app → Resume workout. Read the screen. Tap **Resume <name>**.
- **Expected outcome:** "Unfinished workout": "You have an unfinished workout, <name> (last used N hours ago, 2 sets
  logged). Carry on with it, or discard it and start fresh?" with **Resume <name>** and **Discard & start new**. Resume
  keeps the sets; the hours away are not counted as training time (added as paused time).
- **Source:** `workout-logger.tsx` (conflict screen); `workout-draft.ts` (`STALE_DRAFT_HOURS = 6`, `continueAfterGap`).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-OFF-07-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-OFF-08 · A finished run whose save failed offline

- **Preparation:** A with Pro, outdoors.
- **Steps:**
  1. Record a 3-minute walk. Finish → Finish.
  2. Airplane mode on. Tap **Save walk**. Read the message.
  3. Force-quit. Reopen (offline page). Airplane mode off → Try again.
  4. Run → Outdoor walk. Tap **Review and save** → Save walk.
- **Expected outcome:** (2) "You're offline. Your recording is kept on this device: save it when you're back online."
  (3) The opening plays on this relaunch (a finished recording doesn't count as in progress). (4) The record page shows
  "Your walk from <time> wasn't saved yet." / "It is still on this device: review and save it, or discard it." with
  **Review and save** and **Discard it**. Review and save reopens the review with the same distance, without turning
  location on. Saving gives "Walk saved."; the walk is saved once.
- **Source:** audit D1 (`689ea4a`) and §5C "Unsaved run"; `gps-recorder.tsx` (`isRecoverable`, `continueRecording`,
  save error messages); `src/server/actions/gps-activities.ts` (same id saved once: "Already saved.").
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-OFF-08-a.png`):
- **Severity if failed:**
- **Retest status:**

---

## 9. Airplane-mode workout discard and reconnection (DT-DISC)

**How it works (from the code).** Discarding while offline removes the workout from the phone and records on the
phone that it was discarded (`ngf.workout.discarded.<user id>`, the last 20). The server's in-progress copy is deleted
once the phone is online again: any app screen retries when it opens and when the phone reconnects, then refreshes. The
logger never restores a workout discarded on this phone. Until the phone reconnects, the server copy still exists, so
another device can still see it.

#### DT-DISC-01 · Discard a synced workout while offline, then reconnect

- **Preparation:** Online. Start an Empty workout, complete three sets, wait for "Synced".
- **Steps:**
  1. Airplane mode on. Tap **Discard workout**; read the dialog; tap **Discard**. Screenshot where you land.
  2. Airplane mode off. If the offline page shows, tap Try again. Watch Home for 10 s.
  3. Train → Empty workout. Then open the workout history.
- **Expected outcome:** (1) Dialog "Discard this workout?" / "Everything logged in this session will be deleted. This
  can't be undone." Discard is accepted offline (no "Couldn't discard on the server" error, because the phone is
  offline). The app then goes to Train, which needs the network: expect the "You're offline" page or Train (record
  which). (2) Home may show Resume workout for a moment, then refreshes without it; no pill. (3) A fresh workout opens,
  not the discarded one; the history doesn't contain it.
- **Source:** `workout-logger.tsx` (discard dialog: `rememberDiscard`, `clearLocalDraft`, `router.push("/train")`);
  `src/lib/workout-storage.ts` (`retryPendingDiscards`); `src/components/shell/active-workout-pill.tsx`;
  `workout-draft.ts` `restorableDraft`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-DISC-01-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-DISC-02 · Another device before and after the phone reconnects

- **Preparation:** As DT-DISC-01 step 1 (discarded offline; the phone stays offline). The computer signed in as A.
- **Steps:**
  1. On the computer open Home. Screenshot. Don't resume the workout there.
  2. Turn the phone's airplane mode off; open any app screen; wait 10 s.
  3. Reload Home on the computer.
- **Expected outcome:** (1) The computer still offers **Resume workout** (the server copy is removed only when the
  phone is back online; this is the design). (3) After the phone reconnects, the computer no longer offers it.
- **Source:** `src/lib/workout-storage.ts` (comment on `discardKey`: "the server still has the in-progress snapshot");
  `active-workout-pill.tsx`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-DISC-02-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-DISC-03 · "Discard & start new" while offline

- **Preparation:** A has an active program. Online: start an Empty workout and complete one set (synced). Then go to
  Train and tap Start on today's program session, so the logger shows "Workout in progress … Resume it, or discard it
  and start <session>?".
- **Steps:**
  1. Airplane mode on. Tap **Discard & start new**; read the dialog; confirm **Discard**.
  2. Log one set in the new session offline. Airplane mode off; wait for "Synced".
  3. Go Home; check Resume workout points to the new session; open the history after finishing the new session.
- **Expected outcome:** Dialog "Discard <name>?" / "The unfinished workout and the sets you logged in it are deleted.
  This can't be undone." The program session opens offline. After reconnecting only the new session is offered and
  synced; the discarded workout never comes back and isn't in history.
- **Source:** `workout-logger.tsx` (conflict screen discard: `rememberDiscard`); `restorableDraft`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-DISC-03-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-DISC-04 · Discard offline, force-quit, reconnect later

- **Preparation:** As DT-DISC-01 step 1 (discarded while offline).
- **Steps:**
  1. Still offline, force-quit the app.
  2. An hour later (or at least a few minutes), turn airplane mode off and open the app.
  3. Watch Home for 10 s; open Train → Empty workout.
- **Expected outcome:** The discard is remembered across the restart: no pill; Home may show Resume workout briefly,
  then not; the logger opens a fresh workout. The opening plays on this launch (no workout copy left on the device).
- **Source:** `src/lib/workout-storage.ts` (discards kept in local storage); `active-workout-pill.tsx` (retry on
  mount); `src/lib/opening.ts`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-DISC-04-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-DISC-05 · Discard a GPS recording while offline

- **Preparation:** A with Pro, outdoors.
- **Steps:**
  1. Record a 2-minute walk. Airplane mode on.
  2. Pause → trash button → read the dialog → **Discard**.
  3. Force-quit. Airplane mode off. Reopen → Run → Outdoor walk. Check Run history.
- **Expected outcome:** Dialog "Discard this walk?" / "The recording is deleted from this device and nothing is
  saved." Nothing is offered on reopening; nothing in Run history (a recording reaches the server only on Save).
- **Source:** `gps-recorder.tsx` `discard`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-DISC-05-a.png`):
- **Severity if failed:**
- **Retest status:**

---

## 10. App force-quit and relaunch (DT-QUIT)

**How it works (`docs/OPENING.md`, `src/lib/opening.ts`, `src/lib/supabase/middleware.ts`).** A black splash with the
gold mark (about 1.5 s), then the opening: a narrow arched door opens, light pours out, Matthew 7:13–14 (BSB) and
**Enter Narrow Gate** appear below the doorway, **Skip intro** at the top right; it ends by itself at about 5 s (at
most 5.6 s). It has no sound. It plays **once per launch** (every relaunch after a force-quit) and leads to:

| Who | Where the launch ends |
|---|---|
| New on this device | Welcome page (Start free / Sign in) |
| Signed in here before, signed out now | Sign in |
| Signed in | Home (onboarding first if it isn't finished) |

It never replays on in-app navigation or on returning from the background. It does **not** play when a workout or an
unfinished GPS recording (less than 12 hours old) is on the device. If the app goes to the background for more than a
second during the opening, it fades out on return.

#### DT-QUIT-01 · First launch after installing

- **Preparation:** App deleted; installed fresh from TestFlight. Screen recording on.
- **Steps:** Open the app and leave it alone until the opening ends.
- **Expected outcome:** Splash, then the opening as described, then the welcome page with "Narrow Gate Fitness",
  Matthew 7:13–14 and **Start free** / **Sign in**. The welcome page draws no second gate. No sound.
- **Source:** `docs/OPENING.md` ("What you see", "One gate", "Where a launch goes"); `capacitor.config.ts`
  (`SplashScreen.launchShowDuration: 1500`); `IOS_DEVICE_TEST_PLAN.md` 1.1.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-QUIT-01-a.mov`):
- **Severity if failed:**
- **Retest status:**

#### DT-QUIT-02 · Signed in: relaunch, tabs and returning from the background

- **Preparation:** A signed in, onboarding finished, no workout or recording in progress.
- **Steps:**
  1. Force-quit; reopen; let the opening end.
  2. Switch through Home, Train, Run, Food and Faith; open a few screens.
  3. Swipe to the Home Screen, wait 10 s, return through the app switcher.
  4. Force-quit and reopen once more; tap **Enter Narrow Gate** as soon as it appears, several times quickly.
- **Expected outcome:** (1) The opening plays once and ends on Home. (2) It never replays on tab switches or links.
  (3) Returning from the background doesn't replay it; the screen is where you left it. (4) Enter moves through the
  doorway into the light once (repeated taps do nothing more), then Home.
- **Source:** `docs/OPENING.md` ("When it plays", Enter rules); `IOS_DEVICE_TEST_PLAN.md` 1.2, 1.3.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-QUIT-02-a.mov`):
- **Severity if failed:**
- **Retest status:**

#### DT-QUIT-03 · Signed out on a phone that was signed in before

- **Preparation:** A signed in on this install.
- **Steps:** Profile → **Sign out**. Force-quit. Reopen. After the opening, pull to reload or go to another screen and
  back to Sign in.
- **Expected outcome:** The opening plays once over the **Sign in** page (not the welcome page). It doesn't play again
  when the Sign in page is reloaded or reached again.
- **Source:** `src/lib/supabase/middleware.ts` (`ngf_member` cookie → `/login`; launch mark `ngf_gate` used once).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-QUIT-03-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-QUIT-04 · Onboarding not finished

- **Preparation:** A new account (for example B before it finishes onboarding): sign up, confirm the e-mail in Safari,
  sign in in the app, answer the first onboarding question only.
- **Steps:** Force-quit. Reopen.
- **Expected outcome:** The opening plays once and ends on onboarding.
- **Source:** `docs/OPENING.md` table (signed in → Home → onboarding by the `(app)` layout).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-QUIT-04-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-QUIT-05 · Interrupting the opening

- **Preparation:** Signed in; nothing in progress. Someone who can send you a message.
- **Steps:**
  1. Reopen after a force-quit; force-quit again about 2 s into the opening; reopen.
  2. About 1 s into the opening, swipe to the Home Screen, wait 3 s, return.
  3. Have a message banner arrive during the opening (don't touch it).
- **Expected outcome:** (1) The opening plays from the start. (2) On return it fades out at once and the destination
  shows; it doesn't resume or stall. (3) A short interruption like a banner leaves it running.
- **Source:** `docs/OPENING.md` ("Leaving the app"); `src/lib/opening.ts` (`OPENING_AWAY_MS = 1000`).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-QUIT-05-a.mov`):
- **Severity if failed:**
- **Retest status:**

#### DT-QUIT-06 · Force-quit in the middle of a workout

- **Preparation:** A workout with three completed sets.
- **Steps:** Force-quit. Wait 1 minute. Reopen. Open the workout.
- **Expected outcome:** Splash, then **no opening**; Home with Resume workout and the "Resume: <name>" pill; the logger
  restores the three sets; the elapsed time includes the minute away.
- **Source:** `src/lib/opening.ts` (`activityInProgress`: any `ngf.workout.draft.` key); `workout-logger.tsx`;
  `docs/OPENING.md`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-QUIT-06-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-QUIT-07 · Force-quit in the middle of a run

- **Preparation:** A with Pro, outdoors, recording a walk or run for 3 minutes.
- **Steps:**
  1. Force-quit. Keep moving for 2 minutes. Check the status bar for the blue indicator.
  2. Reopen. Run → Outdoor run. Read the notice. Tap **Continue recording**.
  3. Move 1 minute; Finish → review.
- **Expected outcome:** Location stops when the app is force-quit (no blue indicator). On reopening: no opening; Home.
  The record page shows "You have an unfinished run from <time>." / "Continue it, or discard it. Any time the app was
  closed is kept as a gap: no distance is guessed for it." with **Continue recording** and **Discard it**. After
  Continue: location restarts; Time and Moving include the time the app was closed; the 2 minutes moved while closed
  add no distance; the line breaks; the review says "The signal dropped 1 time; no distance was added…".
- **Source:** `gps-track.ts` `recoverTrack` (gap counted, time away kept unless paused); `gps-recorder.tsx` recovery
  notice; `src/lib/opening.ts` (`GPS_RESUMABLE_MS = 12 h`); `IOS_DEVICE_TEST_PLAN.md` 3.9.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-QUIT-07-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-QUIT-08 · Relaunch with Reduce Motion on

- **Preparation:** Nothing in progress.
- **Steps:** Settings → Accessibility → Motion → **Reduce Motion** on. Force-quit; reopen. Then turn it off again.
- **Expected outcome:** The opening still appears but nothing moves: the scene and the words fade in with the door
  already open and fade out, without the move into the light.
- **Source:** `docs/OPENING.md` (Reduce Motion); `IOS_DEVICE_TEST_PLAN.md` 1.7.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-QUIT-08-a.mov`):
- **Severity if failed:**
- **Retest status:**

---

## 11. Login session persistence (DT-SESS)

**How it works.** The sign-in session lives in the web view's cookies and is checked against Supabase Auth on every
full page load (`getUser()` in the middleware), which also renews it. Local configuration sets a 1-hour access token
with refresh-token rotation (`supabase/config.toml`); the hosted project's own settings apply on the test deployment
and aren't in the repository. The app never signs a member out by itself.

#### DT-SESS-01 · Relaunch keeps the session

- **Preparation:** None.
- **Steps:** Sign in as A. Force-quit. Reopen.
- **Expected outcome:** After the opening, Home, still signed in.
- **Source:** `IOS_DEVICE_TEST_PLAN.md` 1.5; `src/lib/supabase/middleware.ts`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SESS-01-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-SESS-02 · Days later, after restarting the phone

- **Preparation:** None.
- **Steps:** Sign in as A. Don't open the app for at least 3 days (write down the hours). Restart the phone once in
  between. Open the app.
- **Expected outcome:** Still signed in; Home. If the Sign in page appears instead, record after how long; the hosted
  project's session limits are not in the repository (local config has no session time-box).
- **Source:** `supabase/config.toml` (`[auth.sessions]` commented out, `enable_refresh_token_rotation = true`).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SESS-02-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-SESS-03 · Offline for longer than the access token

- **Preparation:** None.
- **Steps:** Sign in as A; put the app in the background; airplane mode on for 70 minutes; airplane mode off; bring
  the app back and move between three tabs; save something small (a water entry or a weight).
- **Expected outcome:** Still signed in; pages load; the save works; no Sign in page.
- **Source:** `supabase/config.toml` (`jwt_expiry = 3600`); middleware session refresh.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SESS-03-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-SESS-04 · Password changed on another device

- **Preparation:** A signed in on the phone, with an unfinished workout (two sets) on the phone.
- **Steps:**
  1. On the computer, sign in to the website as A → Profile → **Change password** → follow the e-mail → set a new
     password.
  2. On the phone, without relaunching, move between tabs and complete a set. Then force-quit and reopen.
  3. If you are asked to sign in: try the old password, then the new one. Open the workout.
- **Expected outcome:** **Not determined by the code:** the app does not sign out other sessions when the password
  changes (`updatePasswordAction`), and whether Supabase ends the phone's session is a hosted-project behaviour. Record
  whether the phone stayed signed in. If it was signed out: the next screen goes to Sign in (`/login?next=…`), the old
  password is refused, the new one works, and the unfinished workout is still offered (it is kept on the device). A
  finish attempted while signed out says "We couldn't reach your account, so the workout isn't saved yet. It's kept on
  this device. If you were signed out, sign in again and finish it from Resume."
- **Source:** `src/server/actions/auth.ts` `updatePasswordAction`; `src/app/(app)/profile/page.tsx` (Change password →
  `/forgot-password`); `workout-draft.ts` `finishFailureMessage`; audit row "Expired session".
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SESS-04-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-SESS-05 · Sign out, then relaunch

- **Preparation:** A signed in.
- **Steps:** Profile → **Sign out**. Try to get back to a signed-in screen (a back swipe or back link, if the app
  offers one). Force-quit; reopen.
- **Expected outcome:** Sign out lands on Sign in. Back doesn't show a signed-in screen with data (any protected screen
  sends you to Sign in). Relaunch: the opening over Sign in (see DT-QUIT-03).
- **Source:** `src/server/actions/auth.ts` `signOutAction`; middleware (`PROTECTED_PREFIXES`).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SESS-05-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-SESS-06 · Reinstall

- **Preparation:** None.
- **Steps:** With A signed in, delete the app. Reinstall from TestFlight. Open it.
- **Expected outcome:** Signed out; the opening ends on the **welcome page** (the cookies and the "signed in here
  before" mark went with the app's data). Record if Sign in or Home appears instead.
- **Source:** `src/lib/supabase/middleware.ts` (`RETURNING_COOKIE`); `docs/OPENING.md`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SESS-06-a.png`):
- **Severity if failed:**
- **Retest status:**

---

## 12. Account switching (DT-SWITCH)

**What sign-out does (from the code).** Profile → **Sign out** clears this member's form drafts (`ngf.draft.<id>.*`)
and any GPS recording (`run.recording.<id>`) from the phone, detaches the phone from the member's App Store purchase
identity (RevenueCat log-out), and the Sign in page clears again in case the recorder wrote once more.

Kept or not per member, also from the code (record what you see; the owner decides which are acceptable):

- The in-progress **workout copy** (`ngf.workout.draft.<id>`) is kept on purpose: it is keyed by member, so another
  member can't load it, and the member gets it back on signing in again (`docs/DATA.md`).
- **Reminders** (Faith, workouts, food, recovery) are account settings since 2026-11-03. Signing out removes every
  notification this app scheduled on the phone (reminders, the sleep alarm, a rest timer); the next member's own
  reminders are scheduled when they sign in (`docs/NOTIFICATIONS.md`, DT-NOTIF).
- A **rest notification** already scheduled is cancelled with everything else the app scheduled (DT-REST-11).
- **Navigation memory** for the app session (`ngf.nav.*`, `ngf.scroll.*`, and dialog state `ngf.ui.*` such as the Add
  food search text) is not cleared on sign-out; it goes when the app is closed.

#### DT-SWITCH-01 · A signs out with unsaved data and activities in progress

- **Preparation:** A with Pro, outdoors for step 6.
- **Steps:** As A:
  1. AI Coach: type a message; don't send.
  2. Faith → prayer journal → new entry: type text; don't save.
  3. Food → Add food → Manual: type a food name; close. Search tab: type "oats".
  4. Progress photos → Add photo: type a note; close.
  5. Start an Empty workout and complete two sets (leave it unfinished).
  6. Run → Outdoor walk → Start walk; wait for Recording; go straight to Profile → **Sign out**.
- **Expected outcome:** Sign out lands on Sign in. Location stops (the recorder left the screen; no blue indicator).
- **Source:** `src/components/shell/sign-out-form.tsx`; `src/lib/drafts.ts` `clearAllDrafts`;
  `src/components/platform/device-cleanup.tsx`; `gps-recorder.tsx` (`stopWatching` on unmount).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SWITCH-01-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-SWITCH-02 · B signs in straight away: nothing of A's is visible

- **Preparation:** DT-SWITCH-01, without force-quitting.
- **Steps:** Sign in as B. Check each place from DT-SWITCH-01 and also: Home (Resume workout, pill), Train → Empty
  workout, Run → Outdoor walk, My Progress (photos, steps, sleep), AI Coach conversations, Profile name and e-mail,
  Plans & billing. Tap each bottom tab once.
- **Expected outcome:** Every form is empty; no Resume workout or pill; Run offers no unfinished walk; photos, steps,
  sleep, conversations and profile are B's only; Plans & billing shows B's plan. **Known from the code:** in the same
  app session the Add food dialog may still show A's search text ("oats") and a tab may reopen A's last screen
  (possibly as "not found"), because session navigation memory isn't cleared on sign-out. Record exactly what appears.
  Any of A's personal content shown to B is a Fail.
- **Source:** `src/lib/drafts.ts` (drafts per member); `src/lib/workout-storage.ts` (workout copy per member);
  `src/lib/nav-memory.ts` (sessionStorage, no sign-out clearing); `docs/DATA.md` §2; `IOS_DEVICE_TEST_PLAN.md` 3.11.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SWITCH-02-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-SWITCH-03 · The same check after a relaunch

- **Preparation:** DT-SWITCH-02 done; B signed in.
- **Steps:** Force-quit; reopen (note whether the opening plays); repeat the checks of DT-SWITCH-02.
- **Expected outcome:** As DT-SWITCH-02, and the session navigation memory is gone (no "oats"). **From the code:** the
  opening does **not** play while A's in-progress workout copy is on the phone (the opening checks every member's
  workout copy): record whether it played.
- **Source:** `src/lib/opening.ts` `activityInProgress` (`WORKOUT_DRAFT_PREFIX` for any user id).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SWITCH-03-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-SWITCH-04 · Reminders and notifications that belong to the phone, not the account

- **Preparation:** A signed in; notifications allowed.
- **Steps:**
  1. As A: Profile → Notifications: Scheduled workouts on, 3 minutes ahead; Bible reading 4 minutes ahead. Save.
  2. Sign out; sign in as B (no relaunch). Open Profile → Notifications. Wait past both reminder times.
  3. As A set a reminder 3 minutes ahead; let the session expire or switch accounts without signing out if possible;
     open the app as B; wait.
- **Expected outcome (from the code, updated 2026-11-03):** (2) B's screen shows B's own settings (all off) and
  neither of A's reminders fires: signing out removed everything this app had scheduled. (3) When the app opens as
  B it sees a different account than the one the phone's reminders belong to, removes A's and schedules B's.
- **Source:** `src/lib/native-notifications.ts` (`clearDeviceNotifications`, the owner check in `syncReminders`);
  `src/components/shell/sign-out-form.tsx`; `src/components/notifications/notification-sync.tsx`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SWITCH-04-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-SWITCH-05 · A signs back in

- **Preparation:** DT-SWITCH-01 to 03 done.
- **Steps:** Sign out B; sign in as A. Check the workout, the four forms from DT-SWITCH-01, and Run → Outdoor walk.
- **Expected outcome:** A's unfinished workout is offered again (Resume) with its two sets. A's form drafts are gone
  (cleared at sign-out). The GPS walk is gone (no "unfinished walk" offer).
- **Source:** `sign-out-form.tsx`; `src/lib/drafts.ts` `clearAllDrafts` (drafts and `run.recording.`, not the workout
  copy); `docs/DATA.md` §2.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SWITCH-05-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-SWITCH-06 · The App Store purchase identity follows the account

- **Preparation:** A has Pro from an App Store sandbox purchase (DT-IAP-02).
- **Steps:** Sign out A; sign in as B → Profile → Plans & billing. **Don't tap Restore purchases.**
- **Expected outcome:** B's current membership is B's own (Free) and the screen offers B the purchase; A's subscription
  is not shown as B's. (Restore here would move the purchase to B; that is DT-IAP-10.)
- **Source:** `src/lib/billing/store-purchases.ts` (`storeLogOut`, `connectStore` logs in with the member id);
  `docs/MOBILE_BILLING.md` ("The member's RevenueCat id is their account id").
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-SWITCH-06-a.png`):
- **Severity if failed:**
- **Retest status:**

---

## 13. Subscription purchase and restoration (DT-IAP)

> **Do not use a real card.** TestFlight purchases are Apple sandbox purchases and are free (`docs/TESTFLIGHT.md`
> §1). A development build uses a Sandbox Apple Account. On the website use Stripe test mode and test card numbers
> only. If a purchase sheet doesn't say it is a sandbox or TestFlight purchase, cancel it and stop.

**Before this section:** sandbox purchases only unlock Pro for allow-listed testers or when the server's sandbox
setting is on (see `docs/MOBILE_BILLING.md`, "Sandbox purchases"); record which applies in "Build to test". To
allow-list the test account: an administrator opens admin → Subscriptions → **Sandbox testers**, enters the account's
email, a note ("TestFlight: <tester>") and optionally an end date, and taps **Add tester**. A second, unlisted account
is useful for the negative check: its sandbox purchase must leave it on Free. The owner must have created the
App Store products (`ngf_pro_monthly`, `ngf_pro_yearly`), the RevenueCat project, offering and webhook, and the build
must include the In-App Purchase capability (`docs/MOBILE_BILLING.md`, "Owner setup"). If any is missing, mark the
section Blocked.

**How it works.** Profile → **Plans & billing** shows the App Store's prices through RevenueCat. After a purchase or a
restore the server asks RevenueCat what the member owns; the app never decides. Renewals, cancellations, expiry and
refunds reach the server by webhook. Sandbox periods are accelerated by Apple; record the real times you see.

#### DT-IAP-01 · The Plans & billing screen

- **Preparation:** A on Free.
- **Steps:** Profile → Plans & billing. Switch between monthly and yearly. Screenshot everything down to "How to cancel".
- **Expected outcome:** "Loading App Store prices…" briefly, then Free and Pro All Access with the App Store's localized
  monthly and yearly prices (yearly only if the store returns `ngf_pro_yearly`; never a price the store didn't
  return); the renewal terms "Payment is charged to your Apple Account when you confirm. Pro All Access renews
  automatically… Deleting the app or your Narrow Gate account does not cancel it. Refunds are handled by Apple.";
  Terms of Service · Privacy Policy links (with "(drafts awaiting legal review)" until the final documents are set);
  **Restore purchases**. No website checkout anywhere in the app. If the store can't be reached: "In-app purchases
  aren't available right now. Please update the app or try again later. Your current membership works everywhere you
  sign in."
- **Source:** `src/components/profile/store-paywall.tsx`; `src/lib/billing/paywall.ts` `renewalTerms`;
  `src/app/(app)/profile/billing/page.tsx`; `IOS_DEVICE_TEST_PLAN.md` 6.1.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-IAP-01-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-IAP-02 · Buy Pro All Access monthly

- **Preparation:** A on Free; sandbox purchases counted for this tester (see above).
- **Steps:** Choose monthly → subscribe → screenshot the Apple sheet → confirm. Then open Run → Outdoor run, My
  Progress → Body Scan, and the program library.
- **Expected outcome:** The Apple sheet marks the purchase as sandbox / TestFlight. After confirming: "Welcome to Pro
  All Access. Thank you!"; Current membership "Pro All Access" with "Billed through the App Store · Monthly · Renews
  <date>"; Profile shows "Current plan: Pro All Access". Pro features open at once (Start run available, Body Scan,
  full program library).
- **Source:** `store-paywall.tsx` `buy`; `src/server/actions/store-billing.ts` `syncStorePurchasesAction`;
  `billing/page.tsx` (`channel`, plan detail); `docs/MOBILE_BILLING.md` sandbox plan step 2.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-IAP-02-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-IAP-03 · A sandbox purchase that isn't counted

- **Preparation:** Only if the owner can give a tester or a deployment for which sandbox purchases are not counted
  (see above). Otherwise mark Blocked.
- **Steps:** As DT-IAP-02. Pull down to refresh after a minute.
- **Expected outcome:** "Purchase received. Your membership will update in a moment. Pull down to refresh if it
  hasn't."; the plan stays Free after refreshing.
- **Source:** `store-paywall.tsx` (`res.plan !== "pro"`); `docs/MOBILE_BILLING.md` (owner setup step 4).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-IAP-03-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-IAP-04 · Cancel the purchase sheet

- **Preparation:** An account on Free.
- **Steps:** On Free, subscribe → close the Apple sheet without confirming.
- **Expected outcome:** "Purchase cancelled. You haven't been charged."; the plan doesn't change.
- **Source:** `store-paywall.tsx` (`purchaseErrorMessage` empty → cancelled text).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-IAP-04-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-IAP-05 · Switch from monthly to yearly

- **Preparation:** DT-IAP-02 done.
- **Steps:** As a monthly Pro member, choose yearly → **Switch to yearly · <price>** → confirm in the Apple sheet.
  Check Plans & billing after the change applies.
- **Expected outcome:** The text under the button: "The App Store moves your membership to yearly billing; it confirms
  when the change takes effect." Plans & billing shows Yearly once Apple applies it (Apple applies same-level duration
  changes at renewal; record when).
- **Source:** `store-paywall.tsx` (switch action text); `docs/MOBILE_BILLING.md` table ("Monthly ↔ yearly").
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-IAP-05-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-IAP-06 · Turn off auto-renew; Manage subscription

- **Preparation:** An active App Store Pro subscription.
- **Steps:** Plans & billing → **Manage subscription** → cancel the subscription in Apple's screen. Return; pull down
  to refresh (allow time for the webhook).
- **Expected outcome:** Manage subscription opens Apple's subscription management. After cancelling: "Your membership
  is set to cancel. You keep Pro All Access until <date> and won't be charged again." and the detail "… · Ends <date>".
  Pro keeps working until then.
- **Source:** `store-paywall.tsx` `manage`; `billing/page.tsx` (`cancelling`); `docs/MOBILE_BILLING.md`
  ("Cancellation").
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-IAP-06-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-IAP-07 · The subscription expires

- **Preparation:** DT-IAP-06 done; some Pro data saved (a run, a Body Scan).
- **Steps:** After DT-IAP-06, wait for the (accelerated) period to end. Pull to refresh Plans & billing. Open a saved
  run, the progress photos, Body Scan history, and Run → Outdoor run.
- **Expected outcome:** Back to Free. Nothing is deleted: saved runs, photos and Body Scans can be viewed. Run →
  Outdoor run shows "Live GPS recording is included with Pro All Access".
- **Source:** `docs/MOBILE_BILLING.md` ("Expiration: Back to Free. Nothing is deleted."); `gps-recorder.tsx`
  (`canRecord`).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-IAP-07-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-IAP-08 · Restore after reinstalling

- **Preparation:** An active subscription; a second sandbox Apple Account that never bought (for step 2).
- **Steps:**
  1. With an active App Store Pro subscription on A: delete the app, reinstall, sign in as A → Plans & billing →
     **Restore purchases**.
  2. On an Apple Account that never bought: Restore purchases.
- **Expected outcome:** (1) "Restoring…", then "Purchases restored. You're on Pro All Access." (2) "No active
  memberships were found for your App Store account."
- **Source:** `store-paywall.tsx` `restore`; `docs/MOBILE_BILLING.md` sandbox plan step 5.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-IAP-08-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-IAP-09 · Restore on another iPhone

- **Preparation:** A second iPhone. Otherwise mark Blocked.
- **Steps:** On the second iPhone (same Apple Account), install the build, sign in as A, Plans & billing → Restore
  purchases.
- **Expected outcome:** "Purchases restored. You're on Pro All Access."; both phones show Pro.
- **Source:** `IOS_DEVICE_TEST_PLAN.md` 6.4; `store-paywall.tsx`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-IAP-09-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-IAP-10 · Restore while signed in to a different Narrow Gate account

- **Preparation:** A has an active App Store Pro subscription.
- **Steps:** On the phone whose Apple Account bought Pro for A, sign in as B → Restore purchases. Then sign in as A
  (on any device) → Plans & billing.
- **Expected outcome:** B: "Purchases restored. You're on Pro All Access." A: back to Free. This is the documented
  design (RevenueCat TRANSFER; both accounts are updated). Record it.
- **Source:** `docs/MOBILE_BILLING.md` table ("Restore purchases … A purchase restored on another Narrow Gate account
  moves there").
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-IAP-10-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-IAP-11 · Refund (if it can be tested)

- **Preparation:** An active subscription. If no sandbox refund tool is available to the tester, mark Blocked.
- **Steps:** Request a refund through Apple's sandbox tools (or StoreKit testing in Xcode for a development build).
  Refresh Plans & billing.
- **Expected outcome:** Access ends at the refund time; Plans & billing shows Free.
- **Source:** `docs/MOBILE_BILLING.md` ("Refund: Access ends at the refund time"; sandbox plan step 6).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-IAP-11-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-IAP-12 · Billing problem (if it can be tested)

- **Preparation:** An active subscription on a sandbox account that offers the option. Otherwise Blocked.
- **Steps:** Use the sandbox account's "billing problem" option; wait for the renewal; refresh Plans & billing.
- **Expected outcome:** "App Store couldn't renew your membership. Update your payment method in your App Store account
  to keep Pro All Access."; access continues during the grace period.
- **Source:** `billing/page.tsx` (`storeSub.status === "past_due"`); `docs/MOBILE_BILLING.md` sandbox plan step 7.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-IAP-12-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-IAP-13 · A website (Stripe) subscriber in the iPhone app

- **Preparation:** Account W subscribed on the test website with Stripe test mode.
- **Steps:** Sign in to the app as W → Plans & billing.
- **Expected outcome:** Current membership "Pro All Access" with "Billed through Stripe on our website…". In place of a
  purchase button: "Your membership was purchased outside the App Store. Manage it where you subscribed; it works here
  too." No Stripe "Manage billing" button inside the app; no second subscription offered.
- **Source:** `store-paywall.tsx` (`action === "elsewhere"`); `billing/page.tsx` (`PortalButton` hidden when native);
  `docs/MOBILE_BILLING.md` (3.1.3(b)).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-IAP-13-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-IAP-14 · An App Store subscriber on the website

- **Preparation:** A has an active App Store subscription.
- **Steps:** On the computer, sign in to the website as A (App Store Pro) → Plans & billing.
- **Expected outcome:** "Billed through the App Store" and "Your membership is billed through the App Store. Manage or
  cancel it on your phone in your Apple Account subscription settings; it works here too."; no Stripe checkout for Pro.
- **Source:** `src/components/profile/web-membership.tsx` (`storeManaged`); `billing/page.tsx`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-IAP-14-a.png`):
- **Severity if failed:**
- **Retest status:**

---

## 14. Data export (DT-EXP)

**How it works (from the code).** Profile → Privacy & data → **Download my data** is an ordinary download link to
`/api/account/export`, which returns one JSON file (`narrow-gate-fitness-export-<YYYY-MM-DD>.json`) with every table the
member owns, read with the member's own session, plus links to progress and Body Scan photos valid for 1 hour. At most
3 exports an hour. The iPhone app adds no native download or share handling (Capacitor iOS 8.5.3 has no download
handler), so what iOS does with the file inside the app is not determined by the code.

#### DT-EXP-01 · Download my data in the app

- **Preparation:** A with some data (a workout, a run, a photo, steps, sleep).
- **Steps:** Profile → Privacy & data → **Download my data**. Screen-record what happens. Try to save or share the file;
  then try to get back to the app.
- **Expected outcome:** **Not determined by the code.** Record exactly what iOS shows (a save/share sheet, the JSON text
  inside the app, a download indicator, or nothing). Pass requires that the member can get the file (or its full
  contents) out of the app, and get back to the app without force-quitting. JSON shown in the app with no way back is
  a Fail.
- **Source:** `src/app/(app)/profile/page.tsx` (`<a href="/api/account/export" download>`);
  `src/app/api/account/export/route.ts`; `node_modules/@capacitor/ios/Capacitor/Capacitor/WebViewDelegationHandler.swift`
  (no download handling).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-EXP-01-a.mov`):
- **Severity if failed:**
- **Retest status:**

#### DT-EXP-02 · What the file contains

- **Preparation:** The file from DT-EXP-01, or, if that failed, from the website on the computer (write down which).
- **Steps:** Open the JSON on a computer. Look for the items below.
- **Expected outcome:** `format` "narrow-gate-fitness/export@1", `exported_at`, `account` with A's id and e-mail;
  `workout_sessions` / `workout_sets` including the offline workout; `activities` including the GPS run with its route;
  `daily_steps` with `source` "apple_health"; `sleep_sessions` and `sleep_stages` (per-night figures, no raw heart-rate
  samples); `progress_photos` and `progress_photo_files` (links that work within an hour); `body_scans`,
  `body_scan_photos` and `body_scan_photo_files`. Nothing belonging to B.
- **Source:** `src/server/services/account.ts` `exportUserData`, `USER_TABLES`; `docs/DATA.md` §4;
  `docs/WEARABLES.md` §4 (no raw samples sent).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-EXP-02-a.json`):
- **Severity if failed:**
- **Retest status:**

#### DT-EXP-03 · Deleted items are not exported

- **Preparation:** A run deleted (DT-GPS-13) and a photo deleted (DT-PHOTO-06).
- **Steps:** Export again; search the file for the deleted run and photo.
- **Expected outcome:** The deleted photo is not in `progress_photos` or `progress_photo_files`. The deleted run is
  either absent or present with `deleted_at` set and `route`, `splits` and `gps_quality` empty (null).
- **Source:** `src/server/actions/activities.ts` (soft delete clears route, splits, GPS quality);
  `IOS_DEVICE_TEST_PLAN.md` 3.10.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-EXP-03-a.json`):
- **Severity if failed:**
- **Retest status:**

#### DT-EXP-04 · More than 3 exports in an hour

- **Preparation:** None.
- **Steps:** Tap Download my data four times within an hour (counting earlier exports in the same hour).
- **Expected outcome:** The fourth request is refused by the server (HTTP 429 with `{"error":"Please wait before
  exporting again."}`). How the app shows it is not determined by the code: record it; the app must stay usable.
- **Source:** `src/app/api/account/export/route.ts` (`rateLimit(export:…, 3, 1 hour)`).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-EXP-04-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-EXP-05 · Export with no network

- **Preparation:** None.
- **Steps:** Profile open; airplane mode on; Download my data. Then airplane mode off and Try again if needed.
- **Expected outcome:** No file; the "You're offline" page or nothing happens (record which); after reconnecting the app
  works normally.
- **Source:** `native-shell/error.html`; `capacitor.config.ts` (`server.errorPath`).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-EXP-05-a.png`):
- **Severity if failed:**
- **Retest status:**

---

## 15. Account deletion (DT-DEL)

**How it works (from the code).** Profile → Privacy & data → Delete account: type **DELETE** and the password →
**Delete my account**. The server cancels any website (Stripe) subscription, removes every file under the member's
folder in the `avatars`, `progress-photos` and `body-scans` buckets, deletes the account (every table cascades),
deletes the Stripe and RevenueCat customer records, signs out and opens the welcome page, which clears this phone's
drafts, workout copy and navigation memory. **An App Store subscription is not cancelled by deletion**: the screen says
so (below).

#### DT-DEL-01 · Mistakes are refused

- **Preparation:** Account C signed in.
- **Steps:** Delete account with: (a) both fields empty; (b) "delete" in lower case and the right password; (c)
  "DELETE" and a wrong password.
- **Expected outcome:** (a) "Type DELETE to confirm." (b) the same. (c) "That password isn't right." Nothing deleted.
  After five attempts in 15 minutes: "Too many attempts. Please wait a few minutes and try again."
- **Source:** `src/server/actions/profile.ts` `deleteAccountAction`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-DEL-01-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-DEL-02 · Deleting a Free account

- **Preparation:** C (Free) with a workout, a progress photo, synced steps, an unfinished workout on the phone and a
  form draft.
- **Steps:**
  1. Read the Delete account section; screenshot it.
  2. Type DELETE and the password → **Delete my account**.
  3. Screenshot where you land. Force-quit; reopen.
  4. Try to sign in as C.
- **Expected outcome:** (1) "This cancels any subscription bought on this website and permanently deletes your account
  and data. It can't be undone." and the form text, including "If you subscribed through the App Store or Google Play,
  deleting your account doesn't stop those charges: cancel in your iPhone's Settings → your name → Subscriptions, or in
  Google Play → Payments & subscriptions." (2) "Deleting…". (3) Signed out, on the welcome page. After relaunch the
  opening ends on the **welcome page**, not Sign in. (4) Signing in as C fails. Owner: the auth user is gone and C's
  folders are gone from the three buckets.
- **Source:** `deleteAccountAction` (deletes `RETURNING_COOKIE`, redirects to `/?deleted=1`);
  `src/server/services/account-deletion.ts`; `src/app/page.tsx` + `src/components/platform/forget-device-data.tsx`;
  `src/components/profile/profile-forms.tsx` `DeleteAccountForm`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-DEL-02-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-DEL-03 · An App Store subscriber: the warning, and the subscription keeps running

- **Preparation:** An account with an active App Store sandbox Pro subscription (it can be a fresh account that bought
  in DT-IAP-02 conditions).
- **Steps:**
  1. Profile → Privacy & data. Screenshot the Delete account section.
  2. Delete the account.
  3. Open Settings → your name → Subscriptions (sandbox subscriptions may be under the Sandbox Account settings).
- **Expected outcome:** (1) Above the form: "Your Pro All Access subscription is billed by the App Store. Deleting your
  account won't cancel it — cancel it first in your App Store subscription settings (Settings → your name →
  Subscriptions)." plus the form text quoted in DT-DEL-02. (2) Deletion completes as in DT-DEL-02. (3) The Apple
  subscription is still active (deletion doesn't cancel it). Owner: the RevenueCat customer record is deleted.
- **Source:** `src/app/(app)/profile/page.tsx` (`storeBilled` warning); `profile-forms.tsx`; `account-deletion.ts`
  (`deleteStoreCustomer`); `docs/MOBILE_BILLING.md` ("Account deletion: Can't cancel a store subscription").
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-DEL-03-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-DEL-04 · A website (Stripe test) subscriber

- **Preparation:** An account subscribed on the test website with Stripe test mode (it may be W, at the end of the run).
- **Steps:** In the app, delete the account. Owner: open the Stripe test dashboard.
- **Expected outcome:** The form says "A membership bought on this website is cancelled for you, with no further
  charges."; deletion completes; Stripe shows the subscription cancelled and the customer deleted.
- **Source:** `account-deletion.ts` (`cancelSubscriptions`, `deleteStripeCustomer`); `profile-forms.tsx`.
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-DEL-04-a.png`):
- **Severity if failed:**
- **Retest status:**

#### DT-DEL-05 · The same phone afterwards

- **Preparation:** DT-DEL-02 done on this phone.
- **Steps:** Start free → create a new account D on the same phone → finish onboarding → check Home, Train, Run, the
  forms and the photo dialog.
- **Expected outcome:** Nothing of C's: no Resume workout, no unfinished run, empty forms, no photos.
- **Source:** `forget-device-data.tsx` (clears all drafts, workout copies, `ngf.nav.*`, `ngf.scroll.*`, `ngf.ui.*`).
- **Pass/Fail:** ☐ Pass ☐ Fail ☐ Blocked
- **Actual result:**
- **Evidence** (suggested file name `DT-DEL-05-a.png`):
- **Severity if failed:**
- **Retest status:**

---

## Summary of all test IDs

Fill in from the CSV after each run. Every result is empty because nothing has been run on a device yet.

| ID | Area | Title | Result | Severity | Retest status | Tester / date / build |
|---|---|---|---|---|---|---|
| DT-REST-01 | Rest timer notifications | First rest asks for notification permission; rest ends with the app open |  |  |  |  |
| DT-REST-02 | Rest timer notifications | Rest ends with the app in the background |  |  |  |  |
| DT-REST-03 | Rest timer notifications | Rest ends with the screen locked |  |  |  |  |
| DT-REST-04 | Rest timer notifications | Notification permission denied |  |  |  |  |
| DT-REST-05 | Rest timer notifications | Permission re-enabled in Settings |  |  |  |  |
| DT-REST-06 | Rest timer notifications | Ring/Silent switch on silent |  |  |  |  |
| DT-REST-07 | Rest timer notifications | Do Not Disturb or another Focus |  |  |  |  |
| DT-REST-08 | Rest timer notifications | Rest ends while the app is closed |  |  |  |  |
| DT-REST-09 | Rest timer notifications | Adjust, skip, pause and resume a running rest |  |  |  |  |
| DT-REST-10 | Rest timer notifications | Rest timer alerts off, Vibrate only, and saved setting |  |  |  |  |
| DT-REST-11 | Rest timer notifications | Finish, discard or sign out while a rest is running |  |  |  |  |
| DT-GPS-01 | Background and locked-screen GPS | First Start: which location prompts iOS shows |  |  |  |  |
| DT-GPS-02 | Background and locked-screen GPS | First fix, recording state and GPS details |  |  |  |  |
| DT-GPS-03 | Background and locked-screen GPS | Screen locked for 10 minutes (While Using) |  |  |  |  |
| DT-GPS-04 | Background and locked-screen GPS | App in the background and switching apps |  |  |  |  |
| DT-GPS-05 | Background and locked-screen GPS | Incoming phone call during a recording |  |  |  |  |
| DT-GPS-06 | Background and locked-screen GPS | Locked screen with "Always" permission |  |  |  |  |
| DT-GPS-07 | Background and locked-screen GPS | "Allow Once" |  |  |  |  |
| DT-GPS-08 | Background and locked-screen GPS | Location refused, then allowed from Settings |  |  |  |  |
| DT-GPS-09 | Background and locked-screen GPS | Approximate location (Precise Location off) |  |  |  |  |
| DT-GPS-10 | Background and locked-screen GPS | Low Power Mode, 20 minutes locked |  |  |  |  |
| DT-GPS-11 | Background and locked-screen GPS | One hour locked: battery and survival |  |  |  |  |
| DT-GPS-12 | Background and locked-screen GPS | Pause and resume |  |  |  |  |
| DT-GPS-13 | Background and locked-screen GPS | Finish, save and delete a run |  |  |  |  |
| DT-ROUTE-01 | Outdoor route accuracy | Running track, 4 laps in lane 1, screen on |  |  |  |  |
| DT-ROUTE-02 | Outdoor route accuracy | Running track, screen locked the whole time |  |  |  |  |
| DT-ROUTE-03 | Outdoor route accuracy | Measured road route, about 5 km |  |  |  |  |
| DT-ROUTE-04 | Outdoor route accuracy | City walk among tall buildings, with a 2-minute stop |  |  |  |  |
| DT-ROUTE-05 | Outdoor route accuracy | Standing still for 10 minutes |  |  |  |  |
| DT-ROUTE-06 | Outdoor route accuracy | Tunnel or underpass |  |  |  |  |
| DT-ROUTE-07 | Outdoor route accuracy | Under tree cover |  |  |  |  |
| DT-SCAN-01 | Native barcode scanning | First scan: camera prompt and a known product |  |  |  |  |
| DT-SCAN-02 | Native barcode scanning | Several known products and barcode formats |  |  |  |  |
| DT-SCAN-03 | Native barcode scanning | Scan into the food diary and log it |  |  |  |  |
| DT-SCAN-04 | Native barcode scanning | Unknown product |  |  |  |  |
| DT-SCAN-05 | Native barcode scanning | Damaged, curved and badly lit barcodes |  |  |  |  |
| DT-SCAN-06 | Native barcode scanning | A code that isn't a food barcode |  |  |  |  |
| DT-SCAN-07 | Native barcode scanning | Cancel the scanner |  |  |  |  |
| DT-SCAN-08 | Native barcode scanning | Camera refused, then allowed |  |  |  |  |
| DT-SCAN-09 | Native barcode scanning | Scanning with no network |  |  |  |  |
| DT-SCAN-10 | Native barcode scanning | Typing the barcode when a scan fails |  |  |  |  |
| DT-CAM-01 | Camera permissions | First camera use through Body Scan |  |  |  |  |
| DT-CAM-02 | Camera permissions | First camera use through a progress photo |  |  |  |  |
| DT-CAM-03 | Camera permissions | One permission for every camera feature |  |  |  |  |
| DT-CAM-04 | Camera permissions | Camera refused: every feature |  |  |  |  |
| DT-CAM-05 | Camera permissions | Camera allowed again in Settings |  |  |  |  |
| DT-CAM-06 | Camera permissions | Photo library: no permission prompt, no "limited" access |  |  |  |  |
| DT-HEALTH-01 | Apple Health steps and sleep | Steps: first sync and the Health sheet |  |  |  |  |
| DT-HEALTH-02 | Apple Health steps and sleep | Steps match the Health app |  |  |  |  |
| DT-HEALTH-03 | Apple Health steps and sleep | A hand entry, then a sync |  |  |  |  |
| DT-HEALTH-04 | Apple Health steps and sleep | Steps access turned off |  |  |  |  |
| DT-HEALTH-05 | Apple Health steps and sleep | Sleep: consent and when the Health sheet appears |  |  |  |  |
| DT-HEALTH-06 | Apple Health steps and sleep | Sleep allowed, measurements refused |  |  |  |  |
| DT-HEALTH-07 | Apple Health steps and sleep | All four allowed: the nights match the Health app |  |  |  |  |
| DT-HEALTH-08 | Apple Health steps and sleep | Syncing again adds no duplicates |  |  |  |  |
| DT-HEALTH-09 | Apple Health steps and sleep | A night entered by hand that overlaps an imported one |  |  |  |  |
| DT-HEALTH-10 | Apple Health steps and sleep | Overnight: no background sync; sync on opening |  |  |  |  |
| DT-HEALTH-11 | Apple Health steps and sleep | Health access revoked |  |  |  |  |
| DT-HEALTH-12 | Apple Health steps and sleep | Disconnect, remove imported nights, and nothing written to Health |  |  |  |  |
| DT-PHOTO-01 | Progress photos | Take a photo with the camera and save it |  |  |  |  |
| DT-PHOTO-02 | Progress photos | Retake before saving; close without saving |  |  |  |  |
| DT-PHOTO-03 | Progress photos | From the photo library (HEIC and PNG) |  |  |  |  |
| DT-PHOTO-04 | Progress photos | The stored copy is resized and has no location |  |  |  |  |
| DT-PHOTO-05 | Progress photos | Only the owner sees the photos |  |  |  |  |
| DT-PHOTO-06 | Progress photos | Delete a photo |  |  |  |  |
| DT-PHOTO-07 | Progress photos | Saving with no network |  |  |  |  |
| DT-PHOTO-08 | Progress photos | Comparison on Pro, locked on Free |  |  |  |  |
| DT-OFF-01 | Offline workout persistence | Log sets with no network |  |  |  |  |
| DT-OFF-02 | Offline workout persistence | Force-quit with no network and reopen with no network |  |  |  |  |
| DT-OFF-03 | Offline workout persistence | Reconnect and resume |  |  |  |  |
| DT-OFF-04 | Offline workout persistence | The offline sets reached the account |  |  |  |  |
| DT-OFF-05 | Offline workout persistence | Finish offline, then online: saved exactly once |  |  |  |  |
| DT-OFF-06 | Offline workout persistence | Wi-Fi with no internet behind it |  |  |  |  |
| DT-OFF-07 | Offline workout persistence | A workout left for 6 hours or more |  |  |  |  |
| DT-OFF-08 | Offline workout persistence | A finished run whose save failed offline |  |  |  |  |
| DT-DISC-01 | Offline discard and reconnection | Discard a synced workout while offline, then reconnect |  |  |  |  |
| DT-DISC-02 | Offline discard and reconnection | Another device before and after the phone reconnects |  |  |  |  |
| DT-DISC-03 | Offline discard and reconnection | "Discard & start new" while offline |  |  |  |  |
| DT-DISC-04 | Offline discard and reconnection | Discard offline, force-quit, reconnect later |  |  |  |  |
| DT-DISC-05 | Offline discard and reconnection | Discard a GPS recording while offline |  |  |  |  |
| DT-QUIT-01 | Force-quit and relaunch | First launch after installing |  |  |  |  |
| DT-QUIT-02 | Force-quit and relaunch | Signed in: relaunch, tabs and returning from the background |  |  |  |  |
| DT-QUIT-03 | Force-quit and relaunch | Signed out on a phone that was signed in before |  |  |  |  |
| DT-QUIT-04 | Force-quit and relaunch | Onboarding not finished |  |  |  |  |
| DT-QUIT-05 | Force-quit and relaunch | Interrupting the opening |  |  |  |  |
| DT-QUIT-06 | Force-quit and relaunch | Force-quit in the middle of a workout |  |  |  |  |
| DT-QUIT-07 | Force-quit and relaunch | Force-quit in the middle of a run |  |  |  |  |
| DT-QUIT-08 | Force-quit and relaunch | Relaunch with Reduce Motion on |  |  |  |  |
| DT-SESS-01 | Login session persistence | Relaunch keeps the session |  |  |  |  |
| DT-SESS-02 | Login session persistence | Days later, after restarting the phone |  |  |  |  |
| DT-SESS-03 | Login session persistence | Offline for longer than the access token |  |  |  |  |
| DT-SESS-04 | Login session persistence | Password changed on another device |  |  |  |  |
| DT-SESS-05 | Login session persistence | Sign out, then relaunch |  |  |  |  |
| DT-SESS-06 | Login session persistence | Reinstall |  |  |  |  |
| DT-SWITCH-01 | Account switching | A signs out with unsaved data and activities in progress |  |  |  |  |
| DT-SWITCH-02 | Account switching | B signs in straight away: nothing of A's is visible |  |  |  |  |
| DT-SWITCH-03 | Account switching | The same check after a relaunch |  |  |  |  |
| DT-SWITCH-04 | Account switching | Reminders and notifications that belong to the phone, not the account |  |  |  |  |
| DT-SWITCH-05 | Account switching | A signs back in |  |  |  |  |
| DT-SWITCH-06 | Account switching | The App Store purchase identity follows the account |  |  |  |  |
| DT-IAP-01 | Subscriptions | The Plans & billing screen |  |  |  |  |
| DT-IAP-02 | Subscriptions | Buy Pro All Access monthly |  |  |  |  |
| DT-IAP-03 | Subscriptions | A sandbox purchase that isn't counted |  |  |  |  |
| DT-IAP-04 | Subscriptions | Cancel the purchase sheet |  |  |  |  |
| DT-IAP-05 | Subscriptions | Switch from monthly to yearly |  |  |  |  |
| DT-IAP-06 | Subscriptions | Turn off auto-renew; Manage subscription |  |  |  |  |
| DT-IAP-07 | Subscriptions | The subscription expires |  |  |  |  |
| DT-IAP-08 | Subscriptions | Restore after reinstalling |  |  |  |  |
| DT-IAP-09 | Subscriptions | Restore on another iPhone |  |  |  |  |
| DT-IAP-10 | Subscriptions | Restore while signed in to a different Narrow Gate account |  |  |  |  |
| DT-IAP-11 | Subscriptions | Refund (if it can be tested) |  |  |  |  |
| DT-IAP-12 | Subscriptions | Billing problem (if it can be tested) |  |  |  |  |
| DT-IAP-13 | Subscriptions | A website (Stripe) subscriber in the iPhone app |  |  |  |  |
| DT-IAP-14 | Subscriptions | An App Store subscriber on the website |  |  |  |  |
| DT-EXP-01 | Data export | Download my data in the app |  |  |  |  |
| DT-EXP-02 | Data export | What the file contains |  |  |  |  |
| DT-EXP-03 | Data export | Deleted items are not exported |  |  |  |  |
| DT-EXP-04 | Data export | More than 3 exports in an hour |  |  |  |  |
| DT-EXP-05 | Data export | Export with no network |  |  |  |  |
| DT-DEL-01 | Account deletion | Mistakes are refused |  |  |  |  |
| DT-DEL-02 | Account deletion | Deleting a Free account |  |  |  |  |
| DT-DEL-03 | Account deletion | An App Store subscriber: the warning, and the subscription keeps running |  |  |  |  |
| DT-DEL-04 | Account deletion | A website (Stripe test) subscriber |  |  |  |  |
| DT-DEL-05 | Account deletion | The same phone afterwards |  |  |  |  |

Cases per area: Rest timer notifications (REST) 11; Background and locked-screen GPS (GPS) 13; Outdoor route accuracy (ROUTE) 7; Native barcode scanning (SCAN) 10; Camera permissions (CAM) 6; Apple Health steps and sleep (HEALTH) 12; Progress photos (PHOTO) 8; Offline workout persistence (OFF) 8; Offline discard and reconnection (DISC) 5; Force-quit and relaunch (QUIT) 8; Login session persistence (SESS) 6; Account switching (SWITCH) 6; Subscriptions (IAP) 14; Data export (EXP) 5; Account deletion (DEL) 5. Total 124.
