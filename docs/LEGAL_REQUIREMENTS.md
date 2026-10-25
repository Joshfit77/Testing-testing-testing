# What the final Privacy Policy and Terms must cover

**This is not legal advice and not a policy.** It is a factual inventory of what the app does, compiled from the code on 2026-10-22 and corrected on 2026-10-25 (GPS runs, Apple Health sleep data, Body Scan and meal photos had been added since), for the owner's lawyer to write the final documents from. The verified data-flow inventory is in `docs/launch-audit/SECURITY_PRIVACY.md`.

- The in-app pages at `/legal/privacy` and `/legal/terms` are **drafts**. Each page says "Placeholder — requires legal review", and search engines are told not to index them.
- No document here has received legal approval.
- When the final documents exist, set `LEGAL_TERMS_URL` and `LEGAL_PRIVACY_URL`, or replace the drafts' text and remove the placeholder banner. The App Store paywall then links them without the "drafts" note.

## Decisions counsel and the owner need to make first

1. **Legal entity and contact:** who the "we" is, postal address, privacy contact email, and (if serving the EU/UK) representative details.
2. **Where it's offered:** US only, or also EU/UK/Canada/Australia. This changes GDPR/UK GDPR, consumer cancellation rights and age rules.
3. **Age:** the app requires 18+ at onboarding. Confirm the minimum age, and that the app isn't directed at children (COPPA).
4. **Governing law, dispute resolution, arbitration/class-action terms**, if any.
5. **Refund policy for web (Stripe) purchases.** App Store and Google Play refunds follow the stores' own policies.
6. **End-user licence:** Apple's standard EULA, or a custom EULA uploaded to App Store Connect.

## Privacy Policy: facts it must state

### Data collected (all tied to the account)

- **Account:**
  - email, display name, password (stored by Supabase Auth as a hash);
  - optional avatar.
- **Training profile:**
  - age, sex (male / female / not specified, for calorie estimates), height, weight;
  - goals, experience, equipment, schedule, diet style and preferences, units, timezone.
- **Activity logs:**
  - workouts, sets, personal records;
  - runs and walks: entered by hand, from a treadmill, or **recorded live with GPS** (`activities.route`: a simplified route of up to 2,000 points, distance, pace, splits and a GPS-quality summary, stored in the member's account and visible only to them). Location is read only during a recording the member started, including while the phone is locked (`UIBackgroundModes: location`); it is never read otherwise and never shared;
  - bodyweight, body measurements;
  - food diary, water, saved meals, recipes, meal plans, grocery lists, supplements.
- **Progress photos and Body Scan photos (Pro):** optional; stored in private storage visible only to the member (`progress-photos` and `body-scans` buckets, signed URLs). Body Scan also stores optional tape measurements. No photo is analysed by AI and no body-fat estimate is made.
- **Meal photos (AI estimate):** a photo the member chooses to send for a calorie estimate is sent to Anthropic for that request and is not stored by the app (`src/server/services/food-photo.ts`).
- **Health data:**
  - Apple Health / Health Connect, read only after the member allows each type on the device: **step counts**; **sleep records** (time in bed, asleep, awake, and sleep stages where a watch or ring wrote them) and **overnight heart rate, heart-rate variability and respiratory rate** summarised per night (`sleep_sessions`, `sleep_stages`, the `vitals` column). The app never writes to Apple Health.
  - The App Store requires stating that HealthKit data isn't used for advertising, isn't sold, and is shared with third parties only for the member's own health/fitness purpose with their permission: the AI coach's `get_sleep_summary` tool sends a **summary** of the member's sleep (averages, stages shares, overnight heart rate/HRV/breathing for recent nights, device name) to Anthropic when the member asks about sleep or recovery, and only after AI consent. State this plainly.
- **Sensitive wellness data:**
  - physical limitation notes and recovery check-ins;
  - stored only after **explicit consent**, which can be withdrawn (this deletes them).
- **Faith content:** prayer journal entries (private; administrators can't read them), devotional and challenge progress.
- **AI coach:**
  - conversations, plus the parts of the member's data the coach uses: profile, recent training, nutrition targets, bodyweight, steps, supplements, recovery check-in score, limitations if consented, a sleep summary when asked about sleep (see Health data), and prayer-journal entries only when the member chose "Share with AI Coach" for that entry.
  - AI meal plans (Pro) send targets, diet, allergies, dislikes, sex and latest weight; "Ask AI about this food" sends the product's facts and the member's targets and goal.
  - These are sent to **Anthropic** only after the member taps "Allow and continue" (App Store 5.1.2(i)); this can be withdrawn in Profile → Privacy & data.
  - Usage counts (model, tokens) are stored for monthly limits.
- **Purchases:**
  - subscription status, plan and renewal dates;
  - from Stripe (web) or from Apple/Google through RevenueCat (in-app), keyed by account id.
  - No card numbers are stored by the app.
- **Barcode and food searches:** sent to Open Food Facts and USDA FoodData Central (query text or barcode only).
- **Device and technical data:**
  - reminders and notifications are scheduled on the device (local notifications);
  - server logs (errors) — counsel to confirm retention with the hosting provider.
- **Not collected:** contacts, advertising identifiers, background location outside a recording.
- **Tracking:** there are no third-party advertising or analytics SDKs in the code (confirm none are added before launch; affects App Tracking Transparency and the privacy label).

### Processors / third parties to list (each needs a data processing agreement checked)

| Provider | Purpose |
|---|---|
| Supabase | database, authentication, file storage |
| Hosting provider (e.g. Vercel; confirm) | runs the website and app server |
| Stripe | web subscriptions |
| RevenueCat | in-app subscription status |
| Apple and Google | in-app purchases, Health data on device |
| Anthropic | AI coach responses (no training on API data by default; counsel to confirm current terms) |
| Open Food Facts, USDA FoodData Central | food lookups (Open Food Facts data is ODbL-licensed: the product page links each product's source page) |
| Email delivery used by Supabase Auth | confirm which |

### Rights and controls the app already provides (describe them)

- **Export:** Profile → Privacy & data exports all of the member's data (JSON).
- **Deletion:** account deletion cancels web subscriptions and deletes all data, files and the Stripe and RevenueCat customer records. App Store / Google Play subscriptions must be cancelled by the member (the app warns them).
- **Withdrawal:** withdrawing wellness consent deletes that data. AI data sharing can be switched off.
- **Correction:** members can edit all profile data.
- **Still to define:** retention periods (e.g. how long server logs and processed-webhook ids are kept); data breach notification; international transfers (US servers?); the "sale/sharing" disclosure for CCPA/CPRA (likely "we don't sell"); response times for requests.

### App Store / Google Play items that must match the policy

- **App Store privacy "nutrition label"** and Google Play **Data safety** form: health & fitness, contact info, user content, purchases, identifiers (user ID).
- A privacy policy link in App Store Connect, Play Console and **inside the app** (5.1.1(i)).
- The HealthKit use statement and the AI data-sharing disclosure (5.1.2(i)).

## Terms: what they must cover

- **Eligibility:** 18+ and account responsibilities.
- **Health and safety disclaimer:**
  - not medical advice;
  - consult a professional; stop if pain.
  - AI coach answers are general information, may be wrong, and suggested changes apply only when the member confirms them.
  - Calorie and photo-free food estimates are approximate.
- **Subscriptions:**
  - Free / Plus $11.99 per month / Pro $24.99 per month;
  - yearly Plus $99.99 / Pro $249.99 when offered;
  - auto-renewal, cancellation, access until the end of the paid period;
  - price changes with notice;
  - what each plan includes, and the AI message allowance (Pro 150 per month).
- **Web purchases:** Stripe billing portal, refund policy (to decide), applicable consumer cancellation rights.
- **App Store / Google Play purchases:**
  - billed by Apple/Google;
  - managed and cancelled in the store account;
  - refunds through Apple/Google;
  - the Apple-required EULA terms (Apple is not responsible for the app, etc.) if a custom EULA is used.
- **Existing subscribers:** the grandfathered AI allowance (`docs/MEMBERSHIPS.md`). Counsel to decide whether the terms or a notice should describe it, and how it can end.
- **Acceptable use:** no misuse of the AI coach, no unlawful content in journals, account sharing.
- **Content and IP:**
  - the member owns their logs and journal entries;
  - licence for the app to store and process them;
  - Scripture attribution (Berean Standard Bible, public domain; notice already shown);
  - exercise images and badge artwork ownership.
- **Third-party services** (food databases, Apple Health, AI provider), and their limits.
- **Termination,** account deletion, limitation of liability, indemnity, changes to the terms, contact.

## Before launch (owner checklist)

- [ ] Counsel drafts and approves both documents (and the EULA choice).
- [ ] Publish them at stable URLs and set `LEGAL_TERMS_URL` / `LEGAL_PRIVACY_URL` (or replace the in-app drafts and remove the placeholder banner).
- [ ] Fill in the App Store privacy label and Google Play Data safety form to match.
- [ ] Add the privacy policy URL (and EULA, if custom) in App Store Connect and Play Console.
