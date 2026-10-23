# Food Quality Scanner

Built on `claude/nine-features` as Stage 8. Route: Food → Food quality (`/nutrition/scanner`), product pages at `/nutrition/product/<barcode>`, and comparisons at `/nutrition/compare?a=&b=` (Plus). It's an original feature; Yuka was used only as a functional reference. No code, branding, scoring, images or distinctive UI were copied.

## What it shows

- **Scanning:** the existing barcode scanner (camera, the native scanner in the app, or a typed code), unlimited and free. An optional `onCode` hook opens the product page. The diary's amount step for a scanned product links to the same page.
- **Product:** name, brand, quantity, barcode, category and the Open Food Facts package photo (only `https` images from `openfoodfacts.org`; hidden if it can't load). "Add to Food Diary" opens the usual amount step with the label serving and logs through the normal barcode path, so no duplicate food records are created.
- **Nutrition:** calories, protein, carbohydrates, sugars, added sugars, total and saturated fat, fibre, sodium and salt, per serving and per 100 g (or ml), with % of the EU reference intake per serving. Missing values say **"Not available"**, never 0.
- **Quality indicators,** each with a "what this means and its limits" note:
  - **Nutri-Score:** the grade Open Food Facts computed, "not applicable" or "not available";
  - **NOVA:** the processing group;
  - **Levels per 100 g/ml:** low, medium or high against the UK front-of-pack thresholds;
  - **EU nutrition-claim thresholds** the data meets (e.g. "high fibre"), labelled as thresholds, not the maker's claims.
  - **No proprietary 0–100 score.**
- **Ingredients:** the list as printed; forms of sugar named in it (with "no added sugar" wording ignored); additives with plain-language names and roles. Notes are regulatory facts only, such as the PKU note for aspartame, the EU colour warning and the polyol laxative statement; additives are never called harmful.
- **Allergens and diet:** declared allergens and "may contain" traces, vegan, vegetarian and palm-oil status from the ingredient analysis, and labels. Missing data is shown as "no information", with a clear note that the app can't guarantee allergen safety.
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

## Sources for the thresholds

- **UK front-of-pack traffic lights** (Department of Health and FSA guidance, 2016), per 100 g. Low is at most fat 3, saturates 1.5, sugars 5 and salt 0.3. High is above fat 17.5, saturates 5, sugars 22.5 and salt 1.5. Drinks use half of those (salt high above 0.75).
- **EU reference intakes,** Regulation (EU) No 1169/2011, Annex XIII.
- **EU nutrition claims,** Regulation (EC) No 1924/2006, Annex.

## Open Food Facts: data, licence, limits

- **Fields:** the app reads Open Food Facts API v2 (`/api/v2/product/<code>.json` with an explicit `fields` list, and `/api/v2/search?categories_tags=…` for alternatives) with a descriptive User-Agent.
- **Caching:** product reads and searches are cached for a day. Searches are throttled to 8 a minute per server, under the published limit of 10 searches a minute. Product page views are limited to 40 a minute per member.
- **Licence:** data is under the Open Database License and images under CC BY-SA. Every page shows the attribution and links to the product on Open Food Facts. Nothing is copied into the app's database, so no derived database is published.
- **Not verified live.** This environment's network policy blocks `world.openfoodfacts.org` and `openfoodfacts.github.io`, so the current API documentation couldn't be re-read and nothing was tested against the live service. Field names follow the v2 API as previously documented. All tests use the local mock (`e2e/off-mock.ts`). **Before release:** re-check the fields, search parameters and rate limits against the current documentation, and run a few real barcodes.

## Tests

- **Unit** (`tests/unit/food-quality.test.ts`): normalisation and unavailable values, drinks, Nutri-Score states, image host checks, UK levels, reference intakes, claim thresholds, sugar terms, neutral additive wording, filters (missing data is never safe), comparability, and alternative selection and reasons.
- **Integration** (`tests/integration/food-quality.test.ts`): the service against the mock (lookup, unknown codes, data-less products, category search, cache, throttle), and owner-only filters with size and type checks.
- **Browser:**
  - `e2e/food-quality.spec.ts` (Free flow, Plus filters and comparisons);
  - `e2e/coach.spec.ts` (Pro explanation and exactly what was sent);
  - `e2e/food-amounts.spec.ts` (the existing barcode journey, now on the shared mock in `e2e/global-setup.ts`).
- **Native camera:** scanning on a physical phone still needs testing.
