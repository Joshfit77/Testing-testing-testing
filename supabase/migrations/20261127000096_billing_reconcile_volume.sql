-- Billing at volume: reconciliation state, the store rotation chosen in SQL, and concurrent restores (production
-- consolidation round 3; independent payments review findings 2, 3 and 5).
--
-- 1. billing_reconcile_state: when Stripe's event log was last replayed completely, so the next run starts there (up to
--    Stripe's 30-day retention) instead of a fixed 3 days: a webhook outage longer than 3 days is still repaired.
-- 2. store_reconcile_candidates(): members with a current (or just ended) store subscription, least recently read
--    from RevenueCat first. Chosen in SQL: the previous selection took the oldest rows of every member ever synced and
--    filtered afterwards, so lapsed members could fill the window and starve current subscribers.
-- 3. apply_store_snapshot(): also bumps the billing version of any other account holding one of the member's store
--    transactions (before or after the snapshot), so a concurrent recompute on that account reads again instead of
--    keeping a purchase that now belongs to this one.
--
-- ROLLBACK: drop function if exists public.store_reconcile_candidates(integer, timestamptz);
--           drop table if exists public.billing_reconcile_state;
--           re-run apply_store_snapshot from 20261101000046_billing_integrity.sql.

create table if not exists public.billing_reconcile_state (
  id smallint primary key default 1 check (id = 1),
  stripe_events_through timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.billing_reconcile_state enable row level security;
revoke all on public.billing_reconcile_state from anon, authenticated;
-- billing_reconcile_state: no policies, service role only.

create or replace function public.store_reconcile_candidates(p_limit integer, p_now timestamptz default now())
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select st.user_id
  from public.store_sync_state st
  where exists (
    select 1 from public.store_subscriptions s
    where s.user_id = st.user_id
      and coalesce(greatest(s.expires_at, s.grace_period_expires_at), 'infinity'::timestamptz) >= p_now - interval '3 days'
  )
  order by st.fetched_at asc
  limit greatest(1, least(p_limit, 1000));
$$;
revoke all on function public.store_reconcile_candidates(integer, timestamptz) from public, anon, authenticated;
grant execute on function public.store_reconcile_candidates(integer, timestamptz) to service_role;

create or replace function public.apply_store_snapshot(p_user_id uuid, p_fetched_at timestamptz, p_rows jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
  v_tx text[];
begin
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'rows must be an array' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('store_sync:' || p_user_id::text, 0));
  select fetched_at into v_last from public.store_sync_state where user_id = p_user_id;
  if v_last is not null and v_last > p_fetched_at then
    return 'stale';
  end if;
  -- Every store transaction this member held before or holds after this snapshot (O-10, concurrent restores).
  select array_agg(distinct t) into v_tx from (
    select store_transaction_id as t from public.store_subscriptions where user_id = p_user_id and store_transaction_id is not null
    union
    select r.store_transaction_id from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(store_transaction_id text)
    where r.store_transaction_id is not null
  ) x;
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
  -- Another account holding one of those transactions may be mid-recompute with a picture from before this snapshot:
  -- bumping its billing version makes that recompute's compare-and-set fail and read again, so two accounts can't both
  -- keep a purchase that only one may have.
  if v_tx is not null then
    update public.billing_state_versions v set version = v.version + 1, updated_at = now()
      where v.user_id in (
        select distinct s.user_id from public.store_subscriptions s
        where s.store_transaction_id = any(v_tx) and s.user_id <> p_user_id
      );
  end if;
  return 'applied';
end;
$$;
