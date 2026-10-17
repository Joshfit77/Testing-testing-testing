-- Narrow Gate Fitness — core schema
-- All weights are stored in kilograms, lengths in centimetres, volumes in millilitres.
-- Units are converted for display only.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Utility: updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles & onboarding
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  role text not null default 'user' check (role in ('user', 'admin')),
  unit_system text not null default 'imperial' check (unit_system in ('imperial', 'metric')),
  birth_year integer check (birth_year between 1900 and 2100),
  height_cm numeric(5, 1) check (height_cm between 90 and 260),
  faith_enabled boolean not null default false,
  wellness_consent_at timestamptz,
  onboarding_completed_at timestamptz,
  timezone text not null default 'UTC' check (char_length(timezone) <= 64),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.onboarding_answers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  primary_goal text not null check (primary_goal in (
    'build_strength', 'build_muscle', 'lose_fat', 'improve_conditioning',
    'athletic_performance', 'combat_sports', 'general_health', 'mobility')),
  experience text not null check (experience in ('new', 'beginner', 'intermediate', 'advanced')),
  days_per_week integer not null check (days_per_week between 1 and 7),
  session_minutes integer not null check (session_minutes between 10 and 180),
  equipment text[] not null default '{}',
  preferred_types text[] not null default '{}',
  -- Optional, sensitive. Only stored when profiles.wellness_consent_at is set (enforced in app + trigger).
  limitations text check (char_length(limitations) <= 1000),
  dietary_preferences text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger onboarding_answers_updated_at before update on public.onboarding_answers
  for each row execute function public.set_updated_at();

create or replace function public.enforce_wellness_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.limitations is not null and btrim(new.limitations) <> '' then
    if not exists (
      select 1 from public.profiles p
      where p.id = new.user_id and p.wellness_consent_at is not null
    ) then
      raise exception 'Consent is required before storing physical limitation notes'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
create trigger onboarding_answers_consent before insert or update on public.onboarding_answers
  for each row execute function public.enforce_wellness_consent();

create table public.fitness_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  goal_type text not null check (goal_type in ('bodyweight', 'strength', 'frequency', 'nutrition', 'custom')),
  exercise_id uuid,
  start_value numeric,
  target_value numeric,
  unit text check (char_length(unit) <= 20),
  target_date date,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index fitness_goals_user_idx on public.fitness_goals (user_id, status);
create trigger fitness_goals_updated_at before update on public.fitness_goals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Exercise library
-- ---------------------------------------------------------------------------
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(name) between 2 and 100),
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  equipment text[] not null default '{}',
  category text not null check (category in ('strength', 'conditioning', 'mobility', 'plyometric', 'cardio', 'core')),
  movement_pattern text not null default 'other' check (movement_pattern in (
    'squat', 'hinge', 'lunge', 'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull',
    'core', 'rotation', 'carry', 'power', 'conditioning', 'mobility', 'isolation', 'other')),
  mechanics text check (mechanics in ('compound', 'isolation')),
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  is_timed boolean not null default false,
  low_impact boolean not null default false,
  description text not null default '',
  instructions text[] not null default '{}',
  form_cues text[] not null default '{}',
  common_mistakes text[] not null default '{}',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index exercises_category_idx on public.exercises (category) where is_published;
create trigger exercises_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();

alter table public.fitness_goals
  add constraint fitness_goals_exercise_fk foreign key (exercise_id) references public.exercises (id) on delete set null;

create table public.exercise_alternatives (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  alternative_id uuid not null references public.exercises (id) on delete cascade,
  reason text check (char_length(reason) <= 200),
  primary key (exercise_id, alternative_id),
  check (exercise_id <> alternative_id)
);
create index exercise_alternatives_alt_idx on public.exercise_alternatives (alternative_id);

create table public.exercise_media (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  storage_path text,
  external_url text check (external_url is null or external_url ~ '^https://'),
  license text not null check (char_length(license) between 2 and 200),
  attribution text,
  alt_text text not null default '',
  created_at timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);
create index exercise_media_exercise_idx on public.exercise_media (exercise_id);

-- ---------------------------------------------------------------------------
-- Programs
-- ---------------------------------------------------------------------------
create table public.program_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger program_categories_updated_at before update on public.program_categories
  for each row execute function public.set_updated_at();

create table public.training_programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(name) between 2 and 120),
  summary text not null default '',
  description text not null default '',
  category_id uuid references public.program_categories (id) on delete set null,
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  duration_weeks integer not null check (duration_weeks between 1 and 52),
  days_per_week integer not null check (days_per_week between 1 and 7),
  session_minutes integer not null check (session_minutes between 10 and 180),
  goals text[] not null default '{}',
  equipment text[] not null default '{}',
  tier text not null default 'free' check (tier in ('free', 'plus', 'pro')),
  progression text not null default '',
  warmup text[] not null default '{}',
  cooldown text[] not null default '{}',
  low_impact boolean not null default false,
  is_published boolean not null default false,
  -- null owner = curated library program. Non-null = private program (e.g. AI-generated, user approved).
  owner_id uuid references auth.users (id) on delete cascade,
  source text not null default 'curated' check (source in ('curated', 'starter', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (owner_id is null or is_published = false)
);
create index training_programs_category_idx on public.training_programs (category_id);
create index training_programs_owner_idx on public.training_programs (owner_id) where owner_id is not null;
create trigger training_programs_updated_at before update on public.training_programs
  for each row execute function public.set_updated_at();

create table public.program_weeks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.training_programs (id) on delete cascade,
  week_number integer not null check (week_number between 1 and 52),
  focus text not null default '',
  is_deload boolean not null default false,
  unique (program_id, week_number)
);

create table public.program_days (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.program_weeks (id) on delete cascade,
  day_number integer not null check (day_number between 1 and 7),
  name text not null check (char_length(name) between 1 and 120),
  focus text not null default '',
  estimated_minutes integer check (estimated_minutes between 5 and 240),
  warmup text[] not null default '{}',
  cooldown text[] not null default '{}',
  unique (week_id, day_number)
);
create index program_days_week_idx on public.program_days (week_id);

create table public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.program_days (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position integer not null check (position >= 0),
  sets integer not null check (sets between 1 and 20),
  reps text check (char_length(reps) <= 20),
  duration_seconds integer check (duration_seconds between 5 and 7200),
  rest_seconds integer not null default 90 check (rest_seconds between 0 and 900),
  intensity text check (char_length(intensity) <= 60),
  rpe numeric(3, 1) check (rpe between 1 and 10),
  notes text check (char_length(notes) <= 500),
  check (reps is not null or duration_seconds is not null),
  unique (day_id, position)
);
create index program_exercises_day_idx on public.program_exercises (day_id);
create index program_exercises_exercise_idx on public.program_exercises (exercise_id);

create table public.user_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid not null references public.training_programs (id) on delete cascade,
  status text not null default 'saved' check (status in ('saved', 'active', 'paused', 'completed')),
  current_week integer not null default 1 check (current_week >= 1),
  current_day integer not null default 1 check (current_day between 1 and 7),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, program_id)
);
create unique index user_programs_one_active on public.user_programs (user_id) where status = 'active';
create trigger user_programs_updated_at before update on public.user_programs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Workout logging
-- ---------------------------------------------------------------------------
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Client-generated id so retries/restores are idempotent.
  client_id uuid not null,
  user_program_id uuid references public.user_programs (id) on delete set null,
  program_day_id uuid references public.program_days (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'discarded')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  paused_seconds integer not null default 0 check (paused_seconds >= 0),
  notes text check (char_length(notes) <= 2000),
  total_volume_kg numeric(12, 2) not null default 0 check (total_volume_kg >= 0),
  -- Snapshot of an in-progress workout so it can be restored on another device/reload.
  draft jsonb check (draft is null or pg_column_size(draft) < 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id),
  check (ended_at is null or ended_at >= started_at)
);
create index workout_sessions_user_started_idx on public.workout_sessions (user_id, started_at desc);
create trigger workout_sessions_updated_at before update on public.workout_sessions
  for each row execute function public.set_updated_at();

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  substituted_from_id uuid references public.exercises (id) on delete set null,
  position integer not null check (position >= 0),
  notes text check (char_length(notes) <= 1000),
  skipped boolean not null default false,
  skip_reason text check (skip_reason in ('pain', 'equipment', 'time', 'other')),
  created_at timestamptz not null default now()
);
create index workout_exercises_session_idx on public.workout_exercises (session_id, position);
create index workout_exercises_user_exercise_idx on public.workout_exercises (user_id, exercise_id);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  set_number integer not null check (set_number between 1 and 50),
  reps integer check (reps between 0 and 1000),
  weight_kg numeric(7, 2) check (weight_kg between 0 and 1500),
  duration_seconds integer check (duration_seconds between 0 and 86400),
  distance_m numeric(9, 1) check (distance_m >= 0),
  rpe numeric(3, 1) check (rpe between 1 and 10),
  is_warmup boolean not null default false,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
create index workout_sets_exercise_idx on public.workout_sets (workout_exercise_id, set_number);

create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  record_type text not null check (record_type in ('estimated_1rm', 'max_weight', 'max_reps', 'max_set_volume', 'max_duration')),
  value numeric(12, 2) not null check (value >= 0),
  weight_kg numeric(7, 2),
  reps integer,
  session_id uuid references public.workout_sessions (id) on delete set null,
  achieved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index personal_records_user_idx on public.personal_records (user_id, exercise_id, record_type, value desc);

-- ---------------------------------------------------------------------------
-- Body tracking & recovery
-- ---------------------------------------------------------------------------
create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recorded_on date not null,
  weight_kg numeric(5, 2) not null check (weight_kg between 25 and 400),
  created_at timestamptz not null default now(),
  unique (user_id, recorded_on)
);
create index weight_entries_user_idx on public.weight_entries (user_id, recorded_on desc);

create table public.measurement_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recorded_on date not null,
  waist_cm numeric(5, 1) check (waist_cm between 30 and 250),
  chest_cm numeric(5, 1) check (chest_cm between 30 and 250),
  hips_cm numeric(5, 1) check (hips_cm between 30 and 250),
  arm_cm numeric(5, 1) check (arm_cm between 10 and 100),
  thigh_cm numeric(5, 1) check (thigh_cm between 20 and 150),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 2 and 75),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);
create index measurement_entries_user_idx on public.measurement_entries (user_id, recorded_on desc);

create table public.recovery_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  checked_on date not null,
  sleep_quality smallint not null check (sleep_quality between 1 and 5),
  energy smallint not null check (energy between 1 and 5),
  soreness smallint not null check (soreness between 1 and 5),
  stress smallint not null check (stress between 1 and 5),
  readiness_score smallint not null check (readiness_score between 0 and 100),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  unique (user_id, checked_on)
);

-- ---------------------------------------------------------------------------
-- Nutrition
-- ---------------------------------------------------------------------------
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  -- null owner = curated public food; otherwise a user's custom food.
  owner_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  brand text check (char_length(brand) <= 120),
  serving_size numeric(8, 2) not null check (serving_size > 0),
  serving_unit text not null check (char_length(serving_unit) between 1 and 30),
  calories numeric(7, 1) not null check (calories >= 0),
  protein_g numeric(6, 1) not null default 0 check (protein_g >= 0),
  carbs_g numeric(6, 1) not null default 0 check (carbs_g >= 0),
  fat_g numeric(6, 1) not null default 0 check (fat_g >= 0),
  fiber_g numeric(6, 1) check (fiber_g >= 0),
  source text not null default 'custom' check (source in ('custom', 'usda', 'curated')),
  source_ref text,
  is_estimate boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index foods_owner_idx on public.foods (owner_id);
create index foods_name_idx on public.foods using gin (to_tsvector('simple', name));
create unique index foods_owner_source_ref on public.foods (owner_id, source, source_ref) where source_ref is not null;
create trigger foods_updated_at before update on public.foods
  for each row execute function public.set_updated_at();

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Templates (saved meals / recipes) have no date.
  eaten_on date,
  meal_type text not null default 'snack' check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  name text check (char_length(name) <= 120),
  is_template boolean not null default false,
  yield_servings numeric(5, 2) not null default 1 check (yield_servings > 0),
  status text not null default 'logged' check (status in ('logged', 'planned')),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_template or eaten_on is not null),
  check (not is_template or name is not null)
);
create index meals_user_day_idx on public.meals (user_id, eaten_on) where not is_template;
create index meals_user_templates_idx on public.meals (user_id) where is_template;
create trigger meals_updated_at before update on public.meals
  for each row execute function public.set_updated_at();

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  servings numeric(7, 2) not null check (servings > 0),
  calories numeric(7, 1) not null check (calories >= 0),
  protein_g numeric(6, 1) not null default 0 check (protein_g >= 0),
  carbs_g numeric(6, 1) not null default 0 check (carbs_g >= 0),
  fat_g numeric(6, 1) not null default 0 check (fat_g >= 0),
  is_estimate boolean not null default false,
  created_at timestamptz not null default now()
);
create index meal_items_meal_idx on public.meal_items (meal_id);

create table public.nutrition_goals (
  user_id uuid primary key references auth.users (id) on delete cascade,
  calories integer not null check (calories between 800 and 8000),
  protein_g integer not null check (protein_g between 0 and 500),
  carbs_g integer not null check (carbs_g between 0 and 1000),
  fat_g integer not null check (fat_g between 0 and 400),
  water_ml integer not null default 2500 check (water_ml between 0 and 10000),
  is_estimate boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger nutrition_goals_updated_at before update on public.nutrition_goals
  for each row execute function public.set_updated_at();

create table public.water_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recorded_on date not null,
  amount_ml integer not null check (amount_ml between 1 and 5000),
  created_at timestamptz not null default now()
);
create index water_entries_user_idx on public.water_entries (user_id, recorded_on);

-- ---------------------------------------------------------------------------
-- AI coach
-- ---------------------------------------------------------------------------
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);
create trigger ai_conversations_updated_at before update on public.ai_conversations
  for each row execute function public.set_updated_at();

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 20000),
  -- Validated structured proposal (e.g. a workout plan) awaiting user approval.
  proposal jsonb,
  proposal_status text check (proposal_status in ('proposed', 'applied', 'dismissed')),
  created_at timestamptz not null default now()
);
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('chat', 'plan')),
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now()
);
create index ai_usage_events_user_idx on public.ai_usage_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Faith (optional)
-- ---------------------------------------------------------------------------
create table public.faith_journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null default current_date,
  theme text check (theme in ('perseverance', 'humility', 'discipline', 'self_control', 'stewardship', 'gratitude', 'other')),
  scripture_ref text check (char_length(scripture_ref) <= 80),
  title text check (char_length(title) <= 120),
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index faith_journal_user_idx on public.faith_journal_entries (user_id, entry_date desc);
create trigger faith_journal_updated_at before update on public.faith_journal_entries
  for each row execute function public.set_updated_at();

create table public.discipline_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  cadence text not null default 'daily' check (cadence in ('daily', 'weekly')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index discipline_goals_user_idx on public.discipline_goals (user_id);

create table public.discipline_checkins (
  goal_id uuid not null references public.discipline_goals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  checked_on date not null,
  primary key (goal_id, checked_on)
);

-- ---------------------------------------------------------------------------
-- Public content & feature flags (admin managed)
-- ---------------------------------------------------------------------------
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('announcement', 'tip', 'devotional')),
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 10000),
  scripture_ref text check (char_length(scripture_ref) <= 80),
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger content_items_updated_at before update on public.content_items
  for each row execute function public.set_updated_at();

create table public.feature_flags (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  enabled boolean not null default false,
  description text not null default '',
  updated_at timestamptz not null default now()
);
create trigger feature_flags_updated_at before update on public.feature_flags
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Billing
-- ---------------------------------------------------------------------------
create table public.billing_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_price_id text,
  plan text not null check (plan in ('plus', 'pro')),
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions (user_id);
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.user_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'plus', 'pro')),
  source text not null default 'default' check (source in ('default', 'stripe', 'admin')),
  valid_until timestamptz,
  updated_at timestamptz not null default now()
);
create trigger user_entitlements_updated_at before update on public.user_entitlements
  for each row execute function public.set_updated_at();

create table public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Admin audit log
-- ---------------------------------------------------------------------------
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) <= 80),
  entity_type text not null check (char_length(entity_type) <= 60),
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- New user bootstrap
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60), ''))
  on conflict (id) do nothing;
  insert into public.user_entitlements (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
