# Release readiness report — 2026-11-09

One report for the combined release of PR #10 (first-time UX) and PR #9 (badge progress) on top of the development
branch `claude/faith-discipleship`.

**Nothing has been merged, deployed or published, and no subscription has been activated.**

## Verdict

| Release | Decision | Why |
|---|---|---|
| **Private (internal) TestFlight** | **GO, after the owner approves the two merges** | Every automated gate passes on the combined tree (below). No open Critical or High *code* defect. Internal TestFlight is not blocked by any legal item (`docs/launch-audit/FINAL_PRIVACY_AND_LEGAL.md` §6). It still needs the owner's staging deployment and Apple account steps (`docs/TESTFLIGHT_STEPS.md`). Its purpose is to run `TESTFLIGHT_ACCEPTANCE.md`. |
| **Paid public launch** | **NO-GO** | See the list below. |

The paid public launch is NO-GO because:
- 0 of 138 physical-device cases have been run.
- Sandbox purchase and restore have never run against real App Store Connect products.
- Live AI has not been evaluated.
- The legal documents are drafts with no entity (U1, U2), and other High legal items are open (U3–U7).

## 1. Exact integrated commit

| Item | Commit |
|---|---|
| Development branch `claude/faith-discipleship` (= `release/rc-2026-11-04`) | `6c0832f` |
| PR #10 head `claude/first-time-ux` | `21d376a` (40 commits ahead of dev, 0 behind) |
| PR #9 head `claude/badge-progress` | `eceaf0a` (5 commits ahead of dev, 0 behind) |
| **Combined trial merge #10 + #9** | commit `549bf96`, tree `fe365f59` — built locally with `git merge-tree`, **on no branch and not pushed** |

The two PRs merge with **no conflicts**, and neither is behind dev. They can be merged in either order. Recommended:
**#9 first, then #10**. #9 is smaller, and #10's tests already expect #9's Badges text (exact-match fix in
840d4a2). Merging is the owner's decision. Nothing has been merged.

## 2. CI and test results

### GitHub CI (`.github/workflows/ci.yml`: checks, integration, security-scan)

| Commit | Run | Result |
|---|---|---|
| #10 `21d376a` | [run 137 (42691155932)](https://github.com/Joshfit77/Testing-testing-testing/actions/runs/42691155932) | **success**, first attempt, 3/3 jobs |
| #10 `840d4a2` | [run 136 (42673763116)](https://github.com/Joshfit77/Testing-testing-testing/actions/runs/42673763116) | attempt 1 failed with only `security-scan` created (checks and integration never scheduled: a GitHub scheduling fault, no code ran); attempt 2 **success**, 3/3 jobs |
| #9 `eceaf0a` | [run 135 (42557498886)](https://github.com/Joshfit77/Testing-testing-testing/actions/runs/42557498886) | **success** |

CI does not run the Playwright suites or the combined tree. Those were run locally (next table).

### Local runs on the combined tree `549bf96`

| Suite | Result |
|---|---|
| Typecheck, lint | pass |
| Unit (vitest) | **3,501 passed** of 3,501 (185 files) |
| Integration (vitest, local Supabase, `db reset`) | **336 passed, 1 skipped** of 337 (53 files + 1 skipped) |
| Production build | pass |
| Production e2e (Playwright, Pixel 7 Chromium, production server with the e2e test config) | **Not yet recorded** (run in progress; the result will be added in the next commit) |
| Demo e2e (Playwright, `DEMO_MODE`, sample account) | **Not yet recorded** (runs after the production suite) |

The suites include the checks the owner named for the combined result:
- **Badge progress:** integration `badge-progress`, `e2e/achievement-progress`, `e2e/rank-badges`.
- **GPS achievements** (GPS + treadmill + manual runs count toward run milestones): `e2e/achievement-progress`, unit
  `exercise-milestones`.
- **Exercise milestones and personal records** (heaviest lift vs estimated 1RM, bodyweight tracks): unit
  `exercise-milestones`, `e2e/training-stage2`.
- **Workout-completion celebration** (no sideways overflow on a phone): `e2e/achievement-progress`, unit
  `milestone-celebration`.
- **New-member empty states:** `e2e/new-member-states`.

## 3. Open Critical and High defects

**Code: none open at Critical or High.** Known Medium and Low code items, carried from
`docs/LAUNCH_AUDIT_2026-11-08.md` §4 and still open on this tree, are:

| Sev | Item |
|---|---|
| Medium | No root `global-error.tsx`: an error in the root layout shows the framework page and is not reported |
| Medium | A background sync that finds the member signed out sends them to login mid-workout without a message (the draft is kept) |
| Medium | GPS "Continue recording" after a crash counts the time away as moving time (owner decision; one-line change) |
| Medium | No soft confirmation for implausible loads (a 1,000 kg typo becomes a personal record) |
| Low | Sleep edge cases (split nights, travel time zones, a few minutes' difference in stage totals) |
| Low | GPS start abandoned while acquiring a fix leaves the "Recording" pill until discarded |
| Low | The offline single-file edition (`standalone/`, Android APK workflow only) shows old prices. Do not ship that APK. The App Store app is not affected. |
| Low | 24 controls still under 44 pt (`docs/ux/FIRST_TIME_UX_RESULTS.md` §13). 21 of them are in files PR #9 also changes, to be fixed after the merge. |

**Legal / compliance (not code), Critical and High** — from `FINAL_PRIVACY_AND_LEGAL.md` §6:

| ID | Sev | Item | Blocks |
|---|---|---|---|
| U1 | Critical | Terms and Privacy Policy are drafts with placeholders | Paid launch; external TestFlight needs at least a public privacy-policy URL |
| U2 | High | No legal entity (individual developer) | Paid launch |
| U3 | High | Terms acceptance not recorded with version and time | Paid launch |
| U4 | High | Web checkout: no consent record, acknowledgment e-mail or annual reminder | Paid launch (web) |
| U5 | High | One source of truth for prices in the Terms and on the paywall, checked against the store products | Paid launch |
| U6 | High | WA MHMDA / NV consumer-health-data policy | Paid launch |
| U7 | High | Breach / HBNR incident procedure | Paid launch |

## 4. Native verification coverage

| Evidence | Status |
|---|---|
| Physical iPhone | **None.** `docs/device-testing/device-test-results.csv`: 0 of 138 cases have a result. `docs/release/TESTFLIGHT_ACCEPTANCE.md` (65 rows, 11 areas) is ready to run. |
| iOS Simulator (CI `ios.yml`) | Earlier release-candidate runs passed: launch, opening gate, relaunch, background return, unsigned Release archive check (`docs/RELEASE_CANDIDATE.md`). **Not re-run on `549bf96`**, and Simulator runs never count as device verification. |
| Browser (Playwright) | Everything in §2. Geolocation, offline, visibility and AI are emulated or mocked. |

These need a physical device and are **not verified**:
- locked and background GPS, and real route accuracy;
- Apple Health permissions and real sleep data;
- notification delivery, sound and haptics;
- the camera barcode scanner and photos;
- the App Store purchase, restore and expiry;
- VoiceOver, Dynamic Type and native keyboard behaviour;
- process termination.

## 5. Payment readiness

| Item | State |
|---|---|
| Stripe live | **Off.** Live keys are refused unless `STRIPE_LIVE_APPROVED=true` (not set). Web checkout is tested in test mode only, and a hosted Checkout session has never been opened. |
| Pro authority | Server only. Client state cannot unlock Pro (integration `pro-bypass`, `entitlements`, `free-user-direct-actions`). |
| Stripe webhooks | Ordered, exactly-once; refunds, disputes and reconciliation tested (integration `billing-integrity`). |
| RevenueCat / App Store | Webhook and server re-check tested with simulated events. Sandbox purchases count only for allow-listed testers (`REVENUECAT_ALLOW_SANDBOX=false`). **Not run against real App Store Connect products or a sandbox Apple ID.** |
| Legacy Plus members | Keep their entitlements (integration `entitlements`, `store-billing`). |
| History after a downgrade | Kept; Pro screens lock with a free next step (integration `plan-enforcement`, `e2e/memberships`). |
| PRs #9 and #10 | Change no billing, entitlement or migration code. |

**Payment readiness: ready for sandbox testing in internal TestFlight. Not ready for real charges.** Real charges need
the App Store Connect products, the RevenueCat project, the device purchase tests (DT-IAP), the legal items U1–U5, and
explicit owner authorisation.

## 6. Privacy and legal work outstanding

- **Counsel:**
  - finalise the Terms and Privacy Policy (U1);
  - consumer-health-data policy (U6);
  - incident procedure (U7);
  - auto-renewal compliance (U4);
  - the release clause (U19);
  - primary-source checks of state law (U20).
- **Owner:**
  - form the entity and move the Apple and store accounts to it (U2);
  - retention periods (U11);
  - confirm the hosting, regions and auth-email provider, and sign DPAs (U12);
  - insurance (U14);
  - decide whether the prayer-journal "Share with AI Coach" option stays. It is opt-in per entry and off by default.
    If it stays, name it in the policy.
- **Code, small:**
  - record terms acceptance with version and time (U3);
  - religious-data notice (U9);
  - progress-photo consent card (U10);
  - open-source notices screen (U15);
  - a persistent AI label in the coach (U16).

Privacy controls already in place and tested:
- The prayer journal is excluded from AI unless the member shares an entry (unit `coach-journal`, `coach-memory`).
- Notifications carry counts only, never prayer text.
- Member data is isolated (integration `rls`, `cross-user-isolation`).
- Export and deletion are tested (integration `account-deletion`).
- No secrets are in the repository (gitleaks, full history, run 137).

## 7. Known limitations

- **Onboarding:** 17 interactions to the first workout, 37 to a saved one. Shortening it further needs an owner
  decision: optional body data, or moving on after a single-choice answer.
- **Badge thresholds** in `docs/BADGES.md` are marked "proposed — please confirm".
- **2D demonstrations:** all 157 exercises have one, and none is marked owner-approved.
- **AI Coach and meal photo** have only run against a mock model. Live responses need an owner-approved, spend-capped
  staging key.
- **Apple Health sleep** is read when the app opens. There is no background sync overnight.
- **Five-tab navigation** is unchanged. No alternative was prototyped.
- **Open PRs #3–#8:**
  - #3–#7 are already contained in dev.
  - #8 (anatomical 3D, draft) is superseded by the 2D-only decision.

  All six are recommended for closing without merge. That is the owner's decision; none has been closed.

## 8. What happens next (owner)

1. Approve and merge PR #9, then PR #10, into `claude/faith-discipleship`. This is not into `main`.
2. Approve the staging deployment and the internal TestFlight build (`docs/TESTFLIGHT_STEPS.md`).
3. Run `docs/release/TESTFLIGHT_ACCEPTANCE.md` on a physical iPhone. Areas 1, 8 and 9 come first.
4. Re-run `docs/release/REGRESSION_CHECKLIST.md` on the merged commit and record it here.
5. Paid launch only after: device acceptance with no open Critical or High, the U1–U7 legal items, App Store
   Connect products, and explicit authorisation to enable real subscriptions.
