-- Onboarding now builds a calorie budget (MyFitnessPal / MyNetDiary style) alongside the starter program:
-- goal weight, weekly pace and activity level outside workouts. session_minutes and equipment already
-- live on onboarding_answers.
--
-- onboarding_answers is covered by the owner-only RLS policies created in 20261016000002_rls_policies.sql
-- (onboarding_answers_{select,insert,update,delete}_own: user_id = auth.uid()), so the new columns are
-- private to their owner. Columns are nullable so accounts created before this migration keep working;
-- the app falls back to the stored nutrition targets when they are missing.

alter table public.onboarding_answers
  add column if not exists goal_weight_kg numeric(5, 2) check (goal_weight_kg between 25 and 400),
  add column if not exists weekly_change_kg numeric(4, 2) check (weekly_change_kg in (-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5)),
  add column if not exists activity_level text check (activity_level in ('sedentary', 'light', 'active', 'very_active'));

comment on column public.onboarding_answers.goal_weight_kg is 'Optional target bodyweight in kg.';
comment on column public.onboarding_answers.weekly_change_kg is 'Chosen weekly weight change in kg (negative = lose).';
comment on column public.onboarding_answers.activity_level is 'Daily-life activity outside workouts, for the calorie budget.';
