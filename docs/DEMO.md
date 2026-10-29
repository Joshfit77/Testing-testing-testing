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
| Opening, onboarding, Home, programs, all 157 demonstrations, workout logging, history, calendar | **Live** (real app, sample data) |
| Food diary, meal planner, recipes, grocery list, water, steps | **Live** (food search uses the built-in food database) |
| Progress, records, badges, body measurements, Body Scan screens | **Live**. Saving a new Body Scan needs photos; don't upload real body photos to a demo server |
| Sleep & Recovery dashboards, check-ins, scoring | **Live** on sample nights. Nights labelled "Apple Watch (sample data)" are pretend imports |
| Faith & Discipline (journal, 40-day challenge, practices) | **Live**, Free |
| Free / Pro comparison, $19.99 / $149.99 prices | **Live**; purchases turned off |
| AI Coach, AI meal plans, food-photo estimates, product explanations | **Simulated** (labelled). The coach's real tools still run on the sample data, and suggestions still wait for approval |
| Runs with routes | **Sample routes** (labelled), not real recordings |
| Live GPS recording | **Needs the phone app** outdoors |
| Apple Health / Health Connect imports | **Needs the phone app** on a phone |
| Barcode camera scanning, notifications, alarms, in-app purchases | **Needs the phone app** |

## The clickable iPhone demo (captured screens + the live 3D figure)

Built 2026-10-29 from this branch by `scripts/demo/iphone-demo/` (see its README): a private page that opens on an
iPhone in Safari and fills the screen. Published as **Narrow Gate iPhone Demo**,
https://claude.ai/artifact/L1eCXFJ1a3UjtQuta3nzRU (private: only the owner and whoever the owner shares it with).

| | |
| --- | --- |
| What it is | **Pictures of the real app**, captured in demo mode (sample data, purchases off, AI simulated) at iPhone size (390 CSS px at 3×, 1170 px wide, one WebP q88 pass), joined by the real tap targets: 396 screens, 3,417 taps. Every one of the 157 exercise pages, the programs, Home, Train, Run, Food, Faith, My Progress, Sleep & Recovery, AI Coach, Profile and the membership screen. |
| What is live | The **3D anatomical figure**: the showcase player (`scripts/anatomy/preview/showcase.ts`, red-and-white Écorché with a Gold switch) runs on the phone for the five 3D exercises, opened from Train → 3D exercise showcase or from those exercises' pages: turn, pinch-zoom, play/pause, slow motion, Front/Side/Rear, Muscle Glow, status badge. |
| Captured step by step | The workout flow (start, demonstration dialog, log set 1 with the rest timer, set 2, exercise options, substitute picker, substituted, finish, summary) and the AI coach (question typed, simulated reply). |
| Not live | Typing, timers, GPS, the camera, Apple Health, purchases, and any screen not among the captured ones (a tap says so). |
| Checks | `verify.mjs` at iPhone 15 size: 29 of 29 tap-through checks (opening → welcome → sample data → tabs → back → the whole workout flow → menu → coach → the live figure loads, switches exercise and returns; every picture present; every tap target inside its screen; no page errors). |
| Found while capturing | Six pages overflow the phone's width at 390 px (the running programs' week tables: `/train/programs/10k-training` 507 px, `half-marathon-base-80-20` 611 px, `5k-training`, `aerobic-base-run-walk`, `powerbuilding-4-day` 404 px; `/progress/overview` 400 px). Not fixed in this round; the demo crops them. |

It is not the live app on the phone: that is the private preview deployment above, which waits on the owner's
one-time setup (the six repository secrets) and a `demo-preview-*` tag, and the TestFlight build after it.

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
