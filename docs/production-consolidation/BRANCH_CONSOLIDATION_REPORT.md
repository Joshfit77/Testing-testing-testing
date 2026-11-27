# Branch consolidation report

Audit of every branch, open pull request and workflow on `Joshfit77/Testing-testing-testing`, 2026-11-25/26.
**No branch was deleted, force-pushed or merged into `main`.**

## Foundation chosen

- **`claude/rc-testflight-1` at `c275a808`** (the release candidate) contains every commit of 34 other branches,
  `claude/legal-remediation` included.
- `claude/legal-remediation`, the suggested starting point, is 62 commits *behind* the release candidate and has no
  commit of its own. The release candidate is the most complete and stable line:
  - unit tests: 4,885 passed;
  - integration tests: 597 passed;
  - browser tests: 163 passed;
  - GitHub CI and iOS checks: green on `c275a808`.
- The integration branch **`release/narrow-gate-production-consolidation`** starts there.

## Every branch

Columns: commits not in the release candidate / commits behind it.

| Branch | Not in RC | Behind | Conclusion |
|---|---|---|---|
| `claude/release-hardening`, `claude/rc-testflight-1` | 0 | 0 | Same as the release candidate |
| `claude/testflight-final-prep`, `testflight-audit-fixes`, `sharp-cray-8y0uuv`, `exercise-priorities`, `legal-remediation`, `release/testflight-rc-2026-11-15`, `pro-premium`, `rc-verification`, `finalization-qa`, `premium-2d-exercise-animations`, `first-time-ux`, `badge-progress`, `faith-discipleship`, `release/rc-2026-11-04`, `security/payment-hardening-prelaunch`, `exercise-demo-25d`, `3d-in-workout`, `anatomical-3d-exercises`, `workout-experience`, `interactive-demo`, `free-pro-membership`, `launch-audit`, `ios-ci-reliability`, `android-hardening`, `testflight-prep`, `nine-features`, `app-cleanup`, `stage2-store-billing`, `badges-polish`, `stage1-memberships`, `badges-27`, `security-nasb-deletion`, `main` | 0 | 6–724 | **Fully contained** in the release candidate. Nothing to bring in |
| `claude/rc-offline-fix` | 1 | 83 | Service-worker fix; **the same change is already in the release candidate** (`public/sw.js`, `ngf-v3`) |
| `claude/production-readiness` | 12 | 724 | **Superseded** (2026-10-27): consent screens, shared rate limits, RevenueCat, and a privacy manifest with 8 data types, all later reimplemented. Its Terms and Privacy text states $19.99 / $149.99. Not merged |
| `claude/privacy-policy` | 2 | 724 | The same 2 legal-text commits; superseded by the counsel drafts in `docs/legal/` |
| `claude/friends-challenges` | 16 | 83 | **Merged** (`8fa7c3b5`), behind its existing flag (off): Friends phase 1 plus the 2026-11-16 legal/IP research documents. Migrations renumbered 076–078 → 091–093 |
| `claude/cool-gauss-hhzt4p` | 55 | 752 | A separate website ("Beauty and Praise"). Not part of the app |
| `claude/new-session-rv5wiw` | 2 | 752 | A separate website ("Narrow Gate Designs"). Not part of the app |
| `claude/claude-ltp8ut` | 1 | 724 | A separate website ("The Recipe Therapist"). Not part of the app |
| `claude/3d-athlete-prototype` | 2 | 753 | A standalone 3D experiment ("not part of the app") |
| `claude/animated-opening-demo` | 2 | 611 | IP/patent research notes. Not app code |
| `bsb-bible-data` | 1 | 753 | The raw BSB text file; the app already bundles the Bible |

**Unconsolidated security fixes found:** none. Every security branch (`security/payment-hardening-prelaunch`,
`claude/security-nasb-deletion`, `claude/release-hardening`) is fully contained.

**Lost features:** none. Only five files exist in `main` but not in the release candidate, and each was deliberately
replaced:

- two splash images, replaced by a plain launch screen (`b77851f4`);
- the workout reminders and native reminders, replaced by one Notifications screen (`acdc55bb`).

## Pricing per branch

| Branch | Pro price in code |
|---|---|
| `main` | $30.00 a month (Plus $9.99) |
| `claude/production-readiness` | $19.99 a month (Plus $9.99) |
| `claude/rc-verification` | $19.99 a month / $149.99 a year |
| Release candidate, `legal-remediation`, `release/testflight-rc-2026-11-15`, `friends-challenges`, **this branch** | **$17.99 a month / $119.99 a year** (owner-approved) |

The pricing logic is unchanged here. Merging this branch into `main` changes `main`'s price from $30.00 to the approved
$17.99 / $119.99.

## Database migrations across branches

- `main`'s 8 migrations are identical in this branch.
- **Migration 040 was edited after many older branches were cut.** The only change makes one existing-data check
  `NOT VALID`, so a database built from an old branch is not harmed.
- **The Friends branch's 076–078 clashed** with this branch's 076–078; renumbered to 091–093.
- `production-readiness` has 4 migrations of its own (rate limits, consents, store subscriptions), superseded by
  later equivalents.

## Open pull requests (all older than the release candidate)

| PR | Head → base | Status |
|---|---|---|
| #12 | `claude/legal-remediation` → `release/testflight-rc-2026-11-15` | **Obsolete**: fully contained in this branch |
| #11 | `claude/rc-verification` → `main` | **Obsolete**: fully contained; superseded by the PR from this branch |
| #10, #9 | `first-time-ux`, `badge-progress` → `faith-discipleship` | Obsolete: contained |
| #8 (draft) | `anatomical-3d-exercises` → `interactive-demo` | Obsolete: the 3D work was replaced by 2D animations |
| #7, #6 | `interactive-demo` → `free-pro-membership` → `testflight-prep` | Obsolete: contained |
| #5, #4, #3 | `ios-ci-reliability`, `android-hardening`, `launch-audit` → `testflight-prep` | Obsolete: contained |

**Recommendation:** close #3–#12 after the consolidation PR is reviewed (owner action; nothing was closed here).

## Workflows

- **CI:** runs on `main`, `release/**` and pull requests.
- **iOS:** compile, archive check, Simulator and WebKit; signed TestFlight upload only on manual, owner-only start
  inside the protected environment.
- **Android APK / Play bundle:** manual or on Android paths.
- **Food database, BSB text, Pages:** data jobs.

Results on this branch are in TEST_RESULTS.md.
