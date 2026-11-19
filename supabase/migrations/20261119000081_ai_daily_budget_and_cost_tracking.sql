-- ROLLBACK (member data, conversations and usage history are untouched; roll back the app code first, it calls the
-- new function signatures):
--   drop function if exists public.admin_ai_cost_report(timestamptz, timestamptz);
--   drop function if exists public.finalize_ai_usage(uuid, text, integer, integer, bigint, integer, integer, bigint);
--   drop function if exists public.reserve_ai_usage(uuid, text, text, integer, integer, integer, integer, bigint, bigint, bigint, integer, integer, integer, bigint, bigint, text);
--   drop function if exists public.ai_budget_day_settle(date, bigint, bigint);
--   drop function if exists public.ai_default_daily_budget(bigint);
--   then re-apply finalize_ai_usage from 20261113000066_ai_cost_controls.sql and reserve_ai_usage and
--   release_ai_usage from 20261113000068_ai_allowance_rules.sql;
--   drop table if exists public.ai_budget_day_alerts; drop table if exists public.ai_budget_days;
--   alter table public.ai_usage_events drop column if exists cache_read_tokens, drop column if exists cache_write_tokens,
--     drop column if exists no_cache_cost_micros, drop column if exists route_reason, drop column if exists downgrade_reason;
--
-- M0 of the AI coach expansion (2026-11-19):
--   * A global DAILY spending limit, enforced in reserve_ai_usage under the same global lock as the monthly one, before
--     any provider call. The monthly limits are unchanged. The app passes the daily limit; if it doesn't, the database
--     uses twice the month's average day (monthly budget x 2 / days in the month), so there is always a daily limit.
--     Days are UTC calendar days. Operators are alerted once per day at 80% and 100%.
--   * Better cost records per request: cache-read and cache-write input tokens, what the request would have cost with
--     no prompt caching (so cache savings are measured, not assumed), why the model tier was chosen (route_reason) and
--     why it was lowered (downgrade_reason).
--   * admin_ai_cost_report: aggregate figures only (no member ids), for admins and the service role.

alter table public.ai_usage_events
  add column if not exists cache_read_tokens integer not null default 0 check (cache_read_tokens >= 0),
  add column if not exists cache_write_tokens integer not null default 0 check (cache_write_tokens >= 0),
  -- The same tokens priced as if nothing were cached. Null for requests recorded before this migration.
  add column if not exists no_cache_cost_micros bigint check (no_cache_cost_micros >= 0),
  add column if not exists route_reason text check (route_reason in ('quick', 'complex', 'plan', 'smart_budget_used', 'feature')),
  add column if not exists downgrade_reason text check (downgrade_reason in ('advanced_used', 'member_budget', 'global_budget', 'global_daily_budget'));

comment on column public.ai_usage_events.input_tokens is 'All input tokens of the request: uncached + cache reads + cache writes (uncached = input_tokens - cache_read_tokens - cache_write_tokens).';

-- Global spending by day (UTC) and the reports: the same shape as ai_budget_months.
create index if not exists ai_usage_events_created_idx on public.ai_usage_events (created_at);

create table if not exists public.ai_budget_days (
  day date primary key,
  budget_micros bigint not null check (budget_micros >= 0),
  spent_micros bigint not null default 0 check (spent_micros >= 0),
  reserved_micros bigint not null default 0 check (reserved_micros >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_budget_day_alerts (
  day date not null,
  threshold integer not null check (threshold in (80, 100)),
  spent_micros bigint not null,
  budget_micros bigint not null,
  fired_at timestamptz not null default now(),
  primary key (day, threshold)
);

alter table public.ai_budget_days enable row level security;
alter table public.ai_budget_day_alerts enable row level security;
-- No policies: members can't read or write these; only the service role (server) does.
revoke all on public.ai_budget_days, public.ai_budget_day_alerts from anon, authenticated;

-- The daily limit when the caller doesn't give one: twice the month's average day.
create or replace function public.ai_default_daily_budget(p_global_budget_micros bigint)
returns bigint
language sql
stable
as $$
  select ceil(greatest(p_global_budget_micros, 0) * 2.0
    / extract(day from (date_trunc('month', now() at time zone 'utc') + interval '1 month' - interval '1 day')))::bigint;
$$;
revoke all on function public.ai_default_daily_budget(bigint) from public, anon, authenticated;
grant execute on function public.ai_default_daily_budget(bigint) to service_role;

-- Move spend into a day's figures and return the daily alert thresholds it crossed (each fires once per day).
create or replace function public.ai_budget_day_settle(p_day date, p_held bigint, p_cost bigint)
returns table (period text, threshold integer, spent_micros bigint, budget_micros bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before bigint;
  v_after bigint;
  v_budget bigint;
  v_cost bigint := greatest(p_cost, 0);
  t integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('ai_budget:global', 0));
  select d.spent_micros, d.budget_micros into v_before, v_budget from public.ai_budget_days d where d.day = p_day;
  if not found then
    return;
  end if;
  update public.ai_budget_days d
    set spent_micros = d.spent_micros + v_cost, reserved_micros = greatest(0, d.reserved_micros - greatest(p_held, 0)), updated_at = now()
    where d.day = p_day;
  v_after := v_before + v_cost;
  foreach t in array array[80, 100] loop
    if v_budget > 0 and v_before * 100 < v_budget * t and v_after * 100 >= v_budget * t then
      insert into public.ai_budget_day_alerts (day, threshold, spent_micros, budget_micros)
        values (p_day, t, v_after, v_budget)
        on conflict do nothing;
      if found then
        period := 'day';
        threshold := t;
        spent_micros := v_after;
        budget_micros := v_budget;
        return next;
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function public.ai_budget_day_settle(date, bigint, bigint) from public, anon, authenticated;
grant execute on function public.ai_budget_day_settle(date, bigint, bigint) to service_role;

-- ------------------------------------------------------------------------------------------------- reserve_ai_usage
-- As in 068, plus: the daily global limit (refused as 'ai_budget_global_daily'; the larger model is not used from 90%
-- of it, reason 'global_daily_budget'), and the route reason stored with the request.
drop function if exists public.reserve_ai_usage(uuid, text, text, integer, integer, integer, integer, bigint, bigint, bigint, integer, integer, integer, bigint);

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
  p_fast_estimate_micros bigint default 3400,
  p_global_daily_budget_micros bigint default null,
  p_route_reason text default null
)
returns table (usage_id uuid, model_tier text, user_spent_micros bigint, global_percent integer, downgrade_reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  v_month_date date := date_trunc('month', now() at time zone 'utc')::date;
  v_day date := (now() at time zone 'utc')::date;
  v_daily bigint := coalesce(p_global_daily_budget_micros, public.ai_default_daily_budget(p_global_budget_micros));
  v_total integer;
  v_plans integer;
  v_smart integer;
  v_recent integer;
  v_user_spent bigint;
  v_inflight_user integer;
  v_inflight_global integer;
  v_global_spent bigint;
  v_global_reserved bigint;
  v_day_spent bigint;
  v_day_reserved bigint;
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
  -- Close holds left by servers that died (charged at their estimate), in their month and their day.
  with stale as (
    update public.ai_usage_events e set finalized_at = now(), cost_micros = e.reserved_micros
      where e.finalized_at is null and e.created_at < now() - make_interval(secs => p_inflight_seconds * 2)
      returning e.reserved_micros as held, date_trunc('month', e.created_at at time zone 'utc')::date as m, (e.created_at at time zone 'utc')::date as d
  ), by_month as (
    update public.ai_budget_months bm
      set spent_micros = bm.spent_micros + s.total, reserved_micros = greatest(0, bm.reserved_micros - s.total), updated_at = now()
      from (select stale.m, sum(stale.held)::bigint as total from stale group by stale.m) s
      where bm.month = s.m
  )
  update public.ai_budget_days bd
    set spent_micros = bd.spent_micros + s.total, reserved_micros = greatest(0, bd.reserved_micros - s.total), updated_at = now()
    from (select stale.d, sum(stale.held)::bigint as total from stale group by stale.d) s
    where bd.day = s.d;

  insert into public.ai_budget_months (month, budget_micros) values (v_month_date, p_global_budget_micros)
    on conflict (month) do update set budget_micros = excluded.budget_micros, updated_at = now();
  select spent_micros, reserved_micros into v_global_spent, v_global_reserved from public.ai_budget_months where month = v_month_date;
  insert into public.ai_budget_days (day, budget_micros) values (v_day, v_daily)
    on conflict (day) do update set budget_micros = excluded.budget_micros, updated_at = now();
  select spent_micros, reserved_micros into v_day_spent, v_day_reserved from public.ai_budget_days where day = v_day;

  -- The larger model: within the advanced share, while the member's budget still covers every standard request they
  -- have left after this one, and while the app has room this month and today.
  if v_tier = 'smart' then
    v_left_after := greatest(0, p_chat_limit - v_total - 1);
    if v_smart >= p_smart_limit then
      v_reason := 'advanced_used';
    elsif v_user_spent + v_estimate + v_left_after::bigint * v_fast > p_user_budget_micros then
      v_reason := 'member_budget';
    elsif (v_global_spent + v_global_reserved + v_estimate) * 100 >= p_global_budget_micros * 90 then
      v_reason := 'global_budget';
    elsif (v_day_spent + v_day_reserved + v_estimate) * 100 >= v_daily * 90 then
      v_reason := 'global_daily_budget';
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
  if v_day_spent + v_day_reserved + v_estimate > v_daily then
    raise exception 'ai_budget_global_daily' using errcode = 'P0001';
  end if;
  select count(*) into v_inflight_global from public.ai_usage_events e
    where e.finalized_at is null and e.created_at >= now() - make_interval(secs => p_inflight_seconds);
  if v_inflight_global >= p_max_inflight_global then
    raise exception 'ai_busy' using errcode = 'P0001';
  end if;

  insert into public.ai_usage_events (user_id, kind, model_tier, reserved_micros, route_reason, downgrade_reason)
    values (p_user_id, p_kind, v_tier, v_estimate, p_route_reason, v_reason)
    returning id into usage_id;
  update public.ai_budget_months set reserved_micros = reserved_micros + v_estimate, updated_at = now() where month = v_month_date;
  update public.ai_budget_days set reserved_micros = reserved_micros + v_estimate, updated_at = now() where day = v_day;

  model_tier := v_tier;
  user_spent_micros := v_user_spent + v_estimate;
  global_percent := case when p_global_budget_micros > 0
    then floor((v_global_spent + v_global_reserved + v_estimate) * 100.0 / p_global_budget_micros)::integer else 100 end;
  downgrade_reason := v_reason;
  return next;
end;
$$;
revoke all on function public.reserve_ai_usage(uuid, text, text, integer, integer, integer, integer, bigint, bigint, bigint, integer, integer, integer, bigint, bigint, text) from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid, text, text, integer, integer, integer, integer, bigint, bigint, bigint, integer, integer, integer, bigint, bigint, text) to service_role;

-- ------------------------------------------------------------------------------------------------ finalize_ai_usage
-- As in 066, plus the cache breakdown and the no-cache cost, settled into the month and the day. Returns the alert
-- thresholds crossed, labelled by period ('month' or 'day'). Calling it twice for the same request changes nothing.
drop function if exists public.finalize_ai_usage(uuid, text, integer, integer, bigint);

create or replace function public.finalize_ai_usage(
  p_usage_id uuid,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cost_micros bigint,
  p_cache_read_tokens integer default 0,
  p_cache_write_tokens integer default 0,
  p_no_cache_cost_micros bigint default null
)
returns table (period text, threshold integer, spent_micros bigint, budget_micros bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserved bigint;
  v_created timestamptz;
  v_cost bigint := greatest(p_cost_micros, 0);
begin
  update public.ai_usage_events e
    set model = p_model, input_tokens = p_input_tokens, output_tokens = p_output_tokens, cost_micros = v_cost,
        cache_read_tokens = greatest(coalesce(p_cache_read_tokens, 0), 0), cache_write_tokens = greatest(coalesce(p_cache_write_tokens, 0), 0),
        no_cache_cost_micros = case when p_no_cache_cost_micros is null then null else greatest(p_no_cache_cost_micros, 0) end,
        finalized_at = now()
    where e.id = p_usage_id and e.finalized_at is null
    returning e.reserved_micros, e.created_at into v_reserved, v_created;
  if not found then
    return;
  end if;
  return query
    select 'month'::text, m.threshold, m.spent_micros, m.budget_micros
      from public.ai_budget_settle(date_trunc('month', v_created at time zone 'utc')::date, v_reserved, v_cost) m
    union all
    select d.period, d.threshold, d.spent_micros, d.budget_micros
      from public.ai_budget_day_settle((v_created at time zone 'utc')::date, v_reserved, v_cost) d;
end;
$$;
revoke all on function public.finalize_ai_usage(uuid, text, integer, integer, bigint, integer, integer, bigint) from public, anon, authenticated;
grant execute on function public.finalize_ai_usage(uuid, text, integer, integer, bigint, integer, integer, bigint) to service_role;

-- ------------------------------------------------------------------------------------------------- release_ai_usage
-- As in 068 (same signature), now also settling the day.
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
  perform public.ai_budget_day_settle((v_created at time zone 'utc')::date, v_reserved, greatest(p_charge_micros, 0));
end;
$$;
revoke all on function public.release_ai_usage(uuid, bigint) from public, anon, authenticated;
grant execute on function public.release_ai_usage(uuid, bigint) to service_role;

-- ------------------------------------------------------------------------------------------- admin_ai_cost_report
-- Aggregate AI usage and cost between two instants: totals, by model, by tier, by feature, by routing reason and
-- downgrade reason, by UTC day, the cache savings, and what members actually cost (averages and spread over the members
-- who used AI, and the average over current Pro members). No member ids or personal data leave this function.
-- Failed requests the member got back are not rows here; what the provider may still have billed for them is in the
-- global budget figures (ai_budget_months / ai_budget_days), which the report includes.
create or replace function public.admin_ai_cost_report(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');
  v_out jsonb;
begin
  if not (public.is_admin() or v_role = 'service_role') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  with ev as (
    select e.*, (e.created_at at time zone 'utc')::date as d
      from public.ai_usage_events e
      where e.created_at >= p_from and e.created_at < p_to and e.finalized_at is not null
  ), per_member as (
    select ev.user_id, sum(ev.cost_micros)::bigint as cost, count(*) as requests from ev group by ev.user_id
  ), agg as (
    select
      count(*) as requests,
      coalesce(sum(cost_micros), 0)::bigint as cost_micros,
      coalesce(sum(input_tokens), 0)::bigint as input_tokens,
      coalesce(sum(output_tokens), 0)::bigint as output_tokens,
      coalesce(sum(cache_read_tokens), 0)::bigint as cache_read_tokens,
      coalesce(sum(cache_write_tokens), 0)::bigint as cache_write_tokens,
      count(no_cache_cost_micros) as requests_with_cache_data,
      coalesce(sum(no_cache_cost_micros), 0)::bigint as no_cache_cost_micros,
      coalesce(sum(cost_micros) filter (where no_cache_cost_micros is not null), 0)::bigint as cost_micros_with_cache_data
    from ev
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'totals', (select to_jsonb(agg) from agg),
    'by_model', coalesce((select jsonb_agg(x order by x.cost_micros desc) from (
      select coalesce(model, 'unknown') as model, model_tier as tier, count(*) as requests, sum(cost_micros)::bigint as cost_micros,
             sum(input_tokens)::bigint as input_tokens, sum(output_tokens)::bigint as output_tokens,
             sum(cache_read_tokens)::bigint as cache_read_tokens, sum(cache_write_tokens)::bigint as cache_write_tokens,
             round(avg(cost_micros))::bigint as avg_cost_micros, max(cost_micros)::bigint as max_cost_micros
        from ev group by 1, 2) x), '[]'::jsonb),
    'by_kind', coalesce((select jsonb_agg(x order by x.cost_micros desc) from (
      select kind, count(*) as requests, sum(cost_micros)::bigint as cost_micros, round(avg(cost_micros))::bigint as avg_cost_micros
        from ev group by 1) x), '[]'::jsonb),
    'by_route_reason', coalesce((select jsonb_agg(x order by x.requests desc) from (
      select coalesce(route_reason, 'not recorded') as route_reason, model_tier as tier, coalesce(downgrade_reason, 'none') as downgrade_reason,
             count(*) as requests, sum(cost_micros)::bigint as cost_micros
        from ev group by 1, 2, 3) x), '[]'::jsonb),
    'by_day', coalesce((select jsonb_agg(x order by x.day) from (
      select ev.d as day, count(*) as requests, sum(cost_micros)::bigint as cost_micros,
             count(*) filter (where model_tier = 'fast') as fast_requests, count(*) filter (where model_tier = 'smart') as smart_requests,
             (select bd.spent_micros from public.ai_budget_days bd where bd.day = ev.d) as budget_spent_micros,
             (select bd.budget_micros from public.ai_budget_days bd where bd.day = ev.d) as daily_budget_micros
        from ev group by ev.d) x), '[]'::jsonb),
    'members', (select jsonb_build_object(
        'members_using_ai', count(*),
        'avg_cost_micros', coalesce(round(avg(cost)), 0)::bigint,
        'median_cost_micros', coalesce(percentile_cont(0.5) within group (order by cost), 0)::bigint,
        'p90_cost_micros', coalesce(percentile_cont(0.9) within group (order by cost), 0)::bigint,
        'max_cost_micros', coalesce(max(cost), 0)::bigint,
        'avg_requests', coalesce(round(avg(requests), 1), 0)
      ) from per_member),
    'pro_members_now', (select count(*) from public.user_entitlements where plan = 'pro'),
    'budget_months', coalesce((select jsonb_agg(to_jsonb(bm) order by bm.month) from public.ai_budget_months bm
        where bm.month >= date_trunc('month', p_from at time zone 'utc')::date and bm.month < p_to), '[]'::jsonb),
    'budget_month_alerts', coalesce((select jsonb_agg(to_jsonb(a) order by a.month, a.threshold) from public.ai_budget_alerts a
        where a.month >= date_trunc('month', p_from at time zone 'utc')::date and a.month < p_to), '[]'::jsonb),
    'budget_day_alerts', coalesce((select jsonb_agg(to_jsonb(a) order by a.day, a.threshold) from public.ai_budget_day_alerts a
        where a.day >= (p_from at time zone 'utc')::date and a.day < p_to), '[]'::jsonb)
  ) into v_out;
  return v_out;
end;
$$;
revoke all on function public.admin_ai_cost_report(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_ai_cost_report(timestamptz, timestamptz) to authenticated, service_role;
