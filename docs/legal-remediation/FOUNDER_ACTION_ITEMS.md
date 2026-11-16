# Founder action items

Date: 2026-11-16. Everything below needs you: a decision, a fact, a document, an external account or a device. Code
work that depends on an answer is noted. In priority order within each group.

## 1. Decisions (approve, change or reject)

| # | Decision | Where to look | What happens next |
|---|---|---|---|
| D1 | Apply the offline fix to the release candidate | `docs/legal-audit-2026-11-16/20_RC_OFFLINE_FIX_PATCH.md`; branch `claude/rc-offline-fix` | I fast-forward the release candidate to it |
| D2 | Keep the separate Apple Health / Health Connect permission for the AI Coach, and its wording | `PRIVACY_DATA_FLOW_AUDIT.md`; `src/components/profile/profile-forms.tsx` (`HealthAiShareForm`) | Counsel reviews the wording |
| D3 | Approve or amend the 27 legally consequential wording changes (pricing promises, privacy statements) | `docs/legal-audit-2026-11-16/21_STATEMENT_CORRECTIONS_APPLIED.md` | Counsel reviews; I adjust |
| D4 | Badge artwork and the supplied dumbbell-curl clip: document, replace, or exclude from public distribution meanwhile | `ASSET_OWNERSHIP_MANIFEST.md` | I implement the option you choose (nothing is deleted without your approval) |
| D5 | The 34 open decisions in the legal drafts (retention periods, age policy, where the app is offered, dispute resolution, governing law and others) | `docs/legal/REMAINING_INFORMATION_NEEDED.md`, section B | Counsel drafts final text |
| D6 | Whether to form an entity now or later (not needed for private TestFlight) | `INVESTOR_IP_OWNERSHIP_CHECKLIST.md` | Counsel advises |
| D7 | Prayer-journal "Share with AI Coach": keep, change or remove (open since the 2026-11-14 audit) | `docs/legal-audit-2026-11-16/06_PRIVACY_DATA_FLOW_MAP.md` | — |
| D8 | An always-available "report this AI reply" control (exists behind a switch that is off; it stores member feedback) | `APP_STORE_COMPLIANCE_CHECKLIST.md`, section 5 | I switch it on or build a minimal version |
| D9 | Friends & Challenges: stays off. Before it is ever switched on: sharing defaults, moderation commitments, username screening | `docs/legal/MODERATION_AND_USER_CONTENT_POLICY_DRAFT.md`; audit file 08 | — |

## 2. Facts and documents only you can supply

| # | Item | Used in |
|---|---|---|
| F1 | Support email and privacy email (a monitored mailbox) | The app, the legal pages, the stores, Open Food Facts requests |
| F2 | Operating party's legal name (you or a company), postal address, effective date | Terms and Privacy Policy (76 bracketed facts listed in `REMAINING_INFORMATION_NEEDED.md`, section A) |
| F3 | Where the 27 badge images' three source pictures came from: tool or source, account, date, terms | Asset manifest |
| F4 | Where the dumbbell-curl clip came from | Asset manifest |
| F5 | Which AI tools you used (coding, images), under which account and plan, with dates; keep the conversation records | IP ownership record |
| F6 | Whether anyone else contributed or was promised a stake | IP ownership record |
| F7 | Who registered the domains; turn on two-factor sign-in for GitHub and the registrar | Ownership |
| F8 | The AI provider account's terms: retention, no training on your members' data | Privacy Policy; counsel |
| F9 | Email provider for sign-up and password emails | Privacy Policy (processor list) |
| F10 | The seven Home photographs, each with a licence or release | Assets |

## 3. External accounts

| # | Task |
|---|---|
| X1 | Apple Developer Program (individual is fine for TestFlight); App Store Connect app record |
| X2 | Hosted staging environment for testers (`docs/STAGING_ENVIRONMENT.md`) |
| X3 | Later, for paid launch: subscription products, paid apps agreement, tax and banking; privacy label; age rating; review notes and demo account |
| X4 | Google Play developer account; Data safety form; health declarations; account-deletion URL (`/legal/delete-account`) |
| X5 | An AI provider staging key with a spending cap, to measure live answers and cost |

## 4. Physical-device testing

On an iPhone (and later an Android phone): sign-up, a workout with the screen locked, a GPS walk, the barcode camera,
reminders, Apple Health import and the new health-sharing switch, Restore Purchases and a sandbox purchase, account
deletion. Plan: `docs/release/IPHONE_PLAN_2026-11-15.md`.

## 5. Send to professionals

| To | Send |
|---|---|
| Trademark attorney | `TRADEMARK_ATTORNEY_PACKAGE.md` |
| Patent counsel | `PATENT_COUNSEL_PACKAGE.md` |
| Privacy / technology attorney | `docs/legal/*_DRAFT.md`, `REMAINING_INFORMATION_NEEDED.md`, `PRIVACY_DATA_FLOW_AUDIT.md`, `THIRD_PARTY_LICENSES.md` (Open Food Facts section), `docs/legal-audit-2026-11-16/13_COUNSEL_QUESTIONS.md` |
| Certified coach, registered dietitian, physiotherapist | The AI coach's safety rules, the programs, supplement notes, exercise demonstrations |
| Theological reviewer | The devotional and commentary text |
