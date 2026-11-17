# Third-party licences: Narrow Gate Fitness

**Date:** 2026-11-16 · **Branch:** `claude/legal-remediation` · **For:** the founder and US technology/licensing counsel

**Limits.** A maintained inventory of third-party software, fonts and data, prepared by a non-lawyer. It states what each licence asks and what the app does; it does not say the app complies with any licence.
Licences are as declared by each package. Open Food Facts, USDA and Berean Standard Bible pages were not re-fetched for this file (openfoodfacts.org was unreachable earlier); their terms are as recorded in audit file 05.

Detail and quoted licence text: `docs/legal-audit-2026-11-16/05_SBOM_AND_DATA_LICENSES.md`. Keep this file current whenever `package-lock.json` changes.

## 1. How the software was counted

| Step | Detail |
|---|---|
| Source 1 | `docs/legal-audit-2026-11-16/sbom-production-dependencies.csv`: 878 lockfile rows; **175** have `production_or_dev = production` (36 direct, 139 transitive; 148 installed on the audit machine, 27 platform-specific binaries not installed) |
| Source 2 | `public/third-party-notices.txt`, written by `scripts/legal/third-party-notices.mjs` from the lockfile's non-dev entries: header "Packages: 175" plus one fonts entry |
| Cross-check | The 175 name+version pairs in both sources match exactly (compared 2026-11-16). Licence = the `license` field of the installed `package.json`, or the lockfile value for uninstalled binaries |
| Not counted | Dev-only packages (703), native iOS/Android libraries resolved at build time (section 4) |

## 2. Production software by licence family

| Licence family | Packages | Notes |
|---|---|---|
| MIT | 122 | Includes 6 uninstalled platform binaries (`@next/swc-*`) |
| MIT AND ISC | 1 | `victory-vendor` |
| ISC | 13 | e.g. `lucide-react`, `d3-*` |
| Apache-2.0 | 18 | 8 installed (e.g. `@zxing/library`, `html5-qrcode`, `class-variance-authority`, `sharp`); 10 uninstalled `@img/sharp-*` binaries |
| BSD-3-Clause / 0BSD | 2 / 1 | |
| MPL-2.0 | 1 | `@capgo/capacitor-health` (section 5) |
| LGPL-3.0-or-later | 10 | `@img/sharp-libvips-*` (2 installed, 8 not) |
| Apache-2.0 AND LGPL-3.0-or-later | 3 | `@img/sharp-win32-*` (not installed) |
| Apache-2.0 AND LGPL-3.0-or-later AND MIT | 1 | `@img/sharp-wasm32` |
| CC-BY-4.0 | 1 | `caniuse-lite` |
| Unlicense / (Unlicense OR Apache-2.0) | 1 / 1 | `fast-sha256` / `@zxing/text-encoding` |
| **Total** | **175** | No GPL or AGPL package; no package without a declared licence |

## 3. Non-permissive and notable packages

| Package (version) | Licence | Ships in | What the licence asks (factual) | How the app addresses it now |
|---|---|---|---|---|
| `@capgo/capacitor-health` (8.11.4) | MPL-2.0 | Phone apps (Swift/Kotlin); minified JS wrapper in the web bundle | Section 5 | Section 5 |
| `@img/sharp-libvips-*` (1.3.4), `@img/sharp-wasm32`, `@img/sharp-win32-*` | LGPL-3.0-or-later (some combined with Apache-2.0/MIT) | Server only (image optimisation via `next` → `sharp`), as far as the repo shows | LGPL obligations attach when the library is conveyed to others; whether running it on a host is conveyance is for counsel | Listed by name and licence in `third-party-notices.txt`; **no licence text** (the packages ship no licence file) |
| `caniuse-lite` (1.0.30001816) | CC-BY-4.0 | Build/server data | Attribution if the material is shared | Listed with its licence text in `third-party-notices.txt` |
| 18 Apache-2.0 packages | Apache-2.0 | Client (`@zxing/library`, `html5-qrcode`, `class-variance-authority`); server (`sharp`, others) | §4: give recipients a copy of the licence, keep notices, carry any NOTICE file | Licence text included for installed packages in `third-party-notices.txt` |
| `es-toolkit` (1.52.0) | MIT, plus a `NOTICE` file | Client (via `recharts`) | MIT: keep the copyright and permission notice | MIT text included. **The NOTICE file (Lodash derivation note) is not included**: the generator copies only the first licence-type file it finds (`scripts/legal/third-party-notices.mjs:21-22`) |
| `fast-sha256`, `@zxing/text-encoding` | Unlicense; (Unlicense OR Apache-2.0) | Server; client | Nothing (public-domain dedication); either licence may be chosen | Listed |
| 38 entries with no licence text | Various | 27 are platform binaries not installed where the file was generated; 11 installed packages ship no licence file (e.g. `standardwebhooks`, `client-only`, `@revenuecat/purchases-typescript-internal-esm`) | MIT/ISC/BSD/Apache ask that the notice travel with copies | Each says "No licence file in the installed package; see the package's repository" |

**How notices reach users today.**

| Surface | What it shows | Evidence |
|---|---|---|
| `/legal/notices` page | Food data, Scripture, an open-source paragraph linking the full list, the MPL plugin, fonts, trademarks | `src/app/legal/notices/page.tsx:9-43` |
| `/third-party-notices.txt` | Name, version, declared licence and licence text of all 175 packages, then the fonts' OFL text | `public/third-party-notices.txt` (6,615 lines) |
| In the phone apps | Profile → "Notices & licenses"; landing-page footer "Notices" | `src/components/profile/legal-links.tsx:11`; `src/app/page.tsx:147-148` |
| Regeneration | Run by hand (`node scripts/legal/third-party-notices.mjs`); **no build, test or CI step runs it**, so the file can drift from the lockfile | `scripts/legal/third-party-notices.mjs:1-3` |
| Repository licence | `package.json` `"license": "UNLICENSED"`; no root LICENSE file | `package.json:5` |

## 4. Native libraries (not in the notices file)

Resolved at build time; no `Package.resolved` or Gradle lockfile is committed, so versions and licences are **unverified** (file 05 §4). Named for counsel: Capacitor/Cordova runtime; AndroidX; `androidx.health.connect:connect-client` 1.1.0; RevenueCat `purchases-hybrid-common` 19.10.0 and the native Purchases SDKs; `com.google.mlkit:barcode-scanning` 17.3.0 and `com.google.android.gms:play-services-location` (Google proprietary terms); `com.google.zxing:core` 3.5.3; OutSystems barcode libraries. No Android open-source-licences screen is configured (`android/` has no oss-licenses plugin).

## 5. The MPL-2.0 Capacitor Health plugin

| Point | Fact |
|---|---|
| Package | `@capgo/capacitor-health` **8.11.4**, pinned exactly (`package.json:49`); author Martin Donadieu |
| Source | `https://github.com/Cap-go/capacitor-health` (from the package's `repository` field) |
| Licence file | `node_modules/@capgo/capacitor-health/LICENSE` is the MPL 2.0 text; reproduced in `public/third-party-notices.txt` from line 355 |
| Where it is used | Dynamic import in `src/lib/native-health.ts:55` and `src/lib/native-sleep.ts:48`; Android project included from `node_modules` (`android/capacitor.settings.gradle:29-30`); iOS package from `node_modules` (`ios/App/CapApp-SPM/Package.swift:23`) |
| Modified? | **No evidence of modification.** No `patches/` directory, no `patch-package`; the only `postinstall` script (`scripts/react-hydration-replay-fix.mjs`) does not reference the plugin; native builds compile the files straight from `node_modules` |
| MPL 2.0 §3, as written in that file | 3.1: source-form distribution stays under MPL; tell recipients the source is under MPL and how to get a copy of the licence. 3.2(a): if distributed in executable form, make the source available and tell recipients how to obtain it by reasonable means, at no more than the cost of distribution. 3.2(b): the executable may be under other terms if they do not limit recipients' rights in the source. 3.3: a larger work may be under any terms if MPL is met for the covered files. 3.4: do not remove or alter licence notices in the source |
| What the app provides now | `/legal/notices` names the plugin and version 8.11.4, links the MPL 2.0 text (`mozilla.org/en-US/MPL/2.0/`) and the GitHub repository (`src/app/legal/notices/page.tsx:31-35`); the full MPL text is in `third-party-notices.txt` |
| Gaps, stated factually | The source link points at the repository's moving default branch, not at the 8.11.4 release. The store listing and the app binary carry no notice; it is on a web page reached from inside the app. The draft Terms still hold a placeholder for the notices URL and an attorney note about MPL (`docs/legal/TERMS_OF_SERVICE_DRAFT.md:465`); its licence grant has not been checked against 3.2(b) |

## 6. Fonts

| Font | Files | Licence | Evidence | Attribution shown |
|---|---|---|---|---|
| Inter, Plus Jakarta Sans, Cinzel, Lora (regular and italic) | `src/app/fonts/` 5 WOFF2 | SIL Open Font License 1.1 — **verified** in the font files' name tables and `src/app/fonts/OFL.txt` (file 04 F1) | Lora has the Reserved Font Name "Lora": a modified copy may not use that name | `/legal/notices` "Fonts" (`src/app/legal/notices/page.tsx:36-41`); OFL text and copyright lines appended to `third-party-notices.txt` (`scripts/legal/third-party-notices.mjs:43-44`) |

## 7. Data sources

| Source | What the app uses | Licence as recorded | Verified? | Attribution shown |
|---|---|---|---|---|
| **Open Food Facts** | Live product lookups, product search, category alternatives, Nutri-Score/NOVA, product images; saved rows when a member logs a product (section 8) | Database ODbL 1.0; contents DbCL 1.0; images CC BY-SA 3.0. OFF Terms ask re-users to name the licence and link to openfoodfacts.org or the product page; derivative works shared alike; data "must not be used for medical purposes"; French law (file 05 §6.3) | **Unverified** against the live site (copies from OFF's GitHub source, read 2026-11-16 for file 05) | Section 8.6 |
| **USDA FoodData Central, SR Legacy** (bundled) | 7,448 foods in `src/data/usda-foods.json` (header: "USDA FoodData Central, SR Legacy (public domain)") | Public domain / CC0 1.0, with a request to cite FoodData Central (search snippets only, file 05) | **Unverified** | `/legal/notices` (`page.tsx:19-22`: "public domain, CC0 … USDA doesn't endorse this app"); "USDA" badge (`src/components/nutrition/source-badge.tsx:21`) |
| **USDA FoodData Central API** (optional) | Search incl. Branded foods, only if `USDA_FDC_API_KEY` is set; a logged food is saved to `foods` with `source = 'usda'` (`src/server/services/food-resolve.ts:71-92`) | As above; whether Branded data carries the same statement is open | **Unverified** | As above |
| **Berean Standard Bible** | Whole text in `public/bible/bsb/` (66 books; source `https://bereanbible.com/bsb.txt`, downloaded 2026-11-03, SHA-256 in `meta.json`); red-letter markup `wj.json` | Public domain (dedication reported from 2023-04-30 in search snippets, file 05) | **Unverified**; the publisher's statement is not saved in the repo | "Scripture quotations are from the Berean Standard Bible (BSB), public domain." with link to berean.bible (`src/data/scripture.ts:40-42`), on Faith pages and `/legal/notices` |

## 8. Open Food Facts: technical evidence for counsel

### 8.1 How a product is fetched and cached

| Step | Fact | File:line |
|---|---|---|
| Who calls OFF | The app's server, never the phone (except the test-only standalone edition, file 05) | `src/server/services/open-food-facts.ts:1, 16-31`; `src/server/services/food-quality.ts:17-27` |
| Endpoints | `GET /api/v2/product/{code}.json` (diary fields or scanner fields); `/cgi/search.pl` (name search); `/api/v2/search` (category alternatives) | `open-food-facts.ts:11, 17`; `food-quality.ts:40, 71-72, 94-95` |
| Fields requested | Diary lookup: code, names, brand, quantity, serving, `nutriments` (`src/lib/open-food-facts.ts:12-23`). Scanner: also image URLs, ingredients, allergens, traces, additives, Nutri-Score, NOVA, categories, labels, states, last-modified (`src/lib/food-quality.ts:17-48`) | |
| User-Agent | `NarrowGateFitness/1.0 (contact via app)` — no contact email | `open-food-facts.ts:12` |
| HTTP cache | Product and search responses cached by Next.js for 24 hours (`revalidate: 86400`) on the server | `open-food-facts.ts:23`; `food-quality.ts:20` |
| In-memory cache | Name searches 1 hour, category searches 6 hours, 500 entries each, per server instance; searches throttled to 8 a minute per instance | `food-quality.ts:49-59, 67-68, 90-91` |
| Per-member limit | Barcode API: 30 lookups a minute per member | `src/app/api/foods/barcode/route.ts:22` |

### 8.2 What is saved when a member logs a scanned product

| Table.column | What is written | When | File:line · migration |
|---|---|---|---|
| `foods`: `owner_id`, `name` (≤160), `brand` (≤120), `serving_size`, `serving_unit`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, **`source = 'openfoodfacts'`**, **`source_ref = <barcode>`**, `is_estimate = false`, `basis` (JSON: per-100 g/ml values, label serving, sugar, sodium, `missing` macros) | Upserted on `(owner_id, source, source_ref)`; re-logging the same product overwrites the row with the latest OFF values | Each log from a scan, re-read from OFF on the server | `src/server/services/food-resolve.ts:109-148` · `supabase/migrations/20261017000004_food_barcode.sql:4-21`; `20261112000059_foods_basis.sql:22-28` |
| `meal_items`: `food_id` (→ the `foods` row), `name` ("name (brand)"), amount columns (`servings`, `calories`, macros, `fiber_g`, `sugar_g`, `sodium_mg`, `grams`, `quantity`, `unit_label`, `amount_label`), **`source = 'off:<barcode>'`**, `basis` | One row per diary entry | Each log | `src/server/actions/nutrition.ts:102-115`; `src/server/services/diary-write.ts:50-69` · `20261019000008_food_amounts.sql:10-22` |
| `food_favorites`: **`food_key = 'off:<barcode>'`**, `name`, `detail`, `basis` (display snapshot sent by the client, sanitised) | On starring | `src/server/actions/nutrition.ts:291-303` · `20261020000011_food_favorites.sql:16-28` |
| `recipe_ingredients`: `name`, **`source = 'off:<barcode>'`**, amount, `basis` | On adding to a recipe | `src/server/actions/recipes.ts:88-105, 121-124` · `20261021000012_recipes_planner_grocery.sql:30-46` |
| Not saved | Ingredients, allergens, additives, Nutri-Score, NOVA, categories, images, search results, AI answers to "Ask AI about this food" (returned to the screen; no insert found in `src/server/actions/food-quality.ts`) | | |

All four tables have owner-only row-level security; rows are deleted with the account and returned by the account data export (`src/server/services/account.ts:35-37, 94-96`).

### 8.3 Can OFF-derived rows be isolated as a set?

| Table | Marker | Gap |
|---|---|---|
| `foods` | `source = 'openfoodfacts'` + barcode | Complete marker |
| `meal_items` | `source LIKE 'off:%'` | An entry re-logged from "My foods" gets `source = 'food:<uuid>'` (`food-resolve.ts:61`); it is traceable only by joining `food_id` to `foods.source`. If the member deletes that saved food, `food_id` becomes null (`20261016000001_core_schema.sql:428`, `on delete set null`) and the OFF origin of those entries is lost |
| `food_favorites` | `food_key LIKE 'off:%'` | A favourite starred from "My foods" uses `food:<uuid>`; same join needed |
| `recipe_ingredients` | `source LIKE 'off:%'` | Same `food:<uuid>` case |
| Copies | Meal templates copy item columns including `source` (`src/server/actions/nutrition.ts:320-328`) | |

### 8.4 Mixing with other rows

`foods` holds four kinds of row in one table, told apart by `source`: `custom` (member-entered), `usda`, `curated` (built-in, `owner_id` null) and `openfoodfacts` (`20261017000004_food_barcode.sql:4-6`). `meal_items`, `food_favorites` and `recipe_ingredients` mix OFF, USDA, saved-food, recipe and custom rows, told apart by the `source` / `food_key` prefix. There is no separate OFF table or schema.

### 8.5 Does the app change OFF data?

| Change | Fact | File:line |
|---|---|---|
| Normalisation | Values rounded to 0.1; calories from kJ ÷ 4.184 when kcal is absent; sodium from salt ÷ 2.5 when sodium is absent; text trimmed and truncated; first listed brand only | `src/lib/open-food-facts.ts:78, 92-118, 137-150` |
| Missing macros | Stored as 0 in `foods` columns, with the list kept in `basis.missing` | `food-resolve.ts:117-138`; `open-food-facts.ts:188-196` |
| Servings | The member's chosen amount is computed from the OFF basis and stored per diary entry; OFF values themselves are not edited | `diary-write.ts:50-69` |
| Editing saved OFF rows | No edit action for `foods` rows in app code; a member can delete a saved food (`src/server/actions/nutrition.ts:260`) | |
| App's own outputs | Computed at request time, not stored: traffic-light levels, filter checks, "Fits your goals", alternatives, and the 0–100 Nutrition Score (off unless `FOOD_IQ_SCORE=on`, `src/lib/food-iq.ts:27-29`) | `src/lib/food-quality.ts`; `src/lib/food-iq.ts` |
| Onward disclosure | "Ask AI about this food" sends the product's OFF data to Anthropic after consent | `src/server/actions/food-quality.ts:70-75`; `src/lib/food-quality-ai.ts:74-83` |

### 8.6 Images

Hot-linked, not stored. Only `https` URLs on `openfoodfacts.org` hosts are accepted (`src/lib/food-quality.ts:128-136`) and drawn with a plain `<img>` straight from OFF (`src/components/nutrition/quality-client.tsx:268-280`), so the member's browser contacts OFF directly. No per-image author credit is shown.

### 8.7 Attribution shown, screen by screen

| Screen | Text | Links |
|---|---|---|
| Scanner, compare and product pages | `OffDataNotice`: "Product data from Open Food Facts (Open Database License); product images under CC BY-SA. Data may be incomplete or out of date: always check the package. Notices & attributions" | OFF home, ODbL text, `/legal/notices` (`src/components/nutrition/quality-sections.tsx:44-63`; used at `scanner/page.tsx:138`, `compare/page.tsx:85`, `product/[code]/page.tsx:267-271`). Product page adds "View or improve this product on Open Food Facts" (`:268-269`) |
| Barcode scanner sheet (before a scan) | "Product data from Open Food Facts (Open Database License), a community database: check the label. Notices & attributions" | OFF home, `/legal/notices`; licence name not linked (`src/components/nutrition/barcode-scanner.tsx:310-317`) |
| Amount step after a scan | "Open Food Facts (community data) — check the label." then, **added in this change**, "Product data from Open Food Facts (Open Database License)." | OFF home and ODbL text (`src/components/nutrition/food-amount.tsx:187-199`) |
| Food lists ("My foods", search results) | Detail tag "Open Food Facts (community data) — check the label" | None (`src/components/nutrition/nutrition-client.tsx:85`) |
| Diary entries, recipe ingredients | Badge "Label · Open Food Facts" for `off:` sources; entries re-logged from My foods show only "Label" | None (`src/components/nutrition/source-badge.tsx:22, 31-34`) |
| Favourites, AI answers | No OFF-specific credit found | — |
| Barcode API JSON | `attribution: "Open Food Facts (community data) — check the label"` | — (`src/app/api/foods/barcode/route.ts:26`) |
| `/legal/notices` | OFF, ODbL, DbCL, CC BY-SA, each linked. Wording says "Product information from barcode scans", narrower than the actual uses above | `src/app/legal/notices/page.tsx:10-18` |

### 8.8 Technical options (proposals for counsel; none decided)

| Option | What changes | Effort | Effect |
|---|---|---|---|
| A. Attribution improvements | Link the food-list tag and diary badge to `/legal/notices` (needs a small layout change: the tag is joined into one text string, `nutrition-client.tsx:85-91`, and the badge sits inside list items); link "Open Database License" on the scanner sheet; widen the notices wording to search, photos, comparisons and AI answers; add a line under Favourites and Recipes | Small (hours) | Every place OFF-derived values appear names OFF and its licence with a link |
| B. Keep OFF rows identifiable | Store the OFF barcode on every diary/favourite/recipe row that originates from OFF, even when re-logged from My foods (e.g. an `origin` column, or keep `off:<barcode>` as the source); stop the link being lost when a saved food is deleted | Medium (a migration plus write-path changes and tests) | OFF-derived rows can be selected, exported or deleted as a complete set |
| C. Export of OFF-derived rows | A script or admin endpoint that writes all OFF-derived rows (or one member's) to a machine-readable file with the ODbL notice; needs B to be complete | Small to medium | Something could be offered if counsel decides ODbL 4.6 applies; member privacy must be weighed, since the rows sit in private accounts |
| D. Do not persist OFF records | Store only the barcode and the member's amount; re-fetch nutrition from OFF when shown or re-logged | Large (diary totals, offline behaviour, recipes and favourites all read stored values; more OFF requests against its rate limits) | Removes the stored OFF copy; adds dependence on OFF availability |
| E. Housekeeping | Correct the comment at `src/server/services/food-quality.ts:13` (says `source "open_food_facts"`; actual value is `openfoodfacts`); record in `docs/DATA.md` that `20261024000033_food_quality.sql:1-2` ("never copied into the app's food tables") is out of date; put a monitored email in the User-Agent | Small | Accurate internal records |

## 9. Code change made with this file

`src/components/nutrition/food-amount.tsx:13, 188-199`: in the amount step for a scanned product, a line "Product data from Open Food Facts (Open Database License)." linking to `https://world.openfoodfacts.org` and the ODbL text, reusing `OFF_HOME_URL` and `OFF_LICENSE_URL` from `src/lib/food-quality.ts:52-53`. The plain-text constant `OFF_ATTRIBUTION` (`src/lib/open-food-facts.ts:11`) is unchanged, because it is consumed as a plain string in three places (amount-step note via `src/components/nutrition/barcode-scanner.tsx:57`, product page `:145`, barcode API JSON `route.ts:26`) and its text is asserted by `e2e/food-amounts.spec.ts:118`. `npx tsc --noEmit` and `npx eslint src` both exited 0 after the change. The other credits on product screens were already linked before this change.
