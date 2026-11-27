-- ROLLBACK (member data and usage history are untouched):
--   drop function if exists public.reserve_ai_usage(uuid, text, text, integer, integer, integer, integer, bigint, bigint, bigint, integer, integer, integer, bigint);
--   drop function if exists public.release_ai_usage(uuid, bigint); then re-apply release_ai_usage from 066;
--   re-apply reserve_ai_usage from 20261113000066_ai_cost_controls.sql;
--   alter table public.ai_usage_events drop constraint ai_usage_events_kind_check;
--   alter table public.ai_usage_events add constraint ai_usage_events_kind_check
--     check (kind in ('chat', 'plan', 'meal_plan', 'food_photo', 'food_explain', 'weekly_report'));
--   (delete or relabel any 'bible_study' rows first). Roll back the app first.
--
-- AI allowance rules (2026-11-13 owner brief):
--   * Free members have no generative AI at all; the Bible study helper is now Pro and metered like every other AI
--     feature (kind 'bible_study'), against the member's request allowance and money budget and the global budget.
--   * The monthly request allowance (150 on Pro) counts every AI action the member starts. The automatic weekly
--     report doesn't use it up (it still counts against the money budgets).
--   * Advanced (larger-model) requests are drawn from the same allowance, up to the plan's share (10 on Pro), and only
--     while the member's money budget still covers every standard request they have left: the advanced share can never
--     eat the money the rest of the allowance needs. When a chat can't use the larger model it runs on the standard one
--     and the reason is returned, so the app can say so (no silent downgrade). A plan generation is refused instead.
--   * The hold for a downgraded request is the standard model's expected cost, not the larger one's.

alter table public.ai_usage_events drop constraint if exists ai_usage_events_kind_check;
alter table public.ai_usage_events add constraint ai_usage_events_kind_check
  check (kind in ('chat', 'plan', 'meal_plan', 'food_photo', 'food_explain', 'weekly_report', 'bible_study'));

drop function if exists public.reserve_ai_usage(uuid, text, text, integer, integer, integer, integer, bigint, bigint, bigint, integer, integer, integer);

create or replace function public.reserve_ai_usage(
  p_user_id uuid,
  p_kind text,
  p_tier text,
  p_chat_limit integer,
  p_plan_limit integer,
  p_smart_limit integer,
  p_per_minute integer,
  p_estimate_micros bigint,
  p_user_budget_micros bigint,
  p_global_budget_micros bigint,
  p_max_inflight_user integer,
  p_max_inflight_global integer,
  p_inflight_seconds integer,
  p_fast_estimate_micros bigint default 3400
)
returns table (usage_id uuid, model_tier text, user_spent_micros bigint, global_percent integer, downgrade_reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  v_month_date date := date_trunc('month', now() at time zone 'utc')::date;
  v_total integer;
  v_plans integer;
  v_smart integer;
  v_recent integer;
  v_user_spent bigint;
  v_inflight_user integer;
  v_inflight_global integer;
  v_global_spent bigint;
  v_global_reserved bigint;
  v_tier text := p_tier;
  v_estimate bigint := greatest(p_estimate_micros, 0);
  v_fast bigint := greatest(p_fast_estimate_micros, 0);
  v_counts boolean := p_kind <> 'weekly_report';
  v_left_after integer;
  v_reason text := null;
begin
  perform pg_advisory_xact_lock(hashtextextended('ai_usage:' || p_user_id::text, 0));

  -- Requests counted against the allowance: everything the member starts (not the automatic weekly report).
  select count(*) filter (where e.kind <> 'weekly_report'), count(*) filter (where e.kind = 'plan'), count(*) filter (where e.model_tier = 'smart'),
         coalesce(sum(case when e.finalized_at is null then e.reserved_micros else e.cost_micros end), 0)
    into v_total, v_plans, v_smart, v_user_spent
    from public.ai_usage_events e where e.user_id = p_user_id and e.created_at >= v_month;
  select count(*) into v_recent from public.ai_usage_events e where e.user_id = p_user_id and e.created_at >= now() - interval '60 seconds';
  select count(*) into v_inflight_user from public.ai_usage_events e
    where e.user_id = p_user_id and e.finalized_at is null and e.created_at >= now() - make_interval(secs => p_inflight_seconds);

  if v_inflight_user >= p_max_inflight_user then
    raise exception 'ai_in_flight' using errcode = 'P0001';
  end if;
  if v_recent >= p_per_minute then
    raise exception 'ai_rate_limited' using errcode = 'P0001';
  end if;
  if v_counts and v_total >= p_chat_limit then
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

  perform pg_advisory_xact_lock(hashtextextended('ai_budget:global', 0));
  -- Close holds left by servers that died (charged at their estimate), as in 066.
  with stale as (
    update public.ai_usage_events e set finalized_at = now(), cost_micros = e.reserved_micros
      where e.finalized_at is null and e.created_at < now() - make_interval(secs => p_inflight_seconds * 2)
      returning e.reserved_micros as held, date_trunc('month', e.created_at at time zone 'utc')::date as m
  )
  update public.ai_budget_months bm
    set spent_micros = bm.spent_micros + s.total, reserved_micros = greatest(0, bm.reserved_micros - s.total), updated_at = now()
    from (select stale.m, sum(stale.held)::bigint as total from stale group by stale.m) s
    where bm.month = s.m;
  insert into public.ai_budget_months (month, budget_micros) values (v_month_date, p_global_budget_micros)
    on conflict (month) do update set budget_micros = excluded.budget_micros, updated_at = now();
  select spent_micros, reserved_micros into v_global_spent, v_global_reserved from public.ai_budget_months where month = v_month_date;

  -- The larger model: within the advanced share, while the member's budget still covers every standard request they
  -- have left after this one, and while the app has room.
  if v_tier = 'smart' then
    v_left_after := greatest(0, p_chat_limit - v_total - 1);
    if v_smart >= p_smart_limit then
      v_reason := 'advanced_used';
    elsif v_user_spent + v_estimate + v_left_after::bigint * v_fast > p_user_budget_micros then
      v_reason := 'member_budget';
    elsif (v_global_spent + v_global_reserved + v_estimate) * 100 >= p_global_budget_micros * 90 then
      v_reason := 'global_budget';
    end if;
    if v_reason is not null then
      if p_kind = 'plan' then
        raise exception 'ai_quota_plan_%', v_reason using errcode = 'P0001';
      end if;
      v_tier := 'fast';
      v_estimate := v_fast;
    end if;
  end if;

  if v_user_spent + v_estimate > p_user_budget_micros then
    raise exception 'ai_budget_user' using errcode = 'P0001';
  end if;
  if v_global_spent + v_global_reserved + v_estimate > p_global_budget_micros then
    raise exception 'ai_budget_global' using errcode = 'P0001';
  end if;
  select count(*) into v_inflight_global from public.ai_usage_events e
    where e.finalized_at is null and e.created_at >= now() - make_interval(secs => p_inflight_seconds);
  if v_inflight_global >= p_max_inflight_global then
    raise exception 'ai_busy' using errcode = 'P0001';
  end if;

  insert into public.ai_usage_events (user_id, kind, model_tier, reserved_micros)
    values (p_user_id, p_kind, v_tier, v_estimate)
    returning id into usage_id;
  update public.ai_budget_months set reserved_micros = reserved_micros + v_estimate, updated_at = now() where month = v_month_date;

  model_tier := v_tier;
  user_spent_micros := v_user_spent + v_estimate;
  global_percent := case when p_global_budget_micros > 0
    then floor((v_global_spent + v_global_reserved + v_estimate) * 100.0 / p_global_budget_micros)::integer else 100 end;
  downgrade_reason := v_reason;
  return next;
end;
$$;
revoke all on function public.reserve_ai_usage(uuid, text, text, integer, integer, integer, integer, bigint, bigint, bigint, integer, integer, integer, bigint) from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid, text, text, integer, integer, integer, integer, bigint, bigint, bigint, integer, integer, integer, bigint) to service_role;

-- A request that failed is given back to the member (not counted, not charged to their budget). When the provider may
-- still have billed it (a timeout or cancel after the request was sent, or earlier tool rounds that completed), that
-- amount is added to the global figures, so the app's accounting doesn't under-count real spend.
drop function if exists public.release_ai_usage(uuid);
create or replace function public.release_ai_usage(p_usage_id uuid, p_charge_micros bigint default 0)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserved bigint;
  v_created timestamptz;
begin
  delete from public.ai_usage_events e where e.id = p_usage_id and e.finalized_at is null
    returning e.reserved_micros, e.created_at into v_reserved, v_created;
  if not found then
    return;
  end if;
  perform public.ai_budget_settle(date_trunc('month', v_created at time zone 'utc')::date, v_reserved, greatest(p_charge_micros, 0));
end;
$$;
revoke all on function public.release_ai_usage(uuid, bigint) from public, anon, authenticated;
grant execute on function public.release_ai_usage(uuid, bigint) to service_role;
