# Narrow Gate Fitness: full app audit and competitor review

**Audited:** 2026-10-22, on branch `claude/stage1-memberships`.

**Builds on:** `docs/PROJECT_CHECKLIST.md` (409 rows, audited 2026-10-20), re-checked against the current code.

**How statuses were set:** from code, migrations and tests in this repository. Tests run on 2026-10-22:
- type check and lint clean, production build passes;
- 2,033 unit and integration tests (local Supabase);
- 42 Playwright end-to-end tests at mobile size (41 pass; 1 is skipped by design when a mock AI provider is running).

**What was not possible here:**
- no real iPhone or Android device;
- no live Stripe, Anthropic, Open Food Facts or App Store access;
- competitor and vendor pages could not be loaded directly; the research used search results that index the official pages, and items marked *unverified* weren't confirmed.

**Statuses:**
- **Working:** implemented and covered by tests.
- **Needs improvement:** works, with known gaps.
- **Partial:** only part of the feature exists.
- **Missing:** not built.
- **Device / external:** needs real-device testing or outside setup.

---

## 1. Summary

1. **The core is solid and well tested.** Training (library, logger, templates, builder), the food diary (USDA data, barcode, units, recipes, planner, grocery), progress, badges, Faith, onboarding, security and account deletion all work and are covered by tests.
2. **Biggest product gaps:**
   - **Live GPS running:** no location code exists.
   - **Pro coaching beyond chat:** no coaching memory, weekly reports, adaptive training reviews or AI meal plans.
   - **Photo-assisted food logging.**
   - **Body map and strength ranks:** never built.
3. **Biggest App Store blockers:**
   - **Billing:** Plus/Pro are sold only through Stripe; Apple in-app purchase is required (3.1.1).
   - **Legal pages:** the privacy policy and terms are drafts.
   - **AI consent:** the AI coach shared user data with the AI provider without explicit consent. **Fixed in Stage 1.**
4. **Cost risk (fixed in Stage 1):** Pro allowed 400 AI requests a month on Opus. At list prices a heavy user could cost more than the subscription.
5. **Stage 1 (implemented on this branch):**
   - **Memberships:** the final membership structure, with server-enforced gates.
   - **AI routing:** Pro-only AI, with 150 requests a month and ~90% Haiku / ≤10% Sonnet routing enforced by metering.
   - **Consent:** an AI data-sharing consent step.
   - **Security:** the high-severity PostCSS advisory fixed.
   - **Docs:** `docs/MEMBERSHIPS.md` and `docs/MOBILE_BILLING.md`.

## 2. Feature audit

| Area | Status | Evidence | Main gaps |
|---|---|---|---|
| Home dashboard | **Working** | `src/app/(app)/home/page.tsx`, real data via `dashboard.ts`, `e2e/navigation.spec.ts`, `core-flow.spec.ts` | Weekly card counts workouts; runs/walks shown once GPS exists |
| Training programs | **Working** | 48 library programs (13 free, 35 Plus), search and 5 filters, completion rules, `e2e/program-library.spec.ts` | Specialist programs (show prep, meet prep, combat, active aging) flagged "not yet reviewed by a qualified coach" |
| Exercise library | **Working** / needs content review | Search, muscle/equipment/difficulty filters, animated demos, history per exercise | Instructions and demos not reviewed by a coach |
| Workout logging | **Working** | Sets/reps/weight/time/distance, RPE, rest timer, supersets, previous performance, PRs, offline draft + sync (`e2e/core-flow`, `journeys`) | Rest-timer sound/vibration untested on a device; no Apple Watch |
| Custom workout builder | **Working** | Templates (`/train/templates`) and program builder (`/train/build`), `e2e/training-stage2`, `program-builder` | — |
| Running and walking | **Partial** | Manual/treadmill entry, history, weekly totals, PRs, edit/delete (`e2e/run.spec.ts`) | **No live GPS, no route or splits, no distance goals, no 10K plan** (`docs/RUN_TRACKING_PLAN.md`) |
| Food diary | **Working** | Meals, units (g/oz/servings), copy meal/day, move, water, day marks, favorites, recents (`e2e/food-amounts`, `nutrition-diary`, `journeys`) | No restaurant database; no photo/voice logging |
| Barcode scanning | **Working** (code) / **Device** | Open Food Facts lookup, native scanner plugin, manual fallback; mocked in e2e | Live Open Food Facts and real camera untested here |
| Calorie and macro tracking | **Working** | Targets from `calorie-budget.ts`, exercise adjustment without double counting, weekly insights | No adaptive TDEE (MacroFactor's core feature) |
| Recipes and saved meals | **Working** | Recipe builder with per-serving nutrition, saved meals, partial servings (`e2e/recipes-planner`) | No recipe import from a URL or photo |
| Meal planner and grocery list | **Working** | Deterministic planner (targets, diet, allergies, budget tier), swaps, grocery merge | No price estimates; allergy matching is by name only (stated in the UI) |
| Progress tracking and photos | **Working** / **Device** | Weight, measurements, PRs, training analytics, private photo bucket with signed URLs, comparisons | Run distance not on Progress; camera untested on a device; body map / strength ranks missing |
| Fitness & Food badges | **Working** | 27 derived ranks with BSB verses, plus 20 achievements (`e2e/rank-badges.spec.ts` at 4 widths) | Art is low-resolution (`docs/BADGES.md`); run badges missing |
| Faith section | **Working** / content review | Scripture (BSB, verified), devotionals, journal, practices, 40-day challenge, Faith ranks; free for everyone | Devotional text not pastor-reviewed; native reminders untested on a device |
| AI coaching | **Needs improvement** | Tool-using chat with read tools, proposals applied only on confirm, plan generation, mocked e2e (`e2e/coach.spec.ts`) | No memory, weekly report, adaptive review, meal plans or running data; no live API run here |
| User onboarding | **Working** | One-question-per-screen flow, goals, combined goals, starter program, display prefs (`e2e/onboarding-plan`, `welcome-diets`) | Secondary goal recorded but not used by the coach |
| Subscriptions | **Needs improvement** | Stripe checkout/portal/webhooks, server entitlements (`tests/integration/entitlements.test.ts`) | **No Apple/Google IAP**; yearly prices need an owner decision (§4) |
| Security and account deletion | **Working** | CSP/HSTS, RLS on every table (`rls-coverage` test), password re-check, ordered deletion with Stripe cleanup (`docs/SECURITY.md`) | Supabase dashboard settings must be applied in production |
| Mobile compatibility | **Needs improvement** / **Device** | Capacitor 8 shells; iOS simulator compile in CI; Android APK builds; layouts tested at 320–430 px | No device testing; no location keys; Health Connect permission missing; the shell loads the live site (4.2 "web wrapper" risk) |

**Offline / iPhone demo edition** (`standalone/index.html`): a local-storage-only showcase, kept in sync for screens and plans. It is not a substitute for the app.

## 3. Critical bugs and security

| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | AI cost exposure: Pro 400 requests/month on Claude Opus (~$0.13 each) and Plus 60 on Sonnet | High (financial) | **Fixed:** Pro-only, 150/month, Haiku by default, Sonnet capped at 15 |
| 2 | AI coach sent account data to Anthropic without explicit consent (Apple 5.1.2(i), privacy) | High (App Store, privacy) | **Fixed:** consent screen, server check, withdraw in Privacy & data |
| 3 | `postcss` < 8.5.23 bundled inside Next.js (GHSA-qx2v, -6g55, -fxqj, -r28c) | High per npm audit; low in practice (build-time, our own CSS) | **Fixed:** `overrides.next.postcss` → 8.5.30; `npm audit` reports 0 |
| 4 | Yearly Pro $119.99 would undercut the new $24.99 monthly by 60% | Medium (pricing) | **Fixed:** yearly hidden unless configured; checkout rejects it otherwise |
| 5 | Food logging, barcode and macros paywalled, contrary to the final structure | Product | **Fixed** |
| 6 | Privacy policy and terms are drafts (`src/app/legal/*`), and don't mention the AI provider | Blocker for launch | **Open:** needs counsel |
| 7 | No location permission strings; no Health Connect `READ_STEPS` permission in `AndroidManifest.xml` | Blocks the GPS and Health Connect features | **Open** |
| 8 | In-memory AI burst limiter is per instance | Low: the durable per-minute check in `ai_usage_events` backs it up | Mitigated |

No data-loss or auth bugs were found. The 2,033 automated tests pass on this branch.

## 4. Subscriptions and App Store readiness

**Implemented in Stage 1** (see `docs/MEMBERSHIPS.md`):
- **Free:** food logging, barcode, macros, basic training and run logging, starter programs, 5 templates, calendar viewing, every rank badge, and all of Faith.
- **Plus ($11.99), no AI:** the full library, builder, unlimited templates, recipes/planner/grocery, advanced trends, photo comparisons, and scheduling/rescheduling.
- **Pro ($24.99):** adds the AI coach (150/month) and AI plans.

**Requirement status:**

| Requirement | Status |
|---|---|
| Entitlements checked on the server | ✓ every gate is in the action or route, not only the UI |
| Existing subscriber data preserved | ✓ no subscription or entitlement rows changed; old Stripe prices keep mapping to their plan |
| Live prices | **Not changed.** Create $11.99/$24.99 Stripe prices and update `STRIPE_PRICE_PLUS/PRO` before deploying |
| Apple in-app purchase | **Missing.** Blocker (3.1.1 / 3.1.3(b)); plan in `docs/MOBILE_BILLING.md` (RevenueCat) |
| Google Play Billing | **Missing.** Required outside the US alternative-billing programs |
| Restore purchases | **Missing** (comes with IAP) |
| Subscription paywall info (3.1.2) | Web page shows name, price, renewal and cancellation; native paywall needs building with IAP |
| Account deletion (5.1.1(v)) | ✓ in-app, with password re-check; needs the "Apple keeps billing until you cancel" note once IAP exists |
| Sign in with Apple (4.8) | Not required: email/password only, no social login |
| Privacy policy and terms | **Draft.** Blocker; must cover the AI provider, health data, photos and retention |
| AI usage enforcement | ✓ monthly and per-minute limits from the server-side usage table; Sonnet share capped |
| API spending limits | Set a monthly spend limit in the Anthropic console (owner); app limits cap the worst case at ≈ $2 per Pro user per month (estimate) |
| Privacy manifest, nutrition labels | Manifest present (3 API reasons); labels must list Health & Fitness, Photos, Purchases and AI-provider sharing |
| Medical-device declaration | Declare "not a medical device" in App Store Connect |
| Minimum functionality (4.2) | Risk: the app loads the deployed site in a WebView. Native features (barcode, HealthKit, notifications, later GPS) help |

## 5. Competitor comparison

**Sources:** official sites, help centres and App Store listings, via search results. Checked 2026-10-22.

**Pricing (USD):**

| App | Free tier | Paid | Notes |
|---|---|---|---|
| Fitbod | None (7-day trial) | $15.99/mo, $95.99/yr | No nutrition or GPS |
| Hevy | Unlimited logging, 4 routines | $2.99/mo, $23.99/yr, $74.99 lifetime | Social feed; "Trainer" is rule-based |
| MacroFactor | None (7-day trial) | $11.99/mo, $71.99/yr; Workouts app sold separately | Adaptive TDEE; photo, label and "describe" logging |
| MyFitnessPal | Logging with ads, macro % goals; **barcode is Premium** | Premium $19.99/mo or $79.99/yr; Premium+ $24.99/mo or $99.99/yr | 22M foods; AI Coach (Premium, June 2026); planner and grocery in Premium+ |
| Strong | Unlimited logging, 3 routines | $4.99/mo, $29.99/yr | Minimal; Apple Watch |
| Strava | GPS recording, clubs, challenges, Beacon | $11.99/mo, $79.99/yr | Segments, routes; running plans via Runna (separate) |

**What competitors do better:**
1. **GPS run tracking** (Strava).
2. **Wearables:** Apple Watch apps for logging (Strong, Hevy, Fitbod), Garmin (Strava).
3. **Adaptive calorie targets:** MacroFactor's weekly expenditure algorithm.
4. **Adaptive workout generation from recovery:** Fitbod's muscle recovery map.
5. **Photo and AI food logging:** MacroFactor, MyFitnessPal, Cal AI.
6. **Food database size:** MyFitnessPal has 22M foods; we use USDA SR Legacy plus Open Food Facts barcodes.
7. **Social and community:** Hevy feed; Strava clubs and challenges.

**Where we already match:**
- **Training:** workout logger (supersets, rest timer, PRs, previous performance, offline); program library and builder; exercise demos.
- **Nutrition:** barcode and macros, now **free**, where MyFitnessPal charges for barcode; recipes, meal planner and grocery list, which MyFitnessPal puts in its $99.99/yr tier.
- **Progress and AI:** progress photos with comparisons; an AI coach that reads the user's own log and proposes changes they approve.

**What genuinely differentiates us:**
1. **One app for strength, running, food and faith.** Today people combine Strava, Hevy and MyFitnessPal.
2. **The Faith section, completely free.** None of the six has faith or accountability features.
3. **Approval-first AI coaching tied to real data.** Every AI change is shown and approved before saving, using the app's own workout, food and progress systems.
4. **Free barcode scanning and macros.** This is MyFitnessPal's most-cited complaint.

**Not worth adding now:**
- Public leaderboards: they conflict with the "faith isn't scored" principle and add moderation cost.
- A general social feed before the core experience is finished.
- A full restaurant database without a licensed source.
- 3D avatars.

**Where to simplify the interface:**
- **Food tools nav:** keep recipes, saved meals, planner, grocery and insights as one row (as now), and mark which tools are Plus (not done yet).
- **Train hub:** combine "My workouts" and "Program builder" into one "Create" entry.
- **Coach:** surface 3 starter questions instead of free text for new Pro users (done).
- **Run:** put "Start" first once GPS exists.

## 6. Pro coaching system (design; stages 3–5)

Everything below reuses existing pieces:
- **Data:** `snapshot.ts` and the coach tools.
- **Proposals:** `ai_messages.proposal` and `applyCoachProposalAction`.
- **Plans:** `custom-programs.ts`, `training_programs` and `user_programs`.
- **Food:** `meal_plan_settings`, `planner-client`, `grocery`.

| Capability | Plan | Complexity |
|---|---|---|
| Personalized training blueprint | Plan mode already validates an AI plan against the exercise catalog. Add the goals/schedule/equipment/history summary and save through the existing "save program" path after approval. | M |
| Adaptive training | Weekly job: compute per-lift trends (e1RM, volume, RPE drift, missed sessions) with pure functions, then let the larger model propose set/rep/load/frequency changes as proposals the user approves (no silent edits). | L |
| Personalized nutrition | AI fills `meal_plan_settings` and picks recipes for the existing planner, writing into the planner and grocery list (no separate system). Approval required. | M |
| Weekly coaching review | Deterministic weekly summary (workouts done vs planned, strength trends, nutrition adherence from `nutrition-insights`, runs, recovery check-ins), plus a short AI commentary. Stored as a report row, shown on a Pro dashboard. One Sonnet request per week counts toward the cap. | M |
| Coaching memory | `coach_memories` table (owner-only RLS): user-approved facts (goals, preferences, equipment, limitations, history notes) with a review / edit / delete screen. The coach proposes a memory and the user saves it. Included in the snapshot. | M |
| Recovery-aware recommendations | Use existing `recovery_checkins` + training load; already partly in the snapshot. | S |
| Multi-goal plans | `combined-goals.ts` already schedules strength + 5K; expose it to plan mode. | S |
| Pro dashboard | One screen: weekly review, pending proposals, memory, usage left. | M |

## 7. Running (stage 6)

`docs/RUN_TRACKING_PLAN.md` holds the full design: plugins, Info.plist and manifest keys, filtering, splits, pause and resume, privacy, and the test plan.

**Proposed order:**
1. Foreground GPS with `@capacitor/geolocation`, plus the browser preview, with Playwright tests using simulated geolocation.
2. Splits, route map, distance goals and a 10K plan.
3. Background tracking with the community plugin.

**Background tracking can't be claimed until it has been tested on a real iPhone and Android phone.**

## 8. Food tracking improvements (stage 4)

**Faster entry:**
- **Meal-level copy:** "repeat yesterday's breakfast" on the empty meal row.
- **Quick-add macros** without a food.
- **Bigger default search results.**
- **Frequent foods per meal slot.**

**Portion adjustments:** a slider with ± serving steps on the amount sheet, which already supports g/oz/servings.

**Nutrition trends:** 30/90-day weight vs intake chart.

**Later, worth evaluating:** an adaptive maintenance estimate (MacroFactor-style), labelled as an estimate.

**Photo-assisted logging (investigated, not built):**
- **How it would work:** send the photo to a vision model (Claude Sonnet or Haiku vision), get *candidate* foods with gram estimates and confidence, then the user confirms or edits each item before anything is saved.
- **Honesty rules:**
  - Always ask about oils, sauces and hidden ingredients.
  - Label results "Estimated from a photo".
  - Never present them as exact.
- **Plan:** Pro only, with the same AI consent.
- **Cost:** about $0.005–0.02 per photo (estimate).
- **Complexity:** M.

## 9. Pro body scanning: technical evaluation (future; nothing purchased)

| Vendor | What it gives | Input | Evidence | Price |
|---|---|---|---|---|
| Prism Labs | Body fat %, lean mass, circumferences, 3D avatar | 10-second 360° video (not front/side photos) | Peer-reviewed vs DXA, n = 131, r = 0.90, MAE ≈ 3.5% (Frontiers in Medicine 2024) | From $500/month (per active user) |
| Bodygram | 33–35 measurements, avatar; body fat with photo scans | Front + side photos | No published study found | Contact sales |
| 3DLOOK | 80+ measurements, body fat estimate | Two photos | Vendor claims only | ~$499/month for 100 scans (third-party listing, unverified) |
| Spren | Body fat %, lean mass | Front + side photos | No published study found | Contact sales |

**Findings:**
- **Visceral fat:** no phone camera measures it. Even DXA's value is an estimate; vendors infer it from shape.
- **Medical status:** no FDA clearance was found for these tools. Present results as wellness estimates, not medical measurements.
- **Recommendation:** evaluate Prism Labs (best evidence, has a web SDK) and Bodygram (matches the front/side photo flow).

**Phased plan:**
1. Due diligence: data-processing agreement, retention, whether images train their models, accuracy by BMI/sex/ethnicity.
2. Web prototype behind a flag, storing only derived numbers.
3. Pro beta with explicit consent naming the vendor, per-scan delete and vendor-side deletion.
4. Launch with "estimate, not a medical device" labels and a methodology page.

**Risks:**
- Sensitive images.
- Health-data laws (GDPR Art. 9; Washington's My Health My Data Act).
- Apple 5.1.2 consent requirements.

**No service has been purchased.**

## 10. Community and partnerships (evaluation; after the core is finished)

| Idea | Value | Recommendation |
|---|---|---|
| Church fitness challenges | High, differentiating | **First.** Invite-only groups with a shared challenge (workouts or days active). Private by default; no public ranking. |
| Friends / accountability groups | High | Same groups, with opt-in sharing (completed workouts only, never food, photos, journals or location). Needs reporting and blocking. |
| Optional workout challenges | Medium | Personal challenges first (e.g. 12 workouts in 30 days), then group versions. |
| Workout sharing | Medium, low cost | A shareable image card of a finished workout (user chooses what's shown). |
| Referral codes | Medium, low cost | Stripe promotion codes now; RevenueCat offer codes with IAP. |
| Trainer partnerships | Medium | Later: trainer-assigned programs via the existing program model. |
| Gym and local business partnerships | Low until there's traction | Promo codes only; no location features. |
| Fitness leaderboards | Low, conflicts with values | Not recommended (at most, opt-in friends-only volume, never Faith). |

## 11. Development priorities

| Stage | Scope | Complexity | Main files |
|---|---|---|---|
| **1 (done on this branch)** | Final memberships; Pro-only AI with 150/month and Haiku/Sonnet routing; AI consent; PostCSS fix; billing plan | M | `plans.ts`, `routing.ts`, `ai-coach.ts`, gated pages/actions, migration `20261022000021`, docs |
| 2 | Mobile billing: RevenueCat, native paywall, restore, webhook; legal pages with counsel; privacy labels | L (+ accounts) | new `/api/revenuecat/webhook`, `billing.ts`, `profile/billing`, `src/app/legal/*` |
| 3 | Training and food usability: quick-add, meal copy, trends, Train hub simplification | M | `nutrition-client.tsx`, `nutrition/page.tsx`, `train/page.tsx` |
| 4 | Adaptive coaching: memory, lift trends, adaptive proposals, Pro dashboard | L | new `coach_memories`, `src/lib/coach/*`, `src/server/coach/*` |
| 5 | AI meal planning into the planner; weekly reports | M | `meal-plan.ts`, new reports table + job |
| 6 | GPS running (foreground → background), splits, goals, 10K plan | L (+ devices) | `src/app/(app)/run/*`, Capacitor config, Info.plist, manifest |
| 7 | Run badges, body map and strength ranks, optional groups and challenges | L | `ranks.ts`, new groups tables |
| 8 | Body-scan vendor evaluation (no purchase without approval) | M | — |

## 12. Owner decisions

Decided by the owner on 2026-10-22:

1. **Prices:** Free $0, Plus $11.99/month, Pro $24.99/month. Live Stripe prices are not created or changed until the owner approves.
2. **Existing subscribers:** nobody already paying loses AI access. Existing subscriptions keep their earlier AI allowance (see `docs/MEMBERSHIPS.md`). New Plus has no AI; Pro has 150 messages a month.
3. **Yearly:** Plus $99.99/year and Pro $249.99/year, built but hidden until prices and billing are ready.
4. **RevenueCat and Apple in-app purchases:** approved to build and test in sandbox. No real charges and no deployment without approval.
5. **Legal:** list what the final privacy policy and terms need (`docs/LEGAL_REQUIREMENTS.md`). Publish no placeholder documents.
6. **Free:**
   - every rank badge (Fitness, Food and Faith);
   - 5 saved workouts;
   - viewing the calendar;
   - unlimited barcode scanning, calorie and macro tracking;
   - the complete Faith section.

   Calendar scheduling and rescheduling are Plus and Pro.

Still open: creating the Stripe prices, Apple/Google/RevenueCat accounts, legal counsel, and real-device testing.
