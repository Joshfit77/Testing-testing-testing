# Founder-led tasks (with Claude's guidance)

Everything below is operational work that needs a person's hands, accounts or phone, not engineering judgement.
The founders do it; Claude prepares every step, reads every result, and fixes anything that goes wrong with a test.
Consultants are only needed for the independent review and for reviewing fixes (ENGAGEMENT_AGENDA.md).

**How to work with Claude on each task:**

1. Start a Claude Code session in this repository.
2. Paste the task's prompt, from `ISSUE_PROMPTS.md` or below.
3. Do what Claude asks and paste back what you see: screenshots, recordings, command output.

**Rules:**

- Never paste a key, password or card number into the chat. Claude tells you where to enter them: hosting settings,
  GitHub secrets, or your own terminal.
- Mark a test passed only after doing it yourself on a real phone. Record the date, device, iOS or Android version
  and build number.
- Stop and ask Claude if anything differs from the expected result, even slightly. That is what the checklists are for.

## The tasks, in order

| # | Task | Who | Time (founder) | Needs first | Claude's part | Done when |
|---|---|---|---|---|---|---|
| F-1 | **Accounts and settings:** Apple Developer and App Store Connect record (`com.narrowgatefitness.app`), Paid Apps agreement, the two subscription products at $24.99 / $149.99, RevenueCat project, entitlement, webhook and transfer behaviour, Stripe **test mode** prices, webhook and portal, staging Supabase project, hosting with the `.env.example` variables, GitHub ruleset and `testflight` environment, Turnstile keys | Founder | 4–6 h, plus Apple's processing | — | A checklist with the exact screens and values (FOUNDER_ACTION_ITEMS.md, PAYMENT_VERIFICATION.md, `docs/STAGING_ENVIRONMENT.md`); checks each setting from your screenshots | Claude has confirmed every setting from your screenshots |
| F-2 | **Staging database and load test:** `supabase db push` to staging, `npm run db:verify`, the staging load test | Founder runs the commands | 1.5–2.5 h | F-1 (staging) | Prepares each command (P-03, P-04); reads the output; explains any warning; fixes anything with a test | 11 of 11 database checks ok; load test without errors |
| F-3 | **TestFlight build:** add the signing secrets to GitHub, run the iOS workflow's `testflight` job, install from TestFlight | Founder | 2–3 h, plus Apple's processing | F-1 | Walks you through `docs/TESTFLIGHT_FIRST_BUILD_GUIDE.md` (P-08); reads the workflow logs; fixes build problems | The build installs from TestFlight and opens |
| F-4 | **iPhone device pass:** the 42 tests in `IPHONE_DEVICE_TESTING.md`, including a 30-minute outdoor run, locked-screen and app-ended GPS, alarm, purchases, HealthKit, keyboard and safe areas | Founder (ideally two iPhones) | 7–10 h over 2–3 days | F-3 | Triages every failure to its root cause (P-02); writes the fix and a test; gives you exactly what to re-test | Every row has a result with evidence; failures fixed and re-tested |
| F-5 | **Sandbox payments:** App Store sandbox buy, restore, cancel, refund and transfer; Stripe test mode checkout, renewal, failed payment, refund and dispute on staging | Founder | 2–3 h | F-1, F-3 | Tells you the expected database state after each step (P-05, P-06); compares it with yours; fixes differences with tests | Every step matches the expected state |
| F-6 | **Universal links:** Associated Domains capability and the Team ID | Founder | 0.5–1 h | F-1 | Runs `npm run native:app-links`; checks the `.well-known` answers (P-07) | Device test 3 opens the app |
| F-7 | **Android device pass** (optional, if launching on Android) | Founder | 3–5 h | APK workflow | As F-4, with `ANDROID_DEVICE_TESTING.md` (P-10) | As F-4 |

**Founder time in total:** about 17–26 hours for the iOS launch with paid subscriptions, plus 3–5 hours for Android.
It is spread over about a week, mostly waiting for Apple. It is not billed, but it is real time: plan for it.

## When to bring in a consultant (escalation)

Ask for a consultant only when Claude and you can't resolve something within one working day, for example:

- Xcode or certificate trouble that Claude can't diagnose from the workflow logs;
- a device-only behaviour Claude can't reproduce or explain, after two attempts at a fix;
- an App Review rejection that needs a judgement call.

The engagement keeps a small reserve for this: hours used only if needed (ENGAGEMENT_AGENDA.md).

## What makes this safe

- **Precise checks:** every device test and sandbox step has an exact expected result, written by Claude from the
  code, so a non-engineer can tell pass from fail.
- **Evidence:** screen recordings and console logs come back to Claude, which finds the cause in the code and writes
  the fix with a test.
- **Independent review:** every fix that comes out of these tasks is reviewed by a consultant before merge (agenda
  item C-3).
- **Owner approval:** nothing is deployed, merged, billed or uploaded to the store without your explicit approval.
