-- Narrow Gate Fitness — Stage 2A nutrition: recipes, meal planner, grocery list and day marks (SPEC §8).
--
-- Every table is private to its owner: owner-only RLS for select / insert / update / delete, no admin
-- access, and every row cascades away with the auth user on account deletion. Child rows (recipe
-- ingredients, plan entries, grocery items) also check that the parent row belongs to the same user.
--
-- Deletes are hard deletes, like meals and saved meals: diary entries logged from a recipe or a plan keep
-- their own snapshot of the nutrition (meal_items.basis), so deleting the recipe or plan never changes
-- what was eaten.

-- ---------------------------------------------------------------------------
-- Recipes
-- ---------------------------------------------------------------------------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  servings numeric(6, 2) not null default 1 check (servings > 0 and servings <= 100),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipes_user_idx on public.recipes (user_id, name);
create trigger recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

-- One row per ingredient. `basis` is a snapshot of the food's nutrition in the same format as
-- meal_items.basis (per 100 g / ml, label serving, USDA household portions, missing macros), taken from the
-- source on the server when the ingredient was added. `quantity` + `unit_label` are the amount picked.
create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position smallint not null default 0 check (position between 0 and 199),
  name text not null check (char_length(name) between 1 and 160),
  source text not null check (source ~ '^(usda:[0-9]{1,10}|off:[0-9]{8,14}|food:[0-9a-f-]{36})$'),
  quantity numeric(10, 3) not null check (quantity > 0 and quantity <= 100000),
  unit_label text not null check (char_length(unit_label) between 1 and 100),
  grams numeric(8, 1) check (grams > 0 and grams <= 20000),
  amount_label text check (char_length(amount_label) between 1 and 160),
  basis jsonb not null check (
    coalesce(jsonb_typeof(basis) = 'object' and jsonb_typeof(basis -> 'per100') = 'object' and octet_length(basis::text) <= 8000, false)
  ),
  is_estimate boolean not null default false,
  created_at timestamptz not null default now()
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, position);

-- Diary entries logged from a recipe or a built-in planner recipe point back at it.
alter table public.meal_items drop constraint if exists meal_items_source_check;
alter table public.meal_items add constraint meal_items_source_check
  check (source ~ '^(usda:[0-9]{1,10}|off:[0-9]{8,14}|food:[0-9a-f-]{36}|recipe:[0-9a-f-]{36}|app:[a-z0-9-]{1,60}|custom)$');

-- ---------------------------------------------------------------------------
-- Meal planner
-- ---------------------------------------------------------------------------
create table public.meal_plan_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  meals_per_day smallint not null default 3 check (meals_per_day between 2 and 5),
  budget text not null default 'any' check (budget in ('low', 'medium', 'any')),
  allergies text[] not null default '{}' check (cardinality(allergies) <= 20 and octet_length(array_to_string(allergies, ',')) <= 1000),
  dislikes text[] not null default '{}' check (cardinality(dislikes) <= 20 and octet_length(array_to_string(dislikes, ',')) <= 1000),
  include_app_recipes boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger meal_plan_settings_updated_at before update on public.meal_plan_settings
  for each row execute function public.set_updated_at();

-- A generated plan for a run of days. `targets` and `settings` are snapshots of what it was built for.
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  start_date date not null,
  days smallint not null default 7 check (days between 1 and 14),
  targets jsonb not null check (jsonb_typeof(targets) = 'object' and octet_length(targets::text) <= 2000),
  settings jsonb not null check (jsonb_typeof(settings) = 'object' and octet_length(settings::text) <= 4000),
  created_at timestamptz not null default now(),
  constraint meal_plans_user_start_unique unique (user_id, start_date)
);

-- One planned meal. Planned meals are separate from what was eaten: "Log this meal" copies it into the
-- diary (meals / meal_items) and records logged_at here.
create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.meal_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_date date not null,
  slot smallint not null check (slot between 0 and 4),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  label text not null check (char_length(label) between 1 and 40),
  source_key text not null check (source_key ~ '^(app:[a-z0-9-]{1,60}|recipe:[0-9a-f-]{36}|meal:[0-9a-f-]{36})$'),
  name text not null check (char_length(name) between 1 and 160),
  portion numeric(4, 2) not null check (portion >= 0.25 and portion <= 4),
  -- Nutrition for ONE serving at planning time, plus whether every ingredient had data.
  per_serving jsonb not null check (jsonb_typeof(per_serving) = 'object' and octet_length(per_serving::text) <= 2000),
  -- Ingredient amounts for ONE serving, for the grocery list: [{key, name, quantity, unitLabel}].
  ingredients jsonb not null default '[]' check (jsonb_typeof(ingredients) = 'array' and octet_length(ingredients::text) <= 20000),
  logged_at timestamptz,
  created_at timestamptz not null default now(),
  constraint meal_plan_entries_slot_unique unique (plan_id, plan_date, slot)
);
create index meal_plan_entries_user_date_idx on public.meal_plan_entries (user_id, plan_date);

-- ---------------------------------------------------------------------------
-- Grocery list (one per user)
-- ---------------------------------------------------------------------------
create table public.grocery_lists (
  user_id uuid primary key references auth.users (id) on delete cascade,
  from_date date,
  to_date date,
  generated_at timestamptz,
  updated_at timestamptz not null default now(),
  check (from_date is null or to_date is null or from_date <= to_date)
);
create trigger grocery_lists_updated_at before update on public.grocery_lists
  for each row execute function public.set_updated_at();

create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  quantity numeric(10, 2) check (quantity is null or (quantity > 0 and quantity <= 100000)),
  unit text check (char_length(unit) between 1 and 60),
  note text check (char_length(note) <= 300),
  origin text not null check (origin in ('plan', 'manual')),
  ingredient_key text check (char_length(ingredient_key) <= 80),
  checked boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index grocery_items_user_idx on public.grocery_items (user_id, position);

-- ---------------------------------------------------------------------------
-- Day marks: "this day is complete" or "I ate nothing" (a fast), so weekly summaries can tell a day
-- logged as zero from a day that simply wasn't logged.
-- ---------------------------------------------------------------------------
create table public.nutrition_day_marks (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  status text not null check (status in ('complete', 'fasted')),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
create trigger nutrition_day_marks_updated_at before update on public.nutrition_day_marks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: owner-only
-- ---------------------------------------------------------------------------
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.meal_plan_settings enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_plan_entries enable row level security;
alter table public.grocery_lists enable row level security;
alter table public.grocery_items enable row level security;
alter table public.nutrition_day_marks enable row level security;

do $$
declare t text;
begin
  foreach t in array array['recipes', 'meal_plan_settings', 'meal_plans', 'grocery_lists', 'grocery_items', 'nutrition_day_marks'] loop
    execute format('create policy %1$s_select_own on public.%1$s for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy %1$s_insert_own on public.%1$s for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy %1$s_update_own on public.%1$s for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy %1$s_delete_own on public.%1$s for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Children: the row and its parent must both be the user's own.
create policy recipe_ingredients_select_own on public.recipe_ingredients
  for select to authenticated using (user_id = (select auth.uid()));
create policy recipe_ingredients_insert_own on public.recipe_ingredients
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid()))
  );
create policy recipe_ingredients_update_own on public.recipe_ingredients
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid()))
  );
create policy recipe_ingredients_delete_own on public.recipe_ingredients
  for delete to authenticated using (user_id = (select auth.uid()));

create policy meal_plan_entries_select_own on public.meal_plan_entries
  for select to authenticated using (user_id = (select auth.uid()));
create policy meal_plan_entries_insert_own on public.meal_plan_entries
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.meal_plans p where p.id = plan_id and p.user_id = (select auth.uid()))
  );
create policy meal_plan_entries_update_own on public.meal_plan_entries
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.meal_plans p where p.id = plan_id and p.user_id = (select auth.uid()))
  );
create policy meal_plan_entries_delete_own on public.meal_plan_entries
  for delete to authenticated using (user_id = (select auth.uid()));

comment on table public.recipes is 'User recipes (ingredients in recipe_ingredients). Owner-only.';
comment on table public.recipe_ingredients is 'Recipe ingredients with a nutrition basis snapshot. Owner-only.';
comment on table public.meal_plan_settings is 'Meal planner preferences: meals per day, budget, allergies, dislikes. Owner-only.';
comment on table public.meal_plans is 'Generated meal plans. Owner-only.';
comment on table public.meal_plan_entries is 'Planned meals (separate from the diary until logged). Owner-only.';
comment on table public.grocery_lists is 'The date range the grocery list was generated for. Owner-only.';
comment on table public.grocery_items is 'Grocery list lines (from the plan or added by hand). Owner-only.';
comment on table public.nutrition_day_marks is 'Days marked complete or as a fast (logged as zero). Owner-only.';
