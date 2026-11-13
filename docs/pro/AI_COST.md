# AI cost at the new Pro price

Modelled, not measured: there is no API key in this environment, so no live model call was made. Prices and the
per-request model come from `docs/ai-eval/COST_MODEL.md` (verified prices, measured prompt sizes, assumed output
lengths). That document compared costs with the old $19.99 price; this one uses the approved $17.99 / $119.99.

## Revenue per Pro member per month

| | Monthly ($17.99) | Yearly ($119.99 ÷ 12 = $10.00) |
|---|---|---|
| After 15% store commission (Small Business Program) | $15.29 | $8.50 |
| After 30% store commission | $12.59 | $7.00 |

## AI cost per Pro member per month (from the cost model)

| Member | Cold cache | Warm cache | Share of the lowest net ($7.00, yearly at 30%) |
|---|---|---|---|
| Light | $0.24 | $0.13 | 2–3% |
| Typical | $0.70 | $0.37 | 5–10% |
| Heavy, at the Pro limits | $1.74 | $0.91 | 13–25% |
| Worst case (every request at the output cap) | about $22 | | more than the price |

New in this branch:

* **Weekly report:** one call a week on the fast model (Haiku 5.5), at most 1,500 output tokens, and only when the
  member has the AI coach feature and AI consent; otherwise the rule-based report is used at no cost. At about 2,500
  input tokens that is at most about $0.001 a report, roughly $0.005 a month. Only the first request for a week calls
  the model (the database insert decides), so retries and the Sunday job never pay twice.
* **Program tools** (`get_program_recommendations`, `propose_program`): computed by the app, no extra model calls; their
  definitions add about 470 tokens (1,446 characters) to the cached prefix, plus one tool round when used.

## What limits the spend today

Per member: the monthly request allowance (150 on Pro), metered in the database before each call, with per-route rate
limits, and a refusal when metering is unavailable (`src/server/services/ai-coach.ts`).

## Gaps (not built; recommended before launch)

1. **No global monthly dollar cap or alert in the app.** Set a workspace spend limit in the Anthropic Console as a
   backstop, and add an alert when daily spend passes a threshold.
2. **The worst case exceeds the yearly net.** Options: lower the per-request output cap for chat, or cap tool rounds at
   3 instead of 6. Owner decision; nothing changed here.
3. **Live measurement.** Run `npx tsx scripts/ai-eval/cost-model.ts` on a live evaluation run to replace the assumed
   output lengths with measured ones.
