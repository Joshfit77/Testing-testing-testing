-- Read-only checks to run against a database after `supabase db push` (staging first), e.g.:
--   psql "$STAGING_DB_URL" -X -v ON_ERROR_STOP=1 -f scripts/verify-database.sql
-- Every line of the result should say ok. It changes nothing.
\pset footer off
select check_name, case when passed then 'ok' else 'FAILED: ' || detail end as result
from (
  select 'migrations applied' as check_name,
         (select count(*) from supabase_migrations.schema_migrations) >= 86 as passed,
         (select count(*)::text || ' applied; expected at least 86 (through 096)' from supabase_migrations.schema_migrations) as detail
  union all
  select 'row-level security on every public table',
         not exists (select 1 from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity),
         (select string_agg(relname, ', ') from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity)
  union all
  select 'progress photo quota trigger (O-16)',
         exists (select 1 from pg_trigger where tgname = 'progress_photos_quota' and tgrelid = 'storage.objects'::regclass),
         'missing: the storage policy still limits uploads, but not under simultaneous uploads; grant TRIGGER on storage.objects to postgres and re-run migration 086''s trigger block'
  union all
  select 'body scan photo quota trigger (O-16)',
         exists (select 1 from pg_trigger where tgname = 'body_scan_photos_quota' and tgrelid = 'storage.objects'::regclass),
         'missing: as above, migration 088'
  union all
  select 'storage insert policies call the quota checks',
         (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('progress_photos_owner_insert', 'body_scans_owner_insert')) = 2,
         'one of the storage insert policies is missing'
  union all
  select 'policies evaluate helpers once per statement (094)',
         not exists (
           select 1 from pg_policies where schemaname = 'public'
             and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(?<!SELECT )(?<![[:alnum:]_.])((?:auth\.)?(?:uid|is_admin|has_ai_coach|can_log_sleep|can_add_body_scan|accountability_can_invite|friends_can_invite))\(\)'),
         'a policy calls a permission helper per row'
  union all
  select 'admin rights need a second factor',
         pg_get_functiondef('public.is_admin()'::regprocedure) like '%aal2%',
         'is_admin() does not require aal2'
  union all
  select 'billing tables not writable by members',
         not exists (select 1 from pg_policies where schemaname = 'public' and cmd <> 'SELECT'
           and tablename in ('billing_customers','store_subscriptions','subscriptions','user_entitlements','stripe_events','revenuecat_events')),
         'a member-facing write policy exists on a billing table'
) checks
order by 1;
