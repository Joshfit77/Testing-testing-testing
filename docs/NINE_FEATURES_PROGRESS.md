# Nine major features: progress

Branch `claude/nine-features` (from `claude/app-cleanup` at `5bf988f`). Not merged into `main`, not deployed, nothing submitted to TestFlight or the App Store. Prices are unchanged (Free $0, Plus $11.99, Pro $24.99) and enforced on the server.

"Tested" here means automated tests on this machine: unit and database tests (Vitest against a local Supabase) and browser tests (Playwright, Chromium with a phone-sized viewport). AI features are tested against a local mock of the Anthropic API, so the app's own logic (limits, consent, validation, saving) is covered, but the quality of real model answers has not been checked with a live API key. Nothing has been run on a physical iPhone or Android phone.

## Tracker

| # | Feature | Plan | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Long-term AI coaching memory | Pro | Complete and tested | Mock AI model only. |
| 2 | Adaptive AI training and recovery | Pro | Complete and tested | Mock AI model only. |
| 3 | Personalized AI meal plans | Pro | Complete and tested | Mock AI model only. Allergy filtering is not certified. |
| 4 | Live GPS running and walking | Free (basic) | Implemented, physical-device testing needed | Browser recording tested with simulated GPS. Background recording on a locked phone is prepared, not synced into a native build, not verified. |
| 5 | Interactive muscle body map | Plus / Pro | Complete and tested | Rank thresholds are provisional and still need review by a qualified coach. |
| 6 | Guided AI body scanner | Pro | Not started | |
| 7 | AI food-photo recognition | Pro | Not started | |
| 8 | Food Quality Scanner | Free / Plus / Pro | Not started | |
| 9 | Genuine 4K badge artwork | — | Blocked by external dependency | The import, checking and export pipeline is ready (`docs/BADGE_ART_SPEC.md`). The 27 new 3840 × 1920 masters must be created by an image tool or an artist, which needs your approval. Not complete until they exist. |

Test totals after Stage 5: Vitest 101 files, 2,173 tests passed. Playwright 53 passed, 1 skipped (the skip predates this branch).

## Stage 1: long-term AI coaching memory (Pro) — commit `affbbca`

1. **Implemented.** A coaching memory the member controls at `/coach/memory`: turn it on (off by default, with its own consent), view, add, edit, delete one or all, and turn it off. In a chat the coach can only *suggest* something to remember; nothing is saved until the member taps "Save to memory" (they can edit it first or tap "Don't save"). The coach can also suggest forgetting something. Each chat has "Coach may suggest things to remember from this chat"; with it off, the server refuses memory suggestions. Approved coach changes are noted as "a change you confirmed". Up to 100 memories of 300 characters. Memories that duplicate structured data (goal, schedule, units) or repeat the prayer journal, and sensitive health details, are refused. Recovery memories are used only with wellness consent. Memories are deleted with the account. The AI limits are unchanged (150 Pro messages a month, Haiku first, reservations, grandfathered plans, AI consent).
2. **Files.** `supabase/migrations/20261024000026_coach_memory.sql`, `src/lib/coach/memory.ts`, `src/server/actions/coach-memory.ts`, `src/app/(app)/coach/memory/page.tsx`, `src/components/coach/memory-manager.tsx`, plus changes in `src/lib/coach/{context,knowledge,prompt,tools}.ts`, `src/server/coach/{snapshot,tools}.ts`, `src/server/actions/coach.ts`, `src/server/services/{ai-coach,account}.ts`, `src/lib/validation/schemas.ts`, `src/components/coach/{coach-chat,suggestion-card,ai-consent-card}.tsx`, `src/app/(app)/coach/page.tsx`, `supabase/setup-all.sql`, and tests `tests/unit/coach-memory.test.ts`, `tests/integration/coach-memory.test.ts`, `e2e/coach.spec.ts`.
3. **Migration.** `20261024000026_coach_memory.sql`: `has_ai_coach()`, profile memory switches, `ai_conversations.memory_off`, `coach_memories` (row-level security, limit of 100).
4. **Tests.** Unit (duplicates, journal overlap, sensitive details, context formatting), database (row-level security, Plus refused, grandfathered Plus allowed, limit, deletion with the account), browser (turn on, approve, edit, use in a later chat, forget, per-chat off).
5. **Results.** All passed (Vitest 91 files / 2,108 tests; Playwright 44 passed / 1 skipped at the time).
6. **Bugs fixed.** A hydration race cleared the message box before sending; duplicate status roles.
7. **Limitations.** Real model behaviour (what it chooses to suggest) is untested without a live key.
8. **External.** An Anthropic API key for live use (already part of the AI coach).
9. **Commit.** `affbbca`.
10. **Next.** Stage 2.

## Stage 2: adaptive AI training and recovery (Pro) — commit `ebecf1b`

1. **Implemented.** A training review at `/train/review`, computed from the member's own logs: consistency, weekly sets per body region against ranges, progression and plateaus per lift, missed sessions, readiness check-ins, weeks since a lighter week, and data gaps. It gives recommendations with the reason and the numbers behind each (add load, plateau options, a recovery week, volume, training days, goal change, low readiness), with no medical conclusions. Each can be accepted, modified or rejected. Accepted changes are recorded with before and after values and can be undone; nothing changes silently. Coach load targets show in the workout logger. The coach can read the review and *suggest* target loads (kept within 0.5–1.15× of the recent top set), recovery weeks and volume changes, which apply only when confirmed.
2. **Files.** `supabase/migrations/20261024000027_adaptive_training.sql`, `src/lib/domain/{adaptive-training,body-regions}.ts`, `src/server/services/adaptive-training.ts`, `src/server/actions/adaptive-training.ts`, `src/app/(app)/train/review/page.tsx`, `src/components/train/training-review.tsx`, plus changes to the Train page, workout page and logger, exercise card, schedule preview, preferences page, coach tools and suggestion card, and tests `tests/unit/adaptive-training.test.ts`, `tests/integration/adaptive-training.test.ts`, `e2e/training-review.spec.ts`, `e2e/coach.spec.ts`.
3. **Migration.** `20261024000027_adaptive_training.sql`: `exercise_targets`, `training_adjustments`, `training_recommendation_decisions`.
4. **Tests.** Unit (10), database (6), browser (accept, modify, reject, undo; coach suggestion).
5. **Results.** All passed (Vitest 93 / 2,124; Playwright 47 / 1 skipped).
6. **Bugs fixed.** A suggestion could be applied twice; it is now claimed first and released on failure.
7. **Limitations.** Library programs can't be edited, so changes apply to the member's own programs; real model output untested.
8. **External.** None beyond the API key.
9. **Commit.** `ebecf1b`.
10. **Next.** Stage 3.

## Stage 3: personalized AI meal plans (Pro) — commit `a2035da`

1. **Implemented.** In the meal planner: an AI draft for 1, 3 or 7 days with a focus (high protein, weight loss, muscle gain, maintenance) and notes. The AI may only choose dishes and servings from the app's own verified recipe catalog; the server recalculates every value, fills gaps with the regular planner, and labels anything uncertain. The draft is reviewed and then approved into the plan or discarded. Planned meals can be swapped, have an ingredient replaced (saved as the member's own recipe copy), have servings adjusted, and be added to the diary and grocery list. Allergy filtering is labelled as not certified.
2. **Files.** `supabase/migrations/20261024000028_ai_meal_plans.sql`, `src/lib/domain/ai-meal-plan.ts`, `src/server/services/ai-meal-plan.ts`, `src/server/actions/ai-meal-plan.ts`, `src/components/nutrition/ai-meal-plan.tsx`, plus changes to the planner page and client, meal-plan service and actions, AI coach service, and tests `tests/unit/ai-meal-plan.test.ts`, `tests/integration/ai-meal-plan.test.ts`, `e2e/coach.spec.ts`, `e2e/recipes-planner.spec.ts`.
3. **Migration.** `20261024000028_ai_meal_plans.sql`: new AI usage kinds, `meal_plan_drafts`.
4. **Tests.** Unit (5), database (3), browser (draft, approve, Plus sees the Pro teaser).
5. **Results.** All passed (Vitest 95 / 2,132; Playwright 48 / 1 skipped).
6. **Bugs fixed.** Type mismatches between planner and AI candidates; an apply path that kept its claim on early return.
7. **Limitations.** Only dishes in the catalog; allergy filtering not certified; real model output untested.
8. **External.** None beyond the API key.
9. **Commit.** `a2035da`.
10. **Next.** Stage 4.

## Stage 4: live GPS running and walking — commit `0f3fc9e`

1. **Implemented.** Outdoor run and walk recording at `/run/record`: start (location is asked for only then), waiting for a good fix, live distance, elapsed and moving time, current and average pace, splits per mile or km, pause, resume, finish, discard, a review with the route, effort and notes, and one save even after a double tap. GPS filtering drops inaccurate, out-of-order and impossible-speed points and ignores standing-still wobble; a signal gap or a pause starts a new route line, and no distance is invented across a gap. A recording survives a crash or closed tab on that device. Program running days open as guided runs with warm-up, run, walk and cool-down cues, and saving counts the completed intervals. New plans: Walk to Run (6 weeks, Free), 5K (8 weeks, Plus), 10K (10 weeks, Plus). Running goals (weekly or monthly distance, target times for 1 mile to half marathon), weekly distance and pace charts, and an activity page with the route, splits and a GPS-quality note. Routes are private and deleted with the account. Native background tracking is prepared (see Limitations).
2. **Files.** New: `src/lib/domain/{gps-track,run-session}.ts`, `src/lib/native/location.ts`, `src/server/actions/gps-activities.ts`, `src/app/(app)/run/record/page.tsx`, `src/components/run/{gps-recorder,route-map,running-goals}.tsx`, `src/lib/coach/chat-key.ts`, `supabase/migrations/20261024000029_gps_running.sql`, `e2e/gps-run.spec.ts`, `tests/unit/{gps-track,run-session,coach-chat-key}.test.ts`, `tests/integration/gps-running.test.ts`. Changed: `src/app/(app)/run/page.tsx`, `src/app/(app)/run/activities/[id]/page.tsx`, `src/data/programs.ts`, `supabase/seed.sql`, `src/server/services/{activities,account,training,adaptive-training}.ts`, `src/server/actions/coach.ts`, `src/components/coach/coach-chat.tsx`, `src/app/(app)/coach/page.tsx`, `src/lib/security-headers.ts`, `ios/App/App/Info.plist`, `android/app/src/main/AndroidManifest.xml`, `capacitor.config.ts`, `package.json`, `package-lock.json`, `supabase/setup-all.sql`, `docs/RUN_TRACKING_PLAN.md`, `docs/PROJECT_CHECKLIST.md`, `e2e/run.spec.ts`, `e2e/coach.spec.ts`, `tests/unit/security-headers.test.ts`, `tests/integration/adaptive-training.test.ts`.
3. **Migration.** `20261024000029_gps_running.sql`: `activities.gps_quality` and `workout_session_id`, size limits for routes (150 kB) and splits (600), `running_goals` (owner-only, up to 10). The seed adds the three new programs (51 in total).
4. **Tests.** Unit: 11 GPS-track tests on simulated traces (noise, jumps, tunnel gap, pause, splits), 7 guided-session and goal tests, the 49 program-library checks. Database: 4 (saved once, private, size limits, goals and their limit, deletion). Browser: a walk recorded with Chromium's location override (pause skips a 200 m move, review, double tap saves once, route and history, goals), a guided program run, and denied permission.
5. **Results.** All passed: Vitest 99 files / 2,158 tests; Playwright 51 passed / 1 skipped. `tsc` and ESLint clean; `npm audit --omit=dev` found no vulnerabilities after adding the plugin.
6. **Bugs fixed.**
   - The site's `Permissions-Policy` header was `geolocation=()`, so every browser refused location before asking. It is now `geolocation=(self)`, with a unit test.
   - The coach chat remounted when a new chat moved to its own URL, which could drop the result of a just-confirmed change. It now stays mounted.
   - Program queries that filtered through embedded day/week joins checked the row policy on every program exercise (about 7 s with many custom programs). They now look up weeks and days by index first; the review loads in milliseconds.
   - A double tap on Save could start two saves; a ref guard stops the second (the server was already idempotent).
7. **Limitations.** Background recording with the screen locked has **not** been tested: `npx cap sync` and native builds were not run (no Xcode or Android SDK here), so the installed apps don't include the plugin yet. In a browser the screen must stay on. There are no map tiles (that needs an approved map provider; the route is drawn as a plain outline). No auto-pause, no "return to run" bar on other pages, and records still use whole activities, not best efforts inside longer runs.
8. **External.** A Mac with Xcode and an Android SDK for native builds; a real iPhone and Android phone for the device checks in `docs/RUN_TRACKING_PLAN.md`; optionally a map-tile provider (paid or with usage terms: needs your approval).
9. **Commit.** `0f3fc9e`.
10. **Next.** Stage 5: interactive muscle body map.

## Stage 5: interactive muscle body map (Plus / Pro) — commit `d24e32b`

1. **Implemented.** "Strength & Body Map" under My Progress (`/progress/body-map`), checked on the server for Plus and Pro (`advanced_analytics`); Free members see what it offers and a link to plans. Original front and back figures with the 12 regions (chest, upper back, lower back, shoulders, biceps, triceps, forearms, abdominals, glutes, quadriceps, hamstrings, calves), tappable and keyboard-accessible, coloured by strength rank or by this week's sets, with a legend, hatching for "Not assessed" and a text list of every region. A region shows its rank and progress to the next one, how it's scored, exercises, workouts, weighted sets, volume, weekly frequency, personal records, a 12-week sets chart, a monthly estimated-1RM trend and a comparison with the previous 28 days. Ranks run Bronze → Silver → Gold → Platinum → Diamond → Disciple, with emblems that gain detail up to an ornate narrow-gate Disciple emblem. Scoring: each benchmark lift has its own table (barbell lifts by estimated 1RM ÷ body weight; pull-ups, chin-ups and dips by body weight plus added load; push-ups, rollouts, knee raises, Nordic curls and hangs by reps or seconds). A region takes its single best benchmark, so repeated logs can't raise it; leg press, hack squat, machine, dumbbell and assisted variants are never ranked; calves stay "Not assessed" because calf-raise loads aren't comparable. The member picks the men's or women's table on the page (the onboarding sex answer stays limited to calorie estimates). The overall rank is the middle rank of at least 4 assessed regions, with the unassessed ones listed. Only the last 12 months of completed working sets count; likely typos are ignored and reported. Ranks are computed from logs each time and never stored, never come from photos, and are separate from the 27 badges. All rules are labelled "Provisional rules v1".
2. **Files.** New: `src/lib/domain/strength-ranks.ts`, `src/lib/domain/body-map.ts`, `src/server/services/body-map.ts`, `src/server/actions/body-map.ts`, `src/app/(app)/progress/body-map/page.tsx`, `src/components/progress/{muscle-map,body-figure,strength-rank-emblem}.tsx`, `supabase/migrations/20261024000030_strength_ranks.sql`, `tests/unit/strength-ranks.test.ts`, `tests/integration/body-map.test.ts`, `e2e/body-map.spec.ts`. Changed: `src/app/(app)/progress/page.tsx`, `supabase/setup-all.sql`, `docs/PROJECT_CHECKLIST.md`, `docs/PRO_ROADMAP.md`.
3. **Migration.** `20261024000030_strength_ranks.sql`: `profiles.strength_standards` ('men' or 'women', member-editable). Nothing else is stored.
4. **Tests.** Unit (12): every benchmark exists and trains its region, thresholds rise, rank placement and progress, body-weight lifts, machines never counted, repeated logs don't inflate, Not assessed reasons, typo filter, best-benchmark and overall rules, set counting, monthly trend, record de-duplication, volume bands. Database (3): unfinished workouts and warm-ups excluded, the table setting's constraint and owner-only update, ranks from real rows, no access to another member's data. Browser (2): Free sees the locked page; Plus chooses a table, sees the overall rank, taps regions on both views (including by keyboard), reads the scoring and stats, switches colouring, and opens a shared link to a region.
5. **Results.** All passed: Vitest 101 files / 2,173 tests; Playwright 53 passed / 1 skipped; `tsc` and ESLint clean. Screens were also checked visually at phone size.
6. **Bugs fixed.** "Men's table" matched inside "Women's table" in tests (exact matching); a gap between the two chest and glute shapes made a tap on the centre line miss; a duplicated confirmation line; "1 sets"; a 28-day set total shown against a weekly range (now a weekly average).
7. **Limitations.** Thresholds were set by hand and need review by a qualified coach (checklist 10.28). Dumbbell lifts can't be ranked until the app records whether a dumbbell load is per hand or in total. The overall rank isn't yet repeated on the Overview page. The figure is a stylised outline, not a detailed anatomical drawing.
8. **External.** None. (A coach review of the thresholds is a people task, not an account.)
9. **Commit.** `d24e32b`.
10. **Next.** Stage 6: guided AI body scanner.
