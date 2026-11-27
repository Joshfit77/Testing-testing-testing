-- ROLLBACK (no member data is lost; sealed memories stay readable only with MEMORY_ENCRYPTION_KEY):
--   alter table public.coach_memories drop constraint coach_memories_content_check;
--   alter table public.coach_memories add constraint coach_memories_content_check check (char_length(content) between 3 and 300);
--     (only after scripts/encrypt-memories.ts --decrypt has opened every sealed row)
--   alter table public.profiles drop column if exists coach_style;
--
-- 1. Coaching memories are sealed at rest by the server (AES-256-GCM, src/server/crypto/memory-crypto.ts). A sealed
--    memory is longer than its text, so the length rule applies to plain text only; the sealed form has its own
--    format and an upper bound. Members can still edit and delete their memories through the app.
-- 2. The member's chosen coaching style (all styles follow the same accuracy, privacy and safety rules).

alter table public.coach_memories drop constraint if exists coach_memories_content_check;
alter table public.coach_memories add constraint coach_memories_content_check check (
  (content like 'enc:v1:%' and char_length(content) <= 2048)
  or (content not like 'enc:v1:%' and char_length(content) between 3 and 300)
);

alter table public.profiles
  add column if not exists coach_style text check (coach_style in ('supportive', 'direct', 'beginner', 'technical'));
grant update (coach_style) on public.profiles to authenticated;
