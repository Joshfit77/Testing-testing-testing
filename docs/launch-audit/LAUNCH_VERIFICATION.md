# Launch verification: iPhone checklist, RevenueCat sandbox, and what changed (2026-11-03)

This review checked the nine launch areas against the code on `claude/faith-discipleship`. It reuses the existing
device script (`docs/device-testing/DEVICE_TEST_SCRIPT.md`) and adds only what was missing.

**Status:** nothing below has run on a physical iPhone. Every result in this file is either an automated test that was
run or a code reading. Delivery, sound, camera and purchase behaviour on hardware are **not verified**.

## 1. Where each area stands

| Area | Already built (not rebuilt) | Defects found and fixed in this round | Still device-only |
| --- | --- | --- | --- |
| First-workout activation | Database events and an admin report (migration 051, `docs/activation/`) | The report counted sandbox testers, admins, demo and test accounts. It now leaves them out by default and says how many (migration 056). The admin funnel lacked "Started a first workout" | Real data appears only once testers start |
| Native rest timer | In-app countdown, beep, end-of-rest notification, DT-REST-01…11 | **The notification was silent on iPhone**: the plugin sets no sound unless asked. **Vibrate did nothing in the iPhone app**: the web view has no `navigator.vibrate`. A Skip during scheduling could leave a stray "Rest complete". DT-REST-11 expected the wrong sign-out behaviour | Sound with the silent switch, Focus, AirPods |
| Offline workout persistence | Saves each change on the phone, then syncs, retries and finishes idempotently (DT-OFF-01…08) | A finish retried after a lost response showed **no records or badges**, although they were saved | Airplane mode, captive Wi-Fi |
| Barcode scanning | Native scanner, web fallback, DT-SCAN-01…10 | None | Real packs, lighting |
| Progress photos | Compress, upload, save; DT-PHOTO-01…08 | A lost reply during "Saving…" **deleted the uploaded image**, leaving an entry with no picture; a retry made a second entry | 48 MP / ProRAW / iCloud photos |
| Camera permissions | `NSCameraUsageDescription`; no photo-library permission needed (file picker); DT-CAM-01…06 | None | The permission prompts themselves |
| RevenueCat purchases | Purchase, restore, server sync, webhook, allow-list, DT-IAP-01…14 | After a **real charge** the paywall could say "You haven't been charged". A member paying on the web and in the App Store **lost Pro** when the earlier one ended. Blanket sandbox acceptance could be switched on in production | Everything against App Store Connect |
| Free/Pro messaging | Gates appear only where a Pro feature is used; no modals or nags | The iPhone app without a store key showed **no benefits** at all. Plan naming and Free lists were inconsistent. Some copy was wrong ("renew Pro" to people who never had it; "can't be purchased inside the app") | — |
| Post-workout progress | Duration, volume, new records, baselines, badges, "Up next" with date | Added: sets, a comparison with last time, "Up next" after a workout outside the program, a link when a program ends, and an optional verse with reflection | — |
| Faith journeys | Strict Bible-and-prayer rule, enforced in the database | Unchanged. Flexible mode assessed only: `docs/faith/FLEXIBLE_JOURNEY_ASSESSMENT.md` | — |

## 2. Real-iPhone checklist (run in this order)

Run the existing cases. The new **LV** cases cover what they don't. Record each one with the iPhone model, the iOS
version and the build number.

**A. Rest timer audio and lock screen:** DT-REST-01…11, plus:

- **LV-REST-1:** Rest ends with the phone locked and the ringer on. "Rest complete" plays the **default sound** (new in
  this build). Repeat with the Silent switch on: expect vibration only (iOS rule).
- **LV-REST-2:** App open, rest alerts set to Vibrate only: the phone **vibrates** at the end of rest (new: Capacitor
  Haptics). Sound only: the beep plays. Repeat with music playing and with AirPods connected, and record whether the
  beep ducks or interrupts the music.
- **LV-REST-3:** Start a rest and immediately tap Skip, five times quickly. **No** stray "Rest complete" arrives
  later.

**B. Lock-screen notifications:** DT-NOTIF-01…13 (`docs/NOTIFICATIONS.md`), SLEEP B1–B10, DT-SWITCH-04, plus:

- **LV-NOTIF-1:** A reminder and the wake-up alarm each arrive **with a sound** with the phone locked (new in this
  build: every notification names the default sound).
- **LV-NOTIF-2:** Wake-up alarm with a Focus on. Without Apple's Time Sensitive entitlement (not added: it needs a
  provisioning change) the alarm can be held back by Focus. Record what happens. The **owner decides** whether to add
  the entitlement.
- **LV-NOTIF-3:** Snooze from the lock screen with the app force-quit and offline. Record whether the snoozed alarm
  arrives. Snooze runs in the web layer, so this can't be determined from code.

**C. Airplane-mode workout persistence:** DT-OFF-01…08, plus:

- **LV-OFF-1:** Log a workout that sets a personal record. Turn on Airplane mode and tap Finish: the app keeps the
  workout and says it couldn't save. Turn Airplane mode off and tap Finish again. The summary shows the **same records
  and badges** (new: a retried finish shows them).
- **LV-OFF-2:** Finish on Wi-Fi with no internet (a captive portal). Note how long "Saving…" shows; there is no request
  timeout. Record it as a finding if it takes more than 30 s.
- **LV-OFF-3:** Go offline mid-workout, then come back online **without touching anything**. Check that the sync
  indicator returns to "Saved" within about 2 minutes.

**D. Camera permissions:** DT-CAM-01…06, plus:

- **LV-CAM-1:** In Xcode, Product → Archive, then *Generate Privacy Report*. The camera reason is listed; the
  UserDefaults reason CA92.1 is present.

**E. Barcode scanning:** DT-SCAN-01…10, plus:

- **LV-SCAN-1:** A UPC-E (short) barcode, a scan held in landscape, and an incoming call during a scan. The scanner
  closes or recovers without freezing.

**F. Progress photos:** DT-PHOTO-01…08, plus:

- **LV-PHOTO-1:** Turn Airplane mode on during "Saving…". The message is "We couldn't confirm the save". Reconnect and
  tap Save again: there is **one** entry, with its image (new in this build).
- **LV-PHOTO-2:** A 48 MP photo, a ProRAW photo, a Live Photo and a photo stored only in iCloud. Each saves or gives
  a clear error, with no crash.

**G. Completion screen:** after any program workout, the summary shows:

- Duration, Sets and Volume;
- "Up N% on last time" from the second time of the same session;
- "Up next" with the date.

With "draw on Scripture" on, there is also a closed "A verse to close with" with red letters, opening a reflection in
the journal.

## 3. RevenueCat end-to-end sandbox verification

### Prerequisites (owner actions; none can be done from this repository)

1. In App Store Connect, create a subscription group with `ngf_pro_monthly` and `ngf_pro_yearly`
   (`docs/MOBILE_BILLING.md`), and create sandbox testers.
2. In RevenueCat:
   - create the project and the entitlement `pro` with both products;
   - turn on "Transfer to new App User ID" for restore behaviour;
   - set the webhook URL `https://<deployment>/api/revenuecat/webhook` with an Authorization header value.
3. On the deployment, set:
   - `REVENUECAT_SECRET_API_KEY`
   - `REVENUECAT_PUBLIC_KEY_IOS`
   - `REVENUECAT_WEBHOOK_AUTH`, the same value as the dashboard header
   - either `REVENUECAT_ALLOW_SANDBOX=true` (test deployment), or add each tester account under Admin → Sandbox
     testers. The blanket flag is now **ignored** where `STRIPE_LIVE_APPROVED=true`.
4. Build the app with that deployment's address (`docs/TESTFLIGHT.md`) and install it via TestFlight.

### Runbook

| Step | Do | Expect in the app | Check on the server (SQL editor, service role) |
| --- | --- | --- | --- |
| R1 | RevenueCat dashboard → webhook → *Send test event* | — | Delivery shows **200**; no account changes |
| R2 | DT-IAP-01, then DT-IAP-02 (buy monthly) | "Welcome to Pro All Access" within seconds; Pro features unlock **without** restarting | `select plan, valid_until, source from user_entitlements where user_id = '<id>'` gives `pro`, a future date and `app_store` |
| R3 | Wait for the webhook (seconds) | — | `select type, environment, status, processed_at from revenuecat_events order by processed_at desc nulls first limit 5` shows `INITIAL_PURCHASE` with status `processed` |
| R4 | Turn on Airplane mode right after confirming a purchase (DT-IAP-02 variant) | "Purchase received. Your membership will update shortly…", **never** "You haven't been charged" (fixed this round) | After reconnecting, R2's row is `pro` (by webhook or Restore) |
| R5 | DT-IAP-08 (reinstall, Restore) and DT-IAP-09 (another iPhone) | "Purchases restored. You're on Pro All Access" | Same entitlement row; no second `store_subscriptions` product row |
| R6 | DT-IAP-10 (Restore while signed in to a different account) | The new account gets Pro | The old account's `user_entitlements` row drops to free after the `TRANSFER` event |
| R7 | DT-IAP-05 (monthly → yearly), DT-IAP-06, DT-IAP-07 (expiry, accelerated in sandbox) | Plan detail updates; after expiry the account is Free | `valid_until` follows; after expiry `plan_of('<id>')` is `free` |
| R8 | DT-IAP-03 with an account **not** on the tester list (production project) | Purchase sheet completes; the plan stays Free | No `pro` entitlement; `store_subscriptions` has no counted row |
| R9 | DT-IAP-11 / DT-IAP-12 (refund, billing issue) if sandbox allows | Refund ends access at once; billing issue shows the grace message | `status` / `valid_until` as described in `docs/MOBILE_BILLING.md` |
| R10 | DT-IAP-13 / DT-IAP-14 (web and store subscriber) | The higher plan, until the **later** end date (fixed this round) | `user_entitlements.valid_until` = the later of the two |

### Negative authorization: automated, run in this round

- **Webhook:**
  - refused without the Authorization header or with a wrong one (401);
  - refused while not configured (503);
  - refused when oversized, including a body that understates its length (413);
  - bad JSON is refused (400);
  - a replayed event is processed once;
  - a well-formed id that isn't a member makes **no RevenueCat lookup** and grants nothing;
  - anonymous ids and Test Store purchases are ignored.

  Tests: `tests/integration/store-billing.test.ts`, `tests/unit/billing-negative-auth.test.ts`.
- **In-app sync action:**
  - refused without a session;
  - only ever syncs the signed-in member, whatever is passed;
  - rate-limited;
  - refused when billing isn't configured.

  Test: `tests/unit/billing-negative-auth.test.ts`.
- **Members** can't write entitlement, subscription or store tables or call billing functions, and can't grant
  themselves a plan; expired Pro closes the AI coach. Tests: `tests/integration/billing-integrity.test.ts` and
  `pro-bypass.test.ts`.
- **Sandbox tester list:** only admins can change it. Members can't read it, add themselves or call the check.
  Tests: `tests/unit/billing-negative-auth.test.ts` and `tests/integration/store-billing.test.ts`.
- **Production guard:** blanket sandbox / Test Store acceptance is ignored where real charges are approved. Test:
  `tests/unit/billing-negative-auth.test.ts`.

### Known gaps (not fixed; for the owner)

- **A lost `TRANSFER` webhook:** the old account keeps Pro until its stored expiry, because reconcile scans only rows
  near expiry. RevenueCat retries webhooks, so this needs a permanently lost delivery.
- **Account aliases:** two of our accounts aliased in RevenueCat would both get Pro. This depends on the dashboard's
  "Transfer to new App User ID" setting (prerequisite 2).

## 4. Physical-device blockers

These are the owner's actions; this environment has no Mac, Apple account or device.

1. **A deployed HTTPS address** for the app. The iPhone build loads the server, so nothing works on a phone without it
   (`docs/TESTFLIGHT.md`).
2. **Apple Developer account and signing secrets** for the TestFlight workflow (`APPLE_TEAM_ID`, `ASC_KEY_ID`,
   `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64`).
3. **The App Store Connect subscription group and products**, plus sandbox testers.
4. **The RevenueCat project**, keys, entitlement and webhook (section 3).
5. **Migrations 053–056 applied** to the target Supabase project (`npm run db:bundle` writes `supabase/setup-all.sql`).
6. **A physical iPhone** (and an Android phone for the Android cases) with the TestFlight build.
7. **Decision:** whether to request the Time Sensitive notification entitlement for the wake-up alarm (LV-NOTIF-2).

## 5. First-workout activation: confirming real data once testing begins

- **Recorded on real actions, by database triggers on `workout_sessions`:** `workout_started` (the first sync of a
  touched workout), `set_completed`, `workout_completed` and `workout_abandoned`. They are idempotent per workout.
- **Read it in Admin → "First-workout activation":**
  - the window is the last 30 days;
  - sandbox testers, admins, demo accounts and test addresses are left out, and the count left out is shown;
  - pass `p_include_test: true` to `admin_activation_metrics` to include them.
- **To confirm it's capturing**, after a tester's first workout run:
  `select event, occurred_at from activation_events where user_id = '<tester id>' order by occurred_at`. Expect
  `workout_started`, then `set_completed`, then `workout_completed`. Testers are left out of the report by design, so
  check their raw events.
- **Caveats** (documented in the admin page):
  - deleted accounts drop out of the counts;
  - "started" is recorded when the member first touches the workout, not when the screen opens;
  - start times use the phone's clock (clamped).
