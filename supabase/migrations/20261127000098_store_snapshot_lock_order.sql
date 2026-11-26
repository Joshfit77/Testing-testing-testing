-- Store billing: no deadlock when two accounts restore one purchase at once, and a rotation failing members can't pin.
--
-- 1. Two accounts restoring the same store purchase at the same moment could deadlock (correctness review 3).
--
-- apply_store_snapshot (migration 096) writes the member's store rows, whose trigger locks the member's
-- billing_state_versions row, and then bumps the versions of the other accounts holding the same transactions. Two
-- snapshots for two such accounts took those row locks in opposite orders: Postgres aborted one with "deadlock
-- detected" and that restore failed (seen intermittently in store-billing.test.ts, 6 concurrent restores).
-- Now every version row involved is locked up front in member-id order, so concurrent snapshots queue instead.
-- Behaviour is otherwise identical to 096.
--
-- 2. See the second part below (store rotation).
--
-- Rollback: re-run the apply_store_snapshot and store_reconcile_candidates definitions from migration 096; the
-- attempted_at column can stay (nothing else reads it) or be dropped.

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
  -- Lock the billing versions of this member and of every other holder of those transactions now, in one fixed
  -- order (by member id), before any row is written. Without this, two accounts syncing the same purchase at once
  -- each locked their own version (through the store_subscriptions trigger) and then waited for the other's:
  -- a deadlock, and one restore failed. The member's own row is created first if it doesn't exist yet.
  insert into public.billing_state_versions (user_id, version) values (p_user_id, 0) on conflict (user_id) do nothing;
  perform 1 from public.billing_state_versions v
    where v.user_id = p_user_id
       or (v_tx is not null and v.user_id in (select s.user_id from public.store_subscriptions s where s.store_transaction_id = any(v_tx)))
    order by v.user_id
    for update;
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

-- The store rotation could be pinned by members whose sync keeps failing (correctness review 6): fetched_at only moves
-- on a successful snapshot, so they stayed first in line every run. Reconciliation now records each attempt, and the
-- rotation orders by the later of the last success and the last attempt.
alter table public.store_sync_state add column if not exists attempted_at timestamptz;

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
  order by greatest(st.fetched_at, coalesce(st.attempted_at, '-infinity'::timestamptz)) asc
  limit greatest(1, least(p_limit, 1000));
$$;
revoke all on function public.store_reconcile_candidates(integer, timestamptz) from public, anon, authenticated;
grant execute on function public.store_reconcile_candidates(integer, timestamptz) to service_role;
