# Final launch checklist

Three separate gates. A green CI run is evidence for the code only; it is not a TestFlight install, a store purchase or
legal clearance. Status as of 2026-10-26, branch `claude/free-pro-membership`.

## Milestones toward installing on your iPhone

| Milestone | Status | Evidence / what's missing |
|---|---|---|
| Web app production build | ✓ Done | `next build` passes locally and in CI |
| iOS Simulator build (compile) | ✓ Done in CI | `ios.yml` compile job; see `FINAL_TEST_RESULTS.md` |
| iOS Simulator tests (opening, relaunch, background) | ✓ Done in CI | `ios.yml` Simulator and WebKit jobs |
| Signed iPhone build (archive) | ✗ Blocked | Needs your Apple Developer account, App ID with HealthKit, and the four `ASC_*` / `APPLE_TEAM_ID` secrets entered by you in GitHub |
| Deployed HTTPS site the app loads | ✗ Blocked | Needs a Supabase project, a host and your approval to deploy (`docs/TESTFLIGHT.md` §1) |
| App Store Connect upload | ✗ Not started | Needs the two rows above and your approval to upload |
| TestFlight processing | ✗ Not started | After upload, usually 10–30 minutes |
| Installed on your iPhone | ✗ Not started | Never claimed; nothing has run on physical hardware |

## Milestones toward Google Play

| Milestone | Status | Evidence / what's missing |
|---|---|---|
| Android project targets API 36 (Play's 2026 requirement), minimal Health Connect permissions, no background location, backups off | ✓ Done | `android/variables.gradle`, `AndroidManifest.xml`; checked by `android-play.yml` |
| Debug APK compiles (offline edition) | ✓ Done in CI | `android-apk.yml` |
| Release bundle (.aab) builds; 16 KB alignment and merged permissions checked | ✓ in CI (offline edition) | `android-play.yml`; see `FINAL_TEST_RESULTS.md` |
| Signed bundle of the online app | ✗ Blocked | Needs your upload key in GitHub secrets and a deployed site |
| Play Console: subscription `ngf_pro` ($19.99 monthly / $149.99 yearly base plans), Data safety, Health apps and foreground-service declarations, listing | ✗ Not started | Draft answers in `ANDROID_READINESS.md` |
| Closed test (12 testers, 14 days, for a new personal account) | ✗ Not started | Your account type decides |
| Installed and tested on an Android phone | ✗ Not started | Never claimed; nothing has run on hardware |

## A. Ready for internal TestFlight

| Requirement | Status | Owner action |
|---|---|---|
| App code builds and its tests pass | ✓ | — |
| No known critical security or data-loss defect | ✓ (none open; see `FINAL_REPOSITORY_REVIEW.md`) | — |
| Cinematic opening, 157 demos, Faith section, black-and-gold design preserved | ✓ | — |
| Deployed site + Supabase migrations applied (including 44 and 45 from this PR) | ✗ | Create project, deploy with your approval |
| Apple Developer membership, App ID (HealthKit), App Store Connect app record, internal testing group | ✗ | You |
| GitHub secrets for signing (`APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64`) | ✗ | You, entered only in GitHub settings |
| Sign-only `testflight` run, then upload | ✗ | Your approval for the upload |
| PRs 3, 4, 5 and this PR merged into `claude/testflight-prep` | ✗ | Your review and approval |

Final privacy policy and terms are not required for internal testers, but the in-app drafts must stay marked as drafts.

## B. Ready for external beta testing

Everything in A, plus:

| Requirement | Status |
|---|---|
| Device test plan run on an iPhone (`IOS_DEVICE_TEST_PLAN.md`): Apple Health import, background GPS, camera barcode scanner, notifications, opening animation | ✗ Needs a device |
| Sandbox purchases end to end (buy monthly/yearly, switch, cancel, restore, refund, billing problem) | ✗ Needs App Store Connect products, RevenueCat, sandbox testers |
| Privacy policy URL, App Privacy answers matching `PrivacyInfo.xcprivacy`, test account for Beta App Review | ✗ You + counsel |
| Legal entity (Apple guideline 5.1.1(ix) expects sensitive-data apps from an entity) | ✗ You |
| Support contact and a breach-response procedure | ✗ You |

## C. Ready for a public paid launch

Everything in B, plus:

| Requirement | Status |
|---|---|
| Final Terms of Service, Privacy Policy, consumer-health-data policy (WA/NV), auto-renewal terms; published by you after counsel review | ✗ Drafts in `docs/legal/` |
| Re-acceptance switched on if final terms differ materially (`LEGAL_REACCEPT_REQUIRED=true`) | ✗ Your decision |
| Stripe live mode approved (`STRIPE_LIVE_APPROVED=true`), live prices at $19.99 / $149.99, receipt and renewal-reminder emails on | ✗ Your approval |
| Store products live at the approved prices, localized prices reviewed | ✗ You |
| Trademark search and filing decision for NARROW GATE FITNESS; review of "Narrow Gate Nutrition Score" next to Nutri-Score grades | ✗ Trademark counsel (`FINAL_TRADEMARK_REVIEW.md`) |
| Patent claims read by counsel (Fitbod '760, Amazon '629/'693 first) | ✗ Patent counsel (`FINAL_PATENT_REVIEW.md`) |
| Insurance: general liability, professional/E&O with affirmative AI coverage, cyber | ✗ You and a broker |
| Experimental 0–100 nutrition score stays off (`FOOD_IQ_SCORE=off`) until scientific and legal review | ✓ Off by default |
| Existing-subscriber price migration, if any subscribers exist | ✗ Your approval (`FINAL_MEMBERSHIP_IMPLEMENTATION.md` §3) |

## Approvals only you can give

Merging any PR; deploying; applying migrations to a production database; uploading to TestFlight or a Google Play
track; submitting to the App Store or Google Play; creating or activating live subscription products; enabling live Stripe charges; accepting
Apple or Google agreements; changing production secrets; publishing legal documents; renaming anything.
