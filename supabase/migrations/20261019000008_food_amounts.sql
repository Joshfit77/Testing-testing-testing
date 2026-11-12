-- MyFitnessPal-style amounts for logged food: the exact weight eaten, the unit and quantity picked
-- ("6 oz", "1.5 cup, chopped"), a readable amount ("6 oz (170 g)"), fiber / sugar / sodium, where the
-- values came from, and the nutrition basis (per 100 g, label serving, USDA portions) so an entry can be
-- edited later. All columns are nullable: entries logged before this migration keep working and are
-- edited as "servings" of their own values.
--
-- meal_items already has owner-only RLS for select / insert / update / delete (user_id = auth.uid(),
-- and the parent meal must be the user's own); new columns are covered by those row policies.

alter table public.meal_items
  add column if not exists grams numeric(8, 1) check (grams > 0 and grams <= 20000),
  add column if not exists quantity numeric(10, 3) check (quantity > 0 and quantity <= 100000),
  add column if not exists unit_label text check (char_length(unit_label) between 1 and 100),
  add column if not exists amount_label text check (char_length(amount_label) between 1 and 160),
  add column if not exists fiber_g numeric(6, 1) check (fiber_g >= 0),
  add column if not exists sugar_g numeric(6, 1) check (sugar_g >= 0),
  add column if not exists sodium_mg numeric(9, 1) check (sodium_mg >= 0),
  add column if not exists source text check (source ~ '^(usda:[0-9]{1,10}|off:[0-9]{8,14}|food:[0-9a-f-]{36}|custom)$'),
  add column if not exists basis jsonb check (
    basis is null
    or coalesce(jsonb_typeof(basis) = 'object' and jsonb_typeof(basis -> 'per100') = 'object' and octet_length(basis::text) <= 8000, false)
  );
