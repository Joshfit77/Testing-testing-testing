-- Narrow Gate Fitness — faith & fitness challenges ("40 Days Through the Narrow Gate").
-- Part of the optional Faith section. Rows are private to their owner (no admin access).

create table public.challenge_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_slug text not null check (char_length(challenge_slug) between 1 and 64),
  started_on date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'completed' or completed_at is not null)
);
-- At most one active enrollment per user and challenge.
create unique index challenge_enrollments_one_active_idx
  on public.challenge_enrollments (user_id, challenge_slug) where status = 'active';
create index challenge_enrollments_user_idx on public.challenge_enrollments (user_id, created_at desc);

create table public.challenge_checkins (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.challenge_enrollments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day_number smallint not null check (day_number between 1 and 40),
  devotional_done boolean not null default false,
  workout_done boolean not null default false,
  note text check (char_length(note) <= 1000),
  checked_on date not null,
  created_at timestamptz not null default now(),
  unique (enrollment_id, day_number)
);
create index challenge_checkins_user_idx on public.challenge_checkins (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: owner-only
-- ---------------------------------------------------------------------------
alter table public.challenge_enrollments enable row level security;
alter table public.challenge_checkins enable row level security;

create policy challenge_enrollments_select_own on public.challenge_enrollments
  for select to authenticated using (user_id = (select auth.uid()));
create policy challenge_enrollments_insert_own on public.challenge_enrollments
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy challenge_enrollments_update_own on public.challenge_enrollments
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy challenge_enrollments_delete_own on public.challenge_enrollments
  for delete to authenticated using (user_id = (select auth.uid()));

create policy challenge_checkins_select_own on public.challenge_checkins
  for select to authenticated using (user_id = (select auth.uid()));
create policy challenge_checkins_insert_own on public.challenge_checkins
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.challenge_enrollments e where e.id = enrollment_id and e.user_id = (select auth.uid()))
  );
create policy challenge_checkins_update_own on public.challenge_checkins
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.challenge_enrollments e where e.id = enrollment_id and e.user_id = (select auth.uid()))
  );
create policy challenge_checkins_delete_own on public.challenge_checkins
  for delete to authenticated using (user_id = (select auth.uid()));
