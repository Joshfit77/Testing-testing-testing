-- Narrow Gate Fitness — billing integrity under concurrency, retries and out-of-order delivery; shared rate limits.
--
-- 1. Webhook events (Stripe and RevenueCat) are claimed, not just inserted. Before, the first delivery inserted the
--    event id and a failure deleted it again. A second delivery of the same event that arrived while the first was
--    still running saw the id, answered 200 "duplicate", and Stripe stopped retrying; if the first then failed, the
--    event was lost. Now an event is `processing` under a short lease, `processed` only after its changes are saved,
--    and `failed` (kept, with a short error code) when they weren't. A delivery that finds another one still holding
--    the lease is told to come back later (the route answers 409, so the provider retries).
-- 2. Stripe subscription rows are written through `upsert_stripe_subscription`, which never moves a subscription to
--    another member and never lets an older read of Stripe overwrite a newer one (`synced_at` is when the server read
--    the subscription from Stripe).
-- 3. App Store / Google Play rows are replaced per member in one transaction (`apply_store_snapshot`), ordered by
--    when the server read RevenueCat, so two overlapping syncs can't interleave or leave half a snapshot behind.
-- 4. The member's entitlement is written with a compare-and-set on a per-member billing version
--    (`apply_entitlement`). Every change to a member's subscription rows bumps the version; a recompute that read
--    the rows before another change landed is refused and recomputed, so the last write always reflects the latest
--    rows. A live admin grant of an equal or higher plan is kept, as before.
-- 5. `rate_limit_hit`: a burst limiter shared by every server instance (sliding window over two fixed windows).
--
-- Every function here is service-role only.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Webhook event claims
-- ---------------------------------------------------------------------------------------------------------------
alter table public.stripe_events
  add column status text not null default 'processed' check (status in ('processing', 'processed', 'failed')),
  add column attempts integer not null default 1 check (attempts >= 0),
  add column locked_until timestamptz,
  add column last_error text check (char_length(last_error) <= 300),
  add column received_at timestamptz not null default now();
alter table public.stripe_events alter column processed_at drop not null, alter column processed_at drop default;

alter table public.revenuecat_events
  add column status text not null default 'processed' check (status in ('processing', 'processed', 'failed')),
  add column attempts integer not null default 1 check (attempts >= 0),
  add column locked_until timestamptz,
  add column last_error text check (char_length(last_error) <= 300),
  add column received_at timestamptz not null default now();
alter table public.revenuecat_events alter column processed_at drop not null, alter column processed_at drop default;

create index stripe_events_open_idx on public.stripe_events (status) where status <> 'processed';
create index revenuecat_events_open_idx on public.revenuecat_events (status) where status <> 'processed';

-- Claim an event for processing. Returns 'claimed' (process it now), 'duplicate' (already processed) or 'busy'
-- (another delivery holds an unexpired lease).
create or replace function public.claim_webhook_event(
  p_provider text,
  p_event_id text,
  p_type text,
  p_environment text default null,
  p_lease_seconds integer default 120
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_locked timestamptz;
  v_lease interval := make_interval(secs => greatest(10, least(coalesce(p_lease_seconds, 120), 900)));
begin
  if p_event_id is null or char_length(p_event_id) not between 1 and 200 then
    raise exception 'invalid event id' using errcode = '22023';
  end if;
  if p_provider = 'stripe' then
    insert into public.stripe_events (id, type, status, attempts, locked_until, processed_at)
      values (p_event_id, left(coalesce(p_type, ''), 100), 'processing', 1, now() + v_lease, null)
      on conflict (id) do nothing;
    if found then return 'claimed'; end if;
    select status, locked_until into v_status, v_locked from public.stripe_events where id = p_event_id for update;
    if v_status = 'processed' then return 'duplicate'; end if;
    if v_status = 'processing' and v_locked is not null and v_locked > now() then return 'busy'; end if;
    update public.stripe_events
      set status = 'processing', attempts = attempts + 1, locked_until = now() + v_lease, last_error = null
      where id = p_event_id;
    return 'claimed';
  elsif p_provider = 'revenuecat' then
    insert into public.revenuecat_events (id, type, environment, status, attempts, locked_until, processed_at)
      values (p_event_id, left(coalesce(p_type, ''), 60), left(p_environment, 20), 'processing', 1, now() + v_lease, null)
      on conflict (id) do nothing;
    if found then return 'claimed'; end if;
    select status, locked_until into v_status, v_locked from public.revenuecat_events where id = p_event_id for update;
    if v_status = 'processed' then return 'duplicate'; end if;
    if v_status = 'processing' and v_locked is not null and v_locked > now() then return 'busy'; end if;
    update public.revenuecat_events
      set status = 'processing', attempts = attempts + 1, locked_until = now() + v_lease, last_error = null
      where id = p_event_id;
    return 'claimed';
  else
    raise exception 'unknown provider' using errcode = '22023';
  end if;
end;
$$;

-- Record the outcome of a claimed event. A failure keeps the row (status 'failed', a short error code) so the next
-- delivery can claim it again and the failure stays visible.
create or replace function public.finish_webhook_event(p_provider text, p_event_id text, p_ok boolean, p_error text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_provider = 'stripe' then
    update public.stripe_events
      set status = case when p_ok then 'processed' else 'failed' end,
          processed_at = case when p_ok then now() else null end,
          locked_until = null,
          last_error = case when p_ok then null else left(coalesce(p_error, 'error'), 300) end
      where id = p_event_id;
  elsif p_provider = 'revenuecat' then
    update public.revenuecat_events
      set status = case when p_ok then 'processed' else 'failed' end,
          processed_at = case when p_ok then now() else null end,
          locked_until = null,
          last_error = case when p_ok then null else left(coalesce(p_error, 'error'), 300) end
      where id = p_event_id;
  else
    raise exception 'unknown provider' using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Per-member billing version (bumped by every change to a member's subscription rows)
-- ---------------------------------------------------------------------------------------------------------------
create table public.billing_state_versions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.billing_state_versions enable row level security;
revoke all on public.billing_state_versions from anon, authenticated;
-- billing_state_versions: no policies — service role only.

create or replace function public.bump_billing_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.billing_state_versions as v (user_id, version) values (new.user_id, 1)
      on conflict (user_id) do update set version = v.version + 1, updated_at = now();
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.user_id is distinct from new.user_id) then
    -- Update only: during an account deletion the member's auth row is already going, and inserting a row that
    -- references it would fail the deletion.
    update public.billing_state_versions set version = version + 1, updated_at = now() where user_id = old.user_id;
  end if;
  return null;
end;
$$;
revoke all on function public.bump_billing_version() from public, anon, authenticated;

create trigger subscriptions_billing_version after insert or update or delete on public.subscriptions
  for each row execute function public.bump_billing_version();
create trigger store_subscriptions_billing_version after insert or update or delete on public.store_subscriptions
  for each row execute function public.bump_billing_version();

insert into public.billing_state_versions (user_id, version)
  select distinct user_id, 1 from (select user_id from public.subscriptions union select user_id from public.store_subscriptions) s
  on conflict (user_id) do nothing;

-- Write the member's entitlement if nothing changed their subscription rows since `p_version` was read.
-- Returns 'applied', 'stale' (recompute and try again) or 'kept_admin' (a live admin grant of an equal or higher
-- plan stays).
create or replace function public.apply_entitlement(
  p_user_id uuid,
  p_version bigint,
  p_plan text,
  p_source text,
  p_valid_until timestamptz
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version bigint;
  v_plan text;
  v_source text;
  v_valid timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('entitlement:' || p_user_id::text, 0));
  select version into v_version from public.billing_state_versions where user_id = p_user_id;
  if coalesce(v_version, 0) <> coalesce(p_version, 0) then
    return 'stale';
  end if;
  select plan, source, valid_until into v_plan, v_source, v_valid from public.user_entitlements where user_id = p_user_id;
  if found and v_source = 'admin' and (v_valid is null or v_valid > now())
     and public.plan_rank(v_plan) >= public.plan_rank(p_plan) then
    return 'kept_admin';
  end if;
  insert into public.user_entitlements as e (user_id, plan, source, valid_until)
    values (p_user_id, p_plan, p_source, p_valid_until)
    on conflict (user_id) do update set plan = excluded.plan, source = excluded.source, valid_until = excluded.valid_until;
  return 'applied';
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Stripe subscription rows: ordered, and never moved to another member
-- ---------------------------------------------------------------------------------------------------------------
alter table public.subscriptions add column synced_at timestamptz;

-- Returns 'applied', 'stale' (a newer read of Stripe is already stored) or 'owner_conflict' (the subscription
-- belongs to another member here; nothing is changed).
create or replace function public.upsert_stripe_subscription(
  p_user_id uuid,
  p_subscription_id text,
  p_price_id text,
  p_plan text,
  p_status text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_synced_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_synced timestamptz;
begin
  insert into public.subscriptions (user_id, stripe_subscription_id, stripe_price_id, plan, status, current_period_end, cancel_at_period_end, synced_at)
    values (p_user_id, p_subscription_id, p_price_id, p_plan, p_status, p_current_period_end, coalesce(p_cancel_at_period_end, false), p_synced_at)
    on conflict (stripe_subscription_id) do nothing;
  if found then return 'applied'; end if;
  select user_id, synced_at into v_owner, v_synced from public.subscriptions where stripe_subscription_id = p_subscription_id for update;
  if v_owner is distinct from p_user_id then return 'owner_conflict'; end if;
  if v_synced is not null and p_synced_at is not null and v_synced > p_synced_at then return 'stale'; end if;
  update public.subscriptions
    set stripe_price_id = p_price_id,
        plan = p_plan,
        status = p_status,
        current_period_end = p_current_period_end,
        cancel_at_period_end = coalesce(p_cancel_at_period_end, false),
        synced_at = coalesce(p_synced_at, now())
    where stripe_subscription_id = p_subscription_id;
  return 'applied';
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. App Store / Google Play rows: one member's whole RevenueCat snapshot at once, newest read wins
-- ---------------------------------------------------------------------------------------------------------------
create table public.store_sync_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  fetched_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.store_sync_state enable row level security;
revoke all on public.store_sync_state from anon, authenticated;
-- store_sync_state: no policies — service role only.

-- `p_rows`: a JSON array of store_subscriptions rows (without user_id). Returns 'applied' or 'stale'.
create or replace function public.apply_store_snapshot(p_user_id uuid, p_fetched_at timestamptz, p_rows jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
begin
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'rows must be an array' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('store_sync:' || p_user_id::text, 0));
  select fetched_at into v_last from public.store_sync_state where user_id = p_user_id;
  if v_last is not null and v_last > p_fetched_at then
    return 'stale';
  end if;
  delete from public.store_subscriptions s
    where s.user_id = p_user_id
      and not exists (
        select 1 from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(store text, product_id text)
        where r.store = s.store and r.product_id = s.product_id
      );
  insert into public.store_subscriptions as s (
    user_id, store, product_id, plan, period_type, purchased_at, original_purchased_at, expires_at,
    grace_period_expires_at, unsubscribe_detected_at, billing_issue_detected_at, refunded_at, is_sandbox,
    ownership_type, store_transaction_id
  )
  select p_user_id, r.store, r.product_id, r.plan, r.period_type, r.purchased_at, r.original_purchased_at, r.expires_at,
         r.grace_period_expires_at, r.unsubscribe_detected_at, r.billing_issue_detected_at, r.refunded_at,
         coalesce(r.is_sandbox, false), r.ownership_type, r.store_transaction_id
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(
      store text, product_id text, plan text, period_type text, purchased_at timestamptz, original_purchased_at timestamptz,
      expires_at timestamptz, grace_period_expires_at timestamptz, unsubscribe_detected_at timestamptz,
      billing_issue_detected_at timestamptz, refunded_at timestamptz, is_sandbox boolean, ownership_type text,
      store_transaction_id text
    )
  on conflict (user_id, store, product_id) do update set
    plan = excluded.plan,
    period_type = excluded.period_type,
    purchased_at = excluded.purchased_at,
    original_purchased_at = excluded.original_purchased_at,
    expires_at = excluded.expires_at,
    grace_period_expires_at = excluded.grace_period_expires_at,
    unsubscribe_detected_at = excluded.unsubscribe_detected_at,
    billing_issue_detected_at = excluded.billing_issue_detected_at,
    refunded_at = excluded.refunded_at,
    is_sandbox = excluded.is_sandbox,
    ownership_type = excluded.ownership_type,
    store_transaction_id = excluded.store_transaction_id;
  insert into public.store_sync_state as st (user_id, fetched_at) values (p_user_id, p_fetched_at)
    on conflict (user_id) do update set fetched_at = excluded.fetched_at, updated_at = now();
  return 'applied';
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Shared burst rate limits
-- ---------------------------------------------------------------------------------------------------------------
create table public.rate_limit_counters (
  key text not null check (char_length(key) between 1 and 200),
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);
create index rate_limit_counters_window_idx on public.rate_limit_counters (window_start);
alter table public.rate_limit_counters enable row level security;
revoke all on public.rate_limit_counters from anon, authenticated;
-- rate_limit_counters: no policies — service role only.

-- Count one request for `p_key` and say whether it is within `p_limit` per `p_window_seconds`. The estimate weighs
-- the previous fixed window by how much of it still overlaps the sliding window, so a burst straddling a window
-- boundary can't get twice the limit. A refused request is not counted. Atomic under concurrency: the counter row
-- for the current window is locked by the upsert.
create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_epoch double precision := extract(epoch from v_now);
  v_window timestamptz;
  v_prev integer;
  v_cur integer;
  v_elapsed double precision;
  v_estimate double precision;
begin
  if p_limit < 1 or p_window_seconds < 1 or p_key is null then
    raise exception 'invalid rate limit' using errcode = '22023';
  end if;
  v_window := to_timestamp(floor(v_epoch / p_window_seconds) * p_window_seconds);
  v_elapsed := (v_epoch - extract(epoch from v_window)) / p_window_seconds;
  -- Lock (or create) this window's counter first, so concurrent calls for the key serialize here.
  insert into public.rate_limit_counters as c (key, window_start, hits) values (left(p_key, 200), v_window, 0)
    on conflict (key, window_start) do update set hits = c.hits
    returning c.hits into v_cur;
  select coalesce((select hits from public.rate_limit_counters
                   where key = left(p_key, 200) and window_start = v_window - make_interval(secs => p_window_seconds)), 0)
    into v_prev;
  v_estimate := v_prev * (1 - v_elapsed) + v_cur;
  if v_estimate + 1 > p_limit then
    allowed := false;
    retry_after_seconds := greatest(1, ceil(p_window_seconds * (1 - v_elapsed))::integer);
    return next;
    return;
  end if;
  update public.rate_limit_counters set hits = hits + 1 where key = left(p_key, 200) and window_start = v_window;
  -- Occasional clean-up of old windows.
  if random() < 0.01 then
    delete from public.rate_limit_counters where window_start < v_now - interval '2 days';
  end if;
  allowed := true;
  retry_after_seconds := 0;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Service role only
-- ---------------------------------------------------------------------------------------------------------------
revoke all on function public.claim_webhook_event(text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.finish_webhook_event(text, text, boolean, text) from public, anon, authenticated;
revoke all on function public.apply_entitlement(uuid, bigint, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.upsert_stripe_subscription(uuid, text, text, text, text, timestamptz, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.apply_store_snapshot(uuid, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_webhook_event(text, text, text, text, integer) to service_role;
grant execute on function public.finish_webhook_event(text, text, boolean, text) to service_role;
grant execute on function public.apply_entitlement(uuid, bigint, text, text, timestamptz) to service_role;
grant execute on function public.upsert_stripe_subscription(uuid, text, text, text, text, timestamptz, boolean, timestamptz) to service_role;
grant execute on function public.apply_store_snapshot(uuid, timestamptz, jsonb) to service_role;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
