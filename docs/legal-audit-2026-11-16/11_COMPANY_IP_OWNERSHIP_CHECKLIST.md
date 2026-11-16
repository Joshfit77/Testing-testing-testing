# 11. Company and IP ownership checklist (investor due diligence)

Date: 2026-11-16. Prepared from the repository only. This is a checklist of documents to assemble and facts to
confirm, not a legal opinion. Nothing in the repository can prove who owns the company, its accounts or its
intellectual property; every "evidence" entry below is what the repository shows and nothing more.

## What the repository shows

| Fact | Evidence | What it does not show |
|---|---|---|
| The code is hosted in a personal GitHub account, `Joshfit77/Testing-testing-testing` | Git remote | Who controls that account; whether a company organisation exists; who else has access |
| The repository name is a placeholder ("Testing-testing-testing") | Git remote | — |
| Every commit visible in this checkout (76; the checkout is shallow, so older history was not examined) is authored as "Claude" with a `Co-Authored-By: Claude …` trailer | `git log` on `claude/friends-challenges`, 2026-11-13 to 2026-11-16 | Which person directed the work, under what account and terms; whether earlier history has human authors or imported material |
| The repository has no `LICENSE` file; `package.json` is `"private": true` with no `license` or `author` field | Repository root, `package.json:2-4` | Ownership. Absence of a licence means no licence is granted to others; it is not evidence of who owns the work |
| App identifier `com.narrowgatefitness.app` on iOS and Android | `capacitor.config.ts:63`, `ios/App/App.xcodeproj/project.pbxproj:319`, `android/app/build.gradle:4-7` | That the identifier is registered in any developer account, or that the matching domain is owned (`capacitor.config.ts:16` says to change it to "a reverse-domain identifier you own") |
| Domains written in code and documents: `narrowgatefitness.com`, `narrowgate.fit` | grep of `src/`, `docs/` | That either is registered to the founder or a company |
| The Terms and Privacy drafts have no contracting party: `[LEGAL ENTITY NAME]`, `[STATE OF FORMATION]`, `[ENTITY TYPE]`, `[POSTAL ADDRESS]`, `[SUPPORT EMAIL]`, `[PRIVACY EMAIL]` | `docs/legal/TERMS_OF_SERVICE_DRAFT.md:12,562,566`; `docs/legal/PRIVACY_POLICY_DRAFT.md:12,248` | — |
| The Terms draft states "the owner is currently an individual" | `docs/legal/TERMS_OF_SERVICE_DRAFT.md:12` | Whether that is still true |
| No trademark application, assignment, contractor agreement, licence receipt or model release is stored in the repository | Search of the tree | Whether such documents exist elsewhere |

## Checklist

Status key: **MISSING FROM REPO** (may exist elsewhere), **UNKNOWN**, **OWNER TO CONFIRM**.

| # | Item | Why an investor or counsel asks | Status | Document to assemble |
|---|---|---|---|---|
| 1 | Legal entity (type, state, formation date, good standing, EIN) | Contracting party for Terms, stores, payment processors and investment | OWNER TO CONFIRM (draft Terms say the owner is an individual) | Formation documents, certificate of good standing |
| 2 | Cap table and founder equity; any co-founder | Who owns the company; vesting | UNKNOWN | Cap table, stock purchase agreements |
| 3 | Assignment of all pre-formation IP from the founder (and any co-founder) to the entity | Work done before the entity existed belongs to the individual unless assigned | MISSING FROM REPO | Signed IP assignment agreement(s) |
| 4 | Contractor, designer, photographer, coach or reviewer agreements with IP assignment | Without a written assignment a contractor generally keeps copyright | UNKNOWN whether any contractor worked on the product | Each agreement, or a signed statement that there were none |
| 5 | Employee invention-assignment agreements | Same, for employees | UNKNOWN | Agreements, or statement that there are no employees |
| 6 | Any prior employer or school claim on the founder's work | Moonlighting and invention-assignment clauses | OWNER TO CONFIRM | Founder representation; review of employment agreement |
| 7 | AI-assisted authorship record | The visible commit history is authored by an AI coding assistant. Counsel will want to assess copyright protectability of AI-generated code, text and art, and the terms of the AI services used | OWNER TO CONFIRM | Account holder and plan for each AI tool used (coding assistant, any image or video generator); the provider terms in force on the dates of use; a short written description of the human direction, selection and editing involved |
| 8 | GitHub repository ownership and access | Control of the code | Personal account | Transfer to a company-owned organisation; list of collaborators; 2FA; rename the repository |
| 9 | Domain ownership (`narrowgatefitness.com`, `narrowgate.fit`, any others) | Brand control; store identifier; email | UNKNOWN | Registrar records showing the registrant |
| 10 | Apple Developer Program account (entity vs individual, D-U-N-S) and App Store Connect app record | Apple expects apps handling sensitive data to come from a legal entity; the seller name is public | UNKNOWN (external) | Account enrolment record |
| 11 | Google Play developer account (organisation vs personal; verification) | Same; personal accounts have a closed-testing requirement | UNKNOWN (external) | Account record |
| 12 | Supabase, hosting, Stripe, RevenueCat, AI-provider and email accounts: account holder, plan, signed DPAs | Processor contracts must be in the operating entity's name | UNKNOWN (external) | Account list with owner, plus each DPA |
| 13 | Trademark applications | Brand ownership | None evidenced | Counsel's clearance search, then application(s) in the entity's name. See `02_TRADEMARK_CONFLICT_REGISTER.md` |
| 14 | Source-code ownership chain | Clean title to the product | See items 3–8 | — |
| 15 | Third-party content permissions (Scripture text, food data, any photographs) | Right to distribute commercially | See `05_SBOM_AND_DATA_LICENSES.md` and `04_ASSET_RIGHTS_LEDGER.md` | Licence texts and source records kept with dates |
| 16 | Open-source compliance record | Standard diligence request | See `05_SBOM_AND_DATA_LICENSES.md` | SBOM, notices file, written policy |
| 17 | Marketing materials (investor deck, screenshots, any logo files, social accounts and handles) | Ownership and accuracy of what is shown to investors and customers | The investor deck was generated in this project from real screenshots; no separate marketing assets are in the repository | Register of social handles and who controls them |
| 18 | Insurance (general liability, cyber, and professional/E&O for fitness and nutrition guidance) | Risk transfer for an app that gives exercise and nutrition guidance | UNKNOWN | Policies or broker quote |
| 19 | Founder/owner photographs for the Home screen | Model and property releases if people or private places appear | Not yet supplied | Licence or release for each photograph |
| 20 | Professional reviewers (coach, dietitian, physiotherapist, theologian, attorney) | Evidence behind any "reviewed by" statement; none may be made until it exists | None engaged per repository records | Engagement letters and written sign-offs |

## Before accepting investment: minimum set

1. Form or confirm the entity and assign all existing IP to it in writing (items 1, 3).
2. Move the repository, domains, developer accounts and service accounts into the entity's name (items 8–12).
3. Written confirmation of who, other than the founder, contributed anything (items 4–6), with assignments.
4. A dated record of AI-tool use and the applicable terms (item 7), for counsel's assessment.
5. Counsel's trademark search and a filing decision (item 13).
6. The licence and source records referenced in the asset ledger and the data-licence inventory (items 15–16).

## What cannot be verified from GitHub alone

Entity existence and standing; ownership of domains, developer accounts and service accounts; any contract,
assignment, release or licence receipt; the identity and role of the people who directed the AI-assisted work; the full
commit history beyond this shallow checkout; trademark filings; insurance.
