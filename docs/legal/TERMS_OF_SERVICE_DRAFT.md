# Narrow Gate Fitness — Terms of Service (DRAFT)

Version: [DRAFT 2026-10-26; factual descriptions revised 2026-11-16]
Effective date: [EFFECTIVE DATE — set when published]

> **DRAFT FOR ATTORNEY REVIEW — NOT LEGAL ADVICE AND NOT IN FORCE.** This document was prepared as research and drafting support for review by a qualified attorney licensed in the relevant jurisdiction(s). It has not been reviewed or approved by counsel. Nothing in it is a statement that any clause is enforceable or that the service complies with any law. Every bracketed placeholder must be completed, and every "[ATTORNEY REVIEW: …]" marker resolved, before publication. Remove this box and all markers before publishing.
>
> **Revision note, 2026-11-16.** The factual descriptions (plans, prices, what each plan includes, billing, cancellation, AI features and feature behaviour) were revised against the TestFlight release candidate, using the legal audit in `docs/legal-audit-2026-11-16/`. The reviser is not a lawyer. No legal wording was approved in this revision, no attorney has reviewed it, and no placeholder was filled with an invented fact. New draft provisions are marked **[DRAFT FOR ATTORNEY REVIEW]**. Earlier attorney notes are kept as written; where the code has since changed, a dated update follows the note. Everything still missing is listed in `docs/legal/REMAINING_INFORMATION_NEEDED.md`.

---

## 1. Who we are and what these Terms cover

These Terms of Service ("**Terms**") are an agreement between you and [LEGAL ENTITY NAME], a [STATE OF FORMATION] [ENTITY TYPE] with its principal address at [POSTAL ADDRESS] ("**Narrow Gate Fitness**," "**we**," "**us**," "**our**"). [ATTORNEY REVIEW: the owner is currently an individual; the contracting party must be the entity that will actually operate the service and receive payments. Apple Guideline 5.1.1(ix) expects apps handling sensitive user information to be submitted by a legal entity rather than an individual developer.]

They govern your use of the Narrow Gate Fitness website, the iOS and Android apps, and every feature, content item and service we provide through them (together, the "**Service**").

**Please read Section 22 (Dispute Resolution and Arbitration) carefully.** Unless you opt out within 30 days, it requires most disputes to be resolved by individual arbitration rather than in court or by jury, and it waives class actions. It does not stop you from going to small-claims court or from reporting concerns to a government agency.

### 1.1 How you accept these Terms

You accept these Terms when you create an account. The sign-up form has three boxes, all unticked and all required: one confirming you are 18 or older, one saying "I agree to the Terms of Service and have read the Privacy Policy" (with links to both), and one accepting the health and AI risk acknowledgment. If you do not agree, do not create an account or use the Service. [ATTORNEY REVIEW: the sign-up form (`src/components/auth/auth-forms.tsx`) uses an unchecked, required checkbox with links to both documents, which supports clickwrap formation under *Meyer v. Uber* (2d Cir. 2017) and *Berman v. Freedom Financial* (9th Cir. 2022). However, the app does not currently record which version was accepted or when. Recommend storing `terms_version` and `terms_accepted_at` per account before relying on arbitration or other protective clauses.] [Update 2026-11-16, not part of the note above: the app now records each acceptance of the Terms, the Privacy Policy and the risk acknowledgment with the document version, a SHA-256 fingerprint of the text shown and a database-set time (`src/lib/legal/versions.ts`; table `legal_acceptances`). Three points remain for counsel: (1) the version members accept today is `2026-10-26-placeholder` — the short in-app placeholder page, shown under a banner saying it is "not legally binding", not this draft; (2) the "18 or older" tick is not recorded; (3) the acceptance record is deleted when the account is deleted. A re-acceptance screen exists and is switched off (`LEGAL_REACCEPT_REQUIRED`).]

### 1.2 Other documents that form part of these Terms

- Our **Privacy Policy** at [PRIVACY POLICY URL], which explains how we handle personal information.
- Any plan or pricing details shown to you at the point of purchase.
- If you download the app from the Apple App Store: Apple's Licensed Application End User License Agreement (the "**Apple Standard EULA**"), or the custom EULA terms in Section 26 if we use one. [ATTORNEY REVIEW: owner must choose either Apple's Standard EULA or a custom EULA uploaded to App Store Connect. Section 26 contains the minimum terms Apple requires in a custom EULA.]
- If you download the app from Google Play: Google Play's Terms of Service also apply to your relationship with Google.

If these Terms conflict with a store's mandatory terms on matters the store controls (billing, refunds through the store, and similar), the store's terms control for those matters.

## 2. Eligibility and accounts

### 2.1 Adults only

You must be **at least 18 years old**, and old enough to form a binding contract where you live, to create an account or use the Service. The Service is not directed to children. When you sign up, you must tick a box confirming that you are 18 or older, and onboarding asks for your age and refuses ages under 18. Age is self-declared; we do not verify it. If we learn that an account belongs to someone under 18, we will close it and delete its data as described in the Privacy Policy. [ATTORNEY REVIEW: confirm that the minimum age stays at 18. A lower age would bring in COPPA (under 13) and minors' contract-disaffirmance issues, and would require reworking the health and AI terms. Facts as of 2026-11-16: an account already exists by the time an under-18 age is refused at onboarding, and no routine closes or deletes such an account, so the "we will close it" sentence above describes a manual step. Some in-app messages say adults only "at launch". [OWNER DECISION: age policy — confirm 18 and decide what happens to an under-age account.]]

### 2.2 Your account

- Give accurate information and keep it up to date. Your profile data (age, sex, height, weight, goals) affects the estimates the Service produces.
- Keep your password confidential. You are responsible for activity under your account unless it results from our failure to protect it.
- One person per account. Do not share, sell or transfer your account.
- Tell us promptly at [SUPPORT EMAIL] if you believe someone else has accessed your account.

## 3. The Service and our plans

### 3.1 Free plan ($0)

The Free plan costs **$0**. It currently includes:
- workout logging, starter programs and all exercise demonstrations;
- up to 5 saved workout templates, with basic history and calendar viewing;
- food diary, calories and macros, barcode scanning, food search, manual entry, saved meals and basic insights;
- manual run and walk logging;
- basic sleep logging and sleep goals;
- weight and basic progress tracking, and badges;
- the core **Faith & Discipline** features: Bible reading, devotionals, the prayer journal, reading journeys and the 40-day challenge.

The Free plan does **not** include any AI feature. The **AI Bible study helper is part of Pro**, not Free.

This list describes the Free plan as it is today. It is not a promise that the Free plan, or any feature in it, will stay free or stay available indefinitely; Section 3.5 covers changes. [OWNER: one in-app plan description still reads "The complete Faith & Discipline section, always free" (`src/lib/domain/plans.ts`, Free plan highlights). It is inaccurate, because the AI Bible study helper is Pro, and "always free" is an open-ended promise. It was outside the scope of this revision and is unchanged.]

### 3.2 Pro All Access

Pro All Access costs:
- **$17.99 per month**, billed every month; or
- **$119.99 per year**, billed once a year as a single payment.

Both Pro options unlock exactly the same features. **No free trial is offered.** In addition to everything in Free, Pro includes:
- the full program library and the custom program builder;
- unlimited saved workout templates and calendar scheduling;
- live GPS run and walk recording, with route maps and splits;
- recipes, meal planning and grocery lists;
- food comparisons and filters;
- advanced sleep and recovery analytics;
- Body Scan and progress-photo comparisons;
- advanced analytics;
- the AI Coach and the other AI features in Section 7, within the monthly allowance in Section 3.3;
- a weekly progress report;
- the AI Bible study helper.

Prices are in U.S. dollars. They do not include any taxes, which may be added where required. Prices in the App Store or Google Play are set and displayed by the store in your local currency and may differ from these amounts. [ATTORNEY REVIEW: confirm that the prices in these Terms match the configured Stripe, App Store and Play prices on the publication date. The code is mid-migration: committed HEAD still lists Plus $11.99 and Pro $24.99, while the uncommitted working tree on 2026-10-26 implements Pro at $19.99 / $149.99. Consider stating prices only "as shown at checkout," to avoid conflicts.] [Added 2026-11-13, not part of the note above: the owner has since approved launch prices of $17.99 / $119.99, which Section 3.2 now states. The note above records the code as it stood on 2026-10-26 and is kept unchanged.] [Update 2026-11-16: $17.99 and $119.99 are the prices in code (`src/lib/domain/plans.ts`, `APPROVED_PRO_PRICE_CENTS`). Web checkout refuses to start if the configured Stripe price differs. [TO BE CONFIRMED — the prices actually configured in Stripe, App Store Connect and Google Play Console; they could not be checked from the repository.]]

### 3.3 AI Coach allowance

Pro includes **150 AI requests per calendar month**. Up to **10** of these may use our more advanced AI model, which handles AI plan generations and more complex questions; the rest use a faster model. The Free plan does not include AI features.

The following count against the 150-request allowance:
- AI Coach messages;
- AI plan generations;
- AI meal plans;
- food-photo and food-label-photo analysis;
- "Ask AI about this food";
- AI sleep coaching;
- AI Bible study questions;
- the AI analysis in your weekly progress report.

Some other limits also apply:
- rate limits;
- a daily limit on food photos (20 a day at launch);
- the AI Bible study helper's own per-minute, daily and monthly question limits;
- the cap of 10 requests a month that use the more advanced AI model;
- a monthly limit on our AI cost per member (about $1.40 at launch). If it is reached before the request allowance, further AI requests that month may be declined. [ATTORNEY REVIEW / OWNER: decide whether to disclose the cost limit as a dollar figure or only as "fair-use limits"; the code enforces it either way (`AI_MEMBER_MONTHLY_BUDGET_USD`).]

Unused requests do not roll over to the next month. The allowance resets at the start of each calendar month [ATTORNEY REVIEW / OWNER: confirm which time zone the reset uses] [Update 2026-11-16: in code the allowance renews on the 1st of each month in UTC (`src/lib/domain/ai-allowance.ts`), so for members in the United States the reset falls on the evening of the last day of the month.]. We may change the AI models we use. [ATTORNEY REVIEW: if the allowance or features are reduced for current subscribers, give notice and apply the change at the next renewal; see Section 24.]

### 3.4 Existing Plus and earlier Pro subscribers

We no longer sell the Plus plan to new customers. If you subscribed to Plus or Pro before [PLAN CHANGE DATE], you keep the paid access and any AI allowance your subscription included, for as long as that subscription stays active on the same plan. This lasts until we change those terms with advance notice under Section 24. If your subscription ends, any new subscription follows the plans then on offer. [ATTORNEY REVIEW: the grandfathered terms are recorded per subscription (`legacy_plan_terms`). Decide whether to send existing subscribers a separate notice, and how much notice to give before ending grandfathering. State automatic-renewal laws (for example California Bus. & Prof. Code §17602 as amended by AB 2863) require clear and conspicuous notice of material changes.]

### 3.5 Changes to features

We may add, change or remove features. If a change materially reduces a paid plan you are subscribed to, we will tell you in advance, and you may cancel before the change takes effect. [ATTORNEY REVIEW: unilateral-modification rights in consumer contracts are limited by implied good faith and by state ARLs. Keep this clause narrow.]

## 4. Health and safety — please read

### 4.1 Not medical care

Narrow Gate Fitness provides **general fitness, nutrition and wellness information and tools**. It is **not** a medical service.

None of the following are substitutes for professional advice, diagnosis or treatment:
- the AI Coach;
- programs and calorie or macro targets;
- sleep and recovery scores;
- Body Scan and other content.

We do not diagnose, treat, cure, mitigate or prevent any disease or condition. [ATTORNEY REVIEW: keep all marketing within FDA's General Wellness guidance (reissued January 6, 2026). Do not make disease claims.]

### 4.2 Talk to a professional first

Consult a physician or other qualified health professional before you start, change or intensify any exercise program, diet or weight-change plan. This is especially important if you:
- have or think you may have a medical condition, including heart, lung, metabolic, kidney or joint conditions or high blood pressure;
- are pregnant, may be pregnant, are postpartum or are breastfeeding;
- take medication;
- have an injury or have recently had surgery;
- have a history of, or concerns about, disordered eating;
- are new to exercise or returning after a long break.

### 4.3 Stop if something feels wrong

Stop exercising immediately and seek medical help if you experience any of the following:
- chest pain or pressure;
- dizziness, light-headedness or fainting;
- unusual shortness of breath;
- palpitations;
- severe headache;
- numbness;
- sharp or worsening pain;
- anything else that concerns you.

For a medical emergency, call 911 or your local emergency number. The Service cannot detect emergencies and does not contact anyone for you.

### 4.4 You control your training

You decide whether, how and how hard to exercise, and you are responsible for the following:
- warming up;
- using proper form, appropriate loads and safe, working equipment;
- having a spotter where appropriate;
- choosing a safe environment;
- staying within your own limits.

The exercise demonstrations are computer-generated animations meant to illustrate movement. They may not show every technique detail or suit your body or abilities.

Some programs are marked in the app as "Not yet reviewed by a qualified coach" (or by another named kind of professional). Treat that label as meaning what it says. Some exercise pages may include a video from YouTube or Vimeo that one of our administrators linked; those videos are made by third parties and are labelled as not reviewed by us.

### 4.5 Estimates are estimates

The Service produces approximations from the information you or your devices provide. They may be inaccurate, especially if inputs are incomplete or wrong. These estimates include:
- calories, macros and maintenance estimates;
- readiness, sleep and recovery scores;
- GPS distance, pace and splits;
- strength rankings;
- Food IQ or quality ratings (where enabled);
- progress comparisons.

Do not use them for medical decisions.

## 5. Assumption of risk

Exercise, running, walking, strength training, dietary change and weight change carry **inherent risks**. These include muscle, joint and soft-tissue injury, falls, cardiovascular events, and in rare cases serious injury or death. Outdoor activity adds risks from traffic, terrain, weather, animals and other people. To the extent permitted by law, you understand these inherent risks and **voluntarily choose to accept them** when you use the Service. This Section does not apply to risks caused by our gross negligence, recklessness, willful misconduct or fraud. It also does not apply where a law prohibits this kind of assumption of risk. [ATTORNEY REVIEW: primary assumption of risk is generally better received than an express release, but courts apply it to the inherent risks of the activity, not to a provider's negligence in designing content. Confirm the wording under the governing-law state and the major user states.]

## 6. Release and waiver (where permitted by law)

**To the fullest extent permitted by applicable law**, you release [LEGAL ENTITY NAME] and its owners, officers, employees and contractors from claims for personal injury, illness or property damage that arise from **the inherent risks of exercise, nutrition changes or outdoor activity** you choose to undertake while using the Service.

**This release does NOT apply to:**
- claims arising from our **gross negligence, recklessness, willful or intentional misconduct, or fraud**;
- claims arising from our violation of a statute or regulation;
- any right or claim that cannot be waived or released under applicable law.

**State-law notice.** Some states do not allow, or strictly limit, advance releases of liability for personal injury, or for negligence. In those states this Section applies only to the extent the law of your state permits, or does not apply at all. Examples include Virginia (*Hiett v. Lake Barcroft Community Ass'n*, 244 Va. 191 (1992)), Louisiana (La. Civ. Code art. 2004), and Montana (Mont. Code Ann. §28-2-702). In New York, Gen. Oblig. Law §5-326 voids certain releases given to paid recreational facilities. In California, Civil Code §1668 and *City of Santa Barbara v. Superior Court* (2007) bar releases for gross negligence, fraud, willful injury and violations of law. Nothing in these Terms limits liability that the law does not allow to be limited.

[ATTORNEY REVIEW: (1) decide whether an express negligence release belongs in an app's Terms at all. It carries high enforcement risk, it may undermine the credibility of the whole document, and a narrow assumption-of-risk clause plus the liability cap may achieve most of the benefit. (2) If it is kept, many states require express mention of "negligence" and conspicuous presentation. Consider a separate acknowledgment screen. (3) Whether NY §5-326 reaches a remote, app-based service is unsettled. (4) Consider whether the Tunkl "public interest" factors could apply to AI-generated individualized health guidance.]

## 7. AI Coach and other AI features

### 7.1 What the AI is

The AI Coach and the related features use a large language model provided by a third party, currently Anthropic's Claude. These features are:
- AI training plans;
- AI meal plans;
- food-photo and food-label-photo estimates;
- "Ask AI about this food";
- AI sleep coaching;
- the AI Bible study helper;
- the AI analysis in the weekly progress report.

AI output is generated automatically. **It is not written or reviewed by a human or by a licensed professional before you see it.** You are interacting with an AI, not a person.

### 7.2 Limits you must understand

- **AI may be wrong.** AI output can be inaccurate, incomplete, outdated, inconsistent or inappropriate for you, even when it sounds confident.
- **AI can misunderstand you.** It can misread or misapply:
  - your health information, injuries or limitations;
  - your experience level and equipment;
  - your food data and portion sizes;
  - your goals.
- **No professional relationship.** The AI is not any of the following, and using it does not create a relationship with any of them:
  - a physician or nurse;
  - a registered dietitian or licensed nutritionist;
  - a physical therapist;
  - a psychologist or counselor;
  - a certified trainer;
  - any other licensed professional.
- **Not diagnosis or treatment.** The AI does not diagnose, treat, cure or prevent any disease or condition. It does not provide medical nutrition therapy, rehabilitation plans, medication or supplement dosing for medical purposes, or interpretation of lab results.
- **Review before you act.** Review every suggestion before changing your workouts, diet or habits. Proposed changes to your plan, targets or memories take effect only when you confirm them in the app. Use your own judgment and stop if something seems wrong.
- **See a professional** for any medical condition, injury, pain, pregnancy, medication question, eating-disorder concern, or major change in diet or body weight. If you are struggling with disordered eating, contact a doctor or an eating-disorder support service. If you are thinking about harming yourself, call or text **988** (U.S.) or your local emergency number.
- **Food and nutrition estimates may be wrong.** Food-photo calorie estimates, AI meal plans and product explanations are approximations. Ingredients, portions, preparation and labels vary.
- **No guaranteed results.** We do not promise any particular result, such as weight loss, muscle gain, performance or health outcome.

### 7.3 Your consent and data

- AI features send the information they need to our AI provider **only after you allow it** on the AI consent screen.
- Meal photos and food-label photos need a **separate** consent. They are sent for that request only and are not stored by us.
- Data imported from Apple Health or Health Connect (imported steps, and sleep, sleep stages, overnight heart rate, heart-rate variability and breathing rate recorded by a watch, ring or phone) is sent to the AI provider **only if you turn on a separate setting**, "Share Apple Health / Health Connect data with the AI Coach", which is off by default. The name of your device is never sent.
- Sleep information and physical-limitation notes are sent only if you also gave wellness consent.
- A prayer-journal entry is sent only if you marked that entry "Share with AI Coach".
- You can withdraw AI consent at any time in Profile → Privacy & data. Withdrawing turns AI features off. It stops future sending; **it cannot recall what was already sent**.
- The Privacy Policy (Section 5) lists exactly what is sent. How long the AI provider keeps what it receives: [TO BE CONFIRMED — the AI provider's retention terms].

### 7.4 Acceptable AI use

Do not use the AI features to:
- seek emergency or medical treatment advice;
- get help with doping, extreme dieting, purging or dehydration protocols;
- generate unlawful, harmful or hateful content;
- try to extract system instructions or other users' data;
- manipulate the AI to bypass its safety limits;
- resell or automate access to the AI.

We may refuse, filter or limit AI responses. [ATTORNEY REVIEW: Anthropic's Usage Policy (version marked effective Nov 12, 2026, accessed 2026-10-26) treats "medical" recommendations, such as diagnosing or recommending or adjusting treatment, as high-risk. High-risk uses require a qualified human reviewer and disclosure. The Service must stay outside that category. The Policy also requires consumer chatbots to disclose that users are talking to AI. Confirm the in-app disclosure is adequate.]

### 7.5 Output ownership

As between you and us, you may use AI output for your personal, non-commercial purposes. Similar output may be generated for other users.

## 8. Nutrition, food data and allergens

- **General information only.** Nutrition features provide general, non-medical nutrition information for healthy adults. They are not individualized medical nutrition therapy for any disease or condition. These features are:
  - calorie and macro targets;
  - recipes;
  - meal plans and grocery lists;
  - food comparisons;
  - food quality information.
- **Do not use these features to manage a medical condition** unless a qualified professional supervising your care has approved it. Examples include diabetes, kidney disease, food allergies requiring strict avoidance, celiac disease, pregnancy, and eating disorders. [ATTORNEY REVIEW: state dietetics-licensure laws vary. Some states, such as Florida (Fla. Stat. ch. 468, part X), Ohio and Alabama, are characterized as strict. Keep features to general, non-individualized-MNT information, and do not use the titles "dietitian," "nutritionist" or "nutrition counselor."]
- **Calorie floor.** The Service does not set calorie targets below a minimum floor, and it caps deficits. Do not eat below safe levels without medical supervision.
- **Food data comes from third parties and users.** Product data for barcode scans, product searches and comparisons comes from Open Food Facts, a database built by volunteers. Generic food data comes from USDA FoodData Central. Other entries are foods written for the app or entered by you. Barcode, label and nutrient data may be missing, outdated or wrong, and a nutrient that a source does not list may be shown as zero. Always check the package.
- **Photo estimates are rough.** A calorie or macro estimate from a meal photo or a label photo is produced by AI from the image. It cannot see hidden ingredients, cooking fats or exact portions. Check and correct every item before you save it.
- **Allergens: no guarantee.** Allergy and dislike filters work by matching ingredient names. **Ingredient screening never guarantees that a food, recipe or meal plan is free of an allergen.** Allergen data may be incomplete, and products may contain undeclared allergens or cross-contact. **Always read the product label and confirm ingredients yourself.** If you have a serious allergy, follow your clinician's advice.
- **Supplements.** Any supplement information is general. Talk to a doctor or pharmacist before taking supplements, especially if you take medication, are pregnant or have a health condition.

## 9. GPS run and walk recording; outdoor safety

- Live GPS recording (Pro) uses your device's location **only while a recording you started is running**, including while your phone is locked or the app is in the background if you allow background location. It stops when you stop the recording. The Service keeps no location history outside your recorded runs and walks. [OWNER TO CONFIRM: recording with the screen locked was not verified on a physical phone (audit file 07, I-9).]
- **Stay aware of your surroundings.** Do not look at or interact with your phone while running or walking near traffic, crossing streets or on uneven ground. Obey traffic laws. Use well-lit, safe routes. Wear visible clothing. Tell someone where you are going, and carry identification.
- GPS distance, pace, splits and route maps are **estimates**. They can be affected by signal loss, buildings, trees, weather and device limits. They are not suitable for navigation, emergencies or competition timing.
- The Service is **not a safety or emergency-location service**. It does not share your live location with anyone and cannot summon help.
- Route maps are drawn from your recorded points. By default there is no third-party map background. [OWNER TO CONFIRM: a map-tile provider can be switched on by configuration (`NEXT_PUBLIC_MAP_TILE_URL`); none is configured in the repository.] Do not rely on route maps for directions.

## 10. Sleep, wearables and health-platform data

- If you connect Apple Health (iPhone) or Health Connect (Android), the Service **reads** the data types you allow on your device. It never writes to them. The types are:
  - steps;
  - sleep records;
  - overnight heart rate, heart-rate variability and respiratory rate.
- Third-party watches, rings and apps produce this data. We do not control its accuracy, completeness or availability. Sleep scores and readiness indicators are wellness estimates, not medical assessments. They cannot detect sleep disorders, heart conditions or other illnesses.
- You can disconnect at any time in your device settings. Disconnecting stops new imports; it does not delete what was already imported. You can delete imported sleep data in the app (Sleep & Recovery → Goal & privacy). Imported step counts are deleted when you delete your account.
- Health-platform data is not used for advertising and is not sold. It is sent to our AI provider only if you turn on the separate setting described in Section 7.3.
- Apple, Google and device makers are not responsible for the Service. Their own terms govern your use of their products.

## 11. Body Scan and progress photos

- Body Scan and progress photos are **optional** Pro features.
- Body Scan requires your separate consent before your first scan.
- Photos are stored in private storage at our hosting and storage provider (Supabase). In the app, only your account can open them, through short-lived links; administrator accounts in the app have no access to them. Before upload, they are resized on your device and location metadata is removed.
- Photos are **not** sent to the AI Coach or the AI provider, and no software analyses them. Body Scan stores your photos and shows them side by side; the on-screen outline is a fixed drawing.
- Body Scan **does not estimate body fat, body composition or any medical measurement**. It does not identify you by facial or body geometry. Measurements are the ones you enter yourself.
- Upload only photos **of yourself** that you have the right to use. Do not upload photos of other people, of minors, or of illegal content.
- You can delete individual photos or scans, or withdraw Body Scan consent to delete all scans, at any time.
- [ATTORNEY REVIEW: progress photos currently have an in-dialog privacy notice but no separate consent gate, unlike Body Scan. Decide whether to add one for consistency with the Privacy Policy.]

## 12. Faith & Discipline content

- The Faith & Discipline section is **optional**. You can use every fitness and nutrition feature without it, and you can turn faith content off.
- Its core features are included in the Free plan: the Bible reader (with reading history, highlights, bookmarks and notes), devotionals, studies, memory verses, the prayer journal, reading journeys, discipline practices, reminders and the 40-day challenge.
- The **AI Bible study helper is a Pro feature** and counts against the AI allowance in Section 3.3. Like all AI output, its answers can be wrong; check them against Scripture itself.
- Scripture quotations are from the **Berean Standard Bible (BSB)**, which has been dedicated to the public domain. [TO BE CONFIRMED — the BSB's public-domain dedication could not be checked against the publisher's own page during the 2026-11-16 audit (file 05, F-7).]
- Devotional and reflection content reflects a Christian perspective. It is offered for encouragement, not as pastoral counseling or as a substitute for your church community or a qualified counselor.
- **Prayer journal entries are private.** Administrator accounts in the app have no access to them. An entry is shared with the AI Coach only if you mark that entry "Share with AI Coach."
- Please use faith features respectfully. Do not use them to post content that is hateful toward any person or faith.
- [ATTORNEY REVIEW: confirm that religious content and the "Narrow Gate" branding raise no consumer-protection or trademark issues (see `docs/launch-audit/C_TRADEMARKS.md`).]

## 13. Acceptable use

You agree **not** to:
- break any law, or infringe anyone's rights;
- use the Service if you are under 18;
- access another person's account or data, or try to;
- probe, scan or test the Service's security, except through a coordinated disclosure we authorize at [SECURITY CONTACT];
- reverse-engineer, scrape, crawl or copy the Service, the exercise library, programs or content at scale;
- interfere with the Service, overload it, or bypass rate limits, plan limits or AI allowances;
- upload malware or unlawful, infringing, harassing, sexually explicit or hateful content;
- upload images of other people without their consent, or any images of minors;
- resell, sublicense or commercially exploit the Service, including using it to provide paid coaching to others, without our written permission;
- misrepresent your age or identity, or create accounts in bulk;
- use the Service to develop a competing product or to train AI models.

### 13.1 Friends: conduct between members — [DRAFT FOR ATTORNEY REVIEW — NOT YET IN FORCE]

> **Not in force.** The Friends feature is switched off and its code is not part of the current release. Challenges between members have not been built. These terms are a draft for counsel. They take effect only if the owner switches Friends on after counsel has approved them and members have accepted them. Facts: audit file 08. Procedure: `docs/legal/MODERATION_AND_USER_CONTENT_POLICY_DRAFT.md`.

If Friends is switched on, the following would apply.

- **What other members can see.** Your username; between friends, your display name; and, while your "show workouts" switch is on, the number of workouts you completed in the last 7 days and your streaks. The Privacy Policy (Section 16) has the full description. Members cannot send each other free text.
- **Usernames and display names.** Your username and display name must not:
  - impersonate another person, or suggest you are Narrow Gate Fitness staff, support or an administrator;
  - contain hateful, harassing, sexually explicit, threatening or unlawful words;
  - contain someone else's personal information, or contact details meant to move a conversation elsewhere;
  - advertise or promote a product or service.
- **Requests and invites.** Do not send repeated friend requests to someone who has not accepted. Do not post an invite link publicly: whoever opens it and signs in becomes your friend at once.
- **Harassment.** Do not use search, requests, invites, blocks or reports to harass, stalk, pressure or single out another member.
- **Reports.** Report only in good faith. Do not file false or repeated reports. Do not put another person's sensitive information in a report beyond what is needed to explain the problem.
- **Minors.** The Service is for adults only (Section 2.1). Do not use Friends to contact anyone you believe is under 18; report the account instead.
- **What we may do.** We may change or remove a username or display name that breaks these rules, remove a friendship, restrict a member's use of Friends, or suspend or close an account under Section 18. [OWNER DECISION: which of these actions will actually be offered. As of 2026-11-16 the app has no in-app tool to suspend a member or change a name; administrators can only read and close reports.]
- **Blocking.** You can block any member. They are not told. We do not promise that a blocked member cannot work out that they were blocked.
- **No duty to monitor.** [ATTORNEY REVIEW: decide what, if anything, to say about monitoring, response times and liability for other members' conduct. No response time has been decided: [OWNER DECISION: report review and response times]. Apple guideline 1.2 and Google Play's user-generated-content policy set expectations for reporting, blocking, filtering and published contact details (audit file 09).]

## 14. Subscriptions, auto-renewal and billing

### 14.1 Automatic renewal

**Pro subscriptions renew automatically** at the end of each billing period (monthly or yearly). The renewal is charged at the then-current price to your payment method or store account, **until you cancel**. You authorize these recurring charges when you subscribe. Before you subscribe, the checkout or purchase screen shows:
- the price;
- the billing period;
- that the subscription renews automatically;
- how to cancel.

[ATTORNEY REVIEW: ROSCA (15 U.S.C. §8403) and state ARLs require clear and conspicuous disclosure **before** billing information is obtained, plus express informed consent. California additionally requires an acknowledgment, simple online cancellation, annual reminders and verification of consent (Bus. & Prof. Code §§17600–17606, as amended by AB 2863, effective July 1, 2025). On committed HEAD the renewal language is a footnote below the plan cards. The in-progress redesign (`src/components/profile/web-membership.tsx`) puts the price on the button and the renewal terms and Terms links in the plan footer. Neither version records consent or sends an acknowledgment email or an annual reminder. See FINAL_PRIVACY_AND_LEGAL.md §6.] [Update 2026-11-16, not part of the note above: website checkout now requires an unticked box reading "I agree that Pro All Access renews automatically at {price} per {period} until I cancel, and that I can cancel any time in Manage billing", and records the agreed text with the plan, price and period. Still true: the app sends no purchase acknowledgment email and no renewal reminder, and it records nothing for App Store or Google Play purchases, which use the store's own purchase sheet. The auto-renewal record is deleted when the account is deleted.]

### 14.2 Where you buy determines who bills you

| You subscribed… | Billed by | Manage / cancel | Refunds |
|---|---|---|---|
| On our website | Stripe, on our behalf | Profile → Plans & billing → **Manage billing** (Stripe customer portal), online, any time | Per Section 14.5 |
| In the iOS app | **Apple** (App Store) | Your Apple Account → Subscriptions (iPhone Settings → [your name] → Subscriptions) | Requested from **Apple** under Apple's policies; we cannot issue App Store refunds |
| In the Android app | **Google** (Google Play) | Google Play → Payments & subscriptions → Subscriptions | Requested from **Google** under Google Play's policies |

If you subscribe through more than one channel, each subscription bills separately. Cancel the one you do not want. The app tries to prevent duplicate purchases but cannot cancel a subscription bought through a different channel.

**Restore Purchases.** If you subscribed through the App Store or Google Play and your Pro access does not appear (for example on a new phone or after reinstalling), use **Restore purchases** on the plans screen in the app, or on the website's Plans & billing page. It re-checks your store purchases and updates your plan. It does not charge you and does not start a new subscription. The plans screen in the app also has a **Manage subscription** link that opens your store's subscription settings.

### 14.3 Cancellation

- You can cancel at any time.
- Cancellation stops future renewals. You keep Pro access until the end of the period you have already paid for.
- For App Store subscriptions, cancel at least 24 hours before the period ends to avoid the next renewal, under Apple's rules.
- **Where to cancel:** an App Store subscription in your Apple Account; a Google Play subscription in Google Play; a website subscription through the **Manage billing** link on the website (Profile → Plans & billing), which opens the Stripe customer portal.
- **Removing the app from your phone cancels nothing.** It does not cancel a website subscription or a store subscription, and it does not delete your account.

### 14.4 Account deletion and subscriptions

- When you delete your Narrow Gate Fitness account in the app, **we cancel any website (Stripe) subscription first**. If that cancellation fails, nothing is deleted and you are told so.
- **We cannot cancel an App Store or Google Play subscription.** You must cancel it yourself in your Apple or Google account. If you don't, the store may keep charging you after your account is deleted. The deletion screen warns you about this.

### 14.5 Refunds for website (Stripe) purchases

[OWNER TO DECIDE refund policy. Example options for counsel: (a) no refunds for partial periods except where required by law; (b) a full refund if requested within [X] days of the first charge; (c) pro-rated refunds for yearly plans.] Where the law of your state or country gives you a right to cancel and receive a refund, that right applies regardless of this Section. [ATTORNEY REVIEW: some states require a posted refund policy, or default to a refund right if none is conspicuously posted (for example Cal. Civ. Code §1723 for retail stores; applicability to online subscriptions should be checked). Ensure the policy is shown before purchase.]

### 14.6 Failed payments

- If a renewal payment fails, Stripe or the store may retry the payment.
- During a retry or grace period you may keep access.
- If payment is not completed, your account returns to Free.
- Your data is not deleted when this happens.

### 14.7 Price changes

We may change subscription prices for future billing periods. We will give you advance notice of any increase that affects an existing subscription:
- at least [OWNER TO DECIDE — e.g. 30] days by email and in the app, for website subscriptions;
- for store subscriptions, according to the store's price-increase process.

The new price applies from your next renewal after the notice period. You can cancel before then. [ATTORNEY REVIEW: Apple and Google have their own price-increase consent and notice flows. California requires clear and conspicuous notice of material changes.]

### 14.8 Promotions and trials

**No free trial is offered today.** Website checkout accepts promotion codes. If we offer a free trial or promotional price, its terms will be shown before you sign up. These include:
- its length;
- the price after it ends;
- when you will first be charged;
- how to cancel before conversion.

[ATTORNEY REVIEW: no trials exist in code today. Stripe checkout has `allow_promotion_codes: true`. Note that California's 2025 amendments expressly cover free-to-pay conversions.]

### 14.9 Taxes

You are responsible for any applicable sales, use or similar taxes, unless we are required to collect them.

## 15. Third-party services

- The Service relies on or links to third parties. These include:
  - Apple and Google, including their app stores and health platforms;
  - Stripe;
  - RevenueCat;
  - Supabase;
  - Anthropic;
  - Open Food Facts;
  - USDA FoodData Central;
  - our hosting provider [HOSTING PROVIDER];
  - our email delivery provider for account emails [EMAIL DELIVERY PROVIDER — OWNER TO CONFIRM; not yet chosen];
  - YouTube, through an optional "search for form videos" link that opens outside the app;
  - YouTube or Vimeo, where an exercise page includes an embedded video that one of our administrators linked.
- We are not responsible for third-party services, their availability, or their content. Your use of them may be subject to their own terms and privacy policies.

## 16. Your content and data

- **You own your content.** You keep ownership of your content, including:
  - workouts and logs;
  - journal and prayer entries;
  - photos;
  - notes and messages.
- **License to us.** You give us a limited, non-exclusive, worldwide, royalty-free license to host, store, process, transmit and display your content. This license is **only** to operate, secure and provide the Service to you, as described in the Privacy Policy. It ends when you delete the content or your account, except for backups kept for the limited time stated in the Privacy Policy. We do not sell your content. We do not use it for advertising or to train AI models. [ATTORNEY REVIEW / OWNER: confirm "no AI training." Anthropic's Commercial Terms (effective June 17, 2025) state that Anthropic may not train models on customer content from its services.]
- **Export and deletion.** You can export your data (Profile → Privacy & data → Export) and delete your account at any time. The Privacy Policy explains how, and so does the public page `/legal/delete-account` [DELETE-ACCOUNT PAGE URL — full web address to be supplied once the production domain is confirmed].
- **Responsibility.** You are responsible for content you upload, and for having the rights to it.
- **Who can see your content.** Today, everything you create in the Service is private to your account; no other member can see any of it. If the Friends feature is switched on, a username, your display name and limited workout figures would be visible to other members as described in Section 13.1 and the Privacy Policy.

## 17. Our intellectual property

- **Our content.** The Service and its content belong to us or our licensors and are protected by intellectual-property laws. Our content includes:
  - the software;
  - design;
  - the exercise library and animations;
  - programs;
  - devotionals;
  - badge artwork;
  - text;
  - trademarks such as "Narrow Gate Fitness".
- **License to you.** We grant you a personal, limited, non-exclusive, non-transferable, revocable license to use the Service for your own non-commercial fitness and wellness purposes, under these Terms.
- **Third-party materials.** The Service includes third-party materials under their own licenses:
  - Berean Standard Bible text (public domain);
  - Open Food Facts data (Open Database License; the database contents are under the Database Contents License; images under CC BY-SA);
  - USDA FoodData Central data (CC0 / public domain) [TO BE CONFIRMED — the USDA licence and citation terms could not be checked against USDA's own pages during the 2026-11-16 audit (file 05, F-7)]. USDA does not endorse the Service;
  - open-source software components;
  - bundled fonts (SIL Open Font License).

  Attribution and license notices are available in the app at Profile → Notices & licenses (the `/legal/notices` page). [ATTRIBUTIONS / OPEN-SOURCE NOTICES URL — the public web address of that page is to be supplied once the production domain is confirmed.] [ATTORNEY REVIEW: audit file 05 found the notices page incomplete (for example, no copy of or link to the MPL-2.0 text, and open-source licence notices are not reproduced); how Open Food Facts data kept in members' diaries and the app's food tables should be classified under the Open Database License is an open question for counsel (file 05, F-2).] [ATTORNEY REVIEW: an in-app notices screen is recommended. `@capgo/capacitor-health` is MPL-2.0, which carries file-level source-availability obligations.]
- **Feedback.** If you send us suggestions, we may use them without obligation to you.
- **Copyright complaints.** Send notices of claimed infringement to [DMCA AGENT NAME AND ADDRESS]. [ATTORNEY REVIEW: register a DMCA designated agent with the U.S. Copyright Office if user uploads are hosted. Uploads here are private, so the benefit of registering is limited, but registration is inexpensive.]

## 18. Suspension and termination

- You may stop using the Service and delete your account at any time.
- We may suspend or close your account, or limit features, if:
  - you materially breach these Terms;
  - we must do so by law;
  - your use creates a risk to others or to the Service.
- Where reasonable, we will give notice and a chance to fix the problem.
- If we close your account without cause, we will refund any prepaid website (Stripe) subscription fees for the unused period. [ATTORNEY REVIEW: confirm.]
- Sections that by their nature should survive will survive termination. These include Sections 5–6, 7.2, 8, 16–17, 19–23 and 25.

## 19. Disclaimer of warranties

**TO THE FULLEST EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE."** We disclaim all warranties, express or implied, including any implied warranties of **merchantability**, fitness for a particular purpose, title, non-infringement and accuracy. We do **not** warrant that:
- the Service, AI output, food data, GPS data, sleep data or estimates will be accurate, complete, reliable or current;
- the Service will be uninterrupted, secure or error-free;
- you will achieve any particular fitness, weight, health or spiritual result.

**Some states do not allow the exclusion of implied warranties. In those states, some or all of the above exclusions may not apply to you, and any implied warranty is limited to the shortest period the law allows.** [ATTORNEY REVIEW: UCC §2-316 requires a merchantability disclaimer to mention "merchantability" and, if written, to be conspicuous. UCC Article 2 may not apply to a software subscription, but conspicuousness is still prudent. Several states restrict implied-warranty disclaimers in consumer transactions, for example Massachusetts, Maryland, Vermont, Kansas, Mississippi, West Virginia, Maine and D.C.; confirm the current list. The Magnuson-Moss Warranty Act (15 U.S.C. §2308) bars disclaiming implied warranties only where a written warranty or service contract is given for a consumer product. We give none, but do not add any "guarantee" marketing.]

## 20. Limitation of liability

**TO THE FULLEST EXTENT PERMITTED BY LAW:**

(a) We will not be liable for any **indirect, incidental, special, consequential, exemplary or punitive damages**, or for lost profits, lost data, or loss of goodwill, arising out of or related to the Service or these Terms.

(b) Our **total liability** for all claims arising out of or related to the Service or these Terms is limited to the **greater of (i) the amounts you paid us for the Service in the 12 months before the event giving rise to the claim, or (ii) US $100**.

(c) **These limits do NOT apply to:**
- liability for death or personal injury caused by our gross negligence, recklessness or willful misconduct;
- fraud or fraudulent misrepresentation;
- our violation of a law that does not permit limitation;
- any other liability that cannot be limited or excluded under applicable law.

These limits apply whatever the legal theory, and even if we were advised of the possibility of the damages. **Some states do not allow the exclusion or limitation of incidental or consequential damages, so some of these limits may not apply to you.**

[ATTORNEY REVIEW: (1) A cap tied to fees paid may be found unconscionable for personal-injury claims in some states. Consider carving personal injury caused by our negligence out of the cap entirely, or confirm the approach under the governing law. (2) New Jersey's Truth-in-Consumer Contract, Warranty and Notice Act (N.J.S.A. 56:12-14 et seq.) penalizes consumer-contract provisions that violate clearly established rights. "Some states do not allow" language may not by itself cure this. Consider NJ-specific wording. (3) Amounts paid to Apple or Google count as "amounts you paid" for this purpose.]

## 21. Indemnity

To the extent permitted by law, you will defend and indemnify us against third-party claims arising from:
- content you upload in violation of these Terms; or
- your willful misuse of the Service or violation of law.

This does not apply to claims caused by our own acts or omissions. [ATTORNEY REVIEW: consumer indemnities are disfavored and rarely useful. Consider deleting this Section or keeping it this narrow.]

## 22. Dispute resolution; individual arbitration; class-action waiver

[ATTORNEY REVIEW — WHOLE SECTION: decide **whether to use arbitration at all**. For a small consumer subscription business, the risks include the following:
- mass-arbitration fee exposure: the AAA Mass Arbitration Supplementary Rules and the business-side fee schedule (2024) mean many simultaneous claims can generate large business-paid fees;
- California's *McGill* rule on public injunctive relief;
- severability fights. In *Heckman v. Live Nation*, 120 F.4th 670 (9th Cir. 2024), the court refused to sever an unconscionable mass-arbitration protocol, and certiorari was denied on Oct. 6, 2025.

Alternatives counsel may prefer:
- courts plus small claims, with a jury waiver where enforceable;
- arbitration with a well-drafted batching provision under an established provider's rules (AAA Consumer Rules or JAMS Consumer Minimum Standards).

The draft below assumes arbitration is kept. Its supporting authority:
- the FAA (9 U.S.C. §§1–16);
- *AT&T Mobility LLC v. Concepcion*, 563 U.S. 333 (2011), on class waivers in consumer arbitration;
- *Epic Systems Corp. v. Lewis*, 584 U.S. 497 (2018), on the employment context, which confirms the FAA's strong enforcement policy.]

### 22.1 Informal resolution first

Before starting arbitration or a court case, the party with the claim must send a written notice to the other party. The notice must include:
- the claimant's name, account email and contact details;
- a description of the dispute;
- the relief sought.

Send notices to us at [LEGAL NOTICE EMAIL] and [POSTAL ADDRESS]. We will send notices to you at your account email. Both sides will try in good faith to resolve the dispute for **60 days** after the notice is received. Within that period, either side may ask for an individual phone or video conference, and you may bring a lawyer. Deadlines to bring claims are paused (tolled) during this period. [ATTORNEY REVIEW: pre-dispute conference requirements have been upheld in some courts but criticized when used to delay claims. Keep them short and mutual.]

### 22.2 Agreement to arbitrate

If the dispute is not resolved, **you and we agree to resolve any dispute arising out of or relating to these Terms or the Service by binding individual arbitration**, except as provided in Section 22.4. "Dispute" includes disputes about the scope or enforceability of this agreement to arbitrate, which the arbitrator decides. However, a court decides:
- disputes about the class-action waiver (22.5) and the public-injunctive-relief carve-out (22.6);
- disputes about the batching provision (22.7);
- disputes about whether the informal-resolution step was followed.

The Federal Arbitration Act governs this Section.

### 22.3 Rules, fees and location

- **Provider.** The arbitration will be administered by [ARBITRATION PROVIDER — e.g. the American Arbitration Association (AAA) under its Consumer Arbitration Rules, or JAMS under its Streamlined Arbitration Rules and Consumer Minimum Standards] in effect when the claim is filed. [OWNER/ATTORNEY TO DECIDE provider.]
- **Fees.** We will pay all filing, administration and arbitrator fees beyond the amount you would pay to file a claim in court, unless the arbitrator finds your claim frivolous or brought for an improper purpose.
- **Hearing.** The arbitration will take place by video or phone, or in person in the county where you live, as you choose. For claims under [US $25,000], it may be decided on written submissions if you choose.
- **Remedies.** The arbitrator may award the same individual relief a court could award, including statutory damages and attorney's fees where the law provides for them.

### 22.4 Exceptions: small claims and agency complaints

Either party may bring an individual claim in **small-claims court** if it qualifies and stays there. Nothing in this Section prevents you from reporting concerns to, or seeking relief through, any federal, state or local government agency, such as the FTC or your state attorney general. Either party may also go to court to stop infringement or misuse of intellectual property.

### 22.5 Class-action and jury waiver

**To the extent permitted by law, you and we each may bring claims against the other only in an individual capacity, not as a plaintiff or class member in any purported class, collective, consolidated or representative proceeding.** The arbitrator may not consolidate claims or preside over any form of class or representative proceeding. **If this Section 22 does not apply, you and we waive any right to a jury trial, to the extent permitted by law.** [ATTORNEY REVIEW: pre-dispute jury waivers are unenforceable in some states, for example California (*Grafton Partners v. Superior Court*, 36 Cal.4th 944 (2005)) and Georgia. Condition the jury waiver accordingly.]

### 22.6 Public injunctive relief

Nothing in these Terms waives any right you have to seek **public injunctive relief** where that right cannot be waived under applicable law, for example under *McGill v. Citibank, N.A.*, 2 Cal.5th 945 (2017). Any such claim will be decided by a court after the individual claims are arbitrated, and the court action will be paused until then.

### 22.7 Mass filings

If 25 or more similar demands are filed by or with the help of the same or coordinated counsel, they will be administered under the provider's mass-arbitration rules. [ATTORNEY REVIEW: draft any batching or bellwether language conservatively. *Heckman* found a provider's bellwether protocol unconscionable. Use the provider's own published supplementary rules rather than a custom protocol.]

### 22.8 30-day opt-out

**You may opt out of this agreement to arbitrate within 30 days after you first accept these Terms.** To opt out, email [OPT-OUT EMAIL] from your account email with the subject "Arbitration Opt-Out" and your name. Opting out does not affect any other part of these Terms, or any earlier arbitration agreement with us. [ATTORNEY REVIEW: consider also accepting opt-outs by mail, and recording them.]

### 22.9 Changes to this Section

If we materially change this Section 22, the change will not apply to:
- a dispute we had notice of before the change; or
- if you reject the change within 30 days, any dispute at all.

### 22.10 Severability of this Section

If the class-action waiver in 22.5 is found unenforceable for a claim, then that claim, and only that claim, must proceed in court and not in arbitration. Any other provision of Section 22 that is found unenforceable will be severed, and the rest will remain in effect.

## 23. Governing law and venue

These Terms are governed by the laws of the State of [GOVERNING-LAW STATE] and applicable U.S. federal law, including the Federal Arbitration Act, without regard to conflict-of-law rules. Consumer-protection laws of your state of residence that cannot be waived by contract still apply to you. Any claim not subject to arbitration will be brought in the state or federal courts located in [COUNTY, STATE], except that you may bring a claim in the courts of your county of residence where the law gives you that right. [ATTORNEY REVIEW: several states restrict forum-selection clauses in consumer contracts. The choice of governing law affects the enforceability of the release, the cap and the arbitration clause.]

## 24. Changes to these Terms

We may update these Terms. If a change is **material**, such as a change to prices for current subscribers, plan features, the AI allowance, dispute resolution or how we use data, we will notify you at least [OWNER TO DECIDE — e.g. 30] days before it takes effect. Notice will be given by email and/or in the app. Material changes apply from the effective date shown in the notice. For a current subscription, a material change to its price or features applies from the next renewal after the notice period. You can cancel before then. Other changes take effect when posted, and the "Version" date above will change. If you keep using the Service after a change takes effect, you accept it. If you do not agree, stop using the Service and cancel your subscription. [ATTORNEY REVIEW: courts have refused to enforce "continued use" modification clauses without actual notice. The app should record each user's acceptance of new versions of the Terms, as noted in Section 1.1.]

## 25. General terms

- **Entire agreement.** These Terms, the Privacy Policy and the documents referenced in Section 1.2 are the entire agreement between you and us about the Service.
- **Severability.** If any provision is found unenforceable, it will be modified to the minimum extent necessary to make it enforceable, or severed if that is not possible. The rest of these Terms remains in effect. Section 22.10 applies to Section 22.
- **No waiver.** Our failure to enforce a provision is not a waiver of it.
- **Assignment.** You may not assign these Terms. We may assign them in connection with a merger, acquisition or sale of assets, with notice to you.
- **Force majeure.** We are not responsible for delays or failures caused by events beyond our reasonable control.
- **Notices.** We may send you notices by email or in the app. Legal notices to us go to [LEGAL NOTICE EMAIL] and [POSTAL ADDRESS].
- **Export and sanctions.** You represent that you are not barred from receiving the Service under U.S. law.
- **Consumer rights.** Nothing in these Terms limits rights you have as a consumer that cannot be waived or limited by contract.

## 26. Additional terms for Apple App Store users (custom EULA minimum terms)

[ATTORNEY REVIEW: include this Section only if a custom EULA is used. Confirm it against the current Apple Developer Program License Agreement, Schedule 1/2 and the "minimum terms" for custom EULAs.]

- These Terms are between you and [LEGAL ENTITY NAME] only, not Apple. We, not Apple, are solely responsible for the app and its content.
- Your license to use the app is limited to Apple-branded devices you own or control, as permitted by the App Store Usage Rules.
- Apple has no obligation to provide maintenance or support for the app.
- If the app fails to conform to any applicable warranty, you may notify Apple, and Apple will refund the purchase price, if any, of the app. To the maximum extent permitted by law, Apple has no other warranty obligation for the app.
- We, not Apple, are responsible for addressing any claims relating to the app, including product-liability claims, claims that the app fails to conform to legal or regulatory requirements, and consumer-protection, privacy or similar claims.
- We, not Apple, are responsible for investigating, defending, settling and discharging any third-party claim that the app infringes intellectual-property rights.
- You represent that you are not located in a country subject to a U.S. Government embargo or designated as "terrorist supporting," and that you are not on any U.S. Government list of prohibited or restricted parties.
- You must comply with applicable third-party terms when using the app.
- Apple and its subsidiaries are third-party beneficiaries of these Terms and may enforce them against you.
- Questions, complaints or claims about the app go to [LEGAL ENTITY NAME], [POSTAL ADDRESS], [SUPPORT EMAIL].

## 27. Contact

[LEGAL ENTITY NAME]
[POSTAL ADDRESS]
Support: [SUPPORT EMAIL]
Legal notices and arbitration opt-out: [LEGAL NOTICE EMAIL]
