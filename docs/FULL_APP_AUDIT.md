# Narrow Gate Fitness: full application audit and repair

Date: 2026-11-01. Branch: `claude/exercise-demo-25d`. Nothing merged into `main`, deployed, published or purchased.

**Verdict: not App Store ready.** No code defect of P0 severity was found, and every P1 code defect is fixed. Submission
is still blocked by setup only you can do (hosting, Apple Developer account, hosted Supabase settings, final legal
documents, store products, two decisions) and by tests that need a physical iPhone. **No physical iPhone was used
anywhere in this audit.**

Four audits ran in parallel, each in its own git worktree, and were merged into the branch after a check that none
touched the 2D exercise animations. The detailed reports, with evidence, file paths and the test for every defect:

| Report | Area |
| --- | --- |
| [`docs/audit/1-security-auth.md`](audit/1-security-auth.md) | Accounts, sign-in, password reset, RLS and storage isolation, API and server-action auth, secrets, logs, privacy, export and deletion |
| [`docs/audit/2-ai-coach-memberships.md`](audit/2-ai-coach-memberships.md) | AI coach (data grounding, memory, safety, cost), Free/Pro limits, Stripe, RevenueCat, demo mode |
| [`docs/audit/3-workouts-nutrition-progress-faith.md`](audit/3-workouts-nutrition-progress-faith.md) | Workout logger and programs, food log and barcode, progress and badges, faith |
| [`docs/audit/4-gps-health-ios-performance.md`](audit/4-gps-health-ios-performance.md) | GPS runs, Apple Health / Health Connect and sleep, the iOS (Capacitor) project, performance |

The 2D exercise animations were out of scope for the audit (your rule 1). That work is reported separately in
[`docs/EXERCISE_ATHLETE_LOOK.md`](EXERCISE_ATHLETE_LOOK.md).

## Counts

| | P0 | P1 | P2 | P3 | Total |
| --- | --- | --- | --- | --- | --- |
| Confirmed defects | 0 | 3 | 8 | 25 | **36** |
| Repaired (each with a regression test, or a documentation fix where the defect was in the docs) | 0 | 2 + 1 documented | 7 | 10 | **20** |
| Remaining | 0 | 0 code (1 setting for you to decide) | 1 | 15 | **16** |

How these were counted:

- Audits 1 and 2 found the same defect (AI routes reading the plan through the wrong client), so it is counted once.
  It was fixed once at merge (audit 2's `planForAuth`).
- The P1 sandbox-purchase setting (`REVENUECAT_ALLOW_SANDBOX`) is in the "repaired" row for its corrected
  documentation. The setting itself is your decision; see the decisions below.
- Remaining by report: audit 1, 1 (P3); audit 2, 4 (P3); audit 3, 3 (P3); audit 4, 8 (1 P2, 7 P3). Each report gives
  the proposed patch for every remaining item.

Tests on the merged branch:

- Unit: **128 files, 2,780 tests, all passing** (up from 115 files and 2,698 tests before the audit).
- `tsc --noEmit`: clean. ESLint: 0 errors, 5 warnings (unused variables, none new).
- Integration: each auditor ran its own area against the local Supabase stack (audit 1: 35 files, 209 tests, 1
  network-only file skipped; audit 3: 11 files, 70 tests; audit 4: 34 of 34 in its area).

## Findings

Statuses: PASS, FIXED, PARTIAL, FAILED, BLOCKED, NOT TESTED. The defect codes (D1, W1…) refer to the detailed reports.

| Feature | Status | Verified problem | Fix performed | Remaining blocker |
| --- | --- | --- | --- | --- |
| Password reset and "Change password" | FIXED | P1 (audit 1 D1). The default Supabase link worked only in the browser that asked for it. A reset requested in the iPhone app opens in Safari and always failed. Proven against the local auth server and mail catcher. | `e4bf019`: token-hash email templates to `/auth/confirm`; a failed reset goes to `/reset-password`. Tests: `tests/integration/auth-email-links.test.ts`, `tests/unit/auth-link-routes.test.ts`, `tests/unit/auth-email-templates.test.ts` | Apply the two templates in `supabase/templates/` to the hosted Supabase project |
| Sign-up, sign-in, sign-out | PASS | None in the app. A registered address is revealed by Supabase's own sign-up endpoint (audit 1 D5, P3, platform behaviour). | — | Optional captcha |
| Sign-in page messages | FIXED | P3 (D4): any text in `?error=` / `?notice=` was shown on the real sign-in page | `e4bf019`: fixed messages only (`src/lib/auth-messages.ts`) | — |
| Session persistence in the iPhone app | NOT TESTED | Code reviewed only | — | Kill and relaunch on an iPhone |
| Data isolation (RLS) and private storage | PASS | None. RLS is on all 73 tables. A sweep of all 61 member tables and 3 private buckets: another member, an admin or an anonymous visitor cannot read, change, delete or spoof anything. A negative control confirms the probes detect access. | Test: `tests/integration/cross-user-isolation.test.ts` | — |
| Data export and account deletion | PASS | None. Export is complete and own-data only. Deletion removes every row, every file and the sign-in. | Tests in the sweep above | Whether the JSON export downloads inside the iPhone app (device) |
| API routes and server actions | PASS | Every route and action authenticates; webhooks verify signatures | — | — |
| AI routes over a bearer token (native API) | FIXED | P2: paying members were refused with `403 not_entitled` | `1ded6eb` `planForAuth`. Test: `tests/unit/ai-routes-plan.test.ts` (fails on the old code) | — |
| AI coach uses the member's real data, memory, catalog, adaptive changes | PASS | None. Traced end to end. A mocked end-to-end run covered streaming, tools, approval-only changes and undo. Unknown exercises are refused. | — | Not run against the real Anthropic API (no key, and no paid API without your approval) |
| AI limits and cost | PARTIAL | Request limits are enforced in the database and over HTTP. There is no monthly token ceiling. A long plan generation can be retried silently past the route time limit (audit 2 D4, P3). A reply over 20,000 characters is cut when saved (D3, P3). | Test: `tests/integration/ai-route-limits.test.ts` | A spend limit on the Anthropic key. D3 needs a migration (patch and rollback in the report). |
| Prompt injection | PARTIAL | P3: the member's own text goes into the system prompt without a "data, not instructions" guard. It can only steer the member's own coach. | — | Optional hardening |
| Free / Pro limits, prices | PASS | None. Prices are unchanged ($19.99 / $149.99, legacy Plus $11.99). The database refuses Free writes to paid features. | — | — |
| Stripe web billing | PASS | None (tested against a local Stripe stand-in). The billing page showed the wrong subscription row (D5, P3). | `db1e02b`. Test: `tests/unit/plans.test.ts` "subscriptionToShow" | Not run in Stripe test mode (no keys) |
| RevenueCat / App Store purchases | BLOCKED | Logic passes against a stand-in. Sandbox purchases grant nothing unless `REVENUECAT_ALLOW_SANDBOX=true`, and App Review buys in the sandbox (D2, P1 configuration). A missed renewal webhook lapses to Free until Restore (D6, P3). | `c2b77a9`, `7b21003`: docs corrected | Your decision on the flag; App Store Connect products, RevenueCat project, device sandbox run |
| Admin › Subscriptions | FAILED | P3 (D7): App Store / Google Play subscribers are not listed | — | Small page change (not done) |
| Demo mode | PASS | Cannot grant paid benefits outside demo mode; purchases off in demo | — | — |
| Workout logger (sets, timers, records, resume) | FIXED | P2 (W1): a workout discarded offline came back. P3 (W2): a name of only spaces blocked every backup. P3 (W3): after a session ended, the member was told "you appear to be offline". | `04100aa`, `a47a3d1`, verified in the browser. Tests: `tests/unit/workout-timers.test.ts` and the logger tests in those commits | Rest-timer notification and sound on iPhone |
| Programs, scheduling, substitutions, catalog | PASS | None. 157 exercises, 51 library and 46 generated programs, no broken references | — | — |
| Training history totals | PARTIAL | P3 (W4): "30 days" uses a UTC day boundary | — | Patch in the report |
| Food search, units, serving sizes, recipes, meal plans | PASS | None | Tests `1644ee0`, `79ee096` | — |
| Food diary totals | FIXED | P2 (N1): a macro the source doesn't list was shown as a real 0. P3 (N2): a malformed `?date=` crashed the page. | `1644ee0`, `d3087bb` | — |
| Missing macros in USDA foods; Home protein card | PARTIAL | P3 (N3, N4): a missing USDA macro is stored as 0 with a "USDA" badge; Home doesn't say "at least" | — | Needs the USDA source data to rebuild (N3) |
| Barcode scanning | PARTIAL | None in code. Typed code → product → log works in the browser. | — | Native scanner, camera permission, denial path on iPhone |
| Progress photos, measurements, badges, ranks, challenges | PASS | None. Photos are private, EXIF stripped, deleted with the account. | — | Camera capture on iPhone |
| Faith section | PASS | None. One public-domain translation (BSB) with a recorded source and checksum. All 66 references the offline edition shows are quoted word for word. Open to Free members, no paywall. | — | — |
| GPS: a finished run that failed to save | FIXED | P1 (audit 4 D1): reopening the record page deleted the run from the device. Reproduced. | `689ea4a`: kept and offered as "Review and save" for 12 h. Tests in `tests/unit/gps-recorder.test.ts` | — |
| GPS: distance, pace, pause, map, isolation | PASS | None | — | Outdoor accuracy on a phone |
| GPS: watcher lifecycle, Android notification, Settings link | FIXED | P3 / P2 / P3 (D5, D4, D6) | `689ea4a`. Tests: `tests/unit/native-location.test.ts` | Android device |
| GPS: iOS location prompt | PARTIAL | P2 (R1): the location plugin asks for **Always**, and asks again after "While Using"; the docs and App Review expect While Using | — | Your decision (explain it in review notes, or patch the plugin); device test |
| GPS: locked-screen recording, battery | BLOCKED | Configured correctly. Not verifiable without a phone. | — | Physical iPhone outdoors |
| GPS messages and refusal | PARTIAL | P3 (R2, R3): an expired session says "couldn't reach the server"; after a refusal the clock keeps running | — | Patches in the report |
| Sleep import from Apple Health / Health Connect | FIXED | P2 (D3): read oldest-first, so the newest nights lost their measurements | `f135802`. Test: `tests/unit/native-sleep.test.ts` | Device test with a real watch |
| "Enter sleep by hand" | FIXED | P3 (D7): React hydration error #418 when the phone's zone differs from the server's | `c4a0d00`. Test: `tests/unit/sleep-session-form.test.tsx` | — |
| Sleep scores, debt, readiness, steps | PASS | None | — | — |
| Background health sync | NOT TESTED | Not built (sync happens when the app opens) | — | A native observer and a device |
| iPhone app offline page | FIXED | P2 (D2): "Try again" reloaded the offline page itself | `d385425`. Test: `tests/unit/native-shell.test.ts` | Device |
| `npx cap run ios` | FIXED | P3 (D8): wrong scheme name | `d385425` | — |
| iOS project (Info.plist, entitlements, icons, bundle id) | PASS | None. Every permission has its usage text; HealthKit entitlement present. | — | Register the App ID with HealthKit |
| iOS privacy manifest | PARTIAL | Doesn't declare Sensitive Info, although the faith journal can reveal religious beliefs | — | Your and counsel's decision |
| Privacy Policy reachable in the app | FIXED | P2 (audit 1 D2): no in-app link for signed-in members (App Store 5.1.1(i)) | `4a7473c`. Test: `tests/unit/profile-legal-links.test.tsx` | — |
| Privacy Policy and Terms content | BLOCKED | Placeholders marked "requires legal review" | — | Final documents from counsel; `LEGAL_PRIVACY_URL`, `LEGAL_TERMS_URL` |
| Auth emails in production | BLOCKED | Supabase's built-in sender is for testing only | `e4bf019` (setup note) | Custom SMTP on the hosted project |
| Auth rate limits | NOT TESTED | P2 risk: sign-in runs on the server, so Supabase's per-IP limit may be one bucket shared by all members (a login lockout) | — | Check on the hosted project |
| Secrets in the repository | PASS | None, in the working tree or the history of any branch | — | — |
| Performance | PARTIAL | P3 (R4, R5): charts in first-load JS (`/progress/overview` 412 KB gzip); two auth round trips per request. Local response times 62–479 ms. | — | Lazy-load charts; measure on the hosted stack |
| Layout, crashes, offline, expired session (30 routes at iPhone 15 size, 22 more screens at 412 px) | PASS | None after the hydration fix | — | — |
| Universal links | NOT TESTED | Not configured. Email links open in Safari, not the app (R6, P3). | — | Optional |

## Apple App Store launch-blocker checklist

Each item must be done before submission. ☐ means not done; none can be done from here without your accounts or
approval.

**Accounts and hosting**

- ☐ Paid Apple Developer Program membership; App ID `com.narrowgatefitness.app` with the HealthKit capability (and
  In-App Purchase); App Store Connect app record; an App Store Connect API key (Admin) saved as the four repository
  secrets the TestFlight workflow reads.
- ☐ A deployed HTTPS site for the app to load (`CAP_SERVER_URL`): a hosted Supabase project with all migrations, a
  host, the environment variables of `docs/TESTFLIGHT.md` §1. **Needs your approval to deploy.**

**Hosted Supabase settings**

- ☐ Apply `supabase/templates/confirmation.html` and `recovery.html` (otherwise password reset from the iPhone app
  still fails).
- ☐ Custom SMTP, so testers' confirmation and reset emails arrive.
- ☐ Site URL (the https address) and redirect allow-list; password policy (8+, letters and digits); secure password
  change; leaked-password protection; consider captcha.

**Legal and privacy**

- ☐ Final Privacy Policy and Terms from counsel; set `LEGAL_PRIVACY_URL` and `LEGAL_TERMS_URL`.
- ☐ App Store Connect privacy answers that match `ios/App/App/PrivacyInfo.xcprivacy`, including the Sensitive Info
  (religious beliefs) decision.

**Purchases**

- ☐ Subscription group in App Store Connect: `ngf_pro_monthly` $19.99 and `ngf_pro_yearly` $149.99 (your approved
  prices, unchanged).
- ☐ RevenueCat project, entitlement `pro`, offering, webhook with its `Authorization` value, `REVENUECAT_*` variables.
- ☐ Decide `REVENUECAT_ALLOW_SANDBOX` (below). With it off, Apple's reviewer cannot unlock Pro.
- ☐ Run the sandbox purchase plan on a device (`docs/MOBILE_BILLING.md`): buy, switch, cancel, restore, refund.

**Permissions and review**

- ☐ Decide Always vs While Using location (R1) and write the review note to match.
- ☐ Review notes and a demo account that show the native features (`docs/launch-audit/APPLE_COMPLIANCE.md` #9).
- ☐ iPhone and iPad screenshots (the app supports iPad).

**Physical iPhone tests** (none done)

- ☐ Sign in, kill and relaunch (session kept); password reset through Mail and Safari.
- ☐ GPS run with the screen locked; the location prompts; recovering an unsaved run; battery.
- ☐ Apple Health permission sheet, sleep and steps import, re-sync.
- ☐ Barcode scanner: camera prompt, denial, cancel, a UPC-A product.
- ☐ Rest-timer notification and sound; progress photo from the camera.
- ☐ Offline start, then "Try again"; discarding a workout in airplane mode.
- ☐ Data export download; account deletion.

**Cost safety**

- ☐ A monthly spend limit on the production Anthropic key (no token ceiling in code).

## Your decisions

1. **`REVENUECAT_ALLOW_SANDBOX`** on the deployed server. Off: no sandbox purchase unlocks Pro, so neither TestFlight
   testers nor Apple's reviewer can. On: every TestFlight tester gets Pro free. A third option, not built: accept
   sandbox purchases only for an allow-list of tester and reviewer accounts.
2. **Location permission:** keep "Always" (explain in review notes that it continues a run started before the phone was
   locked) or patch the plugin to stay at "While Using" (background recording still works with the background mode).
3. **Sensitive Info** in the privacy manifest and App Store answers for faith journal content (with counsel).
4. **Hosting and deployment** of the HTTPS site, and when.
5. **The 2D athlete look:** approve it for the library (`ATHLETE_LOOK_FOR_ALL`), keep it on the five preview exercises,
   or withdraw it. The classic figure stays the fallback until you decide.

## Roadmap: install, beta, submission

Detailed steps are in `docs/audit/4-gps-health-ios-performance.md` §5 and `docs/TESTFLIGHT.md`.

1. **Deploy** (after your approval): hosted Supabase project with the migrations and the settings above, the site on
   an HTTPS host, environment variables, `/api/health` answering.
2. **Build and install on your own iPhone** (a Mac with Xcode): `npm ci`, `CAP_SERVER_URL=https://… npx cap sync ios`,
   open `ios/App/App.xcworkspace`, select your team, run on the phone.
3. **Device test** with the physical-iPhone list above; fix what it finds.
4. **TestFlight internal**: add the four secrets, run the `testflight` job (it checks the site and the synced address,
   archives with automatic signing and uploads only when ticked), install from TestFlight.
5. **Beta testers**: an external TestFlight group (needs Beta App Review), with decision 1 made first.
6. **Submission**: store products, RevenueCat, final legal URLs, privacy answers, screenshots, review notes and demo
   account, then submit. **Only with your approval.**

## Not verified, and what it would take

- Anything on a physical iPhone or Android phone (list above).
- The real Anthropic API, Stripe test mode and RevenueCat sandbox: their keys and accounts (no paid service was used).
- Hosted Supabase settings, hosted performance, the route time limits on the real host: a deployment.
- Background health sync: not built.
