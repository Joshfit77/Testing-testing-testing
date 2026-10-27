# Implementation status

> **Current production-readiness status, blockers and setup steps are in [`docs/PRODUCTION.md`](docs/PRODUCTION.md).**
> This file is the original 2026-10-16 build report. Since then: pricing is Free + Pro ($19.99/month, $149.99/year; Plus is
> legacy), App Store subscriptions use RevenueCat, the AI coach asks for explicit consent, rate limits are shared in Postgres,
> and the legal pages are complete drafts awaiting business details and counsel review.

_Last updated: 2026-10-16._

This file separates what was **verified in this environment** from what **needs external credentials or accounts** and what is **not done yet**.

## How it was verified

Verification ran against a full local Supabase stack (Postgres 17, GoTrue auth, PostgREST, Storage, Mailpit) started with `npx supabase start`:

- `npm run typecheck`: clean (strict TypeScript, `noUncheckedIndexedAccess`)
- `npm run lint`: clean
- `npm run build`: production build succeeds
- `npm run test:unit`: 151 tests for domain logic, catalog integrity, the program generator, badges, barcode parsing, devotional content, reminders and the program-builder UI
- `npm run test:integration`: 44 tests against the real database (including progress-photo, challenge, custom-program and barcode-food privacy rules). They cover RLS isolation, role escalation, entitlement tampering, admin privacy, consent enforcement, cascade on account deletion, workout drafts, idempotent finish, PR detection and recalculation, program advancement, Stripe webhook signature, idempotency and subscription lifecycle, and AI gating and quotas.
- `npm run test:e2e`: Playwright (mobile viewport) against `next start`. Covers sign-up, email confirmation via Mailpit, onboarding, the dashboard, starting a program session, logging sets, reload-restore, pause/resume, finishing with PRs, history, sign-out and sign-in, password-reset email, the under-18 block, free-plan gating (premium program, nutrition, AI, billing page), bodyweight and goals, the consent-gated recovery check-in, the faith opt-in and journal, logging a built-in food, the 40-day challenge check-in, and building a custom program.

## Feature checklist

| Area | Status | Notes |
| --- | --- | --- |
| Design system & shell (black/gold, sidebar, bottom nav + More, skeletons, empty/error states) | ✅ Done | Verified visually with screenshots. A gold progress bar shows during navigation. |
| Auth: sign-up, confirm, login/logout, reset, sessions, profile edit | ✅ Done & e2e-tested | Uses Supabase PKCE `/auth/callback` and token-hash `/auth/confirm`. |
| Data export & account deletion | ✅ Done | Deletion cascade is tested at the DB level. The deletion UI flow needs the service-role key. |
| Onboarding (adult-only, consent-gated limitations) + starter program | ✅ Done & e2e-tested | |
| Exercise library (95) & programs (18 across 16 categories) | ✅ Done | Integrity unit tests cover the catalog. |
| MMA / athletic templates, mobility & recovery | ✅ Done | Two session-library programs and a recovery page. |
| Workout logger (all listed features) + restore | ✅ Done & tested | Unit, integration and e2e. |
| History edit/delete, PRs, volume, frequency | ✅ Done & integration-tested | |
| Dashboard | ✅ Done | |
| Progress analytics (7d/30d/90d/1y) | ✅ Done | Advanced charts are gated server-side to Plus and Pro. |
| Food log (nutrition) | ✅ Done & e2e-tested | A main "Food" tab. Search works out of the box on 94 built-in common foods (typical values, labeled as estimates); logging a serving is e2e-tested. **USDA search additionally needs `USDA_FDC_API_KEY`** and wasn't exercised live here. |
| AI coach (chat, plan generation, approval, metering, rate limits, fallback) | ✅ Implemented; gating/quotas integration-tested | **Live model calls need `ANTHROPIC_API_KEY`**. No real completions were made in this environment. Prompt quality should be evaluated with real usage. |
| Optional Faith & Discipline | ✅ Done & e2e-tested | |
| Pricing: Plus $9.99/mo, Pro $30/mo, All Access Yearly $200/yr (grants Pro) | ✅ Done; yearly price → Pro mapping integration-tested | Needs `STRIPE_PRICE_PRO_YEARLY`; without it the yearly card says it isn't configured. |
| Stripe checkout, portal, webhooks, entitlements | ✅ Implemented; webhook & entitlement logic integration-tested with signed synthetic events | **Checkout and the Billing Portal need real Stripe keys and prices.** They weren't run end to end against Stripe here. |
| Admin (catalog, media, categories, content, flags, subscriptions, metrics, audit) | ✅ Done | Admin RLS and privacy are integration-tested. The admin UI was verified by typecheck and build only. |
| Installable PWA | ✅ Done | Manifest, icons, service worker and offline page. |
| iOS & Android shells (Capacitor 8) | ✅ Projects generated and synced, icons/splash generated | **Not compiled here**: Android SDK downloads are blocked in this environment, and iOS needs macOS/Xcode. Build steps are in SETUP.md. |
| API boundary for native clients | ✅ `/api/v1/me`, `/programs`, `/workouts`, `/api/ai/chat` with Bearer auth | |
| Welcome page, sex in onboarding, 13 diet styles | ✅ Done & e2e-tested | Calorie targets use Mifflin-St Jeor when sex, age and height are known. Diet guidance is general education with safety notes. |
| Build my program (12 types) | ✅ Done & e2e-tested | Generated plans are unit-tested for every type and experience level. Coaching content is general guidance; show prep defers nutrition and peak week to a qualified coach. |
| Progress photos | ✅ Done & integration-tested (privacy) | Photo upload has not been tested on a real phone camera. |
| Badges | ✅ Done | 24 badges computed from existing data. |
| 40-day devotional challenge | ✅ Done & e2e-tested | **Every KJV verse needs a word-for-word check against an authoritative text before launch.** |
| Workout reminders | ✅ Built, unit-tested | **Not tested on a device.** Works only in the iPhone/Android app. |
| Barcode scanner | ✅ Built, unit-tested | **Not tested with a real camera.** Open Food Facts couldn't be reached from this environment; parsing follows its documented format. |
| Exercise video tools | ✅ Built | Admin upload, prompt sheet (`docs/exercise-video-prompts.md`) and bulk import (`npm run videos:import`). Not run against a hosted Supabase project. |
| Legal pages | ⚠️ Placeholders | Clearly marked **for legal review**. |

## Known limitations & decisions

1. **Store billing.** Apple and Google generally require in-app purchase for digital subscriptions bought in-app. The native shells hide Stripe checkout (they're detected via the user-agent token `NarrowGateApp`). **Next step:** integrate RevenueCat (or StoreKit 2 and Play Billing directly). Add a server webhook that writes `subscriptions` and `user_entitlements` with a `source` of `apple` or `google`. Extend the `user_entitlements.source` check constraint accordingly.
2. **Loading boundaries.** Next 15.5 aborted same-route re-renders after server actions when a route-level `loading.tsx` Suspense boundary was present (reproduced: about 40–90% failure). Skeleton `loading.tsx` files are therefore only on read-only routes. Mutation-heavy routes rely on the global navigation progress bar. One-click mutations use `ActionButton` (action + `router.refresh()`).
3. **Burst rate limiting** for AI and food search is in-memory per server instance. Monthly AI quotas are durable (database). For multi-instance production, consider a shared store (e.g. Upstash Redis) for burst limits.
4. **Scripture text** is KJV (public domain outside the UK) and was entered from a well-known text. Verify every verse against an authoritative KJV source before publication.
5. **Exercise videos.** No videos are bundled (we don't own any). Every exercise page has a "Watch form videos" button that opens a YouTube search, and admins can attach a YouTube, Vimeo or direct video link per exercise, which plays inside the app (privacy-enhanced YouTube embed). A license/permission confirmation is required.
6. **Nutrition estimates** are deliberately simple (bodyweight-based) and always labeled as estimates. There is no sex/age-based BMR, by design (minimal data collection).
7. **Offline.** An in-progress workout keeps working offline once the logger page is open, and it syncs when you reconnect. Other pages need a connection (offline page shown).
8. **Admin program editing** covers metadata, publishing, tier and per-exercise prescriptions. Adding or removing weeks, days or exercises in curated programs is done through `src/data/programs.ts` plus `npm run seed:generate`.
9. **Conversation history in the AI coach** shows as a sidebar on large screens. On mobile, users start new chats or reopen one from a link; a mobile history drawer is a small follow-up.

## Next steps (in priority order)

1. Add real credentials in a staging environment. Run Stripe test-mode checkout, portal and cancellation end to end, plus a live AI chat and plan generation, then review AI output quality and safety.
2. Integrate store billing (RevenueCat) for the iOS and Android apps. Then enable in-app upgrades in the native shells.
3. Build and run the native apps on devices. Verify local notifications, haptics and the splash screen. Add push notifications (workout reminders) and optionally HealthKit / Health Connect to strengthen App Store review (Guideline 4.2).
4. Have counsel complete the privacy policy and terms. Fill in the App Store privacy labels and the Play Data safety form.
5. Add Universal Links / App Links so email confirmation and reset links open the app.
6. Add a shared rate-limit store and production error monitoring (e.g. Sentry with PII scrubbing).
7. Add a mobile conversation-history drawer to the AI coach, and expand admin program structure editing.
