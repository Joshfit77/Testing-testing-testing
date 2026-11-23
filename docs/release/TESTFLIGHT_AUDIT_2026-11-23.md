# Engineering and TestFlight readiness audit (2026-11-23)

Release candidate: `claude/rc-testflight-1` at 251d68b4. Fixes from this audit: branch
`claude/testflight-audit-fixes` (on top of 251d68b4, not merged). Nothing was deployed, uploaded, purchased or
merged, and no live credential was changed.

This report is an engineering review, not a guarantee. No software can be shown to be free of vulnerabilities; the
conclusions below are limited to what was tested and inspected, and each names its evidence.

## 1. Engineering assessment

### Complete and verified by automated tests

- Sign-up (18+), sign-in, email confirmation, password reset, onboarding, sessions (30-day maximum), admin
  two-step sign-in with a tested recovery procedure.
- Workout logging with device copies, account backups with revisions, combining two copies of one workout, several
  unfinished workouts, offline logging, sign-out protection, finish retries.
- Nutrition diary, barcode look-up (Open Food Facts), recipes and meal prep, food quality notes.
- GPS runs and walks (simulated positions), route privacy, Apple Health data handling (simulated), sleep.
- Bible reader, journal, faith calendar; journal unreadable by administrators.
- AI coach with consent, per-member and app-wide daily/monthly spending limits, kill switch (tested with a local
  stand-in for the AI service; live AI is off for this build).
- Free and Pro enforcement on the server and in the database; billing webhooks (Stripe and RevenueCat), refunds,
  disputes, grace periods (simulated events only; payments are off).
- Data export and account deletion.
- Database: row-level security on every table, verified by a catalog test that covers all tables.

### Incomplete (needs the owner or a real device)

- Nothing native has been tried on a physical iPhone: **NOT VERIFIED — REAL IPHONE REQUIRED** for HealthKit, GPS
  while locked, camera barcode scanning, notifications, haptics, VoiceOver, performance, and the opening animation on
  device. The iOS Simulator test on GitHub (compile, unsigned archive, a filmed launch) does not prove device
  behaviour.
- Legal pages are drafts with 10 placeholders (`docs/legal/LEGAL_REVIEW_CHECKLIST_2026-11-23.md`).
- Payments: code complete and tested with simulated events; nothing configured in Stripe, App Store Connect or
  RevenueCat; no sandbox purchase made.
- Bot check (Cloudflare Turnstile): code ready; not active until the owner adds the keys.
- Staging environment, email provider and production host: not created or chosen.
- Backups: no restore has been tested; the Supabase free plan's own backups can't be relied on.

### Broken (found and fixed in this audit)

| Defect | Root cause | Fix | Regression test | Remaining risk |
|---|---|---|---|---|
| A sixth unfinished workout was never offered to resume (data still on the account, but invisible) | `getServerDrafts` read at most 5 | Read up to 25 (`SERVER_DRAFTS_SHOWN`) | `workout-revisions.test.ts` "six or more unfinished workouts…" (fails with 5) | More than 25 unfinished workouts at once would hide the oldest; not a realistic case |
| The same set completed on two devices with different weights or reps was resolved silently (the newer copy's numbers kept, the member not told) | The merge counted only sets added, not sets that differed | Both merges (live and second Finish) now report each differing set; the logger shows "Back Squat set 1: kept 105 kg, 3 reps, your other device had 100 kg, 5 reps" | `workout-merge.test.ts`, `workout-two-devices.test.tsx`, `workout-revisions.test.ts` | One copy's numbers are still chosen automatically; the member is told and corrects it. No data is dropped silently |
| A re-run of the TestFlight workflow reused its build number, which App Store Connect refuses | `CURRENT_PROJECT_VERSION` was the run number only | Build number is run number and attempt (57.1, 57.2, 58.1); the unsigned check archive uses the same form, so CI checks it | `check-archive.py` on every iOS checks run | Needs one real upload to confirm |
| The security policy allowed Google Fonts, which the app never uses | Leftover from an earlier font setup | Removed | `security-headers.test.ts` (fails on the old policy) | — |

## 2. Security findings by severity (open items)

| Severity | Item | Evidence | Who | Before |
|---|---|---|---|---|
| High (IP, confidentiality) | F-1: the repository is **public** (code, legal audits, counsel questions, patent notes) | GitHub reports `visibility: public` (checked today) | Owner decision (`docs/security/MAKE_REPOSITORY_PRIVATE.md`) | Before sharing the app widely |
| Medium | F-7: no bot check until Turnstile keys are set; Supabase's own sign-in limits still apply | `captcha-field.tsx`, `security-headers.ts:53`; F-7 tests | Owner: Turnstile site key in Vercel, secret in Supabase Auth | External beta |
| Low | F-13: email codes 6 digits, 1 hour (hosted Supabase setting) | Supabase config | Owner (guide step 11) | External beta |
| Low | F-21: Stripe billing portal must be limited to approved prices | `PAYMENTS_BEFORE_LAUNCH.md` | Owner, Stripe dashboard | Paid launch |
| Low | F-23: `REVENUECAT_ALLOW_SANDBOX` must be unset in production off Vercel | `store-billing.test.ts` | Owner | Paid launch |
| Low | F-15: client address from forwarded-for header (only a concern off Vercel) | review note | — | If hosting moves |
| Info | F-24: RevenueCat restore behaviour must be "Transfer" | `PAYMENTS_BEFORE_LAUNCH.md` | Owner | Paid launch |
| Info | F-25: member ids in some log fields outlive deletion | review note | Developer | Public launch |
| Info | F-16: images allowed from any https host; inline styles allowed | `security-headers.ts` | Developer | Optional |

Checked again today, nothing found:
- **Secrets:** no secret is in the tracked files. The only token-shaped strings are Supabase's public
  local-development keys, used by the tests.
- **Dependencies:** `npm audit` reports 0 vulnerabilities, in production and in all dependencies. Next.js 15.5.29 is
  the current release of its maintained 15 line.
- **GitHub Actions:**
  - every workflow defaults to read-only permissions;
  - every third-party action is pinned to an exact commit;
  - no workflow uses `pull_request_target`;
  - no workflow puts pull-request or issue text into a shell command;
  - the TestFlight key is written with `umask 077` and only to the steps that need it.

Covered by tests in earlier rounds and re-run today (section 3):
- row-level security on every table, and isolation between accounts;
- admin access requires a second sign-in step;
- password changes require a reset link;
- an email link can't swap a signed-in session for another account;
- account-existence probing (enumeration) is blocked;
- rate limits on the email-link routes;
- webhook signatures, replay and ordering;
- entitlements can't be changed by members;
- AI consent, spending limits, and member text treated as data in prompts (prompt injection);
- private photo storage;
- the journal can't be read by administrators;
- the deletion and export paths.

**Not done:**
- no external penetration test;
- no test against the hosted staging project, which doesn't exist yet.

Standards used as checklists:
- OWASP ASVS (authentication, sessions, access control);
- OWASP MASVS (storage, network, platform);
- OWASP API Top 10 (object-level authorisation, rate limits, mass assignment).

The audit does not claim full compliance with any of them.

## 3. Test results (this audit, commit 8b9ddf75; later commits are documents only)

Run locally on a fresh install and a freshly reset database:

| Check | Result |
|---|---|
| Clean install (`npm ci`) | passed |
| `npm audit` (production, and all dependencies) | 0 vulnerabilities |
| Database rebuilt from all 75 migrations (`supabase db reset`) | passed |
| Type check (`tsc --noEmit`) | 0 errors |
| Lint (`eslint src tests e2e scripts/ops`) | 0 errors |
| Unit tests | 280 files, **4,871 passed**, 1 skipped (home background photos, switched off in this release) |
| Integration tests (real local database and auth server) | 95 files, **590 passed**, 1 skipped (opt-in live Open Food Facts test) |
| Production build | passed. The React patch was verified as applied |
| Browser tests (Playwright, phone size, on the production build) | **163 passed, 0 failed**, 101 skipped (opt-in suites; the next two rows run two of them) |
| Tap every safe control | passed: 49 screens, 282 controls, 0 problems |
| Every signed-in screen at 39 phone sizes (18 iPhone, 21 Android), in Chromium | **39 passed**, 0 failed. The WebKit version is the iOS workflow's manual `webkit-matrix` job |

Earlier GitHub runs on the release candidate (251d68b4):
- CI 44837084884: green;
- iOS checks 44837081435: green (compile, unsigned Release archive and archive check, Simulator launch test, WebKit).

On this branch (7bc569ee), on GitHub:
- CI 45198363436: **green** (typecheck, lint, unit, build, integration, dependency audit).
- iOS checks 45198370348: **green**:
  - compile;
  - unsigned Release archive with build number `101.1`, which `check-archive.py` accepted ("build number is
    numeric (101.1)");
  - Simulator launch test;
  - WebKit opening and navigation tests.
- The signed TestFlight job was skipped by design: it runs only when dispatched with `job = testflight` and needs
  the owner's Apple secrets.

### The 12 journeys

| # | Journey | Automated evidence (run today) | On a real iPhone |
|---|---|---|---|
| 1 | Registration, login, onboarding, recovery | e2e `core-flow`, `onboarding-plan`, `new-member-states`, `admin-mfa`; integration `auth-email-links`, `admin-mfa`; unit `auth-no-enumeration`, `auth-link-routes` | NOT VERIFIED — REAL IPHONE REQUIRED (email links opened on the phone) |
| 2 | Workouts | e2e `workout-reliability`, `workout-data-preservation`, `fast-logging`, `sign-out-workout`; integration `workout-revisions`; unit `workout-merge`, `workout-two-devices` | NOT VERIFIED — REAL IPHONE REQUIRED (lock, force-close, Airplane Mode) |
| 3 | Exercise demos | e2e `exercise-demo`, `exercise-demo-2d`, `premium-2d-demos` | NOT VERIFIED — REAL IPHONE REQUIRED (smoothness on device) |
| 4 | Nutrition, barcode, recipes | e2e `nutrition-diary`, `food-quality`, `label-check`, `recipes-planner`, `meal-prep`; integration `barcode-media`, `food-*` | NOT VERIFIED — REAL IPHONE REQUIRED (camera scanning) |
| 5 | GPS | e2e `gps-run`, `run` (simulated positions); integration `gps-running` | NOT VERIFIED — REAL IPHONE REQUIRED (recording while locked, accuracy) |
| 6 | Apple Health | integration `health-ai-sharing`, `sleep-imports`; unit `health-route` (simulated data) | NOT VERIFIED — REAL IPHONE REQUIRED (permission and reading HealthKit) |
| 7 | Bible, journal, faith | e2e `bible-reader`, `faith-journey`, `faith-calendar`, `ux-faith`; integration `faith-*`, `rls` (journal hidden from admins) | Web content; check on device with the rest |
| 8 | AI coaching, consent, limits | e2e `coach`, `ai-usage` (local stand-in for the AI service); integration `ai-route-limits` | Off for this build |
| 9 | Free versus Pro | e2e `pro-programs`, `memberships`; integration `plan-enforcement`, `pro-bypass` | Check with test accounts |
| 10 | Subscriptions | e2e `store-billing` (simulated); integration `store-billing`, `billing-integrity` | Off for this build; sandbox purchase NOT VERIFIED — REAL IPHONE REQUIRED |
| 11 | Notifications, accessibility, performance | e2e `notifications`, `button-sweep` (taps every safe control), `device-matrix` (every iPhone size, WebKit); unit `native-notifications`. Browser tests find controls by accessible role and name (about 1,300 places), so unnamed buttons fail; **no automated accessibility scanner** (contrast, focus order) is run: a gap | NOT VERIFIED — REAL IPHONE REQUIRED (delivery when closed, VoiceOver, Larger Text, speed) |
| 12 | Export and deletion | e2e `account-deletion`; integration `account-deletion-closure`; unit `export-route` | Check with a throwaway account |

## 4. Changes

Branch `claude/testflight-audit-fixes`:

| Commit | What |
|---|---|
| b399cb79 | Workouts: every unfinished workout offered; sets logged differently on two devices reported |
| 8b9ddf75 | Unique build number per re-run; older TestFlight guides marked superseded; no Google Fonts in the CSP; legal review checklist |
| 83234282 | `docs/operations/RELEASE_ROLLBACK_AND_INCIDENTS.md` |
| 5ce49c09 | Real-iPhone acceptance list extended to 18 checks |
| (this file) | This report |

Files:
- `src/server/services/workouts.ts`
- `src/lib/domain/workout-merge.ts`
- `src/server/actions/workouts.ts`
- `src/components/workout/workout-logger.tsx`
- `src/lib/security-headers.ts`
- `.github/workflows/ios.yml`
- tests: `workout-merge`, `workout-two-devices`, `workout-revisions`, `security-headers`
- docs: listed above

No database migration was added, and no legal text was changed.

## 5. TestFlight (private, internal testers): GO, once the owner steps are done

The build is ready from an engineering standpoint. All of the following must hold:
- payments off;
- AI off;
- a separate staging Supabase project and Vercel site holding test accounts only;
- internal testers only.

The owner must complete section 7 first; nothing can be uploaded without the Apple account and the four GitHub
secrets.

## 6. Public paid launch: NO-GO

Blocking:
1. **Legal:** both pages are drafts with placeholders, and counsel hasn't reviewed them.
2. **Real devices:** no physical-iPhone results yet (`TESTFLIGHT_FIRST_BUILD_GUIDE.md`, 18 checks).
3. **Payments:** none configured or tested in sandbox (purchase, restore, refund, renewal failure).
4. **Repository visibility:** still public (F-1).
5. **Backups:** no tested restore, and a backup plan is needed for photos.
6. **Bot check:** Turnstile not active.
7. **Email:** no production email provider.
8. **App Store listing:**
   - App Privacy answers matching the privacy manifest;
   - screenshots;
   - **iPad**: the app is set to run on iPad (`TARGETED_DEVICE_FAMILY = "1,2"`), so App Review will use it there.
     Either test it on an iPad and supply iPad screenshots, or make the app iPhone-only before submitting (owner
     decision).
9. **External penetration test** recommended before taking payments.

## 7. Owner checklist (plain steps)

**For the first TestFlight build** (details: `docs/TESTFLIGHT_FIRST_BUILD_GUIDE.md`):
1. **Apple Developer Program** ($99 a year): enrol, then create the app in App Store Connect with bundle ID
   `com.narrowgatefitness.app`.
2. **App Store Connect API key** (Admin role): download the `.p8` file **once** and keep it private.
3. **Supabase:**
   - make a new **staging** project;
   - run `supabase/setup-all.sql` in it;
   - turn on TOTP multi-factor;
   - set email codes to 30 minutes.
4. **Vercel:**
   - make a staging site from `claude/rc-testflight-1`, with the variables listed in the guide;
   - **no** Stripe, RevenueCat or Anthropic keys.
5. **GitHub repository secrets:** add `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID` and `ASC_KEY_P8`. Enter them
   only in GitHub's settings page; never paste them into a chat.
6. **Run the workflow:** Actions → iOS → Run workflow, then choose:
   - branch `claude/rc-testflight-1`;
   - job `testflight`;
   - your staging address;
   - upload ticked.
7. **Install and test:** add yourself and John as internal testers, install from TestFlight, and record the 18
   checks.
8. **Admin authenticator:** set it up the first time you open Admin, and add the key to a second device.

**Decisions to make:**
1. Approve fast-forwarding `claude/rc-testflight-1` to this audit branch.
2. Make the repository private, and accept the Vercel Pro cost that comes with it.
3. iPhone-only or iPhone and iPad.
4. Turnstile keys.
5. Email provider.
6. Send the legal checklist to counsel.

## 8. Developer handoff

**Architecture:**
- Next.js 15.5 (App Router, server actions) on Vercel.
- Supabase: Postgres with row-level security on every table, Auth with TOTP, and Storage.
- The Capacitor 8 iOS shell loads the deployed site (`CAP_SERVER_URL`); there are 10 native plugins
  (`ios/App/CapApp-SPM/Package.swift`).
- Billing: Stripe on the web, RevenueCat for in-app purchases. Entitlements are decided only on the server.

**Run locally:**
1. `npm ci`
2. `npx supabase start`
3. `npx supabase db reset`
4. `.env.local` from `.env.example`
5. `npm run dev`

**Checks:**
- `npx tsc --noEmit`
- `npx eslint src tests e2e scripts/ops`
- `npx vitest run --project unit`
- `npx vitest run --project integration` (needs the local stack)
- `npm run build`
- `npx playwright test --project mobile` (against a running build)

**CI:**
- `ci.yml`: typecheck, lint, unit tests, build, integration tests and a production dependency audit, on pushes to
  `main` and `release/**`, on pull requests, and on demand.
- `ios.yml` checks: compile, unsigned archive and archive check, a Simulator XCUITest, and WebKit browser tests.
- `ios.yml` `testflight` job: manual only.
- The full Playwright suite is **not** in CI. Run it before each release, or add it as a job (costs Linux minutes).

**Things to know:**
- **React patch:** `scripts/react-hydration-replay-fix.mjs` patches Next 15's bundled React 19.2 canary to apply
  React 19.3's upstream fix for hydration error #418. It runs on install and before build, and the build verifies
  it was applied (`docs/HYDRATION_418.md`). It goes away only with a Next 16 upgrade, which is a separate decision
  (`docs/NEXT16_UPGRADE_EVALUATION.md`).
- **Migrations** are forward-only; take a dump first (`docs/operations/RELEASE_ROLLBACK_AND_INCIDENTS.md`).
- **Legal page versions:** after any change to the legal pages, update their hash in `src/lib/legal/versions.ts`.
- **Workout sync:** see `src/lib/domain/workout-merge.ts` (combining copies) and `src/server/services/workouts.ts`
  (revisions, `draft_rev`).
- **Security register:** `docs/security/ASSESSMENT_2026-11-20.md`.
- **Actions on Node 20:** GitHub warns that the pinned `actions/checkout` and `actions/setup-node` (v4.4.0)
  target Node 20, which is deprecated; they currently run on Node 24. Update them to current releases, pinned by
  commit, as routine maintenance.

## 9. Costs that need your approval

These are typical figures; check each provider's current pricing page before you approve.

| Item | When | Typical cost |
|---|---|---|
| Apple Developer Program | TestFlight | $99 a year |
| Vercel Pro | If the repository goes private (Hobby blocks collaborators' commits), and for commercial use at launch | about $20 per member a month |
| Supabase Pro | Before paying members (daily backups) | about $25 a month; point-in-time recovery is an extra add-on |
| GitHub Actions | If private: macOS minutes count ×10 against 2,000 free minutes (about five iOS checks runs) | Pay-as-you-go beyond the allowance |
| Email provider | Before external testers or launch | Free tiers exist; low monthly cost at small volume |
| Anthropic API | When AI is turned on | Capped by the app's budget settings (default $100 a month app-wide) |
| Legal review | Before launch | Quote from counsel |
| External penetration test | Before payments | Varies widely by scope; get quotes |
| Cloudflare Turnstile | Any time | Free |
| Store and payment fees | At launch | Apple commission; Stripe and RevenueCat fees per their pricing |
