# Live AI coach test: exact setup (not yet run)

Status on 2026-11-13: **the live test has not been run.** No Anthropic API key is available to the build environment
(the session's credential form refuses Anthropic hosts, and no key is stored anywhere in the project), so no live model
call was made and no live result exists. Nothing in this repository should be read as a live pass.

What *was* run on 2026-11-13, with no model and no spend:

| Check | Command | Result |
| --- | --- | --- |
| Cost estimate (no network) | `npx tsx --conditions=react-server scripts/ai-eval/run.ts --estimate` | Static prompt ≈ 12,800 tokens, tools ≈ 6,200 tokens (both cached); 30 scenarios × 3 runs |
| Harness self-test (scripted stand-in, nothing leaves the machine) | `… run.ts --self-test --runs 1` | 30/30 scenarios ran through the real coach code path. The checks flagged the scripted replies that lack referrals (9 safety checks), which is the point of the self-test: they catch a reply that misses a referral. These are not model results. |
| AI unit tests | `npx vitest run --project unit` (coach, AI, budget files) | 16 files, 157 tests passed |
| AI integration tests (real local database) | `npx vitest run --project integration` (coach, AI, budget files) | 11 files, 61 tests passed |

The integration tests prove, against the real database, that:
- a Free account is refused at every AI entry point before anything is reserved or sent (`ai-access.test.ts`);
- simultaneous requests can't overshoot the 150-request allowance or the larger model's share (`ai-limits.test.ts`);
- the per-member money budget refuses a request that would pass it, counting running requests; failures are given back
  (`ai-budget.test.ts`);
- a member with no history is told so, and analysis says so instead of inventing a trend; summaries carry only what
  was logged (`coach-scenarios.test.ts`, scenarios 1, 4–6);
- recorded cost equals the provider's reported tokens at the published prices (`coach-scenarios.test.ts`, 16).

They do **not** prove answer quality, accuracy or personalization from a real model. Only the live run below can.

## Limits being tested

| Limit | Value | Where |
| --- | --- | --- |
| Requests per month (Pro) | 150 | `getPlans()` in `src/lib/domain/plans.ts` (`PLAN_PRO_AI_MONTHLY_LIMIT`) |
| Advanced (larger) model per month | 10, plan generations included | `PLAN_PRO_AI_SMART_MONTHLY_LIMIT`, `PLAN_PRO_AI_PLAN_MONTHLY_LIMIT` |
| Money per member per month | about $1.40 | `AI_MEMBER_MONTHLY_BUDGET_USD` (default from `sustainableAiBudget()`) |
| Free plan | no AI | `aiAllowance` in `plans.ts`; `ai-access.test.ts` |

## Run it (owner, on your own machine)

1. **Make a separate key.** In the Anthropic Console, create a workspace just for testing (for example
   "ngf-eval") and an API key in it. Set the workspace's **spend limit to $10**. That limit is the real backstop; the
   harness's own ceiling is a second one.
2. **Start the local stack** (local Supabase only; the harness refuses any non-local database):
   `bash scripts/setup-all.sh` (or `npx supabase start`), then `set -a; . ./.env.local; set +a`.
3. **Dry run first, no spend:**
   `npx tsx --conditions=react-server scripts/ai-eval/run.ts --estimate`
4. **Live run with a hard ceiling** (the key is read only from this variable and never written anywhere):

   ```bash
   AI_EVAL_ANTHROPIC_API_KEY=sk-ant-… \
     npx tsx --conditions=react-server scripts/ai-eval/run.ts --live --confirm-spend --max-usd 5
   ```

   Without `--confirm-spend` it stops before sending anything. Every request goes through a local budget proxy that
   prices its worst case first and stops the run before `--max-usd` (default 5) or `--max-requests` (default 450)
   could be passed. Expected cost from the cost model: about $1–4 for the coach turns and $2–4 for the judge.
   To spend less, judge with a smaller model or not at all: `--judge-model claude-sonnet-5-5`, or `--no-judge`.
   To test a few topics first: `--only S02,S07,S11,S05,S24 --runs 1` (workout, running, nutrition, recovery, faith).
5. **Read the results** in `ai-eval-results/<timestamp>-live/` (git-ignored): `summary.md` (critical checks, rubric
   scores, tokens, cost and latency per scenario), `transcripts.md` (every reply, word for word) and
   `review-sheet.csv` for a human reviewer (`docs/ai-eval/HUMAN_REVIEW_SHEET.md`).
6. **Delete the key** in the Console when you're done.

The scenario set covers workout (S01–S04, S09, S12–S13, S22), nutrition (S08, S10–S11, S16), recovery (S05),
running (S07), faith (S24–S25), safety (S14–S19), and security (S20, S23, S26–S30). The full list is in `SCENARIOS.md`.

## Running it from a cloud session instead

The cloud environment "Testing-testing-testing" already allows `api.anthropic.com`. Add the test key there yourself as
a network secret for `api.anthropic.com` in the environment's settings (never paste it into a chat), then ask for the
live run. The same `--max-usd` ceiling applies; keep the Console spend limit on as well.

## What happens after a live run

Proposed prompt or routing changes from the results are written up for your approval first; none are applied
automatically.
