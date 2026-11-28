# Biblical AI: cost projections

Estimates, not measurements of a live service: no AI request was made (no API key is configured here). They combine:

- **Prices:** Anthropic's published first-party prices as recorded in the app's own table,
  `MODEL_PRICES` in `src/lib/domain/ai-economics.ts` (read 2026-11-02). Haiku 5.5: $0.10 input, $0.50 output and
  $0.01 cache-read per million tokens. Sonnet 5.5: $2.00, $10.00 and $0.10. Re-check before launch.
- **Prompt sizes, measured:** the real retrieval and message builder over the 314 evaluation questions
  (2026-11-28):
  - system prompt plus tool schema: 7,924 characters;
  - question messages: 803 characters (quick), 1,801 (standard) and 6,694 (deep) on average;
  - 95th percentile: 2,195, 5,033 and 25,698.
- **Assumptions, stated:**
  - about 4 characters per token for English, about 3 for deep studies (Greek and Hebrew cost more tokens);
  - output of 300, 700 and 1,500 tokens for quick, standard and deep;
  - one corrective retry on 20% of questions.

## Per request

| Request | Input tokens (est.) | Output tokens (est.) | Cost, no cache | Cost, cached instructions |
|---|---|---|---|---|
| Quick (Haiku) | 2,181 | 300 | $0.0004 | $0.0002 |
| Standard (Haiku) | 2,431 | 700 | $0.0007 | $0.0005 |
| Deep (Sonnet, Pro) | 4,212 | 1,500 | $0.0281 | $0.0236 |
| Deep (Haiku fallback) | 4,212 | 1,500 | $0.0014 | $0.0012 |
| Study plan, 30 days (Haiku) | ~6,000 | ~9,000 | $0.0061 | — |
| Study plan, 90 days (Haiku) | ~7,000 | ~18,000 (limit 20,000) | $0.0097 | — |


Routing:

- Quick and standard answers use the fast model (Haiku).
- Deep studies use Sonnet for Pro members. Within a member's budget, the reservation falls back to Haiku when the
  larger-model share or the budgets are tight.
- Study plans use Haiku.

## Per member per month

The usage profiles are assumptions:

- **Free:** light 3 quick and 7 standard; moderate 8 and 22; heavy 15 and 45. Free is capped at 3 a day and 60 a month.
- **Pro:**
  - light: 5 quick, 15 standard, 2 deep;
  - moderate: 15, 45, 10 and one study;
  - heavy: 40, 160, 40 and three studies.

| Plan | Light | Moderate | Heavy |
|---|---|---|---|
| Free | $0.006 | $0.019 | $0.04 |
| Pro | $0.069 | $0.326 | $1.27 |

Blended per active member (60% light, 30% moderate, 10% heavy): Free $0.013, Pro $0.267.

## By number of active Biblical AI users

The share of Pro members among Biblical AI users is assumed at 15% and at 30%.

| Active Biblical AI users | Monthly AI cost (15% Pro) | Monthly AI cost (30% Pro) | Per paying subscriber (15% Pro) |
|---|---|---|---|
| 100 | $5 | $9 | $0.34 |
| 500 | $26 | $45 | $0.34 |
| 1,000 | $51 | $89 | $0.34 |
| 2,500 | $128 | $223 | $0.34 |
| 5,000 | $257 | $447 | $0.34 |
| 10,000 | $514 | $894 | $0.34 |
| 25,000 | $1,285 | $2,235 | $0.34 |
| 50,000 | $2,570 | $4,469 | $0.34 |

## What bounds the cost

These limits are enforced in code. The estimates above can't exceed them.

- **Free:** 3 questions a day and 60 a month (configurable). There is also a Biblical AI money budget of $0.30 per Free
  member a month (`FREE_MEMBER_BUDGET_MICROS`). No deep studies and no study plans.
- **Pro:** 40 questions a day and 400 a month. This sits within the member's existing AI money budget of $1.40 a month,
  shared with the fitness coach. Larger-model requests come out of the existing larger-model share.
- **Everyone:** the app-wide monthly and daily AI budgets, the in-flight limits and the AI kill switch (the `ai_coach`
  flag) apply. When the global budget is used up, Biblical AI pauses with a message; reading the Bible is unaffected.
- **Retries:** at most two provider calls per question: one corrective retry after failed checks, or one retry with a
  larger output limit after an answer is cut off. Both calls are costed and counted against the budgets. A plan has
  the same two-call limit.

**Against revenue:** a heavy Pro member's estimated $1.27 a month is about 15% of the lowest net revenue per
member-month ($8.62, App Store yearly at 30%; `docs/pro/AI_COST.md`). On the Pro price that is within the existing
$1.40 budget. A Free member's cost is not covered by revenue: at the default limits it is at most about $0.04 a month,
and at most $0.30 by budget. This is a founder decision (see PRODUCT_DECISIONS.md).
