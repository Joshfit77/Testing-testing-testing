# iPhone device test plan (internal TestFlight)

What to try on a physical iPhone once the TestFlight build installs, in the order that finds problems fastest. Nothing below has run on hardware yet; the CI Simulator run covers only launch, the opening, relaunch and background/foreground. Record each line as pass / fail / not tried, with the iPhone model and iOS version.

Before starting: the deployed site must answer at `https://<your address>/api/health`, and the build must have been synced with that address (`docs/TESTFLIGHT.md`). Sign in with a test account on a test deployment (Stripe test keys, `REVENUECAT_ALLOW_SANDBOX=true`).

## 1. Install, launch, navigation (10 min)

| # | Step | Expect | Code |
|---|---|---|---|
| 1.1 | Install from TestFlight, open | Splash (black, gold icon) then the cinematic opening: gate, light, Matthew 7:13–14, Enter Narrow Gate; welcome page after ~5 s or on Enter | `src/lib/opening.ts`, `capacitor.config.ts` SplashScreen |
| 1.2 | Force-quit, reopen | Opening plays again | opening replays on every full load |
| 1.3 | Swipe to Home, reopen from the app switcher | No replay; app resumes where it was | `visibilityState` rule in `opening.ts` |
| 1.4 | Airplane mode, force-quit, reopen | "You're offline" page with a retry; turn Wi-Fi on, retry loads the app | `native-shell/error.html`, `server.errorPath` |
| 1.5 | Sign up or sign in; force-quit; reopen | Still signed in | Supabase session cookies in WKWebView |
| 1.6 | Walk through the five tabs, open a workout, the exercise library, an exercise demo, Faith, Progress | No layout cut off by the notch/home indicator; tab bar above the home indicator; keyboard pushes forms up, tab bar hides | `contentInset: never`, Keyboard plugin, `keyboard-avoidance.tsx` |
| 1.7 | Settings → Accessibility → Reduce Motion on; reopen the app | Opening is a short fade, confetti and rings static | `prefers-reduced-motion` in `globals.css`; Profile → Display "reduce motion" |
| 1.8 | Settings → Display → larger text | App text scales; nothing overlaps | Profile → Display text size |

## 2. Apple Health and Sleep & Recovery (20 min, needs an Apple Watch or another app writing sleep to Health)

| # | Step | Expect | Code |
|---|---|---|---|
| 2.1 | Profile → Steps → connect Apple Health | iOS Health sheet lists Steps (read); allow | `src/lib/native-health.ts:67` |
| 2.2 | Sleep & Recovery → Goal & privacy → wellness consent, then Connect Apple Health | Health sheet lists Sleep, Heart Rate, Heart Rate Variability, Respiratory Rate (read only; no write rows) | `src/lib/native-sleep.ts:53`; `Info.plist` NSHealthShareUsageDescription |
| 2.3 | Allow only Sleep, deny the vitals | Import works; nights show no HR/HRV/breathing; nothing is estimated in their place; settings page says which series were denied | `vitalsDenied`, "Nothing is estimated" (`sleep-import.ts:173-177`) |
| 2.4 | Allow all four; Sync now | Nights from the watch appear with stages (light/deep/REM/awake), overnight HR avg/min/max, HRV (with method), breathing rate, device name; a phone-only "asleep" record shows no stages | `samplesToSessions`, `oneSourceNoOverlap`, `summarizeVitals` |
| 2.5 | Sync now again | "0 added, N duplicates"; nothing doubled | `source_id` dedupe in `actions/sleep-import.ts` |
| 2.6 | Log a night by hand that overlaps an imported one, then Sync now | The import skips the overlap and says so | `conflicts` count |
| 2.7 | Open a night → nightly score | Score based only on what was recorded; missing parts listed, not guessed | `sleep-score.ts:64-101` |
| 2.8 | AI Coach (Pro, after "Allow and continue") → "How was my sleep this week?" | Coach quotes the summary; names the device; never calls HR/HRV a recovery score | `get_sleep_summary`, `sleep-summary.ts:62` |
| 2.9 | Sleep settings → Delete imported sleep | Imported nights and their stages/vitals gone; manual nights remain | `actions/sleep-import.ts` delete |
| 2.10 | Disconnect Apple Health | No further imports; existing nights remain until deleted; Health app shows the app under Sources with read-only access | `native-health.ts` disconnect |
| 2.11 | Withdraw wellness consent | Limitation notes and recovery check-ins deleted; the page says sleep stays until deleted | `withdrawWellnessConsentAction` |
| 2.12 | Export data (Profile → Privacy & data) | JSON contains the sleep sessions with the same aggregates, no raw samples | `exportUserData` |

## 3. GPS running (30 min outdoors)

| # | Step | Expect | Code |
|---|---|---|---|
| 3.1 | Run → Outdoor run → Start | iOS asks for location "While Using"; then (first background use) "Always"; the purpose strings read as in `Info.plist:77-80` | `@capacitor-community/background-geolocation` |
| 3.2 | Wait for the first fix | "Waiting for GPS" until accuracy ≤ 20 m, then recording; GPS details show accuracy, readings used, never a coordinate | `FIRST_FIX_ACCURACY_M`, `gpsDiagnostics` |
| 3.3 | Run 1 km with the screen locked | Distance and pace keep updating when unlocked; route continuous; no gap counted | `UIBackgroundModes: location`; plugin background mode |
| 3.4 | Pause, walk 200 m, Resume | Nothing added while paused; the route line breaks at the pause | `pauseTrack`, `breakReason: "pause"` |
| 3.5 | Stand still 60 s at a crossing | Distance does not creep | `STILL_SPEED_MS` rule |
| 3.6 | Go indoors / under a bridge for 30 s | "Signal lost" after 15 s; the clock keeps running; a new line starts when fixes return; the uncounted gap is shown in GPS details | `SIGNAL_LOST_MS`, `uncountedGapM` |
| 3.7 | Compare distance with a reference (known loop, watch) | Within a few percent; splits at each km/mile | Kalman smoothing; `newSplits` |
| 3.8 | Finish → review → Save | Map shows the route; the saved run appears in history and weekly totals; the route is private (no sharing control exists) | `routeForSave`, `activities.is_private` |
| 3.9 | Force-quit mid-run, reopen | "You have an unfinished run" with Continue/Discard; Continue keeps time, breaks the line (gap counted) | `recoverTrack` |
| 3.10 | Delete the saved run | Gone from history and totals; Export data no longer contains its route | `deleteActivityAction` strips route; constraint `activities_deleted_no_route` |
| 3.11 | Start a run, then sign out from Profile | Login page; Settings → Safari-style storage can't be inspected on iOS, so instead sign in as a second test account → Run → no "unfinished run" offered | `clearAllDrafts`, `DeviceCleanup` |
| 3.12 | Precise Location off in iOS settings | App explains that only an approximate location is shared and recording won't start | `precise_off` hint |

## 4. Camera, Body Scan, photos (15 min)

| # | Step | Expect | Code |
|---|---|---|---|
| 4.1 | Food → Nutrition Score → Scan a product | Camera permission prompt with the purpose string; native scanner reads EAN/UPC; product page opens; unknown barcode gives "Product not found" | `@capacitor/barcode-scanner`, `Info.plist:11-12` |
| 4.2 | Progress → add a progress photo (camera and library) | Photo compressed on device, EXIF stripped, uploads, shows via a short-lived link; delete removes it | `image-compress.ts`, `progress-photos` bucket |
| 4.3 | Body Scan (Pro) → consent → front/side/back | Outline overlay, 10 s timer, tilt warning, faint overlay of the last scan on the next one; measurements typed by hand; no body-fat number anywhere | `scan-capture.tsx`, `consent-card.tsx:15` |
| 4.4 | Withdraw Body Scan consent | All scan photos and rows deleted | `withdrawBodyScanConsent` |
| 4.5 | Meal photo estimate (Pro, separate consent) | Estimate returned; nothing stored (re-open the page: no photo) | `food-photo.ts` |
| 4.6 | Delete account | Progress and Body Scan photos gone (check the Supabase Storage buckets as owner) | `removeUserStorage` |

## 5. Notifications (10 min)

| # | Step | Expect | Code |
|---|---|---|---|
| 5.1 | Faith → reminders, or a workout reminder → enable | iOS notification permission prompt; a notification arrives at the time with the app in the background and with the phone locked | `@capacitor/local-notifications`, `native-reminders.ts` |
| 5.2 | Sleep alarm → set for 2 min ahead | Notification at the deadline (the "smart window" is stored but every alarm sounds at the deadline, as the page says) | `native-alarm.ts`, `sleep-alarm.ts:1-8` |
| 5.3 | Rest timer during a workout, screen locked | **Known limitation:** the rest timer is in-page only; no native notification fires when the screen is locked. Decide whether to add one later (not in scope) | `src/components/train/*` |
| 5.4 | Notifications permission denied | Reminders page explains and offers the Settings path | `checkPermissions` branch |

## 6. In-app purchases (App Store sandbox, 20 min; needs App Store Connect products and a RevenueCat project)

| # | Step | Expect | Code |
|---|---|---|---|
| 6.1 | Profile → Plans & billing | Store prices for Plus/Pro monthly and yearly (localized), renewal terms, Terms and Privacy links, Restore purchases | `store-paywall.tsx` |
| 6.2 | Buy Plus monthly with a sandbox tester | Apple sheet; after purchase the plan shows Plus within seconds (server confirms with RevenueCat) | `store-billing.ts` |
| 6.3 | Upgrade to Pro | Immediate (same subscription group) | |
| 6.4 | Restore purchases on a second device / after reinstall | Plan restored | |
| 6.5 | Cancel in iOS Settings → Subscriptions | Access continues to period end; page shows the end date | webhook `CANCELLATION` |
| 6.6 | Let a sandbox subscription expire (minutes in sandbox) | Back to Free; nothing deleted | `EXPIRATION` |
| 6.7 | Refund via the sandbox tools | Access ends | `REFUND` |
| 6.8 | Web Stripe subscriber signs in on the iPhone | "Your subscription was purchased outside the App Store"; no second purchase offered | 3.1.3(b), `store-billing.spec.ts` |
| 6.9 | Store subscriber on the web | Told the plan is billed by the App Store; manage there | |

## 7. Account (5 min)

| # | Step | Expect |
|---|---|---|
| 7.1 | Export data | JSON download opens/shares on iOS |
| 7.2 | Delete account (typed DELETE + password) | Signed out; landing page; store subscription warning shown first; Supabase user gone |

## What cannot be verified without hardware (say so in reports)

Apple Health import and the Health permission sheet; background location with the screen locked; the native barcode scanner; local notifications while locked; App Store purchases; real GPS accuracy; haptics; the keyboard behaviour on a real keyboard.
