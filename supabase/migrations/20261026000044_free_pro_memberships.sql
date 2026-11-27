-- Narrow Gate Fitness — Free and Pro All Access (owner decision of 2026-10-26).
--
-- New customers can choose only Free or Pro All Access ($19.99 a month or $149.99 a year, the same features).
-- Plus is no longer sold; the 'plus' plan value stays valid so existing Plus subscriptions keep their access until
-- they end. Nothing existing is changed or removed by this migration: no subscription, entitlement, activity or
-- route is rewritten. It only adds columns and governs new writes.

-- 1. Refunds and disputes (Stripe). A full refund or a dispute of the payment for a subscription's current period
--    ends the access that payment bought; the subscription row keeps its Stripe status. A later paid period, or a
--    dispute closed in the merchant's favour, restores access (src/server/services/billing.ts).
alter table public.subscriptions
  add column access_revoked_at timestamptz,
  add column access_revoked_reason text check (access_revoked_reason in ('refund', 'dispute')),
  add column revoked_invoice_id text check (revoked_invoice_id is null or char_length(revoked_invoice_id) <= 200),
  add constraint subscriptions_revocation_complete check (
    (access_revoked_at is null and access_revoked_reason is null)
    or (access_revoked_at is not null and access_revoked_reason is not null)
  );

-- 2. Live GPS recording is part of Pro (and of legacy Plus subscriptions, which included it). Manual and treadmill
--    run and walk logging stays free. A trigger rather than a policy, because an update has to compare the old row
--    with the new one: a member on Free can still edit the notes or effort of a run they recorded earlier, delete it,
--    or remove its route, but can't create a GPS recording or attach a route. Server-side writes (the service role,
--    with no signed-in member) aren't affected, so imports, exports and account deletion behave as before.
create or replace function public.enforce_live_gps_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  adds_gps boolean;
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    adds_gps := new.source = 'gps' or new.route is not null;
  else
    adds_gps := (new.source = 'gps' and old.source is distinct from 'gps')
      or (new.route is not null and new.route is distinct from old.route);
  end if;
  if adds_gps and public.plan_rank(public.plan_of(new.user_id)) < public.plan_rank('plus') then
    raise exception 'Live GPS recording is included with Pro' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_live_gps_plan() from public, anon, authenticated;

create trigger activities_live_gps_plan before insert or update on public.activities
  for each row execute function public.enforce_live_gps_plan();
