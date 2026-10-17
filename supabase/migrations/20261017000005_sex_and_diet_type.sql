-- Onboarding now asks for sex (used only for calorie estimates) and a diet style.

alter table public.profiles
  add column if not exists sex text check (sex in ('male', 'female', 'unspecified'));
-- Users may update their own sex (column-level grant; role stays non-updatable).
grant update (sex) on public.profiles to authenticated;

alter table public.onboarding_answers
  add column if not exists diet_type text not null default 'balanced' check (diet_type in (
    'balanced', 'high_protein', 'low_carb', 'keto', 'mediterranean', 'paleo', 'vegetarian', 'vegan',
    'pescatarian', 'intermittent_fasting', 'carnivore', 'daniel_fast', 'dash'));
