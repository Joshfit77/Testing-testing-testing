# TestFlight acceptance checklist (physical iPhone)

Written 2026-11-09 for the first private TestFlight build after PR #9 (badge progress) and PR #10 (first-time UX) are
merged. It covers the 11 areas the owner listed. Every row is run **on a physical iPhone running the TestFlight
build**. Nothing in this file has been run yet. Every Result cell is empty.

## What counts as evidence

- **Counts:** a physical iPhone, with the TestFlight build installed from the TestFlight app, connected to the
  staging deployment written in the run header below.
- **Does not count**, however good it looks:
  - the iOS Simulator;
  - a desktop or phone browser, including Safari on the iPhone opening the website;
  - Playwright runs (Pixel 7 emulation or WebKit);
  - the demo mode;
  - mocked AI or mocked Open Food Facts responses;
  - CI.

  These are listed in the "Automated cover" column only to show what is already checked and what is left for the
  device.
- A row passes only when its **Observed** result matches **Expected** and the **Evidence** column names a file (a
  screen recording, screenshot, or exported log). A row without evidence is recorded as `Not run`, not `Pass`.
- Results go in this file's tables, and in `docs/device-testing/device-test-results.csv` for rows that carry a
  `DT-` ID. Where a row points to a `DT-` case, the full steps are in `docs/device-testing/DEVICE_TEST_SCRIPT.md`. That
  script remains the authority for the steps.
- Severity for failures uses the scale in `DEVICE_TEST_SCRIPT.md` ("Severity scale"). Critical and High failures
  block external TestFlight.

## Run header (fill in once per run)

| Field | Value |
|---|---|
| Tester | |
| Date(s) | |
| TestFlight build number / app version | |
| Staging site (`CAP_SERVER_URL`) | |
| Deployed commit (`https://<site>/api/health` → `commit`) | |
| Main device: model / iOS version | |
| Second device (optional): model / iOS version | |
| Sleep source (Apple Watch model + watchOS, or app) | |
| Sandbox purchases counted for this tester? (allow-list or server sandbox setting; ask the owner) | |
| Live AI on staging? (owner confirms a real staging key and spend cap; see area 7) | |
| Accounts used (A fresh, B second, C throwaway, W Stripe test-mode) | |

> No real card anywhere. In-app purchases use TestFlight or sandbox only. If a purchase sheet does not say
> sandbox/TestFlight, cancel and stop the billing rows.

Each row's record fields are: **Device · iOS · Build · Observed · Evidence · Result** (`Pass` / `Fail` / `Blocked` /
`Not run`). The tables give them as the last columns, with the device and build taken from the run header unless a
row was run on the second device.

---

## 1. First workout and set logging

Account A, fresh, on Free. Start from the opening screen.

| ID | Steps | Expected | Automated cover (not device proof) | Device / iOS | Observed | Evidence | Result |
|---|---|---|---|---|---|---|---|
| TF-WO-01 | Start free → sign up → confirm the e-mail (link opens in Safari) → sign in inside the app → finish onboarding with the default answers. Count taps to "Start today's workout". | Plan screen appears; Home shows "Start today's workout"; about 17 interactions to the first workout (browser measurement, `docs/ux/FIRST_TIME_UX_RESULTS.md`). Note the count you saw. | `onboarding-plan.spec`, `first-workout-activation.spec`, `core-flow.spec` | | | | |
| TF-WO-02 | Home → Start today's workout. On set 1 tap the weight field. | A **number pad** opens (not the full keyboard). The field stays visible above the keyboard. | `current-set-card.spec` | | | | |
| TF-WO-03 | Enter weight and reps, tap the set's complete button. | A short haptic tap. The set shows completed. The status reads "Synced" within a few seconds. | `workout-reliability.spec`, `fast-logging.spec` | | | | |
| TF-WO-04 | Complete sets 2–3 using "Same as last set". Skip one set. | Values copy; the skipped set is marked skipped, not completed. | `current-set-card.spec`, unit `drafts` | | | | |
| TF-WO-05 | Finish the workout. | The completion screen shows the volume and sets. For a first workout, the celebration and badge progress ("1 / 1 workout", Foundation earned) appear without the page scrolling sideways. | `achievement-progress.spec` (#9), `new-member-states.spec` | | | | |
| TF-WO-06 | Train → History, then open the workout. Then Progress → Badges. | The workout is listed once with the same sets. Badges show Foundation earned and the next rank "1 / 10". | `core-flow.spec`, integration `badge-progress` | | | | |

## 2. Background and locked-screen GPS

Needs Pro (sandbox purchase from area 8, run early) and an outdoor location. The full steps are DT-GPS-01…13.

| ID | Steps | Expected | Automated cover | Device / iOS | Observed | Evidence | Result |
|---|---|---|---|---|---|---|---|
| DT-GPS-01 | First Start on Run | Location prompt text matches `Info.plist`; recording starts after Allow | `gps-run.spec` (browser geolocation mock only) | | | | |
| DT-GPS-03 | Lock the screen for 10 minutes while walking (While Using) | Distance keeps growing; the route has no straight-line gap | none (needs device) | | | | |
| DT-GPS-04 | Background the app and switch apps for 5 minutes | Recording continues; the timer is correct on return | none | | | | |
| DT-GPS-05 | Take a phone call mid-recording | Recording survives; no duplicate run | none | | | | |
| DT-GPS-10 | Low Power Mode, 20 min locked | Recording survives; record the battery drop | none | | | | |
| DT-GPS-11 | One hour locked | Survival and battery % recorded | none | | | | |
| DT-GPS-12 / 13 | Pause/resume, then finish, save and delete | Paused time is excluded; one saved run; deleting removes the route | `gps-run.spec`, integration `gps-running` | | | | |

## 3. Outdoor walking/running and treadmill entry

| ID | Steps | Expected | Automated cover | Device / iOS | Observed | Evidence | Result |
|---|---|---|---|---|---|---|---|
| DT-ROUTE-01 | 4 laps in lane 1 of a 400 m track, screen on | 1,568–1,632 m (± 2%); record the reported distance | unit `gps-accuracy` controlled traces (simulated) | | | | |
| DT-ROUTE-03 | Measured road route of about 5 km | Within ± 3% of the measured distance | unit `gps-accuracy` traces only | | | | |
| DT-ROUTE-05 | Stand still for 10 minutes while recording | Distance grows by less than 25 m | unit `gps-accuracy` stationary drift | | | | |
| TF-RUN-01 | Free account: Run → "Log a run or walk manually" → Source **Treadmill**, 3.0 mi, 30:00 → Save | Saved with no map and no GPS label. Pace is 10:00 /mi. It counts toward "Longest run" (BADGES.md: treadmill counts). | `run.spec`, integration `activities` | | | | |
| TF-RUN-02 | Switch mi ↔ km on the form, then edit and delete the treadmill entry | The unit toggle is easy to hit (at least 44 pt); edits persist; delete removes it from This week and history | `run.spec` | | | | |
| TF-RUN-03 | After a GPS walk (Pro), open Progress → Badges and the run detail | The walk counts once; GPS and treadmill entries are not double-counted | `achievement-progress.spec` (#9) | | | | |

## 4. Apple Health sleep import and duplicate prevention

The full steps are DT-HEALTH-05…12. You need at least two nights recorded by a watch or an app in Apple Health.

| ID | Steps | Expected | Automated cover | Device / iOS | Observed | Evidence | Result |
|---|---|---|---|---|---|---|---|
| DT-HEALTH-05 | Sleep: consent in the app, then the Health sheet | The app's consent comes first; the Health sheet appears only after Allow | `sleep.spec` (consent only) | | | | |
| DT-HEALTH-07 | Allow all four types | Nights match the Health app (start, end, asleep minutes, stages if recorded) | integration `sleep-imports` (fixtures) | | | | |
| DT-HEALTH-08 | Sync three times (open, Sync now, pull to refresh) | No duplicate nights; the count is unchanged | integration `sleep-imports` dedupe | | | | |
| DT-HEALTH-09 | Enter a night by hand that overlaps an imported one | One night shown, with source precedence as documented in `docs/SLEEP_METHOD.md` | integration `sleep` | | | | |
| DT-HEALTH-11 / 12 | Revoke Health access; then Disconnect and remove imported nights | A clear message, no crash; imported nights removed; nothing written to Health | integration `sleep-imports` | | | | |

## 5. Barcode camera and food photos

| ID | Steps | Expected | Automated cover | Device / iOS | Observed | Evidence | Result |
|---|---|---|---|---|---|---|---|
| DT-SCAN-01…03 | First scan (camera prompt), several products, log to diary | Native scanner opens; haptic on read; correct product and serving; one diary row | `food-quality.spec`, `label-check.spec` (OFF mock) | | | | |
| DT-SCAN-04 / 09 / 10 | Unknown product; no network; type the barcode | A clear message each time; manual entry works | `food-quality.spec` (mock) | | | | |
| DT-CAM-04 / 05 | Refuse the camera, then allow it in Settings | Every camera feature explains how to allow it; works after allowing | none | | | | |
| TF-FOOD-01 | Pro: Nutrition → meal photo → take a photo of a plate | Live AI estimate (needs area 7 live AI); foods with grams are shown before saving; nothing saves until confirmed | integration `food-photo` (mocked AI) | | | | |
| TF-FOOD-02 | Change a portion, save, then tap Undo within 8 s | Diary updates; Undo removes exactly the rows added | `fast-logging.spec`, unit `nutrition-undo-actions` | | | | |
| TF-FOOD-03 | Free account: open meal photo | Locked with "See plans" and "Add food instead"; no AI call is made | `ux-nutrition.spec` (demo) | | | | |

## 6. Local notifications, sound and haptics

The full steps are DT-REST-01…11. The reminders are planned by the app (`docs/NOTIFICATIONS.md`).

| ID | Steps | Expected | Automated cover | Device / iOS | Observed | Evidence | Result |
|---|---|---|---|---|---|---|---|
| DT-REST-01…03 | First rest: permission prompt; rest ends with the app open, in the background, and locked | Prompt once; sound and notification at the end in all three states | unit `notification-planner` (scheduling only) | | | | |
| DT-REST-06 / 07 | Silent switch; Do Not Disturb | Matches iOS rules (no sound on silent; held during Focus); record what happened | none | | | | |
| DT-REST-10 | Alerts off / Vibrate only, then relaunch | The setting is kept; vibration only when chosen | `workout-reliability.spec` (setting only) | | | | |
| TF-NOTIF-01 | You → Notifications: turn on the reading reminder and the workout reminder 2 minutes ahead | Both arrive at the set time; tapping opens the right screen (Bible / today's workout) | `notifications.spec`, integration `notification-settings` | | | | |
| TF-NOTIF-02 | Complete today's reading before its reminder fires | That day's reading reminder is cancelled | unit `notification-planner` | | | | |
| TF-HAPTIC-01 | Complete a set; scan a barcode | One light haptic each; none when iOS system haptics are off | none (native only) | | | | |

## 7. AI Coach with live staging responses

**Precondition (owner):** the staging deployment has a real `ANTHROPIC_API_KEY` with a spend cap. That is a paid API
and is **not** enabled by this work. Until the owner turns it on, mark these rows `Blocked`, not `Pass`. A reply
labelled simulated (demo) or a mocked reply does not count.

| ID | Steps | Expected | Automated cover | Device / iOS | Observed | Evidence | Result |
|---|---|---|---|---|---|---|---|
| TF-AI-01 | Pro: Coach → ask "How do I start my first week?" | A live reply within about 20 s that mentions this member's own plan; the AI label is visible | `coach.spec` (mock server), `docs/ai-eval` harness | | | | |
| TF-AI-02 | Ask for a medical diagnosis or extreme diet | Safe redirect per `docs/LIVE_AI_TEST_PLAN.md`; no diagnosis | unit prompt guards; eval scenarios (not live) | | | | |
| TF-AI-03 | Write a prayer journal entry with a distinctive phrase (not shared). Ask the coach "What did I pray about?" | The coach does not know or quote it | unit `coach-journal`, `coach-memory` | | | | |
| TF-AI-04 | Airplane mode, send a message | A clear offline error; no charge to the quota; retry works after reconnecting | `coach.spec` (error states) | | | | |
| TF-AI-05 | Free account: open Coach | Upsell card with 3 starter questions; no AI call | `new-member-states.spec` | | | | |

## 8. Free-to-Pro sandbox purchase and restore

The full steps are DT-IAP-01…14. Run area 8 early, because GPS (area 2) and food photos (area 5) need Pro.

| ID | Steps | Expected | Automated cover | Device / iOS | Observed | Evidence | Result |
|---|---|---|---|---|---|---|---|
| DT-IAP-01 | Plans & billing screen | Prices come from the App Store; auto-renew terms and links are visible | `store-billing.spec`, `memberships.spec` | | | | |
| DT-IAP-02 | Buy Pro All Access monthly (sandbox) | The sheet says sandbox; Pro unlocks within a minute; the server shows the entitlement (owner checks RevenueCat) | integration `store-billing`, `entitlements`, `pro-bypass` | | | | |
| DT-IAP-03 | A sandbox purchase from a tester not on the allow-list | Not counted; stays Free | integration `store-billing` (allow-list) | | | | |
| DT-IAP-04 | Cancel the purchase sheet | Stays Free; no error | none | | | | |
| DT-IAP-05 / 07 | Monthly → yearly; let it expire (sandbox accelerates) | Pro stays continuous; then returns to Free on expiry with the history kept | integration `billing-integrity` | | | | |
| DT-IAP-08 / 10 | Restore after reinstalling; restore on a different app account | Restores to the same account; the transfer rule follows `docs/MOBILE_BILLING.md` | integration `store-billing` (transfer) | | | | |
| TF-IAP-HIST | After expiry, open workout history, badges, runs, sleep | Nothing recorded while on Pro is lost; Pro-only screens lock with a free alternative | integration `plan-enforcement`, `memberships.spec` | | | | |

## 9. Offline data retention and app termination

| ID | Steps | Expected | Automated cover | Device / iOS | Observed | Evidence | Result |
|---|---|---|---|---|---|---|---|
| DT-OFF-01…04 | Log sets in airplane mode → force-quit → reopen offline → reconnect | Sets are kept on the device, then reach the account (check on the website) | `workout-data-preservation.spec` (Chromium offline emulation) | | | | |
| DT-OFF-05 | Finish offline, then reconnect | Saved exactly once | integration `workouts` idempotency | | | | |
| DT-QUIT-06 / 07 | Force-quit in the middle of a workout / a GPS run | The workout resumes; the run is recoverable or clearly saved | `workout-data-preservation.spec` (visibility only) | | | | |
| DT-DISC-01 | Discard a synced workout offline, then reconnect | Discarded on the account too | integration `edit-safety` | | | | |
| TF-OFF-FOOD | Log food offline | A clear "offline" message or a queued save, not a silent loss. Record which. | none | | | | |

## 10. Faith reading, prayer privacy and saved progress

| ID | Steps | Expected | Automated cover | Device / iOS | Observed | Evidence | Result |
|---|---|---|---|---|---|---|---|
| TF-FAITH-01 | Faith → Choose a journey → Day 1 → read the chapter → mark read | Day 1 reading is ticked; Home's "Continue reading" points to the next passage | `faith-journey.spec`, `journeys.spec` | | | | |
| TF-FAITH-02 | Scroll midway in a chapter, force-quit, reopen | Returns to the same chapter and position | `bible-reader.spec` | | | | |
| TF-FAITH-03 | Airplane mode → open a chapter saved for offline | Text shows, with red letters if on | `bible-reader.spec` (offline), unit `bible-offline` | | | | |
| TF-FAITH-04 | Write a prayer journal entry; lock the phone; check the notification and lock-screen previews | Prayer text never appears in a notification (counts only, `notifications.ts`) | unit `notification-planner` | | | | |
| TF-FAITH-05 | Sign out, sign in as B on the same phone | None of A's prayers, notes, highlights or progress is visible | integration `cross-user-isolation`, `rls`; DT-SWITCH-02 | | | | |
| TF-FAITH-06 | Miss a day of the daily rule (reading + prayer) | The journey resets to Day 1 as the rule says, shown clearly; the history is kept | integration `faith-journeys` | | | | |

## 11. VoiceOver, Dynamic Type and keyboard

| ID | Steps | Expected | Automated cover | Device / iOS | Observed | Evidence | Result |
|---|---|---|---|---|---|---|---|
| TF-A11Y-01 | VoiceOver on: swipe through Home, start a workout, complete a set, finish | Every control has a spoken name ("Mark Back Squat set 1 complete"); the order is logical; status changes are announced | axe checks in `phone-sweep.spec`, `button-sweep.spec` (browser) | | | | |
| TF-A11Y-02 | VoiceOver: five tabs, Faith reader, Nutrition search, Plans & billing | Tabs announce the selected state; no unlabeled buttons | axe (browser) | | | | |
| TF-A11Y-03 | Settings → Accessibility → Larger Text at the largest non-accessibility size, then AX3 | No clipped or overlapping text on Home, the workout, Nutrition, Faith; buttons still reachable | `device-matrix.spec` text-scale checks (browser zoom, not Dynamic Type) | | | | |
| TF-A11Y-04 | Reduce Motion on; relaunch | The opening gate and celebrations use the reduced versions | `opening-gate.spec` (emulated) | | | | |
| TF-A11Y-05 | Keyboard: sign-up fields, set entry, food search, journal | The right keyboard type; Return/Next moves on; the keyboard never hides the field being typed (keyboard avoidance) | none (native keyboard) | | | | |
| TF-A11Y-06 | One-handed reach: the controls used in a workout | Complete-set and Next are in the lower half of the screen and at least 44 pt | `scripts/ux/targets.mjs` (browser measurement) | | | | |

---

## Sign-off

| Item | Value |
|---|---|
| Rows run / total | / 65 |
| Pass / Fail / Blocked | |
| Open Critical or High failures (IDs) | |
| Ready for external TestFlight? (no open Critical or High; areas 1, 8 and 9 all Pass) | |
| Signed off by / date | |
