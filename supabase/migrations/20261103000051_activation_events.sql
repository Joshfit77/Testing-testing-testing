-- First-workout activation, measured on the server (launch-critical item 1).
--
-- What it records: four facts about a member's own workouts, each once per workout, with a timestamp and nothing
-- else (no exercises, weights, notes or device data):
--   workout_started    the server first saw the workout (the logger saves it once the member does something)
--   set_completed      the server first saw a completed set in it
--   workout_completed  it was finished and saved
--   workout_abandoned  it was discarded while still in progress
-- Account creation and onboarding come from profiles (created_at, onboarding_completed_at), which already exist.
--
-- Server-validated: rows are written only by these triggers, from the workout rows the server itself stores. Members
-- can read their own rows (they are part of the data export) but cannot insert, change or delete any. No-duplicate by
-- construction: one row per (member, event, workout). First-party only: nothing leaves the database, and the rows
-- are deleted with the account (on delete cascade).

create table public.activation_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  event text not null check (event in ('workout_started', 'set_completed', 'workout_completed', 'workout_abandoned')),
  -- The workout's client id (workout_sessions.client_id): stable across retries, devices and the discard.
  workout_client_id uuid not null,
  occurred_at timestamptz not null,
  -- How the server learned it: a draft sync, the finish, the discard, or this migration's backfill of old workouts.
  source text not null check (source in ('sync', 'finish', 'discard', 'backfill')),
  created_at timestamptz not null default now(),
  unique (user_id, event, workout_client_id)
);
create index activation_events_user_event_idx on public.activation_events (user_id, event, occurred_at);

alter table public.activation_events enable row level security;
create policy "activation_events: read own" on public.activation_events for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.activation_events from anon, authenticated;
grant select on public.activation_events to authenticated;

-- A workout's started time as the server will believe it: the client's own start, but never in the future and never
-- more than two days before the server first saw it.
create or replace function public.activation_clamp_start(p_started timestamptz)
returns timestamptz
language sql
stable
as $$
  select greatest(least(p_started, now()), now() - interval '2 days');
$$;

create or replace function public.activation_has_completed_set(p_draft jsonb)
returns boolean
language sql
immutable
as $$
  select p_draft is not null and jsonb_path_exists(p_draft, '$.exercises[*].sets[*] ? (@.completed == true)');
$$;

create or replace function public.activation_record(p_user uuid, p_event text, p_client uuid, p_at timestamptz, p_source text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.activation_events (user_id, event, workout_client_id, occurred_at, source)
  values (p_user, p_event, p_client, p_at, p_source)
  on conflict (user_id, event, workout_client_id) do nothing;
$$;
revoke execute on function public.activation_record(uuid, text, uuid, timestamptz, text) from anon, authenticated, public;

create or replace function public.activation_on_workout_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.activation_record(new.user_id, 'workout_started', new.client_id, public.activation_clamp_start(new.started_at), case when new.draft is not null then 'sync' else 'finish' end);
  end if;
  if new.status = 'in_progress' and public.activation_has_completed_set(new.draft)
     and (tg_op = 'INSERT' or not public.activation_has_completed_set(old.draft)) then
    perform public.activation_record(new.user_id, 'set_completed', new.client_id, now(), 'sync');
  end if;
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    -- Finished without the server ever seeing a completed set (a workout logged entirely offline): the first set is
    -- known only to have happened by the finish.
    if exists (select 1 from public.workout_sets s where s.user_id = new.user_id and s.completed
               and s.workout_exercise_id in (select e.id from public.workout_exercises e where e.session_id = new.id)) then
      perform public.activation_record(new.user_id, 'set_completed', new.client_id, least(coalesce(new.ended_at, now()), now()), 'finish');
    end if;
    perform public.activation_record(new.user_id, 'workout_completed', new.client_id, least(coalesce(new.ended_at, now()), now()), 'finish');
  end if;
  return null;
end;
$$;

create trigger workout_sessions_activation_write
  after insert or update of status, draft on public.workout_sessions
  for each row execute function public.activation_on_workout_write();

create or replace function public.activation_on_workout_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only a discard of a workout still in progress. Deleting a finished workout from history is not abandonment, and
  -- when the whole account is being deleted (the sign-in row is already gone) nothing is recorded.
  if old.status = 'in_progress' and exists (select 1 from auth.users u where u.id = old.user_id) then
    perform public.activation_record(old.user_id, 'workout_abandoned', old.client_id, now(), 'discard');
  end if;
  return null;
end;
$$;

create trigger workout_sessions_activation_delete
  after delete on public.workout_sessions
  for each row execute function public.activation_on_workout_delete();

-- Workouts from before this migration: their starts and finishes are known; when their first sets happened is not.
insert into public.activation_events (user_id, event, workout_client_id, occurred_at, source)
select user_id, 'workout_started', client_id, started_at, 'backfill' from public.workout_sessions
on conflict do nothing;
insert into public.activation_events (user_id, event, workout_client_id, occurred_at, source)
select user_id, 'workout_completed', client_id, coalesce(ended_at, updated_at), 'backfill' from public.workout_sessions where status = 'completed'
on conflict do nothing;

-- Admin-only cohort summary. New members are the accounts created in [p_from, p_to); returning members are older
-- accounts that trained in that window. Aggregates only; no member is identifiable from it except in a tiny cohort,
-- which the admin page says. Times are minutes (medians), days are the member's own calendar days (their time zone).
create or replace function public.admin_activation_metrics(p_from timestamptz default now() - interval '30 days', p_to timestamptz default now())
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
  with cohort as (
    select p.id, p.created_at, p.onboarding_completed_at, coalesce(nullif(p.timezone, ''), 'UTC') as tz
    from public.profiles p
    where p.created_at >= p_from and p.created_at < p_to
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
        where p.created_at < p_from and e.event = 'workout_completed' and e.occurred_at >= p_from and e.occurred_at < p_to),
      'workouts_completed', (select count(*) from public.activation_events e join public.profiles p on p.id = e.user_id
        where p.created_at < p_from and e.event = 'workout_completed' and e.occurred_at >= p_from and e.occurred_at < p_to)
    )
  ) into result;
  return result;
end;
$$;
revoke execute on function public.admin_activation_metrics(timestamptz, timestamptz) from anon, public;
grant execute on function public.admin_activation_metrics(timestamptz, timestamptz) to authenticated;
