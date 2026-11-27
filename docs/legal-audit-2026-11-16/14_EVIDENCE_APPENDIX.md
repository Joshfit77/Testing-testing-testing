# 13. Evidence appendix

Date of all retrievals and runs: 2026-11-16, unless a report states otherwise.

## A. Repository state audited

| Branch | Commit | Note |
|---|---|---|
| `claude/friends-challenges` | `b7c5cac` plus the remediation commit that adds this file | Audited tree. Contains the two branches below plus Friends (switched off) |
| `release/testflight-rc-2026-11-15` | `56500ff` | Release candidate; not modified by this audit |
| `claude/pro-premium` | `fcdd129` | Ancestor of the release candidate |
| `main` | `aad49a1` | Far behind; not audited separately |

The checkout is shallow: history visible here starts on 2026-11-13 with an import commit (`223ee96`). Earlier history,
and the commits the older launch-audit reports were written against, could not be examined.

Audit commits on `claude/friends-challenges`: `61e74e6` (ownership checklist), `329ee36` (asset ledger), `f71c38d`
(trademark register), `a959965` and `5c9c9c8` (dependency list and licence inventory), `0eefad3` (patent review),
`f8722a8` (store checklist, claims audit), `45165db` (data-flow map), `b7c5cac` (legal documents, Friends audit).

## B. Test runs supporting statements in this package

| Run | Result | When |
|---|---|---|
| `npx tsc --noEmit`, `npx eslint .` | Clean | After the part A corrections |
| `npx vitest run --project unit` | 257 files; 4,728 passed, 1 skipped | After the part A corrections |
| `npx vitest run --project integration` (local Supabase, all 77 migrations) | 80 files passed, 1 skipped; 485 passed, 1 skipped | After the part A corrections |
| `tests/integration/friends.test.ts` | 18 passed (16 of 17 before correction A4: one test failed because the run fell on a Monday) | Before and after |
| `tests/integration/cross-user-isolation.test.ts`, `api-function-surface.test.ts` | Passed, with the Friends tables and functions included | After migration 077 |
| Browser suite (`--project mobile`, stand-ins for the AI provider and food database) | 148 passed, 101 skipped, 2 failed and then fixed (service worker), from the Phase 1 review | Before this audit; **not re-run after the part A corrections** |

All tests used synthetic accounts in a local database. No production system or real member data was touched.
Nothing was run on a physical phone or in a store console.

## C. Sources that could not be reached

USPTO trademark search and status (tmsearch, TSDR); USPTO Patent Center; Google Patents; Espacenet; Justia;
Trademarkia; uspto.report; TMview; WIPO; the Apple App Store and Google Play listings; `support.google.com` and
`play.google.com` policy pages; `openfoodfacts.org` and `opendatacommons.org` (GitHub copies were used);
`fdc.nal.usda.gov` and the Berean Bible publisher's pages (search snippets only); domain registration (RDAP);
the third-party businesses' own websites. Each report lists what it relied on instead.

## D. Web sources cited, by report

Type of each source (official record, secondary source, unverified lead) is stated beside its use in the report
itself. A URL appearing here does not mean the page was opened: some are recorded as the place where counsel should
look, and the reports say which were fetched and which were not.

### Cited in `02_TRADEMARK_CONFLICT_REGISTER.md` (74)

- https://apps.apple.com/app/id6449856784
- https://apps.apple.com/app/id6776576667
- https://apps.apple.com/us/app/-/id6756872057
- https://appshunter.io/ios/app/ingredient-checker-foodiq/id6762440690
- https://classpass.com/studios/narrow-path-athletics-casselberry
- https://corehandf.com/stairmaster-branding
- https://journalofcyberpolicy.com/?p=304016
- https://markinton.com/trademark/food-iq-85481822
- https://markinton.com/trademark/foodiq-88541061
- https://markinton.com/trademark/skierg-77870905
- https://markinton.com/trademark/the-gate-85091506
- https://markinton.com/trademark/wisescore-97108875
- https://markinton.com/trademark/wokwow-99571469
- https://my.playbookapp.io/narrowpathco
- https://narrowgate.org/our-story/
- https://narrowgateefl.com/who-we-are/
- https://narrowgatewellness.com/
- https://nglodge.org/
- https://rocketreach.co/crossfit-narrow-gate-profile_b47276e9fc5cd0ed
- https://search.ipaustralia.gov.au/trademarks/search/view/2457439/details
- https://trademark.justia.com/778/64/narrow-gate-wellness-77864192.html
- https://trademark.justia.com/792/78/nutri-79278346.html
- https://trademark.justia.com/851/46/starting-strength-85146322.html
- https://trademark.justia.com/863/83/jeff-galloway-training-run-walk-86383758.html
- https://trademark.justia.com/877/90/rooted-in-87790465.html
- https://trademark.justia.com/888/57/faith-88857119.html
- https://trademark.justia.com/907/52/jim-wendler-5-3-90752575.html
- https://trademark.justia.com/978/06/80-20-97806347.html
- https://trademark.justia.com/986/57/narrow-path-98657296.html
- https://trademark.justia.com/owners/80-20-endurance-llc-5442162
- https://trademark.justia.com/owners/broska-communications-llc-1686042
- https://trademark.justia.com/owners/i-am-rooted-5544722
- https://trademark.justia.com/owners/jim-wendler-llc-2435838
- https://trademark.justia.com/owners/mcelfish-alexander-5950569
- https://trademark.justia.com/owners/narrow-gate-electrical-services-llc-2175063
- https://trademarkdir.com/trademark/nutrishift-score-97063378
- https://trademarkdir.com/trademark/trademark-97074083
- https://trademarkregistration.app/Trademark/Details/86381009
- https://trademarkregistration.app/Trademark/Details/99312657
- https://trademarks.justia.com/751/13/stairmaster-75113371.html
- https://trademarks.justia.com/792/78/nutri-score-79278494.html
- https://trademarks.justia.com/854/81/food-85481822.html
- https://trademarks.justia.com/888/22/assaultbike-88822491.html
- https://trademarks.justia.com/907/65/narrow-gate-wealth-90765404.html
- https://trademarks.justia.com/970/63/nutrishift-97063378.html
- https://trademarks.justia.com/978/33/narrow-paths-high-97833162.html
- https://trademarks.justia.com/981/64/narrow-98164045.html
- https://trademarks.justia.com/owners/acxion-foodservice-inc-5802784
- https://trademarks.justia.com/owners/food-iq-inc-3330611
- https://village.ai/company/crossfit-narrow-gate
- https://www.bonfire.com/store/narrowpath-martial-arts/
- https://www.discobrands.co/brands/narrow-gate
- https://www.facebook.com/NPA2021/
- https://www.narrowgateathletics.com/
- https://www.narrowgateclub.com/
- https://www.narrowgateclub.com/groups
- https://www.narrowgateclub.com/post/christian-community-greensboro-nc
- https://www.narrowgateco.com/
- https://www.narrowgatecounselingservices.com/
- https://www.narrowgatestrength.com/
- https://www.narrowgatestrength.com/store
- https://www.narrowgatestrength.com/trainingpackages
- https://www.narrowpathathletics.com/
- https://www.narrowpathathletics.com/about
- https://www.narrowpathfitness.com/
- https://www.rijksoverheid.nl/documenten/2023/12/22/conditions-of-use-of-the-trademark-nutri-score
- https://www.santepubliquefrance.fr/content/download/150258/file/24042023CoU_EN.pdf
- https://www.santepubliquefrance.fr/en/nutrition-and-physical-activity/nutri-score
- https://www.skool.com/rooted-in-faith-network-1840
- https://www.skool.com/the-narrow-gate-4483/about
- https://www.trademarkelite.com/trademark/trademark-detail/87893232/STARTING-STRENGTH
- https://www.trademarkelite.com/trademark/trademark-detail/98164045/NARROW-GATE
- https://www.wellnessliving.com/explore/locations/crossfit/us-az-phoenix/crossfitnarrowgate/
- https://www.youtube.com/channel/UCzVcQrfBajRaCjiHnBeJbYA

### Cited in `03_PATENT_REVIEW.md` (36)

- https://ai-lab.exparte.com/case/dct/ded/1:26-cv-00289/doc/1
- https://dockets.justia.com/docket/delaware/dedce/1:2026cv00289/92454
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11232629
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11580693
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11854146
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12109454
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12163790
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12165271
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12165771
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12347542
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12551757
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12551760
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12555666
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12614640
- https://litigation.rpxcorp.com/litigation/dedce-92454-whoop-v-finerpoint
- https://patents.google.com/patent/US10842429B2/en
- https://patents.google.com/patent/US11903730B1/en
- https://patents.google.com/patent/US12163790
- https://patents.google.com/patent/US12165771B2/en
- https://patents.google.com/patent/US20140350850A1/en
- https://patents.google.com/patent/US20240252121A1/en
- https://patents.google.com/patent/US20240424346A1/en
- https://patents.google.com/patent/US9891059B2/cg-RX-API-DMAC7.html
- https://patents.google.com/patent/WO2016135382A1/en
- https://patents.justia.com/assignee/fitbod-inc
- https://patents.justia.com/assignee/oura-health-oy
- https://patents.justia.com/assignee/whoop-inc
- https://patents.justia.com/inventor/allen-chen
- https://patents.justia.com/inventor/aneeb-qureshi
- https://patents.justia.com/inventor/marcin-michal-kmiecik
- https://ptacts.uspto.gov/ptacts/public-informations/petitions/1556908/download-documents?artifactId=NG_2u6-1BrWAo_P2G5IA9mBAtVmvDn6LhqxtIZyLJhqrrCj7H6dTMTg
- https://www.9235.net/patent/US11986313B2.html
- https://www.htsyndication.com/us-fed-news/article/us-patent-issued-to-myfitnesspal-on-sept.-16-for--food-knowledge-graph-for-a-health-tracking-system---texas-inventors-/22213973830
- https://www.pacermonitor.com/public/case/63631790/Whoop,_Inc_v_Finerpoint,_Inc
- https://www.patentguru.com/assignee/myfitnesspal-inc

### Cited in `04_ASSET_RIGHTS_LEDGER.md` (2)

- https://bereanbible.com/bsb.txt
- https://claude.ai/code/session_…

### Cited in `05_SBOM_AND_DATA_LICENSES.md` (12)

- https://bereanbible.com/bsb.txt
- https://bereanbible.com/bsb_usfm.zip
- https://en.openfoodfacts.org
- https://fdc.nal.usda.gov/
- https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
- https://github.com/Cap-go/capacitor-health
- https://opendatacommons.org/licenses/odbl/1-0/
- https://openfontlicense.org
- https://openfoodfacts.org
- https://world.openfoodfacts.org
- https://www.mozilla.org/MPL/2.0/
- https://www.npmjs.com/package/@capgo/capacitor-health/v/8.11.4

### Cited in `09_STORE_COMPLIANCE_CHECKLIST.md` (9)

- https://developer.android.com/google/play/requirements/target-sdk
- https://developer.android.com/health-and-fitness/health-connect/publish
- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/app-store/subscriptions/
- https://developer.apple.com/app-store/user-privacy-and-data-use/
- https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api
- https://developer.apple.com/help/app-store-connect/reference/age-ratings-values-and-definitions/
- https://developer.apple.com/support/offering-account-deletion-in-your-app/
- https://support.google.com/googleplay/android-developer/
## E. Key file paths

| Topic | Paths |
|---|---|
| Earlier reports re-checked | `docs/launch-audit/C_TRADEMARKS.md`, `FINAL_TRADEMARK_REVIEW.md`, `FINAL_PATENT_REVIEW.md`, `B_PATENT_CLAIM_CHARTS.md`, `NUTRITION_IP_REVIEW.md`, `FINAL_PRIVACY_AND_LEGAL.md` |
| Legal text | `src/app/legal/**`, `docs/legal/PRIVACY_POLICY_DRAFT.md`, `docs/legal/TERMS_OF_SERVICE_DRAFT.md` |
| Plans and prices | `src/lib/domain/plans.ts`, `src/app/(app)/profile/billing/**` |
| AI context sent to the provider | see file 06 for the exact functions and lines |
| Food data | `src/server/services/open-food-facts.ts`, `src/server/services/food-quality.ts`, `src/lib/food-quality.ts` |
| Friends | `supabase/migrations/20261116000076_friends_foundation.sql`, `20261116000077_friends_hardening.sql`, `src/server/actions/friends.ts`, `src/lib/domain/friends.ts`, `tests/integration/friends.test.ts`, `e2e/friends.spec.ts` |
| Accountability partners | `supabase/migrations/20261113000067_accountability_partners.sql` |
| Account export and deletion | `src/server/services/account.ts`, `src/server/services/account-deletion.ts` |
| Native configuration | `capacitor.config.ts`, `ios/App/App/Info.plist`, `android/app/src/main/AndroidManifest.xml`, `android/variables.gradle` |
| Assets | `public/badges/`, `public/exercise-demos/`, `public/icons/`, `public/illustrations/`, `public/opening/`, `assets/`, `src/app/fonts/` |
| Notices | `src/app/legal/notices/page.tsx`, `public/third-party-notices.txt`, `scripts/legal/third-party-notices.mjs` |
