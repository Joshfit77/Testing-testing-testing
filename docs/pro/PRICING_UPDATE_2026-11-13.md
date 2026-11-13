# Pro pricing update to $17.99 / $119.99: report and owner checklist

This update was made on 2026-11-13 on branch `claude/pro-premium`. It has **not** been merged or deployed. **No store product,
Stripe price, RevenueCat setting or other billing configuration was created, changed or inspected. No purchase or
charge of any kind was made.** PR #11 was not touched.

**Billing is not launch-ready.** It stays that way until real sandbox purchases have been verified on physical iPhone and
Android devices. Those checks must cover purchase, entitlement, renewal, cancellation, expiry and restore (section 7).

## 1. Confirmed prices

| Plan | Price | In code |
|---|---|---|
| Free | $0 | `plans.free` |
| Pro monthly | $17.99 / month | `APPROVED_PRO_PRICE_CENTS.month = 1799` (`src/lib/domain/plans.ts`) |
| Pro annual | $119.99 / year | `APPROVED_PRO_PRICE_CENTS.year = 11999` |

Monthly and annual unlock exactly the same features and the same AI allowance: 150 requests a month, up to 10 of them
advanced. An annual member receives the allowance month by month.

## 2. The 44% saving, verified

| Step | Value |
|---|---|
| 12 × $17.99 | $215.88 |
| $215.88 − $119.99 | **$95.89** saved |
| $95.89 ÷ $215.88 | 44.42% → shown as **"Save 44%"** (rounded down, never up) |
| $119.99 ÷ 12 | $9.9992 → "about $10.00 a month" (web, rounded to the cent); the stores supply their own figure |

The screen says "Billed $119.99 once a year (about $10.00 a month). Save approximately 44% compared with monthly
billing." It never says a yearly member is charged monthly. Checked by `tests/unit/membership-billing-line.test.ts`, `plans.test.ts`,
`paywall.test.ts` and the browser tests below.

## 3. What changed

**App.** `src/components/profile/membership-plans.tsx` is shared by the website and the iPhone/Android paywall. It now has:

* a visible "Narrow Gate Fitness Pro" heading;
* Monthly and Annual cards. Each states how often it is billed ("per month, billed monthly" / "per year, billed once a
  year"). The Annual card keeps a gold border even when it is not selected;
* "Save 44% with annual billing" under the cards;
* a price line on the Pro card stating the amount and how often it is charged (`billingLine()`).

Restore purchases, Manage subscription and the renewal terms are unchanged and stay on the same screen. The per-month
equivalent on the web was $9.99 because it was rounded down. It now uses normal rounding: $10.00
(`src/app/(app)/profile/billing/page.tsx`).

**Monthly is still the option selected by default.** Annual is highlighted, but whether to pre-select it is your call
(section 8).

**Economics.** `src/lib/domain/ai-economics.ts` now models each payment channel separately. The channels are Stripe
(2.9% + 30¢ plus Billing's 0.7%), Google Play (15%), the App Store at 30% and at 15%, and RevenueCat at 1%. The model
also includes the $1.00 operating cost broken down by item and 2% of gross held for refunds. Each channel is flagged
when AI goes over 20% of net. The $1.40 member AI budget, the 150 / 10 allowance and the global budget were **not changed**.

**Configuration and docs.**

* `.env.example`: `PLAN_PRO_PRICE_CENTS=1799` and `PLAN_PRO_YEARLY_PRICE_CENTS=11999`. They were 1999 and 14999, so a copied
  example file would have displayed the old price while checkout refused it.
* `SETUP.md`, `README.md` and `IMPLEMENTATION_STATUS.md`.
* `scripts/finance/forecast.py`: the new prices, plus the current 10 advanced requests and 2 reserved.
* Billing, TestFlight and Play guides: `MOBILE_BILLING`, `TESTFLIGHT_SETUP_GUIDE`, `TESTFLIGHT_STEPS`,
  `TESTFLIGHT_INTERNAL_CHECKLIST`, `STAGING_ENVIRONMENT`, `release/IPHONE_TEST_SCRIPT`, `launch-audit/ANDROID_READINESS`
  and `launch-audit/FINAL_LAUNCH_CHECKLIST`.
* Membership, demo and release docs: `MEMBERSHIPS` (with a price history), `PRESENTATION_GUIDE`, `DEMO`, `BETA_TEST_PLAN`
  and `RELEASE_CANDIDATE`.
* Legal: `legal/TERMS_OF_SERVICE_DRAFT` and `LEGAL_REQUIREMENTS`.
* AI cost: `ai-eval/COST_MODEL`, `pro/AI_COST`, `pro/AI_COACH_OVERHAUL` and `pro/FINAL_REPORT`.

**Left unchanged on purpose.** These describe the configuration in force when they were written:

* dated audits and reports: `docs/quality/*`, `docs/audit*`, `VISUAL_COMPARISON_2026-11-07`, `LAUNCH_AUDIT_2026-11-08`,
  `launch-audit/FINAL_MEMBERSHIP_IMPLEMENTATION`, `FINAL_PRIVACY_AND_LEGAL` and `PRE_TESTFLIGHT_READINESS_REPORT`;
* the comments in migrations 044 and 045.

`MEMBERSHIPS.md` explains this. The generated offline pages (`standalone/`, `downloads/`) contain no Pro price; their only
matches were USDA food data.

**Tests added or changed.**

* `membership-billing-line` (new): the wording and the arithmetic.
* `revenuecat`: App Store and Google Play, monthly and yearly, each give the identical Pro entitlement, features and AI
  allowance.
* `checkout-guards`: the previous $19.99 and $149.99 Stripe prices are refused, and $119.99 yearly is accepted.
* `ai-economics`: the channel fees and the flag.
* `store-paywall` and `e2e/features`: the new wording.
* `entitlements`: the mock charge amount.

## 4. AI economics at the new prices

The figures are per Pro member-month, with AI at the full $1.40 budget. That is the most a member can use before being
stopped; a typical member uses $0.37–0.70.

| Channel | Net after fees | Left after refunds, $1.00 costs and $1.40 AI | AI share of net |
|---|---|---|---|
| Web monthly | $17.04 | $14.28 | 8.2% |
| Web yearly | $9.61 | $7.01 | 14.6% |
| Google Play monthly / App Store monthly at 15% | $15.11 | $12.35 | 9.3% |
| Google Play yearly / App Store yearly at 15% | $8.40 | $5.80 | 16.7% |
| App Store monthly at 30% | $12.41 | $9.65 | 11.3% |
| **App Store yearly at 30%** | **$6.90** | **$4.30** | **20.3% ⚑** |

* **Flag:** the full AI budget passes the 20% guideline on one channel: App Store yearly, in a subscriber's first year,
  without the Small Business Program.
* **Every channel still makes money**, even when AI is fully used.
* **Free members generate no billable AI.** This is enforced on the server and tested in `ai-access`.
* **Global budget:** still $100 by default. For launch, Pro members × $1.05 is a reasonable starting point.

Full detail and assumptions are in `AI_COST.md`. Provider fees come from the providers' published pages as of 2026-11-13.
No provider account was inspected.

## 5. Test results (this branch, local machine)

| Check | Result |
|---|---|
| Typecheck, lint | Clean |
| Unit tests (`vitest --project unit`) | 234 files, **4,441 passed**, plus the 2 checkout tests added after that run (3/3 in that file) |
| Integration: entitlements, store-billing, subscription-lifecycle, billing-integrity, ai-access, ai-budget (local Supabase) | **70 passed** |
| Browser tests on a production build, mobile: memberships, features, usability-medium, ai-usage | **13 passed** (5 more need demo mode, below) |
| Browser tests on a demo-mode server, mobile: demo, ux-home-onboarding-coach-you | **22 passed** |
| Not run | Any real purchase, any store sandbox, any device, the full integration and e2e suites, the WebKit/iPhone browser project |

## 6. Billing audit (code and tests; external dashboards not inspected)

| Area | Finding | Evidence |
|---|---|---|
| Price/product mapping | Pro monthly is `ngf_pro_monthly` (App Store) / `ngf_pro:monthly` (Play); yearly is `ngf_pro_yearly` / `ngf_pro:yearly`. The plan comes from the RevenueCat entitlement `pro`, never from the price | `store-billing.ts`, `revenuecat.test.ts` |
| Same entitlements monthly and yearly | Yes: the plan, every feature and the AI allowance are identical | new `revenuecat.test.ts` cases |
| Checkout refuses wrong prices | Stripe checkout is refused unless the configured price is exactly $17.99/month or $119.99/year in USD, recurring and active. An environment override of the displayed price cannot change this | `billing.ts`, `checkout-guards.test.ts` |
| Live payments off | A live Stripe key is ignored unless `STRIPE_LIVE_APPROVED=true`. Store sandbox purchases grant nothing unless the account is on the tester allow-list | `stripe-live-guard.test.ts`, `store-billing.test.ts` |
| Webhooks secure | Stripe needs a valid signature and RevenueCat the configured Authorization header. Oversized bodies are refused. Each event is processed once, and out-of-order events can't undo the current state | `entitlements.test.ts`, `store-billing.test.ts` |
| Cancellation, expiry, failed payment | Access lasts to the end of the period. A billing issue keeps access during the grace period. Expiry ends access. An immediate cancellation ends it at once | same |
| Refunds, disputes | A full refund of the current period ends access, a partial refund doesn't, and a dispute pauses access until it's won | `entitlements.test.ts`, `store-billing.test.ts` |
| Restore, transfer | Restore moves the subscription to the restoring account and updates both members. A sandbox purchase restored onto an unlisted account grants nothing | `store-billing.test.ts` |
| Upgrade/downgrade | Web: Stripe's billing portal. Stores: the store applies the change at renewal, and the app follows the store | `store-billing.test.ts` |
| Annual renewals | The entitlement runs to the store's or Stripe's period end. AI is allocated monthly | `entitlements`, `coach-scenarios` |
| Legacy members | Earlier Stripe price ids listed in `STRIPE_PRICE_PRO_LEGACY` still grant Pro. Legacy Plus keeps what it paid for. Nobody's price is changed by code | `entitlements.test.ts` ("maps earlier Stripe prices…") |
| Existing paying customers | None known: no live product has been sold, and Stripe live mode is off. **Nothing was repriced** | — |

## 7. Owner actions (external dashboards; none done here)

All of these are for you to do. Prices you type into a dashboard must match exactly.

1. **App Store Connect**:
   * Subscription group with `ngf_pro_monthly` at **$17.99** and `ngf_pro_yearly` at **$119.99** (US storefront).
   * Review the auto-generated prices for other countries.
   * If either product already exists at $19.99 / $149.99, change it before any customer buys. If anyone has bought
     it, read Apple's current rules for price changes to existing subscribers first.
   * Enrol in the **App Store Small Business Program** if eligible. This clears the AI flag in section 4.
2. **Google Play Console**:
   * Subscription `ngf_pro` with base plans `monthly` at **$17.99** and `yearly` at **$119.99**.
   * If base plans exist at the old prices with subscribers, Play keeps existing subscribers on their price unless you
     run a price migration. Decide that before changing it.
3. **RevenueCat**:
   * Attach all four products (`ngf_pro_monthly`, `ngf_pro_yearly`, `ngf_pro:monthly`, `ngf_pro:yearly`) to the
     entitlement **`pro`**.
   * An offering containing the two packages (`docs/MOBILE_BILLING.md`); the app picks them by product id.
   * Webhook URL and Authorization header.
4. **Stripe** (test mode first):
   * Create two recurring USD prices, **$17.99/month** and **$119.99/year**.
   * Set `STRIPE_PRICE_PRO` and `STRIPE_PRICE_PRO_YEARLY`.
   * If you had created test prices at $19.99 / $149.99, archive them, or list them in `STRIPE_PRICE_PRO_LEGACY` if a
     test subscription uses them.
   * Turn on the customer portal with switching between monthly and yearly.
   * Keep `STRIPE_LIVE_APPROVED=false` until you approve live charges.
5. **Display settings**: leave `PLAN_PRO_PRICE_CENTS` and `PLAN_PRO_YEARLY_PRICE_CENTS` unset or set them to 1799 and
   11999. Checkout uses the prices fixed in code either way.
6. **Device verification, required before calling billing launch-ready.** On a physical iPhone (App Store sandbox) and
   an Android phone (Play licence tester), check each of these:
   * a monthly purchase, then a yearly purchase;
   * Pro unlocks on both;
   * switching between monthly and yearly;
   * cancellation, with access lasting to the period end;
   * expiry;
   * a failed payment and its grace period;
   * a refund;
   * Restore on a reinstall and on a second device.

   Then check that the server's `store_subscriptions` row and the RevenueCat customer agree. The steps are in
   `docs/release/IPHONE_TEST_SCRIPT.md` and `docs/launch-audit/ANDROID_READINESS.md`.

## 8. Decisions for you

1. **AI on the App Store yearly channel at 30%** is 20.3% of net when fully used. Options:
   * keep it (it still leaves $4.30);
   * enrol in the Small Business Program;
   * set `AI_MEMBER_MONTHLY_BUDGET_USD=1.38`.

   Nothing was changed.
2. **Default billing period on the membership screen.** Monthly is selected and Annual is highlighted. Pre-selecting
   Annual is a one-line change. It also changes several tests and the first price a member sees.
3. **Terms of Service draft** now states $17.99 / $119.99. It needs your legal review before it is published.
4. **Old products.** If any $19.99 / $149.99 product or price already exists in a dashboard, decide how to handle it
   (section 7).
5. **`scripts/finance/forecast.py`** predates the per-member money cap. Its "stress" row ($5.32) is not reachable
   in the app any more and is shown only as a theoretical bound.

## 9. Confirmation

No real payment, purchase, refund or sandbox transaction was made. No App Store Connect, Google Play, RevenueCat or Stripe
setting was viewed or changed. Nothing was deployed or published, and nothing was merged into `main`. The only database
touched was the local test database in this container.
