# TestFlight: first internal beta

Branch: `claude/testflight-prep` (the cinematic opening from `claude/animated-opening-demo` merged with the app work
on `claude/sharp-cray-8y0uuv`). Nothing here has been deployed or uploaded.

## How the iPhone app works

The iPhone app is a native shell (Capacitor) around the **deployed web app**: it opens `CAP_SERVER_URL` in a web view
and adds the native parts (Apple Health, background GPS, barcode scanner, notifications, haptics, App Store
purchases). So:

- A TestFlight build is only as complete as the site it loads. **A deployed HTTPS site is required first.**
- Changes to the web app reach testers as soon as the site is redeployed; only native changes (plugins,
  permissions, icons) need a new build.
- The offline edition (`CAP_MODE=standalone`) is a separate, limited demo (no accounts, AI coach or payments). It is
  used for the compile check only and is never uploaded.

`capacitor.config.ts` has no default address: syncing the online app without a real `https://` address stops with
an error, so a build can't point at a placeholder.

## What blocks an upload today

| | Status | What's needed |
| --- | --- | --- |
| Deployed site | **Blocked** | No deployment exists. Needs your Supabase project, a host (e.g. Vercel) and your go-ahead to deploy. |
| Apple Developer account | **Blocked** | Needs your paid membership, the app record and an API key (or Xcode signed in to your account). |
| iPhone project | Ready to build | Permissions, privacy manifest, icon, iOS 16 minimum, bundle ID `com.narrowgatefitness.app`. |
| Opening in an iPhone build | Checked in the Simulator by CI | `app-in-simulator` job in `.github/workflows/ios.yml`. Not yet seen on a physical iPhone. |

## Step by step

### 1. Deploy the web app (needs your approval)

1. Create a Supabase project; apply the migrations (`npx supabase link`, `npx supabase db push`).
2. In Supabase > Authentication > URL configuration, set the Site URL to your app address and add it to the
   redirect URLs.
3. Create the hosting project (Vercel: import the repository, framework Next.js, branch `claude/testflight-prep`).
4. Set the environment variables from `.env.example`, with payments in test mode:
   - `NEXT_PUBLIC_SITE_URL` = your app address; Supabase URL, anon key and service-role key.
   - Stripe **test** keys only (`sk_test_...`); leave `STRIPE_LIVE_APPROVED=false` (live keys are ignored without it).
   - `REVENUECAT_ALLOW_SANDBOX=true` on this test deployment only (TestFlight purchases are Apple sandbox purchases
     and are free); `REVENUECAT_ALLOW_TEST_STORE=false`.
   - `ANTHROPIC_API_KEY` for the AI coach (optional; the coach says so honestly when it isn't configured).
   - `FOOD_IQ_SCORE=off` until the method is reviewed.
5. Deploy, then open `https://<your address>/api/health`. It should answer
   `{"data":{"app":"narrow-gate-fitness","commit":"<the commit>"}}`, and the address itself should play the opening.

### 2. Set up your Apple Developer account (once)

1. Enrol in the Apple Developer Program (developer.apple.com/programs, paid yearly membership).
2. Note your **Team ID** (developer.apple.com > Account > Membership details).
3. Certificates, Identifiers & Profiles > Identifiers > **+** > App IDs > App: bundle ID
   `com.narrowgatefitness.app` (or another you own), and tick **HealthKit**. Nothing else is needed: background
   location is an Info.plist setting, and in-app purchase is on by default.
4. App Store Connect > Apps > **+** > New App: platform iOS, name "Narrow Gate Fitness", the bundle ID above, any SKU.
5. App Store Connect > TestFlight > Internal Testing: create a group and add yourself.

### 3a. Upload with GitHub Actions (no Mac needed)

1. App Store Connect > Users and Access > Integrations > App Store Connect API > **+**: role **Admin** (needed for
   automatic signing to create the distribution certificate). Download the `.p8` file once; note the Key ID and
   Issuer ID.
2. GitHub > the repository > Settings > Secrets and variables > Actions > New repository secret. Add:
   `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, and `ASC_KEY_P8_BASE64` (on a Mac: `base64 -i AuthKey_XXXX.p8 | pbcopy`).
   Enter them only there, never in chat, issues or files.
3. Actions > iOS > Run workflow: branch `claude/testflight-prep`, job `testflight`, `server_url` = your deployed
   address, **upload unticked**. This checks the site (health, the current opening) and signs the build without
   sending anything to Apple.
4. When that passes, run it again with **upload ticked**.
5. Wait for App Store Connect > TestFlight to finish processing the build (usually 10–30 minutes). The export
   compliance question is answered by the app (no non-exempt encryption).
6. On your iPhone: install **TestFlight** from the App Store, open the invitation (or TestFlight shows the app if
   you're an internal tester), and install Narrow Gate Fitness.

### 3b. Upload with Xcode (on a Mac)

1. Install Xcode (latest), Node 22, then: `git clone` the repository, `git checkout claude/testflight-prep`, `npm ci`.
2. `CAP_SERVER_URL=https://<your address> npx cap sync ios`, then `npx cap open ios`.
3. In Xcode: target **App** > Signing & Capabilities: tick *Automatically manage signing*, choose your Team, check the
   bundle ID, and that **HealthKit** is listed.
4. Choose **Any iOS Device (arm64)** as the destination, then Product > **Archive**.
5. In the Organizer: **Distribute App** > App Store Connect (or *TestFlight Internal Only*) > Upload.
6. Continue with step 3a.5.

### Installing straight from Xcode while you work (optional)

For day-to-day testing you can skip TestFlight: connect your iPhone, turn on Developer Mode (Settings > Privacy &
Security), choose it in Xcode and press **Run**. With `CAP_SERVER_URL` pointing at your deployed site the app
loads it; for a site running on your Mac use `CAP_SERVER_URL=http://<your Mac's LAN address>:3000
CAP_ALLOW_CLEARTEXT=true` (local testing only).

## Automated checks (every push to `claude/testflight-prep`)

`.github/workflows/ios.yml`, no Apple account needed:

- **compile**: the offline edition compiles for the Simulator.
- **app-in-simulator**: builds and serves the full web app on the build Mac, points the iPhone app at it, opens it
  once in an iPhone simulator (the first launch after installing is slow on CI), waits for the machine to settle,
  then runs XCUITest (`scripts/ios-verify`): a fresh launch left alone is filmed, Enter Narrow Gate is pressed
  (timed from the opening's first frame: see below), the app is relaunched (the opening must replay, with
  Matthew 7:13–14), Skip intro is tapped, and the app returns from the background (it must not replay). The log
  ends with the test results, each frame's brightness, a coarse text picture of key frames and one CHECK line per
  filmed step; screenshots and contact sheets are in the `opening-in-simulator` artifact.
- **webkit**: the opening and navigation browser tests in WebKit (Safari's engine) at iPhone 15 size, signed in
  against a throwaway local Supabase.

### Why the opening checks are timed the way they are

Shared CI machines have no GPU, so the opening is drawn in software and everything that touches the app while it
animates is slow: a Simulator screenshot takes 0.3–2.5 s, a synthesized tap lands 0.3–1.8 s after it is sent, and
WebKit can go over a second without drawing a frame. The opening itself is untouched; the checks are built around
those delays:

- Enter Narrow Gate rises in 2.15 s into the opening, the opening moves on by itself at 3.85 s and is gone at
  5.05 s. The Simulator test does not wait for a screenshot to show the risen button (that put the tap after the
  window on a slow machine): it films the launch with cheap frames of the blank page, takes the opening's first
  painted frame as its clock (or the moment a blank capture stalls because the simulator is painting those first
  frames), and sends the tap 2.0 s after it, at the place the fresh launch's film showed the button. Frames are
  decoded in the background, so a film runs at the pace of the screenshot call alone. The frame right after the
  press must show the door open with its light, so a tap that lands after the opening moved on by itself fails
  and XCTest retries it; then the opening must end and the welcome page appear. The light after the press counts
  as proof of the move only when it comes within 3.9 s of the opening's first frame, before the opening's own
  move could have brightened the screen; a later light, or screenshots too slow to catch it, is said so in the
  log (a `1-nolight.txt` note and the CHECK verdict) rather than passed or failed blindly.
- The fresh launch measures the machine. The simulator's screenshot service can stall for seconds while the
  opening's heavy first frames render, and the opening goes on meanwhile: when no frame could be taken while the
  door stood open, the fresh launch says so (a `0-stall.txt` note and a warning) instead of failing, since Skip
  intro's presence and the opening's end are still checked through the accessibility tree. The Enter check then
  runs only when that film caught the door open and a screenshot call takes under 0.9 s; otherwise a film cannot time the press or catch the half second of light,
  and the check is skipped with the measured reason (an XCTest skip, a `::warning::` line and a SKIPPED
  verdict). The relaunch and background checks always run, and the move into the light is checked frame by
  frame in WebKit. Frames of retried attempts are kept under `earlier-attempts/` in the artifact.
- The WebKit test films the move into the light from inside the page, frame by frame from the press itself, so
  slow round trips between Playwright and the browser cannot miss the 0.9 s push; it still requires the scene to
  grow past 2.5x and the light to fill the screen. When the machine draws no frame before the opening's own 1.5 s
  safety timer closes the overlay, the test fails and Playwright retries it on a fresh page, reporting it as flaky.
- The job waits for the Mac's CPU to be mostly idle before the warm-up launch and again before the tests.

Signed-in screens (tabs, workouts, Food IQ, AI coach, GPS) are covered by the full browser suite
(`npx playwright test`) against a local Supabase; Apple Health, background GPS and the camera scanner need a
physical iPhone.

## Before inviting external testers

Internal testers (people on your App Store Connect team) need no review. External testing needs Beta App Review:
a privacy policy URL (`LEGAL_PRIVACY_URL`), the App Privacy answers in App Store Connect matching
`ios/App/App/PrivacyInfo.xcprivacy`, a test account for the reviewer, and contact details.

## Who does what

| Step | Claude can do it from the repository | Needs you (account, money, approval or a device) |
|---|---|---|
| Deploy the web app | Prepare config, environment variable list, health check, CI; run the deploy **only after you approve and give access** | Create the Supabase project and host account; approve the deploy; enter secrets in the host (never in chat) |
| Supabase | Migrations are in the repo (`supabase/migrations`); `supabase db push` once linked | Create the project; link it; apply migrations to the live project (a destructive step needs your go-ahead) |
| Apple Developer | Nothing: Apple requires the account holder | Enrol; note the Team ID; register the App ID with HealthKit; create the App Store Connect app; create the internal-testing group |
| Signing | The workflow is written; it signs when the four secrets exist | Create the App Store Connect API key (Admin role); add `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64` as repository secrets |
| RevenueCat sandbox | Product ids, entitlements and webhook are coded (`docs/MOBILE_BILLING.md`) | Create the RevenueCat project and the four App Store subscriptions; add the keys to the deployment; create sandbox testers |
| Build and archive | The `testflight` job builds and signs on GitHub's Mac; or you archive in Xcode | Run the job (upload unticked first) |
| Upload to TestFlight | The job can upload when `upload` is ticked | **Your explicit approval**, then tick `upload` |
| Install and test on an iPhone | The device plan is written (`docs/launch-audit/IOS_DEVICE_TEST_PLAN.md`) | Install TestFlight, run the plan, send results |

## Requirements by stage

Marked **unverified** where the current App Review Guidelines could not be opened from the audit sandbox; confirm against developer.apple.com before each stage.

| Requirement | Internal TestFlight (your own testers, no review) | External TestFlight (Beta App Review) | App Store release |
|---|---|---|---|
| Deployed HTTPS site, Apple account, signed build | Required | Required | Required |
| Privacy policy URL in App Store Connect | Not enforced for internal builds (unverified) | Required | Required (5.1.1(i)) |
| Final terms, EULA choice | Not needed | Recommended | Required |
| App Privacy ("nutrition label") answers | Not needed | Required before the first external build (unverified) | Required |
| In-app purchases live in App Store Connect | Sandbox only | Sandbox / review | Products approved with the app (3.1.1) |
| Review notes, demo account, screenshots, age rating | Not needed | Beta review notes and a test account | Full metadata (2.3) |
| Export compliance | Answered in `Info.plist` | Same | Same |
| Device testing of Health, GPS, camera, purchases | This is what internal testing is for | Done | Done |
| Legal clearance (trademark, patents) | Not an Apple requirement | Not an Apple requirement | Business decision before commercial release (`docs/launch-audit/E_LAUNCH_READINESS.md`) |
