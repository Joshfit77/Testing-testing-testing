# 10 — Health, nutrition and AI claims audit

**Narrow Gate Fitness · prelaunch audit · 2026-11-16 · branch `claude/friends-challenges`**

Readers: the founder and US counsel.

**What this is.** A sweep of the wording members and the public will see, checked against what the code does and what substantiation the repository holds. It was prepared by an AI assistant, not a lawyer, coach, dietitian, physician, physiotherapist or theologian. It records statements and concerns as facts; it draws no legal conclusions. No feature or wording was changed.

## Summary

- **The wording is already cautious.** No "guaranteed", "clinically proven", "doctor-recommended", "lose X in Y" or "burn fat" promises were found. No testimonials, ratings, user counts or "trusted by" lines exist. No competitor is named in member-facing copy. Body Scan says outright that it does not estimate body fat. No "AI checks your form" feature is exposed.
- **One statement contradicts the code:** onboarding says age, sex, height and weight are "Never shared", but they are sent to the AI provider once the member allows the AI Coach.
- **Statements that depend on who can reach the database:** "Our team and admins can't view them" (Body Scan photos) and "Administrators can't" (prayer journal) are true of the app's own screens and access rules; whoever holds the hosting and database credentials can technically read stored data. Needs qualifying or confirming with the security workstream.
- **Content nobody qualified has reviewed:** the AI coach's built-in coaching, nutrition, pain-workaround and supplement knowledge; the supplement list with evidence ratings and health-benefit phrases; the calorie method and floors; many programs. The repository says so itself in several places.
- **Marketing phrases to look at:** "AI personal coaching", "sleep coaching", "Free forever plan", "Faith is always free", "Programs that adapt", "precise workout tracking", "Shaped by feedback from women lifters", and a few "Research shows…" lines in program descriptions.

## 1. Scope and method

**Swept:** `src/app/**`, `src/components/**`, message strings in `src/lib/domain/**`, `src/data/**` (programs, habit programs, exercises, supplements, content; Scripture text and devotionals were searched by pattern, not read in full), the AI coach prompt (`src/lib/coach/knowledge.ts`, `prompt.ts`), the Bible helper prompt (`src/lib/bible/ai.ts`), notification copy (`src/lib/notifications/catalog.ts`), onboarding, paywall and membership copy, the public welcome page (`src/app/page.tsx`), `README.md` and `docs/PRESENTATION_GUIDE.md`.

**How:** pattern searches for each category in the brief (guarantee, proven, clinical, science, expert, certified, personal trainer, doctor, dietitian, body fat, form, accurate, precise, never shared, private, encrypted, secure, anonymous, free forever, competitor names, testimonial, ratings, prevent, heal, cure, rehab, disease names, supplement terms, weekly weight-change figures), then reading the surrounding text.

**Limits.** Roughly 220 exercises, several dozen programs, the recipe set and the devotionals were pattern-searched, not read line by line. AI output is generated at run time and cannot be audited from source; only its instructions were read. Store listing text does not exist yet.

**Recommendation values:** KEEP · QUALIFY · NEEDS SUBSTANTIATION · NEEDS LICENSED-PROFESSIONAL REVIEW (who) · REMOVE-CANDIDATE.

## 2. Statements found

### 2.1 AI coaching and personalisation

| # | Exact quote | File:line | Where the user sees it | Concern, stated factually | Substantiation in repo | Recommendation | Counsel |
|---|---|---|---|---|---|---|---|
| 1 | "AI personal coaching" | `src/components/profile/membership-plans.tsx:27`; `src/lib/domain/membership.ts:27`; `src/lib/domain/plans.ts:182` | Paywall, plan comparison, public pricing | "Personal coaching" may be read as a human or a qualified coach. The word "AI" is present. No credential is claimed. | Coach uses the member's own log (`src/lib/coach/context.ts`). | QUALIFY (for example "AI coaching from your own log") | Y |
| 2 | "Personalized coaching from your goals, program, workouts, food log and bodyweight." | `src/app/(app)/coach/page.tsx:137` | AI Coach screen header | Factual description of inputs. | `context.ts:238-340` | KEEP | N |
| 3 | "AI meal plans, food-photo analysis and sleep coaching" | `membership.ts:31` | Plan comparison | "Sleep coaching" may imply sleep therapy. The coach is instructed to quote the member's own figures and not compare with norms (`knowledge.ts:271`). | Sleep method documented (`docs/SLEEP_METHOD.md`, in-app method page) | QUALIFY ("sleep insights from your own log") | Y |
| 4 | "Personalized AI workout plans, saved only when you approve" | `membership.ts:30` | Plan comparison | Accurate as to approval step. Plans are AI-generated and not individually reviewed by a qualified coach. | Validation schema `src/lib/validation/ai.ts` | KEEP; consider "AI-generated" | N |
| 5 | "Ask about technique, progression and recovery using your own log. Suggested changes are saved only when you approve them." | `src/app/page.tsx:23` | Public welcome page | "Recovery" and "technique" advice from an AI; no credential claimed. | — | KEEP | N |
| 6 | System prompt: "You are the Narrow Gate Fitness coach: an experienced strength & conditioning and nutrition coach inside a training app." | `src/lib/coach/knowledge.ts:16` | Not shown to members; shapes every answer | The model is told to adopt an experienced-coach persona. It is also told it is "not a doctor, physiotherapist, dietitian or psychologist" (`:29`). The persona could lead it to describe itself as experienced or qualified. | — | QUALIFY the prompt (add: never claim human experience, qualifications or certification); test with the live-AI plan in `docs/LIVE_AI_TEST_PLAN.md` | Y |
| 7 | "Adaptive training adjustments and deload guidance"; "Programs that adapt" | `membership.ts:46`; `src/app/page.tsx:21` | Plan comparison; public welcome page | On the welcome page "Programs that adapt" is followed by "matched to your goals and equipment". Adaptive adjustments are a Pro feature and each change needs the member's acceptance. A Free visitor may read it as automatic adaptation for everyone. | `src/lib/domain/adaptive-training.ts`; disclaimer at `src/components/train/training-review.tsx:319` | QUALIFY | N |
| 8 | "AI Bible study helper (answers from Scripture, every passage shown)" | `membership.ts:87` | Plan comparison | Religious-content claim about source fidelity. The helper is told to separate text from interpretation and not take denominational sides (`src/lib/bible/ai.ts:55-58`). | Prompt rules; `docs/faith/` review notes | NEEDS LICENSED-PROFESSIONAL REVIEW (theologian) for the helper's instructions | N |

### 2.2 Medical advice, injury, rehab, disease

| # | Exact quote | File:line | Where seen | Concern | Substantiation | Recommendation | Counsel |
|---|---|---|---|---|---|---|---|
| 9 | Coach prompt: "Ordinary training pain: a 'traffic light' rule is fine — pain that stays ≤3/10, doesn't change the movement and settles within 24 hours is usually tolerable; anything sharper, or worsening, means modify or stop and get it assessed." | `knowledge.ts:31` (short form `:258`) | Shapes AI answers | A pain-triage rule given by software. The same block tells the coach never to diagnose or present advice as treatment or rehab (`:29`). | None cited in the prompt | NEEDS LICENSED-PROFESSIONAL REVIEW (physiotherapist or physician) | Y |
| 10 | Coach prompt: "By complaint (pain-free alternatives; never a diagnosis, and only if there are no red flags): Irritated shoulder when pressing… Knee discomfort when squatting… Wrist pain…" | `knowledge.ts:94-100` | Shapes AI answers | Exercise substitutions organised by symptom. Framed as alternatives, not treatment. Sits close to the line between general fitness guidance and injury management. | None cited | NEEDS LICENSED-PROFESSIONAL REVIEW (physiotherapist) | Y |
| 11 | Coach prompt red-flag list ("chest pain or pressure, fainting… dark urine after very hard training (possible rhabdomyolysis)… → stop training and see a medical professional") | `knowledge.ts:30`, `:257` | Shapes AI answers | A referral rule; names a condition as "possible". The list's completeness has not been reviewed by a clinician. | None cited | NEEDS LICENSED-PROFESSIONAL REVIEW (physician) | Y |
| 12 | "fast rising builds the power that prevents falls"; "speed builds the power that helps prevent falls" | `src/data/programs.ts:1723`, `:3336` | Program description and exercise note (older-adult program) | Injury-prevention claim; the first is unqualified ("prevents"). Same description cites WHO guidelines for adults 65+. | `docs/PROGRAM_RESEARCH.md` (not reviewed by a qualified coach, per its first paragraph) | QUALIFY ("may help") and NEEDS SUBSTANTIATION | Y |
| 13 | "hamstring and groin injury-prevention work, and neck training (stronger necks are associated with lower concussion risk in observational research)" | `programs.ts:2521-2522` | Combat-sport program description | Injury-prevention and concussion-risk statements. The second is hedged as observational. | `docs/PROGRAM_RESEARCH.md` — check that the concussion source is recorded | NEEDS SUBSTANTIATION; NEEDS LICENSED-PROFESSIONAL REVIEW (coach / sports physician) | Y |
| 14 | "Sustainable activity to support fat loss and heart health." | `programs.ts:131` | Program category description | General wellness wording ("support… heart health"). | — | KEEP (general wellness); counsel to confirm | Y |
| 15 | "Walking is one of the simplest ways to care for your health. It helps your heart, mood and recovery from training" | `src/data/habit-programs/faith-fitness-foundations.ts:105` | Habit program lesson | General wellness statement. | — | KEEP | N |
| 16 | "Health benefits keep rising up to roughly 7,000–10,000 steps a day for most adults" | `src/data/habit-programs/sustainable-fat-loss.ts:139` | Habit program lesson | Quantified health statement with no source shown to the member. | Not found in a cited form | NEEDS SUBSTANTIATION (record the source) | N |
| 17 | "Collagen + vitamin C… May support tendons and ligaments during rehab or jumping work." | `src/data/supplements.ts:235` | Supplements page; coach knowledge | Uses the word "rehab" for a supplement. Rated "Limited evidence". | Header says doses come from position stands and NIH ODS (`supplements.ts:3-6`); no per-item citation | QUALIFY (drop "rehab") | Y |

### 2.3 Nutrition prescriptions, calorie targets, vulnerable users

| # | Exact quote | File:line | Where seen | Concern | Substantiation | Recommendation | Counsel |
|---|---|---|---|---|---|---|---|
| 18 | "These targets are estimates based on bodyweight and goal — adjust them to suit you." / "Estimates are general guidance, not dietary advice. If you have a medical condition, are pregnant, or have a history of disordered eating, consult a registered dietitian or physician." | `src/components/nutrition/nutrition-client.tsx:897`, `:928-929` | Nutrition targets form | The app sets individual calorie and macro targets. They are labelled estimates and the member can edit them. Some US states regulate individualised nutrition advice (see §5). | Method: Mifflin–St Jeor × activity (`src/lib/domain/calorie-budget.ts`; described to the coach at `knowledge.ts:165`) | KEEP the labels; NEEDS LICENSED-PROFESSIONAL REVIEW (dietitian) of the method | Y |
| 19 | Calorie floors: 1,500 kcal men / 1,200 women / 1,350 unspecified | `calorie-budget.ts:33`; coach `knowledge.ts:33`, `:165` | Applied silently to the budget; quoted by the coach | A fixed minimum the app will prescribe down to. A second routine clamps starter targets at 1,200 kcal for everyone regardless of sex (`src/lib/domain/nutrition.ts:82`) — **suspected inconsistency; confirm which routine sets the targets members see**. | None cited for the floors | NEEDS LICENSED-PROFESSIONAL REVIEW (dietitian); engineering to confirm the inconsistency | Y |
| 20 | Weekly pace choices from −1 kg to +0.5 kg per week; "Slower paces are easier to stick to." | `calorie-budget.ts:22`; `src/components/onboarding/onboarding-questionnaire.tsx:538,572` | Onboarding | Fastest option is about 2.2 lb a week. Deficit is capped at 25% below maintenance and ±1,000 kcal (per `knowledge.ts:165`). | — | NEEDS LICENSED-PROFESSIONAL REVIEW (dietitian) | Y |
| 21 | "That goal weight is below the healthy BMI range for your height. Consider talking with your doctor before aiming for it." | `onboarding-questionnaire.tsx:560` | Onboarding | The app warns but still accepts an underweight goal — **suspected; confirm the form does not block it**. | BMI 18.5 threshold (`:401`) | NEEDS LICENSED-PROFESSIONAL REVIEW (dietitian / physician): warn only, or refuse? | Y |
| 22 | Pregnancy, breastfeeding, eating-disorder handling | Sign-up (`src/components/auth/auth-forms.tsx:128`); diets page (`src/app/(app)/nutrition/diets/page.tsx:25-26`); habit programs (`src/data/habit-programs/shared.ts:7`); coach (`knowledge.ts:34`) | Several screens | Handled by notices and by coach instructions. Onboarding does not ask about pregnancy or eating-disorder history, so calorie targets are set the same way for everyone. | — | NEEDS LICENSED-PROFESSIONAL REVIEW (dietitian / physician) on whether notices are enough | Y |
| 23 | Minors: "I confirm I am 18 years of age or older." | `auth-forms.tsx:134`; `src/lib/validation/schemas.ts:54` | Sign-up, onboarding | Self-declaration only. Coach told not to coach under-18s (`knowledge.ts:35`). | — | KEEP; counsel to confirm the approach | Y |
| 24 | "evidence-based prep guidance (Helms, Aragon & Fitschen) suggests losing about 0.5–1% of body weight per week" | `programs.ts:2491` | Show-prep program description | Named-author scientific claim with a quantified rate, aimed at physique competitors. Followed by "should be guided by a qualified coach or registered dietitian". | `docs/PROGRAM_RESEARCH.md` | KEEP if the citation is recorded and accurate; NEEDS LICENSED-PROFESSIONAL REVIEW (coach / dietitian) | Y |
| 25 | "Allergies and dislikes from your planner settings are filtered by ingredient names. That is not a guarantee a dish is free of an allergen: always check labels and recipes." | `src/components/nutrition/ai-meal-plan.tsx:120` | AI meal plan | Allergen handling with an explicit limit. | — | KEEP | Y (allergen wording) |
| 26 | "Everyday meals we wrote for the meal planner, with nutrition from USDA FoodData Central. Not reviewed by a dietitian; values are estimates for the amounts listed." | `src/app/(app)/nutrition/recipes/page.tsx:83` | Recipes | Honest label. | — | KEEP | N |
| 27 | Nutrition Score (internal "Food IQ"): "Experimental · not yet reviewed"; "This is an experimental rating that hasn't yet been independently reviewed by a nutrition professional. It isn't medical advice." | `src/components/nutrition/food-iq-sections.tsx:90`, `:174` | Product page, only when `FOOD_IQ_SCORE=on` (off by default: `src/lib/food-iq.ts:28`) | A 0–100 food-quality number. Off in production by default. | `docs/FOOD_IQ_METHOD.md`; `docs/ADDITIVE_EVIDENCE_SOURCES.md` | KEEP off until reviewed; NEEDS LICENSED-PROFESSIONAL REVIEW (dietitian) before switching on | Y |
| 28 | Additive notes, for example "The US FDA revoked its authorization in 2024…", "The FDA's decision cited animal studies showing effects on the thyroid." | `src/lib/additive-evidence.ts:305` (one of many) | Product page, "Ingredients worth knowing about" | Regulatory and health statements about named ingredients in branded products. Errors could be said to disparage products. | `docs/ADDITIVE_EVIDENCE_SOURCES.md` | NEEDS SUBSTANTIATION check of each entry against its listed source; NEEDS LICENSED-PROFESSIONAL REVIEW (dietitian / food scientist) | Y |

### 2.4 Body composition and form analysis

| # | Exact quote | File:line | Where seen | Concern | Substantiation | Recommendation | Counsel |
|---|---|---|---|---|---|---|---|
| 29 | "Body Scan does not estimate body fat. A phone camera can't measure body fat or visceral fat, so we don't guess." | `src/components/body-scan/consent-card.tsx:15`; similar `scan-dashboard.tsx:129` | Body Scan | The name "Body Scan" may suggest measurement; the screen says it is photos and tape measurements only. Matches the code (`docs/BODY_SCAN.md`). | `docs/BODY_SCAN.md` | KEEP; make sure the store listing describes it the same way | Y (name vs function) |
| 30 | "Body fat (%)" entry field | `src/components/progress/progress-forms.tsx:42` | Measurements form | Member-entered value only; no estimate is produced. | — | KEEP | N |
| 31 | "Exercise library: 200+ exercises with demonstrations and form guides" | `membership.ts:38`; `plans.ts:137`; `membership-plans.tsx:39` | Paywall, plan comparison, public pricing | Count: 219 exercise entries found (158 in `src/data/exercises.ts` plus 61 in `src/data/exercise-batches/`). Demonstrations are drawn animations; the readiness file records `ownerApproved: 0` (`src/data/exercise-demo-readiness.json`). Captions say "Not a substitute for coaching." | Count supports "200+". Quality of each animation not verified here. | KEEP the number; NEEDS LICENSED-PROFESSIONAL REVIEW (coach) of demonstrations before calling them correct technique | N |
| 32 | Form analysis | `src/lib/form-analysis/` | **Not exposed**: no screen imports it | The module's own note says no threshold "has been validated on real footage" (`types.ts:62`). No "AI checks your form" claim was found in member-facing copy. | — | KEEP unexposed; treat any future form-check claim as needing validation | N |

### 2.5 Outcomes, science claims, superlatives

| # | Exact quote | File:line | Where seen | Concern | Substantiation | Recommendation | Counsel |
|---|---|---|---|---|---|---|---|
| 33 | "Three run/walk sessions a week take you from walking to 30 minutes of continuous easy running in 8 weeks — about a 5K." | `programs.ts:2753` | Program summary | Quantified outcome in a set time, stated as a fact. | `docs/PROGRAM_RESEARCH.md` | QUALIFY ("is designed to take you…") | Y |
| 34 | "Alternating easy running and brisk walking. The proven way for new runners to build up to continuous running without overdoing it." | `src/data/exercises.ts:2591` | Exercise description | "Proven". | Not found | QUALIFY or NEEDS SUBSTANTIATION | Y |
| 35 | "The classic way new lifters get strong fastest, in the style of Starting Strength and StrongLifts" | `programs.ts:1864` | Program description | Superlative ("fastest") and two third-party program names. | `docs/PROGRAM_RESEARCH.md` §1.2 (marked "[background knowledge]") | QUALIFY; counsel on the names | Y |
| 36 | "In the style of Jim Wendler's 5/3/1… which is why it keeps working for years." | `programs.ts:1992-1993` | Program description | Outcome claim and a third party's name and program. Similar: GZCLP/Cody Lefever (`:1892`), Westside Barbell (`:2213`), Brandon Campbell's PHUL (`:2416`), Layne Norton's PHAT (`:2465`). | — | QUALIFY; counsel on use of names and any implied endorsement | Y |
| 37 | "The most time-efficient way to build muscle for beginners and busy lifters. Research shows growth depends mostly on weekly hard sets taken close to failure…" | `programs.ts:2340-2341` | Program description | Superlative plus "Research shows" with no source shown to the member. | `docs/PROGRAM_RESEARCH.md` §1.1 (volume, frequency, proximity to failure; several marked "(secondary)") | QUALIFY the superlative; NEEDS SUBSTANTIATION (keep the citation on file) | Y |
| 38 | "Research shows women gain muscle at a similar relative rate to men and often gain upper-body strength faster" | `programs.ts:1919-1920` | Program description | Scientific claim. | `docs/PROGRAM_RESEARCH.md` §1.1 "Sex differences" (Roberts, Nuckols & Krieger 2020) | KEEP with the citation on file | N |
| 39 | "Shaped by feedback from women lifters who wanted real strength progression rather than 'toning' circuits." | `programs.ts:1919` | Program description | States that real users gave feedback. The app has not launched; no record of such feedback was found in the repository. | None found | NEEDS SUBSTANTIATION or REMOVE-CANDIDATE | Y |
| 40 | "Concurrent-training research shows strength work and conditioning can coexist when sessions are separated and lifting stays submaximal" | `programs.ts:2686` | Program description | Scientific claim, no source shown. | `docs/PROGRAM_RESEARCH.md` — confirm entry | NEEDS SUBSTANTIATION | N |
| 41 | "Not yet reviewed by a qualified coach." (and the habit-program equivalent) | `src/app/(app)/train/programs/[slug]/page.tsx:200`; `train/programs/page.tsx:350`; `train/habits/[slug]/page.tsx:36` | Program pages | Honest label. It also tells members that paid content is unreviewed. | `docs/PROGRAM_RESEARCH.md` | KEEP; owner to decide whether to obtain review before charging | Y |
| 42 | "Premium training programs, precise workout tracking, nutrition and an AI coach" | `src/app/page.tsx:76` | Public welcome page | "Premium" and "precise" are loose quality words. "Precise" describes logging of entered numbers, not measurement. | — | KEEP or soften "precise" | N |
| 43 | "Everything you need to train well" | `src/app/page.tsx:86` | Public welcome page | General puffery. | — | KEEP | N |

### 2.6 Supplements

| # | Exact quote | File:line | Where seen | Concern | Substantiation | Recommendation | Counsel |
|---|---|---|---|---|---|---|---|
| 44 | Evidence labels "Strong evidence" / "Some evidence" / "Limited evidence" on 24 supplements, each with a purpose, typical dose and timing | `src/data/supplements.ts:19-23`, `:46-291` | Supplements page (free); AI coach (`knowledge.ts:186-188`, `:293`) | The app rates evidence and lists typical doses. No per-item source is shown or stored. The app sells no supplements. | File header: "drawn from sports-nutrition position stands and the NIH Office of Dietary Supplements" (`supplements.ts:3-6`); no citations per item | NEEDS SUBSTANTIATION (per-item sources); NEEDS LICENSED-PROFESSIONAL REVIEW (dietitian / pharmacist) | Y |
| 45 | "Omega-3 fish oil… Heart health and general wellbeing if you rarely eat oily fish." | `supplements.ts:163` | Same | Health-benefit phrasing for a supplement. | As above | QUALIFY; counsel on structure/function vs disease wording | Y |
| 46 | "Psyllium fiber… Helps digestion and cholesterol if you eat little fiber." | `supplements.ts:277` | Same | Mentions cholesterol. | As above | QUALIFY | Y |
| 47 | "Vitamin D3… Supports bones, muscles and immunity" | `supplements.ts:153` | Same | "Immunity". | As above | QUALIFY | Y |
| 48 | "Melatonin… Helps you fall asleep, especially with jet lag or shift changes."; "Ashwagandha… May lower stress and help sleep." | `supplements.ts:257`, `:246` | Same | Sleep and stress claims for supplements. | As above | QUALIFY | Y |
| 49 | "Creatine monohydrate… More strength, power and muscle gain from your training." | `supplements.ts:48` | Same | Performance claim stated as certain. | As above | QUALIFY ("can help") | Y |
| 50 | "Supplements aren't approved by the FDA before they're sold. Choose products tested by NSF Certified for Sport or Informed Sport, and talk to your doctor before starting anything new, especially if you're pregnant, under 18, have a medical condition or take medication." | `supplements.ts:315`; shown at `src/app/(app)/nutrition/supplements/page.tsx:45` | Supplements page | Existing disclaimer. Names two third-party certification marks. Mentions "under 18" in an 18+ app. | — | KEEP; counsel to compare with the wording FDA rules use for products (the app is not a seller) | Y |

### 2.7 Sleep and recovery

| # | Exact quote | File:line | Where seen | Concern | Substantiation | Recommendation | Counsel |
|---|---|---|---|---|---|---|---|
| 51 | "Advanced sleep & recovery insights"; "Sleep quality breakdowns, trends, sleep debt and schedule insights" | `plans.ts:186`; `membership.ts:69` | Paywall, comparison | "Recovery insights" could be read as a physiological recovery measure. The method page says the score "is not sleep debt, not a recovery measure and not a diagnosis". | `docs/SLEEP_METHOD.md`; `src/app/(app)/progress/sleep/method/page.tsx` | KEEP; counsel on "recovery" in marketing | Y |
| 52 | "80 and over reads as restful, 60–79 as fair, below 60 as a short or broken night. The thresholds are round numbers chosen to be readable, not medical cut-offs." | `sleep/method/page.tsx` (score section) | Sleep method page | Disclosed method and limits. | `docs/SLEEP_METHOD.md` | KEEP | N |
| 53 | "A sleep score is not a recovery measure, and short sleep alone does not predict injury." | `src/app/(app)/progress/sleep/training/page.tsx:102` | Sleep and training | Limiting statement. | — | KEEP | N |
| 54 | "Recovery looks low today. Consider a lighter session, mobility, an easy walk, or a rest day. If you feel unwell or have pain, rest and consult a qualified professional." | `src/lib/domain/readiness.ts:32` | Recovery check-in | A readiness band from self-reported check-ins drives a training suggestion. | — | KEEP; NEEDS LICENSED-PROFESSIONAL REVIEW (coach) of the bands | N |
| 55 | Overnight heart rate, HRV and respiratory rate shown from a watch | `src/components/sleep/vitals-cards.tsx`; coach rule `knowledge.ts:271` | Sleep night report | Displays third-party device readings. The coach is told to compare only with the member's own earlier nights, "never against population norms". | — | KEEP; counsel on the general-wellness line (§5) | Y |

### 2.8 Religious content

| # | Exact quote | File:line | Where seen | Concern | Substantiation | Recommendation | Counsel |
|---|---|---|---|---|---|---|---|
| 56 | "Rooted in faith. Built for strength." | `src/app/page.tsx:61`; sign-up | Public pages | Tagline; no outcome promised. | — | KEEP | N |
| 57 | "This is an AI, not a pastor, and it can be wrong: read the passages for yourself, and bring big questions to your church." | `src/app/(app)/faith/ask/page.tsx:50` | Bible helper | Disclosure. | — | KEEP | N |
| 58 | Devotionals, studies and challenge reflections | `src/data/devotionals.ts`, `studies.ts`, `faith-challenges.ts` | Faith section | Pattern search found no promise of healing, prosperity or guaranteed spiritual results. Not read in full. Draft studies are hidden "until a reviewer approves" (`faith/studies/[study]/[lesson]/page.tsx:96`). | `docs/faith/` | NEEDS LICENSED-PROFESSIONAL REVIEW (theologian) of the full text | N |
| 59 | "for every athlete, whatever you believe. An optional faith and discipline section is there if you want it." | `src/app/page.tsx:76-77` | Public welcome page | Accurate: faith features are optional (`knowledge.ts` faith on/off instructions). | — | KEEP | N |

### 2.9 Price and "free" promises

| # | Exact quote | File:line | Where seen | Concern | Substantiation | Recommendation | Counsel |
|---|---|---|---|---|---|---|---|
| 60 | "Free forever plan. No card required." | `src/app/(auth)/signup/page.tsx:23` | Sign-up | An open-ended promise that a free plan will always exist. | Business decision, not code | QUALIFY or confirm as a commitment the Terms will honour | Y |
| 61 | "Faith is always free: the Bible, devotionals and prayer journal."; "The complete Faith & Discipline section, always free" | `src/app/(app)/profile/billing/page.tsx:169`; `plans.ts:143`; `membership-plans.tsx:43` | Billing, paywall, pricing | Open-ended promise. The AI Bible helper inside Faith is Pro (`membership.ts:87`), so "complete… section" is not exact. | — | QUALIFY ("the Bible, devotionals, prayer journal and challenges are always free") | Y |
| 62 | "Everything you need to build your foundation, free for as long as you like." | `billing/page.tsx:164` | Billing | Open-ended promise. | — | As #60 | Y |
| 63 | "Change or cancel any time." | `billing/page.tsx:95` | Billing header | Accurate for all three channels per the "How to cancel" box (`:214-231`). | — | KEEP | N |
| 64 | Yearly "(save N%)" | `src/app/page.tsx:120`; `billing/page.tsx:89-90` | Pricing | Computed from the actual monthly and yearly prices. | `yearlySavingsPercent` in `plans.ts` | KEEP | N |

### 2.10 Statements about data, privacy and security (cross-checked against code)

| # | Exact quote | File:line | Where seen | Check against code | Recommendation | Counsel |
|---|---|---|---|---|---|---|
| 65 | "Used to confirm you're an adult and to estimate your daily calories. **Never shared.**" / "Only used to estimate your daily calories. **Never shared.**" | `onboarding-questionnaire.tsx:487`; `src/components/onboarding/onboarding-wizard.tsx:249` | Onboarding (age, sex, height, weight) | **Contradicted.** After AI consent, age, sex and height are in every coach request (`src/lib/coach/context.ts:244-246`), bodyweight too (`:247`, `:281-286`); AI meal plans send sex and latest weight (`src/server/services/ai-meal-plan.ts:53-60` (profile sex and latest `weight_entries` row)). The consent card itself lists "basic details (age, height, sex, units)" and "Bodyweight" (`ai-consent-card.tsx:37,40`). | Factual fix F1 (§7) | Y |
| 66 | "They're kept in private storage that only your account can open. **Our team and admins can't view them.**" | `consent-card.tsx:13` | Body Scan consent | True of the app's admin screens and storage access rules as described in `docs/BODY_SCAN.md`. A person with the storage or database service credentials can technically open the files. **Suspected overstatement; confirm with the security workstream.** | QUALIFY | Y |
| 67 | "Your photos are never sent to the AI coach or **to any other company or service**." | `consent-card.tsx:14`; `scan-dashboard.tsx:140` | Body Scan | Photos are stored at the storage provider (Supabase), which is another company. Not sent to the AI provider (consent card `ai-consent-card.tsx:53`). | QUALIFY ("…other than our storage provider") | Y |
| 68 | "Only you can see this entry. It isn't shared with the AI coach or administrators."; "Never visible to administrators or the AI coach." | `src/app/(app)/faith/journal/[id]/page.tsx:88-89`; `src/components/faith/faith-forms.tsx:159`; privacy draft "our administrators have no access path to them" (`src/app/legal/privacy/page.tsx:39`) | Prayer journal | Same point as #66: true at the application level; database operators are a separate matter. | QUALIFY or confirm with the security workstream | Y |
| 69 | "Private by design — Your data is isolated to your account. Export or delete it any time." | `src/app/page.tsx:26` | Public welcome page | Export and delete exist (`profile/page.tsx:130-175`). "Isolated to your account" holds while Friends and accountability partners are off; with Friends on, selected data is shown to friends by the member's choice. | KEEP now; QUALIFY when Friends is on | N |
| 70 | "We do not use advertising or analytics trackers." | `privacy/page.tsx:49` | Privacy draft | No such SDK found in `package.json` or `src/`. | KEEP; re-check on any SDK or log-drain change | Y |
| 71 | "This data is never used for advertising or marketing and is never sold." (Apple Health / Health Connect) | `privacy/page.tsx:27` | Privacy draft | No advertising code found. | KEEP | Y |
| 72 | "no AI analyses them" (progress and Body Scan photos) | `privacy/page.tsx:36` | Privacy draft | Consistent with the code read; the only image AI calls are meal and label photos (`src/server/services/food-photo.ts`, `label-photo.ts`). | KEEP | N |
| 73 | "Narrow Gate Fitness doesn't store the photo: it's resized, sent once, and discarded." ; "over an encrypted connection" | `src/components/nutrition/food-photo-consent.tsx:20-21` | Meal photo consent | Matches the route comments (`src/app/api/ai/food-photo/route.ts:18`). The AI provider's own retention is governed by its terms, which this sentence does not address. | QUALIFY (mention the provider's retention terms) | Y |
| 74 | "Sleep times, naps and check-ins… shown only to you, never shared with the AI coach unless you ask it about your sleep" | `src/components/sleep/consent-card.tsx:18` | Sleep consent | Consistent: sleep reaches the coach through the `get_sleep_summary` tool (`src/lib/coach/tools.ts:262`). | KEEP | N |
| 75 | "Reminders only say what's ready. They never show your prayers, journal, notes, meals, weight, sleep or other health details" | `src/components/notifications/notification-settings.tsx:596` | Notification settings | Catalog copy read (`src/lib/notifications/catalog.ts:61-161`): generic titles and bodies only. | KEEP | N |
| 76 | "Location is used only while you record. Routes are private." | `src/app/(app)/run/page.tsx:129`; `gps-recorder.tsx:489` | Run | Consistent with `src/lib/native/location.ts`. Map background tiles are off unless the owner sets a tile URL; turning them on would tell the tile provider where the member ran (`src/lib/domain/map-tiles.ts:1-7`). | KEEP; revisit if map tiles are switched on | Y |
| 77 | "We'll email you a secure link to choose a new password." | `src/app/(auth)/forgot-password/page.tsx:10` | Password reset | Generic security word. | KEEP | N |
| 78 | "Your prayer journal and notes are never shared with it." | `faith/ask/page.tsx:50` | Bible helper | Consistent with the helper's request as read (`src/server/services/bible-ai.ts`); not traced line by line. | KEEP; confirm in the privacy workstream | N |

No use of "anonymous", "anonymised" or "end-to-end encrypted" was found in member-facing copy.

### 2.11 Accuracy of measurements and estimates

| # | Exact quote | File:line | Where seen | Concern | Recommendation | Counsel |
|---|---|---|---|---|---|---|
| 79 | "Estimated from a photo, not measured"; "Results can be wrong. You check and correct everything…" | `src/components/nutrition/food-photo-flow.tsx:333,336`; `food-photo-consent.tsx:22` | Meal photo | Clear estimate labels. `docs/PRESENTATION_GUIDE.md:43` tells presenters never to quote an accuracy figure because none has been measured. | KEEP; never state an accuracy figure in the store listing | N |
| 80 | "Search a USDA-based food database, scan barcodes and track calories, macros and water — free. Estimates are clearly labeled." | `src/app/page.tsx:24` | Public welcome page | Accurate as far as checked. | KEEP | N |
| 81 | "Open Food Facts data can be incomplete or out of date; always check the label."; "Allergen data comes from volunteers and may be incomplete… this app can't guarantee allergen safety." | `src/app/legal/notices/page.tsx:16-17`; `src/components/nutrition/quality-sections.tsx:230` | Notices; product page | Clear limits. | KEEP | Y (allergen wording) |
| 82 | "Live GPS recording with route maps, distance, pace and splits" | `membership.ts:53` | Plan comparison | No accuracy figure claimed. The recorder reports ignored readings (`gps-recorder.tsx:74`). GPS has not been verified on a device (`docs/GPS_ACCURACY.md`, `docs/FOOD_IQ_FORM_GPS_REPORT.md`). | KEEP; no accuracy claims until device-tested | N |
| 83 | Calories burned in exercise, added back to the daily budget | `src/lib/domain/exercise-energy.ts:16,44` ("All of it is an estimate"; MET values) | Food diary "Exercise" figure | The in-code comment says it is an estimate. Whether the diary strip labels the exercise figure as an estimate where the member sees it was **not confirmed**. | QUALIFY if the on-screen figure lacks an "estimated" label | N |
| 84 | Strength ranks ("beginner" to "elite") | `src/lib/domain/strength-ranks.ts:7-10` | Progress, body map | Code comment: "PROVISIONAL APP RULES, not validated strength standards… nothing has been calibrated against a population." Whether the screen tells members this was **not confirmed**. | QUALIFY on screen if not already; NEEDS LICENSED-PROFESSIONAL REVIEW (coach) | N |

### 2.12 Competitors, endorsements, testimonials

- **Competitor names in member-facing copy:** none found. "MyFitnessPal" and "MyNetDiary" appear only in code comments and in `README.md:29,31` ("MyFitnessPal-style logging"). Device brands appear as compatibility statements: "Apple Watch, Oura, Garmin, WHOOP and more" (`src/components/sleep/source-card.tsx:166`; `sleep/settings/page.tsx:55`).
- **Testimonials, star ratings, user counts, "trusted by", awards:** none found. The one feedback-style statement is #39.
- **Third-party program and coach names:** #35 and #36.
- **Certification marks named:** NSF Certified for Sport, Informed Sport (#50).
- **README:** says "157 exercises" (`README.md:21`) while the app says "200+"; internal document, stale. If the repository or README text is ever used publicly, treat "MyFitnessPal-style" as a comparative reference for counsel.

## 3. Disclaimers that exist

| Disclaimer | Path |
|---|---|
| Sign-up "Before you start" list (injury risk; not medical advice; not a doctor, dietitian or physical therapist; AI and food estimates can be wrong; see a professional if condition, injury, pregnant, disordered eating) | `src/components/auth/auth-forms.tsx:121-129` |
| Risk acknowledgement accepted with its own unticked box, versioned and hashed | `src/lib/legal/versions.ts:20-25`; `auth-forms.tsx:153-154` |
| Public footer: "Not medical advice — consult a professional before starting a new program." | `src/app/page.tsx:139` |
| Terms draft health disclaimer | `src/app/legal/terms/page.tsx:11-17` |
| AI Coach: "AI answers can be wrong and aren't medical advice…" with expandable detail "You're chatting with an AI…" | `src/components/coach/coach-chat.tsx:643-650` |
| AI Coach safety rules (not a doctor; red flags; no PEDs; calorie floor; eating-disorder care; under 18; supplements; self-harm and 988) | `src/lib/coach/knowledge.ts:29-37`, `:256-264` |
| Bible helper: "This is an AI, not a pastor, and it can be wrong" | `src/app/(app)/faith/ask/page.tsx:50` |
| Training suggestions: "not medical advice and can't see injuries or illness" | `src/components/train/training-review.tsx:319` |
| Exercise page: "General fitness information, not medical advice. Stop if an exercise causes pain…"; demo caption "Not a substitute for coaching." | `src/app/(app)/train/exercises/[slug]/page.tsx:259`, `:121` |
| Custom program note: "Stop any exercise that causes pain. This is general fitness guidance, not medical advice." | `src/lib/domain/custom-programs.ts:2408` |
| Program-level notes ("not a rehabilitation program"; "check with your healthcare provider") | `src/data/programs.ts:1724,1799,3302`; `src/data/program-catalog/endurance-mobility.ts:599,732-733`; `beginner-lifestyle.ts:157,390,671` |
| "Not yet reviewed by a qualified coach / professional" labels | `train/programs/[slug]/page.tsx:200`; `train/programs/page.tsx:350`; `train/habits/[slug]/page.tsx:36`; `train/habits/page.tsx:52` |
| Habit programs opening note (not medical or dietetic advice; conditions, pregnancy, medication, disordered eating) | `src/data/habit-programs/shared.ts:7` |
| Nutrition targets: estimate label and "not dietary advice" | `src/components/nutrition/nutrition-client.tsx:897,928-929` |
| Diets page | `src/app/(app)/nutrition/diets/page.tsx:25-26`; keto caution `src/lib/domain/diets.ts:74` |
| Supplements: "General education, not medical advice." plus FDA sentence | `src/app/(app)/nutrition/supplements/page.tsx:45`; `src/data/supplements.ts:315` |
| Recipes: "Not reviewed by a dietitian; values are estimates" | `src/app/(app)/nutrition/recipes/page.tsx:83` |
| AI meal plan allergen limit | `src/components/nutrition/ai-meal-plan.tsx:120` |
| Product allergen limit | `src/components/nutrition/quality-sections.tsx:230`; `src/lib/food-quality.ts:631` |
| Meal photo: "Estimated from a photo, not measured"; "Results can be wrong" | `src/components/nutrition/food-photo-flow.tsx:333-336`; `food-photo-consent.tsx:22` |
| Nutrition Score: "Experimental · not yet reviewed" | `src/components/nutrition/food-iq-sections.tsx:90,174` |
| Sleep: method page; "not medical advice. Nothing here changes your training or suggests medication."; "not a recovery measure" | `src/app/(app)/progress/sleep/method/page.tsx`; `sleep/page.tsx:279`; `sleep/training/page.tsx:102` |
| Weekly report: "this isn't medical advice" | `src/app/(app)/progress/reports/[week]/page.tsx:92` |
| Recovery check-in note | `src/lib/domain/readiness.ts:32`; `adaptive-training.ts:516` |
| Body Scan: no body-fat estimate | `src/components/body-scan/consent-card.tsx:15`; `scan-dashboard.tsx:129` |
| Underweight goal warning | `src/components/onboarding/onboarding-questionnaire.tsx:560` |

## 4. Gaps: features with no disclaimer found, or a weak one

| Feature | What was found | Gap |
|---|---|---|
| Home dashboard cards (calorie ring, "recovery recommendation", AI shortcuts) | Not read line by line | Confirm the recovery card carries or links to the readiness note. |
| Food diary "Exercise" calories | Estimate stated in code comments only | Confirm an on-screen "estimated" label (#83). |
| Strength ranks and body map | Provisional rules stated in code only | Confirm an on-screen note (#84). |
| GPS runs | Safety is in the sign-up acknowledgement ("stay aware of traffic") | No accuracy note on the activity page beyond ignored-readings detail. Low priority. |
| Sleep alarm | Method page explains limits | No note on the alarm screen that an alarm can fail (silent mode, permissions); **not confirmed**. |
| Notifications | Generic copy | None needed. |
| Supplements | Page-level disclaimer | No per-item source; evidence labels are unsourced to the member (#44). |
| AI meal plans | Allergen note | No "AI-generated, not reviewed by a dietitian" line found on the plan itself; **not confirmed**. |
| AI Coach self-description | Disclaimer under the chat | Nothing stops the model describing itself as experienced or qualified (#6). |
| Onboarding calorie setup | Underweight warning only | No pregnancy, breastfeeding or eating-disorder screen before targets are set (#22). |
| Store listing | Does not exist | Every claim in it must be read against this file before submission. |

## 5. Legal topics for counsel (named, without conclusions)

- **FTC Act section 5** (unfair or deceptive acts) and the FTC's **Health Products Compliance Guidance (2022)**: the substantiation standard for health-related claims ("competent and reliable scientific evidence"), and how it applies to the supplement evidence labels, "Research shows…" lines, injury-prevention wording and any outcome statements. The Guidance also addresses qualifying language and whether disclaimers cure a claim.
- **FTC Endorsement Guides** (16 CFR Part 255) and the rule on fake reviews and testimonials: #39 ("Shaped by feedback from women lifters"); named coaches and programs (#35, #36); any future testimonials or influencer content.
- **FTC "free" and negative-option rules** and state automatic-renewal laws: "Free forever", "always free", renewal and cancellation wording. (The subscription workstream covers these in depth.)
- **FDA general-wellness policy versus the medical-device / software-as-a-medical-device line**: Body Scan (photos and tape measurements, no estimate); sleep score, sleep debt and estimated energy; display of overnight heart rate, HRV and respiratory rate from wearables; recovery/readiness bands; AI recommendations that change training load or calorie targets; the coach's pain rules and red-flag list. Also FDA's clinical-decision-support guidance as it relates to AI suggestions.
- **FDA dietary-supplement rules** (DSHEA): the line between structure/function statements and disease claims, and the standard disclaimer text, as they bear on an app that describes supplements but does not sell them (#44–#50).
- **State consumer-protection (UDAP) laws**, including California's Unfair Competition Law, False Advertising Law and CLRA: the same statements, plus privacy statements that do not match practice (#65–#68).
- **Lanham Act section 43(a)**: comparative or third-party references (#35, #36, device brand names, README "MyFitnessPal-style"), and any implied affiliation or endorsement.
- **State licensure of dietitians and nutrition advice**: individualised calorie and macro targets, AI meal plans and AI nutrition answers; which states restrict individualised nutrition care to licensed professionals and what exemptions (general non-medical nutrition information, software) may apply.
- **State licensure of physical therapy / practice of medicine**: symptom-based exercise substitutions and pain triage by the AI coach (#9–#11).
- **State health-data laws** (for example Washington's My Health My Data Act) and the **FTC Health Breach Notification Rule**: statements about health data handling (#65–#74). (The privacy workstream covers these in depth.)
- **Religious content**: no specific regulatory topic identified; consumer-protection law applies to any outcome promise. Theological review is a quality matter for the owner.

## 6. Findings

### C-1 "Never shared" contradicts the AI data flow (High)
- **Confirmed.**
- **Evidence:** `onboarding-questionnaire.tsx:487`; `onboarding-wizard.tsx:249`; versus `src/lib/coach/context.ts:244-247`, `ai-meal-plan.ts:53-60`, `ai-consent-card.tsx:37,40`.
- **Impact:** a privacy statement made at the moment of collection that later practice contradicts for members who use AI features. Relevant to FTC Act s.5, state UDAP and Apple 5.1.2.
- **Action:** apply fix F1 after counsel agrees the wording.
- Counsel must decide: **Y** · Blocks public launch: **Y** (simple to fix) · Technical testing can resolve it: **Y** (text change plus a copy test)

### C-2 "Our team and admins can't view them" / "Administrators can't" (Medium)
- **Suspected** overstatement; depends on who holds database and storage credentials.
- **Evidence:** `consent-card.tsx:13-14`; `faith/journal/[id]/page.tsx:88-89`; `faith-forms.tsx:159`; `privacy/page.tsx:39`.
- **Impact:** absolute privacy promises about the most sensitive content in the app (body photos, prayers).
- **Action:** security workstream confirms the real access paths; then qualify (fix F2) or back the statement with a control such as encryption the operator cannot reverse.
- Counsel: **Y** · Blocks public launch: **counsel** · Testing can resolve: **partly** (access can be tested; the promise is a wording decision)

### C-3 AI coach knowledge and safety rules are unreviewed by any licensed professional (High)
- **Confirmed** by the file's own header ("it is not medical, dietetic or physiotherapy advice", `knowledge.ts:6-7`) and by the absence of any review record.
- **Evidence:** `knowledge.ts:29-37` (safety), `:94-100` (pain alternatives), `:165-175` (calories, protein, macros), `:186-188` (supplements).
- **Impact:** the paid AI feature gives individualised training, nutrition, pain-workaround and supplement information. The rules that keep it inside "general wellness" were written without clinical or dietetic review, and AI output cannot be audited from source.
- **Action:** review by a coach, a registered dietitian and a physician or physiotherapist; run and record the live safety tests in `docs/LIVE_AI_TEST_PLAN.md` and `docs/ai-eval/`; add the persona guard in #6.
- Counsel: **Y** · Blocks public launch: **counsel** (the coach is Pro-only, so it mainly bears on paid launch) · Testing can resolve: **partly** (tests show behaviour on sampled prompts, not correctness of the advice)

### C-4 Supplement list: evidence ratings, doses and health-benefit phrases without per-item sources (Medium)
- **Confirmed.**
- **Evidence:** `src/data/supplements.ts:19-23,46-291`; rows #44–#49.
- **Action:** store a source per item; soften the phrases in #45–#49; dietitian or pharmacist review; counsel on FDA and FTC framing.
- Counsel: **Y** · Blocks public launch: **counsel** · Testing can resolve: **N**

### C-5 Calorie targets, floors and pace options are unreviewed; possible floor inconsistency (Medium)
- **Confirmed** as unreviewed; the inconsistency between `calorie-budget.ts:33` and `nutrition.ts:82` is **suspected**.
- **Action:** engineering confirms which routine members' targets come from; dietitian reviews floors, the 25% cap, the −1 kg/week option and the underweight-goal handling; counsel considers state licensure.
- Counsel: **Y** · Blocks public launch: **counsel** · Testing can resolve: **partly** (the inconsistency, yes)

### C-6 Unsubstantiated or absolute statements in program copy (Medium)
- **Confirmed** as written: #12 ("prevents falls"), #13 (injury prevention, concussion), #33 (5K in 8 weeks), #34 ("proven"), #35 ("fastest"), #37 ("most time-efficient", "Research shows"), #39 ("Shaped by feedback from women lifters").
- **Action:** qualify or source each; remove #39 unless a record of that feedback exists.
- Counsel: **Y** · Blocks public launch: **counsel** · Testing can resolve: **N**

### C-7 "Free forever" / "always free" promises (Medium)
- **Confirmed.** #60–#62.
- **Action:** owner decides whether these are commitments; counsel aligns them with the Terms; fix the "complete Faith section" wording, since the AI Bible helper is Pro.
- Counsel: **Y** · Blocks public launch: **counsel** · Testing can resolve: **N**

### C-8 "AI personal coaching" and "sleep coaching" labels (Low to Medium)
- **Confirmed.** #1, #3.
- **Action:** counsel decides whether to qualify.
- Counsel: **Y** · Blocks public launch: **N** · Testing can resolve: **N**

### C-9 Third-party names in program descriptions (Low to Medium)
- **Confirmed.** #35, #36.
- **Action:** counsel on nominative use and implied endorsement; see also `docs/launch-audit/FINAL_TRADEMARK_REVIEW.md`.
- Counsel: **Y** · Blocks public launch: **counsel** · Testing can resolve: **N**

### C-10 Additive and ingredient evidence notes (Medium)
- **Suspected** risk; entries were not checked one by one.
- **Evidence:** `src/lib/additive-evidence.ts`; `docs/ADDITIVE_EVIDENCE_SOURCES.md`.
- **Action:** verify each note against its source and date; dietitian or food-scientist review.
- Counsel: **Y** · Blocks public launch: **counsel** · Testing can resolve: **N**

### C-11 Paid programs labelled "Not yet reviewed by a qualified coach" (Low; business and counsel choice)
- **Confirmed.** #41.
- **Impact:** honest, and it tells paying members the content is unreviewed.
- **Action:** obtain review, or keep the label knowingly.
- Counsel: **Y** · Blocks public launch: **N** · Testing can resolve: **N**

### C-12 On-screen estimate labels not confirmed for exercise calories and strength ranks (Low)
- **Suspected.** #83, #84.
- **Action:** check the rendered screens; add a short label where missing.
- Counsel: **N** · Blocks public launch: **N** · Testing can resolve: **Y**

## 7. Low-risk factual corrections (proposed, not applied)

These are statements that contradict the code or will be out of date at launch. Proposed text is a starting point for the owner and counsel.

| # | File:line | Current text | Proposed text | Why |
|---|---|---|---|---|
| F1 | `src/components/onboarding/onboarding-questionnaire.tsx:487`; `src/components/onboarding/onboarding-wizard.tsx:249` | "…to estimate your daily calories. Never shared." | "…to estimate your daily calories. Not shown to other members. If you later turn on AI features, they are sent to our AI provider, and we ask you first." | Age, sex, height and weight go to the AI provider after consent (`context.ts:244-247`). |
| F2 | `src/components/body-scan/consent-card.tsx:14`; `scan-dashboard.tsx:140` | "…never sent to the AI coach or to any other company or service." | "…never sent to the AI coach. They are held only by our storage provider so we can show them to you." | Photos are stored at a third-party storage provider. |
| F3 | `src/app/(app)/run/page.tsx:129` | "…the phone app is being prepared to keep recording with the screen locked." | After device testing: "…in the phone app, a recording continues with the screen locked." (or remove the clause) | Status note; the native project already declares background location (`Info.plist:79-84`). |
| F4 | `src/app/(app)/progress/sleep/method/page.tsx:110` | "The alarm hasn't been tested on a physical phone yet." | Remove once tested; until then keep. | Development status note in member-facing text. |
| F5 | `src/lib/domain/plans.ts:143`; `src/components/profile/membership-plans.tsx:43` | "The complete Faith & Discipline section, always free" | "The Bible, devotionals, prayer journal and challenges, always free" | The AI Bible study helper in the Faith section is Pro (`membership.ts:87`). Counsel also to consider "always" (C-7). |
| F6 | `README.md:21` | "157 exercises" | "200+ exercises" (219 entries found) | Stale internal figure; only matters if the README is published. |
| F7 | `src/data/supplements.ts:315` | "…especially if you're pregnant, under 18, have a medical condition…" | Remove "under 18," | The app is for adults only; the phrase suggests minors may use it. |

## 8. What could not be verified here

- **AI output.** Only the instructions were read. Whether the coach, meal planner, photo estimator and Bible helper follow them needs recorded live tests.
- **Rendered screens.** Wording was read in source. Prominence, truncation and what appears on a small phone were not checked.
- **Full text** of exercises, programs, recipes, devotionals and studies (pattern-searched only).
- **Database-level access** behind the "admins can't" statements (security workstream).
- **The substantiation documents themselves.** `docs/PROGRAM_RESEARCH.md`, `docs/FOOD_IQ_METHOD.md`, `docs/SLEEP_METHOD.md` and `docs/ADDITIVE_EVIDENCE_SOURCES.md` were identified and sampled, not audited source by source. `PROGRAM_RESEARCH.md` states that most of its sources were abstracts or secondary summaries and that it has not been reviewed by a qualified coach.
- **Store listing and marketing outside the repository** (website, social posts, ads): none exists in the repository.
