# Memberships: Free, Plus and Pro

Final structure set by the owner on 2026-10-22. The plans are defined in `src/lib/domain/plans.ts`, and the server
enforces each gate as well as the screen showing it. The Faith section is never gated.

## What each plan includes

| Feature | Free | Plus $11.99/mo | Pro $24.99/mo | Where it's enforced |
|---|---|---|---|---|
| Food diary, food search, barcode scanning, calories & macros, saved meals, copy meals, water, weekly nutrition insights | ✓ | ✓ | ✓ | `nutrition_tracking` (free): `src/app/api/foods/*`, `src/server/actions/nutrition*.ts` |
| Workout logging, history, exercise library | ✓ | ✓ | ✓ | `workout_logging` |
| Starter programs (13 free library programs) and the starter program built at sign-up | ✓ | ✓ | ✓ | `training_programs.tier = 'free'`, `canAccessTier` |
| Basic progress (weight, measurements, records, photos) and run/walk logging | ✓ | ✓ | ✓ | — |
| Saved workout templates | 3 | Unlimited | Unlimited | `unlimited_templates`, `templateLimit`: `src/server/actions/templates.ts` |
| Faith: Scripture, devotionals, prayer journal, practices, 40-day challenge, Faith ranks | ✓ all | ✓ | ✓ | Never gated |
| Fitness & Food ranks | 1–3 | All 9 | All 9 | `full_rank_badges`, `applyRankPlanLimit` (`src/lib/domain/ranks.ts`) |
| Full program library (35 Plus programs, including running plans) | — | ✓ | ✓ | `full_program_library` / `canAccessTier` |
| Custom program builder (`/train/build`) | — | ✓ | ✓ | `custom_program_builder`: page and `buildCustomProgramAction` |
| Recipes, meal planner, grocery list | — | ✓ | ✓ | `meal_planning`: pages and `src/server/actions/{recipes,meal-plan,grocery}.ts` |
| Advanced progress & strength trends, progress-photo comparisons | — | ✓ | ✓ | `advanced_analytics` |
| Rescheduling sessions on the training calendar | — | ✓ | ✓ | `advanced_calendar`: `movePlannedSessionAction` (viewing is free; "move back" works on every plan) |
| AI coach (150 requests/month) and AI plan generation (15/month) | — | — | ✓ | `ai_coach`, `ai_plan_generation`: `assertAiAllowed` |

**Downgrades never delete anything.**
- Templates saved earlier stay usable; only new ones are limited.
- Ranks are derived from activity, so reached ranks reappear on upgrade.
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

## Prices and billing: what the owner must do before launch

- **Stripe:** display prices come from `plans.ts`, but **Stripe charges whatever price `STRIPE_PRICE_PLUS` and `STRIPE_PRICE_PRO` point at.** Create new $11.99 and $24.99 recurring prices in Stripe and update those env vars before deploying. Changing code doesn't change what Stripe charges.
- **Existing subscribers:** they keep the plan their Stripe price maps to (`planForPrice` in `src/server/services/billing.ts`). They stay on their old price until you migrate them in Stripe.
  - **Owner decision:** existing *Plus* subscribers lose AI coaching under this structure. Grandfather them (move them to Pro at their price), or notify them.
- **Yearly:** the yearly option is hidden unless `PLAN_PRO_YEARLY_PRICE_CENTS` and `STRIPE_PRICE_PRO_YEARLY` are both set. The old $119.99 yearly price would undercut the new monthly Pro by 60%. Existing yearly subscribers still map to Pro. **Owner decision:** the new yearly prices, if any.
- **App stores:** see `docs/MOBILE_BILLING.md`. The iOS app can't unlock paid plans without Apple in-app purchase.
