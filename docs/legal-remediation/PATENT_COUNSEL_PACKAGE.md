# Patent counsel package: Narrow Gate Fitness

**Date:** 2026-11-16 · **Branch:** `claude/legal-remediation` · **For:** US patent counsel

**Limits.** Technical facts about the current code, prepared by a non-lawyer. It says nothing about whether any claim is or is not met, valid or enforceable.
**No claim text has been obtained for any patent below.** Numbers, titles and owners are copied from audit file 03, which took them from search-engine extracts; every status is unverified.

Source detail, element charts and URLs: `docs/legal-audit-2026-11-16/03_PATENT_REVIEW.md`. This package consolidates file 03 and re-checks its code references against this branch. The older charts in `docs/launch-audit/` describe earlier code and are out of date where file 03 §2.1 says so.

## 1. Sources

| Item | Position |
|---|---|
| Official patent sources | Google Patents, USPTO (image-ppubs, ppubs, Patent Center) and Espacenet were unreachable from this environment in every earlier attempt (file 03 §1). **Not retried for this package.** |
| Claims | **Independent claims NOT OBTAINED** for every row in this package. |
| Status, owner, dates | **UNVERIFIED** for every row. Owners are "as reported" in file 03. |
| USPTO PDF pattern for whoever pulls the claims | `https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/<number>` |
| Code references | Checked against this branch on 2026-11-16 by opening each cited line. |

## 2. Facts common to every feature

| Fact | Evidence |
|---|---|
| The phone apps are Capacitor shells that load the deployed website. App logic is TypeScript running either in the phone's web view or on the server | `capacitor.config.ts:9-12, 62-72` |
| The only AI is a third-party general language model (Anthropic) called over an API. The app trains no model, ships no model file and has no machine-learning library | `src/server/services/ai-coach.ts:102`; `src/lib/coach/routing.ts:15`; `package.json` |
| Coach tools that would change a member's data are proposals the member must confirm in the interface | `src/lib/coach/tools.ts:5-6, 129-139` |
| Nothing goes to the AI provider until the member gives the general AI consent | `src/server/services/ai-coach.ts:469-470` |
| **Apple Health / Health Connect data now reaches the AI provider only with a separate permission.** Rows whose source is `apple_health`, `health_connect` or `wearable` are withheld unless both the general AI consent and the separate "share health-platform data with the AI Coach" permission are on. The device name is never sent | `src/lib/domain/health-ai-sharing.ts:7-21`; permission set at `src/server/actions/profile.ts:152-157` |

## 3. Adaptive training and AI workout adjustments

### 3.1 What the code does

| Step | What happens | Runs on | File:line |
|---|---|---|---|
| 1 | Loads the member's own logged workouts (last 56 days), check-ins, program, targets and past decisions | Server | `src/server/services/adaptive-training.ts:37-56` |
| 2 | Per lift, per session: best estimated one-rep max and top weight from logged sets | Server | `src/lib/domain/adaptive-training.ts:280-290` |
| 3 | Plateau flag by fixed rule: 4+ sessions, a span of 21+ days, 3+ sessions since the best | Server | `src/lib/domain/adaptive-training.ts:311` |
| 4 | Effort drift: highest logged RPE minus prescribed RPE, averaged when there are 4+ exercise entries | Server | `src/lib/domain/adaptive-training.ts:323-329` |
| 5 | "Add load": the last two sessions in 21 days at the same top weight both met the rep target within the RPE limit; proposes one load step | Server | `src/lib/domain/adaptive-training.ts:362-394` |
| 6 | "Plateau": proposes a target at 90% of the last top weight | Server | `src/lib/domain/adaptive-training.ts:396-416` |
| 7 | "Recovery week": sets × 0.6 and RPE cap 7, when 4+ weeks since a lighter week plus a signal, or 8+ weeks | Server | `src/lib/domain/adaptive-training.ts:418-440` |
| 8 | Member accepts (optionally modified), rejects or restores each recommendation. Accept re-runs the analysis on the server before applying | Phone (tap), then server | `src/server/actions/adaptive-training.ts:30-53` (accept), `:55-70` (reject) |
| 9 | An accepted change is written to `exercise_targets` or the program tables and logged in `training_adjustments` with before-values; it can be undone | Server | `src/server/services/adaptive-training.ts:192-282, 291-309` |
| 10 | AI coach: reads the same rule-based review through a tool and can issue proposals (target load, recovery week, volume change, exercise swap, whole program) | Server, calling the third-party model | `src/server/coach/tools.ts:415-417`; `src/lib/coach/tools.ts:222, 256, 295-348` |
| 11 | Coach lift analysis: best estimated 1RM per rolling week; last 4 weeks vs the 4 before | Server | `src/lib/coach/lift-analysis.ts:173-205` |
| 12 | Coach load summary: last 7 days ÷ average week of last 28 days (sessions and hard sets); notes at ≥ 1.3 and ≤ 0.7 | Server | `src/lib/coach/recovery-summary.ts:62-101` |

### 3.2 Facts counsel will need

| Question | Answer from the code |
|---|---|
| Inputs | The member's logged sets (weight, reps, RPE), program prescription, self-reported check-ins, and logged sleep. No other member's data. |
| Where it runs | Server. |
| Fixed rule or model | Fixed rules and thresholds produce every recommendation. The third-party language model can relay, word and propose changes in chat; it is not trained by the app. |
| What triggers an adjustment | Only the member's acceptance (review screen) or confirmation (coach proposal). No automatic change was found. |
| Member approval | Required for every change. |
| What is stored | Accepted changes with prior values (`training_adjustments`); accept/reject decisions (`training_recommendation_decisions`). A rejection hides that recommendation; nothing learns from it. |
| Predicted strength, moving average, recency weighting | None found (file 03 §5.1–5.2). |

### 3.3 Patents previously identified (file 03 §3)

| Number | Title (as reported) | Owner (as reported) | Marking |
|---|---|---|---|
| US 12,551,760 B2 | Workout modification based on muscle strength measurement trends | Fitbod, Inc. | Independent claims NOT OBTAINED; status UNVERIFIED |
| US 12,555,666 B2 | Machine learning-based exercise recommendation adjustment based on user feedback | Not seen | Independent claims NOT OBTAINED; status UNVERIFIED |
| US 12,109,454 B2 | Determining a user's current exercise capability | Fitbod, Inc. | Independent claims NOT OBTAINED; status UNVERIFIED |
| US 12,551,757 B2 | Machine-learned exercise capability prediction model | Not seen (Fitbod family per extract) | Independent claims NOT OBTAINED; status UNVERIFIED |
| US 12,347,542 B2 | Predicting exercises based on user-selected variance | Fitbod, Inc. (prior report) | Independent claims NOT OBTAINED; status UNVERIFIED |
| US 2024/0424346 A1 | Determining a user's current exercise capability (continuation) | Fitbod family | Independent claims NOT OBTAINED; status UNVERIFIED |
| US 11,602,279; US 11,627,946; US 12,220,112 | WHOOP strain and related (listed on D. Del. 1:26-cv-00289) | Whoop, Inc. | Independent claims NOT OBTAINED; status UNVERIFIED |

## 4. Body Scan

### 4.1 What the code does

| Step | What happens | Runs on | File:line |
|---|---|---|---|
| 1 | Separate consent to store body photos (Pro) | Server record | `src/server/actions/body-scan.ts:16-21` |
| 2 | Fixed pose order: front and side required, rear optional; per-pose text tips; 10-second timer | Phone | `src/lib/domain/body-scan.ts:5-12, 20-51` |
| 3 | Camera preview; a device-orientation reading shows whether the phone is upright; a faint overlay of the previous scan | Phone | `src/components/body-scan/scan-capture.tsx:144, 235-237` |
| 4 | The member takes each photo (button or timer). The video frame is copied to a canvas as a JPEG, then resized to at most 1600 px | Phone | `src/components/body-scan/scan-capture.tsx:268, 280-286`; `src/lib/domain/body-scan.ts:11` |
| 5 | Upload to a private storage bucket; the server checks path ownership and consent | Phone, then server | `src/components/body-scan/scan-capture.tsx:82-90`; `src/server/actions/body-scan.ts:47-84` |
| 6 | The server stores paths and typed measurements and returns short-lived signed links | Server | `src/server/services/body-scan.ts:17-25` |
| 7 | Measurements (waist, chest, hips, arm, thigh, weight) are typed by the member; comparison is subtraction | Phone and server | `src/server/services/body-scan.ts:21` |

### 4.2 Facts counsel will need

| Question | Answer from the code |
|---|---|
| Image analysis | None found: no pose detection, segmentation, measurement from pixels or automatic frame selection; no vision library in `package.json`; no AI call in the body-scan action, service or components (searched 2026-11-16). |
| Fixed rule or model | Neither decides anything about the body. The member chooses when to take each photo. |
| 3D model or body-fat estimate | None. The consent screen says Body Scan does not estimate body fat (`src/components/body-scan/consent-card.tsx:15`). |
| What leaves the phone | The resized photos, to the app's own private storage. |
| What is stored | Photos (private bucket), paths, typed measurements, weight, note. |

### 4.3 Patents previously identified (file 03 §3)

| Number | Title (as reported) | Owner (as reported) | Marking |
|---|---|---|---|
| US 11,232,629 B1 | Two-dimensional image collection for three-dimensional body composition modeling | Amazon Technologies, Inc. | Independent claims NOT OBTAINED; status UNVERIFIED |
| US 11,580,693 B1 | Same title | Amazon Technologies (per extract) | Independent claims NOT OBTAINED; status UNVERIFIED |
| US 12,165,271; US 11,836,853; US 11,854,146; US 11,903,730 B1 | Amazon body-model / body-fat family members | Amazon (per extracts / prior report) | Independent claims NOT OBTAINED; status UNVERIFIED |

## 5. Sleep analysis

### 5.1 What the code does

| Step | What happens | Runs on | File:line |
|---|---|---|---|
| 1 | With platform permission, reads finished sleep records and overnight heart rate, HRV and respiratory-rate samples from Apple Health or Health Connect through `@capgo/capacitor-health`. No raw sensor stream | Phone | `src/lib/native-sleep.ts:43-65` |
| 2 | Runs automatically when the member has turned import on and the last sync is stale, or when the member taps sync | Phone | `src/components/sleep/source-card.tsx:79-86, 128` |
| 3 | Groups platform samples less than 30 minutes apart into one session; discards records under 10 minutes | Phone | `src/lib/domain/sleep-import.ts:51-53` |
| 4 | Labels each imported record: 3 hours or less **and** starting 09:00–20:00 local time → nap; otherwise night | Server | `src/lib/domain/sleep-import.ts:60-69`; `src/server/actions/sleep-import.ts:197` |
| 5 | Lists a session under the local date on which it ended (`nightOf`). No configurable cut-off time found | Phone and server | `src/lib/domain/sleep.ts:157-161` |
| 6 | Nightly score: time asleep vs goal 50, efficiency 20, timing 20, awakenings 10. No heart-rate input | Pure function | `src/lib/domain/sleep-score.ts:52` |
| 7 | Sleep debt: last 14 nights; shortfall counts in full, half of any surplus repays. Minutes asleep vs the member's goal only | Pure function | `src/lib/domain/sleep-debt.ts:12-14, 62` |
| 8 | Bed window: wake anchor − goal − median latency − 10 min settle, ±30 min. Debt and scores are not inputs | Pure function | `src/lib/domain/sleep-schedule.ts:13-14, 74-88` |
| 9 | Readiness: four self-reported 1–5 answers turned into 0–100 | Pure function | `src/lib/domain/readiness.ts:1-14` |
| 10 | Overnight vitals stored as the device's average, minimum and maximum per night; nothing estimated | Server | `src/lib/domain/sleep-import.ts:225-231` |

### 5.2 What reaches the AI provider (affects what the feature does)

| Path | Health-platform rows | File:line |
|---|---|---|
| Coach `get_sleep_summary` tool | Withheld unless the separate permission is on; the coach is told how many nights were withheld | `src/server/coach/sleep-summary.ts:27-31`; `src/server/coach/tools.ts:600-601` |
| Coach context snapshot (steps) | Same filter | `src/server/coach/snapshot.ts:279` |
| Weekly report text | Imported nights removed unless allowed | `src/server/services/weekly-reports.ts:182` |
| Coach `get_training_review` tool | **No health-sharing filter found.** The review input includes imported nights' minutes asleep and watch heart-rate / HRV averages (gated only by the wellness consent); the review's recovery block and short-sleep text can carry them | `src/server/services/adaptive-training.ts:38, 59, 146-151`; `src/lib/domain/adaptive-training.ts:339-348, 533, 564`; `src/server/coach/tools.ts:415-417` |
| Coach `get_recovery_summary` tool | **No health-sharing filter found.** Includes imported nights' minutes asleep (gated only by the wellness consent) | `src/server/coach/analysis.ts:41-59, 125-145` |

The last two rows come from reading the code on 2026-11-16, not from a test. The integration test `tests/integration/health-ai-sharing.test.ts` covers the context snapshot and sleep summary only. Whether these two paths are intended is for the founder to confirm (see UNRESOLVED 9).

### 5.3 Facts counsel will need

| Question | Answer from the code |
|---|---|
| Inputs | Platform sleep records and overnight samples; manual entries; the in-app sleep timer; self-reported check-ins. |
| Does the app detect sleep from physiology | No. It reads records the platform already holds. |
| Fixed rule or model | Fixed rules for grouping, nap labelling, score, debt and bed window. |
| Nap classification | Duration threshold plus fixed clock window. **Older charts say naps are not detected; that is out of date** (file 03 D1). |
| Member confirmation of a nap on import | None found. Members can edit or log naps by hand. |
| Do naps change scores or debt | Night summaries exclude naps (file 03 §5.5; `src/lib/domain/sleep.ts:358-362`, not re-read). |
| Strain, heart-rate-derived load, sleep need from debt | None found. The sleep goal is the member's setting. |
| What is stored | Sleep sessions with kind, source, stage segments and per-night vitals summaries. |

### 5.4 Patents previously identified (file 03 §3)

| Number | Title (as reported) | Owner (as reported) | Marking |
|---|---|---|---|
| US 12,614,640 B2 | Method and system for supplemental sleep detection | Oura Health Oy | Independent claims NOT OBTAINED; status UNVERIFIED; dates conflict |
| US 12,165,771 B2 | Same title (parent) | Oura Health Oy | Independent claims NOT OBTAINED (one relayed fragment only); status UNVERIFIED |
| US 10,842,429 B2 | Method and system for assessing a readiness score of a user | Oura Health Oy | Independent claims NOT OBTAINED; status UNVERIFIED; IPR status conflicting |
| US 11,478,187 B2; US 11,986,313 B2 | Method and system for monitoring and improving sleep pattern of user | Oura Health Oy | Independent claims NOT OBTAINED; status UNVERIFIED |
| US 2024/0350078 A1 | (reported as same family) | — | No record found; UNVERIFIED |
| US 12,318,226 B2 | Determining sleep need from physiological measurements | Whoop, Inc. | Independent claims NOT OBTAINED; status UNVERIFIED |
| US 10,111,615 B2; US 10,555,698 B2 | Sleep scoring based on physiological information | Fitbit LLC (prior report) | Independent claims NOT OBTAINED; status UNVERIFIED |

## 6. GPS processing (run recorder)

### 6.1 What the code does

| Step | What happens | Runs on | File:line |
|---|---|---|---|
| 1 | Position fixes from browser geolocation or, in the phone app, a background-geolocation plugin, only during a run or walk the member starts | Phone | `src/lib/native/location.ts:92, 111` |
| 2 | Fix rejected if accuracy is missing or worse than a limit, stale or out of order; the first fix must meet a tighter limit | Phone | `src/lib/domain/gps-track.ts:287-294` |
| 3 | Constant-velocity Kalman filter per axis; measurement variance from each fix's reported accuracy; process noise differs for run and walk | Phone | `src/lib/domain/gps-track.ts:207-208, 309-312` |
| 4 | Jump gate by implied speed (run 10 m/s, walk 4 m/s) | Phone | `src/lib/domain/gps-track.ts:122` |
| 5 | In-progress track kept in the phone's local storage for recovery after a crash | Phone | `src/components/run/gps-recorder.tsx:199-219` |
| 6 | On save: Douglas–Peucker point removal, cap of 2,000 points; route, splits and totals sent to the server, which checks physical consistency | Phone, then server | `src/lib/domain/gps-track.ts:529-568`; `src/server/actions/gps-activities.ts:27, 50, 64` |
| 7 | Route drawn on a scale grid. Optional raster map tiles as a background **only** if `NEXT_PUBLIC_MAP_TILE_URL` and an attribution are set; commented out in the example configuration | Phone | `src/lib/domain/map-tiles.ts`; `.env.example:109-116` |

### 6.2 Facts counsel will need

| Question | Answer from the code |
|---|---|
| Inputs | Position fixes with timestamps and reported accuracy. No motion sensors, no map data. |
| Where it runs | Phone. The server stores and checks the result. |
| Fixed rule or model | Fixed filter and thresholds. |
| Spline, map matching, road or trail data | None found; points are never moved toward map features. Tiles, if enabled, are display images only. |
| What is stored | Simplified route (up to 2,000 points), splits, totals. |
| Production value of the tile setting | **Not in the repository.** Founder to state it. |

### 6.3 Patents previously identified (file 03 §3)

| Number | Title (as reported) | Owner (as reported) | Marking |
|---|---|---|---|
| US 9,891,059 B2 | Route smoothing | TomTom Global Content B.V. | Independent claims NOT OBTAINED; status UNVERIFIED |
| US 12,163,790 B2 | Route smoothing with map matched positioning coordinates | Apple Inc. (prior report) | Independent claims NOT OBTAINED; status UNVERIFIED |

## 7. Food-photo recognition (meal photo and label photo)

### 7.1 What the code does

| Step | What happens | Runs on | File:line |
|---|---|---|---|
| 1 | Separate consent to send meal photos to the AI provider | Server record | `src/server/services/food-photo.ts:35-38, 50` |
| 2 | One photo goes to the third-party model with fixed instructions and a fixed output schema (items, grams, calories, macros, confidence, a `packaged` flag, a search term, clarifying questions). The photo is held in memory for the request and not stored | Server, calling the third-party model | `src/lib/domain/food-photo.ts:16-50`; `src/server/services/food-photo.ts:40-70` |
| 3 | Each item's model-written search term is matched to the bundled USDA table by fixed word rules | Server | `src/server/services/food-photo.ts:13-32`; `src/lib/domain/food-photo.ts:183-262` |
| 4 | A "strong" match is pre-selected at the estimated weight; the photo estimate stays one tap away | Phone | `src/components/nutrition/food-photo-flow.tsx:106-119` |
| 5 | The member reviews, corrects and taps "Confirm and add to diary" before anything is saved | Phone | `src/components/nutrition/food-photo-flow.tsx:541-542` |
| 6 | Label photo: the model is told to transcribe only; the member corrects the text; fixed rule tables then list additives, sugars, sodium sources and allergens | Server | `src/lib/domain/label-photo.ts:4-8`; `src/lib/label-analysis.ts` |

### 7.2 Facts counsel will need

| Question | Answer from the code |
|---|---|
| Inputs | One photo and optional member notes. |
| Fixed rule or model | The third-party model estimates items and amounts; fixed rules do the database match. |
| Bounding boxes, segmentation, depth or multi-image volume | Not in the output schema; single image. |
| What happens inside the model | Not visible in this repository. |
| Automatic logging | None; the member confirms. |
| What is stored | The confirmed diary entries only. |

### 7.3 Patents previously identified (file 03 §3)

| Number | Title (as reported) | Owner (as reported) | Marking |
|---|---|---|---|
| US 11,347,751 B2 | System and method for associating user-entered text to database entries | MyFitnessPal, Inc. | Independent claims NOT OBTAINED; status UNVERIFIED |
| US 12,008,002 B2 | (reported as same family) | — | No record found; UNVERIFIED |
| US 12,417,837 | Food knowledge graph for a health tracking system | MyFitnessPal Inc. (news syndication) | Lead only; independent claims NOT OBTAINED; status UNVERIFIED |
| US 9,734,426; US 9,916,520; US 8,439,683; US 8,345,930 | Meal-photo recognition / estimation | SRI / Passio (as listed in `NUTRITION_IP_REVIEW.md`) | Not found; independent claims NOT OBTAINED; status UNVERIFIED |
| US 11,830,603; US 11,688,187 · US 9,349,297; US 9,892,656 · US 12,182,982 | Meal-photo recognition / estimation | doinglab · Fitly · not stated (as listed) | Not found; independent claims NOT OBTAINED; status UNVERIFIED |
| US 10,332,053; US 12,682,300; US 11,942,208 | Barcode/UPC logging | Unknown | Independent claims NOT OBTAINED; status UNVERIFIED |

## 8. Nutrition scoring

### 8.1 What the code does

| Step | What happens | Runs on | File:line |
|---|---|---|---|
| 1 | Barcode read on the phone; product record fetched from Open Food Facts by the server | Phone, then server | `src/server/services/food-quality.ts:36-47` |
| 2 | Score formula, the same for every member, from the product's nutrients per 100 g/ml: foods `50 + 2.5 × P − 1.5 × N`; drinks `80 + 2.5 × P − 2 × N`; clamped 0–100 | Pure function | `src/lib/food-iq.ts:138-148, 232-235` |
| 3 | The score is shown **only** if the server setting `FOOD_IQ_SCORE=on`; the example configuration sets it off | Server setting | `src/lib/food-iq.ts:27-29`; `.env.example:107` |
| 4 | "Fits your goals": compares the product with the member's calorie and macro targets, diet style and chosen filters | Server | `src/lib/food-iq.ts:405` |
| 5 | Nutri-Score grade and NOVA group shown as computed by Open Food Facts | Phone | `src/components/nutrition/quality-sections.tsx:87-88, 101-102` |
| 6 | "Ask AI about this food": product data and the member's targets go to the third-party model after consent; its instructions forbid medical or allergy guarantees | Server | `src/lib/food-quality-ai.ts:20-24, 74-83` |

### 8.2 Facts counsel will need

| Question | Answer from the code |
|---|---|
| Inputs | Product nutrients from Open Food Facts; for "Fits your goals", the member's targets and filters. |
| Fixed rule or model | Fixed formula. No AI produces the score. |
| Personalised score | No. The number is the same for every member; personal comparison is a separate list. |
| Health-condition or medication profile; go / no-go verdict; wearable input | None found. |
| What is stored | Nothing from the score; it is computed at request time. |
| Production value of `FOOD_IQ_SCORE` | **Not in the repository.** Founder to state it. |

### 8.3 Patents and applications previously identified (file 03 §3)

| Number | Title (as reported) | Owner (as reported) | Marking |
|---|---|---|---|
| US 2026/0196331 A1 | (claimed: personalized ingredient analysis) | Ingredient IQ LLC (claimed in the original brief) | No record found on three attempts; UNVERIFIED |
| US 2026/0204388 A1 | (claimed: AI scoring of consumables) | IndulgeRx (claimed in the original brief) | No record found on three attempts; UNVERIFIED |
| US 7,974,881; US 8,626,796 B2 | Food scoring | Guiding Stars (per prior reports) | Independent claims NOT OBTAINED; status UNVERIFIED |
| US 11,803,781 B2 | Food scoring | WW (per prior reports) | Independent claims NOT OBTAINED; status UNVERIFIED |
| US 12,106,841 B2 | Food scoring | Nestlé (per prior reports) | Independent claims NOT OBTAINED; status UNVERIFIED |

## 9. UNRESOLVED

| # | Item | Why unresolved |
|---|---|---|
| 1 | Independent claims of every patent in sections 3–8 | No claim text obtained; official sources unreachable from this environment. |
| 2 | Legal status, current owner and maintenance fees of every patent | Seen only as third-party extracts. |
| 3 | Whether US 2026/0196331 A1, US 2026/0204388 A1, US 2024/0350078 A1 and US 12,008,002 B2 exist under those numbers | No record returned (file 03 §2.3). |
| 4 | Filing and grant dates of US 12,614,640 B2; date of patent of US 12,318,226 B2 | Sources conflict. |
| 5 | Outcome of IPR2024-01080 (US 10,842,429 B2) | Sources conflict. |
| 6 | Whoop, Inc. v. Finerpoint, Inc., D. Del. 1:26-cv-00289: asserted claims and the order of 2026-10-29 | Docket summary only. |
| 7 | Assignee of US 12,555,666 B2 and US 12,551,757 B2 | Not seen. |
| 8 | What the third-party model does internally with photos and text | Not in the repository. |
| 9 | Whether the coach's training-review and recovery-summary tools are meant to carry Apple Health / Health Connect sleep data without the separate permission (section 5.2) | Read in code only; not tested; founder to confirm the intent. |
| 10 | Production settings: `FOOD_IQ_SCORE`, `NEXT_PUBLIC_MAP_TILE_URL` | Not in the repository. |
| 11 | Areas never searched: AI coaching and conversational memory, social features, the dormant pose-based form-analysis module, design patents, non-US patents, pending applications generally (file 03 §8) | Search gap. |
| 12 | Operating-system and plugin behaviour (HealthKit, Health Connect, background geolocation, barcode SDKs) | Outside this repository's code. |
| 13 | Whether these line references still hold at the commit counsel reads | Branch has uncommitted work; re-pin before sending. |

## 10. What to bring

The claim sets and status records for sections 3–8; this package; audit file 03; a short written description from the founder of how each feature is meant to work and which settings are on in production; the date each feature was first shown outside the project.
