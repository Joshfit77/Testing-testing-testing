-- Sleep & Recovery, Stage B4: a record of each health-platform import (Apple Health / Health Connect), so a member
-- can see what was brought in and a failed or repeated import never adds a record twice. The sessions themselves go
-- into sleep_sessions with their source and the platform's record id (unique per member and source), and overlaps
-- with anything already stored are refused by that table; the counts here say how many were added, skipped as
-- already imported, or skipped because they clashed with an existing entry.

create table public.sleep_import_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('apple_health', 'health_connect')),
  range_start timestamptz not null,
  range_end timestamptz not null,
  added integer not null default 0 check (added between 0 and 10000),
  duplicates integer not null default 0 check (duplicates between 0 and 10000),
  conflicts integer not null default 0 check (conflicts between 0 and 10000),
  -- The name of the device or app the platform attributed the records to, when it said.
  device text check (char_length(device) <= 120),
  created_at timestamptz not null default now(),
  check (range_end > range_start)
);
create index sleep_import_runs_user_idx on public.sleep_import_runs (user_id, created_at desc);

alter table public.sleep_import_runs enable row level security;
create policy sleep_import_runs_select_own on public.sleep_import_runs
  for select to authenticated using (user_id = (select auth.uid()));
create policy sleep_import_runs_insert_own on public.sleep_import_runs
  for insert to authenticated with check (user_id = (select auth.uid()) and public.can_log_sleep());
create policy sleep_import_runs_delete_own on public.sleep_import_runs
  for delete to authenticated using (user_id = (select auth.uid()));

-- Whether the member has switched automatic import off (records they already imported stay until deleted).
alter table public.profiles add column if not exists sleep_import_enabled boolean not null default true;
grant update (sleep_import_enabled) on public.profiles to authenticated;
