# Narrow Gate Fitness: instructions for Claude Code

A Christian fitness app: training programs and workout logging, nutrition, GPS runs, sleep and recovery, Faith (Bible
reader, prayer journal, reading plans, a Bible study helper), an AI coach, and Pro membership. Next.js 15 (App Router,
React 19, TypeScript) on Supabase (Postgres with row-level security, Auth, Storage), shipped to iOS and Android as a
Capacitor 8 shell that loads the hosted site. Stripe (web) and RevenueCat (App Store / Google Play) for billing;
Anthropic for AI.

Read `docs/production-consolidation/MASTER_ENGINEERING_REPORT.md` for the current state and
`docs/engagement/ENGAGEMENT_AGENDA.md` for the work in progress. Dated reports elsewhere in `docs/` are history.

## Rules that are never negotiable

- **Pricing:** Free $0, Pro **$17.99/month** and **$119.99/year**, defined only in `APPROVED_PRO_PRICE_CENTS`
  (`src/lib/domain/plans.ts`). Never change a price without the owner's written approval.
- **No production actions without the owner's approval:** no merge into `main`, no deploy, no live billing
  (`STRIPE_LIVE_APPROVED`), no store uploads, no changes to a hosted database, no paid AI calls beyond a capped test the
  owner approved.
- **Never weaken, skip or delete a test to get a pass.** Find the root cause. If a test's stand-in is wrong about a
  platform, fix the stand-in and say so in the commit.
- **No secrets** in code, commits, logs, test fixtures or chat. Local Supabase demo keys in `tests/integration/setup.ts`
  are the only keys in the repo. Never ask anyone to paste a key into chat.
- **Preserve the brand and the Christian identity:** the gate imagery, the gold/black palette, Scripture (Berean
  Standard Bible text in `public/bible/bsb/`), and the Faith features. Don't reword Scripture.
- **Health and faith data are sensitive.** Every AI path checks consent (AI data consent, health-sharing and
  journal-sharing permissions, wellness consent); the database enforces them too (migration 089). Never send member
  data to a provider without the matching consent.
- **Report honestly.** Never claim a device test, a sandbox purchase or a live service call that didn't happen.

## Commands

```bash
npm run setup            # one-time: Node 22 check, npm ci, local Supabase, all migrations, DB checks, .env.local
npm run dev              # http://localhost:3000
npm run verify           # typecheck, lint, unit, integration (needs local Supabase), production build
npm run verify -- --browser   # ...plus the browser suite with mocks
npm run test:unit        # ~4,900 tests, jsdom, seconds per file
npm run test:integration # ~650 tests in ~100 files against the real local database (REQUIRE_TEST_STACK=1 makes a missing stack fail)
npm run test:e2e:mocked  # Playwright at phone size against `next start` with the AI and food mocks (build first)
npm run db:verify        # read-only database checks (RLS, quota triggers, policy helpers, billing tables)
bash scripts/bundle-sql.sh   # regenerate supabase/setup-all.sql after adding a migration
```

One file: `npx vitest run --project unit tests/unit/<file>.test.ts` (or `--project integration`). Browser tests must
go through `npm run test:e2e:mocked`; plain `npx playwright test` fails AI tests for the wrong reason.

## Where things are

| Path | What |
|---|---|
| `src/app` | Routes. `(app)` signed-in screens, `(auth)` sign-in, `api/` route handlers (`v1/` Bearer API, `stripe/` and `revenuecat/` webhooks, `billing/reconcile` and `maintenance/*` cron jobs with `CRON_SECRET`) |
| `src/server/actions` | Server actions (`"use server"`: **only async functions may be exported**) |
| `src/server/services` | Server logic: billing, store billing, reconcile, AI coach, workouts, accounts |
| `src/lib/domain` | Pure domain logic (plans, GPS track, calorie budget, sleep alarm, ...): unit-test here first |
| `src/lib/native*`, `src/lib/native/` | Capacitor bridges (location, notifications, alarm, back button, app links). Safe no-ops in a browser |
| `src/lib/ai`, `src/lib/coach`, `src/server/coach` | AI prompts, tools, budgets; `src/lib/ai/bible-ai.ts` + `src/server/actions/bible-ai.ts` is the Bible study helper |
| `supabase/migrations` | Ordered SQL migrations, `YYYYMMDD000NNN_name.sql` (NNN = the next number after the highest, 099 so far) |
| `tests/unit`, `tests/integration`, `e2e` | Vitest unit (jsdom), Vitest integration (real DB), Playwright |
| `ios/`, `android/`, `native-shell/` | Native projects and the offline shell (offline page, bundled Bible) |
| `.claude/agents/` | Specialist agents: native-mobile, security, backend, database, payments, qa-testing |

## How to change things here

- **Migrations:** one new file per change, numbered after the highest; header comment says why and how to roll back;
  `create ... if not exists` / `drop ... if exists`; every new table gets RLS and an integration test. Call no-argument
  permission helpers in policies as `(select helper())` (a test enforces it). Then run `bash scripts/bundle-sql.sh`.
  Never edit a migration that may have run on a hosted database.
- **Server actions called from the client:** await them inside `useSafeTransition` (`src/lib/use-safe-transition.ts`)
  or catch errors yourself; a unit test fails on an unguarded call. Return `{ ok, error }` rather than throwing.
- **Forms that take typing:** keep unsent text with `useDraft` (`src/lib/use-draft.ts`).
- **Retried writes:** make them idempotent (client attempt ids, `attemptId` in `src/lib/domain/diary.ts`).
- **Billing:** the plan is read only from `user_entitlements`, written only by `recomputeEntitlement` /
  `apply_entitlement` (compare-and-set). Webhooks go through `claimWebhookEvent`. Never trust a webhook body about what
  a member owns; re-read the provider. Tests use local stand-ins on ports 4611 (RevenueCat) and 4613 (Stripe).
- **AI:** every call reserves budget first (`reserve_ai_usage`), honours the kill switches and consents, and treats
  member-written text as untrusted data inside the prompt.
- **New environment variables:** add them to `.env.example` (a test checks).
- **Native code:** keep plugin calls behind `isNativeApp()` / `Capacitor.isPluginAvailable`, never break the web build,
  and don't add entitlements that need an Apple capability the App ID may not have (see `scripts/native/app-links.mjs`).

## Definition of done

`npm run verify` passes; a regression test exists that fails without the change; migrations bundled; `.env.example`
updated; anything that needs a phone is added to `docs/production-consolidation/IPHONE_DEVICE_TESTING.md` /
`ANDROID_DEVICE_TESTING.md` rather than claimed; commit message says what changed and why.
