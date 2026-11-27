# iPhone test script: Narrow Gate Fitness TestFlight build

A step-by-step script for **one tester with a physical iPhone**, who doesn't need to be an engineer. A second, older or
smaller iPhone and an Apple Watch make it better, and some cases need them. Each case says what to prepare, what to tap,
what should happen, what to attach as proof, and how serious a failure is.

**Status:** written 2026-11-12 from branch `claude/rc-verification`. **No case in this file has been run yet.** Every
result box is empty on purpose.

## How this file relates to the other test documents

This script pulls the earlier device documents into one run order. It does not replace their detail:

| Document | What it still provides |
|---|---|
| `docs/device-testing/DEVICE_TEST_SCRIPT.md` | The full wording of each on-screen message, the code each expectation comes from, and the retest rules. When a case below says **Detail: DT-…**, the exact expected text is in that case there. If the two files disagree, check the code and fix whichever file is wrong. |
| `docs/device-testing/device-test-results.csv` | Where `DT-` results are recorded. Add `IP-` rows for the cases below that have no `DT-` equivalent. |
| `docs/release/TESTFLIGHT_ACCEPTANCE.md`, `docs/TESTFLIGHT_INTERNAL_CHECKLIST.md`, `docs/release/REGRESSION_CHECKLIST.md` | The release sign-off tables. They point here and to `DEVICE_TEST_SCRIPT.md`. |
| `docs/launch-audit/IOS_DEVICE_TEST_PLAN.md`, `docs/GPS_BACKGROUND_IPHONE.md`, `docs/SLEEP_DEVICE_CHECKLIST.md`, `docs/NOTIFICATIONS.md` (DT-NOTIF), `docs/MOBILE_BILLING.md` (sandbox plan) | Earlier plans. Their rows are covered by the cases below. |

AI Coach, Faith reading, workouts and photos are covered in `TESTFLIGHT_ACCEPTANCE.md`. This script only touches them
where they cross a native feature (camera, offline, notifications, accessibility).

---

## What this build actually contains

Checked against the native project on 2026-11-12. Only features in this list are tested below.

| Native feature | In this build? | Evidence in the project |
|---|---|---|
| Minimum iOS | **iOS 16.0** | `IPHONEOS_DEPLOYMENT_TARGET = 16.0` (`ios/App/App.xcodeproj/project.pbxproj`). iPhone only (`LSRequiresIPhoneOS`, arm64). |
| How the app works | A native shell that loads the deployed website (`CAP_SERVER_URL`), with an offline page and an offline Bible bundled in the app | `capacitor.config.ts`, `native-shell/` |
| Camera (barcode, meal photo, progress photos, Body Scan) | Yes | `NSCameraUsageDescription`; `@capacitor/barcode-scanner` 3.1.2 |
| GPS with the screen locked | Yes | `UIBackgroundModes: location`; When-In-Use and Always purpose strings; `@capacitor-community/background-geolocation` 1.2.26 (`src/lib/native/location.ts`) |
| Apple Health: **read** steps, sleep, overnight heart rate, HRV, respiratory rate | Yes | HealthKit entitlement; `NSHealthShareUsageDescription`; `@capgo/capacitor-health` 8.11.4 (`src/lib/native-health.ts`, `src/lib/native-sleep.ts`) |
| Local notifications (reminders, rest timer, wake-up alarm) | Yes | `@capacitor/local-notifications` (`src/lib/native-notifications.ts`, `src/lib/native-alarm.ts`, `src/lib/native.ts`) |
| In-app purchases (RevenueCat, App Store) | Yes | `@revenuecat/purchases-capacitor` 13.7.3; products `ngf_pro_monthly` ($17.99) and `ngf_pro_yearly` ($119.99) (`docs/MOBILE_BILLING.md`) |
| Haptics, keyboard, status bar, splash screen | Yes | Capacitor plugins in `ios/App/CapApp-SPM/Package.swift` |

### Not in this build

These are mentioned in the brief or in other documents but aren't wired into the native project. Don't test them.
Record them as **N/A, not in build**.

| Feature | Why it is N/A |
|---|---|
| **Sign in with Apple** (new account, Hide My Email, returning sign-in, revoking in Settings, deleting an Apple-signed-in account) | No Sign in with Apple plugin or `com.apple.developer.applesignin` entitlement. Auth is email and password only (`supabase/config.toml` `[auth.external.apple] enabled = false`; `docs/launch-audit/APPLE_COMPLIANCE.md` row 12). One check that no social sign-in appears is IP-SIWA-01. |
| **Apple Health write-back** (saving workouts or runs to Health) | Read-only. `NSHealthUpdateUsageDescription` says "only reads… does not write"; the code only calls `requestAuthorization({ read: … })`. IP-HLT-10 checks that nothing is written. |
| **Background Health sync** (importing while the app is closed) | No `healthkit.background-delivery` entitlement and no observer query. Import happens when the app is opened (`docs/WEARABLES.md` §3). |
| **Apple Watch app** | The project has no watchOS target. The watch is used only as a **source of data in Apple Health** (sleep, heart rate) and as a **distance reference** (its Workout app). |
| **Push (remote) notifications** | No `aps-environment` entitlement. All notifications are local, scheduled on the phone. |
| **Universal links** (email links opening in the app) | No associated-domains entitlement. Confirmation and reset emails open in Safari (`docs/TESTFLIGHT_INTERNAL_CHECKLIST.md`). |
| **iPad layout** | `LSRequiresIPhoneOS`. On an iPad the app runs as an iPhone app. Not covered here. |

---

## Labels used on each case

| Label | Meaning |
|---|---|
| **[TF]** | **Needs the TestFlight build itself.** It can't be done before a TestFlight build exists, for example installing from TestFlight, TestFlight purchase renewal timing, release-build performance, or TestFlight crash reports. |
| *(no label)* | Needs any installed native build. The tester uses TestFlight. An engineer could run it earlier on a development build from Xcode. |
| **[Mac]** | Also needs a Mac with Xcode, usually for logs or measurements. Without a Mac, mark the Mac-only part **Blocked** and do the rest. |
| **[Watch]** | Needs an Apple Watch paired with the main iPhone (or another source that writes to Apple Health, such as Oura or Garmin). |
| **[2nd iPhone]** | Needs the second iPhone. |
| **[Owner]** | The app owner must do or check something: Supabase, RevenueCat, App Store Connect, or the sandbox tester list. |
| **[Outdoors]** | Needs walking or running outside. |

### Severity if a case fails

The same scale as `DEVICE_TEST_SCRIPT.md` (S1 to S4), with the names this script uses:

| Severity | Meaning | Release impact |
|---|---|---|
| **Blocker** (S1) | Crash, data loss, another member's data shown, money or entitlement wrong (charged, or paid but locked), a deleted account can still sign in, a core flow unusable | Stops the TestFlight round and App Store submission |
| **High** (S2) | A feature works only partly or gives a wrong result, with no reasonable workaround (GPS gap, distance outside tolerance, reminder never arrives, duplicates) | Fix before external TestFlight |
| **Medium** (S3) | Wrong or misleading message, or an awkward flow that has a workaround | Fix before App Store release, or log a known issue with the owner's agreement |
| **Low** (S4) | Cosmetic: layout, wording, truncation | Backlog |

The severity on each case is the default. Raise it if what happened is worse, for example a crash in a "Medium" case
is a Blocker.

---

## Before you start

### 1. Devices

| Device | Needed? | Record |
|---|---|---|
| **Main iPhone** on the current iOS release, battery health at least 85% (Settings → Battery → Battery Health) | Required | Model, iOS version, battery health % |
| **Second iPhone**: older or smaller, ideally on **iOS 16.x** (the minimum), for example iPhone SE (2nd/3rd gen), iPhone 8 or iPhone X | Recommended. Required for the [2nd iPhone] cases. | Model, iOS version |
| **Apple Watch** (watchOS 9 or later) paired with the main iPhone, with Sleep tracking on and **at least two nights recorded** before you start | Recommended. Required for [Watch] cases. | Model, watchOS version |
| A Mac with Xcode (current release) and a USB cable | Optional. Required for [Mac] parts. | macOS and Xcode versions |
| A computer or second phone with a web browser | Required for checking an account from "another device" | — |

### 2. Install the TestFlight build [TF]

1. On the iPhone, open the email invitation from TestFlight, or the public link the owner sent. Install **TestFlight**
   from the App Store if asked.
2. In TestFlight, tap **Narrow Gate Fitness → Install**. Wait until the button says **Open**.
3. In TestFlight, tap the app and write down the **version and build number** ("1.0.0 (14)"). Every result must name
   this build.
4. Ask the owner for the **deployed site address and commit** the build is using. You can see the commit yourself by
   opening `https://<site>/api/health` in Safari. The app loads that website, so a website change can alter results
   without a new build.
5. In TestFlight, turn **Automatic Updates** off for the duration of a run. If a new build arrives mid-run,
   finish the section you are in and start a new results sheet.

### 3. Accounts

| Account | What for |
|---|---|
| **A**, a fresh app account made for this run (Start free → sign up with a new email you can read) | Most cases. Confirm the email in Safari (the link doesn't open the app), then sign in inside the app. |
| **B**, a second fresh account | Restore onto a different account (IP-IAP-09). |
| **C**, a throwaway account | Account deletion (IP-DEL-01, -03). |
| **D**, a fresh account that never bought | Annual purchase (IP-IAP-04) and Ask to Buy (IP-IAP-10). |
| **Sandbox tester list** [Owner] | In a TestFlight build every purchase is a sandbox purchase. The server only counts sandbox purchases for accounts on the **sandbox tester list** (Admin → Subscriptions → Sandbox testers), unless the test deployment has `REVENUECAT_ALLOW_SANDBOX=true` (`docs/MOBILE_BILLING.md`). Ask the owner to add A, B, C and D **before** any purchase case, and write down which rule applies. |

> **Never use a real payment card anywhere in this script.** If an Apple purchase sheet does **not** say it is a
> TestFlight or Sandbox purchase ("You will not be charged" or "[Environment: Sandbox]"), tap Cancel and stop the
> purchase cases.

### 4. The Apple Account used for purchases

- **TestFlight build (normal case):** purchases use the Apple Account you're signed in to on the iPhone. Apple marks
  them as TestFlight purchases and **doesn't charge** for them. Renewals are sped up. At the time of writing Apple
  renews TestFlight subscriptions **about once a day** whatever their length, **up to 6 times**. Check Apple's current
  TestFlight page before you rely on this.
- **Development build from Xcode [Mac]:** sign in with a **Sandbox Apple Account** that the owner creates in App
  Store Connect (Users and Access → Sandbox → Test Accounts). On the iPhone:
  - **iOS 18 and later:** Settings → **Developer** → **Sandbox Apple Account**. The Developer menu appears after the
    phone has been connected to Xcode once and Developer Mode is on.
  - **iOS 16 and 17:** Settings → **App Store** → scroll to **Sandbox Account**.

  Sandbox renewals: by default 1 month = 5 minutes and 1 year = 1 hour, renewing up to 12 times. Recent iOS versions
  let you change the renewal rate under the Sandbox Account → **Manage**.
- Ask-to-Buy (IP-IAP-10) and refunds (IP-IAP-11) can usually only be produced with a sandbox account or Xcode, so they
  are marked [Mac][Owner].

### 5. Resetting permissions between cases

| What | How to reset |
|---|---|
| Everything at once (fresh first-run state) | Delete the app (long-press → Remove App → Delete App), then reinstall from TestFlight. This clears the app's sign-in and stored data, and iOS forgets its camera, location and notification answers. |
| Location, if the prompt doesn't come back after a reinstall | Settings → General → Transfer or Reset iPhone → Reset → **Reset Location & Privacy**. This resets **every app's** privacy answers, so warn the phone's owner. |
| Location for this app only | Settings → Privacy & Security → Location Services → Narrow Gate Fitness (Never / Ask Next Time / While Using / Always; Precise Location switch) |
| Camera | Settings → Narrow Gate Fitness → Camera. **iOS 18+:** Settings → Apps → Narrow Gate Fitness. |
| Notifications | Settings → Notifications → Narrow Gate Fitness (Allow Notifications, Lock Screen, Banners, Sounds) |
| Apple Health | Health app → your profile picture (top right) → **Apps** → Narrow Gate Fitness → turn categories on or off (Turn On All / Turn Off All). Also reachable from Settings → Health → Data Access & Devices. iOS shows the Health permission sheet only for categories the app has **never** asked about, so turning a category back on is done here, not in the app. If the sheet doesn't reappear after a reinstall, write that down and use these switches. |
| Purchases | See IP-IAP-06 (cancel) and the renewal timing above. A new Apple account, or a sandbox account cleared by the owner, gives a "never bought" state. |

### 6. Collecting evidence

- **Screen recording:** add Screen Recording to Control Center (Settings → Control Center). Swipe down from the top
  right → tap the record button → 3-second countdown. Long-press it and turn on **Microphone** if sound matters (rest
  timer, alarm). Stop it from the red pill. The video goes to Photos.
- **Screenshot:** Side button + Volume Up.
- **Battery:** Settings → **Battery**. Choose **Last 24 Hours**, tap the hour bar that covers your test, and screenshot
  the per-app list. Tap Narrow Gate Fitness to see **Screen Active** and **Background** minutes. Write the battery %
  before and after from the status bar (turn on Settings → Battery → Battery Percentage).
- **Crashes and memory kills without a Mac:** Settings → Privacy & Security → **Analytics & Improvements** → **Analytics
  Data**. Look for files starting with `App-` or `NarrowGate` (crash) and `JetsamEvent` (iOS killed apps to free
  memory) dated during your test. Open one → Share → save to Files. If the app crashes, TestFlight usually asks for
  feedback. Say yes and add the test ID.
- **TestFlight feedback:** take a screenshot, then tap **Share Beta Feedback** in the preview, or open TestFlight →
  the app → **Send Beta Feedback**. Start the comment with the test ID.
- **With a Mac [Mac]:**
  - Xcode → Window → **Organizer** → the app → **Crashes**, **Energy**, **Hangs**, **Launch Time**, **Memory**.
    TestFlight builds report here after testers who share analytics have used them, often a day later.
  - Xcode → Window → **Devices and Simulators** → the phone → **Open Console** (live log) or **View Device Logs**.
  - Instruments (Xcode → Open Developer Tool → Instruments) → **Energy Log**, **Thermal State**, **Allocations**, or
    **App Launch**, attached to the running app. Profiling a TestFlight build may not attach. If so, note it and use a
    release-configured development build.
- **File names:** `<test id>-<letter>.<ext>`, for example `IP-GPS-05-a.mov`, `IP-BAT-01-b.png`. One folder per run:
  `<build>/<device>/`.
- **Privacy:** keep evidence **outside the repository**, in a private shared folder. Route maps show where you live and
  run, Health screens show health data, and purchase screens show your Apple Account email.

### 7. Reporting a result

For each case, record one row (in the results CSV, or a copy of the summary table at the end):

| Field | Example |
|---|---|
| Test ID | IP-GPS-05 |
| Device | iPhone 15, battery health 91% |
| iOS version | 18.1 |
| Build | 1.0.0 (14), site commit `a1b2c3d` |
| Result | Pass / Fail / Blocked / N/A |
| What happened | Only for Fail or Blocked, or where the case says "record". Numbers asked for (distance, %, seconds). |
| Evidence | File names |
| Severity | Only for Fail: Blocker / High / Medium / Low |

Rules:

- **Pass** means every point under *Expected* happened and evidence is attached. A Pass with no evidence counts as
  *Not run*.
- A case that fails even once in three tries is a **Fail**. Write how often it failed.
- **Blocked** means it couldn't be run. Say why: no watch, no Mac, owner step missing, an earlier case failed.
- Report every Blocker the same day, with the recording, to the owner.

### 8. Suggested order

Purchases first, because GPS needs Pro:

1. Setup (IP-SET), then purchases IP-IAP-01…03 so account A has Pro.
2. Camera and scanning (IP-CAM, IP-SCAN), done indoors.
3. Health (IP-HLT), on the morning after a night with the watch.
4. Notifications (IP-NTF). Some cases need waiting, so run them alongside others.
5. GPS and battery (IP-GPS, IP-BAT), outdoors. Plan about 3 hours over two days.
6. Offline (IP-OFF), performance (IP-PERF), accessibility (IP-A11Y).
7. The remaining purchase cases (IP-IAP-04…13). These need waiting for renewals.
8. Account deletion (IP-DEL), last.

---

## Test cases

Format: **ID · title**, followed by a header line: Area · Labels · **Severity if it fails**. `Detail: DT-…` names the
case in `DEVICE_TEST_SCRIPT.md` with the exact on-screen text.

Main navigation: the tab bar has **Home, Train, Nutrition, Faith, You**. Run is under Train. My Progress, Sleep and
Plans & billing are under You.

### 0. Setup

#### IP-SET-01 · Install, first launch, build recorded
Setup · [TF] · **Blocker**
- **Preconditions:** TestFlight invitation accepted.
- **Steps:**
  1. Install from TestFlight (step 2 above) and open the app.
  2. Watch the launch: a plain dark screen, then the opening animation, then the welcome page. Tap Skip/Enter if
     shown.
  3. Create account A, confirm the email in Safari, and sign in inside the app. Finish onboarding.
  4. You → write down the plan shown ("Free").
- **Expected:** The app opens without a crash or a white screen and reaches Home. The email link opens Safari and
  confirms the account. There are no prompts for location, camera, notifications or Health at launch: each is asked
  only when a feature needs it.
- **Evidence:** A screen recording of steps 1–2. A screenshot of TestFlight showing the build number.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-QUIT-01, TF-WO-01

### 1. Camera permission

#### IP-CAM-01 · First camera request, allowed
Camera · **High**
- **Preconditions:** Fresh install; the camera has never been asked for. Account A signed in.
- **Steps:**
  1. Nutrition → Add food → **Scan** (or Nutrition Score → Scan a product).
  2. Read the iOS prompt and screenshot it. Tap **Allow**.
  3. Point at any food barcode.
- **Expected:** One prompt with the text "Narrow Gate Fitness uses the camera to scan food barcodes, photograph meals
  for nutrition estimates you confirm, and take progress and Body Scan photos…". After Allow the scanner opens straight
  away. A later progress photo or Body Scan doesn't ask again.
- **Evidence:** A screenshot of the prompt; a recording of the scanner opening.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-SCAN-01, DT-CAM-01…03

#### IP-CAM-02 · Camera refused
Camera · **High**
- **Preconditions:** Reinstall (or reset the camera to off in Settings).
- **Steps:**
  1. Open the scanner as in IP-CAM-01. Tap **Don't Allow**.
  2. Try again: the scanner, You → My Progress → add a progress photo, and Body Scan (Pro).
- **Expected:** No crash and no black camera screen left open. Each feature says the camera is off and how to turn it
  on (Settings → Narrow Gate Fitness → Camera). Typing a barcode by hand still works. iOS doesn't ask a second time.
- **Evidence:** A screenshot of each message.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-SCAN-08, DT-CAM-04

#### IP-CAM-03 · Camera re-enabled in Settings
Camera · **High**
- **Preconditions:** IP-CAM-02 done.
- **Steps:**
  1. Settings → Narrow Gate Fitness (iOS 18+: Settings → Apps → Narrow Gate Fitness) → turn **Camera** on.
  2. Return to the app (don't force-quit) and open the scanner again. Then force-quit, reopen and try again.
- **Expected:** The scanner works both without and after a relaunch. No stale "camera is off" message remains.
- **Evidence:** A recording.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-CAM-05

### 2. Barcode scanning

Materials: a packaged food with an **EAN-13** code (13 digits, common outside North America; the app's example is
`3017620422003`), one with a **UPC-A** code (12 digits, US/Canada), a creased or curved code, an item **not** in Open Food
Facts (a store's in-house label), and a QR code. Write down each item's digits.

#### IP-SCAN-01 · EAN-13 product
Scanning · **High**
- **Preconditions:** Camera allowed; online.
- **Steps:** Nutrition → Add food → Scan → scan the EAN-13 item. Log one serving to today's diary.
- **Expected:** A short haptic on reading. The right product (compare the name and brand with the pack). Its
  nutrition per serving or per 100 g is shown as on the label. After logging, one diary row and the day's totals
  update.
- **Evidence:** A recording from scan to diary, and a photo of the pack's label.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-SCAN-01, -03

#### IP-SCAN-02 · UPC-A product
Scanning · **High**
- **Steps:** As IP-SCAN-01 with the 12-digit UPC-A item.
- **Expected:** The right product is found. A UPC-A code is looked up with a leading 0 as well, so US products found in
  Open Food Facts must appear.
- **Evidence:** A screenshot of the result and a photo of the barcode digits.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-SCAN-02

#### IP-SCAN-03 · Damaged, curved or blurred code
Scanning · **High** if a wrong product appears, otherwise **Low**
- **Steps:** Try the creased code and the curved code three times each, then three times while deliberately moving or
  holding the phone too close to blur it. Time each try and give up after 20 s with Cancel.
- **Expected:** Each try either reads the **correct** product or reads nothing. **Never a different product.** A code
  that fails the check-digit test is refused with "That code (…) isn't a food product barcode (EAN or UPC). Try again
  or type the numbers." There is no read-time target: record the times and success rate.
- **Evidence:** A recording; a table of tries and seconds.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-SCAN-05

#### IP-SCAN-04 · Unknown product → manual entry, nothing invented
Scanning · **High** (Blocker if nutrition numbers are invented)
- **Steps:**
  1. Scan the item that isn't in Open Food Facts from Nutrition → Add food → Scan.
  2. Tap **Enter it manually**.
  3. Also scan it from Nutrition Score → Scan a product.
- **Expected:** "Barcode N isn't in Open Food Facts yet." with **Enter it manually** and **Scan another**. Manual entry
  opens with **empty** nutrition fields: no calories, macros or product name are guessed. Nutrition Score shows
  "Product not found… nothing is guessed". A product that is found but has no nutrition says "enter it manually from
  the label".
- **Evidence:** Screenshots of each screen.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-SCAN-04

#### IP-SCAN-05 · Poor light
Scanning · **Medium**
- **Steps:** In a dim room (one lamp, or evening light), scan the EAN-13 item three times. Note whether the scanner
  offers a torch, and try it if so.
- **Expected:** It reads the correct product or reads nothing, never a wrong one. Record the success rate and whether
  a torch was offered.
- **Evidence:** A recording.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-SCAN-05

#### IP-SCAN-06 · No network
Scanning · **High**
- **Steps:** Turn Airplane Mode on (and Wi-Fi off). Scan the EAN-13 item. Then turn Airplane Mode off and scan it again.
- **Expected:** Offline: "You're offline. Connect to the internet to look up products." There's no endless "Looking
  up…" and nothing is added to the diary. Back online, the lookup works.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-SCAN-09

#### IP-SCAN-07 · A QR code, cancelling, and typing the number
Scanning · **Medium**
- **Steps:**
  1. Scan a QR code.
  2. Open the scanner and tap Cancel.
  3. Type the EAN-13 digits in the barcode field instead of scanning.
- **Expected:** (1) It's refused as not a food barcode, with no crash. (2) You return to the previous screen and the
  camera indicator (green dot) goes off. (3) Typing finds the same product as scanning.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-SCAN-06, -07, -10

### 3. GPS runs and walks

GPS recording needs **Pro** (IP-IAP-02 first). Train → **Run** → Outdoor run / Outdoor walk → Start. Before each
outdoor case, set Auto-Lock to 30 seconds (Settings → Display & Brightness → Auto-Lock) so locking happens as it would
in real use.

#### IP-GPS-01 · Permission: Allow While Using App
GPS · **High**
- **Preconditions:** Fresh install, or Reset Location & Privacy. A with Pro. Outdoors.
- **Steps:**
  1. Train → Run → Outdoor walk. Check that nothing asked for location yet.
  2. Tap **Start**. Screenshot the prompt and copy its text. Tap **Allow While Using App**.
  3. Wait for "Recording". Walk 2 minutes, then Pause → discard.
- **Expected:** No location prompt before Start. The prompt shows one of the app's purpose strings ("…uses your
  location only during a run or walk you start…" or "Lets a run or walk you started keep recording while your phone is
  locked…"). "Waiting for GPS" changes to "Recording" once accuracy is within 20 m. GPS details never show your
  coordinates.
- **Evidence:** Screenshots of the prompt and of GPS details.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-GPS-01, -02

#### IP-GPS-02 · Permission: Always (the upgrade prompt)
GPS · **Medium**
- **Preconditions:** IP-GPS-01 done.
- **Steps:**
  1. Start another walk. If iOS shows "Change to Always Allow?", screenshot it. Choose **Keep Only While Using** the
     first time.
  2. On a later walk, choose **Change to Always Allow** if offered, or set it in Settings → Privacy & Security →
     Location Services → Narrow Gate Fitness → **Always**.
  3. Record a 5-minute walk with the phone locked.
- **Expected:** The prompts appear, are readable, and don't stop the recording. The app works with either answer: While
  Using plus background location is enough for a run started on screen. Record exactly when the Always prompt
  appeared. Known issue R1: the plugin asks for Always, and the owner still has to decide on it.
- **Evidence:** Screenshots of each prompt.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-GPS-01, -06

#### IP-GPS-03 · Permission: Precise Location off
GPS · **Medium**
- **Steps:** Settings → Privacy & Security → Location Services → Narrow Gate Fitness → **Precise Location** off. Start a
  walk and wait 1 minute. Then turn Precise on again.
- **Expected:** No distance is added from approximate positions. The recorder waits ("Waiting for GPS" or an
  approximate-location message) and explains why. Record the exact wording. With Precise back on, recording starts.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-GPS-09

#### IP-GPS-04 · Permission: Don't Allow, then allowed in Settings
GPS · **High**
- **Steps:**
  1. Reset location for the app (Ask Next Time). Start a walk and tap **Don't Allow**.
  2. Follow the app's button or path to Settings, set **While Using**, and return.
  3. Start again.
- **Expected:** (1) A clear message that location is off and how to turn it on, with no crash and no distance. (3)
  Recording starts.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-GPS-08

#### IP-GPS-05 · 2 km outdoor accuracy against a reference
GPS · [Outdoors] [Watch optional] · **High**
- **Preconditions:** A known **2.00 km** route: **5 laps in lane 1 of a 400 m track**, or a road route measured on a map
  tool (write down the source). If you use an Apple Watch as the reference, start an **Outdoor Walk/Run** workout on the
  watch at the same moment.
- **Steps:**
  1. Stand still 30 s at the start until the app says Recording. Start the reference at the same moment.
  2. Walk or run the route with the screen **on** and the phone in your hand or a pocket.
  3. Finish → Save. Note the app's distance, moving time and pace, and the reference's distance.
- **Expected:** The app's distance is within **±3% of the measured route: 1,940 to 2,060 m**. If only a watch was used,
  within ±3% of the watch. A watch is itself about 1–2% out, so prefer the measured route. The route on the map follows
  the path, with no spikes across buildings. Splits appear at each km or mile.
- **Evidence:** Screenshots of the app's summary and map, and of the watch summary; the measured route's source.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-ROUTE-01, -03

#### IP-GPS-06 · Pause and resume
GPS · [Outdoors] · **High**
- **Steps:** Start a walk. After 3 minutes tap **Pause**, walk about 200 m, tap **Resume**, walk 3 more minutes, then
  Finish.
- **Expected:** Nothing is added while paused: the distance doesn't grow and the moving time stops. The map line has a
  break at the pause. The saved walk's distance doesn't include the 200 m.
- **Evidence:** A recording of the pause and resume; a screenshot of the saved map.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-GPS-12

#### IP-GPS-07 · Screen locked for 10+ minutes
GPS · [Outdoors] · **High**
- **Steps:** Start a walk. Lock the phone and put it in a pocket. Walk **at least 12 minutes** on a known route. Unlock.
- **Expected:** While locked, iOS shows the blue location indicator (status-bar pill). After unlocking, the distance
  covers the whole locked walk (within ±3% of the route): no straight-line jump across the locked stretch, and no "signal
  lost" gap where you had open sky. It is the same recording (no "unfinished recording" offer).
- **Evidence:** A screenshot of the lock screen showing the indicator, and the map after unlocking.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-GPS-03; `GPS_BACKGROUND_IPHONE.md` tests 1–2

#### IP-GPS-08 · App backgrounded and other apps used
GPS · [Outdoors] · **High**
- **Steps:**
  1. Start a walk. Press Home (swipe up) and use Music, Maps or Messages for 5 minutes while walking.
  2. Return to the app.
  3. Then, inside the app, open Nutrition or Faith for 2 minutes and come back using the "Recording" pill.
- **Expected:** The recording continues in both cases. The timer and distance are right on return, and the route is
  continuous.
- **Evidence:** A recording of the return; a screenshot of the map.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-GPS-04; `GPS_BACKGROUND_IPHONE.md` tests 3–4

#### IP-GPS-09 · Incoming phone call
GPS · [Outdoors] · **High**
- **Steps:** During a walk, have someone call you. Answer and talk for 1 minute while walking, hang up, and return to
  the app.
- **Expected:** The recording survives, with no duplicate run and no reset timer. Distance walked during the call is
  counted, or shown as a gap, never invented.
- **Evidence:** A screenshot after the call.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-GPS-05

#### IP-GPS-10 · Force-quit mid-run and recovery
GPS · [Outdoors] · **Blocker** if the run is lost, otherwise **High**
- **Steps:**
  1. Start a walk and walk 3 minutes.
  2. Force-quit (swipe up from the bottom and hold, then swipe the app away). Check whether the blue location
     indicator disappears.
  3. Reopen the app and go to Run.
- **Expected:** "You have an unfinished run/walk" with **Continue** and **Discard** (offered for up to 12 hours).
  Continue keeps the time and distance recorded before the quit. The time while the app was closed shows as a gap, not
  distance. The blue indicator was gone after quitting, so location isn't left running.
- **Evidence:** A recording of steps 2–3.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-QUIT-07

#### IP-GPS-11 · Airplane Mode mid-run, then saved when back online
GPS · [Outdoors] · **Blocker** if the run is lost, otherwise **High**
- **Steps:**
  1. Start a walk. After 2 minutes turn **Airplane Mode on** (GPS keeps working without a network).
  2. Walk 3 more minutes. Finish → **Save**.
  3. Read the message. Turn Airplane Mode off. Save again, from the same screen or Run → **Review and save**.
- **Expected:** (1–2) Recording continues. Map tiles may not load, but distance keeps growing. (3) Offline: "You're
  offline. Your recording is kept on this device: save it when you're back online." Online: "Walk saved." It is saved
  **once**, with the full distance, and appears once in history.
- **Evidence:** A recording; a screenshot of history.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-OFF-08

#### IP-GPS-12 · Finished run kept offline, saved within 2 days
GPS · [Outdoors] · **High**
- **Steps:**
  1. Record a 3-minute walk, Finish, turn Airplane Mode on, and tap Save (it fails, as in IP-GPS-11).
  2. Force-quit. Leave the phone for **about 24 hours** (next day).
  3. Airplane Mode off. Open the app → Run.
  4. *(Optional)* Repeat with a recording left for **more than 48 hours**.
- **Expected:** (3) "Your walk from <time> wasn't saved yet… review and save it, or discard it." Review and save shows
  the same distance without turning location on, and saves it once. (4) After 2 days: "Recordings can be saved for up to
  2 days after they start. You can add it as a manual entry instead…" No crash, and nothing is silently lost.
- **Evidence:** Screenshots, with the phone's clock visible.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-OFF-08; `src/lib/domain/gps-track.ts` `SAVE_WINDOW_MS`

### 4. Background activity and battery

The owner hasn't set battery limits. The thresholds below are **proposed targets for the owner to confirm or
change**. They assume a phone from the last 4 years, battery health at least 85%, brightness at 50%, a 4G/5G or Wi-Fi
connection, and the screen locked for most of the recording. A result outside a target is reported as a Fail
(**High**) unless the owner changes the target.

| Measure | Proposed target (owner to confirm) |
|---|---|
| Battery used, 30-min locked GPS recording | **≤ 6 %** |
| Battery used, 60-min locked GPS recording | **≤ 12 %** |
| Older/second iPhone | at most 1.5× the above |
| Location after Finish/Discard | blue indicator off within 10 s; **0** background minutes after the recording ends |
| Heat | No "iPhone needs to cool down" warning. The phone is warm at most, not uncomfortable to hold. With a Mac, thermal state stays **Nominal or Fair**. |

#### IP-BAT-01 · 30-minute recorded walk/run
Battery · [Outdoors] · **High**
- **Preconditions:** Phone charged to at least 80% and **unplugged** for 10 minutes. Low Power Mode **off**. Close other
  apps that use location (navigation, fitness).
- **Steps:**
  1. Write down the battery %, the time and the outside temperature.
  2. Start a walk or run. Lock the phone. Go for **30 minutes**, unlocking once at 15 minutes for 10 s.
  3. Finish → Save. Write down the battery % and time straight away.
  4. Settings → Battery → Last 24 Hours → tap the hour bars covering the test. Screenshot the app list. Tap Narrow Gate
     Fitness and note its Screen Active and Background minutes.
- **Expected:** The drop meets the target. Narrow Gate's share is what you'd expect for a GPS recording. The recording
  is complete (as IP-GPS-07).
- **Evidence:** Before and after screenshots of the battery %, the Battery screen, and the saved walk.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-GPS-10

#### IP-BAT-02 · 60-minute recorded walk/run
Battery · [Outdoors] · **High**
- **Steps:** As IP-BAT-01 for **60 minutes** of locked recording. Also feel the phone at the end and note it as cool,
  warm or hot.
- **Expected:** The drop meets the target. The recording survives the full hour with no "unfinished recording" offer.
  No heat warning.
- **Evidence:** As IP-BAT-01.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-GPS-11

#### IP-BAT-03 · Location stops after a recording ends
Battery · **High**
- **Steps:**
  1. Finish and save a short walk. Watch the status bar for 10 s.
  2. Start another walk and **discard** it. Watch again.
  3. Leave the app in the background for 1 hour without recording, then check Settings → Battery for the app's
     Background minutes in that hour, and Settings → Privacy & Security → Location Services (the arrow icon next to
     the app shows recent use).
- **Expected:** The blue indicator and the location arrow go away after Finish or Discard. The app shows about **0
  background minutes** in the idle hour. Location isn't used when no recording is running.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: `GPS_BACKGROUND_IPHONE.md` limitation 2

#### IP-BAT-04 · Thermal state and energy impact
Battery · [Mac] · **Medium**
- **Steps:** With the phone connected to the Mac, run Instruments → **Energy Log** (or **Thermal State**) during a
  15-minute recording. Afterwards, check Xcode Organizer → Energy for reports from the TestFlight build.
- **Expected:** Thermal state stays Nominal or Fair. The energy log shows location as the main cost, with no constant
  high CPU while the screen is locked.
- **Evidence:** Exported Instruments trace or screenshots.
- ☐ Pass ☐ Fail ☐ Blocked

#### IP-BAT-05 · Older iPhone, 30 minutes
Battery · [2nd iPhone] [Outdoors] · **High**
- **Steps:** IP-BAT-01 on the second iPhone, ideally at the same time as on the main phone (carry both).
- **Expected:** At most 1.5× the main phone's target; the recording is complete; distance within ±3% of the main phone
  or the route.
- **Evidence:** As IP-BAT-01, for both phones.
- ☐ Pass ☐ Fail ☐ Blocked

### 5. Apple Health

The app **reads** Steps (You → My Progress → Steps card → **Sync Apple Health**) and Sleep, Heart Rate, HRV and
Respiratory Rate (You → My Progress → **Sleep & Recovery**, after the wellness consent). It writes nothing.

#### IP-HLT-01 · Permission sheet: grant all
Health · [Watch] · **High**
- **Preconditions:** Fresh install; Health never asked. A watch or app has written steps and sleep to Health.
- **Steps:**
  1. Steps card → Sync Apple Health. Screenshot the sheet. Turn on Steps → **Allow**.
  2. Sleep & Recovery → tick the consent → **Allow sleep logging**. If the Health sheet doesn't appear by itself, tap
     **Connect Apple Health**. Screenshot the sheet. **Turn On All** → Allow.
- **Expected:** The sheets list **read** access only, with **no write rows**, and show the app's explanation. Steps:
  "Synced N days from Apple Health." Sleep: nights appear, and the card reads "<device> via Apple Health · Last synced
  just now". Record whether the sleep sheet appeared on its own after consent.
- **Evidence:** Screenshots of both sheets and both results.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-HEALTH-01, -05, -07

#### IP-HLT-02 · Permission sheet: grant some
Health · [Watch] · **High**
- **Preconditions:** Reinstall, or use a category never granted.
- **Steps:** At the sleep sheet turn on **Sleep only**, leaving Heart Rate, HRV and Respiratory Rate off → Allow. Open
  last night.
- **Expected:** Nights import. The heart rate, HRV and breathing tiles say "Not recorded", with nothing estimated in
  their place. iOS doesn't tell apps about a refusal, so no "not allowed" text is expected.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-HEALTH-06

#### IP-HLT-03 · Permission sheet: deny all
Health · **High**
- **Preconditions:** Reinstall, with Health never asked.
- **Steps:** At both sheets, leave everything off → Allow (or tap **Don't Allow**). Then use the app normally for 2
  minutes.
- **Expected:** No crash. Steps: "No steps found — check Health > Sharing > Apps > Narrow Gate and turn on Steps." Sleep:
  "No sleep found in Apple Health…". Manual step and sleep entry still work. If the Settings path in the message doesn't
  match your iOS version, record it (Low).
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-HEALTH-04, -11

#### IP-HLT-04 · Steps import matches the Health app
Health · **High**
- **Steps:** Sync Apple Health. Note today's steps and the last 7 days' bars. In the Health app → Steps → **D** view,
  note today's and the previous 6 days' totals.
- **Expected:** Each day matches the Health app's daily total. Today's may lag by steps taken since the sync. Days with
  no steps are empty.
- **Evidence:** Screenshots of both apps.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-HEALTH-02

#### IP-HLT-05 · Sleep import matches the Health app
Health · [Watch] · **High**
- **Preconditions:** At least two nights recorded by the watch.
- **Steps:** Sleep & Recovery → Sync now. Open two recent nights. In the Health app → Sleep → the same nights → Show
  More Sleep Data.
- **Expected:** Start, end, time asleep and the stage totals (Core shows as light, plus deep, REM and awake) agree with
  Health, allowing for rounding. Stage totals never exceed the time in bed. "Recorded by <watch>". Heart rate shows
  average and min–max, HRV shows ms SDNN.
- **Evidence:** Screenshots of both apps for each night.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-HEALTH-07, `SLEEP_DEVICE_CHECKLIST.md`

#### IP-HLT-06 · Re-sync adds no duplicates
Health · **High**
- **Steps:** Tap Sync now twice, pull the Sleep hub down to refresh, then Sync Apple Health on Steps twice. Open the sleep
  history and the steps week.
- **Expected:** "Apple Health: 0 added, N already imported." No night appears twice, and step totals don't double.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-HEALTH-08

#### IP-HLT-07 · Manual step entry, then a sync
Health · **Medium**
- **Steps:** On the Steps card, enter today's steps by hand (a number clearly different from Health's) and save. Note
  the label. Tap Sync Apple Health.
- **Expected:** After the hand entry the label says "Entered by hand". After the sync, **the hand-entered number is
  kept** (the sync skips days entered by hand: `syncableDays` in `src/lib/domain/steps.ts`, `syncStepsAction` in
  `src/server/actions/steps.ts`) and the app says how many hand-entered days it kept. Other days take Health's numbers.
- **Evidence:** Screenshots before and after.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-HEALTH-03

#### IP-HLT-08 · Manual sleep entry that overlaps an imported night
Health · [Watch] · **Medium**
- **Steps:** Sleep → Manage → **Delete imported entries** → confirm. Enter last night by hand with times that overlap
  the watch's night. Sync now.
- **Expected:** The confirmation says your own entries stay and Health isn't touched. The sync says "1 skipped (overlap
  an entry you made)". Your hand entry stays as you entered it, and other nights come back.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-HEALTH-09

#### IP-HLT-09 · Access revoked in Health, and behaviour after
Health · **High**
- **Steps:** Health app → profile → Apps → Narrow Gate Fitness → **Turn Off All**. In the app: Sleep → Sync now; Steps →
  Sync Apple Health. Then the next morning, open the Sleep hub.
- **Expected:** No crash. The "No sleep found…" and "No steps found…" messages point you to Health. Nights and days
  imported earlier **stay**. Nothing new is imported.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-HEALTH-11

#### IP-HLT-10 · Disconnect, remove imported data, nothing written to Health
Health · **High**
- **Steps:**
  1. Sleep → Manage → Connected devices → **Disconnect** and choose to remove imported nights.
  2. Health app → Browse → Workouts, Steps and Sleep → Show All Data / Data Sources: look for any entry from Narrow Gate
     Fitness. Also check Health → profile → Apps → Narrow Gate Fitness for a "write" section.
  3. Record a GPS walk and a workout in the app, then check Health again.
- **Expected:** Imported nights are removed from the app and your own entries stay. **Health has no data written by
  Narrow Gate Fitness**: no workouts, steps or sleep. That is expected: workout write-back is **not in this build**.
- **Evidence:** Screenshots of the Health data sources.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-HEALTH-12

### 6. Notifications

Reminders live in **You → Notifications**. They are all off until you turn one on, and **permission is asked only
when you save a reminder that is on**. The rest timer (during a workout) and the wake-up alarm (Sleep & Recovery →
Alarm) are separate. All are local notifications: no internet is needed for them to arrive.

#### IP-NTF-01 · Permission: first ask
Notifications · **High**
- **Preconditions:** Fresh install.
- **Steps:**
  1. Use the app for 2 minutes. Confirm no notification prompt appears at launch.
  2. You → Notifications → turn on **Bible reading** → Save. Screenshot the iOS prompt. Tap **Allow**.
- **Expected:** The prompt appears only after Save, and only once. The screen then shows that notifications are
  allowed, and "Next 24 hours" lists the planned reminders.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-NOTIF-01

#### IP-NTF-02 · Permission denied, then allowed in Settings
Notifications · **High**
- **Steps:**
  1. Reinstall. Save a reminder and tap **Don't Allow**. Read the screen.
  2. Save another reminder. Check that no prompt appears again.
  3. Allow notifications in Settings → Notifications → Narrow Gate Fitness. Return to the app.
- **Expected:** (1) The screen says notifications are off and how to allow them, and Home shows a "Today's reminders"
  list instead. (2) There's no repeated prompt. (3) Back in the app, reminders are scheduled (the next-24-hours preview
  fills in) and they arrive.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-REST-04, -05; DT-NOTIF-01

#### IP-NTF-03 · Each reminder type is delivered
Notifications · **High**
- **Preconditions:** Notifications allowed. For workout and recovery reminders, an active program (from onboarding).
- **Steps:** For each row below, set the reminder 3–5 minutes ahead on today's weekday → Save. Then **force-quit** the
  app and **lock** the phone. Tick when it arrives, with sound (Ring/Silent switch on ring).

  | Group | Reminder | Arrived (time) | Text shown |
  |---|---|---|---|
  | Faith | Bible reading | | |
  | Faith | Prayer | | |
  | Faith | Evening check-in | | |
  | Faith | Devotional / Daily practices / Memory practice / Faith challenge / Fitness goal (pick at least two) | | |
  | Faith | Before midnight (strict journey only) | | |
  | Faith | Reading plan progress / Prayer follow-up (weekly; set today) | | |
  | Workouts | Scheduled workouts (on a training day) | | |
  | Workouts | This week's training plan (weekly) | | |
  | Workouts | Weekly progress review (weekly) | | |
  | Food & water | Breakfast / Lunch / Dinner / Snacks (at least two) | | |
  | Food & water | Water (every 1 h starting in 3 min) | | |
  | Recovery & sleep | Recovery days (on a rest day) | | |
  | Recovery & sleep | Wind down for sleep | | |
- **Expected:** Each arrives within a minute of the set time (iOS fires them on time), with the app closed and the
  phone locked. The text is the app's fixed wording: **never** your prayer or journal text, and never numbers about
  weight, calories, water or sleep. No day goes over the daily limit (8 by default).
- **Evidence:** Screenshots of the lock screen and Notification Centre; the filled table.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-NOTIF-02, -03, -12; `docs/NOTIFICATIONS.md` Categories

#### IP-NTF-04 · Rest timer notification with the phone locked
Notifications · **High**
- **Steps:** Start a workout, complete a set so the rest timer starts, and lock the phone. Wait for the rest to end.
  Repeat with the app in the background. Repeat once with the Ring/Silent switch on silent.
- **Expected:** A "Rest complete" notification with sound when it ends (locked and background). On silent: no sound,
  but the notification still appears.
- **Evidence:** A screen recording with the microphone on.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-REST-01…08

#### IP-NTF-05 · Wake-up alarm: Snooze and I'm up
Notifications · **High**
- **Steps:** Sleep & Recovery → Alarm → set it 3 minutes ahead → save. Lock the phone. When it fires, long-press it and
  tap **Snooze**. When it fires again, tap **I'm up**.
- **Expected:** It fires at the set minute with sound. Snooze brings it back after the snooze time. I'm up opens the
  app to say how you slept. Note that iOS can't ring like the Clock app's alarm: it is a notification.
- **Evidence:** A recording.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: `IOS_DEVICE_TEST_PLAN.md` 5.2

#### IP-NTF-06 · Quiet hours
Notifications · **High**
- **Steps:** You → Notifications → System → **Quiet hours** from now to 30 minutes from now → Save. Set a reminder 5
  minutes ahead (inside quiet hours) and another 35 minutes ahead (outside) → Save.
- **Expected:** The "Next 24 hours" preview leaves out the reminder inside quiet hours. It doesn't arrive, and the one
  outside does. Setting the same start and end time is refused ("Quiet hours need different start and end times.").
- **Evidence:** A screenshot of the preview and the lock screen afterwards.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: `docs/NOTIFICATIONS.md` System group

#### IP-NTF-07 · Time-zone change
Notifications · **High**
- **Steps:**
  1. Set a reminder for a clock time 10 minutes ahead → Save.
  2. Settings → General → Date & Time → turn **Set Automatically** off → choose a time zone **1 hour west** (for
     example New York to Chicago).
  3. Open the app → You → Notifications. Read the banner. Tap **Use <zone>** if offered.
  4. Afterwards, restore Set Automatically.
- **Expected:** The screen notices the phone's zone differs from the account's and offers "Use <zone>". After you
  accept, reminders follow the new local clock (the reminder you set for 9:00 fires at 9:00 local time), with **no
  duplicate** firing in the old zone. Record what happens if you **don't** tap Use.
- **Evidence:** Screenshots and the times notifications arrived.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-NOTIF-06

#### IP-NTF-08 · Disabled in the app
Notifications · **High**
- **Steps:** Turn off a reminder that is due in 5 minutes → Save. Then turn on **Pause all optional reminders** → Save,
  and wait past two other reminder times.
- **Expected:** The disabled reminder doesn't arrive, and nothing arrives while paused. The rest timer and the alarm
  still work (they are separate). Turning Pause off brings reminders back.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked

#### IP-NTF-09 · Disabled in iOS Settings
Notifications · **Medium**
- **Steps:** Settings → Notifications → Narrow Gate Fitness → **Allow Notifications** off. Wait past a reminder time.
  Open the app → You → Notifications.
- **Expected:** Nothing arrives. The app shows notifications are off and how to allow them, and doesn't re-prompt.
  Home shows "Today's reminders" instead.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked

#### IP-NTF-10 · Tapping a notification opens the right screen
Notifications · **High**
- **Steps:** Tap each notification type as it arrives, once with the app **force-quit** and once with it in the
  **background**: Bible reading, a meal, Scheduled workouts, Recovery, Wind down, Weekly review.
- **Expected:** Bible reading → the journey (if one is active) or the Bible. Meal or water → Nutrition. Workout →
  Train. Recovery → Recovery. Wind down → Sleep. Weekly review → My Progress. If you're signed out, you go to sign in
  and then to the app. It never opens a page outside the app.
- **Evidence:** A recording of each tap.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-NOTIF-04

#### IP-NTF-11 · No duplicates after reinstall
Notifications · **High**
- **Steps:**
  1. With three reminders on, delete the app. Wait past one reminder time.
  2. Reinstall from TestFlight, sign in as the same account, and allow notifications when asked (save once).
  3. Wait past the next reminder times.
- **Expected:** (1) Nothing arrives while the app is deleted. (3) Each reminder arrives **once**, with no doubles. You →
  Notifications → Devices lists this phone; if an old entry for the same phone remains, record it (Low).
- **Evidence:** Screenshots of Notification Centre.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-NOTIF-09, DT-SWITCH-04

#### IP-NTF-12 · Completing the activity cancels today's reminder
Notifications · **Medium**
- **Steps:** Set the Bible reading and Lunch reminders 10 minutes ahead. Before they fire, mark today's reading and log
  a lunch.
- **Expected:** Neither arrives today. Tomorrow's still do.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-NOTIF-05, TF-NOTIF-02

#### IP-NTF-13 · Lock-screen privacy and sign-out clean-up
Notifications · **Blocker** if private text appears, otherwise **High**
- **Steps:**
  1. Write a prayer journal entry with a distinctive phrase. Let a prayer reminder arrive on the lock screen.
  2. Sign out with reminders, an alarm and a rest timer pending. Wait past their times.
- **Expected:** (1) Only fixed reminder text; the phrase never appears. (2) Nothing arrives after sign-out.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: TF-FAITH-04, DT-SWITCH-04

### 7. Sign in with Apple

**Not in this build** (see "What this build actually contains"). The new account, Hide My Email, returning sign-in,
revoke and Apple-account deletion cases are **N/A**. Only this check runs:

#### IP-SIWA-01 · No third-party sign-in is offered
Sign-in · **High** (App Store guideline 4.8 applies if any social sign-in appears)
- **Steps:** Look at the welcome, Sign in and Sign up screens.
- **Expected:** Email and password only. There are no "Continue with Google/Facebook" buttons and no Sign in with
  Apple button. If any social sign-in appears, Sign in with Apple becomes required. Report it as High.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked

### 8. In-app purchases (TestFlight sandbox)

Plans & billing: **You → Plans & billing**. Products: Pro All Access monthly (`ngf_pro_monthly`, **$17.99** in the US
storefront) and yearly (`ngf_pro_yearly`, **$119.99**). Prices come from the App Store, in your storefront's currency.
Before starting, the owner confirms the accounts are on the sandbox tester list.

**"Nothing charged" check (applies to every purchase case):** each Apple sheet must say it is a TestFlight or Sandbox
purchase. After the run, check that **no real charge** appears in Settings → your name → Media & Purchases → View
Account → **Purchase History**, at reportaproblem.apple.com, or on the card's statement. A real charge is a **Blocker**.

#### IP-IAP-01 · Plans & billing screen and prices
Purchases · [TF] · **High** (Blocker if a price is wrong)
- **Preconditions:** A on Free. iPhone's App Store region = United States (Settings → your name → Media & Purchases →
  View Account → Country/Region). In another region, record the local prices.
- **Steps:** You → Plans & billing. Switch monthly ↔ yearly. Scroll to the end.
- **Expected:** "Loading App Store prices…" briefly, then **$17.99/month** and **$119.99/year** (if a saving is shown,
  it's 44%). Auto-renew terms ("renews automatically… unless cancelled at least 24 hours before the end of the current
  period… Manage or cancel any time in your Apple Account settings…"), Terms and Privacy links, and **Restore purchases**
  are all present. **No website or card checkout** anywhere in the app.
- **Evidence:** Screenshots of the whole screen.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-IAP-01

#### IP-IAP-02 · Buy monthly
Purchases · [TF] [Owner] · **Blocker**
- **Steps:** Choose **monthly → Subscribe**. Screenshot the Apple sheet. Confirm with Face ID or your password. Then open
  Train → Run → Outdoor run, and Body Scan.
- **Expected:** The sheet says TestFlight or Sandbox, with no real charge. Within a minute: "Welcome to Pro…", and Plans
  & billing shows Pro All Access, monthly. GPS and Body Scan open. The plan survives a force-quit. [Owner] RevenueCat
  shows the purchase as sandbox, and the webhook returned 200.
- **Evidence:** A recording from tap to unlock.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-IAP-02

#### IP-IAP-03 · Cancel the purchase sheet ("nothing charged")
Purchases · [TF] · **High**
- **Steps:** On a Free account, tap Subscribe and close the Apple sheet without confirming.
- **Expected:** "Purchase cancelled. You haven't been charged." The plan stays Free. No error loop.
- **Evidence:** Screenshot.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-IAP-04

#### IP-IAP-04 · Buy annual
Purchases · [TF] [Owner] · **Blocker**
- **Preconditions:** Account D (never bought), signed in on a phone whose Apple Account has no active Narrow Gate
  subscription. Use the second iPhone with a different Apple Account, or wait until A's subscription has expired.
- **Steps:** Choose **yearly → Subscribe** → confirm.
- **Expected:** As IP-IAP-02, with Plans & billing showing **Yearly**.
- **Evidence:** A recording.
- ☐ Pass ☐ Fail ☐ Blocked

#### IP-IAP-05 · Upgrade monthly → annual
Purchases · [TF] · **High**
- **Preconditions:** A on monthly (IP-IAP-02).
- **Steps:** Plans & billing → yearly → **Switch to yearly · <price>** → confirm in the Apple sheet. Pull down to
  refresh after a minute. Check again after the next renewal.
- **Expected:** The app explains that the App Store moves the subscription and confirms when it takes effect. Apple
  applies a same-level duration change **at the next renewal**. Pro stays on throughout, with no Free gap and no second
  subscription. After the renewal, Plans & billing shows Yearly.
- **Evidence:** Screenshots before and after.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-IAP-05

#### IP-IAP-06 · Cancel, then accelerated expiry
Purchases · [TF] · **High** (Blocker if access never ends, or ends early)
- **Steps:**
  1. Plans & billing → **Manage subscription** → cancel in Apple's screen. Return and pull to refresh.
  2. Wait for the period to end: about a day in TestFlight, or minutes with a sandbox account (see "Before you start" §4).
     Pull to refresh Plans & billing.
  3. Open a saved run and a Body Scan from the Pro period. Try to start a GPS run.
- **Expected:** (1) Apple's subscription management opens. After cancelling: "set to cancel… until <date>", and Pro
  continues until then. (2) After the date: back to Free. (3) **Nothing is deleted**: saved runs and scans can be
  viewed. Pro-only screens lock with a free alternative (manual run entry).
- **Evidence:** Screenshots with the clock visible.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-IAP-06, -07, TF-IAP-HIST

#### IP-IAP-07 · Restore after reinstall
Purchases · [TF] · **Blocker**
- **Preconditions:** An active subscription on A.
- **Steps:** Delete the app, reinstall from TestFlight, sign in as A. If it still shows Free, tap **Restore purchases**.
- **Expected:** Pro is back (straight away from the account, or after "Purchases restored. You're on Pro All Access.").
  No second purchase is offered as the only way out.
- **Evidence:** A recording.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-IAP-08

#### IP-IAP-08 · Restore on a second device
Purchases · [TF] [2nd iPhone] · **High**
- **Preconditions:** The second iPhone signed in to the **same Apple Account** as the main phone, with the TestFlight
  build installed.
- **Steps:** Sign in as A → Plans & billing → **Restore purchases**.
- **Expected:** "Purchases restored. You're on Pro All Access." Both phones show Pro. Pro also shows when A signs in on
  the website.
- **Evidence:** Screenshots from both phones.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-IAP-09

#### IP-IAP-09 · Restore onto a different app account
Purchases · [TF] [Owner] · **Blocker** if both accounts get Pro
- **Steps:** On the phone whose Apple Account bought for A, sign out, sign in as **B**, and tap Restore purchases. Then
  sign in as A again.
- **Expected:** The purchase **moves** to B (RevenueCat transfer). B shows Pro and A goes back to Free. **Both
  accounts never have Pro from one purchase.** [Owner] Note: a sandbox purchase moved to an account not on the tester
  list grants nothing.
- **Evidence:** Screenshots of both accounts.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-IAP-10

#### IP-IAP-10 · Ask to Buy / interrupted purchase
Purchases · [Mac] [Owner] · **Medium**
- **Preconditions:** A development build with a sandbox account set to **Interrupt Purchases** (App Store Connect →
  Sandbox → the tester → Interrupted Purchases), or Xcode's StoreKit testing with "Enable Ask to Buy". In a TestFlight
  build without these, mark Blocked.
- **Steps:** Subscribe as D. Complete or approve the interruption when asked.
- **Expected:** While it waits: "Your purchase is waiting for approval (for example, Ask to Buy). Your plan updates once
  it's approved." The plan stays Free until approval, then turns Pro. No double purchase.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked

#### IP-IAP-11 · Refund
Purchases · [Mac] [Owner] · **High**
- **Preconditions:** A refund can be produced in the sandbox: Xcode's StoreKit Transaction Manager, or an owner-side
  sandbox refund. The app has no in-app "request refund" button. Otherwise mark Blocked.
- **Steps:** Refund the active subscription. Pull to refresh Plans & billing within a few minutes.
- **Expected:** Pro access ends at the refund time. History is kept. [Owner] RevenueCat shows the refund, and the
  webhook returned 200.
- **Evidence:** Screenshots; owner's RevenueCat screenshot.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-IAP-11

#### IP-IAP-12 · A website subscriber isn't offered a second subscription
Purchases · [Owner] · **Blocker** if a second purchase is offered
- **Preconditions:** Account W, subscribed on the test website with **Stripe test mode** only.
- **Steps:** Sign in as W in the app → Plans & billing.
- **Expected:** "Your membership was purchased outside the App Store. Manage it where you subscribed; it works here
  too." No Apple purchase button is offered for the plan W already has.
- **Evidence:** Screenshot.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-IAP-13

#### IP-IAP-13 · Nothing charged: end-of-run check
Purchases · [TF] · **Blocker**
- **Steps:** After all the purchase cases: Settings → your name → Media & Purchases → View Account → **Purchase
  History**, and **Subscriptions**. Also check the card used by that Apple Account.
- **Expected:** No real charge for Narrow Gate Fitness. TestFlight or sandbox subscriptions are absent from real history
  or marked as test. Record what you see.
- **Evidence:** Screenshots with personal details covered.
- ☐ Pass ☐ Fail ☐ Blocked

### 9. Performance

Use the **TestFlight** build: a development build from Xcode is slower and doesn't count. The app loads the deployed
site, so record **Wi-Fi or cellular** and signal bars for every timing. The targets below are **proposed, for the owner
to confirm**.

| Measure | Proposed target (owner to confirm) |
|---|---|
| Cold start: tap the icon → Home usable, **skipping** the opening (tap Skip/Enter as soon as possible), on Wi-Fi | ≤ **3 s** on the main iPhone; ≤ **5 s** on the older iPhone |
| Warm start: return from the background → screen usable | ≤ **1 s** |
| Scrolling | No visible stutter; no blank white areas while scrolling |
| 2D exercise demo | Smooth playback with no freeze or jump. Start within 1 s of opening. |

#### IP-PERF-01 · Cold start time
Performance · [TF] · **Medium** (High if over twice the target)
- **Steps:** Force-quit. Start a screen recording, then tap the app icon. Tap through the opening at once. Stop when
  Home is usable (buttons respond). Repeat 3 times on Wi-Fi and once on cellular. Afterwards, measure the time from the
  recording (scrub frame by frame).
- **Expected:** The median of the 3 Wi-Fi runs meets the target. No white flash and no "You're offline" page on a good
  connection.
- **Evidence:** The recordings and a list of the times. [Mac] Organizer → Launch Time if available.
- ☐ Pass ☐ Fail ☐ Blocked

#### IP-PERF-02 · Warm start and returning from the background
Performance · [TF] · **Medium**
- **Steps:** Use the app, press Home, open another app for 1 minute, return. Repeat after 20 minutes away.
- **Expected:** It returns to the same screen within the target. The opening doesn't replay. After a long time away, a
  reload is acceptable, but it must land on the same section and lose no unsaved input you had typed.
- **Evidence:** Recordings.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: `IOS_DEVICE_TEST_PLAN.md` 1.3

#### IP-PERF-03 · Scrolling the exercise library
Performance · [TF] · **Medium**
- **Steps:** Train → Exercises. Fling-scroll from top to bottom and back 3 times. Search and filter once.
- **Expected:** Smooth scrolling. Images and demos appear without long blank gaps, and search results appear without
  freezing the screen.
- **Evidence:** A screen recording.
- ☐ Pass ☐ Fail ☐ Blocked

#### IP-PERF-04 · Scrolling history
Performance · [TF] · **Medium**
- **Preconditions:** At least 10 workouts and 5 runs logged. Combine with other cases or ask the owner to seed the
  account.
- **Steps:** Train → History; Run → Activities; Nutrition → previous days. Scroll quickly.
- **Expected:** Smooth, with no duplicate rows and no jumps back to the top.
- **Evidence:** A recording.
- ☐ Pass ☐ Fail ☐ Blocked

#### IP-PERF-05 · 2D exercise demo smoothness
Performance · [TF] · **Medium**
- **Steps:** Open 5 different exercises with demos (from the library and from inside a workout). Watch each loop twice,
  enlarge one, and scrub one if a scrubber is offered.
- **Expected:** Smooth motion with no stutter, freeze or jump between frames. Where no demo exists, a labelled
  placeholder or pose frames show instead of a broken image. Nothing claims to be 3D.
- **Evidence:** A screen recording at full frame rate.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: REGRESSION_CHECKLIST T8

#### IP-PERF-06 · 30-minute session: memory and crashes
Performance · [TF] [Mac for logs] · **High**
- **Steps:** Use every tab for 30 minutes: a workout with demos, the scanner twice, Run (no recording), Faith reader,
  photos, Plans & billing. Then check Settings → Privacy & Security → Analytics & Improvements → Analytics Data for
  `JetsamEvent` or app crash files from that period. [Mac] Organizer → Crashes and Memory; Instruments → Allocations for
  steady growth.
- **Expected:** No crash and no unexpected reload (white flash back to Home). No crash or memory-kill file for the app.
- **Evidence:** A list of the Analytics files (names and times); [Mac] screenshots.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: `TESTFLIGHT_INTERNAL_CHECKLIST.md` §9

#### IP-PERF-07 · Older or smaller iPhone pass
Performance · [TF] [2nd iPhone] · **High**
- **Steps:** On the second iPhone (ideally iOS 16.x, small screen), run IP-SET-01, IP-PERF-01, IP-PERF-03, IP-PERF-05,
  IP-SCAN-01, IP-GPS-01, IP-NTF-01 and IP-IAP-01. Also check every tab for cut-off text or buttons under the notch or
  home bar.
- **Expected:** Each case passes as on the main phone, within the older-phone targets. The layout fits with no
  sideways scrolling.
- **Evidence:** As each case, prefixed with the device name.
- ☐ Pass ☐ Fail ☐ Blocked

### 10. Offline recovery

#### IP-OFF-01 · Airplane Mode during a workout
Offline · **Blocker** if sets are lost or doubled
- **Steps:**
  1. Start today's workout and complete 1 set online.
  2. Airplane Mode on. Complete 3 more sets and note the status ("Saved on device").
  3. Force-quit. Reopen while still offline (you'll see the offline page). Airplane Mode off → **Try again**.
  4. Return to the workout and finish it.
  5. On a computer, sign in as the same account on the website → History.
- **Expected:** (2) Logging continues. (3–4) The workout resumes at the same set with all 4 sets. (5) The workout
  appears **once**, with exactly 4 sets.
- **Evidence:** A recording of the phone; a screenshot of the website.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-OFF-01…05, DT-QUIT-06

#### IP-OFF-02 · Food logging offline
Offline · **High**
- **Steps:**
  1. With Nutrition open, turn Airplane Mode on. Log a food from Recent or by entering it by hand → Save.
  2. Read the message. Turn Airplane Mode off. Tap Save or Retry in the same dialog.
  3. Check the day's diary.
- **Expected:** (1–2) A clear "couldn't save" or offline message. The dialog and your numbers **stay**, and nothing
  silently disappears. (3) After the retry the food appears **once** (the retry reuses the same save id). Food search
  offline says "You're offline — search needs a connection."
- **Evidence:** A recording.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: TF-OFF-FOOD

#### IP-OFF-03 · Journey check-in offline
Offline · **High**
- **Preconditions:** An active reading journey.
- **Steps:**
  1. Faith → the journey. Airplane Mode on. Mark today's reading (and prayer) done.
  2. Force-quit. Reopen offline, then turn Airplane Mode off and open any screen.
  3. Mark the same item again on purpose.
- **Expected:** (1) "You're offline. Saved on this device; it will count when you reconnect, if that's before 3 a.m."
  (2) After reconnecting: "Bible reading you marked offline is saved." (3) Counted **once**, and the day's progress
  isn't doubled.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked

#### IP-OFF-04 · Launching with no connection, then reconnecting
Offline · **High**
- **Steps:** Force-quit. Airplane Mode on. Open the app. Tap the offline Bible if offered. Turn Airplane Mode off →
  **Try again**.
- **Expected:** The "You're offline" page with Try again, plus the bundled offline Bible, which opens and reads. Try
  again loads the app and you're still signed in.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: `IOS_DEVICE_TEST_PLAN.md` 1.4; TF-FAITH-03

#### IP-OFF-05 · Wi-Fi with no internet behind it
Offline · **Medium**
- **Steps:** Join a Wi-Fi network with no internet (a phone hotspot whose own data is off). Log a set, log a food, and
  open a new screen.
- **Expected:** The same handling as Airplane Mode: clear messages, nothing lost, and nothing duplicated once a real
  connection returns.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-OFF-06

#### IP-OFF-06 · No duplicates after reconnecting (summary check)
Offline · **Blocker** if anything is duplicated
- **Steps:** After IP-OFF-01…03 and IP-GPS-11/12, check on the website and in the app: workout history, runs, the food
  diary, and journey progress.
- **Expected:** Each item made offline appears exactly once.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked

### 11. Account deletion

You → Privacy & data → **Delete account**: type **DELETE** and your password → **Delete my account**.

#### IP-DEL-01 · Deleting a Free account end to end
Account · [Owner] · **Blocker**
- **Preconditions:** Account C (Free) with a workout, a progress photo, synced steps, a reminder on, and an unfinished
  workout on the phone.
- **Steps:**
  1. Try with the field empty, with lower-case "delete", and with a wrong password.
  2. Screenshot the Delete account section. Delete with DELETE and the right password.
  3. Force-quit and reopen. Try to sign in as C in the app and on the website.
  4. Wait past C's reminder time.
- **Expected:** (1) "Type DELETE to confirm." and "That password isn't right." Nothing is deleted. (2) The section says
  what deletion does, **including the App Store subscription guidance** ("If you subscribed through the App Store…
  deleting your account doesn't stop those charges: cancel in your iPhone's Settings → your name → Subscriptions"). You
  land signed out on the welcome page. (3) **Sign-in as C fails everywhere.** (4) No reminder for C arrives. [Owner]
  The auth user and C's photo folders are gone.
- **Evidence:** A recording; the owner's screenshot.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-DEL-01, -02

#### IP-DEL-02 · Deleting an App Store subscriber: guidance shown
Account · [TF] [Owner] · **Blocker** if the warning is missing
- **Preconditions:** An account with an active TestFlight or sandbox Pro subscription. A fresh account on the tester
  list that bought monthly works.
- **Steps:** You → Privacy & data. Screenshot. Delete the account. Then Settings → your name → Subscriptions.
- **Expected:** Above the form: "Your Pro All Access subscription is billed by the App Store. Deleting your account won't
  cancel it — cancel it first…". Deletion completes. The Apple subscription is **still active** in Settings, as
  expected, because the app can't cancel it. The tester then cancels it there. [Owner] The RevenueCat customer record is
  deleted.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-DEL-03

#### IP-DEL-03 · The same phone afterwards
Account · **Blocker** if any of the deleted account's data shows
- **Steps:** After IP-DEL-01, create a new account E on the same phone. Check Home, Train (no Resume workout), Run (no
  unfinished run), the forms, photos, and You → Notifications.
- **Expected:** Nothing from C appears.
- **Evidence:** Screenshots.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-DEL-05

### 12. Accessibility on the device

#### IP-A11Y-01 · VoiceOver: workout flow
Accessibility · **High**
- **Steps:** Settings → Accessibility → **VoiceOver** on. (Tip: set Accessibility Shortcut to VoiceOver, then
  triple-click the side button to toggle it.) Using swipes only: Home → start today's workout → enter weight and reps →
  complete a set → let the rest timer run → finish.
- **Expected:** Every control is spoken with a meaningful name ("Mark Back Squat set 1 complete", not "button"). The
  order is logical. The set's completion and the rest ending are announced. You can finish without sighted help.
- **Evidence:** A screen recording with the microphone on, so the speech is captured.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: TF-A11Y-01

#### IP-A11Y-02 · VoiceOver: other main flows
Accessibility · **High**
- **Steps:** With VoiceOver: the tab bar (all five tabs), log a food by search, open the scanner and cancel, Run start
  screen, Faith reader (read a verse), You → Plans & billing (hear the prices and the Subscribe button), You →
  Notifications (turn one on).
- **Expected:** The tabs announce which is selected. There are no unlabelled buttons. Prices and renewal terms are read
  out. Dialogs keep VoiceOver focus inside until closed.
- **Evidence:** Recordings with sound.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: TF-A11Y-02

#### IP-A11Y-03 · Dynamic Type at the largest size
Accessibility · **Medium** (High if a core action can't be reached)
- **Steps:** Settings → Accessibility → Display & Text Size → **Larger Text** → turn on Larger Accessibility Sizes →
  drag to the **largest**. Go through Home, a workout set card, Nutrition add food, Faith reader, Run, Plans &
  billing, and Delete account. Repeat at the largest non-accessibility size.
- **Expected:** The text grows. Nothing is clipped or overlapping in a way that hides meaning. Every button (Complete
  set, Save, Subscribe, Restore, Delete) can still be reached and tapped. No sideways scrolling.
- **Evidence:** Screenshots of each screen at the largest size.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: TF-A11Y-03

#### IP-A11Y-04 · Reduce Motion
Accessibility · **Medium**
- **Steps:** Settings → Accessibility → Motion → **Reduce Motion** on. Force-quit and reopen. Finish a workout (the
  celebration) and open an exercise demo.
- **Expected:** The opening is a short fade, not the full animation. Celebrations and progress rings are static or
  reduced. Demos still play when you start them, or offer a play control.
- **Evidence:** Recordings.
- ☐ Pass ☐ Fail ☐ Blocked · Detail: DT-QUIT-08, TF-A11Y-04

---

## Summary table

Copy this table for each run. Result: Pass / Fail / Blocked / N/A. [TF] = needs the TestFlight build itself; [Mac] =
needs a Mac with Xcode for at least part of it.

| ID | Title | Labels | Severity if it fails | Result |
|---|---|---|---|---|
| IP-SET-01 | Install, first launch, build recorded | TF | Blocker | |
| IP-CAM-01 | First camera request, allowed | | High | |
| IP-CAM-02 | Camera refused | | High | |
| IP-CAM-03 | Camera re-enabled in Settings | | High | |
| IP-SCAN-01 | EAN-13 product | | High | |
| IP-SCAN-02 | UPC-A product | | High | |
| IP-SCAN-03 | Damaged, curved or blurred code | | High (wrong product) / Low | |
| IP-SCAN-04 | Unknown product → manual entry, nothing invented | | High (Blocker if invented) | |
| IP-SCAN-05 | Poor light | | Medium | |
| IP-SCAN-06 | No network | | High | |
| IP-SCAN-07 | QR code, cancel, typed number | | Medium | |
| IP-GPS-01 | Permission: Allow While Using App | Outdoors | High | |
| IP-GPS-02 | Permission: Always (upgrade prompt) | Outdoors | Medium | |
| IP-GPS-03 | Permission: Precise Location off | | Medium | |
| IP-GPS-04 | Permission: Don't Allow, then Settings | | High | |
| IP-GPS-05 | 2 km accuracy vs reference (±3%) | Outdoors, Watch optional | High | |
| IP-GPS-06 | Pause and resume | Outdoors | High | |
| IP-GPS-07 | Screen locked 10+ minutes | Outdoors | High | |
| IP-GPS-08 | App backgrounded, other apps used | Outdoors | High | |
| IP-GPS-09 | Incoming phone call | Outdoors | High | |
| IP-GPS-10 | Force-quit mid-run and recovery | Outdoors | Blocker / High | |
| IP-GPS-11 | Airplane Mode mid-run, save when online | Outdoors | Blocker / High | |
| IP-GPS-12 | Finished run kept offline, saved within 2 days | Outdoors | High | |
| IP-BAT-01 | 30-minute recorded run, battery | Outdoors | High | |
| IP-BAT-02 | 60-minute recorded run, battery | Outdoors | High | |
| IP-BAT-03 | Location stops after a recording ends | | High | |
| IP-BAT-04 | Thermal state and energy impact | Mac | Medium | |
| IP-BAT-05 | Older iPhone, 30 minutes | 2nd iPhone, Outdoors | High | |
| IP-HLT-01 | Health sheet: grant all | Watch | High | |
| IP-HLT-02 | Health sheet: grant some | Watch | High | |
| IP-HLT-03 | Health sheet: deny all | | High | |
| IP-HLT-04 | Steps import matches Health | | High | |
| IP-HLT-05 | Sleep import matches Health | Watch | High | |
| IP-HLT-06 | Re-sync adds no duplicates | | High | |
| IP-HLT-07 | Manual step entry kept after a sync | | Medium | |
| IP-HLT-08 | Manual sleep overlapping an imported night | Watch | Medium | |
| IP-HLT-09 | Access revoked in Health | | High | |
| IP-HLT-10 | Disconnect; nothing written to Health | | High | |
| IP-NTF-01 | Permission: first ask | | High | |
| IP-NTF-02 | Permission denied, then allowed | | High | |
| IP-NTF-03 | Each reminder type delivered | | High | |
| IP-NTF-04 | Rest timer notification, locked | | High | |
| IP-NTF-05 | Wake-up alarm: Snooze and I'm up | | High | |
| IP-NTF-06 | Quiet hours | | High | |
| IP-NTF-07 | Time-zone change | | High | |
| IP-NTF-08 | Disabled in the app | | High | |
| IP-NTF-09 | Disabled in iOS Settings | | Medium | |
| IP-NTF-10 | Tap opens the right screen | | High | |
| IP-NTF-11 | No duplicates after reinstall | | High | |
| IP-NTF-12 | Completion cancels today's reminder | | Medium | |
| IP-NTF-13 | Lock-screen privacy and sign-out clean-up | | Blocker / High | |
| IP-SIWA-01 | No third-party sign-in offered (Sign in with Apple not in build) | | High | |
| IP-IAP-01 | Plans & billing screen and prices ($17.99 / $119.99) | TF | High (Blocker if price wrong) | |
| IP-IAP-02 | Buy monthly | TF, Owner | Blocker | |
| IP-IAP-03 | Cancel the purchase sheet | TF | High | |
| IP-IAP-04 | Buy annual | TF, Owner | Blocker | |
| IP-IAP-05 | Upgrade monthly → annual | TF | High | |
| IP-IAP-06 | Cancel, then accelerated expiry | TF | High | |
| IP-IAP-07 | Restore after reinstall | TF | Blocker | |
| IP-IAP-08 | Restore on a second device | TF, 2nd iPhone | High | |
| IP-IAP-09 | Restore onto a different app account | TF, Owner | Blocker (double grant) | |
| IP-IAP-10 | Ask to Buy / interrupted purchase | Mac, Owner | Medium | |
| IP-IAP-11 | Refund | Mac, Owner | High | |
| IP-IAP-12 | Website subscriber not offered a second subscription | Owner | Blocker | |
| IP-IAP-13 | Nothing charged: end-of-run check | TF | Blocker | |
| IP-PERF-01 | Cold start time | TF | Medium | |
| IP-PERF-02 | Warm start and return from background | TF | Medium | |
| IP-PERF-03 | Scrolling the exercise library | TF | Medium | |
| IP-PERF-04 | Scrolling history | TF | Medium | |
| IP-PERF-05 | 2D exercise demo smoothness | TF | Medium | |
| IP-PERF-06 | 30-minute session: memory and crashes | TF, Mac for logs | High | |
| IP-PERF-07 | Older or smaller iPhone pass | TF, 2nd iPhone | High | |
| IP-OFF-01 | Airplane Mode during a workout | | Blocker | |
| IP-OFF-02 | Food logging offline | | High | |
| IP-OFF-03 | Journey check-in offline | | High | |
| IP-OFF-04 | Launching offline, reconnecting | | High | |
| IP-OFF-05 | Wi-Fi with no internet | | Medium | |
| IP-OFF-06 | No duplicates after reconnecting | | Blocker | |
| IP-DEL-01 | Deleting a Free account end to end | Owner | Blocker | |
| IP-DEL-02 | Deleting an App Store subscriber: guidance | TF, Owner | Blocker | |
| IP-DEL-03 | The same phone afterwards | | Blocker | |
| IP-A11Y-01 | VoiceOver: workout flow | | High | |
| IP-A11Y-02 | VoiceOver: other main flows | | High | |
| IP-A11Y-03 | Dynamic Type at the largest size | | Medium | |
| IP-A11Y-04 | Reduce Motion | | Medium | |

**Counts:** 85 cases: Setup 1, Camera 3, Scanning 7, GPS 12, Battery 5, Health 10, Notifications 13, Sign in with
Apple 1 (the rest N/A), Purchases 13, Performance 7, Offline 6, Account deletion 3, Accessibility 4.

**Sign-off:** ready for external TestFlight only when there are no open Blocker or High failures, every Blocker-level
case has a Pass with evidence, and the owner has confirmed or changed the proposed battery and performance targets.

---

## What this script cannot prove

- **Long-term battery and reliability across many users, phones and iOS versions.** One or two phones on a few days show
  that it can work, not how it behaves across the user base. Xcode Organizer's energy, hang and crash metrics only
  mean something after many TestFlight or App Store users.
- **App Review's outcome.** Passing here doesn't mean Apple will approve the app (for example on HealthKit use, the
  Always-location request R1, subscription wording, or guideline 4.2 for an app that loads a website).
- **Real money.** Every purchase here is TestFlight or sandbox. Production pricing in every storefront, tax, real
  renewals, real refunds, family sharing, billing retry and grace on real cards, and production RevenueCat webhooks are
  not exercised.
- **Long sandbox lifecycles.** Accelerated renewals compress months into minutes or days. Behaviour at real month and
  year boundaries, offer codes and price increases is untested.
- **GPS accuracy in general.** One measured route and one watch comparison, in one place and one weather, don't
  establish accuracy in dense cities, forests, tunnels or for every phone model. `DEVICE_TEST_SCRIPT.md` §3 has further
  route cases.
- **Every Health source.** Only the watch or app the tester owns is exercised. Oura, Garmin, WHOOP and others are
  covered only by `docs/WEARABLES.md` research.
- **Background Health sync, Health write-back, Sign in with Apple, push notifications, universal links and a watch
  app.** They aren't in this build, so nothing here says they work.
- **Server-side load, security and data isolation at scale.** Covered by the automated and integration suites
  (`docs/release/REGRESSION_CHECKLIST.md`), not by one tester.
- **AI Coach quality.** See `TESTFLIGHT_ACCEPTANCE.md` area 7 and `docs/LIVE_AI_TEST_PLAN.md`. It needs a live key the
  owner controls.
- **iPad, Android, and iOS versions below 16.0.** Android has its own checklist
  (`docs/device-testing/ANDROID_HEALTH_CONNECT_CHECKLIST.md`).
- **Daylight-saving transitions at the real date** and **reminders over weeks.** IP-NTF-07 changes the time zone only.
  DT-NOTIF-07 (daylight saving) needs the phone's date changed and is left to `docs/NOTIFICATIONS.md`.
