-- ROLLBACK (no reading history is lost; the journeys go back to following the profile's time zone):
--   Re-run the four function definitions from 20261103000053_faith_discipleship.sql (faith_journey_settle_at,
--   faith_journey_check_in_at, faith_journey_undo, faith_journey_enroll), then:
--   drop function if exists public.faith_journey_set_timezone(text);
--   drop function if exists public.faith_journey_set_timezone_at(uuid, text, timestamptz);
--   drop trigger if exists faith_journeys_timezone_default on public.faith_journeys;
--   drop function if exists public.faith_journey_timezone_default();
--   drop function if exists public.faith_journey_zone_at(public.faith_journeys, timestamptz);
--   alter table public.faith_journeys drop column if exists timezone_switch_at, drop column if exists pending_timezone,
--     drop column if exists timezone_since, drop column if exists previous_timezone, drop column if exists timezone;
-- Roll back the app code first (or together): the journey screen reads these columns.
--
-- Reading journeys keep their own time zone (owner decision T10, 2026-11-12).
--
-- Before: every journey day followed the member's profile time zone, so changing it mid-journey could reopen a day
-- that was already final, or close today early. Now:
--   * A journey takes the member's time zone when it is created, and keeps it. Changing the profile time zone no
--     longer moves journey days. Existing journeys are given the member's current profile zone, so nothing about them
--     changes today.
--   * The member can change a journey's zone explicitly (faith_journey_set_timezone). The change waits for a day
--     boundary: it takes effect at the later of the next midnight in the old zone and the same midnight in the new
--     zone. At that instant both zones show the same date, so no day is skipped, repeated or lengthened to rescue a
--     missed one. Days already final are never re-judged; the strict restart rule is unchanged. A change that would
--     skip a whole calendar day (zones 24 hours or more apart) is refused.
--   * Each moment is judged in the zone in force at that moment: an offline check-in counts for the day it was
--     made on, in the zone that applied then.
--
-- Additive and live-safe: new nullable columns (a catalog-only change), a backfill of active and past journeys from
-- the profile (one UPDATE; small table), and function redefinitions.

alter table public.faith_journeys
  add column if not exists timezone text check (timezone is null or char_length(timezone) between 1 and 64),
  -- The zone used before the last change took effect, and when that change took effect.
  add column if not exists previous_timezone text check (previous_timezone is null or char_length(previous_timezone) between 1 and 64),
  add column if not exists timezone_since timestamptz,
  -- A requested change, and the instant it takes effect (a day boundary in both zones).
  add column if not exists pending_timezone text check (pending_timezone is null or char_length(pending_timezone) between 1 and 64),
  add column if not exists timezone_switch_at timestamptz,
  add constraint faith_journeys_pending_tz_check check ((pending_timezone is null) = (timezone_switch_at is null));

update public.faith_journeys j
  set timezone = public.faith_safe_tz(p.timezone)
  from public.profiles p
  where p.id = j.user_id and j.timezone is null;

-- New journeys take the member's time zone as it is when they start.
create or replace function public.faith_journey_timezone_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.timezone is null then
    select public.faith_safe_tz(p.timezone) into new.timezone from public.profiles p where p.id = new.user_id;
    new.timezone := coalesce(new.timezone, 'UTC');
  end if;
  return new;
end;
$$;
drop trigger if exists faith_journeys_timezone_default on public.faith_journeys;
create trigger faith_journeys_timezone_default before insert on public.faith_journeys
  for each row execute function public.faith_journey_timezone_default();

-- The time zone a journey's days follow at a given instant.
create or replace function public.faith_journey_zone_at(j public.faith_journeys, p_at timestamptz)
returns text
language plpgsql
stable
set search_path = public
as $$
begin
  if j.pending_timezone is not null and p_at >= j.timezone_switch_at then
    return public.faith_safe_tz(j.pending_timezone);
  end if;
  if j.previous_timezone is not null and j.timezone_since is not null and p_at < j.timezone_since then
    return public.faith_safe_tz(j.previous_timezone);
  end if;
  return public.faith_safe_tz(coalesce(j.timezone, 'UTC'));
end;
$$;
revoke execute on function public.faith_journey_zone_at(public.faith_journeys, timestamptz) from public, anon;
grant execute on function public.faith_journey_zone_at(public.faith_journeys, timestamptz) to authenticated, service_role;

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
  -- The journey's own time zone (fixed when it started; an explicit change takes effect at a day boundary).
  v_tz := public.faith_journey_zone_at(j, p_now - public.faith_offline_grace());
  v_through := ((p_now at time zone v_tz) - public.faith_offline_grace())::date - 1;
  if p_force_through is not null and p_force_through > v_through then
    v_through := least(p_force_through, (p_now at time zone public.faith_journey_zone_at(j, p_now))::date - 1);
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
  -- The journey's own time zone, as in force now (and, for an offline check-in, as in force when it was made).
  v_tz := public.faith_journey_zone_at(j, p_now);
  v_today := (p_now at time zone v_tz)::date;
  v_date := v_today;

  if p_occurred_at is not null and p_occurred_at < p_now - interval '2 minutes' then
    if p_occurred_at > p_now then
      raise exception 'faith_invalid_time' using errcode = 'P0001';
    end if;
    v_date := (p_occurred_at at time zone public.faith_journey_zone_at(j, p_occurred_at))::date;
    v_source := 'offline';
    v_at := p_occurred_at;
    if v_date = v_today then
      null;
    -- The grace runs from the end of that day in the zone that applied to it (the same as before when the journey's
    -- zone hasn't changed).
    elsif v_date < v_today and p_now < ((v_date + 1)::timestamp at time zone public.faith_journey_zone_at(j, p_occurred_at)) + public.faith_offline_grace() then
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
  v_today := (now() at time zone public.faith_journey_zone_at(j, now()))::date;
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
  -- The journey keeps the member's time zone as it is today (journey_timezone_default fills it in).
  insert into public.faith_journeys (user_id, plan_kind, plan_param, duration_days, start_on)
    values (v_user, p_kind, nullif(p_param, ''), p_duration, p_start_on)
    returning id into v_id;
  insert into public.faith_journey_attempts (journey_id, user_id, attempt_number, started_on) values (v_id, v_user, 1, p_start_on);
  return v_id;
end;
$$;

revoke execute on function public.faith_journey_enroll(text, text, integer, date) from public, anon;
grant execute on function public.faith_journey_enroll(text, text, integer, date) to authenticated;

/**
 * Change the time zone of a member's active journey as of p_now. Takes effect at the later of the next midnight in the
 * current zone and that same date's midnight in the new zone, so both zones agree on the date at the switch. Passing
 * the zone already in force cancels a change that hasn't taken effect yet. Returns when the change takes effect.
 */
create or replace function public.faith_journey_set_timezone_at(p_user uuid, p_tz text, p_now timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.faith_journeys%rowtype;
  v_cur text;
  v_change_on date;
  v_switch timestamptz;
begin
  if p_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_tz is null or p_tz = '' or public.faith_safe_tz(p_tz) <> p_tz then
    raise exception 'faith_invalid_timezone' using errcode = 'P0001';
  end if;
  select id into j.id from public.faith_journeys where user_id = p_user and status = 'active';
  if j.id is null then
    raise exception 'faith_no_journey' using errcode = 'P0001';
  end if;
  -- Days that are already over are judged first, in the zone that applied to them.
  perform public.faith_journey_settle_at(j.id, p_now);
  select * into j from public.faith_journeys where id = j.id and status = 'active' for update;
  if not found then
    raise exception 'faith_no_journey' using errcode = 'P0001';
  end if;
  -- A change whose moment has passed becomes the journey's zone (the old one is kept for the days before it).
  if j.pending_timezone is not null and p_now >= j.timezone_switch_at then
    update public.faith_journeys
      set previous_timezone = timezone, timezone = pending_timezone, timezone_since = timezone_switch_at,
          pending_timezone = null, timezone_switch_at = null
      where id = j.id
      returning * into j;
  end if;
  v_cur := public.faith_journey_zone_at(j, p_now);
  if p_tz = v_cur then
    update public.faith_journeys set pending_timezone = null, timezone_switch_at = null where id = j.id;
    return jsonb_build_object('timezone', v_cur, 'pending', null, 'switch_at', null);
  end if;
  v_change_on := (p_now at time zone v_cur)::date + 1;
  v_switch := greatest(v_change_on::timestamp at time zone v_cur, v_change_on::timestamp at time zone p_tz);
  if (v_switch at time zone v_cur)::date <> v_change_on or (v_switch at time zone p_tz)::date <> v_change_on then
    raise exception 'faith_timezone_jump' using errcode = 'P0001';
  end if;
  update public.faith_journeys set pending_timezone = p_tz, timezone_switch_at = v_switch where id = j.id;
  return jsonb_build_object('timezone', v_cur, 'pending', p_tz, 'switch_at', v_switch, 'change_on', v_change_on);
end;
$$;
revoke execute on function public.faith_journey_set_timezone_at(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.faith_journey_set_timezone_at(uuid, text, timestamptz) to service_role;

-- The member-facing change: their own active journey, the server's clock.
create or replace function public.faith_journey_set_timezone(p_tz text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.faith_journey_set_timezone_at((select auth.uid()), p_tz, now());
$$;
revoke execute on function public.faith_journey_set_timezone(text) from public, anon;
grant execute on function public.faith_journey_set_timezone(text) to authenticated;
