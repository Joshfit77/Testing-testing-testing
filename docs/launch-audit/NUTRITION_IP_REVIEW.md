# Nutrition features: intellectual-property desk research (Cal AI, MyFitnessPal, meal photos, labels, food data)

**Date:** 2026-11-03.
**Status:** desk research for attorney review. **This is not legal advice, a clearance search, or an opinion on
infringement, non-infringement or freedom to operate. No legal clearance is claimed.**

It builds on, and doesn't repeat, three earlier reviews:
- `FINAL_PATENT_REVIEW.md` (item U9, the meal-photo gap);
- `FINAL_TRADEMARK_REVIEW.md` (NUTRI-SCORE, FOOD IQ Reg. 4,337,059, and item U4, "Narrow Gate Nutrition Score");
- `FINAL_PRIVACY_AND_LEGAL.md` §2c/§2e (Anthropic, Open Food Facts, USDA).

**How reliable the sources are:**
- **(F)** means read directly.
- **(S)** means a search-engine summary only, not verified.
- Direct fetches of most sites (techcrunch.com, passio.ai, myfitnesspal.com, fdc.nal.usda.gov, openfoodfacts.github.io,
  USPTO) failed from the research environment.
- No USPTO status (TSDR) record and no patent claim set was read. Every patent below needs its claims and status pulled.

## 1. What the app does (the facts counsel needs)

| Feature | What it does | What it does *not* do |
|---|---|---|
| **Meal photo** (`/nutrition/photo`, Pro) | Sends one photo to Anthropic's Claude for food names, portions and macros as **estimates**. Matches each item to the app's bundled **USDA SR Legacy** data by a plain word match. The member corrects everything before saving. | No volume or depth sensing; no own recognition model; no competitor data; no accuracy claim; no additive or allergen inference from a photo. |
| **Barcode scan** (`/nutrition/scanner`) | Looks up the code in **Open Food Facts** (ODbL) and shows its nutrition, ingredients and allergens. | No MyFitnessPal or Cal AI data; no scraping. |
| **Label check** (`/nutrition/label`, new) | Typed text is free. A **photo** (Pro) is transcribed by the AI, word for word; the member corrects the text. The app's own rule tables then list additives, sugars, sodium sources and allergens. | No health-condition profile; no personalised "safe / unsafe" or Go/No-Go verdict; the AI doesn't analyse ingredients. |
| **Nutrition Score** | An original formula (FIQ-0.1), off by default. | Not Nutri-Score's tables; not shown under the FOOD IQ name. |

## 2. Cal AI

- **Owner:**
  - Founded by Zach Yadegari and Henry Langmack (S).
  - **MyFitnessPal announced its acquisition of Cal AI on 2026-03-02.** Cal AI stays a standalone app (S, TechCrunch).
  - Treat the two as one rights-holder group.
- **Marks:**
  - CAL AI, Ser. 99039125, owned by Viral Development LLC, class 9, filed 2025-02-12 (S).
  - A separate CAL AI application, Ser. 99001636, from California Intelligence Inc. (S).
  - CAL SCANNER, Ser. 99875211, pending, for food image recognition (S).
  - Status and any assignment of these: **not verified**.
- **Trade dress (uncertain):** an apple-icon splash, goal and pace onboarding, a weight graph, and heavily tested
  paywalls (S).
- **Patents:** none found (search only).
- **Accuracy:** an NIH study presented at NUTRITION 2026 reported Cal AI underestimating meals by about 345 kcal (S).

## 3. MyFitnessPal

- **Owner:**
  - Francisco Partners bought MyFitnessPal from Under Armour in 2020 (S).
  - MYFITNESSPAL, Ser. 77946984, is listed under Under Armour (S). Its registration number, status and current owner are
    **not verified**.
- **Meal Scan:** a Premium feature (S). Whether Passio powers it is unverified.
- **Terms of service:** a personal, non-commercial licence that prohibits copying, derivative works and reverse
  engineering (S). The FAQ asks people not to scrape the site (S). The food database is crowdsourced (S).
- **Patents (claims not read):**
  - **US 11,347,751 and 12,008,002** (MyFitnessPal Inc.): matching food text to food-database records, with
    machine-learning-derived queries (S). **The most relevant family for this app.** See §5.
  - Also US 10,387,931, US 11,887,719, a recipe-logging family (10,966,469 / 11,537,685 / 11,899,738 / 12,164,592) and
    US 10,671,893 (S).

## 4. Other patents worth review (all S; claims and status not read)

| Patent | Listed holder | Gist (from descriptions) | Nearest app feature |
|---|---|---|---|
| US 9,734,426; 9,916,520 | SRI International (Passio lists '426) | Photo of a plate → per-item boxes, IDs, confidence, nutrition | Meal photo |
| US 8,439,683; 8,345,930 | SRI / Passio | Recognition from images + speech; volume per item | Meal photo (no speech, no volume) |
| US 11,830,603; 11,688,187 | doinglab Corp. | AI nutrition estimate from meal photos | Meal photo |
| US 9,349,297; 9,892,656; US 2017/0069225 | Fitly Inc. | Food-image recognition; volume from several images | Meal photo (one image, no volume) |
| US 12,182,982 | unknown | Nutrition estimate by a multimodal LLM with depth images and segmentation | Meal photo (no depth, no segmentation) |
| US 10,332,053; 12,682,300 | unknown | Scan a UPC or menu tag, then log to a consumption log | Barcode → diary |
| US 11,942,208 | unknown | Barcode detector overrides the object detector in food recognition | Meal photo "packaged" note (no detector; the model only flags packaging) |
| US 8,630,448; US 6,652,455 | Intuit; an individual | Image-based nutrition monitoring; barcode intake logging | Google Patents marks them expired (fee-related); not verified |
| US 2026/0196331 (application) | Ingredient IQ LLC | Health profile + ingredient image capture + AI analysis → personalised Go/No-Go (`B_PATENT_CLAIM_CHARTS.md`) | **Label check** (see §5) |

## 5. Design notes for counsel: where the app is closer or further

1. **Meal photo → USDA match vs MyFitnessPal '751/'002.**
   - **What the app does:** the AI's item name is used as a search term. The app's own word-match rules (no machine
     learning) pick a public-domain USDA record. The member sees the match and can undo it.
   - **What changed:** the match now **pre-selects** strong matches (before, it only pre-filled a search).
   - **Ask:** whether any independent claim reads on "model-generated query → food-database record". If so, the
     pre-selection could revert to a pre-filled search (a one-line change in `initialItems`).
2. **Label photo vs US 2026/0196331.**
   - **Shared elements:** image capture of an ingredient label, and an AI.
   - **Elements absent:** no health-condition profile, no personalised compatibility evaluation, no Go/No-Go verdict.
     The AI only transcribes; the analysis is a fixed rule table applied to text the member corrected.
   - **Ask:** to read the claims once the publication can be obtained.
3. **Meal photo vs the SRI/Passio, doinglab, Fitly and US 12,182,982 families.**
   - The app sends one ordinary photo to a third-party general model.
   - It does no volume estimation from multiple images, no depth sensing and no segmentation.
   - **Ask:** pull the claims and status.
4. **Barcode → diary vs US 10,332,053 / 12,682,300.** Barcode logging is widespread (and older patents are expired),
   but these two need status and claims checked.

## 6. Names and branding

- **The app uses:** "Meal photo", "Check a label", "Nutrition Score".
- **The app does not use:** "Meal Scan", "Snap", or any name starting "Cal".
- **No copied competitor material:** no competitor logo, colour, screenshot, onboarding sequence or paywall pattern
  was copied. The app's black-and-gold design is its own.
- **Keep avoiding:**
  - names starting **"Cal"** (two CAL AI applicants and CAL SCANNER are in this exact field);
  - **"Meal Scan"** (MyFitnessPal's feature name, though no registration was found);
  - **"Snap"** (Snap Inc. enforces SNAP in classes 9/42; SnapCalorie is a direct competitor; USDA's SNAP logo).
- **Open from before:** item U4, "Narrow Gate Nutrition Score" (`src/lib/food-iq.ts:24`).
- **Code comments:** "MyFitnessPal-style" appears only in code comments (e.g.
  `src/components/nutrition/diary-client.tsx:29`). It isn't user-facing; renaming it would be tidy, not required.

## 7. Food data and AI terms

- **USDA FoodData Central / SR Legacy:**
  - Public domain (CC0) (S).
  - USDA asks for the citation "U.S. Department of Agriculture, Agricultural Research Service… FoodData Central".
  - **Action:** confirm the citation appears on an About or Sources screen.
- **Open Food Facts:**
  - ODbL (database), DbCL (contents), CC BY-SA (images); attribution on every screen that uses the data (S). The
    product page shows it.
  - **Share-alike:** a database built from OFF data and used publicly must be offered under the ODbL.
  - Each member's own `foods` rows copy the products they log. That is per-member and unpublished, and the
    documentation now says so (`docs/FOOD_QUALITY.md`). **Never build a shared food database from those rows without
    legal review.**
  - API conditions: a custom User-Agent (done), and 10 searches per minute per IP (the app throttles to 8 a minute
    **per server instance**, so several instances could exceed it).
- **No competitor data:** no MyFitnessPal or Cal AI data is used, and none may be scraped (their terms forbid it).
- **Anthropic (Commercial Terms, effective 2025-06-17, read directly):**
  - Anthropic doesn't train on customer content.
  - The customer owns the outputs, and a data processing addendum (DPA) applies.
  - The customer warrants it has the rights to send its inputs.
  - The customer **must tell users that factual statements in outputs shouldn't be relied on**. The meal-photo and
    label screens say "Estimated from a photo, not measured" and "Read from your photo by AI: check every word".
    Counsel should confirm that meets section D.3.
  - Retention (30 days by default, or 7 by another source; zero retention by approval) is **unverified**.

## 7a. Ingredient analysis and Nutrition Score: originality

- **Ingredient evidence:** the explanations (`src/lib/additive-evidence.ts`, `src/lib/additive-origins.ts`) are
  written by the app from public regulatory and scientific sources (EU regulations, EFSA, WHO/IARC/JECFA, US FDA and
  CFR, peer-reviewed papers). They're listed with their verification status in `docs/ADDITIVE_EVIDENCE_SOURCES.md`.
  - No text, ratings, colours or classifications come from Yuka, Cal AI, MyFitnessPal or any other app.
  - There's no numerical "toxicity" or hazard score for ingredients.
- **Nutrition Score:** an original formula (FIQ-0.1, `docs/FOOD_IQ_METHOD.md`) with anchors from public regulations
  and guidance. It doesn't reproduce Nutri-Score's point tables.
  - The Nutri-Score grade shown on product pages is the one Open Food Facts computed. Earlier trademark review covers
    the NUTRI-SCORE mark.
- **Label check:** the photo reader transcribes text; the analysis uses the app's own rule tables. The allergen word
  lists are generic food vocabulary for the 14 EU-regulated allergens.

## 8. Marketing claims

- No "accurate to X%" claim is made anywhere. Estimate quality hasn't been measured (`docs/FOOD_PHOTO.md`), and
  independent research suggests photo apps underestimate.
- Any comparative claim (e.g. in `docs/APP_AUDIT.md`) must use current facts. MyFitnessPal and Cal AI are now one
  company.

## Questions for counsel (in order)

1. MyFitnessPal US 11,347,751 / 12,008,002, against the USDA pre-selection (§5.1).
2. US 2026/0196331, against the label check (§5.2), once the publication can be obtained.
3. The meal-photo families: SRI/Passio, doinglab, Fitly, US 12,182,982 (§4, extending U9).
4. Barcode-logging families US 10,332,053 / 12,682,300.
5. Names: Cal, Snap, Meal Scan; item U4; the TSDR status of Ser. 99039125, 99001636 and 77946984.
6. ODbL share-alike and the per-member `foods` copies; image credits under CC BY-SA.
7. Anthropic DPA retention terms and the user notice required by section D.3.
8. How any future accuracy or comparative claim must be substantiated.
