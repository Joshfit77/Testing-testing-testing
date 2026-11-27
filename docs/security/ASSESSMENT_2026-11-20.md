# Security assessment: baseline, 2026-11-20 (updated the same day)

Branch `claude/rc-testflight-1`. First pass of the owner's security programme (OWASP ASVS / MASVS / API Top 10 as the
reference). **This is not a penetration test and does not claim the app is secure.** Automated tests prove only the
cases they test; code reviews find only what the reviewers looked at.

**Method:** the repository's own automated suites (unit, integration against a real local Supabase, browser);
two independent read-only code reviews (authentication and sessions; member isolation, sensitive data and billing);
queries against the live local database catalog; `npm audit`; gitleaks over every branch and its full history.

## 1. What the app holds (most sensitive first)

| Data | Where | Who can reach it |
|---|---|---|
| Prayer-journal entries | `faith_journal_entries` | The member only (RLS). To the AI provider only with the separate journal permission (migration 080). |
| Apple Health data: sleep, heart rate, HRV, breathing, steps | `sleep_sessions`, `sleep_stages`, `sleep_import_runs`, `daily_steps` | The member only. To the AI provider only with the separate health permission (migration 079). |
| Progress photos, body scans | private buckets `progress-photos`, `body-scans` | The member only (first folder of the path must be their id). Signed viewing links last 10 minutes (the member's own data-export links, 1 hour). |
| Body measurements, weight, nutrition, workouts, goals | member tables | The member only. |
| AI conversations; coaching memories (sealed at rest) | `ai_*` tables | The member only. |
| Subscription state | `user_entitlements`, billing tables | Read: the member. Write: service role only. |
| Payment card or bank data | **Not held.** Web: Stripe Checkout (hosted). iOS: Apple in-app purchase via RevenueCat. No card number, CVV or bank detail reaches the app or its database. |

## 2. Threat model (what we defend against, and what's left)

| Threat | Main control | Left open |
|---|---|---|
| One member reading or changing another's data | RLS on every table and bucket; server checks `auth.uid()` | F-19 (admins can read private programs) |
| Account takeover (stuffing, reset abuse, stolen link) | Supabase Auth, email confirmation, rate limits, no enumeration | F-7 (until CAPTCHA is switched on), F-13 (Supabase setting); admin two-step (F-8), reset-link-only passwords (F-9), link swap (F-10) and 30-day sessions (F-14) fixed |
| Free member getting paid features | Entitlement decided in the database and server only | F-17 fixed; device tampering untested (needs the signed iOS build) |
| Forged, replayed or out-of-order payment events | Stripe signature + mode check; RevenueCat secret + provider re-read; each event once | F-21, F-23, F-24 (settings; F-20 fixed); never run against real sandboxes yet |
| Health or journal data leaving the app | Separate consent per category before any AI call; no third-party analytics | F-25 (ids in logs) |
| Prompt injection through member text | Member and third-party text passed as inert data; tools scoped to the member | Not yet tried against the live model (no key) |
| AI cost runaway | Per-member, daily and monthly limits; kill switches fail closed; **no AI key on staging** | Real per-member cost not yet measured |
| Credential leak or CI compromise | gitleaks on every branch; actions pinned to commits; signing secrets only in the manual TestFlight job | F-1 (public repository) |
| Lost unfinished workout | Device copy on every change; revisioned server backup per set; copies from two devices combined; every unfinished workout kept; never cleared without confirmation | Not yet on a real iPhone (§5) |

## 3. Verified protections (with evidence)

| Protection | Evidence |
|---|---|
| Row-level security on **every** public table (108) | `tests/integration/database-security-catalog.test.ts` (live catalog; fails on an injected table without RLS) |
| No view can read past RLS; every security-definer function (65) pins its search_path | same test |
| Signed-out visitors reach only the public catalog, read-only | same test (fails on an injected visitor write policy) |
| Members' photos and scans in private buckets; only `exercise-media` is public | same test; `cross-user-isolation.test.ts` (list/read/sign/replace/delete another member's files refused) |
| One member can't read, change or delete another's rows (every user-owned table in the sweep), including every level of a private training program | `cross-user-isolation.test.ts` (15), `rls.test.ts` (11), `private-program-isolation.test.ts` (5) |
| Admins can't read members' health or journal data | `rls.test.ts`, `cross-user-isolation.test.ts` |
| A member can't make themselves admin or grant themselves a plan | `rls.test.ts`, `pro-bypass.test.ts`, `billing-integrity.test.ts`, `account-security.test.ts` |
| Service-only database functions refuse members and visitors; the callable list equals the reviewed list | `api-function-surface.test.ts` |
| Pro checked in the database and server, never the client | `pro-bypass.test.ts` (7), `free-user-direct-actions.test.ts` (9), `plan-enforcement.test.ts` (6) |
| Stripe webhook: signature on the raw body, size cap, each event once, out-of-order safe, metadata can't move a subscription, **mode (test/live) must match the key** | `billing-integrity.test.ts` (16), `entitlements.test.ts` (14), `subscription-closure.test.ts` (17) |
| RevenueCat webhook: constant-time secret, each event once, provider re-read (body never trusted), sandbox purchases need the allow-list, replay grants nothing | `store-billing.test.ts` (21), `subscription-closure.test.ts`, `billing-integrity.test.ts` |
| Refunds, disputes, expiry and past-due caps end access | `entitlements.test.ts`, `subscription-lifecycle.test.ts`, `subscription-closure.test.ts` |
| AI sees member data only with consent; health and journal need their own permission | `ai-consent.test.ts`, `journal-ai-consent.test.ts`, `health-ai-sharing.test.ts`, `ai-access.test.ts` |
| Member and third-party text passed to the AI as inert data | `tests/unit/prompt-injection-hardening.test.ts` (18) |
| With no AI key (first TestFlight build), no AI request leaves the server and the app says the coach isn't configured | `ai-off-no-requests.test.ts`, e2e `coach.spec.ts` ("says honestly…") |
| A new password only from a recent reset-email link; admins see only the shared program library | `password-reset-session.test.ts`, `private-program-isolation.test.ts` |
| AI spending: per-member, daily and monthly limits, per-request ceiling, kill switches fail closed | M0 suites (`ai-daily-budget`, `ai-kill-switch`, `coach-scenarios`) |
| No open redirect after sign-in or email links | `security-headers.test.ts`, `auth-link-routes.test.ts` |
| Same reply for existing and unknown emails (sign-up, reset, resend, including Supabase's throttle) | `duplicate-signup.test.ts`, `auth-no-enumeration.test.ts` |
| Login and email limits per address and per email; email-link routes limited per address | `auth-rate-limit-keys.test.ts`, `auth-link-routes.test.ts` |
| Signing out ends every session on every device (refresh token dead) | `account-security.test.ts` |
| CSP with a per-request nonce and `strict-dynamic`, no inline script; frame-ancestors none; nosniff; HSTS on https | `security-headers.test.ts`, `e2e/csp-and-layout.spec.ts` ("injected script doesn't run") |
| No server secret in any client file or `NEXT_PUBLIC_` variable | code review (all `NEXT_PUBLIC_` variables listed: Supabase URL and anon key, site URL, error-reporting flag, map tiles) |
| Account deletion removes rows, files, Stripe and RevenueCat customers; what remains is documented | `account-deletion*.test.ts` |
| Dependencies: 0 known vulnerabilities | `npm audit` 2026-11-20 after upgrades |
| No credential in the repository's history | gitleaks, all 41 branches, 0 findings (four reviewed exact-value exceptions) |
| Unfinished workouts never silently deleted, and a backup that failed, timed out or is still pending is never shown as saved (sign-out, timeout, crash, offline, sign-in expiry) | `sign-out-workout` (unit 9, e2e 2), `workout-backup-timeout`, `workout-save-status`, `workout-signed-out`, reliability suites. **Not yet on an iPhone.** Limits: F-29, F-30 |

## 4. Findings register

Severity: critical / high / medium / low / info. "Blocks" = the first release stage that must not start while open.

| ID | Finding | Severity | Component | Status | Evidence | Blocks |
|---|---|---|---|---|---|---|
| F-1 | Repository is **public**: source, 41 branches of history, legal audits, trademark notes, counsel questions, patent claim charts. No credential found in it. | High (IP) | GitHub | **Open: owner decision**; prepared in `MAKE_REPOSITORY_PRIVATE.md` (access, Actions cost, Vercel) | `visibility: public` | Patent strategy; not TestFlight |
| F-2 | Sign-out deleted an unsaved workout | High (data loss) | App | **Fixed** 8ec239f9 | unit + e2e | — |
| F-3 | Build tools: tar (critical), sharp/libvips, @capacitor/cli, @capacitor/assets (high) | Medium (dev/CI only) | Tooling | **Fixed** 5c5b01cd | `npm audit` 16 → 0 | — |
| F-4 | next 15.5.28: HttpOnly cookie exposure on Edge routes, SVG bypass, response injection | Moderate | App | **Fixed** (15.5.29) | `npm audit` | — |
| F-5 | A hung backup blocked later backups | Medium | App | **Fixed** c32b0a67 | unit | — |
| F-6 | Security scan failed on four harmless values | Info | CI | **Resolved** 9bfe9d73 | gitleaks 12 → 0 | — |
| F-7 | No CAPTCHA; the app's login/sign-up limits can be skipped by calling Supabase Auth directly with the public anon key (credential stuffing, sign-up and reset spam) | Medium | Auth | **Prepared** 5a856ae6 (Turnstile check on sign-up, sign-in and email requests; token passed to Supabase). **Open until switched on** in Supabase and Vercel (guide step 11) | `auth-captcha.test.ts` | **External beta** (switch it on). Internal build: sign-ups off in Supabase |
| F-8 | Admin accounts use a password only (no two-factor; no AAL2 check) | Medium | Auth/admin | **Fixed** 3ecfd0e3: admin tools and the database's is_admin() require a session verified with an authenticator code (aal2); recovery in ADMIN_MFA.md | `admin-mfa.test.ts` (real auth server), `require-admin-mfa.test.ts`, e2e `admin-mfa.spec.ts` | — (owner: enable TOTP in Supabase, approve the recovery procedure) |
| F-9 | Password could be changed from any signed-in session (an unlocked phone) without the reset email | Low–medium | Auth | **Fixed** 042c2bea: only a session opened by a reset-email link in the last 30 minutes can set a password. Residual: a direct auth-API call with a stolen token is governed by Supabase's "Secure password change" (guide step 11) | `password-reset-session.test.ts`, e2e `core-flow.spec.ts` | — |
| F-10 | An email link (sign-up or reset) opened by someone else signs them into the sender's account (session swap) | Low–medium | Auth | **Fixed** 1d1b2578: a link for another account never replaces the session already signed in; Secure cookies | `auth-link-routes.test.ts` | — (residual: someone signed out who opens a stranger's link is signed into that account, as with any email link) |
| F-11 | Reset / resend replies revealed registered addresses through Supabase's 429 | Low–medium | Auth | **Fixed** 56750e30 | `auth-no-enumeration.test.ts` | — |
| F-12 | Email-link routes had no rate limit; token guessing could use up Supabase's per-address limit for everyone | Low–medium | Auth | **Fixed** 3b73747e | `auth-link-routes.test.ts` | — |
| F-13 | Email codes are 6 digits valid for 1 hour (hosted setting) | Low | Supabase config | Open (owner setting, guide step 11: 30-minute expiry, longer codes) | review W7 | External beta |
| F-14 | Sessions have no maximum age or idle timeout; cookies lack the Secure flag (httpOnly is off by design: the browser reads the session) | Low | Auth | **Fixed** 2a5ddfe7: sign in again after 30 days (SESSION_MAX_AGE_DAYS), from the token's original sign-in time; Secure cookies over HTTPS | `session-age.test.ts` | — |
| F-15 | Client address taken from the leftmost forwarded-for header (spoofable only off Vercel) | Low | App | Open (note) | review W8 | Only if hosting moves off Vercel |
| F-16 | CSP allows images from any https host, any `*.supabase.co`, inline styles; no reporting | Info | App | Open | review W10 | — |
| F-17 | Legacy Plus members in past-due skip the 14-day cap, keeping AI use (real cost) while unpaid | Low–medium | Billing | **Fixed** 8f1f0def: legacy terms follow the 14-day grace and never raise a Free member's allowance | `entitlements.test.ts` (reproduced end to end), `plans.test.ts` | — |
| F-18 | Isolation sweep didn't cover tables outside its list | Low (test gap) | Tests | **Fixed**: catalog invariants test (every table) and `private-program-isolation.test.ts` (another member and a visitor can't read, add to, change, delete or re-parent any level of a private program) | review S2 | — |
| F-19 | Admins could read members' private AI and starter programs, and enrol in them | Low (privacy) | DB policy | **Fixed** 3b1b3f81 (migration 083: admins see only the owner-less library) | `private-program-isolation.test.ts`, isolation sweep | — |
| F-20 | Stripe promotion codes are allowed at checkout (any active code in the Stripe account works) | Low (config) | Billing | **Fixed** b7bbf243: promotion codes off unless STRIPE_ALLOW_PROMOTION_CODES=true | `checkout-guards.test.ts` | — |
| F-21 | The Stripe billing portal could let a member switch to a price not on the server's list | Low (config) | Billing | Open (owner: limit the billing portal to the approved prices, PAYMENTS_BEFORE_LAUNCH.md) | review S5 | Paid launch |
| F-22 | Test/live Stripe events weren't checked against the key's mode | Low | Billing | **Fixed** 44107eb2 | `entitlements.test.ts` | — |
| F-23 | `REVENUECAT_ALLOW_SANDBOX=true` on a production host that isn't Vercel production would give TestFlight users free Pro; docs disagree | Low (config) | Billing | Open (owner setting; ignored on Vercel production; PAYMENTS_BEFORE_LAUNCH.md) | review S7 | Paid launch |
| F-24 | RevenueCat must be set to "Transfer" restore behaviour (legacy alias mode would let one purchase unlock several accounts) | Info (config) | Billing | Open (owner: RevenueCat restore = Transfer; PAYMENTS_BEFORE_LAUNCH.md) | review S8 | Paid launch |
| F-25 | Member ids appear in some log context fields (outlive account deletion) | Info | Logging | Open | review S9 | Public launch (privacy policy) |

| F-26 | Workout header could read "Synced" while an edit (typing debounce) or a newer change wasn't on the account yet | Medium (false "saved") | Workout logger | **Fixed** a3a3cf10 | `workout-save-status.test.tsx` | — |
| F-27 | Finish and sign-out had no timeout: a request that never answered left "Saving…" for ever | Medium | Workout logger, sign-out | **Fixed** a3a3cf10 (45 s / 20 s, counted as not saved; device copy kept) | `workout-save-status.test.tsx`, `sign-out-workout.test.tsx` | — |
| F-28 | A sign-in that ran out mid-workout redirected the whole app to the login page in the middle of a set | Medium (UX; data was kept) | Workout actions | **Fixed** a3a3cf10 (backup and Finish answer "signed out", member told, workout stays) and f60d4c39 (the middleware no longer redirects server-action requests; pages are still guarded) | `workout-signed-out.test.ts`, `middleware-server-actions.test.ts`, e2e `workout-data-preservation.spec.ts` | — |
| F-29 | Two *different* unfinished workouts on two devices: the app silently opens the newer one; the other device's unsynced workout can then be overwritten on that device | Medium (data loss, multi-device only) | Workout drafts | **Fixed** 2add177c: every unfinished workout is kept and offered; switching saves the other first (refused offline, with the reason) | `workout-two-devices.test.tsx`, `workout-merge.test.ts`, `workout-revisions.test.ts`, e2e `workout-data-preservation.spec.ts` | — (physical iPhone check pending) |
| F-30 | Two tabs or devices editing the *same* workout at once: the server keeps whichever backup arrives last, and a second Finish with different sets is ignored while that device shows "complete" | Low–medium | Workout drafts | **Fixed** 2add177c: revisioned backups (an older copy never replaces a newer one), set-by-set combining, Finish combines first, a second Finish of a saved workout adds instead of replacing | same as F-29, plus the e2e two-device test with one device offline | — (physical iPhone check pending) |

Test gaps noted by the reviews (no known defect): `isSameOrigin` for cookie API routes, `signOutAction` itself,
non-admin calls to every `admin.ts` action. (Now tested: the weekly-report cron secret in `billing-integrity.test.ts`,
`updatePasswordAction` in `password-reset-session.test.ts`.)

## 5. Needs a physical iPhone (not yet done)

Workout survival through lock, swipe-away and Airplane Mode; the sign-out warning; Apple Health permission and import;
background GPS; camera barcode; notifications; that iOS keeps the web storage the app relies on. Simulator and browser
results don't count for these.

## 6. Release gates

- **Internal TestFlight (Josh and John):** staging project only; test accounts; no payment keys (payments off); no AI key
  (AI off); Supabase sign-ups turned off after the two accounts exist; no open critical finding. **Met by the code;
  the setup steps are the owner's** (docs/TESTFLIGHT_FIRST_BUILD_GUIDE.md).
- **External beta:** F-7 switched on, F-13 set, TOTP enabled in Supabase; isolation sweep re-run on staging; a backup restore
  actually tested on the hosted project; no open critical or high finding affecting testers.
- **Paid public launch:** F-21, F-23, F-24 configured (PAYMENTS_BEFORE_LAUNCH.md), F-25 closed or accepted in writing; real Stripe
  test-mode and App Store sandbox purchase, restore, refund and expiry tests on devices; incident-response plan;
  **independent professional security review** (below).

## 7. Independent professional review: scope

Manual testing by a qualified firm (not an automated scan only): authentication and sessions (F-7 to F-14),
Supabase isolation with two test accounts, subscription authorization and both webhooks, the RevenueCat integration and
restore, the iOS app (Capacitor shell, web storage, deep links, HealthKit), secret management and CI, AI privacy and
prompt injection against the live model. Give them test accounts, the staging URL and read access to the repository.

Budget: published 2026 vendor guides put a startup-scale web application test at about **$5,000–$15,000**, an API at
**$4,000–$20,000**, a mobile app at **$5,000–$25,000 per platform**, and a combined web + API scope at
**$15,000–$35,000** (Startup Defense, Invicti, Compass IT Consulting pricing guides). These are vendors' own
benchmarks; get two or three written quotes. Offers far below these ranges are often automated scans only.
