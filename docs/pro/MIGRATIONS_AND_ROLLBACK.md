# Pro work: database changes, deployment order and rollback

Branch `claude/pro-premium`, 2026-11-13. Nothing has been applied to staging or production. Every change below was
applied to the local Supabase stack and exercised by the integration tests named.

## Migrations

| Migration | What it does | Data it touches | Rollback (also at the top of each file) |
|---|---|---|---|
| `20261113000063_weekly_reports.sql` | `weekly_reports` table (one row per member per Monday-start week, unique), RLS: members read and delete their own and may only mark them read; only the server writes. Adds `weekly_report` to the AI usage kinds. | New table only. | Drop the table and restore the previous `ai_usage_events_kind_check` list. |
| `20261113000064_habit_programs.sql` | `habit_program_enrollments` and `habit_program_checkins`, RLS: own rows only; new enrollments and check-ins need `has_plan('pro')`; one active run per program; no future-day rules live in the server action. | New tables only. | Drop both tables (roll back the app first: `/train/habits` uses them). |
| `20261113000065_program_enrollment_grandfather.sql` | `can_use_program` also allows a member with an existing `user_programs` row for that program, so nobody loses a program part-way through when library programs became Pro-only. | Function only. | Restore the previous function body (in the file header). |
| `20261113000066_ai_cost_controls.sql` | AI metered in money: `ai_usage_events` gains `cost_micros`, `reserved_micros`, `finalized_at` (existing rows backfilled and closed); `ai_budget_months` and `ai_budget_alerts` (service role only); `reserve_ai_usage` replaced (13 arguments: member and global budgets, in-flight limits, fast-model switch, stale-hold sweep); new `finalize_ai_usage`, `release_ai_usage`, `ai_budget_settle`, `ai_budget_check`. | Columns added with defaults; one function replaced. The app must be deployed with it (the old 7-argument call no longer exists). | Header of the file: drop the new functions and tables, drop the columns, re-apply `reserve_ai_usage` from `20261024000032_food_photos.sql`. Roll back the app first. |
| `20261113000067_accountability_partners.sql` | Accountability partners: invites, partnerships, per-partner shares, fixed-message nudges, six functions; flag `accountability_partners` inserted **off**. | New tables only. | Header of the file (tested inside a transaction). |
| `20261114000070_program_library_cleanup.sql` | Program library clean-up (docs/programs/PROGRAM_LIBRARY_AUDIT.md): new names for 13 curated programs (incl. "4-Week Wave Strength" → "Wave Strength: Training-Max Method", still 8 weeks) and "who it's for" summaries for 43, by slug. | `training_programs.name` / `summary` only; no ids, weeks, days, tiers or `is_published`. | Header of the file (old names and summaries). |

Tests: `tests/integration/weekly-reports.test.ts`, `tests/integration/pro-programs.test.ts` (Free can't enroll or forge
an earlier enrollment, a kept enrollment still works, switching keeps history, habit-program RLS), plus the existing
`plan-enforcement`, `custom-programs` and `workouts` suites.

## Catalog data (seed)

`supabase/seed.sql` is generated from `src/data` (`npx tsx scripts/generate-seed.ts`, then `bash scripts/bundle-sql.sh`
for `supabase/setup-all.sql`). It is idempotent and uses stable ids.

**Fixed in this branch: re-seeding no longer detaches member history.** The seed used to delete every library program's
weeks before re-inserting them. `workout_sessions.program_day_id` is `on delete set null` and calendar overrides cascade,
so running the seed against a live database would have unlinked every logged program workout from its day. Weeks and
days are now upserted in place under their stable ids; only exercise rows are rebuilt; only weeks or days a program no
longer has are removed. Verified locally (linked workouts survive a re-seed) and guarded by
`tests/unit/seed-preserves-history.test.ts`.

What the new seed changes in an existing database:

* adds 22 programs (catalog 1, 2, 7–17, 20–22, 27–32) and 61 exercises; existing rows keep their ids;
* sets `tier = 'pro'` on the 14 programs that were Free: `foundations-full-body`, `home-bodyweight-strength`,
  `active-aging-low-impact`, `daily-mobility-flow`, `recovery-deload-week`, `barbell-strength-foundations`,
  `strongman-foundations`, `full-body-hypertrophy-3-day`, `mma-off-camp-2-day`, `aerobic-base-run-walk`,
  `walk-to-run-beginner`, `agility-footwork`, `calisthenics-foundations`, `seated-strength-mobility`;
* leaves every existing program's prescriptions as they were (the adopted catalog programs only gain milestones and
  instructions, which live in the app code, not the database).

Rollback of the tier change only:

```sql
update public.training_programs set tier = 'free'
where owner_id is null and slug in ('foundations-full-body','home-bodyweight-strength','active-aging-low-impact',
  'daily-mobility-flow','recovery-deload-week','barbell-strength-foundations','strongman-foundations',
  'full-body-hypertrophy-3-day','mma-off-camp-2-day','aerobic-base-run-walk','walk-to-run-beginner',
  'agility-footwork','calisthenics-foundations','seated-strength-mobility');
```

New programs and exercises can stay in place on rollback. Do **not** hide a program with `is_published = false`: row
level security then hides it, its weeks and days from members already enrolled in it and blocks logging workouts
against its days. Retire it from browsing instead (`src/data/program-retirements.ts`), which leaves it published and
fully usable for those members (docs/programs/PROGRAM_LIBRARY_AUDIT.md).

## Deployment order (when approved)

1. Back up the database.
2. Apply migrations 063–070 (`supabase db push` against staging first). 066 and the app code that calls it must go out together.
3. Run the regenerated `supabase/seed.sql` on staging; check a member with a logged program workout still sees it
   linked to its day.
4. Deploy the app build from this branch to staging; run the integration and e2e suites against it.
5. Production only after owner approval. Stripe and store prices are not changed by any of this (see below).

## Not changed

* No subscription product, price or billing setting in Stripe, App Store Connect or Google Play. The approved prices
  ($17.99 / $119.99) are in code only; checkout refuses until the live price matches (`src/lib/domain/plans.ts`).
* No existing user record is overwritten. No migration deletes member data.
* The experimental 3D prototype is untouched.
