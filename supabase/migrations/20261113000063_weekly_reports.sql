-- ROLLBACK (removes the weekly reports and nothing else; workouts, food, runs, sleep and weight are untouched):
--   drop table if exists public.weekly_reports;
--   alter table public.ai_usage_events drop constraint if exists ai_usage_events_kind_check;
--   alter table public.ai_usage_events add constraint ai_usage_events_kind_check
--     check (kind in ('chat', 'plan', 'meal_plan', 'food_photo', 'food_explain'));
--   (the second step fails while weekly_report usage rows exist; delete those rows first or leave the wider check)
-- Roll back the app code first: /progress/reports and the weekly-report job read and write this table.
--
-- Weekly progress reports (Pro). One row per member per Monday–Sunday week (the member's own time zone), written
-- only by the server: the scheduled job or the member opening their reports. The unique key makes generation
-- retry-safe: a second attempt for the same week finds the row and does nothing.
--
-- `metrics` holds the aggregates computed from the member's own records (counts, totals, averages; no food names,
-- notes, journal text or photos). `analysis` is the written part: rule-based or AI, as `analysis_source` says.
create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  time_zone text not null check (char_length(time_zone) between 1 and 64),
  metrics jsonb not null,
  analysis jsonb not null,
  analysis_source text not null check (analysis_source in ('rules', 'ai')),
  model text,
  generated_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, week_start)
);
create index if not exists weekly_reports_user_week on public.weekly_reports (user_id, week_start desc);

alter table public.weekly_reports enable row level security;

-- Members read and delete their own reports and can mark them read; only the server (service role) creates them.
drop policy if exists weekly_reports_select_own on public.weekly_reports;
create policy weekly_reports_select_own on public.weekly_reports for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists weekly_reports_delete_own on public.weekly_reports;
create policy weekly_reports_delete_own on public.weekly_reports for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists weekly_reports_update_own on public.weekly_reports;
create policy weekly_reports_update_own on public.weekly_reports for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.weekly_reports from authenticated;
grant select, delete on public.weekly_reports to authenticated;
grant update (read_at) on public.weekly_reports to authenticated;

-- The AI write-up of a report counts against the member's monthly AI allowance like other AI requests.
alter table public.ai_usage_events drop constraint if exists ai_usage_events_kind_check;
alter table public.ai_usage_events add constraint ai_usage_events_kind_check
  check (kind in ('chat', 'plan', 'meal_plan', 'food_photo', 'food_explain', 'weekly_report'));
