# Documentation index

Start here. This folder has grown to more than 200 files, and many are dated reports kept for the record. **When a
dated report disagrees with the code or with a document listed under "Current" below, the code and the current
document win.**

**Prices** are defined in exactly one place:

- `APPROVED_PRO_PRICE_CENTS` in `src/lib/domain/plans.ts`: **Pro $24.99 a month, $149.99 a year; Free $0**.

Older reports that mention $19.99 / $149.99 or $24.99 describe earlier proposals.

**Environment variables:** every variable the app reads is listed, with its default, in `../.env.example`. A unit test
(`tests/unit/env-example.test.ts`) keeps that list complete.

## Start with these (current source of truth, 2026-11-26)

- `production-consolidation/MASTER_ENGINEERING_REPORT.md`: state, evidence and readiness scores.
- `production-consolidation/BUG_FIX_REGISTER.md`: everything fixed (B-01..B-22, O-01..O-20) and what remains (R-01..R-07).
- `engagement/ENGAGEMENT_AGENDA.md` and `engagement/ISSUE_PROMPTS.md`: how the remaining work is run with Claude Code.
- `engagement/BIBLICAL_AI_BASELINE.md`: the baseline for the Biblical AI work.
- `../CLAUDE.md`: rules and commands for anyone (or any agent) changing the code.

**Don't repeat earlier audits.** The dated audit and readiness folders (`audit-2026-11-07/`, `audit-2026-11-14/`,
`audit/`, `launch-audit/`, `launch-readiness/`, `quality/`, `legal-audit-2026-11-16/` and the dated `*_REPORT.md` /
`*_AUDIT*.md` files here) are history. Their findings were re-verified and either fixed or carried into the register
above. New review work starts from the register and adds to it.

## Current

**Release and TestFlight:**

- `TESTFLIGHT_FIRST_BUILD_GUIDE.md`: the step-by-step guide for the first build;
- `IPHONE_TESTFLIGHT_CHECKLIST.md`: what to check on an iPhone;
- `operations/RELEASE_ROLLBACK_AND_INCIDENTS.md`: releases, rollback, incidents.

**Security:**

- `security/GITHUB_PROTECTION.md`: branch ruleset, Actions settings, the `testflight` environment;
- `security/MAKE_REPOSITORY_PRIVATE.md`;
- `security/ADMIN_MFA.md`;
- `security/PAYMENTS_BEFORE_LAUNCH.md`.

**Memberships and billing:**

- `MEMBERSHIPS.md`: Free and Pro, with the price history;
- `MOBILE_BILLING.md`: App Store / Google Play through RevenueCat;
- `pro/AI_COST.md` and `ai-eval/COST_MODEL.md`: AI cost model and budgets. Modelled, not yet measured with live
  calls;
- `LIVE_AI_TEST_PLAN.md`.

**Legal (drafts for counsel; not in force):**

- `LEGAL_REQUIREMENTS.md`;
- `legal/`: Terms, Privacy Policy and moderation drafts, review checklist, information still needed.

**Features:**

- workouts: `WORKOUT_LOGGING.md`;
- `NOTIFICATIONS.md`;
- GPS: `GPS_BACKGROUND_IPHONE.md`, `GPS_ACCURACY.md`;
- `BODY_SCAN.md`;
- food: `FOOD_PHOTO.md`, `FOOD_QUALITY.md`, `FOOD_IQ_METHOD.md`;
- sleep: `SLEEP_METHOD.md`, `SLEEP_DEVICE_CHECKLIST.md`;
- Scripture: `SCRIPTURE.md`;
- `BADGES.md`;
- exercise animations: `EXERCISE_DEMOS_2D.md`, `ANIMATION_KNOWN_LIMITATIONS.md`;
- `WEARABLES.md`;
- `ERROR_MONITORING.md`;
- demo mode: `DEMO.md`.

**Engineering notes:**

- `HYDRATION_418.md`: why `scripts/react-hydration-replay-fix.mjs` exists;
- `NEXT16_UPGRADE_EVALUATION.md`;
- `DATA.md`;
- `SPEC.md`: product specification.

## Superseded (kept for the record)

These carry a "Superseded" note at the top. Use `TESTFLIGHT_FIRST_BUILD_GUIDE.md` instead:

- `TESTFLIGHT.md`;
- `TESTFLIGHT_SETUP_GUIDE.md`;
- `TESTFLIGHT_STEPS.md`;
- `STAGING_ENVIRONMENT.md`.

## Historical reports (point-in-time; may be out of date)

These describe the app as it was on their date. Prices, test counts, open issues and recommendations in them may no
longer apply:

- dated reports: every file with a date in its name, such as `LAUNCH_AUDIT_2026-11-08.md`, `QA_REPORT_2026-11-05.md`,
  `REDESIGN_2026-11-07.md`, `VISUAL_COMPARISON_2026-11-07.md`;
- older audits and trackers:
  - `APP_AUDIT.md`, `FULL_APP_AUDIT.md`, `APP_OPTIMIZATION_REPORT.md`;
  - `PRE_TESTFLIGHT_READINESS_REPORT.md`;
  - `COMPLETION_TRACKER.md`, `NINE_FEATURES_PROGRESS.md`, `PROJECT_CHECKLIST.md`;
  - `RELEASE_CANDIDATE.md` (release candidate 1, 2026-11-04);
  - `SLEEP_AND_PRELAUNCH_REPORT.md`;
- folders of dated work:
  - `audit/`, `audit-2026-11-07/`, `audit-2026-11-14/`;
  - `launch-audit/`, `launch-preview/`;
  - `quality/`;
  - `legal-audit-2026-11-16/`;
  - `ux/audit/`;
  - `ai-eval/AI_COACH_VALIDATION_REPORT.md`;
  - `security/ASSESSMENT_2026-11-20.md` and `security/PRELAUNCH_SECURITY_REPORT.md`.
