# Final patent review: research draft for patent counsel

**Narrow Gate Fitness** · prepared 2026-10-26 · code reviewed at branch `claude/free-pro-membership`, commit `9915f22` · US focus.

> **What this document is.** Technical research put together for qualified patent counsel. It is **not** a freedom-to-operate opinion. It makes no finding of non-infringement or invalidity and gives no legal clearance. "Present / absent / unclear" compares the app's code with the best claim information that could be obtained. It is not claim construction. Design-around ideas are **engineering ideas for counsel to evaluate**. None of them removes a feature.

## How the records were checked, and the limits

- **Direct access was blocked.** From this sandbox, every direct request to patents.google.com, image-ppubs.uspto.gov, ppubs.uspto.gov, Patent Center, Espacenet, Justia, the PTAB and PatentsView failed (DNS failure or proxy 403). Only `patentimages.storage.googleapis.com` answered, and it needs per-document hashed paths that could not be found.
- **Records came through a search engine.** Every patent fact below was taken from those official pages (Google Patents, USPTO full-text PDFs, Justia, the PTAB) by a web-search tool that reads the page and returns extracts. Each source URL is listed in §6, all accessed **2026-10-26**.
- **No complete, verbatim independent claim was obtained for any patent.** The tool returned the front matter, abstracts, descriptions and some dependent claims, not the claims sections. Claim text appears in four forms below:
  - **"Verbatim"** marks a fragment the tool quoted directly.
  - **"Claim (extract)"** marks the tool's summary of claim text it read.
  - **"Abstract/description"** marks what it is.
  - Everything else is marked **not verified**.
- **Before anything here is relied on**, counsel should pull each claim set from the USPTO PDF links in §6.
- **Statuses** come from Google Patents' "Active" labels, which Google itself calls an assumption. Fee and assignment records were **not verified** for any patent.

## 1. Summary

| ID | Title (as found) | Owner (as listed) | Status found | Closest app feature | Risk note |
|---|---|---|---|---|---|
| US 2026/0196331 A1 | **Did not resolve** | not verified | not verified | Barcode scan + "Fits your goals" | Needs counsel (cannot be assessed) |
| US 2026/0204388 A1 | **Did not resolve**; press releases describe a related IndulgeRx filing | not verified | not verified | Nutrition Score (off by default) and AI product explanation | Needs counsel (cannot be assessed) |
| US 9,891,059 B2 | Route smoothing | TomTom Global Content BV (original) | Granted 2018-02-13; Google: Active; fees not verified | GPS track smoothing | Low |
| US 12,163,790 B2 | Route smoothing with map matched positioning coordinates | Apple Inc. (original) | Granted; Google: Active | GPS track smoothing and route drawing | Low |
| US 2024/0350078 A1 | **Did not resolve** (related family verified: US 11,478,187 B2, US 11,986,313 B2) | Oura Health Oy (family) | Family granted, Active | Sleep schedule / bed window | Low (family); number needs counsel |
| US 12,614,640 B2 | Method and system for supplemental sleep detection | Oura Health Oy | Granted (2026-04-28 per Justia, not matched to the number) | Naps, nightly sleep score | Low |
| US 12,551,760 B2 | Workout modification based on muscle strength measurement trends | Fitbod, Inc. | Granted 2026-02-17 (Google citation table) | Adaptive training review: plateau → reset | **Needs counsel** |
| US 12,109,454 B2 | Determining a user's current exercise capability | Fitbod, Inc. | Granted (date conflict: 2024-10-08 Google / 2025-07-01 Justia extract) | e1RM trends per lift | Low–moderate |
| US 12,347,542 B2 | Predicting exercises based on user-selected variance | Fitbod, Inc. | Granted 2025-07-01 | Program generator exercise choice | Low |
| US 10,842,429 B2 | Method and system for assessing a readiness score of a user | Oura Health Oy | Active; adjusted expiry 2036-11-21 (Google); litigated | Readiness check-in; overnight HR shown | Low (moderate if HR/HRV enters a score) |
| US 11,232,629 B1 | Two-dimensional image collection for three-dimensional body composition modeling | Amazon Technologies, Inc. (Google citation table) | Granted (pub. 2022-01-25) | Body Scan guided capture | **Needs counsel** |
| US 11,580,693 B1 | Same title (continuation of 16/557,830) | not verified (presumably Amazon) | Granted (pub. 2023-02-14) | Body Scan guided capture | **Needs counsel** |
| *Landscape:* US 11,602,279; US 12,318,226 B2 | Strain (weighted heart-rate reserve); Determining sleep need from physiological measurements | Whoop, Inc. | Granted; asserted against an app-only product (D. Del. 2026) | Sleep debt | Low–moderate |
| *Landscape:* US 10,111,615 B2 / 10,555,698 B2 | Sleep scoring based on physiological information | Fitbit LLC (Google) | Google: Active | Nightly sleep score | Low |
| *Landscape:* US 12,555,666 B2 | Machine learning-based exercise recommendation adjustment based on user feedback | not verified (shares description with '760) | Granted | Accept/decline of recommendations | Low–moderate |
| *Landscape:* US 11,903,730 B1 | Body fat measurements from a two-dimensional image | Amazon Technologies, Inc. | Google: Active | Body Scan (no body-fat estimate) | Low |
| *Landscape:* US 7,974,881; US 8,626,796 B2 | Nutrition rating algorithm; star-rating food database | Guiding Stars (per company); not verified | Not verified (2011 grant may be near expiry) | Nutrition Score | Low |

### Unresolved items for patent counsel

- **Blocks internal TestFlight:** no item does. Internal testing is not a sale or offer for sale. Counsel should confirm this.
- **Blocks public paid launch:** a "y" means "should be read by counsel before public paid launch". It is not a call to remove or disable a feature.

| # | Item | Severity | Evidence | User impact | Recommended next step | Blocks internal TestFlight | Blocks public paid launch | Needs owner approval | Needs specialist review |
|---|---|---|---|---|---|---|---|---|---|
| U1 | No verbatim independent claims obtained for any of the 12 identifiers | High (process gap) | §Method; direct access blocked | None directly; every chart below is provisional | Counsel pulls the USPTO PDFs (§6) and re-runs U2, U3, U6 first | n | y | y (budget for counsel) | y – patent counsel |
| U2 | Fitbod '760 (and '666, '454): plateau/decline detection → workout modification | Needs counsel | Description: model "predicts a user's strength and modifies workouts when measured strength decreases or plateaus". App: rule-based plateau → 10% reset proposal (`analyzeTraining`) | Pro adaptive review and AI coach load proposals | Read '760 claim 1. Confirm whether a trained or population model is a required element, and whether an LLM given the app's deterministic plateau flag could read on it | n | y | y | y – patent counsel |
| U3 | Amazon '629 / '693: app-guided multi-direction 2D body photos | Needs counsel | Description: portable-device app "provide[s] instructions… and collect[s] 2D body images… from different body directions", sent to remote resources for a 3D model. App: guided front/side/back capture, uploaded to private storage, no model | Pro Body Scan | Read claim 1 of both. Confirm whether measurements, a 3D model or remote processing are required in every independent claim | n | y | y | y – patent counsel |
| U4 | US 2026/0196331 A1 and US 2026/0204388 A1 do not resolve | Moderate (unknown) | Number searches empty; IndulgeRx press release mentions filings of 2025-10-10, with no number | Barcode/nutrition features; Nutrition Score off by default | Counsel searches by number in Patent Center. If found, obtain the published claims and note that pending claims can change | n | n (pending applications; counsel to confirm provisional-rights exposure) | n | y – patent counsel |
| U5 | US 2024/0350078 A1 does not resolve | Low | No record found; family '187 and '313 verified | Sleep schedule | Confirm the number. Chart '187 and '313 claim 1 (bed window from score-vs-bedtime analysis) | n | n | n | y – patent counsel |
| U6 | Oura '429: litigation/IPR status conflicting; Oura enforces actively | Low | Google page: IPR2024-01080 "instituted"; a PTAB decision footnote says institution denied | Readiness check-in; HR/HRV display; sleep–readiness association | Check the PTAB docket. Read claim 1 against `sleepTrainingLinks` (the readiness-after-overnight-HR association) | n | n | n | y – patent counsel |
| U7 | WHOOP enforces against an app-only product (Bevel, D. Del. 1:26-cv-00289) | Low–moderate | Docket lists 11,602,279; 11,627,946; 12,220,112; 12,318,226 | Sleep debt; future strain/recovery ideas | Read '226 claim 1 (strain-based + accumulated sleep debt) against `sleepDebt`. A newer grant (12,765,843) was reported by a news aggregator and is not verified | n | n | n | y – patent counsel |
| U8 | TomTom '059 maintenance fees (7.5-year window 2025-08) not verified | Low | Google "Active" is an assumption | GPS runs | Check Patent Center fees for app. 14/344,640 | n | n | n | n |
| U9 | Meal-photo calorie estimation: no family could be opened | Moderate (search gap) | Only leads were found: US 9,349,297 B1 and US 2016/0063692 A1, with status and claims not verified | Pro Meal photo | Run a targeted search (CPC G06V20/68, G16H20/60) and pull claims of active families | n | n | n | y – patent searcher |
| U10 | Packaged-food scoring patents: status not verified | Low | Guiding Stars US 7,974,881 (2011 grant, per company page), US 8,626,796 B2 | Nutrition Score (off by default; "Experimental") | Confirm expiry/status before the score flag is turned on | n | n | y (turning the score on) | y – patent counsel |

## 2. The twelve identifiers

### 2.1 US 2026/0196331 A1: did not resolve
- **Searches tried:** number searches (`US20260196331A1`, `US 2026/0196331`, with feature words). They returned only unrelated composition patents.
- **Unknown:** title, owner, status and claims. The earlier audit's label ("personalized ingredient analysis", Ingredient IQ LLC) came from a brief, not from a record.
- **Code (for counsel):**
  - **Barcode lookup:** Open Food Facts (`src/lib/food-quality.ts`).
  - **Goal comparison:** "Fits your goals" compares a product with the member's calorie/macro targets, diet style and chosen allergen filters (`fitsYourGoals`, `src/lib/food-iq.ts`).
  - **No medical profile:** there are no health-condition or medication fields. The coach's memory actively filters such terms (`SENSITIVE`, `src/lib/coach/memory.ts`).
  - **No verdict:** the app gives no go/no-go verdict.
  - **Constrained AI:** the optional AI explanation may only repeat the app's evidence lines (`PRODUCT_EXPLAIN_INSTRUCTIONS`, `src/lib/food-quality-ai.ts`).
- **Risk:** needs counsel, because it cannot be assessed.

### 2.2 US 2026/0204388 A1: did not resolve
- **Number searches:** returned nothing.
- **Related press release:** IndulgeRx Brands (natlawreview / einpresswire) describes three US non-provisionals filed 2025-10-10, including "System and Method for Artificial Intelligence Analyzation and Scoring of Consumables". It gives **no publication number**, so the link to this identifier is **not verified**.
- **Concept (press-release paraphrase):** consumables scored "using novel AI-enabled, AI-driven dynamically applied algorithms" drawing on clinical research and a person's lifestyle or therapeutic needs.
- **Code:**
  - **Fixed formula:** the Nutrition Score is a published fixed formula, `50 + 2.5P − 1.5N` (drinks `80 + 2.5P − 2N`), applied per 100 g (`scoreFoodIq`, `src/lib/food-iq.ts`; `docs/FOOD_IQ_METHOD.md`).
  - **Same for every user:** it is not personalized.
  - **Off by default:** it is shown only when `FOOD_IQ_SCORE=on` (`foodIqScoreEnabled`; `.env.example` sets `off`).
  - **AI does not score:** the AI explanation receives the score and never computes it.
- **Risk:** needs counsel, because it cannot be assessed. The elements most likely to matter are an AI-generated score and personalization to health or therapeutic needs. On current code both appear **absent**.

### 2.3 US 9,891,059 B2: Route smoothing (TomTom)
- **Record:**
  - **Identity:** exists. Application 14/344,640; pre-grant publication US 2014/0350850 A1; granted 2018-02-13.
  - **Inventors:** Kmiecik, Gliszczynski.
  - **Original assignee:** TomTom Global Content BV.
  - **Family:** CN 103975223 B and JP 6363504 B2 are shown; a 2011 European priority is listed, but the country was not verified.
  - **Status:** Google shows "Active". The expected expiry and maintenance fees are **not verified** (see U8).
- **Independent claims (extract):** a system claim and a computer-readable-medium claim. Both:
  - receive a user's position data along a route;
  - obtain **historical route data and/or digital map data**;
  - apply **a spline algorithm** to the position data to obtain an estimated route;
  - **refine** that estimate using the additional data;
  - provide the result for display.
  - Verbatim fragment from the family: "applying a cubic spline smoothing algorithm to the position data". Some embodiments use motion or accuracy data instead.

| Limitation (extract) | App | Evidence | Status |
|---|---|---|---|
| Receive position data at multiple times | GPS fixes with accuracy and time | `addFix`, `src/lib/domain/gps-track.ts` | present |
| Historical route data and/or digital map data obtained | None. Each recording stands alone and no map data is loaded | `gps-track.ts` takes fixes only. `route-map.tsx` draws "from its own GPS points (no map tiles…)" | absent |
| Spline applied to the positions | Constant-velocity Kalman filter per axis, then Douglas–Peucker point removal. "spline" appears only in exercise-animation easing (`src/lib/exercise-motion/`) | `predict`/`update`, `simplify`, `routeForSave` | absent |
| Refine the estimate with the additional data | No second data source | — | absent |
| Provide for display | SVG route shape and splits | `RouteMap`, `newSplits` | present |

- **Risk:** low. The spline element and the map/historical-data element are both absent.
- **Design-around ideas (engineering):** keep the filtering Kalman- or accuracy-weighted; keep the route drawn from its own points; do not add map-snapping or history-based correction without review.

### 2.4 US 12,163,790 B2: Route smoothing with map matched positioning coordinates (Apple)
- **Record:**
  - **Identity:** exists. Application 17/739,074; provisional 63/197,234, filed 2021-06-04.
  - **Inventors:** Pesyna, Selle, Godha, Miller.
  - **Original assignee:** Apple Inc.
  - **Status:** Google shows "Active".
  - **Not obtained:** the claims. Expiry and foreign family were not verified.
- **Abstract/description:** estimate a traversed path from receiver positions; identify **previously mapped features** near the path; **match the path to the map** to produce a map-matched path; render it on a map display. The context is fitness tracking.

| Limitation (abstract) | App | Evidence | Status |
|---|---|---|---|
| Positions obtained during a movement event | yes | `addFix` | present |
| Path estimated from positions | Kalman-filtered points | `gps-track.ts` | present |
| Identify previously mapped features | No map data, map SDK or tiles anywhere | `route-map.tsx:38`; `package.json` has no map library | absent |
| Map-match the path | none | — | absent |
| Display on a map image | The route is drawn alone on an SVG with no base map | `RouteMap` | absent |

- **Risk:** low.
- **Design-around ideas (engineering):** keep the base-map-free SVG, or if a base map is added later, keep it display-only with no snapping of points to map features.

### 2.5 US 2024/0350078 A1: did not resolve (Oura sleep-pattern family checked instead)
- **The number:** returned no record in two number searches. Treat the earlier audit's filing and publication dates as **not verified**.
- **US 11,478,187 B2** (application 16/767,440):
  - **Title:** "Method and system for monitoring and improving sleep pattern of user".
  - **Owner and status:** Oura Health Oy; Google "Active".
- **US 11,986,313 B2:** same title. The USPTO PDF states it is a continuation of 16/767,440. A third-party listing gives expiry 2038-11-21 (not verified).
- **Family concept (description/summary, near-verbatim):** "analysing the sleep scores and associated go-to-bed time and/or time of falling asleep of the user to determine an optimum bedtime window". Description example: a 60-minute default window.
- **Code:**
  - **Bed window:** `sleepWindows` (`src/lib/domain/sleep-schedule.ts`) builds the window from the member's anchor wake time, sleep goal, latency and settle time. It never correlates scores with bedtimes (no reference to `nightlyScore`).
  - **Circadian claim:** the module header says "nothing here measures circadian phase".
  - **Status:** score-vs-bedtime analysis is **absent**; a window and guidance are **present**.
- **Risk:** low for the family. The number itself needs counsel (U5).
- **Design-around ideas (engineering):** keep the bed window derived from the wake anchor and the goal, not from which bedtimes produced better scores.

### 2.6 US 12,614,640 B2: Method and system for supplemental sleep detection (Oura)
- **Record:**
  - **Identity:** exists. The USPTO PDF is titled "Method and system for supplemental sleep detection"; owner Oura Health Oy.
  - **Dates:** a Justia listing shows filing 2024-10-31 and grant 2026-04-28. The tool did not confirm that the listing matches this number.
  - **Parent:** US 12,165,771 B2.
- **Claim 1:** not obtained.
- **Dependent claims (verbatim):**
  - "The system of claim 1, wherein the determined cut-off time of day is based at least in part on a time of day that the user typically begins a primary sleep period each calendar day."
  - "The system of claim 1, wherein the sleep day aligns with a calendar day such that determined cut-off time of day is midnight."
- **What these show:** claim 1 recites a *determined cut-off time of day*, and the midnight dependent claim suggests claim 1 also covers a simple calendar-day cut-off.
- **Parent '771:**
  - **Abstract:** "receive data… from a wearable device… detect a primary sleep period… detect a supplemental sleep period including a duration that exceeds a threshold duration".
  - **Dependent claims (extract):** the GUI shows the supplemental period and receives user confirmation; Sleep and Readiness Scores are updated.

| Limitation (extract) | App | Evidence | Status |
|---|---|---|---|
| Data received from a wearable | Finished sleep records imported from Apple Health / Health Connect (no raw sensor streams) | `samplesToSessions`, `src/lib/domain/sleep-import.ts`; `@capgo/capacitor-health` | unclear (claim construction: imported records vs "data from a wearable") |
| Detect a primary sleep period | Platform samples ≤30 min apart are grouped into a session; no physiological detection | `samplesToSessions` | unclear |
| Detect a supplemental period over a threshold | No detection. Naps exist only when the member logs `kind: "nap"`; every import is stored as `kind: "night"` | `src/server/actions/sleep-import.ts` (insert `kind: "night"`) | absent |
| Determined cut-off time of day / sleep day | `nightOf` assigns a session to the local date of its end time | `nightOf`, `src/lib/domain/sleep.ts` | unclear (calendar grouping exists; the midnight dependent claim makes this worth counsel's look) |
| Generate/update scores because of the supplemental period | The nightly score takes one night; naps are excluded and never trigger recalculation | `nightlyScore` (`sleep-score.ts`); "Finished nights (not naps)" (`sleep.ts`) | absent |
| Display and user confirmation of the supplemental period | No confirmation step | — | absent |

- **Risk:** low. The detection, score-update and confirmation elements are absent.
- **Design-around ideas (engineering):** keep naps out of the nightly score, or if they are ever added, count only naps the member enters (no automatic detection) and keep a separate nap figure instead of revising the night's score.

### 2.7 US 12,551,760 B2: Workout modification based on muscle strength measurement trends (Fitbod)
- **Record:**
  - **Identity:** exists. A Google Patents citation table shows "US12551760B2 | 2023-03-09 | 2026-02-17 | Fitbod, Inc.".
  - **Conflict:** a Justia listing gave different inventors and a 2026-03-10 date, and its page mixed in unrelated text. Treat it as unreliable.
- **Claims:** not obtained.
- **Description:**
  - "a machine-learned model that predicts a user's strength and modifies workouts when measured strength decreases or plateaus";
  - stored user requests to perform exercises more or less often.

| Limitation (description-based; claims may differ) | App | Evidence | Status |
|---|---|---|---|
| Strength measurements from the user's workout history | Best estimated 1RM per session, Epley `w × (1 + reps/30)`, reps ≤ 12 | `estimateOneRepMax` (`src/lib/domain/strength.ts`); `bestE1rm`, `analyzeTraining` (`adaptive-training.ts`) | present |
| Machine-learned model (trained on population data) predicting strength | None in the review. A fixed formula on the member's own logs; no population data | `adaptive-training.ts` header ("Only what was logged counts") | absent, though see the LLM note |
| Detect a decrease/plateau over an interval against a threshold | `plateau = points ≥ 4 && span ≥ 21 days && sessionsSinceBest ≥ 3` | `analyzeTraining` (lifts block) | present (functionally similar) |
| Modify the workout for that exercise/muscle | Proposes a reset to 90% of the top load. A recovery week is proposed after ≥4 weeks plus signals. **Nothing changes until the member accepts** | `analyzeTraining` (recommendations 2–3); `TrainingChange`; coach tools `propose_target_load` / `propose_deload_week` (`src/lib/coach/tools.ts`) | present as a proposal; unclear whether "modify" requires automatic change |

- **LLM note for counsel:**
  - The Pro AI coach (Claude Haiku/Sonnet via `src/lib/coach/routing.ts`, `src/server/services/ai-coach.ts`) reads this review through the `get_training_review` tool and can issue load or deload proposals.
  - The LLM is a general model; it is not trained on exercise histories, and it never computes the strength figures (`describeReviewForCoach`).
  - Whether that could satisfy a "machine-learned model" element is a claim-construction question.
- **Risk:** **needs counsel.** This is the closest functional overlap in the set (plateau detection → workout modification).
- **Design-around ideas (engineering):**
  1. Keep strength trends as a documented deterministic formula on the member's own data, with no trained predictor and no population data.
  2. Keep member acceptance as the only path to a change.
  3. Keep the LLM explanation-only for strength figures; it may relay deterministic flags but never estimate or predict strength itself.
  4. If needed, express a stall as "no new best in N sessions" (current) rather than "actual below predicted".

### 2.8 US 12,109,454 B2: Determining a user's current exercise capability (Fitbod)
- **Record:**
  - **Identity:** exists. Fitbod, Inc.; filed 2021-04-16.
  - **Grant date:** conflicting. Google shows 2024-10-08; a Justia extract showed 2025-07-01, likely confused with '542.
  - **Continuation:** US 2024/0424346 A1 (filed 2024-09-09, pending).
- **Abstract (extract):** "partitions the exercise history into a plurality of time periods, and, for each time period, computes an aggregate capability… calculates a moving average capability… and determines a current capability", optionally discounted by recency. Claims not obtained.

| Limitation (abstract) | App | Evidence | Status |
|---|---|---|---|
| Exercise history for an exercise | yes | `analyzeTraining` series | present |
| Partition into time periods, with aggregate capability per period | Per-session best e1RM. No period buckets | `analyzeTraining` | absent |
| Moving average across periods | None; first/last/best only | `lifts[]` fields | absent |
| Recency discount → current capability | None | — | absent |
| Use for recommendations | Load-progress and plateau proposals | `analyzeTraining` | present |

- **Risk:** low–moderate, pending claim 1.
- **Design-around ideas (engineering):** keep per-session values and simple first/last/best comparisons, with no period aggregation or recency-weighted moving average.

### 2.9 US 12,347,542 B2: Predicting exercises based on user-selected variance (Fitbod)
- **Record:** exists. Fitbod, Inc.; filed 2021-04-16; granted 2025-07-01. Inventors Chen, Venticinque.
- **Claim (extract, a computer-readable-medium claim):** user profile; a **variance level selected with a mobile GUI slider**; a **ranking model trained on population exercise histories**; random selection of recently performed exercises whose rankings are adjusted; a weight-recommendation model.
- **Code:**
  - **Ranking:** `candidateScore` and `recommendPrograms` (`src/lib/domain/program-generator.ts`) rank exercises and programs with fixed, explained points (goal, equipment, difficulty, usage penalty) and a deterministic tie-break.
  - **Absent elements:** no trained model, no variance slider and no randomness.
  - **Custom builder:** "Pure and deterministic — the same input always produces the same program" (`custom-programs.ts`).
  - **Status:** slider, trained ranking model and randomization are all **absent**.
- **Risk:** low.
- **Design-around ideas (engineering):** keep any future "more variety" control as a deterministic rotation rule rather than a variance input to a trained ranker.

### 2.10 US 10,842,429 B2: Method and system for assessing a readiness score of a user (Oura)
- **Record:**
  - **Identity:** exists. Oura Health Oy.
  - **Status:** Google "Active", adjusted expiry 2036-11-21.
  - **Family:** WO 2016/135382 A1 and US 2018/0042540 A1.
- **Litigation:**
  - **Samsung case:** asserted in *Samsung v. Oura*, N.D. Cal. 3:24-cv-03245 (reported dismissed).
  - **IPR2024-01080 (Samsung, filed 2024-06-28):** status is **conflicting / not verified**. The Google page says instituted; a PTAB decision footnote says institution was denied.
- **Claim 1 (extract):**
  - determine rest and activity periods;
  - form a rest summary from biosignals and an **activity summary**;
  - determine a **body response summary** from both;
  - calculate the **readiness score from that summary and a previous one**.

| Limitation (extract) | App | Evidence | Status |
|---|---|---|---|
| Biosignals measured during rest and activity periods | No sensing. Overnight HR/HRV/respiration are imported as the device's figures | `summarizeVitals` (`sleep-import.ts`) | absent (import only) |
| Activity summary / body response summary | none | — | absent |
| Readiness computed from the summary vs a previous summary | Readiness comes from four self-reported 1–5 answers | `readinessScore` (`src/lib/domain/readiness.ts`) | absent |
| (Adjacent) HR used with readiness | Text compares self-reported readiness after nights with device HR ≥4 bpm above the member's 14-day average vs other nights. Descriptive only; it produces no score. HR/HRV 7- and 14-day averages are passed to the coach as context, with the rule "never call any of them a recovery score" | `sleepTrainingLinks` (`readiness_after_overnight_hr`, `src/lib/domain/sleep-training.ts`); `analyzeTraining` `recorded`; `src/server/coach/sleep-summary.ts` | unclear (closest adjacent feature) |

- **Risk:** low as implemented. It would become moderate if HR or HRV ever feeds a computed readiness or recovery number.
- **Design-around ideas (engineering):** keep readiness self-reported; keep device vitals display-only and in descriptive associations; never combine rest and activity physiology into a score.

### 2.11 US 11,232,629 B1 and 2.12 US 11,580,693 B1: Two-dimensional image collection for three-dimensional body composition modeling
- **US 11,232,629 B1:**
  - **Identity:** exists. Google citation table: assignee **Amazon Technologies, Inc.**; priority 2019-08-30; published 2022-01-25.
- **US 11,580,693 B1:**
  - **Identity:** exists. Same title; published 2023-02-14.
  - **Continuity:** the USPTO PDF says "Continuation of U.S. patent application Ser. No. 16/557,830, filed Aug. 30, 2019".
  - **Assignee:** not confirmed by the tool.
- **Related Amazon family members:** US 12,165,271 ("Three-dimensional body model from a two-dimensional body image") and US 11,836,853.
- **Claims:** not obtained for either. Do not use the claim 1 text that circulates for US 2023/0096013 A1; it belongs to a different publication.
- **Description:** an application on a portable device with a 2D camera "may provide instructions to a user and collect 2D body images of a body of the user from different body directions". The images are sent to remote resources to determine body measurements and generate a dimensionally accurate 3D body model.

| Limitation (description-based) | App | Evidence | Status |
|---|---|---|---|
| App on a portable device with a 2D camera | Phone camera (`getUserMedia`) or upload | `src/components/body-scan/scan-capture.tsx` | present |
| Instructions guiding capture | Guidance screens, head-to-feet outline, 10 s timer, tilt indicator, faint overlay of the previous scan | `SCAN_GUIDANCE`, `SCAN_POSE_TIPS`, `tiltFromUpright` (`src/lib/domain/body-scan.ts`); overlay `opacity-30` in `scan-capture.tsx` | present |
| Images from different body directions | Front and side required, rear optional | `SCAN_POSES`, `REQUIRED_POSES` | present |
| Send to remote resources | Uploaded to the private Supabase bucket for storage and comparison only | `docs/BODY_SCAN.md` (Saving) | unclear (upload exists; no processing) |
| Determine measurements / body composition from the images | None. Measurements are typed in. "Body Scan does **not** estimate body fat" | `compareScans`; `docs/BODY_SCAN.md` | absent |
| Generate/present a 3D body model | none | — | absent |

- **Risk:** **needs counsel.** If an independent claim covers guided multi-direction capture plus transmission without requiring measurement or model generation, Body Scan is the closest match in the set.
- **Design-around ideas (engineering):**
  1. Keep the images free of any server-side analysis.
  2. Consider making the outline and timer optional aids rather than a required sequence.
  3. Keep comparisons to member-entered numbers and side-by-side viewing.
  4. If a body-composition vendor is ever added (see `docs/BODY_SCAN.md`), review it first.

## 3. Other active families found (landscape)

Each family below was read only through search-engine extracts of its official page; claims are summaries unless marked verbatim. Families for which only a title surfaced are listed as leads at the end.

| Family | Owner / status | Closest claim information | App mapping | Risk note |
|---|---|---|---|---|
| **US 11,602,279** (strain); **US 12,318,226 B2** "Determining sleep need from physiological measurements" (appl. 18/634,281; filed 2024-04-12; granted 2025-06-03) | Whoop, Inc.; both asserted in *Whoop v. Finerpoint (Bevel app)*, D. Del. 1:26-cv-00289, filed 2026-03-17, with 11,627,946 and 12,220,112 | '279 claim 1 (verbatim, from the complaint): "using a weighted sum of heart rate reserve data". '226 abstract: "a first sleep debt metric based on user strain and a second sleep debt metric based on accumulated sleep debt" → sleep needed next period | Sleep debt is a rolling 14-night shortfall vs goal from logged durations, with no strain and no HR (`sleepDebt`, `src/lib/domain/sleep-debt.ts`). No strain score exists. Strain-based debt: **absent**. Accumulated debt: **present** (generic) | Low–moderate. Notable because WHOOP enforces against a software-only app. Idea: keep debt duration-only; no HR-reserve load metric |
| **US 10,111,615 B2 / US 10,555,698 B2** "Sleep scoring based on physiological information" (priority 2017-03-11; CN 108852283 B) | Fitbit LLC (Google); Google "Active" | Title and keywords centre on physiological data incl. heart rate; claims not obtained | Score = duration 50 / efficiency 20 / timing 20 / wake-ups 10; HR never enters (`nightlyScore`, `sleep-score.ts`) | Low. Idea: keep vitals out of the score |
| **US 12,555,666 B2** "Machine learning-based exercise recommendation adjustment based on user feedback" | Assignee not verified (shares description with Fitbod '760) | Description: a machine-learned model ranks exercises from history, equipment, goals and **feedback**; claims not obtained | Accepted or declined recommendations are only hidden or listed (`decided`/`rejected` sets in `analyzeTraining`); no model learns from them | Low–moderate (read with U2) |
| **US 11,903,730 B1** "Body fat measurements from a two-dimensional image" (filed 2019-09-25) | Amazon Technologies; Google "Active" | Description: phone 2D image(s) → neural network → body-fat value | No body-fat estimate (`docs/BODY_SCAN.md`) | Low (high relevance if body fat is ever added) |
| **US 11,759,151 B2** "Body composition assessment using two-dimensional digital image analysis" | Univ. of Alabama; status not verified | Claim (extract): combines a scale reading and impedance with a single camera image | Absent | Low |
| **US 7,974,881** (nutrition rating algorithm) and **US 8,626,796 B2** (star-rating food database, UPC-keyed) | Guiding Stars (per company release); status not verified | '881 (company description): credits vitamins, minerals, fibre and whole grains; debits trans/saturated fat, cholesterol, added sugars and sodium → 0–3 stars. '796: a "star rating function for designating a rating algorithm type" per product | Nutrition Score: N/P points per 100 g with EU/UK anchors (`scoreFoodIq`); bands, not stars; off by default | Low (likely near expiry; verify) |

**Leads not opened (not verified, for the counsel search in U9):**
- Meal-photo estimation: US 9,349,297 B1 "System and method for nutrition analysis using food image recognition" and US 2016/0063692 A1.
- Peloton LLM coaching filings: reported as pending.
- Strava segment patents and progress-photo overlay patents: numbers cited in the earlier audit (US 11,116,442 / 11,509,819) did not surface at all.
- **App facts for counsel:**
  - **Meal photo:** sends one downscaled photo to a general LLM (`FOOD_PHOTO_INSTRUCTIONS`, `foodPhotoOutputSchema`, `src/lib/domain/food-photo.ts`). It returns per-item portion, grams, calories and macros with a confidence level and clarifying questions. The member edits and confirms before anything is saved (`docs/FOOD_PHOTO.md`). There is no segmentation, pixel counting or volume model in the app.
  - **Progress photos:** side-by-side compare only (`comparePhotos`, `src/lib/domain/progress-photos.ts`).

## 4. Corrections to the earlier audit (B_PATENT_CLAIM_CHARTS.md)

1. **Route display:** the earlier audit said the route is drawn "on a map". The current code draws it as an SVG with **no map tiles** (`route-map.tsx:38`), which widens the difference from Apple '790.
2. **'429 IPR:** the earlier audit said "IPR instituted". The evidence conflicts (Google page vs a PTAB footnote saying institution was denied), so it is now marked **not verified**.
3. **Oura '078:** the earlier audit gave filing and publication dates. **The number did not resolve**, so those dates are unsupported. The family members '187 and '313 are verified.
4. **Amazon '629 assignee:** the earlier audit had it unconfirmed. Google's citation table now lists **Amazon Technologies, Inc.**
5. **Fitbod '454:** the grant date is contested (2024-10-08 Google vs a 2025-07-01 extract); 2024-10-08 is retained.
6. **Adjacent HR feature added:** `sleepTrainingLinks` compares self-reported readiness with device overnight HR. It is descriptive only and is charted under '429.
7. **Line numbers:** the earlier audit's line numbers (commit `c541d63`) no longer apply. This document cites functions.
8. **Unchanged:** "no full claim set obtained" still holds, now because the tools were blocked rather than for lack of search effort.

## 5. Recurring engineering principles (for counsel to evaluate)

These summarize the ideas above. Each keeps the feature and changes only *how* it is computed:
- **Deterministic and documented:** published formulas on the member's own data, not trained predictors.
- **Member confirmation:** the member confirms every change.
- **Separation:** device vitals are kept apart from computed scores.
- **No snapping:** no map-snapping or spline refinement of GPS.
- **No image analysis:** no image-derived measurements.
- **Logged naps only:** naps are entered by the member and never folded into the night's score.

Any change in these areas should get a short patent check first.

## 6. Sources (all accessed 2026-10-26 via search-engine extraction; direct fetch blocked)

**Direct access attempts that failed (2026-10-26):** patents.google.com, image-ppubs.uspto.gov, ppubs.uspto.gov, patentcenter.uspto.gov, worldwide.espacenet.com, patents.justia.com, ptacts.uspto.gov, s3.amazonaws.com/data.patentsview.org (403).

**Official and primary records:**
- **TomTom '059:**
  - https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9891059
  - https://patents.google.com/patent/US9891059B2/cg-RX-API-DMAC7.html
  - https://patents.google.com/patent/US20140350850A1/en
  - https://patents.google.com/patent/CN103975223B/en
  - https://patents.google.com/patent/JP6363504B2/cg-RX-API-DMAC7.html
  - https://patents.justia.com/inventor/marcin-michal-kmiecik
- **Apple '790:**
  - https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12163790
  - https://patents.google.com/patent/US12163790
  - https://patents.justia.com/patent/12163790
- **Oura sleep pattern ('187, '313):**
  - https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11478187
  - https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11986313
  - https://patents.google.com/patent/US11478187
  - https://patents.justia.com/inventor/hannu-kinnunen
  - https://uspto.report/patent/app/20200397367
  - https://mtec-sc.org/patents/US-11986313-B2 (third party)
- **Oura supplemental sleep ('640, '771):**
  - https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12614640
  - https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12165771
  - https://patents.google.com/patent/US12165771B2/en
  - https://patents.justia.com/assignee/oura-health-oy
- **Fitbod ('760, '666, '454, '542):**
  - https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12551760
  - https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12555666
  - https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12347542
  - https://patents.google.com/patent/US12109454
  - https://patents.google.com/patent/US20240424346A1/en
  - https://patents.justia.com/assignee/fitbod-inc
  - https://patents.justia.com/inventor/allen-chen
- **Oura '429:**
  - https://patents.google.com/patent/US10842429B2/en
  - https://patents.google.com/patent/WO2016135382A1/en
  - https://ptacts.uspto.gov/ptacts/public-informations/petitions/1556908/download-documents?artifactId=NG_2u6-1BrWAo_P2G5IA9mBAtVmvDn6LhqxtIZyLJhqrrCj7H6dTMTg
  - https://www.patsnap.com/resources/blog/litigation/samsung-v-oura-health-galaxy-ring-patent-infringement-dismissed-patsnap/
- **Amazon body images ('629, '693, '271, '853, '730):**
  - https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11232629
  - https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11580693
  - https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12165271
  - https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11836853
  - https://patents.google.com/patent/US11903730B1/en
  - https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11903730
- **Univ. of Alabama:** https://patents.google.com/patent/US11759151B2/en
- **WHOOP:**
  - https://dockets.justia.com/docket/delaware/dedce/1:2026cv00289/92454
  - https://ai-lab.exparte.com/case/dct/ded/1:26-cv-00289/doc/1
  - https://patents.google.com/patent/US20240252121A1/en
  - https://patents.justia.com/inventor/mostafa-ghannad-rezaie
  - https://www.whoop.com/us/en/patents/
- **Fitbit:**
  - https://patents.google.com/patent/CN108852283B/zh
  - https://patents.google.com/patent/US10555698
- **Food scoring:**
  - https://guidingstars.com/guiding-stars-news/guiding-stars-granted-patent-approval-for-nutrition-rating-algorithm/
  - https://patents.google.com/patent/US8626796
  - https://patents.google.com/patent/US20080091705A1/en
- **Meal-photo leads:**
  - https://patents.google.com/patent/US9349297B1/en
  - https://patents.google.com/patent/US20160063692A1/en
- **IndulgeRx (press, not a patent record):**
  - https://natlawreview.com/press-releases/three-patent-pending-ai-technologies-power-next-generation-nutrition
  - https://www.einpresswire.com/article/862710725/three-patent-pending-ai-technologies-power-next-generation-nutrition-intelligence
- **Secondary, context only:**
  - https://theclipout.com/peloton-ai-workout-patents-real-time-coaching/
  - https://the5krunner.com/2026/10/22/3-trademark-patent-filing-week-ending-22-october-2026/ (reported US 12,765,843; not verified)

**Searches that returned no record (2026-10-26):** "US20260196331A1"; "US 2026/0196331"; "US20260204388A1"; "2026/0204388"; "US20240350078A1"; "20240350078"; "11,116,442"; "11,509,819".

**Code reviewed (read-only):**
- **Coach:** `src/lib/coach/{routing,tools,prompt,memory}.ts`, `src/server/services/ai-coach.ts`, `src/server/coach/sleep-summary.ts`.
- **Training:** `src/lib/domain/{adaptive-training,readiness,sleep-training,strength,program-generator,custom-programs}.ts`.
- **GPS:** `src/lib/domain/{gps-track,run-session}.ts`, `src/components/run/route-map.tsx`.
- **Sleep:** `src/lib/domain/{sleep-score,sleep-schedule,sleep-debt,sleep-import,sleep}.ts`, `src/server/actions/sleep-import.ts`, `src/lib/native-health.ts`.
- **Nutrition:** `src/lib/{food-iq,food-quality-ai}.ts`, `src/lib/domain/food-photo.ts`.
- **Body and photos:** `src/lib/domain/{body-scan,progress-photos}.ts`, `src/components/body-scan/scan-capture.tsx`.
- **Docs:** `docs/{BODY_SCAN,FOOD_PHOTO}.md`, `.env.example`.
