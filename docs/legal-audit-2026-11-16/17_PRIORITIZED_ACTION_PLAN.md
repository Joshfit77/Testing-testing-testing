# 17. Prioritised action plan

Date: 2026-11-16. Scope set by the owner: finish the release candidate, verify ownership and licensing, correct
misleading statements, prepare for legal review. No new feature work. Friends & Challenges stays switched off and is
not merged or deployed.

Three lists: what Claude can safely do in code, what needs the owner, and what needs a licensed attorney or another
professional. Within each list, items are in priority order.

## What would prevent a safe public launch today

1. No final Terms or Privacy Policy, and no named operating party or contact in them.
2. The brand has not been searched on any official register, and similar fitness names are in use.
3. Statements to members that do not match the code (the remaining ones are consent and pricing wording, file 15).
4. The Open Food Facts storage question and the health-data-to-AI question are undecided (files 05 and 18).
5. Badge artwork and one exercise clip have no ownership record.
6. Nothing has been tested on a physical phone; no store purchase has been run; live AI is unmeasured.
7. No professional review of the AI coach's safety rules, the programs or the demonstrations.
8. No support contact, reviewer account or store listing.

## List 1. Claude can do safely in code

| # | Fix | Status | Needs before doing |
|---|---|---|---|
| 1.1 | Offline fix on the release candidate (service worker no longer requests missing pictures) | **Patch prepared and verified on a copy; awaiting your approval to apply** (file 20) | Your approval |
| 1.2 | Remove the two false "Never shared" statements in onboarding; correct the cancellation note | **Done** on the Friends branch (file 15, B1 and B5) | Your decision whether to carry them to the release candidate |
| 1.3 | Stop sending the wearable's device name to the AI provider | Proposed (file 18, Q3) | Your approval: it changes what the coach receives |
| 1.4 | Send steps to the AI provider only when the member asks about activity, and only typed-in steps unless a separate switch is on; leave watch-recorded sleep stages and vitals out unless that switch is on | Proposed (file 18, option A then B) | Your decision; counsel's wording for the switch |
| 1.5 | Add a contact email to Open Food Facts requests; move to its current service version | Proposed | A support address from you |
| 1.6 | Remove the 57 files derived from the undocumented exercise clip, or leave them | Proposed | Your answer on the clip's origin (list 2, item 2.4) |
| 1.7 | Replace the badge artwork with code-drawn badges if its origin cannot be documented | Proposed | Your answer on its origin (2.4) |
| 1.8 | Apply approved consent and pricing wording (file 15: B1-option, B2, B3, B4) | Waiting | Your approval and attorney review |
| 1.9 | Reword or attribute the descriptive references to named coaches and equipment brands | Waiting | Counsel's wording (file 16, section 6) |
| 1.10 | Put a support contact into the app and the legal pages; fill the non-legal blanks | Waiting | Details from you |
| 1.11 | A public web page for account-deletion requests (Google Play asks for one) | Proposed; small | Your approval |
| 1.12 | An always-available control to report an AI reply on Android (currently behind a switch that is off) | Proposed; small | Your approval |
| 1.13 | Carry the third-party notices file and Notices-page fixes to the release candidate | Done on the Friends branch | Your decision to carry over |
| 1.14 | Friends, kept off: `search_path` hardening on its database functions; hide the five switches that do nothing yet | Proposed | Not urgent while Friends is off |

Already done in this audit and listed in file 12, part A: Friends database hardening, the notices file, the Monday
test, comment and README corrections.

## List 2. Needs the owner (decisions, facts, external accounts)

| # | Action | Why |
|---|---|---|
| 2.1 | Approve or reject the release-candidate patch (file 20) | To finish the release candidate |
| 2.2 | Decide on the wording proposals in file 15 (B1-option, B2, B3, B4) | Misleading statements |
| 2.3 | Decide the health-data approach in file 18 (recommended: nothing from Apple Health or Health Connect goes to the AI provider unless a separate switch is on) | Health-data rules |
| 2.4 | State where the badge images and the supplied exercise clip came from: which tool or source, which account, when | Ownership |
| 2.5 | Write the short founder's statement of authorship and direction; list the AI tools and accounts used; keep the conversation records (file 11, A1–A2) | Ownership |
| 2.6 | Say whether there is a co-founder, contractor or anyone else who contributed (file 11, B) | Ownership |
| 2.7 | Provide a support email and a privacy email | TestFlight and launch |
| 2.8 | Confirm who registered the domains and that two-factor sign-in is on for GitHub and the registrar | Control |
| 2.9 | Apple Developer account: enrol (individual or company), create the app record, set up TestFlight | External account |
| 2.10 | Run the device test plan on an iPhone | Only possible on a device |
| 2.11 | Supply the seven Home photographs with a licence or release for each | Assets |
| 2.12 | Decide the 17 open points in file 07, section 7 (retention periods, age handling, where the app is offered, and others) | Policies |
| 2.13 | Engage a certified coach and a registered dietitian (and a physiotherapist for injury content) to review the AI safety rules, programs, supplement notes and demonstrations; a theological reviewer for the commentary | Claims |
| 2.14 | Later, for paid launch: create the store products, a reviewer demo account, the store listing, privacy labels and data-safety form; run sandbox purchases; set up an AI staging key with a spending cap | Paid launch |

## List 3. Needs a licensed attorney

| # | Matter | Brief |
|---|---|---|
| 3.1 | Trademark search and advice on the name, tagline, "Nutrition Score" and "Food IQ" | File 16 |
| 3.2 | Terms of Service and Privacy Policy; consent and paywall wording | Files 07, 15 |
| 3.3 | Who should own and operate the product; documenting the founder's ownership, including AI-assisted work | File 11 |
| 3.4 | Open Food Facts: what storing its data in the app's tables requires | File 05 |
| 3.5 | Health-platform data and the AI provider; state health-data laws | File 18 |
| 3.6 | Patent counsel: obtain and review the claims listed | File 03 |
| 3.7 | Subscription disclosures against auto-renewal law | File 09 |
| 3.8 | Age, retention, and which privacy laws apply | File 06 |
| 3.9 | Health, nutrition and AI claims; disclaimers | File 10 |
| 3.10 | The data-processing contracts needed with each provider | File 06 |
| 3.11 | Before Friends is ever switched on: sharing between members, moderation, defaults | File 08 |

All 35 questions are in `13_COUNSEL_QUESTIONS.md`.

## Suggested order of work

1. Approve the release-candidate patch (2.1); Claude applies it (1.1).
2. Decide the wording (2.2) and the health-data approach (2.3); Claude applies what is approved (1.3, 1.4, 1.8).
3. Answer the ownership questions (2.4–2.6, 2.8); Claude removes or replaces what cannot be documented (1.6, 1.7).
4. Provide contacts (2.7); Claude fills them in (1.5, 1.10).
5. Apple account and a first device pass (2.9, 2.10): private TestFlight (file 19).
6. In parallel, send files 13 and 16 to counsel (3.1–3.5 first).
7. Public and paid launch only after lists 2 and 3 are closed.
