-- Indexes for the billing repairs added in the production consolidation (O-09, O-10).
--   * One store purchase grants one account: recomputing an entitlement looks up other accounts holding the same
--     store transaction (src/server/services/billing.ts, transactionsHeldMoreRecentlyElsewhere).
--   * Reconciliation rotates through members by when RevenueCat was last read for them (billing-reconcile.ts).
-- ROLLBACK: drop index if exists public.store_subscriptions_transaction_idx; drop index if exists public.store_sync_state_fetched_idx;
create index if not exists store_subscriptions_transaction_idx on public.store_subscriptions (store_transaction_id) where store_transaction_id is not null;
create index if not exists store_sync_state_fetched_idx on public.store_sync_state (fetched_at);
