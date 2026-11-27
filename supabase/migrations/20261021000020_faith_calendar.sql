-- Narrow Gate Fitness — Stage 2C: prayer journal, daily practices, faith reminders, secondary goal and
-- training-calendar reschedules (SPEC §3, §4, §12).
--
-- Every new table is private to its owner: owner-only RLS for select / insert / update / delete, no admin
-- access, and rows cascade away with the auth user on account deletion.

-- ---------------------------------------------------------------------------
-- Prayer journal: entry type, answered prayers and the AI-coach opt-in.
-- ---------------------------------------------------------------------------
-- kind: 'reflection' (general), 'request' (a prayer request) or 'praise' (praise / thanksgiving).
-- A request can be marked answered (answered_on + optional note).
-- share_with_coach is OFF by default: the AI coach only ever sees entries the user ticked.
alter table public.faith_journal_entries
  add column kind text not null default 'reflection' check (kind in ('reflection', 'request', 'praise')),
  add column answered_on date,
  add column answered_note text check (char_length(answered_note) <= 2000),
  add column share_with_coach boolean not null default false,
  add constraint faith_journal_answered_note_needs_date check (answered_note is null or answered_on is not null);

create index faith_journal_user_kind_idx on public.faith_journal_entries (user_id, kind, entry_date desc);

-- ---------------------------------------------------------------------------
-- Daily practices reuse discipline_goals / discipline_checkins. `practice` names the preset
-- (Scripture reading, prayer, gratitude, fasting, worship, rest/Sabbath) or 'custom'.
-- ---------------------------------------------------------------------------
alter table public.discipline_goals
  add column practice text not null default 'custom'
    check (practice in ('scripture', 'prayer', 'gratitude', 'fasting', 'worship', 'rest', 'custom'));

-- One active row per preset practice (custom practices can repeat).
create unique index discipline_goals_one_preset_idx on public.discipline_goals (user_id, practice)
  where practice <> 'custom' and is_active;

-- ---------------------------------------------------------------------------
-- Faith reminders: optional, off by default (no row = off). Delivered as local notifications by the
-- iPhone / Android app; the web app only stores the settings.
-- ---------------------------------------------------------------------------
create table public.faith_reminders (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('devotional', 'prayer', 'practices')),
  enabled boolean not null default false,
  remind_at time not null default '07:00',
  -- JavaScript weekdays: 0 = Sunday … 6 = Saturday.
  weekdays smallint[] not null default '{0,1,2,3,4,5,6}'
    check (cardinality(weekdays) <= 7 and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
create trigger faith_reminders_updated_at before update on public.faith_reminders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Secondary goal (optional, onboarding).
-- ---------------------------------------------------------------------------
alter table public.onboarding_answers
  add column secondary_goal text check (secondary_goal in (
    'build_strength', 'build_muscle', 'lose_fat', 'improve_conditioning', 'athletic_performance',
    'combat_sports', 'general_health', 'mobility', 'run_5k'
  ));

-- ---------------------------------------------------------------------------
-- Training calendar: a planned program session moved to another date. Keyed by the enrolment and the
-- program day, so completed workouts (workout_sessions) are never touched by a reschedule.
-- ---------------------------------------------------------------------------
create table public.planned_session_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_program_id uuid not null references public.user_programs (id) on delete cascade,
  program_day_id uuid not null references public.program_days (id) on delete cascade,
  planned_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planned_session_overrides_unique unique (user_program_id, program_day_id)
);
create index planned_session_overrides_user_idx on public.planned_session_overrides (user_id, planned_date);
create trigger planned_session_overrides_updated_at before update on public.planned_session_overrides
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: owner-only
-- ---------------------------------------------------------------------------
alter table public.faith_reminders enable row level security;
alter table public.planned_session_overrides enable row level security;

create policy faith_reminders_select_own on public.faith_reminders
  for select to authenticated using (user_id = (select auth.uid()));
create policy faith_reminders_insert_own on public.faith_reminders
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy faith_reminders_update_own on public.faith_reminders
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy faith_reminders_delete_own on public.faith_reminders
  for delete to authenticated using (user_id = (select auth.uid()));

-- The row and the enrolment it reschedules must both be the user's own.
create policy planned_session_overrides_select_own on public.planned_session_overrides
  for select to authenticated using (user_id = (select auth.uid()));
create policy planned_session_overrides_insert_own on public.planned_session_overrides
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.user_programs up where up.id = user_program_id and up.user_id = (select auth.uid()))
  );
create policy planned_session_overrides_update_own on public.planned_session_overrides
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.user_programs up where up.id = user_program_id and up.user_id = (select auth.uid()))
  );
create policy planned_session_overrides_delete_own on public.planned_session_overrides
  for delete to authenticated using (user_id = (select auth.uid()));

comment on table public.faith_reminders is 'Optional devotional / prayer / practice reminder settings (off by default). Owner-only.';
comment on table public.planned_session_overrides is 'Planned program sessions moved to another date on the training calendar. Owner-only.';
comment on column public.faith_journal_entries.share_with_coach is 'Off by default. Only entries with this set are ever included in the AI coach context.';
