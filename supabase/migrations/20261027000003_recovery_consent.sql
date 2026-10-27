-- Recovery check-ins are optional wellness information stored only with consent (as the app and privacy
-- policy say). Limitation notes were already protected by a trigger; check-ins relied on application
-- code alone. This adds the same database-level guarantee.

create or replace function public.enforce_recovery_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.id = new.user_id and p.wellness_consent_at is not null
  ) then
    raise exception 'Consent is required before storing recovery check-ins'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger recovery_checkins_consent before insert or update on public.recovery_checkins
  for each row execute function public.enforce_recovery_consent();
