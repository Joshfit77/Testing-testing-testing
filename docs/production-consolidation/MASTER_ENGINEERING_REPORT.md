# Master engineering report: Narrow Gate Fitness production consolidation

**Date:** 2026-11-26 · **Branch:** `release/narrow-gate-production-consolidation` (from the release candidate
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

  What remains needs a phone, an account or a hosted service (R-01..R-07). It is planned as an AI-assisted engagement
  of **24–41 consultant hours** (docs/engagement/ENGAGEMENT_AGENDA.md).
- **The database upgrades from `main` with all synthetic data preserved**, and a fresh install of all 85 migration
  files succeeds (DATABASE_MIGRATION_REPORT.md).
- **Pricing is unchanged at the approved $17.99 / $119.99.** `main` still has older prices ($30 Pro / $9.99 Plus), so
  merging the pull request changes `main`'s pricing to the approved prices (PAYMENT_VERIFICATION.md). Real billing
  stays off.
- **Nothing has been tested on a physical phone.** That is now the largest gap: iOS and Android scores are capped
  accordingly, and full checklists are ready (IPHONE_DEVICE_TESTING.md, ANDROID_DEVICE_TESTING.md).
- **No new dependencies, paid services or recurring costs** were added.

## Evidence

| Check | Result |
|---|---|
| GitHub CI on `8fa7c3b5` (typecheck, lint, unit, build, integration, secret scan, dependency audit) | Passed |
| Unit tests (local) | 4,919 passed, 1 skipped, 0 failed |
| Integration tests (real database, local) | 640 passed, 1 skipped (opt-in live food test), 0 failed |
| Browser suite at phone size (production build) | 167 passed, 0 failed, 101 skipped (opt-in suites) |
| Tap every safe control on every main screen (opt-in sweep) | 49 screens, 282 controls, 0 problems |
| Android APK compile (GitHub) | Passed |
| iOS build, archive, Simulator, WebKit tests (GitHub) | Passed on `8fa7c3b5` |
| Fresh install / upgrade from `main` | Passed / passed with all data preserved |
| Local load test | 0 errors up to 100 members and 25 concurrent; about 36 requests a second on one app process |
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
| Architecture | **84** | Clear layering (server actions / services / domain), RLS on every table with catalog tests, offline-first workout storage, one safe pattern for client actions (guard-tested), a device fix journal for GPS. Minus: web-shell native app (App Review 4.2 risk) |
| Security | **82** | No open Critical or High findings; consents, quotas and session limits enforced in the database; admin MFA; keyed rate-limit hashes; one purchase, one account. Minus: no external penetration test; hosted-only settings unverified |
| Database integrity | **75** | Upgrade from `main` preserved all data; fresh install of 85 migrations; post-deploy checks script; 646 integration tests. **Capped at 75** until `supabase db push` to a hosted staging project confirms the storage triggers (R-03) |
| UX | **76** | Browser suite and tap-every-control sweep; notes and photos no longer lost on failure; network blips show a message instead of the error page. Minus: no device check of keyboard, safe areas, haptics |
| Reliability | **77** | Idempotent retries, drafts survive reloads, saved workouts can't be reported as unsaved, locked-screen GPS journalled, reminders never left empty, billing self-repairs. Minus: the native behaviour is unconfirmed on hardware |
| Performance | **70** | Local load test: 0 errors to 25 concurrent; app process is the bottleneck and scales out; RLS helpers once per statement; AI budget lock measured at about 100x need. Minus: write paths and real network untested (cap 75) |
| iOS | **58** | Compiles, archive checked, Simulator launch and WebKit tests in CI; GPS, alarm and watcher fixes in code. **Capped at 60: never run on an iPhone** |
| Android | **45** | APK compiles; back button, reminders and edge-to-edge handled in code and guard-tested. Capped at 60; never run on a device |
| Subscriptions | **68** | Entitlements, webhooks, reconciliation that repairs lost events and ended grants, refund and transfer handling, price guard, closure on deletion, all tested with stand-ins. Capped at 75 until App Store sandbox and Stripe test mode are run (R-02) |
| **Overall** | **71** | Weighted mean: (84 + 76 + 70 + 58 + 45 + 1.5 × (82 + 75 + 77 + 68)) ÷ 11 = 71.45. Was 68 before the second round |

## What blocks what

| Milestone | Blockers |
|---|---|
| **TestFlight (internal testing)** | Owner: Apple account, signing, a deployed staging site for `CAP_SERVER_URL` (R-04). Engineering: none, unless hosted Supabase refuses the storage triggers (R-03 tells) |
| **Public launch** | iPhone device tests passed (R-01), then the O-02 wording; staging verified (R-03); independent PR review (R-05); final privacy policy and terms; store forms |
| **Paid subscriptions** | App Store sandbox and Stripe test mode verified (R-02); RevenueCat transfer setting; Stripe live mode (owner approval) |

## Deliverables in this folder

| File | Contents |
|---|---|
| BRANCH_CONSOLIDATION_REPORT.md | Branch and PR inventory, pricing by branch, migration clashes, lost-feature check |
| BUG_FIX_REGISTER.md | Fixed B-01..B-22; open O-01..O-20 with severity, files, repro, fix, expertise, hours, blockers |
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
