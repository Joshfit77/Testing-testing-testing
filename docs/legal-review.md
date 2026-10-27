# Legal documents review notes

Companion to `src/app/legal/privacy/page.tsx` and `src/app/legal/terms/page.tsx`. This file records what the documents are based on, what
still has to be supplied before publication, and a checklist for Apple's App Privacy questionnaire. It reflects the code as audited; re-check it whenever data
collection, providers or SDKs change.

## Before publishing

1. Fill in the shared business details in `src/app/legal/legal-details.ts` (used by both documents):
   - `operatorLegalName`: the legal entity that operates Narrow Gate Fitness.
   - `contactEmail`: contact email address for privacy, legal and support questions.
   - `postalAddress`: postal address for legal correspondence.
   - `governingLaw`: the jurisdiction whose law governs the Terms.

   Then fill in `src/app/legal/privacy/policy-config.ts`:
   - `effectiveDate`: the date the policy takes effect.
   - `providerProtectionConfirmed`: set to `true` only after confirming data processing agreements, or equivalent terms, with each
     provider named in the policy. Apple Guideline 5.1.1(i) requires the policy to confirm that providers protect data to the same
     standard.
   - `legalReviewComplete`: set to `true` after counsel has reviewed the final text.

   And `src/app/legal/terms/terms-config.ts`:
   - `effectiveDate`: the date the terms take effect.
   - `legalReviewComplete`: set to `true` after counsel has reviewed the final text.

   When every field for a document is set, that page drops "(Draft)" from its title, removes the review banner and `noindex`, and shows the contact details.
2. Confirm that production is hosted on Vercel. This comes from `SETUP.md`; the code itself doesn't name a host.
3. Resolve or accept the open findings below, especially the AI coach consent requirement.
4. Publish at `https://<production domain>/legal/privacy` and enter that URL in App Store Connect and Google Play. The repo has no production
   domain: `capacitor.config.ts` uses the placeholder `app.narrowgatefitness.example`, and `NEXT_PUBLIC_SITE_URL` defaults to localhost.
5. Keep `ios/App/App/PrivacyInfo.xcprivacy` and the App Store Connect answers consistent with the policy (see below).

## Third-party services (verified in code)

| Service | Where | What it receives |
| --- | --- | --- |
| Supabase | `src/lib/supabase/*`, migrations | All stored account and user data, progress photos, auth (email, password, session) |
| Stripe | `src/server/services/billing.ts` | Email address and user ID (customer metadata), payment details entered in Checkout; webhooks return subscription status |
| Anthropic | `src/server/services/ai-coach.ts` | User message, up to 20 prior messages, an athlete-context summary (see policy), limitation notes only with wellness consent; no email, name, sex, height, photos, measurements, meals or faith content |
| USDA FoodData Central | `src/server/services/food-database.ts` | Search text, sent server-side with the app's API key; no user identifiers |
| Open Food Facts | `src/server/services/open-food-facts.ts` | Barcode numbers, sent server-side; no user identifiers. The offline edition (`standalone/index.html`) calls it directly from the device |
| Vercel | `SETUP.md` only | Hosting: all requests, IP addresses |
| YouTube (nocookie) / Vimeo | `src/lib/media.ts`, exercise pages | Viewer IP and device data when an embedded demo video loads (only if admins add such media) |
| Google Fonts | `standalone/index.html` only | Device IP when the offline edition loads fonts. The main app self-hosts fonts via `next/font` |

No analytics, advertising, crash-reporting or attribution SDKs were found. The iOS privacy manifest declares `NSPrivacyTracking = false`.

## Apple App Privacy questionnaire checklist

"Collected" means the data leaves the device and is kept longer than needed to answer the request. Data sent to Anthropic counts. Check
each item yourself; the ones marked **Decide** depend on how you read Apple's definitions.

| Apple data type | Collected? | Source in app | Linked to user | Tracking | Purposes |
| --- | --- | --- | --- | --- | --- |
| Contact Info → Email Address | Yes | Sign-up, auth emails, Stripe customer | Yes | No | App Functionality |
| Contact Info → Name | Yes | Display name | Yes | No | App Functionality |
| Health & Fitness → Fitness | Yes | Workouts, sets, PRs, programs | Yes | No | App Functionality, Product Personalization (starter program, AI coach) |
| Health & Fitness → Health | Yes | Recovery check-ins, limitation notes (consented), bodyweight, measurements, body-fat %; **Decide** whether height, weight and calorie estimates belong here | Yes | No | App Functionality, Product Personalization |
| User Content → Photos or Videos | Yes | Progress photos | Yes | No | App Functionality |
| User Content → Other User Content | Yes | AI coach messages, faith journal, workout and meal notes, challenge notes | Yes | No | App Functionality, Product Personalization |
| Purchases → Purchase History | Yes | Subscription plan and status (purchases happen on the web; native checkout is blocked) | Yes | No | App Functionality |
| Identifiers → User ID | Yes | Supabase account ID (also sent to Stripe) | Yes | No | App Functionality |
| Sensitive Info | **Decide** | Faith features may reveal religious beliefs; limitation notes may reveal disability | Yes | No | App Functionality |
| Other Data | **Decide** | Age (birth year), sex, diet style and preferences, time zone | Yes | No | App Functionality, Product Personalization |
| Usage Data → Product Interaction | **Decide** | `ai_usage_events` (per-request token counts used for quotas) | Yes | No | App Functionality |
| Search History | **Decide** | Food search text goes to USDA but isn't stored by the app; logged foods are stored | — | No | App Functionality |
| Diagnostics | Probably no | Server error logs exclude user data (`src/server/log.ts`); no crash SDK. Hosting providers log requests | — | — | — |
| Location | No | Photos are re-encoded on device, which strips EXIF/GPS (`src/lib/image-compress.ts`); no location APIs | — | — | — |
| Financial Info | No (in the iOS app) | Card details are entered in Stripe Checkout on the web only | — | — | — |
| Browsing History, Contacts, Audio | No | — | — | — | — |

Tracking: none found, so App Tracking Transparency isn't needed. Re-check if analytics or ads are ever added.

Privacy manifest gap: `PrivacyInfo.xcprivacy` doesn't declare Photos or Videos, User ID, or any items you mark as Sensitive Info or Other
Data above. Update it to match your final answers.

Related guidelines (checked October 2026 at https://developer.apple.com/app-store/review/guidelines/):

- 5.1.1(i): privacy policy link required in App Store Connect and inside the app.
- 5.1.1(v): in-app account deletion. Implemented.
- 5.1.2(i): you must clearly disclose sharing with third-party AI and get explicit permission first. **Not implemented** (see finding 1).
- 5.1.3: health and fitness data may not be used for advertising or data mining. No such use was found.

## Findings: implementation vs. policy

1. **No explicit consent before AI coach data goes to Anthropic.** The coach page has no disclosure or opt-in, and the wellness-consent
   checkbox wording doesn't mention the AI provider. Apple 5.1.2(i) requires explicit permission. The policy discloses the sharing, but
   disclosure alone doesn't meet the guideline. Needs a product decision and an in-app consent step.
2. **Onboarding copy overstates admin access.** The limitations field says it is "never visible to administrators" (`src/components/onboarding/onboarding-wizard.tsx`).
   That holds for the in-app admin tools, but anyone with the service-role key or Supabase console access can read it. The policy is worded
   accurately; the onboarding copy should be aligned with it.
3. **Recovery check-in consent is enforced only in application code.** Limitation notes are also protected by a database trigger
   (`enforce_wellness_consent`); `recovery_checkins` has no equivalent.
4. **Unticking consent in preferences differs from "Withdraw consent".** Re-saving onboarding without consent clears the consent timestamp
   and limitation notes but leaves existing recovery check-ins. The Profile → Withdraw action deletes both.
5. **Withdrawal scope.** Workout skip reasons such as "pain" and free-text notes aren't covered by wellness consent, and skip reasons are
   sent to the AI coach. The policy says so; decide whether that's acceptable.
6. **Account deletion isn't atomic.** Stripe subscriptions are cancelled immediately and storage is wiped before the auth user is deleted.
   If a later step fails, earlier steps aren't reversed. The policy says this. Immediate cancellation also differs from the Terms, which
   say access continues to the end of the paid period on cancellation.
7. **Stripe customer records aren't deleted** on account deletion. The email and the `user_id` metadata remain at Stripe. The policy
   discloses this.
8. **Export gaps.** The week/day/exercise structure of custom programs isn't exported (only `training_programs` rows), and neither is
   `billing_customers` (the Stripe customer ID). The policy discloses the program gap. The Profile copy "Download everything stored for your
   account" overstates the export.
9. **No individual delete** for body measurements, recovery check-ins or goals (goals can only be archived). The policy doesn't claim
   these can be deleted individually.
10. **No consent-version record.** Only `wellness_consent_at` is stored. Acceptance of the Terms and this policy, and the age confirmation,
    are required at sign-up but not recorded.
11. **The offline edition loads Google Fonts at runtime.** Consider self-hosting the fonts so that edition makes no third-party requests
    beyond Open Food Facts.

## Questions for counsel

- Which privacy laws apply (for example GDPR/UK GDPR, CCPA/CPRA, Washington My Health My Data Act and similar consumer-health-data laws),
  and whether the policy needs legal bases, a "sale/share" statement, state-specific rights or a consumer-health-data policy.
- Whether faith content (religious beliefs) and limitation notes (possible disability or health information) need explicit consent under
  applicable law, beyond the current opt-in toggle.
- International transfers: where Supabase, Vercel, Anthropic and Stripe process data (region not recorded in the repo) and what transfer
  mechanisms are needed.
- Backup and log retention periods to state, which depend on the Supabase and Vercel plans and settings.
- Billing-record retention obligations, and whether immediate cancellation on account deletion needs a refund or proration policy.
- Whether the material-changes notice commitment ("in the app or by email before they take effect") is the right promise.
- Wording for the 18+ requirement and what to do on discovering an underage user.
- Whether the offline test edition needs its own notice if it is distributed publicly.

## Terms of Service: what is based on code vs. drafted for review

Based on the code:

- 18+ eligibility: sign-up checkbox and onboarding age check.
- Plans: Free, Plus and Pro monthly, plus Pro yearly when `STRIPE_PRICE_PRO_YEARLY` is set. Prices are configurable by environment
  variables, so the Terms point to the Plans & billing page rather than stating amounts.
- Purchases happen on the web through Stripe Checkout and are blocked in the native apps. Promotion codes are enabled.
- Cancelling through the Stripe portal keeps access until the period ends, and access continues while a payment is `past_due`
  (`src/lib/domain/plans.ts`).
- Account deletion cancels subscriptions immediately (`cancelStripeSubscriptionsForUser`). The previous draft's subscription wording didn't
  cover this.
- AI allowances reset on the first of each calendar month in UTC (`monthStartIso`). Plans proposed by the AI only apply after the user
  approves them.
- Food data sources: USDA, Open Food Facts (crowd-sourced) and curated foods. Scripture is from the KJV (`src/data/devotionals.ts`).

Drafted as standard language that counsel must confirm or replace (none of it is a fact from the code):

- **Refunds:** "non-refundable except where required by law", including unused time after account deletion. This is a business decision.
  The code has no refund logic; refunds are handled manually in the Stripe dashboard.
- **Price-change notice:** "we will tell you before the change applies to your next renewal". This is a commitment you must be able to
  keep, since there is no notification tooling in the code.
- **Limitation of liability:** cap equal to the amount paid in the prior 12 months. Also the disclaimers, the indemnity and the general
  clauses.
- **Suspension:** we may suspend or end access. There is no admin tooling to suspend a user today; it would be done directly in Supabase.
- **Acceptable-use rules:** for example, progress photos must be of you, with no explicit content.
- **Material-change notice:** given in the app or by email before changes take effect.
- **No arbitration clause or class-action waiver was added.** Ask counsel whether you want one.
- **Auto-renewal disclosure:** the automatic-renewal wording is in bold. Some US states (for example California) have specific
  auto-renewal disclosure and cancellation rules for checkout; counsel should confirm the Stripe Checkout flow complies.
- **KJV:** it is public domain except in the UK, where Crown rights apply. Check this if you distribute there.
