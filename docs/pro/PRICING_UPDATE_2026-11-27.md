# Pro pricing update to $24.99 / $149.99: report and owner checklist

Approved in writing by the founder on 2026-11-27 ("Free: $0. Pro Monthly: $24.99. Pro Annual: $149.99"). Built on branch
`claude/sharp-cray-8y0uuv` from the approved development baseline `1197f96f`. It has **not** been merged into `main` or
deployed.

**Nothing outside the repository was touched:**

- no Stripe price, product or webhook was created, changed or inspected;
- no App Store Connect, Google Play Console or RevenueCat setting was created or changed;
- no purchase or charge of any kind was made;
- no existing subscription was changed.

Live billing stays off (`STRIPE_LIVE_APPROVED` is not set).

This replaces the 2026-11-13 update (`PRICING_UPDATE_2026-11-13.md`, kept as history).

## 1. Approved prices

| Plan | Price | In code |
|---|---|---|
| Free | $0 | `plans.free` |
| Pro monthly | $24.99 / month | `APPROVED_PRO_PRICE_CENTS.month = 2499` (`src/lib/domain/plans.ts`) |
| Pro annual | $149.99 / year | `APPROVED_PRO_PRICE_CENTS.year = 14999` |

`APPROVED_PRO_PRICE_CENTS` is the **single source of truth**. Everything else derives from it:

- the membership screen, comparison table and upgrade prompts;
- the Coach, GPS and Home upsell lines;
- the auto-renewal consent text;
- the server's Stripe checkout guard;
- the AI cost model and the admin AI-cost page.

Monthly and annual unlock the same features and the same AI allowance (150 requests a month, up to 10 advanced).

## 2. The saving, verified

| Step | Value |
|---|---|
| 12 × $24.99 | $299.88 |
| $299.88 − $149.99 | **$149.89** saved |
| $149.89 ÷ $299.88 | 49.98%, which is "about 50%" in words. The screen shows **"Save 49%"**, because the app rounds down so a saving is never overstated |
| $149.99 ÷ 12 | $12.4992, so the web screen says "about $12.50 a month". The stores supply their own figure |

The web screen says "Billed $149.99 once a year (about $12.50 a month). Save approximately 49% compared with monthly
billing." A yearly membership is **one charge a year**, and the screen never describes it as a monthly charge.

**Owner choice:** the badge can read "Save 50%" only if you want rounding to the nearest percent. The code currently
rounds down on purpose; tell Claude if you want it changed.

## 3. What changed in the code

- **Prices:** `APPROVED_PRO_PRICE_CENTS` is now `{ month: 2499, year: 14999 }`.
- **Display price fixed in code:**
  - Before this update, `PLAN_PRO_PRICE_CENTS` and `PLAN_PRO_YEARLY_PRICE_CENTS` could set a different *displayed* Pro
    price, while checkout only accepted the approved one. A stale environment value would therefore have shown a price
    the member could not be charged.
  - Now `getPlans()` always shows the approved prices. `PLAN_PRO_YEARLY_PRICE_CENTS=0` still hides the yearly option.
  - Tested in `tests/unit/plans.test.ts`.
- **Stripe checkout guard:** `stripePriceProblems()` / `approvedCents()` refuse any Stripe price whose amount, interval,
  interval count, currency or usage type differs from the approved one, including the previous $17.99 / $119.99 and
  $19.99 prices (`tests/unit/checkout-guards.test.ts`, `tests/unit/stripe-price-guard.test.ts`).
- **Store paywall (iPhone and Android):** unchanged by design. It shows the store's own localized `priceString`, and it
  works out the saving from the store's prices (`src/lib/billing/paywall.ts`). Restore purchases does not depend on price.
- **Entitlements:** unchanged. Plans are mapped from product IDs and price IDs, not amounts. Product IDs are unchanged:
  `ngf_pro_monthly`, `ngf_pro_yearly`, `ngf_pro:monthly`, `ngf_pro:yearly`.
- **AI budget:** unchanged at the owner's $1.40 target per member-month.
  - At the new prices, the lowest-net channel (App Store yearly at 30%) nets $8.62 a month, so AI at the full budget is
    16.2% of net. Earlier it was 20.3% and flagged.
  - No channel is flagged now. Details are in `docs/pro/AI_COST.md`.
- **Revenue forecast:** `scripts/finance/forecast.py` now uses $24.99 / $149.99. Run `python3 -I scripts/finance/forecast.py`.
- **Templates and documentation:**
  - `.env.example` no longer sets display prices.
  - Current documentation and the Terms draft state the new prices.
  - Dated reports and audits keep the prices in force when they were written.
- **Regression guard:** `tests/unit/pricing-consistency.test.ts` fails if an outdated Pro price appears in the app
  source, the demo pages, the configuration templates or the current documentation.

## 4. Existing subscribers keep their price

No existing subscription agreement changes. Each channel keeps current subscribers on what they bought:

| Channel | What to do | Why existing members are unaffected |
|---|---|---|
| **Stripe (web)** | Create two **new** prices: $24.99 every 1 month and $149.99 every 1 year, in USD, licensed (not metered). Set `STRIPE_PRICE_PRO` and `STRIPE_PRICE_PRO_YEARLY` to the new IDs. Add the previous Pro price IDs to `STRIPE_PRICE_PRO_LEGACY` (comma-separated). | A Stripe price's amount can't change, so existing subscriptions stay on their old price. `STRIPE_PRICE_PRO_LEGACY` keeps them recognised as Pro. Checkout for new members accepts only the new prices. |
| **App Store Connect** | Products `ngf_pro_monthly` and `ngf_pro_yearly` → Subscription Prices → change the US price to $24.99 / $149.99. Choose **"Keep the current price for existing subscribers"**. Review the other storefronts' prices Apple suggests. | Apple preserves the earlier price for current subscribers. The app shows each storefront's localized price. |
| **Google Play Console** | Subscription `ngf_pro`, base plans `monthly` and `yearly` → set $24.99 / $149.99. Keep existing subscribers on the **legacy price** (don't migrate them). | Play keeps existing subscribers in their legacy price cohort. |
| **RevenueCat** | Nothing to change: same products, entitlement `pro`, offerings. | RevenueCat reads prices from the stores. |

**If no products have been created yet** (the current state), simply create them at the new prices: there are no
existing subscribers to protect.

## 5. Owner checklist (nothing here has been done)

| # | Task | Where |
|---|---|---|
| 1 | Create the Stripe **test-mode** prices at $24.99 / $149.99 and set them in staging | Stripe dashboard (test mode); hosting settings |
| 2 | Create, or update for new subscribers only, the App Store products at $24.99 / $149.99 | App Store Connect |
| 3 | Do the same for the Google Play base plans | Play Console |
| 4 | Sandbox purchase, restore, cancel and expire on a real iPhone (FOUNDER_TASKS.md F-5); confirm the screen shows Apple's price | iPhone, TestFlight |
| 5 | Have the attorney confirm the Terms prices and any notice before publication | `docs/legal/TERMS_OF_SERVICE_DRAFT.md` §3.2 |
| 6 | Live prices only after explicit approval to take real money (`STRIPE_LIVE_APPROVED`) | Stripe live mode |

## 6. Verification

The verification results are recorded in `docs/production-consolidation/SESSION_PROGRESS.md` (pricing round). They
cover:

- unit, integration and end-to-end tests;
- the build;
- the GitHub workflows (CI, iOS checks, Android).
