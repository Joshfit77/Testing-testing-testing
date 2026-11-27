-- Narrow Gate Fitness — close the remaining ways to get the paid program builder through the database API, and a few
-- defence-in-depth gaps found in the 2026-11-01 database audit (docs/security/PRELAUNCH_SECURITY_REPORT.md).
--
-- 1. M1: a Free member could insert a "starter" program with their own token (starter inserts had no plan check),
--    fill it with any weeks, days and exercises, and relabel it "custom" or "ai": the paid builder's result without
--    the plan, and without the builder's rate limit. Now starter programs are created by the server only (the app's
--    onboarding and schedule rebuild do this with the service role), a member can never change a program's source,
--    and editing the contents of a member's starter program needs Plus/Pro (the app's only editors of those contents,
--    adaptive training and coach suggestions, are Pro features already).
-- 2. L3: has_ai_coach() ignored a refunded or disputed period (access_revoked_at), unlike the app's own rule.
-- 3. L4: members could insert their own AI "proposal" JSON on a question and then apply it as if the coach wrote it.
-- 4. L6: anon and authenticated held TRUNCATE, REFERENCES and TRIGGER on every table, and write grants on billing
--    tables that RLS alone was denying. Removed (nothing in the app uses them).

-- 1a. Starter programs: server only.
drop policy if exists training_programs_insert on public.training_programs;
create policy training_programs_insert on public.training_programs
  for insert to authenticated with check (
    (
      owner_id = (select auth.uid()) and is_published = false
      and ((source = 'custom' and public.has_plan('plus')) or (source = 'ai' and public.has_plan('pro')))
    )
    or (owner_id is null and public.is_admin())
  );

-- 1b. A program's source never changes under a member's session (the server's service role has no auth.uid()).
create or replace function public.lock_training_program_source()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and new.source is distinct from old.source then
    raise exception 'A program''s source can''t be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.lock_training_program_source() from public, anon, authenticated;
create trigger training_programs_lock_source before update on public.training_programs
  for each row execute function public.lock_training_program_source();

-- 1c. The contents of a member's starter program are edited only with Plus/Pro. Security invoker: it sees only the
-- caller's own programs (the parent ownership check in the write policies already requires that), so it can't be
-- used to probe other members' programs.
create or replace function public.is_member_starter_program(p_program_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from public.training_programs p where p.id = p_program_id and p.owner_id is not null and p.source = 'starter');
$$;
revoke all on function public.is_member_starter_program(uuid) from public, anon;
grant execute on function public.is_member_starter_program(uuid) to authenticated, service_role;

create policy program_weeks_starter_plan_insert on public.program_weeks
  as restrictive for insert to authenticated
  with check (not public.is_member_starter_program(program_id) or public.has_plan('plus'));
create policy program_weeks_starter_plan_update on public.program_weeks
  as restrictive for update to authenticated
  using (not public.is_member_starter_program(program_id) or public.has_plan('plus'))
  with check (not public.is_member_starter_program(program_id) or public.has_plan('plus'));

create policy program_days_starter_plan_insert on public.program_days
  as restrictive for insert to authenticated
  with check (not public.is_member_starter_program(public.program_of_week(week_id)) or public.has_plan('plus'));
create policy program_days_starter_plan_update on public.program_days
  as restrictive for update to authenticated
  using (not public.is_member_starter_program(public.program_of_week(week_id)) or public.has_plan('plus'))
  with check (not public.is_member_starter_program(public.program_of_week(week_id)) or public.has_plan('plus'));

create policy program_exercises_starter_plan_insert on public.program_exercises
  as restrictive for insert to authenticated
  with check (not public.is_member_starter_program(public.program_of_day(day_id)) or public.has_plan('plus'));
create policy program_exercises_starter_plan_update on public.program_exercises
  as restrictive for update to authenticated
  using (not public.is_member_starter_program(public.program_of_day(day_id)) or public.has_plan('plus'))
  with check (not public.is_member_starter_program(public.program_of_day(day_id)) or public.has_plan('plus'));

-- 2. The legacy AI allowance ends with a refunded or disputed period, as in src/lib/domain/plans.ts.
create or replace function public.has_ai_coach()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_plan('pro') or exists (
    select 1
    from public.legacy_plan_terms t
    join public.subscriptions s on s.stripe_subscription_id = t.stripe_subscription_id
    where t.user_id = auth.uid()
      and t.ai_monthly_limit > 0
      and (t.ends_at is null or t.ends_at > now())
      and s.plan = t.plan
      and s.status in ('active', 'trialing', 'past_due')
      and s.access_revoked_at is null
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;
revoke all on function public.has_ai_coach() from public, anon;
grant execute on function public.has_ai_coach() to authenticated, service_role;

-- 3. Members write only plain questions: no proposal or proposal status of their own.
drop policy if exists ai_messages_insert_own on public.ai_messages;
create policy ai_messages_insert_own on public.ai_messages
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and role = 'user'
    and proposal is null
    and proposal_status is null
    and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))
  );

-- 4. Defence in depth: privileges RLS was the only barrier for.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from anon, authenticated;
revoke all on public.stripe_events, public.revenuecat_events from anon, authenticated;
revoke insert, update, delete on public.subscriptions, public.user_entitlements, public.billing_customers, public.store_subscriptions,
  public.legacy_plan_terms, public.ai_usage_events from anon, authenticated;
