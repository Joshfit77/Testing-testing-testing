# 06 · Physical iPhone checklist (prioritised), 2026-11-17

Nothing in this file has been run. Every line is **NOT TESTED** until a person runs it on a physical iPhone and writes
down the result. Detailed steps for many cases are in `docs/release/IPHONE_TEST_SCRIPT.md` and
`docs/release/IPHONE_PLAN_2026-11-15.md`; the DV numbers are the device tests in `04_RELIABILITY_CLOSURE.md` §5.

**Set-up.**
- **Phones:** one current iPhone on the latest iOS, and one older supported model (for example an iPhone SE 2nd
  generation or iPhone 11) for P1.
- **Build:** the TestFlight build of the approved release candidate, pointed at the hosted staging environment. Use
  synthetic accounts only.
- **For the subscription section only:** a sandbox Apple Account on the sandbox-tester allow-list. **Never use a real
  card or a real Apple Account for purchases.**
- **For each case, record:** date, phone model, iOS version, build number, PASS / FAIL / BLOCKED, and a screenshot or
  screen recording for any FAIL.

**Order.** Run P0 before inviting any tester. Run P1 in the first week of TestFlight. P2 is required before a public
launch. The subscription section (S) is required before paid subscriptions are switched on. Do not switch them on
for this TestFlight.

## P0: before inviting testers (about half a day)

| # | Area | Do this | Pass means |
|---|---|---|---|
| P0-1 | Install and sign-up | Fresh install from TestFlight. Create an account with a real mailbox you control. Open the confirmation link on the phone. Answer the onboarding questions | The link opens the app; you reach the plan with "Start today's workout"; no dead end (NEW-01) |
| P0-2 | Workout: log and finish | Start today's workout; complete every set with one tap, including one timed exercise; finish | The summary is right; History shows every set once, timed sets as times (NEW-02) |
| P0-3 | Workout: app killed | Log 3 sets, swipe the app away, reopen. Then Discard; reopen twice | "Resume workout" with all 3 sets; after Discard it never comes back (DV-04, NEW-04) |
| P0-4 | Workout: offline | Airplane Mode on; log 2 sets; tap Finish (it should say it's saved on the device); Airplane Mode off; tap Finish again | One workout in History with every set once (DV-15 short form) |
| P0-5 | **Lost Finish reply, then more sets** (fix in this release) | Use a weak signal or the airplane-mode toggle so a Finish fails after it is sent. Log one more set; tap Finish again. Then check History on a second device or the web | One workout, and it **includes the extra set**; the volume counts every set once |
| P0-6 | Workout: rest timer, phone locked | Complete a set, lock the phone, wait out the rest | One alert at the end of the rest; the timer is right when you unlock (NEW-03, DV-12) |
| P0-7 | Crash recovery | Open the workout screen with sets logged; force-quit during a set; reopen. If any error screen ever appears, tap Try again, then Go to Home | Sets kept. Any recovery screen offers Try again and Go to Home and says the workout is kept. (The new root error page cannot be triggered on purpose; record it if it ever appears) |
| P0-8 | Offline launch | Mid-workout, Airplane Mode on, kill and reopen the app | The bundled offline page says the workout is kept; after reconnecting, every set is there (DV-17) |
| P0-9 | GPS: short outdoor walk | Allow location "While Using". Walk a known 400 m track or loop for 5 minutes with the screen on, then 5 minutes locked | The blue location pill shows while locked; no straight-line jump in the route; distance within 3% of the reference (DV-01, short form) |
| P0-10 | Barcode scanning | First scan: Don't Allow. Then allow in Settings and scan 3 real products (EAN-13, UPC-A, a small EAN-8) and one unknown product. Type a barcode by hand once | The refusal message names Settings; typing works; real products are found; an unknown product invents nothing (DV-08) |
| P0-11 | Apple Health: connect and import | Connect Apple Health; allow steps and sleep; import | Steps and sleep import once; nothing is duplicated on a second import (DV-10, first half) |
| P0-12 | Health and journal sharing switches | In Profile, with the AI Coach on: check that "Apple Health and Health Connect data" and "Prayer journal" (shown only with faith features on) are both **Off** by default. Write a journal entry. Turn the journal switch on and off | Off by default. With the journal switch off, no "Share with AI Coach" choice appears on the entry. With it on, the choice appears. Turning it off makes the entry private again |
| P0-13 | Account deletion | With a throwaway account: Profile → Delete account | The account is gone; signing in again fails; local workout drafts are cleared |

## P1: first week of TestFlight

| # | Area | Do this | Pass means |
|---|---|---|---|
| P1-1 | GPS: long locked run, other app in front | 20 min locked; then 5 min with Music in front (DV-01) | Same session throughout; distance within 3%; Diagnostics show fixes during the lock |
| P1-2 | GPS: permissions and power | Precise Location off; Low Power Mode on for 10 min (DV-02) | Precise off shows the "approximate location" hint and counts nothing; Low Power keeps recording |
| P1-3 | GPS: app killed mid-run | Record 3 min, swipe the app away, reopen (DV-05) | "Unfinished recording" offered; the time away is a gap, not distance; the location pill is gone after the kill |
| P1-4 | Low-memory termination | Mid-workout and mid-run, open the camera and 5–6 heavy apps until the app is evicted (DV-06) | Workout: every set restored. Run: offered back as in P1-3 |
| P1-5 | Background save | Type a weight, press Home at once, kill the app 10 s later, open on a second device (DV-07) | The typed weight is on the second device |
| P1-6 | Apple Health: partial and revoked | Allow some types and deny others; then revoke in the Health app and import again (DV-10) | Denied types explained, not errors; revoking doesn't crash; nothing imported twice |
| P1-7 | Photos | Meal photo (Pro feature; test account with Pro granted server-side), label photo, progress photo, Body Scan; refuse the camera once; "Limited photo access" (DV-09) | A clear message and a library path each time; nothing saved without confirming |
| P1-8 | Network handover | Walk from gym Wi-Fi to cellular while logging; tap Finish during the handover (DV-15) | "Saved on device", then "Synced"; exactly one workout with every set once |
| P1-9 | Notifications | Workout, reading and prayer reminders; deny notifications, then allow (DV-12, NEW-06) | Reminders arrive at the set local time; a refused permission is explained |
| P1-10 | Older iPhone | Repeat P0-2, P0-3, P0-9 and P0-10 on the older model | Same results; note any slowness (script section 9) |

## P2: before a public launch

| # | Area | Do this | Pass means |
|---|---|---|---|
| P2-1 | Clock and time-zone changes | Change the time zone mid-workout and finish. Set the clock back 2 h mid-workout and finish. Set the clock back 10 min mid-GPS-walk (fixes in this release) and save the walk (DV-16) | The workout saves once with a sensible duration; **the walk saves** (it was refused before this release) with the right distance; times across the jump may be approximate |
| P2-2 | Accessibility | VoiceOver through sign-up, a workout and finish; the largest text size (script section 12) | Everything reachable and read; nothing clipped |
| P2-3 | Live AI on staging | With a capped staging key: the 30 scenarios in `docs/LIVE_AI_TEST_PLAN.md`, and five real coach messages from the phone (NEW-07) | Replies follow the safety rules; record cost and latency |
| P2-4 | Home after midnight, offline | Open Home, Airplane Mode on, leave the app past midnight, reopen (NEW-08) | The next day's screen, no error |

## S: native subscription sandbox (only before switching on paid subscriptions)

Sandbox only. Products `ngf_pro_monthly` ($17.99) and `ngf_pro_yearly` ($119.99) must exist in App Store Connect and
RevenueCat. The tester's account must be on the sandbox allow-list. Server-side checks for every row are in
`02_SUBSCRIPTION_SECURITY_CLOSURE.md` §5.

| # | Do this | Pass means |
|---|---|---|
| S-1 | Open the paywall | Both products show the store's price; terms, privacy, Restore purchases and Manage subscription links are present |
| S-2 | Buy monthly in the sandbox | Pro unlocks once; RevenueCat's webhook reaches the server with a 200 response; the plan comes from the server, not the phone |
| S-3 | Tap Buy twice quickly / retry after a network drop | One subscription, no double charge |
| S-4 | Restore on a second device, and after deleting and reinstalling the app | Pro restored; RevenueCat's transfer setting behaves as configured |
| S-5 | Upgrade monthly → yearly | One active subscription; the change happens on the store's schedule |
| S-6 | Cancel in iOS Settings; let accelerated sandbox renewals run to expiry | Pro shows "cancels on …" and is removed at expiry |
| S-7 | Billing retry / grace period (sandbox renewal failure) | Matches the grace setting in App Store Connect |
| S-8 | Refund (StoreKit testing or sandbox) | RevenueCat reports the refund; Pro access ends |
| S-9 | Delete the account while subscribed | The deletion screen warns that the App Store subscription continues until cancelled in Settings; the account is deleted |
| S-10 | Family Sharing (only if you turn it on for the products) | A family member's shared entitlement grants Pro as configured |

## Not testable on a phone, listed so a green checklist isn't over-read

- The root error page needs an error in the app's root layout, which can't be caused on purpose.
- Stripe web billing in live mode stays switched off until you approve it.
