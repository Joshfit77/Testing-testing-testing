-- Barcode scanning: products looked up on Open Food Facts are cached per user in public.foods
-- with source 'openfoodfacts' and source_ref = the product barcode.

alter table public.foods drop constraint if exists foods_source_check;
alter table public.foods
  add constraint foods_source_check check (source in ('custom', 'usda', 'curated', 'openfoodfacts'));

-- Users may cache Open Food Facts products for themselves, like USDA foods.
drop policy if exists foods_insert_own on public.foods;
create policy foods_insert_own on public.foods
  for insert to authenticated with check (
    (owner_id = (select auth.uid()) and source in ('custom', 'usda', 'openfoodfacts'))
    or (owner_id is null and public.is_admin())
  );

-- Cached USDA / Open Food Facts foods are upserted with ON CONFLICT (owner_id, source, source_ref).
-- Postgres can't use a *partial* unique index for that, so the original index made those upserts fail
-- (error 42P10). A plain unique index behaves the same for rows without a source_ref, because
-- NULLs never conflict with each other.
drop index if exists public.foods_owner_source_ref;
create unique index foods_owner_source_ref on public.foods (owner_id, source, source_ref);
