# Mobile billing plan (App Store / Google Play)

Status: **plan only. Nothing here is built or activated.** Billing changes need the owner's approval and accounts
(Apple Developer, Google Play Console, RevenueCat). Research date: 2026-10-22. Sources are linked in
`docs/APP_AUDIT.md` §7.

## Why it's needed

- **Apple 3.1.1:** an iOS app that unlocks paid features must offer them as in-app purchases.
- **The multiplatform exception (3.1.3(b)):** access to web purchases is allowed only if the same items are *also* sold in the app. Apps with no purchase screen have still been rejected for "accessing content purchased outside the app".
- **Current state:** the native shells hide Stripe checkout but still unlock Plus/Pro for web subscribers. **That is the most likely App Store rejection.**
- **Google Play:** Play Billing is required for digital subscriptions. The US exception (external links / alternative billing) has its own enrolment and fees.

## Recommended approach: RevenueCat as the one source of truth for store purchases

1. **Products:** create auto-renewing subscriptions in App Store Connect and Play Console at $11.99 (Plus) and $24.99 (Pro), with a matching price ladder outside the US.
2. **RevenueCat:**
   - Map the products to entitlements `plus` and `pro`.
   - Use our Supabase user id as the RevenueCat App User ID on every platform.
   - Cost: free up to $2,500/month of tracked revenue, then 1% of tracked revenue.
3. **App plugin:**
   - Add `@revenuecat/purchases-capacitor`; confirm its Capacitor 8 support first.
   - The native app shows a paywall that meets 3.1.2: plan names, lengths, full renewal price most prominent, Terms and Privacy links, Restore Purchases.
   - Purchases happen only in native code; the web build keeps Stripe.
4. **Server:**
   - Add a RevenueCat webhook endpoint (`/api/revenuecat/webhook`), authenticated with a shared secret header.
   - It upserts `subscriptions` with `source = 'app_store' | 'play_store'` and recomputes `user_entitlements` through the same `entitlementFromSubscriptions` the Stripe webhook uses. A user with both a web and a store subscription gets the higher plan.
   - The webhook must be idempotent (store the event id, as `stripe_events` does).
5. **Account deletion (5.1.1(v)):** for in-app subscribers, the deletion screen must say Apple keeps billing until they cancel, and link to manage subscriptions. Deleting the account can't cancel an App Store subscription.
6. **Restore:** add a "Restore purchases" button (user-tapped only) in Plans & billing on iOS/Android.

## Open decisions for the owner

- Yearly plans (prices) and free trials (length).
- Whether to keep Stripe for the web: RevenueCat can sync existing Stripe subscriptions, or move web checkout to RevenueCat Web Billing.
- Whether to use the US external-purchase link on iOS. Allowed in the US since 2025; Apple's commission on linked purchases is still being decided in court. It doesn't remove the need for IAP in other storefronts.

## Not done in this stage (by design)

No billing code, products, webhook or plugin was added. Prices in `plans.ts` changed, but **live Stripe prices were not touched**.
