-- Narrow Gate Fitness — enforce paid features in the database as well as in the server actions.
--
-- The Supabase anon key is public, so a signed-in member can call the REST API with their own session and skip the
-- server actions. Row level security already kept every member to their own rows, but it didn't check the plan, so
-- a Free member could create recipes, meal plans and grocery lists, build custom or AI programs, save more than five
-- workouts, move calendar sessions, enrol in Plus programs and read their prescriptions. These policies add the plan
-- check. Nothing existing is changed or removed: they only govern new writes (and reads of paid prescriptions), so
-- a member who downgrades keeps everything they made.

-- The member's current plan: their entitlement while it's valid, otherwise Free (the same rule as getUserPlan in
-- src/server/auth.ts). Anonymous visitors are Free.
create or replace function public.plan_of(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select e.plan from public.user_entitlements e
      where e.user_id = p_user_id and (e.valid_until is null or e.valid_until > now())),
    'free');
$$;

create or replace function public.plan_rank(p_plan text)
returns integer
language sql
immutable
as $$
  select case p_plan when 'pro' then 2 when 'plus' then 1 else 0 end;
$$;

-- Does the signed-in member's plan include `p_min_plan`?
create or replace function public.has_plan(p_min_plan text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.plan_rank(public.plan_of(auth.uid())) >= public.plan_rank(p_min_plan);
$$;

-- Can the signed-in member use this program's prescriptions: their own program, a published program at their
-- plan's tier or below, or as an admin.
create or replace function public.can_use_program(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.training_programs p
    where p.id = p_program_id
      and (p.owner_id = auth.uid() or public.is_admin() or (p.is_published and public.has_plan(p.tier)))
  );
$$;

revoke all on function public.plan_of(uuid) from public, anon, authenticated;
grant execute on function public.plan_of(uuid) to authenticated, service_role;

-- Program prescriptions (sets, reps, rest) of paid programs: only for members whose plan includes them. Week and
-- day names stay readable, as the program page shows them as a preview.
drop policy if exists program_exercises_read on public.program_exercises;
create policy program_exercises_read on public.program_exercises
  for select to anon, authenticated using (public.can_use_program(public.program_of_day(day_id)));

-- Enrolling in a program needs a plan that includes it.
drop policy if exists user_programs_visible_program on public.user_programs;
create policy user_programs_visible_program on public.user_programs
  as restrictive for insert to authenticated with check (public.can_use_program(program_id));

-- Private programs: starter programs (built at sign-up) for everyone, custom programs with Plus, AI programs with Pro.
drop policy if exists training_programs_insert on public.training_programs;
create policy training_programs_insert on public.training_programs
  for insert to authenticated with check (
    (
      owner_id = (select auth.uid()) and is_published = false
      and (
        source = 'starter'
        or (source = 'custom' and public.has_plan('plus'))
        or (source = 'ai' and public.has_plan('pro'))
      )
    )
    or (owner_id is null and public.is_admin())
  );

-- Recipes, the meal planner and grocery lists (Plus): creating new rows needs the plan.
do $$
declare
  t text;
begin
  foreach t in array array[
    'recipes', 'recipe_ingredients', 'meal_plan_settings', 'meal_plans', 'meal_plan_entries', 'grocery_lists', 'grocery_items'
  ] loop
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (public.has_plan(''plus''))', t || '_plan', t);
  end loop;
end;
$$;

-- Moving a session on the calendar (Plus). Moving it back (deleting the override) stays open to everyone.
create policy planned_session_overrides_plan_insert on public.planned_session_overrides
  as restrictive for insert to authenticated with check (public.has_plan('plus'));
create policy planned_session_overrides_plan_update on public.planned_session_overrides
  as restrictive for update to authenticated using (public.has_plan('plus')) with check (public.has_plan('plus'));

-- Saved workouts: five on Free (PLAN_FREE_TEMPLATE_LIMIT's default in src/lib/domain/plans.ts; keep them equal).
-- A trigger rather than a policy, so two saves at the same moment can't both slip under the limit: it takes a
-- per-member lock before counting.
create or replace function public.enforce_free_template_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('workout_templates:' || new.user_id::text, 0));
  if public.plan_rank(public.plan_of(new.user_id)) = 0
     and (select count(*) from public.workout_templates where user_id = new.user_id) >= 5 then
    raise exception 'Free plan limit: 5 saved workouts' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger workout_templates_free_limit before insert on public.workout_templates
  for each row execute function public.enforce_free_template_limit();
