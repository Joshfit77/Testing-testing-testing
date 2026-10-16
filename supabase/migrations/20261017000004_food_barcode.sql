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
