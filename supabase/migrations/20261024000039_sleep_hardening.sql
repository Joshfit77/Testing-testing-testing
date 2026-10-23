-- Sleep & Recovery hardening after review: bounds on the profile's sleep JSON and tip list, a per-session cap on
-- imported stage rows, and the session cap trigger no longer touching another member's lock before RLS rejects
-- the row. Nothing here changes behaviour for well-formed data.

alter table public.profiles
  add constraint profiles_sleep_alarm_check
    check (sleep_alarm is null or (jsonb_typeof(sleep_alarm) = 'object' and octet_length(sleep_alarm::text) <= 1000));

alter table public.profiles drop constraint if exists profiles_sleep_tips_dismissed_check;
alter table public.profiles
  add constraint profiles_sleep_tips_dismissed_check
    check (cardinality(sleep_tips_dismissed) <= 50 and octet_length(array_to_string(sleep_tips_dismissed, ',')) <= 2500);

-- The cap only concerns the member's own rows; a row for someone else is RLS's to reject, without taking their lock.
create or replace function public.sleep_session_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is distinct from (select auth.uid()) then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('sleep_sessions:' || new.user_id::text));
  if (select count(*) from public.sleep_sessions where user_id = new.user_id) >= 4000 then
    raise exception 'sleep_session_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- At most 1,000 stage rows per session (a night at one-minute resolution is under 1,500 but imports are capped at 500).
create or replace function public.sleep_stage_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is distinct from (select auth.uid()) then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('sleep_stages:' || new.session_id::text));
  if (select count(*) from public.sleep_stages where session_id = new.session_id) >= 1000 then
    raise exception 'sleep_stage_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.sleep_stage_limit() from public, anon;
create trigger sleep_stages_limit before insert on public.sleep_stages for each row execute function public.sleep_stage_limit();
