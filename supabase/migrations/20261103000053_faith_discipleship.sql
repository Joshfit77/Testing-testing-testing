-- Narrow Gate Fitness — Faith & Discipleship: Bible reader data, reading journeys with the daily Bible-and-prayer rule,
-- daily Faith and Fitness goals, memorization, studies, AI Bible study history and reminder kinds.
--
-- Everything here is private to its owner (owner-only RLS, no admin access) and cascades away with the account.
-- Existing Faith tables (prayer journal, practices, reminders, the 40-day challenge) are only extended; no existing
-- row is changed or removed. Journey progress is written only by the SECURITY DEFINER functions below, which validate
-- dates on the server, so a client cannot mark days complete, backdate check-ins or undo a reset.

-- ---------------------------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------------------------

-- The 66 books and their chapter counts (the same canon as src/data/bible/books.json).
create or replace function public.bible_chapter_count(p_book text)
returns smallint
language sql
immutable
parallel safe
as $$
  select ('{"GEN":50,"EXO":40,"LEV":27,"NUM":36,"DEU":34,"JOS":24,"JDG":21,"RUT":4,"1SA":31,"2SA":24,"1KI":22,"2KI":25,"1CH":29,"2CH":36,"EZR":10,"NEH":13,"EST":10,"JOB":42,"PSA":150,"PRO":31,"ECC":12,"SNG":8,"ISA":66,"JER":52,"LAM":5,"EZK":48,"DAN":12,"HOS":14,"JOL":3,"AMO":9,"OBA":1,"JON":4,"MIC":7,"NAM":3,"HAB":3,"ZEP":3,"HAG":2,"ZEC":14,"MAL":4,"MAT":28,"MRK":16,"LUK":24,"JHN":21,"ACT":28,"ROM":16,"1CO":16,"2CO":13,"GAL":6,"EPH":6,"PHP":4,"COL":4,"1TH":5,"2TH":3,"1TI":6,"2TI":4,"TIT":3,"PHM":1,"HEB":13,"JAS":5,"1PE":5,"2PE":3,"1JN":5,"2JN":1,"3JN":1,"JUD":1,"REV":22}'::jsonb ->> p_book)::smallint;
$$;

create or replace function public.is_bible_chapter(p_book text, p_chapter integer)
returns boolean
language sql
immutable
parallel safe
as $$
  select coalesce(p_chapter between 1 and public.bible_chapter_count(p_book), false);
$$;

-- A member's time zone, or UTC when the stored name isn't one Postgres knows.
create or replace function public.faith_safe_tz(p_tz text)
returns text
language plpgsql
stable
as $$
begin
  if p_tz is null or p_tz = '' then
    return 'UTC';
  end if;
  perform now() at time zone p_tz;
  return p_tz;
exception when others then
  return 'UTC';
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Bible reader: position, history, highlights, bookmarks, notes
-- ---------------------------------------------------------------------------------------------------------------

create table public.bible_reading_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  book_id text not null,
  chapter smallint not null,
  verse smallint check (verse between 1 and 176),
  font_scale numeric(3, 2) not null default 1.00 check (font_scale between 0.80 and 1.80),
  updated_at timestamptz not null default now(),
  check (public.is_bible_chapter(book_id, chapter))
);

create table public.bible_reading_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id text not null,
  chapter smallint not null,
  read_on date not null,
  read_at timestamptz not null default now(),
  unique (user_id, book_id, chapter, read_on),
  check (public.is_bible_chapter(book_id, chapter))
);
create index bible_reading_history_user_idx on public.bible_reading_history (user_id, read_at desc);

create table public.bible_highlights (
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id text not null,
  chapter smallint not null,
  verse smallint not null check (verse between 1 and 176),
  color text not null check (color in ('gold', 'sage', 'sky', 'rose')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id, chapter, verse),
  check (public.is_bible_chapter(book_id, chapter))
);
create index bible_highlights_user_idx on public.bible_highlights (user_id, updated_at desc);

create table public.bible_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id text not null,
  chapter smallint not null,
  verse smallint check (verse between 1 and 176),
  label text check (char_length(label) <= 120),
  created_at timestamptz not null default now(),
  check (public.is_bible_chapter(book_id, chapter))
);
create unique index bible_bookmarks_unique_idx on public.bible_bookmarks (user_id, book_id, chapter, coalesce(verse, 0));
create index bible_bookmarks_user_idx on public.bible_bookmarks (user_id, created_at desc);

create table public.bible_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id text not null,
  chapter smallint not null,
  verse_start smallint not null check (verse_start between 1 and 176),
  verse_end smallint not null check (verse_end between 1 and 176),
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (verse_end >= verse_start),
  check (public.is_bible_chapter(book_id, chapter))
);
create index bible_notes_user_idx on public.bible_notes (user_id, book_id, chapter);
create index bible_notes_user_updated_idx on public.bible_notes (user_id, updated_at desc);
create trigger bible_notes_updated_at before update on public.bible_notes for each row execute function public.set_updated_at();
create trigger bible_highlights_updated_at before update on public.bible_highlights for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------------------------
-- Scripture memorization (the text itself always comes from the verified BSB, never stored here)
-- ---------------------------------------------------------------------------------------------------------------

create table public.scripture_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id text not null,
  chapter smallint not null,
  verse_start smallint not null check (verse_start between 1 and 176),
  verse_end smallint not null check (verse_end between 1 and 176),
  status text not null default 'learning' check (status in ('learning', 'memorized')),
  -- How much of the verse is hidden in practice (0 = none … 4 = all), raised as the member succeeds.
  level smallint not null default 0 check (level between 0 and 4),
  review_count integer not null default 0 check (review_count >= 0),
  next_review_on date,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (verse_end >= verse_start and verse_end - verse_start < 30),
  check (public.is_bible_chapter(book_id, chapter)),
  unique (user_id, book_id, chapter, verse_start, verse_end)
);
create index scripture_memory_user_idx on public.scripture_memory (user_id, status, next_review_on);
create trigger scripture_memory_updated_at before update on public.scripture_memory for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------------------------
-- Guided Bible studies: the member's progress and private notes per lesson (lesson content ships with the app)
-- ---------------------------------------------------------------------------------------------------------------

create table public.bible_study_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  study_slug text not null check (char_length(study_slug) between 1 and 80),
  lesson_slug text not null check (char_length(lesson_slug) between 1 and 80),
  completed_at timestamptz,
  notes text check (char_length(notes) <= 10000),
  updated_at timestamptz not null default now(),
  primary key (user_id, study_slug, lesson_slug)
);
create trigger bible_study_progress_updated_at before update on public.bible_study_progress for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------------------------
-- AI Bible study: conversation history and its own usage ledger (separate from the fitness coach's quota)
-- ---------------------------------------------------------------------------------------------------------------

create table public.bible_ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  -- Scripture the answer cited, as verified references ["John 3:16", …].
  citations jsonb not null default '[]'::jsonb check (jsonb_typeof(citations) = 'array'),
  created_at timestamptz not null default now()
);
create index bible_ai_messages_thread_idx on public.bible_ai_messages (user_id, thread_id, created_at);

create table public.bible_ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  model text check (char_length(model) <= 80),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'done', 'failed'))
);
create index bible_ai_usage_user_idx on public.bible_ai_usage (user_id, created_at desc);

-- Reserve one Bible-study question atomically: per-minute, per-day and per-month limits (passed by the server from
-- its configuration). Raises bible_ai_rate_limited / bible_ai_quota. Service role only.
create or replace function public.reserve_bible_ai_usage(p_user_id uuid, p_per_minute integer, p_daily integer, p_monthly integer)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('bible_ai:' || p_user_id::text, 0));
  if (select count(*) from public.bible_ai_usage u where u.user_id = p_user_id and u.status <> 'failed' and u.created_at >= now() - interval '60 seconds') >= p_per_minute then
    raise exception 'bible_ai_rate_limited' using errcode = 'P0001';
  end if;
  if (select count(*) from public.bible_ai_usage u where u.user_id = p_user_id and u.status <> 'failed' and u.created_at >= now() - interval '24 hours') >= p_daily then
    raise exception 'bible_ai_quota' using errcode = 'P0001';
  end if;
  if (select count(*) from public.bible_ai_usage u where u.user_id = p_user_id and u.status <> 'failed' and u.created_at >= date_trunc('month', now())) >= p_monthly then
    raise exception 'bible_ai_quota' using errcode = 'P0001';
  end if;
  insert into public.bible_ai_usage (user_id) values (p_user_id) returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.reserve_bible_ai_usage(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_bible_ai_usage(uuid, integer, integer, integer) to service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Daily Faith challenge and Fitness goal (optional; never part of the journey rule)
-- ---------------------------------------------------------------------------------------------------------------

create table public.faith_daily_goals (
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_date date not null,
  kind text not null check (kind in ('faith_challenge', 'fitness')),
  completed_at timestamptz not null default now(),
  note text check (char_length(note) <= 1000),
  primary key (user_id, goal_date, kind),
  -- A day near today (time zones differ by at most ~a day); the server action checks the member's own date.
  check (goal_date between (completed_at at time zone 'UTC')::date - 2 and (completed_at at time zone 'UTC')::date + 1)
);

-- ---------------------------------------------------------------------------------------------------------------
-- Reading journeys: enrolment, attempts, daily check-ins
-- ---------------------------------------------------------------------------------------------------------------

create table public.faith_journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_kind text not null check (plan_kind in ('guided', 'gospels', 'new_testament', 'old_testament', 'chronological', 'full_bible', 'book', 'topic')),
  -- The book (BSB book id) for 'book', the topic slug for 'topic'.
  plan_param text check (char_length(plan_param) between 1 and 40),
  duration_days smallint not null check (duration_days in (30, 60, 90, 180, 365)),
  -- The member's chosen first day (never in the past when enrolling).
  start_on date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  check ((plan_kind in ('book', 'topic')) = (plan_param is not null)),
  check (plan_kind <> 'book' or public.bible_chapter_count(plan_param) is not null),
  check ((status = 'active') = (ended_at is null))
);
create unique index faith_journeys_one_active_idx on public.faith_journeys (user_id) where status = 'active';
create index faith_journeys_user_idx on public.faith_journeys (user_id, created_at desc);

create table public.faith_journey_attempts (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.faith_journeys (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt_number integer not null check (attempt_number >= 1),
  -- Day 1 of this attempt (the member's local date).
  started_on date not null,
  status text not null default 'active' check (status in ('active', 'interrupted', 'completed', 'ended')),
  -- The day that wasn't completed, and what was missing on it.
  interrupted_on date,
  interruption_reason text check (interruption_reason in ('reading', 'prayer', 'both')),
  days_completed integer not null default 0 check (days_completed >= 0),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (journey_id, attempt_number),
  check ((status = 'interrupted') = (interrupted_on is not null and interruption_reason is not null)),
  check ((status = 'active') = (ended_at is null))
);
create unique index faith_journey_attempts_one_active_idx on public.faith_journey_attempts (journey_id) where status = 'active';
create index faith_journey_attempts_user_idx on public.faith_journey_attempts (user_id, created_at desc);

-- One row per journey and calendar day (the member's local date) holding that day's two required activities.
create table public.faith_journey_checkins (
  journey_id uuid not null references public.faith_journeys (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  check_date date not null,
  -- The schedule day whose reading was marked complete (a reading counts only for its own day).
  reading_day smallint check (reading_day between 1 and 365),
  reading_completed_at timestamptz,
  reading_source text check (reading_source in ('online', 'offline')),
  prayer_completed_at timestamptz,
  prayer_source text check (prayer_source in ('online', 'offline')),
  updated_at timestamptz not null default now(),
  primary key (journey_id, check_date),
  check ((reading_completed_at is null) = (reading_day is null))
);
create index faith_journey_checkins_user_idx on public.faith_journey_checkins (user_id, check_date desc);

-- How long after local midnight a check-in made offline before midnight may still count for the previous day.
-- The member's deadline is midnight; this only lets a device that was offline deliver what it recorded in time.
create or replace function public.faith_offline_grace()
returns interval
language sql
immutable
as $$ select interval '3 hours' $$;

/**
 * Apply the daily rule to one journey as of p_now, idempotently:
 *   - days up to "settle_through" are final: yesterday becomes final 3 hours after local midnight (offline grace), or at
 *     once when p_force_through says so (a check-in for the new day proves the member is online);
 *   - the first final day of the active attempt without BOTH the day's reading (for that schedule day) and prayer
 *     interrupts the attempt (date + reason recorded) and starts a new attempt at Day 1 on the next day;
 *   - a new attempt that has no completed day yet simply moves its Day 1 forward instead of piling up empty attempts;
 *   - nothing is ever deleted.
 * Concurrent callers (several devices, the scheduled job) serialize on the journey row.
 */
create or replace function public.faith_journey_settle_at(p_journey_id uuid, p_now timestamptz, p_force_through date default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.faith_journeys%rowtype;
  a public.faith_journey_attempts%rowtype;
  v_tz text;
  v_through date;
  v_last_day date;
  v_miss date;
  v_row public.faith_journey_checkins%rowtype;
  v_reason text;
  v_guard integer := 0;
begin
  select * into j from public.faith_journeys where id = p_journey_id for update;
  if not found or j.status <> 'active' then
    return;
  end if;
  select public.faith_safe_tz(p.timezone) into v_tz from public.profiles p where p.id = j.user_id;
  v_tz := coalesce(v_tz, 'UTC');
  v_through := ((p_now at time zone v_tz) - public.faith_offline_grace())::date - 1;
  if p_force_through is not null and p_force_through > v_through then
    v_through := least(p_force_through, (p_now at time zone v_tz)::date - 1);
  end if;

  loop
    v_guard := v_guard + 1;
    exit when v_guard > 1000;
    select * into a from public.faith_journey_attempts where journey_id = j.id and status = 'active' for update;
    if not found then
      insert into public.faith_journey_attempts (journey_id, user_id, attempt_number, started_on)
        values (j.id, j.user_id, coalesce((select max(attempt_number) from public.faith_journey_attempts where journey_id = j.id), 0) + 1, j.start_on)
        returning * into a;
    end if;
    exit when a.started_on > v_through;

    v_last_day := least(v_through, a.started_on + j.duration_days - 1);
    -- The first final day of this attempt that isn't complete.
    select d::date into v_miss
      from generate_series(a.started_on, v_last_day, interval '1 day') d
      where not exists (
        select 1 from public.faith_journey_checkins c
        where c.journey_id = j.id and c.check_date = d::date
          and c.prayer_completed_at is not null
          and c.reading_completed_at is not null
          and c.reading_day = (d::date - a.started_on + 1)
      )
      order by d
      limit 1;

    if v_miss is null then
      -- Every final day so far is complete. Finished the whole schedule?
      if a.started_on + j.duration_days - 1 <= v_through then
        update public.faith_journey_attempts set status = 'completed', days_completed = j.duration_days, ended_at = p_now where id = a.id;
        update public.faith_journeys set status = 'completed', ended_at = p_now where id = j.id;
      end if;
      exit;
    end if;

    if v_miss = a.started_on and a.attempt_number > 1 and a.days_completed = 0
       and not exists (select 1 from public.faith_journey_checkins c where c.journey_id = j.id and c.check_date = v_miss) then
      -- A restarted attempt whose Day 1 passed untouched: move Day 1 forward rather than recording another attempt.
      update public.faith_journey_attempts set started_on = v_miss + 1 where id = a.id;
      continue;
    end if;

    select * into v_row from public.faith_journey_checkins c where c.journey_id = j.id and c.check_date = v_miss;
    v_reason := case
      when v_row.prayer_completed_at is not null then 'reading'
      when v_row.reading_completed_at is not null and v_row.reading_day = (v_miss - a.started_on + 1) then 'prayer'
      else 'both'
    end;
    update public.faith_journey_attempts
      set status = 'interrupted', interrupted_on = v_miss, interruption_reason = v_reason,
          days_completed = v_miss - a.started_on, ended_at = p_now
      where id = a.id;
    insert into public.faith_journey_attempts (journey_id, user_id, attempt_number, started_on)
      values (j.id, j.user_id, a.attempt_number + 1, v_miss + 1);
  end loop;
end;
$$;
revoke execute on function public.faith_journey_settle_at(uuid, timestamptz, date) from public, anon, authenticated;
grant execute on function public.faith_journey_settle_at(uuid, timestamptz, date) to service_role;

-- Settle every active journey (the scheduled job). Returns how many were looked at.
create or replace function public.faith_journeys_settle_due(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  for r in select id from public.faith_journeys where status = 'active' loop
    perform public.faith_journey_settle_at(r.id, p_now);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.faith_journeys_settle_due(timestamptz) from public, anon, authenticated;
grant execute on function public.faith_journeys_settle_due(timestamptz) to service_role;

/**
 * Record one of the day's two required activities ('reading' or 'prayer') for p_user as of p_now.
 * p_occurred_at: when the member tapped it, for a check-in a device saved while offline. It may count for the
 * previous local day only if it happened on that day and arrives within the offline grace after midnight, and only
 * while that day isn't final yet; otherwise it's refused (never silently moved to another day).
 * Duplicate check-ins are harmless (the first time is kept). Returns the day's state.
 */
create or replace function public.faith_journey_check_in_at(p_user uuid, p_activity text, p_now timestamptz, p_occurred_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.faith_journeys%rowtype;
  a public.faith_journey_attempts%rowtype;
  v_tz text;
  v_today date;
  v_date date;
  v_source text := 'online';
  v_at timestamptz := p_now;
  v_day integer;
  v_row public.faith_journey_checkins%rowtype;
begin
  if p_activity not in ('reading', 'prayer') then
    raise exception 'faith_invalid_activity' using errcode = 'P0001';
  end if;
  select * into j from public.faith_journeys where user_id = p_user and status = 'active';
  if not found then
    raise exception 'faith_no_journey' using errcode = 'P0001';
  end if;
  select public.faith_safe_tz(p.timezone) into v_tz from public.profiles p where p.id = p_user;
  v_tz := coalesce(v_tz, 'UTC');
  v_today := (p_now at time zone v_tz)::date;
  v_date := v_today;

  if p_occurred_at is not null and p_occurred_at < p_now - interval '2 minutes' then
    if p_occurred_at > p_now then
      raise exception 'faith_invalid_time' using errcode = 'P0001';
    end if;
    v_date := (p_occurred_at at time zone v_tz)::date;
    v_source := 'offline';
    v_at := p_occurred_at;
    if v_date = v_today then
      null;
    elsif v_date = v_today - 1 and (p_now at time zone v_tz) < (v_today::timestamp + public.faith_offline_grace()) then
      null;
    else
      raise exception 'faith_offline_too_late' using errcode = 'P0001';
    end if;
  end if;

  -- A check-in for today proves the member is online: yesterday is final now. One for yesterday settles nothing new.
  perform public.faith_journey_settle_at(j.id, p_now, case when v_date = v_today then v_today - 1 end);
  select * into j from public.faith_journeys where id = j.id;
  if j.status <> 'active' then
    raise exception 'faith_no_journey' using errcode = 'P0001';
  end if;
  select * into a from public.faith_journey_attempts where journey_id = j.id and status = 'active';
  if v_date < a.started_on then
    -- Before the journey starts, or a day of an attempt that has already been interrupted.
    raise exception 'faith_day_closed' using errcode = 'P0001';
  end if;
  v_day := v_date - a.started_on + 1;
  if v_day > j.duration_days then
    raise exception 'faith_day_closed' using errcode = 'P0001';
  end if;

  insert into public.faith_journey_checkins as c (journey_id, user_id, check_date, reading_day, reading_completed_at, reading_source, prayer_completed_at, prayer_source)
    values (
      j.id, p_user, v_date,
      case when p_activity = 'reading' then v_day end,
      case when p_activity = 'reading' then v_at end,
      case when p_activity = 'reading' then v_source end,
      case when p_activity = 'prayer' then v_at end,
      case when p_activity = 'prayer' then v_source end
    )
    on conflict (journey_id, check_date) do update set
      reading_day = case when p_activity = 'reading' and (c.reading_completed_at is null or c.reading_day <> v_day) then v_day else c.reading_day end,
      reading_completed_at = case when p_activity = 'reading' and (c.reading_completed_at is null or c.reading_day <> v_day) then v_at else c.reading_completed_at end,
      reading_source = case when p_activity = 'reading' and (c.reading_completed_at is null or c.reading_day <> v_day) then v_source else c.reading_source end,
      prayer_completed_at = case when p_activity = 'prayer' and c.prayer_completed_at is null then v_at else c.prayer_completed_at end,
      prayer_source = case when p_activity = 'prayer' and c.prayer_completed_at is null then v_source else c.prayer_source end,
      updated_at = now()
    returning * into v_row;

  -- The last day of the schedule, completed: the journey is finished.
  if v_day = j.duration_days and v_row.prayer_completed_at is not null and v_row.reading_day = v_day then
    perform public.faith_journey_settle_at(j.id, p_now, v_date + 1);
    -- settle_at only finalizes days before today; finish explicitly when the last day is today.
    update public.faith_journey_attempts set status = 'completed', days_completed = j.duration_days, ended_at = p_now
      where id = a.id and status = 'active';
    update public.faith_journeys set status = 'completed', ended_at = p_now where id = j.id and status = 'active';
  end if;

  return jsonb_build_object(
    'date', v_date, 'day', v_day, 'source', v_source,
    'reading', v_row.reading_completed_at is not null and v_row.reading_day = v_day,
    'prayer', v_row.prayer_completed_at is not null
  );
end;
$$;
revoke execute on function public.faith_journey_check_in_at(uuid, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.faith_journey_check_in_at(uuid, text, timestamptz, timestamptz) to service_role;

-- The member-facing check-in: their own account, the server's clock.
create or replace function public.faith_journey_check_in(p_activity text, p_occurred_at timestamptz default null)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.faith_journey_check_in_at((select auth.uid()), p_activity, now(), p_occurred_at);
$$;
revoke execute on function public.faith_journey_check_in(text, timestamptz) from public, anon;
grant execute on function public.faith_journey_check_in(text, timestamptz) to authenticated;

-- Undo a mistaken tap, today only (a day that is already final can't be changed).
create or replace function public.faith_journey_undo(p_activity text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := (select auth.uid());
  j public.faith_journeys%rowtype;
  v_today date;
begin
  select * into j from public.faith_journeys where user_id = v_user and status = 'active';
  if not found then
    return;
  end if;
  select ((now() at time zone public.faith_safe_tz(p.timezone)))::date into v_today from public.profiles p where p.id = v_user;
  if p_activity = 'reading' then
    update public.faith_journey_checkins set reading_day = null, reading_completed_at = null, reading_source = null, updated_at = now()
      where journey_id = j.id and check_date = v_today;
  elsif p_activity = 'prayer' then
    update public.faith_journey_checkins set prayer_completed_at = null, prayer_source = null, updated_at = now()
      where journey_id = j.id and check_date = v_today;
  end if;
end;
$$;
revoke execute on function public.faith_journey_undo(text) from public, anon;
grant execute on function public.faith_journey_undo(text) to authenticated;

-- Settle the caller's own journey now (every Faith page load calls this, in addition to the scheduled job).
create or replace function public.faith_journey_settle_mine()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.faith_journeys where user_id = (select auth.uid()) and status = 'active';
  if v_id is not null then
    perform public.faith_journey_settle_at(v_id, now());
  end if;
end;
$$;
revoke execute on function public.faith_journey_settle_mine() from public, anon;
grant execute on function public.faith_journey_settle_mine() to authenticated;

/**
 * Start a journey (ending the current one, whose history is kept). p_start_on: today or up to 30 days ahead in the
 * member's time zone. The plan's feasibility (enough Scripture for the duration) is checked by the server action
 * before this is called; here the kind, duration and dates are enforced.
 */
create or replace function public.faith_journey_enroll(p_kind text, p_param text, p_duration integer, p_start_on date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := (select auth.uid());
  v_today date;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select ((now() at time zone public.faith_safe_tz(p.timezone)))::date into v_today from public.profiles p where p.id = v_user;
  if p_start_on is null or p_start_on < v_today or p_start_on > v_today + 30 then
    raise exception 'faith_invalid_start' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('faith_journey:' || v_user::text, 0));
  update public.faith_journey_attempts set status = 'ended', ended_at = now()
    where user_id = v_user and status = 'active';
  update public.faith_journeys set status = 'ended', ended_at = now() where user_id = v_user and status = 'active';
  insert into public.faith_journeys (user_id, plan_kind, plan_param, duration_days, start_on)
    values (v_user, p_kind, nullif(p_param, ''), p_duration, p_start_on)
    returning id into v_id;
  insert into public.faith_journey_attempts (journey_id, user_id, attempt_number, started_on) values (v_id, v_user, 1, p_start_on);
  return v_id;
end;
$$;
revoke execute on function public.faith_journey_enroll(text, text, integer, date) from public, anon;
grant execute on function public.faith_journey_enroll(text, text, integer, date) to authenticated;

-- End the active journey (history kept).
create or replace function public.faith_journey_end()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := (select auth.uid());
begin
  update public.faith_journey_attempts set status = 'ended', ended_at = now() where user_id = v_user and status = 'active';
  update public.faith_journeys set status = 'ended', ended_at = now() where user_id = v_user and status = 'active';
end;
$$;
revoke execute on function public.faith_journey_end() from public, anon;
grant execute on function public.faith_journey_end() to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Existing tables, extended (no data changed)
-- ---------------------------------------------------------------------------------------------------------------

-- Prayer journal: more kinds of prayer, and archiving.
alter table public.faith_journal_entries drop constraint if exists faith_journal_entries_kind_check;
alter table public.faith_journal_entries
  add constraint faith_journal_entries_kind_check check (kind in ('reflection', 'request', 'praise', 'intercession', 'confession', 'daily')),
  add column archived_at timestamptz;
create index faith_journal_user_archived_idx on public.faith_journal_entries (user_id, archived_at, entry_date desc);

-- Reminders: Bible reading, Faith challenge, Fitness goal, the accountability reminders and memorization reviews.
alter table public.faith_reminders drop constraint if exists faith_reminders_kind_check;
alter table public.faith_reminders
  add constraint faith_reminders_kind_check check (kind in ('devotional', 'prayer', 'practices', 'reading', 'challenge', 'fitness', 'accountability', 'final', 'memorize'));

create table public.faith_reminder_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- No reminder is scheduled between these times (local). Null: no quiet hours.
  quiet_start time,
  quiet_end time,
  updated_at timestamptz not null default now(),
  check ((quiet_start is null) = (quiet_end is null))
);
create trigger faith_reminder_prefs_updated_at before update on public.faith_reminder_prefs for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------------------------
-- Row Level Security: owner-only
-- ---------------------------------------------------------------------------------------------------------------

-- Row level security on every new table (stated one by one so static checks can see it; the policies follow).
alter table public.bible_reading_state enable row level security;
alter table public.bible_reading_history enable row level security;
alter table public.bible_highlights enable row level security;
alter table public.bible_bookmarks enable row level security;
alter table public.bible_notes enable row level security;
alter table public.scripture_memory enable row level security;
alter table public.bible_study_progress enable row level security;
alter table public.faith_daily_goals enable row level security;
alter table public.faith_reminder_prefs enable row level security;
alter table public.faith_journeys enable row level security;
alter table public.faith_journey_attempts enable row level security;
alter table public.faith_journey_checkins enable row level security;
alter table public.bible_ai_usage enable row level security;

do $$
declare
  t text;
begin
  -- Members read and write their own rows.
  foreach t in array array['bible_reading_state', 'bible_reading_history', 'bible_highlights', 'bible_bookmarks', 'bible_notes',
                           'scripture_memory', 'bible_study_progress', 'faith_daily_goals', 'faith_reminder_prefs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t || '_delete_own', t);
  end loop;
  -- Read-only to the member: progress and usage are written only by the functions above / the server.
  foreach t in array array['faith_journeys', 'faith_journey_attempts', 'faith_journey_checkins', 'bible_ai_usage'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select_own', t);
  end loop;
  -- AI Bible study history: the member reads and deletes their own; the server writes it.
  alter table public.bible_ai_messages enable row level security;
  create policy bible_ai_messages_select_own on public.bible_ai_messages for select to authenticated using (user_id = (select auth.uid()));
  create policy bible_ai_messages_delete_own on public.bible_ai_messages for delete to authenticated using (user_id = (select auth.uid()));
end;
$$;

revoke insert, update, delete on public.faith_journeys, public.faith_journey_attempts, public.faith_journey_checkins, public.bible_ai_usage, public.bible_ai_messages from anon, authenticated;
grant delete on public.bible_ai_messages to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Scheduled settlement: every 15 minutes, so a missed day resets even if the member never opens the app.
-- (Page loads and check-ins also settle, so the rule holds even where pg_cron isn't available.)
-- ---------------------------------------------------------------------------------------------------------------

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('faith-journeys-settle', '*/15 * * * *', 'select public.faith_journeys_settle_due()');
exception when others then
  raise notice 'pg_cron is not available here (%); journeys settle on page load and check-in only.', sqlerrm;
end;
$$;

comment on table public.faith_journeys is 'Bible reading journeys (plan, duration, chosen start). Owner-readable; written only by faith_journey_* functions.';
comment on table public.faith_journey_attempts is 'Each attempt at a journey: interrupted attempts keep the missed date and what was missing. Never deleted by a reset.';
comment on table public.faith_journey_checkins is 'The two required daily activities (reading for that schedule day, prayer) per local calendar day.';
