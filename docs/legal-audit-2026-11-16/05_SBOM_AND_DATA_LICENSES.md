# 05 · Third-party software and data licences (SBOM and data-licence inventory)

**Audit date:** 2026-11-16 · **Repo state:** branch `claude/friends-challenges`, commit `61e74e66` · **Readers:** founder and US technology/licensing counsel

**This is a factual inventory, not legal advice.** The author is not a lawyer. Nothing here says the app "complies" with a licence unless the specific requirement and the evidence are both stated. Classification questions (for example ODbL "Derivative Database" vs "Produced Work") are laid out for counsel and deliberately not decided.

Companion file: `docs/legal-audit-2026-11-16/sbom-production-dependencies.csv` (878 rows: every package in `package-lock.json`, production rows first).

---

## 1. Scope, method, limits

**Scope.** (a) npm packages; (b) native iOS/Android dependencies pulled in by Capacitor plugins; (c) the in-app Notices page; (d) third-party data and content (food data, Scripture, fitness/nutrition reference material); (e) external services the code calls.

**Method.**
- SBOM: a throwaway script (kept outside the repo) read `package-lock.json`, then each installed package's own `package.json` `license` field and looked for `LICENSE*`/`LICENCE*`/`COPYING*`/`NOTICE*`/`UNLICENSE*` files in the package root. "Production" = not flagged `dev`/`devOptional` in the lockfile. Paths were checked with `npm ls <pkg>`.
- Native: read `ios/App/CapApp-SPM/Package.swift`, `android/**/build.gradle`, `android/capacitor.settings.gradle`, and each plugin's own `build.gradle` / `Package.swift` / `.podspec` in `node_modules`.
- Data and services: `grep` over `src/`, `supabase/migrations/`, `scripts/`, `public/`, `standalone/`, `.env.example`, `src/server/env.ts`, `src/lib/security-headers.ts`, and the docs named in the brief.
- Licence terms: fetched on 2026-11-16 where the network allowed (see table below).

**What could be fetched on 2026-11-16, and what could not.**

| Source | Result |
|---|---|
| ODbL 1.0 full text | **Fetched** from the SPDX licence-list mirror (`raw.githubusercontent.com/spdx/license-list-data/main/text/ODbL-1.0.txt`). `opendatacommons.org` itself was blocked. |
| Open Food Facts Terms of use | **Fetched** from the project's own source repo (`openfoodfacts/openfoodfacts-web`, `lang/en/texts/terms-of-use.html`, `main`). The live page `world.openfoodfacts.org/terms-of-use` was blocked, so the live wording was not compared. The text says the French original prevails. |
| Open Food Facts API rules | **Fetched** from `openfoodfacts/openfoodfacts-server`, `docs/api/index.md` and `docs/api/tutorials/license-be-on-the-legal-side.md` (`main`). The rendered docs site was blocked. |
| MPL-2.0 | Read from the copy shipped in `node_modules/@capgo/capacitor-health/LICENSE`. |
| Apple App Review Guidelines 5.1.2(vi), 5.1.3 | **Fetched** (`developer.apple.com/app-store/review/guidelines/`) through a fetch tool that returns extracted text; re-read the live page before quoting it in a filing. |
| Anthropic Usage Policy | **Fetched** (`anthropic.com/legal/aup`) through the same tool; fragments only. |
| USDA FoodData Central licence/citation | **Not fetched** (`fdc.nal.usda.gov`, `catalog.data.gov` blocked). Search-result snippets only. |
| Berean Standard Bible licensing | **Not fetched** (`berean.bible`, `bereanbible.com`, `ebible.org` blocked). Search-result snippets only. |
| Google Health Connect policy | **Not fetched** (`support.google.com` blocked). |
| Database Contents License, CC BY-SA 3.0, OFL, Nutri-Score usage regulation, RevenueCat/Stripe/Supabase/Vercel terms | Not fetched. Named only. |

**Other limits.**
- Licences are *as declared* by each package. Declared licences were not checked against every source file.
- 121 lockfile entries are platform-specific optional binaries not installed on this Linux machine (27 production, 94 dev). Their licence comes from the lockfile, not from the package.
- Native dependencies are resolved at build time by Gradle/SwiftPM. The repo has no `Package.resolved` or Gradle lockfile, so transitive native libraries and their exact versions are **not visible** from the repo. Their licences below are marked unverified.
- The native apps were not built, so what the shipped `.ipa`/`.aab` actually contains was not inspected.
- Image, video and artwork provenance (badges, exercise demos, home backgrounds) is only touched on in §7; it belongs to the IP/content workstream.

---

## 2. Software summary

**How the app is assembled (matters for "who receives what").** The native apps are thin Capacitor shells that load the deployed website (`capacitor.config.ts:9-12`, `server.url`). So:
- **Web client bundle**: JavaScript served to browsers and to the WebView.
- **Server**: code and binaries that run on the host (docs name Vercel) and are not sent to users.
- **Native app binary**: Capacitor runtime and plugin Swift/Kotlin code compiled into the store apps, plus `native-shell/` (offline page and the offline Bible).
- A separate offline edition (`standalone/index.html`, `CAP_MODE=standalone`) is described as test-only ("never for TestFlight").

**Counts** (`package-lock.json`, 878 entries; no GPL or AGPL package was found anywhere, production or dev; no package has a missing or "UNLICENSED" licence field).

| Licence family | Production, installed (148) | Production, platform-optional, not installed (27) | Dev-only (703: 609 installed, 94 not) |
|---|---|---|---|
| MIT (incl. `MIT AND ISC` ×1) | 117 | 6 | 471 installed + 76 not installed; MIT-0 ×2; `(MIT OR WTFPL)` ×1 |
| ISC | 13 | 0 | 45 |
| Apache-2.0 | 8 | 10 | 39 |
| BSD-2/3-Clause, 0BSD | 3 (2 × BSD-3-Clause, 1 × 0BSD) | 0 | 22; `(BSD-2-Clause OR MIT OR Apache-2.0)` ×1 |
| MPL-2.0 | **1** (`@capgo/capacitor-health`) | 0 | 7 installed + 18 not (`lightningcss*`, `axe-core`) |
| LGPL | **3** (2 × `@img/sharp-libvips-*` LGPL-3.0-or-later; `@img/sharp-wasm32` "Apache-2.0 AND LGPL-3.0-or-later AND MIT") | 11 (8 × libvips LGPL; 3 × win32 sharp "Apache-2.0 AND LGPL-3.0-or-later") | 0 |
| GPL / AGPL | 0 | 0 | 0 |
| Creative Commons | 1 (`caniuse-lite`, CC-BY-4.0) | 0 | 2 (CC0-1.0) |
| Unlicense / dual with Unlicense | 2 (`fast-sha256` Unlicense; `@zxing/text-encoding` "(Unlicense OR Apache-2.0)") | 0 | 2 |
| Other | 0 | 0 | BlueOak-1.0.0 ×14; Python-2.0 ×1; "SEE LICENSE" ×2 (`@trapezedev/*`; the file is MIT text) |

**Packages the brief asked about by name** (all production unless noted; licence as declared in the installed `package.json`, LICENSE file present in every case unless noted).

| Package | Version | Licence | Ships in |
|---|---|---|---|
| `next` | 15.5.28 | MIT | server + client bundle. Note: `scripts/react-hydration-replay-fix.mjs` patches the React build inside `node_modules/next` on install/build, so the shipped React is a **modified** copy (MIT permits modification; the notice requirement is unchanged). |
| `react`, `react-dom` | 19.3.1 | MIT | client + server |
| `@supabase/supabase-js`, `@supabase/ssr` (+ `auth-js`, `postgrest-js`, `realtime-js`, `storage-js`, `functions-js`, `phoenix`) | 2.118.0 / 0.12.7 | MIT | client + server |
| `@capacitor/core`, `/android`, `/ios` | 8.5.3 | MIT | client; native apps |
| `@capacitor/app` 8.1.2, `/haptics` 8.0.2, `/keyboard` 8.0.6, `/local-notifications` 8.3.1, `/splash-screen` 8.0.2, `/status-bar` 8.0.4, `/barcode-scanner` 3.1.2 | | MIT | client; native apps |
| `@capacitor-community/background-geolocation` | 1.2.26 | MIT | client; native apps |
| **`@capgo/capacitor-health`** | 8.11.4 | **MPL-2.0** (`package.json` line 19; `LICENSE` is the MPL 2.0 text) | client (JS wrapper, dynamic import in `src/lib/native-health.ts:55`, `src/lib/native-sleep.ts:48`); native apps (Swift/Kotlin) |
| `@revenuecat/purchases-capacitor` (+ `purchases-typescript-internal-esm` 19.10.0, no LICENSE file in that sub-package) | 13.7.3 | MIT | client; native apps |
| `stripe` | 23.0.0 | MIT | server only |
| `@anthropic-ai/sdk` (+ `standardwebhooks` MIT, `fast-sha256` Unlicense, `@stablelib/base64` MIT) | 0.135.0 | MIT | server only |
| `zod` | 4.6.7 | MIT | client + server |
| `@radix-ui/*` (30 packages) | | MIT | client |
| `lucide-react` | 1.58.0 | ISC | client |
| `class-variance-authority` | 0.7.1 | Apache-2.0 | client |
| `clsx`, `tailwind-merge` | | MIT | client |
| `tailwindcss`, `@tailwindcss/postcss` (dev) | 4.3.3 | MIT | build tool; output CSS ships. Pulls `lightningcss` (MPL-2.0) as a **build tool only**. |
| `sharp` (via `next`) | 0.35.5 | Apache-2.0; prebuilt **libvips binaries LGPL-3.0-or-later** | server only (image optimisation; `next/image` is imported in 3 files) |
| `recharts` (charting; + `d3-*` ISC/BSD-3-Clause, `victory-vendor` "MIT AND ISC", `@reduxjs/toolkit`, `immer`, `es-toolkit`) | 3.10.1 | MIT | client. `es-toolkit` carries a `NOTICE` file. |
| `@zxing/browser` 0.2.1 (MIT), `@zxing/library` 0.23.0 (**Apache-2.0**), `html5-qrcode` 2.3.8 (**Apache-2.0**, via `@capacitor/barcode-scanner`) | | | client (barcode scanning) |
| Map libraries | none | | Route maps draw a grid; tile loading is off unless `NEXT_PUBLIC_MAP_TILE_URL` is set (`.env.example:109-116`). |
| PDF libraries | none found | | |
| Service worker | `public/sw.js`, hand-written, no library | | |
| Fonts | Inter, Plus Jakarta Sans, Cinzel, Lora (`src/app/fonts/*.woff2`, from Fontsource 5.3.0) | SIL OFL 1.1 (`src/app/fonts/OFL.txt` with the four copyright lines) | client (served to every browser) |

---

## 3. Packages that are not plainly permissive, and other notable ones

"Evidence of compliance in repo" answers only: does the repo show the stated obligation being met?

| Package (version) | Licence | Brought in by | Where it ends up | What the licence text requires (factual) | Evidence in repo |
|---|---|---|---|---|---|
| `@capgo/capacitor-health` (8.11.4) | MPL-2.0 | direct dependency | client JS bundle (minified); compiled into iOS and Android apps | See §3.1 | **Partial**. See §3.1 |
| `@img/sharp-libvips-linux-x64`, `-linuxmusl-x64` (1.3.4); `@img/sharp-wasm32` (0.35.5) and 11 uninstalled platform variants | LGPL-3.0-or-later (libvips and bundled libraries); no LICENSE file in the two installed libvips packages | `next` → `sharp` | Server only. Not in the client bundle or the native apps, as far as the repo shows | LGPL obligations attach when the library is conveyed to others. Whether running it on a third-party host is conveyance is a question for counsel. | **No** notice anywhere. Not mentioned on the Notices page |
| `caniuse-lite` (1.0.30001816) | CC-BY-4.0 | `next` | Build/server (browser-support data). Not confirmed in the client bundle | Attribution if the material is shared | **No** attribution; likely not redistributed (suspected, not verified) |
| `fast-sha256` (1.3.0) | Unlicense | `@anthropic-ai/sdk` → `standardwebhooks` | Server | None (public-domain dedication) | n/a |
| `@zxing/text-encoding` (0.9.0) | (Unlicense OR Apache-2.0) | `@zxing/browser`, `@zxing/library` (optional) | client | Either licence may be chosen | n/a |
| `@zxing/library`, `html5-qrcode`, `class-variance-authority`, `sharp`, `@swc/helpers`, `@opentelemetry/api` | Apache-2.0 | direct / `@capacitor/barcode-scanner` / `next` | client (first three), server (rest) | Apache-2.0 §4: give recipients a copy of the licence; keep notices; carry any `NOTICE` file content. None of these six has a `NOTICE` file. | **No** licence copy is delivered to app users (see §5) |
| `es-toolkit` | MIT, with a `NOTICE` file | `recharts` | client | MIT: include the copyright and permission notice in copies | **No** |
| `lightningcss` + platform binaries, `axe-core` | MPL-2.0 | `@tailwindcss/*` (build), `eslint-plugin-jsx-a11y` (lint) | Dev/build tools only; not distributed | None triggered by internal use | n/a |
| BlueOak-1.0.0 (14), Python-2.0 (`argparse`), `@trapezedev/*` "SEE LICENSE" (MIT text) | permissive | dev tooling | not distributed | n/a | n/a |
| MIT / ISC / BSD-3-Clause production packages (about 133) | permissive | various | client, server, native | Reproduce the copyright notice and permission notice "in all copies or substantial portions" (MIT/ISC); BSD-3: also in documentation for binary redistribution | **No**. See §5 |

### 3.1 `@capgo/capacitor-health` (MPL-2.0): what the licence says and what the app does

**Verified facts about the package.** `package.json`: `"license": "MPL-2.0"`, author Martin Donadieu, repository `github.com/Cap-go/capacitor-health`. `LICENSE` in the package is the MPL 2.0 text (also confirmed for the repo's `main` branch on 2026-11-16). The individual `.swift`/`.kt`/`.ts` files carry **no** per-file Exhibit A header; MPL Exhibit A allows the notice to sit in a LICENSE file in a relevant directory instead.

**MPL-2.0 section 3, as written in that file:**

> 3.1 … All distribution of Covered Software in Source Code Form, including any Modifications that You create or to which You contribute, must be under the terms of this License. You must inform recipients that the Source Code Form of the Covered Software is governed by the terms of this License, and how they can obtain a copy of this License. …
>
> 3.2 … If You distribute Covered Software in Executable Form then: (a) such Covered Software must also be made available in Source Code Form, as described in Section 3.1, and You must inform recipients of the Executable Form how they can obtain a copy of such Source Code Form by reasonable means in a timely manner, at a charge no more than the cost of distribution to the recipient; and (b) You may distribute such Executable Form under the terms of this License, or sublicense it under different terms, provided that the license for the Executable Form does not attempt to limit or alter the recipients' rights in the Source Code Form under this License.
>
> 3.3 … You may create and distribute a Larger Work under terms of Your choice, provided that You also comply with the requirements of this License for the Covered Software. …
>
> 3.4 … You may not remove or alter the substance of any license notices … contained within the Source Code Form of the Covered Software …

**What the app does today.**

| Point | Status |
|---|---|
| Is the plugin distributed in Executable Form? | Yes on the face of it: compiled into the iOS/Android apps and minified into the web bundle. |
| Has the project modified the plugin's files? | **No evidence of modification.** No patch script or `patches/` folder touches it; the only `node_modules` patcher (`scripts/react-hydration-replay-fix.mjs`) targets React inside `next`. The version is pinned exactly (`"8.11.4"`). |
| Are recipients told how to get the Source Code Form? | **Partly.** `src/app/legal/notices/page.tsx:27-29` names the plugin, says "Mozilla Public License 2.0, whose source is available at that link", and links to `https://github.com/Cap-go/capacitor-health`. |
| Gaps against the wording of 3.1/3.2 | (1) The link is to the repo's moving default branch, not to the 8.11.4 source that is actually shipped. (2) No link to, or copy of, the MPL-2.0 text itself (3.1: "how they can obtain a copy of this License"). (3) The notice lives on a web page of the deployed site; the store listing and the app binary carry nothing. It is reachable in-app from Profile → "Notices & licenses" (`src/components/profile/legal-links.tsx:11`) and from the landing page footer (`src/app/page.tsx:147`). (4) The draft Terms (`docs/legal/TERMS_OF_SERVICE_DRAFT.md:409`) still has a placeholder for the notices URL, and its licence grant should be checked against 3.2(b) (must not limit recipients' rights in the MPL source). |

---

## 4. Native dependencies (from plugin build files; licences **not verified** unless stated)

iOS uses Swift Package Manager (`ios/App/CapApp-SPM/Package.swift`); there is no Podfile. Android includes each plugin as a Gradle project (`android/capacitor.settings.gradle`, `android/app/capacitor.build.gradle`).

| Native dependency | Declared in | Platform | Licence |
|---|---|---|---|
| `capacitor-swift-pm` 8.5.3 (Capacitor, Cordova) | `ios/App/CapApp-SPM/Package.swift` | iOS | MIT per the npm packages' LICENSE; the SwiftPM binary repo itself not checked |
| `org.apache.cordova:framework` 14.0.1; AndroidX (`appcompat`, `core`, `activity`, `fragment`, `coordinatorlayout`, `webkit`, `core-splashscreen`) | `@capacitor/android/capacitor/build.gradle`, `android/variables.gradle`, `android/app/build.gradle` | Android | Upstream states Apache-2.0. Not verified here |
| **`androidx.health.connect:connect-client:1.1.0`**, `kotlin-stdlib`, `kotlinx-coroutines-android:1.11.0` | `@capgo/capacitor-health/android/build.gradle:62-66` | Android | Upstream states Apache-2.0. Not verified here. Use of Health Connect is separately governed by Google Play policy (§8) |
| HealthKit (system framework) | `@capgo/capacitor-health` iOS sources; `ios/App/App/App.entitlements` | iOS | Apple SDK terms / Developer Program License Agreement (§8) |
| **`com.revenuecat.purchases:purchases-hybrid-common:19.10.0`** (Android); **`RevenueCat/purchases-hybrid-common` 19.10.0** (SwiftPM) | `@revenuecat/purchases-capacitor/android/build.gradle:61`, `Package.swift:14` | both | The JS wrapper's LICENSE is MIT (© 2023 RevenueCat, Inc.). The hybrid-common library and the native Purchases SDKs it pulls in were **not** inspected. They in turn bring Google Play Billing (Android) under Google's SDK terms |
| `io.ionic.libs:ionbarcode-android:2.1.1`; `OutSystems/OSBarcodeLib-iOS` ≥ 2.2.1 | `@capacitor/barcode-scanner` build files | both | Not verified |
| `com.google.zxing:core:3.5.3` | same | Android | Upstream states Apache-2.0. Not verified |
| **`com.google.mlkit:barcode-scanning:17.3.0`** | same | Android | Proprietary Google ML Kit terms (not open source). Not fetched |
| `androidx.camera:*` 1.5.1, `androidx.compose.material3` 1.4.0, `activity-compose` | same | Android | Upstream states Apache-2.0. Not verified |
| **`com.google.android.gms:play-services-location`** | `@capacitor-community/background-geolocation/android/build.gradle:50` | Android | Proprietary Google Play services / Android SDK terms. Not fetched |
| `com.google.gms:google-services:4.4.4` (classpath; applied only if `google-services.json` exists) | `android/build.gradle` | Android build | Not verified |

Android builds that include Google Play services and AndroidX usually need an open-source-licences screen (Google publishes a Gradle plugin for it). None is configured in `android/`.

---

## 5. The Notices page and the repository's own licence

**What exists.** `src/app/legal/notices/page.tsx` (36 lines, **hand-written**, not generated). Sections: Food data (Open Food Facts with ODbL, DbCL and CC BY-SA 3.0 links; USDA FoodData Central "public domain, CC0"; "USDA doesn't endorse this app"), Scripture (`ScriptureNotice`: "Scripture quotations are from the Berean Standard Bible (BSB), public domain." + link to berean.bible), Open-source software (one paragraph naming Next.js, React, Supabase, Capacitor, Radix UI and the MPL plugin), Trademarks (Apple, Google).

All links on the page are well-formed and point at the intended sites; none could be opened from this environment except GitHub (reachable). Font licence text exists at `src/app/fonts/OFL.txt` but is a source file, not a served page.

**The repository itself.** No `LICENSE`, `NOTICE` or `COPYING` file at the root. `package.json` has `"private": true` and no `"license"` field. That is consistent with proprietary code, but nothing in the repo states it.

**Concrete gaps.**

1. **Coverage.** The page names 5 projects plus the MPL plugin. The lockfile has 148 installed production packages (about 133 MIT/ISC/BSD, 8 Apache-2.0). No copyright notices and no licence texts are reproduced anywhere a user can reach.
2. **An inaccurate sentence.** "The full license texts are included with each package." That is true of `node_modules` on the build machine. It is not true of what users receive: the compiled client chunks in `.next/static/chunks` (129 files from the existing local build) contain **zero** `@license` / copyright comments, and no licence bundle is added to the native projects.
3. **Not named at all:** Stripe SDK, Anthropic SDK, RevenueCat SDK, zod, lucide (ISC), Recharts and d3 (ISC/BSD-3-Clause), ZXing and html5-qrcode (Apache-2.0), class-variance-authority (Apache-2.0), Tailwind, sharp/libvips (LGPL, server).
4. **Fonts.** Inter, Plus Jakarta Sans, Cinzel and Lora are served to every browser under the SIL OFL 1.1, which asks that the copyright notice and licence travel with copies of the font. The Notices page does not mention fonts. (The draft Terms do mention "bundled fonts (SIL Open Font License)".)
5. **Native dependencies** (§4) are not listed: RevenueCat native SDK, Health Connect client, ML Kit, Play services, Cordova, Kotlin, OSBarcodeLib.
6. **MPL notice** is partial (see §3.1): unpinned source link, no link to the licence text.
7. **"(MIT and Apache-2.0 licenses)"** is attached to five projects that are all MIT. The Apache-2.0 packages actually shipped are different ones and are not named.
8. **Open Food Facts wording** says "Product information from barcode scans". OFF is also used for product name search, category alternatives, product images, Nutri-Score, NOVA and the AI "ask about this food" feature (§6).
9. **Not maintained by a check.** No test or script ties the page to `package.json`, so it will drift.
10. **Offline surfaces.** `native-shell/` (offline page and offline Bible) and `standalone/index.html` have no notices screen. The offline Bible page and the standalone edition do show the BSB line.
11. **Nutri-Score and NOVA** are shown by name (`src/components/nutrition/quality-sections.tsx:60,367`; `scanner/page.tsx:93`) with no notice. Nutri-Score is, to the author's knowledge, a registered mark of Santé publique France with a usage regulation; **not verified today**. Cross-reference the trademark workstream.

---

## 6. Data-licence inventory

### 6.1 Summary table

| Source | What we take | How stored / cached / combined (file:line) | Licence / terms as verified, URL, retrieved 2026-11-16 | Attribution shown where | Open obligations / questions |
|---|---|---|---|---|---|
| **Open Food Facts** (API, live) | Per product: code, names, brand, quantity, serving, `nutriments`; for the scanner also image URLs, ingredients text, allergens, traces, additives, Nutri-Score grade, NOVA group, categories, labels, states, last-modified (`src/lib/open-food-facts.ts:12-23`, `src/lib/food-quality.ts:18-49`). Endpoints: `/api/v2/product/{code}.json`, `/cgi/search.pl`, `/api/v2/search` (`src/server/services/open-food-facts.ts:17`, `food-quality.ts:38,69,92`) | See §6.2 | ODbL 1.0 (database), DbCL 1.0 (contents), CC BY-SA 3.0 (images): OFF Terms of use and API docs, fetched from the project's GitHub source. ODbL text from the SPDX mirror. See §6.3 | See §6.2 | See §6.4 and findings F-2, F-3, F-4 |
| **USDA FoodData Central, SR Legacy** (bundled) | 7,448 foods: per-100 g energy, protein, carbs, fat, fibre, sugar, sodium, USDA household portions, food category | `src/data/usda-foods.json` (1.0 MB, `"source":"USDA FoodData Central, SR Legacy (public domain)"`), built by `scripts/build-food-db.mjs` from `https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip` (`.github/workflows/food-db.yml:47`). Loaded server-side only (`src/server/services/usda-local.ts:50-52`). `src/data/popular-foods.ts` and `src/data/app-recipes.ts` point at its FDC ids with the app's own friendly names | **Not fetched.** Search snippets attributed to fdc.nal.usda.gov: data are public domain, published under CC0 1.0; "no permission is needed for their use, but we request that users list FoodData Central as the source of the data"; suggested citation: "U.S. Department of Agriculture, Agricultural Research Service, Beltsville Human Nutrition Research Center. FoodData Central. [Internet]. [cited (enter date)]. Available from https://fdc.nal.usda.gov/." One data.gov catalogue entry labels it "U.S. public domain" rather than CC0 | Notices page ("FoodData Central (public domain, CC0). USDA doesn't endorse this app."); "USDA" tag on foods (`src/components/nutrition/nutrition-client.tsx:85,629`) | Counsel/owner to confirm the statement on the primary page. Notices page does not use USDA's suggested citation or state the release (SR Legacy, April 2018) |
| **USDA FoodData Central API** (optional, live) | Search and single-food lookups incl. **Branded** and FNDDS data types (`src/server/services/food-database.ts:9,93-110`). Off unless `USDA_FDC_API_KEY` is set | A food the member logs is upserted into `public.foods` with `source='usda'` (`src/server/services/food-resolve.ts:73-85`) | **Not fetched.** Snippets attributed to the FDC API guide: key from api.data.gov; default limit 1,000 requests per hour per IP; key blocked for 1 hour if exceeded | as above | Confirm that Branded Foods data (supplied by industry) carries the same public-domain/CC0 statement. API key terms (api.data.gov) to be read. Key is sent as a query parameter |
| **Berean Standard Bible** (bundled, whole Bible) | Full text, 66 books | `public/bible/bsb/books/*.json` (66 files, 4.1 MB; folder 4.2 MB with `meta.json`), built by `scripts/build-bsb-bible.mjs` from `https://bereanbible.com/bsb.txt` (SHA-256 `2ac3af1d…ca96`, downloaded 2026-11-03 per `public/bible/bsb/meta.json`). Also `src/data/bsb-passages.json` (quoted passages). Copied into the native app bundle on `cap sync` (`capacitor.config.ts:56-59`) and inlined in `standalone/index.html` | **Not fetched.** Snippets attributed to berean.bible/licensing.htm and /terms.htm: the Berean Bible texts were placed in the public domain as of April 30, 2023; public-domain materials may be freely reproduced and adapted, including commercially; works that keep the verbatim text may bear the Berean name. A "CC0" label appears only on third-party sites. An earlier in-repo audit records "Do not use the 'Berean' name on altered text" from the same terms page | "Scripture quotations are from the Berean Standard Bible (BSB), public domain." + link (`src/data/scripture.ts:41-42`; Faith pages, Notices page, standalone edition line 2121, offline reader) | Confirm the dedication wording on the primary page and whether it covers headings, footnotes and the USFM markup. The app shows the verbatim text (tests enforce it) and omits footnotes. Trademark use of "Berean" → trademark workstream |
| **BSB red-letter markup** | Positions of the words of Jesus | `public/bible/bsb/wj.json` (32 KB), built from the publisher's USFM edition `https://bereanbible.com/bsb_usfm.zip` (SHA-256 `f0c56438…5f87`), `\wj` markers (`docs/faith/RED_LETTER.md:9-12`) | Not fetched. Assumed by the repo to share the BSB's status | none specific | Confirm the USFM file is covered by the same dedication |
| **World English Bible** (eBible.org) | Nothing shipped. Used once in CI to cross-check red-letter verses (`docs/faith/RED_LETTER.md:42-43`) | Comparison results only, in `docs/faith/REVIEW.md` | Not fetched | n/a | None apparent |
| **Devotionals, studies, challenges, reading plans, memory verses, journey copy** | App-authored text | `src/data/devotionals.ts` (40 days), `src/data/studies.ts` (26 studies; 4 lessons with full notes, all `draft` and hidden from members), `src/data/faith-challenges.ts` (30), `src/lib/bible/plans.ts`, `src/lib/faith/*`, `src/data/content.ts` | Repo evidence: "written for the app, with AI assistance" (`docs/faith/REVIEW.md:3-5`; `src/data/studies.ts:8`). A search of `src/data`, `src/lib/faith*`, `src/lib/bible`, `src/lib/coach` for named theologians, commentaries, creeds, catechisms, hymns and other Bible translations found **none** (only a dormant KJV option in `src/data/scripture.ts:28-35`). All commits in the repo are authored as "Claude" | n/a | AI-assisted authorship affects copyright ownership of this text (IP workstream). "One common arrangement" chronological plan (`docs/faith/REVIEW.md` §2): no named source |
| **Exercise library** | ~160 KB of descriptions, cues, mistakes | `src/data/exercises.ts`, `src/data/exercise-batches/`, `src/data/exercise-details/` | Header: "Written for general fitness education from standard strength-training references (NSCA Essentials…; ACSM's Guidelines…; ExRx.net technique pages)" (`src/data/exercise-details/types.ts:5-6`). No dataset import found (no free-exercise-db, wger, ExerciseDB) | none | The header names three copyrighted references as sources. The repo cannot show whether text was paraphrased closely. Spot-check by counsel or an editor |
| **Program catalog** | Program structures and descriptions | `src/data/programs.ts`, `src/data/program-catalog/*` | App-authored. Several descriptions say "in the style of" named third-party programs: 5/3/1 (`programs.ts:259`), Starting Strength and StrongLifts (`:1864`), Cody Lefever's GZCLP (`:1892`), Texas Method / Rippetoe and Kilgore (`:1966`), Brandon Campbell's PHUL (`:2416`). `docs/PROGRAM_RESEARCH.md` records set/rep/percentage schemes taken from practitioner and app pages | none | Names are trademarks or author names; percentage tables are reproduced from secondary web pages → trademark/copyright workstream |
| **Strength ranks** | Thresholds per lift | `src/lib/domain/strength-ranks.ts` | "PROVISIONAL APP RULES … set by hand to sit roughly where common strength-level tables put 'beginner' to 'elite'" (`:7-10`). No table named | n/a | No named source to license; "common strength-level tables" is unspecific |
| **Formulas** | Mifflin-St Jeor (`src/lib/domain/nutrition.ts:42`), Epley 1RM (`src/lib/coach/tools.ts:535`), MET estimates: strength ≈ 5, conditioning ≈ 7, running ≈ 9.8, walking ≈ 3.5 (`src/lib/domain/calorie-budget.ts:114-115`, `exercise-energy.ts:44`) | code constants | Published scientific formulas and single values; no table copied. MET values have no cited source in code | n/a | Low. Cite the source of the MET values in a doc |
| **Sleep method** | Scoring rules | `docs/SLEEP_METHOD.md`, `src/lib/domain/sleep*.ts` | App's own rules; no third-party scale (PSQI etc.) or dataset referenced | n/a | None apparent |
| **Nutrition Score ("Food IQ")** | Thresholds from EU Reg. 1924/2006 and 1169/2011 and UK FSA 2016 guidance | `src/lib/food-iq.ts`; `docs/FOOD_IQ_METHOD.md` | Doc states an "independent, original formula", "doesn't reproduce Nutri-Score's … point tables". Off in production by default (`FOOD_IQ_SCORE=off`). Internal name "Food IQ" is noted as another company's US mark | shown per component | Input data is OFF data (see §6.4). UK guidance is Crown copyright (Open Government Licence, not verified) |
| **Additive evidence register** | Short app-written summaries with links to IARC, EFSA, FDA, EUR-Lex, WHO | `src/lib/additive-evidence.ts`, `src/lib/additive-origins.ts`; `docs/ADDITIVE_EVIDENCE_SOURCES.md` | Summaries and links, not copied text, per the doc. Some sources "couldn't be opened" when written | links in app | Accuracy risk more than licence risk (regulatory workstream) |
| **Supplement list, common foods, app recipes** | App-written | `src/data/supplements.ts` ("drawn from sports-nutrition position stands and the NIH ODS"), `src/data/foods.ts` ("based on USDA FoodData Central reference entries, rounded"), `src/data/app-recipes.ts` ("written for this app (not taken from a cookbook…)") | as stated in file headers | n/a | None apparent |

### 6.2 Open Food Facts: where the data goes (facts)

**Calls.** All from the app's server, with `User-Agent: NarrowGateFitness/1.0 (contact via app)` (`src/server/services/open-food-facts.ts:12`). HTTP responses are cached by Next.js for 24 h (`next: { revalidate: 86400 }`, `open-food-facts.ts:23`, `food-quality.ts:18`). Search results are held in server memory for 1 h (name) or 6 h (category), 500 entries each, and searches are throttled to 8 per minute per server instance (`food-quality.ts:47-56,60-103`). The test-only standalone edition calls OFF directly from the device (`standalone/index.html:2390`).

**Persistent copies in the app's own database (Supabase Postgres).**

| Table | What is written | When | Evidence |
|---|---|---|---|
| `public.foods` | One row per member per product: name, brand, serving, calories, protein, carbs, fat, fibre, `source='openfoodfacts'`, `source_ref=<barcode>`, plus `basis` JSON (label serving, sugar, sodium, missing macros) | When a member **logs** a scanned product | `src/server/services/food-resolve.ts:112-141`; `supabase/migrations/20261017000004_food_barcode.sql:1-2`; `20261112000059_foods_basis.sql` |
| `public.meal_items` | Snapshot of name and nutrition per diary entry, `source='off:<barcode>'` | on logging | `docs/DATA.md` (Food favourites / Recipes paragraphs) |
| `public.food_favorites` | `food_key='off:<barcode>'` + snapshot of name and nutrition basis | on starring | `supabase/migrations/20261020000011_food_favorites.sql:9-11,22` |
| `recipe_ingredients` | Snapshot of each ingredient's nutrition basis | on adding to a recipe | `docs/DATA.md` §1 "Recipes" |
| `ai_messages` | AI answers that may restate product data | "Ask AI about this food" | `src/lib/food-quality-ai.ts:74-83` |

Not persisted: scanner fields (ingredients, allergens, additives, Nutri-Score, NOVA, categories, images). Images are hot-linked from OFF's hosts (`src/lib/food-quality.ts:122-128`; `quality-client.tsx:278`), not copied.

**Combination with other data.** `public.foods` is one table holding four kinds of row, told apart by a `source` column: `custom` (member-entered), `usda`, `curated` (app's built-in foods, `owner_id` null), `openfoodfacts` (constraint at `20261017000004_food_barcode.sql:5-6`). OFF rows are private to the member who logged them (row-level security on `owner_id`); they are not readable by other members or anonymously. OFF values are not edited: unlisted macros are stored as 0 with a `missing` list. The app computes its own outputs from OFF data at request time: traffic-light levels, filter checks, "better alternatives", and (when switched on) the 0–100 Nutrition Score.

**Scale.** No bulk import, no dump download. The stored set is "whatever products members have logged", one copy per member. It grows without limit over time. The account data export returns the member's `foods` rows (`src/server/services/account.ts`).

**Onward disclosure.** For "Ask AI about this food", the product's OFF data is sent to Anthropic (`src/components/coach/ai-consent-card.tsx:50`; `src/lib/food-quality-ai.ts`).

**Attribution shown to users.**

| Where | Text | Link? |
|---|---|---|
| Barcode scanner sheet (`barcode-scanner.tsx:310`), amount step note (`:57`), API response (`api/foods/barcode/route.ts:26`), food list tag (`nutrition-client.tsx:85`) | "Open Food Facts (community data) — check the label" / "…come from Open Food Facts, a community database" | No link, no licence named |
| Scanner, compare and product pages (`scanner/page.tsx:137`, `compare/page.tsx:85`, `product/[code]/page.tsx:268`) | `OFF_DATA_NOTICE`: "Product data and images: Open Food Facts, a free database built by volunteers (database under the Open Database License, images under CC BY-SA). Data may be incomplete or out of date: always check the package." | Licence named in plain text, no hyperlink. The product page adds a link to the product's OFF page (`:269`) |
| Notices page | Names OFF, ODbL, DbCL, CC BY-SA 3.0 with hyperlinks | Yes |
| Diary entries, favourites, recipes, AI answers built from OFF rows | Source tag only where the food list shows it | No |

### 6.3 What the Open Food Facts and ODbL texts say (quoted from the copies fetched on 2026-11-16)

**OFF Terms of use, "Terms and conditions for re-use"** (source repo copy):

> "The Open Food Facts database is available under the Open Database License. Individual contents of the database are available under the Database Contents License. Products images are available under the Creative Commons Attribution ShareAlike licence. They may contain graphical elements subject to copyright or other rights, that may in some cases be reproduced (quotation rights or fair use)."
>
> "The individuals and entities who reproduce or re-use information, data and/or photos from the Open Food Facts site or database have to mention the licence and to attribute the authorship to Open Food Facts with a link to https://openfoodfacts.org, the appropriate local version (e.g. https://en.openfoodfacts.org) or the product page, when the information and data reproduced or re-used pertain to a specific product. Such attribution is also necessary for derivative works."
>
> "Derivative works must be shared under the same conditions. The text of each licence specifies the exact conditions for sharing derivative works."
>
> "The information and data is provided only for indicative information. It can contain errors and must not be used for medical purposes."
>
> "For instance, the Creative Commons Attribution ShareAlike licence for images only covers the photo itself … Other rights of third parties may apply, such as: copyright for the product design and graphical elements it contains …, image rights of people … featured on the packaging, trademark rights etc."
>
> "Using, contributing or reusing the site and/or information, data or photos from Open Food Facts implies full acceptance of these terms…" · "The applicable law is French law." · "In case of discrepancies, the original terms and conditions in French prevail."

**OFF API documentation** (`docs/api/index.md`, `main`):

> "15 req/min/IP address for all read product queries (`GET /api/v*/product` requests or product page)…"
> "10 req/min/IP address for all search queries (`GET /api/v*/search` or `GET /cgi/search.pl` requests); don't use it for a search-as-you-type feature, you would be blocked very quickly."
> "If these limits are reached, we reserve the right to deny you access to the website and the API through IP address ban."
> "If your requests come from your users directly (ex: mobile app), the rate limits apply per user."
> "If you need to fetch more than a few hundred products, we ask you to download the data as a CSV or JSONL file directly."
> "We ask you to **always use a custom User-Agent to identify your app** … The User-Agent should be in the form of `AppName/Version (ContactEmail)`. For example, `MyApp/1.0 (myapp@example.com)`."
> "Create an account … and fill out the API usage form so that we can identify your usage and prevent potential bans."

The same docs list v2 of the API as "deprecated" (current is v3); the app calls v2.

**ODbL 1.0** (SPDX copy):

> "**Collective Database**" – Means this Database in unmodified form as part of a collection of independent databases in themselves that together are assembled into a collective whole. A work that constitutes a Collective Database will not be considered a Derivative Database.
>
> "**Derivative Database**" – Means a database based upon the Database, and includes any translation, adaptation, arrangement, modification, or any other alteration of the Database or of a Substantial part of the Contents. This includes, but is not limited to, Extracting or Re-utilising the whole or a Substantial part of the Contents in a new Database.
>
> "**Produced Work**" – a work (such as an image, audiovisual material, text, or sounds) resulting from using the whole or a Substantial part of the Contents (via a search or other query) from this Database, a Derivative Database, or this Database as part of a Collective Database.
>
> "**Substantial**" – Means substantial in terms of quantity or quality or a combination of both. The repeated and systematic Extraction or Re-utilisation of insubstantial parts of the Contents may amount to the Extraction or Re-utilisation of a Substantial part of the Contents.
>
> "**Publicly**" – means to Persons other than You or under Your control…
>
> "**Convey**" – … Conveying does not include interaction with a user through a computer network, or creating and Using a Produced Work, where no transfer of a copy of the Database or a Derivative Database occurs.
>
> 4.3 … "if you Publicly Use a Produced Work, You must include a notice associated with the Produced Work reasonably calculated to make any Person that uses, views, accesses, interacts with, or is otherwise exposed to the Produced Work aware that Content was obtained from the Database, Derivative Database, or the Database as part of a Collective Database, and that it is available under this License." Example notice: "Contains information from DATABASE NAME, which is made available here under the Open Database License (ODbL)." with hyperlinks to the database and the licence text, or the plain-text URIs if hyperlinks are not possible.
>
> 4.4 a. "Any Derivative Database that You Publicly Use must be only under the terms of: i. This License; ii. A later version…; or iii. A compatible license." · 4.4 c. "A Derivative Database is Publicly Used and so must comply with Section 4.4. if a Produced Work created from the Derivative Database is Publicly Used."
>
> 4.5 b. "Using this Database, a Derivative Database, or this Database as part of a Collective Database to create a Produced Work does not create a Derivative Database for purposes of Section 4.4" · 4.5 c. "Use of a Derivative Database internally within an organisation is not to the public…"
>
> 4.6 "If You Publicly Use a Derivative Database or a Produced Work from a Derivative Database, You must also offer to recipients of the Derivative Database or Produced Work a copy in a machine readable form of: a. The entire Derivative Database; or b. A file containing all of the alterations made to the Database or the method of making the alterations…"
>
> 6.2 "This License does not affect any rights of lawful users to Extract and Re-utilise insubstantial parts of the Contents … The repeated and systematic Extraction or Re-utilisation of insubstantial parts of the Contents may however amount to the Extraction or Re-utilisation of a Substantial part of the Contents."

### 6.4 Questions this leaves for counsel (not decided here)

1. Is the set of `source='openfoodfacts'` rows in `public.foods` (plus the snapshots in `meal_items`, `food_favorites`, `recipe_ingredients`) a "database based upon the Database" containing a "Substantial part of the Contents"? Relevant facts: rows accumulate one logged product at a time, with no bulk extraction; ODbL's "repeated and systematic" sentence; a reduced set of fields is kept; there is no upper bound; copies are per member.
2. If it is a Derivative Database, is it "Publicly Used"? Relevant facts: each row is shown only to the member who created it; screens built from those rows (the diary, My foods) are shown to that member, who is a person outside the company; 4.4 c links Produced Works to the underlying Derivative Database; 4.5 c covers internal use only.
3. Does keeping OFF rows in the same table as USDA, curated and member-entered rows make a Collective Database (ODbL: the Database "in unmodified form as part of a collection of independent databases") or something else? The rows are separable by `source`.
4. Are the screens (product page, traffic lights, alternatives, Nutrition Score, AI answers) Produced Works needing the 4.3 notice, and does the present notice satisfy 4.3 and the OFF Terms' "mention the licence and … a link" where it has no hyperlink (barcode sheet, diary, favourites, compare and scanner pages)?
5. If 4.4/4.6 applied, would the company have to offer the OFF-derived rows (or the method) under ODbL, and can that be done given they sit in members' private accounts?
6. OFF Terms: "must not be used for medical purposes". The app shows allergen checks and health-oriented scores built on OFF data. Is that a "medical purpose"?
7. Product photos: CC BY-SA 3.0 covers the photographer's rights only; packaging artwork and marks belong to third parties. The app displays the photos by hot-link with a general credit and no per-image author credit.
8. French governing law for the OFF Terms.

---

## 7. External services the code calls

Hosts found in `src/`, `next.config.ts`, `src/lib/security-headers.ts`, `src/server/env.ts`, `.env.example`, `public/`, `native-shell/`, `standalone/`. Governing documents are named, not interpreted.

| Service | Purpose | Where | Data sent | Governing documents to obtain |
|---|---|---|---|---|
| **Anthropic API** (`api.anthropic.com`) | AI coach, Bible study helper, food photo and label photo analysis, "ask about this food" | `src/server/services/ai-coach.ts:102`, `bible-ai.ts`, `food-photo.ts`, `label-photo.ts`; `ANTHROPIC_API_KEY` | Member messages; profile and training context; food and label photos; OFF product data; via tools, sleep summaries that can include nights imported from Apple Health / Health Connect (`src/lib/coach/tools.ts:262-264`) | Commercial Terms of Service; Usage Policy (incl. High-Risk Use Case Requirements); DPA; data-retention terms. See §8 |
| **Supabase** (`*.supabase.co`) | Database, auth, storage, realtime, auth emails | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; `supabase/templates` | All account data, incl. health-related data and photos | Terms of Service; DPA; (HIPAA add-on not applicable unless counsel says otherwise); sub-processor list |
| **Stripe** (`checkout.stripe.com`, `billing.stripe.com`, API) | Web subscriptions | `STRIPE_*`; CSP `form-action` | Email, customer id, subscription state | Stripe Services Agreement; DPA; brand guidelines |
| **RevenueCat** (`api.revenuecat.com`, native SDK) | App Store / Play subscriptions | `REVENUECAT_*`; `@revenuecat/purchases-capacitor` | App user id, purchase receipts | RevenueCat Terms; DPA |
| **Apple** (App Store, StoreKit, HealthKit, `apps.apple.com`) | Distribution, IAP, health data | native app; `App.entitlements` | n/a | Apple Developer Program License Agreement; App Review Guidelines; Schedule 2 (paid apps). See §8 |
| **Google** (Play, Play Billing, Health Connect, Play services location, ML Kit, `play.google.com`) | Distribution, IAP, health data, location, barcode ML | native app | n/a | Google Play Developer Distribution Agreement; Developer Program Policies (Health Connect / health apps); Google APIs / ML Kit terms. See §8 |
| **Open Food Facts** (`world.openfoodfacts.org`; image hosts `*.openfoodfacts.org`) | Barcode, search, product images | §6.2 | Barcode or search text from the server; members' browsers load images straight from OFF (member IP visible to OFF) | OFF Terms of use; ODbL; DbCL; CC BY-SA 3.0; API docs |
| **USDA FoodData Central API** (`api.nal.usda.gov`) | Optional food search | `USDA_FDC_API_KEY` | Search text | api.data.gov key terms; FDC API guide |
| **YouTube (`youtube-nocookie.com`) and Vimeo (`player.vimeo.com`)** | Embedded exercise videos if an administrator links one | `src/lib/media.ts`; CSP `frame-src` | Viewer IP to the video host | YouTube API Services Terms / Terms of Service; Vimeo Terms |
| **Google Fonts** (`fonts.googleapis.com`, `fonts.gstatic.com`) | Allowed by the CSP (`security-headers.ts:46-47`) but the main app serves fonts locally (`src/app/layout.tsx:15-26`). `standalone/index.html` does load Inter and Plus Jakarta Sans from Google Fonts | CSP; standalone edition | Viewer IP (standalone only) | Google Fonts terms / privacy FAQ. The CSP allowance appears unused in the main app |
| **Map tiles** | Off. Enabled only by `NEXT_PUBLIC_MAP_TILE_URL` + attribution | `.env.example:109-116`; `src/lib/domain/map-tiles.ts` | Route area, viewer IP | The chosen provider's terms and attribution rules (none chosen) |
| **Hosting (Vercel per docs)** | Runs the app | `docs/ERROR_MONITORING.md`, privacy page | All traffic | Vercel Terms; DPA |
| **Analytics / error monitoring** | None. Errors go to the app's own server log (`docs/ERROR_MONITORING.md`); no vendor SDK | | | Only if a log drain is connected |
| **Email** | No separate provider in code; Supabase Auth sends auth emails | `supabase/templates` | Email address | Supabase terms; any SMTP provider configured in the Supabase dashboard (not visible in the repo) |
| **GitHub Actions** | CI, builds, scheduled billing reconcile | `.github/workflows/*` | Secrets, build artefacts | GitHub Terms |
| Reference links only (no data exchange): `berean.bible`, `opendatacommons.org`, `creativecommons.org`, `efsa.europa.eu`, `eur-lex.europa.eu`, `fda.gov`, `who.int`, `iarc.who.int`, `paho.org`, `foodsafety.gov`, `pubmed.ncbi.nlm.nih.gov` | | | | |

---

## 8. Platform and provider data-use terms flagged for counsel

**Apple, App Review Guideline 5.1.3(i)** (fetched 2026-11-16 from developer.apple.com via an extraction tool; confirm against the live page):

> "Apps may not use or disclose to third parties data gathered in the health, fitness, and medical research context—including from the Clinical Health Records API, HealthKit API, Motion and Fitness, MovementDisorder APIs, or health-related human subject research—for advertising, marketing, or other use-based data mining purposes other than improving health management, or for the purpose of health research, and then only with permission. … You must disclose the specific health data that you are collecting from the device."

5.1.3(ii): "Apps must not write false or inaccurate data into HealthKit … and may not store personal health information in iCloud." 5.1.2(vi): "Data gathered from the … HealthKit … may not be used for marketing, advertising or use-based data mining, including by third parties."

Facts to weigh: the app reads steps, sleep, heart rate, HRV and respiratory rate from HealthKit (`Info.plist` `NSHealthShareUsageDescription`); it stores them in Supabase; the AI coach can pass sleep summaries built from them to Anthropic; no advertising SDK was found. The Apple Developer Program License Agreement's HealthKit clauses were **not** fetched.

**Google Health Connect.** The Play policy text was **not** fetched (host blocked). The Android app declares Health Connect through the plugin (`connect-client:1.1.0`). Counsel/owner should read the current "Health Connect by Android" permissions policy and the health apps declaration, in particular limits on transferring Health Connect data to third parties and on AI/ML use.

**Anthropic Usage Policy** (fetched 2026-11-16 from anthropic.com/legal/aup via an extraction tool that returned fragments; shown effective date "Nov 12, 2026"; re-read in full before relying on it). Fragments returned:

> High-risk "Medical" area: "diagnosing a condition; recommending, starting, stopping, or adjusting a treatment or medication, including dose" … "This includes assessing, diagnosing, or treating a mental health condition." · "A qualified person must meaningfully review a High-risk AI Recommendation" · listed outside that area: "Wellness content, such as education on sleep, stress, nutrition, or exercise." · "All consumer-facing chatbots or AI agents that communicate directly with external users" must disclose they are AI: "This disclosure must be provided at a minimum at the beginning of each chat session or in the product interface." · "We define a minor or child to be any individual under the age of 18 years old" · "Products serving minors" must "comply with the additional guidelines outlined in our Support" article.

Facts to weigh: the product is a consumer AI fitness, nutrition, sleep and Bible-study assistant; the Bible helper is labelled "Bible study helper (AI)" with "This is an AI, not a pastor" (`docs/faith/REVIEW.md` §5); an AI consent card exists (`src/components/coach/ai-consent-card.tsx`). Where the coach's outputs fall relative to the "Medical" and "Wellness" wording, and the age position, are for counsel.

---

## 9. Findings

Severity: High = could block launch or create a claim; Medium = should be fixed or decided before public launch; Low = housekeeping.

| # | Finding | Severity | Confirmed / suspected | Evidence | Business impact | Recommended action | Counsel must decide | Blocks public launch | Can technical testing resolve it |
|---|---|---|---|---|---|---|---|---|---|
| F-1 | Open-source notices given to users are incomplete. About 148 production packages; the Notices page names 6; no copyright notices or licence texts reach users; the page says licence texts "are included with each package", which is not true of the shipped bundles or apps | Medium | Confirmed (page content; 0 licence comments in 129 built client chunks). Native binaries not inspected | §5 | Non-conformance with the notice conditions of MIT/ISC/BSD/Apache-2.0; store reviewers and enterprise customers sometimes ask for this | Generate a full third-party notices file from the lockfile at build time and serve it from `/legal/notices`; add an Android OSS-licences screen or the same page in-app; remove the inaccurate sentence | N (Y for wording) | Counsel | Y (a build check can prove the generated list matches the lockfile) |
| F-2 | Open Food Facts data is persisted in the app's database (`foods`, `meal_items`, `food_favorites`, `recipe_ingredients`) and mixed in one table with USDA, curated and member data. Two code comments say the opposite ("never copied into the app's food tables") | High until counsel classifies it | Facts confirmed; legal classification open | §6.2, §6.4; `food-resolve.ts:112-141`; comments at `food-quality.ts:9-12` and `20261024000033_food_quality.sql:1-2` | If it is a publicly used Derivative Database, ODbL share-alike and the 4.6 offer of the database would apply to those rows | Counsel to answer §6.4 Q1–5. Technical options to present: keep as is with notices; store only the barcode and re-fetch; move OFF rows to a separate table/schema with an ODbL notice; offer an ODbL export | **Y** | Counsel | N (needs a legal decision; engineering can then implement) |
| F-3 | Open Food Facts API usage does not match the published API rules: (a) User-Agent has no contact email (`"NarrowGateFitness/1.0 (contact via app)"`); (b) all product reads come from the server's IP, and the docs fetched today state 15 product reads per minute per IP, with IP bans for exceeding; the code comment assumes only the 10/min search limit; (c) no record of the API usage form; (d) v2 endpoints are marked deprecated; (e) search throttle is per server instance, so several instances can exceed 10/min | Medium (operational: High at scale) | (a), (d), (e) confirmed in code; (b) limit confirmed from the docs' `main` branch, live site not reachable; (c) no evidence either way | §6.2, §6.3 | Barcode scanning can be banned for all users at modest traffic; goodwill with OFF | Fix the User-Agent; fill the usage form; contact reuse@openfoodfacts.org about expected volume; consider a shared (database or KV) throttle, or the data dump/mirror for volume; plan a v3 migration | N | N for a small beta; Y before scale | Y (load test against the staging host with the limits in mind) |
| F-4 | Open Food Facts attribution is uneven: several screens name OFF without the licence or any link; `OFF_DATA_NOTICE` names the licence in plain text without a hyperlink; stored OFF rows shown later (diary, favourites, recipes) carry at most a source tag | Medium | Confirmed | §6.2 table | OFF Terms require mentioning the licence and a link to OFF or the product page; ODbL 4.3 notice | Add a linked notice wherever OFF data is displayed, or a consistent "Open Food Facts · ODbL" link to `/legal/notices` and the product page | Y (sufficiency) | Counsel | Y (UI test can assert the notice is present) |
| F-5 | MPL-2.0 plugin: source notice exists but is unpinned and does not point to the licence text; draft Terms still carry a placeholder for the notices location | Medium | Confirmed | §3.1 | Incomplete conformance with MPL 3.1/3.2 wording | See corrections C-3, C-4; counsel to check the Terms' licence grant against MPL 3.2(b) | Y (Terms wording) | Counsel | N |
| F-6 | Fonts under SIL OFL 1.1 are served without the licence/copyright notice being available to users | Low | Confirmed | §5 gap 4; `src/app/fonts/OFL.txt` | OFL condition 2 (notice with each copy) | Add a Fonts paragraph and serve the OFL text (C-5) | N | N | Y |
| F-7 | USDA and BSB licence statements in the app and docs ("public domain, CC0"; "public domain") could not be confirmed against the primary pages today | Low–Medium | Suspected accurate (consistent search snippets); **unverified** | §1 table; §6.1 | If wrong, attribution wording or permitted use changes; the whole Bible feature depends on the BSB dedication | Owner or counsel opens `berean.bible/licensing.htm`, `berean.bible/terms.htm`, `fdc.nal.usda.gov` (download and API guide pages) and saves dated copies in the repo; confirm scope for USFM markup and for USDA Branded Foods | Y (read the two pages) | Counsel | N |
| F-8 | HealthKit / Health Connect data can flow to Anthropic through the AI coach's sleep tools | Medium–High | Data path confirmed at the tool-description level (`src/lib/coach/tools.ts:262-264`); platform policy texts only partly fetched | §8 | App Store / Play rejection or policy breach if the disclosure, consent or permitted-purpose tests are not met | Counsel to read ADP License Agreement HealthKit clauses, Guideline 5.1.3, the Health Connect policy; confirm consent copy and privacy policy name Anthropic as recipient of health-derived data; consider excluding platform-imported health data from AI context until cleared | **Y** | Counsel | Partly (a test can prove whether imported data is excluded) |
| F-9 | Anthropic Usage Policy: consumer AI giving fitness, nutrition, sleep and faith guidance; minors; AI disclosure | Medium | Policy fragments fetched; fit to the product not assessed | §8 | Loss of API access if out of policy | Counsel to read the current Usage Policy and Commercial Terms in full and map each AI feature to them; confirm the age gate | **Y** | Counsel | N |
| F-10 | LGPL-3.0-or-later libvips binaries (via `sharp`) run on the server and are not mentioned anywhere | Low | Confirmed present; "server only" inferred from Next.js architecture, not from an inspected deployment | §3 | Obligations arise on conveyance; position on hosted deployment is a legal question | Counsel to confirm no obligation when run on a host; mention in the generated notices anyway | Y | N | N |
| F-11 | Native dependency licences and versions are not visible in the repo (no SwiftPM/Gradle lock); Google ML Kit and Play services are proprietary SDKs with their own terms | Low–Medium | Confirmed absence of lockfiles; licences unverified | §4 | Unknown obligations in the shipped binary | Commit `Package.resolved`; run a Gradle licence report in CI; list ML Kit, Play services, RevenueCat native SDK terms in the vendor register | N | N | Y (CI licence report) |
| F-12 | Content written "from" named copyrighted references (NSCA, ACSM, ExRx) and programs "in the style of" named third-party programs | Medium | Statements confirmed in file headers; degree of similarity not assessed | §6.1 | Copyright/trademark exposure in the exercise and program content | Hand to the IP/trademark workstream; editorial spot-check against the named sources | Y | Counsel | N |
| F-13 | Nutri-Score and NOVA labels are displayed by name, taken from OFF | Low–Medium | Display confirmed; mark status and usage rules **not verified** | §5 gap 11 | Possible trademark/usage-regulation issue (Nutri-Score) | Trademark workstream to check the Nutri-Score usage regulation and whether textual reference to an OFF-computed grade is permitted | Y | Counsel | N |
| F-14 | Repository has no licence statement; `package.json` has no `license` field | Low | Confirmed | §5 | Ambiguity for contractors/acquirers; npm warnings | Add `"license": "UNLICENSED"` (C-6); optional short proprietary notice file | N | N | Y |
| F-15 | Product photos from OFF are displayed by hot-link with a generic CC BY-SA credit; OFF's own terms warn third-party rights in packaging artwork are not covered | Low–Medium | Confirmed | §6.3, §6.4 Q7; `quality-client.tsx:278` | Third-party image/trademark claims; CC BY-SA attribution detail | Counsel to decide on per-image attribution or dropping images | Y | Counsel | N |

---

## 10. Low-risk technical corrections proposed (NOT applied)

| # | File | Change | Proposed text |
|---|---|---|---|
| C-1 | `src/server/services/open-food-facts.ts:12` | Put a monitored contact email in the User-Agent, in the form OFF asks for | `export const OFF_USER_AGENT = "NarrowGateFitness/1.0 (<monitored support email>)";` (owner to supply the address; also update `tests/` expectations if any assert the old string) |
| C-2 | `src/server/services/food-quality.ts:9-12` and `supabase/migrations/20261024000033_food_quality.sql:1-2` (comment only; do not edit an applied migration, add the note in `docs/DATA.md` instead) | Correct comments that say OFF data is never copied | "Scanner reads (ingredients, allergens, scores, images) are not stored. A product the member logs is cached per member in public.foods (source 'openfoodfacts') and snapshotted in meal_items, food_favorites and recipe_ingredients; see src/server/services/food-resolve.ts. Published OFF limits: 15 product reads and 10 searches per minute per IP." |
| C-3 | `src/app/legal/notices/page.tsx:28-29` | Pin the MPL source link to the shipped version and link the licence text | "…and the Capacitor Health plugin (@capgo/capacitor-health 8.11.4), licensed under the Mozilla Public License 2.0 (https://www.mozilla.org/MPL/2.0/). We use it unmodified; its source code is available at https://www.npmjs.com/package/@capgo/capacitor-health/v/8.11.4 and https://github.com/Cap-go/capacitor-health." (version text must be updated with the dependency) |
| C-4 | `src/app/legal/notices/page.tsx:29` | Remove the inaccurate sentence | Replace "The full license texts are included with each package." with "A full list of third-party components and their licence texts is available at [link to generated notices file]." (only once that file exists; until then delete the sentence) |
| C-5 | `src/app/legal/notices/page.tsx` (new paragraph under Open-source software) | Add fonts | "Fonts: Inter (© 2016 The Inter Project Authors), Plus Jakarta Sans (© 2020 The Plus Jakarta Sans Project Authors), Cinzel (© 2020 The Cinzel Project Authors) and Lora, each under the SIL Open Font License 1.1 (https://openfontlicense.org)." Copy the Lora copyright line (© 2011 The Lora Project Authors, Reserved Font Name "Lora") from `src/app/fonts/OFL.txt:13-14`; serve `OFL.txt` (for example copy it to `public/licenses/OFL.txt`) and link it |
| C-6 | `package.json` | State the repo's licence position | add `"license": "UNLICENSED",` after `"private": true,` |
| C-7 | `src/app/legal/notices/page.tsx:12` | Describe OFF use accurately | "Product information for barcode scans, product search, product photos and comparisons comes from Open Food Facts…" |
| C-8 | `src/app/legal/notices/page.tsx:27` | Fix the licence attribution | "…including Next.js, React, Supabase, Capacitor and Radix UI (MIT license), and other components under the MIT, ISC, BSD and Apache-2.0 licenses…" |
| C-9 | `src/lib/food-quality.ts:51-52` and the three pages that render `OFF_DATA_NOTICE` | Make the licence reference a link | Render the notice with links: "Open Food Facts" → `https://world.openfoodfacts.org`, "Open Database License" → `https://opendatacommons.org/licenses/odbl/1-0/`, or append a "Notices & licenses" link to `/legal/notices` |
| C-10 | `src/app/legal/notices/page.tsx:20-21` | Use the publisher's requested citation and name the release | "Food search uses FoodData Central (U.S. Department of Agriculture, Agricultural Research Service; SR Legacy release, April 2018, and the FoodData Central API)…" (after F-7 is confirmed) |
| C-11 | `docs/legal/TERMS_OF_SERVICE_DRAFT.md:409` | Fill the placeholder | Replace "[ATTRIBUTIONS / OPEN-SOURCE NOTICES URL OR IN-APP SCREEN]" with "/legal/notices (in the app: Profile → Notices & licenses)" |

---

## 11. Not verified (summary)

- Live wording of: Open Food Facts terms page (repo copy used), opendatacommons.org (SPDX copy used), DbCL, CC BY-SA 3.0, USDA FoodData Central licence/citation/API terms, Berean Standard Bible licensing and terms, Google Health Connect policy, Apple Developer Program License Agreement, Nutri-Score usage regulation, RevenueCat/Stripe/Supabase/Vercel/YouTube/Vimeo terms.
- Apple guideline and Anthropic policy quotations came through a text-extraction tool; confirm verbatim.
- Contents of the built native apps and the production web deployment; licences of native transitive dependencies; licences of the 121 uninstalled platform packages (lockfile value used).
- Whether each package's declared licence matches all of its files.
- Similarity of app-written content to the reference works it names.
