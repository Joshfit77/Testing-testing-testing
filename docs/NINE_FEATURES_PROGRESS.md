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
| 6 | Guided AI body scanner | Pro | Implemented, physical-device testing needed | Browser capture tested with a fake camera and uploads. No body-fat estimate (no validated provider approved). Native camera behaviour on a phone not tested. |
| 7 | AI food-photo recognition | Pro | Implemented, physical-device testing needed | Tested end to end with a mock AI; real-model estimate quality and phone camera capture not yet checked. |
| 8 | Food Quality Scanner | Free / Plus / Pro | Implemented, physical-device testing needed | Tested against a local Open Food Facts mock: this environment's network policy blocks the live API and its docs, so field names and limits still need checking against the live service. Phone camera scanning untested. |
| 9 | Genuine 4K badge artwork | — | Blocked by external dependency | No genuine masters exist yet. The brief, hand-off pack, checks, export (with small copies for phones) and app wiring are ready (`docs/BADGE_ART_SPEC.md`). The 27 new 3840 × 1920 masters must be made by an artist or image service, which needs your approval. Not complete until they exist and are integrated. |

Test totals after Stage 9: Vitest 107 files, 2,207 tests passed. Playwright 59 passed, 1 skipped (the skip predates this branch).

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

## Stage 6: guided body scanner (Pro) — commit `3b1029e`

1. **Implemented.** Body Scan under My Progress (`/progress/body-scan`), separate from progress photos and the muscle map, with full details in `docs/BODY_SCAN.md`.
   - **Consent:** explicit consent comes first and is recorded with its time.
   - **Guided capture:** a preparation screen (lighting, distance and framing, pose, consistency), then front and side photos (required) and a rear photo (optional). Each comes from the live camera, with a framing outline, a 10-second timer, a camera switch, a faint overlay of the previous scan and a level indicator where the phone reports it, or from an upload. Every photo can be retaken.
   - **Measurements (optional):** weight and waist, chest, hips, arm and thigh. They also go into the existing weight and measurement history.
   - **Dashboard:** history with thumbnails, a side-by-side comparison of any two scans (front, side or rear) with the time between and the changes, and 12-month weight and measurement charts.
   - **Body fat:** no estimate. The page says plainly that a phone camera can't measure body fat or visceral fat. Nothing was purchased; the earlier vendor evaluation is referenced in the doc.
   - **Privacy:** a private `body-scans` bucket with owner-only policies and no admin access, signed links that expire in 10 minutes, and Pro plus consent enforced by the database. Members can delete one scan, or withdraw consent and delete everything (still possible after a downgrade). Scans are in the export and removed with the account. Photos are never sent to the AI coach or any other service.
2. **Files.** New: `src/lib/domain/body-scan.ts`, `src/server/services/body-scan.ts`, `src/server/actions/body-scan.ts`, `src/app/(app)/progress/body-scan/page.tsx`, `src/app/(app)/progress/body-scan/new/page.tsx`, `src/components/body-scan/{consent-card,pose-outline,scan-capture,scan-dashboard}.tsx`, `supabase/migrations/20261024000031_body_scans.sql`, `docs/BODY_SCAN.md`, `tests/unit/body-scan.test.ts`, `tests/integration/body-scans.test.ts`, `e2e/body-scan.spec.ts`. Changed: `src/app/(app)/progress/page.tsx`, `src/server/services/account.ts` (export and deletion), `src/lib/security-headers.ts`, `ios/App/App/Info.plist` (camera usage text), `supabase/setup-all.sql`, `docs/PRO_ROADMAP.md`, `tests/unit/security-headers.test.ts`, `e2e/recipes-planner.spec.ts`.
3. **Migration.** `20261024000031_body_scans.sql`:
   - `profiles.body_scan_consent_at` and `can_add_body_scan()`;
   - `body_scans` and `body_scan_photos` with row-level security, path checks and one photo per view;
   - a limit of 200 scans;
   - the private `body-scans` bucket and its policies.
4. **Tests.**
   - **Unit (5):** plan rule, path ownership, comparison, tilt, guidance wording.
   - **Database and storage (4):** consent and Pro required to add; Plus refused; owner-only rows and files, with another member and an admin both blocked; one photo per view; paths must match the scan; deletion after a downgrade or withdrawn consent; account deletion.
   - **Browser (2):** Plus locked; Pro consent, upload with retake, skipped rear photo, measurements, a second scan with Chromium's fake camera, images and the previous-scan overlay actually load, comparison changes, delete one, then withdraw and delete all.
5. **Results.**
   - Vitest: 103 files, 2,183 tests passed.
   - Playwright: 54 passed, 1 skipped and 1 failed (an older recipes test whose text locator was ambiguous). After the locator fix that spec passed.
   - `tsc` and ESLint clean; the build succeeds.
6. **Bugs fixed.**
   - **Photos didn't load locally.** The Content-Security-Policy `img-src` allowed only `https:`, so private photos never loaded against the local http Supabase. It now also lists the configured Supabase origin; https deployments were already fine. The new browser test checks that images really load.
   - **Previews revoked too early.** A cleanup effect would have revoked preview images still on screen.
   - **Ambiguous recipes locator.**
7. **Limitations.**
   - The camera inside the native iPhone and Android apps and the level indicator haven't been tested on a physical phone.
   - No automatic retention period; scans stay until deleted.
   - No body-fat estimate.
8. **External.**
   - A physical iPhone and Android phone for camera testing.
   - Any body-composition vendor would need your approval, a contract and a data-processing agreement.
9. **Commit.** `3b1029e`.
10. **Next.** Stage 7: AI food-photo recognition.

## Stage 7: AI food-photo recognition (Pro) — commit `9d0bb50`

1. **Implemented.** Food → Meal photo (`/nutrition/photo`); details in `docs/FOOD_PHOTO.md`.
   - **Entitlement and consent:** Pro (or a grandfathered AI allowance), checked on the server. The general AI consent plus a separate meal-photo consent that names the provider.
   - **Capture:** take a photo or choose one from the library, with a preview and retake/replace. Choose the meal and add an optional note.
   - **Estimate:** foods, visible ingredients, portion in words, grams when judgeable, calories, protein, carbs and fat, with a confidence level.
   - **Honesty rules:**
     - the app always asks about oil or butter and sauces or dressings, and about portions when unsure;
     - calories that disagree with the macros are flagged;
     - a "not measured" banner is shown.
   - **Correcting:**
     - every field is editable; items can be removed or added;
     - any item can be swapped for a database food (search pre-filled, with undo);
     - one-tap oil, butter and dressing extras use the app's USDA records.
   - **Saving:** nothing is saved until "Confirm and add to diary". Estimates are stored marked as estimates from a photo; database foods are recomputed on the server.
   - **Privacy:** the photo is resized on the device (location data removed), checked by its bytes, sent once to the fast model, and never stored.
   - **Limits:** each analysis counts toward the 150 monthly messages, plus a daily cap of 20 photos inside the locked reservation function.
2. **Files.** New: `src/lib/domain/food-photo.ts`, `src/server/services/food-photo.ts`, `src/server/actions/food-photo.ts`, `src/app/api/ai/food-photo/route.ts`, `src/app/(app)/nutrition/photo/page.tsx`, `src/components/nutrition/{food-photo-consent,food-photo-flow}.tsx`, `supabase/migrations/20261024000032_food_photos.sql`, `docs/FOOD_PHOTO.md`, `tests/unit/food-photo.test.ts`, `tests/integration/food-photo.test.ts`. Changed: `src/app/(app)/nutrition/page.tsx` (Food tools link), `src/components/nutrition/food-picker.tsx` (optional starting search), `src/components/coach/ai-consent-card.tsx`, `src/server/services/ai-coach.ts` (photo-limit message), `ios/App/App/Info.plist`, `supabase/setup-all.sql`, `e2e/coach.spec.ts`.
3. **Migration.** `20261024000032_food_photos.sql`:
   - `profiles.food_photo_consent_at`;
   - `meal_items` source `photo`;
   - `reserve_ai_usage` recreated with the 20-a-day photo cap; all other limits are unchanged.
4. **Tests.**
   - **Unit (5):** normalisation and clamping, mandatory questions, non-food photos, file-type sniffing, quick-add weights match the USDA measures.
   - **Database (4):** no analysis or reservation without consent; consent is owner-only; 23 simultaneous photo reservations give exactly 20 successes while chat stays allowed; photo diary entries are owner-only.
   - **Browser (1):** the whole flow, including what is sent to the AI.
   - **Regression:** the existing AI-limit tests passed against the recreated function.
5. **Results.** Vitest: 105 files, 2,192 tests passed. Playwright: 56 passed, 1 skipped. `tsc`, ESLint and the build are clean.
6. **Bugs fixed.** Test locators made exact: "Meal" also matched "meal photo", and the bundled USDA name for olive oil is "Olive oil".
7. **Limitations.**
   - The real model's estimate quality is unverified (mock AI only).
   - Camera capture hasn't been tried on a physical phone.
   - Hidden ingredients can only be added by the member.
8. **External.**
   - The existing Anthropic API key; no new service.
   - A physical phone for camera testing.
9. **Commit.** `9d0bb50`.
10. **Next.** Stage 8: Food Quality Scanner.

## Stage 8: Food Quality Scanner (Free / Plus / Pro) — commit `fd2826f`

1. **Implemented.** Food → Food quality, an original feature (Yuka was a functional reference only); details in `docs/FOOD_QUALITY.md`.
   - **Scanning:** the existing barcode scanner (camera, native or typed) opens a product page.
   - **Product page:**
     - name, brand, image and a prominent Add to Food Diary, which uses the normal barcode logging, so no duplicate foods;
     - full nutrition per serving and per 100 g/ml, with missing values shown as "Not available", and % of EU reference intakes;
     - Nutri-Score and NOVA as computed by Open Food Facts, each with its meaning and limits; UK front-of-pack levels; EU claim thresholds met. No invented score;
     - ingredients with forms of sugar; additives in neutral plain language (regulatory notes only);
     - declared allergens and traces, vegan, vegetarian and palm-oil status, labels, and an explicit "can't guarantee allergen safety" note;
     - real alternatives from the same category, offered only when clearly better, with the reasons.
   - **Plus:** personal filters (EU allergens, vegan or vegetarian, nutrition preferences) checked on every product, with missing data shown as unknown, never safe; alternatives filtered by them; side-by-side comparisons that warn when products aren't comparable.
   - **Pro:** an AI explanation for the member's goals from the known facts only.
   - **Gates:** checked on the server, using a new Plus feature `food_comparisons`. Prices and plan highlights are unchanged.
2. **Files.** New: `src/lib/food-quality.ts`, `src/lib/food-quality-ai.ts`, `src/server/services/food-quality.ts`, `src/server/actions/food-quality.ts`, `src/app/(app)/nutrition/{scanner,product/[code],compare}/page.tsx`, `src/components/nutrition/{quality-sections,quality-client}.tsx`, `supabase/migrations/20261024000033_food_quality.sql`, `docs/FOOD_QUALITY.md`, `e2e/{off-mock,global-setup,food-quality.spec}.ts`, `tests/unit/food-quality.test.ts`, `tests/integration/food-quality.test.ts`. Changed: `src/components/nutrition/{barcode-scanner,food-amount}.tsx` (code hook, details link), `src/app/(app)/nutrition/page.tsx` (Food tools link), `src/lib/domain/plans.ts`, `tests/unit/plans.test.ts`, `docs/MEMBERSHIPS.md`, `playwright.config.ts`, `e2e/food-amounts.spec.ts` (now uses the shared mock), `e2e/coach.spec.ts`, `supabase/setup-all.sql`.
3. **Migration.** `20261024000033_food_quality.sql`: `profiles.food_filters` (an owner-editable object of at most 2 KB). No product data is stored.
4. **Tests.**
   - **Unit (11):** normalisation, indicators, sugars, additive wording, filters, comparability, alternatives, AI facts.
   - **Integration (3):** the service against the mock, including the cache and the search throttle; filter storage.
   - **Browser (4):** Free flow (scan, facts, unavailable values, indicators, ingredients, allergens, alternatives, add to diary, no-data and unknown products); Plus filters, filtered alternatives and comparisons, including the drink-versus-food warning; the Pro AI explanation and exactly what was sent; the existing barcode journey on the shared mock.
5. **Results.** Vitest: 107 files, 2,206 tests passed. Playwright: 59 passed, 1 skipped. `tsc`, ESLint and the build are clean.
6. **Bugs fixed.**
   - `capitalize` turned "30 g" into "30 G".
   - Broken product images now hide themselves, including failures before hydration.
   - The nutrition table's columns were cramped.
   - A nitrite note was reworded so no additive text reads as a harm claim.
7. **Limitations.**
   - Not verified against the live Open Food Facts API or its current documentation: this environment's network policy blocks `world.openfoodfacts.org` and `openfoodfacts.github.io`.
   - Additive descriptions cover about 75 common additives; others show their code.
   - Ingredient checks look for English words.
   - The phone camera hasn't been tested.
8. **External.**
   - Network access to `world.openfoodfacts.org` (and `openfoodfacts.github.io` for the docs) in this environment's settings, for live verification. No account or payment is needed.
   - A physical phone.
9. **Commit.** `fd2826f`.
10. **Next.** Stage 9: genuine 4K badge artwork.

## Stage 9: genuine 4K badge artwork — commit `d193790` (not complete)

1. **Implemented.** No new artwork. This environment has no image-generation tool and no approved image service, so
   none of the 27 masters could be made, and the current poster crops were not enlarged to pass as 4K. The app still
   shows the poster crops (352–526 px wide). What was done:
   - **Small copies for phones:** the export now also writes a 600 × 300 `<slot>-sm.webp` from each master (shrunk,
     never enlarged), and the badge and the rank list choose it through `srcset` for small tiles. A phone then
     doesn't download 27 full-size images for the rank list. This only takes effect once masters are exported.
   - **Spec additions** (`docs/BADGE_ART_SPEC.md`): acceptance items for blurry halos, over-sharpening, stretching,
     clipping and matched lighting. Masters stay out of the app bundle. The animations are app layers over still art,
     so nothing should be baked in.
   - **Already in place from earlier work and re-checked:**
     - the per-badge brief, with the Conqueror cross about 25–30 % smaller and the wings kept large;
     - the hand-off pack (27 prompts, reference crops and the original posters; it builds correctly, about 10 MB);
     - the automatic checks, which refuse enlargements of the current crops;
     - the export, and the app wiring.
   - **Animations:** the Fitness shine, Food flames and embers, Faith leaves and sunlight, unlock celebrations and
     reduced motion are unchanged. They are drawn over the image, so new masters keep them.
2. **Files.** `scripts/badge-art/export-masters.py`, `scripts/badge-art/test_badge_pipeline.py`,
   `src/components/badges/{badge-artwork.ts,badge-art.tsx,rank-ladder.tsx}`, `tests/unit/badge-artwork.test.ts`,
   `docs/BADGE_ART_SPEC.md`.
3. **Migration.** None.
4. **Tests.**
   - Unit: `srcset` offers a small copy only when one was exported.
   - Pipeline self-test: the small copies and their size entries. Fake masters are refused or accepted as expected.
   - Existing rank-badge browser tests: all widths, 320–430 px.
5. **Results.** Vitest 107 files, 2,207 tests passed. Playwright 59 passed, 1 skipped. Pipeline self-test passed.
   `tsc`, ESLint and the build are clean.
6. **Bugs fixed.** None found.
7. **Limitations.** The feature is not complete: the 27 genuine 3840 × 1920 masters don't exist.
8. **External.**
   - Your approval of an artist or image-generation service (and its cost), with commercial rights to the images.
   - To send them the pack: `python3 scripts/badge-art/make-handoff-pack.py --out badge-art-handoff.zip`.
   - On delivery:
     1. put the files in `assets/badge-masters/`;
     2. run `python3 scripts/badge-art/export-masters.py`;
     3. review the WARN results at 100 % zoom;
     4. run the tests;
     5. check them on a real iPhone.
9. **Commit.** `d193790`.
10. **Next.** None in this plan: Stages 1–8 are built and Stage 9 waits on the artwork. The open items are below.

## Open items across all stages

- **Physical phones (iPhone and Android):**
  - GPS recording, including on a locked screen;
  - camera use for the body scan, food photos and barcode scanning;
  - how the badges look.
- **A live Anthropic API key** to check the quality of real answers for:
  - coaching memory;
  - the training review;
  - meal plans;
  - food photos;
  - product explanations.
- **Network access to Open Food Facts** (`world.openfoodfacts.org`, `openfoodfacts.github.io`) to verify the
  scanner against the live service.
- **Approval for the badge artwork** (Stage 9).
- **A qualified coach** to review the strength-rank thresholds (Stage 5).
- **Native builds** (Xcode for iOS, the Android SDK) to sync the Capacitor plugins. Nothing has been submitted to
  TestFlight or the App Store.
