-- ROLLBACK:
--   alter table public.profiles drop column if exists journal_ai_consent_at;
-- Roll back the app code first: the AI coach reads this column to decide whether any journal entry may be sent.
--
-- A separate, explicit permission before any prayer-journal entry can be shared with the AI Coach (owner decision,
-- 2026-11-17). Journal entries are private by default (share_with_coach defaults to false, migration 020). From now on
-- an entry marked "Share with AI Coach" is sent to the AI provider only while this permission is on, the general AI
-- consent (ai_data_consent_at) is on, and faith features are on. Null = not allowed (the default, also for every
-- existing member). Entries marked shared before stay inert, and turning the permission on clears every mark first,
-- so nothing marked before it existed is ever sent (src/server/actions/profile.ts, setJournalAiShareAction).
alter table public.profiles add column if not exists journal_ai_consent_at timestamptz;
grant update (journal_ai_consent_at) on public.profiles to authenticated;
comment on column public.profiles.journal_ai_consent_at is
  'Separate permission to share prayer-journal entries with the AI Coach. Null = not allowed (default).';
