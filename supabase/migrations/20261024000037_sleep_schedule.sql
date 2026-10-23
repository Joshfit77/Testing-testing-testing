-- Sleep & Recovery, Stages C1–C3: the wake time a member chooses to keep (the windows hang off it; null means use
-- their typical wake time), and which habit tips they have dismissed.

alter table public.profiles
  add column if not exists sleep_target_wake time,
  add column if not exists sleep_tips_dismissed text[] not null default '{}' check (cardinality(sleep_tips_dismissed) <= 50);
grant update (sleep_target_wake, sleep_tips_dismissed) on public.profiles to authenticated;
