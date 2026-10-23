-- Hardening after the launch-readiness review: an idempotency key for food logging, bounds on two unbounded
-- columns, and user_id indexes on child tables that the export and record rebuilds scan by member.

-- Food logging: the device sends a per-attempt id so a retried request can't log an item twice.
alter table public.meal_items add column if not exists client_id uuid;
create unique index if not exists meal_items_user_client_uidx on public.meal_items (user_id, client_id) where client_id is not null;

alter table public.training_adjustments
  add constraint training_adjustments_changes_size_check check (octet_length(changes::text) <= 20000);
alter table public.profiles
  add constraint profiles_avatar_path_check check (avatar_path is null or char_length(avatar_path) <= 300);

create index if not exists workout_sets_user_idx on public.workout_sets (user_id);
create index if not exists meal_items_user_idx on public.meal_items (user_id);
create index if not exists ai_messages_user_idx on public.ai_messages (user_id);
create index if not exists recipe_ingredients_user_idx on public.recipe_ingredients (user_id);
create index if not exists workout_template_exercises_user_idx on public.workout_template_exercises (user_id);
