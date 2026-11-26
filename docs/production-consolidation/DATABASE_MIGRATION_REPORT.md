# Database migration report

**Branch:** `release/narrow-gate-production-consolidation`.

- **93 migration files**, `20261016000001` to `20261126000093`, applied in filename order.
- `supabase/setup-all.sql` is the generated concatenation for pasting into a new project. It is regenerated with
  `bash scripts/bundle-sql.sh`; an independent check found it identical to the migrations plus the seed.
- **Nothing was run against any hosted or production database.** All tests used a local Supabase stack with synthetic
  accounts.

## Tests performed

| Test | Result |
|---|---|
| **Fresh install** (`supabase db reset`: all migrations plus seed on an empty database) | Passed with 90 migrations before the Friends merge, then with 93 after it |
| **Upgrade from `main`** | **All data preserved** (details below) |
| Integration suites against the migrated schema | See TEST_RESULTS.md |

**Upgrade from `main` in detail:**

1. Start from `main`'s 8 migrations (identical files in this branch).
2. Insert synthetic data: 3 members, 3 workouts with 9 exercises and 27 sets, personal records, 20 weight entries, a
   measurement, a meal, water, a prayer-journal entry, a 40-day challenge enrolment, an AI conversation, and a paying
   member with an active Stripe subscription and a Pro entitlement.
3. Apply the 72 later migrations (to `090`).

Results:

- every count was identical before and after, including the summed set weights;
- the paying member was still Pro;
- row-level security was on for every table;
- the only unvalidated constraint was the intentional `profiles_avatar_path_check` (`NOT VALID` since migration 040).

Friends migrations 091–093 were added after this test. They only create new tables and functions, and the fresh
install with all 93 passed.

## Migrations added by this consolidation

| File | What it does | Rollback |
|---|---|---|
| `20261125000088_body_scan_photo_quota.sql` | Per-member Body Scan upload limit (policy plus locking trigger) | In the file header |
| `20261126000089_consent_enforcement_and_fk_indexes.sql` | AI sub-permissions follow AI consent on withdrawal; journal marks need the permission; recovery check-ins need wellness consent; 8 foreign-key indexes | In the file header |
| `20261126000090_security_review_hardening.sql` | Avatars uploads closed; proposal status guard; layout-prefs size cap; `expire_old_sessions` (server only) | In the file header |
| `20261126000091`–`093` (Friends) | Friends tables, functions, policies, privacy defaults. **Feature flag off** | In the file headers |

## Migrations 079 and 080 (health data and prayer journal consent)

- **What they add:** both add one nullable timestamp column on `profiles`:
  - `health_ai_share_consent_at` (079);
  - `journal_ai_consent_at` (080).

  Both default to "not allowed", for existing members too, which is privacy-protective. Both are idempotent.
- **Gap found:** they relied on app code to:
  - clear old journal marks (from before 080);
  - switch these permissions off with the general AI consent.
- **Fixed by 089:**
  - old marks are cleared;
  - a trigger switches the sub-permissions off when AI consent is withdrawn;
  - a restrictive policy allows a journal entry to be marked for the AI Coach only with the journal permission, the AI
    consent and faith features all on.

  Tested in `consent-enforcement.test.ts`, and the existing `ai-consent` / `ai-outgoing-payloads` suites check what
  actually reaches the AI provider.

## Statements that are risky on a database with existing data

These apply when a database built from an older branch is upgraded (from the independent review):

1. **043:** clears route data from soft-deleted activities. Deliberate and irreversible.
2. **066:** rewrites `ai_usage_events` once. A full-table update.
3. **082:** unpublishes one retired exercise and removes it from curated programs.
4. **Validated constraints and plain `create index` statements** (041, 049, 069, 081, 087 and others) lock their table
   briefly. On a large database, build those indexes beforehand with `create index concurrently`.
5. **086 and 088:** create triggers on `storage.objects`. **Check on a hosted staging project first** (O-16): if hosted
   Supabase refuses them, keep the policy layer and move the counting into an RPC.

No hosted database exists yet, so today none of these can affect real members.

## Backups and restore

**Not set up:** there is no hosted project. Before real members:

- Supabase Pro daily backups (point-in-time recovery if affordable);
- a manual dump before every migration;
- one restore drill into a scratch project;
- a decision on photo backups (storage isn't in database backups).

See `docs/operations/RELEASE_ROLLBACK_AND_INCIDENTS.md`.

## How to apply (when a staging project exists)

1. Install the Supabase CLI and link the project (`npx supabase link --project-ref <ref>`).
2. **Staging first:** `npx supabase db push`. Alternatively, for a brand-new project, paste `supabase/setup-all.sql`
   into the SQL editor once.
3. Run the checks in `docs/TESTFLIGHT_FIRST_BUILD_GUIDE.md` (the two photo-limit triggers exist).
4. Never run migrations against production without a fresh backup and owner approval.
