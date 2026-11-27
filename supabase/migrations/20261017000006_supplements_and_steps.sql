-- Narrow Gate Fitness — supplement stack, supplement check-offs and daily steps.
-- Supplement ids refer to the built-in reference list in the app (src/data/supplements.ts).
-- All rows are private to their owner (no admin access).

create table public.supplement_stack (
  user_id uuid not null references auth.users (id) on delete cascade,
  supplement_id text not null check (char_length(supplement_id) between 1 and 64),
  added_at timestamptz not null default now(),
  primary key (user_id, supplement_id)
);

create table public.supplement_logs (
  user_id uuid not null references auth.users (id) on delete cascade,
  supplement_id text not null check (char_length(supplement_id) between 1 and 64),
  taken_on date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, supplement_id, taken_on)
);
create index supplement_logs_user_day_idx on public.supplement_logs (user_id, taken_on desc);

create table public.daily_steps (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  steps integer not null check (steps between 0 and 200000),
  source text not null default 'manual' check (source in ('manual', 'apple_health', 'health_connect')),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
create trigger daily_steps_updated_at before update on public.daily_steps
  for each row execute function public.set_updated_at();

-- Daily step goal (users may update it; column-level grant like the other self-editable profile fields).
alter table public.profiles
  add column if not exists step_goal integer not null default 8000 check (step_goal between 1000 and 50000);
grant update (step_goal) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: owner-only
-- ---------------------------------------------------------------------------
alter table public.supplement_stack enable row level security;
alter table public.supplement_logs enable row level security;
alter table public.daily_steps enable row level security;

create policy supplement_stack_select_own on public.supplement_stack
  for select to authenticated using (user_id = (select auth.uid()));
create policy supplement_stack_insert_own on public.supplement_stack
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy supplement_stack_update_own on public.supplement_stack
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy supplement_stack_delete_own on public.supplement_stack
  for delete to authenticated using (user_id = (select auth.uid()));

create policy supplement_logs_select_own on public.supplement_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy supplement_logs_insert_own on public.supplement_logs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy supplement_logs_update_own on public.supplement_logs
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy supplement_logs_delete_own on public.supplement_logs
  for delete to authenticated using (user_id = (select auth.uid()));

create policy daily_steps_select_own on public.daily_steps
  for select to authenticated using (user_id = (select auth.uid()));
create policy daily_steps_insert_own on public.daily_steps
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy daily_steps_update_own on public.daily_steps
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy daily_steps_delete_own on public.daily_steps
  for delete to authenticated using (user_id = (select auth.uid()));
