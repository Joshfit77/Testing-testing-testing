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

## Open (not fixed here)

| # | Severity | Description | Files | How to reproduce | Recommended fix | Expertise | Hours | TF | Launch | Paid |
|---|---|---|---|---|---|---|---|---|---|---|
| O-01 | High | **Mobile M3:** run data recorded while the screen is locked is kept only in memory until the app resumes; if iOS ends the app, that part of the run is lost | `src/components/run/gps-recorder.tsx`, `src/lib/native/location.ts` | Device: 30-minute locked run, then force-quit the app | Buffer GPS fixes natively (a small Swift/Kotlin plugin writing to a file) and read them back on resume | iOS/Android engineer | 12–24 | No | Yes, if GPS is advertised | No |
| O-02 | High (App Review) | **Mobile M2:** the run screen says "not yet verified on a phone" | `src/lib/native/location.ts:206` | Open Run in the app | Change the wording after the device tests in IPHONE_DEVICE_TESTING.md pass | Owner + Claude | 0.5 | No | Yes | No |
| O-03 | Medium | **Mobile M4:** the background GPS watcher can be left running after the web view reloads | `src/lib/native/location.ts` | Device: reload the web view mid-run | Store the watcher id, and remove any old watchers at start-up | Mobile engineer | 3–6 | No | Yes | No |
| O-04 | Medium | **Mobile M6:** the sleep "alarm" is a normal notification (muted by Silent and Focus); snooze may not work while the app is closed; Android exact-alarm permission isn't declared | `src/lib/native-alarm.ts` | Device | Call it a wake reminder, or implement a real alarm; set snooze to open the app in the foreground; declare the Android permission | Mobile engineer | 4–10 | No | Yes | No |
| O-05 | Medium | **Mobile M7:** no universal links, so email links open in the browser, not the app | `ios/App/App/App.entitlements`, `android/.../AndroidManifest.xml` | Sign up in the app, then tap the confirmation email | Associated domains, `.well-known` files and an `appUrlOpen` handler | Mobile engineer | 6–10 | No | Recommended | No |
| O-06 | Medium | **Mobile M8:** Android 15 edge-to-edge insets are unverified | `capacitor.config.ts`, app shell CSS | Device: Pixel on Android 15, 3-button navigation | Configure system-bar insets | Mobile engineer | 3–6 | n/a | Android only | No |
| O-07 | Low | **Mobile M9/M10:** the Android back button ignores open sheets; reminder sync cancels before scheduling | `src/lib/native.ts`, `native-notifications.ts` | Device | A back event that overlays can consume; schedule first, then cancel the difference | Claude | 3–5 | No | No | No |
| O-08 | Medium | **Billing F3:** when an admin grant ends, a paying subscriber can show as Free until the next billing event | `billing-reconcile.ts` | Integration: a grant expiring with an active store row | Reconcile also recomputes recently expired entitlements | Claude + review | 3–5 | No | No | Yes |
| O-09 | Medium | **Billing F4:** a lost refund, dispute or transfer event is never repaired by reconcile | `billing-reconcile.ts` | Integration with stand-ins | Rotate store rows through reconcile; replay failed Stripe events | Claude + payments engineer | 6–12 | No | No | Yes |
| O-10 | Low–Medium | **Billing F5:** nothing in the database stops one store purchase from granting two accounts (depends on RevenueCat transfer settings) | `apply_store_snapshot` | Stand-in returns the same transaction for two users | Refuse a transaction already held by another user; set RevenueCat "transfer" behaviour (owner) | Claude + owner | 3–6 | No | No | Yes |
| O-11 | Medium | **Architecture F3:** a Bible verse note is lost on a network error or an accidental swipe | `src/components/bible/chapter-reader.tsx` | Type a note, go offline, tap Save | `useDraft`, catch errors, confirm before closing | Claude | 2–3 | No | No | No |
| O-12 | Medium (performance) | **Architecture F4:** finishing a workout runs about six full-history reads one after another; long-history members may see a false "couldn't save" after 45 s | `src/server/actions/workouts.ts` | Load test with a long history | `Promise.all` and narrower queries | Claude | 3–6 | No | Recommended | No |
| O-13 | Low | **Architecture F5:** a retried progress-photo save can delete an already-saved photo's file in rare cases | `progress-photos.tsx` | Lost reply, then an edited retry | Never delete after an unconfirmed attempt | Claude | 1–2 | No | No | No |
| O-14 | Low | **Architecture F7:** several screens send a network blip to the error page instead of showing a message | various (see report) | Go offline and submit | A shared `safeAction` wrapper | Claude | 3–5 | No | No | No |
| O-15 | Low | **Architecture F8/F9:** the coach's calorie tool ignores reaching goal weight; links to older conversations open a blank chat | `src/lib/coach/tools.ts`, `coach/page.tsx` | As described | Reuse `rateTowardGoal`; fetch the conversation by id | Claude | 2–3 | No | No | No |
| O-16 | Medium (deploy) | **Database F4:** migrations 086 and 088 add triggers on `storage.objects`; hosted Supabase may refuse them | migrations 086, 088 | `supabase db push` to a staging project | If refused, keep the policy layer, or move to an RPC before upload | Engineer with Supabase access | 1–4 | Yes, if it fails | — | — |
| O-17 | Low (performance) | **Database F5/F6:** one global lock for AI budget reservations; per-row policy functions | migrations 081, 034–036 | Load test | Row-level atomic update; wrap helpers in `(select …)` | DB engineer | 4–8 | No | No | No |
| O-18 | Low | **Security N-6:** rate-limit keys use an unsalted hash of the email | `src/server/rate-limit.ts` | Read the database | HMAC with a server secret | Claude | 1 | No | No | No |
| O-19 | Low | **Test quality:** billing suites skip silently when the local stack isn't up | `tests/integration/helpers.ts` | Run without Docker | Fail in CI when the stack is missing | Claude | 1–2 | No | No | No |
| O-20 | Low | `e2e/sleep.spec.ts` can fail when it runs across midnight UTC | `e2e/sleep.spec.ts` | Run at 23:59 UTC | Pin the clock in the test | Claude | 1 | No | No | No |
