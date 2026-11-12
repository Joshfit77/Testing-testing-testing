# C. Trademark review (research notes, not a clearance opinion)

Prepared 2026-10-25. **Method and limits:** the sandbox cannot reach USPTO TSDR/TESS or Justia directly; every USPTO fact below comes from third-party mirrors (Justia, TrademarkElite, Gleanmark, uspto.report) found through web search, and is labelled **confirmed** only when a snippet literally stated it (URL given). "Unverified" means no source was seen. Nothing here clears any name; the attorney list at the end is what still has to be done.

## C.1 FOOD IQ (the name the app used until this branch)

**US Reg. 4,337,059 / Serial 85481822** — confirmed from the Justia mirror (https://trademarks.justia.com/854/81/food-85481822.html):

- Mark FOOD IQ, standard characters, "FOOD" disclaimed; filed 2011-11-28, registered 2013-05-21, first use claimed 2006.
- Classes 035, 041, 042: business consulting/information services for the food industry, training for sales and culinary professionals, product/menu/recipe development. **No class 9 (apps), no consumer nutrition services.**
- Status shown on the mirror: "705 – Partial Section 8 & 15 Accepted and Acknowledged" (2019-04-23): class 041 partially cancelled, classes 035 and 042 kept.
- **Unverified:** whether the ten-year Section 8/9 renewal (window 2022-05-21 → 2023-05-21, grace to 2023-11-21) was filed. No 2023 entry appears in any mirror snapshot. **Current live/dead status must be pulled from TSDR.**
- Owner of record hidden behind a login on the mirror; the snippet says an LLC was entered as a second owner after registration. Inference (not confirmed): the Springfield, MO foodservice-analytics business "Food IQ" (foodiq.net), part of Marlin Network → Advantage Solutions (https://www.crunchbase.com/organization/food-iq).

**Other FOOD IQ / FOODIQ records (mirrors):**

| Mark | Serial / Reg. | Owner | Goods | Status (as shown) |
|---|---|---|---|---|
| FOODIQ | 88541072 / Reg. 6196321 | ZeroCater, Inc. | corporate catering coordination (cl. 43) | Registered 2020-11-10 (https://www.trademarkelite.com/trademark/trademark-detail/88541072/FOODIQ) |
| FOOD IQ | 77069893 | — | — | Abandoned 2008, no statement of use |
| FERMENTED FOODIQ | 98259196, 88895940, 88984803 | — | protein products | not captured |
| FEEDING YOUR FOOD IQ; HIGH FOOD IQ; IQ FOODS RE-FRESHED | 86932522; 76575480; 90135373 | various | — | not captured |
| (two marks, text not shown) | filed 2025-05-12 | **Ingredient IQ LLC** | "downloadable mobile applications using artificial intelligence for scanning lists of ingredients on food product labels" tailored to dietary preferences/allergies | pending (https://gleanmark.com/owner/ingredientiqllc) — the same company behind Patent 1 |
| (image mark) | WO0000001857891 (Madrid/UK, 2025-05-07) | Foodiq Oy (Finland) | cl. 40, 43 | UK designation (https://www.ipo.gov.uk/t-tmj/tm-journals/2025-025/WO0000001857891.html) |

**Market use of "FoodIQ" for nutrition apps (unregistered, confirmed by store listings):** "FoodIQ: Food Scanner" (Lurra, LLC; barcode scanner giving a health assessment — the closest functional overlap), "Ingredient Checker – FoodIQ" (0–100 rating from nutrition/additives/processing), "FoodIQ: Food & Calorie Tracker", FoodIQ (Google Play, com.app.foodiq), "FoodIQ – AI calories tracker" (foodiq.pro), FOODiQ Global (Australia, nutrition science), WISEcode's "Ingredient Quality (IQ) score".

**Conclusion of the research (not legal):** the term is crowded in exactly this product category, one registration exists in classes 35/42 (status to confirm) and another in class 43, and a direct competitor's app uses the name. The owner's decision to stop public use is well supported. **Done on this branch:** every member-visible "Food IQ" is now "Nutrition Score" (see D); internal identifiers, the `FOOD_IQ_SCORE` flag, file names and stored data keep their names.

## C.2 "Nutrition Score" (the temporary replacement)

- **No US registration of the plain phrase was found** (not proof of absence). Nearby dead records: THE NUTRIENT SCORE V (87153536, abandoned 2017); NUVAL 1-100 NUTRITIONAL SCORING SYSTEM NUTRITION FACTS (77633814, abandoned 2011, with "NUTRITIONAL SCORING SYSTEM" disclaimed).
- **NUTRI-SCORE is registered in the US:** Reg. 6,160,878 (Serial 79278346, Madrid), owner Agence nationale de santé publique (Santé publique France), registered 2020-09-29; also NUTRI-SCORE ABCDE (79278494). Goods/services seen: publications and education in dietetics and nutrition (https://trademarks.justia.com/792/78/nutri-79278346.html). Use of the Nutri-Score logo/letters is governed by SpF's conditions of use.
- **Descriptiveness (explanation, not a conclusion):** a label that names a score of nutrition is the kind of wording the USPTO treats as merely descriptive (TMEP §1209.01(b)); as a feature label it is unlikely to be protectable by the owner, and unlikely to be owned by anyone else as a plain phrase. The question for counsel is likelihood of confusion with NUTRI-SCORE (similar sound and meaning, nutrition-education services), which becomes more pressing if the UI ever shows an A–E letter and colour band like the Nutri-Score logo. **The app does not use letters or Nutri-Score colours for its own rating** (bands are words: Excellent/Good/Moderate/Poor/Very poor, `src/lib/food-iq.ts:23-29`). The product page does display the product's *official* Nutri-Score grade from Open Food Facts as a recognised indicator; that is the product's own label data, but counsel should confirm whether showing it needs SpF registration (SpF's conditions of use apply to using the mark).
- **Not asserted:** that "Nutrition Score" is cleared. It is a descriptive placeholder until a distinctive name is searched and cleared.

## C.3 NARROW GATE FITNESS

**USPTO records found (mirrors):**

| Mark | Serial | Owner | Goods/services | Status (as shown) |
|---|---|---|---|---|
| NARROW GATE | 98164045 | NM Global Ventures, LLC | leather goods / horse halters | Abandoned (no statement of use), 2025-03-10 |
| NARROW GATE PROFORMANCE SPORTS | 85091438 | Narrow Gate Electrical Services, LLC | athletic apparel (cl. 25) | Abandoned 2012 |
| THE TIME IS NOW | 85091534 | Narrow Gate Electrical Services, LLC | cl. 41 athletic training, fitness consulting, personal training | Abandoned 2011 |
| NARROWGATE VENTURES | 98635715 | Alexander McElfish | cl. 35 business advice | filed 2024-07-07; **status unverified** |
| NARROW PATH ATHLETICS | 98657296 | individual | cl. 41 physical fitness training, personal training; first use claimed 2020 | filed 2024-07-19; **status unverified** |
| NARROW PATHS. HIGH PLACES.; NARROW PATH; NARROWTIVE | 97833162; 88960794; 90339834 | — | clothing; —; Christian counselling | not captured |

No filing for "NARROW GATE FITNESS", "NARROWGATE", "NARROW GATE TRAINING/CROSSFIT/ATHLETICS/STRENGTH" or "NARROW PATH FITNESS" surfaced in any phrasing (unverified by a direct USPTO search).

**Unregistered (common-law) use in fitness, confirmed from the businesses' own pages:**

- **Narrow Gate Strength & Conditioning**, Chambersburg, PA — active; 12-week coaching packages and nutrition coaching (https://www.narrowgatestrength.com/). Closest services overlap (training + nutrition).
- **Narrow Gate Club**, Greensboro, NC — "faith-based wellness community" inspired by Matthew 7:13-14 (https://www.narrowgateclub.com/). Closest *positioning* overlap.
- **Narrow Gate Athletics** — youth baseball camps, homeschool PE (https://www.narrowgateathletics.com/).
- **CrossFit Narrow Gate**, Phoenix, AZ — listed as closed/out of business (BBB, MapQuest).

**Apps:** no App Store or Google Play app titled "Narrow Gate" was found. Related: Narrow Gate Labs (UK app studio, non-religious apps), "Prayer Gate" (narrowgate-app.github.io, pre-release), TheGate Mobile App (Christian radio; description mentions "the Narrow Gate"), NarrowPath (Bible teaching app).

**Ministries and other businesses using the phrase (outside fitness):** Narrow Gate Foundation (TN; also "Narrow Gate Leather", "Narrow Gate Coffee"), several Narrow Gate Ministries, Narrow Gate Entertainment (KY), The Narrowgate Press (UK), Narrow Gate Electrical Services.

**Research conclusion (not legal):** no registered NARROW GATE mark in classes 9/35/41/42/44 surfaced; the fitness-class filings by Narrow Gate Electrical Services are abandoned. The risk picture is **common-law prior use** by an active PA strength-and-nutrition coaching business and a NC faith-fitness community, plus a pending NARROW PATH ATHLETICS application in class 41. "Narrow Gate" is also a widely used biblical phrase, which weakens distinctiveness and adds crowding. **No rebrand is recommended on this evidence**; a proper search and an attorney's assessment of the two active businesses are needed before filing. The app name is preserved pending that clearance, as the brief instructs.

## C.4 Feature names and slogans used in the app

Inventory (from the UI and data files): "Narrow Gate Fitness"; tagline "Rooted in faith. Built for strength." (`src/app/layout.tsx:35`); "Faith & Discipline"; "40 Days Through the Narrow Gate"; "Sleep & Recovery"; "AI Coach"; "Body Scan"; "Nutrition Score" (was Food IQ); "Food Quality" (one label); tiers "Free", "Plus", "Pro"; ranks and 25 achievements (descriptive names); "Scripture of the day" style verse card.

| Name | What was found | Reading |
|---|---|---|
| Faith & Discipline | No exact record. Crowded "Faith & Fitness" field: FAITH & FITNESS Reg. 4896606 (spiritual retreats); FAITH & FITNESS 88418874 and FAITH + FITNESS 88857119 (apparel); FAITH AND FITNESS 97295753 (2022, fitness + spiritual growth, pending at capture) | Descriptive section label; the records matter only if marketing ever uses "Faith & Fitness" wording |
| 40 Days Through the Narrow Gate | No exact result. Related: 40 DAYS FOR LIFE 87434733 (religious services, active); 40 DAY RITUALS Reg. 5804745 (yoga/fitness; "40 DAY" disclaimed); 40 DAYS TO FLOURISHING 98062682 (wellness/spiritual coaching, active) | "40 Days" is routinely disclaimed; the distinctive part is "Narrow Gate" (C.3) |
| Sleep & Recovery | SLEEP & RECOVER 86717122 (supplements, abandoned); SLEEP, RECOVER, PERFORM. Reg. 5120890 (cl. 44 medical services); SLEEP PERFORMANCE SCORE 50006830 (filed 2026) | Generic feature name |
| AI Coach | AI COACH 97229256 (R3 Collaboratives, teacher-education services; status not shown); many "…AI coach" marks in other fields | Descriptive feature label; not fitness-class |
| Body Scan | BODYSCAN 85905042 (abandoned); WITHINGS BODY SCAN 79323073 (composite, smart scale); TRUE2SCALE BODY SCAN 90603197 (cl. 9/42, active); BOOTY SCAN 98599800 | Descriptive; note Withings' composite mark |
| Food Quality (scanner) | FOODQUALITY 79189701 (cancelled 2023); FOODSCAN Reg. 3306429 (instruments); TRUEST 50051849 (2026, food-scanning app) | Descriptive |
| Plus / Pro | Nothing notable for the bare words; APPLE FITNESS+ Reg. 7,754,794 with "FITNESS+" disclaimed | Generic tier names; avoid any "Fitness+" styling |
| Scripture of the day | SCRIPTURE@WORK 98851094; ON SCRIPTURE 85804120 | Generic (cf. "Verse of the Day") |
| "Rooted in faith. Built for strength." | not searched as a mark | Slogan search still to do |

## C.5 Scripture licensing (checked because the faith content is quoted in a paid app)

The app quotes **only the Berean Standard Bible (BSB)**, which its publisher dedicated to the public domain on 2023-04-30 ("all uses are freely permitted"; attribution requested, not required): https://berean.bible/terms.htm , https://ebible.org/engbsb/copyright.htm . The text is extracted from the official BSB file by a script, every quoted passage is checked against it by `tests/unit/scripture.test.ts`, and the attribution line appears on the Faith page and in the Terms (`docs/SCRIPTURE.md`). The AI coach may quote only verses from that verified list, word for word, labelled "(BSB)" (`src/lib/coach/knowledge.ts:227-239`). **No licence is needed for the shipped translation.** For reference, if a copyrighted translation were ever added: NIV/Biblica and ESV/Crossway allow up to 500 verses gratis with conditions and route commercial non-print use to permission requests; NASB/Lockman and CSB allow 1,000; KJV and WEB are public domain in the US. Sources: https://www.biblica.com/permissions/ , https://www.crossway.org/permissions/ , https://lockman.org/?p=3 , https://csbible.com/permissions/ .

## C.6 Remaining clearance questions for an attorney

1. Pull TSDR for 85481822 / 4,337,059: was a Section 8/9 renewal filed in 2022–2023, which classes survive, and who is the current owner (assignment records)? If dead, is there residual common-law use by the Springfield, MO business?
2. Likelihood of confusion between the label "Nutrition Score" and NUTRI-SCORE (US Reg. 6,160,878; 79278494), and whether displaying a product's official Nutri-Score grade from Open Food Facts needs anything from Santé publique France.
3. Full USPTO search (word, design, phonetic equivalents) for NARROW GATE / NARROWGATE / NARROW PATH in classes 9, 35, 41, 42, 44; current status of 98635715 (NARROWGATE VENTURES) and 98657296 (NARROW PATH ATHLETICS).
4. Common-law assessment of Narrow Gate Strength & Conditioning (PA), Narrow Gate Club (NC), Narrow Gate Athletics and the closed Phoenix CrossFit box: priority dates, geographic scope, whether a nationwide app conflicts.
5. Whether "Narrow Gate" is distinctive enough to register for an app (cl. 9/41/42) and whether "Fitness" must be disclaimed; state business-entity and DBA searches for "Narrow Gate Fitness".
6. Whether "40 Days Through the Narrow Gate" should be filed separately or treated as a descriptive programme title (40 DAYS FOR LIFE, 40 DAYS TO FLOURISHING).
7. "AI Coach" and "Body Scan": confirm the R3 Collaboratives and Withings records' scope; decide on generic-use language.
8. The slogan "Rooted in faith. Built for strength." has not been searched.
9. A distinctive replacement for "Nutrition Score", searched and cleared, before marketing leans on the name.
10. The repository's public pull request (`Joshfit77/Testing-testing-testing#1`) describes the app, tier names and the challenge name; consider whether early public disclosure affects intent-to-use filing timing.
