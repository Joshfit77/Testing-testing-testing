# Independent pre-merge review — PR #11 (2026-11-12)

Four reviewers worked separately and read only the code, never this branch's reports or test results. Their areas were:

1. authentication and general security;
2. billing and subscription entitlements;
3. database migrations;
4. account deletion, data export and privacy.

Each finding was then checked against the code before anything was changed. Prices are unchanged: Free $0, Pro
$19.99 a month, Pro $149.99 a year.

## Result

| Severity | Count | Status |
|---|---|---|
| Critical | 0 | — |
| High | 1 (operational, not code) | Pre-deploy step below: confirm production's migration history |
| Medium | 9 | 8 fixed in this PR; 1 not fixed, listed as a pre-launch item |
| Low | 14 | 4 fixed; the rest accepted or listed |

## Fixed in this PR

| # | Area | Finding | Fix | Proof |
|---|---|---|---|---|
| 1 | Billing / security (two reviewers) | Leaving `REVENUECAT_ALLOW_SANDBOX` / `_TEST_STORE` on in production (with web payments not approved) would let a TestFlight sandbox purchase unlock Pro for free | Both flags are ignored on any production deployment (`VERCEL_ENV=production` or live Stripe approved); named testers use the server-side allow-list (unchanged) | `src/server/env.ts` |
| 2 | Billing | The checkout price guard compared Stripe against the display price, which an environment variable can change, so $24.99 could have been charged without a code change | The guard now compares against the approved constant ($19.99 / $149.99) | `tests/unit/checkout-guards.test.ts` |
| 3 | Billing | Two open checkout pages (two tabs) could both be paid, creating two subscriptions | Open checkouts are expired before a new one is created | `tests/unit/checkout-guards.test.ts` |
| 4 | Deletion | If reading the Stripe customer failed, deletion went ahead and a subscription could outlive the account | The read error stops the deletion before anything is removed (both read sites) | `tests/unit/account-deletion.test.ts` |
| 5 | Privacy | Prayer entries shared with the coach kept reaching the AI after faith coaching was turned off | Journal entries are read only while Faith-inspired coaching is on; the share switch says so | `tests/unit/coach-journal.test.ts`, `tests/integration/ai-consent.test.ts` |
| 6 | Auth | `/auth/confirm` accepted magic-link, invite and email-change tokens that no email uses (more ways to slip someone a session-swapping link) | Only `email` and `recovery` (and `signup`) are accepted | e2e `core-flow` (sign-up, reset) |
| 7 | Migrations | A new length check on `profiles.avatar_path` would abort the production migration if any existing value is over 300 characters | Added `NOT VALID`: enforced for new writes; validate after a clean-up | upgrade test below |
| 8 | Billing | The offline edition (debug APK / simulator only) still listed Plus $11.99 / Pro $24.99 | Now Free / Pro $19.99 a month or $149.99 a year | `standalone/index.html` |
| — | Security (Low) | Sleep `returnTo` was only checked with `startsWith` | Also passes `safeNextPath` | — |

## Migration safety — upgrade-path test (run here, not just read)

1. A local database was built at `main`'s schema (its 8 migrations) and filled with a stand-in for production: 30
   members, 240 workouts, 960 sets, 240 food entries, prayer journal entries, and 7 paying Pro members with Stripe
   rows.
2. All 51 new migrations then applied on top in about 2 seconds, with no errors.
3. A checksum over sessions, sets, food entries, entitlements and journal entries was identical before and after.
   All 7 Pro members are still Pro under the new server-side `plan_of`, and the 23 Free members are still Free.

The migration reviewer found:

- no dropped tables or columns, no type changes, and no NOT NULL added without a default;
- no existing migration edited, and every new file ordered after `main`'s;
- RLS enabled on every table, and every SECURITY DEFINER function pinned to a fixed `search_path`.

**Verdict: safe to apply to production, under the conditions below.**

## Pre-deploy steps for the database (in order)

1. Take a backup or point-in-time restore point of production, and write down the restore point.
2. Run `supabase migration list --linked` against production. It should list exactly the 8 versions from `main`,
   ending in `20261017000005`.
   - **High:** if production was set up by pasting `setup-all.sql`, there is no migration history. A push would
     then start again from the first file and fail.
   - In that case, run `supabase migration repair --status applied <version>` for each of the 8 first.
3. Run these read-only checks:
   - row counts for `ai_messages`, `workout_sets`, `meal_items`, `ai_usage_events` and `faith_journal_entries`.
     If any is large, pre-build those indexes with `CREATE INDEX CONCURRENTLY` (same names) first.
   - `select count(*) from profiles where char_length(avatar_path) > 300;` (expected: 0).
4. Do a dry run on staging restored from a production snapshot: `supabase db push`, then `migration list`, which
   should show 59 versions.
5. On production, in a low-traffic window: `supabase db push --dry-run`, then `supabase db push`.
6. Deploy the app code only after the push succeeds. The old code still works on the new schema, because the new
   columns have defaults.
7. Smoke-test Stripe webhooks, food logging and a Free member's writes.

Each file runs in its own transaction. If one fails partway, keep the old app running and either fix forward or
restore.

## Accepted / listed, not fixed (Medium and Low)

- **Login CSRF on `/auth/confirm` (Medium-Low).** A GET link verifies the token immediately, so an attacker could
  sign someone into the attacker's own account. The reduced link types narrow this. The full fix is a "Continue"
  button (POST) and a warning when another account is signed in, recommended before public launch.
- **Per-IP rate limits trust X-Forwarded-For (Low on Vercel).** Vercel overwrites the header. On another host, read
  the platform's trusted header instead.
- **Hosted Supabase settings (Low, outside the code).** The public anon key allows direct sign-up and sign-in calls,
  so the hosted project's auth rate limits and CAPTCHA are the real protection. Check them in the dashboard before
  launch.
- **Demo mode guard (Low).** Demo mode is refused on `VERCEL_ENV=production` or when live Stripe is approved. On a
  non-Vercel host, keep `DEMO_MODE` unset in production.
- **Late `invoice.paid` (Low, suspected).** A delayed payment event could lift a refund block. The suggested
  tightening is to require it to be the subscription's latest invoice with an amount above zero.
- **Progress-photo comparison (Low).** It is a Pro display feature computed in the browser from the member's own
  photos. No data is exposed.
- **Restore message (Low).** "Purchases restored" can appear for a member whose Pro comes from the website. The
  wording only.
- **iOS cancel instructions mention the website (Low).** The text is informational and has no links. Consider
  showing only the current platform's line for App Review.
- **Account deletion (Low).**
  - Photos are removed before the auth user. A failed final step leaves the account with no photos; the message
    says so.
  - A checkout that completes in another tab after deletion is logged but not refunded automatically. The
    expiry fix above narrows the window.
- **Export (Low).** Pages over 1,000 rows are read without a sort order, and the file is built in memory.
- **Anonymous calls (Low).** A few SECURITY DEFINER read helpers can still be called anonymously. At most they
  reveal which program a day belongs to.
- **CSP (Low).** `connect-src` allows any `*.supabase.co`. Narrow it to the production project.
- **Rollback headers.** 6 of the 51 migrations state a rollback. Treat a database restore as the real rollback.

## Checked and found sound (summary)

- **Auth:** open-redirect handling, PKCE callback, no user enumeration, password re-check before deletion and
  rate limits.
- **Server actions:** every action authenticates and runs under RLS, and none accepts a `userId`.
- **Service role:** used only with the session user's id or in webhook and admin contexts.
- **Stripe webhook:** signature checks, leased idempotency, re-reads Stripe, ordering by `synced_at`, refund and
  dispute rules, 14-day past-due grace.
- **RevenueCat:** constant-time authentication, the server re-reads the customer, UUID ids only, atomic snapshot,
  transfers.
- **Entitlements:** members can't write any billing table; `plan_of` is server-only; Pro gates are server-side
  (coach, photos, programs, templates, planner, body scan, GPS, sleep analytics).
- **Deletion:** the password is re-checked; every user table cascades from `auth.users` (enforced by a unit test);
  all three photo buckets are emptied; Stripe is cancelled first, and the deletion stops if that fails.
- **Privacy:** prayer entries are private by default, Bible AI sends no journal text, and logs are redacted.
- **Demo reset:** only the demo account, only in demo mode, and never on a production database.
