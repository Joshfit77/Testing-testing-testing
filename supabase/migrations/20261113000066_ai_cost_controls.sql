-- ROLLBACK (restores request-count metering only; member data, conversations and usage history are untouched):
--   drop function if exists public.release_ai_usage(uuid);
--   drop function if exists public.ai_budget_check(bigint);
--   drop function if exists public.finalize_ai_usage(uuid, text, integer, integer, bigint);
--   drop function if exists public.ai_budget_settle(date, bigint, bigint);
--   drop function if exists public.reserve_ai_usage(uuid, text, text, integer, integer, integer, integer, bigint, bigint, bigint, integer, integer, integer);
--   drop table if exists public.ai_budget_alerts;
--   drop table if exists public.ai_budget_months;
--   alter table public.ai_usage_events drop column if exists cost_micros, drop column if exists reserved_micros,
--     drop column if exists finalized_at;
--   then re-apply reserve_ai_usage from 20261024000032_food_photos.sql. Roll back the app code first: it calls the
--   new functions.
--
-- AI cost controls. Until now the server counted requests; it now also accounts in money (micro-USD):
--   * each request holds its expected cost while it runs (reserved_micros) and records its real cost when done;
--   * a per-member monthly budget and a global monthly budget are checked under locks before any provider call;
--   * operators are alerted once per month at 50%, 75%, 90% and 100% of the global budget (ai_budget_alerts);
--   * a member may have a small number of requests in flight, and the whole app a capped number at once;
--   * the reservation tells the app to use the fast model when a member's or the app's budget is running low.
-- Nothing here touches non-AI features: running out of AI budget only stops AI requests.

alter table public.ai_usage_events
  add column cost_micros bigint not null default 0 check (cost_micros >= 0),
  add column reserved_micros bigint not null default 0 check (reserved_micros >= 0),
  add column finalized_at timestamptz;

-- Rows written before this migration are finished requests. Their cost is estimated from the tokens recorded
-- (input tokens at the full input price, which over-counts cached reads: a conservative figure).
update public.ai_usage_events
set finalized_at = created_at,
    cost_micros = case
      when model like 'claude-haiku%' then ceil(input_tokens * 0.10 + output_tokens * 0.50)
      when model like 'claude-sonnet%' then ceil(input_tokens * 2 + output_tokens * 10)
      else ceil(input_tokens * 4 + output_tokens * 20)
    end::bigint;

create index ai_usage_events_inflight_idx on public.ai_usage_events (created_at) where finalized_at is null;

-- One row per calendar month (UTC): the budget in force and what has been spent and is being held.
create table public.ai_budget_months (
  month date primary key check (extract(day from month) = 1),
  budget_micros bigint not null check (budget_micros >= 0),
  spent_micros bigint not null default 0 check (spent_micros >= 0),
  reserved_micros bigint not null default 0 check (reserved_micros >= 0),
  updated_at timestamptz not null default now()
);

-- Each threshold alerts once per month.
create table public.ai_budget_alerts (
  month date not null,
  threshold integer not null check (threshold in (50, 75, 90, 100)),
  spent_micros bigint not null,
  budget_micros bigint not null,
  fired_at timestamptz not null default now(),
  primary key (month, threshold)
);

alter table public.ai_budget_months enable row level security;
alter table public.ai_budget_alerts enable row level security;
-- No policies: members can't read or write these; only the service role (server) does.
revoke all on public.ai_budget_months, public.ai_budget_alerts from anon, authenticated;

-- The old reservation function (7 arguments) is replaced.
drop function if exists public.reserve_ai_usage(uuid, text, text, integer, integer, integer, integer);

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
  p_inflight_seconds integer
)
returns table (usage_id uuid, model_tier text, user_spent_micros bigint, global_percent integer)
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
begin
  -- Per member first (one lock per member), then the shared budget (one global lock, held for milliseconds).
  perform pg_advisory_xact_lock(hashtextextended('ai_usage:' || p_user_id::text, 0));

  select count(*), count(*) filter (where e.kind = 'plan'), count(*) filter (where e.model_tier = 'smart'),
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
  -- The member's money budget: spent plus what is held for running requests plus this one.
  if v_user_spent + v_estimate > p_user_budget_micros then
    raise exception 'ai_budget_user' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ai_budget:global', 0));
  -- A request whose server died before it could record its cost would hold budget for ever. After twice the in-flight
  -- window it is closed and charged at its estimate (never at zero: the provider may still have billed it).
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
  if v_global_spent + v_global_reserved + v_estimate > p_global_budget_micros then
    raise exception 'ai_budget_global' using errcode = 'P0001';
  end if;
  select count(*) into v_inflight_global from public.ai_usage_events e
    where e.finalized_at is null and e.created_at >= now() - make_interval(secs => p_inflight_seconds);
  if v_inflight_global >= p_max_inflight_global then
    raise exception 'ai_busy' using errcode = 'P0001';
  end if;

  -- The larger model only while the member's share lasts and both budgets have room.
  if v_tier = 'smart' and (
    v_smart >= p_smart_limit
    or (p_kind <> 'plan' and v_user_spent * 100 >= p_user_budget_micros * 75)
    or (p_kind <> 'plan' and (v_global_spent + v_global_reserved) * 100 >= p_global_budget_micros * 90)
  ) then
    v_tier := 'fast';
  end if;

  insert into public.ai_usage_events (user_id, kind, model_tier, reserved_micros)
    values (p_user_id, p_kind, v_tier, v_estimate)
    returning id into usage_id;
  update public.ai_budget_months set reserved_micros = reserved_micros + v_estimate, updated_at = now() where month = v_month_date;

  model_tier := v_tier;
  user_spent_micros := v_user_spent + v_estimate;
  global_percent := case when p_global_budget_micros > 0
    then floor((v_global_spent + v_global_reserved + v_estimate) * 100.0 / p_global_budget_micros)::integer else 100 end;
  return next;
end;
$$;
revoke all on function public.reserve_ai_usage(uuid, text, text, integer, integer, integer, integer, bigint, bigint, bigint, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid, text, text, integer, integer, integer, integer, bigint, bigint, bigint, integer, integer, integer) to service_role;

-- Move spend into this month's global figures and return the alert thresholds it crossed (each fires once per
-- month). Shared by the coach, the other AI features and the free Bible study helper.
create or replace function public.ai_budget_settle(p_month date, p_held bigint, p_cost bigint)
returns table (threshold integer, spent_micros bigint, budget_micros bigint)
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
  select m.spent_micros, m.budget_micros into v_before, v_budget from public.ai_budget_months m where m.month = p_month;
  if not found then
    return;
  end if;
  update public.ai_budget_months m
    set spent_micros = m.spent_micros + v_cost, reserved_micros = greatest(0, m.reserved_micros - greatest(p_held, 0)), updated_at = now()
    where m.month = p_month;
  v_after := v_before + v_cost;
  foreach t in array array[50, 75, 90, 100] loop
    if v_budget > 0 and v_before * 100 < v_budget * t and v_after * 100 >= v_budget * t then
      insert into public.ai_budget_alerts (month, threshold, spent_micros, budget_micros)
        values (p_month, t, v_after, v_budget)
        on conflict do nothing;
      if found then
        threshold := t;
        spent_micros := v_after;
        budget_micros := v_budget;
        return next;
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function public.ai_budget_settle(date, bigint, bigint) from public, anon, authenticated;
grant execute on function public.ai_budget_settle(date, bigint, bigint) to service_role;

-- Is there room in this month's global budget? For AI that has its own per-member limits and isn't counted per
-- request here (the free Bible study helper): it checks before calling the provider and settles its real cost after.
create or replace function public.ai_budget_check(p_global_budget_micros bigint)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_date date := date_trunc('month', now() at time zone 'utc')::date;
  v_used bigint;
begin
  insert into public.ai_budget_months (month, budget_micros) values (v_month_date, p_global_budget_micros)
    on conflict (month) do update set budget_micros = excluded.budget_micros, updated_at = now();
  select spent_micros + reserved_micros into v_used from public.ai_budget_months where month = v_month_date;
  if v_used >= p_global_budget_micros then
    raise exception 'ai_budget_global' using errcode = 'P0001';
  end if;
  return v_month_date;
end;
$$;
revoke all on function public.ai_budget_check(bigint) from public, anon, authenticated;
grant execute on function public.ai_budget_check(bigint) to service_role;

-- Record what a request really used, move its hold to spent, and return the global alert thresholds this request
-- crossed. Calling it twice for the same request changes nothing the second time.
create or replace function public.finalize_ai_usage(
  p_usage_id uuid,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cost_micros bigint
)
returns table (threshold integer, spent_micros bigint, budget_micros bigint)
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
    set model = p_model, input_tokens = p_input_tokens, output_tokens = p_output_tokens, cost_micros = v_cost, finalized_at = now()
    where e.id = p_usage_id and e.finalized_at is null
    returning e.reserved_micros, e.created_at into v_reserved, v_created;
  if not found then
    return;
  end if;
  return query select * from public.ai_budget_settle(date_trunc('month', v_created at time zone 'utc')::date, v_reserved, v_cost);
end;
$$;
revoke all on function public.finalize_ai_usage(uuid, text, integer, integer, bigint) from public, anon, authenticated;
grant execute on function public.finalize_ai_usage(uuid, text, integer, integer, bigint) to service_role;

-- A request that failed before the provider answered: give back its hold and its count.
create or replace function public.release_ai_usage(p_usage_id uuid)
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
  perform public.ai_budget_settle(date_trunc('month', v_created at time zone 'utc')::date, v_reserved, 0);
end;
$$;
revoke all on function public.release_ai_usage(uuid) from public, anon, authenticated;
grant execute on function public.release_ai_usage(uuid) to service_role;
