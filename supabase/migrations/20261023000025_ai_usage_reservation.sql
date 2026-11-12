-- Narrow Gate Fitness — make the AI coach's limits exact and impossible to sidestep.
--
-- Before: usage was recorded after the reply was saved, so (a) several requests sent at once could all pass the
-- check before any was counted, and (b) a request whose reply failed to save (for example because the member
-- deleted the conversation mid-reply) was never counted, though the member had already seen the streamed text.
-- Now the server reserves a usage row before calling the AI provider, under a per-member lock that re-checks every
-- limit, and fills in the model and token counts afterwards. A reservation is removed only if the provider call
-- itself fails, so members aren't charged for errors.

create or replace function public.reserve_ai_usage(
  p_user_id uuid,
  p_kind text,
  p_tier text,
  p_chat_limit integer,
  p_plan_limit integer,
  p_smart_limit integer,
  p_per_minute integer
)
returns table (usage_id uuid, model_tier text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  v_total integer;
  v_plans integer;
  v_smart integer;
  v_recent integer;
  v_tier text := p_tier;
begin
  perform pg_advisory_xact_lock(hashtextextended('ai_usage:' || p_user_id::text, 0));
  select count(*), count(*) filter (where e.kind = 'plan'), count(*) filter (where e.model_tier = 'smart')
    into v_total, v_plans, v_smart
    from public.ai_usage_events e where e.user_id = p_user_id and e.created_at >= v_month;
  select count(*) into v_recent from public.ai_usage_events e where e.user_id = p_user_id and e.created_at >= now() - interval '60 seconds';
  if v_recent >= p_per_minute then
    raise exception 'ai_rate_limited' using errcode = 'P0001';
  end if;
  if v_total >= p_chat_limit then
    raise exception 'ai_quota' using errcode = 'P0001';
  end if;
  if p_kind = 'plan' and (v_plans >= p_plan_limit or v_smart >= p_smart_limit) then
    raise exception 'ai_quota_plan' using errcode = 'P0001';
  end if;
  -- A chat that would have used the larger model falls back to the fast one once that share is used up.
  if v_tier = 'smart' and v_smart >= p_smart_limit then
    v_tier := 'fast';
  end if;
  insert into public.ai_usage_events (user_id, kind, model_tier)
    values (p_user_id, p_kind, v_tier)
    returning id into usage_id;
  model_tier := v_tier;
  return next;
end;
$$;
revoke all on function public.reserve_ai_usage(uuid, text, text, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid, text, text, integer, integer, integer, integer) to service_role;

-- Coach messages: members write only their own questions (replies are written by the server), and can only change
-- a suggestion's status, not any message's text. This stops a member planting long fake "assistant" turns that
-- would be sent to the AI as history.
drop policy if exists ai_messages_insert_own on public.ai_messages;
create policy ai_messages_insert_own on public.ai_messages
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and role = 'user'
    and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))
  );
revoke update on public.ai_messages from authenticated;
grant update (proposal_status) on public.ai_messages to authenticated;
