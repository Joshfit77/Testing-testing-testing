# Final release report — 2026-11-12

Branch `claude/rc-verification`. Nothing has been merged into `main`, published, deployed, submitted to the App Store, or
connected to real billing. Prices are unchanged: Free $0, Pro Monthly $19.99, Pro Annual $149.99.

## What changed in this round (owner approval of Phases 1 and 2)

| Area | Change | Proof |
|---|---|---|
| Security (P1a) | Test-only settings (Stripe/RevenueCat/AI/Open Food Facts stand-ins, sign-in rate-limit scaling) are honoured only for addresses on the same machine and never on a production deployment | `tests/unit/test-overrides.test.ts` |
| Reliability (P1b) | One retry-safety helper for every diary save (food, photo, label, recipes, water) | unit + integration tests; label-check retry test (one row for 3 sends, 2 concurrent) |
| T10 | A reading journey keeps the time zone it started in; a change takes effect at the next shared midnight, never rewrites finished days and can't rescue a missed day (migration 061) | `tests/integration/faith-journey-timezone.test.ts` |
| T8 | A loaded lift asks for its weight, or an explicit "no added weight", before a set is logged. No weight is invented; bodyweight stays one tap; previous weights carry over | unit + e2e (`current-set-card.spec.ts`) |
| M1–M6 | Onboarding at 200 % text, controls on first view at 375 × 667 and 320 × 568, rest timer in view, 48 px steppers, honest offline banner | `e2e/usability-medium.spec.ts` (each acceptance criterion) |
| B7 | Yearly card shows "$89.89 less than 12 monthly payments" (from the prices shown); website Restore purchases; direct Apple/Google subscription links for store-billed members | unit + e2e |
| Drop sets | "Add a drop set (no rest)" after a working set; empty weight for the member to enter; counts for volume; saved, survives edits, kept out of "last time" (migration 062) | unit, integration, e2e (`drop-sets-repeat.spec.ts`) |
| Repeat workout | "Do this workout again" on a saved workout: same exercises and planned sets, weights from the member's own last time; another member's workout can't be repeated | unit + e2e |
| Account deletion | New browser test: DELETE + password required, wrong password refused, account and data gone, sign-in fails afterwards | `e2e/account-deletion.spec.ts` |

A real defect was caught by the new e2e before commit: Finish didn't send the drop-set flag, so drops were saved as
normal sets. Fixed and covered by a unit test.

## Automated results on the final code

| Suite | Result |
|---|---|
| Typecheck, lint | clean |
| Unit | 3,651 / 3,651 |
| Integration (local Supabase) | 369 passed, 1 skipped by design |
| Production build | clean |
| Browser e2e, production server (mock AI + mock Open Food Facts) | 134 passed, 0 failed (deletion spec fixed and re-run); 99 skipped = demo-server specs and opt-in suites, run separately below |
| Browser e2e, demo server | 57 passed, 1 skipped (data-dependent) |
| Button sweep (opt-in) | 49 screens, 270 controls, 0 findings |
| AI coach without a key | "unavailable" message shown, send disabled |
| WebKit / iPhone Simulator | run only in CI (`ios.yml`): see the PR |

## Demo and video

- **Interactive demo**: the real app in demo mode with about 30 days of synthetic data (29 workouts, 30 days of food,
  8 runs, 28 nights of sleep, a 90-day Gospels journey on day 21, prayer journal, badges), a Free/Pro switch and
  in-app Reset. Run it locally with `npm run demo`. **Blocker for a live link:** hosting it means pushing a
  `demo-preview-*` tag, which deploys a private Vercel preview. That is a deployment, so it waits for owner approval.
  The tappable screenshot tour from 2026-11-09 is still at https://claude.ai/artifact/L1eCXFJ1a3UjtQuta3nzRU, but it
  predates this round.
- **MP4 walkthrough**: `deliverables/narrow-gate-walkthrough-2026-11-12.mp4` in the working copy, not committed
  (7 min 49 s, 1080 × 1920, 24 chapters). It was recorded from this build in demo mode. Every simulated feature is
  captioned "(simulated in the demo)": AI replies, barcode camera, meal photo, GPS routes, Apple Health nights and
  purchases. The barcode lookup shows its offline error because the recording machine has no internet.

## 1. Verified functionality (automated tests against the real app and a real local database)

Sign-up, email confirmation, onboarding, plan building, workout logging (T8, drop sets, repeat, skip, undo, rest,
offline sync), history editing, programs and templates, nutrition diary (search, quick add, water, recipes, meal
planner, label check, retry safety, cached barcode basis), Faith (Bible reader, red letters, journeys with the strict
restart rule and T10, prayer journal, challenges), notifications planning, membership screen and server-side Pro
gating, Stripe webhook handling (test mode), account export and deletion, cross-user isolation, CSP, rate limits.

## 2. Tested only with mocks or simulators (not verified live)

- AI coach, meal photo, label photo and Bible study assistant: mock AI server only. No paid AI calls were made.
- Barcode: mock Open Food Facts. The camera scanner hasn't been used on a device.
- GPS: synthetic traces in the browser. No real outdoor run has been recorded.
- Apple Health / Health Connect: code paths and simulator only.
- iPhone layout and opening gate: iOS Simulator in CI.
- Purchases: no App Store or Google Play sandbox purchase has been made. Stripe runs in test mode with stand-ins.

## 3. Physical-device tests remaining

The scripts are in `docs/device-testing/` and `docs/TESTFLIGHT_INTERNAL_CHECKLIST.md`. They cover:

- a real outdoor GPS run with the screen locked;
- Apple Health and Health Connect permission and import;
- the camera barcode scanner and meal/label photos;
- notifications delivered at the right local times;
- offline workout sync on cellular;
- 200 % Dynamic Type;
- VoiceOver and TalkBack.

## 4. Subscription sandbox tests remaining

- App Store sandbox: buy monthly and yearly, upgrade, cancel, restore, refund, expiry and grace period.
- Google Play sandbox: the same set (blocked until the Play console is set up — register item B1).
- RevenueCat webhooks to staging.
- Stripe test-mode checkout and portal on staging.

None of this has been run.

## 5. Actual launch blockers

1. Staging deployment (Supabase project and hosting), which needs owner approval.
2. App Store and Google Play sandbox purchase verification (section 4).
3. Physical-device pass (section 3), especially GPS, Health and the camera.
4. Live AI validation with a real key and a cost cap (the harness exists; it needs a key and approval to spend).
5. Final legal review of the Terms and Privacy Policy (currently marked as drafts).
6. App Store Connect setup: products at $19.99 / $149.99, screenshots, privacy labels, review notes.
7. Owner review of this pull request and approval to merge.
