# Narrow Gate Fitness — Preliminary IP & Asset Risk Register
Reviewed 2026-10-24. Branch: `claude/animated-opening-demo`.

**Scope & limitations:** Preliminary code/document review, not legal advice, not a full image-similarity or trademark clearance search, and not a patent freedom-to-operate claim chart. No proven infringement identified. U.S. trademark attorney and patent counsel should confirm priority issues.

| Priority | Issue | Evidence and recommendation |
|---|---|---|
| HIGH | **Food IQ / FOODIQ feature name** | `docs/FOOD_IQ_METHOD.md`, `src/lib/food-iq.ts`. Prior public record searches returned third-party FOODIQ / FOOD IQ trademark registrations in food-related sectors. Verify current registration status, owner, goods/services, priority and common-law use directly through USPTO TSDR; seek counsel's clearance before presenting this as a standalone brand. |
| HIGH | **Primary NARROW GATE FITNESS name** | `src/app/layout.tsx`, `src/components/common/logo.tsx`. Similar commercial fitness naming (e.g. Narrow Gate Strength & Conditioning) has appeared publicly. A comprehensive live/dead and common-law clearance must cover fitness apps, coaching, training programs and nutrition services before branding investment. |
| HIGH | **Badge art ownership / chain of title** | `docs/BADGE_ART_SPEC.md` expressly says 27 existing WebP badge files are crops from the owner's poster screenshots and genuine new master artwork is not finished. Confirm who created posters, the source image assets, commissioned work assignment/license, any AI vendor commercial terms and whether derivative rights exist. Retain signed permissions and originals. Owner possession of screenshots alone does not establish copyright ownership. |
| HIGH | **Open Food Facts database reuse** | `src/lib/open-food-facts.ts`, `src/lib/food-iq.ts`, and food database integration. OFF documents ODbL attribution/share-alike, API use requirements and separate CC BY-SA for product images. Audit whether entries are copied to private tables or combined with USDA/custom food entries to form a derivative database. Check data provenance, product image usage, user agent and attribution placement. Get counsel/licensor clarification for database combination. Source: https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/ |
| HIGH | **Legal disclosure mismatch** | `docs/LEGAL_REQUIREMENTS.md` states 'there is no GPS tracking' and 'Not collected: location / GPS,' while the project README and native code implement GPS run tracking and background location permissions (`ios/App/App/Info.plist`). Update legal inventory and privacy disclosures before external release. This is an accuracy/compliance issue, not evidence of infringement. |
| MEDIUM | **Exercise videos/photos** | `scripts/import-exercise-videos.ts` requires a free-form `--license` and `--attribution`. That is bookkeeping, not proof of valid underlying commercial licenses. Confirm each upload's creator, signed license, scope, model releases where applicable, attribution and proof of ownership. |
| MEDIUM | **Logo design similarity** | `src/components/common/logo.tsx` draws a simple arched golden gate and describes it as original. Perform image/design mark clearance; provenance alone does not guarantee non-confusion. |
| MEDIUM | **Patent freedom-to-operate** | Prioritize actual claim-by-claim search around image-based body scan, food analysis/nutrient scoring, wearable recovery scoring and automated exercise program adaptation. Generic functional resemblance alone is not evidence of infringement. Check U.S. family status, enforceable claims, expiration, geographic scope with patent counsel. |
| LOW | **Berean Standard Bible excerpts** | `src/data/scripture.ts`. Official Berean Bible says texts were dedicated to public domain 2023-04-30; credit appreciated though not mandatory. Source: https://berean.bible/licensing.htm |
| LOW | **USDA FoodData Central** | `src/data/usda-foods.json` sourced from USDA, which identifies FoodData Central as public domain (CC0) and requests source credit. Source: https://fdc.nal.usda.gov/api-guide/ |
| LOW | **Open-source UI dependencies/fonts** | `package.json` includes Capacitor, Radix, Lucide, etc., `src/app/layout.tsx` uses Google fonts. Generate an exact locked-dependency SBOM / license inventory, include required notices and check redistribution restrictions for binary packages, fonts, SDK terms and branding. |

## Immediate to-do
1. Obtain counsel clearance for `NARROW GATE FITNESS` and `FOOD IQ`, with live TSDR printouts and common-law search results.
2. Obtain artwork ownership/provenance for every badge poster and uploaded exercise media before commercial distribution.
3. Resolve OFF attribution, data combination and share-alike analysis; preserve separate source provenance.
4. Correct outdated legal inventories about GPS and other newer features, then review external privacy policy/terms.
5. Assemble dependency license/SBOM reports and secure lawyer review for targeted patent FTO questions.

Nothing in this report proves infringement or establishes that a brand is safe to register or use.
