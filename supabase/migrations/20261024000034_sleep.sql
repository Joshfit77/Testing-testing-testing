-- Sleep & Recovery, Stage B1: nights and naps a member logs by hand or with the in-app timer, and (Stage B4) records
-- imported from Apple Health / Health Connect or a wearable. Times are timestamptz; the IANA zone a session was logged
-- in is kept so clock times display as the member saw them, and `night_of` is the local date they got up (computed
-- on the server). Nothing here measures sleep stages or physiology: the app's own entries only know when the member
-- was in bed and, if they said so, when they think they fell asleep and woke. Stage intervals exist only for imported
-- records. Logging needs the same "optional wellness information" consent as recovery check-ins
-- (profiles.wellness_consent_at); viewing and deleting never do, so withdrawing consent never traps data.

create extension if not exists btree_gist;

-- The member's sleep goal (4–12 hours), editable like the other self-service profile fields.
alter table public.profiles
  add column if not exists sleep_goal_minutes smallint not null default 480 check (sleep_goal_minutes between 240 and 720);
grant update (sleep_goal_minutes) on public.profiles to authenticated;

create or replace function public.can_log_sleep()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.wellness_consent_at is not null);
$$;
revoke all on function public.can_log_sleep() from public, anon;
grant execute on function public.can_log_sleep() to authenticated, service_role;

create table public.sleep_sessions (
  -- Generated on the device before saving, so a retried save can't create a second session.
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'night' check (kind in ('night', 'nap')),
  -- Got into bed / got out of bed (null while the timer runs).
  started_at timestamptz not null,
  ended_at timestamptz,
  -- Optional detail the member gave: when they think they fell asleep and finally woke, and time awake in between.
  onset_at timestamptz,
  final_wake_at timestamptz,
  awakenings smallint check (awakenings between 0 and 50),
  awake_minutes smallint check (awake_minutes between 0 and 1440),
  timezone text not null check (char_length(timezone) between 1 and 64),
  night_of date not null,
  source text not null default 'manual' check (source in ('manual', 'timer', 'apple_health', 'health_connect', 'wearable')),
  -- The record's id in its source, so one import can't be added twice. The app's own entries have none.
  source_id text check (char_length(source_id) between 1 and 200),
  notes text check (char_length(notes) <= 280),
  -- Where the session ends for overlap checks: ended_at, or 20 hours after bedtime while a timer runs. Kept by the
  -- trigger below (an index expression can't compute it: timestamptz + interval isn't immutable).
  overlap_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at > started_at),
  check (ended_at is null or ended_at - started_at <= interval '24 hours'),
  check (onset_at is null or (onset_at >= started_at and (ended_at is null or onset_at <= ended_at))),
  check (final_wake_at is null or (final_wake_at >= coalesce(onset_at, started_at) and (ended_at is null or final_wake_at <= ended_at))),
  check ((source in ('manual', 'timer')) = (source_id is null)),
  check (overlap_until > started_at),
  unique (user_id, source, source_id),
  -- A member's sessions never overlap, whatever their source.
  exclude using gist (user_id with =, tstzrange(started_at, overlap_until, '[)') with &&)
);
create index sleep_sessions_user_night_idx on public.sleep_sessions (user_id, night_of desc);
create index sleep_sessions_user_started_idx on public.sleep_sessions (user_id, started_at desc);

create or replace function public.sleep_session_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.overlap_until := coalesce(new.ended_at, new.started_at + interval '20 hours');
  return new;
end;
$$;
create trigger sleep_sessions_prepare before insert or update on public.sleep_sessions
  for each row execute function public.sleep_session_prepare();
create trigger sleep_sessions_updated_at before update on public.sleep_sessions
  for each row execute function public.set_updated_at();

-- Stage intervals supplied by a health platform or wearable for one imported session. The app never writes its own.
create table public.sleep_stages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sleep_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  stage text not null check (stage in ('awake', 'light', 'deep', 'rem', 'asleep', 'unknown')),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  check (ended_at > started_at),
  check (ended_at - started_at <= interval '24 hours')
);
create index sleep_stages_session_idx on public.sleep_stages (session_id, started_at);
create index sleep_stages_user_idx on public.sleep_stages (user_id);

alter table public.sleep_sessions enable row level security;
alter table public.sleep_stages enable row level security;

create policy sleep_sessions_select_own on public.sleep_sessions
  for select to authenticated using (user_id = (select auth.uid()));
create policy sleep_sessions_insert_own on public.sleep_sessions
  for insert to authenticated with check (user_id = (select auth.uid()) and public.can_log_sleep());
create policy sleep_sessions_update_own on public.sleep_sessions
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.can_log_sleep());
create policy sleep_sessions_delete_own on public.sleep_sessions
  for delete to authenticated using (user_id = (select auth.uid()));

create policy sleep_stages_select_own on public.sleep_stages
  for select to authenticated using (user_id = (select auth.uid()));
create policy sleep_stages_delete_own on public.sleep_stages
  for delete to authenticated using (user_id = (select auth.uid()));
-- Stages belong to the member's own imported session only.
create policy sleep_stages_insert_own on public.sleep_stages
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and public.can_log_sleep()
    and exists (
      select 1 from public.sleep_sessions s
      where s.id = session_id and s.user_id = (select auth.uid()) and s.source not in ('manual', 'timer')
    )
  );

-- At most 4,000 sessions per member (about ten years of nights and naps), checked under a per-member lock.
create or replace function public.sleep_session_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('sleep_sessions:' || new.user_id::text));
  if (select count(*) from public.sleep_sessions where user_id = new.user_id) >= 4000 then
    raise exception 'sleep_session_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger sleep_sessions_limit before insert on public.sleep_sessions for each row execute function public.sleep_session_limit();
