-- ROLLBACK (loses no pre-existing data — every row written before this migration has basis null, and the columns
-- the app fell back to before are untouched and still written on every cache upsert):
--   alter table public.foods drop column if exists basis;
-- The constraint below is attached to the column and goes with it. Roll back the app code first (or together):
-- the current food-resolve cache upsert and the My foods queries name the basis column.
--
-- Full nutrition basis for cached foods (N5): a barcode (Open Food Facts) or USDA food is cached in foods when it
-- is logged, but the columns hold one serving of plain numbers with unlisted macros stored as 0, so a re-log from
-- My foods lost the `missing` list (totals no longer read "at least"), sugar, sodium and the label serving. The
-- basis as built at lookup time is now stored alongside, in the same format and with the same check as
-- meal_items.basis (20261019000008_food_amounts.sql); the app prefers it when it is valid and otherwise rebuilds
-- from the columns exactly as before, so rows without a basis (custom, built-in, and foods cached earlier) log
-- with the same numbers as today. A cached row gets its basis the next time that product is looked up again.
--
-- Additive and live-safe: a nullable column with no default is a catalog-only change (no rewrite). The CHECK is
-- validated against existing rows, which are all null, under a brief ACCESS EXCLUSIVE lock. No index is added.
-- RLS: the foods policies are row-level (owner_id), not column lists, and there are no column grants on foods, so
-- the column is readable / writable exactly where the row already is. Cached rows are per user (owner_id = the
-- member); built-in rows (owner_id null) never get a basis. Account deletion cascades on owner_id, and the data
-- export reads foods with select * by owner_id (src/server/services/account.ts), so both already cover it.

alter table public.foods
  add column if not exists basis jsonb check (
    basis is null
    or coalesce(jsonb_typeof(basis) = 'object' and jsonb_typeof(basis -> 'per100') = 'object' and octet_length(basis::text) <= 8000, false)
  );

comment on column public.foods.basis is 'Nutrition basis as looked up (per 100 g/ml or per serving, label serving, sugar, sodium, missing macros) for cached barcode / USDA foods; null = rebuild from the columns.';
