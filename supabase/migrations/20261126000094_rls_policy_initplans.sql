-- Row-level-security policies evaluate their permission helpers once per statement, not once per row.
-- (Production consolidation, open item O-17; Supabase's own guidance for RLS performance.)
--
-- 38 policies called a no-argument helper directly: is_admin(), auth.uid(), has_ai_coach(), can_log_sleep(),
-- can_add_body_scan(), accountability_can_invite(), friends_can_invite(). Written that way, Postgres runs the helper
-- for every row a query looks at (each one a lookup of its own). Wrapped as `(select helper())`, it becomes an InitPlan
-- that runs once per statement. Every one of these helpers is STABLE and depends only on the caller and the statement's
-- snapshot, so the result of every policy is unchanged; only the number of calls drops.
--
-- Each policy is rewritten from its own current definition (pg_policies), so nothing else in it changes.
-- tests/integration/rls-policy-initplans.test.ts checks that no policy is left with an unwrapped helper call.
--
-- ROLLBACK: the same loop with the replacement reversed (regexp_replace '\(\s*SELECT\s+(helper\(\))\s*\)' -> '\1'),
-- or re-run the policies' original migrations. Behaviour is identical either way.
do $$
declare
  r record;
  -- A helper call not already preceded by "SELECT " (deparsed policies spell it in capitals).
  pat constant text := '(?<!SELECT )(?<![[:alnum:]_.])((?:auth\.)?(?:uid|is_admin|has_ai_coach|can_log_sleep|can_add_body_scan|accountability_can_invite|friends_can_invite))\(\)';
  new_qual text;
  new_check text;
  stmt text;
begin
  for r in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ pat or coalesce(with_check, '') ~ pat)
  loop
    new_qual := case when r.qual is null then null else regexp_replace(r.qual, pat, '(SELECT \1())', 'g') end;
    new_check := case when r.with_check is null then null else regexp_replace(r.with_check, pat, '(SELECT \1())', 'g') end;
    stmt := format('alter policy %I on public.%I', r.policyname, r.tablename);
    if new_qual is not null then stmt := stmt || format(' using (%s)', new_qual); end if;
    if new_check is not null then stmt := stmt || format(' with check (%s)', new_check); end if;
    execute stmt;
  end loop;
end
$$;
