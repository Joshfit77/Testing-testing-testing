-- Narrow Gate Fitness — AI coach replies are saved whole (AI audit 2026-11-01, D3).
-- A coach reply could stream to the member in full and then be saved cut at 20,000 characters (the chat replaces the
-- streamed draft with the saved message), so a long answer lost its end, "shortened" note included. A reply can use
-- up to 12,000 output tokens per round (src/lib/coach/prompt.ts), about 48,000 characters at most; the limit becomes
-- 60,000, and the server ends anything longer with a visible note (fitStoredReply). Members can't write replies
-- (only the server does), so this changes nothing a member can do.
--
-- Rollback: update public.ai_messages set content = left(content, 20000) where char_length(content) > 20000;
--           then restore the check below with 20000.

alter table public.ai_messages drop constraint if exists ai_messages_content_check;
alter table public.ai_messages add constraint ai_messages_content_check check (char_length(content) <= 60000);
