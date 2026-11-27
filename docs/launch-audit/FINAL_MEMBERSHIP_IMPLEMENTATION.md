# Final membership implementation: Free and Pro All Access

Branch `claude/free-pro-membership` (2026-10-26). The plan-by-plan feature table and enforcement points are in
`docs/MEMBERSHIPS.md`; store setup is in `docs/MOBILE_BILLING.md`. Nothing here activates live payments, creates store
products or changes any live subscription.

## 1. What was implemented

| Area | Change | Where |
|---|---|---|
| Plans | Free ($0) and Pro All Access ($19.99/month, $149.99/year, same features) are the only plans offered. Plus stays an internal legacy plan for existing subscriptions only. | `src/lib/domain/plans.ts` |
| Live GPS | Pro only, enforced in `saveGpsActivityAction` and by the database trigger `enforce_live_gps_plan` (blocks creating a GPS recording or attaching a route on Free; editing, deleting and removing routes stay open). Manual run/walk logging stays free. The recorder and Run screen show the lock; an unsaved recording on the phone is never discarded by the lock. | migration `20261026000044`, `gps-recorder.tsx`, `run/page.tsx` |
| Membership screen | One black-and-gold Free vs Pro layout for the website and the app: monthly/yearly toggle with the saving, per-month equivalent, eight Pro highlights, a full comparison table, current membership with channel, interval and renewal/end date, renewal and cancellation terms per channel, Restore purchases, Manage subscription, Terms and Privacy links, and "How to cancel" for each channel. | `membership-plans.tsx`, `web-membership.tsx`, `store-paywall.tsx`, `profile/billing/page.tsx` |
| Prices shown = prices charged | App: only the store's own localized price strings for `ngf_pro_monthly`/`ngf_pro_yearly`; nothing is shown that the store didn't return. Web: the configured Stripe prices are read; checkout is refused (and says so, no charge) if amount, currency or interval differ from the approved price. | `paywall.ts`, `billing.ts` (`stripeProPrices`, `stripePriceProblems`) |
| Refunds and disputes (Stripe) | A full refund or a dispute of the current period's payment ends that period's access; a won dispute or the next paid period restores it; partial refunds and refunds of earlier periods don't touch current access. The Stripe subscription itself is left for the owner to cancel. | `billing.ts`, columns `access_revoked_*` |
| Duplicate billing | Checkout refuses a second subscription (Stripe's own list is checked), and tells App Store / Google Play members to change their membership in the app. The app paywall never sells to someone billed on the web or the other store. | `actions/billing.ts`, `paywallAction` |
| Monthly ↔ yearly | App: "Switch to yearly/monthly" through the same store subscription (Google Play gets the old product id). Web: in the Stripe customer portal. | `store-paywall.tsx` |
| Consent records | Sign-up records Terms, Privacy Policy and a whole-app health & AI acknowledgment (version + SHA-256 of the exact text); web checkout records auto-renewal consent naming price and period; optional re-acceptance after a material change (`LEGAL_REACCEPT_REQUIRED`, off). | migration `20261026000045`, `src/lib/legal/versions.ts`, `src/server/legal.ts` |
| AI safeguards | Meal-plan notes describing a medical condition or therapeutic diet aren't sent to the AI and the member is told why; normal preferences, diet styles and substitutions still pass. Instructions forbid medical nutrition therapy and going below the calorie target. Clearer AI disclosures on the coach and meal-plan screens. | `ai-meal-plan.ts`, `coach-chat.tsx` |
| Copy | Every "Plus" upsell now says Pro All Access; the landing page shows two plans. | ~35 files |

## 2. Billing lifecycle (requested scenarios)

"Tested" names the automated test; "device" means it also needs a sandbox run on a real phone (`docs/MOBILE_BILLING.md`).

| # | Scenario | How it's handled | Evidence |
|---|---|---|---|
| 1–3 | Free → Pro, monthly, yearly | Web: Stripe Checkout at the verified price after the auto-renewal box. App: store purchase, then the server re-reads RevenueCat. | `store-paywall.test.tsx`, `entitlements.test.ts` (yearly price → Pro); device |
| 4 | Renewal | Stripe `invoice.paid` / RevenueCat RENEWAL → resync | `entitlements.test.ts`, `store-billing.test.ts` |
| 5–6 | Monthly ↔ yearly | Store: same subscription, switch action. Web: Stripe portal (owner must enable price switching in the portal settings). | `paywall.test.ts`, `store-paywall.test.tsx`; device |
| 7 | Cancellation | Access to the end of the paid period; screen shows "Ends <date>". | `plans.test.ts`, `entitlements.test.ts` |
| 8 | Expiration | Back to Free, nothing deleted. | `entitlements.test.ts`, `revenuecat.test.ts` |
| 9–10 | Payment failure, grace | `past_due` and store grace keep access; notice to fix payment. | `plans.test.ts`, `revenuecat.test.ts` |
| 11 | Refunds | Stripe: full refund of the current period ends access (new). Store: refund time ends access. | `entitlements.test.ts` (new), `revenuecat.test.ts` |
| 12 | Chargebacks / disputes | Stripe: pauses access; won restores, lost keeps it ended (new). Store disputes are refunds. | `entitlements.test.ts` (new) |
| 13 | Restore purchases | Re-reads RevenueCat; transfers update both accounts. | `store-billing.test.ts`, `store-paywall.test.tsx` |
| 14–16 | Cross-device, reinstall, account switching | Entitlement is server-side per account; RevenueCat id = account id; RevenueCat `logIn` on account change. | `store-billing.test.ts`; device |
| 17 | Account deletion while subscribed | Stripe subscriptions cancelled and customer deleted; store subscriptions can't be cancelled by the app, and the deletion screen, paywall terms and "How to cancel" say so. | `account-deletion.test.ts` |
| 18 | Duplicate subscriptions | Refused on web and in the app (see §1). | `paywall.test.ts`, `store-paywall.test.tsx` |
| 19 | Webhook retries, idempotency | Event ids stored once; failures release the id so the provider retries; current state always re-read from Stripe/RevenueCat. | `entitlements.test.ts`, `store-billing.test.ts` |
| 20 | Secure store validation | The app never says what was bought; the server asks RevenueCat's REST API with the secret key; webhooks need the configured Authorization header (constant-time check). | `store-billing.test.ts` |

## 3. Existing subscribers (non-destructive plan)

No real subscriber data or store account could be inspected from here, so nothing has been migrated. The code keeps
every existing subscription working without any change in Stripe, App Store or Google Play:

1. **Before switching prices**, export active subscriptions from Stripe (and RevenueCat) to know who exists.
2. **Create the new Stripe prices** ($19.99/month, $149.99/year, USD, recurring) and point `STRIPE_PRICE_PRO` /
   `STRIPE_PRICE_PRO_YEARLY` at them. Put the old Plus price ids in `STRIPE_PRICE_PLUS*` and the old Pro ids in
   `STRIPE_PRICE_PRO_LEGACY`. Archive the old prices for new sales only; never delete them.
3. **Run migration 20261022000022** (already in the repo) before the switch if it hasn't run: it records each
   existing subscription's AI allowance in `legacy_plan_terms`.
4. Existing Plus and Pro subscribers then keep their access, AI allowance and price. Moving them to the new prices is a
   separate, owner-approved step with advance notice (Stripe price migration; Apple/Google price-change consent flows).
5. Refunds, disputes and cancellations already in Stripe are picked up by the next webhook for each subscription.

## 4. AI cost and profitability (estimates)

Official Anthropic prices checked 2026-10-26: Haiku 5.5 $0.10 / $0.50 and Sonnet 5.5 $2 / $10 per million input /
output tokens. Other fees (Apple 15% Small Business / 30%→15% standard verified; Google 15%, Stripe 2.9% + 30¢ + 0.7%
Billing, RevenueCat 1% above $2,500/month, Supabase Pro $25, Vercel Pro $20/seat) came from search results because
those pages were blocked here; re-check them before launch. Full model: `python3 -I scripts/finance/forecast.py`.

AI cost per Pro member per month: light $0.31, typical $0.78, full allowance $1.62 (most expensive allowed mix);
long conversations near the code's caps can reach about $6.76.

Contribution per subscriber per month (price − store/payment fees − RevenueCat − 2% refunds − AI − variable hosting):

| Plan | iOS 15% | iOS 30% (year 1) | Android | Web |
|---|---|---|---|---|
| Monthly ($19.99) | $15.51 | $12.51 | $15.51 | $17.65 |
| Yearly ($149.99, per month) | $9.37 | $7.50 | $9.37 | $10.87 |

Steady-state month at 70% monthly / 30% yearly, Apple 15%, channels iOS 60 / Android 25 / web 15:

| Active paying subscribers | 100 | 250 | 500 | 750 | 1,000 |
|---|---|---|---|---|---|
| New subscribers needed to replace churn | 7 | 17 | 33 | 50 | 66 |
| MRR (yearly plans counted /12) | $1,774 | $4,436 | $8,871 | $13,307 | $17,743 |
| Contribution margin, typical AI | $1,411 | $3,491 | $6,981 | $10,472 | $13,963 |
| After hosting and replacement ads at $40 CAC | $1,084 | $2,767 | $5,583 | $8,414 | $11,210 |

Blended CAC payback: about 1.4–1.9 months at $20, 2.9–3.8 at $40 and 5.7–7.7 at $80 per paying subscriber. Yearly
plans collect $149.99 upfront, which is cash, not monthly revenue. Assumptions: 8% monthly churn, 60% yearly renewal,
2% refunds; salaries, legal, insurance and other fixed costs are excluded. None of this is a guarantee.

## 5. What the owner must do before sandbox testing

1. Stripe (test mode): create the two Pro prices; set `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PRO_YEARLY`; enable plan
   switching and cancellation in the customer portal; turn on receipt emails and upcoming-renewal emails.
2. App Store Connect: one subscription group with `ngf_pro_monthly` ($19.99) and `ngf_pro_yearly` ($149.99); sandbox
   testers. Google Play: `ngf_pro` with monthly and yearly base plans.
3. RevenueCat: entitlement `pro` with both products, an offering, the webhook and its Authorization header; set the
   `REVENUECAT_*` variables, and `REVENUECAT_ALLOW_SANDBOX=true` only on the TestFlight deployment.
4. Keep `STRIPE_LIVE_APPROVED=false` until you approve real charges.
