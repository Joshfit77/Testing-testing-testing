-- Explicit consent before any data is sent to the third-party AI provider (Apple App Review 5.1.2(i)).
-- profiles.ai_consent_at is set when the member agrees on the coach screen and cleared when they withdraw.
-- The server refuses AI requests without it; as a second line of defence, new AI messages can't be
-- stored for a member who hasn't consented.

alter table public.profiles add column if not exists ai_consent_at timestamptz;
grant update (ai_consent_at) on public.profiles to authenticated;

create or replace function public.enforce_ai_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'user' and not exists (
    select 1 from public.profiles p where p.id = new.user_id and p.ai_consent_at is not null
  ) then
    raise exception 'Consent is required before using the AI coach'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger ai_messages_consent before insert on public.ai_messages
  for each row execute function public.enforce_ai_consent();
