-- Food Quality Scanner. Product data is read from Open Food Facts when a product is opened and is never copied into
-- the app's food tables. The only new data is the member's own product filters (allergens to avoid, vegan or
-- vegetarian, nutrition preferences), used for Plus checks and comparisons.

alter table public.profiles
  add column if not exists food_filters jsonb check (food_filters is null or (jsonb_typeof(food_filters) = 'object' and octet_length(food_filters::text) <= 2000));
grant update (food_filters) on public.profiles to authenticated;
