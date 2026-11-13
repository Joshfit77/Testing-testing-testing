# Quality improvement pass, 2026-11-13 (branch `claude/pro-premium`)

All of this was done and verified locally, in demo/test mode. Nothing was merged into main, deployed or published, and no
live payments or paid AI calls were made. "Verified" below means a test or a real-app check that was actually run.

## Phase 1: AI coach

- **Live model test: not run.** There is no Anthropic key in this environment, and the credential form refuses
  Anthropic hosts. No live result exists, and none is claimed. The exact setup the owner needs (a separate key, a
  Console spend limit, a `--max-usd 5` ceiling) is in `docs/ai-eval/LIVE_TEST_SETUP.md`.
- **Offline checks run:**
  - Cost estimate.
  - Harness self-test: 30 scenarios through the real coach code path with a scripted stand-in. Its safety checks
    correctly flagged the stand-in's missing referrals.
  - AI unit tests: 157 passed.
  - AI integration tests: 61 passed, against the real database. They cover:
    - Free refused at every AI entry point;
    - the 150-request allowance and the 10-request larger-model share holding under concurrent requests;
    - the per-member money budget;
    - no invented history (a new member's analysis says there is no history);
    - recorded cost equal to the provider-reported tokens.

## Phase 2: workout logging

- **RPE asked only after a set is done.** A set still to do shows weight, reps and the tick only. Covered by a new e2e
  assertion in `e2e/fast-logging.spec.ts`.
- **Sync status in the workout header is an icon** with a spoken label. The words "Saved on device" were clipped on
  narrow phones.
- **Number fields show a "Done" key**, and Enter closes the keyboard (list rows and the current-set card).
- **Kept from earlier work, re-verified by e2e:** one-tap Complete set, automatic rest timer, last time shown per set,
  in-progress workouts kept offline and retried.

## Phase 3: program library

Done by a sub-agent; merged in 2c21dac. Details are in `docs/programs/PROGRAM_LIBRARY_AUDIT.md`.

- **Browsing shows 64 of 74 training programs.** 10 near-duplicates are retired from browsing only; none is deleted or
  unpublished.
- **Members keep everything.** Enrollments, logged workouts and calendar moves are untouched. Retired programs stay
  under "My programs" with a notice.
- **13 programs renamed.** Wave Strength is an 8-week program (two 4-week waves), so its name now matches. Slugs and
  ids are unchanged.
- **Migration 070 changes names and summaries only.** It contains the rollback and was tested on a throwaway database
  with members part-way through programs.

## Phase 4: the eight bugs

| # | Bug | Root cause and fix | Regression test | Verified in the app |
|---|---|---|---|---|
| 1 | Route map had no background | A scale grid is drawn by default. Optional map tiles appear only when the owner configures a provider (off by default: tiles would tell the provider where the member ran). | `tests/unit/route-map.test.tsx`: grid, no images by default, tile placement matches Web Mercator | Screenshot `run-route-map` |
| 2 | 3.11-mile run showed "Mile 4" | The seed wrote splits in a different format from the recorder, and the label used the split index. A short final split is now labelled by its length ("0.11 mi"). | `tests/unit/run-splits.test.ts` | Splits read Mile 1–3 and 0.11 mi, and sum to the moving time |
| 3 | Weekly report in km for a miles member | Distances and pace follow the member's unit, including the AI report instructions. | `tests/unit/weekly-report.test.ts` | "4 mi in total" |
| 4 | Sample weights such as 203.9 lb | Loads are chosen in pounds, in 5 lb steps, and stored the way the app stores a typed weight. | `tests/integration/demo-seed-quality.test.ts` (every set is a whole 5 lb) | Logger shows 350, 205 and so on |
| 5 | Body map "Not assessed" | With no table chosen, the strength table follows the member's sex. An explicit choice still wins. | `tests/unit/strength-ranks.test.ts`, `tests/integration/body-map.test.ts` | Ranked, "Comparing with the men's table" |
| 6 | Duplicate daily check-ins | The recovery check-in fills the sleep journal's three shared answers without clearing the rest. The journal no longer asks them again. | Unit and integration tests in `sleep-checkins` | The journal points to the daily check-in |
| 7 | Agility shuttle and 90/90 animations | Rebuilt by the animation agent (merged cbac7fb): real 5-10-5 pattern, 90/90 with the pelvis and feet fixed. | `exercise-agility-drills`, `exercise-mobility-drills` | Renders reviewed frame by frame; coach review still needed |
| 8 | "Browse free programs" led to a library with no free programs | The builder lock now offers "Rebuild my free starter program". Train shows the same for Free members. | `e2e/memberships.spec.ts` | Screenshot `free-builder-locked` |

## Phase 5: demo data and nutrition

- **Sample member:**
  - named Jordan Hayes, with plate-friendly loads;
  - this week's sessions are logged, so no false "3 sessions came and went";
  - three recipes, a 7-day meal plan and a grocery list, all built by the app's own planner and list builder.
- **Nutrition maths checked by hand.** Chicken rice bowl: 579 kcal per serving against about 581 from the ingredients.
  Overnight oats: 583 against about 588. Plan day: 2,625 of 2,600 kcal.
- **Grocery list:**
  - **Fixed:** the same ingredient appeared twice ("0.5 cup" and "2.6 oz"). Cups with a known weight are now added to
    the weight.
  - **Still apart:** amounts with no known weight stay on separate lines, with a note.
- **Estimates labelled.** The planner states that it is an estimate. Recorded vs estimated labelling is unchanged from
  earlier work. No new accuracy claims were added.

## Phase 6: UX

- **Exercise library order.** Opened with no filter, the library starts with the core lifts, then lists everything A–Z.
  It no longer opens on "90/90…".
- **Not done in this pass:**
  - a broader disclaimer reduction;
  - a navigation simplification beyond the items above.

## Phase 7: documentation

- **AI limits corrected** to 150 requests, 10 advanced, about $1.40 a month, and no AI on Free. Files updated:
  - `MEMBERSHIPS.md`
  - the Terms draft, §3.3, with an attorney-review marker
  - `PRO_ROADMAP.md`
  - `pro/FINAL_REPORT.md`
  - dated notes in `ai-eval/COST_MODEL.md` and `faith/FINAL_REPORT.md`
- **Historical attorney note restored** to its original $19.99 / $149.99. A separately dated line records the later
  approved prices.
- **Attorney review still open.** Terms and Privacy remain drafts, and attorney review is still an open launch blocker
  in `launch-audit/FINAL_LAUNCH_CHECKLIST.md`.

## Validation (actual results)

| Check | Result |
|---|---|
| `tsc --noEmit`, eslint on changed files | Clean |
| Unit suite | 4,453 of 4,454 passed. The one failure was a 5 s timeout in `exercise-motion-quality` under heavy CPU load from the animation renders; it passes alone (13/13 and 45/45 with the new drills). |
| Integration suite | 432 passed, 1 skipped, 0 failed |
| Production e2e (changed areas: memberships, fast logging, program library, training, workout data preservation) | 12 passed, 0 failed |
| Demo e2e (`demo.spec`, `ux-train-run`) | 20 passed and 3 failed (see below). The new-member flow failed in the full run and passed on its own re-run. |
| Real-app checks (`fixes.mjs`, 16 checks on the demo server) | 16 passed, 0 page errors |
| Walkthrough (16 sections) | 16/16 ok, 0 console errors |

## Open problems (not fixed)

1. **Demo e2e: exercise library.** "Bench Dip" still shows "Demo soon": it has no animation yet (a placeholder since it
   was added in 2d99a3f). The test that forbids placeholders in the list fails.
2. **Demo e2e: program library length.** The library page measures 12.95 iPhone-15 screens against a limit of 12. It
   was not confirmed whether this is new.
3. **Live AI quality, accuracy and personalization: not tested** (no key).
4. **Map tiles are off.** Turning them on is an owner decision: privacy policy update, provider terms and attribution.
5. **Workout header.** The workout name still truncates beside three header buttons.
