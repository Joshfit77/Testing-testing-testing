-- Admins manage the shared program library (programs with no owner). They no longer read, or link their own rows to,
-- a member's private programs (custom, AI-built or starter plans): those describe the member's goals and training.
-- Before this, every read path below also let any admin through (finding F-19, security assessment 2026-11-20). The
-- admin screens only ever list owner-less programs, so nothing in the app depends on the wider access. A member keeps
-- full access to their own programs; published programs stay readable as before; the service role is unaffected.

drop policy if exists training_programs_read on public.training_programs;
create policy training_programs_read on public.training_programs
  for select to anon, authenticated
  using (is_published or owner_id = (select auth.uid()) or (owner_id is null and public.is_admin()));

CREATE OR REPLACE FUNCTION public.can_view_program(p_program_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.training_programs p
    where p.id = p_program_id
      and (p.is_published or p.owner_id = auth.uid() or (p.owner_id is null and public.is_admin()))
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_use_program(p_program_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.training_programs p
    where p.id = p_program_id
      and (
        p.owner_id = auth.uid()
        or (p.owner_id is null and public.is_admin())
        or (p.is_published and public.has_plan(p.tier))
        or exists (select 1 from public.user_programs up where up.program_id = p.id and up.user_id = auth.uid())
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.program_of_week(p_week_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select w.program_id
  from public.program_weeks w
  join public.training_programs p on p.id = w.program_id
  where w.id = p_week_id and (p.is_published or p.owner_id = auth.uid() or (p.owner_id is null and public.is_admin()));
$function$;

CREATE OR REPLACE FUNCTION public.program_of_day(p_day_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select w.program_id
  from public.program_days d
  join public.program_weeks w on w.id = d.week_id
  join public.training_programs p on p.id = w.program_id
  where d.id = p_day_id and (p.is_published or p.owner_id = auth.uid() or (p.owner_id is null and public.is_admin()));
$function$;

CREATE OR REPLACE FUNCTION public.check_member_reference()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
      where p.id = v_ref and (p.is_published or p.owner_id = auth.uid() or (p.owner_id is null and public.is_admin())))
    when 'program_day' then exists (
      select 1 from public.program_days d
      join public.program_weeks w on w.id = d.week_id
      join public.training_programs p on p.id = w.program_id
      where d.id = v_ref and (p.is_published or p.owner_id = auth.uid() or (p.owner_id is null and public.is_admin())))
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
$function$;
