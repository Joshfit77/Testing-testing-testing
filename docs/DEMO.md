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
| AI | The app's AI calls go to `/api/demo-ai`, a scripted stand-in. Every reply says "Simulated demo reply — written by a script, not an AI model". No AI provider is called and nothing is paid for. The route answers 404 outside demo mode |

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

## Private hosted preview (needs your approval and accounts)

This repository's cloud environment can't open a public tunnel or reach hosting APIs, so there is no hosted link yet.
To host the demo privately:

1. Create a **new, separate** Supabase project just for the demo (never the production project). Apply the migrations
   (`supabase db push`) and `supabase/seed.sql`.
2. Seed it from your computer:
   `DEMO_SEED_ALLOW_REMOTE=true NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/demo/seed-demo.ts`
3. Deploy a **preview** (not production) on a host with access protection, for example a Vercel preview deployment
   with Deployment Protection (Vercel Authentication or a password) switched on. Set these environment variables on
   that preview only: `DEMO_MODE=true`, the demo project's `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_ACCOUNT_EMAIL` and `DEMO_ACCOUNT_PASSWORD` from `.demo-credentials.local`,
   `ANTHROPIC_API_KEY` set to any random value, `ANTHROPIC_BASE_URL=https://<preview address>/api/demo-ai`, and
   `NEXT_PUBLIC_SITE_URL=https://<preview address>`. Don't set any Stripe or RevenueCat keys.
4. Share the protected preview link only with the people you choose.
