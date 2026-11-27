# Launch audit 2026-11-07 — product areas 7–10

Auditor worktree: `/home/user/Testing-testing-testing/.claude/worktrees/agent-af4c0405214fb1339` (branch
`worktree-agent-af4c0405214fb1339`, based on `claude/faith-discipleship` @ 4bdd1db). Ports used: 3104 (app), 4787
(AI mock), 4788 (OFF mock).

**Environment notes.**
- For the first hour the Docker daemon was down (no `dockerd`, `docker ps` refused), so local Supabase answered nothing
  (`curl` → 000). Everything that needs it was prepared from code; once the coordinator reported Docker and Supabase back
  (`rest/v1/` → 200), every blocked run was executed and the results below are the real ones.
- The repo's e2e specs could not sign up on port 3104: Supabase builds the confirmation email from its own `site_url`
  (`http://localhost:3000`, `supabase/config.toml:160`, `supabase/templates/confirmation.html`), and `e2e/helpers.ts`
  followed that link verbatim (`ERR_CONNECTION_REFUSED` on `localhost:3000/auth/confirm?...`). Per the coordinator's
  note I changed the helper locally to rebase the app's emailed links onto `E2E_BASE_URL` (commit ad4f373); Supabase's
  own `/auth/v1/verify` links are untouched. Port 3000 was not used.
- Signed-in measurements (areas 9 and 10) and the area-8 browser checks ran on **the same production build started in
  demo mode** (`DEMO_MODE=true`, the seeded sample account, payments and AI keys blanked), because the sample account
  carries realistic data and the repo's `scripts/ux/axe-sweep.mjs` signs in through "Explore with sample data". The
  screens are the production screens; the demo bar adds one small block at the top of each. The e2e specs ran on the
  same build restarted without demo mode (the brief's command). No deployed server, no real payments, no AI provider.

---

## Area 7 — Free and Pro subscription enforcement

### Inventory

Plan model
- `src/lib/domain/plans.ts` — `FEATURES`, `getPlans()` (free / legacy plus / pro), `APPROVED_PRO_PRICE_CENTS = {month: 1999, year: 14999}`,
  `hasFeature`, `canAccessTier`, `effectivePlanFromSubscription`, `entitlementFromSubscriptions`, `planFromEntitlement`, `aiAllowance`,
  `legacyTermsApply`, `formatPrice`, `yearlySavingsPercent`.
- `src/lib/domain/types.ts` — `Plan = "free" | "plus" | "pro"`.
- `src/server/auth.ts` — `getPlanWith(client, userId)` (reads `user_entitlements`), `getUserPlan` (cookie session), `assertFeature` →
  `EntitlementError`, `requireUser / requireOnboardedUser / requireAdmin`.
- `src/server/api-auth.ts` — `authenticateRequest` (bearer or cookie), `planForAuth` (plan read through the authenticating client).

Billing
- `src/server/services/billing.ts` — Stripe checkout/portal, `handleStripeEvent`, `stripePriceProblems` + `PriceMismatchError`
  (`createCheckoutSession` refuses a Stripe price whose `unit_amount` differs from the approved cents, lines 140–147),
  `AlreadySubscribedError`, refund/dispute handling (`access_revoked_at`), ordered subscription sync.
- `src/server/services/store-billing.ts` — RevenueCat webhook handling, `webhookAuthorized`, server-side re-read of the customer
  before any grant, sandbox allow-list (`sandbox-testers.ts`). `src/server/actions/store-billing.ts:16` `syncStorePurchasesAction`
  asks RevenueCat; the client's purchase result is never trusted.
- `src/server/services/billing-reconcile.ts` + `src/app/api/billing/reconcile/route.ts` (CRON_SECRET).
- `src/server/services/webhook-events.ts` — exactly-once processing with a lease (`webhook_events`): duplicate / busy / failed.
- `src/server/actions/billing.ts`, `src/lib/billing/paywall.ts`, `src/lib/billing/revenuecat.ts`, `src/lib/billing/store-purchases.ts`.
- Routes: `src/app/api/stripe/webhook/route.ts` (signature via `constructEvent` on the raw body, 512 kB cap, 400/409/413/500/503),
  `src/app/api/revenuecat/webhook/route.ts` (Authorization header, 256 kB cap, schema), `src/app/api/billing/reconcile/route.ts`,
  `src/app/api/v1/me/route.ts`, `src/app/api/v1/programs/route.ts` (`locked` flag from the server-side plan).
- `src/server/env.ts` — Stripe / RevenueCat / AI keys blanked when `demoModeOn()`; `STRIPE_LIVE_APPROVED` gate.
- Demo Pro switch: `src/server/actions/demo.ts:60-70` `setDemoPlanAction` (`isDemoMode() && isDemoUser(user)` → upsert
  `user_entitlements` with the service role), `src/server/demo.ts`, `src/lib/demo/mode.ts` (`DEMO_MODE === "true"` and neither
  `VERCEL_ENV=production` nor `STRIPE_LIVE_APPROVED=true`).
- Migrations: `20261017000007_onboarding_plan.sql`, `20261022000022_legacy_plan_terms.sql`, `20261022000023_store_subscriptions.sql`,
  `20261023000024_plan_enforcement.sql` (`plan_of()` / `has_plan()` checks in RLS: `training_programs_insert` allows `starter` for all,
  `custom` with Plus, `ai` with Pro; paid `program_exercises` readable only with the plan), `20261025000042_plan_of_private.sql`,
  `20261101000046_billing_integrity.sql`, `20261103000052_sandbox_testers.sql`. Tables: `user_entitlements`, `subscriptions`,
  `store_subscriptions`, `legacy_plan_terms`, `webhook_events`, `sandbox_testers`, `ai_usage_events`.

Server actions that gate a Pro feature (file:line of the gate)
- AI coach: `coach.ts:30` ("Saving AI plans requires Pro."), `coach.ts:113`; `coach-memory.ts:15` (`chatLimit > 0` for every memory
  write); `adaptive-training.ts:17,36,59,77`; `food-photo.ts:18,25,70` (AI photo consent and logging), `food-quality.ts:43`
  (`explainProductAction` → `withAiRequest` → `assertAiAllowed`). AI routes `api/ai/chat|food-photo|label-photo` →
  `planForAuth` → `assertAiAllowed` in `src/server/services/ai-coach.ts:126-132` (403 `not_entitled`).
- Live GPS: `gps-activities.ts:55` (`live_gps`).
- Advanced analytics: `body-map.ts:17`; page-level `progress/overview`, `progress/page.tsx`, `train/exercises/[slug]/history`.
- Meal planning / recipes / grocery / AI meal plan: `meal-plan.ts:28`, `recipes.ts:27`, `grocery.ts:19`, `ai-meal-plan.ts:22` — all
  through a shared `ctx()` that runs before any input is read.
- Food comparisons / filters: `food-quality.ts:21`; page `nutrition/compare`, `nutrition/product/[code]`.
- Body Scan: `body-scan.ts:19` (consent) and `:61-70` (save; uploaded files are removed when the plan does not allow the scan).
- Sleep insights: page-level — `progress/sleep/{debt,energy,schedule,history}` (`sleep_analytics`), `progress/sleep/training`
  (`sleep_ai_coaching`). Sleep *writes* (`sleep.ts`, `sleep-checkins.ts`, `sleep-import.ts`, `recovery.ts`) are Free by design.
- Premium programs: `programs.ts:21-23` (`canAccessTier` or owner → "This program requires an upgraded plan."),
  `custom-programs.ts:25`, `calendar.ts:25`, `templates.ts:31-37` (Free limit 5, `MAX_TEMPLATES` for everyone).
  `plan-schedule.ts` (`applyScheduleChangeAction`) rebuilds the *starter* program with the service role and no plan gate: this is
  intentional (starter programs are Free; rate-limited 10/hour) and matches the RLS policy.
- Pages gating on read: `(app)/layout.tsx`, `home`, `train/*`, `run/*`, `nutrition/*`, `coach/*`, `progress/*`, `profile`,
  `profile/billing`, `calendar`, `search`, `faith/ask`.

Tests
- Integration (local Supabase): `entitlements.test.ts`, `billing-integrity.test.ts`, `store-billing.test.ts`, `plan-enforcement.test.ts`,
  `pro-bypass.test.ts`, `ai-route-limits.test.ts`, `ai-limits.test.ts`, and the new `free-user-direct-actions.test.ts`.
- Unit: `plans.test.ts`, `demo-mode.test.ts`, `demo-mode-guard.test.ts`, `stripe-live-guard.test.ts`, `revenuecat.test.ts`,
  `paywall.test.ts`, `billing-negative-auth.test.ts`, `ai-routes-plan.test.ts`, `bible-plans.test.ts`, `store-paywall.test.tsx`.
- e2e: `memberships.spec.ts`, `store-billing.spec.ts`, `production-no-demo.spec.ts` (not run tonight; see area 8 for the e2e runs).

### Workflows and failure scenarios tested

| What | How | Result |
| --- | --- | --- |
| Every Pro server action called directly by a Free member | `tests/integration/free-user-direct-actions.test.ts` (finished from the earlier auditor's draft; 9 tests, 30 action calls across 14 modules: meal planner ×6, recipes ×2, grocery ×3, AI meal plan ×2, program builder, calendar move, strength ranks, food filters, AI product explanation, paid library program save/start, Body Scan consent, live GPS save, food-photo consent and logging, coach proposals ×2, coaching memory ×3, adaptive training ×3, the Free template limit; the demo Pro switch with `DEMO_MODE` unset; a plan claimed in cookies, body and `user_metadata` against `/api/ai/chat`; a server-side grant opening the calls and its expiry closing them) | `npx vitest run --project integration tests/integration/free-user-direct-actions.test.ts` → **9 passed**. Two first-run failures were test inputs (an unseeded exercise slug and an invalid memory category), fixed in 94d723e. No application defect. |
| Whole integration project | `npx vitest run --project integration` | **50 files passed, 1 skipped (331 tests: 330 passed, 1 skipped)**; exit 0. Baseline before tonight: 157 passed / 27 files (the branch has since grown). |
| Gate ordering (plan check before any write) | Code read of every gated action; the test passes schema-valid input where parsing comes first (`draftAiMealPlanAction`, `acceptRecommendationAction`); input validation sometimes answers before the plan check (`addCoachMemoryAction`), which is harmless | Verified: every refusal happens before any write; the test also counts rows afterwards (0). |
| Stripe webhook signature, replay, oversize, malformed | `api/stripe/webhook/route.ts` (`constructEvent` on the raw body, 512 kB cap, lease via `webhook-events.ts`); `entitlements.test.ts:76,85`, `billing-integrity.test.ts:138-245` | **Pass** (in the integration run). |
| RevenueCat webhook auth, replay cannot grant | `store-billing.test.ts:94,141`, `billing-integrity.test.ts:351,370` | **Pass**. |
| Client claiming Pro in cookie / body / user_metadata | `pro-bypass.test.ts:48,81,137` + the new test's case (403, `getPlanWith` → "free", 0 `ai_usage_events`) | **Pass**. |
| Demo Pro switch with `DEMO_MODE` unset | New integration case (an account flagged `app_metadata.demo=true` by the service role calls `setDemoPlanAction("pro")` → entitlement stays absent, `getPlanWith` → "free"); unit `demo-mode.test.ts`, `demo-mode-guard.test.ts` | **Pass**. |
| Prices are $19.99 / $149.99 everywhere | `grep` of every `$`-price and cents literal across `src`, `ios`, `android`, `native-shell`, `standalone`, `public`, docs | Code: only `plans.ts:100` defines them; checkout refuses a mismatching Stripe price (`billing.ts:146`); the native paywall shows the store's localized price. **Stale copies** in `README.md:37`, `SETUP.md:63,80`, `IMPLEMENTATION_STATUS.md:37`, `docs/LEGAL_REQUIREMENTS.md:94-95` ($24.99 / $249.99 and a `BILLING_YEARLY_ENABLED` flag that no longer exists) — fixed in 457126b (documentation only). `standalone/index.html:2787,2800` (offline single-file edition) still lists "Plus $11.99, Pro $24.99" — not changed, see blockers. |
| Unit tests of the plan model and billing guards | 10 files (listed above) | **156 passed**. |

### Bugs found
1. **Stale prices in four documents** (low). Fixed 457126b. No regression test (prose).
2. **Offline edition (`standalone/index.html`) shows the pre-October plans and prices** (medium for the offline APK built by
   `.github/workflows/android-apk.yml` from `standalone/**`; not the App Store app). Not fixed: generated from a template outside the
   repo (`docs/PROJECT_CHECKLIST.md:569`).
3. No enforcement defect found: every Pro feature traced is refused server-side before any write, and the database repeats the
   check for paid rows (`plan_enforcement.sql`).

### Security / data isolation / subscription enforcement
- Plan source of truth: `user_entitlements` (server and webhooks write it; members cannot). Cookie and bearer requests read it through
  their own authenticated client, never from `user_metadata`, cookies or request bodies (tested).
- Webhooks: signature (Stripe) / shared header (RevenueCat), size caps, schema validation, exactly-once lease, older-snapshot guard,
  RevenueCat re-read before a grant. Replays return `duplicate: true` and change nothing (tested).
- Checkout: `PriceMismatchError` stops a checkout whose Stripe price is not 1999 / 14999 cents; `AlreadySubscribedError` stops a second
  subscription from a second tab.
- Demo: `DEMO_MODE=true` is refused on production / live-approved deployments; without it the Pro switch, demo sign-up and
  simulated AI do not exist (tested).
- Client-side gating only hides UI (`hasFeature` in pages); nothing grants access on the client.

### Scores
- Functionality 9/10 — every gate traced is in place, consistent with `docs/MEMBERSHIPS.md`, and exercised by 331 integration tests.
- Reliability 8/10 — webhook lease, ordering guards and reconciliation all pass; the offline edition's copy is the one stale piece.
- Security 9/10 — server-side only, database backstop, forged-claim and replay tests pass.
- Accuracy 8/10 — prices consistent in code; four docs (fixed) and the offline edition were stale.

### Launch blockers (ranked)
1. Regenerate `standalone/index.html` with Free + Pro All Access before shipping the offline APK again.
2. Owner-side: create the real Stripe prices and App Store / Play products at $19.99 / $149.99 (`docs/MEMBERSHIPS.md`,
   `docs/MOBILE_BILLING.md`); the code refuses checkout otherwise, so a wrong price shows as a refused checkout, not a wrong charge.
3. None in the enforcement code itself.

---

## Area 8 — Reliability, offline behaviour and data persistence

### Inventory
- Workout draft (device): `src/lib/workout-storage.ts` (`ngf.workout.draft.<userId>`, `localDraftKey`, `DRAFT_EVENT`, discard memory
  `ngf.workout.discarded.<userId>`, last 20, `retryPendingDiscards`), `src/lib/domain/workout-draft.ts` (reducer, `DRAFT_VERSION = 2`,
  `migrateDraft`, `restorableDraft`, `newerDraft`, `draftFromOtherTab` (new), `finishPayload`, `finishFailureMessage`, `STALE_DRAFT_HOURS = 6`).
- Workout draft (server): `src/server/actions/workouts.ts` `syncWorkoutDraftAction` / `discardWorkoutAction` / `finishWorkoutAction`;
  `src/server/services/workouts.ts` `saveDraftSnapshot` (unique `client_id`), `discardDraft`, `finishWorkout` (idempotent on
  `client_id`: a retried finish returns the saved session and its records; a partial attempt is cleaned and redone).
- Logger: `src/components/workout/workout-logger.tsx` — local save on every change, server push debounced 2 s, immediate on set
  completion, flush on `visibilitychange`/`pagehide`, retry back-off 5 s ×3 up to 120 s, online/offline state, restore = newer of
  local/server minus discarded, conflict screen for a different session or a draft older than 6 h, finish keeps the first requested
  end time; **new**: a `storage` listener adopts a newer copy of the same workout saved by another tab.
- Shell: `active-workout-pill.tsx`, `quick-add.tsx`, `app-shell.tsx`, `home/today-workout-action.tsx` (listen for `storage` and `DRAFT_EVENT`).
- Generic drafts: `src/lib/drafts.ts` (`ngf.draft.<userId>.<key>`, 30-day expiry, 100 000-char cap, `clearAllDrafts` on sign-out /
  device cleanup), `src/lib/use-draft.ts` (400 ms debounce, flush on hide/unmount, "Draft restored" notice). Used by
  `faith-forms.tsx` (journal, per entry/kind), `coach-chat.tsx`, `progress-photos.tsx`, `diary-client.tsx` (quick add),
  `nutrition-client.tsx` (manual and custom food).
- Live GPS: `src/lib/run/live-recording.ts` (track written every 5 s; kept across in-app navigation; a reload ends the watcher and
  the recorder offers the saved track).
- Service worker: `public/sw.js` — `_next/static`, icons, fonts, png/svg cache-first (`ngf-v1-static`); navigations network-first
  with `/offline.html`; Bible text in `ngf-bible-v1` (survives SW updates); authenticated HTML/API never cached. Registered in
  production, web only (`sw-register.tsx`).
- Error monitoring: `src/instrumentation.ts`, `src/instrumentation-client.ts`, `src/lib/error-report.ts`, `src/lib/error-redact.ts`,
  `src/app/api/client-errors/route.ts` (30 per address / 10 min), `src/app/(app)/error.tsx` (reports and offers "Try again"),
  `docs/ERROR_MONITORING.md` (off until `ERROR_REPORTING=on`). No `global-error.tsx`.
- Session: `src/middleware.ts` → `updateSession` (cookie refresh) on every non-static request.
- Tests: unit `workout-discard.test.ts`, `workout-draft-session.test.ts`, `workout-logger-stage2.test.ts`, `workout-fast-logging.test.ts`,
  `workout-timers.test.ts`, `drafts.test.tsx`, `bible-offline.test.ts`, `error-monitoring.test.ts`, **new** `workout-two-tabs.test.ts`;
  integration `workouts.test.ts`, `workout-fast-logging.test.ts`; e2e `workout-reliability.spec.ts`, `train-pause.spec.ts`,
  `fast-logging.spec.ts`, `core-flow.spec.ts`.

### Workflows and failure scenarios tested

Browser checks ran with a Playwright script (scratchpad `a7/reliability-demo.mjs`) on the production build in demo mode, iPhone 15
Pro profile, the sample account's "today" session; every workout started was discarded at the end (nothing was finished for real).

| Scenario | How | Result |
| --- | --- | --- |
| Reload mid-workout | Fill set 1 weight 135, mark set 1 complete, `page.reload()` | **PASS** — the completed set and the typed weight are back. |
| Finish while offline | `context.setOffline(true)` → Finish → Finish & save | **PASS** — "You appear to be offline. Your workout is saved on this device — try again when you're connected."; set 1 still logged. |
| Server 500 on Finish | The server-action POST to `/train/workout` (header `next-action`) fulfilled with 500 once | **PASS** — "We couldn't reach your account, so the workout isn't saved yet. It's kept on this device…"; no hard reload; set 1 still logged; 1 POST intercepted. |
| Server 500 on draft sync | Code: `syncWorkoutDraftAction` returns `{ok:false}` → status "local", back-off retry; local copy already saved | Verified by reading (same path as above with a softer message). |
| Discard while offline / pending discards | Unit `workout-discard.test.ts` (7 tests) | **Pass**. |
| Finish retry is idempotent (`client_id`) | Integration `workouts.test.ts` + unit `workout-draft-session.test.ts:119` | **Pass**. |
| Conflict: local vs server draft, stale draft | `restorableDraft` picks the newer; > 6 h or a different session → conflict screen; unit tests | **Pass** (unit). |
| **Two tabs on the same workout** | Tab A logs set 1 (synced); tab B opens the workout — restores set 1 (**PASS**) — and logs set 2 (synced); tab A then types a weight in set 3; tab B reloads | **FAIL before the fix**: set 2 gone (stored draft `[true,false,false,false]`): the logger had no cross-tab listener, so A wrote its older draft over B's locally and on the server. **Fixed** in b4c378b; re-run after the rebuild: see "Re-run after the two-tab fix" below. |
| Expired session mid-workout | `requireUser()` in `syncWorkoutDraftAction` → `redirect("/login")` thrown from a background sync; the local draft (keyed by userId) is restored after sign-in | Verified by reading: no data loss, but the member is sent to the login screen by a background save rather than told. Not reproduced (would need to expire the sample account's session). |
| Food log and journal drafts | Unit `drafts.test.tsx` (saves while typing, restores after remount, flushes on unmount, never another user's) | **Pass**. |
| Service worker offline page, Bible offline cache | Unit `bible-offline.test.ts` (12) | **Pass**. |
| Error monitoring | Code read + unit `error-monitoring.test.ts` | **Pass**; production switch is off by default (owner decision). |
| e2e `workout-reliability.spec.ts`, `train-pause.spec.ts` | Against the non-demo production server on :3104 with the AI/OFF mocks, after the helper fix | See "e2e runs" below. |

### Bugs found
1. **Two tabs: the slower tab overwrote the other's sets** (P2; reproduced in a browser). Fixed b4c378b: `draftFromOtherTab` +
   a `storage` listener in the logger adopts the other tab's copy when it is the same workout and strictly newer. Regression test
   `tests/unit/workout-two-tabs.test.ts` (2 tests); browser re-run below.
2. **Background sync can redirect the member to /login mid-workout without a message** (P3). Draft kept. Suggested: have
   `syncWorkoutDraftAction` return `{ok:false, error:"signed_out"}` instead of redirecting and show a banner.
3. No `global-error.tsx` (P3): an error in the root layout shows Next's default page and is not reported.

### Browser-tested vs needs-physical-device
| Item | Browser (Chromium, production build) | Device |
| --- | --- | --- |
| Draft persistence on reload, offline finish, server-500 finish, two tabs | Tested (scripts above) | Background-tab flush while the phone is locked needs an iPhone |
| Service worker offline page / Bible cache | Unit (mocked SW) | Safari/iOS PWA check; the native shell does not register the SW |
| Live GPS persistence | Not run | Physical phone (GPS) |

### Scores
- Functionality 8/10 — complete local+server persistence, idempotent finish, offline discards, drafts where they matter.
- Reliability 8/10 — reload / offline / 500 paths all behave; the two-tab overwrite is fixed; the silent login redirect remains.
- Security 8/10 — SW never caches private HTML/API; drafts are per-user and cleared on sign-out; error reports redacted twice.

### Launch blockers (ranked)
1. None hard. Turn `ERROR_REPORTING=on` for the beta so crash screens reach the host's logs (owner decision).
2. The signed-out-mid-workout message (P3) before a wider beta.

---

## Area 9 — Performance and loading efficiency

### Inventory
- Build: `npx next build` (Next 15.5.28) — 91 static pages generated, every app route dynamic. Shared First Load JS 108 kB; middleware
  94.9 kB. Heaviest routes (First Load JS): `/progress/overview` 326 kB, `/faith` 296 kB, `/nutrition` 292 kB,
  `/nutrition/compare|product|scanner` 291 kB, `/nutrition/photo` 285 kB, `/nutrition/planner` 283 kB, `/nutrition/recipes/*` 279 kB,
  `/nutrition/saved-meals` 274 kB, `/profile` 271 kB, `/run` 255 kB, `/progress` 254 kB, `/faith/journal/[id]` 253 kB, `/home` 252 kB,
  `/progress/sleep` 251 kB, `/calendar` 249 kB, `/train/programs` 248 kB, `/train` 246 kB, `/login` 239 kB, `/train/workout` 225 kB
  (23.3 kB own), `/coach` 189 kB, `/faith/bible/[book]/[chapter]` 154 kB.
- Heaviest client chunks (`.next/static/chunks`): `4301.*.js` 457 kB and `3fdb55f3.*.js` 288 kB (ZXing barcode, loaded lazily by
  `barcode-scanner.tsx:199` when the scanner opens), `6303.*.js` 399 kB (recharts via `components/charts/chart-plots.tsx`),
  `2463.*.js` 288 kB and `2983-*.js` 182 kB (three.js — the 2.5D exercise demos, another engineer's area; `2983` is in the first
  load of 46 routes including `/` and `/onboarding`), `framework-*.js` 219 kB, `3976-*.js` 195 kB (`/progress/overview`, `/progress/body-scan/new`).
- Fonts: five self-hosted woff2 (Inter 48 kB, Plus Jakarta 27 kB, Cinzel 26 kB, Lora 38 + 41 kB) — 178 kB on every cold load.
- Images: `public/bible` 4.2 MB (fetched only for "Save for offline"), `public/exercise-demos` 2.7 MB (other engineer), `public/badges`
  2.1 MB (27 webp, 80–138 kB each), `public/icons/icon-512.png` 124 kB, `public/opening` 196 kB. On the eight measured screens the
  only images fetched were two SVG illustrations and the icon (≤ 2 kB).
- Server pages: static count of awaited calls in `src/app/(app)/**/page.tsx` (top): `train/workout` 11 awaits / 4 `.from(` / 2
  `Promise.all`, `nutrition/product/[code]` 10/3/1, `train/programs/[slug]` 10/8/1, `coach` 9/4/1, `run` 9/4/3, `nutrition/photo` 7/2/3.
  Live per-request query counts were not instrumented; the TTFB column below is the practical measure.

### Measurements

Production build, Playwright Chromium, iPhone 15 Pro profile at 393 × 852, cold context per route, CDP
`Network.emulateNetworkConditions` (1.6 Mbps down / 750 kbps up / 150 ms RTT — DevTools "Slow 4G") and
`Emulation.setCPUThrottlingRate` 4× (scripts: scratchpad `a7/measure.mjs`, `a7/measure-demo.mjs`). Local server; hosted TTFB
will be higher.

Signed-in (demo-mode build, sample account):

| Route | TTFB | FCP | LCP | DCL | load | transfer | JS | requests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/home` | 127 ms | 1.24 s | 1.36 s | 0.93 s | 3.07 s | 559 kB | 297 kB | 48 |
| `/train` | 161 ms | 1.16 s | 1.16 s | 0.99 s | 3.12 s | 545 kB | 296 kB | 46 |
| `/train/workout` | 53 ms | 1.10 s | 1.10 s | 0.97 s | 3.41 s | 634 kB | 366 kB | 48 |
| `/nutrition` | 231 ms | 1.51 s | 1.51 s | 1.22 s | 3.57 s | 731 kB | 446 kB | 48 |
| `/faith` | 252 ms | 1.58 s | 1.84 s | 1.11 s | 3.54 s | 613 kB | 333 kB | 53 |
| `/faith/bible/john/3` | 58 ms | 1.22 s | 1.22 s | 0.98 s | 3.48 s | 601 kB | 353 kB | 53 |
| `/coach` | 115 ms | 1.10 s | 1.29 s | 0.94 s | 2.74 s | 483 kB | 245 kB | 38 |
| `/progress` | 74 ms | 1.16 s | 1.30 s | 0.97 s | 3.17 s | 551 kB | 304 kB | 48 |

Signed-out (same build without demo mode):

| Route | TTFB | FCP | LCP | load | transfer | JS | fonts | requests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 81 ms | 1.69 s | 1.69 s | 3.15 s | 449 kB | 220 kB | 178 kB | 31 |
| `/login` | 35 ms | 1.61 s | 1.61 s | 3.14 s | 491 kB | 268 kB | 178 kB | 32 |
| `/signup` | 22 ms | 1.50 s | 1.50 s | 2.99 s | 483 kB | 258 kB | 178 kB | 30 |
| `/legal/terms` | 34 ms | 1.50 s | 1.50 s | 2.67 s | 407 kB | 188 kB | 178 kB | 23 |
| `/legal/privacy` | 27 ms | 1.43 s | 1.43 s | 2.64 s | 412 kB | 188 kB | 178 kB | 24 |

Reading: FCP ≤ 1.6 s and LCP ≤ 1.9 s on slow 4G with a 4× slower CPU on every main screen; `load` (2.6–3.6 s) is dominated by JS
(245–446 kB per screen) and the 178 kB of fonts. The heaviest screens are Nutrition (446 kB JS) and the workout logger (366 kB).
Server render stays under 260 ms on the local database; `/faith` and `/nutrition` are the slowest to render.

### Findings
1. **Fonts: 178 kB on every cold load** (P3). Lora italic (41 kB) and Cinzel (26 kB) are only needed on Scripture/faith screens.
2. **`/nutrition` ships 446 kB of JS and `/progress/overview` has the largest First Load (326 kB)** (P3): recharts is bundled statically
   through `chart-plots.tsx`; a `next/dynamic` import would take 399 kB (raw) off the first paint of Progress/Sleep pages, and the
   nutrition screens would benefit from splitting the scanner/photo/label tools.
3. three.js chunk `2983` in 46 routes' first load (P3; another engineer's area — reported, not touched).
4. Badge images 80–138 kB each (P3): `/progress/badges` can show all 27 (≈ 2.1 MB); check lazy-loading on that grid before beta.
5. `train/programs/[slug]/page.tsx` runs eight `.from(` queries with one `Promise.all`; fine locally, worth a look on a hosted round-trip.
6. No regression in the build: no page over 31 kB of its own JS.

### Scores
- Functionality 8/10 — build clean (one pre-existing lint warning: unused `BookOpen`), all 91 pages generate.
- Reliability 8/10 — every main screen measured on the production build under throttling, with good paint times.
- Accuracy 7/10 — local server, emulated network/CPU; hosted TTFB and Safari on a real iPhone will differ.

### Launch blockers (ranked)
1. None hard. (Nice to have: dynamic-import recharts; trim fonts; lazy badge grid.)

---

## Area 10 — Accessibility and mobile usability

### Inventory
- `scripts/ux/axe-sweep.mjs` (axe-core 4.14, 51 signed-in routes at iPhone 15 Pro size), `scripts/ux/interaction-audit.mjs`,
  `scripts/ux/responsive-audit.mjs`.
- Styles: `src/app/globals.css` — tokens (`--gold #c9a54c`, `--gold-highlight #e2c477`, `--gold-muted #8c6a2f`, `--muted-foreground
  #b3b0aa`, `--background #070707`, `--card #151515`), global `:focus-visible { outline: 2px solid var(--gold-highlight) }` (line 231),
  `html[data-text-size="large|xlarge"]` 112.5 % / 125 % (249–254), `@media (prefers-reduced-motion: reduce)` (379, 522, 664, 1216)
  and the in-app `html[data-motion="reduce"]` mirror.
- Text size / motion wiring: `src/app/layout.tsx:34` inline `PREFS_SCRIPT` applies `localStorage` prefs before first paint;
  `(app)/layout.tsx:25` passes the profile's `text_size` / `reduce_motion`; `app-shell.tsx:42` `applyDisplayPrefs`;
  `profile/display-settings.tsx` (radio group with `aria-checked`).
- Shell: `src/components/shell/*`; bottom tab labels `[font-size:clamp(0.625rem,3vw,0.75rem)]` (`app-shell.tsx:207`).
- e2e: `phone-sweep.spec.ts` (every signed-in screen at 320/375/…/440 with the largest text and reduced motion), `csp-and-layout.spec.ts:98`,
  `device-matrix.spec.ts`, `button-sweep.spec.ts`.

### Checks run

| Check | Where | Result |
| --- | --- | --- |
| axe-core WCAG 2.1 A/AA, signed-in | `scripts/ux/axe-sweep.mjs` against the demo-mode production build: 51 screens (`/home` … `/search?q=squat`, collapsed sections opened) | **51 screens checked; 0 violating nodes in 0 rules**; no screen errored. Plus the 8 main screens in `measure-demo.mjs`: 0 violations each. |
| axe-core, signed-out | `/`, `/login`, `/signup`, `/legal/terms`, `/legal/privacy` at 393 px | **1 rule before the fix**: `label-content-name-mismatch` (serious) on the brand link `<a aria-label="Narrow Gate Fitness home">` on `/login`, `/signup`, `/legal/*` (visible text computed as "Narrow GateFitness": two flex-stacked spans with no separator). **Fixed** bd69fab (`src/components/common/logo.tsx`); regression test `tests/unit/logo-link-name.test.tsx`. The signed-in sweep above ran on the rebuilt code (the app shell carries the same link) and is clean. |
| Tap targets | 8 signed-in + 5 signed-out screens; count of interactive elements under 44 × 44 and list under 24 × 24 | Under 24 px: only visually-hidden inputs (1 × 1 radio inputs on `/faith`, the skip link), a 20 × 20 checkbox inside a label (`/nutrition`, `/faith`), a 16 × 16 checkbox on `/coach`, and inline text links ("Full weekly insights" 113 × 15, "Memory" 47 × 16, "berean.bible" 73 × 15, "Forgot password?" 101 × 16, footer links 16 px tall). Under 44 px (Apple HIG): 8–10 per screen, 27 on `/nutrition` (meal rows' inline controls); none fail WCAG 2.2 AA (24 px) except inline links, which are exempt. |
| Text under 12 px | Same screens, computed font size of every visible text node | Bottom tab labels **11.8 px at 393 px wide** (`clamp(0.625rem,3vw,0.75rem)`: 10 px at 320 px, 12 px from 400 px; the `3vw` middle does not grow with the text-size setting); wordmark "Fitness" 10 px (`text-[0.625rem]`, part of the logo); welcome tagline 10.88 px below `md` (`src/app/page.tsx:61`). Static scan of `src`: 3 × `text-[0.625rem]`, 2 × `text-[0.68rem]`, 2 × `text-[0.65rem]`, no fixed-px sizes under 12 — everything else scales with the setting. |
| Gold-on-dark contrast | Computed from the tokens | gold 8.60:1 on background, 7.80:1 on card; gold-highlight 11.89 / 10.78; muted-foreground 9.31 / 8.44; **gold-muted 4.05:1 on background, 3.67:1 on card — fails AA for normal text (4.5), passes large text/UI (3.0)**; black on a gold button 8.60:1. axe's `color-contrast` rule found nothing on 56 screens, so gold-muted is not used for body text where axe could see it. |
| Focus visibility | `globals.css:231` global ring (11.9:1); 33 `outline-none` uses in `src` | Each `outline-none` inspected is paired with a `focus-visible:` replacement or `ring-*` (`body-figure.tsx:115`, `exercise-card.tsx:404`); `program-builder.tsx:436` is a `tabIndex=-1` heading. |
| Reduced motion | CSS media query + in-app setting; `celebration.tsx`, `demo-video.tsx`, `keyboard-avoidance.tsx` | Present and mirrored by the in-app toggle; `phone-sweep.spec.ts` exercises it (see e2e runs). |
| Large-text setting | `html[data-text-size]` scales `font-size` on `html`; applied before paint | Design sound; rem-based sizes scale (the tab labels' `3vw` middle term does not, see above). |
| Names of icon-only buttons | Browser: 0 unnamed buttons/links on all 13 screens. Static: every `<Button size="icon">` in `src` carries `aria-label`, `sr-only` text or `title` | Pass. |
| Horizontal overflow 320 / 360 / 375 / 393 / 430 px | 8 signed-in + 5 signed-out screens, `scrollWidth > innerWidth` | **None** at any width on any of the 13 screens. |

### Bugs found
1. **Brand link accessible-name mismatch on every signed-out screen and the app shell** (P2, axe serious; WCAG 2.5.3). Fixed bd69fab.
2. **Bottom tab labels render at 10–11.8 px on phones narrower than 400 px and do not follow the large-text setting** (P3):
   `app-shell.tsx:207`. Suggested `clamp(0.6875rem, 3vw, 0.75rem)` or a plain `text-xs`. Not changed (visual decision; the owner asked
   for no unnecessary visual changes).
3. **`--gold-muted` as text fails AA at body sizes** (P3) — keep it for borders/dividers only.
4. Welcome tagline 10.88 px below `md` (P3): `text-xs` as the `md:` variant already does.

### Browser-tested vs needs-physical-device
| Item | Browser (Chromium, production build) | Device |
| --- | --- | --- |
| axe on 56 screens, tap targets, small text, overflow at 5 widths | Tested | VoiceOver, Dynamic Type and iOS safe areas need an iPhone |
| Reduced motion, large text | e2e `phone-sweep.spec.ts` (see e2e runs) | iOS "Reduce Motion" needs an iPhone |

### Scores
- Functionality 8/10 — a11y foundations (focus ring, text scaling, motion, named icon buttons) in place; 0 axe violations on 56 screens after one fix.
- Reliability 8/10 — the whole signed-in surface was swept at phone size; only the tab-label size and gold-muted remain as notes.
- Accuracy 8/10 — contrast and markup findings are computed, not estimated.

### Launch blockers (ranked)
1. None hard. VoiceOver pass on a physical iPhone before App Store review.
2. Tab labels / gold-muted / tagline sizes (P3) at the owner's discretion.

---

## e2e runs (production build on :3104, no demo mode, AI mock 4787 / OFF mock 4788, helper fix ad4f373)
(appended below)

## Re-run after the two-tab fix
(appended below)

## Commands run and results (exact)
- `docker ps` → daemon down at the start; later `curl http://127.0.0.1:54321/rest/v1/` → 200.
- `npx tsc --noEmit -p .` → exit 0 (after every change).
- `npx vitest run --project integration tests/integration/free-user-direct-actions.test.ts` → 9 passed (after 94d723e).
- `npx vitest run --project integration` → 50 files passed, 1 skipped; 330 tests passed, 1 skipped; exit 0.
- `npx vitest run --project unit` → 167 files, 3249 tests passed (before `workout-two-tabs.test.ts` was added; re-run below).
- Targeted unit: 10 plan/billing/demo files → 156 passed; `logo-link-name.test.tsx` → 1 failed before the fix, 2 passed after;
  `workout-two-tabs.test.ts` + `workout-discard.test.ts` → 9 passed.
- `npx eslint` on every changed file → clean.
- `npx next build` → success (91 pages) three times (baseline, logo fix, two-tab fix); one pre-existing lint warning (`BookOpen` unused).
- `node scripts/ux/axe-sweep.mjs` (BASE :3104 demo) → 51 screens checked; 0 violating nodes in 0 rules.
- `node a7/measure.mjs` (5 signed-out routes) and `node a7/measure-demo.mjs` (8 signed-in routes) → tables above.
- `node a7/reliability-demo.mjs` → A PASS ×2, B PASS ×2, C PASS, D FAIL (before fix).
