-- The revision of a workout's in-progress copy on the account (findings F-29 and F-30, security assessment 2026-11-20).
--
-- Until now the server kept whichever backup of an unfinished workout arrived last. With two devices (or two tabs)
-- logging the same workout, an older copy could replace a newer one, and the device that sent it showed "Synced".
-- Every saved backup now moves draft_rev on by one, and a backup is stored only if it was built on the revision the
-- server still holds (the app sends the revision it last saw). Otherwise the server answers with its own copy, the
-- device combines the two (no completed set is dropped) and saves the combined copy on the new revision.
--
-- Existing rows start at 0: the first backup from the updated app is checked against that.
alter table public.workout_sessions add column if not exists draft_rev integer not null default 0;

comment on column public.workout_sessions.draft_rev is
  'Revision of the in-progress draft: +1 on every saved backup; a backup must name the revision it was built on.';
