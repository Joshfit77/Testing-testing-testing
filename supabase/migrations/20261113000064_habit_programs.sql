-- ROLLBACK (removes habit-program enrollments and check-ins only; workouts, food, journal and Bible data untouched):
--   drop table if exists public.habit_program_checkins;
--   drop table if exists public.habit_program_enrollments;
-- Roll back the app code first: /train/habits reads and writes these tables.
--
-- Habit programs: structured nutrition, faith-and-fitness and lifestyle programs made of daily and weekly activities
-- (lessons, food logging, protein, workouts, optional Scripture, prayer and reflection) rather than sets and reps. The
-- program content lives in the app (src/data/habit-programs); the database keeps who is enrolled and what they did.
--
-- No restart rule: a missed day stays missed and the member carries on. (The strict-restart 40-day challenge and
-- reading journeys keep their own tables and rules, unchanged.)
--
-- Enrolling needs Pro (checked here, not only in the app). After Pro ends, a member keeps reading, exporting and
-- deleting what they recorded; ticking off new days needs Pro again.
create table if not exists public.habit_program_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_slug text not null check (program_slug ~ '^[a-z0-9-]{1,64}$'),
  started_on date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'stopped')),
  -- The member's own goals for this program (e.g. a protein target in grams), adjustable at any time.
  goals jsonb not null default '{}'::jsonb check (pg_column_size(goals) < 4000),
  completed_at timestamptz,
  stopped_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'completed' or completed_at is not null)
);
create unique index if not exists habit_program_one_active on public.habit_program_enrollments (user_id, program_slug) where status = 'active';
create index if not exists habit_program_enrollments_user on public.habit_program_enrollments (user_id, created_at desc);

create table if not exists public.habit_program_checkins (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.habit_program_enrollments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day_number smallint not null check (day_number between 1 and 120),
  activity_key text not null check (activity_key ~ '^[a-z0-9_-]{1,48}$'),
  -- A short answer to a weekly check-in question (never prayer or journal text: reflection lives in the private
  -- prayer journal, which keeps its own privacy settings).
  answer text check (char_length(answer) <= 500),
  checked_on date not null,
  created_at timestamptz not null default now(),
  unique (enrollment_id, day_number, activity_key)
);
create index if not exists habit_program_checkins_user on public.habit_program_checkins (user_id);

alter table public.habit_program_enrollments enable row level security;
alter table public.habit_program_checkins enable row level security;

drop policy if exists habit_enrollments_select_own on public.habit_program_enrollments;
create policy habit_enrollments_select_own on public.habit_program_enrollments for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists habit_enrollments_insert_pro on public.habit_program_enrollments;
create policy habit_enrollments_insert_pro on public.habit_program_enrollments for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'active' and public.has_plan('pro'));
drop policy if exists habit_enrollments_update_own on public.habit_program_enrollments;
create policy habit_enrollments_update_own on public.habit_program_enrollments for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists habit_enrollments_delete_own on public.habit_program_enrollments;
create policy habit_enrollments_delete_own on public.habit_program_enrollments for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.habit_program_enrollments from authenticated;
grant update (status, goals, completed_at, stopped_at) on public.habit_program_enrollments to authenticated;

drop policy if exists habit_checkins_select_own on public.habit_program_checkins;
create policy habit_checkins_select_own on public.habit_program_checkins for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists habit_checkins_insert_pro on public.habit_program_checkins;
create policy habit_checkins_insert_pro on public.habit_program_checkins for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_plan('pro')
    and exists (select 1 from public.habit_program_enrollments e where e.id = enrollment_id and e.user_id = (select auth.uid()) and e.status = 'active')
  );
drop policy if exists habit_checkins_delete_own on public.habit_program_checkins;
create policy habit_checkins_delete_own on public.habit_program_checkins for delete to authenticated using (user_id = (select auth.uid()));
