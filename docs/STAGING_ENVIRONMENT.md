# Staging environment for the first TestFlight build

The internal TestFlight build loads a deployed copy of the web app. Its server address is set when the build is made.
Use a **separate staging deployment and a separate Supabase project**, never production. The staging deployment uses
disposable test accounts, Stripe **test mode**, and App Store **sandbox** purchases only. Nothing on this page has been set up
yet: every step needs your accounts. Nothing has been deployed, and no hosted database has been changed.

Branch and commit this was written against: `security/payment-hardening-prelaunch`. Migrations run up to
`20261102000048`.

## 1. Supabase staging project

1. Create a **new** project (for example `narrowgate-staging`), separate from any future production project.
2. Apply the schema, then the exercise and program catalog:
   ```bash
   npx supabase link --project-ref <staging-ref>
   npx supabase db push                       # applies all 45 files in supabase/migrations, in order
   psql "$STAGING_DB_URL" -f supabase/seed.sql   # catalog only (idempotent); no member data
   ```
   `npx supabase migration list` should then show every local migration as applied remotely, the last one being
   `20261102000048`. Checked locally only: the migrations apply in order to an empty database (`supabase db reset`),
   and the integration tests pass against the result. They have not been run against a hosted project.
3. **Auth → URL configuration.** Set Site URL to `https://<staging-domain>`. Add `https://<staging-domain>/**` to the
   redirect URLs.
4. **Auth → Email.** Keep "Confirm email" on. Add custom SMTP; Supabase's built-in sender is rate-limited, so testers'
   emails may not arrive.
5. **Auth → Email Templates.** Use `supabase/templates/confirmation.html` ("Confirm signup") and
   `supabase/templates/recovery.html` ("Reset password") by pasting them in the dashboard (do **not** run `npx supabase config push` against a hosted project: it would also push the local `site_url` and localhost redirect URLs from `supabase/config.toml`). Without them, a password
   reset requested in the iPhone app fails when its link opens in Safari.
6. **Storage.** The migrations create the buckets: `avatars`, `progress-photos` and `body-scans` are private, and
   `exercise-media` is public (admin uploads only). Check them under Storage after `db push`.

**Rollback.** Migrations are forward-only and contain no down scripts. On staging the recovery is:
- take a backup before `db push` (Database → Backups, or `supabase db dump -f staging-before.sql`);
- if a migration fails, `db push` stops at that file and the earlier ones stay applied;
- fix it with a new migration, or restore the dump into a fresh staging project.

Never edit a migration that has already been applied. Production needs the same backup first, plus your go-ahead.

## 2. Hosting (Vercel or any Node host), staging deployment

Deploy the branch you want to test. The iPhone app shows whatever this deployment serves, and
`/api/health` reports its commit.

| Variable | Staging value | Production differs? |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<staging-domain>` | its own domain |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | staging project (Project Settings → API) | production project |
| `SUPABASE_SERVICE_ROLE_KEY` | staging project's service-role key (server only, never in the app) | production project |
| `CRON_SECRET` | long random value; schedule `POST /api/billing/reconcile` every 30 min with `Authorization: Bearer <value>` | own value |
| `ANTHROPIC_API_KEY` | optional; blank turns the AI coach off cleanly. A paid key costs money, so only add one if you decide to. | — |
| `COACH_MODEL_FAST`, `COACH_MODEL_SMART`, `AI_RATE_LIMIT_PER_MINUTE` | leave unset (defaults) | — |
| `STRIPE_SECRET_KEY` | **`sk_test_…` only** | live key only after you approve real charges |
| `STRIPE_LIVE_APPROVED` | **unset** (a live key is then ignored) | `true` only with your approval |
| `STRIPE_WEBHOOK_SECRET` | from the test-mode webhook endpoint `https://<staging-domain>/api/stripe/webhook` | live endpoint's |
| `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PRO_YEARLY` | test-mode prices of exactly $19.99/month and $149.99/year (checkout refuses any other amount) | live prices |
| `STRIPE_PRICE_PLUS*`, `STRIPE_PRICE_*_LEGACY` | unset (Plus isn't sold; only for existing Plus subscribers) | only if Plus subscribers exist |
| `REVENUECAT_SECRET_API_KEY` | RevenueCat secret key (server only) | same project or a production one |
| `REVENUECAT_WEBHOOK_AUTH` | the exact Authorization header you set on the RevenueCat webhook to `https://<staging-domain>/api/revenuecat/webhook` | own value |
| `REVENUECAT_PUBLIC_KEY_IOS` | `appl_…` (public SDK key) | — |
| `REVENUECAT_ENTITLEMENT_PRO` | `pro` (default) | — |
| `REVENUECAT_PRODUCTS_PRO_MONTHLY`, `…_YEARLY` | the App Store product IDs you create (defaults `ngf_pro_monthly`, `ngf_pro_yearly`) | — |
| `REVENUECAT_ALLOW_SANDBOX` | `true` on staging (every account's TestFlight purchases, always sandbox and never charged, unlock Pro) or `false` with the sandbox tester allow-list | **`false`**: App Review's demo account and TestFlight testers go on the sandbox tester allow-list (docs/MOBILE_BILLING.md "Sandbox purchases") |
| `REVENUECAT_ALLOW_TEST_STORE` | unset | never `true` |
| `LEGAL_TERMS_URL`, `LEGAL_PRIVACY_URL` | unset until counsel-reviewed documents exist (the app then links its drafts, marked as drafts) | final URLs |
| `USDA_FDC_API_KEY` | optional free key; blank searches the bundled USDA database | — |
| `FOOD_IQ_SCORE` | unset (off) until the method is reviewed | — |
| `AUTH_RATE_LIMIT_SCALE` | unset | unset |
| `DEMO_MODE` | **unset** (`true` turns off accounts' payments and AI and shows the demo banner) | unset |

Leave the `PLAN_*` overrides unset: the defaults are the approved prices and limits.

## 3. GitHub repository secrets, for the TestFlight job

Settings → Secrets and variables → Actions. These are never printed. The workflow writes the key file only for the
signing steps, then deletes it.

| Secret | Where it comes from |
|---|---|
| `APPLE_TEAM_ID` | Apple Developer → Membership details (10 characters) |
| `ASC_KEY_ID` | App Store Connect → Users and Access → Integrations → App Store Connect API → key ID |
| `ASC_ISSUER_ID` | the same page, "Issuer ID" |
| `ASC_KEY_P8_BASE64` | the downloaded `AuthKey_<id>.p8`, base64-encoded (`base64 -i AuthKey_<id>.p8 \| pbcopy` on a Mac) |

Give the key the **Admin** role: automatic signing needs it to create the distribution certificate and profile.

## 4. Smoke test on staging, before building for TestFlight

1. Open `https://<staging-domain>/api/health`: it answers `{"data":{"app":"narrow-gate-fitness","commit":…}}`. On Vercel
   the commit is filled in; on another host, set `NGF_BUILD_SHA`.
2. Sign up with a test address. The confirmation email arrives, and its link opens onboarding.
3. Log a workout, a meal and a journal entry. Sign out, then sign in again: everything is still there.
4. In a Stripe test-mode checkout, pay with card `4242 4242 4242 4242`. Pro unlocks. Cancel it in the Stripe
   dashboard: Pro ends when the period does.
5. Request a password reset and open the link on another device: the reset page opens.
6. Delete the test account (Profile → Delete account). Signing in with it fails, and its rows and files are gone.
