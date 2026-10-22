# Mobile billing: App Store and Google Play through RevenueCat

**Status (2026-10-22): built and tested in code; not yet tested on a device; not activated.**

- Built on branch `claude/stage2-store-billing`, with automated tests (see *What has been tested* below).
- It has not run against a real RevenueCat project, App Store sandbox or device: none is available from this environment.
- Nothing charges anyone until the owner creates the store products, sets the keys below and approves going live.

## Why it's needed

- **Apple 3.1.1:** an iOS app that unlocks paid features must sell them with in-app purchase and offer a way to restore purchases.
- **Apple 3.1.3(b) (multiplatform):** web subscribers may use what they bought, as long as the same plans are also sold in the app.
- **Google Play:** Play Billing is required for digital subscriptions.

## How it works

1. **The purchase happens on the phone.** The app shows the paywall (Profile → Plans & billing), using the `@revenuecat/purchases-capacitor` plugin (13.7.3, pinned). Prices come from the store, localized.
2. **The app never says what was bought.** After a purchase or "Restore purchases", the server asks RevenueCat's REST API (`GET /v1/subscribers/{user id}`) for the member's current state. It does the same after every RevenueCat webhook (`POST /api/revenuecat/webhook`), as RevenueCat recommends.
3. **The state is stored per product** (`store_subscriptions`). Entitlements are then recomputed with the same code as Stripe. A member who pays both on the web and in the app gets the higher plan, with no double grant.
4. **The member's RevenueCat id is their account id.** Anonymous RevenueCat ids are ignored.

| Event | What happens |
|---|---|
| Purchase | Plan unlocks as soon as the server confirms with RevenueCat (usually before the purchase sheet closes). |
| Renewal | Period extended. |
| Upgrade Plus → Pro | iOS: same subscription group, immediate. Android: the app names the old product so Google replaces it. Pro applies at once. |
| Downgrade / crossgrade | Takes effect when the store applies it (usually at renewal). |
| Cancellation (auto-renew off) | Access continues to the end of the paid period; Plans & billing says when it ends. |
| Billing problem | Access continues through the store's grace period; Plans & billing asks the member to fix payment. |
| Expiration | Back to Free. Nothing is deleted. |
| Refund | Access ends at the refund time. |
| Restore purchases | Re-reads purchases for the store account. A purchase restored on another Narrow Gate account moves there (RevenueCat TRANSFER); both accounts are updated. |
| Account deletion | Can't cancel a store subscription. The deletion screen warns store subscribers and says where to cancel. The RevenueCat customer record is deleted afterwards. |

- **Web subscribers on the phone** are not offered a second subscription. They see "Your subscription was purchased outside the App Store", to avoid inadvertent double billing (3.1.2(b)).
- **Store subscribers on the web** are told their plan is billed by the App Store / Google Play and where to manage it.

## Owner setup (sandbox first)

1. **App Store Connect:** use the app's real bundle id (`CAP_APP_ID`).
   - Create one *subscription group* with four auto-renewable subscriptions:
     - `ngf_plus_monthly` $11.99
     - `ngf_pro_monthly` $24.99
     - `ngf_plus_yearly` $99.99
     - `ngf_pro_yearly` $249.99
   - Order them in the group so Pro is the higher level (upgrades are then immediate).
   - Add review screenshots and descriptions.
   - Create **Sandbox tester** accounts.
2. **Google Play Console** (when Android is ready): create subscriptions `ngf_plus` and `ngf_pro`, each with `monthly` and `yearly` base plans. Set the product ids in `.env` if they differ.
3. **RevenueCat:**
   - Create a project and add the iOS app (App Store Connect API key / in-app purchase key) and the Android app.
   - Create entitlements `plus` and `pro`. Attach the Plus products to `plus`, and the Pro products to `pro` (optionally also to `plus`).
   - Create an offering containing the packages.
   - Add the webhook: URL `https://<your domain>/api/revenuecat/webhook`, with an Authorization header value you generate (long and random).
   - **Pricing:** free up to $2,500 a month in tracked revenue, then 1% (per RevenueCat's published pricing; check before launch).
4. **Server environment** (see `.env.example`):
   - `REVENUECAT_SECRET_API_KEY` (v1 secret key)
   - `REVENUECAT_WEBHOOK_AUTH` (the exact header value)
   - `REVENUECAT_PUBLIC_KEY_IOS` / `REVENUECAT_PUBLIC_KEY_ANDROID`
   - optionally the product ids and entitlement ids
5. **Native build:** run `npm install` and `npx cap sync`. In Xcode, add the **In-App Purchase** capability to the app target. Then build in Xcode / Android Studio. The plugin is native code: an app binary built before this change can't make purchases; it shows "In-app purchases aren't available right now".
6. **Yearly plans** stay hidden until `BILLING_YEARLY_ENABLED=true` (the same switch as the website).

## Sandbox test plan (on a real iPhone)

Use a development build signed with your team, signed in with a **Sandbox** Apple Account (Settings → App Store → Sandbox Account).

1. **New member:** open Plans & billing. Check that the prices show, along with the renewal terms, Terms and Privacy links, and Restore purchases.
2. **Subscribe to Plus monthly.** The plan shows Plus, the AI Coach says it's included with Pro, and Plus tools open.
3. **Upgrade to Pro.** Pro applies at once, and the AI Coach asks for data-sharing consent, then works.
4. **Cancel** in Settings → Apple Account → Subscriptions. Plans & billing shows "set to cancel… until <date>". Sandbox renewals are accelerated (a month lasts minutes), so expiry returns you to Free shortly after.
5. **Restore:** delete and reinstall the app, sign in, tap Restore purchases.
6. **Refund:** request one through Apple's sandbox tools (or StoreKit testing in Xcode). Access ends.
7. **Billing problem:** use a sandbox account's "billing problem" option. The past-due notice appears and access continues during grace.
8. **Account deletion** while subscribed: the warning appears.
9. In RevenueCat, confirm each event reached the webhook with a 200 response.

RevenueCat's **Test Store** (a `test_…` key) can be used for quick development builds without App Store Connect. Purchases from it count only when `REVENUECAT_ALLOW_TEST_STORE=true`, which must never be set in production.

## What has been tested

- **Unit tests:**
  - mapping RevenueCat customers to subscriptions (active, cancelled, grace, expired, lifetime, refunds, Test Store and web purchases skipped);
  - webhook parsing and which members an event concerns (including transfers and anonymous ids);
  - paywall rules (yearly hidden, Google Play base-plan ids, no double subscription, upgrade/current/included);
  - purchase error messages.
- **Paywall component tests** (store mocked): prices, renewal terms, legal links, subscribe → server check, cancelled and pending purchases, restore (nothing found / found), Android upgrade naming the old product, web subscribers not offered a purchase, store unavailable.
- **Integration tests** against the real database, with a local stand-in for RevenueCat's API:
  - webhook auth (401), bad bodies (400), the TEST event;
  - purchase and duplicate delivery; upgrade; cancellation; billing grace; expiry; refund; transfer between accounts;
  - web + store (the higher plan wins);
  - a RevenueCat outage (500, then a successful retry);
  - members can read only their own rows;
  - deletion of the RevenueCat customer.
- **End-to-end:** inside the iPhone app the website checkout is never offered, and a store-billed member sees where to manage their plan and the deletion warning.

**Not tested:** real purchases on a device, the real RevenueCat API and webhooks, App Review. The RevenueCat facts used were taken from RevenueCat's documentation as indexed by search, and from the plugin's published type definitions; RevenueCat's site couldn't be loaded directly from this environment.

## Still open

- **Real-device sandbox testing:** the plan above.
- **Final legal documents:** the paywall links them once `LEGAL_TERMS_URL` / `LEGAL_PRIVACY_URL` are set; until then it links the drafts and says so. See `docs/LEGAL_REQUIREMENTS.md`.
- **US external purchase link on iOS:** optional; not built.
- **Web purchases synced into RevenueCat** (RevenueCat Web Billing): not needed; Stripe stays the web processor.
