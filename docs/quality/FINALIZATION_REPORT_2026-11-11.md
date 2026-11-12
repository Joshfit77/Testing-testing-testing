# Finalization report — 2026-11-11

Branch `claude/finalization-qa`. Not merged, no pull request, nothing submitted to the App Store, no live payments.
It carries the unmerged PR #9 / PR #10 work and the 2D animation branch underneath it. Issue-by-issue detail is in
`docs/quality/ISSUE_REGISTER_2026-11-11.md`.

Every result below comes from the cloud sandbox (local Supabase in Docker, production build, headless Chromium at
phone size) or GitHub Actions. **No physical iPhone or Android device was used.** Nothing was run against real users,
a hosted database, Stripe live mode, App Store Connect or RevenueCat production.

## A. What this pass changed

Four read-only code audits (security and accounts; billing and AI coach; nutrition, GPS, health and notifications;
training, faith and progress) found **no Critical or High defect** and 29 Medium/Low ones. 24 are fixed:

- **Privacy and security**
  - The Bible study helper now asks for AI-data consent and respects the AI kill switch, as the coach already did.
  - Sign-in and password-reset limits are keyed on email + IP, so a stranger can't lock a member out.
  - Email addresses are redacted from server logs.
  - Sign-out now clears the workout draft from a shared device.
- **Billing and AI**
  - Pro access after a failed Stripe renewal is capped at 14 days.
  - Coach chat turns stop before the platform limit, and the reserved usage is released.
  - The Bible helper token cap was raised and cut-short answers and refusals are handled.
  - The GPS upsell no longer hard-codes US prices (and shows none inside the native app).
  - Legacy yearly plans are no longer labelled Monthly.
- **Data loss and correctness**
  - A finished but unsaved GPS run is kept for up to 2 days instead of being deleted after 12 hours.
  - GPS runs can have notes and effort edited (Free and Pro).
  - Food logging keeps the entry and its retry id when a save fails offline.
  - USDA foods no longer record missing macros as zeros.
  - A Health sync no longer overwrites a hand-entered step count.
  - Calories are rounded on write, so the daily total matches the rows.
  - Retries are idempotent for relog, saved meal, copy day and recipe.
  - Offline reading-journey check-ins are no longer silently dropped (dropping them could trigger an undeserved Day-1
    restart).
  - Body measurements, and every weight entry, can be deleted.
  - Streaks are correct beyond 120 days.
  - Failed deletes and toggles now show an error instead of looking successful.
  - Deleting a workout no longer leaves stale personal records.
  - The workout editor keeps edits on a network failure.
  - The personal-bests table is complete for long histories.

73 unit tests were added. The strict reading-journey restart rule, the 40-day challenge rules and all prices
($0 / $19.99 / $149.99) are unchanged.

## B. Feature status

Legend: **Verified** = passes automated browser and/or integration tests in the sandbox. **Device** = implemented,
needs a real phone. **Partial** = works with a known gap. **Blocked** = needs an external account or decision.

| Area | Status | Notes |
|---|---|---|
| Sign-up, sign-in, sign-out, password reset, email confirmation | Verified | Apple Sign In needs the device and Apple configuration |
| Account deletion (typed DELETE + password, explanation, store-subscription guidance) | Verified | Path: You → Privacy & data → Delete account |
| Data export | Verified | |
| Onboarding → first workout | Verified | Five screens but about ten inputs; owner decision T8 on a starter load |
| Workout logging, rest timer, history, PRs, editing | Verified | |
| 2D exercise demonstrations | Verified | Studio character redesign is preview-only, not integrated |
| AI coach (consent, quota, approval before changes) | Verified with a mock provider | Live provider not called |
| Nutrition: search, diary, recipes, meal plans, water | Verified | Water retries not yet idempotent |
| Barcode scanner | Device | Lookup needs Open Food Facts online; camera needs the phone |
| Food-photo and label-photo AI | Verified with a mock provider | Estimates are labelled as estimates |
| GPS run recording | Device | Maths and persistence verified with recorded traces |
| Manual and treadmill runs | Verified | |
| Apple Health / Health Connect (steps, sleep) | Device | Import logic verified with synthetic data |
| Faith: Bible, plans, journeys, journal, devotionals, 40-day challenge | Verified | |
| Progress: weight, measurements, photos, PRs, badges | Verified | |
| Notifications and reminders | Device | Planner verified; delivery needs the phone |
| Free / Pro gating | Verified | Server-side |
| Stripe web checkout and webhooks | Verified in test mode | No live purchases |
| Apple / Google in-app purchases (RevenueCat) | Blocked | Needs sandbox testers and store products; Play billing interval (B1) unconfirmed |
| iOS / Android builds | Not re-run in this pass | Earlier CI runs built the unsigned iOS archive |

## C. Test evidence (this pass)

| Check | Result |
|---|---|
| Typecheck, lint | pass |
| Unit | 3,599 passed |
| Integration (local database) | 336 passed, 1 skipped |
| Production build | pass |
| Browser suite, production build | 125 passed, 99 skipped (demo-only and device-only), 0 failed |
| Browser suite, demo mode (`demo.spec.ts`) | 17 passed |
| `npm audit --omit=dev` | 0 vulnerabilities |
| GitHub Actions CI run 141 (checks, integration, gitleaks full history, dependency audit) | success |

## D. Remaining risks before a public launch

- **Release blockers**
  - Run the app on a physical iPhone: GPS in the background and on screen lock, HealthKit, camera and barcode,
    notifications, Sign in with Apple, offline behaviour.
  - Configure App Store Connect products and RevenueCat, then test purchases, restore and cancellation in sandbox.
  - Legal review of the Privacy Policy and Terms; the app still labels them "Drafts awaiting legal review".
  - Apple privacy labels and permission strings checked against the final build.
- **Open defects**
  - B1: Google Play interval (needs a Play sandbox).
  - B7: membership screen polish.
  - N5: barcode foods lose detail when re-logged (schema change).
  - Water retries are not idempotent.
- **Owner decisions**
  - T8: prefill a starter weight on the first workout?
  - T10: snapshot the time zone on a reading journey?
- **Not measured**
  - Real-device frame rate, battery, memory and startup time.

## E. Demo deliverables

- Runnable demo: `npm run demo` (local database, demo mode, no payments, simulated AI), then open
  http://localhost:3000. Reset with `npm run demo:reset` or the in-app Reset demo control. See `docs/DEMO.md`.
- Walkthrough video: 7 min 31 s, 1080×1920 H.264, all 24 requested sections, simulated features captioned as
  simulated. Recorded from the running demo. Too large for the repository (56 MB); delivered separately.
- Contact sheet: `docs/screenshots/finalization-2026-11-11/walkthrough-contact-sheet.webp`.
- Known demo limits:
  - The barcode lookup needs internet (the video shows the honest "Open Food Facts isn't responding" screen).
  - Sign-up is shown but not submitted.
  - Account deletion is shown but not submitted for the sample member.
- There is no hosted preview URL; deploying one needs the owner's approval.

## F. Readiness (evidence-based, not a guarantee)

| Dimension | Assessment | Basis |
|---|---|---|
| User experience | Good | Full browser suite and demo walkthrough; first workout reachable in a few taps |
| Reliability | Good in the browser; unproven on device | Offline and retry paths now covered by tests; no device runs |
| Performance | Unmeasured on device | Only sandbox measurements exist |
| Security | Good | Audits found no Critical or High issue; RLS, server-side gating, secret scan and dependency audit clean |
| Subscriptions | Web: good in test mode. Mobile: not ready | Store products and sandbox purchases not yet configured or tested |
| App Store compliance | Close | Account deletion, consent, disclosures in place; legal review and device checks outstanding |
| **Overall** | **Ready for a private TestFlight build after physical-device checks; not ready for a paid public launch** | Mobile purchases, device testing and legal review are outstanding |
