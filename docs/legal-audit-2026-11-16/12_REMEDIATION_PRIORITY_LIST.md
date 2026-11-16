# 11. Remediation priority list

Date: 2026-11-16. Three parts: what was corrected in this audit, exact patches proposed and awaiting approval, and
actions only the owner or counsel can take. Nothing here was merged or deployed; all changes are on
`claude/friends-challenges`.

## A. Corrected in this audit (low risk; no legal judgment involved)

| # | Change | Files | Verification |
|---|---|---|---|
| A1 | A member who sent a report could read the administrators' internal note on it. No screen ever wrote that note; the column is removed | `supabase/migrations/20261116000077_friends_hardening.sql`; `src/app/(app)/admin/reports/page.tsx` unaffected | `tests/integration/friends.test.ts` (reading `admin_note` now errors) |
| A2 | The limit on username searches existed only in the app, so a direct database call could list usernames. The database function now counts its own calls (60 a minute per member) | same migration | New test: 70 searches, 60 answered |
| A3 | The same for guessing invite codes (20 attempts in 10 minutes). A code that isn't found now returns null instead of an error, because an error undid the count | same migration; `src/server/actions/friends.ts`; `src/lib/domain/friends.ts` | New test: attempts 21 and 22 are refused |
| A4 | A Friends test failed on Mondays (yesterday's workout falls in the previous week) | `tests/integration/friends.test.ts` | 18 of 18 pass |
| A5 | The Notices page said licence texts were "included with each package", which is not true of the shipped app. A complete third-party notices file (175 production packages with licence texts, plus the four fonts) is now generated and linked | `scripts/legal/third-party-notices.mjs`, `public/third-party-notices.txt`, `src/app/legal/notices/page.tsx` | Typecheck, lint, unit suite |
| A6 | Notices page: health plugin now named with its version (8.11.4) and a link to the Mozilla Public License 2.0; fonts (Inter, Plus Jakarta Sans, Cinzel, Lora; SIL OFL 1.1) now attributed; "(MIT and Apache-2.0)" corrected to the families actually present | `src/app/legal/notices/page.tsx` | same |
| A7 | A code comment said no Open Food Facts data is copied into the app's tables; it is. Comment corrected to describe the actual behaviour | `src/server/services/food-quality.ts` | — |
| A8 | Internal Friends document said a block "is never revealed" and a decline "isn't shown"; both can be inferred. Corrected | `docs/friends/FRIENDS_CHALLENGES.md` | — |
| A9 | README said 157 exercises; there are 218 | `README.md` | — |
| A10 | `package.json` now says `"license": "UNLICENSED"` (no licence is granted to others), matching the absence of a licence file | `package.json` | — |
| A11 | (From the Phase 1 review, same branch) the service worker no longer requests Home pictures that do not exist, which had stopped offline use | `public/sw.js` | Bible offline tests |

Checks after part A: typecheck and lint clean; unit suite 4,728 passed, 1 skipped; integration suite result recorded
in `14_EVIDENCE_APPENDIX.md`. The browser suite was not re-run after these changes. Migration 077 has a rollback note
at its top.

## B. Exact patches proposed, awaiting approval (wording or behaviour with legal consequence)

| # | Where | Now | Proposed | Why approval is needed |
|---|---|---|---|---|
| B1 | `src/components/onboarding/onboarding-questionnaire.tsx:487`, `onboarding-wizard.tsx:249` | Body details are "Never shared" | "Used to calculate your plan. Sent to the AI coach's provider only if you turn the AI coach on. Never sold or shown to other members." | A privacy representation; counsel should approve the words |
| B2 | `src/components/body-scan/consent-card.tsx:14`, `scan-dashboard.tsx:140` | Photos go to no "other company or service" | "Stored privately with our hosting provider. Never sent to the AI coach, never shown to other members." | Same |
| B3 | `src/lib/domain/plans.ts:143`, `src/components/profile/membership-plans.tsx:43` | "Complete Faith section, always free" | "Bible, prayer journal, devotionals and reading journeys are free. The AI Bible study helper is part of Pro." | A pricing promise; "always" and "forever" are open-ended commitments |
| B4 | `src/components/coach/ai-consent-card.tsx` | List of what the AI provider receives omits Bible study questions, weekly-report figures, label photos, earlier conversation text, sleep check-in factors | Add those five items | A consent disclosure |
| B5 | `src/app/(app)/profile/billing/page.tsx:230` | Wording implies deleting the app cancels a web subscription | Remove "the app" so it reads that deleting the account does not cancel a store subscription, and say where to cancel | Subscription disclosure |
| B6 | `src/data/supplements.ts:315` | Mentions "under 18" although the app is for adults only | Remove the phrase | Age representation |
| B7 | `src/lib/domain/friends.ts:66-75` | Five privacy switches (records, rankings, body, nutrition, faith) are shown but nothing reads them yet | Hide them until the feature that uses them ships | A switch that does nothing can mislead; product decision |
| B8 | `src/server/services/open-food-facts.ts:12` | Requests identify the app without a contact email | Add the support email once one exists | Needs the owner's address |
| B9 | All 24 Friends and accountability database functions | `set search_path = public` | `set search_path = public, pg_temp` | Defence in depth; touches many functions, so it deserves its own reviewed migration |
| B10 | Friends defaults (`show_workouts`, `searchable`, `show_in_leaderboards` start on) | On | Counsel and owner to decide whether sharing should start off | Consent design |
| B11 | Stop sending Apple Health / Health Connect-derived steps and sleep to the AI provider, or gate it behind a separate, explicit switch | Sent after the general AI consent | Decide after counsel reads the platform rules (E8) | Changes a feature |

## C. Owner and counsel actions, in priority order

| Priority | Action | Who | Blocks |
|---|---|---|---|
| 1 | Decide with counsel who will own and operate the product (the founder as an individual, or a company). Document the founder's authorship and direction of the work (file 11). If a company is formed, assign the rights to it in writing | Owner + counsel | Public launch (a named operating party in the Terms); investment. **Not required for private TestFlight**, which an individual Apple account can run |
| 2 | Commission a full trademark search (federal, state, common law, app stores, design) and decide on the name, tagline, "Nutrition Score" and "Food IQ" | Trademark counsel | Public launch, filing |
| 3 | Finalise the Terms and Privacy Policy from the drafting facts in file 07; decide the 17 open owner decisions; provide a working support and privacy contact | Owner + counsel | TestFlight (contact only), public launch |
| 4 | Approve or amend patches B1–B6 | Owner + counsel | Public launch |
| 5 | Decide the Open Food Facts question (E7) and the health-data-to-AI question (E8) | Counsel | Public launch |
| 6 | Establish who made the badge artwork and the supplied exercise clip, and under what terms; replace what cannot be documented | Owner | Public launch (counsel) |
| 7 | Patent counsel to pull the claim sets listed in file 03 and advise | Patent counsel | Counsel |
| 8 | Engage a certified coach, a registered dietitian and, for injury content, a physiotherapist to review the AI safety rules, programs, supplement notes and animations; a theological reviewer for the commentary | Owner | Public launch (counsel) |
| 9 | Decide retention periods, age handling and where the app will be offered | Owner + counsel | Public launch |
| 10 | Device test plan; store products; reviewer demo account; store listings, privacy labels and data-safety form | Owner | Public and paid launch |
| 11 | Before Friends is switched on: moderation process and response time, a staff suspend tool, a username filter, the Terms and Privacy sections for sharing between members, patches B7 and B10 | Owner + counsel | Switching Friends on |
| 12 | Record of AI-tool use and the applicable terms; insurance | Owner | Investment |

Superseded in part by `17_PRIORITIZED_ACTION_PLAN.md`, which is the current plan; wording items B1 and B5 were
applied in part and B6 withdrawn, as recorded in `15_WORDING_CORRECTIONS_BEFORE_AFTER.md`.
