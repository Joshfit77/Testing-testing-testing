-- Narrow Gate Fitness — App Store / Google Play subscriptions through RevenueCat.
--
-- RevenueCat is the source of truth for in-app purchases. After every RevenueCat webhook (and after a purchase or
-- "Restore purchases" in the app) the server fetches the customer's current state from RevenueCat's REST API and
-- stores one row per store product here. Entitlements are then recomputed from these rows together with the
-- Stripe rows in `subscriptions`, so a member who pays on both gets the higher plan. Only the service role writes.
create table public.store_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  store text not null check (store in ('app_store', 'play_store', 'test_store', 'other')),
  product_id text not null check (char_length(product_id) <= 200),
  -- The plan this product grants (from the RevenueCat entitlement it unlocks). Null if it isn't attached to one.
  plan text check (plan in ('plus', 'pro')),
  period_type text check (char_length(period_type) <= 20),
  purchased_at timestamptz,
  original_purchased_at timestamptz,
  expires_at timestamptz,
  grace_period_expires_at timestamptz,
  unsubscribe_detected_at timestamptz,
  billing_issue_detected_at timestamptz,
  refunded_at timestamptz,
  is_sandbox boolean not null default false,
  ownership_type text check (char_length(ownership_type) <= 30),
  store_transaction_id text check (char_length(store_transaction_id) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, store, product_id)
);
create index store_subscriptions_user_idx on public.store_subscriptions (user_id);
create trigger store_subscriptions_updated_at before update on public.store_subscriptions
  for each row execute function public.set_updated_at();

alter table public.store_subscriptions enable row level security;
create policy store_subscriptions_select_own on public.store_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

-- Webhook deliveries already processed (RevenueCat retries with the same event id). No personal data is kept.
create table public.revenuecat_events (
  id text primary key check (char_length(id) <= 200),
  type text not null check (char_length(type) <= 60),
  environment text check (char_length(environment) <= 20),
  processed_at timestamptz not null default now()
);
alter table public.revenuecat_events enable row level security;
-- revenuecat_events: no policies — service role only.

-- Entitlements can now come from the stores as well as Stripe and admin grants.
alter table public.user_entitlements drop constraint user_entitlements_source_check;
alter table public.user_entitlements
  add constraint user_entitlements_source_check check (source in ('default', 'stripe', 'admin', 'app_store', 'play_store'));
