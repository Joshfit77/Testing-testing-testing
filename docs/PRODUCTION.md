# Production readiness

The single place to check what is done, what is verified, and what still needs a person, an account or a decision before
TestFlight, App Store submission and a public launch. Branch: `claude/production-readiness` (built on `main`).
Related documents: `SETUP.md` (local setup and base deployment), `docs/legal-review.md` (privacy/terms notes and the App
Privacy checklist), `.env.example` (every variable).

Readiness categories used below:

- **Verified**: complete, and checked in this repository (tests, build, CI or a direct check).
- **Implemented, not verified**: code is in place but hasn't run end to end against the real service or a real device.
- **Blocked**: needs external access, credentials, hardware or an account.
- **Decision / review**: needs the owner or a qualified professional.
- **Not implemented**.

## 1. Status at a glance

| Area | Status | Evidence / what's missing |
| --- | --- | --- |
| Web build, typecheck, lint, unit tests | Verified | Local runs on this branch; see §9 |
| Database migrations apply in order | Verified | All migrations applied to PostgreSQL 16 with Supabase stubs; new triggers and functions tested in SQL |
| Integration tests (RLS, billing, consent) | Verified in CI | 57 passed, 0 skipped on a real Supabase stack (GitHub Actions); see §9 |
| Browser end-to-end tests | Not run | Need the local Supabase stack (same blocker) |
| Shared rate limiting | Verified (SQL + unit) | `rate_limit_hit` in Postgres; falls back to per-instance memory |
| AI coach consent (Apple 5.1.2(i)) | Verified (SQL + unit), UI not seen in a browser | Needs a signed-in Pro session with a database to view |
| Wellness consent enforcement | Verified (SQL) | Database triggers for limitation notes and recovery check-ins |
| Account deletion | Implemented, not verified end to end | Needs the service-role key and a real project |
| Data export | Implemented, not verified end to end | Includes program structure, billing and store records |
| Web subscriptions (Stripe) | Implemented, not verified against Stripe | Webhook logic integration-tested with signed synthetic events (CI); checkout/portal need test-mode keys |
| App Store subscriptions (RevenueCat) | Implemented, not verified | Needs App Store Connect products, RevenueCat project, sandbox testers |
| iOS project compiles | Verified in CI | Unsigned Simulator build with Xcode 26.6, RevenueCat linked; not a signed device build |
| Signed iOS build / TestFlight | Blocked | Apple Developer account, signing secrets, deployed site |
| Production deployment | Blocked | Supabase project, Vercel project, domain, approval to deploy |
| Privacy policy and terms | Decision / review | Written from the code; business details and counsel review required |
| Physical-device testing | Blocked | Nothing has run on a real iPhone |

## 2. What changed on this branch

| Change | Why |
| --- | --- |
| Privacy policy and Terms of Service rewritten from the code, with draft gating (`src/app/legal/`) | Placeholders blocked submission (Apple 5.1.1(i)) |
| Shared Postgres rate limiting; new limits on sign-in, sign-up, emails, export, deletion | In-memory limits don't hold on serverless; auth had no app-level limits |
| Explicit AI-sharing consent before any coach request, enforced on the server and in the database | Apple 5.1.2(i): third-party AI sharing needs explicit permission |
| Recovery check-in consent trigger; consistent consent withdrawal; accurate admin-visibility copy | Consent was app-only for check-ins; unticking consent left data behind |
| Export includes custom program structure, Stripe customer and store subscription records | Export was incomplete |
| Pricing: Free + Pro $19.99/month, $149.99/year; Plus legacy; checkout refuses mismatched Stripe prices | Confirmed pricing; prevents charging a different amount from the one shown |
| App Store subscriptions through RevenueCat (ported from `claude/stage2-store-billing`) | Apple 3.1.1: digital subscriptions in an iOS app need in-app purchase |
| iOS: `arm64` device capability; privacy manifest adds photos and user ID | `armv7` is wrong for iOS 15+; manifest didn't match collection |
| PostCSS override for Next 15.5.28 | Production dependencies now audit clean |
| CI can be run manually on any branch | Lets integration tests run without opening a pull request |

## 3. Environment variables

Secrets marked **server** must only be set on the server (Vercel project settings). Never commit real values.
`NEXT_PUBLIC_*` values are compiled into the browser bundle and are public by design.

| Variable | Required | Scope | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Yes | public | Production origin (auth email links, Stripe return URLs, CSRF origin check) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | public | Supabase anon key (RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes in production | **server** | Webhooks, AI metering, shared rate limits, account deletion, admin metrics. Bypasses RLS |
| `ANTHROPIC_API_KEY` | For the AI coach | **server** | Coach is disabled without it |
| `AI_MODEL` | No | server | Defaults to `claude-opus-5-5` |
| `AI_RATE_LIMIT_PER_MINUTE` | No | server | Per-member AI burst limit (default 6) |
| `STRIPE_SECRET_KEY` | For web payments | **server** | Checkout, portal, cancellation on deletion |
| `STRIPE_WEBHOOK_SECRET` | For web payments | **server** | Verifies webhook signatures |
| `STRIPE_PRICE_PRO` | For web payments | server | Pro monthly price (USD, monthly, $19.99) |
| `STRIPE_PRICE_PRO_YEARLY` | Optional | server | Pro yearly price (USD, yearly, $149.99); yearly option hidden without it |
| `STRIPE_PRICE_PLUS` | Only if Plus subscribers exist | server | Lets legacy Plus webhooks map to Plus |
| `PLAN_PRO_PRICE_CENTS`, `PLAN_PRO_YEARLY_PRICE_CENTS`, `PLAN_PLUS_PRICE_CENTS` | No | server | Displayed prices (defaults 1999 / 14999 / 999). Checkout refuses a Stripe price that differs |
| `PLAN_*_AI_MONTHLY_LIMIT`, `PLAN_PRO_AI_PLAN_MONTHLY_LIMIT` | No | server | AI allowances |
| `REVENUECAT_SECRET_API_KEY` | For App Store purchases | **server** | Reads and deletes RevenueCat customers |
| `REVENUECAT_WEBHOOK_AUTH` | For App Store purchases | **server** | Exact `Authorization` header value configured on the RevenueCat webhook |
| `REVENUECAT_PUBLIC_KEY_IOS` | For App Store purchases | public (sent to the app) | RevenueCat iOS SDK key (`appl_…`) |
| `REVENUECAT_PUBLIC_KEY_ANDROID` | Not used yet | public | Android purchases aren't set up |
| `REVENUECAT_ENTITLEMENT_PRO` / `_PLUS` | No | server | Entitlement identifiers (defaults `pro` / `plus`) |
| `REVENUECAT_PRODUCTS_PRO_MONTHLY` / `_YEARLY` | No | server | App Store product ids (defaults `ngf_pro_monthly` / `ngf_pro_yearly`) |
| `REVENUECAT_ALLOW_TEST_STORE` | No | server | Development only; must be `false` in production |
| `USDA_FDC_API_KEY` | For food search | **server** | USDA FoodData Central; built-in foods work without it |
| `CAP_SERVER_URL` | For native builds | build-time | Deployed HTTPS URL the iOS/Android shells load |
| `CAP_APP_ID` | For native builds | build-time | Bundle identifier (default `com.narrowgatefitness.app`) |

## 4. Deployment (web)

Follow `SETUP.md` §4 for creating the Supabase and Vercel projects. Additional production notes:

1. **Migrations.** Apply with `npx supabase db push` against the linked project. All migrations on this branch are additive
   (new tables, columns, functions and triggers; no drops of user data). Migrations added here:
   `20261027000001_shared_rate_limits`, `…02_ai_consent`, `…03_recovery_consent`, `…04_store_subscriptions`.
   Take a backup first (Supabase dashboard → Database → Backups) and apply to a staging project before production.
   - `…03_recovery_consent` adds a trigger that refuses recovery check-ins without wellness consent. Existing check-ins aren't
     changed, but an existing check-in for a member without consent can no longer be *updated*. Check first:
     `select count(*) from recovery_checkins r join profiles p on p.id = r.user_id where p.wellness_consent_at is null;`
     If that isn't 0, decide whether to delete those rows (they were stored without consent) before applying.
2. **Auth URLs.** Site URL = production origin; redirect URLs `https://<domain>/**`. Configure custom SMTP (Supabase's
   built-in email is rate-limited and not for production).
3. **Auth rate limits.** Sign-in and sign-up calls are made from the server, so Supabase's per-IP auth limits see the
   server's address, not the member's. The app now applies its own per-IP and per-email limits; review Supabase's
   `auth.rate_limit` settings so legitimate traffic from the server isn't throttled.
4. **Function duration.** The AI chat route sets `maxDuration = 120`. Confirm the Vercel plan allows it.
5. **Webhooks.** Stripe → `https://<domain>/api/stripe/webhook` (events: `checkout.session.completed`,
   `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`). RevenueCat → `https://<domain>/api/revenuecat/webhook`
   with an `Authorization` header equal to `REVENUECAT_WEBHOOK_AUTH`.
6. **Backups and recovery.** Daily backups and point-in-time recovery depend on the Supabase plan. Record the retention
   period (it's also needed for the privacy policy). Test a restore into a staging project once before launch.
7. **Logging and error reporting.** Server errors are logged as JSON to the platform logs (`src/server/log.ts`) without
   request bodies or personal data. There is no error-reporting service (e.g. Sentry) yet; see §8.
8. **Security headers** are set in `next.config.ts` (`nosniff`, `DENY` framing, referrer policy, camera limited to self).
   There's no Content-Security-Policy yet; see §8.
9. **Rollback.** Vercel keeps previous deployments; promote the last good one. Database migrations aren't rolled back
   automatically; because these are additive, older app versions keep working with the newer schema.

Do not deploy to production, change DNS or apply migrations to a production database without the owner's approval.

## 5. Subscriptions and payments

Plans (confirmed): **Free**, and **Pro** at **$19.99/month** or **$149.99/year** (same features). **Plus** ($9.99) is
legacy: not sold to new members; existing Plus subscriptions keep their access through Stripe webhooks.

**Web (Stripe).** Create products and prices in Stripe **test mode** first: a monthly USD price of 1999 and a yearly USD price
of 14999. Put their ids in `STRIPE_PRICE_PRO` / `STRIPE_PRICE_PRO_YEARLY`. Checkout retrieves the price and refuses to start if
its amount, currency or interval differs from the app's displayed price. Configure the Billing Portal (allow cancellation and
switching between the two Pro prices). Test checkout, renewal (Stripe test clocks), cancellation, failed payment and refund
before going live. Do not create live products or enable live keys without the owner's approval.

**iOS (App Store through RevenueCat).**

1. App Store Connect: create an auto-renewable subscription group with `ngf_pro_monthly` ($19.99) and `ngf_pro_yearly`
   ($149.99), including review screenshots and descriptions. Agree to the Paid Apps agreement and add banking and tax details.
2. RevenueCat: create a project and an iOS app with the App Store Connect shared secret / in-app purchase key; create an
   entitlement `pro` attached to both products; put both products in the current offering.
3. Set `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_PUBLIC_KEY_IOS` and `REVENUECAT_WEBHOOK_AUTH`; add the webhook.
4. Test with sandbox testers: buy monthly and yearly, switch, cancel, restore on a reinstall, restore on another account,
   refund, billing problem. The server only grants access after reading the purchase back from RevenueCat.

**Rules that matter for review.** Inside the iOS app, website prices and Stripe checkout are hidden (guideline 3.1.1). Members
who subscribed on the web keep their plan in the app and aren't sold a second subscription. Deleting an account warns App Store
subscribers that the store subscription must be cancelled in their Apple Account.

## 6. iOS build and TestFlight

Facts from the project: display name "Narrow Gate Fitness", bundle id `com.narrowgatefitness.app` (change to one you own),
version 1.0.0 (build 1), iOS 15.0 minimum, iPhone and iPad, `arm64`, camera usage description present, export compliance
declared (`ITSAppUsesNonExemptEncryption = false`), privacy manifest present. The app is a Capacitor shell that loads the
deployed site (`CAP_SERVER_URL`); the offline edition (`CAP_MODE=standalone`) is only for testing.

1. Deploy the site (§4) so the app has an HTTPS URL to load.
2. Apple Developer: create the App ID, then the App Store Connect app record.
3. Add the GitHub secrets `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64` (see `.github/workflows/ios.yml`).
4. Run the iOS workflow with `job = testflight`, `edition = online`, `server_url = https://<domain>`. Or archive in Xcode
   (`npm run cap:ios`) after `CAP_SERVER_URL=https://<domain> npm run cap:sync`.
5. In TestFlight, add internal testers and run the device checks below.

**Device checks (none have been done).** Sign-up and email confirmation (links open in the browser; there are no Universal Links),
sign-in and sign-out, onboarding, workout logging including going offline mid-workout, camera barcode scanning, progress-photo
capture and upload, rest-timer and workout-reminder notifications, AI consent and chat, sandbox purchase and restore, account
deletion, safe areas and keyboard behaviour on a notched iPhone, the offline error page when the site is unreachable, and the
layout on iPad (it's a supported device, so App Review will try it).

## 7. App Store submission checklist

| Requirement | Status |
| --- | --- |
| In-app account deletion (5.1.1(v)) | Implemented (Profile → Privacy & data) |
| Privacy policy link in the app and in App Store Connect (5.1.1(i)) | In-app link done; publish the policy and enter its URL |
| App Privacy answers match collection | Use `docs/legal-review.md`; the privacy manifest was updated on this branch |
| Third-party AI disclosure and consent (5.1.2(i)) | Implemented |
| In-app purchase for digital subscriptions (3.1.1) | Implemented; needs products, RevenueCat and sandbox testing |
| Subscription terms next to purchase (3.1.2) | Price, period, auto-renewal, Terms and Privacy links, Restore purchases |
| Health claims (1.4.1) | Not-medical-advice wording in the app, coach and legal pages; AI prompt avoids diagnosis |
| Minimum functionality for web-based apps (4.2) | **Risk**: the app loads a website. Native features: haptics, local notifications, camera. Reviewers may still object |
| Review account | **Needed**: create a review member and give it Pro for the review (see below) |
| Placeholder content | Legal pages are labelled drafts until completed; no other placeholders found in user-facing screens |
| Licensed content | Exercise videos are only links or admin-added embeds with a licence field; KJV scripture must be proofread (`IMPLEMENTATION_STATUS.md`) |
| iPad support | **Decision**: keep iPad (needs iPad screenshots and layout checks) or make the app iPhone-only |

**Review account.** Create a normal account for App Review, complete onboarding, then grant Pro so reviewers can see paid
features without purchasing (they can also test the sandbox purchase): run in the Supabase SQL editor
`update user_entitlements set plan = 'pro', source = 'admin' where user_id = '<review user id>';`. Put the credentials only in
App Store Connect's review notes, not in the repository.

## 8. Known limitations and risks

- **Minimum functionality (4.2).** A web app in a native shell is a common rejection reason. HealthKit, push notifications or
  more native features would reduce the risk. The newer branches in this repository contain HealthKit work that isn't on `main`.
- **No Universal Links.** Confirmation and password-reset emails open the browser, not the app.
- **No error-reporting service.** Only platform logs. Consider Sentry with personal-data scrubbing (needs an account and DSN).
- **No Content-Security-Policy.** Adding one needs care because of Stripe, Supabase, YouTube/Vimeo embeds and Next.js inline scripts.
- **Android purchases not set up.** The Android app shows "in-app purchases aren't available yet".
- **Feature allocation.** Plans keep `main`'s features (Free has no food tracking or AI). The newer `claude/free-pro-membership`
  branch made food tracking free; that's a product decision not applied here.
- **Unmerged work.** `main` is far behind a chain of open pull requests (#3–#8) with features and fixes not on this branch.
  Decide whether to merge, port or close them.
- **Dev-tool advisories.** `npm audit` reports `sharp` (via `@capacitor/assets`) and `tar` advisories in development tools
  only; they don't ship in the app.
- **Node version.** `@zxing/library` declares Node ≥ 24; CI uses Node 22. It's a browser library and builds fine, but
  consider moving CI to Node 24.
- **AI output quality and safety** haven't been evaluated with real model calls (no API key here). Review real conversations,
  especially injury, dieting and supplement questions, before launch.
- **USDA and Open Food Facts** weren't called live. Open Food Facts data is crowd-sourced and labelled as such.
- **Scripture text** must be proofread against an authoritative KJV source.

## 9. Test results (this branch)

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run test:unit` | Passed: 193 tests in 24 files |
| `npm run build` | Passed |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Migrations on PostgreSQL 16 with Supabase stubs | All 12 applied; rate limiter, AI-consent and recovery-consent triggers checked with SQL |
| `npm run test:integration` (local) | Not run locally: Supabase Docker images couldn't be pulled here (registry rate limits / blocked) |
| `npm run test:e2e` | Not run: same blocker |
| CI (`ci.yml`: typecheck, lint, unit, build, integration) on the branch head | Passed; integration 57 tests in 9 files, 0 skipped ([run 40431375340](https://github.com/Joshfit77/Testing-testing-testing/actions/runs/40431375340)) |
| iOS Simulator compile (`ios.yml`, offline edition, unsigned) | Passed: `BUILD SUCCEEDED`, Xcode 26.6, RevenueCat linked ([run 40430900952](https://github.com/Joshfit77/Testing-testing-testing/actions/runs/40430900952)) |
| Physical device, TestFlight, sandbox or live purchases | Not done |

## 10. Remaining blockers (priority order)

| # | What's missing | Why it matters | Needs | Next action | Blocks |
| --- | --- | --- | --- | --- | --- |
| 1 | Supabase production project with migrations applied | Nothing works without the database | Account + approval | Create the project, back up, `supabase db push` (§4) | TestFlight, launch |
| 2 | Deployed HTTPS site (Vercel) with production env | The iOS app loads this site | Account + approval | Import the repo into Vercel, set §3 variables, deploy | TestFlight, launch |
| 3 | Apple Developer account, App ID, App Store Connect record, signing secrets | Required to sign and upload | Account + credentials | Enroll, create the record, add the four GitHub secrets (§6) | TestFlight |
| 4 | Business details and legal review of the privacy policy and terms | Apple requires a published policy; current pages are drafts | Human + counsel | Fill `src/app/legal/legal-details.ts` and the two configs; counsel review | Submission |
| 5 | App Store subscription products and RevenueCat project | In-app purchase is required for Pro in the iOS app | Accounts | Create products and entitlement, set RevenueCat env (§5) | Submission |
| 6 | Sandbox purchase testing | Purchases have never run end to end | Device + sandbox testers | Run the §5 purchase scenarios on TestFlight | Submission |
| 7 | Device testing (§6 checklist) | Camera, notifications, offline and layout never tested on hardware | iPhone (and iPad) | Run the checklist on TestFlight | Submission |
| 8 | Stripe test-mode run, then live-mode approval | Web payments untested against Stripe | Stripe account + approval | Create test prices, run checkout/portal/cancel/refund (§5) | Web paid launch |
| 9 | Review account with Pro | Reviewers must reach paid features | Human | Create it and grant Pro (§7) | Submission |
| 10 | Browser end-to-end tests | The Playwright suite hasn't run on this branch | A machine with Docker access | `npx supabase start && npm run build && npm run test:e2e` | Confidence for launch |
| 11 | iPad decision | iPad support means iPad screenshots and review on iPad | Owner decision | Keep (and test) or set the device family to iPhone only | Submission |
| 12 | Minimum-functionality risk (4.2) | Possible rejection of a web-based app | Owner decision | Decide whether to add HealthKit or push before submitting | Possibly submission |
| 13 | Custom SMTP, backup retention, error reporting | Production email delivery, recovery, visibility | Accounts | Configure SMTP; record backup retention; optionally add Sentry | Launch |
