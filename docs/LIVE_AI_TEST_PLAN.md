# Testing real AI coach responses with a strict spending limit

Status 2026-11-04: **no live model call has been made.** Every AI test so far used the local mock
(`e2e/ai-mock.ts`) or the evaluation harness's scripted self-test, which is labelled "not model output". This page is
what is needed to run the real thing, and the limits that keep it cheap. **Nothing here runs without the owner's
approval.**

## What is needed (owner)

1. **An Anthropic API key in a separate workspace with a hard spend limit.** In the Anthropic Console create a
   workspace for testing (e.g. "NGF eval"), set its monthly spend limit (e.g. $10), and create a key in that workspace
   only. The limit is enforced by Anthropic, independently of our code.
2. **Approval of a budget for one run**, e.g. "up to $8".
3. Where to run it: the owner's computer, or a CI job the owner triggers by hand. The key goes in an environment
   variable for that run only (`AI_EVAL_ANTHROPIC_API_KEY`); it is never written to the repository, a file or a log.

## The harness (already built)

`scripts/ai-eval/run.ts` runs 30 synthetic-member scenarios (training, nutrition, injury and red-flag safety, faith,
privacy, prompt-injection) through the app's real coach code, against the real model, and has a second model grade
each answer. See `docs/ai-eval/README.md`.

```sh
# 1. Free: the cost estimate (nothing is sent)
npx tsx --conditions=react-server scripts/ai-eval/run.ts

# 2. Free: the scripted self-test (checks the harness itself; not model output)
npx tsx --conditions=react-server scripts/ai-eval/run.ts --self-test

# 3. Paid, only with the owner's approval and budget:
AI_EVAL_ANTHROPIC_API_KEY=<key from the limited workspace> \
  npx tsx --conditions=react-server scripts/ai-eval/run.ts --live --confirm-spend --max-usd 8
```

Spend controls, three layers:

- **Our ceiling:** the harness counts every token and stops before a request would pass `--max-usd` (default $5) or
  `--max-requests`. Without `--confirm-spend` it refuses to start.
- **The provider's ceiling:** the workspace spend limit above.
- **Scope:** synthetic members only; no real member data is sent.

Expected cost (from `docs/ai-eval/README.md`, an estimate, not a measurement): about $1–4 for the coach turns and
$2–4 for the grading on the current models. A single smoke test (`--only <one scenario> --runs 1`) costs cents.

## After the run

- `summary.md`, `transcripts.md`, `results.json` and `review-sheet.csv` are written to the output folder; the
  summary states the actual spend.
- A person reads the transcripts with `docs/ai-eval/HUMAN_REVIEW_SHEET.md` (the safety scenarios first). Automatic
  grades are not a substitute.
- Then, separately: the in-app coach on TestFlight with the production key (`ANTHROPIC_API_KEY` on the deployment),
  which uses the app's own per-member quotas (`docs/ai-eval/COST_MODEL.md`).
