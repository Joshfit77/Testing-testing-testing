# Memberships: Free, Plus and Pro

Final structure set by the owner on 2026-10-22 (revised the same day: every rank badge is free, and Free keeps five saved workouts). The plans are defined in `src/lib/domain/plans.ts`, and the server
enforces each gate as well as the screen showing it. The Faith section is never gated.

## What each plan includes

| Feature | Free | Plus $11.99/mo | Pro $24.99/mo | Where it's enforced |
|---|---|---|---|---|
| Food diary, food search, barcode scanning, calories & macros, saved meals, copy meals, water, weekly nutrition insights | ✓ | ✓ | ✓ | `nutrition_tracking` (free): `src/app/api/foods/*`, `src/server/actions/nutrition*.ts` |
| Workout logging, history, exercise library | ✓ | ✓ | ✓ | `workout_logging` |
| Starter programs (13 free library programs) and the starter program built at sign-up | ✓ | ✓ | ✓ | `training_programs.tier = 'free'`, `canAccessTier` |
| Basic progress (weight, measurements, records, photos) and run/walk logging | ✓ | ✓ | ✓ | — |
| Saved workout templates | 5 | Unlimited | Unlimited | `unlimited_templates`, `templateLimit`: `src/server/actions/templates.ts` |
| Faith: Scripture, devotionals, prayer journal, practices, 40-day challenge, Faith ranks | ✓ all | ✓ | ✓ | Never gated |
| All 27 rank badges (9 Fitness, 9 Food, 9 Faith) | ✓ | ✓ | ✓ | Never gated |
| Viewing the training calendar | ✓ | ✓ | ✓ | — |
| Full program library (35 Plus programs, including running plans) | — | ✓ | ✓ | `full_program_library` / `canAccessTier` |
| Custom program builder (`/train/build`) | — | ✓ | ✓ | `custom_program_builder`: page and `buildCustomProgramAction` |
| Recipes, meal planner, grocery list | — | ✓ | ✓ | `meal_planning`: pages and `src/server/actions/{recipes,meal-plan,grocery}.ts` |
| Advanced progress & strength trends, progress-photo comparisons | — | ✓ | ✓ | `advanced_analytics` |
| Scheduling and rescheduling sessions on the training calendar | — | ✓ | ✓ | `advanced_calendar`: `movePlannedSessionAction` (viewing is free; "move back" works on every plan) |
| Interactive muscle body map and strength ranks (`/progress/body-map`) | — | ✓ | ✓ | `advanced_analytics`: page and `setStrengthStandardsAction` |
| Food Quality Scanner: product facts, indicators, ingredients, allergens, alternatives, Add to Food Diary | ✓ | ✓ | ✓ | `nutrition_tracking` |
| Food Quality Scanner: personal filters and side-by-side comparisons | — | ✓ | ✓ | `food_comparisons`: compare page and `setFoodFiltersAction` |
| Guided Body Scan (`/progress/body-scan`) | — | — | ✓ | `canUseBodyScan` + database `has_plan('pro')` and consent |
| Meal photo analysis, AI meal plans, food-quality AI explanations | — | — | ✓ | AI allowance (`withAiRequest`), AI consent, and the separate photo consent |
| AI coach (150 requests/month) and AI plan generation (15/month) | — | — | ✓ | `ai_coach`, `ai_plan_generation`: `assertAiAllowed` |

**Downgrades never delete anything.**
- Templates saved earlier stay usable; only new ones are limited.
- Programs a user built stay theirs.
- Moved sessions can always be moved back.

## AI coach: routing, limits and cost

- **Routing** (`src/lib/coach/routing.ts`):
  - Plan generation and complex requests go to Claude Sonnet 5.5 (`claude-sonnet-5-5`). Complex means designing or restructuring a program, reviewing weeks of training, a plateau or stall, anything about pain, injury or a medical condition, or very long messages.
  - Everything else goes to Claude Haiku 5.5 (`claude-haiku-5-5`).
  - Override the models with `COACH_MODEL_FAST` and `COACH_MODEL_SMART`.
- **Cap:** Pro gets 150 requests a month, of which at most 15 can use Sonnet (`PLAN_PRO_AI_SMART_MONTHLY_LIMIT`). Chat stops escalating to Sonnet 5 requests early, so plan generation stays available. The split is therefore at most about 90/10 by construction.
- **Metering:**
  - Every request is recorded in `ai_usage_events` with its model and tier (migration `20261022000021`).
  - Limits are checked on the server before each call.
  - Users can't write usage rows.
- **Cost estimate:** worst case at full use, list prices from October 2026, before prompt-caching savings. *Estimates, not measurements: no live API call can be made from this environment.*

  | Request | Cost per request |
  |---|---|
  | Haiku chat ($0.10 / $0.50 per million tokens) | ≈ $0.003 |
  | Sonnet chat ($2 / $10) | ≈ $0.07 |
  | Sonnet plan generation | ≈ $0.10 |
  | **Pro user at the full 150** | **≈ $2 a month** |

  **For comparison:** the previous defaults (Pro: 400 requests a month on Opus) could cost ≈ $50 a month per heavy user, more than the plan price.
- **Consent:** nothing goes to the AI provider until the user taps "Allow and continue" on the AI Coach screen. That screen lists what's shared, and the server also checks the consent (App Store guideline 5.1.2(i)). Users can turn it off in Profile & Settings → Privacy & data (`profiles.ai_data_consent_at`).

## Existing subscribers (grandfathering)

Before this change Plus included 60 AI coach messages a month, and Pro 400 messages and 20 plan generations.
Nobody already paying loses AI access unexpectedly:

- **What's kept:** migration `20261022000022_legacy_plan_terms.sql` records every Stripe subscription that exists when it runs (active, trialing, past due, unpaid, paused, or cancelled but still inside its paid period) in `legacy_plan_terms`, with its previous AI allowance:
  - existing Plus: 60 messages a month (no plan generation, as before);
  - existing Pro: 400 messages and 20 plan generations a month.

  Requests run on the new Haiku/Sonnet routing, and at most 10% use Sonnet (6 a month for Plus, 40 for Pro). Worst-case cost ≈ $0.60 per legacy Plus and ≈ $4 per legacy Pro subscriber a month (estimates).
- **How long:** for as long as that subscription stays on the same plan and keeps access. Upgrading a legacy Plus subscription to Pro gives Pro's allowance; when the subscription ends, the terms end with it. Re-subscribing later follows the new plans. The owner can set `ends_at` to end the terms earlier, with notice.
- **New subscriptions** follow the new plans: Plus has no AI, Pro has 150 messages a month.
- **No existing subscribers:** if there are none, the migration inserts nothing and the new structure applies directly.
- **Nothing changes in Stripe or in the subscription records.** Subscribers on the old prices keep paying the old prices until the owner migrates them in Stripe; the app never changes a price.
- **Members see it:** Plans & billing shows a note that their subscription kept its AI allowance.
- **Not covered:** Plus or Pro granted by an admin (not paid) isn't recorded; an admin can grant Pro instead.
- **Old prices keep working.** When new Stripe prices are created, list the old price IDs in `STRIPE_PRICE_PLUS_LEGACY` / `STRIPE_PRICE_PRO_LEGACY`. As a safety net, a renewal on a price the server doesn't recognise keeps the plan already stored for that subscription instead of dropping the subscriber to Free.

## Yearly plans

Approved prices: **Plus $99.99/year** (saves 30%) and **Pro $249.99/year** (saves 16%). They are built but **hidden**:

- They appear only when `BILLING_YEARLY_ENABLED=true`.
- Web checkout for a yearly plan also needs that plan's Stripe price (`STRIPE_PRICE_PLUS_YEARLY` / `STRIPE_PRICE_PRO_YEARLY`).
- In the iPhone/Android app, they also need the yearly products set up in App Store Connect / Play Console and RevenueCat (see `docs/MOBILE_BILLING.md`).
- The env vars `PLAN_PLUS_YEARLY_PRICE_CENTS` / `PLAN_PRO_YEARLY_PRICE_CENTS` override the displayed price.

## Prices and billing: what the owner must do before launch

- **Stripe:** display prices come from `plans.ts`, but **Stripe charges whatever price `STRIPE_PRICE_PLUS` and `STRIPE_PRICE_PRO` point at.** Create new $11.99 and $24.99 recurring prices in Stripe and update those env vars before deploying. Changing code doesn't change what Stripe charges.
- **Existing subscribers:** see *Existing subscribers (grandfathering)* above.
- **App stores:** App Store / Google Play subscriptions through RevenueCat are built on `claude/stage2-store-billing` and off until configured; see `docs/MOBILE_BILLING.md`.
