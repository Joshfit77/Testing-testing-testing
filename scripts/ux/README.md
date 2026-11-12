# UX measurement tooling

Measures the real app (demo mode, local database only) at iPhone 15 Pro size for the first-time-user audit
(`docs/ux/FIRST_TIME_UX_AUDIT.md`). Nothing here runs in production or touches a hosted database.

Prerequisites: local Supabase running, the demo server on :3000 (`npm run demo`), Playwright's Chromium
(`CHROMIUM=/path/to/chrome` if it is not the default).

| Script | What it does |
| --- | --- |
| `seed-occasional.ts` | Creates the "occasional member" (sample history trimmed to a sparse last week) on the LOCAL database and writes its sign-in to `scripts/ux/occasional.env` (git-ignored). `npx tsx --tsconfig tsconfig.json --conditions=react-server scripts/ux/seed-occasional.ts scripts/ux/occasional.env` with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set to the local stack. Refuses any non-local URL. |
| `capture.mjs` | `node scripts/ux/capture.mjs <outDir> <established\|occasional\|new>`: screenshots every route in `routes.json` and measures page height, words, controls, small text, small targets, overflow, controls above the fold and load time (`metrics.json`). Hides the demo-only bar. |
| `onboarding.mjs` | `node scripts/ux/onboarding.mjs <outDir>`: the onboarding screens in order and the interactions from the login screen to the first workout. |
| `journeys.mjs` | `node scripts/ux/journeys.mjs <out.json> <account>`: the 15 tasks in `journey-steps.json` (j14 Sleep from Quick add and j15 Undo a food were added after the baseline) from Home to completion, counting taps, typed fields, scrolls, screens and errors. Each task runs in a fresh tab with on-device storage cleared. |
| `journey_table.py` | `python3 scripts/ux/journey_table.py <before-prefix> [<after-prefix>]`: Markdown table of journey results. |

The time column is a model-based **estimate** (keystroke-level style: about 1.3 s per tap or field plus typing and
reading time), not a measurement of a person. Usability targets that depend on human time or understanding need
testing with real new members.
