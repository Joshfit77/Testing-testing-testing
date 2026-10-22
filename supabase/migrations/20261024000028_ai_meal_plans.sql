-- Narrow Gate Fitness — personalized AI meal plans (Pro), and the AI usage kinds for the later AI food features.
--
-- The AI only chooses among dishes the app can already measure (the member's recipes and saved meals and the
-- built-in recipes, all with nutrition from the food database) and suggests portions. Every number shown is
-- computed by the app from those values, never by the AI. A generated plan is a draft until the member approves
-- it; only then does it become a normal meal plan (swap, portions, log to diary, grocery list as before).

-- Each AI request is still one of the member's monthly AI messages; the kind says what it was for.
alter table public.ai_usage_events drop constraint if exists ai_usage_events_kind_check;
alter table public.ai_usage_events add constraint ai_usage_events_kind_check
  check (kind in ('chat', 'plan', 'meal_plan', 'food_photo', 'food_explain'));

-- One draft per member, replaced by the next generation, removed when approved or discarded.
create table public.meal_plan_drafts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  start_date date not null,
  days smallint not null check (days in (1, 3, 7)),
  focus text not null check (focus in ('balanced', 'high_protein', 'weight_loss', 'muscle_gain', 'maintenance')),
  notes text check (char_length(notes) <= 300),
  -- Targets the plan was built for, with how they were derived.
  targets jsonb not null check (jsonb_typeof(targets) = 'object' and octet_length(targets::text) <= 2000),
  settings jsonb not null check (jsonb_typeof(settings) = 'object' and octet_length(settings::text) <= 4000),
  -- [{ date, meals: [{ slotIndex, key, portion, by: 'ai' | 'planner' }] }]: dish keys and portions only.
  days_plan jsonb not null check (jsonb_typeof(days_plan) = 'array' and octet_length(days_plan::text) <= 40000),
  summary text check (char_length(summary) <= 1500),
  model text check (char_length(model) <= 100),
  created_at timestamptz not null default now()
);

alter table public.meal_plan_drafts enable row level security;
create policy meal_plan_drafts_select_own on public.meal_plan_drafts for select to authenticated using (user_id = (select auth.uid()));
create policy meal_plan_drafts_delete_own on public.meal_plan_drafts for delete to authenticated using (user_id = (select auth.uid()));
-- Drafts are written by the server after an AI request (service role); members can't plant their own.
