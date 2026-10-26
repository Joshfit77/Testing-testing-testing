# Narrow Gate Fitness — Privacy & Legal Research Memo and Gap List

> **Status after this pull request (claude/free-pro-membership, 2026-10-26).** The memo below was researched while the
> membership work was in progress. Resolved in code since: the accepted Terms/Privacy version, date and text
> fingerprint are now recorded at sign-up (`legal_acceptances`, migration 20261026000045); web checkout now requires an
> unticked auto-renewal consent naming the price and period and records it; the plan model, `.env.example` and
> `docs/MOBILE_BILLING.md` now describe Free + Pro All Access only; AI meal-plan notes about medical conditions are no
> longer sent to the AI. Still open: acknowledgment email and annual reminder (Stripe customer-email settings, owner),
> a consent screen for progress photos, a notice for faith/religious data, and every item needing counsel or owner
> information. The full drafts are in `docs/legal/`; the in-app Terms and Privacy pages are unchanged placeholders.

Prepared 2026-10-26 from the repository at `/home/user/Testing-testing-testing` (branch `claude/free-pro-membership`, HEAD `9915f22`, plus uncommitted working-tree changes another agent was making to the plan model during this review). The review was read-only. Companion drafts are `TERMS_OF_SERVICE_DRAFT.md` and `PRIVACY_POLICY_DRAFT.md` in this folder.

> **RESEARCH AND DRAFTING FOR ATTORNEY REVIEW — NOT LEGAL ADVICE.** Nothing here says the app complies with any law or is cleared by any authority, or that any clause is enforceable. Everything here must be reviewed by a qualified attorney before anyone relies on it.
>
> **Source caveat.** The sandbox could load only `developer.apple.com` and `anthropic.com` directly. Those two sources were read in full on 2026-10-26. Every other source was checked through web-search results, which return the cited pages' text in summary form; the primary statute or regulation text was **not** opened. Each such source is marked "(search)". Counsel should pull the primary text before relying on it. All URLs were accessed 2026-10-26.

## 0. Key findings

1. **Every third-party recipient of personal data found in code is listed in §1.** There are **no analytics, crash-reporting, advertising or map-tile SDKs or hosts**.
   - GPS route maps are drawn locally as SVG (`src/components/run/route-map.tsx:37`).
   - Fonts are bundled locally (`src/app/layout.tsx:12-23`).
   - Open Food Facts and USDA lookups are made from the server, so neither service sees the user's IP address.
2. **Consent gates exist in code** for AI, meal photos, wellness/sleep data, Body Scan and coaching memory, and a per-entry share switch exists for the journal.
   - **Missing:** a consent gate for progress photos, and any explicit notice or consent for religious-belief data.
   - **Missing:** a record of which Terms version the user accepted. The checkbox is validated but never stored (`src/server/actions/auth.ts:12-23`).
3. **The web checkout's auto-renewal flow is still incomplete for ROSCA and the 2025 California ARL.**
   - Committed HEAD shows the renewal text only as a footnote (`src/app/(app)/profile/billing/page.tsx:185-188`).
   - Uncommitted work in progress (`src/components/profile/web-membership.tsx:64-90`) adds the price and period to the checkout button, plus renewal terms and Terms/Privacy links in the plan footer.
   - In both versions there is still no consent capture or retained proof of consent, no acknowledgment email and no annual reminder. Re-check how close the footer sits to the button once this work is merged.
4. **Apple Guideline 5.1.1(ix)**, current text (last updated 2026-10-16), says apps that "require sensitive user information should be submitted by a legal entity … and not by an individual developer". Entity formation is therefore an App Store issue as well as a liability issue.
5. **Plan model is mid-migration.**
   - Committed code still defines Plus at $11.99 and Pro at $24.99.
   - The working tree implements Free + Pro All Access at $19.99 / $149.99, with legacy Plus keeping its access, including live GPS.
   - `.env.example`, `docs/MOBILE_BILLING.md` and the store product IDs still describe four Plus/Pro products.
   - The legal documents must match whatever ships.
6. **The FTC "Click-to-Cancel" rule is not in force.**
   - The Eighth Circuit vacated it on July 8, 2025.
   - The FTC issued an ANPRM in March 2026 (search).
   - ROSCA and FTC Act §5 still apply, as do state ARLs.

## 1. Data-flow table (verified in code)

| # | Recipient | Data received | Trigger / gate | Evidence (file) | Status |
|---|---|---|---|---|---|
| 1 | Supabase (DB, Auth, Storage) | All account, profile, logs, health/sleep, GPS routes, photos (private buckets), journal, AI chats, billing status | Always (core service) | `src/lib/supabase/*`, `supabase/migrations/*`; RLS on all tables (`docs/launch-audit/SECURITY_PRIVACY.md` §B) | Verified |
| 2 | Anthropic (Claude API) | Coach context (profile, workouts, food totals, bodyweight, steps, readiness score, limitations if consented, shared journal entries, memories, ≤24k chars history); sleep summary incl. HR/HRV/RR + device name; meal-plan targets/allergies/dislikes/notes; meal photo (in memory); OFF product facts + targets | `profiles.ai_data_consent_at` (`src/server/services/ai-coach.ts:340-341`, `:511-512`); meal photo also `food_photo_consent_at` (`src/server/services/food-photo.ts:8-25`); consent text `src/components/coach/ai-consent-card.tsx:31-51` | `ai-coach.ts`, `ai-meal-plan.ts`, `food-photo.ts`, `src/server/actions/food-quality.ts`, `src/server/coach/sleep-summary.ts` | Verified |
| 3 | Stripe | Email, `user_id` metadata, price/plan; card data entered on Stripe Checkout | Web checkout | `src/server/services/billing.ts:48`, `:76-85` | Verified |
| 4 | RevenueCat | App user id = account id; store purchase records; deletion of the customer at account deletion | In-app purchase / webhook | `src/server/services/store-billing.ts:46,60`; `src/lib/billing/store-purchases.ts` | Verified (never run live) |
| 5 | Apple / Google | Store payments; HealthKit / Health Connect read on device (steps, sleep, HR, HRV, RR) | OS permission + wellness consent for sleep | `src/lib/native-health.ts:67`, `src/lib/native-sleep.ts:53-80`; `ios/App/App/Info.plist` | Verified (no device test) |
| 6 | Open Food Facts | Barcode (server-side fetch, UA "NarrowGateFitness/1.0") | Barcode scan; product page | `src/server/services/open-food-facts.ts:9-20`, `src/server/services/food-quality.ts:17` | Verified |
| 7 | USDA FoodData Central | Search text + API key (server-side) | Food search when key set | `src/server/services/food-database.ts:8` | Verified |
| 8 | Google ML Kit (Android, on-device) | Camera frames processed on device | Native barcode scan | `node_modules/@capacitor/barcode-scanner/android/build.gradle:70-71` | Library present; Google telemetry **unverified** |
| 9 | Hosting provider | All HTTP traffic, server logs | Always | No `vercel.json`; drafts *say* Vercel | **Unverified — owner to confirm** |
| 10 | Auth email delivery | Email address, auth links | Sign-up / reset | `supabase/config.toml:106` (local SMTP only) | **Not configured for production** |
| 11 | YouTube / Vimeo | None by default; an external "proper form" YouTube search link; embeds only if an admin sets a video URL | User taps link | `src/lib/media.ts:5-37`; no seeded YouTube/Vimeo URLs found | Verified (conditional) |
| — | Map tiles | **None** — route drawn from own points | — | `src/components/run/route-map.tsx:37` | Verified absent |
| — | Analytics / crash / ads SDKs | **None** (searched sentry, posthog, mixpanel, amplitude, segment, gtag, firebase, datadog, bugsnag, crashlytics, vercel analytics) | — | `package.json`, `src`, native configs; `PrivacyInfo.xcprivacy` tracking=false | Verified absent |
| — | Google Fonts | None at runtime (local `next/font/local`); CSP still allows `fonts.googleapis.com` | — | `src/app/layout.tsx:2-23`, `src/lib/security-headers.ts:35-36` | Verified (CSP can be tightened) |

**Other code facts relied on in the drafts:**
- **Age gate.** 18+ checkbox (`src/lib/validation/schemas.ts:35`); onboarding refuses age under 18 (`:49,88,144`, `src/components/onboarding/onboarding-wizard.tsx:137`); the coach refuses to coach anyone who says they are under 18 (`src/lib/coach/knowledge.ts`).
- **Export.** Rate-limited JSON export (`src/app/api/account/export/route.ts`).
- **Deletion.** Order: cancel Stripe → remove storage → delete auth user (cascade) → delete Stripe customer and RevenueCat customer (`src/server/services/account-deletion.ts:39-84`).
- **Wellness withdrawal.** Deletes limitation notes and recovery check-ins; sleep is deleted separately (`src/server/actions/profile.ts:57-70`).
- **Body Scan.**
  - No face or body geometry is derived. Measurements are entered by the user.
  - Separate consent: `body_scan_consent_at`, DB `can_add_body_scan()` (`docs/BODY_SCAN.md`, `src/components/body-scan/consent-card.tsx:10-17`).
  - The only camera code is `getUserMedia` (`scan-capture.tsx:248`). No ML or vision libraries are present.
- **Guardrails.**
  - Calorie floor of 1,500 (men) / 1,200 (women) / 1,350 (sex not given), ≤25% deficit, eating-disorder, red-flag and mental-health rules (`src/lib/coach/knowledge.ts:29-40`).
  - Meal plans use only curated dishes, the app computes all nutrition, and the AI is told "no medical claims" (`src/lib/domain/ai-meal-plan.ts:165-173`).
  - Allergen disclaimers (`src/components/nutrition/ai-meal-plan.tsx:120`, `quality-sections.tsx:229`).

## 2. Requirement-by-requirement findings, with sources

### 2a. Enforceability of protective clauses

- **Contract formation.**
  - **Sources:** *Meyer v. Uber*, 868 F.3d 66 (2d Cir. 2017) — https://case-law.vlex.com/vid/868-f-3d-66-697657205 (search); *Berman v. Freedom Fin. Network*, 30 F.4th 849 (9th Cir. 2022) — https://perkinscoie.com/insights/update/ninth-circuit-addresses-website-design-enforceable-terms-service (search).
  - **Rule:** terms bind when notice is reasonably conspicuous and assent is unambiguous.
  - **Finding:** the sign-up form uses a separate, unchecked, required box with underlined links (`src/components/auth/auth-forms.tsx:115-129`). That is favorable. Acceptance is not stored, which weakens proof.
- **Arbitration and class waivers.**
  - **Sources:** FAA, 9 U.S.C. §§1-16; *AT&T Mobility v. Concepcion*, 563 U.S. 333 (2011); *Epic Systems v. Lewis*, 584 U.S. 497 (2018) (employment; it reinforces enforcement of individual-arbitration agreements); *McGill v. Citibank*, 2 Cal.5th 945 (2017), which holds that waivers of public injunctive relief are unenforceable in California — https://www.akingump.com/en/insights/alerts/mcgill-v-citibank-and-arbitration-agreements (search); *Heckman v. Live Nation*, 120 F.4th 670 (9th Cir. 2024), which held a mass-arbitration protocol unconscionable and refused to sever it, cert. denied Oct. 6, 2025 — https://www.scotusblog.com/cases/case-files/live-nation-entertainment-inc-v-heckman/ (search).
  - **Mass-arbitration cost:** AAA Mass Arbitration Supplementary Rules and fee schedule, effective Jan. 15, 2024 — https://www.mayerbrown.com/en/insights/publications/2024/02/american-arbitration-association-adopts-new-mass-arbitration-rules-and-fee-schedules (search). The business pays most fees.
  - **Drafted terms:** a small-claims carve-out, a 30-day opt-out and a McGill carve-out are common practice and are drafted in.
- **Releases and exculpatory clauses.**
  - Virginia voids pre-injury personal-injury releases: *Hiett v. Lake Barcroft*, 244 Va. 191 (1992).
  - Louisiana voids clauses limiting liability for physical injury: La. Civ. Code art. 2004.
  - Montana: Mont. Code Ann. §28-2-702.
  - Source for these three: https://www.mwl-law.com/wp-content/uploads/2018/05/EXCULPATORY-AGREEMENTS-AND-LIABILTY-WAIVERS-CHART.pdf (search; chart dated 1/13/22).
  - New York: Gen. Oblig. Law §5-326 voids releases given to paid "pool, gymnasium, place of amusement or recreation." Its application to an app is **unsettled**, and courts look to whether the operator's purpose is recreational or instructional — https://www.athleticbusiness.com/operations/legal/article/15141206/recreational-facilities-purpose-can-undermine-the-validity-of-some-waivers (search).
  - California: *Tunkl v. Regents*, 60 Cal.2d 92 (1963) (public-interest test); *City of Santa Barbara v. Superior Court*, 41 Cal.4th 747 (2007) (no release of future gross negligence); Civ. Code §1668 (fraud, willful injury, violation of law) — https://www.insurancejournal.com/news/west/2007/04/26/79020.htm (search).
- **Warranty disclaimers.**
  - UCC §2-316 requires the word "merchantability" and conspicuousness. Article 2 may not apply to SaaS.
  - The Magnuson-Moss Warranty Act (15 U.S.C. §2308) bars implied-warranty disclaimers only when a written warranty or service contract is given.
  - Several states restrict consumer disclaimers. Counsel should confirm the list; it was not verified this session.
- **New Jersey TCCWNA** (N.J.S.A. 56:12-14 to -18) creates exposure for "some states don't allow" clauses. Not verified this session.

### 2b. Subscriptions and auto-renewal

- **ROSCA** (15 U.S.C. §8403) requires:
  - clear and conspicuous disclosure of material terms before billing information is obtained;
  - express informed consent before charging;
  - simple cancellation.
- **FTC Negative Option ("Click-to-Cancel") rule:**
  - vacated in full by the 8th Circuit on July 8, 2025, on procedural grounds — https://www.wilmerhale.com/en/insights/client-alerts/20250801-eighth-circuit-vacates-the-ftcs-click-to-cancel-rule-but-federal-and-state-regulators-likely-to-remain-active (search);
  - ANPRM sent to OIRA on Jan. 30, 2026 and published in March 2026 (dates in sources: 11 or 13 March), with comments due around April 13, 2026 — https://www.kelleydrye.com/viewpoints/blogs/ad-law-access/ftc-relaunches-negative-option-rulemaking-with-new-questions-new-branding , https://www.sidley.com/en/insights/newsupdates/2026/02/us-ftc-signals-renewed-interest-in-click-to-cancel-rulemaking (search);
  - **no new rule was in force as of the sources found.**
- **California ARL** (Bus. & Prof. Code §§17600-17606), as amended by AB 2863 (Stats. 2024 ch. 515) for contracts entered into, amended or extended on or after July 1, 2025 — https://btlaw.com/en/insights/alerts/2025/california-expands-automatic-renewal-law-new-requirements-now-in-effect , https://fenwick.com/insights/publications/california-tightens-requirements-for-automatically-renewing-subscriptions (search). Requirements:
  - express affirmative consent to the renewal terms;
  - verification of that consent kept for 3 years, or 1 year after the contract ends, whichever is longer;
  - an acknowledgment;
  - an **annual reminder**;
  - notice of material changes;
  - click-to-cancel and cancellation through the same medium used to sign up.
- **New York.**
  - Current law: GBL §527-a, as amended by ch. 728 of 2023.
  - Pending bills would add same-medium online cancellation and renewal notices of 15-45 days: A6823, A3928B, S5615A — https://www.nysenate.gov/legislation/bills/2025/A6823 (search). **Whether they were enacted was not verified.**
  - Other states with ARLs (e.g., CO, VA, IL, OR, VT, DC, MN) were not individually verified this session.
- **Apple 3.1.2** (fetched; last updated 2026-10-16) — https://developer.apple.com/app-store/review/guidelines/
  - subscription periods of at least 7 days;
  - users must not be able to subscribe inadvertently to multiple variations of the same subscription;
  - 3.1.2(c) requires that before subscribing the app "clearly describe what the user will get for the price" and meet Schedule 2 of the Developer Program License Agreement.
  - The in-app paywall shows renewal terms, Terms and Privacy links, and Restore (`src/components/profile/store-paywall.tsx:181-220`; `src/lib/billing/paywall.ts:87-91`).
- **Google Play** — https://support.google.com/googleplay/android-developer/answer/9900533 , https://android-developers.googleblog.com/2020/04/building-user-trust-through-more.html (search). Requirements:
  - disclose cost and billing frequency;
  - describe trial terms clearly;
  - say how to manage or cancel;
  - provide an easy online cancellation method.

### 2c. Privacy

- **FTC Act §5** (15 U.S.C. §45) applies to privacy and security representations.
  - Example: *GoodRx* (Feb. 2023), the first Health Breach Notification Rule case — $1.5M penalty and a ban on sharing health data for ads — https://www.ftc.gov/news-events/news/press-releases/2023/02/ftc-enforcement-action-bar-goodrx-sharing-consumers-sensitive-health-info-advertising (search).
- **HBNR**, 16 C.F.R. Part 318, as amended (published May 30, 2024; effective July 29, 2024) — https://www.mofo.com/resources/insights/240514-ftc-issues-final-rule-to-expand , https://www.law.cornell.edu/cfr/text/16/318.4 (search).
  - The amendments expressly cover health apps that draw data from multiple sources.
  - A "breach" includes unauthorized disclosure.
  - Individual notice: no later than 60 calendar days after discovery.
  - FTC notice timing for breaches of 500 or more people: **sources conflict** (same time as individual notice vs. within 10 business days). Counsel should confirm.
  - Penalty: civil penalties per violation. The app pulls data from Apple Health or Health Connect plus user input, so **the rule is likely to be relevant; counsel to determine**.
- **Washington MHMDA**, RCW 19.373 — https://www.orrick.com/de-DE/Insights/2023/05/6-Things-to-Know-About-Washingtons-My-Health-My-Data-Law , https://connectontech.bakermckenzie.com/washington-state-my-health-my-data-act-signed-into-law-some-provisions-operative-in-less-than-3-months (search).
  - No revenue or volume thresholds.
  - Separate consent for collection and for sharing; a signed authorization to sell.
  - A separate homepage health-data privacy policy.
  - A geofencing ban.
  - A private right of action through the Consumer Protection Act.
  - Small businesses have been subject since June 30, 2024.
- **Nevada SB 370**, NRS ch. 603A, effective March 31, 2024 — https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20230614-nevada-legislature-passes-consumer-health-data-privacy-bill , https://www.bassberry.com/news/nevada-consumer-health-data-law-takes-effect-on-march-31-2024/ (search).
  - No thresholds.
  - Separate consents for collection and sharing.
  - No private right of action.
- **CCPA/CPRA** — https://www.cppa.ca.gov/regulations/cpi_adjustment.html (search).
  - Thresholds: annual revenue over $26,625,000 (from Jan. 1, 2025), or 100,000+ consumers or households bought, sold or shared, or 50%+ of revenue from selling or sharing.
  - "Sensitive personal information" includes health, precise geolocation, and religious or philosophical beliefs (Civ. Code §1798.140(ae)).
  - **Likely not applicable at launch scale; counsel to confirm.**
- **Other state comprehensive laws.** Sensitive data, including religious beliefs and health diagnosis, requires opt-in consent.
  - Virginia: §59.1-575 and §59.1-578. Threshold: 100,000 consumers, or 25,000 consumers plus more than 50% of revenue from sales — https://privacy.gtlaw.com/virginia/ (search).
  - Colorado: C.R.S. §6-1-1303(24) and §6-1-1308(7). Threshold: 100,000 consumers, or 25,000 plus revenue from sales. Not re-verified.
  - Texas: TDPSA, Tex. Bus. & Com. Code ch. 541, effective July 1, 2024. Covers non-small businesses under the SBA definition. A small business must obtain consent before *selling* sensitive data — https://www.texasattorneygeneral.gov/consumer-protection/file-consumer-complaint/consumer-privacy-rights/texas-data-privacy-and-security-act (search).
  - Connecticut: SB 1295 (PA 25-113), effective July 1, 2026, reportedly covers **any controller that processes sensitive data**, regardless of volume — https://www.hunton.com/privacy-and-cybersecurity-law-blog/connecticut-amends-the-connecticut-data-privacy-act , https://perkinscoie.com/insights/blog/connecticut-pierces-glba-veil-overhauling-its-omnibus-privacy-law (search). **High relevance; verify against the enrolled text.**
- **COPPA**, 16 C.F.R. Part 312, as amended (effective June 23, 2025; compliance date April 22, 2026) — https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule (search).
  - The app is 18+ with an age gate and is not directed to children. **COPPA exposure is low unless the app gains actual knowledge of users under 13.**
- **HIPAA.**
  - HHS OCR guidance ("Access Right, Health Apps & APIs") says data a consumer directs to an app that is neither a covered entity nor a business associate is not protected by HIPAA — https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/access-right-health-apps-apis/index.html (search).
  - On current facts the company is direct-to-consumer, is not a provider, plan or clearinghouse, and does not act for one, so **HIPAA likely does not apply**.
  - That would change if the company contracted with clinics, employers' health plans or insurers to handle PHI.
  - Do not claim "HIPAA compliant." GoodRx was charged partly over misrepresenting HIPAA compliance.
- **Biometrics.**
  - BIPA (740 ILCS 14/10) excludes photographs from "biometric identifiers" but covers "scan of … face geometry." SB 2979 (2024) made damages per person.
  - Texas CUBI (Bus. & Com. Code §503.001) covers "record of hand or face geometry."
  - Source: https://www.thompsonhine.com/insights/illinois-legislature-amends-bipa-to-limit-damages-and-expand-consent-options (search).
  - **Verified:** Body Scan and progress photos derive **no** face or body geometry, run no ML, and are not sent to AI. The facts therefore do not appear to trigger BIPA or CUBI; counsel to confirm.
  - **Any future body-composition vendor or pose/segmentation model would change this analysis.**
- **Apple 5.1.1, 5.1.2 and 5.1.3** (fetched) — https://developer.apple.com/app-store/review/guidelines/
  - 5.1.1(i): the privacy policy must explain retention and deletion and how to revoke consent.
  - 5.1.1(ix): submission by a legal entity is expected for apps requiring sensitive user information.
  - 5.1.2(i): explicit permission is required before sharing with "third-party AI."
  - 5.1.2(vi): no marketing use of HealthKit or Camera-API data.
  - 5.1.3(i)-(ii): health data may not be used for advertising or data mining, and personal health information may not be stored in iCloud.
- **Google Play.** Health apps declaration; health data accessed through Health Connect is personal and sensitive; the privacy policy must be public, non-geofenced and not a PDF — https://developer.android.com/health-and-fitness/health-connect/publish , https://support.google.com/googleplay/android-developer/answer/16555673 (search).
- **Anthropic** (fetched).
  - Commercial Terms, effective June 17, 2025: "Anthropic may not train models on Customer Content"; a DPA is incorporated — https://www.anthropic.com/legal/commercial-terms
  - Usage Policy, page dated "Effective Nov 12, 2026": "Medical" recommendations, i.e. diagnosing, or recommending or adjusting treatment, are **High-risk**. High-risk uses require a qualified human reviewer and disclosure that AI was used. Consumer chatbots must disclose AI at least at the start of each session or in the interface — https://www.anthropic.com/legal/aup
  - The coach is designed to avoid medical recommendations. The consent card names Claude/Anthropic. **Confirm the per-session AI disclosure.**

### 2d. Nutrition and dietetics

- **Licensure laws vary.**
  - Florida (Fla. Stat. §468.505), Ohio (a closed list of what the unlicensed may do) and Alabama are characterized as strict.
  - North Carolina reportedly reserves only medical nutrition therapy.
  - Nebraska's MNT Practice Act is operative Jan. 1, 2025, and exempts non-MNT individualized guidance.
  - Michigan re-enacted licensure in 2024, with licensing required from about Oct. 27, 2027.
  - Sources: https://www.eatrightpro.org/advocacy/licensure/licensure-map-and-statutes-by-state/florida , https://nanp.org/state-law/florida , https://dhhs.ne.gov/licensure/Documents/Medical%20Nutrition%20Therapy.pdf , https://eatrightmich.org/professionals/licensure-for-michigan-2/ (search; Ohio, Alabama and North Carolina via a single secondary source — **verify**).
- **Common exemption:** general, non-individualized nutrition information, without use of a protected title.
- **Risk:** AI meal plans are individualized. They should stay "general wellness" by:
  - never addressing a disease (no MNT);
  - enforcing the calorie floor (present);
  - including eating-disorder handling (present in the coach, not in the meal-plan prompt);
  - including allergen disclaimers (present);
  - refusing or redirecting when notes mention a medical condition. **Not present:** the meal-plan prompt says "Follow … the member's notes" (`src/lib/domain/ai-meal-plan.ts:171`).
- **FDA General Wellness guidance**, reissued Jan. 6, 2026, superseding the 2019 version — https://www.cov.com/news-and-insights/insights/2026/01/fda-issues-revised-guidance-on-general-wellness-products , https://faegredrinker.com/en/insights/publications/2026/1/key-updates-in-fdas-2026-general-wellness-and-clinical-decision-support-software-guidance (search).
  - Low-risk products promoting healthy lifestyle, without disease claims, are outside device regulation.
  - Claims must avoid diagnosis or treatment.

### 2e. Content licenses

- **Open Food Facts.**
  - Database: ODbL. Contents: Database Contents License. Images: CC BY-SA.
  - Obligations: attribution, plus share-alike for any publicly used *adapted database* — https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/ , https://wiki.openfoodfacts.org/ODBL_License (search).
  - **Finding:** the app caches OFF records in its `foods` table. Counsel should decide whether that is an "adapted database" used publicly; it is likely not public, since it is not anon-readable (RLS).
- **USDA FoodData Central:** CC0 1.0. Attribution requested, not required — https://fdc.nal.usda.gov/ , https://catalog.data.gov/dataset/fooddata-central (search).
- **BSB:** dedicated to the public domain on April 30, 2023. Attribution appreciated. Do not use the "Berean" name on altered text — https://berean.bible/terms.htm (search).
  - The app quotes exact text, checked by `tests/unit/scripture.test.ts`, with attribution (`docs/SCRIPTURE.md`).
- **Map tiles:** none (§1).
- **Open source.**
  - Production dependencies are mostly MIT, ISC, Apache-2.0 and BSD.
  - `@capgo/capacitor-health` is **MPL-2.0**, compiled into the native apps. This requires a license notice and source availability for MPL files.
  - `sharp`/libvips is LGPL-3.0, used server-side only.
  - Bundled fonts are under the SIL OFL (`src/app/fonts/OFL.txt`).
  - Apache-2.0 NOTICE files must be carried.
  - **There is no in-app open-source notices screen.**

### 2f. Business protection

- **Entity.**
  - An LLC or corporation generally limits owners' personal liability for business debts.
  - Courts may pierce the veil for commingled funds, undercapitalization, ignored formalities, or fraud.
  - Owners remain personally liable for their **own** torts.
  - Practices that help: a separate bank account and card, adequate capitalization, contracts signed in the entity's name, and transfer of IP and store accounts to the entity.
  - An Apple Developer account in the entity's name requires a D-U-N-S number. Owner to confirm.
- **Insurance to quote.** Coverage terms depend on the policy wording.
  - General liability (CGL).
  - Professional liability / E&O covering fitness and nutrition guidance and software. Confirm it covers **AI-generated** advice.
  - Cyber / privacy liability, including regulatory defense and HBNR/MHMDA notification costs.
  - Product liability, which may sit within CGL products-completed operations.
  - Media/IP coverage.
- **AI exclusions.** ISO introduced generative-AI exclusion endorsements in January 2026: CG 40 47 (broad), CG 40 48 and CG 35 08. Carriers increasingly restrict AI losses in CGL and E&O — https://www.insurancebusinessmag.com/us/news/cyber/isos-generative-ai-exclusion-is-already-on-thousands-of-cgl-policies-589971.aspx , https://fenwick.com/insights/publications/end-silent-ai-emerging-ai-exclusions-coverage-fragmentation-and-practical-implications (search).
  - **Ask brokers for affirmative AI coverage and for disclosure of any AI exclusion.**
  - Personalized-nutrition advice may be excluded, or treated as dietetic professional services.
- **Neither an entity nor insurance eliminates personal liability.** Fraud, personal torts, unpaid trust-fund taxes, personal guarantees and veil-piercing remain. Insurance has limits, exclusions and deductibles.

## 3. Enforceability notes per protective clause (ToS)

| Clause (ToS §) | Supportable | Risky | Cannot be waived / limited |
|---|---|---|---|
| Health disclaimer and "not medical" (4, 7.2) | Generally supportable and expected (Apple 1.4.1); must match the product's actual behavior | Contradicted by any disease-specific marketing or by AI output that gives treatment advice | FTC Act §5 deception liability if the marketing contradicts it |
| Assumption of inherent risk (5) | Strongest of the protective clauses, for inherent risks of exercise and outdoor activity | Does not reach negligent content design (e.g., an unsafe program or a bad AI plan) | Gross negligence, recklessness, intentional harm |
| Release (6) | Possibly enforceable in many states if conspicuous and expressly naming negligence | Void or disfavored: VA, LA, MT; NY §5-326 (application to apps unsettled); CA public-interest analysis; personal injury against a consumer-facing health service | Gross negligence (CA *Santa Barbara*), fraud, willful injury, statutory violations (CA Civ. §1668) |
| Warranty disclaimer (19) | Conspicuous "as is" plus "merchantability" | State consumer statutes restricting disclaimers; NJ TCCWNA | Implied warranties where state law bars disclaimer; MMWA if any written warranty is given |
| Damages cap and consequential exclusion (20) | Commonly enforced for economic loss | Personal-injury caps may be unconscionable; NJ TCCWNA | Fraud, willful misconduct, gross negligence; non-waivable statutory damages (e.g., MHMDA/CPA, ARL remedies) |
| Arbitration and class waiver (22) | FAA, *Concepcion*; clickwrap per *Meyer*/*Berman* | Mass-arbitration fees; *Heckman* (custom protocols, severability); missing assent records; unilateral-change clause | Public injunctive relief (CA *McGill*); agency complaints; pre-dispute jury waiver in CA and GA |
| Informal dispute resolution (22.1) | Short, mutual, tolls deadlines | Long or one-sided pre-filing hurdles can be found unconscionable | — |
| Indemnity (21) | Narrow version | Broad consumer indemnities disfavored | — |
| Changes to terms (24) | With actual notice and re-acceptance | "Continued use" alone, without notice | ARL material-change notice obligations |
| Severability (25) | Standard | Courts may refuse to sever when a clause is permeated by unconscionability (*Heckman*) | — |

**Non-waivable rights to preserve:**
- ARL cancellation and refund remedies;
- state privacy rights, including MHMDA's private right of action;
- HBNR notification;
- the right to complain to agencies;
- public injunctive relief (CA);
- implied warranties where state law protects them;
- claims for gross negligence, intentional conduct and fraud.

## 4. Prioritized action lists

### 4.1 Protections that can be implemented in code now (no lawyer needed to build; counsel to confirm wording)

1. Store `terms_version`, `terms_accepted_at`, `privacy_version` and the accepting IP or user agent at sign-up, and re-prompt for acceptance on material changes.
2. Web checkout:
   - show price, period, "renews automatically until you cancel" and how to cancel **directly above or next to** the checkout button, with links to the Terms;
   - add a consent checkbox, or an equivalent explicit statement on the button;
   - keep the consent record for 3 years or more;
   - send an acknowledgment email with the terms and cancellation instructions;
   - for yearly plans, send a renewal reminder (enable Stripe's upcoming-renewal emails or build one), plus an annual reminder.
3. Meal-plan and coach guardrail: detect medical-condition terms in plan notes and coach requests (e.g., diabetes, kidney, pregnancy, eating disorder) and redirect to a professional instead of following them.
4. Add a progress-photo consent gate mirroring Body Scan, or a clear in-flow notice; counsel to choose.
5. Show a faith-features notice or consent: "Turning this on tells us you're interested in faith content; this may be sensitive."
6. Add an in-app "Licenses & Attributions" screen covering OFF (ODbL / DbCL / CC BY-SA), USDA, BSB, MPL-2.0 and Apache notices, and fonts.
7. Show an AI disclosure at the start of every coach session (Anthropic AUP).
8. Remove `fonts.googleapis.com` and `fonts.gstatic.com` from the CSP if unused.
9. Write an incident-response runbook (HBNR / state breach laws) with notice templates.

### 4.2 Clauses requiring an attorney

1. Whether to use arbitration at all, which provider, the mass-filing language and the opt-out mechanics.
2. The release in §6: keep it narrow, drop it, or move it to a separate acknowledgment.
3. The liability-cap carve-outs for personal injury.
4. Governing law and venue.
5. Web refund policy; price-change notice periods; ending the grandfathered AI allowances.
6. MHMDA and Nevada consumer health data policy and consents; Connecticut sensitive-data applicability; whether faith data needs consent.
7. HBNR applicability and procedure.
8. Choice between the Apple Standard EULA and a custom EULA.
9. Dietetics licensure posture for AI meal plans by state.
10. Trademark clearance (from the prior audit).

### 4.3 Risks contract language cannot eliminate

- Personal-injury claims alleging negligent program or AI design.
- Gross-negligence and intentional-conduct claims.
- FTC and state attorney-general enforcement (deception, ROSCA, ARL, privacy).
- MHMDA private suits.
- Breach-notification duties and costs.
- Store policy rejections.
- Unlicensed-practice complaints.
- Reputational harm from AI errors.
- Claims by non-users (e.g., a pedestrian).

### 4.4 Insurance decisions

- Quote CGL + E&O (with affirmative AI coverage) + cyber/privacy (including regulatory and notification costs) before paid launch.
- Disclose AI coaching and personalized nutrition on applications. Non-disclosure risks rescission.
- Check for ISO CG 40 47-type exclusions.
- Decide limits and deductibles.
- Name the entity, not the individual.

### 4.5 Steps required before paid public launch

1. Form the entity; move the Apple and Google developer accounts, Stripe, RevenueCat, the domain and IP into it; open a separate bank account.
2. Counsel finalizes the Terms, the Privacy Policy, the WA/NV health-data policy and the EULA choice. Publish them at public URLs; set `LEGAL_TERMS_URL` and `LEGAL_PRIVACY_URL`; remove the draft banner.
3. Finish the plan migration so that code, Stripe prices, App Store and Play products, `.env.example`, the paywall copy and the Terms all show Free / Pro $19.99 / $149.99 and the legacy rules.
4. Implement items 1-2 of §4.1 (assent records and ARL-compliant checkout).
5. Sign or confirm DPAs with Supabase, the hosting provider, Anthropic, Stripe and RevenueCat; confirm data regions.
6. Ensure the App Store privacy label and Play Data safety form match `PrivacyInfo.xcprivacy` and the policy.
7. Bind insurance.
8. Complete sandbox purchase and cancellation tests on a device (`docs/MOBILE_BILLING.md`).

## 5. Missing information the owner must provide

- **Contracting party:** legal entity name, type and state of formation, principal postal address, and D-U-N-S number for Apple.
- **Contact addresses:** support email, privacy email, legal-notice and arbitration opt-out email, security-disclosure contact, and DMCA agent (if any).
- **Dispute terms:** governing-law state and venue county; arbitration yes or no and the provider (AAA or JAMS); the small-claims threshold for document-only arbitration.
- **Billing terms:** web refund policy; price-change notice period; material-change notice period for the Terms; the date of the plan change and how long grandfathering lasts; the time zone for the AI allowance reset.
- **Retention periods** for every row in Privacy Policy §7, including logs and backups.
- **Hosting and email:** hosting provider and region; Supabase region; auth-email provider; Anthropic data-retention arrangement.
- **Markets:** U.S. only, or international (GDPR / UK).
- **App Store terms:** Apple Standard EULA or a custom EULA.
- **Minimum age:** confirmation that it stays at 18.
- **Analytics:** confirmation that no analytics will be added at launch.
- **Data officer:** whether to name a privacy officer or data protection officer (not required under U.S. law at this scale).
- **Insurance:** broker and the coverage chosen.

## 6. Unresolved issues

Key: TF = blocks internal TestFlight; Paid = blocks public paid launch; Own = needs owner approval; Dev = needs a real device or external account; Spec = needs specialist legal review.

| ID | Sev | Issue | Evidence | User impact | Recommended fix | TF | Paid | Own | Dev | Spec |
|---|---|---|---|---|---|---|---|---|---|---|
| U1 | Critical | Legal documents are drafts, with placeholders and no entity | `src/app/legal/*`; this folder | No enforceable terms; App Store 5.1.1(i) rejection | Counsel finalizes; publish URLs | n | y | y | n | y |
| U2 | High | No legal entity; individual developer | Owner facts; Apple 5.1.1(ix) | Personal exposure; possible App Review issue | Form entity; transfer accounts | n | y | y | y | y |
| U3 | High | Terms acceptance not recorded (version or time) | `src/server/actions/auth.ts:12-23` | Weak proof of assent, which undermines arbitration and the release | Store version, timestamp and source; re-accept on change | n | y | n | n | n |
| U4 | High | Web checkout: no consent record, acknowledgment email or annual reminder; disclosure placement must be re-checked after the in-progress redesign | HEAD `src/app/(app)/profile/billing/page.tsx:185-188`; working tree `src/components/profile/web-membership.tsx:64-90` | ROSCA / CA ARL exposure; surprise renewals | Redesign checkout; consent record; emails | n | y | y | y (Stripe settings) | y |
| U5 | High | Plan, price and product mismatch during migration | HEAD `plans.ts` vs working tree; `.env.example:57-65`; `docs/MOBILE_BILLING.md` | Users shown wrong prices or features; deceptive-pricing risk | Finish migration; one source of truth for prices in Terms and paywall | n | y | y | y (stores) | n |
| U6 | High | WA MHMDA / NV SB 370: no separate consumer-health-data policy; collection and sharing consents not mapped to those statutes | Privacy Policy §9 | Private suits (WA); AG enforcement | Counsel drafts the policy; map consents; homepage link | n | y | y | n | y |
| U7 | High | HBNR / breach incident procedure absent | `E_LAUNCH_READINESS.md` E.2 #6 | Late or missed notices; penalties | Runbook, templates, owner decision tree | n | y | y | n | y |
| U8 | Medium | AI meal plan follows member notes, which may contain medical conditions | `src/lib/domain/ai-meal-plan.ts:171` | Disease-specific advice; licensure and AUP "medical" risk | Condition detection and redirect; prompt rule | n | y | n | n | y |
| U9 | Medium | Religious-belief data (faith toggle, journal): no explicit sensitive-data notice or consent | `profiles.faith_enabled`; `src/server/actions/onboarding.ts:38` | CT/VA/CO/TX sensitive-data consent gap if applicable | Notice or consent at enable; policy text | n | y | y | n | y |
| U10 | Medium | Progress photos lack a consent gate (Body Scan has one) | `src/components/progress/progress-photos.tsx:132` | Inconsistency with stated "with consent" | Add a consent card, or align the policy | n | n | y | n | n |
| U11 | Medium | Retention periods undecided | Privacy Policy §7 | Apple 5.1.1(i); state-law notice gap | Owner decides; build purges if needed | n | y | y | n | n |
| U12 | Medium | Hosting provider, regions and auth-email provider unconfirmed; DPAs not confirmed | No `vercel.json`; `supabase/config.toml:106` | Inaccurate processor list | Confirm and sign DPAs | n | y | y | y | n |
| U13 | Medium | Store subscription survives account deletion | `account-deletion.ts:13-17`; deletion warning exists | Users keep paying after deletion | Keep the warning; add store deep links; email reminder | n | n | n | y | n |
| U14 | Medium | Insurance not bound; AI exclusions likely | §2f | Uninsured AI or nutrition claims | Broker quotes with affirmative AI coverage | n | y | y | y | n |
| U15 | Low | No open-source / attribution screen (MPL-2.0, OFF ODbL, Apache NOTICE) | `package-lock.json`; OFF use | License non-compliance | Add a notices screen | n | y | n | n | n |
| U16 | Low | Per-session AI disclosure (Anthropic AUP) | `ai-consent-card.tsx` shown once | AUP non-compliance | Persistent "AI" label in the coach UI | n | n | n | n | n |
| U17 | Low | ML Kit (Android) data practices unverified | `@capacitor/barcode-scanner` gradle | Play Data safety inaccuracy | Check Google's ML Kit terms; update the form | n | n | n | y | n |
| U18 | Low | CSP allows unused Google Fonts hosts | `src/lib/security-headers.ts:35-36` | None today | Tighten the CSP | n | n | n | n | n |
| U19 | Low | Release clause (ToS §6) may be void in several states and may hurt credibility | §3 table | False sense of protection | Counsel decides keep, narrow or drop | n | n | y | n | y |
| U20 | Info | NY ARL amendments, other state ARLs, state warranty-disclaimer list, Connecticut text not verified from primary sources | §2 source caveat | — | Counsel verifies the primary text | n | y | n | n | y |

**Internal TestFlight** is not blocked by any legal item in this list. The technical blockers in `E_LAUNCH_READINESS.md` E.1 (a deployed site and an Apple account) still apply. External TestFlight requires a public privacy-policy URL (Apple 5.1.1(i)). That is U1 at the privacy-policy level only.
