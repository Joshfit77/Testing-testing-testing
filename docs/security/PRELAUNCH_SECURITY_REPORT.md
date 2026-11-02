# Narrow Gate Fitness: pre-launch security, payment and launch-readiness report

Branch: `security/payment-hardening-prelaunch` (based on `claude/exercise-demo-25d`, see "Starting point"). Date: 2026-11-01.
Nothing was merged, deployed or published. No live credentials, subscriptions, customers or production data were
touched. No purchases were made.

How each result was obtained is stated next to it:

- **automated test**: a test in this repository that was run for this report;
- **static inspection**: reading the code or configuration;
- **local stack**: the local Supabase stack in Docker, with disposable accounts;
- **CI**: GitHub Actions runners;
- **not verified**: needs access or hardware this work did not have.

No physical iPhone, App Store Connect, RevenueCat dashboard, Stripe account or hosted Supabase project was available.

---

## A. Executive summary

**Starting point.**
- `main` is 279 commits behind the working line of the app. It has Stripe web checkout but no App Store purchases.
- The App Store / RevenueCat integration, the Free and Pro plans, account deletion and the earlier security work all
  live on unmerged branches. `claude/exercise-demo-25d` contains all of them, so this branch starts from there.
- Basing it on `main` would have meant rebuilding that work. Merging into `main` is the owner's decision.

**What was inspected.**
- Payments: the Stripe checkout, portal and webhook path; the RevenueCat webhook, sync and native paywall; and the
  entitlement logic that turns both into Free or Pro.
- Every server entry point to a paid feature.
- The AI coach's quota and the rate limiter.
- All 45 existing migrations (47 after this work), every RLS policy, function, grant and storage bucket.
- The full git history of every branch and tag, searched for secrets.
- Dependencies, CI workflows, and the iOS project configuration.

**What was confirmed and fixed** (details in B):

1. **Webhook events could be lost** (High). A second delivery of a Stripe or RevenueCat event that arrived while the
   first was still running was answered "already processed". If the first then failed, its row was deleted and the
   provider never retried, so a paid renewal, cancellation or refund could silently never apply. Events are now
   claimed under a lease, failures are kept and retried, and an in-progress event answers 409 so the provider retries.
2. **Older data could overwrite newer** (High). A delayed sync could store an older Stripe or RevenueCat state over a
   newer one; for example, a late "active" read could undo a cancellation. Both are now ordered by when the provider
   was read.
3. **Concurrent changes could leave a stale plan** (High). Two webhooks for the same member could leave their
   entitlement computed from an older picture. Entitlements are now written compare-and-set against a per-member
   billing version.
4. **Metadata could move a subscription** (High). A subscription's `metadata.user_id` was trusted over the
   customer → member link, so editing metadata could move a paid subscription to another member. The recorded link
   is now authoritative, and a conflict is refused and logged for review.
5. **Rate limits were per server instance** (High). On serverless hosting the in-memory limiter barely held. Limits
   are now shared through Postgres. Sign-in, sign-up, reset and confirmation emails, and password changes are now
   limited too.
6. **Free members could reach the paid program builder through the database API** (Medium, found by the database
   audit). Closed in the database and the app.
7. Lower-severity items:
   - Members could plant their own AI plan "proposal" and apply it.
   - A refunded legacy plan kept AI rights in one database rule.
   - TRUNCATE and other unused grants were held by member roles.
   - The phone kept the previous member's RevenueCat identity after sign-out.
   - Missed webhooks had no automatic repair.

**Already correct, and proven by tests in this work:**
- The AI quota is reserved atomically before any provider call. With 3 messages left, 10 simultaneous requests let
  exactly 3 through.
- Every paid feature is enforced on the server and in the database from the server-held entitlement. No client value
  (cookies, local storage, request fields, demo switches) can unlock it.
- Card data never touches the app.
- Members are isolated from each other in every private table and bucket.
- The service-role key never reaches the browser.

**What could not be verified:**
- Real App Store purchases on a device, TestFlight, and App Store Connect product setup.
- The RevenueCat and Stripe dashboards, and live or test-mode provider calls. The provider code was tested against
  local stand-ins.
- The hosted Supabase project's settings and applied migrations.
- Any physical iPhone.

**Can real users start paying?** Not yet. No known critical security issue remains in the code. But the payment
flows haven't been run end to end against the real providers, the app hasn't been tested on a real iPhone or
TestFlight, and the hosted environment hasn't been checked. See H.

---

## B. Findings

Severity: Critical, High, Medium, Low. Status: Fixed, Open, Blocked, Unverified.

| # | Issue | Sev | Evidence (before) | Impact | Resolution | Verification | Status | Blocker |
|---|---|---|---|---|---|---|---|---|
| F1 | Webhook event lost when two deliveries overlap and the first fails | High | `src/server/services/billing.ts` `handleStripeEvent` and `store-billing.ts` `handleRevenueCatEvent`: insert the id, delete it on failure, and answer 200 "duplicate" to any delivery that found the id | A renewal, cancellation or refund never applied | `claim_webhook_event` / `finish_webhook_event` (migration 046). States are processing, processed and failed, with a 120 s lease and takeover. A held lease answers 409 with `Retry-After`. Failures are recorded with a code only, never the message text. `src/server/services/webhook-events.ts` | `tests/integration/billing-integrity.test.ts`: busy → 409, failure recorded then retried, dead worker taken over, 8 simultaneous deliveries processed once. The same tests fail on the old code. | Fixed | — |
| F2 | An older provider read could overwrite a newer one | High | `syncSubscription` upserted whatever it read; the store sync deleted and upserted in separate calls | A cancelled member regains Pro, or a renewed member loses it, until the next event | `upsert_stripe_subscription` (ordered by `synced_at`); `apply_store_snapshot` (one transaction per member, ordered by when RevenueCat was read) | billing-integrity: "older read never overwrites a newer one", "older RevenueCat snapshot can't replace a newer one". Both fail on the old code. | Fixed | — |
| F3 | A concurrent recompute could store a stale entitlement | High | `recomputeEntitlement` read the rows, then upserted, with no guard | Wrong plan until the next event | `billing_state_versions` (bumped by triggers) and the `apply_entitlement` compare-and-set; the recompute retries if the rows changed | billing-integrity: a stale version is refused; 30 shuffled concurrent operations in each of three rounds (Stripe and App Store combined, cancel plus purchase, refund) end in the right plan, in 3 of 3 runs | Fixed | — |
| F4 | Subscription metadata could move a paid subscription to another member | High | `userIdForSubscription` preferred `metadata.user_id`; the upsert on `stripe_subscription_id` overwrote `user_id` | Pro granted to the wrong account; the payer loses access | The customer → member link is authoritative. Metadata naming someone else, or a member with a second customer, is refused (`OwnershipConflictError`; the event is kept as failed for review). The database refuses to re-point a stored subscription. | billing-integrity "metadata can't move a subscription", "can't attach someone else's subscription". These fail on the old code. | Fixed | — |
| F5 | Burst rate limits held in each server instance's memory | High | `src/server/rate-limit.ts` (in-memory Map) | On serverless hosting, flooding was barely limited | `rate_limit_hit`: an atomic sliding window in Postgres shared by all instances, with a per-instance fallback if the database is down. Keys hold no email or IP in clear. | billing-integrity: 40 simultaneous requests against a limit of 5 let exactly 5 through; a window-boundary burst can't double; a second "instance" sees the same count. Unit-tested fallback. | Fixed | — |
| F6 | No app-level limits on sign-in, sign-up, reset or confirmation emails, or password change | Medium | `src/server/actions/auth.ts` | Credential stuffing and email bombing are limited only by Supabase's per-server-address limits | Per hashed client address and per hashed email; skipped when no address is known. `AUTH_RATE_LIMIT_SCALE` can only raise the limits (for test runs). | Unit tests for the limiter; the e2e auth flows pass with the scale set | Fixed | — |
| F7 | A Free member could build a custom program through the database API (`source='starter'`, then relabel; contents editable) | Medium | `20261023000024_plan_enforcement.sql:76-87`; `20261016000002_rls_policies.sql:257-282` | The paid builder's result for free, and unbounded program rows | Migration 047: starter programs are created by the server only, `source` is immutable for members, and editing a member starter program's contents needs Plus/Pro. `src/server/services/custom-programs.ts` writes starter programs with the service role. | `tests/integration/pro-bypass.test.ts` (Free refused, Pro allowed) | Fixed | — |
| F8 | A member could plant an AI plan proposal and apply it as the coach's | Low | `…025:63-69`, `src/server/actions/coach.ts:32` | A plan saved without using a plan generation | Insert policy forbids `proposal`; apply reads assistant messages only | pro-bypass "can't plant an AI plan proposal" | Fixed | — |
| F9 | `has_ai_coach()` ignored a refunded or disputed period | Low | `…026:12-30` | A legacy subscriber keeps AI write rights after a refund | `and s.access_revoked_at is null` (migration 047) | static inspection, plus the migration applies cleanly | Fixed | — |
| F10 | Member roles held TRUNCATE, REFERENCES and TRIGGER, and write grants on billing tables (RLS was the only barrier) | Low | default ACL | One RLS mistake away from exposure | Revoked (migration 047) | `rls.test.ts`, billing-integrity "members can't write billing state" | Fixed | — |
| F11 | The phone kept the previous member's RevenueCat identity after sign-out | Low | `src/components/shell/sign-out-form.tsx` | On a shared phone, purchases could attach to the previous member's App Store identity until the paywall re-identified the device | `storeLogOut()` on sign-out | `tests/unit/store-logout.test.tsx` | Fixed; device behaviour unverified | — |
| F12 | No repair for webhooks lost for good, and no view of failed events | Medium | — | A member keeps a wrong plan until their next event | `/api/billing/reconcile` (Bearer `CRON_SECRET`): re-reads open Stripe subscriptions and expiring or troubled store subscriptions, and reports failed and stuck events | billing-integrity "scheduled reconciliation" (401 without the secret, repairs a missed renewal, no member data in the reply) | Fixed; **a schedule must be configured on the host** | No |
| F13 | Oversized or malformed Stripe webhook bodies were accepted | Low | `src/app/api/stripe/webhook/route.ts` | Memory and CPU spent on junk | 512 KB limit, event shape check, error replies without details | billing-integrity "forged, unsigned, wrongly signed, oversized and malformed" | Fixed | — |
| F14 | A member can repoint `user_programs.program_id` | Low | DB audit L1 | A bogus enrolment; paid content stays hidden | Migration 048: changing `program_id` under a member session needs `can_use_program` (the insert rule) | `low-findings.test.ts` F14: paid and someone's private program refused, other updates allowed. Fails with the old rules. | Fixed (2026-11-02) | — |
| F15 | Plan and consent triggers reveal another member's plan or consent status from error messages, given their UUID | Low | DB audit L2 | Small information leak | Migration 048: the six SECURITY DEFINER triggers skip a row that isn't the caller's own, so RLS refuses it with its usual message | `low-findings.test.ts` F15: four tables, RLS message only; the member's own limit and GPS checks still fire. Fails with the old rules. | Fixed (2026-11-02) | — |
| F16 | `legal_acceptances` rows are written by members with unvalidated version and hash | Low | DB audit L5 | Weaker evidence in a consent dispute | Migration 048: `legal_document_versions` lists published versions; every record must name one; only auto-renewal (from checkout) carries details; members no longer insert (the server records re-acceptance and checkout consent; sign-up records only listed versions) | `legal-acceptances.test.ts` (4 tests), `tests/unit/legal-versions-db.test.ts`. Fails with the old rules. | Fixed (2026-11-02) | — |
| F17 | Some foreign keys to another member's rows are unchecked; definer helpers can be called by `anon` | Low | DB audit L7, L8 | Existence checks only, no data | Migration 048: ten links must point at the member's own rows or the catalog (same error as a missing row); `program_of_week`/`program_of_day` answer only for programs the caller can see | `low-findings.test.ts` F17 (2 tests). Fails with the old rules. | Fixed (2026-11-02) | — |
| F18 | AI requests have no client request id, so a client retry after a delivered-but-lost reply counts twice against the member's own allowance | Low | `src/server/services/ai-coach.ts` | One extra unit of the member's own quota. Provider cost isn't affected, because each call is reserved before it is made. | The chat sends a request id and reuses it on a retry of the same text; the server returns the saved reply (no call, no charge), answers 409 while the first is still running, and re-answers a request abandoned for 4 min (`ai_messages.request_id`, unique per member) | `low-findings.test.ts` F18 (5 tests: replay, 409, abandoned, over the allowance, another member's id) | Fixed (2026-11-02) | — |
| F19 | The browser Content-Security-Policy keeps `'unsafe-inline'` for scripts | Low | `src/lib/security-headers.ts:4` | Weaker defence against injected script; no injection point was found (the two inline scripts are constants) | Per-request nonce from the middleware: `script-src 'self' 'nonce-…' 'strict-dynamic'`; Next.js and the root layout put it on every script; the static headers no longer carry a second policy. Every page now renders per request (a nonce needs it). | `e2e/csp-and-layout.spec.ts`: no CSP violation on signed-out and signed-in pages, every script tag has the nonce, a new nonce per response, injected inline script and event handler don't run; `security-headers.test.ts` | Fixed (2026-11-02) | — |
| F20 | Secrets in the repository and its history, dependencies and CI | — | — | — | — | — | See section B2 | — |

### B2. Secrets, dependencies and CI

**Secrets: no real secrets found.**
- **Scope:** every commit reachable from all 60 refs (392 commits, branches, tags and the stash), every unique blob,
  and the working tree, including build outputs, APKs and zips.
- **Tools:**
  - gitleaks 8.30.1 and trufflehog 3.99.7, both checksum-verified, with trufflehog's live verification off;
  - a targeted regex scan over all 10,883 blobs.
- **Searched for:** Supabase service-role keys and JWT secrets for a hosted project, Stripe live or test keys and
  webhook secrets, RevenueCat or Anthropic keys, database passwords, Apple `.p8`/`.p12`/profiles, Android keystores,
  OAuth or GitHub tokens, and production `.env` files.
- **Result:** none appears anywhere, and no hosted `*.supabase.co` project URL appears in any commit or build.
- **What was flagged was all safe:**
  - the Supabase CLI's published local demo JWTs (issuer `supabase-demo`, usable only against a local stack) in test
    helpers;
  - dummy test values;
  - false positives inside base64 images.
- **No rotation or history rewrite is needed.**
- 14 old commits carry a personal email address in their author metadata. Consider GitHub's noreply address for
  future commits.

**Dependencies.**
- `npm audit --omit=dev` reports **0 vulnerabilities** in production dependencies.
- The full audit reports 23, all in development-only tooling: 1 critical (`tar` via `@capacitor/assets`' bundled old
  CLI), 3 high (`sharp` and the same chain) and 19 moderate (eslint/glob/uuid chains).
- They don't ship in the app. The fixes are semver-major (`@capacitor/assets@4`), so they are left for a tested
  upgrade.

| # | CI / repository finding | Sev | Resolution | Status |
|---|---|---|---|---|
| C1 | The TestFlight job put the App Store Connect signing key and IDs in job-level `env`, so `npm ci` install scripts and `cap sync` could read them | High | Secrets set only on the steps that use them | Fixed (`07254e5`) |
| C2 | The demo deploy job exposed the service-role key, database URL and Vercel token to `npm ci` | High | `npm ci` runs with those values blanked | Fixed (`07254e5`); a protected Environment with reviewers is still recommended |
| C3 | No secret or dependency scanning, and no Dependabot | Medium | `security-scan` job in `ci.yml` (gitleaks over all history with a narrow allowlist, plus a production `npm audit` at `high`); `.github/dependabot.yml` | Fixed. Locally: 0 leaks over 373 commits, 0 production advisories |
| C4 | No `permissions:` in `ci.yml` and `ios.yml` | Medium | `contents: read` | Fixed |
| C5 | Android Play signing step ran on pushes when secrets were set | Medium | Signing only on manual runs | Fixed |
| C6 | Actions pinned to moving tags | Low–Medium | Pinned to the commit SHAs their `v4` tags point to today | Fixed |
| C7 | `.gitignore` didn't cover `.env.*`, `.p8`/`.p12`/`.pem`, `.keystore`/`.jks`, `keystore.properties`, service-account JSON | Low | Added (none were ever committed) | Fixed |
| C8 | `android-apk.yml`, `bsb-text.yml` and `food-db.yml` grant `contents: write` workflow-wide; the data downloads have no checksum | Medium | Each split into a read-only build job and a publish job, the only one with `contents: write` (+ `actions: read`), which runs no repository code: it downloads the build's artifact with `gh`, checks its SHA-256 and replaces the release. Downloads HTTPS-only and pinned: the BSB text to the SHA-256 recorded in `src/data/bsb-passages.json`, the USDA SR Legacy 2018-04 zip to `b8081729…6fd0`. Push triggers unchanged; a manual run publishes only with `publish` ticked; `dry_run` exercises the publish job without changing the release. | Fixed (2026-11-02); dry runs on GitHub, see E |
| C9 | Repository settings that can't be seen from here: secret scanning and push protection, branch/tag protection, default token permissions | — | Turn on GitHub secret scanning and push protection (free for public repos) | Owner action |
| C10 | Found by zizmor in the other workflows: every checkout kept the job token in git config for later steps (`ci`, `ios`, `android-play`, `demo-preview`); the demo deploy and the TestFlight job restored a shared npm cache in a job holding secrets | Medium | `persist-credentials: false` on every checkout (no job runs git afterwards); no package cache in those two jobs (`package-manager-cache: false`, for v5 and later too) | Fixed (2026-11-02); zizmor: 0 high, 0 medium across all 7 workflows |

---

## C. Payment security

**Implemented.**
- **Apple App Store (and Google Play) through RevenueCat.**
  - The native paywall: `src/components/profile/store-paywall.tsx` and `src/lib/billing/store-purchases.ts`.
  - The server sync: `src/server/services/store-billing.ts`.
  - The webhook: `src/app/api/revenuecat/webhook/route.ts`.
- **Stripe hosted Checkout and Billing Portal on the web**: `src/server/services/billing.ts` and
  `src/app/api/stripe/webhook/route.ts`.
- Inside the native app, web checkout refuses (Apple rule 3.1.1). The phone only sells through the App Store.

**Verified.**
- Both server paths: purchase, renewal, cancellation, billing issue with grace, expiry, refund, dispute, transfer to
  another account, duplicate and forged webhooks, concurrent and out-of-order events. All run against local stand-ins
  for the providers' APIs: `entitlements.test.ts` (12), `store-billing.test.ts`, `billing-integrity.test.ts` (16).
- **Not verified** against the real Stripe test mode, the RevenueCat sandbox or an App Store sandbox purchase on a
  device: no accounts or device were available.

**Who processes card data.**
- Apple processes App Store purchases.
- Stripe processes web payments on its hosted Checkout and Portal pages.
- The app never sees, stores or logs card numbers, CVCs or bank details. A search of the code, migrations and logging
  found no card fields, and the logger records error codes and short messages only.
- This puts the web side in the lowest PCI DSS self-assessment category for hosted payment pages (SAQ A). The owner
  still has to complete that questionnaire with Stripe; it isn't automatic.

**How Pro is protected.**
- Every paid feature checks the plan on the server, and every paid write also checks it in the database (RLS
  `has_plan`). The plan comes only from `user_entitlements`, which only the server's billing code writes.
- The app's word is never trusted. After a purchase or restore, the server asks RevenueCat what the member owns.
- Webhooks are verified by signature (Stripe) or a constant-time header check (RevenueCat), and the server then re-reads
  the provider instead of trusting the event body.
- Demo mode switches off every payment and AI key, and its Free/Pro switch only works for accounts the server marked
  as demo accounts (`tests/unit/demo-mode.test.ts`).
- Live Stripe keys are ignored until `STRIPE_LIVE_APPROVED=true`. App Store sandbox and RevenueCat Test Store
  purchases grant nothing unless explicitly allowed.

**Refunds, expiry and cancellation.**
- A full refund or a dispute of the current period's payment ends that period's access. A partial refund doesn't.
- A refund or dispute of an earlier period's payment leaves the current period alone. A won dispute restores access.
- Cancelling keeps access until the paid period ends. A billing problem keeps access during the store's grace period
  (`past_due`).
- Every entitlement carries `valid_until` and reads as Free once it has passed, even if a webhook never arrives.
- App Store refunds come through RevenueCat as a refund date and end access at that moment.

**Stripe and Apple together.**
- The highest valid plan wins.
- Web checkout refuses anyone who already has a membership, naming the App Store when that is where they pay.
- The phone's paywall refuses anyone billed on the web or in the other store, so nobody is offered a second
  subscription.
- Deleting an account cancels Stripe subscriptions. It can't cancel an App Store subscription, so the deletion screen
  and the terms tell the member to cancel it in their Apple account.

**Known unauthorized-access paths.** None found. The bypass attempts that were tried and refused:
- forged request fields;
- direct calls to the API and server actions;
- writing paid rows, entitlements or subscriptions with a member's own token;
- calling the billing functions;
- an expired grant;
- forged or replayed webhooks;
- metadata pointing at another member;
- demo switches.

---

## D. Database and privacy

- **Account isolation:** passed.
  - `cross-user-isolation.test.ts` (23 tests) covers every member-owned table and private bucket against a second
    member, an admin and an anonymous visitor.
  - Read-only probes as three real test users found no foreign rows. Details: `docs/security/DATABASE_AUDIT.md`.
- **Private photos:** the `progress-photos` and `body-scans` buckets are private, limited to the member's own folder
  for every operation, and signed with the member's own session.
- **Service-role key:** used only on the server, in 22 reviewed call sites. None acts on an id taken from request
  input. It is not in any browser bundle (production build searched).
- **Admin rights:** members can't change `profiles.role`, can't call admin functions, and can't read the audit log.
  This is tested in `account-security.test.ts` and `rls.test.ts`.
- **Export and deletion:**
  - `account-coverage.test.ts` fails the build if any member-linked table is missing from the export or from deletion.
  - `account-deletion.test.ts` deletes a real test account with rows and files.
  - Deletion cancels Stripe subscriptions first, and refuses to proceed if it can't tell which subscriptions exist.
- **Policies match the database:** for the local stack, yes; the replay diff was empty. For the hosted project, this
  is not verified.

---

## E. Test results (run for this report)

| Check | Before (baseline) | After | Notes |
|---|---|---|---|
| Type check (`tsc --noEmit`) | 0 errors | 0 errors | |
| Lint (`eslint .`) | 0 errors, 5 warnings | 0 errors, 5 warnings | Same 5 pre-existing warnings |
| Production build (`next build`) | pass | pass | |
| Unit tests | 2,780 / 2,780 | **2,787 / 2,787** | 130 files |
| Integration tests (local Supabase) | 208 passed, 1 skipped | **238 passed, 1 skipped, 0 failed** | The skipped file calls a live outside food service |
| New security regression tests | — | billing-integrity 16, pro-bypass 7, account-security 7, rate-limit 4, store-logout 3 | All pass |
| Same tests on the pre-change code | — | 8 of 13 runnable billing-integrity cases fail | Shows the defects were real |
| Database isolation | — | cross-user sweep 23/23; read-only probes 0 foreign rows | Local stack |
| Browser tests (Playwright, Chromium at phone size): opening, navigation, onboarding, builder, memberships, store billing, core flow | — | 22 / 22, then 22 / 22 again on a stack recreated from the current config | The membership tests need an AI key configured on the server; they pass with a placeholder (no provider is called). The second run used the current confirmation-email template, after the helper fix in `ae1fc43`. |
| Secret scan, full history | — | 0 confirmed secrets | gitleaks + trufflehog + regex over 392 commits / 60 refs |
| Production dependency audit | — | 0 vulnerabilities | `npm audit --omit=dev` |
| iOS compile (GitHub macOS runner) | — | pass | Simulator build, unsigned (iOS run 53) |
| iOS opening and navigation tests in WebKit at iPhone 15 size (GitHub) | **fails** on the unchanged base `claude/exercise-demo-25d` (iOS run 52, `03f815a`) | **pass**, 13 / 13 (iOS run 53, `ae1fc43`) | The base fails because its sign-up helper waits for the wrong confirmation link (an existing break from `e4bf019`). `ae1fc43` fixes the helper. |
| iOS Simulator app test (XCUITest: launch, Enter Narrow Gate, relaunch, return from the background) | — | **pass** (iOS run 53) | The same job failed in runs 50 (`c9ce6a2`) and 51 (`54880e7`): `test0_freshLaunchPlaysTheOpeningAndEndsByItself` reported "opening not seen" in all 3 tries. Between those runs and run 53, the only iOS change was the workflow file's permissions, pinned actions and WebKit settings. The app, the opening and the XCUITest code were identical. So this test is timing-sensitive on GitHub's Mac runners. Not caused by this branch, but not root-caused either. A Simulator is not a physical iPhone. |
| Payment sandbox (Stripe test mode, App Store sandbox, RevenueCat) | — | **not run** | No accounts |
| Physical iPhone | — | **not run** | No device |
| TestFlight | — | **not run** | Needs the owner's Apple account and approval |

---

## F. Changes delivered

**Commits on `security/payment-hardening-prelaunch`:**

| Commit | What |
|---|---|
| `c9ce6a2` | Billing integrity: claimed webhooks, ordered writes, compare-and-set entitlements, shared rate limits, auth limits, reconciliation, RevenueCat sign-out |
| `c8d51ed` | Tests: Pro bypass attempts, shared rate limiter, RevenueCat sign-out |
| `4973c14` | Tests: account security against the auth server and the API |
| `38da14b` | Database: close the route to the paid program builder; AI proposals; grants |
| `54880e7` | Auth rate limits: test runs can raise them; no shared counter without a client address |
| `07254e5` | CI hardening: secret scanning, least-privilege tokens, pinned actions, scoped signing secrets; `docs/security/DATABASE_AUDIT.md` |
| `ae1fc43` | e2e: follow the confirmation link the app's email template sends (an existing break from `e4bf019`) |

**New files:**
- Migrations: `supabase/migrations/20261101000046_billing_integrity.sql` and
  `supabase/migrations/20261101000047_program_builder_enforcement.sql`.
- Server: `src/server/services/webhook-events.ts`, `src/server/services/billing-reconcile.ts` and
  `src/app/api/billing/reconcile/route.ts`.
- Tests: `tests/integration/billing-integrity.test.ts`, `tests/integration/pro-bypass.test.ts`,
  `tests/integration/account-security.test.ts`, `tests/unit/rate-limit.test.ts` and `tests/unit/store-logout.test.tsx`.
- Docs: `docs/security/DATABASE_AUDIT.md` and this report.
- CI: `.gitleaks.toml` and `.github/dependabot.yml`.

**Changed files:**
- Server: `src/server/services/billing.ts`, `store-billing.ts`, `custom-programs.ts`, `account.ts`, `ai-coach.ts`;
  `src/server/rate-limit.ts`, `src/server/env.ts`; `src/server/actions/auth.ts`, `coach.ts`, `demo.ts`, `profile.ts`,
  `plan-schedule.ts`, `store-billing.ts`.
- Routes and pages: both webhook routes, the export, food search and barcode routes, and two nutrition pages
  (shared limiter).
- Client: `src/lib/billing/store-purchases.ts` and `src/components/shell/sign-out-form.tsx`.
- Config and tests: `supabase/setup-all.sql` (regenerated), `.env.example`, `playwright.config.ts`, `.gitignore`;
  all seven `.github/workflows/*.yml` (permissions, scoped secrets, pinned actions, the scan job); three existing test
  fixtures (`entitlements`, `rls` and `workouts`), updated to the stricter rules; and `e2e/helpers.ts` plus
  `e2e/welcome-diets.spec.ts`.

**No pull request was opened.** The brief didn't ask for one; opening it against `main` is the owner's call.

**To reproduce:**

```bash
npm ci
npx supabase start            # local stack (Docker)
npx supabase db reset         # applies all 47 migrations
npm run typecheck && npm run lint && npm run test:unit
npm run test:integration      # needs the local stack; includes billing-integrity, pro-bypass, account-security
npm run build && npx playwright test --project=mobile   # set ANTHROPIC_API_KEY to any placeholder for the coach tests
```

---

## G. What needs access or a human

| Needs | What |
|---|---|
| **Owner approval** | Merge this branch (and the line it sits on) into `main`; approve live payments (`STRIPE_LIVE_APPROVED`); TestFlight upload; App Store submission |
| **App Store Connect / Apple Developer** | Create the subscription group and the two products (`ngf_pro_monthly`, `ngf_pro_yearly`, or set `REVENUECAT_PRODUCTS_*` to the real ids) at the approved prices; In-App Purchase capability on the App ID; signing; sandbox testers; privacy labels; the TestFlight build (`ios.yml`, job `testflight`, with the four secrets it names) |
| **RevenueCat dashboard** | Project, iOS app with the App Store shared secret / API key, entitlement `pro`, offering with monthly and yearly; webhook URL `/api/revenuecat/webhook` with a long random `Authorization` value matching `REVENUECAT_WEBHOOK_AUTH`; transfer behaviour "transfer to new App User ID" (what the tests assume) |
| **Stripe dashboard** | Test-mode prices ($19.99/month, $149.99/year), webhook endpoint and secret, Billing Portal settings; then a test-mode run of checkout, renewal, cancellation, refund and dispute against a deployed staging app |
| **Supabase (hosted staging and production)** | Apply migrations 046 and 047; confirm `supabase migration list`; run the integration suite against staging with disposable accounts; set auth settings to match `supabase/config.toml` (email confirmation on, secure password change, refresh-token rotation, password length) |
| **Hosting** | Set `CRON_SECRET` and call `/api/billing/reconcile` every 30 minutes; keep `AUTH_RATE_LIMIT_SCALE` unset; keep `DEMO_MODE` unset |
| **A physical iPhone** (several models if possible) | Everything in section 7.3 of the brief: install, sign-up, onboarding, purchase, restore, account switch, camera, GPS, Health, notifications, background/foreground, offline, deletion |
| **15+ TestFlight testers** | Recruit, feedback channel, crash reports |

---

## H. Launch verdict

**UNVERIFIED — ESSENTIAL TESTING OR ACCESS IS MISSING**

- **The code side.** All known Critical and High issues found here are fixed and covered by tests that failed before
  the fixes. The remaining app findings are Low (F14–F19). One Medium CI finding stays open (C8: three workflows
  with write access across the whole workflow and unchecked downloads). It changes how release files are published,
  so it's left for the owner's decision.
- **What is still unproven.**
  - Real payments: no sandbox purchase through the App Store or Stripe test mode has been made against a deployed app.
  - A real iPhone: none has run the app.
  - TestFlight: the build hasn't gone out.
  - The hosted database and auth settings: not checked.
- **Why not "ready" or "controlled beta".** The brief's own completion gates for Phases 6 and 7 require those, and they
  can't be met without the owner's accounts and a device.
- **Next step: controlled beta.** The app is in a state to move to a TestFlight beta once the owner completes the
  App Store Connect and RevenueCat setup above and approves the upload.
