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

## Third round (2026-11-26): native persistence, billing at volume, trigger-free quotas, review fixes (T-01..T-31)

Each item was verified in the code first. "Fails on old code" means the new test was run against the previous version
of the file and failed.

| # | Severity | Defect or gap | Fix | Commit | Proof |
|---|---|---|---|---|---|
| T-01 | High | Locked-screen GPS depended on the web view: fixes reaching JavaScript were journalled (O-01), but while iOS suspended the web view nothing reached it, and an ended app lost them | Native run journal: Swift (`RunJournalRecorder`, its own CLLocationManager with background updates, every fix fsynced to protected app storage) and Java (LocationManager in the foreground-service process, fsynced to no-backup storage). Recovery merges native fixes through the live rules (nothing counted twice) | `77ce4060`, `ef3c9001` | XCTest (5) in `ios/RunJournalCore` on GitHub macOS; JUnit (5) locally and in the APK workflow; `native-run-journal.test.ts`. **Device:** tests 15, 15a, Android 6a |
| T-02 | High (privacy) | Recorded routes stayed on a shared phone after sign-out and account deletion; a discarded run's native journal stayed | `clearAllDrafts` removes the web journal and the native journal (that member's on sign-out, all on deletion); saving, discarding or starting a recording clears it | `77ce4060` | `native-run-journal.test.ts`. Device test 26a |
| T-03 | Medium | A Capacitor bridge reset (web content crash, full-page navigation) stopped native recording mid-run; notification taps and "I'm up" did a full reload | Process-level recorder singleton; in-app navigation for notification taps, the alarm and app links; app start stops a journal with nothing to continue | `ef3c9001` | `native-run-journal.test.ts` (navigation, reconcile). Device tests 15a, 15b |
| T-04 | Medium | Android 14+: the GPS plugin started its foreground service before the location prompt; a WebView renderer crash ended the app and its run service; the plugin's service was exported | Permission first (`RunJournal.ensurePermission`), refusal starts nothing; renderer crash recreates the page; service overridden to `exported=false` | `ef3c9001` | `native-run-journal.test.ts` (Android permission). Android tests 6, 6b |
| T-05 | Medium | The alarm follow-up used its own 7 notification ids: with every reminder and a 7-day alarm on, reminders 55 + alarm ids 15 + rest timer = 71, over iOS's 64 pending notifications, so some silently never fired; a later sync re-added a ring after "I'm up" | Follow-up shares the snooze's slot (64 exactly, tested); "I'm up" is remembered for the day; Snooze replaces the follow-up in one step; reminder rebuilds serialised | `ef3c9001` | `native-alarm-followup.test.ts`, `notification-limit.test.ts`, `sleep-alarm.test.ts`. Device test 25a |
| T-06 | Medium | A replayed `charge.dispute.created` revoked a dispute already won | Re-read the dispute; skip won / warning_closed | `430e3758` | `entitlements.test.ts`, fails on old code |
| T-07 | Medium | An outage longer than 3 days lost refunds and cancellations for good; a large backlog was replayed newest first and could time out | Replay from a stored cursor (`billing_reconcile_state`, migration 096), 3–30 days back, in 6-hour windows oldest first; the cursor only passes fully handled windows; subscriptions Stripe created that never reached the database are found | `430e3758` | `entitlements.test.ts` (8-day-old refund after a 10-day gap; never-stored subscription), fail on old code |
| T-08 | Medium | The store rotation could be filled by lapsed members, starving current subscribers; one slow section stopped the whole check | Rotation chosen in SQL (`store_reconcile_candidates`), least recently read current subscribers first; per-section time budget and error isolation; route `maxDuration` 300 s | `430e3758` | `store-billing.test.ts` (rotation starvation guard) |
| T-09 | Low–Medium | Concurrent restores of one store purchase on two accounts could leave both granted for a moment; sandbox purchases could decide which real account held a transaction | `apply_store_snapshot` bumps the other holders' billing versions; released holders recomputed; sandbox eligibility applied first | `430e3758` | `store-billing.test.ts` (6 concurrent restores), existing sandbox tests |
| T-10 | Low | Admin grants that ended more than 7 days before a missed run were never recomputed; members paying twice (Stripe + store) were invisible | Ended grants recomputed however old; duplicates counted and logged | `430e3758` | `entitlements.test.ts` (grant ended 20 days ago), fails on old code |
| T-11 | Medium (cost) | On a hosted project without storage triggers, simultaneous uploads passed the photo limits (measured: 44 of 60 against a daily limit of 30; 10 of 10 past the byte limit) | Upload reservations under the member's lock (migration 097); both photo insert policies require one | `5200bc09` | `storage-upload-reservations.test.ts` (triggers dropped for the file), 9 of 12 fail on the old policies |
| T-12 | Medium (cost) | Progress photos could be replaced: upload small files, then overwrite them with large ones past the 1 GiB limit | UPDATE policy removed (the app never replaces a file) | `5200bc09` | Same file (overwrite and `update()` refused, size unchanged) |
| T-13 | Low | Catalog test didn't know `billing_reconcile_state` (096) | Registered with its reason | `5200bc09` | `account-deletion-closure.test.ts` |
| T-14 | Low (data loss) | After a timeout or dropped connection the server could delete an uploaded photo whose row was in fact written; the screen also deleted it | File removed only after a definite refusal; otherwise "couldn't confirm", file kept for a retry | `d0a5f7aa` | `progress-photo-save.test.ts`, 3 fail on old code |
| T-15 | Low | Finishing a workout waited for two rounds of summary extras (up to 16 s); a failing verse lookup or cache refresh could turn a saved workout into an error | One round (8 s at most); verse and refresh guarded | `d0a5f7aa` | `workout-finish-extras.test.ts`, 2 fail on old code |
| T-16 | Low (security hygiene) | The load-test script took the service key on the command line, used a fixed password, and left accounts behind on failure | Keys from the environment, random password per run, cleanup in `finally` and on Ctrl-C | `d0a5f7aa` | Smoke run: 3 members created and removed |
| T-17 | Low (battery) | The web GPS journal rewrote every fix since the last save every 2 s (an hour locked: the whole hour each time); the route preview was recomputed every second | Chunked journal (only the open chunk is rewritten; the old format is still read); preview memoized on the track's lines | `d0a5f7aa` | `run-fix-journal.test.ts` (6 fail on old code), `gps-route-memo.test.ts` |

**Found by the two independent reviews of this round's own changes** (correctness; security and database), each
reproduced or traced before fixing:

| # | Severity | Defect | Fix | Commit | Proof |
|---|---|---|---|---|---|
| T-18 | Medium-high (regression in T-07) | One Stripe event that failed on every attempt stopped the replay of everything after it, for up to 30 days | Every window is handled; the starting point still only passes finished windows; an ownership conflict (needs a person) doesn't hold it back | `89260c5b` | `entitlements.test.ts`, 2 tests fail on the previous loop |
| T-19 | Medium | A window with over 5,000 events re-listed the newest 5,000 every run and never reached the oldest | Full windows split in half, older half first | `89260c5b` | `entitlements.test.ts` (lowered cap), fails on the previous loop |
| T-20 | Low (reproduced) | Two accounts restoring one purchase at once could deadlock (one restore failed) | Migration 098 locks the billing versions involved in member-id order | `89260c5b` | 6-concurrent-restores test: 2 of 4 failed on 096's function, 8 of 8 passed |
| T-21 | Low | Members whose store sync kept failing stayed first in the rotation | `store_sync_state.attempted_at` (098); rotation orders by last success or attempt | `89260c5b` | `store-billing.test.ts` |
| T-22 | Low | T-14 kept files after errors that carry a database code, which means the row was not written | Only a reply with no code is uncertain | `89260c5b` | `progress-photo-save.test.ts` |
| T-23 | Low | Load test: a member failing after creation, or Ctrl-C during setup, could be left behind | Recorded on creation; Ctrl-C lets `finally` clean up | `89260c5b` | Normal run and Ctrl-C mid-setup: 10 created, 10 removed |
| T-24 | Medium | Signed upload URLs (checked once, valid 2 hours) could be saved up across reservation expiries, past the limits without triggers | A reservation counts as pending until its file exists or 2 hours after expiry; files and pending counted in one snapshot | `c71e652f` | `storage-upload-reservations.test.ts`, 2 tests fail on the previous text; a burst test caught the two-snapshot race (31 of 60) before commit |
| T-25 | Medium | A retry after a lost upload reply got "already exists" forever | The screens treat that answer for their own random name as uploaded | `c71e652f` | Integration test with the real storage answer; unit tests |
| T-26 | Low | A refusal after a granted reservation showed the photo-limit message (inviting deletions); the deploy-order note was wrong | Retry message instead; note corrected | `c71e652f` | `storage-reservation.test.ts` |

**Final review concerns (independent GitHub review after round 3), each investigated in the code first:**

| # | Severity | Concern | Finding and fix | Commit | Proof |
|---|---|---|---|---|---|
| T-27 | Medium | Native GPS recovery racing "Continue recording" | Real: the native read merged into the offer, which Continue had already cleared, so the native fixes were dropped and then deleted on save. Continue now waits for the read (5 s at most), merges first, ignores a second tap | `8b32c103` | `gps-recorder-native-race.test.tsx`, fails on the previous code |
| T-28 | Medium (privacy) | Native journal files in device backups | Real on iOS: Application Support is backed up by default; the journal folder is now excluded from iCloud and computer backups. Android was already excluded (no-backup folder, backups off), now guarded by a test | `8b32c103` | XCTest `testJournalFolderIsExcludedFromBackups`; `native-run-journal.test.ts` |
| T-29 | Medium (privacy) | GPS deletion completion on sign-out, account deletion and discard | Real: deletion was requested and assumed (Swift ignored failures; Java relied on `deleteOnExit`; the web side didn't wait). Both stores now confirm the file is gone; each request is recorded before it is sent and removed only on confirmation; unconfirmed ones are finished at the next app start | `8b32c103` | XCTest and JUnit (confirmed clear); unit tests for confirmed, refused, unanswered and cut-short deletions |
| T-30 | Low | Stripe reconciliation pagination, limits, outages, scale | Verified with a paging stand-in: 250 events over 20 days across pages and windows, each applied once; a time-limited run keeps its place; an outage longer than 30 days. Found and fixed: boundary seconds were listed in two windows (no double processing, but double listing) | `8b32c103` | `entitlements.test.ts` (3 new tests) |
| T-31 | Low (cost) | Storage byte limit at boundaries and under concurrency | The limit allowed up to one file (8 MB) over. Measured that the row the storage service writes carries the real size: the triggers now refuse a file that would pass the limit by even one byte (migration 099). Sized reservations make the app exact without triggers; a lying client is bounded to one file over, once (documented) | `8b32c103` | Boundary tests (exactly at, one byte over, simultaneous, declared vs real); the declared-vs-real test fails on the previous trigger |

**Platform limits, documented rather than fixed:**

- After a **force-quit** iOS stops all location updates for the app: nothing after that moment can be recorded by
  any app code (the route up to that moment is kept). Android behaves the same when the app is swiped away and the
  service is stopped by the system.
- The community GPS plugin asks for "Always" location on iOS and sets its own activity type; changing that needs a fork
  of the plugin (optional, post-launch). Our own recorder uses "When in use" with background updates and `.fitness`.

## What remains (each needs a phone, an account or a hosted service)

| # | Severity | Description | Who | Consultant hours (founder time) | TF | Launch | Paid |
|---|---|---|---|---|---|---|---|
| R-01 | High | Physical iPhone run of IPHONE_DEVICE_TESTING.md (42 tests), especially GPS (14–15c), purchases (29–31), HealthKit (17–18), alarm (25, 25a); then O-02 wording | Founders (F-4); Claude triages and fixes findings | 0 consultant (7–10 founder) | No | Yes | Yes |
| R-02 | High | App Store sandbox purchase, restore, transfer; Stripe test-mode checkout, portal, refund on staging | Founders (F-5); Claude gives expected states and fixes differences | 0 consultant (2–3 founder) | No | No | Yes |
| R-03 | Medium | Staging: `supabase db push` (085 → 098), `npm run db:verify`, cron jobs (billing reconcile now drains backlogs over several runs), staging load test including writes. The storage-trigger question no longer blocks: limits hold without triggers (T-11) | Founders run Claude's commands (F-2) | 0 consultant (1.5–2.5 founder) | No | Yes | No |
| R-04 | Medium | Release engineering: signing, TestFlight upload through the iOS workflow, App Store Connect record, Associated Domains, privacy label | Founders (F-1, F-3, F-6); consultant only if escalated (C-4) | 0 consultant (2–4 founder) | Yes | Yes | No |
| R-05 | Medium | Independent review of the consolidation PR (security, payments and the native recorder) | Consultant (C-2) | 5–7 | No | Yes | Yes |
| R-06 | Low | Android device pass, Play Console, Health Connect declaration | Founders (F-7) | 0 consultant (3–5 founder) | n/a | Android only | Android only |
| R-07 | — | Defects found by R-01..R-06: Claude implements with tests, consultant reviews (C-3); escalation reserve (C-4) only if needed | Claude + consultant | 2–4 (+0–4 reserve) | — | — | — |
