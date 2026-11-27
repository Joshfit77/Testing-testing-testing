-- Narrow Gate Fitness — the remaining Low findings of the 2026-11-01 security review
-- (docs/security/PRELAUNCH_SECURITY_REPORT.md F14–F18; docs/security/DATABASE_AUDIT.md L1, L2, L5, L7, L8).
-- Nothing a member can do in the app changes; only writes the app never makes are refused, and a few error messages
-- that told one member something about another are gone.

-- ---------------------------------------------------------------------------------------------------------------
-- F14 (L1): an enrolment can't be repointed at a program the member couldn't enrol in.
-- The insert policy already requires can_use_program(program_id); an update could change program_id freely. The app
-- never changes it (it pauses one enrolment and inserts another).
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.check_user_program_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and new.program_id is distinct from old.program_id and not public.can_use_program(new.program_id) then
    raise exception 'That program isn''t included in your plan' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.check_user_program_change() from public, anon, authenticated;
create trigger user_programs_program_change before update of program_id on public.user_programs
  for each row execute function public.check_user_program_change();

-- ---------------------------------------------------------------------------------------------------------------
-- F15 (L2): six SECURITY DEFINER triggers checked a row's user_id before row level security did, so a row naming
-- another member's id got that member's plan, consent or limit back in the error. Now a row that isn't the caller's
-- own goes straight on to RLS, which refuses it with its usual message (as migration 039 did for the sleep triggers).
-- The server (service role, no auth.uid()) is unaffected. Bodies are otherwise unchanged.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.enforce_free_template_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.user_id is distinct from auth.uid() then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('workout_templates:' || new.user_id::text, 0));
  if public.plan_rank(public.plan_of(new.user_id)) = 0
     and (select count(*) from public.workout_templates where user_id = new.user_id) >= 5 then
    raise exception 'Free plan limit: 5 saved workouts' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_live_gps_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  adds_gps boolean;
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    adds_gps := new.source = 'gps' or new.route is not null;
  else
    adds_gps := (new.source = 'gps' and old.source is distinct from 'gps')
      or (new.route is not null and new.route is distinct from old.route);
  end if;
  if adds_gps and public.plan_rank(public.plan_of(new.user_id)) < public.plan_rank('plus') then
    raise exception 'Live GPS recording is included with Pro' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_wellness_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.user_id is distinct from auth.uid() then
    return new;
  end if;
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

create or replace function public.enforce_coach_memory_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.user_id is distinct from auth.uid() then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('coach_memories:' || new.user_id::text, 0));
  if (select count(*) from public.coach_memories where user_id = new.user_id) >= 100 then
    raise exception 'coach_memory_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_running_goal_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.user_id is distinct from auth.uid() then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('running_goals:' || new.user_id::text, 0));
  if (select count(*) from public.running_goals where user_id = new.user_id and archived_at is null) >= 10 then
    raise exception 'running_goal_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.body_scan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.user_id is distinct from auth.uid() then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('body_scans:' || new.user_id::text));
  if (select count(*) from public.body_scans where user_id = new.user_id) >= 200 then
    raise exception 'body_scan_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- F17 (L7): links to another member's rows. A foreign key only proves the row exists, so a member could point their
-- own row at someone else's session, enrolment, message, measurement, food or private program (an existence check,
-- and junk links in the data). These links now have to point at the member's own rows (or, for programs and foods,
-- at the public catalog). A missing row and someone else's row get the same error. Security invoker: the check sees
-- only what the member can already see. The server (service role) is unaffected.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.check_member_reference()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_col text := tg_argv[0];
  v_kind text := tg_argv[1];
  v_ref uuid := (to_jsonb(new) ->> v_col)::uuid;
  v_ok boolean;
begin
  if auth.uid() is null or v_ref is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and v_ref is not distinct from (to_jsonb(old) ->> v_col)::uuid then
    return new;
  end if;
  v_ok := case v_kind
    when 'program' then exists (
      select 1 from public.training_programs p
      where p.id = v_ref and (p.is_published or p.owner_id = auth.uid() or public.is_admin()))
    when 'program_day' then exists (
      select 1 from public.program_days d
      join public.program_weeks w on w.id = d.week_id
      join public.training_programs p on p.id = w.program_id
      where d.id = v_ref and (p.is_published or p.owner_id = auth.uid() or public.is_admin()))
    when 'food' then exists (select 1 from public.foods f where f.id = v_ref and (f.owner_id is null or f.owner_id = auth.uid()))
    when 'user_programs' then exists (select 1 from public.user_programs x where x.id = v_ref and x.user_id = auth.uid())
    when 'workout_sessions' then exists (select 1 from public.workout_sessions x where x.id = v_ref and x.user_id = auth.uid())
    when 'ai_messages' then exists (select 1 from public.ai_messages x where x.id = v_ref and x.user_id = auth.uid())
    when 'measurement_entries' then exists (select 1 from public.measurement_entries x where x.id = v_ref and x.user_id = auth.uid())
    else false
  end;
  if not v_ok then
    raise exception 'The linked % was not found', replace(v_col, '_id', '') using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function public.check_member_reference() from public, anon, authenticated;

create trigger workout_sessions_ref_user_program before insert or update of user_program_id on public.workout_sessions
  for each row execute function public.check_member_reference('user_program_id', 'user_programs');
create trigger workout_sessions_ref_program_day before insert or update of program_day_id on public.workout_sessions
  for each row execute function public.check_member_reference('program_day_id', 'program_day');
create trigger personal_records_ref_session before insert or update of session_id on public.personal_records
  for each row execute function public.check_member_reference('session_id', 'workout_sessions');
create trigger activities_ref_workout_session before insert or update of workout_session_id on public.activities
  for each row execute function public.check_member_reference('workout_session_id', 'workout_sessions');
create trigger planned_session_overrides_ref_program_day before insert or update of program_day_id on public.planned_session_overrides
  for each row execute function public.check_member_reference('program_day_id', 'program_day');
create trigger coach_memories_ref_source_message before insert or update of source_message_id on public.coach_memories
  for each row execute function public.check_member_reference('source_message_id', 'ai_messages');
create trigger training_adjustments_ref_program before insert or update of program_id on public.training_adjustments
  for each row execute function public.check_member_reference('program_id', 'program');
create trigger training_adjustments_ref_source_message before insert or update of source_message_id on public.training_adjustments
  for each row execute function public.check_member_reference('source_message_id', 'ai_messages');
create trigger body_scans_ref_measurement before insert or update of measurement_id on public.body_scans
  for each row execute function public.check_member_reference('measurement_id', 'measurement_entries');
create trigger meal_items_ref_food before insert or update of food_id on public.meal_items
  for each row execute function public.check_member_reference('food_id', 'food');

-- ---------------------------------------------------------------------------------------------------------------
-- F17 (L8): program_of_week and program_of_day are callable by anyone over the API (row level security on the
-- catalog uses them for signed-out visitors too), and returned the program of any week or day id, including a
-- member's private program. They now answer only for programs the caller can see (published, their own, or any for
-- an admin), which is all the policies that use them need; for anything else they return null, as for a missing id.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.program_of_week(p_week_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select w.program_id
  from public.program_weeks w
  join public.training_programs p on p.id = w.program_id
  where w.id = p_week_id and (p.is_published or p.owner_id = auth.uid() or public.is_admin());
$$;

create or replace function public.program_of_day(p_day_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select w.program_id
  from public.program_days d
  join public.program_weeks w on w.id = d.week_id
  join public.training_programs p on p.id = w.program_id
  where d.id = p_day_id and (p.is_published or p.owner_id = auth.uid() or public.is_admin());
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- F16 (L5): legal acceptance records. Members could add their own rows with any version, fingerprint and details,
-- which weakens them as evidence. Now:
-- - legal_document_versions lists every published version with its fingerprint (seeded below from
--   src/lib/legal/versions.ts; the server registers new ones from the same file before recording them);
-- - every acceptance must name a listed version, and only auto-renewal consent carries details;
-- - members no longer write acceptances directly: the server records re-acceptance and checkout consent (with the
--   details it computed from the approved price), and sign-up records only listed versions.
-- Existing rows are kept as they are.
-- ---------------------------------------------------------------------------------------------------------------
create table public.legal_document_versions (
  document text not null check (document in ('terms', 'privacy', 'risk_acknowledgment', 'auto_renewal')),
  version text not null check (char_length(version) between 1 and 64),
  document_sha256 text not null check (document_sha256 ~ '^[0-9a-f]{64}$'),
  registered_at timestamptz not null default now(),
  primary key (document, version, document_sha256)
);
alter table public.legal_document_versions enable row level security;
revoke all on public.legal_document_versions from public, anon, authenticated;
grant select, insert on public.legal_document_versions to service_role;

insert into public.legal_document_versions (document, version, document_sha256) values
  ('terms', '2026-10-26-placeholder', '946063b3f9f9fc2f0c5d5aa0d22fbedd2119743ef7ba460621460b026625027e'),
  ('privacy', '2026-10-26-placeholder', '8d8a8e0f40273174a44b291eb90fadc7ccb2dd7abae5841df0e1accc4b35646f'),
  ('risk_acknowledgment', '2026-10-26', '13ee7dde914c308e7cf61bfc835c33a608fb43c9ae34f34497eeff1c6191c4a8'),
  ('auto_renewal', '2026-10-26', '21f34d05136b28c07ae40b2351ea66d51f01ca8603d8254d57cc88dd3c1eb49c')
on conflict do nothing;

create or replace function public.legal_acceptance_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.legal_document_versions v
    where v.document = new.document and v.version = new.version and v.document_sha256 = new.document_sha256
  ) then
    raise exception 'Unknown legal document version' using errcode = '23514';
  end if;
  if (new.document = 'auto_renewal') <> (new.details is not null) then
    raise exception 'Only auto-renewal consent records what was agreed to, and it must' using errcode = '23514';
  end if;
  if new.document = 'auto_renewal' and new.source <> 'checkout' then
    raise exception 'Auto-renewal consent is recorded at checkout' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.legal_acceptance_check() from public, anon, authenticated;
create trigger legal_acceptances_check before insert on public.legal_acceptances
  for each row execute function public.legal_acceptance_check();

drop policy if exists legal_acceptances_insert_own on public.legal_acceptances;
revoke insert, update, delete on public.legal_acceptances from anon, authenticated;

-- Sign-up records only listed versions (an entry that isn't listed is skipped, never blocking the sign-up).
create or replace function public.record_signup_acceptances()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
begin
  if jsonb_typeof(new.raw_user_meta_data -> 'legal_acceptances') <> 'array' then
    return new;
  end if;
  for item in select * from jsonb_array_elements(new.raw_user_meta_data -> 'legal_acceptances') limit 10 loop
    if item ->> 'document' in ('terms', 'privacy', 'risk_acknowledgment')
       and exists (
         select 1 from public.legal_document_versions v
         where v.document = item ->> 'document' and v.version = item ->> 'version' and v.document_sha256 = item ->> 'sha256'
       ) then
      insert into public.legal_acceptances (user_id, document, version, document_sha256, source)
      values (new.id, item ->> 'document', item ->> 'version', item ->> 'sha256', 'signup');
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.record_signup_acceptances() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- F18: an AI coach request can carry a request id from the client. A retry with the same id gets the saved reply
-- instead of a second answer (and a second charge against the member's allowance); while the first is still being
-- answered, the retry is told so. One question and one reply per request id and member.
-- ---------------------------------------------------------------------------------------------------------------
alter table public.ai_messages add column if not exists request_id uuid;
create unique index if not exists ai_messages_request_once on public.ai_messages (user_id, role, request_id) where request_id is not null;
