# Narrow Gate Fitness — Privacy Policy (DRAFT)

Version: [DRAFT 2026-10-26; factual descriptions revised 2026-11-16]
Effective date: [EFFECTIVE DATE — set when published] · Last updated: [DATE]

> **DRAFT FOR ATTORNEY REVIEW — NOT LEGAL ADVICE AND NOT IN FORCE.** This draft was prepared from a read-only review of the code on branch `claude/free-pro-membership` (2026-10-26) for review by a qualified privacy attorney. It does not state or imply that the service complies with any law. Retention periods are marked **[OWNER TO DECIDE]**; none has been decided. Verify every factual statement against the shipped build before publishing. Remove this box and all bracketed notes before publication.
>
> **Revision note, 2026-11-16.** The factual descriptions (what is collected, who receives it, what the app does) were revised against the TestFlight release candidate, using the legal audit in `docs/legal-audit-2026-11-16/` (files 05, 06, 07, 08, 09, 10 and 18). The reviser is not a lawyer. No legal wording was approved in this revision, no attorney has reviewed it, and no placeholder was filled with an invented fact. New draft provisions are marked **[DRAFT FOR ATTORNEY REVIEW]**. Everything still missing is listed in `docs/legal/REMAINING_INFORMATION_NEEDED.md`.

---

## 1. Who we are

This Privacy Policy explains how [LEGAL ENTITY NAME] ("**we**," "**us**") collects, uses, shares and protects personal information when you use the Narrow Gate Fitness website and iOS/Android apps (the "**Service**"). We are the business or controller responsible for your information.

- Privacy contact: [PRIVACY EMAIL]
- Postal address: [POSTAL ADDRESS]
- [Toll-free number, if required — ATTORNEY REVIEW: CCPA §1798.130(a)(1) requires two methods for submitting requests, and online-only businesses that have a direct relationship with consumers may use an email address alone. Confirm before relying on this.]

**The short version:**
- We use your information to run the Service for you.
- We do **not** sell your personal information.
- We do **not** share it for targeted advertising. The app contains no advertising software and no third-party analytics or crash-reporting software. We keep a small record of our own of workout events (Section 2.4).
- Health data from Apple Health or Health Connect is never used for advertising and never sold.
- We send data to our AI provider **only after you allow it**. Data imported from Apple Health or Health Connect is sent to the AI provider only if you also turn on a **separate setting that is off by default** (Section 5.3).
- Body Scan photos, progress photos, GPS routes and unshared prayer-journal entries are **never** sent to AI.
- Other members cannot see any of your information. The Friends feature is switched off (Section 16).
- You can export or delete your data in the app at any time.

## 2. Information we collect

### 2.1 Information you give us

| Category | What it includes | Required? |
|---|---|---|
| Account | email address, display name, password (stored only as a hash by our authentication provider), optional avatar image | Email, name and password are required |
| Age confirmation and training profile | age, stored as a year of birth (to confirm you are 18+ and to estimate calorie needs); sex (male / female / not specified, used for calorie estimates); height; weight; goal weight; goals; experience; activity level; equipment; schedule; diet style; food preferences, allergies and dislikes; units; time zone | Age is required; the rest improves the estimates |
| Workouts | workout sessions, exercises and sets (reps, weight, time, effort), reasons you give for skipping an exercise, notes, personal records, programs, saved workout templates, strength ranks, and the training adjustments the app suggests and your decisions on them | Optional |
| Runs and walks | runs and walks you enter by hand; recorded runs and walks (Section 2.2); running goals | Optional |
| Steps | daily step counts you type in, and your step goal | Optional |
| Nutrition | food diary, water, saved meals, favourite foods, foods you create, recipes, meal plans and planner settings, grocery lists, supplements, food filters (diet style, allergens, dislikes) | Optional |
| Food photos and label photos | a meal photo or a food-label photo you send for an estimate. **We do not store these photos** (Section 5.2) | Optional (Pro) |
| Bodyweight and measurements | bodyweight entries; waist, chest, hips, arm and thigh measurements; a body-fat percentage if you type one in; notes | Optional |
| **Sensitive wellness information** | physical-limitation notes; recovery check-ins (sleep quality, energy, soreness, stress, notes, and a readiness score the app works out); sleep entries you log or time; sleep check-ins (how rested you feel, energy, mood, stress, caffeine, alcohol, late meals, exercise timing, screens, disturbances, travel, sleep aids, notes) | Optional, **only after you give wellness consent** (Section 4) |
| **Progress photos** | photos with a date, pose, optional weight and note | Optional |
| **Body Scan photos** | front and side photos (rear optional), with optional weight, tape measurements and a note | Optional (Pro), only after Body Scan consent |
| **Faith content** | whether you turn on faith features; **prayer-journal entries**; Bible reading position and history (book, chapter, date and time); highlights, bookmarks and notes; memory verses; study progress; reading journeys and daily check-ins; discipline goals and check-ins; devotional and 40-day-challenge progress; faith reminders and daily goals; questions you ask the AI Bible study helper and its answers | Optional |
| AI interactions | messages to the AI Coach; conversation titles and history; changes the coach proposes and whether you applied them; your coach-style choice; coaching memories you choose to keep; AI meal-plan requests and drafts; weekly progress reports; counts of your AI usage (type of request, model, token counts and cost; no message content) | Optional (Pro) |
| Notification settings and device records | the reminders you choose and their times; for each phone or tablet: a device key, platform, label, time zone, whether notifications are allowed, and the time of the last sync. **We do not hold a push-notification token**: reminders are scheduled on your device | Optional |
| Habit-program data | enrollments and check-ins for habit programs | Optional |
| Legal acceptances | which version of the Terms, Privacy Policy and health-and-AI risk acknowledgment you accepted at sign-up, with a fingerprint of the text shown and the time; for a website subscription, the auto-renewal terms you agreed to with the plan, price and period. We do not record your IP address or device with these records, and the "18 or older" tick is not stored | Created when you sign up or subscribe |
| Support and legal communications | messages you send us, requests to exercise your rights | Optional |

Two more categories exist in code for features that are **switched off**: reports and other Friends data (Section 16), and feedback on AI Coach replies (a thumbs rating, an optional comment of up to 1,000 characters and a "safety concern" flag).

### 2.2 Information from your device, with your permission

- **Precise location (GPS) — Pro, optional.**
  - **When.** Location is read **only while a run or walk recording that you started is running**. If you allow background location, recording continues while your phone is locked or the app is in the background, until you stop the recording. Location is not read at any other time, and we keep no location history outside your recorded runs and walks. [ATTORNEY REVIEW / OWNER: recording with the screen locked was not verified on a physical phone, and one in-app notice (`src/app/(app)/run/page.tsx:129`) says the phone app "is being prepared" to do this. Confirm the behaviour on a device and make every notice say the same thing.]
  - **What is stored.** A simplified route of up to 2,000 points, with coordinates rounded to five decimal places (about one metre), plus start time, time zone, distance, times, pace, splits, a GPS-quality summary, effort and your notes.
  - **On your device.** While a recording is in progress, unsaved location fixes are kept on your device.
  - **Deleting.** Deleting a run removes its route, splits and GPS-quality summary at once. The rest of that entry (date, time zone, distance, time, effort and notes) stays in your account until you delete your account.
  - **Maps.** Routes are drawn on screen from your own points. By default no third-party map service receives them. [OWNER TO CONFIRM: the code can load a map background from a tile provider if one is configured (`NEXT_PUBLIC_MAP_TILE_URL`). None is configured in the repository. If one is switched on, that provider learns the area of each route viewed and must be named here first.]
  - Routes are never sent to the AI provider and are never shown to other members.
- **Apple Health (iPhone) / Health Connect (Android) — optional.** See Section 14 for the full description. The app reads only the types you allow:
  - daily **steps** (needs only the operating system's permission);
  - **sleep** records (time in bed, asleep, awake, and stages where your watch or ring recorded them), only after you give wellness consent;
  - overnight **heart rate, heart-rate variability and respiratory rate**, summarized per night, only after you give wellness consent;
  - the name of the source device.

  **We only read; we never write** to Apple Health or Health Connect. Workouts are not imported from them.
- **Camera.** Used only when you scan a barcode or take a photo. On Android, barcode scanning uses Google's on-device ML Kit library. [ATTORNEY REVIEW: confirm whether ML Kit sends any usage or diagnostic data to Google under its current terms.]
- **Local notifications.** Reminders, including the sleep alarm, are scheduled on your device.
- **Local storage.** The device keeps unsent drafts, an unfinished GPS recording and display preferences. Code exists to clear drafts on sign-out. [OWNER TO CONFIRM: whether every locally stored item is cleared on sign-out was not verified on a device.]

### 2.3 Information from third parties

- **Payment status.** We receive subscription status, plan, product, price identifier, renewal and expiry dates, cancellation, refund and billing-issue flags, and a store transaction identifier from:
  - **Stripe**, for website purchases;
  - **RevenueCat**, which relays Apple App Store and Google Play purchases.

  **We never receive or store your full card number.**
- **Food data.** We receive product and nutrient information from **Open Food Facts** in response to your barcode scans and product searches, and from **USDA FoodData Central** (Section 6).

### 2.4 Technical information, usage events and logs

- **Hosting and server data.** Our servers and hosting provider process technical data such as IP address, request times and error information in order to deliver and secure the Service.
- **Error logs.** Our application writes one log line per server error: where it happened, the error name, a code, a status and a redacted message. Some lines also carry your internal account ID or a Stripe customer ID. Logs are designed not to contain your email, health values, journal text or passwords. An optional report of errors from your browser to our own server exists and is off unless we switch it on.
- **Workout usage events (our own, not a third party's).** For each workout the database records up to four events — started, first set completed, completed, abandoned — with a time and the workout's ID. We use them for totals shown to our administrators (for example, how many workouts were started and finished). You can see your own events in your data export.
- **Sign-up and sign-in protection.** Rate limits use a hash of the IP address and of the email address.
- **We do not use advertising identifiers, cross-app tracking, or third-party analytics or crash-reporting SDKs.** [OWNER: keep this true. If any analytics are added, this Policy, the App Store privacy label and the Google Play Data safety form must all change first.]

## 3. How we use information

| Purpose | Information used |
|---|---|
| Provide the Service: logging, programs, calendars, progress, badges, nutrition tools, sleep features, GPS recording, Body Scan, faith features, reminders | The relevant category you provide |
| Calculate estimates (calorie and macro targets, readiness, sleep scores, strength ranks) | Profile, logs, sleep and health-platform data |
| AI features (Pro, after consent) | See Section 5 |
| Process subscriptions, prevent duplicate purchases, enforce plan limits and AI allowances | Account ID, email (Stripe), purchase status, AI usage counts (model and token counts) |
| Count overall use of the Service | Workout usage events (Section 2.4), in totals |
| Security, abuse prevention and rate limiting | Account ID, technical data |
| Keep a record of what you agreed to | Legal acceptances |
| Customer support and legal requests | Contact details and the request |
| Comply with law and enforce our Terms | As needed |

**We do not:**
- sell personal information;
- share it for cross-context behavioral or targeted advertising;
- use health, location, photo or faith data for marketing or advertising;
- use your data to train AI models;
- make decisions with legal or similarly significant effects about you based solely on automated processing.

[ATTORNEY REVIEW: confirm the "no training" statement against Anthropic's current Commercial Terms and DPA. As accessed 2026-10-26, the Commercial Terms effective June 17, 2025 state that Anthropic "may not train models on Customer Content from Services." The contract terms that apply to the owner's actual account are [TO BE CONFIRMED]; no contract is in the repository.]

## 4. Sensitive information and how we ask for consent

Several categories we handle are treated as "sensitive" under various U.S. state laws. These include health and consumer-health data, precise geolocation, religious beliefs and, in some states, photos or images. We handle them as follows:

| Sensitive data | How we obtain consent or permission (as implemented in the app) | How to withdraw |
|---|---|---|
| Physical-limitation notes, sleep data (including Apple Health / Health Connect sleep and overnight readings), sleep check-ins | **Wellness consent** screen. The database refuses to store limitation notes and sleep data without it | Profile → Privacy & data. Withdrawing deletes limitation notes and recovery check-ins. **Sleep entries are not deleted by withdrawing**: delete them under Sleep & Recovery → Goal & privacy ("delete imported" or "delete all") |
| Recovery check-ins | **Wellness consent**, checked by the app before saving (the database itself does not check it) | Profile → Privacy & data. Withdrawing deletes them |
| Steps from Apple Health / Health Connect | The operating system's permission prompt. No separate in-app consent | Device settings (stops new imports). The app has no control to delete imported step counts individually; they are deleted with your account |
| Apple Health / Health Connect access generally | The operating system's per-type permission prompt | Device settings |
| Precise location | The operating system's location permission. Location is used only during a recording you start. No separate in-app consent record | Device settings; delete runs |
| Body Scan photos and measurements | **Separate Body Scan consent** card, recorded with a timestamp. The database refuses scans and uploads without it | "Withdraw consent and delete all scans" |
| Progress photos | You choose to upload. A privacy notice is shown in the upload dialog [ATTORNEY REVIEW: no separate consent gate exists in code; decide whether one is needed] | Delete each photo |
| Meal and food-label photos sent to AI | **Separate food-photo consent**, in addition to AI consent. Photos are not stored by us | Profile → Privacy & data |
| Sharing data with AI | **AI consent** card listing the categories, before any data is sent | Profile → Privacy & data (turns AI features off) |
| Sharing Apple Health / Health Connect data with AI | A **separate setting, off by default**: "Share Apple Health / Health Connect data with the AI Coach" (Section 5.3) | Turn the setting off in Profile → Privacy & data |
| Coaching memory | **Separate memory consent**; memory must be switched on | Turn memory off; delete memories |
| Faith interest and prayer-journal entries | You choose to turn on faith features and write entries. An entry goes to AI only if you mark that entry "Share with AI Coach" (off by default) | Turn faith features off; delete entries |
| Workouts, food diary, bodyweight, measurements, typed-in steps, supplements, allergies | No separate consent step: you choose to enter them | Delete the entries or your account |

**How consents are recorded.** Each consent above is one timestamp on your profile. Withdrawing it erases the timestamp. The app keeps no history of earlier consents and no copy of the wording you were shown for these consents. (The Terms, Privacy Policy, risk acknowledgment and auto-renewal acceptances are recorded separately, with version and text fingerprint: Section 2.1.)

[ATTORNEY REVIEW: religious beliefs are "sensitive data" under, among others, Va. Code §59.1-575, Colo. Rev. Stat. §6-1-1303(24), Conn. Gen. Stat. §42-515, and Tex. Bus. & Com. Code §541.001. They are "sensitive personal information" under Cal. Civ. Code §1798.140(ae). Where those laws apply, they require opt-in consent (or, under the CCPA, a right to limit). Turning on faith features is an affirmative act, but it is not presented as consent to process religious data. Decide whether a short explicit notice or consent is needed when faith features are turned on. Similarly, assess whether Washington's My Health My Data Act (RCW 19.373) and Nevada SB 370 (NRS ch. 603A) require separate consent for *collection* and *sharing* of consumer health data. Those laws have no revenue thresholds, and their definitions are broad enough to cover fitness, sleep, bodyweight and limitation data.]

## 5. AI features: what is sent and to whom

Our AI features are powered by **Anthropic** (Claude). They are part of Pro. Every request to Anthropic is made from our server, and **nothing is sent unless you have given AI consent** on the consent card ("Allow and continue") and have not withdrawn it.

### 5.1 What is sent with each AI Coach message

- today's date and your units; your age, sex, height and latest bodyweight;
- your goal, experience, goal weight, chosen weekly pace and activity level; days per week and session length; equipment and preferred training types;
- physical-limitation notes, **only if you gave wellness consent**;
- your diet style; calorie budget and saved targets; today's intake totals and 7-day averages;
- your bodyweight entries for the last 90 days and the trend;
- your active program with its days and exercises;
- adherence and streaks; your last 10 workouts (top set per exercise, and any reason you gave for skipping an exercise); best lifts;
- the last 7 days of **step counts you typed in** and your step goal (imported steps: Section 5.3);
- your latest readiness score and its date; the names of your supplements;
- your 40-day-challenge name and progress, and whether faith features are on;
- prayer-journal entries you marked "Share with AI Coach" (date, kind, title, scripture reference and an excerpt), only while faith features are on;
- coaching memories, only while memory is on;
- your coach-style choice and the conversation so far.

**When the coach needs more to answer you,** it can ask our server for: more workout and exercise history; a nutrition summary that includes food names; the weeks of your program; a sleep summary (durations, scores, patterns drawn from your sleep check-in answers such as caffeine, alcohol and stress), only if you gave wellness consent; a running summary (dates, distance, time, effort and source — **not the route**); a recovery summary; an analysis of a lift; and the titles and text of your earlier conversations, except conversations you marked "memory off".

### 5.2 Other AI features

- **AI meal plans:** your targets, planner settings (diet, budget, allergies, dislikes), your notes and the list of eligible dishes.
- **Meal photos and food-label photos (separate consent):** the photo, for that request only. Our server resizes it, removes its metadata (including location), sends it once and discards it. **We do not store these photos.** Only the items you confirm are saved to your diary.
- **"Ask AI about this food":** the product's Open Food Facts data, together with your goal, diet style, daily targets and food filters.
- **AI Bible study helper:** your question and the earlier questions and answers in that thread.
- **Weekly progress report:** the week's workout, nutrition, running, sleep and bodyweight figures. The report is produced on a schedule for Pro members who have given AI consent, not in response to a message you send. [OWNER TO CONFIRM: whether the scheduled weekly report is switched on in production.]

### 5.3 Apple Health and Health Connect data: a separate setting, off by default

Data that came from Apple Health, Health Connect or a wearable is sent to the AI provider **only if you turn on a separate setting**: **"Share Apple Health / Health Connect data with the AI Coach"**. The setting is off until you turn it on, and it applies in addition to AI consent. It covers:

- imported step counts;
- nights of sleep recorded by a watch, ring or phone, with their stages;
- overnight heart rate, heart-rate variability and breathing (respiratory) rate.

While the setting is off, these are left out of everything sent to the AI provider, including the weekly report, and the coach is told only that some imported data was withheld. Data you typed in yourself is covered by the general AI consent. **The name of your watch, ring or phone is never sent**, whatever the setting.

[ATTORNEY REVIEW / OWNER: this setting is being added in the same release as this revision (database migration `20261116000079_health_ai_share_consent.sql`; `src/lib/domain/health-ai-sharing.ts`). Confirm it is in the shipped build, and confirm the wording of the setting, before publishing this section. Counsel to advise whether Apple guideline 5.1.3, Google's Health Connect policy, Washington's My Health My Data Act and Nevada's equivalent require anything further (audit file 18, questions 1–4).]

### 5.4 Never sent to AI

No code path sends any of the following to the AI provider:

- your email address or display name;
- progress photos and Body Scan photos;
- prayer-journal entries you have not marked for sharing; Bible notes and highlights;
- GPS routes;
- body measurements (tape measurements and body-fat percentage);
- free-text sleep and recovery notes;
- payment data;
- the name of your wearable device.

Anything you type into a message to the AI is sent as you typed it.

### 5.5 Withdrawing, and what the provider keeps

- You can withdraw AI consent at any time in Profile → Privacy & data. This turns the AI features off and turns coaching memory off. **It stops future sending. It cannot recall anything that was already sent.**
- Withdrawing does not delete your past conversations and memories from your account. Delete them yourself, or delete your account.
- Your AI conversations are stored in your account until you delete them or your account.
- Anthropic processes this data as our service provider, under its commercial terms and data processing addendum. How long Anthropic keeps AI inputs and outputs, and whether any zero-data-retention arrangement applies to our account: **[TO BE CONFIRMED — Anthropic's retention terms for the owner's account]**. [ATTORNEY REVIEW: state Anthropic's retention period for API inputs and outputs, and whether any zero-data-retention arrangement applies. Confirm the DPA covers U.S. state-law service-provider and processor terms.]

## 6. Who we share information with

We share personal information only with the service providers and processors below, acting on our instructions, and as required by law. [ATTORNEY REVIEW: execute or confirm a data processing agreement with each.]

| Recipient | What they receive | Why |
|---|---|---|
| **Supabase** | All account data, logs you enter, photos (private storage buckets), AI conversations, billing status; your email and password hash for sign-in | Database, authentication, file storage. Supabase's authentication service also sends our two account emails (confirm sign-up, reset password) |
| **[EMAIL DELIVERY PROVIDER — OWNER TO CONFIRM; no production SMTP is configured in the repository]** | Your email address and the content of the two account emails | Delivering the sign-up confirmation and password-reset emails. The provider has not been chosen. The app sends no other email and no marketing email |
| **[HOSTING PROVIDER — OWNER TO CONFIRM, e.g. Vercel]** | All requests passing through the web app server; technical data; server logs | Hosting |
| **Anthropic** | The AI inputs described in Section 5, only after consent | AI responses |
| **Stripe** | Email address, account ID, plan and price. Stripe collects your payment details directly from your browser | Website payments |
| **RevenueCat** | Account ID (used as the RevenueCat user ID); App Store / Google Play purchase records. Our code does not send RevenueCat your email | In-app subscription status |
| **Apple / Google** | Purchase and payment information (handled by the store). Health data stays on your device's health platform until the app reads it | In-app purchases; health platforms |
| **Open Food Facts** | The barcode you scan, and the text of a product search in the scanner and comparison tools. Requests are made from our server, not your device, and do not include your identity. Product photos are loaded by your device directly from Open Food Facts' servers, which therefore see your IP address | Product lookups and product photos |
| **USDA FoodData Central** | Food search text (up to 80 characters), requested from our server, **only if live USDA search is switched on**. Otherwise food search uses a copy of USDA data built into the app and nothing is sent. [OWNER TO CONFIRM: whether `USDA_FDC_API_KEY` is set in production] | Food search |
| **YouTube (no-cookie player) / Vimeo** | Your IP address and browser details, only if an exercise page has an embedded third-party video and you open it | Playing a video that one of our administrators linked |
| Professional advisers, authorities, successors | As needed | Legal advice; legal compliance; a merger or sale (with notice to you) |

**Other members receive nothing today.** Section 16 describes what would be shared if the Friends feature is switched on.

We require our service providers to protect personal information in a way consistent with this Policy. [ATTORNEY REVIEW: this sentence describes contracts that are not in the repository. Confirm it is true for each provider before publishing.]

## 7. How long we keep information

**What is true today: the Service has no automatic deletion.** No personal data is deleted on a schedule. Your data stays until you delete it or delete your account. The periods in the right-hand column have not been decided.

[OWNER TO DECIDE all periods below; do not publish until decided. Apple Guideline 5.1.1(i) requires the policy to explain retention and deletion.]

| Data | Current behavior in the app | Retention period to state |
|---|---|---|
| Account and logs | Kept while your account exists; deleted when you delete the account | [OWNER DECISION: retention period — e.g. "until you delete it or your account"] |
| Deleted runs | The route, splits and GPS-quality summary are removed immediately. The entry keeps its date, time zone, distance, time, effort and notes until account deletion | [OWNER DECISION: retention period — whether to purge deleted runs after N days] |
| AI conversations and memories | Until you delete them or your account. Withdrawing AI consent does not delete them | [OWNER DECISION: retention period] |
| AI usage counts (model, tokens, cost) | Until account deletion | [OWNER DECISION: retention period] |
| Meal and food-label photos | Not stored by us | Provider retention: [TO BE CONFIRMED — Anthropic's retention terms] [ATTORNEY REVIEW] |
| Progress photos and Body Scans | Until you delete them, withdraw Body Scan consent (which deletes all scans), or delete your account | [OWNER DECISION: retention period] |
| Sleep data and wellness information | Limitation notes and recovery check-ins: until you withdraw wellness consent or delete your account. Sleep data: until you delete it or your account | [OWNER DECISION: retention period] |
| Billing records and webhook event IDs | Billing rows are deleted with the account. A list of processed payment-event IDs (event ID, type and status, with no account reference) is kept. Stripe and RevenueCat customer records are deleted on account deletion, on a best-effort basis | [OWNER DECISION: retention period; tax and accounting records may need to be kept for a legally required period — ATTORNEY REVIEW] |
| Workout usage events | Until account deletion | [OWNER DECISION: retention period] |
| Rate-limit counters | Contain an account ID; rows older than two days are removed the next time the limiter runs | [OWNER DECISION: retention period] |
| Administrator audit log | Kept. An entry can contain a member's account ID (Section 8) | [OWNER DECISION: retention period] |
| Server and error logs | Held by the hosting provider | [OWNER DECISION: retention period / confirm with provider] |
| Backups | Held by the database provider | [OWNER DECISION: retention period / confirm with provider] |
| Consent records | Each in-app consent is a single timestamp on your profile, erased when you withdraw it. Records of the Terms, Privacy Policy, risk acknowledgment and auto-renewal terms you accepted are **deleted with your account** | [OWNER DECISION: retention period — California ARL requires keeping verification of auto-renewal consent for 3 years or 1 year after the contract ends, whichever is longer — ATTORNEY REVIEW. As built, the record does not survive account deletion] |

## 8. Your choices and rights

**For everyone, in the app:**
- **Access / export:** Profile → Privacy & data → **Export**. This downloads one JSON file with the data in your account (limited to 3 exports per hour). Coaching memories are included in readable form. Progress photos and Body Scan photos are not inside the file: it contains download links to them that work for one hour.

  **Not in the export:** your avatar image file (only its location); sign-in records held by our authentication provider beyond your ID and email; anything held by Stripe, RevenueCat or Anthropic; server logs; and a small number of internal records (the administrator audit log, internal billing-state and store-sync records, and the list of test accounts).
- **Delete your account:** Profile → Privacy & data → **Delete account**. You confirm by typing DELETE and re-entering your password. Then, in this order:
  1. Website (Stripe) subscriptions are cancelled. If that fails, nothing is deleted and you are told.
  2. Your avatar, progress photos and Body Scan photos are removed from storage.
  3. Your sign-in account is deleted, which deletes every record linked to it: profile, logs, routes, sleep and health data, conversations and memories, faith content, billing rows, usage events, device records and legal acceptances.
  4. We ask Stripe and RevenueCat to delete your customer record. If either request fails, the failure is logged for us to follow up.

  **We cannot cancel App Store or Google Play subscriptions.** Cancel those in your store account to stop charges. Removing the app from your phone does not delete your account or cancel anything.

  **What is not deleted when you delete your account:**
  - an App Store or Google Play subscription, which keeps billing until you cancel it in the store;
  - records Stripe, RevenueCat, Apple and Google keep under their own terms;
  - the list of processed payment-event IDs (no account reference);
  - administrator audit-log entries, which can contain your account ID;
  - rate-limit counters containing your account ID, for up to about two days;
  - server log lines at the hosting provider, some of which carry an account ID or Stripe customer ID;
  - database backups at the database provider, until they expire: [OWNER DECISION: retention period for backups];
  - whatever Anthropic retains of past AI requests under its own terms: [TO BE CONFIRMED].
- **Correct:** edit your profile and logs at any time.
- **Withdraw consent:** wellness data, AI sharing, sharing of Apple Health / Health Connect data with AI, food photos, Body Scan, coaching memory, and Apple Health / Health Connect access (in device settings).
- **Delete specific items:** runs, photos, scans, journal entries, conversations, memories, imported sleep or all sleep.

**State privacy rights.** Depending on where you live, you may have the right to:
- know or access the personal information we hold about you, and obtain a portable copy;
- correct it;
- delete it;
- opt out of sale, sharing or targeted advertising (we do none);
- limit or withdraw consent to the use of sensitive data;
- appeal our decision on your request;
- not be discriminated against for exercising these rights.

To make a request that the in-app tools don't cover, email [PRIVACY EMAIL]. We will verify your identity, usually by confirming control of your account email, and respond within [45 days — ATTORNEY REVIEW: confirm the statutory periods and any extension]. You may use an authorized agent where the law allows. If we deny your request, you may appeal by replying to our decision. If the appeal is denied, you may contact your state attorney general.

[ATTORNEY REVIEW / OWNER: the paragraph above describes a process that does not exist yet. The Service has no request log, no appeal procedure, no authorized-agent procedure and no control labelled "limit the use of sensitive information". These must be set up before the paragraph is published.]

[ATTORNEY REVIEW: the CCPA/CPRA applies only to businesses that meet a threshold: annual gross revenue over $26,625,000 (CPPA CPI adjustment effective Jan. 1, 2025), buying, selling or sharing the personal information of 100,000+ consumers or households, or deriving 50%+ of revenue from selling or sharing. Most other state comprehensive laws use consumer-count thresholds; Virginia and Colorado use 100,000. **Connecticut's amendments (SB 1295, Public Act 25-113, most provisions effective July 1, 2026) reportedly apply to any controller that processes sensitive data, regardless of volume.** Texas applies to all non-"small businesses" (SBA definition). Washington MHMDA and Nevada SB 370 have no thresholds. Decide whether to extend these rights to all U.S. users as a matter of policy. This is recommended, because the in-app tools already provide most of them.]

## 9. Consumer health data (Washington, Nevada and similar laws)

[ATTORNEY REVIEW: Washington's MHMDA requires a **separate, prominently linked Consumer Health Data Privacy Policy** on the homepage (RCW 19.373.020). That policy must list the categories of consumer health data, the purposes, the sources, the categories shared and with whom, and how to exercise rights. Nevada SB 370 has similar requirements. Draft that separate policy from Sections 2–8 of this document. The Service does not ask for a state of residence, so it cannot tell which members live in Washington or Nevada.] In summary:
- the consumer health data we collect is listed in Sections 2.1–2.2: wellness notes, sleep and health-platform data, bodyweight and measurements, fitness logs, food logs, limitation notes and, where applicable, photos;
- we collect it to provide the features you request;
- we share it only with the processors in Section 6;
- we do not sell it;
- we do not use geofencing.

## 10. Children

The Service is for adults **18 and older**. This is how the age check works today:

- To create an account you must tick a box that says "I confirm I am 18 years of age or older." The account cannot be created without it. The tick itself is not stored.
- During onboarding you enter your age. The app refuses an age under 18 (and over 100) and stores a year of birth, not a date of birth.
- Age is self-declared. We do not verify it.
- The AI Coach is instructed not to coach anyone who says they are under 18.

We do not knowingly collect personal information from children under 13, or from anyone under 18. If we learn that we have, we will delete it. Contact [PRIVACY EMAIL].

[ATTORNEY REVIEW / OWNER — facts counsel should know before approving this section: (1) a person who enters an age under 18 at onboarding has already created an account with an email, name and password, and nothing deletes it automatically; (2) there is no neutral age screen, no block on retrying with a different age, and no parental-consent flow; (3) the database itself accepts any year of birth from 1900 to 2100, and a member can change their own; (4) the "we will delete it" commitment above relies on a manual step — no routine exists. [OWNER DECISION: age policy — confirm the minimum age stays 18 and decide what happens to an account found to belong to someone under 18.]]

## 11. Security

Our safeguards include:
- encryption in transit (HTTPS);
- row-level access controls on every database table, so each member can reach only their own records;
- private storage for avatars, progress photos and Body Scan photos, opened only through short-lived signed links;
- removal of location metadata from photos on your device before upload;
- encryption of coaching memories with a key held on our server (AES-256-GCM), in addition to the database provider's own encryption of stored data;
- password re-entry for account deletion;
- rate limits on sign-in, export, deletion and other actions;
- a required email confirmation at sign-up and a minimum password length of 8;
- no access for administrator accounts in the app to members' journals, photos, health records, food logs, location or AI conversations.

**What administrators can see in the app:** a subscriptions screen showing display name, plan, status and dates, with look-up of an account by email; totals of workout usage events; and their own audit log. People with direct access to our database provider's console or the server's service key can technically reach all stored data; who holds that access is [OWNER TO CONFIRM — who holds administrator, service-role and database-console access in production].

No system is perfectly secure. Keep your password confidential. [ATTORNEY REVIEW: avoid absolute security claims; FTC Act §5 treats inaccurate security representations as deceptive. For accuracy, counsel should also know what is **not** present: AI conversations, journals and health data are not separately field-encrypted (only coaching memories are); there is no multi-factor sign-in; administrators' reading of the subscriptions screen is not logged; and three in-app notices say data is "never visible to administrators" or that "our team and admins can't view" photos, which is true of administrator accounts in the app but not of console or service-key access (audit file 07, I-10 and I-11).]

## 12. Data breaches

If a security incident affects your personal information, we will investigate. We will notify you, regulators and others as required by law. This includes, where applicable, the **FTC Health Breach Notification Rule (16 C.F.R. Part 318)**, under which an unauthorized disclosure of identifiable health information, not only a hack, can count as a breach. It also includes state breach-notification laws. [ATTORNEY REVIEW: adopt a written incident-response procedure. Under 16 C.F.R. §318.4, individual notice must be given without unreasonable delay and no later than 60 calendar days after discovery. Confirm the current timing for notice to the FTC for breaches involving 500 or more people. Sources conflict on whether that notice is due at the same time as individual notice or within 10 business days. As of 2026-11-16 no incident-response procedure, breach log or notification template exists in the repository.]

## 13. Where data is processed; international use

We are based in the United States. Our providers process data in [REGIONS — OWNER TO CONFIRM Supabase project region, hosting region, and Anthropic processing locations]. [ATTORNEY REVIEW: if the Service is offered outside the U.S., add GDPR / UK GDPR sections, a legal basis for each purpose, and transfer mechanisms; otherwise state that the Service is intended for U.S. users.]

**What is true today:** nothing in the Service restricts where it can be used. There is no country check at sign-up, in the app or at checkout, and the app supports metric units and every time zone. The countries in which the apps are offered are chosen in App Store Connect and Google Play Console, outside the code. [OWNER DECISION: geographic availability — United States only, or wider.] [DRAFT FOR ATTORNEY REVIEW — placeholder, not approved wording: "The Service is intended for people in [COUNTRIES SERVED]. If you use it from elsewhere, your information will be processed in the United States."]

## 14. Apple Health and Health Connect; app store disclosures

**How the Service handles Apple Health (HealthKit) and Health Connect data:**

- **Optional.** Nothing is read unless you connect Apple Health or Health Connect and allow each data type in the operating system's prompt.
- **Read-only.** The app reads data. It never writes to Apple Health or Health Connect.
- **Data types read:** steps (daily totals); sleep sessions and sleep stages; overnight heart rate; heart-rate variability; respiratory rate; and the name of the device that recorded a night. Workouts are not imported.
- **Where it is kept.** What the app reads is saved to your account at our database provider (Supabase), so that your steps, sleep scores and recovery screens work. We do not store HealthKit data in iCloud.
- **What it is used for.** Only to provide the features you request: step totals, sleep and recovery screens and scores, and your weekly report.
- **No advertising or data mining.** This data is not used for advertising or marketing, is not used for data mining, and is not sold. The app contains no advertising software.
- **AI provider.** It is sent to our AI provider only if you turn on the separate, default-off setting described in Section 5.3. The device name is never sent.
- **Other members.** It is not shown to other members.
- **How to disconnect.** Turn off the app's access in your device settings (iPhone: Settings → Health → Data Access & Devices, or Settings → Privacy & Security → Health; Android: Health Connect → App permissions). [OWNER TO CONFIRM the exact menu paths on current iOS and Android versions; they were not verified on a device.] Disconnecting stops new imports. It does not delete what was already imported.
- **How to delete what was imported.** Sleep & Recovery → Goal & privacy → "delete imported" removes imported sleep data ("delete all" removes every sleep entry). Imported step counts have no delete control of their own in the app today; they are deleted when you delete your account. [OWNER DECISION: whether to add a "delete imported steps" control before publishing this section.] Deleting your account deletes all imported data.

Our App Store privacy label and Google Play Data safety form describe the same data as this Policy. [OWNER TO CONFIRM: the answers submitted in App Store Connect and Google Play Console were not available for comparison. This sentence must not be published until they have been checked against this Policy.]

## 15. Changes to this Policy

We will post updates here and change the "Last updated" date. For material changes, we will notify you in the app or by email before the change takes effect. For any new use of sensitive data, we will ask for your consent where the law requires it.

[ATTORNEY REVIEW / OWNER: as built, the app records which version of this Policy each member accepted. A re-acceptance screen exists and is switched off (`LEGAL_REACCEPT_REQUIRED`); switching it on makes every member accept the current versions before continuing. The app has no way to send a notice email today (Section 6: only two account emails exist). Decide how notice will actually be given before publishing this section.]

## 16. Friends (not yet available)

> **[DRAFT FOR ATTORNEY REVIEW — DESCRIBES A FEATURE THAT IS SWITCHED OFF.]** Friends is not available to any member. It is switched off, and its code is not part of the current release. **Challenges between members have not been built.** This section records, for counsel, what the Friends code on another branch would share if the owner switched it on. It is a draft, nothing in it is in force, and it must be reviewed, completed and accepted by members before the feature is switched on. Source: audit file 08.

**What would be shared between members if Friends were switched on:**

| With whom | What they could see |
|---|---|
| Any member using search | Your **username** (3 to 20 characters, chosen by you when you join Friends) and whether you are already connected, unless you turn "searchable" off. Search matches the first letters of a username and returns at most 10 results. The search result also carries a permanent internal account identifier |
| A member you sent a request to, or who sent you one | Your username and the time of the request. Not your display name; no activity |
| A member who accepts an invite link you created | They become your friend at once, with no further confirmation by you. The invite page does not show who created the link |
| **Friends** | Your username; your **display name** (the name you gave at sign-up — always shown to friends, with no switch to hide it); the date and time you became friends; whether you have hidden your profile |
| Friends, **while your "show workouts" switch is on** | The number of workouts you completed in the **last 7 days**, and your **streaks** (days and weeks). Nothing about which exercises, sets or weights |

- **Defaults.** In the code as built, "searchable", "profile visible" and "show workouts" start **on** when you join. [OWNER DECISION / ATTORNEY REVIEW: whether workout sharing should start off, and whether accepting the first friend needs an explicit sharing step (audit F-07).]
- **Changing your mind.** Switching a setting off takes effect immediately. Removing a friend takes effect immediately.
- **Blocking.** You can block a member. Blocking removes the friendship and closes pending requests between you. The blocked member is **not told**. They may still be able to work out that they were blocked, for example because you no longer appear in search. We do not promise that a block cannot be detected.
- **Declined requests.** The sender is not told that a request was declined, but may be able to infer it.
- **Reporting.** You can report a member, giving a reason and up to 500 characters of detail. **Reports go to our administrators only.** The reported member is not told who reported them. Administrators see both usernames, the reason, the details, the status and the number of open reports about the reported member.
- **No messages.** Members cannot send each other free text. There is no chat, no comments and no activity feed.

**Never shared with other members by the Friends code:** your email address, weight, body measurements, nutrition, sleep, health-platform data, progress photos, Body Scans, prayer journal, Bible activity, AI conversations, individual exercises or sets, time zone and location.

**Facts counsel must settle before Friends is switched on** (each is an open item in `REMAINING_INFORMATION_NEEDED.md`):
- Joining creates no separate consent record. [ATTORNEY REVIEW: whether disclosing workout counts to another member needs its own consent under the consumer-health-data laws.]
- Five further switches exist on the Friends privacy screen (records, weight and body measurements, nutrition, faith activity, leaderboards). **No code reads them today**, so nothing in those categories is shared. [OWNER DECISION: hide them, or reset them to off and ask again when each kind of sharing is built (audit F-09).]
- A member cannot leave Friends without deleting the whole account: the username stays reserved (audit F-10).
- Usernames are checked against a list of reserved staff-like names. They are not screened for offensive words, and display names are not screened at all (audit F-20).
- Retention: requests, invites, blocks and reports are never deleted automatically. A report is deleted when either the reporter's or the reported member's account is deleted. [OWNER DECISION: retention period for reports and for other Friends records.]
- Export: your data export would include your Friends profile, friendships, your own blocks, reports and invites, and requests visible to you. It would not include reports made about you, blocks placed on you, or requests you sent that were declined (audit F-11).
- A known defect lets a reporter read the administrators' internal note on their own report (audit F-05). It must be fixed first.
- Moderation: see `docs/legal/MODERATION_AND_USER_CONTENT_POLICY_DRAFT.md`.

**Accountability partners (also switched off).** A second switched-off feature would let two members who exchange a code see each other's display name and, by default, workouts in the last 7 days and streaks; program name and week only if switched on; and send one of six fixed encouragement messages (one of them is "praying"). It raises the same questions and must be covered by the same review (audit F-21).

## 17. Contact

[LEGAL ENTITY NAME] · [POSTAL ADDRESS] · [PRIVACY EMAIL]
