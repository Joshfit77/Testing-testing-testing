-- Narrow Gate Fitness — Stage 2B training (SPEC §5, §6).
--
--   * training_programs.needs_specialist_review: specialist programming (show prep, meet prep, combat, active
--     aging) that a qualified coach has not reviewed yet. The app shows "Not yet reviewed by a qualified coach".
--   * profiles.rest_timer_sound / rest_timer_vibrate: optional rest-timer alerts in the workout logger.
--   * workout_templates + workout_template_exercises: saved custom workouts (order, sets, reps / time /
--     distance, rest, supersets). Private to their owner, cascade on account deletion, included in the export.

alter table public.training_programs
  add column if not exists needs_specialist_review boolean not null default false;

alter table public.profiles
  add column if not exists rest_timer_sound boolean not null default true,
  add column if not exists rest_timer_vibrate boolean not null default true;
grant update (rest_timer_sound, rest_timer_vibrate) on public.profiles to authenticated;

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_templates_user_idx on public.workout_templates (user_id, updated_at desc);
create trigger workout_templates_updated_at before update on public.workout_templates
  for each row execute function public.set_updated_at();

-- One row per exercise, in order. `target` says what each set prescribes: reps, a time or a distance.
-- Exercises sharing a `superset_group` (1–20) within a template are done as a superset: one set of each in
-- turn, with rest only after the round.
create table public.workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position smallint not null check (position between 0 and 39),
  sets smallint not null check (sets between 1 and 20),
  target text not null default 'reps' check (target in ('reps', 'time', 'distance')),
  reps text check (char_length(reps) between 1 and 20),
  duration_seconds integer check (duration_seconds between 5 and 7200),
  distance_m numeric(8, 1) check (distance_m > 0 and distance_m <= 100000),
  rest_seconds smallint not null default 90 check (rest_seconds between 0 and 900),
  superset_group smallint check (superset_group between 1 and 20),
  notes text check (char_length(notes) <= 500),
  unique (template_id, position),
  check (
    (target = 'reps' and reps is not null)
    or (target = 'time' and duration_seconds is not null)
    or (target = 'distance' and distance_m is not null)
  )
);
create index workout_template_exercises_template_idx on public.workout_template_exercises (template_id, position);
create index workout_template_exercises_exercise_idx on public.workout_template_exercises (exercise_id);

alter table public.workout_templates enable row level security;
alter table public.workout_template_exercises enable row level security;

create policy workout_templates_select_own on public.workout_templates
  for select to authenticated using (user_id = (select auth.uid()));
create policy workout_templates_insert_own on public.workout_templates
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy workout_templates_update_own on public.workout_templates
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy workout_templates_delete_own on public.workout_templates
  for delete to authenticated using (user_id = (select auth.uid()));

-- Children: the row and its parent template must both be the user's own.
create policy workout_template_exercises_select_own on public.workout_template_exercises
  for select to authenticated using (user_id = (select auth.uid()));
create policy workout_template_exercises_insert_own on public.workout_template_exercises
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_templates t where t.id = template_id and t.user_id = (select auth.uid()))
  );
create policy workout_template_exercises_update_own on public.workout_template_exercises
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_templates t where t.id = template_id and t.user_id = (select auth.uid()))
  );
create policy workout_template_exercises_delete_own on public.workout_template_exercises
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.workout_templates, public.workout_template_exercises to authenticated;
