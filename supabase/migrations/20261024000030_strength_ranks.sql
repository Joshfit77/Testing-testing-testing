-- Strength ranks on the muscle map (Plus and Pro) compare each lift with a men's or a women's table. The member picks
-- the table on the map itself; the profile's `sex` answer stays limited to calorie estimates, as onboarding says.
-- Ranks are computed from logged workouts when the map is opened and are never stored, like the milestone badges.

alter table public.profiles
  add column if not exists strength_standards text check (strength_standards in ('men', 'women'));

grant update (strength_standards) on public.profiles to authenticated;
