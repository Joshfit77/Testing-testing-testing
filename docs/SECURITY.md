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
