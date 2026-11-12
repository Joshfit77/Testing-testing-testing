# Memberships: Free and Pro All Access

Owner decision of 2026-10-26. New customers choose between two memberships only. The plans are defined in
`src/lib/domain/plans.ts`; the membership screen's comparison is `src/lib/domain/membership.ts`. Every paid feature is
enforced on the server (and, where members write directly to the database, by database rules) as well as on screen.

| Membership | Price | Who can buy it |
|---|---|---|
| Free | $0 | Everyone |
| Pro All Access, monthly | $19.99 / month | New and existing members |
| Pro All Access, yearly | $149.99 / year (saves 37% against 12 monthly payments) | New and existing members |
| Plus (legacy) | What the subscriber already pays | Nobody new: kept only for subscriptions that already exist |

Monthly and yearly Pro unlock exactly the same features.

## What each membership includes

| Feature | Free | Pro | Enforced by |
|---|---|---|---|
| Workout logging, history, records, rest timers, substitutions | ✓ | ✓ | `workout_logging` |
| All 157 exercise demonstrations and instructions | ✓ | ✓ | never gated |
| Starter programs | ✓ | ✓ | `training_programs.tier = 'free'` |
| Saved workout templates | 5 | Unlimited | `templateLimit`, database trigger |
| Training calendar | View | Schedule & reschedule | `advanced_calendar`, database policy |
| Full program library (strength, bodybuilding, powerlifting, athletic, combat sports, calisthenics, running) | — | ✓ | `canAccessTier`, `can_use_program()` |
| Custom program builder | — | ✓ | `custom_program_builder`, database policy |
| Strength progression, advanced analytics, muscle map | — | ✓ | `advanced_analytics` |
| Adaptive training and deload guidance | — | ✓ | `advanced_recommendations` |
| Food diary, calories, macros, barcode scanning, food search, manual entry, saved meals, basic insights | ✓ | ✓ | `nutrition_tracking` |
| Recipes, meal planning, grocery lists | — | ✓ | `meal_planning`, database policies |
| Food comparisons and personal filters | — | ✓ | `food_comparisons` |
| "Fits your goals" product analysis | — | ✓ | `food_goal_analysis` |
| Manual run and walk logging, pace and totals | ✓ | ✓ | never gated |
| Live GPS run and walk recording, route maps, splits | — | ✓ | `live_gps`, `saveGpsActivityAction`, database trigger `enforce_live_gps_plan` |
| Sleep logging, duration and goals | ✓ | ✓ | never gated |
| Sleep quality breakdowns, trends, sleep debt, schedule and energy insights | — | ✓ | `sleep_analytics` |
| Weight, measurements, progress photos, badges | ✓ | ✓ | never gated |
| Progress-photo comparisons | — | ✓ | `advanced_analytics` |
| Body Scan | — | ✓ | `canUseBodyScan`, database `has_plan('pro')` and consent |
| AI coach, AI plans, AI meal plans, food-photo analysis, AI sleep coaching | — | ✓ | `ai_coach`, `assertAiAllowed`, `withAiRequest` |
| The entire Faith & Discipline section | ✓ | ✓ | never gated |

**Nothing a member made or recorded is removed when they move to Free.** Templates, programs, recipes, plans, photos,
scans, runs and routes stay theirs to view, edit, export and delete; only new paid-feature writes are refused. A live
GPS recording left unsaved on the phone stays there until it's saved (with Pro) or discarded.

## AI allowance and cost

- Pro: 150 AI requests a calendar month, at most 15 of them plan generations, and at most 15 on the larger model
  (`PLAN_PRO_AI_*`). Every AI feature reserves one request in the database before calling the model
  (`reserve_ai_usage`), so the limit holds across server instances. One coach message counts once, even when it makes
  several model calls for tools; its tokens are recorded.
- Routing (`src/lib/coach/routing.ts`): plan generation and complex questions use Claude Sonnet 5.5, everything else
  Claude Haiku 5.5. Official prices (checked 2026-10-26): Haiku $0.10 / $0.50 and Sonnet $2 / $10 per million input /
  output tokens.
- Estimated AI cost per Pro member (forecast in `docs/launch-audit/FINAL_MEMBERSHIP_IMPLEMENTATION.md`): about $0.31
  (light use) to $1.62 (full allowance, most expensive mix) a month. Estimates from the code's prompt sizes, not
  measurements.
- Nothing goes to the AI provider until the member allows it on the AI Coach screen; meal photos need a second consent.

## Existing subscribers

- **Plus subscriptions keep what they paid for**: the same features (including live GPS, which every plan had then),
  their recorded AI allowance (`legacy_plan_terms`), and their price, until the subscription ends or the owner changes
  its terms with notice. Plus is never offered to anyone else; a Plus member sees Pro All Access as an upgrade.
- **Earlier Pro subscriptions** keep their recorded allowance (400 requests, 20 plans) under the same rule.
- **Earlier Stripe prices keep mapping to their plan**: list them in `STRIPE_PRICE_PLUS*` / `STRIPE_PRICE_*_LEGACY`.
  A renewal on a price the server doesn't recognise keeps the plan already stored, so a configuration change never
  drops a paying subscriber to Free.
- No live subscription, price or entitlement is changed by this code. Moving existing subscribers to new prices is a
  Stripe / App Store / Google Play operation for the owner to approve.

## Prices actually charged

- **Website:** checkout reads the configured Stripe prices and refuses one whose amount, currency or interval differs
  from the approved price; the screen shows Stripe's amount.
- **App:** the paywall shows the App Store / Google Play price string (localized) for `ngf_pro_monthly` and
  `ngf_pro_yearly`, and never a price the store doesn't return. See `docs/MOBILE_BILLING.md`.
