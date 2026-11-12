# B. Patent claim comparison (technical research, not a legal opinion)

Prepared 2026-10-25 against branch `claude/testflight-prep` (commit `c541d63`), US jurisdiction. Line numbers are from that commit.

**Read this first: what could and could not be verified.** The development sandbox cannot reach patents.google.com, USPTO Patent Center / PPUBS, PatentsView, Justia or WIPO (the outbound proxy answers 403 to every host except GitHub and npm). Every patent fact below therefore comes from web-search result snippets and summaries, gathered with 60+ differently-phrased queries. **No full claim set was obtained for any of the six patents.** Where a snippet carried claim or abstract text it is marked *snippet-quoted (unverified)*; everything else is a **paraphrase**. The code side of each chart is verified by reading the files cited. A patent attorney must re-run each chart against the actual independent claims (the PDF links are given) before anything is relied on. Nothing here is a conclusion of infringement or non-infringement, and a missing element in a paraphrase is not clearance.

Classification key (from the brief): **GREEN** keep, **YELLOW** modify/review, **RED** hold from commercial release, **NOT PRESENT**.

---

## Patent 1 — US 2026/0196331 A1, "personalized ingredient analysis" (Ingredient IQ LLC)

**Status found:** the publication could not be located under any number format, by title phrase, by feature language or by applicant on any reachable source. Nothing can be said about its claims, its current status, assignment history, or family. The only corroboration is a product channel ("IngredientIQ": labels → "personalized Go/No-Go signals using smart OCR, AI, and verified health data"), which matches the brief's description of the application. Links to try: https://patents.google.com/patent/US20260196331A1/en and the USPTO PPUBS number search.

**Required elements (from the brief, not from the claims):** user health profile · barcode or image capture of ingredients · ingredient identification · AI analysis · ingredient-to-health-condition relationships · personalized compatibility evaluation · Go/No-Go output.

### Claim chart (element list taken from the brief; claim numbers unknown)

| Element (brief) | Narrow Gate implementation | Evidence | Match / difference / unknown |
|---|---|---|---|
| User **health profile** (conditions, medications) | None. The member context used for food analysis holds calorie/macro targets, training goal, diet style and chosen allergen filters only. There is no field for a medical condition or medication anywhere in the nutrition code or the `profiles` table columns the feature reads. | `src/lib/food-iq.ts:346-357` (`MemberTargets`, `MemberContext`); `src/lib/food-quality.ts:539-548` (`FoodFilters`: allergens, diet, nutrition) | **Difference** (no health-condition profile) |
| Barcode or image capture of ingredients | Barcode scan (native scanner / ZXing) and name search; product facts come from Open Food Facts. No OCR of labels. | `src/app/(app)/nutrition/scanner/page.tsx`; `src/server/services/food-quality.ts:8-101`; `src/lib/barcode.ts` | Partial similarity (barcode lookup is ordinary) |
| Ingredient identification | Ingredient list and additive tags as supplied by Open Food Facts; additives looked up in a fixed evidence table. | `src/lib/food-quality.ts:336-520`; `src/lib/additive-evidence.ts:117+` | Similar (data display) |
| AI analysis of ingredients | Optional "Ask AI about this food" (Pro): the model is instructed to repeat only the app's reviewed evidence lines and never add safety claims about an ingredient. | `src/lib/food-quality-ai.ts:15-25` (rules), `:58+` (facts sent) | Partial; the AI is not an ingredient analyser |
| Ingredient ↔ health-condition relationships | None. Additive evidence is general (what regulators say), not keyed to any person's condition. | `src/lib/additive-evidence.ts:14-30` (evidence classes) | **Difference** |
| Personalized compatibility evaluation | "Fits your goals": per-serving percentages of the member's own calorie/macro targets, a fibre reference from calories, the general 2,300 mg sodium limit, diet-style conflicts (vegan/vegetarian/keto carbs) and the member's chosen allergen filters. | `src/lib/food-iq.ts:391-447` | Partial: personalization is to *fitness targets, diet style and chosen allergens*, not to medical conditions |
| Go/No-Go verdict | None. Output is rows, notes and "conflicts" sentences; no safe/unsafe verdict, no medical verdict, and the AI is told not to give allergy or medical guarantees. | `src/lib/food-iq.ts:373-378` (`GoalFit` shape); `src/lib/food-quality-ai.ts:19-21` | **Difference** |

**Assessment (technical):** the app displays product facts and compares them with fitness targets and self-chosen diet/allergen preferences; it does not perform a combined medical compatibility workflow. Under the brief's default: **GREEN** for barcode lookup and nutrition information; the hypothetical RED trigger (automated medical compatibility scoring) is **NOT PRESENT**.

**Questions for counsel:** obtain the publication and check whether any independent claim covers a *dietary-preference/allergen* profile rather than a medical one; confirm whether "Go/No-Go" is a required element; check the 2025 Ingredient IQ LLC trademark filings for the same product (see C).

---

## Patent 2 — US 2026/0204388 A1, "AI analysis and scoring of consumables" (IndulgeRx Brands)

**Status found:** the US publication could not be located. Company press material (not patent records) describes: US provisional 2025-01-16; three US non-provisionals 2025-10-10 ("System and Method for Artificial Intelligence Analyzation and Scoring of Consumables" among them); PCTs published 2026-07-23 as WO2026156104 / WO2026156106 / WO2026156110, with the company stating the written opinions were favourable for claims 1–15 (company characterisation, unverified). Concept (paraphrase of press material): individualized "Relevant Nutrition Scores" weighing ingredient composition, synergy, bioavailability, clinical research and the user's health objectives/therapeutic needs; adaptive to new science and user feedback. The wearable-input element named in the brief was not found in any public text. Owner: IndulgeRx Brands Inc. (trademark IRX FOODSCORE, serial 98406755). Sources: https://www.einpresswire.com/article/862710725/ , https://www.einpresswire.com/article/928855450/ .

### Claim chart (elements from the brief)

| Element (brief) | Narrow Gate implementation | Evidence | Match / difference / unknown |
|---|---|---|---|
| Personal nutrition goals | Calorie and macro targets, training goal. | `src/lib/food-iq.ts:346-357`; targets from `src/server/services/nutrition-targets.ts` | Similar (generic) |
| Health-profile information | None (see Patent 1). | as above | **Difference** |
| Wearable or other sensor inputs feeding the food score | None. Sleep/steps/HR data never enter any food calculation. | `scoreFoodIq` inputs are the product's per-100 g nutrients only: `src/lib/food-iq.ts:136-150` | **Difference** |
| AI-enabled evaluation producing the score | None. The rating is a deterministic published formula (`50 + 2.5P − 1.5N`, drinks `80 + 2.5P − 2N`) with fixed anchors from EU/UK regulatory thresholds; no model, no learning, no adaptation to feedback. The optional AI explanation is given the score as an input and may not change it. | `src/lib/food-iq.ts:79-85` (`lin`), `:122-134` (`positiveFactor`), `:136-263`; `docs/FOOD_IQ_METHOD.md` | **Difference** |
| Personalized nutrition-**risk** score | None. The 0–100 rating is the same for every member (per 100 g of the product). The personal part ("Fits your goals") is a target comparison, explicitly "separate from" the rating, and is not a risk score. Both the rating and the AI are told to never express a probability of being healthy or safe. | `src/lib/food-iq.ts:35-36` (`SCORE_MEANING`), `:391-447`; `src/components/nutrition/food-iq-sections.tsx:332` | **Difference** |
| Combined consumer-health assessment | None. | — | **Difference** |

**Current state of the feature:** the 0–100 rating is **off** in production (`FOOD_IQ_SCORE` must be `"on"`: `src/lib/food-iq.ts:26-28`; `.env.example:86-87`), and when on it is labelled "Experimental · not yet reviewed". The nutrient classes, ingredient evidence and "Fits your goals" are always shown. **Classification:** GREEN for the general nutrient scoring and facts (kept off until a dietitian reviews the method, per the owner's instruction); the medically personalized risk scoring the brief says to hold is **NOT PRESENT**.

**Questions for counsel:** obtain the US publication and the three WO documents; check whether claim 1 is limited to AI/ML-generated scores and to a health profile; note Nutri-Score, Ofcom/FSA and NRF indices as prior art for nutrient-profile scoring (the method doc lists what was consulted).

---

## Patent 3 — US 9,891,059 B2, "Route smoothing" (TomTom Global Content BV / TomTom Polska)

**Status found:** granted 2018-02-13 (app. 14/344,640; priority GB 2011-09-13; PCT 2012-09-13; 20 claims); family EP 2570771 B1, CN 103975223 B, JP 6363504 B2. Google Patents shows "Active", anticipated expiry 2032-09-13. **The 7.5-year maintenance fee (window 2025-02-13 → 2025-08-13, surcharge to 2026-02-13) could not be verified**; if unpaid the patent lapsed in February 2026. Check Patent Center fees for 14/344,640. PDF: https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9891059 ; https://patents.google.com/patent/US9891059B2/en

**Abstract (snippet-quoted, unverified):** "…A smoothing operation is performed on the GPS data to generate a more accurate representation of the route travelled… In the smoothing operation, a cubic spline algorithm is used to obtain an initial estimate of the route representation. The estimate is then subjected to a refinement using at least received user motion data recorded by the personal training device."

**Independent claims (paraphrase from a full-text snippet; numbering partly inferred):** claim 1 (system) — receive position data at multiple times along a route; obtain historical route data and/or digital map data; perform a smoothing operation comprising "applying a spline algorithm to the received position data to obtain an estimated representation of the route in the form of a spline curve" *(snippet-quoted)* and refining that estimate using the additional data; provide the result for display. Claim 16 (medium) mirrors it. Unresolved: whether the granted claims require *user motion data*, *historical/map data*, or both.

### Claim chart

| Required element (paraphrase) | Narrow Gate implementation | Evidence | Match / difference / unknown |
|---|---|---|---|
| Receive position data for a user at multiple times along a route | Yes: GPS fixes (lat, lng, accuracy, time) arrive during a run or walk. | `src/lib/domain/gps-track.ts:22-29` (`GpsFix`), `:287-348` (`addFix`) | Match (generic) |
| **Spline algorithm** applied to the position data to obtain the route as a spline curve | **No spline anywhere.** Positions are estimated with a constant-velocity **Kalman filter** per axis (predict/update with the fix's reported accuracy as measurement variance). The stored route is the sequence of filtered points, later simplified with Douglas–Peucker (point removal, no curve fitting). | `src/lib/domain/gps-track.ts:202-234` (filter), `:301-347` (per-fix predict, gate, update), `:500-523` (`simplify`), `:532-543` (`routeForSave`) | **Difference** |
| Refinement of the spline estimate using **user motion data** (accelerometer/pedometer) | No motion data is read at all; the only inputs are GPS fixes. | `src/lib/domain/gps-track.ts:22-29`; location source `src/components/run/*` uses `@capacitor-community/background-geolocation` only | **Difference** |
| Refinement using **historical route data** | None; each recording is independent and nothing is compared to earlier routes. | no reference to earlier activities in `gps-track.ts` | **Difference** |
| Refinement using **digital map data** (roads, building footprints, water) | None; no map data is loaded into the filter. The map is display only. | `gps-track.ts` has no map input; map view `src/components/run/*` draws the stored line | **Difference** |
| Provide the more accurate representation for display | Yes (live position and saved route on a map). | `src/lib/domain/gps-track.ts:371-378`, `:532-543` | Match (generic) |

**Also present, for completeness:** accuracy gate (> 25 m rejected), outlier gate on the normalised innovation, speed sanity limits, restart on consistent outliers, no distance while standing still, signal-loss handling (`gps-track.ts:118-137`, `:308-336`). These are filtering rules, not route smoothing with a spline.

**Assessment (technical):** the one element common to both is "smooth GPS positions for display". The claimed mechanism (spline curve + refinement with motion/historical/map data) is absent. Kalman filtering of GPS is textbook prior art (the TomTom specification itself calls it well-known). **GREEN** per the brief's default, subject to counsel reading claims 1 and 16. **Do not** add spline fitting or map-based refinement without a review.

**Questions for counsel:** confirm the granted independent claims' second-data-source wording; confirm maintenance-fee status; confirm Douglas–Peucker simplification is not read as a "spline algorithm".

---

## Patent 4 — US 12,163,790 B2, "Route smoothing with map matched positioning coordinates" (Apple Inc.)

**Status found:** granted 2024-12-10 (app. 17/739,074 filed 2022-05-06; provisional 63/197,234 filed 2021-06-04; pub. US 2022/0390238). Google Patents "Active". Claim text not obtained. PDF: https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12163790 ; https://patents.google.com/patent/US12163790

**Abstract (snippet-quoted, unverified):** position information obtained periodically from a receiver during a movement event; a path is estimated; previously mapped features near the estimated path are identified; the estimated path is **matched to the map** based on those features to obtain a map-matched path; the map-matched path is displayed on an image of the map. The description adjusts/shifts the path toward roads and trails and away from buildings and water within an error threshold.

### Claim chart (elements from the abstract; actual claims unknown)

| Element (paraphrase) | Narrow Gate implementation | Evidence | Match / difference / unknown |
|---|---|---|---|
| Obtain receiver position data periodically during a movement event | Yes. | `src/lib/domain/gps-track.ts:287` | Match (generic) |
| Estimate a path from the position data | Yes (Kalman-filtered points). | `gps-track.ts:301-347` | Match (generic) |
| Identify **previously mapped features** near the estimated path | **None.** No map features, road network, trail data or building footprints are loaded or queried anywhere. | no map-data dependency in `package.json` (no map SDK); `gps-track.ts` is pure and takes only fixes | **Difference** |
| **Match** the path to the map / snap points to roads or trails | **None.** Points are never moved toward map features. Post-workout processing is simplification (point removal) and rounding to 5 decimals only. | `gps-track.ts:500-543` | **Difference** |
| Post-workout route reconstruction using map information | None. `recoverTrack` only breaks the line after an app restart; nothing is reconstructed. | `gps-track.ts:562-567` | **Difference** |
| Display the map-matched path on a map image | The *unmatched* route is drawn on a map. | `src/components/run/*` | Difference (displaying a route on a map is not map matching) |

**Assessment:** every public description of this patent is built around map matching, which the app does not do. **GREEN** (preserve ordinary maps and running statistics). If route snapping is ever considered, review first.

**Questions for counsel:** obtain claims 1/11/16 and confirm "map matching" is a required element in each independent claim.

---

## Patent 5 — US 2024/0350078 A1, "Method and system for monitoring and improving sleep pattern of user" (Oura Health Oy)

**Status found:** continuation filed 2024-04-18, published 2024-10-24, priority FI 2017-11-29; family: US 11,478,187 B2 (granted 2022-10-25) → US 11,986,313 B2 (granted 2024-05-21) → this application. No grant, allowance or abandonment event for '078 could be retrieved; best inference is **still pending** (unverified; pull the file wrapper). The '078 claims themselves were not obtained; the parent's claims (snippet-quoted, unverified) include "…analysing the sleep scores and associated go-to-bed time and/or time of falling asleep of the user to determine an optimum bedtime window for the user" and providing feedback; a dependent claim measures sleep duration from heart rate, temperature or movement. Sources: https://patents.justia.com/inventor/hannu-kinnunen ; https://uspto.report/patent/app/20200397367

### Claim chart (parent-based element list; '078 may differ)

| Element (paraphrase) | Narrow Gate implementation | Evidence | Match / difference / unknown |
|---|---|---|---|
| Wearable (ring) measurement data: heart rate, **temperature**, movement | The app reads no sensors. It imports what Apple Health / Health Connect already hold: sleep samples, and overnight heart rate / HRV / respiratory-rate samples summarised to avg/min/max per night. No temperature, no movement data. | `src/lib/native-sleep.ts:1-18`; `src/lib/domain/sleep-import.ts:39-48`, `:178-192` | **Difference** (import vs sensing; no temperature) |
| Define the user's circadian rhythm | None. The schedule module states "nothing here measures circadian phase"; windows come from the member's own median bedtime/wake time and goal. | `src/lib/domain/sleep-schedule.ts:1-6`, `:71-92` | **Difference** |
| Compute a sleep score per night | Yes, from duration vs goal, efficiency, timing vs the member's usual times, and wake-ups (weights 50/20/20/10). No physiological input. | `src/lib/domain/sleep-score.ts:47`, `:64-101` | Similar (generic scoring) |
| Associate each score with go-to-bed / fall-asleep time and **analyse scores against bedtimes to find an optimum bedtime window** | **No.** The bed window is `anchor wake − goal − latency − settle` around the member's typical wake time (or a chosen one); scores are never correlated with bedtimes to pick a window. | `src/lib/domain/sleep-schedule.ts:71-96` (`sleepWindows`): `anchorWake`, `bedCenter`, `WAKE_WINDOW_HALF`, `BED_WINDOW_HALF`; no reference to any score | **Difference** |
| Personalized behavioral guidance / feedback based on that analysis | Guidance sentences come from consistency of the member's own times and the goal shortfall (e.g. shift 15 min per night). | `sleep-schedule.ts:97-112`; `src/lib/domain/sleep-habits.ts` | Partial (guidance exists, from a different analysis) |
| Window length tied to variability of bedtimes | Fixed half-widths (±30 min bed, ±15 min wake). | `sleep-schedule.ts:16-17` | Difference |

**Assessment:** basic sleep history and an independent, transparent score — **GREEN** per the brief's default. The "sophisticated physiological circadian optimization" the brief says to review is **NOT PRESENT** (the energy-rhythm sketch in `src/lib/domain/sleep-energy.ts:1-7` is explicitly a two-assumption estimate, not a circadian measurement). Keep it that way until reviewed.

**Questions for counsel:** pull the '078 claims and prosecution history; confirm whether any claim covers computing a bed window from a goal and typical wake time alone; note the parent patents 11,478,187 and 11,986,313 are granted and should be charted too.

---

## Patent 6 — US 12,614,640 B2, "Method and system for supplemental sleep detection" (Oura Health Oy)

**Status found:** granted 2026-04-28 (filed 2024-10-31; pub. US 2025/0062033; priority provisional 63/180,381 of 2021-04-27). Parent: US 12,165,771 B2 (granted 2024-12-10). PDF: https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12614640

**Independent claim structure (paraphrase from full-text snippets; attributed by the search layer to both '640 and the parent, so treat as the family template):** wearable sensors + user device + processors that: detect a **primary sleep period** within a "sleep day" that ends at a configured **cut-off time**; generate initial Sleep/Readiness scores for that day; **detect a supplemental sleep period** whose duration exceeds a threshold; identify its time of day; **update the day's scores if it falls before the cut-off** (else assign to the next day); display the updated scores and the supplemental period; **receive user confirmation**. Dependent (snippet-quoted): "wherein the determined cut-off time of day is based at least in part on a time of day that the user typically begins a primary sleep period each calendar day."

### Claim chart

| Element (paraphrase) | Narrow Gate implementation | Evidence | Match / difference / unknown |
|---|---|---|---|
| Receive sensor data from a wearable and **detect** a primary sleep period | No detection. Nights are either typed in by the member or imported as finished records from Apple Health / Health Connect (whatever the platform already classified). The app has no access to raw sensor streams. | `src/lib/domain/sleep-import.ts:110-155` (`samplesToSessions`: groups platform samples ≤ 30 min apart); `src/lib/native-sleep.ts` | **Difference** (import, not detection) |
| Sleep day with a configured cut-off time | Sessions carry a `night_of` date for grouping; there is no cut-off time logic that reassigns a nap to today or tomorrow by time of day. | `src/lib/domain/sleep.ts:343-387` (`napsOn`, nights grouped by date) | **Difference** (grouping by calendar date only) |
| Generate initial sleep/readiness scores from the primary period | Nightly score from the night only (naps excluded: "Finished nights (not naps)"). Readiness is a 4-question morning check-in, not derived from sleep sensors. | `src/lib/domain/sleep.ts:343`; `src/lib/domain/sleep-score.ts:64`; `src/lib/domain/readiness.ts:9-14` | Similar only in that a score exists |
| **Detect a supplemental sleep period** exceeding a duration threshold | No detection. A nap is a session the member logs with `kind: "nap"` (max 6 h) or an imported record; nothing identifies naps from sensor data. | `src/lib/domain/sleep.ts:17`, `:26`, `:134-135` | **Difference** |
| Time-of-day test against the cut-off; **update the sleep-day scores** because of the supplemental period | **No.** The nightly score never includes naps and is not recomputed when a nap is added. | `sleep-score.ts:64-101` takes one `NightSummary`; `sleep.ts:343` | **Difference** |
| Display the supplemental period and **receive user confirmation** | Naps are listed; imports are deduplicated and conflicting ones skipped automatically, with a count shown. There is no "confirm this nap" step. | `src/server/actions/sleep-import.ts:126-231`; `src/lib/domain/sleep.ts:385-387` | **Difference** |

**Assessment:** ordinary sleep import and an independent score — **GREEN** per the brief's default. The "automated detection-and-score-recalculation" combination is **NOT PRESENT**. Design note for the future: if naps are ever folded into the nightly score with an automatic cut-off and a confirmation prompt, review this family first.

**Questions for counsel:** whether "receive data from a wearable device" could be read on HealthKit-imported records (claim construction); confirm the '640 independent claims include the confirmation and score-update elements.

---

## Part 2 — Additional patents found (starting points, not a freedom-to-operate search)

Statuses are from Google Patents/Justia snippets (Google itself labels these assumptions). "What claim 1 appears to require" is a paraphrase unless marked quoted.

| Topic | Patent | Owner / status | Claim 1 appears to require (paraphrase) | Apparent overlap with Narrow Gate | Attorney follow-up |
|---|---|---|---|---|---|
| AI workout recommendation | **US 12,551,760 B2** "Workout modification based on muscle strength measurement trends" | Fitbod, Inc.; granted 2026-02-17 | ML model trained on a population's exercise history predicts the user's strength; detect plateau/decline over an interval vs threshold; modify the workout for that muscle group | NGF's adaptive review is **rule-based on the member's own logs** (no trained model, no population data): plateau = no new estimated 1RM in N sessions → proposes a 10 % reset; deload proposed after ≥ 4 weeks with low readiness / high RPE / ≥ 2 stalls; **nothing changes until the member accepts** (`src/lib/domain/adaptive-training.ts:1-10`, `:346-400`, `:504`). The ML-model element appears absent; the plateau-then-modify behaviour is functionally similar. | Read claims 1–3; confirm the ML element is required. **YELLOW (review)** |
| | US 12,109,454 B2 "Determining a user's current exercise capability" | Fitbod; granted 2024-10-08 | Partition history into periods, aggregate capability per period, derive current capability, recommend | NGF computes e1RM trends per lift from history (`adaptive-training.ts`, `src/lib/domain/strength.ts`) | Read claim 1 |
| | US 12,347,542 B2 "Predicting exercises based on user-selected variance" | Fitbod; granted 2025-07-01 | ML ranking + user-selected variance | Not present | Low |
| | Peloton "Real-time modification of workouts…" (pub. 2026-08-27, pending) | Peloton | Live class segment changes | Not present (no live classes) | Low |
| Readiness / strain | **US 10,842,429 B2** "…readiness score of a user" | Oura; granted 2020-11-24; litigated (Samsung, Ultrahuman, Circular); IPR instituted | Movement → rest vs activity periods → biosignals during rest → rest + activity summaries → body-response summary → readiness from current vs previous summaries | NGF readiness = four self-reported answers (`src/lib/domain/readiness.ts:9-14`); no biosignal segmentation. Overnight HR/HRV shown only as the device's figures and compared only with the member's own nights, never turned into a score (`src/server/coach/sleep-summary.ts:62`) | Low as implemented; **do not** add an HRV-derived readiness without review |
| | WHOOP US 11,602,279; 11,627,946; 12,220,112; **12,318,226** (sleep need) — asserted in *WHOOP v. Finerpoint* (D. Del. 2026) | WHOOP; granted | '279: strain from weighted heart-rate-reserve; '226: sleep need from strain-based and sleep-based debt metrics | NGF's sleep debt is a rolling shortfall vs goal from entries only (`src/lib/domain/sleep-debt.ts`); no strain, no HR | Low as implemented; aimed at AI-coach apps that compute strain/recovery from HR |
| | Firstbeat (Garmin) US 7,192,401 / 7,330,752 / 7,460,901 | likely at/near expiry | HRV-based stress/recovery indices | Not present | Verify expiry only if HRV scoring is added |
| Food scoring | **US 11,803,781 B2** "Machine learning for nutrient quantity estimation in score-based diets" | WW International; active | ≥ 1,000 decision trees predict a nutrient, then compute the diet score | NGF never estimates missing nutrients: "never computed from missing data" (`src/lib/food-iq.ts:7-8`, `:150+` insufficient status) | Low |
| | US 12,106,841 B2 single dietary intake score (quantity + quality) | Nestlé; granted 2024-10-01 | Single score over *consumed* items vs optimal | NGF rates products per 100 g, not intake | Pull claims; low |
| | Yuka / Fooducate / MyFitnessPal | no US patents located | — | Crowded field; prior art US 2008/0091705, WO2007137110, US 2013/0108993 | — |
| Body composition | **US 11,232,629 B1 / 11,580,693 B1** "Two-dimensional image collection for three-dimensional body composition modeling" (+ 11,836,853; 12,165,271) | assignee not confirmed (consistent with Amazon Halo); granted | App-guided capture of 2D body images from several directions → 3D model / composition outputs | NGF Body Scan guides front/side/back photos with an outline, a 10 s timer, tilt warning and a faint overlay of the last scan (`src/components/body-scan/scan-capture.tsx:144`, `:211+`; `src/lib/domain/body-scan.ts:19-51`, `:92-97`) but builds **no 3D model and no composition estimate** ("Body Scan does not estimate body fat": `src/components/body-scan/consent-card.tsx:15`) | **Read claim 1** of both: if the guided multi-angle capture alone is claimed, this is the closest item in the list. YELLOW (review) |
| | US 11,759,151 B2 body-fat from a 2D image | Univ. of Alabama; granted 2023 | Image segmentation → body-fat estimate | Not present | Only if body-fat estimation is ever added |
| | US 10,321,728 B1 (Bodygram) | granted | Deep-learning body measurements from photos | Not present (measurements are typed in) | Low |
| Progress photos | US 11,116,442; US 11,509,819; US 2014/0316712; US 2014/0289312; US 10,158,806 | various | Overlay of a prior image / pose-guided auto-capture / countdown prompts | NGF shows the previous photo faintly and a countdown; no auto-capture on alignment | Check '442 and '819 if auto-capture is added; feature is ubiquitous (dense prior art) |
| GPS tracks | Strava US 9,116,922; 9,297,651; 9,778,053; 10,240,939 | Strava; granted; asserted v. Garmin 2025 (dismissed) | Segments, virtual start lines, heat/preference maps | Not present | Low unless segments/popular routes are added |
| | Nike US 10,842,219 ("smart top routes"), US 2011/0032105; Under Armour US 10,331,707 | granted / published | Route suggestion; race identification; multi-sensor distance | Not present; no patent found claiming accuracy filtering or Kalman smoothing | Low |
| Sleep score | **US 10,111,615 B2 / 10,555,698 / 10,980,471 / 11,864,723 B2** "Sleep scoring based on physiological information" | Fitbit (Google); active | Physiological data incl. **sleeping heart rate** and movement; metrics vs the user's wakeful resting HR; unified score | NGF score uses duration, efficiency, timing and wake-ups only (`sleep-score.ts:47`); heart-rate data never enters the score | Low as implemented; **do not** add HR to the score without review |
| | Bose US 10,517,527 B2; Fitbit US 11,478,186 | granted | Score from latency/wake events/REM/deep; clustered sleep profiles | NGF uses stage shares for display only, not in the score (`src/lib/domain/sleep-analytics.ts`) | Low |

**Not searched (out of scope here):** barcode-scanning hardware patents, LLM/agent patents, payment patents.

---

## Limitations (repeat)

1. No full claim set was retrieved for any patent; every element list is a paraphrase or a snippet fragment.
2. Patents 1 and 2 are not indexed anywhere reachable; their descriptions rest on the brief and on company press releases.
3. TomTom '059 maintenance-fee status and the exact second-data-source wording of its claims are unresolved.
4. Apple '790 claim text was not available at all.
5. Oura '078 prosecution events were not retrievable; "pending" is inferred.
6. Statuses in Part 2 are from third-party snippets.
7. A missing element in a paraphrased chart is **not** a non-infringement conclusion; doctrine-of-equivalents and claim-construction questions are for counsel.
