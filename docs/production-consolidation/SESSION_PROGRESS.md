# Session progress: production consolidation

Read this first in any new session. It records what has been done, with evidence, so nothing is repeated.

**Branch:** `release/narrow-gate-production-consolidation`. It started from the release candidate
`claude/rc-testflight-1` at `c275a808`. Pushed to GitHub, where CI runs on every push to `release/**`.

**Rules in force (owner):**

- Pricing stays Free $0 / Pro $17.99 a month / $119.99 a year.
- Without the owner's approval:
  - no merge into `main`;
  - no deploy;
  - no real billing;
  - no store uploads;
  - no production database changes.
- No force-push and no branch deletion.
- Never weaken tests.
- Keep confidential security detail out of the public repo.

## Phase log

| Phase | Status | Evidence / where |
|---|---|---|
| Pre-launch audit (10 documents) | Done 2026-11-25 | Delivered privately to the owner, not in the repo (security detail); summarised in MASTER_ENGINEERING_REPORT.md |
| Branch inventory | Done | BRANCH_CONSOLIDATION_REPORT.md. 45 branches:<br>• 34 fully contained in the release candidate;<br>• 1 superseded fix;<br>• 2 superseded older work;<br>• 6 not part of the app;<br>• `claude/friends-challenges` the only unmerged app work.<br>10 open pull requests (#3–#12), all older than the release candidate |
| Pricing across branches | Done | `main` $30.00 Pro (Plus $9.99); `production-readiness` $19.99; `rc-verification` $19.99 / $149.99; the release candidate and this branch **$17.99 / $119.99** (approved). Not changed |
| Fixes: config docs, Node pin, body-scan quota, AI retention option, admin AI-budget warning, privacy manifest | Done | `e84b14d3`, `f9305d6f`, `bb5d2337`, `bc8cf2d5`, `f0c44da4` |
| Independent reviews (security, database, billing, mobile, architecture) | Done; findings verified, fixed or logged | `7a6ab043`, `9f6d8866`, `ecdca7d8`, `56717544`, `29d80ca9`; BUG_FIX_REGISTER.md |
| Database: upgrade from `main` with synthetic data; fresh install | Done: all data preserved; 83 migration files install | DATABASE_MIGRATION_REPORT.md |
| Friends feature (flag off) | Merged, migrations renumbered 091–093 | `8fa7c3b5` |
| Full regression on `8fa7c3b5` | Done: CI passed; unit 4,919/1 skip; integration 640/1 skip; browser 167/0 failed/101 opt-in skips; Android APK and iOS workflows passed | TEST_RESULTS.md |
| Load test (local) | Done | PERFORMANCE_REPORT.md |
| Deliverables in this folder | Done (16 files) | — |
| Pull request into `main` (not merged) | Open, draft | Joshfit77/Testing-testing-testing#13 |
| Round 2: O-01..O-20 implemented | Done 2026-11-26 | `13d7db30`, `b0a11cc0`, `15c52df8`, `8a6babae`, `ee13eff0`, `100502d5`; BUG_FIX_REGISTER.md |
| Engagement package | Done | CLAUDE.md, `.claude/agents/` (6), `npm run setup / verify / test:e2e:mocked / db:verify`, docs/engagement/ |

## Next steps if continuing

1. Watch the PR checks.
2. The remaining items need people, devices or accounts (R-01..R-07): run them with docs/engagement/ISSUE_PROMPTS.md.
3. After owner approval only: merge, staging deploy, store setup.

## How to run things here (lessons learned)

- **Browser tests must run with the local AI and food mocks**, or AI-related tests fail falsely. Use
  `npm run test:e2e:mocked` (scripts/e2e-mocked.sh), which does this: start `next start` with `ANTHROPIC_API_KEY=e2e-test-key ANTHROPIC_BASE_URL=http://127.0.0.1:<A>
  OFF_API_BASE_URL=http://127.0.0.1:<O>`, then run Playwright with `E2E_BASE_URL`, `E2E_ANTHROPIC_MOCK_PORT=<A>`,
  `E2E_OFF_MOCK_PORT=<O>` and `--project mobile`. Running plain `npx playwright test` without them gives 2 false
  failures (label check, Bible helper).
- The **demo-server suite** needs an isolated database (the demo seed refuses a database with real accounts).
- **New Supabase stacks can't download images in this sandbox.** Reuse the existing local stack; the upgrade test
  temporarily resets it to `main`'s 8 migrations and then back.
- **After a machine restart:**
  1. start `dockerd` again;
  2. run `npx supabase start` in the worktree.
- `e2e/sleep.spec.ts` can fail when it runs across midnight UTC: "last night" changes meaning mid-test. Passed on rerun.
