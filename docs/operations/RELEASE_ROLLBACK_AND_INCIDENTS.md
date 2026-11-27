# Releases, rollback, backups and incidents (first TestFlight build)

Written 2026-11-23 for release candidate `claude/rc-testflight-1`. Plain steps for the owner. Nothing here has been
done yet. Where a dashboard's wording differs slightly from what is written here, look for the nearest match.

## 1. What runs where

| Part | Where | Notes |
|---|---|---|
| Website and server code | Vercel (staging project) | The iPhone app is a native shell that opens this site, so most fixes reach testers without a new TestFlight build |
| Database, sign-in, photo storage | Supabase (a **separate staging project**, never the future production one) | `docs/TESTFLIGHT_FIRST_BUILD_GUIDE.md` Part B |
| iPhone app shell | App Store Connect / TestFlight | A new build only for native changes (permissions, plugins, icon, server address) |
| Payments | **Off.** No Stripe or RevenueCat keys on staging | `docs/security/PAYMENTS_BEFORE_LAUNCH.md` |
| AI coach | **Off** for the first build: leave `ANTHROPIC_API_KEY` blank on staging | Members see "temporarily unavailable" |

Staging must hold test accounts only. Do not invite real customers to a staging build, and do not copy real data into it.

## 2. Database changes (migrations)

The 75 files in `supabase/migrations/` run in order, once each. **There are no "undo" files**: a change is reversed by a
new migration that puts things back ("rolling forward").

Before every migration on a hosted project:

1. **Take a backup you hold yourself** (the free plan's own backups can't be relied on; section 4). On your computer, in
   the repository folder, with the Supabase CLI linked to the project (`npx supabase link`):
   ```
   npx supabase db dump --linked -f backup-YYYY-MM-DD-roles.sql --role-only
   npx supabase db dump --linked -f backup-YYYY-MM-DD-schema.sql
   npx supabase db dump --linked -f backup-YYYY-MM-DD-data.sql --data-only --use-copy
   ```
   Keep the three files somewhere private (they contain members' data); never commit them.
2. Apply to **staging first**: `npx supabase db push`. Then open the staging site and sign in.
3. Check every migration ran: Supabase → SQL Editor:
   `select count(*) from supabase_migrations.schema_migrations;` (75 on this release candidate).

The two newest migrations, and how each would be reversed if ever needed:

| Migration | What it does | Effect on an older app version | Reverse |
|---|---|---|---|
| 084 `workout_draft_revision` | Adds the column `workout_sessions.draft_rev` (default 0) | None: an older version ignores the column | Not needed. Dropping it would break the current app |
| 085 `admin_requires_mfa` | Admin rights in the database require the second sign-in step (`aal2`) | Admin tools need the authenticator; members unaffected | **Don't** without a decision: it would remove admin two-step protection. If an admin is locked out, use `docs/security/ADMIN_MFA.md` (recovery) instead |

## 3. Rolling back a bad release

- **Website:** Vercel → the project → **Deployments** → the last good deployment → **⋯** → **Instant Rollback** (or
  **Promote to Production**). Takes effect in about a minute, and the iPhone app shows it on next open. Check
  `https://<site>/api/health`: it shows the commit being served.
- **Database:** roll forward (section 2). Restore from your backup only for data loss (section 5), never to undo a
  code release.
- **iPhone build:** App Store Connect → the app → **TestFlight** → the bad build → **Expire Build**. Testers can
  install the previous build from the TestFlight app (**Previous Builds**). Then fix and upload a new build: re-runs of
  the workflow get a new build number automatically (`ios.yml`, `BUILD_NUMBER`).

## 4. Backups: what exists and what to decide

| Data | Covered by | Gap |
|---|---|---|
| Database (accounts, workouts, nutrition, journals, routes) | Your own dumps (section 2). Supabase's daily backups and point-in-time recovery come with **paid** plans: check Supabase → Database → Backups for what your plan includes | **On the free plan, assume no Supabase backup.** Before paying members: decide on Supabase Pro (daily backups) and whether to add point-in-time recovery (cost item) |
| Photos (progress, Body Scan) in Supabase Storage | **Not included in database backups** | Decide before launch whether photos need their own copy; for TestFlight test data, accept the gap |
| Code | GitHub | — |
| Secrets | Vercel, GitHub and Supabase settings | Keep a private list of **which** secrets exist and where they are set (never their values in a document) |

**Test a restore once before launch:** create a throwaway Supabase project, load the three dump files
(`psql -f roles.sql`, then `schema.sql`, then `data.sql`), point a local copy of the site at it, and sign in as a test
account. A backup that has never been restored is not yet a proven backup.

## 5. Incidents: first steps

Write down the time, what you saw and what you did as you go. Keep logs: Vercel → **Logs** and Supabase → **Logs**
keep only a short history on lower plans, so download what matters.

| What happened | Do this first | Then |
|---|---|---|
| **A member's account may be taken over** | Supabase → SQL Editor: `delete from auth.sessions where user_id = '<their id>';` (signs them out everywhere; a session already open lasts at most until its hour-long token expires). Ask them to reset their password from the app | If their email itself was taken over, contact them by another channel before changing anything |
| **A secret may have leaked** (in a screenshot, a chat, a commit) | Rotate it where it was issued: Supabase → Project Settings → API keys; Vercel env vars; App Store Connect → Users and Access → Integrations → **Revoke** the API key; GitHub → Settings → Secrets (replace). Redeploy Vercel after changing its variables | Check the provider's logs for use you don't recognise. A secret in a git commit stays in history: rotate it, don't just delete the line |
| **AI costs rising unexpectedly** (once AI is on) | Admin → **Flags** → turn **ai_coach** off (every AI feature stops at once; needs the admin authenticator) | Look at `AI_GLOBAL_DAILY_BUDGET_USD` and the monthly budget (`src/server/services/ai-budget.ts`); the daily cap already stops spending at the limit |
| **The site is down or showing errors** | Instant Rollback (section 3) | Check Supabase status and Vercel status pages |
| **Data lost or damaged** | Stop: don't make further changes to the affected rows. Take a fresh dump of the current state | Load your last good backup into a **new, separate** project and copy back only the affected rows. Never restore over the live project |
| **Member data seen by someone it shouldn't have been** (a possible breach) | Contain it (rotate keys, roll back, sign out sessions). Preserve logs | **Talk to counsel the same day.** Notification duties and deadlines depend on where members live and what data was involved; counsel decides who must be told and when |

## 6. Contacts to keep in one private place

Supabase project owner login (with its two-step recovery codes), Vercel, GitHub, Apple Developer account holder,
App Store Connect API key owner, counsel. Each account should have two-step sign-in turned on.
