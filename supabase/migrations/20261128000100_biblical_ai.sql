-- Narrow Gate Biblical AI (behind the strict feature flag `biblical_ai`, off by default).
--
-- Additive only: new tables, new columns with defaults on bible_ai_usage, new functions, one flag row. Nothing
-- existing is changed or removed; the existing Bible study helper (bible_ai_messages) keeps working as before.
--
-- Members read and delete their own conversations, messages, saved studies and reports (RLS). Every write goes
-- through the server (service role) after the server has checked the session, the flag, consent and the plan.
-- Administrators never read conversations: the admin views are aggregate functions, and an inaccuracy report holds
-- only what the member chose to send with it.
--
-- Rollback (nothing else depends on these objects):
--   drop function if exists public.biblical_ai_admin_metrics(integer), public.biblical_ai_set_source_status(text, text, text, boolean, uuid);
--   drop table if exists public.biblical_ai_source_audit, public.biblical_ai_source_documents, public.biblical_ai_sources,
--     public.biblical_ai_feedback, public.biblical_ai_saved_studies, public.biblical_ai_messages, public.biblical_ai_conversations;
--   alter table public.bible_ai_usage drop column if exists feature, drop column if exists depth,
--     drop column if exists latency_ms, drop column if exists validation_failures;
--   delete from public.feature_flags where key = 'biblical_ai';

insert into public.feature_flags (key, enabled, description)
values ('biblical_ai', false, 'Narrow Gate Biblical AI: the expanded Scripture study assistant in Faith. Off until the owner approves it (release gates in docs/biblical-ai/READINESS.md).')
on conflict (key) do nothing;

-- Usage: Biblical AI questions share the Bible helper's per-member question counter (reserve_bible_ai_usage).
alter table public.bible_ai_usage
  add column if not exists feature text not null default 'helper' check (feature in ('helper', 'biblical_ai', 'study_plan')),
  add column if not exists depth text check (depth in ('quick', 'standard', 'deep')),
  add column if not exists latency_ms integer check (latency_ms >= 0),
  add column if not exists validation_failures integer not null default 0 check (validation_failures >= 0);

create table public.biblical_ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  category text not null check (category in ('scripture', 'doctrine', 'apologetics', 'languages', 'history', 'personal')),
  -- The passage the study started from, as a verified reference ("John 3:16"), when opened from the reader.
  passage text check (char_length(passage) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index biblical_ai_conversations_user_idx on public.biblical_ai_conversations (user_id, updated_at desc);

create table public.biblical_ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.biblical_ai_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  -- The question, or the answer's plain text (for history and copying).
  content text not null check (char_length(content) between 1 and 24000),
  -- The validated, structured answer (sections, verified references, original-language notes).
  answer jsonb check (answer is null or jsonb_typeof(answer) = 'object'),
  depth text check (depth in ('quick', 'standard', 'deep')),
  model text check (char_length(model) <= 80),
  -- The client's id for this question: a retried request returns the saved answer instead of asking twice.
  request_id uuid,
  created_at timestamptz not null default now()
);
create index biblical_ai_messages_conversation_idx on public.biblical_ai_messages (conversation_id, created_at);
create index biblical_ai_messages_user_idx on public.biblical_ai_messages (user_id, created_at desc);
create unique index biblical_ai_messages_request_idx on public.biblical_ai_messages (user_id, request_id, role) where request_id is not null;

create table public.biblical_ai_saved_studies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('answer', 'plan')),
  title text not null check (char_length(title) between 1 and 120),
  conversation_id uuid references public.biblical_ai_conversations (id) on delete set null,
  message_id uuid references public.biblical_ai_messages (id) on delete set null,
  -- kind 'answer': a copy of the validated answer; kind 'plan': { objective, days: [{ day, title, readings, ... }] }.
  content jsonb not null check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 200000),
  note text check (char_length(note) <= 4000),
  bookmarked boolean not null default false,
  -- kind 'plan': the days the member has marked done.
  completed_days integer[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index biblical_ai_saved_studies_user_idx on public.biblical_ai_saved_studies (user_id, updated_at desc);

-- A member's report that an answer was inaccurate (or helpful). The question and answer are copied in only because
-- the member chose to send them for review; the screen says so.
create table public.biblical_ai_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message_id uuid references public.biblical_ai_messages (id) on delete set null,
  kind text not null check (kind in ('inaccurate', 'helpful', 'unhelpful')),
  note text check (char_length(note) <= 1000),
  question text check (char_length(question) <= 2000),
  answer text check (char_length(answer) <= 24000),
  status text not null default 'open' check (status in ('open', 'reviewed')),
  created_at timestamptz not null default now()
);
create index biblical_ai_feedback_status_idx on public.biblical_ai_feedback (status, created_at desc);
create index biblical_ai_feedback_user_idx on public.biblical_ai_feedback (user_id, created_at desc);

-- Source inventory: what Biblical AI may draw on, with rights and approval. Teachers' material is used only from
-- documents of an approved source; until then no teacher is quoted or summarised.
create table public.biblical_ai_sources (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,60}$'),
  kind text not null check (kind in ('scripture', 'original_language', 'lexicon', 'cross_reference', 'teacher', 'history')),
  name text not null check (char_length(name) <= 160),
  author text check (char_length(author) <= 120),
  ministry text check (char_length(ministry) <= 160),
  official_url text check (official_url is null or official_url ~ '^https://'),
  licence text check (char_length(licence) <= 400),
  commercial_use text not null default 'unknown' check (commercial_use in ('permitted', 'not_permitted', 'unknown')),
  storage_permitted text not null default 'unknown' check (storage_permitted in ('permitted', 'not_permitted', 'unknown')),
  attribution text check (char_length(attribution) <= 400),
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'disabled')),
  notes text check (char_length(notes) <= 2000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

-- Approved, licensed passages of commentary or history, for retrieval. Empty until a source is approved and its
-- documents are loaded with their author, title, URL and date (scripts/ load nothing automatically).
create table public.biblical_ai_source_documents (
  id uuid primary key default gen_random_uuid(),
  source_slug text not null references public.biblical_ai_sources (slug) on delete cascade,
  author text not null check (char_length(author) <= 120),
  title text not null check (char_length(title) <= 300),
  url text not null check (url ~ '^https://' and char_length(url) <= 600),
  published_on date,
  body text not null check (char_length(body) between 1 and 6000),
  search tsvector generated always as (to_tsvector('english', title || ' ' || body)) stored,
  created_at timestamptz not null default now()
);
create index biblical_ai_source_documents_search_idx on public.biblical_ai_source_documents using gin (search);
create index biblical_ai_source_documents_source_idx on public.biblical_ai_source_documents (source_slug);

create table public.biblical_ai_source_audit (
  id bigint generated always as identity primary key,
  source_slug text not null,
  old_status text,
  new_status text not null,
  reason text check (char_length(reason) <= 1000),
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

insert into public.biblical_ai_sources (slug, kind, name, author, ministry, official_url, licence, commercial_use, storage_permitted, attribution, status, notes) values
  ('bsb', 'scripture', 'Berean Standard Bible', null, 'Berean Bible', 'https://berean.bible', 'Public domain (dedicated by the publisher)', 'permitted', 'permitted', 'Scripture quotations are from the Berean Standard Bible (BSB), public domain.', 'approved', 'The only English Scripture text. public/bible/bsb, verified by tests/unit/bible-dataset.test.ts.'),
  ('stepbible-tahot', 'original_language', 'Translators Amalgamated Hebrew OT (TAHOT)', null, 'STEP Bible / Tyndale House', 'https://www.stepbible.org', 'CC BY 4.0', 'permitted', 'permitted', 'STEP Bible (www.STEPBible.org), Tyndale House, Cambridge. CC BY 4.0.', 'approved', 'Leningrad Codex text with morphology; data/original-languages.'),
  ('stepbible-tagnt', 'original_language', 'Translators Amalgamated Greek NT (TAGNT)', null, 'STEP Bible / Tyndale House', 'https://www.stepbible.org', 'CC BY 4.0 (as declared by STEPBible; includes edition markers for NA27/28 words; see docs/biblical-ai/SOURCES.md)', 'permitted', 'permitted', 'STEP Bible (www.STEPBible.org), Tyndale House, Cambridge. CC BY 4.0.', 'approved', 'Greek NT words with editions, morphology and glosses; data/original-languages.'),
  ('stepbible-lexicons', 'lexicon', 'Brief lexicons of Extended Strongs (TBESH, TBESG)', null, 'STEP Bible / Tyndale House', 'https://www.stepbible.org', 'CC BY 4.0 (abridged BDB; Abbott-Smith)', 'permitted', 'permitted', 'STEP Bible (www.STEPBible.org), Tyndale House, Cambridge. CC BY 4.0.', 'approved', null),
  ('openbible-cross-references', 'cross_reference', 'OpenBible.info cross references', null, 'OpenBible.info', 'https://www.openbible.info/labs/cross-references/', 'CC BY', 'permitted', 'permitted', 'Cross references: OpenBible.info, CC BY.', 'approved', 'data/cross-references.'),
  ('john-macarthur', 'teacher', 'John MacArthur', 'John MacArthur', 'Grace to You', 'https://www.gty.org', null, 'unknown', 'unknown', null, 'pending_review', 'Rights to store or reproduce material not verified. No content loaded.'),
  ('ray-comfort', 'teacher', 'Ray Comfort', 'Ray Comfort', 'Living Waters', 'https://livingwaters.com', null, 'unknown', 'unknown', null, 'pending_review', 'Rights not verified. No content loaded.'),
  ('john-piper', 'teacher', 'John Piper', 'John Piper', 'Desiring God', 'https://www.desiringgod.org', null, 'unknown', 'unknown', null, 'pending_review', 'Rights not verified (Desiring God publishes a resource-use policy; it must be reviewed for AI storage and commercial use). No content loaded.'),
  ('paul-washer', 'teacher', 'Paul Washer', 'Paul Washer', 'HeartCry Missionary Society', 'https://heartcrymissionary.com', null, 'unknown', 'unknown', null, 'pending_review', 'Rights not verified. No content loaded.'),
  ('tim-conway', 'teacher', 'Tim Conway', 'Tim Conway', 'I''ll Be Honest', 'https://illbehonest.com', null, 'unknown', 'unknown', null, 'pending_review', 'Rights not verified. No content loaded.'),
  ('voddie-baucham', 'teacher', 'Voddie Baucham', 'Voddie Baucham', null, null, null, 'unknown', 'unknown', null, 'pending_review', 'Official ministry website not yet verified (the founder confirms it). No content loaded.'),
  ('billy-graham', 'teacher', 'Billy Graham', 'Billy Graham', 'Billy Graham Evangelistic Association', 'https://billygraham.org', null, 'unknown', 'unknown', null, 'pending_review', 'Rights not verified. Author-level checks needed: many BGEA articles are by other writers. No content loaded.'),
  ('alistair-begg', 'teacher', 'Alistair Begg', 'Alistair Begg', 'Truth For Life', 'https://www.truthforlife.org', null, 'unknown', 'unknown', null, 'pending_review', 'Rights not verified. No content loaded.'),
  ('mark-spence', 'teacher', 'Mark Spence', 'Mark Spence', 'Living Waters', 'https://livingwaters.com', null, 'unknown', 'unknown', null, 'pending_review', 'Rights not verified. Author-level checks needed (Living Waters also publishes Ray Comfort). No content loaded.'),
  ('frank-turk', 'teacher', 'Frank Turk', 'Frank Turk', null, null, null, 'unknown', 'unknown', null, 'pending_review', 'Identity and original authorship (including Pyromaniacs posts, a blog with several authors) not yet verified. No content loaded.'),
  ('jeff-durbin', 'teacher', 'Jeff Durbin', 'Jeff Durbin', 'Apologia Studios / Apologia Church', null, null, 'unknown', 'unknown', null, 'pending_review', 'Official ministry resources not yet verified. No content loaded.')
on conflict (slug) do nothing;

-- RLS: members see and delete only their own rows; nobody writes directly (the server does).
alter table public.biblical_ai_conversations enable row level security;
alter table public.biblical_ai_messages enable row level security;
alter table public.biblical_ai_saved_studies enable row level security;
alter table public.biblical_ai_feedback enable row level security;
alter table public.biblical_ai_sources enable row level security;
alter table public.biblical_ai_source_documents enable row level security;
alter table public.biblical_ai_source_audit enable row level security;

create policy biblical_ai_conversations_select_own on public.biblical_ai_conversations for select to authenticated using (user_id = (select auth.uid()));
create policy biblical_ai_conversations_delete_own on public.biblical_ai_conversations for delete to authenticated using (user_id = (select auth.uid()));
create policy biblical_ai_messages_select_own on public.biblical_ai_messages for select to authenticated using (user_id = (select auth.uid()));
create policy biblical_ai_messages_delete_own on public.biblical_ai_messages for delete to authenticated using (user_id = (select auth.uid()));
create policy biblical_ai_saved_studies_select_own on public.biblical_ai_saved_studies for select to authenticated using (user_id = (select auth.uid()));
create policy biblical_ai_saved_studies_delete_own on public.biblical_ai_saved_studies for delete to authenticated using (user_id = (select auth.uid()));
create policy biblical_ai_feedback_select_own on public.biblical_ai_feedback for select to authenticated using (user_id = (select auth.uid()));
-- Sources, documents and the audit trail: no member policy at all (administrators use the functions below).

revoke all on table public.biblical_ai_conversations, public.biblical_ai_messages, public.biblical_ai_saved_studies, public.biblical_ai_feedback from anon;
revoke insert, update on table public.biblical_ai_conversations, public.biblical_ai_messages, public.biblical_ai_saved_studies, public.biblical_ai_feedback from authenticated;
revoke all on table public.biblical_ai_sources, public.biblical_ai_source_documents, public.biblical_ai_source_audit from anon, authenticated;

-- Aggregate figures for the admin page: counts and timings only, never a question, answer or member.
create or replace function public.biblical_ai_admin_metrics(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'since', v_since,
    'questions', (select count(*) from public.bible_ai_usage u where u.feature in ('biblical_ai', 'study_plan') and u.created_at >= v_since and u.status = 'done'),
    'failed', (select count(*) from public.bible_ai_usage u where u.feature in ('biblical_ai', 'study_plan') and u.created_at >= v_since and u.status = 'failed'),
    'active_members', (select count(distinct u.user_id) from public.bible_ai_usage u where u.feature in ('biblical_ai', 'study_plan') and u.created_at >= v_since and u.status = 'done'),
    'by_depth', coalesce((select jsonb_object_agg(d, n) from (select coalesce(u.depth, 'standard') as d, count(*) as n from public.bible_ai_usage u
                where u.feature in ('biblical_ai', 'study_plan') and u.created_at >= v_since and u.status = 'done' group by 1) x), '{}'::jsonb),
    'avg_latency_ms', (select round(avg(u.latency_ms)) from public.bible_ai_usage u where u.feature in ('biblical_ai', 'study_plan') and u.created_at >= v_since and u.latency_ms is not null),
    'validation_failures', (select coalesce(sum(u.validation_failures), 0) from public.bible_ai_usage u where u.feature in ('biblical_ai', 'study_plan') and u.created_at >= v_since),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'questions', n) order by d) from (
                select (u.created_at at time zone 'UTC')::date as d, count(*) as n from public.bible_ai_usage u
                where u.feature in ('biblical_ai', 'study_plan') and u.created_at >= v_since and u.status = 'done' group by 1) x), '[]'::jsonb),
    'reports_open', (select count(*) from public.biblical_ai_feedback f where f.kind = 'inaccurate' and f.status = 'open'),
    'reports', (select count(*) from public.biblical_ai_feedback f where f.created_at >= v_since),
    'cost_micros', (select coalesce(sum(e.cost_micros), 0) from public.ai_usage_events e where e.kind = 'bible_study' and e.created_at >= v_since)
  );
end;
$$;
revoke all on function public.biblical_ai_admin_metrics(integer) from public, anon;
grant execute on function public.biblical_ai_admin_metrics(integer) to authenticated;

-- Change a source's status, with an audit row. Disabling: any administrator. Approving a teacher's material:
-- only the server's founder check may pass p_founder = true (the server sets it after checking the founder list, and
-- passes the administrator as p_actor). Service role only: members and the browser can't call it.
create or replace function public.biblical_ai_set_source_status(p_slug text, p_status text, p_reason text, p_founder boolean, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
  v_kind text;
begin
  if p_status not in ('pending_review', 'approved', 'disabled') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  select s.status, s.kind into v_old, v_kind from public.biblical_ai_sources s where s.slug = p_slug for update;
  if v_old is null then
    raise exception 'unknown source' using errcode = '22023';
  end if;
  if p_status = 'approved' and v_kind = 'teacher' and not coalesce(p_founder, false) then
    raise exception 'founder approval required' using errcode = '42501';
  end if;
  update public.biblical_ai_sources set status = p_status, updated_at = now(), updated_by = p_actor where slug = p_slug;
  insert into public.biblical_ai_source_audit (source_slug, old_status, new_status, reason, changed_by) values (p_slug, v_old, p_status, left(p_reason, 1000), p_actor);
end;
$$;
revoke all on function public.biblical_ai_set_source_status(text, text, text, boolean, uuid) from public, anon, authenticated;
grant execute on function public.biblical_ai_set_source_status(text, text, text, boolean, uuid) to service_role;
