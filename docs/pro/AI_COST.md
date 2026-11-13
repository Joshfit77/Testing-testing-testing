# AI cost controls and projections

2026-11-13, branch `claude/pro-premium`. These are **modelled figures, not measurements**: no API key is configured here,
so no live model call was made. Model prices are Anthropic's published first-party prices (per million tokens), as recorded in
`docs/ai-eval/COST_MODEL.md` and coded in `src/lib/domain/ai-economics.ts`. Expected request sizes come from the
same cost model (measured prompt sizes, assumed output lengths).

## What is enforced now (server side, before any provider call)

All of this is in the database function `reserve_ai_usage` (migration `20261113000066_ai_cost_controls.sql`), which the
server calls under a per-member lock and then a global lock. The app cannot skip it: members cannot call it, and the
provider is only called after it succeeds.

| Control | Default | Where | When reached |
|---|---|---|---|
| Per-member monthly AI budget (money) | $1.3999 (derived below) | `AI_MEMBER_MONTHLY_BUDGET_USD` | AI requests are refused until the 1st: "You've reached this month's AI allowance… everything else in the app keeps working" (HTTP 429) |
| Global monthly AI budget (money, every member and every AI feature, including the free Bible helper) | $100 | `AI_GLOBAL_MONTHLY_BUDGET_USD` | All AI is paused until the budget is raised or the month ends; message says non-AI features are unaffected (HTTP 503). `0` switches AI off |
| Alerts to operators | 50%, 75%, 90%, 100% of the global budget, once each per month | server log `ai.budget_alert` + optional `AI_BUDGET_ALERT_WEBHOOK_URL` (Slack-style `{text}`) | Totals only, never member data |
| Requests running at once, per member | 2 | `ai-budget.ts` | "Your previous AI request is still being answered" (HTTP 409) |
| Requests running at once, whole app | 20 | `AI_MAX_CONCURRENT` | "The AI coach is busy right now. Please try again in a minute." (HTTP 503) |
| Request count allowance (unchanged) | 150 a month on Pro | `PLAN_PRO_AI_MONTHLY_LIMIT` | as before |
| Larger-model share | **10 a month (was 15)** | `PLAN_PRO_AI_SMART_MONTHLY_LIMIT` | requests run on the fast model; plan generation (which needs the larger model) stops |
| Automatic switch to the fast model | when a member has used 75% of their budget, or the app 90% of the global budget | migration 066 | chat continues on Haiku instead of Sonnet; plan generation is not downgraded |
| Per-request cost ceiling (chat) | $0.025 on the fast model, $0.40 on the larger | `REQUEST_CEILING_MICROS` | the coach must answer with what it has (no further tool rounds) |
| Per-minute rate limit (unchanged) | per route | `reserve_ai_usage`, route limits | as before |
| Request length (unchanged, reviewed) | chat message ≤ 4,000 characters; history ≤ 24,000 characters; ≤ 6 tool rounds; output ≤ 12,000 tokens (chat), 16,000 (plan), 8,000 (meal plan), 2,000–2,500 (photos), 1,500 (weekly report), 1,200 (food explain), 2,000 (Bible helper, question ≤ 600 characters) | `schemas.ts`, `ai-coach.ts`, each service | the request is refused (too long) or the answer is marked "shortened" |

How the money is counted: each request holds its **expected** cost while it runs; when it finishes, the hold is replaced
by its **real** cost, computed from the provider's usage block (uncached input, cache writes, cache reads and output each at
its own price). A failed provider call gives the hold back. A request whose server died is closed after 6 minutes and
charged at its estimate, so a crash can't leak budget. The free Bible helper keeps its own question limits; it checks the
global budget before each question and adds its real cost afterwards.

**Nothing here charges a member extra or touches non-AI features.** Reaching any limit only stops AI requests, with a
message saying so. Logging, programs, nutrition, Faith (including the 40-day challenge), GPS, sleep and the daily recovery
check-in keep working.

Changed business rule, stated plainly: the larger-model share on Pro went from 15 to 10 a month so that a member who uses
the whole allowance stays within the sustainable budget at expected costs. The 150-request allowance and the prices are
unchanged. Both are environment settings, so the owner can restore 15 without a code change.

## How the per-member budget is derived

`sustainableAiBudget()` takes the approved prices ($17.99 a month, $119.99 a year), removes store or Stripe fees, and sizes
the AI budget against the channel that leaves the least:

| Channel | Gross per member-month | Net per member-month |
|---|---|---|
| Web, monthly (Stripe 2.9% + 30¢) | $17.99 | $17.17 |
| Web, yearly (Stripe, charged once) | $10.00 | $9.68 |
| App Store / Play, monthly at 15% | $17.99 | $15.29 |
| App Store / Play, yearly at 15% | $10.00 | $8.50 |
| App Store / Play, monthly at 30% | $17.99 | $12.59 |
| **App Store / Play, yearly at 30% (lowest)** | **$10.00** | **$7.00** |

Yearly members pay up front but use AI all year, so the yearly price is spread over 12 months and the budget is enforced
**month by month**: a yearly member can't spend the year's AI in the first month, and a refund in month 2 doesn't leave a
year of AI already spent.

Assumptions (owner to confirm, all overridable): other operating cost $1.00 per Pro member-month (hosting, database,
storage, email, monitoring, support tools; an estimate, not a bill), and AI may use at most 20% of the lowest net, leaving
the rest for margin, refunds, chargebacks, taxes not counted above and growth.

Budget = min($7.00 − $1.00, 20% × $7.00) = **$1.40 per Pro member per month** (1,399,880 micro-USD).

## What a request costs (expected, cold cache)

| Request | Model | Expected cost | Held while running |
|---|---|---|---|
| Chat, fast | Haiku 5.5 | $0.0034 | $0.0034 |
| Chat, larger model | Sonnet 5.5 | $0.080 | $0.080 |
| Plan generation | Sonnet 5.5 | $0.10 | $0.10 |
| Meal plan | Haiku 5.5 | $0.006 | $0.006 |
| Food photo / label | Haiku 5.5 | $0.004 | $0.004 |
| Food explanation | Haiku 5.5 | $0.0025 | $0.0025 |
| Weekly report | Haiku 5.5 | $0.0015 | $0.0015 |
| Bible helper question | Haiku 5.5 | ≤ $0.002 | not held (checked, then settled) |

Routine requests use Haiku; the router (`src/lib/coach/routing.ts`) sends a chat to Sonnet only for plan generation and
complex questions, within the member's larger-model share and only while the budgets have room.

## Projections per Pro member-month

| Member | Expected AI cost | Share of the lowest net ($7.00) | Margin on the lowest net after AI and $1.00 other costs |
|---|---|---|---|
| Light (≈20 fast chats) | $0.07–0.24 | 1–3% | $5.76–5.93 |
| Typical (≈60 fast chats, 3 larger-model) | $0.37–0.70 | 5–10% | $5.30–5.63 |
| Heavy (all 150 requests, 10 larger-model) | about $1.28 at expected sizes | 18% | $4.72 |
| Most a member can be charged in AI before being stopped | $1.40 budget, plus at most the overshoot of the requests already running (≤ $0.04 each on Haiku; ≤ about $0.58 each on Sonnet, which stops being used at 75% of the budget) | ≤ about 32% in the rare worst case | ≥ about $3.80 |

Before this change the worst case (every request at the output cap) was about $22 a member-month, more than the price.
It is now bounded by the money budget.

Higher-net channels have more headroom: on web monthly ($17.17 net) a heavy member leaves about $14.90.

Free members: the only AI they can use is the Bible helper (Faith stays free), limited to 10 questions a day and 60 a
month; at most about $0.12 a month each, paid from the global budget. Pro members' Bible questions (up to 400 a month,
at most about $0.80) also come from the global budget, not their own.

## Setting the global budget

The $100 default suits internal testing and a small beta. For a paid launch, a reasonable starting point is:

    global budget ≈ Pro members × $0.70 (typical cold-cache) × 1.5  +  free members × $0.05

For example 1,000 Pro and 5,000 free members: about $1,050 + $250 = **$1,300 a month**. The alerts at 50/75/90% say when
it needs raising. Also set a workspace spend limit in the Anthropic Console as an independent backstop.

## Not verified

* No live model call: real output lengths, cache hit rates and costs are modelled. Run the evaluation harness with a real
  key and a low Console spend limit, then compare `ai_usage_events.cost_micros` with the Anthropic usage page.
* The alert webhook is tested against a stub, not a real Slack channel.
* Store commission (15% vs 30%) depends on Small Business Program enrolment; the budget assumes the worse.

## Tests

* `tests/unit/ai-economics.test.ts`: prices, rounding, unknown models priced high, channel nets, budget derivation, the Pro
  allowance fitting the budget, thresholds.
* `tests/unit/ai-budget.test.ts`: env overrides, alert text, webhook delivery, alerts never break a request.
* `tests/integration/ai-budget.test.ts` (local Supabase): member cap with running requests counted, real cost replacing the
  hold exactly once, release, global cap and raising it, alerts once per threshold per month, downgrade to the fast model,
  per-member and app-wide concurrency, crash recovery, the Bible helper counted against the same budget, members locked out.
