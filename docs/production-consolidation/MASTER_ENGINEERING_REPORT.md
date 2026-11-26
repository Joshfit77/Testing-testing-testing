# Master engineering report: Narrow Gate Fitness production consolidation

**Date:** 2026-11-26 · **Branch:** `release/narrow-gate-production-consolidation` (from the release candidate
`c275a808`) · **Target:** a reviewed pull request into `main`, **not merged**.

## Summary

- **One branch now holds all the app work.** All 45 branches were audited. 34 were already in the release candidate,
  the only unmerged app work (Friends & Challenges) was merged with its feature switched off, and nothing was lost
  (BRANCH_CONSOLIDATION_REPORT.md). No branch was deleted and nothing was force-pushed.
- **22 verified defects were fixed**, each with a regression test where testable (BUG_FIX_REGISTER.md B-01..B-22). Two
  were High: Manage billing disappeared after the past-due grace period, and the privacy page bundled in the app
  understated the health data read. Six new migrations (088–093) enforce consents, quotas and session limits in the
  database itself.
- **No Critical or High security findings remain** after an independent review. 20 open items are documented with
  files, repro steps, fixes and hours (O-01..O-20).
- **The database upgrades from `main` with all synthetic data preserved**, and a fresh install of all 83 migration
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
| Architecture | **82** | Clear layering (server actions / services / domain), RLS on every table with a catalog test, offline-first workout storage. Minus: web-shell native app (App Review 4.2 risk), a few sequential heavy reads (O-12) |
| Security | **80** | No open Critical or High findings. Consents, quotas and session limits are enforced in the database, and admins need MFA. Minus: Low items O-18 and O-10; no external penetration test; hosted-only settings unverified |
| Database integrity | **75** | Upgrade from `main` preserved all data; fresh install passes; every new migration has rollback notes and tests; 640 integration tests pass. **Capped at 75**: the `storage.objects` triggers are unverified on hosted Supabase (O-16) |
| UX | **72** | Browser suite at phone size including a tap-every-control sweep; data-loss fixes B-13/B-15. Minus: O-11, O-14; no device tests (keyboard, safe areas, haptics) |
| Reliability | **70** | Idempotent retries, workout drafts survive reloads, failures are surfaced. Minus: O-01 (High: locked-screen run data in memory), O-08/O-09 billing repair gaps |
| Performance | **68** | Local load test: 0 errors to 25 concurrent; page p95 under 620 ms at 10 concurrent on one process. The bottleneck is the app process, which scales out, not the database. Minus: write paths and AI not load-tested; O-12, O-17; local only (cap 75) |
| iOS | **55** | Compiles, archive contents checked, Simulator launch, WebKit tests in CI; privacy manifest complete. **Capped at 60: never run on an iPhone.** Minus: O-01, O-02, O-04 |
| Android | **40** | APK compiles in CI. Never run on a device; edge-to-edge and back button open (O-06, O-07); secondary platform |
| Subscriptions | **60** | Server-side entitlements, webhook handling, reconcile, price guard and closure on deletion, all tested with stand-ins. Minus: never run against the App Store sandbox or Stripe test mode end to end; O-08..O-10 |
| **Overall** | **68** | Weighted mean: (82 + 72 + 68 + 55 + 40 + 1.5 × (80 + 75 + 70 + 60)) ÷ 11 = 67.7 |

## What blocks what

| Milestone | Blockers |
|---|---|
| **TestFlight (internal testing)** | Owner: Apple account, signing, a deployed staging/production site for `CAP_SERVER_URL`. Engineering: O-16 only if hosted Supabase refuses the triggers |
| **Public launch** | Device tests passed; O-01 (if GPS runs are advertised), O-02, O-03, O-04; final privacy policy and terms; store forms |
| **Paid subscriptions** | Sandbox purchase and restore on a device; O-08, O-09, O-10; Stripe live mode (owner approval) |

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
