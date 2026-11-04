# Narrow Gate Fitness on real iPhones through TestFlight (internal testing): owner runbook

**Status: ready to follow; nothing in it has been done yet.** Written 2026-11-04 from the release candidate branch
`release/rc-2026-11-04`; every value names the file it comes from, and anything the repository doesn't contain is
marked **NOT IN REPO — owner decides**. Where an older document disagrees, follow this runbook; the differences are
listed in §10 (the ones already corrected are marked). No secret values appear here, and none exist in the repository.

**Who does each step**

- **Owner**: you, the account holder. Only you can pay, sign agreements or approve.
- **Owner or helper**: you, or someone you give access to.
- **Workflow**: the GitHub Actions job does it automatically.

**Security rule.** Keys, passwords and `.p8` files go **only** into the dashboard that issued them, the hosting
provider's environment variables, or GitHub repository secrets. Never put them in chat, issues, commits or files.
GitHub reports this repository as **public** (checked 2026-11-04), so anything committed can be read by anyone.

---

## 0. Key facts at a glance

| Fact | Exact value | Source |
|---|---|---|
| Bundle ID | `com.narrowgatefitness.app` | `ios/App/App.xcodeproj/project.pbxproj` (`PRODUCT_BUNDLE_IDENTIFIER`, Debug and Release); `capacitor.config.ts` `appId`; `ios.yml` input `bundle_id` default |
| App name | `Narrow Gate Fitness` | `Info.plist` `CFBundleDisplayName`; `capacitor.config.ts` `appName` |
| Version shown in TestFlight | `1.0.0` | `project.pbxproj` `MARKETING_VERSION = 1.0.0`; `ios.yml` input `marketing_version` default |
| Build number | the workflow's run number (`CURRENT_PROJECT_VERSION="${{ github.run_number }}"`). Every run has a higher number than the last, so each upload gets a new build number. | `ios.yml` job `testflight`; GitHub run list |
| Minimum iOS | 16.0 | `project.pbxproj` `IPHONEOS_DEPLOYMENT_TARGET = 16.0` |
| Devices | iPhone and iPad (`TARGETED_DEVICE_FAMILY = "1,2"`), arm64 only | `project.pbxproj`; `Info.plist` `UIRequiredDeviceCapabilities` |
| Signing | Automatic (`CODE_SIGN_STYLE = Automatic`). No team is in the project (`DEVELOPMENT_TEAM` is passed in by the workflow). | `project.pbxproj`; `ios.yml` |
| Entitlements | HealthKit only (`com.apple.developer.healthkit`) | `ios/App/App/App.entitlements` |
| Export compliance | `ITSAppUsesNonExemptEncryption` = `false` | `ios/App/App/Info.plist` |
| What the app loads | the `server_url` you give the workflow, which becomes `server.url`. Navigation is limited to that host (`allowNavigation: [host]`). | `capacitor.config.ts`; `ios.yml` |
| Workflow and job | Actions → **iOS** → job input `testflight` (job name "TestFlight build (online app, signed; uploaded only if asked)") | `.github/workflows/ios.yml` |
| GitHub secrets | `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64` | `ios.yml` step "Check secrets" |
| Store product IDs | `ngf_pro_monthly` ($19.99/month), `ngf_pro_yearly` ($149.99/year) | `src/server/services/store-billing.ts` `storeProductIds()`; `.env.example`; `docs/TESTFLIGHT_SETUP_GUIDE.md` §5 |
| Approved prices in code | `APPROVED_PRO_PRICE_CENTS = { month: 1999, year: 14999 }` | `src/lib/domain/plans.ts` |
| RevenueCat entitlement | `pro` (default of `REVENUECAT_ENTITLEMENT_PRO`) | `src/server/env.ts` |
| RevenueCat webhook | `POST https://<staging-domain>/api/revenuecat/webhook`. The `Authorization` header must equal `REVENUECAT_WEBHOOK_AUTH` exactly. | `src/app/api/revenuecat/webhook/route.ts`; `src/server/services/store-billing.ts` `webhookAuthorized` |
| Health check | `https://<staging-domain>/api/health`, which answers `{"data":{"app":"narrow-gate-fitness","commit":"<sha>"}}` | `src/app/api/health/route.ts` |
| Database | 53 migration files, last `20261103000056_activation_report_exclusions.sql`, plus `supabase/seed.sql` (catalog) | `supabase/migrations/` |
| Storage buckets (created by migrations) | `avatars` (private), `exercise-media` (public), `progress-photos` (private), `body-scans` (private) | `…000003_storage.sql`, `…000002_progress_photos.sql`, `…000031_body_scans.sql` |

**One address, five places.** Choose the staging address once (for example `https://<staging-domain>`) and use the
**same** value everywhere:

1. the workflow input `server_url`;
2. `NEXT_PUBLIC_SITE_URL` on the host;
3. the Supabase Site URL;
4. the base of the RevenueCat webhook URL;
5. (later, only if approved) `BILLING_RECONCILE_URL`.

It must be the final address with no redirect to another host: the app only allows navigation within the
`server_url` host (`capacitor.config.ts` `allowNavigation`).

---

## 1. Prerequisites and accounts

**1.1 Apple Developer Program.** *Who: Owner.*

1. If the app will be sold as the LLC, get a **D-U-N-S Number** for it (free). Enroll at
   developer.apple.com/programs/enroll as an **Organization** (`docs/TESTFLIGHT_SETUP_GUIDE.md` §1). Enrolling as an
   individual is possible (`docs/TESTFLIGHT.md` §2); that choice is **NOT IN REPO — owner decides**.
2. Pay the annual fee: "$99/year" according to `docs/INSTALL.md`. Confirm the current amount on Apple's site.
3. Wait for verification, which "can take several days" (setup guide §1).
4. **Check:** developer.apple.com → Account → Membership details shows your **Team ID** (10 characters). You'll need
   it in §6.

**1.2 Do you need a Mac? No, not for the GitHub route.** *Who: nobody (checked in `ios.yml`).*

- The `testflight` job runs on GitHub's own Mac (`runs-on: macos-latest`). It archives, signs with your App Store
  Connect API key (`-allowProvisioningUpdates -authenticationKeyPath …`) and uploads with
  `xcodebuild -exportArchive`. Nothing runs on your computer.
- You only need a Mac for the alternative Xcode route (`docs/TESTFLIGHT.md` §3b) or to install builds straight from
  Xcode. That route needs Xcode 26 or later with the iOS 26 SDK (`ios.yml` minimum). `SETUP.md` still says
  "Xcode 16+", which is out of date.
- Turning the `.p8` key into base64 works on any computer (§4.4).

**1.3 Accounts to create (all yours).** *Who: Owner.*

| Account | Used for | Required for internal TestFlight? |
|---|---|---|
| Apple Developer / App Store Connect | App ID, app record, subscriptions, TestFlight | Yes |
| GitHub, with admin rights on `Joshfit77/Testing-testing-testing` | Secrets and running the workflow | Yes |
| Supabase | **Separate** staging project | Yes |
| Hosting: Vercel is what the repo assumes ("Vercel or any Node host", `docs/STAGING_ENVIRONMENT.md` §2) | HTTPS staging deployment | Yes |
| Email (SMTP) provider | Confirmation and reset emails reaching testers. Provider: **NOT IN REPO — owner decides**. | Strongly recommended (STAGING §1.4) |
| RevenueCat | App Store purchases → server | Yes, to test purchases |
| Stripe (test mode only) | Web checkout smoke test | Optional (the iPhone app never uses Stripe) |
| Anthropic | AI coach | Optional. Blank turns the coach off (STAGING §2). |

**1.4 Phones.** *Who: Owner.*

- iPhones on iOS 16 or later.
- The checklist asks for "at least one small (iPhone SE / 13 mini) and one large (Pro Max), on the current iOS and
  one version older" (`docs/TESTFLIGHT_INTERNAL_CHECKLIST.md`).

**1.5 Costs that are the owner's** (amounts are not in the repo unless quoted).

- Apple Developer Program: annual fee ("$99/year", `docs/INSTALL.md`).
- Supabase and Vercel plans: **NOT IN REPO — owner decides** the plan.
- SMTP provider and a domain, if you use one: **NOT IN REPO**.
- RevenueCat: "free up to $2,500 a month in tracked revenue, then 1%" (`docs/MOBILE_BILLING.md`; check before
  launch).
- Anthropic API usage, only if you add a key: "A paid key costs money, so only add one if you decide to"
  (STAGING §2).
- GitHub Actions macOS minutes. The repository is public, and GitHub normally doesn't bill hosted-runner minutes
  for public repositories. If you make it private, macOS minutes count against your plan. Confirm with GitHub's
  billing page.

---

## 2. Staging environment (separate from any future production)

The TestFlight build is a shell around this deployment: "A TestFlight build is only as complete as the site it
loads" (`docs/TESTFLIGHT.md`). Deploy **`release/rc-2026-11-04`**: `docs/RELEASE_CANDIDATE.md`, "TestFlight
verification checklist", step 1.

### 2A. Supabase staging project

**2.1 Create the project.** *Who: Owner.*

1. supabase.com → New project, for example `narrowgate-staging` (STAGING §1.1). The region and plan are **NOT IN
   REPO — owner decides**.
2. Save the database password in your password manager.
3. **Check:** the project dashboard opens and shows a project ref (the `<staging-ref>` in `https://<staging-ref>.supabase.co`).

**2.2 Tools on your computer.** *Who: Owner or helper.*

1. Node 22: CI uses `node-version: 22`; `package.json` has no `engines` field.
2. Clone the repository and check out `release/rc-2026-11-04`.
3. Run `npm ci`.
4. Install the PostgreSQL client `psql`, which is needed for the seed step.
5. Run `npx supabase login`.
6. **Check:** `npx supabase --version` prints a 2.x version (`package.json` devDependency `supabase` `^2.121.0`).

**2.3 Apply the schema, using the method this repo supports for a hosted project.** *Who: Owner or helper.*

Method A (recommended; from `docs/STAGING_ENVIRONMENT.md` §1.2 and `SETUP.md` §4):
```bash
npx supabase link --project-ref <staging-ref>
npx supabase db push                               # applies supabase/migrations in name order
psql "$STAGING_DB_URL" -f supabase/seed.sql        # exercise/program/food catalog only; idempotent; no member data
```
- `STAGING_DB_URL` is the project's connection string with the database password. `demo-preview.yml` uses the
  "Session pooler connection string" for the same purpose.
- Keep the connection string in your shell only, never in a file.
- Rollback: migrations are forward-only (STAGING §1). On an empty staging project, the recovery is a fresh project.

Method B (alternative; only once, on a brand-new empty project):
1. Open Supabase → SQL Editor → New query.
2. Paste the whole of `supabase/setup-all.sql` and click Run. The file's header says "Run it only once on a new
   project"; it is built by `scripts/bundle-sql.sh` / `npm run db:bundle`.
3. Know the limits of this method:
   - On the release candidate (checked 2026-11-04) the file is byte-identical to the 53 migrations plus `seed.sql`.
   - It is about 3.4 MB.
   - It doesn't record migration history, so a later `supabase db push` wouldn't know what's applied.
   - It has not been run on a hosted project.
   - Use Method A unless you have no way to run the CLI.

**Check (either method):**
- `npx supabase migration list` shows all 53 local migrations as applied remotely, the last being
  **`20261103000056`** (Method A only). `docs/STAGING_ENVIRONMENT.md` still says "45 … `20261102000048`", which is
  out of date.
- Storage shows the four buckets from §0, with `exercise-media` public and the others private (STAGING §1.6).
- SQL Editor: `select count(*) from public.exercises;` returns **157**, and
  `select count(*) from public.training_programs;` returns **51** (row counts in `supabase/seed.sql`).

**2.4 Auth → URL Configuration.** *Who: Owner.*

1. Set **Site URL** to `https://<staging-domain>`.
2. Under **Redirect URLs**, add `https://<staging-domain>/**` (STAGING §1.3).

Why this matters:
- The email templates link to `{{ .SiteURL }}/auth/confirm?...` (`supabase/templates/*.html`).
- The server asks for `emailRedirectTo: ${NEXT_PUBLIC_SITE_URL}/auth/callback?next=/onboarding` and
  `/auth/callback?next=/reset-password` (`src/server/actions/auth.ts`).

**Check:** the dashboard shows the https staging address, not `http://localhost:3000`.

**2.5 Auth → Email.** *Who: Owner.*

1. Keep **Confirm email** on (`supabase/config.toml` `enable_confirmations = true`; STAGING §1.4).
2. Configure **custom SMTP**. "Supabase's built-in sender is rate-limited, so testers' emails may not arrive"
   (STAGING §1.4). Which provider: **NOT IN REPO — owner decides** (`config.toml` mentions SendGrid only as a
   commented example).
3. Optional: match the local password rules in `config.toml` (`minimum_password_length = 8`,
   `password_requirements = "letters_digits"`). Whether to set them on hosted: **NOT IN REPO — owner decides**.

**Check:** send a test email from the SMTP settings, if the dashboard offers it, or do §2.14 step 2.

**2.6 Auth → Email Templates (required).** *Who: Owner.*

1. **Confirm signup**: subject `Confirm your email address`; body = the whole of `supabase/templates/confirmation.html`.
2. **Reset password**: subject `Reset your password`; body = the whole of `supabase/templates/recovery.html`.

The subjects come from `supabase/config.toml` `[auth.email.template.*]`. The templates link to
`/auth/confirm?token_hash=…`, which works in Safari. Without them, "a password reset requested in the iPhone app
fails when its link opens in Safari" (STAGING §1.5; `src/app/auth/confirm/route.ts`).

**Do not use `npx supabase config push` for staging.** STAGING §1.5 and SETUP.md §4 offer it as an alternative, but it
pushes `supabase/config.toml`, whose `[auth]` has `site_url = "http://localhost:3000"` and localhost redirect URLs.
That would overwrite step 2.4.

**Check:** the template editor shows `{{ .TokenHash }}` in the link, not `{{ .ConfirmationURL }}`.

**2.7 Copy the keys for the host.** *Who: Owner.*

1. Go to Project Settings → API (STAGING §2) and copy:
   - the Project URL → `NEXT_PUBLIC_SUPABASE_URL`;
   - the **anon** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
   - the **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`. It is server-only and never goes in the app.
2. The repo and CI use these legacy anon and service_role keys. Whether Supabase's newer publishable/secret key
   formats work here is **NOT IN REPO — owner decides**; use the anon and service_role keys if both are offered.
3. **Check:** the URL contains your staging project ref and no other project's.

### 2B. Web hosting for the staging server

**2.8 Create a separate staging hosting project.** *Who: Owner.*

1. Vercel → Add New → Project → import `Joshfit77/Testing-testing-testing`. **Framework preset: Next.js**
   (`SETUP.md` §4 "Vercel").
2. Set the build settings. The repo has no `vercel.json`; `.vercelignore` exists and excludes `ios`, `android`,
   `docs`, `tests` and similar.

| Setting | Value | Source |
|---|---|---|
| Root directory | repository root | — |
| Install command | default (`npm install`), or `npm ci` as in CI. `postinstall` runs `scripts/react-hydration-replay-fix.mjs`. | `package.json` |
| Build command | `npm run build`, the Next.js default. `prebuild` applies the hydration fix; `postbuild` (`--verify-build`) **fails the build** if the fix is missing. | `package.json`; `docs/HYDRATION_418.md` |
| Output | Next.js default | — |
| Node.js version | **22.x**, to match CI (`node-version: 22`). The repo doesn't pin it for Vercel. | `.github/workflows/*.yml` |

3. Choose which branch it serves. The deployment must serve **`release/rc-2026-11-04`**. How to point Vercel at it is
   **NOT IN REPO — owner decides**. One way: a separate Vercel project whose Settings → Git → Production Branch is
   `release/rc-2026-11-04`. A side effect of that is good: the deployment has `VERCEL_ENV=production`, and
   `src/lib/demo/mode.ts` refuses `DEMO_MODE` there.
4. It must be reachable without signing in. The workflow fetches `/api/health` and `/` from GitHub's machine
   (`curl -fsS`), and the iPhone web view can't pass a Vercel login. So Vercel Deployment Protection
   ("Vercel Authentication") must be **off** for the address you use. How to keep staging private beyond an
   unadvertised address is **NOT IN REPO — owner decides**. Use only test accounts on it.
5. Domain: a `*.vercel.app` address works (the workflow refuses only `localhost`, `127.*`, `.example`, `.invalid`,
   `.test` and `.localhost`). A custom staging domain is **NOT IN REPO — owner decides**.

**2.9 Environment variables on the staging deployment.** *Who: Owner. Names are exact, from `src/server/env.ts`,
`src/lib/env.ts` and `.env.example`.*

`NEXT_PUBLIC_*` values are built into the app, so **redeploy after changing them**.

Set these:

| Variable | Staging value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<staging-domain>`, the exact `server_url` |
| `NEXT_PUBLIC_SUPABASE_URL` | staging Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | staging anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | staging service_role key (server only) |
| `REVENUECAT_SECRET_API_KEY` | RevenueCat secret API key, "(v1 secret key)" per `docs/MOBILE_BILLING.md` (§5.6) |
| `REVENUECAT_WEBHOOK_AUTH` | the exact Authorization header value you type in RevenueCat (§5.7), e.g. `Bearer <long random string>` (`.env.example`) |
| `REVENUECAT_PUBLIC_KEY_IOS` | RevenueCat public App Store key `appl_…` (§5.6) |
| `REVENUECAT_ALLOW_SANDBOX` | `false`, the default (recommended; see the note below), or `true` |
| `REVENUECAT_ALLOW_TEST_STORE` | `false` or unset. "never `true`" (STAGING §2). |

Optional:

| Variable | Value |
|---|---|
| `REVENUECAT_ENTITLEMENT_PRO` | `pro`. Unset gives the same default. |
| `REVENUECAT_PRODUCTS_PRO_MONTHLY` / `REVENUECAT_PRODUCTS_PRO_YEARLY` | unset. The defaults are `ngf_pro_monthly,ngf_pro:monthly` and `ngf_pro_yearly,ngf_pro:yearly`. If you set them, the defaults are replaced. |
| `ANTHROPIC_API_KEY` | blank. The AI coach is then off, honestly labelled. Add a key only if you approve the spend. |
| `USDA_FDC_API_KEY` | blank. Search then uses the bundled USDA database. |
| `STRIPE_SECRET_KEY` | blank, or a **`sk_test_…`** key only |
| `STRIPE_WEBHOOK_SECRET` | blank, or from the **test-mode** endpoint `https://<staging-domain>/api/stripe/webhook` |
| `STRIPE_PRICE_PRO` / `STRIPE_PRICE_PRO_YEARLY` | blank, or **test-mode** prices of exactly $19.99/month and $149.99/year. Checkout refuses any other amount. |

Leave these unset (they must stay off):

| Variable | Why |
|---|---|
| `STRIPE_LIVE_APPROVED` | Unset or `false`. A live key is then ignored (`src/server/env.ts` `stripeSecretKey`). |
| `DEMO_MODE` | `true` turns off payments and AI and shows the demo banner. It is **not** refused on a Vercel *preview*. |
| `ERROR_REPORTING`, `NEXT_PUBLIC_ERROR_REPORTING` | Error reporting stays off until approved (`docs/ERROR_MONITORING.md`). |
| `CRON_SECRET` | Billing reconciliation stays off until approved (§8). With it unset, `/api/billing/reconcile` refuses every call. STAGING §2 says to set it and schedule a job; that is the "switch on" step, so do it only with approval. |
| `STRIPE_PRICE_PLUS*`, `STRIPE_PRICE_*_LEGACY`, `REVENUECAT_PRODUCTS_PLUS_*`, `PLAN_*` | Plus isn't sold; the defaults are the approved prices. |
| `FOOD_IQ_SCORE` | Unset or `off`; only `on` shows it (`src/lib/food-iq.ts`). |
| `LEGAL_TERMS_URL`, `LEGAL_PRIVACY_URL` | Unset until counsel-reviewed documents exist. The app links its drafts, marked as drafts. |
| `LEGAL_REACCEPT_REQUIRED` | Unset or `false`. |
| `AUTH_RATE_LIMIT_SCALE`, `AI_RATE_LIMIT_PER_MINUTE`, `COACH_MODEL_FAST`, `COACH_MODEL_SMART`, `BIBLE_AI_MODEL`, `OFF_API_BASE_URL`, `REVENUECAT_API_BASE_URL`, `STRIPE_API_BASE_URL` | Defaults are correct; the base URLs are for tests. |
| `NGF_BUILD_SHA` | Only for a non-Vercel host. Set it to the deployed commit, so `/api/health` reports it. |

**Note on `REVENUECAT_ALLOW_SANDBOX`.** The docs disagree (see §10). With `false`, TestFlight purchases unlock Pro only
for accounts you put on the **sandbox tester allow-list** (§5.10). That is what `docs/RELEASE_CANDIDATE.md`,
"TestFlight verification checklist", step 5 tests: an unlisted account must get nothing. With `true`, every account's
free sandbox purchase unlocks Pro on this server.

**Check:** the host's environment-variable list shows exactly the names above and no live Stripe key.

**2.10 Deploy, then confirm the right commit is live.** *Who: Owner.*

1. Deploy `release/rc-2026-11-04` and wait for the build to finish. The `postbuild` check must pass.
2. Open `https://<staging-domain>/api/health`. The expected answer is
   `{"data":{"app":"narrow-gate-fitness","commit":"<sha>"}}`, where `<sha>` is the tip of `release/rc-2026-11-04`
   (the commit GitHub shows for that branch).
   - On Vercel the commit comes from `VERCEL_GIT_COMMIT_SHA`.
   - On another host it comes from `NGF_BUILD_SHA`.
   - `null` means neither is set.
3. Open `https://<staging-domain>/` signed out. It should play the opening ("Enter Narrow Gate"; Matthew 7:13–14).
   The workflow later checks the page for `data-intro-enter`, `Enter Narrow Gate` and
   `small is the gate and narrow the way`.

**2.11 Make yourself an admin on staging** (needed for the sandbox tester list). *Who: Owner.*

1. Sign up on the staging site and finish onboarding.
2. In the Supabase SQL Editor, run (`SETUP.md` §2, "Make yourself an admin"):
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = '<your test email>');
   ```
3. **Check:** an **Admin** item appears in the navigation, and `/admin/subscriptions` shows a "Sandbox testers"
   section.

**2.12 Smoke test before any build** (from STAGING §4). *Who: Owner.*

1. `/api/health` answers as in §2.10.
2. Sign up with a test address. The confirmation email arrives, and its link opens `/auth/confirm…` and then onboarding.
3. Log a workout, a meal and a journal entry. Sign out and sign in: everything is still there.
4. Optional, Stripe **test mode** only: pay with card `4242 4242 4242 4242`. Pro unlocks; cancel it in the Stripe
   dashboard.
   - The test-mode webhook needs these events, all handled in code: `checkout.session.completed`,
     `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`,
     `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid`, `invoice.payment_failed`,
     `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`.
   - `SETUP.md` lists only the first eight.
5. Request a password reset and open the link on another device: the reset page opens.
6. Delete the test account (Profile → Delete account). Signing in with it then fails.

**Check:** all six pass. Record the commit from `/api/health`.

---

## 3. Apple Developer: App ID, capabilities and signing

**3.1 Register the App ID.** *Who: Owner.*

1. developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → **+** → App IDs → App.
2. Description: any, for example `Narrow Gate Fitness` (**NOT IN REPO**).
3. Bundle ID: **Explicit**, `com.narrowgatefitness.app`. Leave the workflow's `bundle_id` input at this default:
   changing it changes `PRODUCT_BUNDLE_IDENTIFIER` but not the Capacitor `appId`, and `check-archive.py` expects
   this value.
4. **Check:** the identifier is listed under your team.

**3.2 Capabilities.** *Who: Owner. Checked against `App.entitlements`, `Info.plist` and the plugins in
`ios/App/CapApp-SPM/Package.swift`.*

| Capability | Turn on? | Evidence |
|---|---|---|
| **HealthKit** | **Yes**, tick it | `App.entitlements` has `com.apple.developer.healthkit` (with `healthkit.access` empty). `@capgo/capacitor-health` reads only. |
| In-App Purchase | Nothing to tick: "included for every App ID" (setup guide §2–3) | `@revenuecat/purchases-capacitor` 13.7.3. No IAP entitlement in the project. |
| Background Modes → Location updates | Not an App ID capability; already in `Info.plist` | `UIBackgroundModes` = `location` |
| Push Notifications | **No** | Reminders are **local** notifications (`@capacitor/local-notifications`, `docs/NOTIFICATIONS.md`). There is no `aps-environment` entitlement. |
| Associated Domains | **No** | No entitlement, no `apple-app-site-association`. Email links open in Safari by design (`docs/audit/4-gps-health-ios-performance.md`; `SETUP.md` §6). |
| Sign in with Apple | No | `supabase/config.toml` `[auth.external.apple] enabled = false` |

**Check:** the App ID's capability list shows HealthKit enabled.

**3.3 Certificates and provisioning profiles: none by hand.** *Who: Workflow.*

- The `testflight` job archives with `DEVELOPMENT_TEAM="$APPLE_TEAM_ID" CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates`
  and your App Store Connect API key, then exports with `method` = `app-store-connect`, `signingStyle` = `automatic`.
- The key needs the **Admin** role: "automatic signing needs it to create the distribution certificate and profile"
  (STAGING §3).
- The secrets it expects are listed in §6.1.

**Check:** after the first signing-only run (§6.4), Certificates, Identifiers & Profiles shows the certificates and
profiles Xcode created for the App ID.

---

## 4. App Store Connect

**4.1 Create the app record.** *Who: Owner.*

1. App Store Connect → Apps → **+** → New App (setup guide §4).
2. Platform **iOS**; Name **Narrow Gate Fitness**. If the name is taken, the alternative is **NOT IN REPO — owner
   decides**.
3. Primary language **English (U.S.)**; Bundle ID `com.narrowgatefitness.app`.
4. SKU: anything, for example `NGF001` (the guide's example); User Access: **Full Access**.
5. **Check:** the app appears under Apps, with the bundle ID shown on App Information.

**4.2 Agreements.** *Who: Owner.*

1. Business → Agreements: accept the **Paid Apps** agreement and complete banking and tax. These are required before
   any subscription can be sold (setup guide §5).
2. The setup guide says "Sandbox testing works before then". Apple's own sandbox documentation has listed the Paid
   Applications Agreement as a prerequisite for testing in-app purchases. **Verify this; if products don't load in
   sandbox, this is the first thing to check** (§9.4).
3. **Check:** Agreements shows Paid Apps as Active.

**4.3 The two auto-renewable subscriptions (approved prices only; do not change them).** *Who: Owner.*

1. App → Monetization → Subscriptions → create the subscription group **`Pro All Access`** (setup guide §5).
2. In that group, create:

| Reference name | Product ID (exact) | Duration | Price (U.S.) |
|---|---|---|---|
| Pro Monthly | `ngf_pro_monthly` | 1 month | **$19.99** |
| Pro Yearly | `ngf_pro_yearly` | 1 year | **$149.99** |

3. Put both at the same level in the group (`docs/MOBILE_BILLING.md`: "both 'Pro All Access' at the same level").
4. Create **no Plus products** (setup guide §5).
5. Add display names, descriptions and a review screenshot (MOBILE_BILLING "Add review screenshots and
   descriptions"). The wording is **NOT IN REPO — owner decides**. Which countries: **NOT IN REPO — owner decides**.
6. Product IDs can't be reused once created, so type them exactly.
7. **Check:** both subscriptions show the exact IDs and prices, and their status is no longer "Missing Metadata".

**4.4 App Store Connect API key for the workflow.** *Who: Owner.*

1. Users and Access → Integrations → **App Store Connect API** → **+** (STAGING §3; setup guide §8). Use a team key:
   the workflow uses an Issuer ID.
2. Name: anything (**NOT IN REPO**). Access: **Admin** (automatic signing needs it).
3. Download `AuthKey_<KEYID>.p8`. It can be downloaded only once.
4. Note the **Key ID** and the **Issuer ID** shown on the same page.
5. Base64-encode the file as one line, with no spaces or line breaks:
   - on a Mac: `base64 -i AuthKey_<KEYID>.p8 | pbcopy` (setup guide §8);
   - on Linux: `base64 -w0 AuthKey_<KEYID>.p8` (not from the repo).
   - The workflow decodes it with `base64 --decode` on macOS.
6. Paste the result directly into the GitHub secret in §6.1. Don't save it to a file.
7. **Check:** the key is listed as Active with the Admin role.

**4.5 In-App Purchase key for RevenueCat.** *Who: Owner.*

1. Users and Access → Integrations → **In-App Purchase** → generate a key, then download its `.p8` and note its Key
   ID (setup guide §6.1).
2. It goes only into RevenueCat (§5.2).
3. RevenueCat may also ask for an App Store Connect API key (to import products) or the App-Specific Shared Secret.
   Which of these it needs is **NOT IN REPO — owner decides** by following RevenueCat's on-screen requirements.
   MOBILE_BILLING says "(App Store Connect API key / in-app purchase key)".
4. **Check:** the key is listed as Active.

**4.6 Internal testing group.** *Who: Owner.*

1. App → TestFlight → Internal Testing → **+**, and name it, for example `Owners` (setup guide §4).
2. Add yourself.
3. Internal testers must be users of your App Store Connect team (Users and Access). Their role is **NOT IN
   REPO — owner decides**.
4. "Internal testers need no App Review" (setup guide §4).
5. **Check:** the group lists each tester's Apple Account email.

**4.7 Sandbox tester Apple Accounts.** *Who: Owner.*

1. Users and Access → **Sandbox** → add a tester for each person who will test purchases (setup guide §13).
2. Use email addresses that are not already Apple Accounts.
3. On each iPhone: Settings → App Store → **Sandbox Account** → sign in with that tester.
4. TestFlight purchases are always sandbox purchases: free, with sped-up renewals.
5. Sandbox Apple Accounts are separate from the Narrow Gate **app accounts** that go on the allow-list (§5.10).
6. **Check:** the testers are listed under Sandbox.

**4.8 Export compliance: nothing to do.** *Who: nobody.*

- `Info.plist` has `ITSAppUsesNonExemptEncryption` = `false` ("standard HTTPS encryption only", setup guide §10), so
  TestFlight doesn't ask.
- `check-archive.py` checks this on every push.
- **Check:** the uploaded build doesn't show "Missing Compliance".

**4.9 App Privacy questionnaire (pointer).** *Who: Owner.*

1. Not needed for internal testing. It is required before external testing or release (`docs/TESTFLIGHT.md`,
   "Requirements by stage", marked unverified).
2. When you do it, answer from `ios/App/App/PrivacyInfo.xcprivacy`:
   - **No tracking** (`NSPrivacyTracking` = `false`).
   - Collected, linked to the user, not used for tracking, purpose **App Functionality**: Email Address, Name,
     Fitness, Health, Other User Content, Purchase History, User ID, Precise Location, Photos or Videos.
   - The list in `SETUP.md` §6 is shorter and out of date.
3. The privacy policy URL becomes `LEGAL_PRIVACY_URL` once counsel finishes it.

---

## 5. RevenueCat

**5.1 Project.** *Who: Owner.*

1. Create a RevenueCat project. Its name is **NOT IN REPO**.
2. **Check:** the project dashboard opens.

**5.2 iOS app.** *Who: Owner.*

1. Add an **App Store** app with bundle ID **`com.narrowgatefitness.app`** (setup guide §6.1).
2. Upload the In-App Purchase key from §4.5, with its Key ID and your Issuer ID.
3. **Check:** RevenueCat shows the key as valid or connected.

**5.3 Products.** *Who: Owner.*

1. Import or add `ngf_pro_monthly` and `ngf_pro_yearly` (setup guide §6.2).
2. **Check:** both are listed for the App Store app.

**5.4 Entitlement (exact identifier).** *Who: Owner.*

1. Create the entitlement with identifier **`pro`** and attach **both** products.
2. The server decides the plan from this entitlement: `storeRowsFromSubscriber` in `src/lib/billing/revenuecat.ts`
   checks `entitlements["pro"].product_identifier`. A product not attached to `pro` unlocks nothing.
3. **Check:** entitlement `pro` shows two products.

**5.5 Offering.** *Who: Owner.*

1. Use the **default** offering, with two packages: one with `ngf_pro_monthly`, one with `ngf_pro_yearly`. Mark it
   **Current** (setup guide §6.2).
2. The code doesn't require a particular offering or package identifier. `src/lib/billing/store-purchases.ts` takes
   the packages of `offerings.current` plus all offerings, and the paywall matches them by product ID. The exact
   offering and package identifiers are **NOT IN REPO — owner decides** (RevenueCat's defaults are fine).
3. **Check:** the current offering lists both packages.

**5.6 API keys.** *Who: Owner.*

1. Under API keys, copy:
   - the public App Store key (`appl_…`) → `REVENUECAT_PUBLIC_KEY_IOS`;
   - the **secret** key → `REVENUECAT_SECRET_API_KEY`. MOBILE_BILLING says the v1 secret key; the server calls
     `GET /v1/subscribers/{id}`.
2. Set them only on the staging deployment (setup guide §6.4).
3. Both are needed. `storePublicKey()` returns nothing when the secret key is missing, and the app then says
   "In-app purchases aren't available right now".
4. **Check:** they appear in the host's environment-variable list. Redeploy.

**5.7 Webhook.** *Who: Owner.*

1. Integrations → Webhooks → add:
   - URL: `https://<staging-domain>/api/revenuecat/webhook`;
   - Authorization header value: a long random string you generate, for example `Bearer ` followed by the output of
     `openssl rand -base64 32`.
2. Put the **identical** string, including any `Bearer ` prefix, in `REVENUECAT_WEBHOOK_AUTH` and redeploy. The server
   compares the whole header (`webhookAuthorized`).
3. If RevenueCat lets you choose which environment's events to send, sandbox events must be included for staging.
   That setting isn't in the repo; the server stores RevenueCat's `environment` with each event.
4. **Check:** use RevenueCat's "send test event". The delivery log should show **200**; the server accepts `TEST`
   events and does nothing with them. Other responses:
   - **401**: the header doesn't match;
   - **503** "Webhook not configured": `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_AUTH` or
     `SUPABASE_SERVICE_ROLE_KEY` is missing.

**5.8 Server environment variables (summary).** *Who: Owner.*

- Set: `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_PUBLIC_KEY_IOS`.
- Set or leave unset: `REVENUECAT_ALLOW_SANDBOX` (`false` recommended, see §2.9), `REVENUECAT_ALLOW_TEST_STORE`
  (`false` or unset).
- Optional, defaults already correct: `REVENUECAT_ENTITLEMENT_PRO=pro`, `REVENUECAT_PRODUCTS_PRO_MONTHLY`,
  `REVENUECAT_PRODUCTS_PRO_YEARLY`.
- If `STRIPE_LIVE_APPROVED=true` were ever set, both "allow" flags would be ignored (`realMoneyDeployment` in
  `src/server/env.ts`).
- **Check:** after redeploying, signed in as an admin, `/admin/subscriptions` loads.

**5.9 Sandbox tester allow-list.** *Who: Owner (as a staging admin).*

`STORE_SANDBOX_TESTERS` is **not a setting in the code**. The allow-list is the database table `sandbox_testers`
(migration `20261103000052_sandbox_testers.sql`), keyed by the Narrow Gate **user id**. It applies when
`REVENUECAT_ALLOW_SANDBOX` is `false`.

1. Each tester first creates their Narrow Gate account on staging, in the app or on the web.
2. You open **Admin → Subscriptions → Sandbox testers** (`/admin/subscriptions`).
3. Fill in:
   - **Account email or user id**;
   - **Who and why**, for example `TestFlight: internal QA`;
   - optionally **Ends on**, for example the end of the TestFlight round.
4. Click **Add tester**. The server re-reads that member's store purchases at once (MOBILE_BILLING, "Enrol a tester").
5. Without the admin page, use SQL in the Supabase SQL editor (from MOBILE_BILLING):
   ```sql
   insert into public.sandbox_testers (user_id, note, expires_at) values ('<user-id>', 'TestFlight: internal QA', null)
     on conflict (user_id) do update set note = excluded.note, expires_at = excluded.expires_at;
   ```
6. **Check:**
   - the tester appears in the list with "no end date" or their end date;
   - if `REVENUECAT_ALLOW_SANDBOX=true` is set, the page says so and the list isn't needed;
   - later, a sandbox purchase from an **unlisted** account must grant nothing (RC checklist step 5).

---

## 6. GitHub: secrets, then build and upload

**6.1 Repository secrets.** *Who: Owner.*

1. Go to Settings → Secrets and variables → Actions → **New repository secret**.
2. Add them as **repository** secrets. The job has no `environment:`, so environment-level secrets won't be seen.

| Secret (exact name) | Value from |
|---|---|
| `APPLE_TEAM_ID` | developer.apple.com → Membership details (10 characters) |
| `ASC_KEY_ID` | the App Store Connect API key's Key ID (§4.4) |
| `ASC_ISSUER_ID` | the Issuer ID on the same page |
| `ASC_KEY_P8_BASE64` | the base64 text of `AuthKey_<KEYID>.p8` (§4.4) |

3. **Check:** the four names are listed. Values are never shown.

**6.2 Repository variables: none for TestFlight.** *Who: nobody.*

- `BILLING_RECONCILE_URL` (and a GitHub secret `CRON_SECRET`) belong to `billing-reconcile.yml`. **Leave them unset**
  until you approve reconciliation (§8).

**6.3 Recommended first run: the checks (no Apple account involved).** *Who: Owner.*

1. Actions → **iOS** → **Run workflow**.
2. **Use workflow from: `release/rc-2026-11-04`**; job: `checks`.
3. This runs the compile check, the unsigned Release device archive checked by `scripts/ios-verify/check-archive.py`,
   the full app in the iOS Simulator and the WebKit tests on the exact commit.
4. **Check:** all four jobs are green on the commit you deployed.

> **Warning: pick the right branch every time.** The default branch `main` (`aad49a1`) holds an **old** `ios.yml`.
> Its inputs are `job` = `simulator`/`testflight`, `edition` = `offline`/`online` and `server_url`. Its `testflight`
> job **always uploads** (there is no upload checkbox) and defaults to the **offline edition**, which must never be
> uploaded. Before clicking the green Run button, make sure the form shows `checks` as a job option and an
> **`upload`** checkbox. If it shows `edition` or `simulator`, you are on `main`: change "Use workflow from".

**6.4 Signing-only run (nothing leaves GitHub).** *Who: Owner starts it; the Workflow does the rest.*

1. Actions → **iOS** → **Run workflow**, with these inputs:
   - Use workflow from: **`release/rc-2026-11-04`**, the branch deployed to staging;
   - `job`: **`testflight`**;
   - `server_url`: **`https://<staging-domain>`**, the same as `NEXT_PUBLIC_SITE_URL`;
   - `upload`: **unticked**;
   - `bundle_id`: leave **`com.narrowgatefitness.app`**;
   - `marketing_version`: leave **`1.0.0`**.
2. **What the job checks, in order** (`ios.yml` job `testflight`):
   1. All four secrets exist ("Missing repository secret …").
   2. `server_url` starts with `https://`, and its host isn't empty, `localhost`, `127.*`, `*.example`,
      `*.invalid`, `*.test` or `*.localhost`.
   3. `<server_url>/api/health` answers within 20 s. It prints "Deployed app: …" and warns if the site's commit
      differs from the build's commit.
   4. `<server_url>/` contains `data-intro-enter`, `Enter Narrow Gate` and `small is the gate and narrow the way`.
   5. After `npm ci` and `CAP_SERVER_URL="$SERVER_URL" npx cap sync ios`, the generated
      `ios/App/App/capacitor.config.json` has `server.url` equal to `server_url` and `webDir` that isn't
      `standalone` ("The app will load …").
   6. Xcode is not a beta and the iPhoneOS SDK is 26 or later.
   7. Archive (Release, `generic/platform=iOS`, automatic signing, build number = run number).
   8. Export signed for App Store Connect (`destination` = `export`). The `.ipa` is **not** kept as an artifact.
   9. "Remove the key" deletes the `.p8` and the export, even after a failure.
3. What it does **not** do: the signed archive is not re-checked with `check-archive.py`. That check runs on the
   unsigned archive in the `archive-check` job (§6.3).
4. **Check:** the run is green, and the last step's log says "Signed for App Store Connect, not uploaded."

**6.5 Upload run (only after you approve).** *Who: Owner approves and starts it; the Workflow uploads.*

1. Run the workflow again with the **same inputs** and **`upload` ticked**. The step is named "Sign and upload to App
   Store Connect (TestFlight)" and uses `destination` = `upload`.
2. **Check:** the log ends with "Uploaded build `<run number>` (version 1.0.0). It appears in App Store Connect >
   TestFlight after Apple finishes processing."

Every run gets a new run number, so every upload has a unique build number. A web-only fix doesn't need a new build:
redeploy staging. A new build is needed only for native changes: "plugins, permissions, the icon, or the server
address" (setup guide §14).

---

## 7. TestFlight: install and first launch

**7.1 Processing.** *Who: Apple; Owner watches.*

1. Open App Store Connect → the app → TestFlight → iOS builds. Build **1.0.0 (`<run number>`)** shows Processing;
   it "usually takes 10–30 minutes" (setup guide §10).
2. Apple emails the account holder if processing finds a problem.
3. **Check:** the build status becomes ready to test, with no "Missing Compliance".

**7.2 Add the build and testers.** *Who: Owner.*

1. TestFlight → Internal Testing → `Owners` (or your group): add the build, then add or confirm the testers.
   Whether to turn on automatic distribution is **NOT IN REPO — owner decides**.
2. **Check:** each tester shows as Invited or Installed.

**7.3 Install on the iPhone.** *Who: each tester.*

1. Install **TestFlight** from the App Store, signed in with the Apple Account that is on the internal group.
2. Accept the invite (or the app appears directly), then tap **Install**. The phone must be on iOS 16 or later.
3. **Check:** "Narrow Gate Fitness" opens from the home screen with the gold icon.

**7.4 Record the build.** *Who: tester.*

1. Fill in "Build to test" in `docs/device-testing/DEVICE_TEST_SCRIPT.md`:
   - build number;
   - version `1.0.0`;
   - the `server_url`;
   - the commit from `/api/health`;
   - whether sandbox purchases count for this tester (allow-listed, or `REVENUECAT_ALLOW_SANDBOX`).
2. Results go in `docs/device-testing/device-test-results.csv` (columns
   `id,area,title,platform,result,actual,evidence,severity,retest_status,tester,date,build`). Keep screenshots
   **outside** the repository.

**7.5 First-launch checks (about 15 minutes).** *Who: tester.*

1. **Opening:** a black splash, then the opening once, with Skip and Enter Narrow Gate working. Later launches behave
   as designed.
2. **Sign up** with a new email:
   - the confirmation email arrives;
   - its link opens in **Safari**, not in the app (there are no universal links), and lands on onboarding there;
   - return to the app and **sign in with the password**.
   - This is the expected behaviour (`DEVICE_TEST_SCRIPT.md`, Accounts row A).
3. **Plans & billing:**
   - Profile → **Plans & billing** shows Apple's prices for Pro All Access ($19.99/month and $149.99/year in the
     U.S. storefront) and **Restore purchases**;
   - there is no website checkout inside the app;
   - "In-app purchases aren't available right now" means §9.4.
4. **Sandbox purchase**, with the tester's Narrow Gate account on the allow-list: buy monthly. Apple's sheet
   appears and Pro unlocks.
5. **Apple Health:**
   - My Progress → Steps card → "Sync Apple Health" opens the Health sheet, listing **read** access only;
   - the steps import.
6. **Run or walk:** the location prompt explains why. iOS may first offer "While Using" and later ask for "Always"
   (`DEVICE_TEST_SCRIPT.md`, DT-GPS-01).
7. **Workout:** the first rest asks for notification permission, and the rest-over notification arrives with the
   phone locked.
8. **Offline:** in airplane mode, the app shows the offline page ("Offline · Narrow Gate Fitness"), which can open
   the bundled Bible (`native-shell/error.html` → `bible-offline.html`). "Try again" returns to the site once you are
   back online.

**7.6 Full pass.** *Who: testers.*

1. Work through **`docs/TESTFLIGHT_INTERNAL_CHECKLIST.md`**, sections 1–9.
2. Use `docs/device-testing/DEVICE_TEST_SCRIPT.md` for the step-by-step detail.
3. Then go through `docs/RELEASE_CANDIDATE.md`, "TestFlight verification checklist", steps 3–10.
4. Report each defect with:
   - the build number;
   - the iPhone model and iOS version;
   - the steps;
   - what you expected and what happened;
   - a recording (setup guide §14).

---

## 8. What stays off until you approve, and how to confirm it

| Item | How it stays off | How to confirm it is off |
|---|---|---|
| **Live payments (web)** | `STRIPE_SECRET_KEY` blank or `sk_test_…`; `STRIPE_LIVE_APPROVED` unset or `false`. A live key is then ignored (`src/server/env.ts`). | Host env list: no `sk_live_`/`rk_live_`, and no `STRIPE_LIVE_APPROVED=true`. Any web checkout shows Stripe's test mode. |
| **Live payments (App Store)** | The app is never submitted for review, so TestFlight purchases are sandbox only. `REVENUECAT_ALLOW_TEST_STORE` unset. | App Store Connect: the app's version is not submitted; RevenueCat customers show sandbox purchases only. |
| **Production data** | Staging uses its own Supabase project (§2.1); no production project is involved. | `NEXT_PUBLIC_SUPABASE_URL` contains the **staging** project ref; only test accounts exist under Authentication → Users. |
| **Public deploy / release** | Only the staging deployment exists. No production hosting project. Don't push tags named `demo-preview-*` (that triggers `demo-preview.yml`). No external TestFlight groups; no App Review submission. | Hosting dashboard: only the staging project; App Store Connect → TestFlight → External Testing: no groups. Repo tags: no new `demo-preview-*` tag. |
| **Merge to `main`** | `release/rc-2026-11-04` stays unmerged (RC doc: "Nothing is merged into `main`"). | On GitHub, `main` still points at `aad49a1`. Merging would also bring the scheduled `billing-reconcile.yml` live. |
| **Error reporting** | `ERROR_REPORTING` and `NEXT_PUBLIC_ERROR_REPORTING` unset. The server-error log line in `src/instrumentation.ts` is always on, but it only writes to the host's own log. | Host env list: neither variable present. Host logs: no `"scope":"client.` lines. `/api/client-errors` always answers 204, so it can't be checked from outside. Switch-on steps: `docs/ERROR_MONITORING.md`, "Activation checklist". |
| **Billing reconciliation** | Deployment `CRON_SECRET` unset (every call refused). GitHub variable `BILLING_RECONCILE_URL` and secret `CRON_SECRET` unset. Workflow not on `main`. | `curl -i -X POST https://<staging-domain>/api/billing/reconcile` returns **401**, or 503 if the service-role key is missing. GitHub → Settings → Variables has no `BILLING_RECONCILE_URL`. |
| **Demo mode** | `DEMO_MODE` unset | Plans & billing shows no "Demo:" notice; there is no demo banner. |
| **Paid AI** | `ANTHROPIC_API_KEY` blank unless you approve the spend | The coach says it isn't configured (checklist §7 needs a key). |
| **Experimental Food IQ score** | `FOOD_IQ_SCORE` unset or `off` | No Food IQ score on product pages |
| **Upload to Apple** | `upload` left unticked until you approve | The run log says "not uploaded" |

---

## 9. Troubleshooting the most likely failures

**9.1 Workflow stops before building.**

| Error in the log | Cause | Fix |
|---|---|---|
| `Missing repository secret <NAME> (see docs/TESTFLIGHT.md)` | The secret isn't set, is mistyped, or is an environment secret | Re-add it under **Repository secrets** with the exact name |
| `server_url must be the https:// address…` / `…is a placeholder or local address` | Empty, `http://`, or a placeholder host | Use the real `https://` staging address |
| `…/api/health did not answer: deploy the app there first` | Not deployed; wrong address; Vercel Deployment Protection asking for a login; or the build failed | Open the URL in a private browser window: it must show the JSON without a login |
| `…doesn't serve the current opening ('<marker>' missing)` | An older branch is deployed. The message mentions `claude/testflight-prep`; the branch now is `release/rc-2026-11-04`. | Redeploy `release/rc-2026-11-04` |
| `::warning::The site serves commit X; this build is from Y` | The site and the build branch differ | Deploy the same branch you run the workflow from |
| `The selected Xcode is a beta` / `iOS SDK … older than … 26` | GitHub's `macos-latest` image changed | Re-run later. Pinning an Xcode version is **NOT IN REPO — owner decides**. |
| Form shows `edition` / `simulator`, or a run uploaded without being asked | You ran `main`'s old `ios.yml` | Always choose `release/rc-2026-11-04` (§6.3 warning) |

**9.2 Signing fails in "Archive (automatic signing with the API key)".**

- An authentication failure or invalid key usually means `ASC_KEY_P8_BASE64` isn't a clean single-line base64 of
  the `.p8`, or `ASC_KEY_ID` / `ASC_ISSUER_ID` don't belong to that key. Re-create the secrets (§4.4, §6.1).
- A permissions error, or no certificate or profile being created, means the key isn't **Admin** (STAGING §3).
  Create an Admin key.
- "No profiles for 'com.narrowgatefitness.app'" or an unknown bundle ID means the App ID isn't registered under
  the team in `APPLE_TEAM_ID`, or the `bundle_id` input was changed (§3.1).
- If a certificate limit is reached because of repeated CI runs, revoking unused certificates in Certificates,
  Identifiers & Profiles is **NOT IN REPO — owner decides**.

**9.3 Missing capability.**

- A HealthKit or entitlement error during the archive or export means HealthKit isn't enabled on the App ID. Tick it
  (§3.2) and re-run; `App.entitlements` requires it.
- Don't add Push Notifications or Associated Domains: the project doesn't use them.

**9.4 Products don't load in sandbox** (Plans & billing shows "In-app purchases aren't available right now", or no
prices). Check in this order:

1. `REVENUECAT_SECRET_API_KEY` **and** `REVENUECAT_PUBLIC_KEY_IOS` are both set on staging, and you redeployed. The
   public key isn't sent to the app without the secret key (`storePublicKey`).
2. The RevenueCat App Store app has bundle ID `com.narrowgatefitness.app` and a valid In-App Purchase key.
3. Products `ngf_pro_monthly` and `ngf_pro_yearly` exist with exactly those IDs in App Store Connect and RevenueCat,
   and are in the **current** offering.
4. The App Store Connect subscriptions have complete metadata (not "Missing Metadata").
5. The **Paid Apps agreement** is active. The setup guide says it isn't needed for sandbox; Apple's documentation
   suggests it is. Verify (§4.2).
6. Newly created products can take time to appear in sandbox. How long is **NOT IN REPO**.
7. The build includes the purchases plugin (`PurchasesPlugin` in `packageClassList`). An old build without it can't
   buy (MOBILE_BILLING).

**9.5 Purchase completes but Pro doesn't unlock.**

1. The tester's Narrow Gate account isn't on **Admin → Subscriptions → Sandbox testers** while
   `REVENUECAT_ALLOW_SANDBOX` is `false`. Add it; the server re-reads at once. Or tap **Restore purchases**.
2. Look at RevenueCat → webhook deliveries:
   - **401** means `REVENUECAT_WEBHOOK_AUTH` ≠ the dashboard header, including the `Bearer ` prefix;
   - **503** means a key or `SUPABASE_SERVICE_ROLE_KEY` is missing.
3. A product not attached to entitlement **`pro`** is never mapped to Pro.
4. If `STRIPE_LIVE_APPROVED=true` is set, sandbox purchases count only for allow-listed accounts.

**9.6 Auth email links open in the wrong place.**

- **They open in Safari, not the app.** This is expected: there are no Associated Domains or URL scheme. Confirm in
  Safari, then sign in inside the app.
- **A link points to `localhost`, or to the wrong host:**
  - Supabase **Site URL** isn't the staging address (§2.4);
  - or `npx supabase config push` was run and pushed `site_url = "http://localhost:3000"`;
  - or `NEXT_PUBLIC_SITE_URL` is wrong (fix it **and redeploy**; it is built in).
- **`/login?error=link_invalid`:**
  - the templates in §2.6 aren't installed (the default `{{ .ConfirmationURL }}` link fails in Safari);
  - or the link was already used, or expired (one hour, `otp_expiry = 3600`);
  - or the email went to a redirect URL that isn't allowed (add `https://<staging-domain>/**`).
- **No email arrives:** custom SMTP isn't configured (§2.5), or Supabase's built-in rate limit was hit.

**9.7 The app shows the offline page, or opens pages in Safari.**

- **Offline page with Wi-Fi on:** the staging site is down, or the address changed. A new address needs a new build.
- **Pages open in Safari:** the site redirected to another host, for example apex → www. The app allows only the
  `server_url` host. Rebuild with the final address, and set `NEXT_PUBLIC_SITE_URL` to match.

---

## 10. Gaps and inconsistencies found between the docs and the code

Items marked **Fixed** were corrected on 2026-11-04; the rest remain (the steps above already avoid them).

1. **Fixed.** **`STORE_SANDBOX_TESTERS` doesn't exist in the code.** `docs/TESTFLIGHT_INTERNAL_CHECKLIST.md`, "Before the
   build", names it. The real mechanism is the `sandbox_testers` table (migration `20261103000052`), managed at
   `/admin/subscriptions` or by SQL.
2. **`REVENUECAT_ALLOW_SANDBOX` on staging: the docs conflict.**
   - `true` on staging: `docs/STAGING_ENVIRONMENT.md` §2, `docs/TESTFLIGHT_SETUP_GUIDE.md` §7,
     `docs/PRE_TESTFLIGHT_READINESS_REPORT.md` D7, and `docs/launch-audit/IOS_DEVICE_TEST_PLAN.md`.
   - `false` plus the allow-list: `docs/TESTFLIGHT.md` §1, `.env.example` and `docs/MOBILE_BILLING.md`.
   - `docs/RELEASE_CANDIDATE.md`, TestFlight checklist step 5, only works with `false`.
   - `PRE_TESTFLIGHT_READINESS_REPORT.md` §A ("count only when …=true") predates migration 052.
3. **Fixed in `RELEASE_CANDIDATE.md` (53).** **Migration counts are stale.**
   - `STAGING_ENVIRONMENT.md` says "45 files", last `20261102000048`; `PRE_TESTFLIGHT_READINESS_REPORT.md` says 45.
   - The repository has **53**, ending at `20261103000056`.
   - `RELEASE_CANDIDATE.md` says 53 in §A and "56 migrations" in §G. The numbers run to 056 with gaps.
4. **Fixed (both docs now warn against it).** **`npx supabase config push` would break hosted auth URLs.** STAGING §1.5 and SETUP §4.5 offer it. It pushes
   `config.toml` `site_url = "http://localhost:3000"` and localhost redirect URLs.
5. **Remains (needs your merge decision; the steps above avoid it).** **The default branch has a dangerous old `ios.yml`.** `main` (`aad49a1`) has `job` = `simulator`/`testflight` and
   `edition` (default `offline`), and its `testflight` job always uploads. Running "iOS" from `main` would upload the
   offline edition with no checkbox.
6. **Fixed.** **`docs/INSTALL.md` was out of date and conflicted with the workflow.**
   - It says to choose "`testflight` and the `offline` edition"; the current workflow forbids the offline edition
     for TestFlight.
   - It gives the API key role as "App Manager"; the other docs say **Admin**, which automatic signing needs.
7. **In-App Purchase capability.** `MOBILE_BILLING.md` step 5 says "In Xcode, add the In-App Purchase capability to
   the app target". `TESTFLIGHT_SETUP_GUIDE.md` says there is nothing to tick. The project has no IAP capability or
   entitlement entry, and the workflow signs without one.
8. **Paid Apps agreement and sandbox.** `TESTFLIGHT_SETUP_GUIDE.md` §5 says "Sandbox testing works before then". This
   is probably wrong (Apple lists the Paid Applications Agreement as a sandbox prerequisite). Verify.
9. **Fixed.** **`TESTFLIGHT_INTERNAL_CHECKLIST.md` wording.**
   - §1 says the confirmation link "opens the app/site"; it can only open Safari (no universal links), and
     `DEVICE_TEST_SCRIPT.md` says so correctly.
   - §2 says "Profile → Membership"; the row is "Plans & billing" (`/profile/billing`), with the eyebrow "Membership".
   - §7 says "needs the production API key on the deployment"; it means an Anthropic key, not production data.
10. **Pointers to the device tests.** `TESTFLIGHT_SETUP_GUIDE.md` §12 points to `PRE_TESTFLIGHT_READINESS_REPORT.md`
    §E, not the newer `TESTFLIGHT_INTERNAL_CHECKLIST.md` / `DEVICE_TEST_SCRIPT.md`.
11. **Stale branch names.**
    - `STAGING_ENVIRONMENT.md` and `TESTFLIGHT.md` name `security/payment-hardening-prelaunch`. That includes
      §3b `git checkout …` and §1.3 "Vercel … branch …".
    - The `ios.yml` error text says "deploy claude/testflight-prep (or later)".
    - The release candidate is `release/rc-2026-11-04`.
12. **`SETUP.md` is stale.**
    - Prices: Pro $24.99/$249.99, Plus, `BILLING_YEARLY_ENABLED`. The code has $19.99/$149.99.
    - `AI_MODEL`: not read by the code.
    - "Xcode 16+": the workflow needs Xcode 26 with the iOS 26 SDK.
    - The privacy-label list is shorter than `PrivacyInfo.xcprivacy`.
    - The Stripe webhook event list is missing `charge.refunded`, `charge.dispute.created` and
      `charge.dispute.closed`.
13. **Variables the code reads but the staging table or `.env.example` don't list.**
    - Missing from the STAGING table: `ERROR_REPORTING`, `NEXT_PUBLIC_ERROR_REPORTING`, `NGF_BUILD_SHA` (only in
      the smoke test), `LEGAL_REACCEPT_REQUIRED`, `BIBLE_AI_MODEL`, `OFF_API_BASE_URL`, `REVENUECAT_API_BASE_URL`,
      `REVENUECAT_PUBLIC_KEY_ANDROID`.
    - Missing from `.env.example`: `ERROR_REPORTING`, `NEXT_PUBLIC_ERROR_REPORTING`, `DEMO_MODE`, `NGF_BUILD_SHA`,
      `BIBLE_AI_MODEL`.
14. **`CRON_SECRET` on staging.** `STAGING_ENVIRONMENT.md` says to set it and schedule `/api/billing/reconcile` every
    30 minutes. `ERROR_MONITORING.md` and `RELEASE_CANDIDATE.md` treat reconciliation as dormant until you approve.
15. **"Private" staging vs. the workflow.** `TESTFLIGHT_INTERNAL_CHECKLIST.md` says "the private deployment". The
    workflow and the iPhone web view need `/` and `/api/health` to answer **without a login**. The repo doesn't say
    how to keep staging private.
16. **Gaps in the TestFlight job.**
    - It doesn't run `check-archive.py` on the signed archive.
    - Its `bundle_id` input changes the Xcode bundle ID but not the Capacitor `appId` (`CAP_APP_ID` isn't passed).
      Leave the default.
17. **Local Xcode route caveats** (`TESTFLIGHT.md` §3b).
    - The git-ignored `ios/App/App/capacitor.config.json` in this checkout points at `http://127.0.0.1:3000` with
      cleartext, so `cap sync` with the staging address must run before archiving.
    - The project's `CURRENT_PROJECT_VERSION = 1` is below the workflow's run-number builds (64+).
18. **Not in the repo:**
    - the RevenueCat App-Specific Shared Secret, the webhook environment selection, and the offering and package
      identifiers (the code accepts any offering and matches by product ID);
    - Supabase's newer key formats;
    - the Vercel production-branch and protection settings;
    - the SMTP provider;
    - the App Store subscription display names.
