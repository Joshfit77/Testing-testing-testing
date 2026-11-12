-- AI food-photo recognition (Pro). A meal photo is sent to the AI provider only after the member's separate,
-- explicit consent, recorded here with the time. Photos are never stored: the server reads the upload in memory,
-- sends it once, and keeps only the items the member confirms (as ordinary diary entries marked as estimates).

alter table public.profiles add column if not exists food_photo_consent_at timestamptz;
grant update (food_photo_consent_at) on public.profiles to authenticated;

-- Diary entries confirmed from a photo estimate say where they came from.
alter table public.meal_items drop constraint if exists meal_items_source_check;
alter table public.meal_items add constraint meal_items_source_check
  check (source ~ '^(usda:[0-9]{1,10}|off:[0-9]{8,14}|food:[0-9a-f-]{36}|recipe:[0-9a-f-]{36}|app:[a-z0-9-]{1,60}|photo|custom)$');

-- Same reservation as before (one per-member lock re-checks every limit), plus an image cost control: at most
-- 20 food-photo analyses in any 24 hours. Photos also count toward the monthly AI allowance like any request.
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
  if p_kind = 'food_photo' and (
    select count(*) from public.ai_usage_events e
    where e.user_id = p_user_id and e.kind = 'food_photo' and e.created_at >= now() - interval '24 hours'
  ) >= 20 then
    raise exception 'ai_quota_photo' using errcode = 'P0001';
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
