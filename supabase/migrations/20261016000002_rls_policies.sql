-- Narrow Gate Fitness — Row Level Security
-- Principle: every user-owned row is visible/mutable only by its owner.
-- Admins manage the public catalog (exercises, programs, content, flags) but
-- are NOT granted access to other users' health, nutrition, journal or AI data.
-- Billing/entitlement tables are written only by the service role (Stripe webhook).

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.can_view_program(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.training_programs p
    where p.id = p_program_id
      and (p.is_published or p.owner_id = auth.uid() or public.is_admin())
  );
$$;

create or replace function public.can_edit_program(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.training_programs p
    where p.id = p_program_id
      and ((p.owner_id is not null and p.owner_id = auth.uid())
           or (p.owner_id is null and public.is_admin()))
  );
$$;

create or replace function public.program_of_week(p_week_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select program_id from public.program_weeks where id = p_week_id;
$$;

create or replace function public.program_of_day(p_day_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select w.program_id from public.program_days d
  join public.program_weeks w on w.id = d.week_id
  where d.id = p_day_id;
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.onboarding_answers enable row level security;
alter table public.fitness_goals enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_alternatives enable row level security;
alter table public.exercise_media enable row level security;
alter table public.program_categories enable row level security;
alter table public.training_programs enable row level security;
alter table public.program_weeks enable row level security;
alter table public.program_days enable row level security;
alter table public.program_exercises enable row level security;
alter table public.user_programs enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.personal_records enable row level security;
alter table public.weight_entries enable row level security;
alter table public.measurement_entries enable row level security;
alter table public.recovery_checkins enable row level security;
alter table public.foods enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.nutrition_goals enable row level security;
alter table public.water_entries enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage_events enable row level security;
alter table public.faith_journal_entries enable row level security;
alter table public.discipline_goals enable row level security;
alter table public.discipline_checkins enable row level security;
alter table public.content_items enable row level security;
alter table public.feature_flags enable row level security;
alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.stripe_events enable row level security;
alter table public.admin_audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles: owner read/update. Role column is not updatable by end users.
-- ---------------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

revoke update on public.profiles from authenticated, anon;
grant update (display_name, unit_system, birth_year, height_cm, faith_enabled, wellness_consent_at,
  onboarding_completed_at, timezone, avatar_path) on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated, anon;

-- ---------------------------------------------------------------------------
-- Simple owner-scoped tables (user_id column)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'onboarding_answers', 'fitness_goals', 'user_programs', 'workout_sessions', 'personal_records',
    'weight_entries', 'measurement_entries', 'recovery_checkins', 'meals', 'nutrition_goals',
    'water_entries', 'ai_conversations', 'faith_journal_entries', 'discipline_goals'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t || '_delete_own', t);
  end loop;
end;
$$;

-- user_programs may only reference programs the user can see.
create policy user_programs_visible_program on public.user_programs
  as restrictive for insert to authenticated with check (public.can_view_program(program_id));

-- ---------------------------------------------------------------------------
-- Child tables: owner AND parent must belong to owner
-- ---------------------------------------------------------------------------
create policy workout_exercises_select_own on public.workout_exercises
  for select to authenticated using (user_id = (select auth.uid()));
create policy workout_exercises_insert_own on public.workout_exercises
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid()))
  );
create policy workout_exercises_update_own on public.workout_exercises
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid()))
  );
create policy workout_exercises_delete_own on public.workout_exercises
  for delete to authenticated using (user_id = (select auth.uid()));

create policy workout_sets_select_own on public.workout_sets
  for select to authenticated using (user_id = (select auth.uid()));
create policy workout_sets_insert_own on public.workout_sets
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_exercises e where e.id = workout_exercise_id and e.user_id = (select auth.uid()))
  );
create policy workout_sets_update_own on public.workout_sets
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_exercises e where e.id = workout_exercise_id and e.user_id = (select auth.uid()))
  );
create policy workout_sets_delete_own on public.workout_sets
  for delete to authenticated using (user_id = (select auth.uid()));

create policy meal_items_select_own on public.meal_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy meal_items_insert_own on public.meal_items
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.meals m where m.id = meal_id and m.user_id = (select auth.uid()))
  );
create policy meal_items_update_own on public.meal_items
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.meals m where m.id = meal_id and m.user_id = (select auth.uid()))
  );
create policy meal_items_delete_own on public.meal_items
  for delete to authenticated using (user_id = (select auth.uid()));

create policy ai_messages_select_own on public.ai_messages
  for select to authenticated using (user_id = (select auth.uid()));
create policy ai_messages_insert_own on public.ai_messages
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))
  );
create policy ai_messages_update_own on public.ai_messages
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ai_messages_delete_own on public.ai_messages
  for delete to authenticated using (user_id = (select auth.uid()));

create policy discipline_checkins_select_own on public.discipline_checkins
  for select to authenticated using (user_id = (select auth.uid()));
create policy discipline_checkins_insert_own on public.discipline_checkins
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.discipline_goals g where g.id = goal_id and g.user_id = (select auth.uid()))
  );
create policy discipline_checkins_delete_own on public.discipline_checkins
  for delete to authenticated using (user_id = (select auth.uid()));

-- AI usage: users may read their own metering; only the server (service role) writes.
create policy ai_usage_events_select_own on public.ai_usage_events
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Catalog: public read of published rows, admin write
-- ---------------------------------------------------------------------------
create policy exercises_read on public.exercises
  for select to anon, authenticated using (is_published or public.is_admin());
create policy exercises_admin_write on public.exercises
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy exercise_alternatives_read on public.exercise_alternatives
  for select to anon, authenticated using (true);
create policy exercise_alternatives_admin_write on public.exercise_alternatives
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy exercise_media_read on public.exercise_media
  for select to anon, authenticated using (true);
create policy exercise_media_admin_write on public.exercise_media
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy program_categories_read on public.program_categories
  for select to anon, authenticated using (true);
create policy program_categories_admin_write on public.program_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy training_programs_read on public.training_programs
  for select to anon, authenticated using (
    is_published or owner_id = (select auth.uid()) or public.is_admin()
  );
create policy training_programs_insert on public.training_programs
  for insert to authenticated with check (
    (owner_id = (select auth.uid()) and is_published = false and source in ('starter', 'ai'))
    or (owner_id is null and public.is_admin())
  );
create policy training_programs_update on public.training_programs
  for update to authenticated using (public.can_edit_program(id)) with check (
    (owner_id = (select auth.uid()) and is_published = false)
    or (owner_id is null and public.is_admin())
  );
create policy training_programs_delete on public.training_programs
  for delete to authenticated using (public.can_edit_program(id));

create policy program_weeks_read on public.program_weeks
  for select to anon, authenticated using (public.can_view_program(program_id));
create policy program_weeks_write on public.program_weeks
  for all to authenticated using (public.can_edit_program(program_id)) with check (public.can_edit_program(program_id));

create policy program_days_read on public.program_days
  for select to anon, authenticated using (public.can_view_program(public.program_of_week(week_id)));
create policy program_days_write on public.program_days
  for all to authenticated
  using (public.can_edit_program(public.program_of_week(week_id)))
  with check (public.can_edit_program(public.program_of_week(week_id)));

create policy program_exercises_read on public.program_exercises
  for select to anon, authenticated using (public.can_view_program(public.program_of_day(day_id)));
create policy program_exercises_write on public.program_exercises
  for all to authenticated
  using (public.can_edit_program(public.program_of_day(day_id)))
  with check (public.can_edit_program(public.program_of_day(day_id)));

-- Foods: curated foods are public; custom foods are private to owner.
create policy foods_read on public.foods
  for select to authenticated using (owner_id is null or owner_id = (select auth.uid()));
create policy foods_insert_own on public.foods
  for insert to authenticated with check (
    (owner_id = (select auth.uid()) and source in ('custom', 'usda'))
    or (owner_id is null and public.is_admin())
  );
create policy foods_update_own on public.foods
  for update to authenticated
  using (owner_id = (select auth.uid()) or (owner_id is null and public.is_admin()))
  with check (owner_id = (select auth.uid()) or (owner_id is null and public.is_admin()));
create policy foods_delete_own on public.foods
  for delete to authenticated using (owner_id = (select auth.uid()) or (owner_id is null and public.is_admin()));

create policy content_items_read on public.content_items
  for select to anon, authenticated using (is_published or public.is_admin());
create policy content_items_admin_write on public.content_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy feature_flags_read on public.feature_flags
  for select to anon, authenticated using (true);
create policy feature_flags_admin_write on public.feature_flags
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Billing: owner read-only; writes via service role only (no policies => denied).
-- ---------------------------------------------------------------------------
create policy billing_customers_select_own on public.billing_customers
  for select to authenticated using (user_id = (select auth.uid()));
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy user_entitlements_select_own on public.user_entitlements
  for select to authenticated using (user_id = (select auth.uid()));
-- stripe_events: no policies — service role only.

-- Admin audit log: admins can read; inserts come from the server with the service role.
create policy admin_audit_logs_admin_read on public.admin_audit_logs
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Aggregate, privacy-preserving metrics for admins (counts only, no row data).
-- ---------------------------------------------------------------------------
create or replace function public.admin_usage_metrics()
returns table (
  total_users bigint,
  onboarded_users bigint,
  workouts_last_7d bigint,
  workouts_last_30d bigint,
  active_users_30d bigint,
  ai_requests_30d bigint,
  plus_subscribers bigint,
  pro_subscribers bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query
  select
    (select count(*) from public.profiles),
    (select count(*) from public.profiles where onboarding_completed_at is not null),
    (select count(*) from public.workout_sessions where status = 'completed' and started_at > now() - interval '7 days'),
    (select count(*) from public.workout_sessions where status = 'completed' and started_at > now() - interval '30 days'),
    (select count(distinct user_id) from public.workout_sessions where started_at > now() - interval '30 days'),
    (select count(*) from public.ai_usage_events where created_at > now() - interval '30 days'),
    (select count(*) from public.user_entitlements where plan = 'plus'),
    (select count(*) from public.user_entitlements where plan = 'pro');
end;
$$;

revoke execute on function public.admin_usage_metrics() from anon, public;
grant execute on function public.admin_usage_metrics() to authenticated;
