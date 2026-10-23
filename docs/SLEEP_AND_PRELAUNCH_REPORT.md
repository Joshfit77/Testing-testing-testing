# Report: Sleep & Recovery system, verification of earlier work, and pre-launch review

Branch `claude/sharp-cray-8y0uuv`. Everything below was built, tested and committed in stage-sized commits; nothing
was merged, deployed or submitted to a store. Labels follow `docs/COMPLETION_TRACKER.md`, which is the row-by-row
record (files, migrations, tests, commits) for every stage.

## 1. What was built: Sleep, circadian rhythm and recovery

Entry: My Progress → Sleep & Recovery, plus a Home shortcut. The five tabs (Home · Train · Run · Food · Faith) and
the AI Coach header are unchanged; the black/charcoal/champagne/gold design is used throughout. Design in
`docs/SLEEP_PLAN.md`; every figure's method, in member language, in `docs/SLEEP_METHOD.md` and on the in-app
"How it's worked out" page (they are kept in step).

| # | Feature asked for | Status | What it is |
| --- | --- | --- | --- |
| 1 | Manual tracking | Complete and tested | Sleep timer (going to bed / stop) and manual entry with bed, wake, optional fall-asleep time, final wake-up, wake-ups, minutes awake, notes; edit, delete, overlap refusal; naps. |
| 2 | Automated detection | Implemented, physical-device testing needed | Apple Health / Health Connect sleep records, with stages where a watch recorded them, imported on the phone and de-duplicated on the server. Motion/microphone detection is not built, because it could only invent sleep without a validated native service. |
| 3 | Nightly report and score | Complete and tested | Night report with "Not recorded" rows, never invented stages; score v1 (duration 50 / efficiency 20 / timing 20 / wake-ups 10) that excludes missing parts and says what it was based on. |
| 4 | Stages and timeline | Complete and tested (display) | Stage timeline and totals shown only for imported records that carry stages; the app never infers stages. |
| 5 | Smart alarm | Implemented, physical-device testing needed | Fixed-time weekly alarm with Snooze and I'm up on the phone, next alarms in the member's zone, Android exact-alarm handling, synced from the account at launch. The smart window is stored but inactive: no alarm sounds before the set time until background detection exists. |
| 6 | Nighttime sound analysis | Not started | Design only (on-device levels → events, no audio stored, separate consent). Needs a native background-audio plugin and a classifier with measured accuracy; building a guess was refused. |
| 7 | Personal sleep needs | Complete and tested | A goal the member chooses (4–12 h, 8 to start), presented as a target, never as a measured need. |
| 8 | Estimated sleep debt | Complete and tested (Plus) | Debt v1 over a rolling 14 nights; shortfalls add in full, surplus repays half, unlogged nights change nothing; bands and trend; the maths is shown. |
| 9 | Circadian schedule and windows | Complete and tested (Plus) | Bed and wake windows hung off a chosen or typical wake time, consistency, weekend drift, a 15-minute-a-night plan. |
| 10 | Daily energy rhythm | Complete and tested (Plus) | Hourly alertness estimate from wake time, last night and debt, with its assumptions printed, next to reported energy. |
| 11 | Morning and daily check-ins | Complete and tested | One-tap restedness, full check-in (ratings, caffeine, alcohol, screens, late meal, disturbances, travel, notes); associations worded as "on N nights after X…, not proof of a cause". |
| 12 | Habit coaching | Complete and tested | Ten plain rules with the entries they came from, at most three at a time, dismissible, never about medication. |
| 13 | AI sleep coach | Partially complete (Pro) | The existing coach gets a read-only `get_sleep_summary` tool under the same AI consent and quota; sleep reaches the AI only when asked about. Live-model answers not verified (stand-in server only). |
| 14 | Fitness and recovery integration | Complete and tested (Pro) | Adaptive training sees last night and debt and may suggest an easier day through the existing accept/decline cards; a Sleep & training page shows nights and workouts side by side with the limits of the comparison stated. |
| 15 | HealthKit / Health Connect / wearables | Implemented, physical-device testing needed | As #2; watches and rings that write to the health platform are covered that way; import can be switched off and imported entries deleted separately. |
| 16 | Historical analytics | Complete and tested | 7-day nights, weekly averages over 30/90 days, monthly over a year, averages and bests; weekday vs weekend comparison (Plus). |
| 17 | Dashboard and navigation | Complete and tested | The Sleep & Recovery hub with timer, last night, score, week bars, rhythm, check-in, tips and links to every page; Home shortcut; My Progress card. |

Security and privacy for sleep (Part 7): four tables with owner-only RLS, consent enforced in the database,
exclusion constraint against overlapping nights, per-member caps, duplicate-import prevention by source id,
data-source labels on every entry, export and account-deletion coverage, versioned calculations, time-zone and DST
handling with epoch arithmetic and circular medians, no health data in logs, no sleep to the AI provider without AI
consent and then only through the tool. Retention: entries stay until the member deletes them (one entry, all
imported, or everything) or the account goes; withdrawing wellness consent stops new entries and says so.

Membership (Part 9): prices untouched (Free $0 / Plus $11.99 / Pro $24.99). Sleep features sit under two new keys,
`sleep_analytics` (Plus: score detail, debt, windows, energy, comparisons) and `sleep_ai_coaching` (Pro: AI sleep
coaching, sleep × training), so the split can change in one place. **This split is a proposal that needs the
owner's approval**; Free gets logging, the timer, the score, history and the goal.

Performance and battery (Part 8): every query is bounded and indexed; nothing runs in the background on the phone
(timer = stored start time, alarm = OS notification, import = on tap); battery is not measured because there is no
device (`docs/SLEEP_PLAN.md` §8).

Tests specific to sleep (Part 13): cross-midnight nights, DST and zone changes, duplicate imports, overlaps,
manual edits, score, missing data, stage attribution, alarm calculations and clock changes, interrupted timers,
consent withdrawal, debt recalculation, analytics, AI authorization, deletion and training integration, across
`tests/unit/sleep*.test.ts`, `tests/integration/sleep*.test.ts` and `e2e/sleep.spec.ts`. Simulated data is used
and labelled; nothing here proves HealthKit, Health Connect or alarm delivery on a phone.

## 2. Verification of the earlier work (Phase A)

- **A2 exercise figures**: 157 exercises rendered at six phases, 13 corrected with before/after sheets and form
  regression tests. An independent check against the Part 2 list found the six figures flagged for a coach now
  carry that note in the app, the caption no longer says "correct technique", and no professional verification is
  claimed. Still open: a qualified coach's review (the corrections were checked against the app's own instructions,
  not an external reference), and a per-frame smoothness test (only loop closure is asserted).
- **A3 Food IQ**: method, flag, ingredient evidence, nutrient classes and Fits Your Goals verified present; added
  visible evidence-strength text, per-serving amounts on every class, a Pro browser test, and an env-gated live
  Open Food Facts test for when internet access exists. The 0–100 rating stays behind `FOOD_IQ_SCORE` (off) until a
  dietitian review.
- **A4 GPS**: permission policy, outlier/drift/gap/out-of-order handling, duplicate-save guard, interrupted
  recording, diagnostics and simulated-route tests verified; the native source label no longer claims locked-screen
  recording works; docs now cover desktop-browser location limits and the map-provider options that need approval.
- **A5 nine features**: see `docs/COMPLETION_TRACKER.md` A5 for the per-feature labels and the seven fixes.
- **A6 security**: two independent static reviews; all isolation/authorization/consent/webhook/storage claims held;
  fixes and open items in `docs/SECURITY.md`.

## 3. Test results (Stage E1, commits `b26d9fb`–`1aa71b3`)

| Suite | Result |
| --- | --- |
| TypeScript | clean |
| ESLint | clean |
| Unit (Vitest) | 95 files, 2,528 tests passed |
| Integration (Vitest, local Supabase) | 32 files, 176 tests: 175 passed, 1 skipped by design (live Open Food Facts, needs `OFF_LIVE=1`) |
| Browser (Playwright, production build of `1aa71b3`, mobile profile) | 65 tests: 64 passed, 1 skipped by design (the no-AI-provider case, since the app under test runs with the stand-in AI server) |

Mocked: the AI provider (a stand-in server), Open Food Facts (local mock), HealthKit / Health Connect, local
notifications, RevenueCat (mock), Stripe (not exercised). None of those are claimed as live-verified.

## 4. The demo (Part 11)

1. A preview exists: a private claude.ai artifact (the link is in the conversation; not public, not deployed).
2. Created in this session from the real app running locally at iPhone size (390×844), screenshots stitched into a
   clickable viewer with the real controls' positions.
3. Previous version: commit `e810c7e` (602 screens). The click-everything capture (2,694 screens, 7,245 recorded
   taps, 602 pop-ups/overlays) was recorded from the same build; the Sleep & Recovery screens and the pages whose
   copy changed since are captured from the final build of this branch and merged in.
4. Only accessible to whoever holds the private artifact link; nothing is deployed.
5. Food IQ: included. 6. GPS: included (the recorded route is a scripted one; the browser has no GPS).
7. Exercise animations: current (live figures). 8. Newer AI features: included, against the stand-in AI server.
9. Migrations: all applied to the local database the demo ran on, including the sleep ones.
10. External services: mocked (AI stand-in, Open Food Facts mock, no Stripe/RevenueCat/HealthKit).

Typing can't work in a recorded demo; destructive account/storage actions show a note instead of running.

## 5. What needs you (not code)

1. Approve the Plus/Pro split for sleep features (§1).
2. A physical iPhone and Android phone for `docs/SLEEP_DEVICE_CHECKLIST.md` and the GPS outdoor plan.
3. A dietitian's review before `FOOD_IQ_SCORE=on`; a coach's review of the six flagged figures.
4. 3840×1920 badge masters with commercial rights (pipeline ready, art absent).
5. A live AI model run (credentials) to check answer quality and structured output.
6. A map-tile provider decision (free OSM tiles forbid heavy app use; MapTiler/Mapbox have free tiers).
7. The open security items in `docs/SECURITY.md` (CSP nonce, DB-backed rate limiting, storage caps, refund policy,
   token ceiling) and the dashboard settings listed there.

## 6. Handoff

- Branch: `claude/sharp-cray-8y0uuv`, commits from `226a438` to the head of the branch, each a reviewable stage.
- Run locally: `npx supabase start && npx supabase migration up`, then `npm run build && npm run start`; tests with
  `npx vitest run --project unit`, `--project integration`, and `npx playwright test` against the running build.
- New environment variable: `REVENUECAT_ALLOW_SANDBOX` (leave unset in production).
- Do not merge to main, deploy, or submit to TestFlight/App Store from this branch without the approvals above.
