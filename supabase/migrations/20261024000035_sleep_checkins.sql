-- Sleep & Recovery, Stage B5: brief, optional morning and daily check-ins. One row per member and day; every field
-- is optional so a check-in can be a single tap. A row's `day` is the day the member woke up, so it lines up with
-- the night listed under that date (sleep_sessions.night_of). Evening habits (caffeine, alcohol, late meal, screens)
-- describe the evening before that night. Same wellness consent as sleep sessions; viewing and deleting never need it.

create table public.sleep_checkins (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  -- 1 (low) – 5 (high) ratings.
  restedness smallint check (restedness between 1 and 5),
  energy_morning smallint check (energy_morning between 1 and 5),
  energy_afternoon smallint check (energy_afternoon between 1 and 5),
  energy_evening smallint check (energy_evening between 1 and 5),
  mood smallint check (mood between 1 and 5),
  stress smallint check (stress between 1 and 5),
  sleep_quality smallint check (sleep_quality between 1 and 5),
  -- Last caffeine the day before, as a clock time (null = not answered or none).
  caffeine_last time,
  alcohol boolean,
  late_meal boolean,
  exercise_timing text check (exercise_timing in ('none', 'morning', 'afternoon', 'evening')),
  evening_screens boolean,
  disturbances text[] not null default '{}'
    check (cardinality(disturbances) <= 12 and disturbances <@ array['noise', 'light', 'heat', 'cold', 'partner', 'pet', 'child', 'pain', 'bathroom', 'worry', 'other']::text[]),
  travel boolean,
  -- Free text the member chose to record (never a recommendation).
  sleep_aid text check (char_length(sleep_aid) <= 120),
  notes text check (char_length(notes) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
create trigger sleep_checkins_updated_at before update on public.sleep_checkins
  for each row execute function public.set_updated_at();

alter table public.sleep_checkins enable row level security;

create policy sleep_checkins_select_own on public.sleep_checkins
  for select to authenticated using (user_id = (select auth.uid()));
create policy sleep_checkins_insert_own on public.sleep_checkins
  for insert to authenticated with check (user_id = (select auth.uid()) and public.can_log_sleep());
create policy sleep_checkins_update_own on public.sleep_checkins
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.can_log_sleep());
create policy sleep_checkins_delete_own on public.sleep_checkins
  for delete to authenticated using (user_id = (select auth.uid()));
