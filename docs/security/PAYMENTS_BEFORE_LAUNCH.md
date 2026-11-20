# Payments: what must be set up before accepting paying subscribers

**Status 2026-11-21:** live payments are **off** (no Stripe or RevenueCat keys on staging), and stay off for the first
private TestFlight build. Nothing below has been configured; each item needs the owner. Technical detail of the iOS
flow: `docs/MOBILE_BILLING.md`.

## What the app already guarantees (verified by automated tests)

| Protection | Evidence |
|---|---|
| No card number, CVV, bank detail or banking password is ever stored: web payments run on Stripe Checkout (hosted), iOS on Apple in-app purchase | `database-security-catalog.test.ts` (no such column), code review |
| Members can't write subscriptions or entitlements (no write policy on any of the 10 billing tables) | `database-security-catalog.test.ts` |
| Plans are decided by the server and database, never the device | `pro-bypass.test.ts`, `plan-enforcement.test.ts`, `free-user-direct-actions.test.ts` |
| Stripe webhooks: signature on the raw body, each event once, replay-safe, out-of-order safe, test/live mode must match the key | `billing-integrity.test.ts`, `entitlements.test.ts`, `subscription-closure.test.ts` |
| RevenueCat webhooks: constant-time secret, provider re-read (body never trusted), each event once, sandbox only for allow-listed testers | `store-billing.test.ts` |
| Refunds, disputes, cancellations, expiry and a 14-day past-due grace end access; legacy terms end with it (F-17) | `entitlements.test.ts`, `subscription-lifecycle.test.ts` |
| A live Stripe key is refused unless `STRIPE_LIVE_APPROVED=true` | `stripe-live-guard.test.ts` |

## To configure before the first paying subscriber

### Stripe (web)
1. Live secret key `STRIPE_SECRET_KEY` and webhook secret `STRIPE_WEBHOOK_SECRET` in Vercel **production only**
   (Sensitive), and `STRIPE_LIVE_APPROVED=true` once approved.
2. Webhook endpoint `https://<site>/api/stripe/webhook` with the events listed in `docs/TESTFLIGHT_STEPS.md` (Stripe section).
3. Price ids `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PRO_YEARLY` (and Plus, if sold).
4. **F-20 (fixed in code):** Checkout no longer accepts promotion codes unless `STRIPE_ALLOW_PROMOTION_CODES=true`.
   Only set it when you run a promotion, and keep the list of active codes in Stripe short.
5. **F-21:** Billing portal: allow switching only between the prices above (Settings → Billing → Customer portal →
   Products).
6. Turn on Stripe Radar rules for card testing (Stripe Dashboard → Radar), and 3-D Secure as Stripe recommends.

### Apple / RevenueCat (iOS)
1. App Store Connect: Paid Apps agreement, tax and banking forms complete; subscription group and product ids as in
   `docs/MOBILE_BILLING.md`.
2. RevenueCat: project with the App Store app, entitlements `pro` (and `plus`), `REVENUECAT_SECRET_API_KEY`,
   `REVENUECAT_PUBLIC_KEY_IOS`, webhook to `/api/revenuecat/webhook` with the `REVENUECAT_WEBHOOK_AUTH` header.
3. **F-24:** Restore behaviour **Transfer to new App User ID** (never "keep with original", never legacy aliasing), so
   one purchase can't unlock several accounts.
4. **F-23:** `REVENUECAT_ALLOW_SANDBOX` and `REVENUECAT_ALLOW_TEST_STORE` unset in production (they are ignored on a
   Vercel production deployment, but don't rely on that if you host elsewhere).

### App
1. Billing reconciliation: repository variable `BILLING_RECONCILE_URL` and secret `CRON_SECRET` (same value as the
   site's `CRON_SECRET`): the half-hourly check runs only once both exist (the workflow skips itself until then).
2. Final legal links `LEGAL_TERMS_URL`, `LEGAL_PRIVACY_URL` after counsel's review.

### Tests to run before launch (sandbox only, on devices)
Purchase, restore on a second device (Transfer), refund, cancellation at period end, failed renewal (grace then
lapse), upgrade and downgrade, for both Stripe test mode and the App Store sandbox. Record actual results.
