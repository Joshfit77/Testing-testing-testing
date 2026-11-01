# Audit 3: workouts and programs, nutrition and barcode, progress, faith

Branch `worktree-agent-ae5d1c487e3b1bd3f`, based on `claude/exercise-demo-25d` at `fc8d113` (the current app branch; the
worktree started at `aad49a1`, which is 247 commits older, so it was moved to the current app code before auditing).
Date: 2026-10-31 / 11-01. No physical iPhone was used. Nothing here was tested on a device.

## How it was checked

- Code traced end to end for each feature: page, client component, server action, service, SQL migration, RLS.
- Unit tests: `npx vitest run --project unit` gave **118 files, 2,725 tests passed**. The baseline before my changes was
  115 files and 2,698 tests. `npx tsc --noEmit` is clean, and eslint is clean on every changed file.
- Integration tests against the local Supabase stack passed: **11 files, 70 tests**. They were workouts, food-amounts,
  barcode-media, progress-photos, faith-calendar, challenges, recipes-planner, food-favorites, training-stage2,
  custom-programs and rls.
- Browser checks at Pixel 7 size (412 px wide, Chromium):
  - They ran against this worktree's dev server (`next dev -p 3160`) with a local Open Food Facts stand-in.
  - Each check used a fresh confirmed account created through the Supabase admin API.
  - The repo's own e2e specs could not be used here. Their sign-up confirmation links redirect to
    `http://localhost:3000`, where no server was running, and the local Supabase stack was restarted by something else
    during my first run.
  - The audit-only specs are kept outside the repo at
    `/tmp/claude-0/-home-user-Testing-testing-testing/b5f7be41-8a07-5fa2-949c-491c9ac58107/scratchpad/aud/e2e-audit/`.
    That folder holds `explore.spec.ts`, `debug-discard.spec.ts`, `debug-expired.spec.ts` and `standalone-verses.ts`.
- Catalog checks:
  - Static: every exercise slug, alternative and program reference in `src/data/*`.
  - Database: row counts and a weeks × days consistency check on every program.

## Findings

| Feature | Status | Verified problem | Fix performed | Remaining blocker |
|---|---|---|---|---|
| Workout logging (sets, reps, weight, time, distance, RPE, supersets) | PASS | None. Browser: logged sets, finished, "Workout complete" with new personal records, workout shown in history. Integration `workouts.test.ts` | — | — |
| In-progress workout survives reload, offline and another device | PASS | None. Browser: reload restored the sets; edits made offline were kept; after clearing localStorage ("another device") the server snapshot restored both sets; finishing removed the Resume pill | — | — |
| Discarding a workout while offline | FIXED | W1 (P2): the discarded workout came back on the next visit, and Home kept offering "Resume workout" | `04100aa` | — |
| In-progress backup when the workout is renamed to spaces | FIXED | W2 (P3): every backup was rejected by the server schema | `04100aa` | — |
| Finishing with an expired session | FIXED | W3 (P3): the message said "You appear to be offline… try again"; an online member could never succeed | `a47a3d1` | — |
| Failed save / retry | PASS | Finish is idempotent per client id (integration test). A failed finish keeps the draft on the device (browser: offline and signed-out cases) | — | — |
| Rest timer, pause and resume, elapsed time | PASS | None. 8 new unit tests (`workout-timers.test.ts`); timers are stored as timestamps, so they survive reloads | Tests `5e11650` | Sound, vibration and the local notification on iPhone are untested (device) |
| Personal records | PASS | None. Unit tests plus integration tests (records rebuilt after an edit or delete); browser shows "New personal records" | — | — |
| Progressive overload (training review, AI targets; Pro) | PARTIAL | None found; I reviewed only the load-step rounding and rely on the existing `adaptive-training.test.ts` | — | Coach review of the rules |
| Program scheduling and calendar | PASS | None. Unit `training-schedule`/`calendar`; database: every week of all 51 library and 46 generated programs has `days_per_week` days, so `advanceProgram` never points at a missing day | — | — |
| Exercise substitution and catalog references | PASS | None. 157 exercises, 0 duplicate slugs, 0 missing alternatives, 0 program references to missing exercises (all weeks expanded), strength-rank benchmark slugs all exist; database has 157 published exercises, 445 alternatives and no orphaned program exercises | — | — |
| Training history | PARTIAL | W4 (P3): the "30 days" totals use a UTC midnight boundary, not the member's time zone | Not fixed (cosmetic) | — |
| Date boundaries and time zones (dashboard, streaks, progress, challenge, badges) | PASS | Dates come from `isoDateInTz(…, profile.timezone)` throughout; the only exception is W4 | — | — |
| Food search (offline USDA SR Legacy; optional FoodData Central) | PASS | Search, units and logging covered by integration `food-amounts` plus unit tests | — | Live FoodData Central not testable (no key or network) |
| Barcode scanning (web camera + native plugin + typed code) | PARTIAL | None in code. Typed code → Open Food Facts stand-in → amount step → logged (browser). GTIN, UPC-E and EAN-8 unit tests. Native plugin registered in `ios/App/CapApp-SPM/Package.swift` and `android/capacitor.settings.gradle`. Error codes `OS-PLUG-BARC-0006`/`0007` match the plugin source. `NSCameraUsageDescription` and Android `CAMERA` present | — | Real camera, native scanner and permission prompts need an iPhone |
| Serving sizes and unit conversions (g, oz, lb, ml, fl oz, household portions, per-100 g vs per-serving) | PASS | None. New unit tests for lb and fl oz, kJ→kcal, salt→sodium, per-serving vs per-100 g agreement, and serving-only custom foods | Tests `1644ee0`, `79ee096` | — |
| Calorie and macro math, daily totals | FIXED | N1 (P2): an entry whose source doesn't list a macro was summed and shown as a real 0 on the diary | `1644ee0` | — |
| Diary page `?date=` | FIXED | N2 (P3): `/nutrition?date=2026-13-45` threw a RangeError while rendering; `2026-02-30` silently became March 2 | `d3087bb` | — |
| Missing data presented as verified | PARTIAL | N3 (P3): the offline USDA database and FoodData Central search store a missing macro as 0 with a "USDA" badge. N4 (P3): Home's protein card doesn't say "at least" | Not fixed | Needs the USDA source CSV to rebuild (see N3) |
| Saved meals and recipes (serving scaling) | PASS | None. New `scaleItem`/`amountColumns` unit tests; integration `recipes-planner` | Tests `79ee096` | — |
| Meal plans and grocery list (Pro) | PASS | None. Unit `meal-planner`, `grocery`; integration `recipes-planner` | — | — |
| Water tracking | PASS | Code review: 1–5,000 ml per entry, user-scoped undo; page renders at phone width | — | — |
| Nutrition score | PASS | Off by default (`FOOD_IQ_SCORE`), labelled experimental and never computed from missing data. Name clearance is tracked in `docs/launch-audit` | — | Dietitian review before switching it on |
| Progress photos (upload, storage, delete, per-user isolation) | PASS | None. Private bucket with owner-only storage and row policies; server checks the path is `<uid>/<uuid>.jpg` and that the object exists; delete removes the file before the row; re-encoding through a canvas strips EXIF and GPS; account deletion removes storage. Integration `progress-photos.test.ts` | — | Camera capture on iPhone untested |
| Body measurements and weight history | PASS | Code review: unit conversion before save, range checks (weight 25–400 kg); pages render at phone width | — | Not exercised in the browser beyond rendering |
| Charts and layouts at phone width | PASS | Browser: 22 screens (Home, Train ×5, Calendar, Food ×7, Progress ×4, Faith ×4) at 412 px had no horizontal overflow, no error screen and no console errors | — | — |
| Badges, ranks, strength ranks | PASS | None. Unit tests for achievements, ranks and strength ranks; every rank verse has BSB text; the First Step badge unlocks on the first workout (browser) | — | — |
| Challenges (40-day) | PASS | None. Unit `challenge`; integration `challenges`; check-ins can't skip ahead | — | — |
| Faith: scripture source and translation | PASS | None. One translation (BSB) chosen in `src/data/scripture.ts`; 68 passages from `bsb-passages.json` with source URL, download time and SHA-256; 44 scripture/devotional/faith tests pass; the offline edition quotes all 66 references it shows word for word; no KJV wording ("ye" matches are minified code) | — | — |
| Faith: licensing notes | PASS | `docs/SCRIPTURE.md` matches the code: workflow `bsb-text.yml`, `scripts/extract-bsb.mjs` and `bsb-references.json` exist; attribution is shown on the Faith page and in the Terms | — | — |
| Faith: broken references | PASS | None. Every reference used by content, devotionals, ranks and the coach resolves to BSB text (test fails otherwise) | — | — |
| Faith: reachable on Free, no paywall | PASS | Faith is a main tab; the middleware requires sign-in only; faith and challenge actions have no plan check; a fresh Free account opened `/faith`, `/faith/journal`, `/faith/practices` and `/faith/reminders` without error | — | — |
| Prayer tracking, practices, daily verse, devotional | PASS | All writes filtered to the member's own rows; practice check-ins limited to today and the previous 6 days on the server; verse and devotional rotations are deterministic by date | — | — |

## Confirmed defects

### W1 (P2, FIXED in `04100aa`): a workout discarded while offline came back

**Files.** `src/components/workout/workout-logger.tsx` (both discard paths and the restore effect),
`src/lib/workout-storage.ts`, `src/components/shell/active-workout-pill.tsx`, `src/lib/domain/workout-draft.ts`.

**Root cause.**
1. The logger backs up every in-progress workout to `workout_sessions.draft` with `status = 'in_progress'`.
2. Discarding calls `discardWorkoutAction`. Offline, that call fails, but the device copy was cleared anyway (in the
   conflict screen the result was ignored entirely).
3. On the next visit, `getServerDraft` returned the server snapshot and `newerDraft(null, server)` restored it. Home and
   Train also kept showing "Resume workout", because they read the server's in-progress row.

**Evidence.** In the browser, I logged 135 lb × 5, waited for the backup, went offline, chose Discard workout, went
back online and opened `/train/workout`. It printed `after offline discard, set 1 weight on /train/workout = "135"`.

**Fix.**
- The device records every discard (the last 20 per account) and the logger never restores a recorded workout.
- While a record is not yet confirmed, the app shell deletes the server copy whenever the device is online, then
  refreshes the page.
- Records are kept after the delete. Otherwise a page that loaded the snapshot just before the delete restores it; the
  browser showed this race in an intermediate version of the fix.
- Discard also cancels the pending rest notification.

**Regression tests.**
- `tests/unit/workout-discard.test.ts` (7 tests).
- Browser, after the fix: going straight to the logger after reconnecting does not restore the workout, and its server
  row is deleted. Going to Home shows no "Resume workout" and leaves no server rows (`[]`).

### W2 (P3, FIXED in `04100aa`): a workout name of only spaces blocked every server backup

**File.** `src/components/workout/workout-logger.tsx` (sync payload).

**Root cause.** The payload sent `d.name || "Workout"`, which keeps `"   "`. `draftSnapshotSchema` trims the name and
requires at least one character, so every backup returned "Invalid workout snapshot". The workout then lived only on the
device.

**Fix and test.** A new `draftSnapshot()` helper trims the name first. A unit test shows the old payload is rejected by
the real schema and the new one is accepted.

### W3 (P3, FIXED in `a47a3d1`): finishing with an ended session said "you appear to be offline"

**File.** `src/components/workout/workout-logger.tsx` (finish).

**Root cause.** When the session has ended, for example after signing out on another device:
- The middleware answers the server-action POST with a 307 redirect to `/login?next=…`.
- The action rejects.
- The catch handler always said "You appear to be offline… try again when you're connected", so an online member
  retried forever.

**Evidence.** Browser probe: after clearing cookies, `POST /train/workout … 307` was followed by `POST /login … 200`, and
the same "offline" message was still showing after 60 s. The draft was kept.

**Fix and test.**
- Online, the message now says the account couldn't be reached, the workout is kept on the device, and to sign in again
  and finish from Resume. The offline message is unchanged.
- Unit test in `workout-discard.test.ts`. Browser: the new message appears, the draft is kept, and after signing in the
  same workout resumes and finishes.

### N1 (P2, FIXED in `1644ee0`): a missing macro was shown as a real zero on the food diary

**File.** `src/app/(app)/nutrition/page.tsx`.

**Root cause.** For an Open Food Facts product that doesn't list protein (or carbs or fat):
- The value is stored as 0 for running totals, with `basis.missing = ["protein_g"]`.
- Insights and recipes already show such totals as "at least…".
- The day page summed the 0 as a real value and showed "P 0" on the entry.

**Fix.**
- `incompleteMacros()` in `src/lib/domain/food-basis.ts` reads the logged items' bases.
- The totals card marks affected macros with "≥" and explains it below the card.
- The entry row shows "—" for the unlisted macro.

**Regression tests.**
- `tests/unit/nutrition-audit.test.ts`, which also adds unit-conversion and scaling tests.
- Browser: typed barcode → "Not listed on this product: protein" → logged → "Protein is a minimum: some entries don't
  list it", the row shows "P — · C …", and exactly one macro is flagged ≥.

### N2 (P3, FIXED in `d3087bb`): `/nutrition?date=` accepted impossible dates

**Files.** `src/app/(app)/nutrition/page.tsx` and `src/app/(app)/nutrition/photo/page.tsx` only checked
`/^\d{4}-\d{2}-\d{2}$/`.

**Evidence.**
- `addDays("2026-13-45", -1)` throws `RangeError: Invalid time value`, and the page calls it while rendering.
- `addDays("2026-02-30", -1)` returns `2026-03-01`.

**Fix and test.** `isValidIsoDate()` in `src/lib/domain/dates.ts` accepts only real calendar dates, and a bad date falls
back to today. Unit test in `nutrition-audit.test.ts`. Browser: both bad dates open today's diary with no error screen.

### N3 (P3, remaining): missing USDA macros are stored as 0 and badged "USDA"

**Files and evidence.**
- `scripts/build-food-db.mjs:98` writes `r1(p ?? 0), r1(c ?? 0), r1(fat ?? 0)` into `src/data/usda-foods.json`.
- `src/server/services/food-database.ts:63-65` (FoodData Central, only with an API key) does the same.
- The source badge then says "Published values from USDA FoodData Central".

**Impact.** Unknown. SR Legacy is nearly complete for macros, and the source CSV the script reads is not in the repo, so
I couldn't count the affected foods.

**Proposed patch.**
- In `normalize()`, return `missing: ["protein_g", …]` for absent nutrients, and pass it into `basis.missing` in
  `src/app/api/foods/search/route.ts` and `food-resolve.ts`.
- Rebuild `usda-foods.json` keeping `null`, and map `null` to `missing` in `usda-local.ts`.
- The N1 labelling then applies automatically.

### N4 (P3, remaining): Home's nutrition card doesn't flag incomplete protein

**Evidence.** `src/server/services/dashboard.ts:31` selects only `calories, protein_g` and sums them, so a day with a
"protein not listed" entry shows a protein total without "at least".

**Proposed patch.** Also select `basis`, and use `incompleteMacros()` as the diary does.

### W4 (P3, remaining): history "30 days" totals use a UTC day boundary

**Evidence.** `src/app/(app)/train/history/page.tsx:29` uses
`.gte("started_at", `${since}T00:00:00Z`)`. For a member in UTC−5, a workout at 9 pm on the day before the window starts
is counted. The workout list itself is correct.

**Proposed patch.** Query a day earlier, then filter with `isoDateInTz(started_at, profile.timezone) >= since`, as
`getTrainingBuckets` does.

## Counts

- **Confirmed defects: 8** (2 × P2, 6 × P3).
- **Repaired: 5**, each with a regression test: W1, W2, W3, N1, N2. Two further commits add tests only: `5e11650` and
  `79ee096`.
- **Remaining: 3**, all P3: N3, N4, W4.

## Launch blockers for an iPhone beta or App Store submission (this area)

No code defect left in this area blocks a beta. These must be checked on a physical iPhone before submission, because
nothing here could be:

1. **Native barcode scanner.** Check:
   - the camera permission prompt and its wording;
   - what happens when permission is denied (the app shows how to re-enable it in Settings);
   - cancelling a scan;
   - a UPC-A product, which iOS reports as a 13-digit EAN.
2. **Rest timer.**
   - The local notification: permission request, and firing while the app is in the background or locked.
   - The end-of-rest beep. `beep()` creates a new `AudioContext` each time. Capacitor sets
     `mediaTypesRequiringUserActionForPlayback = []`, so it should play, but that is unverified.
3. **Progress photos** taken with the camera through the file input, then upload and delete.
4. **Discarding a workout in airplane mode, then reconnecting** (W1 path) inside the native shell.

## Could not verify, and what it would take

- **Anything on a device** (camera, native scanner, notifications, sound, haptics): needs a TestFlight build on an
  iPhone.
- **Live Open Food Facts and USDA FoodData Central**: needs outbound access and a USDA API key. A local stand-in was used
  instead.
- **The repo's own Playwright specs for this area** (core-flow, journeys, food-amounts, nutrition-diary, rank-badges,
  faith-calendar, challenge, train-pause): they need the app served at the address in `NEXT_PUBLIC_SITE_URL` and in
  Supabase `site_url` (`http://localhost:3000`), so e-mail confirmation links resolve. Alternatively, run them with both
  pointed at the test server.
- **A theoretical race, not reproduced.**
  - The case: a backup sync already in flight when the member discards online could re-insert the in-progress row,
    because `saveDraftSnapshot` inserts when no row exists (`src/server/services/workouts.ts:51-62`).
  - On that device the W1 record now stops it being restored. The server row would still show "Resume workout" on Home.
  - Proposed: have `discardDraft` set `status = 'discarded'` instead of deleting, so the existing "never resurrect"
    guard applies. Every query that reads `workout_sessions` without a status filter would need checking first.
- **How many USDA foods N3 affects**: needs the SR Legacy CSV inputs of `scripts/build-food-db.mjs`.
- **Whether the adaptive training (Pro) recommendations are right**: needs a coach to review the rules in
  `src/lib/domain/adaptive-training.ts`.

## Stale points in earlier documents

- `docs/APP_AUDIT.md` line 33 ("Body map and strength ranks: never built") and line 61 ("body map / strength ranks
  missing") are out of date. `src/lib/domain/strength-ranks.ts` and `src/lib/domain/body-map.ts` exist, and
  `/progress/body-map` renders.
- `docs/SCRIPTURE.md` is accurate.
