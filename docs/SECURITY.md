# Security notes

## In the code

- **Headers** (`src/lib/security-headers.ts`, wired up in `next.config.ts`).
  - Content-Security-Policy: own origin, Supabase, Stripe's hosted pages, the YouTube/Vimeo embeds, no plugins, no
    framing. `'unsafe-eval'` is allowed only in development. `'unsafe-inline'` scripts stay, because Next streams inline
    hydration scripts and the layout applies display settings before first paint.
  - HSTS and `upgrade-insecure-requests` are sent when `NEXT_PUBLIC_SITE_URL` is https.
  - Also nosniff, frame denial, a referrer policy, a permissions policy and COOP.
- **Auth.**
  - Every request is checked with `supabase.auth.getUser()`, which validates the session with Supabase Auth.
  - Post-login redirects only go to same-site paths (`safeNextPath`).
  - Passwords need 8+ characters with a letter and a number, in the app and in `supabase/config.toml`.
  - `secure_password_change` makes an old session sign in again before changing the password.
  - Reset and confirmation emails are limited to one per 60 s.
- **Data isolation.**
  - Every personal table has owner-only row level security (`tests/integration/rls.test.ts` and each feature's
    integration test).
  - Progress photos are in a private bucket and are served through short-lived signed URLs.
  - Journal entries reach the AI coach only when the person ticks "Share with AI Coach" on that entry.
- **AI coach.**
  - Plus/Pro only, with monthly quotas per plan and a cap on reply length.
  - Burst limit per user (`AI_RATE_LIMIT_PER_MINUTE`, default 6), enforced in memory and against the
    `ai_usage_events` table, so it holds across server instances.
- **Billing.**
  - The Stripe webhook verifies its signature on the raw body and is idempotent through `stripe_events`.
  - Plans are derived only from server-side subscription rows.
- **Account deletion** (Profile → Privacy & data; `src/server/services/account-deletion.ts`). It requires typing
  DELETE and the account password (5 tries per 15 minutes). It then runs four steps:
  1. Cancel Stripe subscriptions. On failure nothing is deleted.
  2. Remove stored files.
  3. Delete the auth user. Every personal table cascades from it, which `tests/unit/account-coverage.test.ts`
     enforces.
  4. Delete the Stripe customer. This is best effort; a failure is logged with the customer id.

  Each kind of failure tells the person exactly what did and didn't happen. The session is signed out and the
  device's local data is cleared. `tests/integration/account-deletion.test.ts` checks against a real database that the
  auth user, every personal row and the stored files are gone, that an old access token no longer resolves, and that
  other users' data is untouched.

## Database audit (live catalog, local stack)

- **Row level security:** on for every table in `public`. No security-definer function is missing a pinned
  `search_path`.
- **Anonymous access:** only the public catalog can be read without signing in: exercises, exercise media and
  alternatives, training programs and their weeks, days and exercises, program categories, published content and
  feature flags.
- **Personal tables:** every policy is limited to `auth.uid()` or to admins. The one exception, a policy on
  `user_programs` that checks the program is visible, is RESTRICTIVE, so it adds to the ownership rule instead of
  replacing it.
- **Storage:** `avatars` and `progress-photos` are private with one folder per user. `exercise-media` is public to
  read and only admins can write to it. Each bucket has a size limit and accepts only image or video types.
- **Profiles:** users can update only their own non-sensitive columns. Role, plan and billing can't be changed from
  the client.
- **Table grants:** `anon` and `authenticated` hold Supabase's default grants, and row level security is what
  protects the rows. The API never exposes TRUNCATE.
- **Regression test:** `tests/unit/rls-coverage.test.ts` fails if a future migration adds a table without row level
  security, gives anonymous users a policy on a personal table, or adds a security-definer function without a
  pinned `search_path`.

## Needs setting outside the code

- **Supabase dashboard (production project) → Authentication.**
  - Minimum password length 8, with letters and digits.
  - Turn on "Secure password change".
  - Email rate limits as in `supabase/config.toml`.
  - Leaked-password protection, if your plan has it.
- **Hosting:** set `NEXT_PUBLIC_SITE_URL` to the https URL so HSTS is sent, and keep `SUPABASE_SERVICE_ROLE_KEY`,
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `ANTHROPIC_API_KEY` as server-only environment variables.
- **Anthropic console:** set a monthly spend limit for the API key.
- **Stripe:** restrict the API key to the resources the app uses, if you use restricted keys.

## Known limits

- The iPhone app opens Stripe Checkout for Plus/Pro. Apple's App Review Guideline 3.1.1 normally requires
  In-App Purchase for digital subscriptions bought inside an iOS app, so expect review questions until the app
  either uses In-App Purchase or doesn't offer purchase on iOS.
- Apple and Google in-app subscriptions don't exist yet. The deletion screen tells people to cancel those in their
  phone's settings, for when they're added.
- A deleted user's access token is a signed JWT that stays valid until it expires (up to 1 hour). The server always
  re-checks the user with Supabase Auth, and their rows are gone, so it can't read anything.

## Launch-readiness review (23 October 2026, branch `claude/sharp-cray-8y0uuv`)

Two independent, read-only reviews of the code (one for the new Sleep & Recovery feature, one for the rest of the
app) checked every claim above against the migrations and server code. The isolation, authorization, consent,
webhook, private-storage and export/deletion claims all held. Nothing was exercised dynamically and no penetration
test was done; the Supabase, Stripe and RevenueCat dashboards, production environment values, host request-body
limits and the native iOS/Android projects were not inspected.

Fixed on this branch as a result:

- RevenueCat: App Store / Play **sandbox purchases no longer grant entitlements** unless `REVENUECAT_ALLOW_SANDBOX=true`
  (keep it unset in production; TestFlight testers otherwise got Pro for $0).
- Stripe: a checkout is refused when Stripe already has an open subscription for the customer (two tabs or a retry
  before the webhook could create two subscriptions); account deletion cancels the subscriptions Stripe lists, not
  only the ones in the local table; an **expired admin grant no longer blocks** a paid subscription from being written.
- AI spend: chat replies are capped at 12k output tokens (plan generation keeps 16k) and the history sent back per
  request is budgeted at 24k characters on top of the per-message cap; the monthly request quota is unchanged.
- Account deletion follow-up logs now carry the Stripe customer id / user id they exist for.
- Withdrawing wellness consent asks for confirmation, flips the flag before deleting, and says that sleep entries
  stay until deleted under Sleep & Recovery.
- Food logging has an idempotency key (`meal_items.client_id`, unique per member) so a retried request can't log an
  item twice; the meal-photo upload requires a numeric `Content-Length`; the password-change error no longer echoes
  the auth provider's text; signing out forgets the device's drafts.
- Bounds: `training_adjustments.changes` and `profiles.avatar_path` are size-checked; `profiles.sleep_alarm` and
  `sleep_tips_dismissed` too; `user_id` indexes added on `workout_sets`, `meal_items`, `ai_messages`,
  `recipe_ingredients` and `workout_template_exercises`.
- Sleep: the coach only sees sleep through `get_sleep_summary` (no sleep line in every prompt), the training review
  stops using sleep once wellness consent is withdrawn, imports validate record by record, stage rows are capped per
  session, and the session cap never touches another member's advisory lock.

Still open (decisions or work for the owner, none blocking data isolation):

- Content-Security-Policy still allows `'unsafe-inline'` scripts and `img-src https:`; a nonce-based policy is the
  defence-in-depth step. HSTS depends on an https `NEXT_PUBLIC_SITE_URL` in production.
- The in-memory rate limiter (deletion password check, store sync, food search, barcode) is per server instance; the
  AI path is database-backed and unaffected. A database-backed counter is the fix on serverless hosts.
- No per-member cap on objects in the private storage buckets (orphans are purged only at account deletion).
- No monthly **token** ceiling for AI use (requests are capped, tokens are recorded but not enforced).
- Stripe refunds and disputes do not end access automatically (RevenueCat refunds do): decide and document.
- The displayed price (`PLAN_*_PRICE_CENTS`) is not checked against the Stripe price actually charged at startup.
- A brand-new subscription on an unknown Stripe price is skipped with only a log line.
- Live dashboard settings to confirm before launch: leaked-password protection, captcha, redirect allow-list, email
  templates, webhook event subscriptions and restricted API keys.

