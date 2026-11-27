-- ROLLBACK:
--   drop policy if exists exercises_read_own_history on public.exercises;
--   drop function if exists public.member_references_exercise(uuid);
--   update public.exercises set is_published = true where slug = '90-90-hip-switch';
--   (then re-run the seed from the commit before the retirement to restore its alternatives and program rows)
--
-- Retires exercises from active use without deleting anything a member logged (owner decision, 2026-11-20: the
-- dynamic 90/90 Hip Switch is removed from the app).
--
-- A retired exercise keeps its row, id, slug and name, so workouts, personal records, targets, goals, saved templates
-- and members' own programs that reference it stay intact and keep showing its name. It is unpublished, so it is no
-- longer in the library, search, pickers, the AI coach's catalog or any curated program. The seed no longer inserts it
-- (src/data/exercises.ts), so a new database never has it.
--
-- Unpublished exercises are visible only to admins (exercises_read, migration 002). The new policy also lets a member
-- read an unpublished exercise their own data references, so their history does not lose the exercise's name.
-- It reveals nothing about anyone else: the check only looks at the caller's own rows.

update public.exercises set is_published = false where slug = '90-90-hip-switch';

-- Library links to and from it ("try instead").
delete from public.exercise_alternatives
where exercise_id in (select id from public.exercises where slug = '90-90-hip-switch')
   or alternative_id in (select id from public.exercises where slug = '90-90-hip-switch');

-- Curated programs only (owner_id is null). Members' own programs are their data and are left as they are; the seed
-- rebuilds the curated days' exercise rows anyway.
delete from public.program_exercises pe
using public.program_days d, public.program_weeks w, public.training_programs p
where pe.day_id = d.id and d.week_id = w.id and w.program_id = p.id
  and p.owner_id is null
  and pe.exercise_id in (select id from public.exercises where slug = '90-90-hip-switch');

-- True when the calling member's own data references the exercise. Security definer so the policy below does not
-- depend on (or recurse through) the other tables' policies; every branch is limited to auth.uid().
create or replace function public.member_references_exercise(p_exercise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.workout_exercises we
            where we.user_id = auth.uid() and (we.exercise_id = p_exercise_id or we.substituted_from_id = p_exercise_id))
    or exists (select 1 from public.personal_records pr where pr.user_id = auth.uid() and pr.exercise_id = p_exercise_id)
    or exists (select 1 from public.exercise_targets t where t.user_id = auth.uid() and t.exercise_id = p_exercise_id)
    or exists (select 1 from public.fitness_goals g where g.user_id = auth.uid() and g.exercise_id = p_exercise_id)
    or exists (select 1 from public.workout_template_exercises te
               where te.user_id = auth.uid() and te.exercise_id = p_exercise_id)
    or exists (select 1 from public.program_exercises pe
               join public.program_days d on d.id = pe.day_id
               join public.program_weeks w on w.id = d.week_id
               join public.training_programs p on p.id = w.program_id
               where p.owner_id = auth.uid() and pe.exercise_id = p_exercise_id)
  );
$$;
revoke all on function public.member_references_exercise(uuid) from public, anon;
grant execute on function public.member_references_exercise(uuid) to authenticated;

drop policy if exists exercises_read_own_history on public.exercises;
create policy exercises_read_own_history on public.exercises
  for select to authenticated using (not is_published and public.member_references_exercise(id));
