# Master launch readiness: Narrow Gate Fitness

Date: 2026-11-17. Branch `claude/legal-remediation`. This document closes the launch-readiness and security pass. It
builds on `docs/legal-remediation/*` and `docs/legal-audit-2026-11-16/*` and does not repeat them. It is not legal,
tax or financial advice. Nothing here has been merged, deployed or published, and no subscription has been switched on.

The closure reports behind it:

| File | Subject | Commit |
|---|---|---|
| `01_AI_PRIVACY_CLOSURE.md` | Every path that sends data to the AI provider, with the actual outgoing payloads | 6483d85 |
| `02_SUBSCRIPTION_SECURITY_CLOSURE.md` | Free/Pro authorisation, webhooks, idempotency, expiry, refunds, deletion | 462de09 |
| `03_ACCOUNT_DELETION_CLOSURE.md` | Every data category, processors, backups, logs; Privacy Policy draft aligned | ac9c0af |
| `04_RELIABILITY_CLOSURE.md` | Workouts, offline sync, background, GPS, camera, crash recovery; 17 device tests | 0b58fc7 |
| `05_SKIPPED_TEST_REVIEW.md` | Every skipped test: why, what was run, what remains and how to test it | cda6262 (test fix); this commit |

## 1. Where each branch stands

| Branch | Head | Contains | Status |
|---|---|---|---|
| `release/testflight-rc-2026-11-15` | 56500ff | The release candidate as approved for review | Unchanged |
| `claude/rc-offline-fix` | 8ea238f | The release candidate plus the service-worker offline fix only | Awaiting your approval (D1 in `FOUNDER_ACTION_ITEMS.md`) |
| `claude/legal-remediation` | this branch | The offline fix, the legal remediation, the health-data permission for the AI Coach, and all four closure passes (8 defects fixed in this pass) | Awaiting your approval |
| `claude/friends-challenges` | fcb18ee | Friends & Challenges, switched off | Kept separate. Not merged, not deployed |

**Important:** the release candidate does **not** contain the fixes from this pass or from the legal remediation. In
particular, the weekly-report sleep leak (AI privacy D1), the rate-limit counters left after deletion, and reliability
defects D1–D5 (including a workout that can never be saved after the clock is put back, and a damaged device copy that
makes the workout screen unusable) are fixed only on `claude/legal-remediation`. Before private TestFlight, the
release candidate should be rebuilt from `claude/legal-remediation` or have it merged in. That needs your approval.

## 2. Completed in this pass, with evidence

| Area | Result | Defects fixed | Evidence |
|---|---|---|---|
| AI privacy | 8 provider call sites and 9 entry points traced; there is one AI client and no other AI host in the code. Consent, plan gate, minimisation, isolation between members and withdrawal checked for each | **D1**: the weekly report sent sleep figures without wellness consent, and imported nights without the health permission | `tests/integration/ai-outgoing-payloads.test.ts` (16 tests; records every request body sent to a local stand-in for the provider and asserts on it; test 8 failed before the fix); `tests/unit/health-ai-sharing.test.ts` (5) |
| Subscriptions | Gate table for every Pro feature at database, API and screen level; Stripe and RevenueCat webhooks: signatures, replays, out-of-order events, expiry, refunds, cancellation, restore, deletion | None found. Five observations (N1–N5) recorded | `tests/integration/subscription-closure.test.ts` (17), plus the existing billing suites. **Against local stand-ins only. No native purchase has been tested.** |
| Account deletion | Every table, storage bucket, processor, backup and log mapped; the Privacy Policy draft and the public deletion page corrected to match | Rate-limit counters (keyed by account ID and a hash of the email) survived deletion; the storage-failure message was inaccurate | `tests/integration/account-deletion-closure.test.ts` (7; fails with the fix disabled); `tests/unit/account-deletion.test.ts` (8) |
| Reliability | Ten scenarios mapped (restore after kill, offline, Finish retries, background, GPS, camera, crash, service-worker update, clock changes, two tabs) | **D1** clock put back: workout could never be saved; **D2** offline sets lost after a clock change; **D3** one bad GPS timestamp stopped distance counting; **D4** a damaged device copy crashed the workout screen on every open; **D5** two tabs could overwrite a completed set | `tests/unit/reliability-closure.test.ts` (10), `workout-logger-closure.test.tsx` (5), `camera-permission-closure.test.tsx` (7), `e2e/reliability-closure.spec.ts` (7). Each new unit test failed before its fix. The two-tab test passed 10 of 10 repeated runs |
| Skipped tests | All 101 skipped browser tests, 1 skipped unit test and 1 skipped integration test explained; every one that can run here was run (99 of 103) | No app defect. One test defect: the stage-chart test's guard skipped it on every run (cda6262) | `05_SKIPPED_TEST_REVIEW.md`; section 9 below |

## 3. Unresolved blockers, by the stage they block

Stages: **TF** = private TestFlight (invited testers); **Free** = public launch, Free plan only; **Paid** = Pro
subscriptions switched on; **Inv** = investment (due diligence and closing).

### 3.1 Code and engineering

| # | Item | Blocks | Who | Notes |
|---|---|---|---|---|
| E1 | Bring `claude/legal-remediation` into the release candidate and rebuild | TF | You approve; then engineering | Section 1 |
| E2 | No result from a physical device for anything (17 device tests in `04_RELIABILITY_CLOSURE.md` §5, plus the iPhone plan in `docs/release/IPHONE_PLAN_2026-11-15.md`) | TF (core tests DV-01 to DV-08); Free (all) | You, on a device | Background audio/GPS, the camera, Apple Health import, the lock screen and app kills cannot be tested in a browser |
| E3 | **W-5**: after a Finish whose reply was lost, sets logged before the retry are not stored | Free | You decide; then engineering | Rare (needs a lost reply and more sets before the retry). Needs a product decision: apply the retry as an edit, or block logging until the retry resolves |
| E4 | No `src/app/global-error.tsx`: an error in the root layout shows Next's default error page | Free | Engineering (small) | Drafts are not affected; they stay on the device |
| E5 | Live AI behaviour (safety rules, prompt injection through shared journal text or food names) and cost per member, measured with a capped staging key | Free (behaviour); Paid (cost) | You provide the key; then engineering | Every AI test so far uses a scripted stand-in |
| E6 | Live Open Food Facts integration test | Free | You run it (one command, section 9) | The host is allowed in this environment, but running it was refused here by the session's safety policy |
| E7 | Readiness and check-in scores depend on deletion, not a query-level consent check, to stop reaching the AI after wellness consent is withdrawn | Free (counsel's view) | Counsel decides; engineering | `01_AI_PRIVACY_CLOSURE.md`, "For counsel" 3 |
| E8 | Hosted configuration not verified: production keys, cron secret, feature flags, backups, log retention | Free | You | Nothing hosted was touched in this pass |
| E9 | Native purchases, restore, refund, renewal and expiry in the Apple and Google sandboxes; RevenueCat dashboard setup | Paid | You (device and dashboards) | `02_SUBSCRIPTION_SECURITY_CLOSURE.md` §5, items 1–9 |
| E10 | Friends & Challenges stays off; not on the release candidate | Switching it on | You and counsel | `LEGAL_BLOCKERS_REMAINING.md`, last section |

### 3.2 Legal, privacy and policy

| # | Item | Blocks | Who |
|---|---|---|---|
| L1 | Testers accepting the draft Terms and Privacy Policy (all labelled DRAFT) | TF (advisable, not strictly required) | Counsel's view |
| L2 | Final Terms and Privacy Policy: 76 facts to supply, 34 decisions, 66 attorney notes (`docs/legal/REMAINING_INFORMATION_NEEDED.md`) | Free | You and a privacy/technology attorney |
| L3 | Retention decisions: Supabase Auth audit log (keeps the email after deletion), admin audit entries naming a member, backups, server logs, AI conversations | Free | You and counsel (`03_ACCOUNT_DELETION_CLOSURE.md` §4) |
| L4 | AI provider terms: retention, no training on member data, deletion; other processor agreements; email provider | Free | You and counsel |
| L5 | AI consent card does not list every use (Bible questions, weekly-report figures, label photos, sleep factors, run summary) | Free | Counsel's wording; then engineering |
| L6 | Approval of the 27 legally consequential wording changes and the health-data permission wording | Free | You and counsel |
| L7 | Professional review of the coach's safety rules, programs, supplement notes and demonstrations; theological review of the commentary | Free | Reviewers you engage |
| L8 | Subscription and auto-renewal disclosures against federal and state law | Paid | Counsel |
| L9 | Prayer-journal "Share with AI Coach" (D7): keep, change or remove. Today an entry reaches the coach only if it is marked shared **and** faith is on | Free | You |

### 3.3 Intellectual property and assets

| # | Item | Blocks | Who |
|---|---|---|---|
| P1 | Trademark search on official registers; decision on the name, tagline, "Nutrition Score", the Nutri-Score display and "Food IQ". **Not cleared; nothing filed** | Free (risk); Inv | Trademark attorney |
| P2 | Ownership records for the 27 badge images and the dumbbell-curl clip, or replace or exclude them (nothing deleted without your approval) | Free | You |
| P3 | Your record of authorship and AI-tool use; any co-founder or contractor assignments | Free (advisable); Inv | You and counsel |
| P4 | Open Food Facts database licence obligations for storing its records | Free | Counsel |
| P5 | Patent counsel's view (`PATENT_COUNSEL_PACKAGE.md`); no claims have been obtained | Inv | Patent counsel |
| P6 | Entity, operating agreement, cap table, IP assignment, account ownership (domains, developer accounts, GitHub), insurance | Inv | You and counsel. Not needed for an individual Apple Developer account or for TestFlight |

### 3.4 Accounts and store setup

| # | Item | Blocks | Who |
|---|---|---|---|
| A1 | Support and privacy email (monitored), shown in the app | TF | You |
| A2 | Apple Developer Program, App Store Connect record, hosted staging, signed build | TF | You |
| A3 | Store listing, privacy label, Data safety form, health declarations, age rating, review notes and demo account, support and deletion URLs | Free | You |
| A4 | Google Play developer account | Free (Android) | You |
| A5 | Subscription products at $17.99 monthly and $119.99 yearly; paid apps agreement; tax and banking | Paid | You |

## 4. What you must do

In order: (1) decide whether to bring `claude/legal-remediation` into the release candidate (E1); (2) set up the
support email (A1); (3) enrol in the Apple Developer Program and create the app record (A2); (4) provide a hosted
staging environment and a capped AI staging key (E5, E8); (5) run the core device tests DV-01 to DV-08 on an iPhone
(E2); (6) run the live Open Food Facts test (E6); (7) answer the asset-origin questions (P2) and the AI-tool record
(P3); (8) engage the attorneys and reviewers below. Full detail: `docs/legal-remediation/FOUNDER_ACTION_ITEMS.md`.

## 5. What needs an attorney or another reviewer

| Reviewer | Items | Package to send |
|---|---|---|
| Privacy / technology attorney | L1–L6, L8, L9, E7, P4 | `docs/legal/*_DRAFT.md`, `REMAINING_INFORMATION_NEEDED.md`, `PRIVACY_DATA_FLOW_AUDIT.md`, closure reports 01–03, `docs/legal-audit-2026-11-16/13_COUNSEL_QUESTIONS.md` |
| Trademark attorney | P1 | `TRADEMARK_ATTORNEY_PACKAGE.md` |
| Patent counsel | P5 | `PATENT_COUNSEL_PACKAGE.md` |
| Corporate counsel | P3, P6 | `INVESTOR_IP_OWNERSHIP_CHECKLIST.md` |
| Certified coach, registered dietitian, physiotherapist | L7 | Coach safety rules, programs, supplement notes, exercise demonstrations |
| Theological reviewer | L7 | Devotional and commentary text |

## 6. Estimated costs (only where a published source supports a figure)

| Item | Cost | Source |
|---|---|---|
| Apple Developer Program | $99 per year | https://studio.adalo.com/blog/apple-developer-program-guide |
| Google Play developer account | $25 one time | https://magora-systems.com/google-play-developer-account-cost/ |
| USPTO trademark application (base fee, from 2025-01-18) | $350 per class; +$100 per class if information is insufficient; +$200 per class for free-form identification text | https://www.uspto.gov/trademarks/trademark-fee-information ; https://www.uspto.gov/trademarks/basics/how-much-does-it-cost |
| Supabase Pro (hosted database, 7 days of daily backups) | $25 per month | https://supabase.com/pricing ; https://supabase.com/docs/guides/platform/backups |
| Supabase point-in-time recovery (optional) | $100 per month for 7 days of recovery | https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery |
| Attorneys (privacy, trademark, patent, corporate) and professional reviewers | **No supported figure. Get written quotes** | — |
| AI provider usage per member | **Not measured.** Measure under a capped staging key (E5) | — |
| Hosting for the web app | Not confirmed which host is used; check the chosen plan | — |

No filing or purchase has been made.

## 7. Plan

### Next 7 days (to private TestFlight)

1. Day 1: approve or decline bringing `claude/legal-remediation` into the release candidate; set up the support email.
2. Day 1–2: enrol in the Apple Developer Program (an individual account is acceptable); create the App Store Connect
   record; keep subscriptions off in the TestFlight build.
3. Day 2–3: hosted staging environment with synthetic data; capped AI staging key; run the live Open Food Facts test.
4. Day 3–4: build, sign and upload; run device tests DV-01 to DV-08 and the iPhone plan on one iPhone; log results
   honestly (not tested ≠ passed).
5. Day 4–5: fix what the device tests find; add the TestFlight "What to test" notes, including that the legal pages
   are drafts.
6. Day 5–7: invite a small group of testers; send the privacy attorney and the trademark attorney their packages and
   request quotes.

### Next 30 days (to a public Free launch decision)

1. Week 2: answer the 76 facts and 34 decisions; attorney drafts the final Terms and Privacy Policy; decide retention
   (L3) and the prayer-journal share (L9); decide W-5 and add `global-error.tsx` (E3, E4).
2. Week 2–3: trademark search result and naming decision; badge and clip ownership resolved or replaced (with your
   approval); professional and theological reviews started.
3. Week 3: live AI evaluation and cost measurement; store listing, privacy label, Data safety, health declarations,
   age rating, review notes.
4. Week 4: the remaining device tests (DV-09 to DV-17) on iPhone and Android; full regression on the final build;
   go/no-go for public Free.
5. Paid subscriptions follow only after the sandbox programme in `02_SUBSCRIPTION_SECURITY_CLOSURE.md` §5 passes and
   counsel has reviewed the disclosures.

## 8. Decision: GO / CONDITIONAL / NO-GO

| Stage | Decision | Evidence | Conditions or blockers |
|---|---|---|---|
| Internal testing (you, on a local or staging build) | **GO** | Section 9: type check, lint, unit, integration, the full browser suite and every opt-in group pass on this branch and on the release candidate (5,507 passed, 0 failed, 4 skipped here) | Use synthetic data |
| Private TestFlight | **CONDITIONAL** | Code: all automated suites pass; the four closure passes found and fixed 8 defects; Friends is off; subscriptions not enabled | E1 (your approval to bring this branch into the release candidate), A1, A2, and a pass of the core device tests (E2). Draft legal pages labelled as drafts (L1, counsel's view advised). No device test has been run, so this cannot be GO yet |
| Public launch, Free plan | **NO-GO** | Engineering is close; the blockers are legal, IP, store and device work | L2–L7, L9, P1–P4, A3, E2–E8 |
| Paid subscriptions | **NO-GO** | Server-side billing logic passes against stand-ins (02); no native purchase has been tested | Everything for Free, plus E9, A5, L8 |
| Investment | **NO-GO** for due diligence; early conversations are fine | IP and legal packages exist and are organised | P1, P3, P5, P6; the trademark is not cleared |
| Friends & Challenges | **NO-GO** (stays off) | Off by default; not on the release candidate | E10 |

## 9. Test results

Full detail, and the reason for every remaining skip: `05_SKIPPED_TEST_REVIEW.md` §2. Skipped tests are never counted
as passes. All runs: local stack, fresh production build, freshly reset database, synthetic data.

| Build | Type check / lint | Unit | Integration | Browser, all groups incl. opt-in | Remaining skips |
|---|---|---|---|---|---|
| `claude/legal-remediation` cda6262 | clean / clean | 4,741 passed, 0 failed | 513 passed, 0 failed | 253 passed, 0 failed | 4: Home photographs (3, assets not supplied), live Open Food Facts (1, you run it) |
| Release candidate + offline fix 8ea238f | clean / clean | 4,713 passed, 0 failed | 467 passed, 0 failed | 245 passed, 0 failed | 4: as above, plus the stage-chart test, skipped by a test defect fixed in this pass (passes on that build once fixed) |

Not covered by any test here: physical devices, native purchases in the sandbox, live AI behaviour and cost, the
hosted environment (section 3).
