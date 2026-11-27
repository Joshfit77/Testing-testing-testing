# Payment verification

**Approved pricing (unchanged):**

- Free: $0;
- Pro: **$17.99 a month** or **$119.99 a year**.

The single source is `APPROVED_PRO_PRICE_CENTS` in `src/lib/domain/plans.ts`.

**Real billing is off:**

- a live Stripe key is refused unless `STRIPE_LIVE_APPROVED=true`;
- no store products are configured;
- no real or sandbox transaction has been made.

**Two kinds of evidence:**

- **Simulated:** automated tests against local stand-ins for Stripe and RevenueCat, with a real local database.
- **Store sandbox:** a real Apple / Google / Stripe test-mode transaction. **None performed yet.** They need the owner's
  accounts and a device.

## Scenario coverage

| Scenario | Simulated test | Store sandbox |
|---|---|---|
| Free vs Pro access (screens, actions, direct database writes) | ✅ `plan-enforcement`, `pro-bypass`, `free-user-direct-actions`, `memberships.spec`, `meal-prep.spec` | n/a |
| Purchase (Stripe checkout session; price guard) | ✅ `billing-integrity`, `stripe-price-guard` (unit) | ❌ not done |
| Purchase in the app (RevenueCat) | ✅ `store-billing` (stand-in), `store-billing.spec` (web checkout never offered in the app) | ❌ not done (needs device) |
| Restore purchases | ✅ server re-reads RevenueCat (`store-billing`) | ❌ not done |
| Renewal / expiration | ✅ `subscription-lifecycle` | ❌ |
| Cancellation (at period end) | ✅ `subscription-lifecycle`, `subscription-closure` | ❌ |
| Refund (full ends access; partial doesn't), dispute (lost / won) | ✅ `billing-integrity` | ❌ |
| Failed payment, 14-day grace, Manage billing still reachable after grace | ✅ grace logic tested; the "open subscription" rule unit-tested (B-01). Page rendering after grace not browser-tested | ❌ |
| Duplicate webhooks | ✅ processed once (`billing-integrity`) | ❌ |
| Out-of-order webhooks | ✅ re-fetch and newer-wins (`billing-integrity`) | ❌ |
| Cross-platform (Stripe plus App Store) | ✅ Plus vs Pro case (`store-billing`); same-plan-on-both-channels not covered | ❌ |
| Account deletion while subscribed | ✅ Stripe cancelled first, open checkouts expired (new), RevenueCat customer deleted; the App Store subscription must be cancelled by the member, who is told so | ❌ |
| Premium features without paying (direct API / database) | ✅ refused by the database | n/a |
| Status after reinstalling | Server-side entitlement (not cached on the device) | ❌ device test |
| Entitlement caching | Read from `user_entitlements` with `valid_until` on every request; no cross-user cache | n/a |

## Fixed in this consolidation

- **B-01:** Manage billing stays reachable while Stripe retries a failed payment past the grace period, and the app
  doesn't offer a second (App Store) purchase meanwhile. This prevents double charging.
- **B-02:** account deletion expires open checkout pages.
- **B-03:** the price guard refuses multi-interval, metered or multi-currency prices.

## Billing items found earlier (all resolved in code)

Details in BUG_FIX_REGISTER.md:

- **O-08 (resolved):** an ended admin grant is recomputed at the next reconciliation, however long ago it ended (T-10).
- **O-09 (resolved):** reconciliation replays Stripe's event log from a stored cursor (outages up to Stripe's 30 days,
  paged, busy windows split, a failing event can't stop it) and rotates store members through RevenueCat (T-07,
  T-08, T-18, T-19, T-21).
- **O-10 (resolved in code):** one store purchase grants one account; concurrent restores neither deadlock nor
  double-grant (T-09, T-20). The owner still sets RevenueCat's transfer behaviour (step 4 below).

What remains for paid subscriptions is verification with real accounts (App Store sandbox, Stripe test mode), not
code.

## Before taking real money

See also FOUNDER_ACTION_ITEMS.md.

**App Store and RevenueCat setup:**

1. Apple Paid Apps agreement, tax and banking.
2. Subscription group with `ngf_pro_monthly` ($17.99) and `ngf_pro_yearly` ($119.99).
3. RevenueCat project, entitlement `pro`, webhook with a long secret.
4. **RevenueCat "transfer behaviour"** set to block or transfer, never share (O-10).

**Web (Stripe):**

5. Stripe **test-mode** prices at exactly $17.99 and $119.99; webhook; Customer Portal.

**Testing:**

6. Sandbox purchase tests on a real iPhone: buy, restore, cancel, expire, refund, billing issue, delete account.
7. Stripe test mode on staging: checkout, renewal (test clock), failed payment, refund, dispute.
8. Reconcile the Stripe and RevenueCat dashboards against the app's tables after the sandbox tests (O-08 and O-09 are fixed in code).

**Legal:**

9. Final Terms and Privacy Policy published.
