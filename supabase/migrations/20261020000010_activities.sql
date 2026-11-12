-- Narrow Gate Fitness — runs and walks ("activities").
--
-- One row per run or walk. The row id is the stable activity id: the client generates it before
-- the first save, so a double-submitted form or a retried upload is a no-op instead of a duplicate,
-- and badges/records derived from activities can key on it.
--
-- Decisions (see docs/RUN_TRACKING_PLAN.md):
-- * distance_m may be null only for a time-only manual entry ("a 30-minute walk"). Treadmill and
--   GPS activities always have a distance. Pace is never stored: it's computed in code from
--   distance_m and moving_s, so there is one source of truth.
-- * moving_s excludes paused time and is never more than elapsed_s. Manual entries default it to
--   elapsed_s when the user doesn't know their moving time.
-- * route is only allowed for GPS activities, so manual/treadmill entries can never carry a route.
-- * Soft delete (deleted_at): reads filter it out; records and badges recalculate from the
--   remaining rows. The owner can also hard-delete (and account deletion cascades).
-- * Duplicate imports: external_id (a wearable/health-app workout id) is unique per user and
--   source, and two live GPS recordings can't start at the same instant.

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('run', 'walk')),
  source text not null check (source in ('manual', 'treadmill', 'gps')),
  started_at timestamptz not null,
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  distance_m numeric(9, 2) check (distance_m is null or (distance_m >= 0 and distance_m <= 500000)),
  elapsed_s integer not null check (elapsed_s between 1 and 172800),
  moving_s integer not null check (moving_s >= 1),
  notes text check (notes is null or char_length(notes) <= 2000),
  perceived_effort smallint check (perceived_effort is null or perceived_effort between 1 and 10),
  route jsonb,
  splits jsonb check (splits is null or jsonb_typeof(splits) = 'array'),
  external_id text check (external_id is null or char_length(external_id) between 1 and 128),
  is_private boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint activities_moving_le_elapsed check (moving_s <= elapsed_s),
  constraint activities_distance_required check (distance_m is not null or source = 'manual'),
  constraint activities_route_gps_only check (route is null or source = 'gps')
);

create index activities_user_started_idx on public.activities (user_id, started_at desc) where deleted_at is null;
create unique index activities_user_source_external_uidx on public.activities (user_id, source, external_id)
  where external_id is not null;
create unique index activities_user_gps_started_uidx on public.activities (user_id, source, started_at)
  where source = 'gps' and deleted_at is null;

create trigger activities_updated_at before update on public.activities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: owner-only (no admin access; routes are private data)
-- ---------------------------------------------------------------------------
alter table public.activities enable row level security;

create policy activities_select_own on public.activities
  for select to authenticated using (user_id = (select auth.uid()));
create policy activities_insert_own on public.activities
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy activities_update_own on public.activities
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy activities_delete_own on public.activities
  for delete to authenticated using (user_id = (select auth.uid()));
