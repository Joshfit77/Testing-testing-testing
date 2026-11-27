# Integration baseline for the Biblical AI work

The verified starting point for the upcoming Biblical AI implementation. Build new work on a branch from the commit
below; if `npm run verify` and the browser suite don't match these numbers before you start, stop and find out why.

## Baseline

- **Branch:** `release/narrow-gate-production-consolidation` (PR into `main`, not merged).
- **Commit:** see TEST_RESULTS.md in docs/production-consolidation for the exact verified head and its test counts.
- **Database:** 88 migration files (through `20261127000098`); `npm run db:verify` all ok after a fresh install.
- **Gates that must stay green:** GitHub CI (typecheck, lint, unit, build, integration, secret scan, dependency audit),
  iOS workflow (including the native run-journal tests), Android APK workflow (including the JVM unit tests), the
  browser suite with mocks, the tap-every-control sweep.

## What already exists (reuse it; don't build a second one)

| Piece | Where | Notes |
|---|---|---|
| Verified Bible text (BSB) | `public/bible/bsb/`, `src/server/bible/text.ts` (`getPassage`, `searchBible`) | Public-domain-dedicated Berean Standard Bible; offline copy bundled in the app. Never let a model generate Scripture text: quote from here |
| Reference parsing | `src/lib/bible/reference.ts`, `src/lib/bible/books.ts` | `parseReference`, `formatReference`, book abbreviations |
| Bible study helper | `src/server/services/bible-ai.ts`, `src/lib/bible/ai.ts`, `src/server/actions/bible-ai.ts`, UI `src/components/faith/bible-ask.tsx` | Retrieval of BSB passages for a question; the model answers from them; `checkCitations` / `markUnverified` flag any cited reference that doesn't exist or wasn't retrieved |
| Its own quota and history | tables `bible_ai_usage`, `bible_ai_messages`; `BIBLE_AI_LIMITS` | Separate from the fitness coach's allowance; history deletable (`clearBibleAiHistoryAction`), optional retention (`AI_CHAT_RETENTION_DAYS`) |
| Model choice | `BIBLE_AI_MODEL` (default `claude-haiku-5-5`) | Change by setting, not code |
| Consent | AI data consent + faith features on; the helper never sees the prayer journal, notes or any other personal data | Keep it that way unless the owner decides otherwise and the privacy policy says so |
| Budget and kill switches | `reserve_ai_usage` / `finalize_ai_usage` (migration 081), global daily and monthly limits, `ai_coach` flag | New AI features reserve budget before calling the provider |
| Tests | `tests/unit/bible-ai.test.ts`, `bible-ai-gates.test.ts`, `e2e/faith-journey.spec.ts` (helper answers from the BSB and marks references that don't exist) | The e2e AI mock lives in the Playwright setup; never call the live API in tests |

## Rules for the new work

1. **Scripture is quoted, never generated.** Any verse text shown comes from the BSB files; model output that cites a
   reference is checked with `checkCitations`, and unverifiable references are marked, as today.
2. **Theological care:** the helper explains what passages say and where traditions differ; it doesn't speak for God,
   issue pastoral or medical directives, or present one denomination's view as the only one. Put such instructions
   in the system prompt (`BIBLE_AI_SYSTEM`) and test them with the AI eval harness (`scripts/ai-eval`).
3. **Privacy:** the prayer journal stays out of every prompt unless the member turned on journal sharing for the AI
   Coach (that is a separate, explicit permission enforced by the database, migration 089).
4. **Cost:** estimate per-request tokens and add the feature to AI_COST_ANALYSIS.md before enabling it; reserve
   budget before each call; respect the global daily limit.
5. **Done means:** unit tests for prompt building and citation checks, an integration test for quota and consent, an
   e2e test with the mock, `npm run verify` green, and an owner-approved, capped live evaluation run before launch.
