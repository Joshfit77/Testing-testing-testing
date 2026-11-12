-- Narrow Gate Fitness — adaptive training and recovery (Pro).
--
-- The training review (and the AI coach) suggest changes from the member's logs: a target load for the next
-- session, a recovery week, one more or one fewer set. Nothing changes unless the member accepts, and every accepted
-- change is recorded with what it replaced, so it can be reviewed and undone. Workout history is never touched.

-- Approved target loads, shown in the workout logger beside "Last time".
create table public.exercise_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  weight_kg numeric(6, 2) check (weight_kg > 0 and weight_kg <= 1000),
  reps smallint check (reps between 1 and 100),
  note text check (char_length(note) <= 300),
  source text not null check (source in ('review', 'coach')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, exercise_id)
);
create trigger exercise_targets_updated_at before update on public.exercise_targets
  for each row execute function public.set_updated_at();

-- Every accepted change, with the values it replaced (for review and undo).
create table public.training_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid references public.training_programs (id) on delete cascade,
  kind text not null check (kind in ('exercise_target', 'deload_week', 'volume_change')),
  summary text not null check (char_length(summary) <= 300),
  reason text check (char_length(reason) <= 1000),
  -- [{ "table": "program_exercises" | "program_weeks" | "exercise_targets", "id": uuid, "before": {...}, "after": {...} }]
  changes jsonb not null default '[]',
  source text not null check (source in ('review', 'coach')),
  recommendation_key text check (char_length(recommendation_key) <= 200),
  source_message_id uuid references public.ai_messages (id) on delete set null,
  created_at timestamptz not null default now(),
  reverted_at timestamptz
);
create index training_adjustments_user_idx on public.training_adjustments (user_id, created_at desc);

-- Recommendations the member accepted or turned down, so they aren't offered again.
create table public.training_recommendation_decisions (
  user_id uuid not null references auth.users (id) on delete cascade,
  recommendation_key text not null check (char_length(recommendation_key) <= 200),
  decision text not null check (decision in ('accepted', 'rejected')),
  decided_at timestamptz not null default now(),
  primary key (user_id, recommendation_key)
);

alter table public.exercise_targets enable row level security;
alter table public.training_adjustments enable row level security;
alter table public.training_recommendation_decisions enable row level security;

-- Members always see and can remove their own rows (also after a downgrade); creating or changing them needs Pro.
create policy exercise_targets_select_own on public.exercise_targets for select to authenticated using (user_id = (select auth.uid()));
create policy exercise_targets_delete_own on public.exercise_targets for delete to authenticated using (user_id = (select auth.uid()));
create policy exercise_targets_insert_own on public.exercise_targets for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_ai_coach());
create policy exercise_targets_update_own on public.exercise_targets for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.has_ai_coach());

create policy training_adjustments_select_own on public.training_adjustments for select to authenticated using (user_id = (select auth.uid()));
create policy training_adjustments_delete_own on public.training_adjustments for delete to authenticated using (user_id = (select auth.uid()));
create policy training_adjustments_insert_own on public.training_adjustments for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_ai_coach());
-- Only the undo mark can change.
create policy training_adjustments_update_own on public.training_adjustments for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.training_adjustments from authenticated;
grant update (reverted_at) on public.training_adjustments to authenticated;

create policy training_decisions_select_own on public.training_recommendation_decisions for select to authenticated using (user_id = (select auth.uid()));
create policy training_decisions_delete_own on public.training_recommendation_decisions for delete to authenticated using (user_id = (select auth.uid()));
create policy training_decisions_insert_own on public.training_recommendation_decisions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_ai_coach());
create policy training_decisions_update_own on public.training_recommendation_decisions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.has_ai_coach());
