-- ROLLBACK (drops only the drop-set marker; every set, its reps and weight stay):
--   alter table public.workout_sets drop constraint if exists workout_sets_drop_not_warmup;
--   alter table public.workout_sets drop column if exists is_drop;
-- Roll back the app code first (or together): finishWorkout and the workout editor write this column.
--
-- Drop sets: a set done straight after a working set at a lower weight, with no rest in between. They are real
-- working sets (their reps and weight count towards volume and records), so they live in workout_sets like any
-- other set; is_drop only says "this one followed the set before it with no rest", which the logger, history and
-- "last time" need to show and align sets correctly. A warm-up can't be a drop set.
--
-- Additive and live-safe: a boolean with a constant default is a catalog-only change on Postgres 11+ (no rewrite),
-- and every existing set is a normal set (false).
alter table public.workout_sets add column if not exists is_drop boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workout_sets_drop_not_warmup') then
    alter table public.workout_sets add constraint workout_sets_drop_not_warmup check (not (is_drop and is_warmup));
  end if;
end $$;
