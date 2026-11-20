# Security assessment: baseline, 2026-11-20

Branch `claude/rc-testflight-1`. This is the **first pass** of the security programme the owner set out on 2026-11-20
(OWASP ASVS / MASVS / API Top 10 as the reference). It records what was verified, how, and what is still open. It is not
a penetration test and does not claim the app is secure. Automated tests prove only the cases they test.

## 1. What the app holds (most sensitive first)

| Data | Where | Who can reach it |
|---|---|---|
| Prayer-journal entries | `faith_journal_entries` | The member only (RLS). Sent to the AI provider only with the separate journal permission (migration 080). |
| Health-platform data (Apple Health / Health Connect), sleep | `health_*`, `sleep_*` tables | The member only. Sent to the AI provider only with the separate health permission (migration 079). |
| Progress photos, body scans | private storage buckets | The member only (path-scoped storage policies). |
| Body measurements, weight, nutrition, workouts | member tables | The member only (RLS). |
| AI conversations and memories | `ai_messages`, memories (encrypted at rest with `MEMORY_ENCRYPTION_KEY`) | The member only. |
| Subscription state | `user_entitlements`, billing tables | Read: the member. Write: service role only (webhooks, reconciliation). |
| Payment card data | **Not held.** Web payments use Stripe Checkout (hosted); iOS uses Apple in-app purchase via RevenueCat. No card numbers, CVVs or bank details reach the app or its database. |

## 2. Threat model (first cut)

| Threat | Main control | Evidence | Residual risk |
|---|---|---|---|
| One member reading/changing another's data | RLS on every member table and bucket; server checks `auth.uid()` | `tests/integration/cross-user-isolation.test.ts` (15: every user-owned table and private bucket, read/insert/update/delete as another member), `rls.test.ts` (11), `progress-photos.test.ts` (6) | Only the tables listed in the sweep; a new table without a policy would need the sweep updated (the sweep enumerates tables, see that test). |
| Free member getting Pro | Entitlement checked in the database and server, never the client | `pro-bypass.test.ts` (7), `free-user-direct-actions.test.ts` (9), `plan-enforcement.test.ts` (6) | Device-level tampering with the native shell not tested (needs the iOS build). |
| Forged / replayed / duplicate payment webhooks | Stripe signature check; RevenueCat shared-secret header; idempotent event records | `entitlements.test.ts` (13), `billing-integrity.test.ts` (16), `store-billing.test.ts` (21), `subscription-closure.test.ts` (17), `subscription-lifecycle.test.ts` (5) | Never run against the real Stripe/RevenueCat sandboxes (E9 in MASTER_LAUNCH_READINESS). |
| Member calling service-only database functions | Every function's EXECUTE grant reviewed | `api-function-surface.test.ts` (4: the API's own list of callable functions must equal the reviewed list; service-only functions refused with 42501) | — |
| Prompt injection via journal, food names, notes | Member and third-party text passed as inert data blocks; tools scoped to the member | `tests/unit/prompt-injection-hardening.test.ts` (18) and M0 review | Not yet tested against the live model (needs the capped key). |
| AI reading data without consent | Consent gates on every provider call; separate health and journal permissions | `ai-consent.test.ts` (5), `journal-ai-consent.test.ts` (8), `health-ai-sharing.test.ts` (6), `ai-access.test.ts` (4) | — |
| AI spending runaway | Per-member, daily and monthly global budgets, per-request ceiling, kill switches failing closed | M0 tests (`ai-daily-budget`, `ai-kill-switch`, `coach-scenarios`) | Real per-member cost not yet measured. |
| Account takeover | Supabase Auth; email confirmation; rate limits on auth routes | `account-security.test.ts` (7), `auth-email-links.test.ts` | Admin MFA, session revocation across devices, enumeration not yet reviewed (§5). |
| Secrets in the repository | gitleaks over all branches and history in CI | Full scan 2026-11-20: 0 findings after four reviewed exact-value exceptions (all test fixtures or public catalog ids) | The repository is **public** (§4). |
| Compromised CI / supply chain | Third-party actions pinned to commit SHAs; `contents: read` by default; signing secrets only on the steps that use them; TestFlight job manual only | Workflow review 2026-11-20 | Build-tool dependency vulnerabilities (§3, F-3). |
| Data loss of an unfinished workout | Device copy on every change; server backup per set; never cleared without confirmation | `sign-out-workout` (unit 8, e2e 2), `workout-backup-timeout`, reliability suites | Not yet verified on an iPhone. |

## 3. Findings register

| ID | Finding | Severity | Component | Status | Evidence | Blocks |
|---|---|---|---|---|---|---|
| F-1 | The GitHub repository is **public**: all source, history of 41 branches, legal audits, trademark notes, counsel questions and **patent claim charts** are readable by anyone. No credential was found in it. | High (IP / confidentiality) | GitHub | **Open: owner decision** (make private) | `visibility: public` (2026-11-20) | Patent filing strategy (public disclosure); not TestFlight |
| F-2 | Sign-out deleted a workout whose latest sets hadn't reached the server | High (data loss) | Web app | **Fixed** (8ec239f9) | unit + e2e | — |
| F-3 | Build-time dependencies with known vulnerabilities: `tar` (critical, path traversal on extract), `sharp`/libvips, `@capacitor/cli`, `@capacitor/assets` (high) | Medium (dev and CI machines only; not shipped to members) | Tooling | Open: upgrade in a separate change and re-test the iOS/Android builds | `npm audit` 2026-11-20 | — |
| F-4 | `next` 15.5.x: SVG rejection bypass in image optimisation | Moderate | Web app | Open: upgrade to the fixed patch and re-test | `npm audit --omit=dev` | — |
| F-5 | A hung backup request blocked later backups | Medium (data freshness) | Web app | **Fixed** (c32b0a67) | unit | — |
| F-6 | Security-scan failures on PR #12 were four harmless values | Info | CI | **Resolved** with exact-value exceptions (9bfe9d73) | gitleaks 12 → 0 | — |

## 4. Not yet assessed (next security milestone)

Authentication depth (admin MFA, session revocation on all devices, enumeration, email-change protection), security
headers and CSP review in depth, SSRF/redirect review of server routes, storage URL guessing beyond the isolation sweep,
dynamic scanning (DAST) of a staging deployment, iOS configuration checks on the signed build, backup restore test on
the hosted Supabase project, incident-response plan, and live AI adversarial tests with a capped key.

## 5. Release gates

- **Internal TestFlight (owner and John):** staging only, test accounts, live payments off, AI capped or off, no open
  critical finding in the test environment. F-1 does not block (it is a confidentiality/IP issue, not member data).
- **External beta:** the §4 authentication items reviewed, isolation sweep re-run on staging, restore test done, no open
  critical/high finding affecting testers.
- **Paid public launch:** real-sandbox subscription tests (E9), independent professional review of authentication,
  Supabase isolation, subscriptions/RevenueCat, iOS app, secrets and AI privacy; incident-response plan in place.
