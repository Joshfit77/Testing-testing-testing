# Security audit (consolidation branch)

**Scope:** `release/narrow-gate-production-consolidation`, 2026-11-26.

**Method:**

- code reading;
- scripted checks;
- the live local database catalogue;
- five independent read-only reviews;
- the automated suites, run against a real local Supabase with synthetic accounts only.

Principles: OWASP ASVS, API Security Top 10 and MASVS.

**What this is not:**

- not a penetration test;
- not a certification;
- not proof of legal compliance.

**Note:** this repository is public, so open items are described without exploit detail. A fuller confidential version
was delivered to the owner privately.

## Result

| Severity | Found by the reviews | Fixed here | Open |
|---|---|---|---|
| Critical | 0 | — | 0 |
| High | 0 code issues. Operational items: public repository, no backups, GitHub protections not yet switched on | — | 3 (owner / infrastructure) |
| Medium | 7 | 6 (N-1, N-2, consent F2, F3, F1 indexes, S-12) | Bot protection keys; no member two-step sign-in. (The storage-trigger deploy risk, O-16, is resolved: photo limits hold without the triggers, T-11, T-24, migration 099) |
| Low | 8+ | 5 + O-18 | None open in code (BUG_FIX_REGISTER.md) |

## Fixed in this branch (verified, with regression tests)

- **Sessions:**
  - the maximum sign-in age now also applies on the API's Bearer path;
  - a daily server job (`/api/maintenance/sessions`) ends old sessions at the authentication server.
- **Storage:**
  - nothing new can be uploaded to the unused avatars bucket;
  - Body Scan uploads have a per-member limit that holds under simultaneous uploads (like progress photos).
- **Consent enforced by the database:**
  - withdrawing AI consent switches off health-data sharing, prayer-journal sharing and coaching memory, whatever writes
    the profile;
  - journal "share" marks can be set only with all permissions on, and are cleared when the permission changes;
  - recovery check-ins need the wellness consent.
- **Integrity:**
  - a coach proposal can be confirmed once;
  - training-change Undo writes only the tables and columns such changes use, and reports failures;
  - layout preferences are size-limited.
- **Billing:**
  - deleting an account expires open checkout pages;
  - Manage billing stays reachable while a payment is being retried;
  - the price guard is stricter (see PAYMENT_VERIFICATION.md).
- **Account deletion:** verified to remove every row naming the member across 100+ tables, including the new Friends
  tables, plus all three private buckets.

## Verified sound (evidence)

| Area | Evidence |
|---|---|
| **Authorization** | Every exported server action reaches a sign-in/role check (scripted). Every API route has the right gate: session, signature, secret, or public health check only |
| **Row-level security** | On every public table (catalogue test). Cross-account isolation sweep across every member table and private bucket (`cross-user-isolation.test.ts`) |
| **Database functions** | All security-definer functions set `search_path`. The callable-function list is pinned by `api-function-surface.test.ts` |
| **Admin** | Needs an authenticator (aal2) in the database itself. Admins can't read journals, private programs or members' rows, except member reports, which is by design |
| **Webhooks** | Stripe signature on the raw body. RevenueCat constant-time secret, and the server re-reads the subscriber. Processed once, retried safely |
| **XSS** | No `dangerouslySetInnerHTML` except fixed nonce'd scripts. AI text rendered as React text, links https-only. Strict nonce CSP |
| **CSRF** | Same-origin required for cookie-authenticated writes; SameSite=Lax |
| **AI** | Tools read only the member's own data, and any change is a proposal the member confirms. Untrusted text is marked as such. Budgets, rate and concurrency limits, kill switch. Health and journal data only with separate consent |
| **Logs** | Ids and codes only; messages redacted |
| **Dependencies** | `npm audit`: 0 known vulnerabilities (2026-11-25) |

## Open security work

| Item | Severity | Owner / who |
|---|---|---|
| Repository is public (code, schema and earlier reports readable) | High | Owner decision; GitHub Pro if private |
| No backups or restore drill (no hosted project yet) | High | Owner + engineer before real users |
| GitHub ruleset and `testflight` environment not switched on | High until done | Owner (`docs/security/GITHUB_PROTECTION.md`) |
| Bot protection (Turnstile) keys not set | Medium | Owner, before external testers |
| No two-step sign-in for members (admins have it) | Medium | Engineer; recommended for accounts holding health data |
| ~~Storage triggers may need a different approach on hosted Supabase (O-16)~~ Resolved: upload reservations enforce the photo limits without triggers (097, 099); the triggers add exact byte checks where installed | — | Confirmed by `npm run db:verify` on staging (founder runs it) |
| Independent penetration test | Recommended before payments | External |
| Session cookies readable by page scripts (`@supabase/ssr` default; mitigated by the CSP) | Medium (accepted) | Engineer review |
