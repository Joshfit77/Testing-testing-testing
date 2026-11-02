# From LLC to TestFlight on your iPhone: setup guide

Who does each step is marked: **You** (your accounts, money or approval) or **Done** (already in the repository).
Detailed reference: [TESTFLIGHT.md](TESTFLIGHT.md) (how the build works),
[STAGING_ENVIRONMENT.md](STAGING_ENVIRONMENT.md) (every setting) and [MOBILE_BILLING.md](MOBILE_BILLING.md).
Never paste keys, passwords or `.p8` files into chat, issues or files. They go only into the dashboards and GitHub
secrets named below.

| # | Step | Who |
|---|---|---|
| 1 | Enroll in the Apple Developer Program as an organization | You |
| 2 | Register the App ID `com.narrowgatefitness.app` | You |
| 3 | Turn on HealthKit and In-App Purchase | You (the project side is Done) |
| 4 | Create the App Store Connect app record | You |
| 5 | Create the two Pro subscriptions | You |
| 6 | Connect RevenueCat and its webhook | You (the server side is Done) |
| 7 | Staging: Supabase and an HTTPS deployment | You (the configuration is Done) |
| 8 | Signing secrets in GitHub | You (the workflow is Done) |
| 9 | Signing-only build | You start it; the workflow does the rest |
| 10 | Upload the first internal build | You, after approving |
| 11 | Install TestFlight | You |
| 12 | Test the native features | You (checklist below) |
| 13 | Test purchases without real charges | You (sandbox) |
| 14 | Report defects, retest new builds | You and me |

## 1. Apple Developer Program, as your LLC

After the LLC is formed:
1. Get a **D-U-N-S Number** for the LLC (free from Dun & Bradstreet, through Apple's lookup tool). Apple uses it to
   verify the organization. The legal name must match your formation documents exactly.
2. Make sure the LLC has a website on its own domain, and that you can legally bind it (owner or authorized officer).
3. Enroll at developer.apple.com/programs/enroll with an Apple Account under your company email. Choose
   **Organization**. Apple charges an annual membership fee; that purchase is your decision.
4. Verification can take several days. When it's done, note the **Team ID** (Account → Membership details).

Enrolling as an organization makes the LLC the seller shown on the App Store.

## 2–3. App ID and capabilities

1. Certificates, Identifiers & Profiles → Identifiers → **+** → App IDs → App.
2. Bundle ID (explicit): `com.narrowgatefitness.app`.
3. Capabilities: tick **HealthKit**. In-App Purchase is included for every App ID; there's nothing to tick.
   Background location needs no capability (it's an Info.plist setting, already in the project).

Done in the project: the HealthKit entitlement, the permission texts (camera, Apple Health, location while in use and
while locked), background location, the privacy manifest, the app icon and launch screen, iOS 16 minimum, arm64. CI
checks these on every run (see "Device archive check" in `.github/workflows/ios.yml`).

## 4. App Store Connect app record

Apps → **+** → New App: iOS, name **Narrow Gate Fitness**, primary language English (U.S.), the bundle ID above,
any SKU (e.g. `NGF001`), full access. In TestFlight → Internal Testing, create a group (e.g. "Owners") and add
yourself. Internal testers need no App Review.

## 5. The two Pro subscriptions (approved prices only)

Monetization → Subscriptions → create a group **Pro All Access**, then two auto-renewable subscriptions:

| Reference name | Product ID | Duration | Price (U.S.) |
|---|---|---|---|
| Pro Monthly | `ngf_pro_monthly` | 1 month | $19.99 |
| Pro Yearly | `ngf_pro_yearly` | 1 year | $149.99 |

Use exactly these product IDs; the server maps them to Pro. Don't create Plus products. Before the first
subscription can be sold, Apple requires the Paid Apps agreement, banking and tax forms (Business section). Sandbox
testing works before then.

## 6. RevenueCat

1. In RevenueCat, create a project and add an **App Store** app with bundle ID `com.narrowgatefitness.app`.
   Connect it with an In-App Purchase key from App Store Connect (Users and Access → Integrations → In-App Purchase).
2. Products: import `ngf_pro_monthly` and `ngf_pro_yearly`. Entitlement: identifier **`pro`**, with both products
   attached. Offering: the default one, with both packages.
3. Integrations → Webhooks: URL `https://<staging-domain>/api/revenuecat/webhook`. Set an Authorization header value
   of your choice (a long random string); the same value goes in `REVENUECAT_WEBHOOK_AUTH`.
4. Copy the secret API key into `REVENUECAT_SECRET_API_KEY` and the public iOS key (`appl_…`) into
   `REVENUECAT_PUBLIC_KEY_IOS`, on the staging deployment only.
5. Leave "transfer purchases" at RevenueCat's default. The server re-reads both accounts whenever a purchase moves,
   and never trusts the webhook body.

## 7. Staging

Follow [STAGING_ENVIRONMENT.md](STAGING_ENVIRONMENT.md):
- a separate Supabase project with every migration applied;
- an HTTPS deployment of the branch;
- Stripe in **test mode**;
- `REVENUECAT_ALLOW_SANDBOX=true` on staging only.

Then run its smoke test. The TestFlight build loads this address, so test accounts and test purchases never touch
production.

## 8. Signing secrets

App Store Connect → Users and Access → Integrations → App Store Connect API → **+**:
1. Create a key with the **Admin** role.
2. Download the `.p8` once.
3. In GitHub, under Settings → Secrets and variables → Actions, add four repository secrets:
   - `APPLE_TEAM_ID`;
   - `ASC_KEY_ID`;
   - `ASC_ISSUER_ID`;
   - `ASC_KEY_P8_BASE64` (on a Mac: `base64 -i AuthKey_XXXX.p8 | pbcopy`).

## 9. Signing-only build (nothing leaves GitHub)

Actions → **iOS** → Run workflow, with these inputs:
- branch: the one deployed to staging;
- job: `testflight`;
- `server_url`: `https://<staging-domain>`;
- **upload unticked**.

The workflow then:
- checks the site answers `/api/health` and serves the opening;
- checks that Xcode is a release (not a beta) with the iOS 26 SDK or later, Apple's current minimum (the iOS 27 SDK
  becomes the minimum in April 2027);
- configures the online app, archives it, signs it with your key, then deletes the key.

## 10. First upload (needs your approval)

Run the same workflow with **upload ticked**. Processing in App Store Connect usually takes 10–30 minutes. The build
number is the workflow's run number, so every upload is unique. Export compliance is already answered in the app
(standard HTTPS encryption only).

## 11. Install on your iPhone

Install **TestFlight** from the App Store, signed in with the Apple Account you added as an internal tester. The build
appears there; tap Install. Your iPhone needs iOS 16 or later.

## 12. Test what a Simulator can't

Work through the "Physical iPhone" list in [PRE_TESTFLIGHT_READINESS_REPORT.md](PRE_TESTFLIGHT_READINESS_REPORT.md)
(section E). Note the build number and the date for every result.

## 13. Purchases without real charges

1. On the iPhone, Settings → App Store → Sandbox Account: sign in with a sandbox tester. Create one in App Store
   Connect → Users and Access → Sandbox.
2. In the app, open Profile → Plans & billing and buy Pro Monthly. TestFlight purchases are always sandbox purchases: no
   charge, and renewals are sped up (a month renews in minutes).
3. Check each of these:
   - Pro unlocks;
   - "Restore purchases" works after reinstalling the app;
   - switching to Yearly works;
   - after you cancel (sandbox account → Manage), Pro ends when the sped-up period runs out;
   - signing in to a second Narrow Gate account on the same phone doesn't carry Pro over unless you restore it there.
4. Stripe on the web: in test mode only, with card `4242 4242 4242 4242`.

## 14. Defects and retesting

For each problem, record:
- the build number (TestFlight → the build);
- the iPhone model and iOS version;
- the steps;
- what you expected and what happened;
- a screen recording if you can.

A fix in the web app reaches testers as soon as staging is redeployed. Only native changes need a new build: plugins,
permissions, the icon, or the server address.
