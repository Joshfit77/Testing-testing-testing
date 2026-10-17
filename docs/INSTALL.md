# Installing Narrow Gate Fitness on your phone (before the app stores)

There are two editions of the app:

| | Offline edition | Online app |
| --- | --- | --- |
| What it is | The whole app running on your phone | The full app with accounts, using your server |
| Works without internet | Yes | No |
| Accounts, email sign-in | No (your details stay on the phone) | Yes |
| Subscriptions (Stripe) and AI coach | No | Yes |
| Needs | Nothing | Supabase + Vercel set up (see SETUP.md) |

## Android (works today)

1. On your Android phone, open
   `https://github.com/Joshfit77/Testing-testing-testing/releases/tag/android-latest`
   and tap **NarrowGateFitness-offline.apk**. (Or open the APK file you were sent.)
2. When Android asks, allow your browser or file app to **install unknown apps**.
3. Tap **Install**, then **Open**.

Every push that changes the offline edition or the Android project rebuilds this APK automatically
(GitHub Actions → "Android APK"). It's a debug-signed test build: fine for your own phones, not
for the Play Store.

## iPhone

Apple doesn't allow installing an app file directly. The options are:

1. **Today, no account needed:** open the offline edition in Safari and tap
   **Share → Add to Home Screen**. It gets an icon and runs full-screen.
2. **TestFlight (the real installed app):**
   1. Join the Apple Developer Program ($99/year) at developer.apple.com.
   2. In App Store Connect, create an app with bundle ID `com.narrowgatefitness.app`.
   3. Create an App Store Connect API key (Users and Access → Integrations → App Store Connect API, role **App Manager**) and download the `.p8` file.
   4. In GitHub, go to repository **Settings → Secrets and variables → Actions** and add these secrets:
      - `APPLE_TEAM_ID`
      - `ASC_KEY_ID`
      - `ASC_ISSUER_ID`
      - `ASC_KEY_P8_BASE64` (the `.p8` file, base64-encoded)
   5. Run **Actions → iOS → Run workflow**, choosing `testflight` and the `offline` edition.
   6. When processing finishes in App Store Connect, add yourself as a TestFlight tester and install from the TestFlight app.

Every push also runs an iPhone **compile check** (the `simulator` job), so you'll know the iPhone app
still builds. It produces a Simulator-only `.app` for testing on a Mac.

## When you're ready for the stores

See SETUP.md, "iOS & Android apps", for:
- switching to the online app (`CAP_SERVER_URL`)
- your own signing keys
- in-app purchases
- the store listings
