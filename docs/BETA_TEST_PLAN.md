# 15-tester beta: test plan

A first closed beta of Narrow Gate Fitness on real phones, through TestFlight (iPhone) and an internal test track
(Android). The goal is to learn whether a new member can get from install to a finished first workout without help,
and whether the things automated tests can't reach (camera, notifications, Apple Health / Health Connect, store
purchases in sandbox, GPS outdoors) work on real hardware.

The targets below are **benchmarks to measure against, not results**. Nothing here has been run with testers yet.

## Who

| Group | Count | Why |
|---|---|---|
| New to lifting (under 1 year) | 5 | The onboarding and the current-set card are built for them; the beginner RPE cap matters most here |
| Regular lifters (1–5 years) | 6 | Logging speed, "last time" and pre-filled numbers, program progression |
| Experienced (5+ years) | 2 | Program quality, warm-up vs working sets, records |
| Faith-first members (any level) | 2 | Bible reading, prayer journal, 40-day challenge, reminders |

Device mix to aim for: at least 4 iPhones of different sizes (one SE-size), 1 iPad, 4 Android phones (two makes),
and at least one phone with text size set to the largest.

## Before handing out builds

1. One person (owner or developer) runs the **device smoke test** below (and the fuller
   `docs/device-testing/DEVICE_TEST_SCRIPT.md`) on one iPhone and one Android phone. In
   particular, confirm the notification fix of 2026-11-04 on real hardware: reminders schedule, the sleep alarm
   schedules, and signing out clears them (see `tests/unit/capacitor-plugin-thenable.test.ts` for what changed).
2. RevenueCat in **sandbox** only; every tester's account id is on the sandbox allow-list
   (`docs/MOBILE_BILLING.md`). Live Stripe stays off (`STRIPE_LIVE_APPROVED` unset).
3. `DEMO_MODE` is **not** set on the beta deployment (the server refuses it on Vercel production and with live
   Stripe approved, but the beta should not rely on that guard).
4. A feedback channel testers can reach from their phone (TestFlight feedback, plus one shared form).

## Device smoke test (one person, ~45 minutes per phone)

| # | Check | Pass when |
|---|---|---|
| 1 | Install, open | The opening gate plays once; the welcome screen fits the screen |
| 2 | Sign up, onboarding quick path | Plan built after goal, experience, schedule, equipment, about you |
| 3 | Start today's workout | The current-set card shows exercise 1, set 1, big weight and reps controls |
| 4 | Complete a set with one tap; double-tap on purpose | One set completes, the rest ring starts; the double tap doesn't complete two sets |
| 5 | Lock the phone during rest | The rest-end notification arrives (sound/vibration per settings) |
| 6 | Undo, then complete again straight away | Both taps work |
| 7 | Finish early | "Finish early?" says how many sets aren't counted; completion stats count only done sets |
| 8 | Same program day next week (or re-open it) | "Last time" shows the previous numbers; weight pre-filled |
| 9 | Turn on reminders (Profile → Notifications) | Permission prompt once; reminders appear at their times |
| 10 | Sign out | Pending reminders and the sleep alarm are gone (Settings → Notifications shows none) |
| 11 | Barcode scan, meal photo | Camera opens, a product resolves, a photo is analysed or clearly refused |
| 12 | Apple Health / Health Connect | Permission sheet, then steps or sleep import |
| 13 | GPS walk outdoors, 10 minutes | Route and distance look right; pause/resume |
| 14 | Membership screen | Both plans visible ($17.99/month, $119.99/year); sandbox purchase and restore work; Faith stays free |
| 15 | iPad | Billing shows the App Store path, never the web checkout or Google Play |

Anything that fails here is fixed before the 15 testers get the build.

## What testers do

**Week 1:** install, sign up, finish onboarding, complete the first workout, and use the app for at least two more
sessions. Try one Faith feature.
**Week 2:** normal use, at least three workouts. Turn on one reminder. Try the AI coach once.

Testers are not given a script for week 1's first session, so we measure what a new member does on their own.

## What we measure

| Measure | How | Benchmark (not a result) |
|---|---|---|
| Install → first completed set | Activation events (`docs/activation/`) | Median under 3 minutes |
| Onboarding finished | Activation events | At least 13 of 15 |
| First workout finished | Activation events | At least 12 of 15 |
| Came back for a second workout within 7 days | Workout history | At least 10 of 15 |
| Crashes | TestFlight / Play console | None that lose a logged set |
| Lost data | Tester reports + server drafts | None |
| "I couldn't find how to…" reports | Feedback form | Each one triaged |
| Wrong numbers (volume, records, pre-fills) | Feedback form | Each one reproduced or explained |

For reference, the automated walk of the quick path on 2026-11-04 took 10 taps and 4 typed fields to finish
onboarding and 12 taps to the first completed set (`docs/activation/measurements/activation-2026-11-04-essentials-first.json`).
That is a browser robot, not a person: it says how short the path is, not how long a person takes.

## Questions for every tester (end of week 2)

1. What did you expect the app to do that it didn't?
2. Was there a moment you weren't sure what to tap next? Where?
3. Did any number look wrong (weight, volume, a record, "last time")?
4. Did the exercise demonstrations help? Which ones looked wrong?
5. Would you pay for Pro? Which plan, and why or why not?
6. (Faith testers) Did the daily reading and prayer rules feel encouraging or punishing?

## Exit criteria for moving on from the beta

- No open defect that loses data, charges incorrectly, or unlocks Pro without a purchase.
- The device smoke test passes on iPhone, iPad and Android.
- At least 10 of 15 testers finished a first workout without asking for help.
- Every "wrong number" report is fixed or explained.
