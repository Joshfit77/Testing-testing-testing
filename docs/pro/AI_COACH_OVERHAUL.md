# AI coach overhaul: implementation report

2026-11-13, branch `claude/pro-premium`. Not merged, not deployed. No subscription product, price or billing
configuration was changed. PR #11 was not touched.

**No real model was called.** There is no approved Anthropic key in this environment, and the standing instruction
is no paid API calls without approval, so every AI test ran against a local scripted stand-in for the Messages API.
Costs below are **modelled** from measured prompt sizes and published prices, not measured provider bills. The live
measurement is ready to run (section 7) once you approve a key and a spend limit.

## 1. Architecture

```
member action ──► server route / action ──► plan from user_entitlements (server)  ──► Free/Plus: refused, nothing sent
                                          └► consent check (ai_data_consent_at)
                                          └► reserve_ai_usage (database, per-member + global locks)
                                               · request allowance (150), advanced share (10), per-minute rate
                                               · member money budget, global money budget, in-flight limits
                                               · advanced model only if the rest of the allowance stays affordable
                                               · holds the expected cost; closes stale holds
                                          └► routeCoachRequest (fast unless the task needs advanced)
                                          └► prompt = cached prefix (instructions + tools, shared by all members)
                                                    + member block (style, structured context, memories)
                                          └► tool loop (≤ 6 rounds, cost ceiling per request): read tools over the
                                               member's own data, deterministic analyses, proposals needing approval
                                          └► finalize_ai_usage (real cost from the usage block) → alerts 50/75/90/100%
                                             or release_ai_usage (failure: member not charged; possible provider
                                             charge kept in the global figures)
```

Every AI feature uses this pipeline: coach chat and program generation (`coachTurn`), meal plans, food photos and
labels, food explanations, weekly reports, and the Bible study helper (`withAiRequest`).

## 2. Changes made (this round)

| Area | What changed | Files |
|---|---|---|
| Free has no AI | Bible study helper is Pro (`ai_bible_study`) and goes through the shared pipeline; Faith reading, prayer, journeys and the 40-day challenge stay free; membership comparison updated | `bible-ai.ts`, `plans.ts`, `membership.ts`, `faith/ask/page.tsx` |
| Allowance rules (migration 068) | One pool of 150 requests for everything the member starts (the automatic weekly report doesn't use it); up to 10 advanced; advanced only while the member's budget still covers every standard request left; downgrades return a reason; plans refused instead of downgraded; downgraded holds at the standard estimate | `20261113000068_ai_allowance_rules.sql`, `ai-coach.ts`, `ai-allowance.ts` |
| No silent downgrade | An answer that called for the advanced model but ran on the standard one ends with a one-line reason | `ai-allowance.ts`, `ai-coach.ts` |
| Failures | A failed request is given back to the member; completed tool rounds and cut-off requests are added to the global accounting (`release_ai_usage(id, charge)`) | migration 068, `ai-coach.ts` |
| Routing | Length no longer selects the advanced model; 2 advanced requests kept for program generation (was 5); labelled routing evaluation set | `routing.ts`, `tests/unit/routing-eval.test.ts` |
| Per-request ceiling | Fast-model chat stops calling tools at $0.015 (was $0.025) | `ai-economics.ts` |
| Usage screen | `/coach/usage`: requests left, advanced left, renewal date, what counts, app-wide pause shown as such, early-capacity note; plan mode says it uses an advanced request before sending | `coach/usage/page.tsx`, `coach-chat.tsx` |
| Memory sealed at rest (migration 069) | AES-256-GCM per memory, owner id as associated data; production refuses to store memories without `MEMORY_ENCRYPTION_KEY`; every read opens for the owner only; export readable; script to seal old rows | `memory-seal.ts`, `memory-crypto.ts`, `scripts/ops/encrypt-memories.ts` |
| Coaching styles | Supportive, direct, beginner educator, technical; tone only; in the member's uncached block | `style.ts`, `coach-style-form.tsx` |
| Training intelligence | `analyze_lift_progress`: weekly e1RM, volume, frequency, RPE, PR recency, attendance, sleep and check-in context, findings with evidence, missing data | `lift-analysis.ts`, `server/coach/analysis.ts` |
| Running, recovery | `get_running_summary` (source-labelled runs, pace from runs with distance and time, ramp flag), `get_recovery_summary` (check-ins, sleep labelled recorded/self-reported/in-bed, load, not a diagnosis) | `running-summary.ts`, `recovery-summary.ts` |
| Conversation recall | `recall_conversations`: earlier chats only when relevant, only with memory on, never "don't remember" chats | `server/coach/tools.ts` |

Earlier this session (still in force): money budgets, alerts, concurrency and stale-hold recovery (migration 066),
missed-session rescheduling with approval, the 30-day sleep summary.

## 3. Free versus Pro AI access (final rules)

| | Free | Pro |
|---|---|---|
| AI coach chat, AI programs, AI meal plans, food-photo and label analysis, AI food explanations | No | Yes, from the monthly allowance |
| AI Bible study helper | No (reading, search, prayer, journeys, 40-day challenge: free) | Yes, from the monthly allowance, max 40 questions a day |
| Weekly progress report | Not offered | Yes; the AI write-up doesn't use a request; a rule-based report is used when AI is unavailable |
| Every non-AI feature | Unchanged | Unchanged |

Enforced on the server: the plan is read from `user_entitlements`, never from the client; the reservation function is
callable only by the server; `tests/integration/ai-access.test.ts` calls every AI entry point as a Free member with every
consent given and checks the provider receives nothing and nothing is reserved.

## 4. Member-facing allowance

* **150 AI requests a month**, renewing on the 1st (UTC), for monthly and yearly members alike (a yearly membership
  gets a monthly allowance).
* **Up to 10 advanced requests** within the 150: program generation (always advanced) and complex coaching (program
  design, multi-week analysis, plateaus, pain/injury/medical). The last 2 are kept for program generation.
* What uses a request, what uses an advanced one and what is free is listed on the usage screen. No prices or margins
  are shown. Nothing is ever charged extra.
* If unusually long requests use the month's AI capacity before 150, the usage screen and the refusal say so plainly.
* If the app-wide AI budget is used up, the message says AI is paused for everyone and that it isn't the member's
  allowance.

## 5. Costs

Measured prompt sizes (offline `--estimate`, today's code): cached prefix 39,592 + 19,236 characters ≈ **12,772 +
6,205 tokens**, shared by all members. Per request (modelled, published prices):

| Request | Cold cache | Warm cache |
|---|---|---|
| Chat, fast (Haiku 5.5) | $0.0034 | $0.0014 |
| Chat, advanced (Sonnet 5.5) | $0.08 | $0.04 |
| Program generation (Sonnet 5.5) | $0.10 | $0.07 |

| Pro member per month | Cold | Warm | Against $1.40 |
|---|---|---|---|
| Light (18 fast, 1 advanced, 1 program) | $0.24 | $0.13 | fits |
| Typical (54 fast, 4 advanced, 2 programs) | $0.70 | $0.37 | fits |
| Heavy, the whole allowance (140 fast, 8 advanced, 2 programs) | $1.32 | $0.66 | fits |

So the advertised 150 and 10 fit the $1.40 budget at modelled request sizes, including the heavy case. The money
cap only binds for unusually long requests (a fast request can cost up to about $0.02 at the ceiling); the floor rule
makes sure advanced requests never eat the money the standard ones need.

Monthly AI cost at a 30% light / 50% typical / 20% heavy mix (Free members now cost nothing):

| Paying members | Cold cache | Warm cache | Hard ceiling (members × $1.40) |
|---|---|---|---|
| 100 | $69 | $36 | $140 |
| 500 | $343 | $178 | $700 |
| 1,000 | $686 | $355 | $1,400 |
| 3,000 | $2,058 | $1,065 | $4,200 |
| 5,000 | $3,430 | $1,775 | $7,000 |
| 10,000 | $6,860 | $3,550 | $14,000 |

The shared prefix is cached across members, so larger fleets move toward the warm column. For comparison, the lowest
net revenue per member is $6.90 a month (App Store yearly at 30%, after RevenueCat's 1%); the per-channel table with
Stripe, store, RevenueCat, operating and refund costs is in `AI_COST.md` (updated for $17.99 / $119.99 on 2026-11-13).

## 6. Test results (local stack, scripted provider)

See the chat summary for the final counts. New suites: `ai-access` (Free reaches no provider), `ai-budget` (12 incl.
floor rule, reasons, weekly report, release charge), `coach-scenarios` (9 scenarios from the brief),
`coach-analysis-tools`, `memory-sealing`, `memory-seal` (unit), `routing-eval`, `bible-ai-gates`.

| Brief scenario | Where | Result |
|---|---|---|
| 1 beginner, no history | coach-scenarios | pass (scripted provider) |
| 2 six months of records, 3 plateau | coach-scenarios, coach-analysis-tools | pass |
| 4 runner after missed sessions | coach-scenarios, missed-sessions | pass |
| 5 inconsistent sleep | coach-scenarios | pass |
| 6 nutrition plan request | coach-scenarios (data side only) | pass; answer quality not tested |
| 7 remember preferences, 8 withdraw consent | coach-scenarios, memory-sealing | pass |
| 9 two accounts | cross-user-isolation, coach-analysis-tools | pass |
| 10 monthly allowance, 11 money budget | ai-budget, ai-limits | pass |
| 12 concurrent near the global limit | coach-scenarios, ai-budget | pass |
| 13 yearly member, monthly allocation | coach-scenarios | pass |
| 14 Free calling AI | ai-access, ai-route-limits | pass |
| 15 failures and recovery | ai-access, coach-provider-limits, ai-budget | pass |
| 16 cost reconciliation vs real provider | coach-scenarios (scripted usage only) | **not run live** |

## 7. Live evaluation (not run)

`npx tsx --conditions=react-server scripts/ai-eval/run.ts --live --confirm-spend --max-usd 8` with
`AI_EVAL_ANTHROPIC_API_KEY` runs 30 scenarios × 3 against real models through the app's own pipeline, with a local
spend guard, and writes quality checks, judge scores and per-request token usage. To compare models, run it once with
the default routing and once with `COACH_MODEL_FAST`/`COACH_MODEL_SMART` set to the alternatives. Then compare
`ai_usage_events.cost_micros` with the Anthropic usage page. Needs your approval and a Console spend limit.

## 8. Privacy and memory

* Memories: member-approved only (the coach can only propose), sealed at rest, owner-bound, readable through the app
  and the export, deletable one by one or all at once, switched off with one control (the coach then reads none and
  can't recall earlier chats). Health-related recovery memories also need health-data consent.
* The coach's context is built from structured records first; memories are labelled with their source and treated as
  statements, not verified records; analyses label recorded vs self-reported vs estimated data.
* Alerts carry totals only. Account isolation is covered by the isolation sweep and the analysis-tool tests.
* Not encrypted at field level: conversation messages (they are protected by row-level security and the database's
  own encryption at rest).

## 9. Decisions for you

1. **Bible helper is now Pro** (your brief). Members who used it on Free lose it; reading and prayer stay free.
2. **Weekly report doesn't use a request** (my call: it's automatic). Say if you want it counted.
3. **Allowance renews on the 1st (UTC)**, not on each member's billing date. Billing-date renewal is possible but needs
   the subscription period from RevenueCat/Stripe per member.
4. **2 of the 10 advanced requests are kept for program generation.**
5. **Global budget**: still $100 by default; a starting point for launch is Pro members × $1.05.
6. **Live measurement**: approve a key and spend limit to replace the modelled costs.

## 10. Remaining blockers before a paid public launch

1. Live evaluation and cost reconciliation (section 7).
2. `MEMORY_ENCRYPTION_KEY` in staging and production, then `scripts/ops/encrypt-memories.ts`.
3. Apply migrations 063–069 with the matching app build (066 and 068 change the reservation function).
4. Set `AI_GLOBAL_MONTHLY_BUDGET_USD`, `AI_BUDGET_ALERT_WEBHOOK_URL` and an Anthropic Console spend limit.
5. Store and Stripe products at $17.99 / $119.99, sandbox purchases on devices (owner action).
6. Professional review of programs; registered-dietitian review of nutrition programs.
7. Device testing (Health import, GPS, notifications) and a privacy-policy update for memory encryption and the
   Bible-helper change.
