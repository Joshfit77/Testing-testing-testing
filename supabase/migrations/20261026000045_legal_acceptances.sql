-- Narrow Gate Fitness — evidence of what each member agreed to, and when.
--
-- Sign-up already required unticked "I agree" and "18 or older" boxes, but nothing recorded which version of the
-- Terms and Privacy Policy was shown or when it was accepted. Each row records one acceptance: the document, its
-- version, a SHA-256 fingerprint of the exact text shown (src/lib/legal/versions.ts; the text itself is kept in the
-- repository's history), when, and where (sign-up, re-acceptance after a change, or web checkout's auto-renewal
-- consent). Rows are append-only for members: they can read their own and add their own, never edit or delete.
-- They are removed with the account. Nothing existing is changed.

create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document text not null check (document in ('terms', 'privacy', 'risk_acknowledgment', 'auto_renewal')),
  version text not null check (char_length(version) between 1 and 64),
  document_sha256 text not null check (document_sha256 ~ '^[0-9a-f]{64}$'),
  source text not null check (source in ('signup', 'reaccept', 'checkout')),
  -- For auto-renewal consent: what was agreed to (e.g. "Pro All Access, $19.99 per month").
  details text check (details is null or char_length(details) <= 300),
  accepted_at timestamptz not null default now()
);
create index legal_acceptances_user_idx on public.legal_acceptances (user_id, document, accepted_at desc);

alter table public.legal_acceptances enable row level security;
create policy legal_acceptances_select_own on public.legal_acceptances
  for select to authenticated using (user_id = (select auth.uid()));
create policy legal_acceptances_insert_own on public.legal_acceptances
  for insert to authenticated with check (user_id = (select auth.uid()) and source in ('reaccept', 'checkout'));

-- The time is always the database's, so a record can't be back- or post-dated.
create or replace function public.legal_acceptance_stamp()
returns trigger
language plpgsql
as $$
begin
  new.accepted_at := now();
  return new;
end;
$$;
create trigger legal_acceptances_stamp before insert on public.legal_acceptances
  for each row execute function public.legal_acceptance_stamp();

-- Sign-up: the sign-up form sends the documents accepted with the new account (user metadata), and they're recorded
-- in the same transaction that creates the account, so an account can't exist without the record of how it was
-- created. Malformed entries are ignored rather than blocking the sign-up; the app treats a member without a current
-- record as not having accepted (src/server/legal.ts).
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
       and char_length(coalesce(item ->> 'version', '')) between 1 and 64
       and coalesce(item ->> 'sha256', '') ~ '^[0-9a-f]{64}$' then
      insert into public.legal_acceptances (user_id, document, version, document_sha256, source)
      values (new.id, item ->> 'document', item ->> 'version', item ->> 'sha256', 'signup');
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.record_signup_acceptances() from public, anon, authenticated;

create trigger on_auth_user_created_legal
  after insert on auth.users
  for each row execute function public.record_signup_acceptances();
