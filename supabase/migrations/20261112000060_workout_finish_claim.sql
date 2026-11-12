-- ROLLBACK (loses no workout data; only the in-flight claim markers go):
--   alter table public.workout_sessions drop column if exists finish_claimed_at;
--   alter table public.workout_sessions drop column if exists finish_claim;
-- Roll back the app code first (or together): finishWorkout writes these columns.
--
-- Finishing a workout is several writes (session, exercises, sets, records, status). Two finishes of the same workout
-- at once (a double tap, or a retry while the first request is still running on gym Wi-Fi) both cleared and re-wrote
-- the exercises, so the sets were saved twice. finishWorkout now claims the session first with a conditional update
-- (status in progress and no live claim); only the request that wins the claim writes, the others wait for it to
-- finish and report the workout as already saved. A claim older than two minutes is treated as abandoned (the
-- server died mid-save), so a later retry can take it over.
--
-- Additive and live-safe: nullable columns with no default are a catalog-only change (no table rewrite).
alter table public.workout_sessions add column if not exists finish_claim uuid;
alter table public.workout_sessions add column if not exists finish_claimed_at timestamptz;
