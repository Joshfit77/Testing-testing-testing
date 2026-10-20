-- Food favorites (SPEC §8 "Favorites and recent foods").
--
-- A favorite points at a food by the same stable source key that meal_items.source uses:
--   usda:<fdcId>      USDA FoodData Central (bundled SR Legacy or the remote API)
--   off:<barcode>     Open Food Facts product
--   food:<uuid>       a row in public.foods (built-in common foods or the user's own saved foods)
-- Hand-entered quick adds ("custom") have no stable identity and can't be favorited.
--
-- name / detail / basis are a display snapshot so the Favorites tab renders without a lookup. When a
-- favorite is logged, nutrition is always re-read on the server from the source (logFoodAction), never
-- taken from this snapshot.
--
-- Rows are private to their owner: owner-only RLS for select / insert / update / delete, no admin
-- access, and they cascade away with the auth user on account deletion.

create table public.food_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_key text not null check (food_key ~ '^(usda:[0-9]{1,10}|off:[0-9]{8,14}|food:[0-9a-f-]{36})$'),
  name text not null check (char_length(name) between 1 and 160),
  detail text check (char_length(detail) <= 200),
  basis jsonb not null check (
    coalesce(jsonb_typeof(basis) = 'object' and jsonb_typeof(basis -> 'per100') = 'object' and octet_length(basis::text) <= 8000, false)
  ),
  is_estimate boolean not null default false,
  created_at timestamptz not null default now(),
  constraint food_favorites_user_key_unique unique (user_id, food_key)
);
create index food_favorites_user_created_idx on public.food_favorites (user_id, created_at desc);

alter table public.food_favorites enable row level security;

create policy food_favorites_select_own on public.food_favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy food_favorites_insert_own on public.food_favorites
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy food_favorites_update_own on public.food_favorites
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy food_favorites_delete_own on public.food_favorites
  for delete to authenticated using (user_id = (select auth.uid()));

comment on table public.food_favorites is 'Foods a user starred for quick logging. Owner-only.';
comment on column public.food_favorites.food_key is 'Stable source key, same format as meal_items.source (usda:/off:/food:).';
