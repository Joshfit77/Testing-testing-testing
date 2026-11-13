# AI coach cost and performance model

**What is measured and what is modelled.** Prices are verified, and so are the sizes of the prompts the app sends
(measured on this branch, 2026-11-02). Output lengths, tool rounds and latency are **assumptions until a live run
measures them**: there is no API key here, so no live call was made. After a live run,
`npx tsx scripts/ai-eval/cost-model.ts ai-eval-results/<run>-live/results.json` replaces the assumptions with the
measured cost per turn.

## Verified prices

Anthropic first-party API, from platform.claude.com/docs/en/about-claude/pricing, read 2026-11-02. USD per million
tokens; cache writes use the 5-minute cache.

| Model (role in the app) | Input | Cache write | Cache read | Output |
| --- | --- | --- | --- | --- |
| Claude Haiku 5.5 (`claude-haiku-5-5`: everyday coaching, meal plans, photos) | $0.10 | $0.125 | $0.01 | $0.50 |
| Haiku 5.5, prompts over 100,000 tokens | $0.50 | $0.625 | $0.05 | $2.50 |
| Claude Sonnet 5.5 (`claude-sonnet-5-5`: plans, pain/injury, reviews) | $2.00 | $2.50 | $0.10 | $10.00 |
| Claude Opus 5.5 (`claude-opus-5-5`: evaluation judge only) | $4.00 | $5.00 | $0.20 | $20.00 |

Not used here: US-only inference (`inference_geo`) multiplies every price by 1.1, and the app doesn't set it. The
pricing page says nothing about a hard spend cap. The Anthropic Console offers workspace spend limits, but this
report doesn't assume they are a guaranteed hard stop for your account. Treat them as a backstop and keep the app's
own limits.

## Measured prompt sizes

Token counts are estimated at about 3.1 characters per token (the 5.5 models' tokenizer counts about 30% more tokens
than the older ~4 characters per token). `messages.count_tokens` would give exact counts but needs a key.

| Part of every request | Size | Tokens ≈ | Cached? |
| --- | --- | --- | --- |
| Static coaching prompt (`COACH_STATIC_PROMPT`) | 38,292 chars | 12,350 | yes, shared by every member |
| Tool definitions (chat only) | 14,818 chars | 4,780 | yes, shared |
| Faith block (members with the faith section on) | 7,945 chars | 2,560 | yes |
| Athlete context: new member / beginner / intermediate | 424 / 3,246 / 5,601 chars | 140 / 1,050 / 1,810 | no |
| Plan mode: exercise catalog (157 exercises) | 11,866 chars | 3,830 | no (sent after the member's context) |
| History re-sent | capped at 24,000 chars | ≤ 7,700 | no |

## Per request and per member (modelled)

Assumptions (`scripts/ai-eval/cost-model.ts`):

- 1.5 model rounds per question, because about half of questions call a tool;
- 900 output tokens per round on Haiku and 1,600 on Sonnet (reply plus thinking at effort "medium");
- 6,000 output tokens for a plan;
- 1,200 tokens of history.

A "cold" cache means the first round writes the shared prefix: low traffic, or a gap of more than 5 minutes between
members. A "warm" cache means steady traffic keeps it cached.

| Per request | Cold cache | Warm cache |
| --- | --- | --- |
| Chat, fast (Haiku 5.5) | $0.0034 | $0.0014 |
| Chat, larger model (Sonnet 5.5) | $0.08 | $0.04 |
| Plan (Sonnet 5.5) | $0.10 | $0.07 |

| Pro member per month | Requests | Cold cache | Warm cache |
| --- | --- | --- | --- |
| Light | 18 fast + 1 larger + 1 plan | $0.24 | $0.13 |
| Typical | 54 fast + 4 larger + 2 plans | $0.70 | $0.37 |
| Heavy (at the Pro limits) | 135 fast + 10 larger + 5 plans | $1.74 | $0.91 |

For scale, the price of Pro is $17.99 a month or $119.99 a year (launch prices approved 2026-11-13; previously
$19.99 / $149.99). After Apple's 15% (Small Business Program) or 30% commission, a monthly member leaves $15.29 or
$12.59; a yearly member, spread over 12 months, $8.50 or $7.00 (before RevenueCat's 1%). A typical member costs well
under 10% of that. The per-channel table, with Stripe, RevenueCat, operating costs and refunds, is in
`docs/pro/AI_COST.md`.

Across members, 100 typical members cost about $37–70 a month and 1,000 cost about $365–696.

Meal plans and meal-photo estimates use the same allowance (150 requests a month) and run on Haiku. Their cost per
request is in the same range as a fast chat turn.

## Worst case, and what enforces the budget

The worst case is a member who makes every request as expensive as the app allows: every one of the 150 monthly
requests runs 6 model rounds, each at the 12,000-token output cap, with maximum history. That member costs about
$0.06 per fast request and $1.26 per larger-model request, about **$22 a month**. That is more than the $17.99 price,
and well above the net after commission. (Since migration 066 a per-member money budget of $1.40 a month stops this.)

What the server enforces today (verified in code and by `tests/integration/ai-limits.test.ts`, `ai-route-limits.test.ts`
and `coach-provider-limits.test.ts`):

| Control | Where | Limit |
| --- | --- | --- |
| Monthly requests per member | `reserve_ai_usage` (SQL, per-member lock) and `assertAiAllowed` | 150 (Pro) |
| Larger-model requests per member | same | 15 a month, 5 of them held back for plans |
| Plans per member | same | 15 a month |
| Burst | in-memory and SQL | 6 a minute |
| Meal photos | SQL | 20 per 24 hours |
| Output per request | `CHAT_MAX_TOKENS` / `PLAN_MAX_TOKENS` | 12,000 per round, at most 6 rounds; plan 16,000 |
| History re-sent | `coachTurn` | 8,000 chars per message, 24,000 in total |
| Plan retries | `PLAN_REQUEST_OPTIONS` (fixed in this round, D4) | sent once, 150 s |
| Kill switch | `ai_coach` feature flag | turns the coach off for everyone |
| Usage record | `ai_usage_events` | tokens recorded for every request |

**Gap:** every limit counts requests. None counts tokens or dollars, either per member or across the whole app. A
heavy member costs less than $2 a month, but the worst case costs more than the subscription. Nothing on the server
would stop a flood of expensive requests across many accounts until the requests ran out. Proposed, for the owner to
decide; not built:

1. A per-member monthly cost ceiling in `reserve_ai_usage`. Price each finalized row from its recorded tokens and
   refuse new requests past, for example, $3 a month. The member sees the same message as for the monthly quota.
2. A lower output cap for the fast tier (`CHAT_MAX_TOKENS` 6,000 instead of 12,000). A coaching reply is about
   250 words, so this halves the worst case without affecting normal answers.
3. A daily app-wide spend check: sum of `ai_usage_events` cost for the day, which turns the `ai_coach` flag off
   and alerts the owner past a set amount.
4. A workspace spend limit on the API key in the Anthropic Console, as the last backstop.

## Performance

Not measured: there was no live call. The self-test only times the local plumbing, about 0.1 s per turn with no
model in the loop. A live run reports the median and p95 turn time and the time to the first streamed text, per
model, in `summary.md`. The server allows 180 s per coach request (`maxDuration`). Plans now fail cleanly after
150 s instead of being retried past that limit (D4).
