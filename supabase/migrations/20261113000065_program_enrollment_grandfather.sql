-- ROLLBACK (restores the earlier rule: published program at the member's tier, own program, or admin):
--   create or replace function public.can_use_program(p_program_id uuid) returns boolean language sql stable
--   security definer set search_path = public as $$
--     select exists (select 1 from public.training_programs p where p.id = p_program_id
--       and (p.owner_id = auth.uid() or public.is_admin() or (p.is_published and public.has_plan(p.tier)))); $$;
--
-- Structured library programs become Pro-only for NEW enrollments (owner decision 2026-11-13). Members who already
-- enrolled in (or saved) a program keep using it: an existing user_programs row for that program grants access to
-- its prescriptions, so nobody loses a program part-way through or the plan behind their logged workouts.
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
      and (
        p.owner_id = auth.uid()
        or public.is_admin()
        or (p.is_published and public.has_plan(p.tier))
        or exists (select 1 from public.user_programs up where up.program_id = p.id and up.user_id = auth.uid())
      )
  );
$$;
