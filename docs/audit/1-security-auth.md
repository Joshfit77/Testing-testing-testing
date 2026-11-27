# Audit 1: accounts, authentication, authorization, security and privacy

Audited code: commit `fc8d113` (the main checkout's `claude/exercise-demo-25d` HEAD, 42 migrations). The audit branch
`worktree-agent-a391984a038ab027d` was moved from `aad49a1` (8 migrations, far behind) to `fc8d113` before any work,
so every commit below sits on top of `fc8d113`.

How it was checked: by reading the code, against the local Supabase stack (Postgres, GoTrue, Storage, PostgREST and
the Mailpit mail catcher, with all 42 migrations applied), and with new tests that act as members through the public
API (anon key plus each member's own session). Nothing ran against production. No physical device was used. The
demo server on port 3000 was not running during the audit, so no browser exploration was done. The local Docker
daemon had stopped (twice); I restarted `containerd`/`dockerd` and the existing containers came back. The database
was not reset or altered.

## 1. Findings

| Feature | Status | Verified problem | Fix performed | Remaining blocker |
|---|---|---|---|---|
| Password reset (web and iPhone app) | FIXED | P1. Reset emails use Supabase's default PKCE link. It works only in the browser that requested it, so a reset requested in the iPhone app's WebView fails once Mail opens the link in Safari. The member then lands on "Your link was processed. Please sign in" and cannot set a password. Shown against real GoTrue + Mailpit (`tests/integration/auth-email-links.test.ts`). | `e4bf019`: token-hash templates (`supabase/templates/recovery.html`, `confirmation.html`) pointing at `/auth/confirm`, which verifies in any browser; `/auth/callback` sends a failed reset to `/reset-password` ("opened in a different browser, request a new link"). | The hosted Supabase project must get the same templates (dashboard → Authentication → Email Templates, or `supabase config push`). The local stack loads them only after a restart, which I did not do. |
| Change password (Profile) | FIXED | "Change password" on Profile links to `/forgot-password`, i.e. the same email reset, so it hit the defect above in the iPhone app. | `e4bf019` (same fix) | Same as above |
| Sign-up email confirmation | FIXED | Same PKCE link. The address *is* confirmed by GoTrue, but the session is lost in Safari. Not data-losing; the member signs in again. | `e4bf019`: confirmation template links to `/auth/confirm?type=email`. Integration test confirms a PKCE sign-up through the real route. | Hosted templates; production SMTP (row below) |
| Sign-up | PASS | Server-side rules verified: GoTrue rejects a weak password (`422 weak_password`, probed with curl). The app schema requires 8+ characters with a letter and a digit, plus unticked 18+/terms/risk boxes (`src/lib/validation/schemas.ts:24-38`). Acceptances are recorded by a DB trigger (`legal-acceptances.test.ts` passes). | — | Production dashboard must match `config.toml` (password policy, secure password change, leaked-password protection). |
| Sign-up account enumeration | FAILED (P3) | GoTrue answers `422 user_already_exists` for a registered address even with `GOTRUE_MAILER_AUTOCONFIRM=false` (curl, local v2.197). The app shows "We couldn't create your account" instead of the "check your inbox" message. Anyone can call GoTrue's public `/auth/v1/signup` with the public anon key, so app-side masking would not help. | none (platform behaviour) | Optional: Supabase captcha on auth endpoints; a friendlier "already have an account? Sign in" message. |
| Sign-in | PASS | Wrong password and unknown email give identical GoTrue responses (`400 invalid_credentials`); the app shows one generic message (`src/server/actions/auth.ts:51`). Post-login redirects are same-site only (`safeNextPath`, existing tests). Sessions are validated with `auth.getUser()` in middleware and on the server. | — | — |
| Sign-in page messages | FIXED | P3 content injection: `/login?error=<any text>` and `?notice=` were rendered verbatim (200 chars). `/auth/callback` also forwarded the provider's `error_description` text. A crafted link could put e.g. "Your account is locked, call …" on the real sign-in page. | `e4bf019`: routes pass codes; the page shows only fixed messages (`src/lib/auth-messages.ts`). | — |
| Sign-out | PASS | `signOutAction` → `auth.signOut()` (default scope global: revokes the refresh token on every device). Device drafts and GPS recordings are cleared (existing `device-cleanup` / `drafts` tests). The access JWT stays valid for up to 1 h (`jwt_expiry = 3600`), but its rows are still RLS-scoped. | — | Product choice: signing out on the web also signs the phone out. |
| Session persistence (web and Capacitor WebView) | NOT TESTED | Code only. `@supabase/ssr` cookies are `path=/`, `SameSite=Lax`, `Max-Age` 400 days, `httpOnly=false` (library default, so an XSS could read tokens; the two inline scripts are static constants, `src/app/layout.tsx:58-60`). Middleware refreshes the session on every request. The WebView loads the site itself, so cookies are first-party. | — | Needs a physical iPhone: kill and relaunch the app, check the member stays signed in; check after 1 h (token refresh). |
| Account deletion | PASS | Verified live: a member with a row in all 61 user-owned tables and a file in all 3 private buckets is deleted. Every row, every file and the auth user are gone, an old session no longer resolves, and the other member's row counts are unchanged (`cross-user-isolation.test.ts`, last test). Needs DELETE + password (5 tries per 15 min). The deletion form is shown in the native app too (App Store 5.1.1(v)). | `f1d3ae7` (test only) | — |
| Data export | PASS | Verified live: the export has the member's rows from all 61 tables, signed download links for progress-photo and body-scan files, and nothing of anyone else's. Pointing the export at another member's id with your own session returns nothing. 3 per hour per member. | `f1d3ae7` (test only) | iPhone: whether WKWebView saves the `Content-Disposition: attachment` JSON download is NOT TESTED (needs device). |
| Data isolation (RLS), all tables | PASS | Live catalog: RLS on 73/73 public tables, 244 public + 13 storage policies (all dumped). Sweep with two members + admin + anonymous over all 61 user-owned tables (workouts, meals, photos, sleep/health, GPS routes, progress, badges/challenges, AI, journal, profile, billing). No reads, updates, deletes, spoofed inserts or child rows attached to another member's parent, and every refusal is RLS (`42501`). A negative control with an RLS-bypassing client confirmed the probes do detect access. | `6dc4be5`, `5dd8920` (test) | — |
| Admin access to personal data | PASS | An admin sees no member's personal rows in any of the 61 tables (only `training_programs`, the shared catalog). The only service-role admin read is subscription status + display name (`admin/subscriptions/page.tsx`). | — | — |
| Privileged database functions | PASS | `plan_of`, `reserve_ai_usage`, `record_signup_acceptances` and `admin_usage_metrics` are refused to members/anon (sweep). Helper definers such as `can_view_program`/`program_of_week` stay executable by anon but only answer for a given uuid (negligible oracle). Every definer pins `search_path` (existing `rls-coverage` test). | — | — |
| API routes (`src/app/api/**`, 11 routes) | PASS | Every route takes the user from the cookie session or a bearer token validated by GoTrue (`src/server/api-auth.ts`), never from the body. Cookie POSTs must be same-origin. The Stripe webhook verifies its signature on the raw body. The RevenueCat webhook compares its token with `timingSafeEqual`. Errors are generic. | — | — |
| AI routes over bearer token (native API) | FIXED | P3, fail-closed. `/api/ai/chat` and `/api/ai/food-photo` read the plan with the cookie client even for bearer requests, so every paying member got `403 not_entitled` over the documented native API (reproduced). | `097429b`: `getPlanWith(auth.supabase, …)` | — |
| Server actions (41 files) | PASS | Script over every exported action: each authenticates via `requireUser`/`requireAdmin`/`requireOnboardedUser` directly or through a helper (`nutritionCtx`, `sleepCtx`, `stepsCtx`, `requireFaithUser`, `parse`, `loadAccessibleProgram`). Public auth actions are by design. Every service-role write is keyed by the session user's id (`ai-coach.ts`, `ai-meal-plan.ts:115`, `store-billing.ts`, `profile.ts:107`, `demo.ts`, `admin.ts` audit log). | — | — |
| Storage buckets | PASS | `avatars` (2 MB), `progress-photos` (8 MB) and `body-scans` (8 MB) are private, with per-`<uid>/` folder policies; `exercise-media` is public read, admin write. Verified live: another member cannot list, sign, download, overwrite, plant or delete files; anon cannot sign. Uploads of HTML, SVG or oversize files are refused. Signed URLs last 600 s (pages) / 1 h (export). | `f1d3ae7` (test) | No per-member object-count cap (known); only the declared content type is checked. |
| Secrets in the repository | PASS | Tracked files and the whole history of all branches searched (`git log --all -p -S` for `sk_live_`, `rk_live_`, `sk-ant-api`, `whsec_`, `AKIA`, `PRIVATE KEY-----`, service-role assignments, demo password). The only matches are placeholders and the Supabase CLI's public local-stack JWTs (`iss: supabase-demo`, in `tests/integration/setup.ts`, `e2e/helpers.ts`). No `.env`/key files were ever committed besides `.env.example`. `NEXT_PUBLIC_*` = URL, anon key and site URL only. Nothing in `capacitor.config.ts`, `ios/` or `android/`. CI uses `secrets.*`; the demo workflow passes the service-role key only as runtime env. | — | — |
| AI metering and quota | PASS | Over-quota is refused server-side at both layers: in the DB (`reserve_ai_usage` under a per-member lock, existing tests) and over HTTP (new: a Pro member at 150/150 gets `429 quota`, nothing saved or counted; a member within the allowance passes every check and a failed provider call is given back; Free gets `403`). | `097429b` (test) | — |
| AI cost caps | PARTIAL | Requests are capped (150/month Pro, 15 larger-model, 20 meal photos/24 h, 6/min). Output per chat request is bounded at 6 tool rounds × 12,000 tokens (`src/lib/coach/prompt.ts:20-25`). There is no monthly token ceiling (known, `docs/SECURITY.md`). | — | Owner: set a monthly spend limit on the Anthropic key. |
| Prompt injection | PARTIAL (P3) | The member's own text (shared journal excerpts, memories, workout/meal names) is placed in the system prompt with no "data, not instructions" guard; tool results do have one (`src/lib/coach/knowledge.ts:193`). Single-tenant context: a member can only steer their own coach. Proposals need Confirm and are re-validated; tools are read-only. | — | Optional hardening: delimit user-written fields. |
| Sensitive data in logs | PASS | `logError` writes name/code/message (≤300 chars) and ids only (`src/server/log.ts`); no request bodies, tokens or health data. Two client `console.error` calls (an error digest, and a 3D demo component outside this area). | — | — |
| Rate limiting on auth-adjacent endpoints | NOT TESTED (P2 risk) | Sign-in, sign-up and reset run as server actions, so GoTrue sees the app server's IP for every member. Its per-IP limits (e.g. 30 sign-ins / 5 min) therefore act as one bucket shared by all members, which an attacker could exhaust (login DoS). Not exercised: it would have exhausted the shared local stack's limits for other auditors, and the hosted gateway's IP handling can't be seen here. In-app limits are in-memory per instance (export, deletion password, food search, barcode); AI is DB-backed. | — | Check on the hosted project; options: Supabase captcha, or sign in from the browser client. |
| Privacy Policy reachable in-app | FIXED | P2. A signed-in member had no link to the Privacy Policy or Terms except paywall footers. In the iPhone app the store paywall renders only when a RevenueCat key is set, so there was none (App Store 5.1.1(i)). | `4a7473c`: Profile → Privacy & data → Legal (uses `LEGAL_*_URL` once set) | — |
| Privacy Policy content | BLOCKED | The draft (`src/app/legal/privacy/page.tsx`) lists what the code collects: GPS routes, Apple Health steps/sleep/vitals, photos (stored) and meal photos (sent to AI, not stored), AI data flows, faith journal, processors. It is a placeholder marked "requires legal review". | — | Counsel-reviewed final documents and `LEGAL_TERMS_URL`/`LEGAL_PRIVACY_URL`. |
| iOS Info.plist usage strings | PASS | Present for every permission used: camera (barcode, meal/progress/scan photos), HealthKit share and update, location when-in-use and always, background mode `location`. HealthKit entitlement is present. No photo-library string is needed (the WebView file picker uses PHPicker; no plugin calls photo-library APIs, checked by grep). Default ATS (no arbitrary loads). | — | — |
| iOS PrivacyInfo.xcprivacy | PARTIAL | Declares email, name, fitness, health, other user content, purchases, user ID, precise location, photos; tracking false; UserDefaults `CA92.1`. It does not declare Sensitive Info, although the opt-in faith section and prayer journal reveal religious beliefs (one of Apple's Sensitive Info examples). | — | Owner/counsel decision; mirror it in App Store Connect's privacy answers. |
| Auth email delivery in production | BLOCKED | `[auth.email.smtp]` is commented out; Supabase's built-in sender is rate-limited and meant for testing, so testers' confirmation and reset emails may not arrive. | `e4bf019` (SETUP.md note) | Owner: custom SMTP on the hosted project. |

## 2. Confirmed defects

### D1 (P1): password reset and change impossible from the iPhone app; cross-browser email links broken

- **Files.** `src/app/auth/callback/route.ts`, `src/server/actions/auth.ts:79-88`, `supabase/config.toml` (no templates), `SETUP.md` step 5.
- **Root cause.** `@supabase/ssr` starts PKCE flows. `resetPasswordForEmail` stores the code verifier as a cookie in the requesting browser. The default email links to GoTrue `/verify` → `/auth/callback?code=…`, and `exchangeCodeForSession` needs that verifier. The iOS app has no universal links or URL scheme (`App.entitlements`, `Info.plist`), so Mail opens the link in Safari, which has no verifier.
- **Evidence.** `tests/integration/auth-email-links.test.ts`, case 1, against real GoTrue + Mailpit:
  - The verifier is stored in the requesting jar.
  - `/verify` redirects to `/auth/callback?code=…`.
  - The exchange in a fresh jar returns an error with no session.
  - The original jar succeeds.
  - On failure, the old callback redirected to `/login?notice=Your link was processed. Please sign in`.
- **Fix.** `e4bf019`:
  - Token-hash templates pointing at `/auth/confirm`.
  - The callback sends a failed reset to `/reset-password`.
  - SETUP.md step 5 corrected (it called this optional and said the default link works).
- **Regression tests.**
  - `auth-email-links.test.ts` cases 2-5: the app-initiated `pkce_…` token hash verifies in a fresh browser; the real `/auth/confirm` route signs a fresh browser in and lands on `/reset-password`; a PKCE sign-up is confirmed with `type=email`.
  - `tests/unit/auth-email-templates.test.ts`.
  - `tests/unit/auth-link-routes.test.ts`: 3 of its 5 tests fail on the old code.

### D2 (P2): no in-app route to the Privacy Policy for signed-in members

- **Files.** `src/app/(app)/profile/page.tsx`, `src/app/page.tsx:37` (redirects signed-in members), `src/app/(app)/profile/billing/page.tsx:169-193`.
- **Fix.** `4a7473c`: new `src/components/profile/legal-links.tsx`.
- **Regression test.** `tests/unit/profile-legal-links.test.tsx` renders the real page; both tests fail on the old page.

### D3 (P3): AI routes treated bearer-token Pro members as Free

- **Files.** `src/app/api/ai/chat/route.ts:37`, `src/app/api/ai/food-photo/route.ts:40`, `src/server/auth.ts`.
- **Evidence.** A Pro member over bearer got `403 not_entitled` from both routes (first run of `tests/integration/ai-route-limits.test.ts`).
- **Fix.** `097429b`.
- **Regression test.** `ai-route-limits.test.ts` (5 cases, including the over-quota `429` and a within-allowance positive control).

### D4 (P3): text injection on the sign-in page

- **Files.** `src/app/(auth)/login/page.tsx`, `src/app/auth/callback/route.ts:13`, `src/app/auth/confirm/route.ts:20`.
- **Fix.** `e4bf019`.
- **Regression test.** `auth-link-routes.test.ts`: crafted text, `__proto__`, `constructor` and arrays all show nothing.

### D5 (P3, remains): GoTrue reveals registered addresses at sign-up

- **Evidence.** curl `POST /auth/v1/signup` with the demo account's address returns `422 user_already_exists`; `GOTRUE_MAILER_AUTOCONFIRM=false` (from `docker inspect`).
- **Status.** Not fixable in the app: the endpoint is public.

### D6 (doc): `SETUP.md` step 5 was wrong

- It said the token-hash templates were optional and the default flow works. Fixed in `e4bf019`.

### Stale statements in earlier docs (not edited)

- `docs/SECURITY.md`:
  - AI coach is "Plus/Pro only": it is Pro only, plus legacy Plus terms.
  - Storage lists `avatars` and `progress-photos` only: `body-scans` is missing.
  - "Apple and Google in-app subscriptions don't exist yet": RevenueCat billing exists.
- `docs/launch-audit/SECURITY_PRIVACY.md` says "72 tables": there are 73 now.
- `tests/integration/account-deletion.test.ts` seeds only a few tables, so most of its per-table checks had nothing to delete. The new sweep covers all 61 tables.

## 3. Counts

- **Confirmed defects: 6** (D1–D6).
- **Repaired: 5** (D1, D2, D3, D4, D6), each with a regression test, or a doc correction for D6.
- **Remaining confirmed: 1** (D5, P3, platform).
- **Open risks and decisions (not confirmed defects):** auth rate limits behind the server IP (P2, not tested), Sensitive Info in the privacy manifest, prompt-injection hardening, monthly token ceiling.

**Tests run at the end:**
- Unit: 118 files, 2,709 tests passed.
- Integration: 35 files passed, 1 skipped (network-only `food-quality-live`), 209 tests.
- `tsc --noEmit` clean; ESLint clean on all changed files.

**New tests:**
- `tests/integration/cross-user-isolation.test.ts` (13)
- `tests/integration/auth-email-links.test.ts` (5)
- `tests/integration/ai-route-limits.test.ts` (5)
- `tests/unit/auth-email-templates.test.ts` (4)
- `tests/unit/auth-link-routes.test.ts` (5)
- `tests/unit/profile-legal-links.test.tsx` (2)

## 4. Launch blockers for a physical-iPhone beta or App Store submission

1. **Apply `supabase/templates/confirmation.html` and `recovery.html` to the hosted project.** Without them, password reset and "Change password" from the iPhone app still fail (D1), whatever the code says.
2. **Custom SMTP on the hosted project.** The built-in sender won't reliably deliver testers' confirmation and reset emails.
3. **Final Privacy Policy and Terms.** Both are placeholders marked "requires legal review". App Store Connect needs a real privacy policy URL; set `LEGAL_PRIVACY_URL`/`LEGAL_TERMS_URL`.
4. **App Store privacy answers.** They must match `PrivacyInfo.xcprivacy`, including the open Sensitive Info decision for faith data.
5. **Hosted dashboard auth settings.** Site URL = the https app address and redirect allow-list; minimum password 8 with letters and digits; secure password change; leaked-password protection; consider captcha.
6. **Anthropic spend limit** on the production key: there is no monthly token ceiling in code.

## 5. Could not verify, and what it would take

- **Physical iPhone** (none available):
  - session survives app kill/relaunch and the 1 h token refresh;
  - a reset link from Mail opens Safari and completes there (inferred from the missing associated domains);
  - HealthKit and location permission prompts show the plist strings;
  - the JSON export downloads in WKWebView.
- **Hosted Supabase:**
  - email templates and SMTP;
  - how the API gateway attributes client IPs for the per-IP auth limits;
  - dashboard password/leaked-password settings.

  Needs dashboard access to the production project.
- **The new templates as rendered by the local GoTrue.** Needs `supabase stop && supabase start`, which the brief forbids. The template text is unit-tested, and the token-hash flow is integration-tested with real token hashes.
- **Login rate limiting under load.** Would exhaust the shared local stack's limits for other auditors; test on a disposable project.
- **Privacy manifests of the third-party pods** (RevenueCat `PurchasesHybridCommon`, `OSBarcodeLib`). Needs `pod install` with network.
