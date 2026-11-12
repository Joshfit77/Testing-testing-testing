# AI coach evaluation harness

`scripts/ai-eval/` evaluates the Pro AI coach the way members use it. Every scenario goes through the app's own
`coachTurn` (`src/server/services/ai-coach.ts`): the same system prompt, tools, model routing, plan validation,
proposals and usage metering as production, against synthetic members on a **local** Supabase stack.

Status on 2026-11-02: **built and self-tested; the live run is BLOCKED** because no Anthropic API key is available
in this environment. No live model output exists yet, and nothing in this folder claims otherwise.

## Files

| File | What it does |
| --- | --- |
| `scripts/ai-eval/run.ts` | The harness: seeds members, runs every scenario 3×, applies the checks, optional judge, writes the reports |
| `scripts/ai-eval/scenarios.ts` | 30 scenarios (listed in [SCENARIOS.md](SCENARIOS.md)) with their critical checks and what a good answer does |
| `scripts/ai-eval/profiles.ts` | 8 synthetic members (all invented), local-only seeding and clean-up |
| `scripts/ai-eval/checks.ts` | 22 deterministic critical checks (PASS / FAIL / REVIEW) |
| `scripts/ai-eval/judge.ts` | Rubric scoring, 8 criteria × 1–5, by a judge model (first pass for human reviewers) |
| `scripts/ai-eval/budget-proxy.ts` | Local spending guard every model call goes through |
| `scripts/ai-eval/pricing.ts` | List prices, verified 2026-11-02 |
| `scripts/ai-eval/cost-model.ts` | Monthly cost per member ([COST_MODEL.md](COST_MODEL.md)) |
| `scripts/ai-eval/mock-api.ts` | Local scripted stand-in for the Messages API (tests and self-test only) |

## Running it

Prerequisites: `npx supabase start` (local stack, migrations applied) and the local stack's keys in `.env.local`.

```bash
set -a; . ./.env.local; set +a

# 1. Estimate: prompt sizes, output caps and prices. No network, no spend.
npx tsx --conditions=react-server scripts/ai-eval/run.ts --estimate

# 2. Self-test: the whole pipeline against a scripted local stand-in. Nothing leaves the machine; every reply and
#    score is labelled SELF-TEST and is not an evaluation result.
npx tsx --conditions=react-server scripts/ai-eval/run.ts --self-test

# 3. Live: real model calls, real money. The key is read only from AI_EVAL_ANTHROPIC_API_KEY.
AI_EVAL_ANTHROPIC_API_KEY=… npx tsx --conditions=react-server scripts/ai-eval/run.ts --live --confirm-spend --max-usd 8
```

Options: `--runs 3` (1–5), `--only S01,S14`, `--max-usd 5`, `--max-requests 450`, `--judge-model claude-opus-5-5`,
`--no-judge`, `--keep-members`, `--out <dir>`. Results go to `ai-eval-results/<timestamp>-<mode>/` (git-ignored):
`summary.md`, `transcripts.md` (for reviewers), `results.json`, `review-sheet.csv`, `run.log`.

Expected live cost for the full set (30 scenarios × 3 runs ≈ 90 coach turns plus 90 judge calls), from the cost
model: about **$1–4 for the coach turns and $2–4 for the judge** on Opus 5.5. The default ceiling is $5; `--max-usd 8`
leaves room for the judge. The run stops itself before any request that could pass the ceiling.

## Safety controls

- **Access.** A command-line script, not an endpoint. Its proxy listens on `127.0.0.1` only, accepts only
  `POST /v1/messages`, and exists only while the run lasts. Nothing is added to the app's routes.
- **Key handling.** The real key stays in the harness process and is sent only by the proxy, upstream, as `x-api-key`.
  The app code under test gets a dummy key and talks to the proxy. The proxy never forwards any other credential
  (an `Authorization` header from the environment is dropped) and logs no headers or bodies.
- **Budget.** Every request's worst case (all input at the cache-write rate, all allowed output) is priced before it is
  sent. A request that could take the run past `--max-usd` or `--max-requests` is refused with a 400, which the
  SDK doesn't retry, and the rest of the run is marked "not run". Real usage is metered from each response.
  The provider's own controls are separate. Set a spend limit on the key's workspace in the Anthropic Console
  as well. This report doesn't assume that limit is a guaranteed hard cap.
- **Data.** Only the synthetic members in `profiles.ts`, on a local stack. The seeder refuses any non-local
  Supabase URL. Accounts use the reserved `.invalid` domain and `app_metadata.ai_eval`, and are removed at the
  end of the run and before the next one. No real member data is used or sent anywhere.
- **Honesty.** Self-test output is labelled on every page and in `results.json` (`"live": false`).
  `cost-model.ts` refuses to read a self-test's costs as measurements.

## What the checks and scores mean

- **Critical checks** (`checks.ts`) are code, not a model. Each one returns PASS, FAIL, or REVIEW.
  REVIEW means a pattern matched where the wording may still be safe, and a human decides. A scenario passes
  only if every check passes in all three runs.
- **Rubric scores** come from a judge model and cover accuracy, personalization, safety, actionability, clarity,
  tone, honesty and app rules (1–5 each). They are a first pass for the human review in
  [HUMAN_REVIEW_SHEET.md](HUMAN_REVIEW_SHEET.md), not a substitute for it.
- **Consistency.** The plan scenarios S12 and S13 compare their three plans: days, exercise overlap and weekly sets.
  For every scenario, the summary also reports whether the three runs reached the same check verdicts.
