-- ROLLBACK:
--   alter table public.profiles drop column if exists health_ai_share_consent_at;
-- Roll back the app code first: the AI coach reads this column to decide what to leave out.
--
-- A separate permission for sending Apple Health / Health Connect data to the AI provider (legal audit 2026-11-16,
-- docs/legal-audit-2026-11-16/18_HEALTH_DATA_AI_REVIEW.md). Until a member turns it on, data imported from a health
-- platform or wearable (imported step counts; watch- or ring-recorded sleep with its stages, overnight heart rate,
-- heart-rate variability and breathing rate) is left out of everything sent to the AI provider. What the member typed
-- in themselves is still covered by the general AI consent (ai_data_consent_at). Null = not allowed (the default).
-- The wearable's device name is never sent, whatever this says.
alter table public.profiles add column if not exists health_ai_share_consent_at timestamptz;
grant update (health_ai_share_consent_at) on public.profiles to authenticated;
