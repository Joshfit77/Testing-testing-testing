# Report: Food IQ, exercise form, GPS and the latest demo

_2026-10-23. Branch `claude/sharp-cray-8y0uuv`, built on `claude/nine-features` @ `1bfb578`. That was the newest
complete, verified branch, and it contains all nine-feature work, memberships, RevenueCat/Stripe, security fixes, Faith,
badges and AI limits. Seven commits on top, each stage separately. Nothing merged into `main`, deployed or submitted
to TestFlight. No prices or plan prices changed, no paid services were used, and no keys were added._

| Stage | Commits |
|---|---|
| 1. Narrow Gate Food IQ | `72676ad` (score, evidence, classes, goal fit, search, tests, method doc), `b7b01c4` (screens, browser tests) |
| 2. Exercise form | `4f83cd3` (contact-sheet renderer), `f332817` (13 corrections + form tests), `25d5dc3` (review doc, before/after) |
| 3. GPS | `20cc8b9` (smoothing, outliers, measured on traces), `e810c7e` (GPS details, approximate-location help, map) |
| 4. Demo | This report, and the updated private preview (below) |

## 1. Narrow Gate Food IQ

**What a member sees.**

- The Food tab has a "Narrow Gate Food IQ" card with **Scan a product** and **Search by name** (Open Food Facts,
  rate-limited).
- Each product page shows:
  - the Food IQ summary;
  - the score breakdown;
  - Add to diary;
  - **Fits your goals** (Pro);
  - ingredients worth knowing, with an evidence class and official sources for each additive;
  - protein, carb and fat classifications;
  - better alternatives;
  - Nutri-Score and NOVA;
  - the full nutrition table, ingredients and allergens (Unknown is never shown as safe);
  - compare;
  - **Ask AI about this food** (Pro), with three focuses: goals, compare, meal plan.

**The 0–100 score (FIQ-0.1)** is original and documented in `docs/FOOD_IQ_METHOD.md`:

- formulas per kind of food;
- band rationale;
- 40 reference foods generated from the code;
- known biases;
- a dietitian review checklist.

It returns "not enough data" instead of guessing, and "not rated" for alcohol, baby foods, supplements, herbs and
spices, salt and sweeteners. **It is off by default** (`FOOD_IQ_SCORE=off`). When switched on, it is labelled
"Experimental · not yet reviewed" and says it is not a probability or a medical assessment. Yuka was used only as a
functional reference; none of its scoring, wording or data was copied.

**Evidence classes:**

- established;
- regulatory action;
- mixed or emerging;
- no established concern at permitted levels;
- insufficient.

Each additive entry cites EU regulations, EFSA, WHO/IARC or FDA, and the wording is neutral (no invented risks).

**Claims vs comparisons:** nutrient labels state whether they are legal claim thresholds (EU 1924/2006), UK FSA
guidance or informal comparisons.

**Memberships:**

- Free: scan and search, the analysis, allergens, alternatives and the diary.
- Plus: adds personal filters and side-by-side comparisons.
- Pro: adds Fits your goals and Ask AI (new feature key `food_goal_analysis`).

Prices are unchanged.

**Tests:**

- 60 unit tests (reference foods, orderings, monotonicity over 300 random products, missing data, wording, AI facts);
- an integration test for search;
- browser tests run with the score both on and off.

**Limitations:**

- The score has not been reviewed by a dietitian.
- Real Open Food Facts traffic is blocked in this environment, so the tests use a local mock in the OFF format.

## 2. Exercise demonstrations

All **157** catalog exercises were inspected at six phases each on contact sheets
(`scripts/exercise-review/contact-sheets.mjs`). **13 were corrected**, and **144 are unchanged** (pixel-identical).
**6 are flagged** for a qualified coach. Before/after sheets and the full list are in
`docs/exercise-review/REVIEW.md`.

**Corrected, highest risk first:**

1. **Sumo deadlift:** now a front view: wide stance, toes out, knees over toes, hands inside the knees, plates outside
   the feet, more upright than conventional. It used to look the same as a conventional deadlift.
2. **Sit-to-stand (chair):** actually sits on the chair (it hovered 12 cm above it with a flat back), then leans
   forward and stands.
3. **Barbell box squat:** reaches the box.
4. **Child's pose:** knees, shins, forehead and hands on the floor (the figure floated).
5. **World's greatest stretch:** the hand reaches the floor, the elbow drops to the instep, and the arm points at the
   ceiling.
6. **Atlas stone and sandbag to platform:** platform just past the toes, object hugged on the chest (it was carried at
   arm's length).
7. **Sandbag to shoulder:** the bag is on the shoulder, not on the head.
8. **Pull-up, chin-up and band-assisted pull-up:** chin over the bar; no kipping swing.
9. **Leg press:** back pad under the back.
10. **Hip thrust:** chin tucked at the top.

Variations are checked to stay distinct:

- Bulgarian split squat: the rear foot stays on the bench.
- Kettlebell swing: a hinge.
- Incline vs flat press: the angles differ.
- Front squat: more upright than the back squat.
- RDL: soft knees.

**Flagged for a coach:**

- the open-book camera;
- conventional and sumo torso angles (set by the figure's proportions);
- the front-squat rack position, which the side view hides;
- grip, which can't be drawn on this figure;
- dips (shoulder position at the bottom).

**Tests:** 332 new form tests. Each correction has a contact test that fails on the old code. There are also variation
tests, and every exercise is checked for limb length, framing and a view label.

**Limitations:**

- These are stylised illustrations, not coaching, and don't claim any form is safe for a particular person.
- The offline single-file edition (`standalone/index.html`) is generated outside this repo and still embeds the old
  figures.

## 3. GPS

**Cause:** distance was the sum of raw fix-to-fix steps. Noise zig-zag, drift while standing still and multipath
spikes all made distance read long, especially when walking. Approximate location failed silently.

**Fix:**

- an accuracy-weighted Kalman filter, with distance measured along the smoothed track in ≥ 6 m chords;
- a standing-still rule (no distance below 0.55 m/s);
- outlier gating and speed caps;
- recovery from a bad first fix;
- stale-fix rejection;
- the straight-line distance across signal gaps is reported, never counted.

The existing rules are unchanged: nothing is counted before a good fix, across a pause or across a gap.

**Measured on 12 controlled scenarios** with known truth, 20 seeds each, mean error, before → after
(`docs/GPS_ACCURACY.md`):

| Scenario | Before | After |
|---|---|---|
| Open-sky run | +2.9% | +0.5% |
| City walk | +37.5% | +4.6% |
| Walk with stops | +35.6% | +4.2% |
| Intervals | +2.2% | +1.1% |
| Multipath spikes | +15.1% | +2.8% |
| Slow walk | +7.1% | −0.7% |
| Poor first fix | +28.4% | +3.4% |
| Out-of-order delivery | +2.6% | +0.2% |
| 10 minutes standing still | 153 m | 5 m |

These are simulated traces, not phone recordings.

**New for members:**

- a "GPS details" panel: source, accuracy, update rate, readings used and ignored, gaps, speed. It shows no
  positions and logs nothing;
- a clear message, with steps to fix it, when iPhone Precise Location or Android approximate location is on;
- weak-signal, slow-update and off-route hints;
- route map: km or mile markers, dashed "not counted" breaks, a live position with its uncertainty ring, and an
  imperial scale bar.

**Tests:**

- 12 accuracy tests on the traces;
- 2 diagnostics tests;
- route-map tests;
- the original rule tests;
- browser tests for GPS details and approximate location.

**Browser vs phone:**

- In the browser, location works only while the page is visible. Locked-screen time is a gap, and the screen says so.
- **Not yet verified on a real phone:** native background recording, real-world accuracy, battery and update rates.
  An outdoor test plan with pass criteria is in `docs/GPS_ACCURACY.md`.

## 4. The demo

**Exactly what exists:**

- A private, tappable preview on claude.ai at **https://claude.ai/artifact/NP9mW7vehDxeuzgKdQQp54** (the same link
  as before). It is a viewer of real full-page screenshots of the app at iPhone size, with the app's own links mapped
  as tap areas.
- It was previously captured from `claude/nine-features` @ `1bfb578`.
- **Now re-captured from `claude/sharp-cray-8y0uuv` @ `e810c7e`** and published to the same link as version 5:
  **403 screens**, including Food IQ, the corrected exercise figures and the new GPS screens. A sample image was
  checked to match the local capture byte for byte.
- **Expanded to 602 screens and published as version 10**: the remaining detail pages (exercise history, past
  workouts, saved runs and run edit) were captured so that every link in the demo opens its page. The one exception
  is "Export my data", which downloads a file in the app; in the demo it shows a note explaining that instead.
- **Exercise figures play live in the demo** (160 figures: the 157 exercise pages and the workout logger). They are
  drawn by the app's own animation code (`src/lib/exercise-motion`, bundled into the page), not a recording, and
  pause/play and ½× speed work as in the app. The screenshots are packed into 169 image sheets to fit the
  preview host's file limits.
- Checked on the published page itself: three sample sheets match the local files byte for byte, the published
  page is the local page unchanged inside the host's standard wrapper, and the demo click-through checks pass on it
  (links, back, tab bar, figure animating, pause, ½× speed, the workout logger figure, wide-screen layout, Food IQ
  and run paths), with no script errors.
- Still not possible in a recorded demo: typing, saving new entries, real AI replies, live GPS or the camera.
- Capture setup: a local production build (`next build` / `next start`) on a local Supabase with all migrations
  applied, and a demo account with seeded workouts and runs.
- Mocks: a stand-in AI server (replies are sample text) and a local Open Food Facts mock. GPS is simulated through the
  browser's location override, and meal and body-scan photos are illustrations.
- The Food IQ score flag was **on** for the capture so it can be reviewed; it remains off by default.
- **Not deployed** anywhere else and **not run on a physical iPhone**. There is no other hosted preview and no
  TestFlight build.

**Screens to look at:**

- Food tab → Narrow Gate Food IQ → "Food IQ search" (three protein bars) → any product;
- Run → Record (live run, GPS details, route map) → saved activity;
- Train → exercises (e.g. Sumo Deadlift, Pull-Up, Child's Pose).

## Test results (this branch, final build)

- **Typecheck and lint:** clean.
- **Unit and integration (Vitest):** 111 files, **2,616 passed**, 0 failed.
- **Browser (Playwright, Chromium at phone size, mocks above):**
  - Stage 1 build: 61 passed, 1 skipped by design (the "coach not configured" check can't run while a mock AI is
    attached).
  - With the score off: 11 passed, the same 1 skipped.
  - GPS and exercise-demo specs on the Stage 3 build: 6 passed.
  - **Full run on the final build (`e810c7e`, score on): 62 passed, 1 skipped (the same by-design skip), 0 failed.**

## What needs you or a professional

1. **Dietitian review** of `docs/FOOD_IQ_METHOD.md` before switching `FOOD_IQ_SCORE` on in production.
2. **Coach review** of the 6 flagged exercises (`docs/exercise-review/REVIEW.md`).
3. **Outdoor phone testing** of GPS on iPhone and Android (`docs/GPS_ACCURACY.md`, 8 checks).
4. Approval before any merge into `main`, deployment or TestFlight submission.
