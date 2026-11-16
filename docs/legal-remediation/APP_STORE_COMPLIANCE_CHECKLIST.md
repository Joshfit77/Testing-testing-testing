# App Store and Google Play compliance checklist

Date: 2026-11-16. Branch: `claude/legal-remediation`. Working checklist built from
`docs/legal-audit-2026-11-16/09_STORE_COMPLIANCE_CHECKLIST.md`, which holds the rule quotations and file references
(row IDs A1–A34 for Apple, G1–G17 for Google). Passing automated tests does not prove store compliance. Google Play
policy pages could not be reached from this environment, so every G row except G7 and G10 rests on secondary sources.

## 1. Verified in code

| Item | Evidence | Row |
|---|---|---|
| In-app purchase for Pro in the native apps; web checkout hidden and refused inside them | `store-paywall.tsx`; native detection in the billing code | A11, A13, G1 |
| Restore Purchases control | Plans & billing screen | A12 |
| Subscription name, period, price and auto-renewal wording on the purchase screen | `store-paywall.tsx:157-167`; `src/lib/billing/paywall.ts:95-97` | A16, G2 |
| Manage / cancel links for App Store, Google Play and the website | `src/app/(app)/profile/billing/page.tsx` | A17 |
| Account deletion inside the app, with password confirmation; cancels a website subscription | `DeleteAccountForm`; `src/server/services/account-deletion.ts:52` | A23 |
| Consent before any data goes to the AI provider; server refuses without it | `ai-consent-card.tsx`; `ai-coach.ts:469-470, 659-660` | A24 |
| No tracking or advertising SDK; `NSPrivacyTracking` false | `package.json`; `PrivacyInfo.xcprivacy` | A25 |
| HealthKit / Health Connect read-only; unused Android permissions removed | `Info.plist:73-76`; `AndroidManifest.xml` | A26, G7 |
| Android target API 36 | `android/variables.gradle` | G10 |
| Background location only while recording | Run recorder | A31, G12 |
| "You're chatting with an AI" disclosure in the coach | `coach-chat.tsx:643-650` | A33 |

## 2. Fixed on this branch

| Item | Change | Row |
|---|---|---|
| Health-platform data and the AI provider | Imported steps and watch-recorded sleep, heart rate, HRV and breathing go to the AI provider only with a separate, default-off permission; the device name is never sent. Tests in `tests/integration/health-ai-sharing.test.ts` | A24, A26, G7 |
| AI consent card | States that health-platform data is not sent unless separately allowed | A24 |
| Public web page for account deletion requests | `src/app/legal/delete-account/page.tsx`, linked from the legal links | G4 |
| Statements that contradicted the code | 46 corrections (`docs/legal-audit-2026-11-16/21_STATEMENT_CORRECTIONS_APPLIED.md`), including "Never shared", "always free" and "Free forever", Body Scan and progress-photo storage | 2.3, A5, A21 |
| Cancellation wording | Deleting the account cancels a website subscription; removing the app cancels nothing | A17 |
| Notices and licences | Complete third-party notices file linked from the Notices page | A28 |
| Offline behaviour | Service worker installs again (separate branch `claude/rc-offline-fix`) | A19 (native value) |
| Privacy Policy and Terms drafts | Factual descriptions corrected; still drafts with placeholders | A21 |

## 3. Needs a physical device

| Item | Row |
|---|---|
| Purchase, restore, cancel, refund and expiry in the store sandbox | A7, A11, A12, A14, A15, G1, G2 |
| Health permission prompts and their purpose strings; read-only access; disconnecting | A22, A26, G7 |
| Background location while recording; the lock screen | A31, G12 |
| Notifications, camera and photo permissions | A32, G13 |
| That the native app offers enough beyond a website (reviewer's judgment) | A19 |
| Account deletion from inside the native app | A23 |

## 4. Needs App Store Connect or Google Play Console (owner)

| Task | Row |
|---|---|
| Create the subscription products ($17.99 monthly, $119.99 yearly) and the subscription group | A7, G1 |
| Paid apps agreement, tax and banking | A7 |
| App privacy "nutrition label" (health, fitness, location, photos, contact info, user content, usage data) | A29 |
| Google Play Data safety form | G5 |
| Health apps declaration and Health Connect permission justifications | G6, G7 |
| Background location declaration | G12 |
| Age rating questionnaires (religious content, medical/treatment information, user-generated content when Friends is on, AI chat) | A9, G11 |
| Support URL, marketing URL, privacy policy URL; account-deletion URL on Google Play (`/legal/delete-account`) | A30, A21, G4 |
| Reviewer demo account and review notes (describe AI, health data, subscriptions) | A6, A8 |
| Store listing text and screenshots; no third-party marks in metadata | A8, A10 |
| Export compliance answer | A34 |
| Exact-alarm permission declaration if used | G14 |
| Closed-testing requirement for a new personal Google Play account (unverified) | G16 |

## 5. Needs an operational process (owner)

| Item | Row |
|---|---|
| A support mailbox that is answered, and the address shown in the app | A4, A30 |
| Moderation: who reviews reports, how fast, what action is taken (before Friends is switched on). Draft policy: `docs/legal/MODERATION_AND_USER_CONTENT_POLICY_DRAFT.md` | A2, A3, G8 |
| An always-available way to report an AI reply (exists behind the `coach_feedback` flag, which is off) | A33, G9 |

## 6. Needs counsel

| Item | Row |
|---|---|
| Final Privacy Policy and Terms (placeholders and attorney notes remain) | A6, A21, G3 |
| Health and medical accuracy wording; general-wellness position | A5, G6 |
| Generative-AI responsibilities and disclosures | A33, G9 |
| Intellectual property: trademark search; third-party names in the app | A10, A28, G15 |
| Children: the age gate is a checkbox plus a stated age | A27, G11 |
| Whether Apple's legal-entity expectation in 5.1.1(ix) applies to this app before public release | A27 |

## Open gaps that block public release

A4/A30 (no contact), A6/A21 (placeholder legal pages), A7 (no store products), A8/A9/A29 and G5/G6 (console
declarations not done), the device tests in section 3, and, if Friends is ever switched on, A1–A3 and G8.
