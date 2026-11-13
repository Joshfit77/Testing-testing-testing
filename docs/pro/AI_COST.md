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
| Per-member monthly AI budget (money) | $1.40 (the owner target; see below) | `AI_MEMBER_MONTHLY_BUDGET_USD` | AI requests are refused until the 1st: "You've reached this month's AI allowance… everything else in the app keeps working" (HTTP 429) |
| Global monthly AI budget (money, every member and every AI feature, including the Bible helper) | $100 | `AI_GLOBAL_MONTHLY_BUDGET_USD` | All AI is paused until the budget is raised or the month ends; message says non-AI features are unaffected (HTTP 503). `0` switches AI off |
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
charged at its estimate, so a crash can't leak budget. The Bible helper (Pro only since the 2026-11-13 overhaul) keeps its own question limits; it checks the
global budget before each question and adds its real cost afterwards.

**Nothing here charges a member extra or touches non-AI features.** Reaching any limit only stops AI requests, with a
message saying so. Logging, programs, nutrition, Faith (including the 40-day challenge), GPS, sleep and the daily recovery
check-in keep working.

Changed business rule, stated plainly: the larger-model share on Pro went from 15 to 10 a month so that a member who uses
the whole allowance stays within the sustainable budget at expected costs. The 150-request allowance and the prices are
unchanged. Both are environment settings, so the owner can restore 15 without a code change.

## How the per-member budget is derived

Updated 2026-11-13 for the launch prices ($17.99 a month, $119.99 a year; previously $19.99 / $149.99).
`revenueChannels()` and `channelEconomics()` in `src/lib/domain/ai-economics.ts` work out, for every way a member can pay,
what is left after the provider's fees (provider fees as published, checked 2026-11-13):

* **Stripe (web):** 2.9% + 30¢ per charge, plus Stripe Billing's 0.7% of billing volume. A yearly member is charged
  once a year, so the 30¢ is paid once, not twelve times.
* **Google Play:** 15% on subscriptions from the first day.
* **App Store:** 30% in a subscriber's first year of paid service, 15% after a year, or 15% from the start under the
  App Store Small Business Program.
* **RevenueCat:** free up to $2,500 of monthly tracked revenue, then 1%. Modelled at 1% throughout (conservative).
* **Other operating cost:** $1.00 per Pro member-month (hosting $0.35, database $0.30, storage $0.10, email and
  monitoring $0.10, support and other tools $0.15). These are estimates, not bills.
* **Refunds and chargebacks:** 2% of gross held back.
* Yearly prices are spread over 12 months, and the AI budget is enforced **month by month**: a yearly member gets a
  monthly allocation, can't spend the year's AI in the first month, and a refund in month 2 doesn't leave a year of AI
  already spent.

Per Pro member-month, with AI at the full $1.40 budget (the most a member can be charged in AI before being stopped):

| Channel | Gross | Net after fees | Refunds (2%) | Other costs | AI (max) | Left | AI as % of net |
|---|---|---|---|---|---|---|---|
| Web, monthly (Stripe) | $17.99 | $17.04 | $0.36 | $1.00 | $1.40 | $14.28 | 8.2% |
| Web, yearly (Stripe, charged once) | $10.00 | $9.61 | $0.20 | $1.00 | $1.40 | $7.01 | 14.6% |
| Google Play, monthly (15%) | $17.99 | $15.11 | $0.36 | $1.00 | $1.40 | $12.35 | 9.3% |
| Google Play, yearly (15%) | $10.00 | $8.40 | $0.20 | $1.00 | $1.40 | $5.80 | 16.7% |
| App Store, monthly at 15% | $17.99 | $15.11 | $0.36 | $1.00 | $1.40 | $12.35 | 9.3% |
| App Store, yearly at 15% | $10.00 | $8.40 | $0.20 | $1.00 | $1.40 | $5.80 | 16.7% |
| App Store, monthly at 30% | $17.99 | $12.41 | $0.36 | $1.00 | $1.40 | $9.65 | 11.3% |
| **App Store, yearly at 30% (lowest)** | **$10.00** | **$6.90** | $0.20 | $1.00 | $1.40 | **$4.30** | **20.3% ⚑** |

**Flag for the owner.** On one channel only (App Store yearly, first year, without the Small Business Program) the
full AI budget is 20.3% of net, just over the 20% guideline; 20% of $6.90 would be $1.38. Every channel still leaves at
least $4.30 a member-month after AI, fees, refunds and other costs, so no channel loses money even at the cap. The $1.40
target, the 150 requests and the 10 advanced requests were **kept unchanged** (no allowance or budget was raised or
lowered). Ways to clear the flag, for you to choose: enrol in the App Store Small Business Program (that channel's net
becomes $8.40 and AI 16.7%), or set `AI_MEMBER_MONTHLY_BUDGET_USD=1.38`. At typical use ($0.37–0.70 a member-month)
AI is 2–10% of net on every channel and nothing is flagged.

What this means at a typical member ($0.70 of AI): $15.31 left on web monthly, $5.00 on the lowest channel.

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

| Member | Expected AI cost | Share of the lowest net ($6.90) | Margin on the lowest net after AI, $1.00 other costs and 2% refunds |
|---|---|---|---|
| Light (≈20 fast chats) | $0.07–0.24 | 1–3% | $5.46–5.63 |
| Typical (≈60 fast chats, 3 larger-model) | $0.37–0.70 | 5–10% | $5.00–5.33 |
| Heavy (all 150 requests, 10 larger-model) | about $1.28 at expected sizes | 19% | $4.42 |
| Most a member can be charged in AI before being stopped | $1.40 budget, plus at most the overshoot of the requests already running (≤ $0.04 each on Haiku; ≤ about $0.58 each on Sonnet, which stops being used at 75% of the budget) | ≤ about 32% in the rare worst case | ≥ about $3.50 |

Before this change the worst case (every request at the output cap) was about $22 a member-month, more than the price.
It is now bounded by the money budget.

Higher-net channels have more headroom: on web monthly ($17.04 net) a heavy member leaves about $14.40.

Free members: **no billable AI at all** since the 2026-11-13 overhaul (the Bible study helper moved to Pro; Bible
reading, prayer, journeys and the 40-day challenge stay free). `tests/integration/ai-access.test.ts` calls every AI entry
point as a Free member and checks that the provider receives nothing and nothing is reserved. Pro members' Bible
questions go through the same pipeline and count against their monthly allowance (`docs/pro/AI_COACH_OVERHAUL.md`).

## Setting the global budget

The $100 default suits internal testing and a small beta. For a paid launch, a reasonable starting point is:

    global budget ≈ Pro members × $0.70 (typical cold-cache) × 1.5

For example 1,000 Pro members: about **$1,050 a month** (Free members cost nothing). The hard ceiling is Pro members ×
$1.40 ($1,400 for 1,000). The alerts at 50/75/90% say when it needs raising. Also set a workspace spend limit in the
Anthropic Console as an independent backstop.

## Not verified

* No live model call: real output lengths, cache hit rates and costs are modelled. Run the evaluation harness with a real
  key and a low Console spend limit, then compare `ai_usage_events.cost_micros` with the Anthropic usage page.
* The alert webhook is tested against a stub, not a real Slack channel.
* Store commission (15% vs 30%) depends on Small Business Program enrolment and on how long each subscriber has paid; the table shows both.
* Provider fees were checked against published pages on 2026-11-13; none of the store or Stripe accounts was inspected.

## Tests

* `tests/unit/ai-economics.test.ts`: prices, rounding, unknown models priced high, channel nets, budget derivation, the Pro
  allowance fitting the budget, thresholds.
* `tests/unit/ai-budget.test.ts`: env overrides, alert text, webhook delivery, alerts never break a request.
* `tests/integration/ai-budget.test.ts` (local Supabase): member cap with running requests counted, real cost replacing the
  hold exactly once, release, global cap and raising it, alerts once per threshold per month, downgrade to the fast model,
  per-member and app-wide concurrency, crash recovery, the Bible helper counted against the same budget, members locked out.
