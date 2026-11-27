-- ---------------------------------------------------------------------------------------------------------------
-- First-workout activation report: count real members only. Until now every new profile was in the cohort, so App
-- Review / TestFlight sandbox testers (migration 052), admins, demo accounts and automated-test accounts
-- (@example.com and similar reserved test domains) would have inflated or skewed the figures once testing starts on the
-- production project. They are now left out by default (p_include_test = true includes them), and the report says how
-- many were left out. Events are still recorded for everyone; only the report changes.
-- ---------------------------------------------------------------------------------------------------------------

create or replace function public.activation_is_test_account(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.sandbox_testers t where t.user_id = p_user)
      or exists (select 1 from public.profiles p where p.id = p_user and p.role = 'admin')
      or exists (
        select 1 from auth.users u
        where u.id = p_user
          and (coalesce((u.raw_app_meta_data ->> 'demo')::boolean, false)
               or lower(u.email) ~ '@(example\.(com|org|net)|[a-z0-9.-]+\.(test|example|invalid|localhost))$')
      );
$$;
revoke all on function public.activation_is_test_account(uuid) from public, anon, authenticated;

drop function if exists public.admin_activation_metrics(timestamptz, timestamptz);

create function public.admin_activation_metrics(
  p_from timestamptz default now() - interval '30 days',
  p_to timestamptz default now(),
  p_include_test boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  with signups as (
    select p.id, p.created_at, p.onboarding_completed_at, coalesce(nullif(p.timezone, ''), 'UTC') as tz,
      public.activation_is_test_account(p.id) as is_test
    from public.profiles p
    where p.created_at >= p_from and p.created_at < p_to
  ),
  cohort as (
    select id, created_at, onboarding_completed_at, tz from signups where p_include_test or not is_test
  ),
  firsts as (
    select c.*,
      (select min(e.occurred_at) from public.activation_events e where e.user_id = c.id and e.event = 'workout_started') as first_start,
      (select min(e.occurred_at) from public.activation_events e where e.user_id = c.id and e.event = 'set_completed') as first_set,
      (select min(e.occurred_at) from public.activation_events e where e.user_id = c.id and e.event = 'workout_completed') as first_done
    from cohort c
  ),
  first_workout as (
    select f.id,
      (select e.workout_client_id from public.activation_events e where e.user_id = f.id and e.event = 'workout_started' order by e.occurred_at, e.id limit 1) as client_id
    from firsts f
  ),
  -- Days (0 = the sign-up day) on which the member started or finished a workout.
  active_days as (
    select distinct c.id, ((e.occurred_at at time zone c.tz)::date - (c.created_at at time zone c.tz)::date) as day
    from cohort c join public.activation_events e on e.user_id = c.id and e.event in ('workout_started', 'workout_completed')
  ),
  cohort_days as (
    select c.id, ((now() at time zone c.tz)::date - (c.created_at at time zone c.tz)::date) as age_days from cohort c
  ),
  cohort_workouts as (
    select e.workout_client_id, e.user_id from public.activation_events e join cohort c on c.id = e.user_id where e.event = 'workout_started'
  ),
  stale as (
    -- Still "in progress" but untouched for a day: left, not finished (and not yet discarded).
    select s.user_id, s.client_id from public.workout_sessions s join cohort c on c.id = s.user_id
    where s.status = 'in_progress' and s.updated_at < now() - interval '24 hours'
  )
  select jsonb_build_object(
    'window', jsonb_build_object('from', p_from, 'to', p_to),
    -- Accounts left out of every figure (testers, admins, demo and test addresses); 0 when p_include_test.
    'excluded_test_accounts', (select count(*) from signups where is_test and not p_include_test),
    'new_members', jsonb_build_object(
      'accounts', (select count(*) from cohort),
      'onboarded', (select count(*) from cohort where onboarding_completed_at is not null),
      'started_first_workout', (select count(first_start) from firsts),
      'completed_first_set', (select count(first_set) from firsts),
      'completed_first_workout', (select count(first_done) from firsts)
    ),
    'median_minutes', jsonb_build_object(
      'signup_to_onboarded', (select round((percentile_cont(0.5) within group (order by extract(epoch from onboarding_completed_at - created_at) / 60))::numeric, 1) from firsts where onboarding_completed_at is not null),
      'onboarded_to_first_workout_start', (select round((percentile_cont(0.5) within group (order by extract(epoch from first_start - onboarding_completed_at) / 60))::numeric, 1) from firsts where first_start is not null and onboarding_completed_at is not null),
      'first_workout_start_to_first_set', (select round((percentile_cont(0.5) within group (order by extract(epoch from first_set - first_start) / 60))::numeric, 1) from firsts where first_set is not null and first_start is not null),
      'signup_to_first_set', (select round((percentile_cont(0.5) within group (order by extract(epoch from first_set - created_at) / 60))::numeric, 1) from firsts where first_set is not null),
      'signup_to_first_workout_completed', (select round((percentile_cont(0.5) within group (order by extract(epoch from first_done - created_at) / 60))::numeric, 1) from firsts where first_done is not null)
    ),
    -- Returned on day N: trained on that calendar day. Only members whose day N is over are counted ("eligible").
    'return_activity', jsonb_build_object(
      'day1', jsonb_build_object('eligible', (select count(*) from cohort_days where age_days > 1), 'returned', (select count(*) from cohort_days d where d.age_days > 1 and exists (select 1 from active_days a where a.id = d.id and a.day = 1))),
      'day7', jsonb_build_object('eligible', (select count(*) from cohort_days where age_days > 7), 'returned', (select count(*) from cohort_days d where d.age_days > 7 and exists (select 1 from active_days a where a.id = d.id and a.day = 7))),
      'day14', jsonb_build_object('eligible', (select count(*) from cohort_days where age_days > 14), 'returned', (select count(*) from cohort_days d where d.age_days > 14 and exists (select 1 from active_days a where a.id = d.id and a.day = 14))),
      'days1to7', jsonb_build_object('eligible', (select count(*) from cohort_days where age_days > 7), 'returned', (select count(*) from cohort_days d where d.age_days > 7 and exists (select 1 from active_days a where a.id = d.id and a.day between 1 and 7)))
    ),
    'abandonment', jsonb_build_object(
      'workouts_started', (select count(*) from cohort_workouts),
      'discarded', (select count(*) from public.activation_events e join cohort c on c.id = e.user_id where e.event = 'workout_abandoned'),
      'left_in_progress_24h', (select count(*) from stale),
      'first_workout_abandoned', (select count(*) from first_workout fw where fw.client_id is not null and (
        exists (select 1 from public.activation_events e where e.user_id = fw.id and e.workout_client_id = fw.client_id and e.event = 'workout_abandoned')
        or exists (select 1 from stale s where s.user_id = fw.id and s.client_id = fw.client_id)))
    ),
    'returning_members', jsonb_build_object(
      'trained_in_window', (select count(distinct e.user_id) from public.activation_events e join public.profiles p on p.id = e.user_id
        where p.created_at < p_from and e.event = 'workout_completed' and e.occurred_at >= p_from and e.occurred_at < p_to
          and (p_include_test or not public.activation_is_test_account(p.id))),
      'workouts_completed', (select count(*) from public.activation_events e join public.profiles p on p.id = e.user_id
        where p.created_at < p_from and e.event = 'workout_completed' and e.occurred_at >= p_from and e.occurred_at < p_to
          and (p_include_test or not public.activation_is_test_account(p.id)))
    )
  ) into result;
  return result;
end;
$$;
revoke execute on function public.admin_activation_metrics(timestamptz, timestamptz, boolean) from anon, public;
grant execute on function public.admin_activation_metrics(timestamptz, timestamptz, boolean) to authenticated;
