# Narrow Gate Fitness: pre-TestFlight readiness report

Date: 2 November 2026. Branch: `security/payment-hardening-prelaunch`. Every result below names the commit it was
obtained on. Nothing was merged into `main`, deployed, uploaded to Apple, charged, or changed in a hosted account.
No pull request was opened.

**Verdict for internal TestFlight: NOT VERIFIED.** The code side is ready. Every check that can run without your
accounts passes, including an unsigned Release archive of the online app for a real iPhone. Not verified:
- the signed build;
- the upload;
- the hosted staging database and site;
- sandbox purchases;
- every native feature on a physical iPhone.

All of these need your Apple Developer membership (after the LLC), Supabase, a host, RevenueCat and Stripe test mode.
Section F gives the evidence. Section G gives the order of steps.

---

## Phase 1: which code is the latest

| Fact | Finding (checked on `git fetch --all`, 2 Nov) |
|---|---|
| Newest complete app | `security/payment-hardening-prelaunch`. Every other app branch is fully contained in it, except the ones listed below. |
| Relation to `main` | `main` (`aad49a1`, 17 Oct, PR #2 squash-merged) is an ancestor. The branch is 0 commits behind `main` and was 303 ahead before this round. The earlier "279" doesn't match `main` today. It is exactly the distance from `claude/security-nasb-deletion`, which is probably what that count was measured against. |
| Open pull requests | #3–#8 are stacked on older branches. Every head (`launch-audit`, `android-hardening`, `ios-ci-reliability`, `free-pro-membership`, `interactive-demo`, `anatomical-3d-exercises`) is contained in this branch. None was merged. |
| **Unfinished merge found** | `claude/workout-experience` (4 commits, 28 Oct) held confirmed first-workout fixes that no later branch had. **Merged in this round** (`535b8a2`); details in section B. |
| Superseded work | `claude/production-readiness` (12 commits) is a parallel implementation of Free/Pro, RevenueCat, consent and shared rate limits, all of which this branch has, implemented and tested separately. Its one unique fix (the arm64 device requirement) was ported (`ed7d993`). |
| Not merged, needs your decision | `claude/privacy-policy` (2 commits) has longer draft Terms and Privacy pages, but they were written against the 17 October app and miss later features (GPS routes, sleep, Body Scan, food-photo AI, store billing). They are legal text: counsel should choose. The current pages are short drafts, marked as drafts. |
| Not part of the app | `claude/animated-opening-demo` (2 commits: patent and trademark notes, docs only). Three branches hold other websites: `claude-ltp8ut`, `cool-gauss-hhzt4p`, `new-session-rv5wiw`. |

### Status of previously reported items (checked against the code at `02e4b74`)

| Item | Status | Evidence |
|---|---|---|
| C8: release workflows least-privilege | **VERIFIED COMPLETE** | Read-only build jobs, publish jobs that run no repository code and check the file's SHA-256 checksum. Dry runs on GitHub; zizmor shows 0 high or medium findings. |
| F14–F19 Low findings | **VERIFIED COMPLETE** | Migration 048 applies from scratch; `low-findings.test.ts` and `legal-acceptances.test.ts` pass; the CSP browser tests pass. |
| Migrations 046 and 047 | **VERIFIED COMPLETE** locally · **NEEDS EXTERNAL SETUP** (hosted) | All 45 migrations apply in order to an empty database (`supabase db reset`, 45 applied). Not applied to any hosted project. |
| Stripe and RevenueCat security fixes | **VERIFIED COMPLETE** in code · **NEEDS EXTERNAL SETUP** (sandbox) | `billing-integrity.test.ts` and `pro-bypass.test.ts` pass: forged, replayed, concurrent and out-of-order webhooks, metadata hijack, compare-and-set. |
| AI rate limits and concurrent usage | **VERIFIED COMPLETE** | 40 simultaneous requests against a limit of 5 let exactly 5 through. A retried message is answered from the saved reply with one charge (F18). |
| GitHub Actions permissions | **VERIFIED COMPLETE** · repository settings **NEEDS EXTERNAL SETUP** (C9) | All 7 workflows lint clean. Repository-level settings (default token, branch protection) are yours to set. |
| Intermittent iOS Simulator test | **VERIFIED COMPLETE** | iOS run 58 (`ed7d993`): all 3 XCUITests passed on the first try, and Enter Narrow Gate was exercised (all three CHECKs ok). Runs 54–57 are in the security report, E2. |
| Run page overflow | **VERIFIED COMPLETE** | Phone sweep: no sideways scroll at 320–440 pt. A further overflow on Progress → Overview was found and **fixed** in this round. |
| Repository secret scanning | **VERIFIED** (gitleaks) · GitHub setting **NEEDS EXTERNAL SETUP** | gitleaks 8.30.1 over the whole history: 0 leaks in 394 commits. Turning on GitHub secret scanning and push protection is a repository setting only you can change. |
| Supabase Row Level Security | **VERIFIED COMPLETE** locally · **NEEDS EXTERNAL SETUP** (hosted) | `cross-user-isolation.test.ts`: every user-owned table and every private bucket, for read, write, delete, attach and sign. |

---

## A. Already completed (verified, existed before this task)

- **Accounts:**
  - sign-up with email confirmation, sign-in, sign-out, password reset;
  - links that work in any browser (`/auth/confirm`);
  - no account enumeration;
  - old refresh tokens rejected after sign-out;
  - forged tokens rejected;
  - auth rate limits shared across server instances.
- **Data protection:**
  - RLS on every user-owned table;
  - private buckets for avatars, progress photos and Body Scans;
  - privileged functions closed to members;
  - ownership checks on related records (migration 048);
  - full data export;
  - permanent deletion of every row, file and the sign-in.
- **Payments:**
  - live Stripe keys ignored unless `STRIPE_LIVE_APPROVED=true`;
  - demo mode never charges;
  - Pro enforced on the server (and by the database for paid rows);
  - RevenueCat events re-read the customer and never trust the webhook body;
  - sandbox purchases count only when `REVENUECAT_ALLOW_SANDBOX=true`;
  - the RevenueCat identity is cleared at sign-out;
  - Stripe checkout refuses any price other than $19.99/month and $149.99/year.
- **Browser hardening:**
  - per-request nonce CSP, so injected scripts don't run;
  - security headers;
  - structured logs without request bodies, health data or tokens.
- **iOS project:**
  - Capacitor 8 with Swift Package Manager;
  - iOS 16 minimum;
  - bundle ID `com.narrowgatefitness.app`;
  - HealthKit entitlement;
  - permission texts;
  - background location;
  - privacy manifest;
  - icon and launch screen;
  - an offline page with "Try again";
  - a TestFlight workflow that signs and uploads only when you ask.

## B. Fixed during this task

| Commit | Change | Files | Tests |
|---|---|---|---|
| `535b8a2` | **Merged the unmerged first-workout fixes.** "Today" uses the member's own time zone, captured at onboarding and sign-in; until now every member's day was UTC. Also: no phantom "Resume workout" after just opening the logger; substituting keeps the sets already done; a rest day after a workout; sync back-off; Finish shows what's next and "baselines"; rest notifications only when alerts are on; auth links redirect by path (they broke behind a proxy). Conflicts resolved in favour of the newer code: fixed sign-in messages, the newer offline-discard store. | 26 files, including `workout-logger.tsx`, `workout-draft.ts`, `training-schedule.ts`, `auth/callback`, `auth/confirm`, `actions/auth.ts`, `actions/onboarding.ts` | `workout-reliability.spec.ts`, `core-flow.spec.ts`, `onboarding-plan.spec.ts` 5/5; `workout-draft-session.test.ts` (10); updated route and draft tests |
| `6a9267d` | **Security: open redirect closed.** `?next=/.//evil.com` (and `/a/..//`, `/%2e//`) resolved to `//evil.com`, which a browser sends to another site, after sign-in or from an email link. It existed before this task. | `src/lib/safe-redirect.ts` | 6 payloads + 2 route cases; they fail on the old code |
| `ed7d993` | **iOS:** the required device capability is now arm64 (was the 32-bit armv7). New CI job "Device archive check": the online app, Release, archived unsigned for iPhone and checked against App Store Connect's requirements. The TestFlight job stops if Xcode is a beta or the SDK is older than 26. | `Info.plist`, `ios.yml`, `scripts/ios-verify/check-archive.py` | iOS run 58: archive check 40/40 |
| `5987b76` | **Layout:** Progress → Overview was 400–401 px wide at 320–393 pt for Pro members, and 496 px with the largest text. New regression sweep over every signed-in screen. | `progress/overview/page.tsx`, `e2e/phone-sweep.spec.ts` | Sweep fails before the fix and passes after (295 page loads) |
| `02e4b74` | Staging environment reference; the LLC-to-TestFlight setup guide | `docs/STAGING_ENVIRONMENT.md`, `docs/TESTFLIGHT_SETUP_GUIDE.md` | — |

## C. Remaining code defects (ranked)

1. **Medium (owner decision, not code): the legal pages are short drafts.** Terms and Privacy say they are drafts,
   with counsel placeholders. That's fine for internal TestFlight testers, but the App Store requires a final privacy
   policy URL, and the Terms need refund and consumer-law terms. The fuller drafts on `claude/privacy-policy` predate
   half the features.
2. **Low:** `e2e/journeys.spec.ts` "filters and scroll position…" fails on the build from before the previous round
   too. It's an existing problem, not fixed.
3. **Low (test reliability):** the browser test "iPhone landscape: the door opens…" failed once in the full suite
   (an aborted image request while it waited for frames) and passed 3/3 when rerun.
4. **Low (product decision):** the app is built for iPhone and iPad (`TARGETED_DEVICE_FAMILY = 1,2`). App Store
   review then also tests it on iPad and needs iPad screenshots. If the launch is iPhone-only, set it to `1` before
   submission. It doesn't matter for TestFlight.
5. **Cosmetic:** the launch screen's image set has 3 unassigned images (a build warning, no effect).
6. Development-only dependency advisories remain (`npm audit` without `--omit=dev`). Production dependencies: 0.

No Critical or High code defect is open.

## D. External setup (your accounts)

In order. Full steps: [TESTFLIGHT_SETUP_GUIDE.md](TESTFLIGHT_SETUP_GUIDE.md) and
[STAGING_ENVIRONMENT.md](STAGING_ENVIRONMENT.md).

1. Apple Developer Program as the LLC: D-U-N-S Number, organization enrollment, Team ID.
2. App ID `com.narrowgatefitness.app` with HealthKit. In-App Purchase is on by default.
3. App Store Connect app record and an internal testing group.
4. Subscriptions `ngf_pro_monthly` at $19.99 and `ngf_pro_yearly` at $149.99. Paid Apps agreement, tax and banking
   before real sales.
5. RevenueCat: the App Store app, entitlement `pro`, the webhook to staging, the keys on staging only.
6. Supabase staging project, with migrations, auth URLs, email templates and SMTP.
7. A staging HTTPS deployment with Stripe **test mode** and `REVENUECAT_ALLOW_SANDBOX=true` (staging only).
8. GitHub secrets `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64`.
9. Repository settings: secret scanning with push protection, branch protection on `main`, read-only default
   workflow token.
10. Counsel: final Terms and Privacy, then set `LEGAL_TERMS_URL` and `LEGAL_PRIVACY_URL`.

## E. Physical iPhone testing (a Simulator can't verify these)

Record the build number, iPhone model and iOS version for each.

- **Install and launch:**
  - TestFlight install;
  - first launch with the opening, then Skip intro and Enter Narrow Gate;
  - relaunch;
  - return from the background (the opening must not replay);
  - airplane mode at launch shows the offline page; "Try again" recovers.
- **Accounts:**
  - sign-up confirmation link opened from the Mail app;
  - a password reset requested in the app, opened in Safari;
  - sign out, then sign in to a second account on the same phone (no data or Pro carried over);
  - delete the account.
- **Apple Health:**
  - the permission sheet;
  - steps import;
  - sleep with stages;
  - overnight heart rate, HRV and respiratory rate;
  - re-sync without duplicates;
  - turning access off in the Health app.
- **GPS run and walk:**
  - permission "While Using", then "Always" for locked recording;
  - start, pause, resume, finish;
  - 10+ minutes with the phone locked;
  - distance, pace and splits against a known route;
  - app killed mid-run, then recovered;
  - route deletion;
  - Free vs Pro limits.
- **Camera:**
  - barcode scan in the store;
  - meal photo (AI estimate, which needs an `ANTHROPIC_API_KEY` on staging);
  - progress photos;
  - Body Scan capture.
- **Notifications:**
  - the rest-timer alert while the phone is locked, with sound and vibrate settings respected;
  - workout and devotional reminders.
- **Purchases:**
  - sandbox Pro Monthly and Yearly;
  - restore after a reinstall;
  - monthly ↔ yearly switch;
  - cancellation and expiry (sped-up renewals);
  - a second account on the same Apple ID.
- **Device feel:**
  - keyboard over forms (food log, journal);
  - Dynamic Island and home-indicator clearance;
  - VoiceOver on the main tabs;
  - iOS text size at its largest;
  - Low Power Mode during the opening and the exercise player;
  - haptics on set completion.

## F. TestFlight readiness: NOT VERIFIED

| Requirement | Result | Evidence |
|---|---|---|
| Xcode and SDK meet Apple's minimum (Xcode 26 / iOS 26 SDK since 28 Apr 2026; iOS 27 SDK from April 2027) | **PASS** | Run 58: Xcode 26.6 (17F113), iPhoneOS SDK 26.5, released Xcode (not a beta) |
| Deployment target (iOS 13+ now, iOS 15+ from April 2027) | **PASS** | 16.0 |
| Online app compiles and archives for a real iPhone (Release, arm64) | **PASS** | Run 58 "Device archive check", unsigned |
| Bundle ID, version, build number, icon, launch screen, permission texts, background location, privacy manifest, ATS (HTTPS only), offline page | **PASS** | `check-archive.py`, 40 of 40 checks |
| Online app (not the offline edition) | **PASS** | The archive's `capacitor.config.json` loads the HTTPS server address; the TestFlight job asserts the same |
| The app in an iPhone Simulator | **PASS** | Run 58: launch, Enter Narrow Gate, relaunch, background; 3/3 tests, first try |
| Native plugins compile (Health, background GPS, barcode, notifications, haptics, keyboard, RevenueCat, splash, status bar) | **PASS** | Same archive, Swift Package Manager |
| Signed build | **NOT VERIFIED** | Needs the Apple Developer account and the signing secrets |
| Upload and processing | **NOT VERIFIED** | Needs the above plus your approval |
| Staging site and database | **NOT VERIFIED** | Not deployed; needs Supabase and a host |
| Purchases (sandbox) | **NOT VERIFIED** | Needs App Store Connect and RevenueCat |
| Physical iPhone | **NOT VERIFIED** | Section E; nothing has been run on a real device |

### Automated verification (Phase 8), on `02e4b74`

| Check | Command | Result |
|---|---|---|
| Type check | `npx tsc --noEmit` | pass |
| Lint | `npx eslint .` | 0 errors, the same 5 warnings |
| Production build | `npm run build` | pass |
| Database from scratch | `npx supabase db reset` | all 45 migrations and the seed applied |
| Unit tests | `npx vitest run --project unit` | **2,807 / 2,807** (132 files) |
| Integration (database, auth, RLS, billing, security) | `npx vitest run --project integration` | **248 passed, 1 skipped**: the skipped file calls a live outside food service |
| Browser tests, full suite (Chromium, phone size), server without an AI key | `npx playwright test --project=mobile` | **71 passed, 4 failed, 23 skipped** (98 tests, 13.4 min). Each failure and skip is below. |
| — the 2 membership failures | `e2e/memberships.spec.ts`, rerun on a server with a placeholder AI key (no real key, no AI calls) | **2 / 2 pass**. They check the coach's Pro upsell, which shows only when an AI key is configured; without one the coach correctly says it isn't configured. |
| — the opening in landscape | `opening-gate.spec.ts` "iPhone landscape…", rerun 3 times | **3 / 3 pass**. The one failure was an aborted image request in the test's own frame wait: **intermittent**, counted as such, not as a pass. |
| — the journeys scroll test | `journeys.spec.ts` "filters and scroll position…" | **fails**. It also fails on the build from before the previous round (existing, not fixed; section C). |
| — 13 skipped tests that need mocks | `coach.spec.ts`, `food-quality.spec.ts`, `food-amounts.spec.ts` with the mock AI provider and the mock Open Food Facts server | **13 passed**, 1 skipped (by design: "coach isn't configured" can't run when a provider is set, and it passed in the main run) |
| — 10 skipped demo-mode tests | `demo.spec.ts` | **not run**. The demo seed only runs on an empty database, and this one holds the test accounts. Demo mode isn't part of the TestFlight build. |
| Phone layout sweep | `e2e/phone-sweep.spec.ts` | **pass**: 59 screens × 5 configurations (375, 393, 440, 320 pt; 375 pt with the largest text and reduced motion) |
| iOS on GitHub, run 58 (`ed7d993`) | `ios.yml` checks | **success**: compile, WebKit, device archive, Simulator (no retries) |
| Workflow lint and security | actionlint 1.7.12, zizmor 1.31.1 | clean; zizmor shows no findings on `ios.yml` |
| Secrets | gitleaks 8.30.1, all refs | 0 leaks, 394 commits |
| Production dependencies | `npm audit --omit=dev` | 0 vulnerabilities |

## G. First upload instructions (short form)

1. Finish D1–D8.
2. Deploy the branch to staging and run the smoke test in `STAGING_ENVIRONMENT.md` section 4.
3. Actions → iOS → Run workflow:
   - job `testflight`;
   - `server_url` = `https://<staging-domain>`;
   - **upload unticked** (signs only; nothing leaves GitHub).
4. When that passes, approve the upload and run it again with **upload ticked**.
5. App Store Connect → TestFlight: wait for processing (10–30 min), then add the build to your internal group.
6. On the iPhone: install TestFlight, install Narrow Gate Fitness, and work through section E.

## H. Release safety

- Not merged into `main`, and no pull request opened.
- No deployment of any kind (no Vercel, no hosted Supabase).
- No TestFlight or App Store upload: the TestFlight job stayed skipped on every run.
- No live payment configuration and no charge. Stripe live keys stay ignored without `STRIPE_LIVE_APPROVED`.
- No credentials requested, printed or committed. The local database keys are Supabase's public development defaults.
- Prices unchanged ($19.99/month, $149.99/year). No Plus product added. The faith section is unchanged and stays free.
