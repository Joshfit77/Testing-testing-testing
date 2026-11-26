# Master engineering report: Narrow Gate Fitness production consolidation

**Date:** 2026-11-26 (rounds 2 and 3) · **Branch:** `release/narrow-gate-production-consolidation` (from the release candidate
`c275a808`) · **Target:** a reviewed pull request into `main`, **not merged**.

## Summary

- **One branch now holds all the app work.** All 45 branches were audited. 34 were already in the release candidate,
  the only unmerged app work (Friends & Challenges) was merged with its feature switched off, and nothing was lost
  (BRANCH_CONSOLIDATION_REPORT.md). No branch was deleted and nothing was force-pushed.
- **22 verified defects were fixed**, each with a regression test where testable (BUG_FIX_REGISTER.md B-01..B-22). Two
  were High: Manage billing disappeared after the past-due grace period, and the privacy page bundled in the app
  understated the health data read. New migrations (088–095) enforce consents, quotas and session limits in the
  database itself.
- **No Critical or High security findings remain** after an independent review.
- **All 20 open items (O-01..O-20) were then implemented by Claude** in a second round (2026-11-26), each with a
  regression test that fails on the old code where one is possible. Highlights:
  - GPS fixes recorded with the screen locked are journalled on the device;
  - billing repairs lost refunds and ended admin grants by itself;
  - one store purchase can grant only one account;
  - 61 server-action calls no longer send a network blip to the error page;
  - migrations 094–095 make row security cheaper and index the new billing lookups.

- **A third round (2026-11-26) closed the gaps that round left (T-01..T-26):**
  - **GPS:** a native recorder in Swift and Java keeps writing fixes while iOS suspends the web view or ends the
    app, and recovery merges them without double counting.
  - **Privacy:** recorded routes are removed on sign-out and account deletion.
  - **Billing:**
    - Stripe replay survives week-long outages, busy windows and events that keep failing;
    - lost subscriptions are found;
    - concurrent restores neither deadlock nor double-grant.
  - **Storage:**
    - photo limits hold under simultaneous uploads even where a hosted project refuses storage triggers;
    - files can't be overwritten past the byte limit.

  Two independent reviews of this round's own changes found 9 more defects (one a regression the round had
  introduced). All 9 are fixed, each with a test that fails without the fix.
- **What remains needs a phone, an account or a hosted service** (R-01..R-07). It is planned as an AI-assisted
  engagement of **25.5–41.5 consultant hours** ($9,818–$15,978; docs/engagement/ENGAGEMENT_AGENDA.md). That is
  slightly more than before: there is now more native code to check on a device and review.
- **The database upgrades from `main` with all synthetic data preserved** (round 1), and a fresh install of all 88
  migration files succeeds with every post-deploy check ok (round 3).
- **Pricing is unchanged at the approved $17.99 / $119.99.** `main` still has older prices ($30 Pro / $9.99 Plus), so
  merging the pull request changes `main`'s pricing to the approved prices (PAYMENT_VERIFICATION.md). Real billing
  stays off.
- **Nothing has been tested on a physical phone.** That is now the largest gap: iOS and Android scores are capped
  accordingly, and full checklists are ready (IPHONE_DEVICE_TESTING.md, ANDROID_DEVICE_TESTING.md).
- **No new dependencies, paid services or recurring costs** were added.

## Evidence

| Check | Result |
|---|---|
| Unit tests (local, round 3 head) | 4,982 passed, 1 skipped, 0 failed |
| Integration tests (real database, local, after a fresh install of 88 migrations) | 670 passed, 1 skipped (opt-in live food test), 0 failed |
| Database checks (`npm run db:verify`) | 10 of 10 ok |
| Browser suite at phone size (production build, mocks) | 168 passed, 0 failed, 101 skipped (opt-in suites) |
| Tap every safe control on every main screen | 49 screens, 281 controls, 0 problems |
| Native run-journal stores | Java JUnit 5/5 locally; Swift XCTest and Android unit tests in the GitHub workflows (see PR checks) |
| GitHub CI, iOS build/archive/Simulator, Android APK | See the PR checks on the pushed head (earlier heads passed) |
| Local load test | 0 errors up to 100 members and 25 concurrent (round 1) |
| Physical devices | **Not tested** |

Details: TEST_RESULTS.md, PERFORMANCE_REPORT.md.

## Readiness scores

**Methodology.**

- Each area starts from what is *proven by tests or inspection in this repository*.
- Points are deducted for open register items, weighted by severity: High −8, Medium −4, Low −1, capped per area.
- Each area is capped by its weakest unverified dependency:
  - anything that needs a physical device and hasn't been tested on one is capped at **60**;
  - an area whose core function depends on an external service it has never run against is capped at **75**:
    database (hosted Supabase), subscriptions (store sandboxes) and performance (production load).
- Overall is the weighted mean:
  - security, database integrity, reliability and subscriptions: ×1.5 each;
  - all other areas: ×1.

Scores measure engineering readiness, not market readiness.

| Area | Score | Why |
|---|---|---|
| Architecture | **85** | Clear layering, RLS on every table with catalog tests, offline-first workouts, one safe pattern for client actions, a native GPS persistence layer behind a small bridge. Minus: web-shell native app (App Review 4.2 risk) |
| Security | **84** | No open Critical or High findings after five more independent reviews; quotas enforced without relying on triggers; no photo overwrite; recorded routes removed on sign-out; load-test keys out of argv. Minus: no external penetration test; hosted-only settings unverified |
| Database integrity | **75** | Fresh install of 88 migrations with 10/10 checks; deadlock fixed and tested; 670 integration tests. **Capped at 75** until `supabase db push` to a hosted staging project (R-03); the storage-trigger risk no longer blocks it |
| UX | **76** | Browser suite and tap sweep; photo retries after a lost reply now succeed; no misleading limit message. Minus: no device check of keyboard, safe areas, haptics |
| Reliability | **79** | Native fix persistence, replay that can't be stopped by one bad event, idempotent retries, saved workouts never reported unsaved, single-phase summary. Minus: native behaviour unconfirmed on hardware |
| Performance | **71** | Local load test; chunked GPS journal; route preview memoized; summary waits at most 8 s. Minus: write paths and real network untested (cap 75) |
| iOS | **58** | Compiles, archive checked, Simulator and WebKit tests in CI; native recorder with XCTest on its store. **Capped at 60: never run on an iPhone** |
| Android | **47** | APK compiles; JVM tests of the journal store; permission-first and renderer recovery in code. Capped at 60; never run on a device |
| Subscriptions | **70** | Entitlements, webhooks, outage-proof replay, lost-subscription sweep, concurrent restores, rotation that can't be pinned, all tested with stand-ins. Capped at 75 until App Store sandbox and Stripe test mode (R-02) |
| **Overall** | **73** | Weighted mean: (85 + 76 + 71 + 58 + 47 + 1.5 × (84 + 75 + 79 + 70)) ÷ 11 = 72.6. Was 71 after round 2 |

## Status by category

| Category | What |
|---|---|
| **Implemented and verified (automated)** | O-01, O-03, O-05–O-20 code; T-01..T-26 code: billing replay, lost-subscription sweep, ownership/transfer rules, concurrent restores, store rotation, reservation-based photo limits, no overwrite, route clean-up on sign-out/deletion, chunked GPS journal, workout summary, photo save retries; migrations 088–098 (fresh install + checks); native store logic (JUnit locally; XCTest in CI) |
| **Awaiting a physical device** | Locked-screen and app-ended GPS with the native recorder (iPhone 14–15c, Android 6–6b), alarm and snooze slot (25, 25a), sign-out route clean-up (26a), HealthKit/Health Connect, notification sound under Silent/Focus, keyboard and safe areas, haptics, Android edge-to-edge and Back. Then the O-02 wording |
| **Needs founder credentials or accounts** | Apple Developer Team ID, signing and App Store Connect (R-04); sandbox Apple ID and RevenueCat transfer setting (R-02); Stripe test keys on staging; staging Supabase and hosting with `CRON_SECRET` (R-03); `APPLE_TEAM_ID` / `ANDROID_APP_CERT_SHA256` for app links; final privacy policy and terms |
| **Needs genuine external expertise** | An accountable human review of the security- and money-critical diffs, including the native recorder (R-05); App Review judgement on guideline 4.2; legal review of health, faith and AI data terms |
| **Optional, post-launch** | External penetration test; a fork of the community GPS plugin to stop its "Always" prompt on iOS; the 39-size device matrix run; Android launch; an orphaned-photo sweep for abandoned uploads with an uncertain save |

## What blocks what

| Milestone | Blockers |
|---|---|
| **TestFlight (internal testing)** | Owner: Apple account, signing, a deployed staging site for `CAP_SERVER_URL` (R-04). Engineering: none (photo limits no longer depend on the hosted storage triggers) |
| **Public launch** | iPhone device tests passed (R-01), then the O-02 wording; staging verified (R-03); independent PR review (R-05); final privacy policy and terms; store forms |
| **Paid subscriptions** | App Store sandbox and Stripe test mode verified (R-02); RevenueCat transfer setting; Stripe live mode (owner approval) |

## Deliverables in this folder

| File | Contents |
|---|---|
| BRANCH_CONSOLIDATION_REPORT.md | Branch and PR inventory, pricing by branch, migration clashes, lost-feature check |
| BUG_FIX_REGISTER.md | Fixed B-01..B-22, O-01..O-20 and T-01..T-26; what remains (R-01..R-07) with hours and blockers |
| SECURITY_AUDIT.md | OWASP-mapped review (public-safe; confidential detail kept private) |
| TEST_RESULTS.md | Every suite run, with counts and failures |
| DATABASE_MIGRATION_REPORT.md | Fresh install, upgrade from `main`, migrations 079/080 and 088–093 |
| PERFORMANCE_REPORT.md | Local load test and capacity estimates |
| PAYMENT_VERIFICATION.md | Prices, billing paths, simulated vs sandbox tests |
| AI_COST_ANALYSIS.md | Costs at 100–10,000 subscribers |
| IPHONE_DEVICE_TESTING.md / ANDROID_DEVICE_TESTING.md | Step-by-step device checklists (not yet performed) |
| APP_STORE_READINESS.md | Apple and Google requirements and status |
| FOUNDER_ACTION_ITEMS.md | Decisions, accounts, legal, device testing |
| EXTERNAL_DEVELOPER_SCOPE.md | Architecture diagram, setup, test commands, scoped hours |
| REMAINING_COST_ESTIMATE.md | One-time and recurring costs |
| SESSION_PROGRESS.md | Progress log for continuing in a new session |
| ../engagement/ENGAGEMENT_AGENDA.md | The AI-assisted consultant engagement: order, parallel tracks, hours at $385/h |
| ../engagement/ISSUE_PROMPTS.md | Ready-to-paste Claude Code prompts for every remaining item |
| ../engagement/BIBLICAL_AI_BASELINE.md | The verified baseline and rules for the Biblical AI work |
| ../../CLAUDE.md, ../../.claude/agents/ | Repository instructions and six specialist agents |
