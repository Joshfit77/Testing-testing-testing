-- Consents enforced by the database itself, and indexes for foreign keys that deletions follow.
-- (Independent database review, 2026-11-25: findings F1, F2, F3.)
--
-- ROLLBACK (in reverse order):
--   drop policy if exists recovery_checkins_need_consent on public.recovery_checkins;
--   drop policy if exists faith_journal_share_needs_consent on public.faith_journal_entries;
--   drop trigger if exists profiles_ai_subconsents on public.profiles;
--   drop function if exists public.enforce_ai_subconsents();
--   drop index if exists <each index below>;
-- The cleared "share with AI Coach" marks are not restored (they were inert: see 080).
--
-- 1. AI sub-permissions follow the general AI consent, whatever writes the profile.
--    Until now only the app's own actions (src/server/actions/profile.ts) switched the health-data and prayer-journal
--    permissions and coaching memory off with the AI consent, and only setJournalAiShareAction cleared old journal
--    marks when the journal permission changed. A member can update these columns directly with their own session
--    (column grants, migrations 079 and 080), so the rule now lives in a trigger:
--      * AI consent withdrawn (on -> off)   -> health sharing, journal sharing and coaching memory off;
--      * faith features turned off (on -> off) -> journal sharing off;
--      * journal permission turned on or off -> every entry's "share with AI Coach" mark cleared, so nothing marked
--        before the permission existed, or while it was off, is ever sent.
--    Only these transitions are acted on, exactly as the app's own actions do: a member who turns coaching memory on
--    before the AI consent (which the app allows; memory is unused until both are on) keeps that choice.
create or replace function public.enforce_ai_subconsents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.ai_data_consent_at is not null and new.ai_data_consent_at is null then
    new.health_ai_share_consent_at := null;
    new.journal_ai_consent_at := null;
    new.coach_memory_enabled := false;
  end if;
  if coalesce(old.faith_enabled, false) and not coalesce(new.faith_enabled, false) then
    new.journal_ai_consent_at := null;
  end if;
  if (old.journal_ai_consent_at is null) <> (new.journal_ai_consent_at is null) then
    update public.faith_journal_entries set share_with_coach = false where user_id = new.id and share_with_coach;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_ai_subconsents() from public, anon, authenticated;

drop trigger if exists profiles_ai_subconsents on public.profiles;
create trigger profiles_ai_subconsents
  before update on public.profiles
  for each row execute function public.enforce_ai_subconsents();

-- Marks set before the journal permission existed (migration 080) and never cleared, for members without the
-- permission: inert today (the coach also checks the permission), cleared so they can never come back to life.
update public.faith_journal_entries e set share_with_coach = false
from public.profiles p
where p.id = e.user_id and e.share_with_coach and p.journal_ai_consent_at is null;

-- An entry can be marked for the AI Coach only while the member has all three permissions on.
drop policy if exists faith_journal_share_needs_consent on public.faith_journal_entries;
create policy faith_journal_share_needs_consent on public.faith_journal_entries
  as restrictive
  for all to authenticated
  using (true)
  with check (
    not share_with_coach
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.journal_ai_consent_at is not null and p.ai_data_consent_at is not null and p.faith_enabled
    )
  );

-- 2. Recovery check-ins (readiness, sleep quality, soreness, stress) need the wellness consent, as sleep entries
--    already do (can_log_sleep, migration 034). The app asked for it before saving; the database now requires it.
--    Reading and deleting stay allowed, so a member who withdraws consent can still see and remove what they stored.
drop policy if exists recovery_checkins_need_consent on public.recovery_checkins;
create policy recovery_checkins_need_consent on public.recovery_checkins
  as restrictive
  for insert to authenticated
  with check ((select public.can_log_sleep()));
drop policy if exists recovery_checkins_update_need_consent on public.recovery_checkins;
create policy recovery_checkins_update_need_consent on public.recovery_checkins
  as restrictive
  for update to authenticated
  using (true)
  with check ((select public.can_log_sleep()));

-- 3. Indexes for foreign keys that deletes follow (ON DELETE SET NULL / CASCADE). Without them, deleting an account
--    (its cached foods), a conversation (its messages) or a program scans whole tables once per deleted row.
create index if not exists meal_items_food_idx on public.meal_items (food_id) where food_id is not null;
create index if not exists coach_memories_source_msg_idx on public.coach_memories (source_message_id) where source_message_id is not null;
create index if not exists training_adjustments_source_msg_idx on public.training_adjustments (source_message_id) where source_message_id is not null;
create index if not exists ai_message_feedback_message_idx on public.ai_message_feedback (message_id);
create index if not exists personal_records_session_idx on public.personal_records (session_id) where session_id is not null;
create index if not exists workout_sessions_user_program_idx on public.workout_sessions (user_program_id) where user_program_id is not null;
create index if not exists workout_sessions_program_day_idx on public.workout_sessions (program_day_id) where program_day_id is not null;
create index if not exists body_scans_measurement_idx on public.body_scans (measurement_id) where measurement_id is not null;
