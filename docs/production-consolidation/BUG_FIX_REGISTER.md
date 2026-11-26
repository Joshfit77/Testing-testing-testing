# Bug fix register

**Branch:** `release/narrow-gate-production-consolidation`. Every item below was reproduced or confirmed in the code before
fixing, and has a regression test unless marked otherwise.

**Sources:** the pre-launch audit (2026-11-25) and five independent read-only reviews (security, database, billing,
mobile, architecture). Reviewer findings were verified one by one; some were partly wrong and are marked.

Columns in the open-items table: **TF** blocks TestFlight; **Launch** blocks public launch; **Paid** blocks paid
subscriptions.

## Fixed

| # | Severity | Defect | Fix (commit) | Regression test |
|---|---|---|---|---|
| B-01 | High (data loss / billing) | **Billing F1:** after the 14-day past-due grace, *Manage billing* and the past-due notices disappeared while Stripe kept retrying the card, and the iPhone app offered an App Store purchase on top. The member could be charged twice | An open Stripe subscription keeps Manage billing visible; the app shows a notice instead of the purchase (`56717544`) | `tests/unit/plans.test.ts` (stripeSubscriptionOpen). Page rendering not browser-tested yet |
| B-02 | Medium | **Billing F2:** deleting an account left open Checkout pages payable (a subscription with no account) | Deletion expires open checkouts first (`56717544`) | `subscription-closure.test.ts` (Stripe stand-in) |
| B-03 | Low | **Billing F6:** the price guard didn't check billing-interval count, metered pricing or extra currencies | Stricter guard (`56717544`) | `tests/unit/stripe-price-guard.test.ts` |
| B-04 | Medium | **Database F2 / consent:** the health and prayer-journal AI permissions relied on app code only; a direct write could re-enable old journal "share" marks, or leave sub-permissions on after AI consent was withdrawn | Trigger on withdrawal; restrictive policy for marks; stale marks cleared (`7a6ab043`, narrowed in `ecdca7d8`) | `consent-enforcement.test.ts` |
| B-05 | Medium | **Database F3:** recovery check-ins had no consent check in the database (the app had one) | Restrictive insert/update policies (`7a6ab043`) | `consent-enforcement.test.ts` |
| B-06 | Medium (scale) | **Database F1:** 8 foreign keys without indexes; account deletion and conversation deletion would scan whole tables at scale | Indexes (`7a6ab043`) | `consent-enforcement.test.ts` (catalog check) |
| B-07 | Medium | **Security N-1:** the 30-day sign-in limit wasn't applied on the API's Bearer path, and sessions stayed valid at the auth server | Bearer check plus a daily session-expiry job (`9f6d8866`) | `security-review-hardening.test.ts` |
| B-08 | Medium (cost) | **Security N-2:** the unused avatars bucket accepted unlimited uploads | Upload and overwrite policies removed (`9f6d8866`) | `security-review-hardening.test.ts`, isolation sweep |
| B-09 | Low | **Security N-3:** training-change Undo trusted the stored table name and ignored write errors | Allow-list of tables and columns, errors checked (`9f6d8866`) | Covered by `adaptive-training.test.ts` (existing); no dedicated forged-record test |
| B-10 | Low | **Security N-4:** a member could re-arm an applied coach proposal | Status transition guard; server-side reopen (`9f6d8866`) | `security-review-hardening.test.ts` |
| B-11 | Low | **Security N-5:** unbounded layout preferences | 4,000-byte limit (`9f6d8866`) | `security-review-hardening.test.ts` |
| B-12 | Low (cost) | **Audit S-12:** body-scan photos unlimited in storage | 750 photos / 30 a day / 2 GiB, also under simultaneous uploads (`f9305d6f`) | `body-scan-photo-quota.test.ts` |
| B-13 | Medium (data loss) | **Architecture F2:** a food-log retry reused the first attempt's id after the food changed, so the wrong food was reported as logged | Content-keyed attempt ids (`29d80ca9`) | Existing food tests pass; no dedicated lost-reply test (needs network fault injection) |
| B-14 | Low | **Architecture F6:** removing a diary item or "mark eaten" failed silently | Errors returned and shown (`29d80ca9`) | Not separately tested (needs a forced database error) |
| B-15 | Medium (data loss) | **Architecture F1:** a failed onboarding submit erased all answers | Answers saved again on failure; message instead of the error page (`29d80ca9`) | Not browser-tested with a network fault |
| B-16 | High (store review) | **Mobile M1:** the privacy page bundled in the app said only steps are read; the app also reads sleep and overnight vitals | Page corrected (`29d80ca9`) | Text change; check on device (IPHONE_DEVICE_TESTING.md) |
| B-17 | Medium | **Mobile M5:** run phase cues and the Body Scan timer used `navigator.vibrate`, which the iOS web view lacks | App haptics helper (`29d80ca9`) | Device-only |
| B-18 | Low | **Audit S-7:** AI conversations kept forever | Optional retention period, off by default (`bb5d2337`) | `ai-retention.test.ts` |
| B-19 | Medium (outage) | **Audit:** the $100 global AI limit can stop the AI for everyone without warning | Admin warning with a suggested limit (`bc8cf2d5`) | `ai-economics.test.ts`, `admin-ai-costs.spec.ts` |
| B-20 | Low | **Audit S-17:** 19 settings undocumented | `.env.example` plus a test that keeps it complete (`e84b14d3`) | `env-example.test.ts` |
| B-21 | Low | **Mobile/App Store:** analytics events not declared in the privacy manifest | Product Interaction declared (`f0c44da4`) | `ios-archive-check.test.ts` |
| B-22 | — | **Merge:** Friends migrations clashed with existing numbers | Renumbered 091–093; tests updated to later safeguards (`8fa7c3b5`) | Friends, deletion-closure, catalog tests |

**Reviewer claims not accepted, or only partly:**

- **Database F3 (part):** "the withdrawal message promises sleep vitals are deleted". It doesn't: it says sleep entries
  stay until deleted.
- **Security info item (helper functions callable by the public):** they only answer about the caller. No change.

## Open items O-01 to O-20: resolved in the second round (2026-11-26)

Every item below was implemented by Claude, with a regression test that fails on the old code where one is possible,
then run in the full suite. "Device" means the code is done but its behaviour on a phone still has to be confirmed.

| # | Was | Resolution | Commit | Proof | Still needs |
|---|---|---|---|---|---|
| O-01 | High: locked-screen run fixes only in memory | Every fix the open recorder receives is journalled on the device outside React (at most every 2 s and when the page hides); recovery replays newer fixes | `8a6babae` | `run-fix-journal.test.ts` (60 s saved, 5 locked minutes journalled, app ended, 1,083 m recovered) | Device tests 14–15 |
| O-02 | High (App Review): "not yet verified on a phone" wording | **Not changed, deliberately.** The wording is true until the device tests pass. Prompt P-01 in docs/engagement/ISSUE_PROMPTS.md makes the change in minutes once they do | — | — | Device tests 14–16 |
| O-03 | Medium: native GPS watcher orphaned by a web-view reload | Watcher ids recorded on the device; any not owned by the current page removed before a new watcher starts and at app start | `8a6babae` | `native-orphan-watchers.test.ts` | Device: reload mid-run |
| O-04 | Medium: alarm is a notification; snooze needs the app; exact-alarm permission | Honest wording on the alarm screen; follow-up ring the snooze time after each alarm for the next 7 days, independent of the app running; the exact-alarm finding was wrong (the plugin declares SCHEDULE_EXACT_ALARM) | `ee13eff0` | `sleep-alarm.test.ts` (follow-ups) | Device test 25 |
| O-05 | Medium: no universal links | `/.well-known/apple-app-site-association` and `assetlinks.json` (off until APPLE_TEAM_ID / ANDROID_APP_CERT_SHA256 are set), in-app link handling, `npm run native:app-links` to claim the domain | `100502d5` | `app-links.test.ts` | Owner: Team ID, Associated Domains capability, Play signing fingerprint; then device test 3 |
| O-06 | Medium: Android 15 edge-to-edge unverified | No change needed (Capacitor 8 SystemBars + `viewport-fit=cover` + env() padding); guard test added | `ee13eff0` | `android-edge-to-edge.test.ts` | Android device test 3 |
| O-07 | Low: Back ignores sheets; reminder sync cancels first | Back closes the top sheet or dialog as Escape does; sync schedules first and cancels only stale ids | `ee13eff0` | `native-back.test.tsx`, `native-notifications.test.ts` | Android device test 4 |
| O-08 | Medium: ended admin grant hides a paid plan | Reconciliation recomputes members whose grant ended in the last week | `15c52df8` | `entitlements.test.ts` | Staging cron |
| O-09 | Medium: lost refund / dispute / transfer never repaired | Reconciliation re-reads 3 days of Stripe events through the webhook's claim (no double processing) and rotates store members through RevenueCat | `15c52df8` | `entitlements.test.ts`, `store-billing.test.ts` | Stripe test mode on staging |
| O-10 | Low–Medium: one store purchase on two accounts | The account that confirmed the transaction most recently gets it; the other is recomputed; migration 095 indexes | `15c52df8` | `store-billing.test.ts` | Owner: RevenueCat "Transfer" behaviour (recommended: transfer to new App User ID) |
| O-11 | Medium: Bible note lost | Note kept as a draft until saved; Cancel discards, a swipe keeps it | `13d7db30` | `e2e/bible-reader.spec.ts` (offline save, close, reopen) | — |
| O-12 | Medium: workout finish could report a saved workout as unsaved | Post-save extras run in parallel with 8 s limits and can't fail the save | `b0a11cc0` | `workout-finish-extras.test.ts` | — |
| O-13 | Low: retried photo save could delete a saved photo | Browser never deletes a possibly-saved file; server removes only files no photo uses | `13d7db30` | `progress-photo-save.test.ts` | — |
| O-14 | Low: network blip sent screens to the error page | `useSafeTransition` on 34 screens (61 calls); a guard test fails on any new unguarded call | `13d7db30` | `use-safe-transition.test.ts` | — |
| O-15 | Low: coach calorie tool ignored goal weight; old chats opened blank | Saved pace steered toward the goal weight; older conversations fetched by id | `13d7db30` | `coach-tools.test.ts`, `e2e/coach.spec.ts` | — |
| O-16 | Medium (deploy): storage triggers on hosted Supabase | Trigger creation guarded (warning, policy limit stays, deploy continues); local role grants match hosted; `npm run db:verify` reports the triggers | `b0a11cc0` | Unprivileged-role test; fresh install | One `supabase db push` to staging + `db:verify` |
| O-17 | Low (performance): global AI lock; per-row policy helpers | Migration 094 wraps 38 policies' helpers as InitPlans; the global lock was measured (600–690 reservations/s, about 100× need at 10k members) and kept for correctness | `b0a11cc0` | `rls-policy-initplans.test.ts`; pgbench | — |
| O-18 | Low: unsalted email hash in rate-limit keys | HMAC keyed by a secret derived from the service-role key | `13d7db30` | `rate-limit.test.ts` | — |
| O-19 | Low: integration suites skipped silently | `REQUIRE_TEST_STACK=1` (CI, `npm run verify`) fails instead | `13d7db30` | Verified both ways | — |
| O-20 | Low: sleep test across midnight UTC | Tests that would start within 4 minutes of midnight wait until after it | `13d7db30` | — | — |

## What remains (each needs a phone, an account or a hosted service)

| # | Severity | Description | Who | Hours (with Claude) | TF | Launch | Paid |
|---|---|---|---|---|---|---|---|
| R-01 | High | Physical iPhone run of IPHONE_DEVICE_TESTING.md, especially GPS (14–16), purchases (29–31), HealthKit (17–18), alarm (25); then O-02 wording | Founder + mobile consultant; Claude fixes findings | 6–10 | No | Yes | Yes |
| R-02 | High | App Store sandbox purchase, restore, transfer; Stripe test-mode checkout, portal, refund on staging | Payments consultant + founder accounts | 3–5 | No | No | Yes |
| R-03 | Medium | Staging: `supabase db push` (085 → 095), `npm run db:verify`, cron jobs, staging load test including writes | Backend/DevOps consultant | 3–5 | Yes, if O-16 trips | Yes | No |
| R-04 | Medium | Release engineering: signing, TestFlight upload, App Store Connect record, Associated Domains, privacy label | iOS consultant + founder | 3–5 | Yes | Yes | No |
| R-05 | Medium | Independent review of the consolidation PR (security and payments focus) | Security + payments consultants | 4–6 | No | Yes | Yes |
| R-06 | Low | Android device pass, Play Console, Health Connect declaration | Mobile consultant | 3–5 | n/a | Android only | Android only |
| R-07 | — | Contingency: defects found by R-01..R-06 (Claude implements, consultant reviews) | Claude + consultant | 4–8 | — | — | — |
