-- Narrow Gate Fitness — live GPS runs and walks, running goals (basic tracking is free).
--
-- GPS recordings already fit the activities table (source 'gps', route, splits, moving vs elapsed time, private by
-- default, one save per client-generated id). This adds limits on what a recording can store, a note of the signal
-- quality (so gaps are shown honestly), an optional link to the program session a guided run completed, and
-- running goals.

alter table public.activities
  add column gps_quality jsonb check (gps_quality is null or (jsonb_typeof(gps_quality) = 'object' and octet_length(gps_quality::text) <= 1000)),
  add column workout_session_id uuid references public.workout_sessions (id) on delete set null;

-- Keep a single recording to a sane size (the app simplifies routes to at most 2,000 points before saving).
alter table public.activities
  add constraint activities_route_size check (route is null or (jsonb_typeof(route) = 'object' and octet_length(route::text) <= 150000)),
  add constraint activities_splits_size check (splits is null or jsonb_array_length(splits) <= 600);

-- Running goals: a weekly or monthly distance, or a target time for a distance (e.g. 5 km in 28:00).
create table public.running_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('weekly_distance', 'monthly_distance', 'race_time')),
  distance_m numeric(9, 1) not null check (distance_m > 0 and distance_m <= 1000000),
  target_s integer check (target_s is null or target_s between 60 and 172800),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  check ((kind = 'race_time') = (target_s is not null))
);
create index running_goals_user_idx on public.running_goals (user_id, created_at desc);

alter table public.running_goals enable row level security;
create policy running_goals_select_own on public.running_goals for select to authenticated using (user_id = (select auth.uid()));
create policy running_goals_insert_own on public.running_goals for insert to authenticated with check (user_id = (select auth.uid()));
create policy running_goals_update_own on public.running_goals for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy running_goals_delete_own on public.running_goals for delete to authenticated using (user_id = (select auth.uid()));

-- At most 10 open goals per member.
create or replace function public.enforce_running_goal_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('running_goals:' || new.user_id::text, 0));
  if (select count(*) from public.running_goals where user_id = new.user_id and archived_at is null) >= 10 then
    raise exception 'running_goal_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger running_goals_limit before insert on public.running_goals
  for each row execute function public.enforce_running_goal_limit();
