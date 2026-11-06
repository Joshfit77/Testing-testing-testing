# Using the demo on your own phone: the options (2026-11-06)

You asked for a way to open Narrow Gate Fitness on your iPhone and use it as a customer would: tap freely, log real
demo activity, see it appear, reset it. Nothing here has been deployed or published; each option below says what it
needs from you, what you get, and what it still does not prove. The recommendation is at the end.

What exists today, on the `claude/faith-discipleship` branch and its mirror `release/rc-2026-11-04`:

- **The real app in demo mode** (`DEMO_MODE=true`): the welcome screen offers *Explore with sample data* (the
  returning-customer account, about two months of history) and *Start as a new member* (a fresh, empty account that
  walks through the opening gate, onboarding and the first workout). A demo bar on every screen shows the Free/Pro
  switch, the presenter's guided path and now **Reset demo** (puts the sample account back to its seeded state and
  keeps you signed in). Purchases are off, the AI coach's replies are clearly labelled as simulated unless a live key
  is configured, and the demo database never holds a real member's data (the seed refuses a project with one).
- **A private deployment workflow** (`.github/workflows/demo-preview.yml`): one tag push puts that demo online as a
  Vercel *preview* behind Vercel Authentication, on a Supabase project used only for the demo. It has never been run:
  it waits on five secrets only you can create.
- **The screenshot tour** (https://claude.ai/artifact/L1eCXFJ1a3UjtQuta3nzRU): pictures of the real app with tap
  targets. Useful for a quick look, never a substitute for the app.

## Option 1: private, access-controlled live web demo (recommended)

| | |
| --- | --- |
| What you get | The real application on your iPhone in Safari (and on any Android phone in Chrome): real navigation, scrolling, forms, timers, workout logging, food and water, Bible reading with the saved position, prayer journal, progress, settings, Free/Pro switching, New member and Returning member paths, Reset demo. Add it to the Home Screen from Safari's share sheet and it opens full-screen like an app (the site ships a web manifest). |
| What it needs from you | About 45 minutes once: (1) a free Supabase project made only for the demo; (2) a Vercel account and an access token; (3) five repository secrets (`DEMO_SUPABASE_URL`, `DEMO_SUPABASE_ANON_KEY`, `DEMO_SUPABASE_SERVICE_ROLE_KEY`, `DEMO_SUPABASE_DB_URL`, `VERCEL_TOKEN`; `VERCEL_SCOPE` only for a team); (4) your go-ahead, given by pushing a tag named `demo-preview-<anything>` (or telling me to). Step-by-step in `docs/DEMO.md`, "Private hosted preview". |
| Who can open it | Only people signed in to your Vercel account or team (Vercel Authentication is switched on by the workflow, and the run removes the deployment if the link answers without a sign-in). You open it on the phone, sign in to Vercel once, then tap *Explore with sample data*. |
| Persistence | Everything you log stays in the demo database until you tap Reset demo or run the workflow again. A free Supabase project pauses after a week without use (one click in the Supabase dashboard restores it). Vercel preview deployments stay until deleted. |
| Cost | Supabase free tier; Vercel Hobby is free but for non-commercial use, so for the business Vercel's terms call for the Pro plan (about 20 USD a month) or a short evaluation. |
| What it does not prove | It is the web app in a browser, not the native shell: no Apple Health or Health Connect, no App Store or Play purchases, notifications only as in-app reminders, the barcode scanner uses the phone's web camera, GPS uses the browser's location (works in Safari with permission, but no background tracking). Those stay on the physical-device list. |
| Risk | None to production: there is no production deployment, the demo project is separate, payment keys are never given to it. |

## Option 2: iOS TestFlight build

| | |
| --- | --- |
| What you get | The native iPhone app: Apple Health, background GPS, native barcode scanner, notifications, haptics, and App Store purchases in the sandbox. The closest thing to the shipped product. |
| What it needs from you | Everything in Option 1 first (the iPhone app is a native shell that loads the deployed site: a TestFlight build is only as complete as the site it opens), plus a paid Apple Developer membership, the app record in App Store Connect and an API key or a Mac signed in to Xcode. `docs/TESTFLIGHT.md` and `docs/TESTFLIGHT_STEPS.md` have the exact steps; the project itself is ready (permissions, privacy manifest, icon, iOS 16 minimum, bundle id). |
| Time | A day or two of your account setup; the build and upload are automated in `.github/workflows/ios.yml` once the secrets exist. |
| Persistence and reset | Same demo database and Reset demo as Option 1. |
| What it does not prove | Still the demo database and simulated AI unless configured; purchases are sandbox only. |

## Option 3: Android internal testing build

| | |
| --- | --- |
| What you get | The native Android app in Google Play's internal testing track (Health Connect, background GPS, native scanner, Play purchases in test). |
| What it needs from you | Option 1 first (same reason as iOS), a Google Play developer account, an upload keystore and four repository secrets (`.github/workflows/android-play.yml` builds the signed bundle and checks it against Play's requirements; you upload it in Play Console). The separate `android-apk.yml` builds a **debug APK of the offline edition** (no accounts, no AI coach, no payments): good for a quick install on an Android phone to feel the layout, not the customer experience. |
| What it does not prove | As Option 2, on Android. |

## Option 4: the screenshot tour (secondary reference only)

The published page is pictures of the real app with tap targets, 458 screens, fixed from this round to fill any
phone with one scroll area. It shows what the screens look like; it cannot log anything, keep state, type, or scroll
inside a screen the way the app does. Keep it for a glance or for people who should not have demo credentials.

## Recommendation

**Option 1 now, Option 2 next.** The private web demo is the real application, needs no app-store account, costs
nothing to try, is reachable only by people signed in to your Vercel account, and once it exists the TestFlight
build (Option 2) is a configuration step rather than a new piece of work. Everything in Phase 7 of your brief (real
navigation, persisted demo edits, New and Returning customer, Free and Pro, Reset demo) is in the app today and is
what Option 1 serves.

What to do, in order:

1. Create the demo Supabase project and the Vercel token (`docs/DEMO.md`, "Private hosted preview", steps 1 and 2).
2. Add the five secrets to the repository (step 3).
3. Tell me, or push a `demo-preview-1` tag yourself. The workflow applies the migrations and reference data to the
   demo project, loads the sample member, creates the Vercel project with authentication on, deploys the preview,
   and runs the walkthrough against it. Its run log gives the link.
4. On the iPhone: open the link in Safari, sign in to Vercel, tap *Explore with sample data*, then Share → Add to
   Home Screen for the full-screen version.

Until then, the demo runs on this computer only (`npm run demo` with Docker; `npm run demo:reset` or the Reset demo
button between run-throughs), and the screenshot tour stays the only thing you can open from a link.

## What still needs a physical phone, whichever option you choose

- Safe areas on a notched or Dynamic Island iPhone and on Android with gesture navigation (the layout uses
  `env(safe-area-inset-*)`; emulation reports zero insets).
- The keyboard over forms (Add food, prayer entry, sign-up), rotation, and large-text accessibility settings at the
  OS level.
- VoiceOver and TalkBack through a workout, a food log and a chapter.
- GPS accuracy and background recording, the camera for barcodes and meal photos, Apple Health / Health Connect
  imports, notifications, and sandbox purchases.
- Performance on older phones (an iPhone 11 or a mid-range Android from 2021): the browser measurements in this
  repository are from a desktop Chromium emulating a phone's size, not its speed.
