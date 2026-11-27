# 07 — Legal documents review

Date: 2026-11-16. Branch: `claude/friends-challenges` (commit `3b9bc44`). Prepared for the founder and a US
privacy/technology attorney. **Not legal advice and not legal drafting.** This file lists what exists, every blank
that must be filled, where documents and code disagree, and the facts each final document must describe. It proposes
no legal wording.

## 1. Summary

- **No final legal document exists.** There are two layers, and they differ:
  - **What members see and accept:** two short outline pages inside the app (`/legal/privacy`, 75 lines;
    `/legal/terms`, 28 lines) under a banner reading "Placeholder — requires legal review … not legally binding".
  - **What counsel is meant to review:** two long drafts in `docs/legal/` (Privacy 248 lines, Terms 569 lines),
    dated 2026-10-26, which are not shown to members.
- **Sign-up records acceptance of the placeholders.** Each new account gets a record of Terms version
  `2026-10-26-placeholder` and Privacy version `2026-10-26-placeholder` (`src/lib/legal/versions.ts:15-16`).
- **No text claims attorney review or approval.** Every legal surface says the opposite (section 6).
- **Blanks:** 10 bracketed blanks in the in-app pages, 39 bracketed items in the Privacy draft and 72 in the Terms
  draft (counted by pattern; some lines hold several).
  Section 3 lists them with file and line.
- **The drafts are three weeks behind the code.** The Privacy draft was written from another branch on 2026-10-26.
  Two attorney notes in the Terms draft describe gaps that have since been closed in code (section 4).
- **17 unresolved owner decisions** block final documents, among them: entity, address, contacts, effective date,
  governing law, whether to arbitrate, refund policy, retention periods, countries served, EULA choice, hosting and
  email providers, minimum age, and how to treat sensitive-data consent (section 7).
- **Three statements on member-facing screens do not match the code** (section 5, I-3, I-5, I-9).

## 2. Inventory

"Last changed" is from `git log -1` on this branch. The branch history holds 77 commits and starts at `223ee96`
(2026-11-13); for files last touched in that first commit, the true date of the last edit is earlier and is not
recoverable here.

| Document or screen | Path | Status | Last changed |
|---|---|---|---|
| Privacy Policy, in-app | `src/app/legal/privacy/page.tsx` | **Placeholder outline** with blanks; shown to members | `223ee96` 2026-11-13 |
| Terms of Service, in-app | `src/app/legal/terms/page.tsx` | **Placeholder outline**; two of six sections are blank | `223ee96` 2026-11-13 |
| Placeholder banner and "no index" setting | `src/app/legal/layout.tsx` | Complete as text | `223ee96` 2026-11-13 |
| Notices and attributions | `src/app/legal/notices/page.tsx` | Complete as text; sits under the same "Placeholder" banner | `223ee96` 2026-11-13 |
| Re-acceptance page | `src/app/legal/accept/page.tsx`, `src/components/auth/accept-terms-form.tsx` | Complete as text; switched off (`LEGAL_REACCEPT_REQUIRED`) | `223ee96` 2026-11-13; `582e05e` 2026-11-15 |
| Privacy Policy, full draft | `docs/legal/PRIVACY_POLICY_DRAFT.md` | **Draft** for attorney review; not shown to members | `223ee96` 2026-11-13 |
| Terms of Service, full draft | `docs/legal/TERMS_OF_SERVICE_DRAFT.md` | **Draft** for attorney review; not shown to members | `51482bd` 2026-11-13 |
| Document versions and fingerprints | `src/lib/legal/versions.ts` | Complete; versions say "placeholder" | `223ee96` 2026-11-13 |
| Sign-up consents (three boxes) | `src/components/auth/auth-forms.tsx:132-154` | Complete as text | `582e05e` 2026-11-15 |
| Health and AI risk acknowledgment | `src/lib/legal/versions.ts:20-25` | Complete as text, version `2026-10-26` | `223ee96` 2026-11-13 |
| Onboarding wellness consent and health notices | `src/components/onboarding/onboarding-wizard.tsx:415-421`, `onboarding-questionnaire.tsx:560` | Complete as text | `582e05e` 2026-11-15; `223ee96` 2026-11-13 |
| AI consent card | `src/components/coach/ai-consent-card.tsx` | Complete as text; list is incomplete against the code (I-5) | `223ee96` 2026-11-13 |
| AI notices in the coach | `src/components/coach/coach-chat.tsx:643-648` | Complete as text | `582e05e` 2026-11-15 |
| Coaching-memory notice | `src/components/coach/memory-manager.tsx:163-164` | Complete as text | `582e05e` 2026-11-15 |
| Body Scan consent card | `src/components/body-scan/consent-card.tsx` | Complete as text | `582e05e` 2026-11-15 |
| Food-photo consent card | `src/components/nutrition/food-photo-consent.tsx` | Complete as text | `582e05e` 2026-11-15 |
| Web paywall and renewal terms | `src/components/profile/web-membership.tsx`, `src/lib/billing/paywall.ts:93-99` | Complete as text; links say "(drafts awaiting legal review)" | `223ee96` 2026-11-13 |
| Web auto-renewal consent box | `src/components/profile/billing-buttons.tsx:29-30`, `versions.ts:28-36` | Complete as text, version `2026-10-26` | `582e05e` 2026-11-15 |
| In-app (store) paywall | `src/components/profile/store-paywall.tsx` | Complete as text | `223ee96` 2026-11-13 |
| Plans and billing page, "How to cancel" | `src/app/(app)/profile/billing/page.tsx:214-230` | Complete as text; one sentence inaccurate (I-3) | `1d10749` 2026-11-13 |
| Account deletion screen | `src/components/profile/profile-forms.tsx:140-160`, `src/app/(app)/profile/page.tsx:166-167` | Complete as text | `223ee96` 2026-11-13; `a51ada5` 2026-11-16 |
| Privacy and data section (export, consents) | `src/app/(app)/profile/page.tsx:132-167` | Complete as text | `a51ada5` 2026-11-16 |
| Legal links in Profile | `src/components/profile/legal-links.tsx` | Complete; shows "Drafts awaiting legal review." | `223ee96` 2026-11-13 |
| GPS and location notices | `src/app/(app)/run/page.tsx:129`, `src/components/run/gps-recorder.tsx:489`, `ios/App/App/Info.plist:77-80` | Complete as text; two disagree (I-9) | `38e0dff` 2026-11-15; `223ee96` 2026-11-13 |
| iOS permission strings | `ios/App/App/Info.plist:11-12, 73-80` | Complete as text | `223ee96` 2026-11-13 |
| iOS privacy manifest | `ios/App/App/PrivacyInfo.xcprivacy` | Complete; not compared with the App Store answers | `223ee96` 2026-11-13 |
| Friends: privacy screen, block and report wording | `src/app/(app)/friends/privacy/page.tsx`, `src/components/friends/friends-panels.tsx` | Complete as text; feature off | `a51ada5` 2026-11-16 |
| Accountability partners screen | `src/app/(app)/profile/accountability/page.tsx` | Complete as text; feature off | `fa43b03` 2026-11-13 |
| Emails: confirm sign-up, reset password | `supabase/templates/confirmation.html`, `recovery.html` | Complete as text; no sender identity or address in the body | `223ee96` 2026-11-13 |
| Inventory of what the documents must cover | `docs/LEGAL_REQUIREMENTS.md` | Internal working note, dated 2026-10-22 and 2026-10-25 | `1d10749` 2026-11-13 |

**Documents that do not exist anywhere in the repository:** a consumer-health-data privacy policy (Washington /
Nevada), a refund policy, community or conduct rules for Friends, a moderation procedure, an incident-response
procedure, a retention schedule, data-processing agreements, a cookie notice, a custom EULA, a copyright (DMCA) agent
notice, an accessibility statement.

## 3. Every placeholder, blank and unresolved marker

### 3.1 In the app (visible to members)

| File:line | Text |
|---|---|
| `src/app/legal/layout.tsx:14-15` | "Placeholder — requires legal review. This document is a draft outline and is not legally binding. Have qualified counsel review and complete it before launch." (banner on every legal page, including Notices and the re-acceptance page) |
| `src/app/legal/privacy/page.tsx:1` | Page title "Privacy Policy (Draft)" |
| `src/app/legal/privacy/page.tsx:12` | "Draft last updated: [DATE — to be completed by counsel]" |
| `src/app/legal/privacy/page.tsx:49` | "[Counsel to complete.]" (How we use it) |
| `src/app/legal/privacy/page.tsx:55-56` | "[Counsel to confirm the wording and any applicable 'sale' or 'sharing' definitions under state law.]" |
| `src/app/legal/privacy/page.tsx:61` | "[Counsel to verify and list data processing agreements.]" |
| `src/app/legal/privacy/page.tsx:66-67` | "[counsel to confirm with each provider's agreement]" |
| `src/app/legal/privacy/page.tsx:72` | "[Contact details to be added.]" |
| `src/app/legal/terms/page.tsx:2` | Page title "Terms of Service (Draft)" |
| `src/app/legal/terms/page.tsx:8` | "Draft last updated: [DATE — to be completed by counsel]" |
| `src/app/legal/terms/page.tsx:19` | "[Counsel to complete refund and consumer-law terms, including App Store and Google Play purchases.]" |
| `src/app/legal/terms/page.tsx:21` | Acceptable use: "[To be completed.]" |
| `src/app/legal/terms/page.tsx:23` | Limitation of liability: "[To be completed by counsel.]" |
| `src/components/profile/legal-links.tsx:16` | "Drafts awaiting legal review." |
| `src/components/profile/web-membership.tsx:147`, `store-paywall.tsx:203` | "(drafts awaiting legal review)" beside the Terms and Privacy links on both paywalls |
| `src/lib/legal/versions.ts:15-16` | Versions `2026-10-26-placeholder` for Terms and Privacy, stored in each member's acceptance record |

**Missing entirely from the in-app Privacy page:** the legal entity, address, contact, effective date, retention,
children, security, breach, state rights, consumer-health-data section, international section, change procedure.
**Missing entirely from the in-app Terms page:** the entity, acceptance mechanics, plans and prices, AI allowance,
AI terms, GPS, sleep, Body Scan, faith content, acceptable use, intellectual property, termination, warranty
disclaimer, liability, dispute resolution, governing law, changes, Apple terms, contact.

No `TODO` or `FIXME` relating to legal text was found in `src/`.

### 3.2 `docs/legal/PRIVACY_POLICY_DRAFT.md`

| Line | Placeholder or marker |
|---|---|
| 3 | Version "[DRAFT 2026-10-26]" |
| 4 | "[EFFECTIVE DATE — set when published]", "[DATE]" |
| 6 | Banner: draft for attorney review, not in force; "Retention periods are marked [OWNER TO DECIDE]; none has been decided" |
| 12 | "[LEGAL ENTITY NAME]" |
| 14 | "[PRIVACY EMAIL]" |
| 15 | "[POSTAL ADDRESS]" |
| 16 | Toll-free number: whether one is required |
| 54 | Whether Google ML Kit sends usage or diagnostic data |
| 71 | Owner note: keep "no analytics" true, or change the policy and store forms first |
| 92 | Confirm "no training" against Anthropic's terms |
| 104 | Progress photos have no consent gate: decide whether one is needed |
| 109 | Religious data as sensitive data; whether an explicit notice or consent is needed when faith features are turned on; Washington and Nevada consent for collection and sharing |
| 136 | Anthropic's retention period; zero-retention arrangement; processor terms |
| 140 | Execute or confirm a data-processing agreement with each recipient |
| 144 | "[EMAIL DELIVERY PROVIDER — OWNER TO CONFIRM; no production SMTP is configured in the repository]" |
| 145 | "[HOSTING PROVIDER — OWNER TO CONFIRM, e.g. Vercel]" |
| 158 | "[OWNER TO DECIDE all periods below; do not publish until decided …]" |
| 162 | Retention: account and logs |
| 163 | Retention: whether to purge soft-deleted runs after N days |
| 164 | Retention: AI conversations and memories |
| 165 | Retention: AI usage counts |
| 166 | Provider retention of meal photos |
| 167 | Retention: photos and Body Scans |
| 168 | Retention: billing records; tax and accounting periods |
| 169 | Retention: server and error logs |
| 170 | Retention: backups |
| 171 | Retention: consent records; auto-renewal consent verification period |
| 197 | "[PRIVACY EMAIL]"; "[45 days …]" response period |
| 199 | Which state laws apply; whether to extend rights to all US users |
| 203 | Separate consumer-health-data privacy policy to be drafted |
| 212 | "[PRIVACY EMAIL]" |
| 225 | Avoid absolute security claims |
| 229 | Adopt a written incident-response procedure; confirm notice timing |
| 233 | "[REGIONS …]"; GDPR sections or a US-only statement |
| 248 | "[LEGAL ENTITY NAME] · [POSTAL ADDRESS] · [PRIVACY EMAIL]" |

### 3.3 `docs/legal/TERMS_OF_SERVICE_DRAFT.md`

| Line | Placeholder or marker |
|---|---|
| 3 | Version "[DRAFT 2026-10-26]" |
| 4 | "[EFFECTIVE DATE — set when published]" |
| 6 | Banner: not reviewed or approved by counsel |
| 12 | "[LEGAL ENTITY NAME]", "[STATE OF FORMATION]", "[ENTITY TYPE]", "[POSTAL ADDRESS]"; note that the owner is currently an individual |
| 20 | Clickwrap note (now out of date: section 4, S-1) |
| 24 | "[PRIVACY POLICY URL]" |
| 26 | Apple standard EULA or custom EULA |
| 35 | Confirm minimum age stays 18 |
| 42 | "[SUPPORT EMAIL]" |
| 68 | Confirm prices match Stripe, App Store and Play on the publication date |
| 86 | Whether to state the AI cost limit as a dollar figure |
| 88 | Which time zone the monthly AI reset uses; notice if allowances are reduced |
| 92 | "[PLAN CHANGE DATE]"; notice to legacy subscribers |
| 96 | Scope of the right to change features |
| 110 | Keep marketing within FDA general-wellness guidance |
| 161 | Assumption-of-risk wording |
| 165 | "[LEGAL ENTITY NAME]" |
| 174 | Whether to include an express negligence release at all |
| 224 | Anthropic usage-policy treatment of medical recommendations |
| 238 | State dietetics-licensure laws |
| 271 | Progress photos: consent gate |
| 281 | Religious content and the "Narrow Gate" name: consumer-protection and trademark check |
| 289 | "[SECURITY CONTACT]" |
| 308 | Auto-renewal disclosure and consent note (now out of date: section 4, S-2) |
| 334 | "[OWNER TO DECIDE refund policy …]", "[X] days"; whether a posted refund policy is required |
| 346 | "[OWNER TO DECIDE — e.g. 30]" days' notice of a price increase |
| 349 | Store price-increase flows |
| 359 | Trials: none in code; promotion codes are enabled |
| 375 | "[HOSTING PROVIDER]" |
| 386 | Confirm "no AI training" |
| 409 | "[ATTRIBUTIONS / OPEN-SOURCE NOTICES URL OR IN-APP SCREEN]"; MPL-2.0 plugin |
| 411 | "[DMCA AGENT NAME AND ADDRESS]"; whether to register an agent |
| 421 | "[ATTORNEY REVIEW: confirm.]" (termination) |
| 431 | Warranty-disclaimer form |
| 449 | Liability cap and personal-injury carve-out |
| 457 | Whether to keep the indemnity |
| 461 | **Whether to use arbitration at all** (whole section 22) |
| 482 | "[LEGAL NOTICE EMAIL]", "[POSTAL ADDRESS]"; pre-dispute conference |
| 495 | "[ARBITRATION PROVIDER …]"; "[OWNER/ATTORNEY TO DECIDE provider.]" |
| 497 | "[US $25,000]" threshold |
| 506 | Jury-waiver enforceability |
| 514 | Mass-filing language |
| 518 | "[OPT-OUT EMAIL]"; opt-out by mail |
| 532 | "[GOVERNING-LAW STATE]", "[COUNTY, STATE]"; forum-selection limits |
| 536 | "[OWNER TO DECIDE — e.g. 30]" days' notice of changes; recording acceptance of new versions |
| 545 | "[LEGAL NOTICE EMAIL]", "[POSTAL ADDRESS]" |
| 551 | Include section 26 only if a custom EULA is used |
| 553, 562 | "[LEGAL ENTITY NAME]", "[POSTAL ADDRESS]", "[SUPPORT EMAIL]" (Apple section) |
| 566-569 | "[LEGAL ENTITY NAME]", "[POSTAL ADDRESS]", "[SUPPORT EMAIL]", "[LEGAL NOTICE EMAIL]" |

## 4. Attorney notes in the drafts that the code has overtaken

| # | Draft says | Code today | Evidence |
|---|---|---|---|
| S-1 | Terms :20: "the app does not currently record which version was accepted or when" | It does. Each acceptance is stored with document, version, SHA-256 of the text and a database-set time | Migration `20261026000045_legal_acceptances.sql`; `versions.ts:39-45` |
| S-2 | Terms :308: "Neither version records consent" to auto-renewal | Web checkout requires a ticked box and records the agreed text with price and period. Still true: no acknowledgment email, no reminder, nothing recorded for store purchases | `src/server/actions/billing.ts:29, 49`; `billing-buttons.tsx:29-30` |
| S-3 | Terms :68: code is "mid-migration" between prices | Code prices are $17.99 a month and $119.99 a year (`src/lib/domain/plans.ts:101-102`); a later note in the same paragraph says so. Store and Stripe prices as configured were **not verified** | `plans.ts`; `docs/MEMBERSHIPS.md:10-11` |
| S-4 | Terms :88: "confirm which time zone the reset uses" | UTC: the allowance renews on the 1st of each month, UTC | `src/lib/domain/ai-allowance.ts:11-24` |
| S-5 | Privacy :6: prepared from branch `claude/free-pro-membership` on 2026-10-26 | Features added or changed since are not reflected: section 5 | — |
| S-6 | Migration comment gives "$19.99 per month" as the example auto-renewal detail | Comment only; current price is $17.99 | `20261026000045_legal_acceptances.sql:17` |

## 5. Inconsistencies

"Draft P" = Privacy draft. "Draft T" = Terms draft. "In-app P / T" = the pages members see.

### 5.1 Between what members see and what the code does

| # | Where | Says | Code does |
|---|---|---|---|
| I-3 | `profile/billing/page.tsx:230` | "Deleting the app or your Narrow Gate account cancels a website subscription for you" | Deleting the **account** cancels a Stripe subscription (`account-deletion.ts:51-56`). Deleting the **app** does nothing to it. The renewal text two components away says the opposite for stores ("Deleting the app … does not cancel it", `paywall.ts:95-97`), and Draft T :325 says "Deleting the app from your phone does not cancel a subscription" |
| I-5 | `ai-consent-card.tsx:37-50` | Lists what is sent to Anthropic | Not listed: Bible study questions; weekly-report figures sent on a schedule; food-**label** photos (the food-photo card does mention labels); 40-day challenge progress; text of earlier conversations; sleep check-in factors; running summary. The card's own comment says the list must match the code (:11-12) |
| I-9 | `run/page.tsx:129` | "the phone app is being prepared to keep recording with the screen locked" | `Info.plist:79-80`, In-app P :19-20 and Draft P :46 say recording continues while the phone is locked if allowed. One of the two is out of date; behaviour on a phone was not verified |
| I-10 | `body-scan/consent-card.tsx:14` | Photos are "never sent to the AI coach or to any other company or service" | They are stored with Supabase, a company. The preceding line says "private storage" without naming it |
| I-11 | `onboarding-wizard.tsx:415`; Body Scan card :13 | "never visible to administrators"; "Our team and admins can't view them" | True of app admin accounts (no policy). Anyone with the service-role key or the Supabase dashboard can read the data. Who holds that access is not in the repository |
| I-12 | In-app P :45 | Search text is sent to Open Food Facts and USDA | Barcodes go to Open Food Facts; search text goes to USDA only when a key is set; otherwise nothing leaves (file 06, section 2) |
| I-13 | In-app P :49; Draft P :21 | "We do not use advertising or analytics trackers" | No third-party trackers. A first-party activation-event log and admin metrics exist (file 06, 4.17) |
| I-14 | In-app T :10 | "18 or older … at launch" | "At launch" suggests the age may change; Draft T :35 says 18 without qualification |

### 5.2 Between the drafts and the code

| # | Where | Says | Code does |
|---|---|---|---|
| I-20 | Draft T :54 | The **entire** Faith & Discipline section is free | The Bible study AI helper requires Pro (`src/server/services/bible-ai.ts:110`) |
| I-21 | Draft T :74-80 | Six things count against the 150-request AI allowance | Bible study questions and weekly-report analyses also draw on it (`bible-ai.ts:115`, `weekly-reports.ts:138`); label photos use the photo allowance |
| I-22 | Draft T :54, :276; Draft P :40 | Faith features are Scripture, devotionals, prayer journal and the 40-day challenge | Also a Bible reader with history, highlights, bookmarks and notes, studies, memory verses, journeys, discipline practices, reminders and an AI helper |
| I-23 | Draft P :100 | The database refuses recovery check-ins without wellness consent | App-level check only (file 06, D1) |
| I-24 | Draft P :47 | Health-platform data is read only after wellness consent | Steps need only the operating-system permission (file 06, D2) |
| I-25 | Draft P :113-126 | AI inputs | Same omissions as I-5 |
| I-26 | Draft P §6; Draft T §15 | Recipients | No mention of embedded YouTube or Vimeo players, or of an optional map-tile provider |
| I-27 | Draft P and Draft T | No member-to-member features | Friends and Accountability partners exist behind flags (file 08). Draft T §13 has no conduct rules for usernames, requests, reports or blocks |
| I-28 | Draft P :33-42 | Categories collected | Not listed: legal-acceptance records, notification device records, weekly reports, habit-program data, activation events, coach feedback, reports about members, admin audit logs |
| I-29 | Draft P :171 | Consent records are "kept on your profile" | One timestamp per consent, erased on withdrawal; acceptance records are deleted with the account (file 06, 4.20) |
| I-30 | Draft T :250 | Route maps have no third-party map background | True by default; an environment setting can add one (`src/lib/domain/map-tiles.ts`) |
| I-31 | Draft T :268 | Body Scan "does not identify you by facial or body geometry" | Consistent with the code: no image analysis runs (file 06, 4.9) |
| I-32 | Draft P :212; Draft T :35 | Sign-up confirms 18+ and onboarding refuses under 18 | True. The confirmation is not recorded, and the database does not enforce a minimum (file 06, 5.5) |

### 5.3 Between documents

| # | Topic | Difference |
|---|---|---|
| I-40 | Scope | In-app P and T are outlines; the drafts are full documents. A member reading the in-app Terms sees no arbitration, liability, acceptable-use or pricing terms |
| I-41 | Hosting | In-app P :61 names **Vercel**; Draft P :145 and Draft T :375 leave the host blank |
| I-42 | Plan names | "Pro All Access" throughout; legacy "Plus" appears in Draft T §3.4, the billing page (:142) and a store message (`store-paywall.tsx:120`). In-app T says only "Paid plans" |
| I-43 | Prices | Draft T :58 states $17.99 and $119.99. In-app T states no price. Paywalls show the price from Stripe or the store |
| I-44 | Yearly plan | In-app T :19: "monthly (or yearly, where offered)"; Draft T and the paywalls treat yearly as always offered |
| I-45 | Refunds | In-app T: blank. Draft T :334: undecided. Web renewal text: no refund statement. iOS and Android renewal text: "Refunds are handled under" the store's policy |
| I-46 | Retention | In-app P: providers "delete their copies under their own retention terms". Draft P §7: a table, every period undecided |
| I-47 | Age | In-app P :16 says age is collected "to confirm adult eligibility"; no children section. Draft P §10 has one |
| I-48 | Acceptance wording | Sign-up box and re-acceptance box: "I agree to the … Terms of Service and have read the … Privacy Policy". Draft T :20 says "agree to the Terms and Privacy Policy" |

## 6. Claims of attorney review or approval

None found. Searched `src/` and `docs/legal/` for "attorney", "counsel", "lawyer", "reviewed by", "approved".

- Every in-app legal page carries the "Placeholder — requires legal review" banner.
- Both paywalls and the Profile legal links say the documents are drafts awaiting legal review.
- Both long drafts state at the top that they have not been reviewed or approved by counsel.
- `docs/LEGAL_REQUIREMENTS.md` says "No document here has received legal approval."
- The drafts cite statutes, cases and guidance and contain notes addressed to an attorney. These were written as
  research support, as the banner says. **The accuracy of those citations was not checked for this audit.**

One point for the owner: the banner tells every member "not legally binding" while the sign-up form asks them to
agree to those pages and stores that agreement. Whether that helps or harms is a question for counsel.

## 7. Unresolved owner decisions

| # | Decision | Where it is waiting |
|---|---|---|
| 1 | Legal entity (name, type, state); the owner is currently an individual | Draft T :12; Draft P :12 |
| 2 | Postal address | Draft P :15; Draft T :12, :482, :545, :562, :567 |
| 3 | Contact addresses: privacy, support, legal notices, security, arbitration opt-out | Draft P :14; Draft T :42, :289, :482, :518, :568-569 |
| 4 | Effective date and version label | Both drafts :3-4; `versions.ts:15-16` |
| 5 | Governing-law state and venue | Draft T :532 |
| 6 | Arbitration: whether to use it, provider, thresholds, opt-out method | Draft T :461-518 |
| 7 | Refund policy for web purchases | Draft T :334; In-app T :19 |
| 8 | Retention period for each data type, logs and backups | Draft P :158-171 |
| 9 | Countries served: US only or wider | Draft P :233; `docs/LEGAL_REQUIREMENTS.md` item 2 |
| 10 | Apple standard EULA or a custom one | Draft T :26, :551 |
| 11 | Hosting provider, email provider, processing regions | Draft P :144-145, :233 |
| 12 | Minimum age stays 18; what happens to an under-age account | Draft T :35 |
| 13 | Consent approach for sensitive data: progress photos, faith features, consumer health data; whether to extend state rights to all US members | Draft P :104, :109, :199, :203 |
| 14 | Notice periods for price and terms changes | Draft T :346, :536 |
| 15 | Whether to disclose the AI cost limit in dollars | Draft T :86 |
| 16 | Date and notice for legacy "Plus" subscribers | Draft T :92 |
| 17 | Whether Friends and Accountability launch, and under what rules | Flags; file 08 |

## 8. Drafting facts for counsel

A checklist of what the product does that each document must describe. Facts only; evidence is in file 06 unless a
reference is given. Items marked ◻ are not yet decided or not verifiable from the repository.

### 8.1 Privacy Policy

**Who and where**
- ◻ Operating entity, address, privacy contact.
- ◻ Hosting provider and regions for Supabase, the web host and Anthropic.
- Offered through a website, an iOS app and an Android app (Capacitor). No geo-restriction in code.

**What is collected** (file 06, section 4, one row per type)
- Account: email, password (hash at Supabase Auth), display name, optional avatar.
- Profile: age (stored as birth year), sex, height, weight, goals, experience, equipment, schedule, diet type,
  allergies and dislikes, units, time zone.
- Workouts, programs, templates, records, skip reasons, notes.
- Runs and walks: GPS route (up to 2,000 points, about 1-metre precision), distance, pace, splits, notes.
- Food diary, water, recipes, meal plans, grocery lists, supplements, custom foods, food filters.
- Bodyweight, tape measurements, self-entered body-fat percentage.
- Progress photos; Body Scan photos with measurements.
- From Apple Health or Health Connect, read-only: steps; sleep sessions and stages; overnight heart rate,
  heart-rate variability, respiratory rate; source device name.
- Sleep check-ins (including caffeine, alcohol, stress, mood, sleep aids) and recovery check-ins; limitation notes.
- AI: messages, conversation history, coach proposals, coaching memories, AI usage counts, meal-plan drafts, weekly
  reports, Bible study questions and answers.
- Faith: whether faith features are on; prayer journal; Bible reading history, highlights, bookmarks, notes, memory
  verses, study progress, journeys, discipline goals and check-ins, 40-day challenge, reminders.
- Billing status from Stripe and RevenueCat; no card numbers.
- Reminder settings and a record of each phone (key, platform, label, time zone, permission); no push token.
- Activation events (four per workout), used for aggregate metrics.
- Acceptance records for Terms, Privacy, risk acknowledgment and auto-renewal.
- Technical: IP address and request data at the host; redacted error logs; optional browser error reports.
- Flags off: username, friend links, requests, blocks, reports with free text, invite codes; partner links, share
  settings, fixed encouragement messages; coach feedback comments.

**Permissions and consents as built**
- Sign-up: three required boxes (18+, Terms and Privacy, risk acknowledgment). The first is not recorded.
- Wellness consent (one timestamp): limitation notes (database-enforced), sleep (database-enforced), recovery
  check-ins (app-enforced).
- AI data consent (one timestamp) covering all AI features as a whole.
- Food-photo consent, Body Scan consent, coaching-memory consent (one timestamp each).
- Per-entry "Share with AI Coach" on journal entries, default off.
- Operating-system permissions: location (while using, and always), camera, Health, notifications.
- No consent step for: workouts, food, weight, measurements, steps, progress photos, turning on faith features.
- Each consent is erased on withdrawal; no history is kept.

**Who receives what** (file 06, section 2)
- Supabase; the host; Anthropic (list in file 06, section 6, including the items missing from today's consent card);
  Stripe (email, account ID); RevenueCat with Apple and Google (account ID, purchases); Open Food Facts (barcode);
  USDA (search text, if configured); YouTube or Vimeo (when a member plays an embedded video); a map-tile provider
  only if the owner enables one; the email provider for two account emails.
- No sale, no advertising, no third-party analytics, no cross-app tracking in code.
- ◻ Anthropic's retention and training terms; ◻ agreements with each processor.
- With flags on: other members receive username, display name and workout figures; administrators read reports.

**Retention as built**
- Nothing is deleted on a schedule.
- Deleting a run removes the route at once and keeps the rest of the row.
- Meal and label photos are not stored.
- Withdrawing wellness consent deletes limitation notes and recovery check-ins but not sleep data.
- Withdrawing AI consent keeps past conversations and memories.
- Withdrawing Body Scan consent deletes all scans.
- ◻ Every period, including logs and backups.

**Rights tooling as built**
- Export: JSON of 93 tables plus one-hour photo links; 3 per hour; exclusions listed in file 06, section 3.
- Delete account: type DELETE and re-enter password; sequence and what survives in file 06, section 3.
- Edit profile and logs; delete individual runs, photos, scans, journal entries, conversations, memories, sleep.
- No request log, appeal process or authorised-agent process exists.

**Security as built**
- HTTPS; row-level security on every table; private buckets with signed links; photo metadata removed on the
  device; password re-entry for deletion; rate limits; coaching memories encrypted with a server key.
- Conversations, journals and health data are not field-encrypted.
- No multi-factor sign-in. Minimum password length 8.
- ◻ Who holds administrative and service-role access.

**Children**
- Facts in file 06, section 5.5.

**Other**
- ◻ Breach procedure. ◻ International scope. ◻ Consumer-health-data policy as a separate document.
- HealthKit and Health Connect: read-only, the five data types, stored on Supabase, summary to Anthropic on consent,
  no advertising use.
- Body Scan: no biometric identifier or template is derived.

### 8.2 Terms of Service

**Formation**
- Account creation requires three unticked boxes; acceptance of Terms, Privacy and the risk acknowledgment is
  recorded with version and text fingerprint.
- A re-acceptance screen exists and is off; turning it on (`LEGAL_REACCEPT_REQUIRED=true`) forces every member
  without a current record to accept before continuing.
- Final documents can be linked by URL (`LEGAL_TERMS_URL`, `LEGAL_PRIVACY_URL`) or by replacing the in-app pages;
  either way the version and fingerprint in `versions.ts` must change.
- The acceptance record is deleted when the account is deleted.

**Eligibility**
- 18+ box at sign-up; age 18 to 100 at onboarding; self-declared.

**Plans**
- Free and Pro All Access. Code prices: $17.99 a month, $119.99 a year. ◻ Prices configured in Stripe, App Store
  and Google Play.
- Legacy "Plus" and earlier "Pro" subscribers keep their terms (`legacy_plan_terms`).
- Free plan limit: 5 workout templates. Feature split: `src/lib/domain/plans.ts`.
- The Bible study AI helper is Pro; the rest of Faith is free.
- No free trial in code; Stripe promotion codes are accepted.

**AI**
- 150 requests per calendar month on Pro, reset on the 1st (UTC); a smaller number may use the more capable model;
  a per-member monthly cost limit; daily limit of 20 food photos; separate Bible-question limits.
- Counted: coach messages, plan generation, meal plans, food photos, "Ask AI about this food", sleep coaching,
  Bible study questions, weekly-report analysis.
- Provider: Anthropic. Changes the coach proposes apply only when the member confirms.
- Notices shown: "AI answers can be wrong and aren't medical advice" in the chat; the risk acknowledgment at sign-up.
- The coach is instructed not to coach a person who says they are under 18.

**Subscriptions**
- Web: Stripe Checkout; auto-renewal box required and recorded; manage and cancel in the Stripe portal; access
  continues to period end; failed payments are retried by Stripe.
- Stores: Apple or Google bills; cancel in the store; the app shows Restore purchases and Manage subscription.
- Deleting the account cancels a web subscription first and stops if that fails. It cannot cancel a store
  subscription; the screen says so.
- The app sends no purchase acknowledgment email and no renewal reminder.
- ◻ Refund policy. ◻ Notice periods.

**Feature-specific facts**
- GPS: location only during a recording the member starts; not a safety or emergency service; no live sharing.
- Sleep and health platform: read-only; estimates, not medical assessments.
- Body Scan and progress photos: stored privately; no body-fat estimate; no AI analysis.
- Nutrition: data from Open Food Facts and USDA can be wrong; allergen filters rely on that data.
- Programs: some are labelled "Not yet reviewed by a qualified coach" in the app
  (`src/app/(app)/train/programs/[slug]/page.tsx:200`).
- Faith: Berean Standard Bible text; devotional content from a Christian perspective.
- Third-party video embeds on some exercise pages, labelled "not reviewed by us".

**Conduct and content**
- Member content: logs, notes, journals, photos, AI messages. All private to the member today.
- With Friends on: usernames (3 to 20 characters, reserved staff-like names refused, no offensive-word screening),
  friend requests, invite links, blocking, reporting to administrators; no free text between members; limits in
  file 08, section 5. ◻ Conduct rules, moderation, suspension and appeal.

**To be supplied by owner and counsel**
- ◻ Entity, addresses, governing law, dispute resolution, liability terms, EULA choice, DMCA agent, notice periods.

### 8.3 In-app consent and disclosure screens

| Screen | Facts it must stay consistent with |
|---|---|
| AI consent card | The full list in file 06, section 6 (today's card omits several items: I-5) |
| Food-photo consent | Photo sent to Anthropic, not stored; 20 a day; covers meal and label photos |
| Body Scan consent | Stored at Supabase in a private bucket; not analysed; deleted on withdrawal |
| Wellness consent | Covers limitation notes, recovery check-ins, sleep; withdrawal does not delete sleep |
| Paywalls and auto-renewal box | Price, period, renews until cancelled, how to cancel, restore; what the app records |
| Billing "How to cancel" | Deleting the account cancels a web subscription; deleting the app does not (I-3) |
| Deletion screen | What is deleted, what is not (store subscriptions, provider records, backups, logs) |
| GPS notices | When location is read, including with the phone locked (I-9) |
| Friends and Accountability screens | Fields shared, defaults, that the display name is shown, that blocks are "not told" rather than undetectable (file 08) |

### 8.4 Documents not yet started

- Consumer-health-data privacy policy (Washington, Nevada): the categories in file 06, section 5.1; purposes;
  sources (member, Apple Health, Health Connect); who receives them; how rights are exercised.
- Refund policy.
- Retention schedule.
- Incident-response and breach-notification procedure.
- Community rules and moderation procedure, if Friends launches.
- App Store privacy answers and Google Play Data safety form, to match the final Privacy Policy.

## 9. Could not be verified

- Prices and products as configured in Stripe, App Store Connect and Google Play Console.
- The App Store privacy answers, the Play Data safety form and store listing text.
- The production values of `LEGAL_TERMS_URL`, `LEGAL_PRIVACY_URL` and `LEGAL_REACCEPT_REQUIRED`.
- Any legal document held outside the repository.
- The accuracy of statutes, cases and guidance cited in the two drafts.
- The date each legal file was last edited before 2026-11-13 (history on this branch starts there).
- The Terms draft was read in full for sections 1 to 3, 7.3, 9 to 14 and 16 and for every bracketed marker; the
  remaining sections were scanned through their markers only.
- The two email templates and several long components were searched for the relevant wording, not read line by line.
