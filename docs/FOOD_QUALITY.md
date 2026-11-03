# Narrow Gate Food IQ (formerly the Food Quality Scanner)

Food IQ was added on `claude/sharp-cray-8y0uuv`; this file describes the scanner it builds on, which was Stage 8 on `claude/nine-features`. The method, weights, reference foods and known biases of the experimental 0–100 rating, and the ingredient-evidence rules, are in [`FOOD_IQ_METHOD.md`](FOOD_IQ_METHOD.md).

## What Food IQ added

- **Name and placement:** the scanner is called Narrow Gate Food IQ. It's a highlighted card on the Food tab and in the Food tools; there's no new tab.
- **Search by name:** Open Food Facts full-text search (`/cgi/search.pl`), which shares the search throttle and is cached for an hour.
- **Summary first:** strengths and what to watch, from published thresholds. The experimental 0–100 rating appears only with `FOOD_IQ_SCORE=on`, labelled as not yet reviewed, with a full breakdown.
- **Ingredients worth knowing about:** every additive with an evidence class and sources, plus added sugars and sodium sources. Unreviewed additives say "Insufficient information".
- **Macro analysis:** high or low protein, carbs, fat, saturated fat, sugar, fibre, sodium and calories. Each is labelled as an EU claim threshold, a UK front-of-pack level or an informal comparison.
- **Fits your goals (Pro):** a serving against the member's own targets, kept separate from the rating.
- **Ask AI about this food (Pro):** three focuses (goals, compare, meal plan). The AI gets only reviewed evidence and real alternatives.
- **Alternatives:** with the rating on, products it rates lower are never suggested, and "Food IQ X instead of Y" is shown when one is clearly higher.

The original Food Quality Scanner, which Food IQ builds on:

Built on `claude/nine-features` as Stage 8. Route: Food → Food quality (`/nutrition/scanner`), product pages at `/nutrition/product/<barcode>`, and comparisons at `/nutrition/compare?a=&b=` (Plus). It's an original feature; Yuka was used only as a functional reference. No code, branding, scoring, images or distinctive UI were copied.

## What it shows

- **Scanning:** the existing barcode scanner (camera, the native scanner in the app, or a typed code), unlimited and free. An optional `onCode` hook opens the product page. The diary's amount step for a scanned product links to the same page.
- **Product:** name, brand, quantity, barcode, category and the Open Food Facts package photo (only `https` images from `openfoodfacts.org`; hidden if it can't load). "Add to Food Diary" opens the usual amount step with the label serving and logs through the normal barcode path, so no duplicate food records are created.
- **Nutrition:** calories, protein, carbohydrates, sugars, added sugars, total and saturated fat, fibre, sodium and salt, per serving and per 100 g (or ml), with % of the EU reference intake per serving. On the product page, missing values say **"Not available"**, never 0. In the **diary**, a missing protein, carb or fat value is counted as 0 so the day still adds up, and the totals say "at least" (`basis.missing`); the scanner's own note says "(counted as 0)".
- **Data that can't all be right, or is old** (`dataIssues`):
  - **Conflicting values:** sugars above total carbohydrates, or saturated fat above total fat (allowing 0.5 g for
    rounding), can't both be right. The page says which values conflict, and the Nutrition Score isn't calculated.
  - **Calories that don't match the macros:** if they differ from 4/4/9 kcal per gram (plus 2 for fibre) by more than
    25% and 40 kcal, the page flags it. Alcohol and polyols are named as possible reasons.
  - **The record's last-update date** is shown. A record older than 3 years is flagged, because recipes change.
- **Drink or food:** a product is measured per 100 ml only when Open Food Facts puts it in a drink category (`en:beverages`). Ice cream sold as "500 ml", soy sauce or syrup are foods, with food thresholds. Only a product with no category at all falls back to how its pack size is written (`quantityUnit` in `src/lib/food-quality.ts`).
- **Quality indicators,** each with a "what this means and its limits" note:
  - **Nutri-Score:** the grade Open Food Facts computed, "not applicable" or "not available";
  - **NOVA:** the processing group;
  - **Levels per 100 g/ml:** low, medium or high against the UK front-of-pack thresholds;
  - **EU nutrition-claim thresholds** the data meets (e.g. "high fibre"), labelled as thresholds, not the maker's claims.
  - **No proprietary 0–100 score in the original scanner** (Food IQ later added an experimental, documented one behind a flag).
- **Ingredients:** the list as printed; forms of sugar named in it (with "no added sugar" wording ignored); additives with plain-language names and roles. Notes are regulatory facts only, such as the PKU note for aspartame, the EU colour warning and the polyol laxative statement; additives are never called harmful.
- **Allergens and diet:** declared allergens and "may contain" traces, vegan, vegetarian and palm-oil status from the ingredient analysis, and labels. Missing data is shown as "no information", with a clear note that the app can't guarantee allergen safety.
  - **Never a "safe" tick.** For an allergen a member avoids, the check is "contains" (conflict), "may contain" (caution), "unknown" (no allergen data, or an ingredient list marked incomplete) or **"not declared in the data"**, shown neutrally with "that isn't a guarantee: read the label". No allergen result is ever shown as a match (`allergenStatus` in `src/lib/food-quality.ts`).
  - **Alternatives** for a member who avoids an allergen are only products whose data covers it and declares neither the allergen nor traces of it. Products with missing allergen data aren't suggested.
  - "Fits your goals" says when it can't check an avoided allergen; the comparison table says "No information" rather than "None declared" when there's no data; the AI is told that missing allergen data means nothing is known.
- **Alternatives (all plans):** real products from the same most-specific Open Food Facts category, both foods or both drinks. They're suggested only when better on Nutri-Score or NOVA, or on two or more nutrients, and never when worse overall. The reasons are listed. Prices aren't compared.
- **Plus:**
  - personal filters (the 14 EU allergens, vegan or vegetarian, low sugars, salt or saturated fat, high protein or fibre), checked on every product. Missing data counts as "unknown", never "ok";
  - alternatives that conflict with the filters are left out;
  - side-by-side comparison of two products: calories, protein, sugars, fibre, sodium, saturated fat, fat, carbs, Nutri-Score, NOVA, ingredient count, additives and allergens, with a warning when the products aren't comparable.
- **Pro:** "Explain for my goals" sends only the facts shown plus the member's goal, diet and targets to the fast model (one AI message, AI consent required). The answer is labelled as based only on the data shown.

Plan gates are checked on the server:
- `food_comparisons` (a new Plus feature) for filters and comparisons;
- the AI allowance for explanations;
- the comparison page itself.

## Checking an ingredient label (`/nutrition/label`)

For a product without a barcode, one Open Food Facts doesn't know, or one with no ingredient list.

- **Get the text:**
  - **Type or paste it.** This is free and uses no AI.
  - **Pro: photograph the label.** The photo is re-encoded on the server (upright, at most 1,568 px, metadata removed) and sent once to the fast model, which only **transcribes** the ingredient list, the allergy advice and the nutrition table. It is told never to add, guess, correct or translate anything, and to mark unreadable words [?]. The photo isn't stored.
  - A label photo uses the same consent, monthly allowance and 20-a-day photo cap as meal photos.
- **Correct it.** Every field is editable, and the screen says the text was read by AI and must be checked word for word.
- **Check it with the app's own rules** (`src/lib/label-analysis.ts`; no AI). The member's corrected text is checked for:
  - E-numbers, INS numbers after a function word ("emulsifier (322)") and additive names, including common US names and US spellings. Each additive is shown with the same reviewed evidence as scanned products.
  - Forms of sugar and sodium sources (wording such as "no added salt" doesn't count), with the label's own amounts and level.
  - The 14 EU allergens, by English words, split into "contains" and "may contain". "Gluten-free" doesn't count, and cocoa butter isn't milk.

  Any edit after checking marks the result out of date until the text is checked again.
- **Limits shown on screen:** matching is by English words and E/INS numbers. A missed or misspelt word or another language can hide an ingredient or allergen, so "none recognised" is never proof. Text that doesn't look English is flagged.
- **Log it.** With the label's calories, protein, carbs and fat, the food can be added to the diary. The amount is in g, ml or servings. The server recomputes the values, and the entry is marked "(from a label you checked)", with no duplicate on a retry.
- **Entry points:** the scanner page, "Product not found", products without an ingredient list, and the meal-photo "packaged product" note.

## Sources for the thresholds

- **UK front-of-pack traffic lights** (Department of Health and FSA guidance, 2016), per 100 g. Low is at most fat 3, saturates 1.5, sugars 5 and salt 0.3. High is above fat 17.5, saturates 5, sugars 22.5 and salt 1.5. For drinks (per 100 ml) the fat, saturates and sugars limits are halved (fat 1.5/8.75, saturates 0.75/2.5, sugars 2.5/11.25); salt stays "low" at 0.3 g and is "high" above 0.75 g.
- **EU reference intakes,** Regulation (EU) No 1169/2011, Annex XIII.
- **EU nutrition claims,** Regulation (EC) No 1924/2006, Annex.

## Open Food Facts: data, licence, limits

- **Fields:** the app reads Open Food Facts API v2 (`/api/v2/product/<code>.json` with an explicit `fields` list, and `/api/v2/search?categories_tags=…` for alternatives) with a descriptive User-Agent.
- **Caching:** product reads and searches are cached for a day. Searches are throttled to 8 a minute per server, under the published limit of 10 searches a minute. Product page views are limited to 40 a minute per member.
- **Licence:** data is under the Open Database License and images under CC BY-SA. Every page shows the attribution and links to the product on Open Food Facts.
- **What is copied, and where (corrected 2026-11-03):** viewing a product copies nothing. **Logging** a scanned product to the diary saves its name, brand and nutrition into that member's own `foods` row (owner-only, `src/server/services/food-resolve.ts`), so the entry keeps working if the product changes or the API is down. These rows are never shared between members or published. A shared or public food database built from them would likely be a derivative database under the ODbL (share-alike); that needs legal review before it is ever built (`docs/launch-audit/NUTRITION_IP_REVIEW.md`).
- **Not verified live.** This environment's network policy blocks `world.openfoodfacts.org` and `openfoodfacts.github.io`, so the current API documentation couldn't be re-read and nothing was tested against the live service. Field names follow the v2 API as previously documented. All tests use the local mock (`e2e/off-mock.ts`). **Before release:** re-check the fields, search parameters and rate limits against the current documentation, and run a few real barcodes.

## Tests

- **Unit** (`tests/unit/food-quality.test.ts`): normalisation and unavailable values, drinks, Nutri-Score states, image host checks, UK levels, reference intakes, claim thresholds, sugar terms, neutral additive wording, filters (missing data is never safe), comparability, and alternative selection and reasons.
- **Integration** (`tests/integration/food-quality.test.ts`): the service against the mock (lookup, unknown codes, data-less products, category search, cache, throttle), and owner-only filters with size and type checks.
- **Browser:**
  - `e2e/food-quality.spec.ts` (Free flow, Plus filters and comparisons);
  - `e2e/coach.spec.ts` (Pro explanation and exactly what was sent);
  - `e2e/food-amounts.spec.ts` (the existing barcode journey, now on the shared mock in `e2e/global-setup.ts`).
- **Native camera:** scanning on a physical phone still needs testing.
