-- Narrow Gate Fitness — optional feedback on AI coach replies, for the TestFlight beta.
-- Under a coach reply a member may answer "Was this coaching advice useful?" (Yes / Partially / No), add an optional
-- comment, or report a safety concern. It is OFF: the flag below is inserted disabled and the app shows nothing until
-- the owner switches it on (src/server/flags.ts `isFlagOn`, which treats a missing flag as off). Before switching it
-- on: update the privacy policy and the App Store privacy details (members' feedback is new data the app collects).
--
-- Members can only rate replies the coach gave them, read and change their own feedback, and it goes with their
-- account (deleted with it, included in their export).

create table public.ai_message_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message_id uuid not null references public.ai_messages (id) on delete cascade,
  rating text check (rating in ('yes', 'partially', 'no')),
  comment text check (char_length(comment) <= 1000),
  safety_concern boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, message_id),
  -- A rating, a safety report, or both.
  check (rating is not null or safety_concern)
);
create index ai_message_feedback_safety_idx on public.ai_message_feedback (created_at desc) where safety_concern;
create trigger ai_message_feedback_updated_at before update on public.ai_message_feedback
  for each row execute function public.set_updated_at();

alter table public.ai_message_feedback enable row level security;

-- Only on a reply the coach gave this member.
create or replace function public.is_own_coach_reply(p_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.ai_messages m where m.id = p_message_id and m.user_id = auth.uid() and m.role = 'assistant');
$$;
revoke all on function public.is_own_coach_reply(uuid) from public;
grant execute on function public.is_own_coach_reply(uuid) to authenticated;

create policy "Members read their own coach feedback" on public.ai_message_feedback
  for select to authenticated using (user_id = auth.uid());
create policy "Members give feedback on their own coach replies" on public.ai_message_feedback
  for insert to authenticated with check (user_id = auth.uid() and public.is_own_coach_reply(message_id));
create policy "Members change their own coach feedback" on public.ai_message_feedback
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_own_coach_reply(message_id));
create policy "Members remove their own coach feedback" on public.ai_message_feedback
  for delete to authenticated using (user_id = auth.uid());

insert into public.feature_flags (key, enabled, description)
values ('coach_feedback', false, 'TestFlight: ask "Was this coaching advice useful?" under AI coach replies, with a safety-report option. Off until the owner authorizes collecting it.')
on conflict (key) do nothing;
