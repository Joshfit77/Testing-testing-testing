-- ROLLBACK (run in this order; loses no pre-existing data — every row written before this migration has
-- client_id null, and dropping the column only removes the idempotency keys of water logged after it):
--   drop index if exists public.water_entries_user_client_uidx;
--   alter table public.water_entries drop column if exists client_id;
-- Roll back the app code first (or together): the current addWaterAction writes client_id.
--
-- Water logging idempotency (N7): the device sends one id per tap and reuses it when that tap is retried, so a
-- request whose response was lost can't add the same glass twice. The same pattern as meal_items.client_id
-- (20261024000040_review_hardening.sql). Existing rows keep client_id null and are unaffected; inserts without a
-- client id (older clients) behave exactly as before, since the unique index only covers non-null ids.
--
-- Additive and live-safe: adding a nullable column with no default is a catalog-only change (no table rewrite).
-- The index is a plain `create unique index`, like every index in these migrations, because the migration runner
-- (supabase db push / migration up, and the bundled setup-all.sql in the SQL editor) runs each file inside a
-- transaction, and `create index concurrently` cannot run inside a transaction block. A plain build holds a SHARE
-- lock on water_entries (writes wait, reads continue) only while it runs; on a small table that is milliseconds.
-- On a large production table, build it first outside a transaction so writes never block:
--   create unique index concurrently if not exists water_entries_user_client_uidx
--     on public.water_entries (user_id, client_id) where client_id is not null;
-- and this file's `if not exists` then makes the statement below a no-op. (If a concurrent build fails it leaves an
-- INVALID index: drop it and rerun.) No existing row can violate it: all existing client_ids are null.

alter table public.water_entries add column if not exists client_id uuid;

create unique index if not exists water_entries_user_client_uidx
  on public.water_entries (user_id, client_id) where client_id is not null;

comment on column public.water_entries.client_id is 'Per-tap id sent by the device; a retried request with the same id is not counted twice (null for older entries).';
