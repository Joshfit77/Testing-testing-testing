-- Sandbox tester allow-list (launch-critical item 4).
--
-- App Store / Google Play sandbox purchases (development builds, TestFlight, App Review) cost nothing, and every build
-- talks to the one deployed server. Until now the server either ignored all of them (REVENUECAT_ALLOW_SANDBOX unset:
-- App Review's purchase would not unlock Pro) or counted all of them (set: every TestFlight tester gets free Pro on
-- the production server). This list lets named accounts count sandbox purchases and nobody else:
--   - keyed by the account's stable user id (auth.users.id, which is also its RevenueCat app user id), never by email;
--   - checked on the server when RevenueCat is read (store-billing.ts) and again whenever the plan is recomputed
--     (billing.ts), so removing or expiring an entry stops a stored sandbox purchase from granting anything;
--   - written only by administrators (the admin Subscriptions page) or the service role; members can't read or write
--     it, so nobody can enrol themselves.
-- Production purchases are unaffected, and a sandbox purchase never becomes a production one: store_subscriptions
-- keeps RevenueCat's is_sandbox flag on every row.

create table public.sandbox_testers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Who this is and why (e.g. "App Review demo account", "TestFlight: internal QA"). Shown to admins, and included in
  -- the member's own data export, so keep it factual.
  note text not null check (char_length(note) between 1 and 200),
  added_by uuid references auth.users (id) on delete set null,
  -- Optional end of the access (e.g. the end of a TestFlight round). Null: until removed.
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.sandbox_testers enable row level security;
-- No policies: only the service role (server code) reads or writes it.
revoke all on public.sandbox_testers from anon, authenticated;

create or replace function public.is_sandbox_tester(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.sandbox_testers t where t.user_id = p_user_id and (t.expires_at is null or t.expires_at > now()));
$$;
revoke execute on function public.is_sandbox_tester(uuid) from anon, authenticated, public;
