# AI cost analysis

**No live AI calls were made** (paid AI stays off, by the owner's instruction). Every figure is **modelled** from the
code's per-request estimates and limits; replace them with measurements from a capped live evaluation (needs the
owner's approval and a spending cap).

## What protects spending (verified by tests)

| Limit | Value | Where |
|---|---|---|
| Per Pro member | $1.40 a month (enforced), 150 requests a month, 6 a minute, 2 at once | `src/server/services/ai-budget.ts`, `ai-limits` tests |
| App-wide | $100 a month and about $6.67 a day by default; 20 requests at once | `AI_GLOBAL_*` settings (documented in `.env.example`) |
| Per request | $0.015 (fast model) / $0.40 (larger model) ceiling | `src/lib/domain/ai-economics.ts` |
| Kill switch | Feature flag `ai_coach`, fails closed | `ai-kill-switch` test |
| Free members | No generative AI | `bible-ai.ts`, membership tests |
| **New:** admin warning when the app-wide limit can't cover the current Pro members | — | `/admin/ai-costs` |

## Models and prices (checked 2026-11-25)

| Model | Use | Price per million tokens |
|---|---|---|
| Claude Haiku 5.5 | Everyday coaching, meal plans, photos | $0.10 in, $0.50 out |
| Claude Sonnet 5.5 | Programs, pain/injury and reviews (capped at about 10%) | $2 in, $10 out |

Cache reads cost 0.1× the input price.

## Assumptions

| Assumption | Value |
|---|---|
| Cost per request (code estimates) | Fast chat $0.0034; larger chat $0.080; program $0.10; meal plan $0.006; meal photo $0.004; weekly report $0.0015 |
| **Low** usage | 40% of Pro members use AI: 20 fast chats, 1 larger, 5 photos, 4 weekly reports → **$0.07 per subscriber-month** |
| **Medium** usage | 60% use: 60 fast, 4 larger, 1 program, 10 photos, 4 reports, 1 meal plan → **$0.41** |
| **Maximum** | Everyone spends the enforced limit → **$1.40** (a hard ceiling) |
| Net revenue per subscriber-month (50/50 monthly/annual) | $11.76 (App Store 15%) / $9.66 (App Store 30%) |

## Monthly AI cost by paying subscribers

| Subscribers | Low | Medium | Maximum | Maximum as share of net revenue (15% / 30% Apple) | App-wide limit needed (maximum × 1.2) |
|---|---|---|---|---|---|
| 100 | $7 | $41 | $140 | 11.9% / 14.5% | $168 |
| 500 | $35 | $203 | $700 | 11.9% / 14.5% | $840 |
| 1,000 | $70 | $406 | $1,400 | 11.9% / 14.5% | $1,680 |
| 5,000 | $348 | $2,028 | $7,000 | 11.9% / 14.5% | $8,400 |
| 10,000 | $696 | $4,056 | $14,000 | 11.9% / 14.5% | $16,800 |

**Important:** the default app-wide limit ($100 a month) is used up by about 70 members at the maximum. When it is
reached, **the AI stops for every member** until the month ends. Raise `AI_GLOBAL_MONTHLY_BUDGET_USD` before charging
customers; the admin AI page now warns when it is too low.

**Main uncertainty:** output and "thinking" tokens per request are assumed, not measured. If real requests cost twice
the model, the medium case doubles. The $1.40 cap still holds, but members reach it sooner.

## Reliability and safety (current design)

- Timeouts with one retry for chat.
- Refusals handled in every feature; the larger model opts into server-side fallback.
- Structured outputs are schema-validated.
- Proposals need the member's confirmation.
- Health, journal and recovery data reach the AI only with separate consent, now also enforced in the database.
- Untrusted text is marked as such in prompts.

**Not verified:** the quality and safety of real AI fitness and nutrition advice.

- Needs a capped live evaluation (`scripts/ai-eval/`) and review by a qualified professional before AI is switched on
  for paying members.
- Estimated live-evaluation cost: under $10 with a cap.
