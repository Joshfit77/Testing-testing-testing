# 03 — Patent risk review (technical research for US patent counsel)

**Narrow Gate Fitness** · prepared 2026-11-16 · code read at branch `claude/friends-challenges`, commit `3b9bc44` · US focus.

> **What this is.** A technical comparison of what the code does with the best patent information that could be obtained, prepared by a non-lawyer for the founder and US patent counsel.
> **What it is not.** It is not a freedom-to-operate opinion, a clearance search, claim construction, or a finding of infringement, non-infringement, validity or invalidity. "NOT FOUND IN CODE" is an observation about source files. It is not a legal conclusion, and a missing element in a paraphrased claim says nothing about the real claim.

---

## 1. Scope, method and limits

**Scope.** Priority features: adaptive workout recommendations and training-load adjustments, Body Scan, sleep and recovery scoring, GPS route processing, AI meal-photo estimates, Nutrition Score / ingredient analysis, barcode lookup, AI coach context and memory.

**Method.**
1. Read in full: `docs/launch-audit/FINAL_PATENT_REVIEW.md`, `B_PATENT_CLAIM_CHARTS.md`, `NUTRITION_IP_REVIEW.md`.
2. Tried to re-verify each cited patent on the web on 2026-11-16.
3. Read the current source for each feature and recorded what it does, with file and line.

**The limit that governs everything below.**

- **Direct access to every patent source failed again.** `patents.google.com` did not resolve from the fetch tool, and direct requests to Google Patents, USPTO (image-ppubs, ppubs, Patent Center), Espacenet, Justia, PatentsView, FreePatentsOnline and uspto.report were refused by the session's network proxy (403). No patent page, PDF or register was opened.
- **Everything about patents came from a web-search tool** that reads pages and returns short extracts. The URLs it reported are listed in §9. I did not see the pages themselves.
- **No independent claim was obtained for any patent — not one.** The task asked for independent claims quoted element by element. That could not be done. Every "element" below is taken from an abstract, a description passage, a dependent claim, a plaintiff's complaint, or a prior report's paraphrase, and each is labelled with which. **None is the claim.**
- **Statuses** are Google Patents' labels as relayed by the search tool. Google itself calls them assumptions. No assignment record, fee record or file wrapper was seen.
- **The search is not exhaustive.** It followed the prior reports' citations plus a few leads. Whole areas were not searched (§8).
- **Verification labels used below:**
  - **ID-SEEN** — number, title and assignee appeared in a search extract of an official or primary page on 2026-11-16. Still second-hand.
  - **UNVERIFIED** — not confirmed today, or sources conflict.
  - **Claims: NOT OBTAINED** applies to every row.

**What counsel needs first:** the claim sets. Until someone with normal internet access pulls them, every chart here is provisional. The USPTO PDF link pattern is `https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/<number>`.

---

## 2. Review of the three prior documents

| Document | Date | Code it read | What it verified then | Its own stated limit |
|---|---|---|---|---|
| `B_PATENT_CLAIM_CHARTS.md` | 2026-10-25 | `claude/testflight-prep` @ `c541d63` | Six brief-supplied identifiers + a landscape table, from search snippets | "No full claim set was obtained for any of the six patents" |
| `FINAL_PATENT_REVIEW.md` | 2026-10-26 | `claude/free-pro-membership` @ `9915f22` | Twelve identifiers + landscape, from search extracts; some dependent claims verbatim | "No complete, verbatim independent claim was obtained for any patent"; direct access blocked |
| `NUTRITION_IP_REVIEW.md` | 2026-11-03 | not stated | Nutrition-specific leads; all patent facts marked (S) = search summary | "No … patent claim set was read" |

**Age.** 22, 21 and 13 days old. All three predate the current code.

**Repository history caveat.** Commits `c541d63` and `9915f22` are **not in this repository's history** (`git cat-file` reports "Not a valid object name"). The history has 77 commits and starts on 2026-11-13, so every file's first commit is that date. I could not diff the code the prior reports read against today's code. Differences below come from comparing their descriptions with the current files.

### 2.1 Where the prior descriptions no longer match the code

| # | Prior statement | Current code | Why it matters |
|---|---|---|---|
| D1 | Oura '640 chart: "every import is stored as `kind: "night"`"; supplemental-period detection "absent" | Imported records are now classified. A record of 3 h or less that starts between 09:00 and 20:00 local time is stored as a **nap**: `importedSessionKind`, `src/lib/domain/sleep-import.ts:55-69`; used at `src/server/actions/sleep-import.ts:197` | A duration threshold plus a time-of-day test is the kind of logic the '640 family's abstract and dependent claims describe. The prior "absent" entry is out of date. See §5.5 |
| D2 | Apple '790 / TomTom '059 charts: "No map data, map SDK or tiles anywhere"; route drawn "with no base map" | An **optional raster map background** now exists: `src/lib/domain/map-tiles.ts:1-33`, drawn at `src/components/run/route-map.tsx:127,141-147`. It is off unless `NEXT_PUBLIC_MAP_TILE_URL` and an attribution are set (`.env.example:114-116`, commented out) | Tiles are image background only. No road or trail data is read and no point is moved. But "display on a map image" can no longer be described as absent in every configuration. See §5.3–5.4 |
| D3 | Fitbod '454 chart: "Per-session best e1RM. No period buckets"; "Partition into time periods … absent" | The coach's `analyze_lift_progress` tool builds a **weekly series with the best estimated 1RM per week**, and compares the last 4 weeks with the prior 4: `src/lib/coach/lift-analysis.ts:173-185,188-204` | Time-period partition with a per-period aggregate now exists in one code path. No moving average was found. See §5.2 |
| D4 | Recovery/strain: "No strain score exists" | Still no heart-rate strain. A new coach tool reports **acute:chronic training load** (last 7 days ÷ 28-day weekly average of sessions and hard sets): `src/lib/coach/recovery-summary.ts:62-80` | Inputs are logged sets and RPE only. Counsel should know the feature exists when reading load/strain claims |
| D5 | Coach tools listed: review, target load, deload | Added since: `analyze_lift_progress`, `get_running_summary`, `get_recovery_summary`, `recall_conversations`, `get_program_recommendations`, `propose_program`, `propose_volume_change`, `propose_memory` (`src/lib/coach/tools.ts:104-117,268-348`) | Wider LLM surface than the prior reports charted |
| D6 | Nutrition review: label check described as "new" | Present: `src/lib/domain/label-photo.ts:1-8`, `src/lib/label-analysis.ts:200` | Charted in §5.8 |
| D7 | `.env.example:86-87` sets `FOOD_IQ_SCORE` off | Now `.env.example:107` (`FOOD_IQ_SCORE=off`) | Line reference only; behaviour unchanged |
| D8 | — | A dormant `src/lib/form-analysis/` module exists (pose keypoints → rep counts). `FORM_ANALYSIS_ENABLED = false`; "Nothing under src/app imports this module" (`index.ts:1-16`). No pose-model dependency in `package.json` | Not shipped. No patent search was run for it. Search before it is ever enabled |

### 2.2 Where the prior descriptions still match

Spot-checked and still accurate: rule-based plateau test; member acceptance before any training change; self-reported readiness; sleep score weights 50/20/20/10 with no heart-rate input; duration-only sleep debt; Kalman filter + Douglas–Peucker with no spline; Body Scan with typed measurements and no image analysis; Nutrition Score formula and its off-by-default flag; meal photo sent to a general model with member review.

### 2.3 What re-verification changed on the patent side

| Item | Prior report | Seen 2026-11-16 (search extract) | Result |
|---|---|---|---|
| TomTom '059 fees (prior U8) | Not verified; possible lapse Feb 2026 | Google Patents extract: "Active", anticipated expiry 2032-09-13, 8th-year maintenance fee payment recorded 2025-07-15 | Prior doubt reduced, **not closed**: confirm in USPTO fee records |
| Fitbod '760 | Granted 2026-02-17; inventors uncertain | Justia extract: filed 2023-03-09, granted 2026-02-17, Fitbod, Inc.; inventors Gundlach, Marzagao, Liu, Chen, Venticinque | Identity consistent |
| Fitbod family | '760, '666, '454, '542 | **New lead: US 12,551,757 B2 "Machine-learned exercise capability prediction model"** (same family as '454 per extract) | Add to counsel's list |
| Oura '640 dates | Filed 2024-10-31, granted 2026-04-28 (not matched to the number) | Justia extract: filed **2023-05-26**, date of patent **2026-08-11** | **Conflict. UNVERIFIED** |
| Amazon '629 dates | Priority 2019-08-30, published 2022-01-25 | Google extract same; a Justia extract gave filed 2022-01-21 / granted 2023-02-14 (those look like '693's dates) | Conflict noted; likely a mix-up, unconfirmed |
| Oura '429 IPR | Conflicting | Still conflicting: Google page "Pending – Instituted"; a USPTO PTAB paper (Paper 54) lists IPR2024-01080 among petitions where institution was **denied** | **UNVERIFIED** |
| WHOOP v. Finerpoint (Bevel) | Filed 2026-03-17 | Docket summary: order on a motion to dismiss entered 2026-10-29 (ECF 46), substance not seen. PTAB documents citing the case also surfaced (nature not confirmed) | Active dispute; follow the docket |
| WHOOP '226 | Granted 2025-06-03 | Google extract: Active, anticipated expiry 2038-10-17. A Justia extract showed 2026-10-20 as date of patent | Date conflict; 2025-06-03 retained, unconfirmed |
| MyFitnessPal '751 | Title unknown | Google extract: **"System and method for associating user-entered text to database entries"**, MyFitnessPal, Inc., priority 2016-12-07, published 2022-05-31 | Title now known |
| MyFitnessPal '002 | Listed | No record returned | **UNVERIFIED** |
| US 2026/0196331 A1, US 2026/0204388 A1, US 2024/0350078 A1 | Did not resolve | Did not resolve again (third attempt overall) | **UNVERIFIED** — may be wrong numbers |
| Meal-photo families | Not opened | One combined search returned nothing | **UNVERIFIED** |

---

## 3. Patent table

Jurisdiction is US for every row. "Status as seen" is what a search extract reported on 2026-11-16 unless marked "prior report". Source URLs are those the search tool cited; none was opened directly.

| Number | Title | Assignee (as seen) | Status as seen · source · retrieved 2026-11-16 | Feature it may relate to | Verification |
|---|---|---|---|---|---|
| US 12,551,760 B2 | Workout modification based on muscle strength measurement trends | Fitbod, Inc. | Granted 2026-02-17 (filed 2023-03-09) · patents.justia.com/inventor/allen-chen | Adaptive review; coach load/deload proposals | ID-SEEN · Claims NOT OBTAINED |
| US 12,555,666 B2 | Machine learning-based exercise recommendation adjustment based on user feedback | Not seen (shares text with '760) | Granted (date not seen) · image-ppubs…/12555666 | Accept/decline of recommendations | Title only · UNVERIFIED |
| US 12,109,454 B2 | Determining a user's current exercise capability | Fitbod, Inc. | Granted 2024-10-08 (filed 2021-04-16) · patents.justia.com/assignee/fitbod-inc | Lift trend analysis | ID-SEEN · Claims NOT OBTAINED |
| US 12,551,757 B2 | Machine-learned exercise capability prediction model | Not seen (Fitbod family per extract) | Date "2026-02-17" seen, meaning ambiguous · image-ppubs…/12551757 | Lift trend analysis | Title only · UNVERIFIED |
| US 12,347,542 B2 | Predicting exercises based on user-selected variance | Fitbod, Inc. (prior report) | Granted 2025-07-01 (prior report) | Program generator | Not re-checked · UNVERIFIED |
| US 2024/0424346 A1 | Determining a user's current exercise capability (continuation) | Fitbod family | Pending as of filing 2024-09-09 per extract · patents.google.com/patent/US20240424346A1 | Lift trend analysis | ID-SEEN · status UNVERIFIED |
| US 11,232,629 B1 | Two-dimensional image collection for three-dimensional body composition modeling | Amazon Technologies, Inc. | Granted; published 2022-01-25, priority 2019-08-30 · image-ppubs…/11232629 | Body Scan | ID-SEEN · Claims NOT OBTAINED |
| US 11,580,693 B1 | Same title | Amazon Technologies (per extract) | Granted 2023-02-14 · image-ppubs…/11580693 | Body Scan | ID-SEEN · Claims NOT OBTAINED |
| US 12,165,271; US 11,836,853; US 11,854,146; US 11,903,730 B1 | Amazon body-model / body-fat family members | Amazon (per extracts / prior report) | Not checked | Body Scan (if analysis is ever added) | Titles only · UNVERIFIED |
| US 9,891,059 B2 | Route smoothing | TomTom Global Content B.V. | "Active", anticipated expiry 2032-09-13; fee payment 2025-07-15 · patents.google.com/patent/US9891059B2 | GPS smoothing | ID-SEEN · Claims NOT OBTAINED |
| US 12,163,790 B2 | Route smoothing with map matched positioning coordinates | Apple Inc. (prior report) | Granted; app. 17/739,074 · patents.google.com/patent/US12163790 | GPS route; optional map background | ID-SEEN (title, app. no.) · Claims NOT OBTAINED |
| US 12,614,640 B2 | Method and system for supplemental sleep detection | Oura Health Oy | Granted; dates conflict (2026-04-28 vs 2026-08-11) · patents.justia.com/assignee/oura-health-oy | Sleep import; naps | ID-SEEN · dates UNVERIFIED · Claim 1 NOT OBTAINED |
| US 12,165,771 B2 | Same title (parent) | Oura Health Oy | Granted · patents.google.com/patent/US12165771B2 | Sleep import; naps | ID-SEEN · one claim-1 fragment relayed |
| US 10,842,429 B2 | Method and system for assessing a readiness score of a user | Oura Health Oy | Granted 2020-11-24; "Active"; IPR status conflicting · patents.google.com/patent/US10842429B2 | Readiness check-in; overnight HR display | ID-SEEN · Claims NOT OBTAINED |
| US 11,478,187 B2; US 11,986,313 B2 | Method and system for monitoring and improving sleep pattern of user | Oura Health Oy | '313 published 2024-05-21 per extract; '187 not re-checked | Sleep schedule / bed window | '313 ID-SEEN · '187 UNVERIFIED |
| US 2024/0350078 A1 | (claimed: same family) | — | **No record found** | Sleep schedule | **UNVERIFIED** |
| US 12,318,226 B2 | Determining sleep need from physiological measurements | Whoop, Inc. | "Active", anticipated expiry 2038-10-17; asserted in D. Del. 1:26-cv-00289 · patents.google.com/patent/US20240252121A1 | Sleep debt; bed window | ID-SEEN · Claims NOT OBTAINED |
| US 11,602,279; US 11,627,946; US 12,220,112 | WHOOP strain and related | Whoop, Inc. | Listed on the same docket · dockets.justia.com/…/1:2026cv00289/92454 | Training-load summary (no HR) | Numbers seen on docket extract · UNVERIFIED |
| US 10,111,615 B2; US 10,555,698 B2 | Sleep scoring based on physiological information | Fitbit LLC (prior report) | Not re-checked | Nightly sleep score | UNVERIFIED |
| US 11,347,751 B2 | System and method for associating user-entered text to database entries | MyFitnessPal, Inc. | Published 2022-05-31; priority 2016-12-07; status not seen | Meal-photo item → USDA food match | ID-SEEN · Claims NOT OBTAINED |
| US 12,008,002 B2 | (claimed: same family) | — | **No record found** | Same | **UNVERIFIED** |
| US 12,417,837 | Food knowledge graph for a health tracking system | MyFitnessPal Inc. (news syndication) | "Issued Sept. 16" (year not shown) | Food search / matching | Lead only · UNVERIFIED |
| US 2026/0196331 A1 | (claimed: personalized ingredient analysis, Ingredient IQ LLC) | — | **No record found** | Barcode; label check; "Fits your goals" | **UNVERIFIED** |
| US 2026/0204388 A1 | (claimed: AI scoring of consumables, IndulgeRx) | — | **No record found** | Nutrition Score | **UNVERIFIED** |
| US 9,734,426; 9,916,520; 8,439,683; 8,345,930 (SRI/Passio) · US 11,830,603; 11,688,187 (doinglab) · US 9,349,297; 9,892,656 (Fitly) · US 12,182,982 | Meal-photo recognition / estimation | As listed in `NUTRITION_IP_REVIEW.md` | Not found today | Meal photo | **UNVERIFIED** |
| US 10,332,053; US 12,682,300; US 11,942,208 | Barcode/UPC logging | Unknown | Not checked | Barcode → diary | **UNVERIFIED** |
| US 7,974,881; US 8,626,796 B2 (Guiding Stars) · US 11,803,781 B2 (WW) · US 12,106,841 B2 (Nestlé) | Food scoring | Per prior reports | Not re-checked | Nutrition Score | **UNVERIFIED** |

---

## 4. How to read the element charts

- **"Element (source)"** names where the wording came from. It is never the independent claim.
- **PRESENT IN CODE / NOT FOUND IN CODE / UNCLEAR** describe source files at commit `3b9bc44`. They do not say whether a claim element is met.
- "Not found" means not found in the files read and by keyword search. It is not proof of absence across the whole repository, third-party SDKs, or the operating system's own behaviour.

---

## 5. Per-patent element charts

### 5.1 Fitbod — US 12,551,760 B2 (and US 12,555,666 B2)

**Claim text: NOT OBTAINED.** Elements below are from the description as relayed in the prior report and from a Justia abstract extract seen today. Today's extract summarised the abstract as: a system that trains a model to rank exercises and can change a workout when a predicted strength measure and an actual one diverge, adding exercises for the related muscles. The direction of that comparison in the extract was unclear, so treat it as unreliable.

| Element (source) | Code observation | Where |
|---|---|---|
| Strength measurements from the user's workout history (description) | **PRESENT IN CODE.** Best estimated 1RM per session per lift, from logged working sets | `src/lib/domain/adaptive-training.ts:280-290`; `estimateOneRepMax`, `src/lib/domain/strength.ts` |
| A machine-learned model that predicts the user's strength (description) | **NOT FOUND IN CODE** in the review: fixed formula and fixed thresholds on the member's own logs. No training step, no population data, no model file, no ML dependency in `package.json` | `adaptive-training.ts:1-10` (stated rules), `:291-313` |
| | **UNCLEAR** for the AI coach: a general third-party LLM (Claude Haiku/Sonnet) receives the deterministic review and may issue proposals. It is not trained by the app | `src/lib/coach/routing.ts:15`; `describeReviewForCoach`, `adaptive-training.ts:558-569`; `src/lib/coach/tools.ts:256` |
| Detect a decrease or plateau in strength (description) | **PRESENT IN CODE.** `plateau = sessions ≥ 4 AND span ≥ 21 days AND sessions since best ≥ 3` | `adaptive-training.ts:311` |
| Compare predicted with actual strength (abstract extract) | **NOT FOUND IN CODE.** No predicted value exists; the test is "no new best" | `adaptive-training.ts:294-312` |
| Modify the workout for the exercise or muscle group (description) | **PRESENT IN CODE as a proposal.** Plateau → proposed target at 90% of top load. Also: load step-up, recovery week (≈40% fewer sets, RPE cap 7), ±1 set volume change | `adaptive-training.ts:396-416` (plateau), `:362-394`, `:418-440`, `:442-478` |
| | **UNCLEAR** whether a proposal that the member must accept is "modifying". Nothing is written until acceptance; accepted changes go to `exercise_targets` / program tables and are logged in `training_adjustments`, with undo | `src/server/actions/adaptive-training.ts:30-45`; `src/server/services/adaptive-training.ts:192-282,291-309` |
| Add exercises for related muscles (abstract extract) | **NOT FOUND IN CODE** in the review. Volume changes add or drop a set on an existing exercise. The coach can separately propose an exercise swap or a whole program | `adaptive-training.ts:449-463`; `src/lib/coach/tools.ts:56,117` |
| Stored user requests to do exercises more or less often ('760/'666 description) | **NOT FOUND IN CODE.** Declined recommendations are recorded and hidden; no model learns from them | `src/server/actions/adaptive-training.ts:55-73` |
| Feedback-trained ranking model ('666 description) | **NOT FOUND IN CODE** | — |

**Unknowns**
- The actual independent claims of '760 and '666.
- Whether any independent claim omits the machine-learned model.
- Whether "modify" in the claims requires an automatic change.
- Whether an off-the-shelf LLM that relays a rule-based flag could be argued to be a "machine-learned model". That is claim construction.
- Assignee of '666.

**What patent counsel needs to evaluate**
1. Claim 1 (and every independent claim) of '760 and '666 against `analyzeTraining` and the coach proposal tools.
2. Whether the member-acceptance step matters under the claim wording.
3. Prosecution history, for how the applicant distinguished rule-based prior art.

### 5.2 Fitbod — US 12,109,454 B2, US 12,551,757 B2, US 2024/0424346 A1, US 12,347,542 B2

**Claim text: NOT OBTAINED.** Elements from the '454 abstract as relayed today (Justia/Google extracts). The '757 description was reported as sharing the same passage, plus a random-forest model for exercises the user has not performed.

| Element (source) | Code observation | Where |
|---|---|---|
| Access exercise history for an exercise ('454 abstract) | **PRESENT IN CODE** | `adaptive-training.ts:280-290`; `src/lib/coach/lift-analysis.ts:145-149` |
| Partition the history into a plurality of time periods ('454 abstract) | **PRESENT IN CODE** in the coach's lift analysis: one bucket per rolling week; and two 4-week blocks. **Prior report said absent (D3).** The adaptive review itself uses per-session points, no buckets | `lift-analysis.ts:173-185,188-193`; `adaptive-training.ts:291-313` |
| For each period, compute an aggregate capability ('454 abstract) | **UNCLEAR.** Per week the code keeps the **best** estimated 1RM, session count, hard-set count and average RPE. Whether a per-week maximum is an "aggregate capability" is for counsel | `lift-analysis.ts:179-184` |
| Calculate a moving average capability from the aggregates ('454 abstract) | **NOT FOUND IN CODE.** Keyword search for moving average / exponential smoothing in the GPS, training and coach files found none. Comparisons are first-vs-last week and last-4-vs-prior-4 maxima | `lift-analysis.ts:196-209` |
| Determine current capability; discount by recency ('454 abstract) | **NOT FOUND IN CODE.** No single "current capability" figure and no recency weighting. Plateau tests use sessions and days since the best | `adaptive-training.ts:300-311`; `lift-analysis.ts:128-130` |
| Estimate capability for an unperformed exercise from other users' data ('757 description) | **NOT FOUND IN CODE.** No cross-user data is read. A lift with thin data returns `insufficient_data` | `lift-analysis.ts:1-7,258` |
| User-selected variance slider + trained ranking model + random selection ('542, prior-report extract) | **NOT FOUND IN CODE.** Exercise and program ranking uses fixed points with a deterministic tie-break. `Math.random` appears only in confetti and id generation | `src/lib/domain/program-generator.ts:125-130,166-167,270-299` |

**Unknowns:** all independent claims; grant date and assignee of '757; status of the pending continuation and its current claims.

**What counsel needs to evaluate:** '454 and '757 claim 1 against `analyzeLiftProgress` specifically, because that code path is newer than the prior charts.

### 5.3 TomTom — US 9,891,059 B2 "Route smoothing"

**Claim text: NOT OBTAINED.** Elements are the prior report's paraphrase of a full-text snippet ("claim (extract)"). Today's extract confirmed only description language: a cubic spline for an initial estimate, refined with user motion data; GPS accuracy data, historical route data and digital map data "may be used".

| Element (source) | Code observation | Where |
|---|---|---|
| Receive position data at multiple times along a route (prior extract) | **PRESENT IN CODE** | `GpsFix`, `src/lib/domain/gps-track.ts:22`; `addFix`, `:287` |
| Apply a spline algorithm to obtain an estimated route as a spline curve (prior extract) | **NOT FOUND IN CODE.** Smoothing is a constant-velocity Kalman filter per axis, weighted by each fix's reported accuracy. Stored route is point removal (Douglas–Peucker) and rounding. "spline" does not occur in GPS/run files | `gps-track.ts:204-234` (filter), `:309-334` (predict, gate, update), `:529-552` (`simplify`), `:561-572` (`routeForSave`) |
| Obtain historical route data and/or digital map data (prior extract) | **NOT FOUND IN CODE** as an input to position processing. `gps-track.ts` takes fixes only. Optional map tiles are images for display and are never read by the filter | `gps-track.ts:287-356`; `src/lib/domain/map-tiles.ts:1-7` |
| Refine using user motion data (description) | **NOT FOUND IN CODE.** No accelerometer or pedometer input to the run recorder. (Body Scan reads device orientation, unrelated to runs) | `src/components/run/gps-recorder.tsx:173,263`; `src/lib/run/live-recording.ts:65` |
| Refine using GPS accuracy data (description; "may be used") | **PRESENT IN CODE.** Reported accuracy sets the measurement variance and gates fixes | `gps-track.ts:208` (`measVar`), `:291` (25 m gate), `:317-323` (outlier gate) |
| Provide the result for display (prior extract) | **PRESENT IN CODE** | `src/components/run/route-map.tsx:46-61`; `gps-recorder.tsx:559,678` |

**Unknowns:** whether the granted independent claims require a spline; which "additional data" they require; whether accuracy data alone can serve as the refinement input; fee status (extract says paid 2025-07-15).

**What counsel needs to evaluate:** claims 1 and 16 as granted; whether the accuracy-weighting row above matters once the real wording is known.

### 5.4 Apple — US 12,163,790 B2 "Route smoothing with map matched positioning coordinates"

**Claim text: NOT OBTAINED.** Elements from the abstract as paraphrased in the prior reports. Today's extract added one description passage: a smoother that takes workout type and/or signal environment with raw or map-matched GPS data and adjusts its settings.

| Element (source) | Code observation | Where |
|---|---|---|
| Obtain positions periodically during a movement event (abstract) | **PRESENT IN CODE** | `gps-track.ts:287` |
| Estimate a path from the positions (abstract) | **PRESENT IN CODE** | `gps-track.ts:309-356` |
| Identify previously mapped features near the path (abstract) | **NOT FOUND IN CODE.** No road, trail, building or water data is loaded. No map SDK in `package.json` | `map-tiles.ts` (image URLs only) |
| Match the path to the map (abstract) | **NOT FOUND IN CODE.** Points are never moved toward anything | `gps-track.ts:529-572` |
| Display the path on an image of the map (abstract) | **UNCLEAR / configuration-dependent.** Default: route on a scale grid, no map. If the owner sets a tile URL, the unmatched route is drawn over dimmed map tiles. **Prior reports said no base map exists (D2)** | `route-map.tsx:38-45,52,127,141-147,209-211`; `.env.example:114-116` |
| Smoother settings adjusted by workout type (description) | **PRESENT IN CODE** in a limited sense: process noise and speed limits differ for run and walk | `gps-track.ts:122` (`MAX_SPEED_MS`), `:310` (`PROCESS_Q[s.kind]`) |

**Unknowns:** every independent claim; whether any claim lacks a map-matching step; whether workout-type-dependent smoothing is claimed on its own.

**What counsel needs to evaluate:** claims 1 and the other independents; the tile option before it is switched on in production.

### 5.5 Oura — US 12,614,640 B2 and parent US 12,165,771 B2 "supplemental sleep detection"

**Claim text: '640 claim 1 NOT OBTAINED.** Sources: the family abstract; '640 dependent claims quoted in the prior report; one fragment the search tool attributed to **'771 claim 1** today: *"detect a first primary sleep period for the user during a first sleep day based at least in part on a first subset of the physiological data, wherein the first sleep day comprises 24 hours and ends at a configured cut-off time of day"* (relayed, not seen in context). A description example: data before 6:00 pm counts to the current sleep day, after 6:00 pm to the next.

| Element (source) | Code observation | Where |
|---|---|---|
| Receive (physiological) data from a wearable worn by the user (abstract; '771 fragment) | **UNCLEAR.** The app reads finished sleep records and overnight HR/HRV/respiratory-rate samples from Apple Health / Health Connect, which a wearable may have written. It reads no raw sensor stream itself | `src/lib/native-sleep.ts:53,64,85`; `sleep-import.ts:39-48` |
| Detect a primary sleep period from the data (abstract) | **UNCLEAR.** The app groups platform sleep samples less than 30 min apart into a session and derives onset and final wake from stage segments. It does not infer sleep from physiology | `samplesToSessions`, `sleep-import.ts:166-201`; `MERGE_GAP_MINUTES`, `:51` |
| Detect a supplemental sleep period whose duration exceeds a threshold (abstract) | **UNCLEAR — changed since the prior report.** Imported records are now labelled nap or night by rule: ≤ 3 h **and** start between 09:00 and 20:00 → nap. Records under 10 min are discarded as noise. The code's threshold is an upper bound for a nap plus a lower noise bound | `sleep-import.ts:53,55-69`; `src/server/actions/sleep-import.ts:197` |
| Sleep day ending at a configured / determined cut-off time of day ('771 fragment; '640 dependents) | **UNCLEAR.** A session is listed under the local date on which it ended (`nightOf`). No configurable cut-off time was found. Counsel should note the '640 dependent claim that the cut-off may be midnight | `src/lib/domain/sleep.ts:157-161` |
| Cut-off based on when the user typically begins primary sleep ('640 dependent, verbatim in prior report) | **NOT FOUND IN CODE.** The nap window uses fixed clock times | `sleep-import.ts:60-62` |
| Update sleep/readiness scores because of the supplemental period (prior extract) | **NOT FOUND IN CODE.** Night summaries exclude naps; the score takes one night; debt uses night summaries. Readiness is a self-report | `sleep.ts:358-362`; `src/lib/domain/sleep-score.ts:69-107`; `src/lib/domain/sleep-debt.ts:62`; `src/lib/domain/readiness.ts:9-14` |
| Display the supplemental period (prior extract) | **PRESENT IN CODE.** Naps are listed under their day | `napsOn`, `sleep.ts:401-402` |
| Receive user confirmation of the supplemental period (prior extract) | **NOT FOUND IN CODE** as a confirm step on import. Members can edit or log naps by hand | `sleep.ts:265-272` |

**Unknowns:** '640 claim 1; which of score-update, confirmation and cut-off are in every independent claim; whether health-platform records count as "data from a wearable"; correct filing and grant dates.

**What counsel needs to evaluate:** '640 and '771 independents against `importedSessionKind` and `nightOf`. The prior report's "absent" for nap detection should not be relied on.

### 5.6 Oura — US 10,842,429 B2 "readiness score"; sleep-pattern family US 11,478,187 B2 / US 11,986,313 B2

**Claim text: NOT OBTAINED.** '429 elements are the prior report's "claim 1 (extract)". Today's extract found the phrase *"calculate a readiness score based on the body response summary and a previous body response summary"* on the Google page without showing whether it sits in a claim. Sleep-pattern element is the prior report's near-verbatim summary.

| Element (source) | Code observation | Where |
|---|---|---|
| Determine rest and activity periods from measured movement ('429 prior extract) | **NOT FOUND IN CODE** | — |
| Rest summary from biosignals; activity summary ('429) | **NOT FOUND IN CODE** as a computed summary. Overnight HR/HRV/respiration are stored as the device's avg/min/max per night | `summarizeVitals`, used at `src/lib/native-sleep.ts:94` |
| Body response summary from both ('429) | **NOT FOUND IN CODE** | — |
| Readiness score from current and previous summaries ('429) | **NOT FOUND IN CODE.** Readiness = four self-reported 1–5 answers | `src/lib/domain/readiness.ts:9-14` |
| (Adjacent) physiology shown alongside readiness | **PRESENT IN CODE.** Text compares self-reported readiness after nights with device HR ≥ 4 bpm above the member's own average vs other nights. 7/14-day HR and HRV averages are passed to the review and the coach as context. No score is computed from them | `src/lib/domain/sleep-training.ts:38,96-106`; `adaptive-training.ts:338-348,533` |
| (Adjacent) load context | **PRESENT IN CODE.** Acute:chronic ratio of sessions and hard sets, from logs | `src/lib/coach/recovery-summary.ts:62-80` |
| Analyse sleep scores against bedtimes to find an optimum bedtime window (sleep-pattern family) | **NOT FOUND IN CODE.** Bed window = anchor wake − goal − latency − settle, fixed ±30 min. Scores are not an input | `src/lib/domain/sleep-schedule.ts:74-88,14-15` |
| Sleep score per night (family) | **PRESENT IN CODE** (duration 50, efficiency 20, timing 20, wake-ups 10; no physiological input) | `sleep-score.ts:52,69-107` |

**Unknowns:** '429 claim 1 wording; IPR2024-01080 outcome; whether the LLM coach, given HR/HRV averages and check-ins, could output something a claim would call a readiness assessment (the prompt rules were not re-audited today); the unresolved number US 2024/0350078 A1.

**What counsel needs to evaluate:** '429 independents against the adjacent rows; '187/'313 claim 1 against `sleepWindows`; PTAB docket.

### 5.7 WHOOP — US 12,318,226 B2 (sleep need) and US 11,602,279 (strain)

**Claim text: NOT OBTAINED.** Sources: the '226 abstract (extract): *"a first sleep debt metric based on user strain and a second sleep debt metric based on accumulated sleep debt"* to estimate sleep needed in the next period. A **plaintiff's complaint** (as relayed) characterises claim 1 as including determining a current sleep need from prior sleep history and generating a "first recommended time in bed". That is an adversary's description and the extract mixed in another patent. '279 fragment from the prior report: "a weighted sum of heart rate reserve data".

| Element (source) | Code observation | Where |
|---|---|---|
| Physiological measurements from a wearable ('226 title/abstract) | **UNCLEAR.** Imported platform records only (see §5.5) | `native-sleep.ts:53-94` |
| Sleep debt metric based on strain ('226 abstract) | **NOT FOUND IN CODE.** Debt uses minutes asleep vs goal only | `sleep-debt.ts:62-90` |
| Sleep debt metric based on accumulated debt ('226 abstract) | **PRESENT IN CODE.** Rolling 14 nights; shortfall added, half of any surplus repaid | `sleep-debt.ts:12-14,62-90` |
| Determine sleep need for the next period from the two metrics ('226 abstract) | **NOT FOUND IN CODE.** The goal is the member's setting; debt does not change it | `sleep-schedule.ts:74-88` |
| Generate a recommended time in bed from sleep need (complaint's characterisation) | **UNCLEAR.** A bed window is computed from the member's goal and wake time, not from debt. A tip appears when debt exceeds 2 h ("Protect your sleep window"). Debt also scales the energy sketch | `sleep-schedule.ts:85-88,127`; `src/lib/domain/sleep-habits.ts:72`; `src/lib/domain/sleep-energy.ts:47-51` |
| Strain from weighted heart-rate-reserve ('279 fragment) | **NOT FOUND IN CODE.** No heart-rate-based load metric. Load summary uses sessions, sets and RPE | `recovery-summary.ts:62-80` |

**Unknowns:** all independent claims of the four asserted patents; the 2026-10-29 order; whether PTAB proceedings exist; whether "recommended time in bed" claims require strain.

**What counsel needs to evaluate:** the asserted claims as pleaded in D. Del. 1:26-cv-00289, since WHOOP is enforcing against a software-only app; `sleepWindows` + `sleepDebt` together.

### 5.8 Amazon — US 11,232,629 B1 and US 11,580,693 B1 (Body Scan)

**Claim text: NOT OBTAINED.** Elements from the description as relayed today and in the prior report: an app on a portable device gives instructions and collects 2D body images from different body directions; *"received images are then processed to determine a body direction of the body and to select a 2D body direction image"*; *"a request is presented (e.g., visually and/or audibly) that the body be rotated to a next body direction"*, possibly in a defined order; images go to remote resources to determine measurements and generate a 3D body model.

| Element (source) | Code observation | Where |
|---|---|---|
| Application on a portable device with a 2D camera (description) | **PRESENT IN CODE** | `src/components/body-scan/scan-capture.tsx:245-248` |
| Instructions to the user for capture (description) | **PRESENT IN CODE.** Lighting, distance, pose and consistency guidance; per-pose tips; head-to-feet outline; 10 s timer; upright-tilt indicator; faint overlay of the previous scan | `src/lib/domain/body-scan.ts:12,20-51,93-97`; `scan-capture.tsx:311,334,336,342-344,362` |
| Images from different body directions (description) | **PRESENT IN CODE.** Front and side required, rear optional | `body-scan.ts:5-7`; `scan-capture.tsx:78` |
| Request that the body be rotated to the next direction, in a defined order (description) | **PRESENT IN CODE** as a fixed sequence of steps with a text tip per pose ("Turn to your right side…") | `body-scan.ts:47-51`; `scan-capture.tsx:211,306-311` |
| Process received images to determine body direction and select a direction image (description) | **NOT FOUND IN CODE.** The member takes each photo (button or timer); the frame is copied from the video to a canvas. No pose detection, segmentation or automatic selection; no vision library in `package.json` | `scan-capture.tsx:282-286` |
| Send images to remote computing resources (description) | **PRESENT IN CODE** as upload to a private storage bucket | `scan-capture.tsx:84-85`; `src/server/actions/body-scan.ts:47-53` |
| Remote processing of the images (description) | **NOT FOUND IN CODE.** The server stores paths and issues signed links. No AI call or image analysis in the body-scan service or action files | `src/server/services/body-scan.ts:17-51` |
| Determine body measurements / composition from images (description) | **NOT FOUND IN CODE.** Measurements are typed by the member; comparison is subtraction of typed values. UI states it does not estimate body fat | `body-scan.ts:65-90`; `scan-capture.tsx:168`; `src/components/body-scan/consent-card.tsx:15` |
| Generate and present a 3D body model (description) | **NOT FOUND IN CODE** | — |

**Unknowns**
- Every independent claim of both patents, and of the continuation family ('271, '853, '146).
- Whether any independent claim covers guided multi-direction capture and transmission **without** requiring image processing, measurements or a model.
- Whether "determine a body direction" must be done by software.
- Current assignee and status after Amazon ended its Halo product (not researched).

**What patent counsel needs to evaluate:** claim 1 and each independent claim of '629 and '693; the continuation family's claims; the Body Scan flow in `scan-capture.tsx` end to end.

### 5.9 MyFitnessPal — US 11,347,751 B2 "System and method for associating user-entered text to database entries" (and US 12,008,002 B2, unresolved)

**Claim text: NOT OBTAINED.** Only the title is confirmed. The gist "matching food text to database records with machine-learning-derived queries" is the prior nutrition review's search summary.

| Element (source) | Code observation | Where |
|---|---|---|
| Text describing a food is received (title; prior summary says "user-entered") | **UNCLEAR.** In the meal-photo flow the text is a `search_term` **generated by the LLM** from a photo, not typed by the member. Ordinary food search uses member-typed text | `src/lib/domain/food-photo.ts:33`; `src/server/services/usda-local.ts:99-108` |
| Machine-learning-derived query (prior summary) | **UNCLEAR.** The LLM writes the search term. The matching itself is fixed word rules (token overlap, brand and mixed-dish exclusions) | `food-photo.ts:183-262` (`matchTokens`, `matchStrength`, `bestMatch`) |
| Associate the text with a database entry (title) | **PRESENT IN CODE.** A "strong" match to a bundled USDA record is pre-selected at the estimated weight; the photo estimate stays one tap away; the member confirms before saving | `src/components/nutrition/food-photo-flow.tsx:108-119` |

**Unknowns:** all claims; status; whether '002 exists under that number; the newer MyFitnessPal "food knowledge graph" patent (US 12,417,837, lead only).

**What counsel needs to evaluate:** '751 independents against `matchStrength`/`initialItems` and against plain food search.

### 5.10 Unresolved applications — US 2026/0196331 A1 and US 2026/0204388 A1

**No record found, three times now.** Titles, owners and claimed concepts come from the original brief and press releases, not from any patent record. Pending claims can change, so even a found publication would not be final.

Code facts for counsel, should the publications be located:

| Topic | Code observation | Where |
|---|---|---|
| Barcode capture and lookup | **PRESENT IN CODE.** Native scanner / ZXing; GTIN validation; Open Food Facts lookup | `src/lib/barcode.ts:56`; `src/server/services/open-food-facts.ts:12`; `src/server/services/food-resolve.ts:22-27` |
| Image capture of an ingredient label + AI | **PRESENT IN CODE.** The AI is instructed to transcribe only; fixed rule tables then list additives, sugars, sodium sources and allergens from the corrected text | `src/lib/domain/label-photo.ts:1-8,11-30`; `src/lib/label-analysis.ts:75,135,200` |
| Health-condition or medication profile | **NOT FOUND IN CODE** in nutrition files. Coach memory screens out medical terms | `src/lib/coach/memory.ts:119-122` |
| Personalised compatibility evaluation | **PRESENT IN CODE** as comparison with the member's calorie/macro targets, diet style and chosen allergen filters | `fitsYourGoals`, `src/lib/food-iq.ts:405` |
| Go / No-Go or safe / unsafe verdict | **NOT FOUND IN CODE.** AI rules forbid medical or allergy guarantees | `src/lib/food-quality-ai.ts:21-22` |
| AI-generated food score | **NOT FOUND IN CODE.** Score is a fixed formula (`50 + 2.5P − 1.5N`; drinks `80 + 2.5P − 2N`), same for every member | `food-iq.ts:140-147,234` |
| Score shown to members | Off unless `FOOD_IQ_SCORE=on` | `food-iq.ts:27-28`; `.env.example:107` |
| Wearable input to a food score | **NOT FOUND IN CODE** | `food-iq.ts:147` (inputs are product nutrients) |

**What counsel needs to do:** search Patent Center by number, applicant (Ingredient IQ LLC; IndulgeRx Brands Inc.) and the WO numbers given in the earlier report (WO2026156104 / 106 / 110 — themselves unverified).

### 5.11 Meal-photo estimation families (SRI/Passio, doinglab, Fitly, US 12,182,982) — all UNVERIFIED

No record was retrieved. Code facts only:

| Topic | Code observation | Where |
|---|---|---|
| Image sent to a model that returns items, portions, grams, calories, macros, confidence | **PRESENT IN CODE.** One photo to a third-party general LLM with a fixed output schema | `food-photo.ts:16-37,39-49`; `src/server/services/food-photo.ts:53-65` |
| Per-item bounding boxes / segmentation | **NOT FOUND IN CODE** (not in the output schema) | `food-photo.ts:16-37` |
| Volume from multiple images / depth sensing | **NOT FOUND IN CODE.** Single image; grams are the model's visual estimate | `food-photo.ts:26,43` |
| Speech input | **NOT FOUND IN CODE** | — |
| Barcode detector overriding food recognition ('942,208 lead) | **NOT FOUND IN CODE.** The model only sets a `packaged` flag that suggests scanning | `food-photo.ts:19,49` |
| Clarifying questions; member confirmation | **PRESENT IN CODE** | `food-photo.ts:35,104-159`; `food-photo-flow.tsx:112-119` |
| What happens inside the third-party model | **UNCLEAR.** Not visible in this repository | — |

### 5.12 AI coach context and memory

No specific patent was cited by the prior reports for this feature, and none was searched today beyond a note that Peloton LLM-coaching filings were "reported as pending". **Search gap.** Code facts:

| Topic | Code observation | Where |
|---|---|---|
| Athlete snapshot placed in the system prompt | **PRESENT IN CODE** | `src/server/services/ai-coach.ts:265-267,536-543` |
| Stored memories (≤ 100 items, ≤ 300 chars; 50 / 6,000 chars into context) | **PRESENT IN CODE.** Saved only through a proposal the member confirms; duplicate check by word similarity; medical terms screened | `src/lib/coach/memory.ts:42-47,82-92,119-122,155`; `src/lib/coach/tools.ts:109,327` |
| Recall of earlier conversations | **PRESENT IN CODE** (tool) | `src/lib/coach/tools.ts:289`; `src/server/coach/tools.ts:538` |
| Embeddings / vector search | **NOT FOUND IN CODE** in the coach memory files | `memory.ts` |
| Model routing by task | **PRESENT IN CODE** (fast vs larger model, monthly cap) | `src/lib/coach/routing.ts:15,65-74` |
| Data-changing tools are proposals needing confirmation | **PRESENT IN CODE** | `src/lib/coach/tools.ts:6,130-138` |

---

## 6. Findings

Severity reflects how much is unknown and how close the feature's function sits to what the patent is reported to describe. It is **not** a likelihood of infringement. "Blocks public launch" follows the task's scale: Y / N / counsel.

| # | Finding | Severity | Confirmed vs suspected | Evidence | Business impact | Recommended action | Counsel must decide | Blocks public launch | Can technical testing resolve it? |
|---|---|---|---|---|---|---|---|---|---|
| P1 | **No independent claim text exists in the project file for any patent**, after three research passes from a network-restricted environment | High (process) | **Confirmed** | §1; prior reports' own limits | Every chart is provisional; the founder cannot rely on any "low" note | Have counsel, or anyone with open internet, pull claims and register data for the §3 table; then re-run §5 | Y | counsel | N |
| P2 | Fitbod family ('760, '666, '454, '757, pending '346) vs adaptive review, lift analysis and coach proposals | High — needs counsel | **Suspected** functional overlap (plateau → proposed change; weekly aggregation). Claims unknown | §5.1, §5.2; D3 | Pro adaptive training and AI coach are headline paid features | Counsel review of independents. Keep design notes showing rules are deterministic and member-approved. No code change without owner approval | Y | counsel | N (facts in §5 can be confirmed by tests; the legal question cannot) |
| P3 | Amazon '629 / '693 vs Body Scan guided multi-direction capture and upload | High — needs counsel | **Suspected.** Capture guidance and upload confirmed in code; image processing not found. Claims unknown | §5.8 | Pro Body Scan | Counsel review of independents and continuations. Document that no image analysis occurs | Y | counsel | N |
| P4 | Oura '640 / '771: imported naps are now classified by duration and time of day; **prior chart is outdated** | Medium | **Confirmed** code change; relevance **suspected** | §5.5; D1 | Sleep import (Apple Health / Health Connect) | Counsel reads '640/'771 independents against `importedSessionKind` and `nightOf`. Resolve the date conflict | Y | counsel | N |
| P5 | WHOOP is enforcing four patents against a software-only app; sleep debt + bed window + new load summary sit in the same product space | Medium | Litigation **confirmed** (docket extract); overlap **suspected**; one element (strain-based debt) not found in code | §5.7; D4 | Sleep & Recovery; coach recovery summary | Counsel reads the asserted claims and follows the docket. Keep strain / HR-derived metrics out unless reviewed | Y | counsel | N |
| P6 | MyFitnessPal '751 vs LLM search term → pre-selected USDA record; '002 unresolved | Medium | Title **confirmed**; overlap **suspected**; claims unknown | §5.9 | Meal photo (Pro) | Counsel review. Owner already noted an option (pre-fill a search instead of pre-selecting) — an option only | Y | counsel | N |
| P7 | Meal-photo estimation families not opened at all | Medium (search gap) | **Confirmed** gap | §5.11; prior U9 | Meal photo (Pro) | Commission a targeted search (e.g. CPC G06V 20/68, G16H 20/60) | Y | counsel | N |
| P8 | US 2026/0196331 A1, US 2026/0204388 A1 do not resolve; label-photo feature has since been added | Medium (unknown) | **Confirmed** unresolved | §5.10; D6 | Label check; Nutrition Score (off) | Counsel searches by applicant and number. Keep the score flag off until answered | Y | N for the score while off; counsel for label check | Partly: a test can confirm the score is hidden when the flag is off |
| P9 | Optional map-tile background now exists; prior Apple/TomTom charts assumed none | Low–Medium | **Confirmed** code change; off by default | §5.3, §5.4; D2 | Run tracking | Counsel reads Apple '790 independents before tiles are enabled. Record the production value of `NEXT_PUBLIC_MAP_TILE_URL` | Y (before enabling) | N while tiles are off; counsel if on | Partly: a build check can confirm no tile requests are made |
| P10 | Oura '429: IPR status conflicting; app shows HR/HRV beside self-reported readiness | Low–Medium | Conflict **confirmed**; overlap **suspected** only for adjacent display | §5.6 | Readiness check-in; coach context | Counsel checks PTAB; confirms claim 1 | Y | counsel | N |
| P11 | TomTom '059: spline not found in code; fee reported paid | Low | Code facts **confirmed**; status second-hand | §5.3 | Run tracking | Confirm fees and claims; no action otherwise | Y (light) | N | N |
| P12 | Oura sleep-pattern family; US 2024/0350078 A1 unresolved | Low | Number unresolved **confirmed** | §5.6 | Sleep schedule | Confirm the number; read '187/'313 claim 1 | Y (light) | N | N |
| P13 | Food-scoring and sleep-scoring landscape (Guiding Stars, WW, Nestlé, Fitbit) not re-checked | Low | **Confirmed** not re-checked | §3 | Nutrition Score (off); sleep score | Check status before the score flag is turned on; read Fitbit claim 1 | Y before the flag is on | N while off | N |
| P14 | No search for AI-coach memory/context, social challenges/friends (this branch), or the dormant form-analysis module | Low–Medium (search gap) | **Confirmed** gap | §5.12; D8; §8 | Coach; Friends (flag off); future form analysis | Add to the commissioned search scope | Y | N for dormant/flag-off features; counsel for coach | N |
| P15 | Prior reports' commits are not in repo history; their line numbers are stale | Low (record-keeping) | **Confirmed** | §2 | Counsel cannot reproduce the earlier charts | Treat this document's file:line references (commit `3b9bc44`) as the current set; re-pin if code changes before counsel reads it | N | N | Y (re-run the references) |

---

## 7. Unresolved claim list (priority order)

1. **Fitbod US 12,551,760 B2** — all independent claims. Is a machine-learned model in each? Does "modify" require automation?
2. **Amazon US 11,232,629 B1 / US 11,580,693 B1** — all independent claims. Does any stand on guided capture + transmission alone?
3. **Oura US 12,614,640 B2 / US 12,165,771 B2** — claim 1; cut-off, score-update and confirmation elements; correct dates.
4. **WHOOP US 12,318,226 B2, 11,602,279, 11,627,946, 12,220,112** — asserted claims; outcome of the 2026-10-29 order.
5. **Fitbod US 12,109,454 B2 / US 12,551,757 B2 / US 2024/0424346 A1** — claim 1; "aggregate capability" and "moving average".
6. **MyFitnessPal US 11,347,751 B2** (and whether US 12,008,002 B2 is the right number) — claim 1; status.
7. **Meal-photo families** — existence, status and claims of each number in §3.
8. **US 2026/0196331 A1 and US 2026/0204388 A1** — do they exist under these numbers?
9. **Apple US 12,163,790 B2** — independents; is map matching in each?
10. **Oura US 10,842,429 B2** — claim 1; IPR2024-01080 outcome.
11. **Fitbod US 12,555,666 B2 / US 12,347,542 B2** — assignee of '666; claims.
12. **TomTom US 9,891,059 B2** — claims 1 and 16; fee record.
13. **Oura US 11,478,187 B2 / US 11,986,313 B2; US 2024/0350078 A1** — claim 1; whether '078 exists.
14. **Fitbit US 10,111,615 B2 / 10,555,698 B2; Guiding Stars; WW; Nestlé** — status and claim 1.

---

## 8. Not searched, and design options

**Not searched (stated so nobody assumes otherwise):** AI/LLM coaching, agent-memory and conversational-recall patents; social features (friends, challenges, leaderboards — this branch, flag off); pose-based form analysis; barcode-scanning hardware; push-notification, subscription and payment patents; any non-US patents; design patents; pending applications generally.

**Design options — listed neutrally for counsel and the owner. None is a recommendation to change the product, and none should be made without owner approval and counsel's view of the real claims.**

| Area | Option that exists in principle | Trade-off |
|---|---|---|
| Adaptive training | Keep trend rules deterministic and documented; keep member acceptance as the only path to a change | Already the current design |
| Lift analysis | Present per-session figures instead of weekly buckets | Loses the weekly view the coach uses |
| Body Scan | Make the outline, timer and pose order optional aids | Less consistent photos |
| Sleep import | Store every import as a night and let the member mark naps; or ask the member to confirm a suggested nap | Naps may inflate a night's totals; or adds a step (and a confirmation step is itself something the Oura family is reported to describe — counsel should weigh this) |
| Meal photo | Pre-fill a food search instead of pre-selecting a strong match | One more tap for the member |
| Run map | Leave tiles off; or keep tiles display-only | No street context on the route |
| Recovery | Keep HR/HRV display-only; no HR-derived load or readiness number | Already the current design |
| Nutrition Score | Keep the flag off until the score-related items are answered | Feature stays hidden |

---

## 9. Sources

**All retrieved 2026-11-16 through a web-search tool's extracts. None was opened directly; direct access was blocked (§1).**

- Fitbod: https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12551760 · https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12555666 · https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12109454 · https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12551757 · https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12347542 · https://patents.google.com/patent/US20240424346A1/en · https://patents.justia.com/assignee/fitbod-inc · https://patents.justia.com/inventor/allen-chen
- Amazon: https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11232629 · https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11580693 · https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12165271 · https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11854146 · https://patents.justia.com/inventor/aneeb-qureshi · https://patents.google.com/patent/US11903730B1/en
- TomTom: https://patents.google.com/patent/US9891059B2/cg-RX-API-DMAC7.html · https://patents.google.com/patent/US20140350850A1/en · https://patents.justia.com/inventor/marcin-michal-kmiecik
- Apple: https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12163790 · https://patents.google.com/patent/US12163790
- Oura: https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12614640 · https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12165771 · https://patents.google.com/patent/US12165771B2/en · https://patents.justia.com/assignee/oura-health-oy · https://patents.google.com/patent/US10842429B2/en · https://patents.google.com/patent/WO2016135382A1/en · https://ptacts.uspto.gov/ptacts/public-informations/petitions/1556908/download-documents?artifactId=NG_2u6-1BrWAo_P2G5IA9mBAtVmvDn6LhqxtIZyLJhqrrCj7H6dTMTg · https://www.9235.net/patent/US11986313B2.html (third party)
- WHOOP: https://patents.google.com/patent/US20240252121A1/en · https://patents.justia.com/assignee/whoop-inc · https://dockets.justia.com/docket/delaware/dedce/1:2026cv00289/92454 · https://ai-lab.exparte.com/case/dct/ded/1:26-cv-00289/doc/1 · https://www.pacermonitor.com/public/case/63631790/Whoop,_Inc_v_Finerpoint,_Inc · https://litigation.rpxcorp.com/litigation/dedce-92454-whoop-v-finerpoint
- MyFitnessPal: Google Patents record for US11347751B2 (URL not returned by the tool) · https://www.htsyndication.com/us-fed-news/article/us-patent-issued-to-myfitnesspal-on-sept.-16-for--food-knowledge-graph-for-a-health-tracking-system---texas-inventors-/22213973830 · https://www.patentguru.com/assignee/myfitnesspal-inc

**Searches that returned no record on 2026-11-16:** "US20260196331A1"; "US20260204388A1"; "US20240350078A1" / "US 2024/0350078"; "US12008002B2" / "12,008,002"; "US12182982B2" with SRI and doinglab numbers.

**Searches that returned the patent but no claim text:** every other number in §3 that was searched.

**Code read (commit `3b9bc44`, read-only):** `src/lib/domain/{adaptive-training,load,strength,readiness,program-generator,gps-track,map-tiles,body-scan,sleep,sleep-score,sleep-schedule,sleep-debt,sleep-import,sleep-training,sleep-energy,food-photo,label-photo}.ts` · `src/lib/coach/{tools,memory,routing,lift-analysis,recovery-summary,program-recommendations}.ts` · `src/lib/{food-iq,food-quality-ai,label-analysis,barcode,native-sleep}.ts` · `src/lib/form-analysis/{index,analyze,segmentation}.ts` (headers) · `src/server/services/{adaptive-training,ai-coach,body-scan,food-photo,food-resolve,usda-local,open-food-facts}.ts` · `src/server/actions/{adaptive-training,body-scan,sleep-import}.ts` · `src/components/run/{route-map,gps-recorder}.tsx` · `src/components/body-scan/{scan-capture,consent-card}.tsx` · `src/components/nutrition/food-photo-flow.tsx` · `package.json` · `.env.example`. Most files were read in part (headers, exported functions and the lines cited), not line by line.
