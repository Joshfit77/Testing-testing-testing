# App Store and Google Play readiness

Version 1.0.0 (build 1), bundle id `com.narrowgatefitness.app` (override with `CAP_APP_ID`). The app is a Capacitor 8
shell that loads the hosted site (`CAP_SERVER_URL`), with an offline page and a bundled offline Bible.

Status key: **Done** = verified in this repository or CI; **Owner** = needs the founder (account, legal, store
console); **Device** = needs a physical phone; **Open** = engineering work remaining (see BUG_FIX_REGISTER.md).

## Apple App Store

| Area | Item | Status | Evidence / next step |
|---|---|---|---|
| Build | Xcode project compiles; archive contains the expected files; Simulator launch | Done | GitHub iOS workflow on this branch (TEST_RESULTS.md) |
| Build | Signing certificate, provisioning profile, App Store Connect record | Owner | `docs/TESTFLIGHT_FIRST_BUILD_GUIDE.md`. Keys stay in GitHub secrets / Xcode, never in chat |
| Build | `CAP_SERVER_URL` points to the production HTTPS site | Owner | Requires a production deployment (needs approval) |
| Privacy | `PrivacyInfo.xcprivacy` required-reason APIs and collected data types | Done | `f0c44da4`; checked by `check-archive.py` and a unit test |
| Privacy | App Privacy "nutrition label" answers in App Store Connect | Owner | Use the data inventory in `docs/DATA.md` and the privacy manifest; health, fitness, photos, user content, identifiers, purchases, usage data (analytics) |
| Privacy | Privacy policy URL, live and final | Owner | The in-app text is a draft pending legal review (precedent `3ffdf80d`); the bundled offline copy was corrected (B-16) |
| Privacy | Usage-description strings (camera, photos, location always/when in use, motion, HealthKit, notifications) | Done | `Info.plist`; wording reviewed by the mobile review |
| HealthKit | Read-only types; no writes; health data never used for advertising | Done (code) / Device | Device tests 17–18 |
| Guideline 2.1 | Demo account for App Review | Owner | `docs/DEMO_ACCESS_OPTIONS.md`; create a reviewer account on production |
| Guideline 2.5.4 | Background location justified (run recording) | Open / Device | O-01, O-02: the "not yet verified on a phone" wording must change after device test 14 passes |
| Guideline 3.1.1 | Digital subscription sold only through In-App Purchase on iOS; no web checkout links | Done (code) / Device | `56717544` adds the native notice instead of any Stripe path; device test 31 |
| Guideline 3.1.2 | Subscription terms, price, renewal and cancellation shown before purchase; Restore button | Done (code) / Device | Paywall screen; device tests 29–30 |
| Guideline 3.1.2 | Products in App Store Connect: $17.99 monthly, $119.99 yearly | Owner | Prices must match the approved pricing; RevenueCat offering ids per `docs/MOBILE_BILLING.md` |
| Guideline 5.1.1(v) | In-app account deletion | Done | Tested (integration `account-deletion-closure`, browser suite) |
| Guideline 1.4.1 | Health/fitness claims are not medical advice; disclaimers present | Done | Onboarding and legal pages |
| Guideline 4.2 | Enough native value beyond a website | Risk | Native features: HealthKit, background GPS, barcode camera, notifications, offline Bible. Reviewers sometimes still reject web-shell apps; the device tests are the evidence |
| Content | Screenshots (6.9", 6.5", 5.5"; iPad if supported), description, keywords, age rating (likely 4+ or 12+ for UGC/Friends) | Owner | Friends is switched off; if enabled later, the reporting/blocking features already exist (migrations 091–093) |
| Export | Encryption: standard HTTPS only (`ITSAppUsesNonExemptEncryption = false`) | Verify | Confirm the key in `Info.plist` before upload |

## Google Play

| Area | Item | Status | Evidence / next step |
|---|---|---|---|
| Build | Android project compiles to an APK | Done (CI) | Compile-only Android workflow, `publish=false` (TEST_RESULTS.md) |
| Build | Signed release AAB, Play Console app, upload key | Owner | Never paste the keystore into chat; store it in GitHub secrets |
| Policy | Data safety form | Owner | Same inventory as Apple's label |
| Policy | Health Connect declaration (5 read types) and the privacy-policy link | Owner / Device | B-16 fixed the policy text; Android device test 8 |
| Policy | Background location declaration and video | Owner / Device | Android device test 6 |
| Policy | Foreground service type (location) declaration | Owner | Play Console form |
| Billing | Play Billing products via RevenueCat at the approved prices | Owner | Google may localise prices |
| Quality | Android 15 edge-to-edge, back button | Open | O-06, O-07 |

## Blocks before submission (summary)

1. Production deployment and final `CAP_SERVER_URL` (owner approval).
2. Device tests in IPHONE_DEVICE_TESTING.md, especially GPS (14–15), purchases (29–31), HealthKit (17–18).
3. O-02 wording change after those tests pass; O-01 recommended before relying on long locked-screen runs.
4. Final privacy policy and terms published at public URLs.
5. Store records, products at $17.99 / $119.99, reviewer account, screenshots.
