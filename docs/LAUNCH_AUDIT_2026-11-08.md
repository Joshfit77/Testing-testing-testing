# Narrow Gate Fitness: complete product experience and launch audit (2026-11-07/08)

Branch `claude/faith-discipleship` (merged from `audit/merge-2026-11-07`). Nothing was merged into `main`, nothing was
deployed, and no real payment path was enabled. Every result below was produced in this audit; anything not run says so.

Detailed findings, one file per group of areas, with full inventories (files, components, server actions, API routes,
tables and migrations, native plugins, integrations):

| Areas | Findings file |
| --- | --- |
| 1 Onboarding · 2 Workouts and programs · 3 2D demonstrations · 4 Nutrition · 5 Faith · 6 AI Coach | `docs/audit-2026-11-07/product-areas-1-6.md` |
| 7 Subscriptions · 8 Reliability and offline · 9 Performance · 10 Accessibility | `docs/audit-2026-11-07/product-areas-7-10.md` |
| 11 GPS running, walking, cardio, treadmill | `docs/audit-2026-11-07/gps.md` and the device script `gps-device-test-script.md` |
| 12 Sleep, recovery, Apple Health | `docs/audit-2026-11-07/sleep.md` (device checklist: `docs/SLEEP_DEVICE_CHECKLIST.md`) |
| Visual quality against the 10-page reference | `docs/VISUAL_COMPARISON_2026-11-07.md` |

## 1. Assessment, each dimension separately

| Dimension | Score | Basis |
| --- | --- | --- |
| Visual quality | **7.4 / 10** | Screen-by-screen comparison with the reference: readability 8.7 and usability 8.6 average; imagery 6.4 (flat vector art where the reference is photographic) and the order of three screens hold it back. |
| Functionality | **8 / 10** | Every area works end to end in the browser; the native paths (background GPS, HealthKit import, alarm, camera) are built but unverified on hardware. |
| Performance | **8 / 10** | On the production build at 393 px with slow-4G and a 4× slower CPU: first paint 1.1–1.6 s and largest paint 1.1–1.9 s on every main screen. Heaviest: Nutrition (446 kB JS), workout logger (366 kB). Local server; hosted timings will be higher. |
| Reliability | **7.5 / 10** | Idempotent saves, offline drafts and retries, crash recovery and the two-tab conflict (fixed) all proved in the browser; the open risks are native (web-view suspension, process kills) and a silent sign-out redirect mid-workout. |
| Security | **9 / 10** | Free/Pro enforced on the server for every Pro action (new direct-call test), repeated by database triggers; owner-only row-level security re-proved across workouts, meals, journal, coach and memories; webhooks signed and replay-safe; no private prayer text reaches the AI unless the member opts in per entry (owner decision below). |
| GPS accuracy | **8 / 10** | Within 1–3 % on synthetic and controlled traces; jitter, tunnels, accuracy spikes, duplicate and out-of-order fixes, DST all handled without inventing distance. Not yet measured against real GPS hardware. |
| Sleep accuracy | **8 / 10** (7 before this audit) | Two violations of the "never invent sleep metrics" rule were found and fixed: imported afternoon naps were added to "last night", and the coach was told "0 m deep / REM" when stages were simply not recorded. Missing nights never count as zero; estimates are labelled. Four low edge cases remain open. |
| **Launch readiness** | **Internal TestFlight: ready once staging exists. Paid public launch: not ready.** | The code has no open critical or high defect. What blocks a paid launch is verification that can only happen on real phones and accounts (section 4). |

## 2. What was fixed in this audit (all with regression tests, all merged)

| Area | Fix | Severity | Test |
| --- | --- | --- | --- |
| 12 Sleep | Imported records of three hours or less that start between 9 AM and 8 PM are stored as naps, not added to the night | Medium | `tests/unit/sleep-audit.test.ts`, `sleep-import-action.test.ts` |
| 12 Sleep | The coach summary says stages are "unknown, not zero" when a device recorded no stage detail | Medium | `tests/unit/sleep-audit.test.ts` |
| 12 Sleep | Debt table marks in-bed-only nights; daily energy no longer draws a curve from an assumed 7 AM wake; readiness says it comes from the four self-ratings; import wording corrected | Low | same |
| 1 Onboarding | A second sign-up with an existing e-mail now gets the same "check your inbox" answer instead of an error (no account enumeration, no error log) | Medium | `tests/integration/duplicate-signup.test.ts` |
| 1, 4, 5 | Dates such as 2026-02-30 are refused by validation instead of failing at the database | Low | `tests/unit/validation-dates.test.ts` |
| 8 Reliability | A slower second tab no longer overwrites sets logged in another tab; the newer copy is adopted | Medium (P2) | `tests/unit/workout-two-tabs.test.ts`, browser re-run |
| 11 GPS | The recorder's total time keeps counting while paused (it froze and jumped) | Low | `tests/unit/gps-recorder-audit.test.tsx` |
| 10 Accessibility | The logo link's accessible name matches its visible text on every screen (axe "serious") | Medium | `tests/unit/logo-link-name.test.tsx`; axe 0 violations on 51 screens |
| 7 Subscriptions | Proof that a Free member calling every Pro server action directly is refused and nothing is written | Test added | `tests/integration/free-user-direct-actions.test.ts` (9) |
| 7 Docs | Four documents still listed retired prices ($24.99 / $249.99); now $19.99 / $149.99 | Low | — |
| Tooling | e2e e-mail links and the Bible-helper mock now follow the server and port under test, so the suite runs on any port | Low | whole e2e suite |
| 6 AI Coach (found 2026-11-09 by the demo crawl) | The redesign's "Today at 9:24 AM" message stamps were built in the server's time zone, so every visit to the coach from another zone hit React hydration error #418; the stamp is now rendered in the browser only | Medium | `e2e/coach-timezone.spec.ts` (browser 14 h ahead of UTC) and `coach.spec.ts`: 10 passed, 1 skipped by design, on a fresh production build |

## 3. Test results on the merged branch (this audit, real numbers)

| Check | Result |
| --- | --- |
| `tsc --noEmit` | clean |
| `eslint src e2e tests` | clean (one unused import removed) |
| Unit and integration, `vitest run` (all projects) | 175 files passed, 51 skipped (integration files skip when the database is unreachable at that moment); 3,332 tests passed, 329 skipped, 0 failed |
| Integration only, `vitest run --project integration` against local Supabase | 51 files passed, 1 skipped; 331 tests passed, 1 skipped, 0 failed |
| `next build` (production) | success |
| Playwright e2e, full suite on the production build | 118 passed, 0 failed, 59 skipped (demo-mode and desktop-only cases, skipped by design as in every earlier run) in 12.2 min |
| axe-core sweep, 51 signed-in screens at phone size | 0 violations (after the logo fix) |
| Throttled load measurements, 13 routes | see section 1 and `product-areas-7-10.md` |
| GPS area e2e (`gps-run`, `run`) and integration (`gps-running`, `activities`) | 10 / 10 and 16 / 16 passed |
| Sleep integration (`tests/integration/sleep*`) | 16 / 16 passed |
| Areas 1–6 e2e on a separate server | 23 passed, 1 skipped by design, 0 failed |

## 4. Remaining launch blockers, ranked

### Must be done before a paid public launch

1. **Physical-device verification (iPhone and Android).** Nothing native has run on hardware in this audit, and none of
   it may be called verified: background and locked-screen GPS (script `gps-device-test-script.md` sections A–E),
   HealthKit / Health Connect sleep import and the smart alarm (`SLEEP_DEVICE_CHECKLIST.md` A1–A15, B1–B10), local
   notifications, the camera (barcode, meal photo, label, Body Scan), VoiceOver. Until GPS section C passes, the store
   listing must not promise recording with the screen locked.
2. **Store purchases in sandbox**: purchase, restore, renewal, refund and expiry through App Store and Google Play with
   RevenueCat. Server enforcement is proved; the store side has only been tested with simulated events.
3. **Staging deployment** (owner approval needed) with error reporting switched on, then a TestFlight build that points
   at it. Transport security and environment separation can only be checked on a hosted deployment.
4. **Legal text**: counsel completes the Terms and Privacy Policy, including the journal-sharing decision below and the
   health, location and AI processing.
5. **Live AI evaluation** with a spend-limited key (`docs/LIVE_AI_TEST_PLAN.md`); everything so far ran against a mock.

### Owner decisions (code is ready either way)

6. **Prayer journal and the coach.** The journal is private and excluded from AI by default, but each entry has an
   opt-in "Share with AI Coach" that puts a one-line excerpt into the coach's context. If the rule is "never", remove the
   option; if it stays, name it in the privacy policy.
7. **2D demonstrations sign-off.** All 157 exercises have an honest animated demonstration, but none is marked
   owner-approved.
8. **GPS after a crash.** "Continue recording" counts the whole time away as moving time; a one-line change makes it a
   pause instead.

### Should be fixed before a wider beta

9. The offline single-file edition (`standalone/index.html`, used only by the offline Android APK workflow) still shows
   the pre-October plans and prices. Do not ship that APK until it is regenerated; the App Store app is not affected.
10. A background sync that finds the member signed out redirects to the login page mid-workout without a message (the
    draft is kept).
11. No root-level error page (`global-error.tsx`): an error in the root layout shows the framework default and is not
    reported.
12. Sleep edge cases: a night split into two sessions with mixed detail overstates efficiency slightly; imported nights
    take the device's current time zone after travel; the hub's stage total and the session figure can differ by a few
    minutes; a device zone ahead of the profile zone can push a night out of "this week".
13. GPS: a start abandoned while still acquiring a fix leaves the "Recording" pill until discarded.
14. No soft confirmation for implausible loads (a 1,000 kg typo becomes a personal record).

### Nice to have

15. Performance: load chart code on demand (about 399 kB off Progress and Sleep), trim the two faith-only fonts from
    other screens (67 kB), lazy-load the badge grid (about 2.1 MB at full size).
16. Accessibility: bottom tab labels are 10–11.8 px on phones narrower than 400 px and ignore the large-text setting;
    the muted gold is fine for borders but not for body text.
17. Visual: the prioritised presentation plan in `VISUAL_COMPARISON_2026-11-07.md` (hero art with depth for Home and
    Faith, program-card art, demonstration framing and lighting, section order on Programs, Faith and Nutrition).

## 5. Browser-tested versus physical-device

| Capability | Proved in this audit (browser, unit, integration) | Needs a physical phone |
| --- | --- | --- |
| Workout logging, programs, rest timer, offline drafts, two tabs | Yes | Haptics, rest alarm sound with the screen off |
| GPS maths, permission states, pause/resume, offline save, recovery, treadmill without location | Yes | Locked-screen and background recording, calls, Low Power Mode, real accuracy |
| Free/Pro enforcement | Yes (server and database) | Store purchase, restore, refund, expiry |
| Sleep logging, import logic, debt, trends, labels, coach summary | Yes | HealthKit / Health Connect permissions and real data, alarm |
| Nutrition search, barcode lookup, photo flow with the AI mock | Yes | Camera capture and scanning |
| Faith, Bible offline, journal privacy | Yes | — |
| Accessibility markup and contrast | Yes (axe, computed contrast) | VoiceOver and TalkBack |
| Apple Health workout writing | Not applicable: the app reads steps and sleep only and never writes workouts (by design, stated in Info.plist and the privacy page) | Confirm nothing is written (GPS script section E) |

## 6. Annual price

$149.99 a year and $19.99 a month in every source (code, store product docs, legal text, tests, the reference PDF). No
price was changed.
