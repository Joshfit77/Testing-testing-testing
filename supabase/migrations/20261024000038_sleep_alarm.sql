-- Sleep & Recovery, Stage D2: the member's alarm settings (wake time, window, fixed or smart, sound, days, snooze)
-- as validated JSON on the profile. The phone app schedules them as local notifications; the web app only stores
-- and shows them. Null means never configured.

alter table public.profiles add column if not exists sleep_alarm jsonb;
grant update (sleep_alarm) on public.profiles to authenticated;
