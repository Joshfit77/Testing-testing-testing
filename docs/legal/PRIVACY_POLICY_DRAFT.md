# Narrow Gate Fitness — Privacy Policy (DRAFT)

Version: [DRAFT 2026-10-26]
Effective date: [EFFECTIVE DATE — set when published] · Last updated: [DATE]

> **DRAFT FOR ATTORNEY REVIEW — NOT LEGAL ADVICE AND NOT IN FORCE.** This draft was prepared from a read-only review of the code on branch `claude/free-pro-membership` (2026-10-26) for review by a qualified privacy attorney. It does not state or imply that the service complies with any law. Retention periods are marked **[OWNER TO DECIDE]**; none has been decided. Verify every factual statement against the shipped build before publishing. Remove this box and all bracketed notes before publication.

---

## 1. Who we are

This Privacy Policy explains how [LEGAL ENTITY NAME] ("**we**," "**us**") collects, uses, shares and protects personal information when you use the Narrow Gate Fitness website and iOS/Android apps (the "**Service**"). We are the business or controller responsible for your information.

- Privacy contact: [PRIVACY EMAIL]
- Postal address: [POSTAL ADDRESS]
- [Toll-free number, if required — ATTORNEY REVIEW: CCPA §1798.130(a)(1) requires two methods for submitting requests, and online-only businesses that have a direct relationship with consumers may use an email address alone. Confirm before relying on this.]

**The short version:**
- We use your information to run the Service for you.
- We do **not** sell your personal information.
- We do **not** share it for targeted advertising, and the app contains no advertising or analytics trackers.
- Health data from Apple Health or Health Connect is never used for advertising and never sold.
- We send data to our AI provider **only after you allow it**.
- Body Scan photos, progress photos and unshared prayer-journal entries are **never** sent to AI.
- You can export or delete your data in the app at any time.

## 2. Information we collect

### 2.1 Information you give us

| Category | Examples | Required? |
|---|---|---|
| Account | email address, display name, password (stored only as a hash by our authentication provider), optional avatar | Email, name and password are required |
| Age confirmation and training profile | age (to confirm you are 18+ and to estimate calorie needs); sex (male / female / not specified, used for calorie estimates); height; weight; goals; experience; equipment; schedule; diet style; food preferences, allergies and dislikes; units; time zone | Age is required; the rest improves the estimates |
| Activity logs | workouts, sets, personal records, programs, templates, manual runs and walks, steps you enter | Optional |
| Nutrition | food diary, water, saved meals, recipes, meal plans, grocery lists, supplements, food filters | Optional |
| Body measurements | bodyweight, tape measurements | Optional |
| **Sensitive wellness information** | physical-limitation notes, recovery check-ins, sleep entries and sleep check-ins | Optional, **only after you give explicit wellness consent** |
| **Photos** | progress photos; Body Scan photos (front/side/optional rear) with optional measurements; meal photos you submit for a calorie estimate | Optional |
| **Faith content** | whether you turn on faith features; devotional and 40-day-challenge progress; reminders; **prayer-journal entries** | Optional |
| AI interactions | messages to the AI Coach, coaching memories you choose to save, AI meal-plan requests and drafts | Optional (Pro) |
| Support and legal communications | messages you send us, requests to exercise your rights | Optional |

### 2.2 Information from your device, with your permission

- **Precise location (GPS) — Pro, optional.** Location is read **only while a run or walk recording you started is running**, including while your phone is locked if you allow background location. The app stores a simplified route of up to 2,000 points, plus distance, pace, splits and a GPS-quality summary. Location is not read at any other time. While a recording is in progress, unsaved fixes are kept on your device, and they are cleared when you sign out. **Deleting a run removes its route.** Routes are drawn on screen from your own points. No third-party map service receives them.
- **Apple Health (iPhone) / Health Connect (Android) — optional.** The app reads only the types you allow, and only after you give wellness consent for sleep data:
  - daily **steps**;
  - **sleep** records (time in bed, asleep, awake, and stages where your watch or ring recorded them);
  - overnight **heart rate, heart-rate variability and respiratory rate**, summarized per night;
  - the name of the source device.

  **We only read; we never write** to Apple Health or Health Connect.
- **Camera.** Used only when you scan a barcode or take a photo. On Android, barcode scanning uses Google's on-device ML Kit library. [ATTORNEY REVIEW: confirm whether ML Kit sends any usage or diagnostic data to Google under its current terms.]
- **Local notifications.** Reminders, including the sleep alarm, are scheduled on your device.
- **Local storage.** The device keeps drafts, an unfinished GPS recording and display preferences. These are cleared on sign-out.

### 2.3 Information from third parties

- **Payment status.** We receive subscription status, plan, product, renewal dates, and refund or billing-issue flags from:
  - **Stripe**, for website purchases;
  - **RevenueCat**, which relays Apple App Store and Google Play purchases.

  **We never receive or store your full card number.**
- **Food data.** We receive product and nutrient information from **Open Food Facts** and **USDA FoodData Central** in response to your barcode scans and searches.

### 2.4 Technical information

- Our servers and hosting provider process technical data such as IP address, request times and error information in order to deliver and secure the Service.
- Our application logs record error names, codes and internal IDs. They are designed not to contain your email, health values, journal text or passwords.
- **We do not use advertising identifiers, cross-app tracking, or third-party analytics or crash-reporting SDKs.** [OWNER: keep this true. If any analytics are added, this Policy, the App Store privacy label and the Google Play Data safety form must all change first.]

## 3. How we use information

| Purpose | Information used |
|---|---|
| Provide the Service: logging, programs, calendars, progress, badges, nutrition tools, sleep features, GPS recording, Body Scan, faith features | The relevant category you provide |
| Calculate estimates (calorie and macro targets, readiness, sleep scores, strength ranks) | Profile, logs, sleep and health-platform data |
| AI features (Pro, after consent) | See Section 5 |
| Process subscriptions, prevent duplicate purchases, enforce plan limits and AI allowances | Account ID, email (Stripe), purchase status, AI usage counts (model and token counts) |
| Security, abuse prevention and rate limiting | Account ID, technical data |
| Customer support and legal requests | Contact details and the request |
| Comply with law and enforce our Terms | As needed |

**We do not:**
- sell personal information;
- share it for cross-context behavioral or targeted advertising;
- use health, location, photo or faith data for marketing or advertising;
- use your data to train AI models;
- make decisions with legal or similarly significant effects about you based solely on automated processing.

[ATTORNEY REVIEW: confirm the "no training" statement against Anthropic's current Commercial Terms and DPA. As accessed 2026-10-26, the Commercial Terms effective June 17, 2025 state that Anthropic "may not train models on Customer Content from Services."]

## 4. Sensitive information and how we ask for consent

Several categories we handle are treated as "sensitive" under various U.S. state laws. These include health and consumer-health data, precise geolocation, religious beliefs and, in some states, photos or images. We handle them as follows:

| Sensitive data | How we obtain consent or permission (as implemented in the app) | How to withdraw |
|---|---|---|
| Physical-limitation notes, recovery check-ins, sleep data (including Apple Health / Health Connect sleep) | **Wellness consent** screen. The database refuses to store this data without it | Profile → Privacy & data. Withdrawing deletes limitation notes and recovery check-ins. Sleep entries are deleted separately under Sleep & Recovery → Goal & privacy ("delete imported" or "delete all") |
| Apple Health / Health Connect access | The operating system's per-type permission prompt | Device settings |
| Precise location | The operating system's location permission. Location is used only during a recording you start | Device settings; delete runs |
| Body Scan photos and measurements | **Separate Body Scan consent** card, recorded with a timestamp. The database refuses uploads without it | "Withdraw consent and delete all scans" |
| Progress photos | You choose to upload. A privacy notice is shown in the upload dialog [ATTORNEY REVIEW: no separate consent gate exists in code; decide whether one is needed] | Delete each photo |
| Meal photos sent to AI | **Separate meal-photo consent**, in addition to AI consent. Photos are not stored by us | Profile → Privacy & data |
| Sharing data with AI (including a sleep summary and health-platform vitals) | **AI consent** card listing each category, before any data is sent | Profile → Privacy & data (turns AI off) |
| Faith interest and prayer-journal entries | You choose to turn on faith features and write entries. An entry goes to AI only if you mark that entry "Share with AI Coach" | Turn faith features off; delete entries |

[ATTORNEY REVIEW: religious beliefs are "sensitive data" under, among others, Va. Code §59.1-575, Colo. Rev. Stat. §6-1-1303(24), Conn. Gen. Stat. §42-515, and Tex. Bus. & Com. Code §541.001. They are "sensitive personal information" under Cal. Civ. Code §1798.140(ae). Where those laws apply, they require opt-in consent (or, under the CCPA, a right to limit). Turning on faith features is an affirmative act, but it is not presented as consent to process religious data. Decide whether a short explicit notice or consent is needed when faith features are turned on. Similarly, assess whether Washington's My Health My Data Act (RCW 19.373) and Nevada SB 370 (NRS ch. 603A) require separate consent for *collection* and *sharing* of consumer health data. Those laws have no revenue thresholds, and their definitions are broad enough to cover fitness, sleep, bodyweight and limitation data.]

## 5. AI features: what is sent and to whom

Our AI features are powered by **Anthropic** (Claude). Before any data is sent, you see a consent card that lists the categories and the "Allow and continue" button. Depending on the feature you use, we send Anthropic:
- **AI Coach:**
  - your goals, schedule, equipment and basic details (age, height, sex, units);
  - your current program, recent workouts and personal records;
  - your food log, nutrition targets and supplements;
  - bodyweight, steps and the recovery check-in score;
  - limitation notes, only if you gave wellness consent;
  - journal entries you marked "Share with AI Coach";
  - coaching memories, if memory is on;
  - recent conversation history.
- **When you ask about sleep or recovery:** a sleep **summary**, which can include data imported from Apple Health or Health Connect: time asleep, stage shares, and overnight heart rate, heart-rate variability and breathing rate for recent nights, plus the device name.
- **AI meal plans:** your targets, planner settings (diet, budget, allergies, dislikes), your notes and the list of eligible dishes.
- **Meal photos (separate consent):** the photo, for that request only. **We do not store meal photos.**
- **"Ask AI about this food":** the product's Open Food Facts data, together with your goal, diet style, daily targets and food filters.

**Never sent to AI:**
- progress photos;
- Body Scan photos;
- unshared journal entries;
- free-text sleep and recovery notes;
- your email address;
- payment data.

Anthropic processes this data as our service provider, under its commercial terms and data processing addendum. [ATTORNEY REVIEW: state Anthropic's retention period for API inputs and outputs, and whether any zero-data-retention arrangement applies. Confirm the DPA covers U.S. state-law service-provider and processor terms.] Your AI conversations are stored in your account until you delete them or your account.

## 6. Who we share information with

We share personal information only with the service providers and processors below, acting on our instructions, and as required by law. [ATTORNEY REVIEW: execute or confirm a data processing agreement with each.]

| Recipient | What they receive | Why |
|---|---|---|
| **Supabase** | All account data, logs, photos (private storage buckets), AI conversations, billing status | Database, authentication, file storage. Authentication emails are sent through [EMAIL DELIVERY PROVIDER — OWNER TO CONFIRM; no production SMTP is configured in the repository] |
| **[HOSTING PROVIDER — OWNER TO CONFIRM, e.g. Vercel]** | All requests passing through the web app server; technical data; server logs | Hosting |
| **Anthropic** | The AI inputs described in Section 5, only after consent | AI responses |
| **Stripe** | Email address, account ID, subscription details. Stripe collects your payment details directly | Website payments |
| **RevenueCat** | Account ID (used as the RevenueCat user ID); App Store / Google Play purchase records | In-app subscription status |
| **Apple / Google** | Purchase and payment information (handled by the store). Health data stays on your device's health platform until the app reads it | In-app purchases; health platforms |
| **Open Food Facts** | Barcode numbers, requested from our server (not your device) | Product lookups |
| **USDA FoodData Central** | Food search text, requested from our server | Food search |
| Professional advisers, authorities, successors | As needed | Legal advice; legal compliance; a merger or sale (with notice to you) |

We require our service providers to protect personal information in a way consistent with this Policy.

## 7. How long we keep information

[OWNER TO DECIDE all periods below; do not publish until decided. Apple Guideline 5.1.1(i) requires the policy to explain retention and deletion.]

| Data | Current behavior in the app | Retention period to state |
|---|---|---|
| Account and logs | Kept while your account exists; deleted when you delete the account | [OWNER TO DECIDE — e.g. "until you delete it or your account"] |
| Deleted runs | The route is removed immediately. The row keeps distance and time for totals until account deletion | [OWNER TO DECIDE whether to purge soft-deleted rows after N days] |
| AI conversations and memories | Until you delete them or your account | [OWNER TO DECIDE] |
| AI usage counts (model, tokens) | Until account deletion | [OWNER TO DECIDE] |
| Meal photos | Not stored by us | Provider retention: [ATTORNEY REVIEW] |
| Photos and Body Scans | Until you delete them, withdraw consent, or delete your account | [OWNER TO DECIDE] |
| Billing records and webhook event IDs | Event IDs are kept; other billing rows are deleted with the account. Stripe and RevenueCat customer records are deleted on account deletion, on a best-effort basis | [OWNER TO DECIDE; tax and accounting records may need to be kept for a legally required period — ATTORNEY REVIEW] |
| Server and error logs | Held by the hosting provider | [OWNER TO DECIDE / confirm with provider] |
| Backups | Held by the database provider | [OWNER TO DECIDE / confirm with provider] |
| Consent records (timestamps) | Kept on your profile | [OWNER TO DECIDE — California ARL requires keeping verification of auto-renewal consent for 3 years or 1 year after the contract ends, whichever is longer — ATTORNEY REVIEW] |

## 8. Your choices and rights

**For everyone, in the app:**
- **Access / export:** Profile → Privacy & data → **Export**. This downloads your data as a JSON file, with time-limited links to your photos (limited to 3 exports per hour).
- **Delete your account:** Profile → Privacy & data → **Delete account**. You confirm by typing DELETE and re-entering your password. Then:
  1. Website subscriptions are cancelled. If that fails, nothing is deleted.
  2. Your photos are removed from storage.
  3. Your account and all linked data are deleted.
  4. Your Stripe and RevenueCat customer records are deleted.

  **We cannot cancel App Store or Google Play subscriptions.** Cancel those in your store account to stop charges.
- **Correct:** edit your profile and logs at any time.
- **Withdraw consent:** wellness data, AI sharing, meal photos, Body Scan, coaching memory, and Apple Health / Health Connect access (in device settings).
- **Delete specific items:** runs, photos, scans, journal entries, conversations, memories, imported sleep.

**State privacy rights.** Depending on where you live, you may have the right to:
- know or access the personal information we hold about you, and obtain a portable copy;
- correct it;
- delete it;
- opt out of sale, sharing or targeted advertising (we do none);
- limit or withdraw consent to the use of sensitive data;
- appeal our decision on your request;
- not be discriminated against for exercising these rights.

To make a request that the in-app tools don't cover, email [PRIVACY EMAIL]. We will verify your identity, usually by confirming control of your account email, and respond within [45 days — ATTORNEY REVIEW: confirm the statutory periods and any extension]. You may use an authorized agent where the law allows. If we deny your request, you may appeal by replying to our decision. If the appeal is denied, you may contact your state attorney general.

[ATTORNEY REVIEW: the CCPA/CPRA applies only to businesses that meet a threshold: annual gross revenue over $26,625,000 (CPPA CPI adjustment effective Jan. 1, 2025), buying, selling or sharing the personal information of 100,000+ consumers or households, or deriving 50%+ of revenue from selling or sharing. Most other state comprehensive laws use consumer-count thresholds; Virginia and Colorado use 100,000. **Connecticut's amendments (SB 1295, Public Act 25-113, most provisions effective July 1, 2026) reportedly apply to any controller that processes sensitive data, regardless of volume.** Texas applies to all non-"small businesses" (SBA definition). Washington MHMDA and Nevada SB 370 have no thresholds. Decide whether to extend these rights to all U.S. users as a matter of policy. This is recommended, because the in-app tools already provide most of them.]

## 9. Consumer health data (Washington, Nevada and similar laws)

[ATTORNEY REVIEW: Washington's MHMDA requires a **separate, prominently linked Consumer Health Data Privacy Policy** on the homepage (RCW 19.373.020). That policy must list the categories of consumer health data, the purposes, the sources, the categories shared and with whom, and how to exercise rights. Nevada SB 370 has similar requirements. Draft that separate policy from Sections 2–8 of this document.] In summary:
- the consumer health data we collect is listed in Sections 2.1–2.2: wellness notes, sleep and health-platform data, bodyweight and measurements, fitness logs, limitation notes and, where applicable, photos;
- we collect it to provide the features you request;
- we share it only with the processors in Section 6;
- we do not sell it;
- we do not use geofencing.

## 10. Children

The Service is for adults **18 and older**. Sign-up requires you to confirm you are 18+, and onboarding rejects ages under 18. The AI Coach is instructed not to coach anyone who says they are under 18. We do not knowingly collect personal information from children under 13, or from anyone under 18. If we learn that we have, we will delete it. Contact [PRIVACY EMAIL].

## 11. Security

Our safeguards include:
- encryption in transit (HTTPS);
- row-level access controls, so each member can reach only their own records;
- private storage with short-lived signed links for photos;
- removal of location metadata from photos on your device before upload;
- password re-verification for account deletion;
- rate limits;
- no administrator access path to journals, photos or health records.

No system is perfectly secure. Keep your password confidential. [ATTORNEY REVIEW: avoid absolute security claims; FTC Act §5 treats inaccurate security representations as deceptive.]

## 12. Data breaches

If a security incident affects your personal information, we will investigate. We will notify you, regulators and others as required by law. This includes, where applicable, the **FTC Health Breach Notification Rule (16 C.F.R. Part 318)**, under which an unauthorized disclosure of identifiable health information, not only a hack, can count as a breach. It also includes state breach-notification laws. [ATTORNEY REVIEW: adopt a written incident-response procedure. Under 16 C.F.R. §318.4, individual notice must be given without unreasonable delay and no later than 60 calendar days after discovery. Confirm the current timing for notice to the FTC for breaches involving 500 or more people. Sources conflict on whether that notice is due at the same time as individual notice or within 10 business days.]

## 13. Where data is processed

We are based in the United States. Our providers process data in [REGIONS — OWNER TO CONFIRM Supabase project region, hosting region, and Anthropic processing locations]. [ATTORNEY REVIEW: if the Service is offered outside the U.S., add GDPR / UK GDPR sections, a legal basis for each purpose, and transfer mechanisms; otherwise state that the Service is intended for U.S. users.]

## 14. App store disclosures

- **Apple HealthKit:** HealthKit data is used only to provide the features you request. It is not used for advertising, marketing or data mining, is not sold, and is shared with a third party (our AI provider) only as described in Section 5, with your permission. We do not store HealthKit data in iCloud.
- **Google Health Connect:** the same commitments apply. We read only the data types listed in Section 2.2.

Our App Store privacy label and Google Play Data safety form describe the same data as this Policy.

## 15. Changes to this Policy

We will post updates here and change the "Last updated" date. For material changes, we will notify you in the app or by email before the change takes effect. For any new use of sensitive data, we will ask for your consent where the law requires it.

## 16. Contact

[LEGAL ENTITY NAME] · [POSTAL ADDRESS] · [PRIVACY EMAIL]
