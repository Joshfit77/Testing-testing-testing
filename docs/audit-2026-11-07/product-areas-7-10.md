# Launch audit 2026-11-07 — product areas 7–10

Auditor worktree: `/home/user/Testing-testing-testing/.claude/worktrees/agent-af4c0405214fb1339` (branch
`worktree-agent-af4c0405214fb1339`, based on `claude/faith-discipleship` @ 4bdd1db). Ports used: 3104 (app), 4787
(AI mock), 4788 (OFF mock).

Environment note (affects every section): at the start of this audit the Docker daemon was not running (`docker ps`:
"Cannot connect to the Docker daemon"; no `dockerd` process; the socket file is dated 21:21). The local Supabase stack
on 127.0.0.1:54321 therefore answered nothing (`curl` exit 000), and the demo server on port 3000 was not listening.
Per the brief I did not restart daemons. Consequences are marked **BLOCKED (no Supabase)** below; everything that needs
a signed-in session (integration tests, e2e, axe over authenticated screens, per-page Supabase call counts) could only
be prepared, type-checked and reasoned from code, not executed. Nothing in this file claims a run that did not happen.

---

## Area 7 — Free and Pro subscription enforcement

### Inventory

Plan model
- `src/lib/domain/plans.ts` — `FEATURES`, `getPlans()` (free / legacy plus / pro), `APPROVED_PRO_PRICE_CENTS = {month: 1999, year: 14999}`,
  `hasFeature`, `canAccessTier`, `effectivePlanFromSubscription`, `entitlementFromSubscriptions`, `planFromEntitlement`, `aiAllowance`,
  `legacyTermsApply`, `formatPrice`, `yearlySavingsPercent`.
- `src/lib/domain/types.ts` — `Plan = "free" | "plus" | "pro"`.
- `src/server/auth.ts` — `getPlanWith(client, userId)` (reads `user_entitlements`), `getUserPlan` (cached, cookie session),
  `assertFeature` → `EntitlementError`, `requireUser/requireOnboardedUser/requireAdmin`.
- `src/server/api-auth.ts` — `authenticateRequest` (bearer or cookie), `planForAuth` (plan read through the authenticating client).

Billing
- `src/server/services/billing.ts` (562 lines) — Stripe checkout/portal, `handleStripeEvent` (signature already verified by the route),
  subscription sync with `updated_at`/ordering guard, refund and dispute handling (`access_revoked_at`), entitlement recompute.
- `src/server/services/store-billing.ts` (145) — RevenueCat webhook handling, `webhookAuthorized`, server-side re-fetch of the
  customer from RevenueCat before granting (replayed events cannot grant), sandbox allow-list (`sandbox-testers.ts`).
- `src/server/services/billing-reconcile.ts` (105) — scheduled reconciliation against Stripe; `src/app/api/billing/reconcile/route.ts` (CRON_SECRET).
- `src/server/services/webhook-events.ts` — exactly-once processing with a lease (`webhook_events` table): duplicate / busy / failed.
- `src/server/actions/billing.ts` (web checkout, portal), `src/server/actions/store-billing.ts` (in-app purchase sync),
  `src/lib/billing/paywall.ts` (copy and store disclosures), `src/lib/billing/revenuecat.ts` (webhook schema), `src/lib/billing/store-purchases.ts`.
- Routes: `src/app/api/stripe/webhook/route.ts`, `src/app/api/revenuecat/webhook/route.ts`, `src/app/api/billing/reconcile/route.ts`,
  `src/app/api/v1/me/route.ts` (reports the server-side plan).
- `src/server/env.ts` — Stripe / RevenueCat / AI keys are blanked when `demoModeOn()`; `STRIPE_LIVE_APPROVED` gate.
- Demo Pro switch: `src/server/actions/demo.ts:63-68` (`isDemoMode() && isDemoUser(user)` → upsert `user_entitlements` source `admin`),
  `src/server/demo.ts`, `src/lib/demo/mode.ts` (`DEMO_MODE === "true"` and not production / live-approved).
- Migrations: `20261017000007_onboarding_plan.sql`, `20261022000022_legacy_plan_terms.sql`, `20261022000023_store_subscriptions.sql`,
  `20261023000024_plan_enforcement.sql` (database-level `plan_of()` checks on paid tables), `20261025000042_plan_of_private.sql`,
  `20261101000046_billing_integrity.sql` (webhook_events lease, compare-and-set entitlements), `20261103000052_sandbox_testers.sql`.
  Tables: `user_entitlements`, `subscriptions`, `store_subscriptions`, `legacy_plan_terms`, `webhook_events`, `sandbox_testers`, `ai_usage_events`.

Server actions that gate a Pro feature (file:line of the gate)
- AI coach: `coach.ts:30` (`planLimit <= 0` → "Saving AI plans requires Pro."), `coach.ts:113` ("Coach suggestions are included with Pro.");
  `coach-memory.ts:15` (`chatLimit > 0` helper used by every memory write); `adaptive-training.ts:17,36,59,77`;
  `bible-ai.ts:14` (plan passed to `askBible`); `food-photo.ts:18` (AI photo; plus `nutrition_tracking` at :65); `label.ts:52`.
  AI routes: `src/app/api/ai/chat/route.ts:37` (`planForAuth`), `ai/food-photo`, `ai/label-photo` → `assertAiAllowed` in
  `src/server/services/ai-coach.ts:126-132` (AiError `not_entitled` → 403).
- Live GPS: `gps-activities.ts:55` (`live_gps`).
- Advanced analytics: `body-map.ts:17` (`advanced_analytics`); page-level `progress/overview`, `progress/page.tsx`,
  `train/exercises/[slug]/history`.
- Meal planning / recipes / grocery / AI meal plan: `meal-plan.ts:28`, `recipes.ts:27`, `grocery.ts:19`, `ai-meal-plan.ts:22` (`meal_planning`).
- Food comparisons / filters: `food-quality.ts:21,43` (`food_comparisons`); routes `foods/search`, `foods/barcode`, page `nutrition/compare`.
- Body Scan: `body-scan.ts:19,61` (`canUseBodyScan(plan)`).
- Sleep insights: page-level only — `progress/sleep/{debt,energy,schedule,history}` (`sleep_analytics`), `progress/sleep/training`
  (`sleep_ai_coaching`). The sleep *write* actions (`sleep.ts`, `sleep-checkins.ts`, `sleep-import.ts`, `recovery.ts`) are Free by
  design (basic sleep logging is Free), so they carry no gate.
- Premium programs: `programs.ts:21-23` (`canAccessTier(plan, program.tier)` or owner), `custom-programs.ts:25` (`custom_program_builder`),
  `calendar.ts:25` (`advanced_calendar`), `templates.ts:31-34` (Free template limit 5), API `v1/programs/route.ts`.
  `plan-schedule.ts` (`applyScheduleChangeAction`) rebuilds the *starter* program through `buildAndActivateCustomProgram` with no plan
  gate — see findings.
- Pages that gate on read (hide or preview): `(app)/layout.tsx`, `home`, `train/*`, `run/*`, `nutrition/*`, `coach/*`, `progress/*`,
  `profile`, `profile/billing`, `calendar`, `search`, `faith/ask`.

Existing tests covering this area (all `tests/integration`, need local Supabase): `entitlements.test.ts` (Stripe signature, once-per-event,
past_due, yearly price, refunds, disputes, stale events), `billing-integrity.test.ts` (forged/oversized webhooks, lease, concurrency,
metadata forgery, reconcile), `store-billing.test.ts` (RevenueCat auth, replay, sandbox allow-list), `plan-enforcement.test.ts`,
`pro-bypass.test.ts` (forged plan fields on the AI route, self-grant attempts, `plan_of()` privacy), `ai-route-limits.test.ts`,
`ai-limits.test.ts`. Unit: `tests/unit/plans*.test.ts`, `billing*.test.ts`, `demo-mode*.test.ts` (checked below).
e2e: `memberships.spec.ts`, `store-billing.spec.ts`, `production-no-demo.spec.ts`.

New in this audit: `tests/integration/free-user-direct-actions.test.ts` (from the earlier auditor's draft; see below).

### Workflows tested
(appended below as they are done)

---

## Area 8 — Reliability, offline behaviour and data persistence

### Inventory
- Workout draft (local): `src/lib/workout-storage.ts` (`loadLocalDraft`/`saveLocalDraft`/`clearLocalDraft`, `DRAFT_EVENT`, discard
  memory `rememberDiscard`/`pendingDiscards`/`retryPendingDiscards`), `src/lib/domain/workout-draft.ts` (821 lines: reducer,
  `DRAFT_VERSION = 2`, `migrateDraft`, `isWorkoutDraft`, `restorableDraft`, `newerDraft`, `finishPayload`, `finishFailureMessage`,
  `STALE_DRAFT_HOURS = 6`).
- Workout draft (server): `src/server/actions/workouts.ts` — `syncWorkoutDraftAction`, `discardWorkoutAction`, `finishWorkoutAction`,
  `editWorkoutAction`, `deleteWorkoutAction`; service `src/server/services/workouts.ts`; table `workout_drafts`.
- UI: `src/components/workout/workout-logger.tsx`, `src/components/shell/active-workout-pill.tsx`, `quick-add.tsx`, `app-shell.tsx`,
  `src/components/home/today-workout-action.tsx`, `src/lib/opening.ts`.
- Generic drafts: `src/lib/drafts.ts` (`ngf.draft.` prefix, 30-day max age, per-user key, device cleanup), `src/lib/use-draft.ts`
  (`useDraft`, debounced) used by `faith-forms.tsx` (journal), `coach-chat.tsx`, `progress-photos.tsx`, `diary-client.tsx`,
  `nutrition-client.tsx`; also `recipe-editor.tsx`, `ai-meal-plan.tsx`, `journey-checkin.tsx`.
- Live GPS recording persistence: `src/lib/run/live-recording.ts`.
- Service worker: `public/sw.js` (static cache-first, navigations network-first with `/offline.html`, Bible offline cache
  `ngf-bible-v1`; never caches authenticated HTML/API), registered by `src/components/shell/sw-register.tsx` (production, non-native only).
  `public/offline.html`, `public/bible-offline.{html,js}`, `src/app/manifest.ts`.
- Error monitoring: `src/lib/error-report.ts`, `src/lib/error-redact.ts`, `src/app/api/client-errors/route.ts` (rate-limited 30/10 min
  per IP hash, `logError`), `src/server/log.ts`, `docs/ERROR_MONITORING.md`. Error boundaries: `src/app/**/error.tsx` (checked below).
- Session expiry: `src/lib/supabase/*`, `src/middleware.ts` (checked below).
- e2e covering the area: `workout-reliability.spec.ts`, `train-pause.spec.ts`, `fast-logging.spec.ts`, `core-flow.spec.ts`.
  Unit: `tests/unit/workout-draft*.test.ts`, `workout-storage*.test.ts`, `drafts*.test.ts`, `sw*.test.ts` (checked below).

---

## Area 9 — Performance and loading efficiency

### Inventory
- Build: `next.config.ts`, `npx next build` output (route sizes, First Load JS) — recorded below.
- Images: `public/badges`, `public/illustrations`, `public/opening`, `public/icons`, `public/exercise-demos` (owned by another engineer;
  measured, not changed).
- Measurement scripts already in repo: `scripts/ux/measure-journeys.mjs`, `scripts/ux/responsive-audit.mjs`.
- Server pages: `src/app/(app)/**/page.tsx` — Supabase calls per page counted statically (`.from(` / service calls) where a live
  count was impossible.

---

## Area 10 — Accessibility and mobile usability

### Inventory
- `scripts/ux/axe-sweep.mjs` (axe-core over ~55 routes at iPhone 15 Pro size, needs the demo sign-in), `scripts/ux/interaction-audit.mjs`,
  `scripts/ux/responsive-audit.mjs`.
- Theme / type: `src/app/globals.css` (tokens, `prefers-reduced-motion`, large-text classes), `src/app/layout.tsx`,
  `src/components/profile/display-settings.tsx` (large-text setting), `src/components/common/celebration.tsx`, `src/lib/keyboard.ts`,
  `src/components/platform/keyboard-avoidance.tsx`.
- Shell / navigation: `src/components/shell/*` (bottom tabs, pill, quick-add), icon-only buttons across `src/components/**`.
- e2e: `device-matrix.spec.ts`, `phone-sweep.spec.ts`, `csp-and-layout.spec.ts`, `button-sweep.spec.ts`, `navigation.spec.ts`.
