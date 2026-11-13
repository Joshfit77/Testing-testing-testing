# Interactive demo

The demo is the real app, built in **demo mode**, with its own throwaway database full of sample data. Nothing in it
is a mock-up: the screens, animations, opening, 157 exercise demonstrations and Faith section are the production code.

## Run it on your computer (one command)

Needs Node 22 and Docker Desktop running.

```bash
npm run demo
```

Then open http://localhost:3000 in Safari or Chrome and tap **Explore with sample data**. On an iPhone on the same
Wi-Fi, open `http://<your computer's IP address>:3000`.

- **Start as a new member** creates an empty account so you can walk through onboarding.
- The sample account's password is written to `.demo-credentials.local` (ignored by Git). You only need it to sign
  in by hand; the button signs you in.
- If you've used the local database for development, the seed refuses to run (it only seeds a database with no other
  accounts). `DEMO_RESET_LOCAL_DB=true npm run demo` wipes the **local** database first.
- Each run re-creates the sample data, so anything you log during a session is reset next time.

### On a MacBook, step by step

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and open it (wait for "Engine running").
2. Install Node 22 (for example from nodejs.org).
3. In Terminal: `cd` into this repository, then `npm run demo`. The first run downloads the database images and
   builds the app: allow about 5–10 minutes. Later runs take 2–3 minutes.
4. When Terminal prints `Narrow Gate Fitness demo: http://localhost:3000`, open that address in Safari or Chrome.
5. To show it at phone size on the Mac: Safari › Develop › Enter Responsive Design Mode (turn on the Develop menu in
   Safari › Settings › Advanced), or Chrome › View › Developer › Developer Tools › the phone icon. Or open it on an iPhone
   on the same Wi-Fi (macOS may ask to allow incoming connections for `node`: allow it).
6. To stop: press Control-C in Terminal. Docker keeps the database for next time.

| Command | What it does |
|---|---|
| `npm run demo` | Starts the database, loads the sample account, builds and serves the demo on port 3000 |
| `npm run demo:reset` | Puts the sample account back to its starting state in about 10 seconds while the demo keeps running (the password stays the same; sign in again with **Explore with sample data**). The same thing from inside the app: the demo bar's **Reset demo** button (below) |
| `DEMO_RESET_LOCAL_DB=true npm run demo` | Wipes the **local** database first (only needed if you used it for development) |
| `DEMO_SHOW_SCORE=on npm run demo` | Also shows the experimental Nutrition Score number on product pages. Off by default: the formula hasn't had its dietitian review (`docs/FOOD_IQ_METHOD.md`) |
| `PORT=3001 npm run demo` | Another port |

### The sample member

"Demo Athlete", 28, intermediate, training for strength with gradual fat loss, a 5K and better nutrition, with an
active Faith life. All of it is made up by `scripts/demo/seed-demo.ts`, dated relative to today so it always looks
current:

- **Training:** Powerbuilding 4-Day in week 3, about 8 weeks of logged workouts, personal records, bodyweight and
  measurements, goals.
- **Food:** 30 days of meals, water and steps against 2,600 kcal / 185 g protein targets; today's dinner not yet
  logged.
- **Cardio and recovery:** 8 runs on sample routes; 28 nights of sleep with stages (pretend Apple Watch imports).
- **Faith (all free):** a 90-day Gospels reading journey on day 21, kept every day so far and recorded through the
  database's own daily rule (today's reading and prayer are left open so you can mark them live); the reading history
  for those days; highlights, bookmarks and notes (Matthew 7:13–14 is bookmarked); two memory verses; a guided study
  lesson done with the member's own notes; a prayer journal with an answered request and an open one for a family
  member; the 40-day challenge on day 13; daily disciplines.
- **Notifications:** reading, prayer, before-midnight, workout, lunch, water and wind-down reminders switched on, with
  quiet hours, so the settings screen and its **Next 24 hours** preview have something to show.
- **Consents:** the member has agreed to meal and label photos and to coach memory, so those screens open straight away.
  Prayer entries are **not** shared with the AI coach (each entry is private unless ticked).

### Presenter panel (in the demo bar)

Every screen of a demo deployment shows the demo bar; under it is the presenter's **guided path**: 20 stops from the
opening to the closing Home screen (`src/lib/demo/presenter.ts`). It shows where you are ("4/20 Live workout"), a
**Live / Sample data / Simulated AI / Preview** tag for that stop, one line on what to show, **Next** and **Back**, a
list of all stops to skip ahead or go back to, and **Hide** (a small "Presenter" button brings it back, for clean
screen recordings).

- **Skip and return:** open the list and tap any stop. If you wander off the path (a screen that isn't a stop), the
  panel says so and offers "Back to *n*. *stop*".
- **The opening plays once per browser tab**, at the start, not again on every reload. Stop 1 (**Play the opening**)
  plays it again on purpose.
- **Recovering from a mistake:** a wrong tap is undone with Back or the list. If sample data got changed (a workout
  saved, a reading marked), tap **Reset demo** in the demo bar (or run `npm run demo:reset` in Terminal and tap
  **Explore with sample data** again).
- **Reset demo** (demo bar, sample account only): after a confirmation it wipes everything the sample account logged
  and re-seeds its history, keeps you signed in and returns to Home. It exists only when the server runs in demo mode,
  only for the account the server created as the demo account, never for any other account, and is limited to six
  resets in ten minutes (`src/server/actions/demo.ts`, `src/server/demo-seed.ts`; `e2e/demo-reset.spec.ts`).
- The panel is only links: it unlocks nothing. It is remembered only in this browser tab.

The full talk track, tap by tap, is in `docs/PRESENTATION_GUIDE.md`.

## What demo mode does (`DEMO_MODE=true`)

| Area | Behaviour |
|---|---|
| Data | Its own Supabase database. The seed refuses any database that has accounts it didn't create, and any hosted project unless `DEMO_SEED_ALLOW_REMOTE=true` |
| Demo bar | On every screen: sample data, purchases off, AI simulated, and a **Free / Pro** switch |
| Free / Pro switch | Writes a test entitlement on the server (`user_entitlements`, source `admin`). It works only for accounts the server marked as demo accounts (`app_metadata.demo`, which members can't set), and only in demo mode. There is no client-side bypass |
| Purchases | Stripe and RevenueCat keys are ignored in demo mode, so checkout and store purchases can't start. The membership screen says so |
| AI | Answered inside the server by a scripted stand-in (`src/lib/demo/simulated-ai.ts`). Every reply says "Simulated demo reply — written by a script, not an AI model". Any AI key is ignored in demo mode, so no AI provider is called and nothing is paid for |

## Live, simulated, or needs a phone

| Feature | In the demo |
|---|---|
| Opening, onboarding, Home, programs, the 2D exercise demonstrations (moving, pose frames or a labelled placeholder per exercise, `docs/EXERCISE_DEMOS_2D.md`), workout logging (rest timer with −15 s and Skip, form cues and common mistakes), history, calendar | **Live** (real app, sample data) |
| Food diary, meal planner, recipes, grocery list, water, steps | **Live** (food search uses the built-in food database) |
| Check a label (typed ingredients): additives, sugars, sodium, allergens, evidence notes | **Live**, rule tables in the app |
| Barcode lookup | **Live, needs internet** (Open Food Facts). Type a real barcode from a product you have with you, or use the camera in the phone app. No products are made up |
| Nutrition Score number | **Off** by default (experimental, unreviewed); `DEMO_SHOW_SCORE=on` shows it, labelled experimental |
| Progress, records, badges, body measurements, Body Scan screens | **Live**. Saving a new Body Scan needs photos; don't upload real body photos to a demo server |
| Sleep & Recovery dashboards, check-ins, scoring | **Live** on sample nights. Nights labelled "Apple Watch (sample data)" are pretend imports |
| Faith: Bible (BSB, words of Jesus in red), highlights, notes, reading journeys, prayer journal, memory verses, studies, 40-day challenge, practices | **Live**, Free. Study commentary that hasn't been reviewed stays hidden, as in the real app |
| Bible study assistant (Faith › Ask) | **Simulated** (labelled) |
| Notification settings and the Next 24 hours preview | **Live** settings; **delivery needs the phone app** |
| Free / Pro comparison, $17.99 / $119.99 prices | **Live**; purchases turned off |
| AI Coach, AI meal plans, food-photo estimates, label-photo reading, product explanations | **Simulated** (labelled). The coach's real tools still run on the sample data, and suggestions still wait for approval |
| Runs with routes | **Sample routes** (labelled), not real recordings |
| Live GPS recording | **Needs the phone app** outdoors |
| Apple Health / Health Connect imports | **Needs the phone app** on a phone |
| Barcode camera scanning, notifications, alarms, in-app purchases | **Needs the phone app** |

### What the demo never does

It never charges a card or starts a subscription (payment keys are ignored), never touches real members' records (the
seed refuses any database with accounts it didn't create), never sends push notifications (the web app can't, and the
demo has no push keys), never calls an AI model (replies are scripted and say so), never reads Apple Health (that
needs the phone app) and never records GPS without the phone's own permission prompt. The Free/Pro switch works only
for accounts the server created as demo accounts, only when the server runs in demo mode.

## The clickable iPhone demo (captured screens)

Rebuilt 2026-11-09 (page version 26) from the redesigned build, commit `b4f7b99` of this branch, by
`scripts/demo/iphone-demo/` (see its README): a private page that opens on an iPhone in Safari and fills the screen.
Published in place as **Narrow Gate iPhone Demo**, https://claude.ai/artifact/L1eCXFJ1a3UjtQuta3nzRU (private: only the
owner and whoever the owner shares it with). The stale pictures of version 22 were removed, not left behind.

| | |
| --- | --- |
| What it is | **Pictures of the real app**, captured in demo mode (sample data, purchases off, AI simulated) at iPhone 15 Pro size (393 CSS px at 3×, 1179 px wide, one WebP q88 pass), joined by the real tap targets: 557 screens captured, 462 kept, 5,379 taps (4,045 land on a captured screen; the rest say the screen was not captured). The ten redesigned reference screens (Home, Workout in progress, Exercise demonstration, Workout complete, AI Coach, Nutrition, Programs, Progress, Faith, Narrow Gate Pro), the five tabs, Quick Add, Search, Customize, Run (GPS run and walk, the treadmill log, history), Sleep & Recovery (45 screens), Faith and the Bible (58), 146 of the 157 exercise pages (the page's hosting allows 511 files, so 11 of the library's later pages are left out), My Progress, the settings and the membership screen. |
| What is live | The 2D exercise demonstrations draw and move on all 146 captured exercise pages and on all three tabs of the workout's demonstration dialog (Setup, Execution, Mistakes); everything else is a picture. |
| Captured step by step | The workout flow (start, demonstration dialog with its Setup / Execution / Mistakes tabs, log set 1 with the rest timer, set 2, exercise options, substitute picker, substituted, finish, Workout Complete), the AI coach (question typed, simulated reply), the Run log with Treadmill chosen, and the new-member path (five questions as asked and answered, Ready, the plan, the first workout, the new member's own tabs). |
| Not live | Typing, timers, GPS, the camera, Apple Health, purchases, and any screen not among the captured ones (a tap says so). |
| On a phone | The page never scrolls itself: only the captured screen does, at the full width in portrait and centred at its captured width in landscape, with the phone's safe areas applied once. |
| Checks | `verify.mjs` on the page as downloaded from the published artifact (2026-11-09, `PUBLISHED=1`): 44 of 44 checks (opening → welcome → sample data → the five tabs → back → the whole workout flow → the three demonstration tabs → menu → coach → Run log → Treadmill → new member; live demonstrations draw and move on 146/146 exercise pages and the three dialog tabs; every picture present; every tap target inside its screen; no page errors; no missing files; fills 39 of 39 iPhone and Android viewports, 74 models). The published file list (508 files) matched the local build byte for byte on the files sampled. |

It is not the live app on the phone: that is the private preview deployment above, which waits on the owner's
one-time setup (the six repository secrets) and a `demo-preview-*` tag, and the TestFlight build after it. The
real app in demo mode (`npm run demo`) is the primary demo; the page is a reference.

## Private hosted preview (Vercel, protected)

`.github/workflows/demo-preview.yml` puts the demo online as a **Vercel preview deployment** (never production)
that only people signed in to your Vercel account can open, backed by a **separate Supabase project used only for the
demo**. It runs only when a `demo-preview-*` tag is pushed, after the owner approves.

### One-time setup (owner)

1. **Demo database.** At supabase.com create a new project, for example `narrow-gate-demo` (the free plan is
   enough). Never use the production project: the workflow refuses a database with any account the demo didn't
   create. From the new project copy:
   - Project Settings > API: the Project URL, the `anon` key and the `service_role` key;
   - Connect > Connection string > **Session pooler** (not "Direct connection", which GitHub can't reach), with the
     database password filled in.
2. **Vercel.** Sign in at vercel.com and create an access token (Account Settings > Tokens) with a short expiry.
   You don't need to create a project or connect the repository; the workflow creates a project named
   `narrow-gate-fitness-demo` with Vercel Authentication switched on.
3. **GitHub secrets.** In this repository: Settings > Secrets and variables > Actions > New repository secret.
   Add `DEMO_SUPABASE_URL`, `DEMO_SUPABASE_ANON_KEY`, `DEMO_SUPABASE_SERVICE_ROLE_KEY`, `DEMO_SUPABASE_DB_URL`
   (the session pooler string) and `VERCEL_TOKEN`, plus `VERCEL_SCOPE` (your team slug) only if the project should
   live in a Vercel team.

No Stripe, RevenueCat or AI keys are needed or used.

### Deploying (after approval)

Pushing a tag such as `demo-preview-1` on the `claude/interactive-demo` branch runs the workflow. It:

1. stops if the secrets are missing, point at two different projects, or the database has real accounts;
2. applies the app's migrations and reference data (exercises, programs, foods) to the demo database;
3. loads the sample member (the password stays inside the run and the deployment; it's never printed);
4. creates the Vercel project, switches on Vercel Authentication, and stops if it can't;
5. deploys a preview with `DEMO_MODE=true`;
6. checks that the link refuses visitors who aren't signed in to Vercel, and removes the deployment if it doesn't;
7. runs the demo walkthrough against the preview at iPhone and desktop sizes, through a temporary bypass that is
   revoked afterwards.

The link appears in the run's summary. Open it on your Mac or iPhone, sign in to Vercel when asked, then tap
**Explore with sample data**. To share it with someone else, invite them to the Vercel project or create a
shareable link in Vercel (Deployment Protection settings) and send it privately.

### Notes

- Vercel's free Hobby plan is for non-commercial use; for a business, Vercel's terms call for the Pro plan.
- A free Supabase project pauses after a week without use; restore it from the Supabase dashboard.
- Running the workflow again resets the sample data and gives a new preview link.
- To take the demo down: delete the `narrow-gate-fitness-demo` project in Vercel and the demo project in Supabase,
  then delete the repository secrets.
