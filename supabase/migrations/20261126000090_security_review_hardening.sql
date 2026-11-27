-- Independent security review, 2026-11-25 (findings N-1, N-2, N-4, N-5). All small, all reversible.
--
-- ROLLBACK:
--   drop function if exists public.expire_old_sessions(integer);
--   drop trigger if exists ai_messages_proposal_status_guard on public.ai_messages;
--   drop function if exists public.guard_proposal_status();
--   alter table public.profiles drop constraint if exists profiles_layout_prefs_size_check;
--   recreate avatars_owner_insert / avatars_owner_update as in migration 003.

-- N-2. The avatars bucket isn't used by the app (no screen uploads or shows an avatar), but signed-in members could
-- upload to it without any limit. New uploads and overwrites are no longer allowed; members can still see and delete
-- anything already stored there (and account deletion empties it, src/server/services/account.ts).
drop policy if exists avatars_owner_insert on storage.objects;
drop policy if exists avatars_owner_update on storage.objects;

-- N-4. A coach proposal is confirmed once: members may only move it from "proposed" to "applied" or "dismissed".
-- Moving it back (which would let an already-applied plan be applied again) is reserved to the server, which does it
-- only after a failed save (src/server/actions/coach.ts, reopenProposal).
create or replace function public.guard_proposal_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.proposal_status is distinct from old.proposal_status
     and current_user = 'authenticated'
     and not (old.proposal_status = 'proposed' and new.proposal_status in ('applied', 'dismissed')) then
    raise exception 'proposal already handled' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_proposal_status() from public, anon, authenticated;
drop trigger if exists ai_messages_proposal_status_guard on public.ai_messages;
create trigger ai_messages_proposal_status_guard
  before update of proposal_status on public.ai_messages
  for each row execute function public.guard_proposal_status();

-- N-5. Screen-layout preferences are small; cap them like the other member-written JSON columns (033, 039).
alter table public.profiles drop constraint if exists profiles_layout_prefs_size_check;
alter table public.profiles
  add constraint profiles_layout_prefs_size_check check (layout_prefs is null or octet_length(layout_prefs::text) <= 4000) not valid;
alter table public.profiles validate constraint profiles_layout_prefs_size_check;

-- N-1. The 30-day maximum sign-in age (SESSION_MAX_AGE_DAYS) was enforced by the website and the API, but the
-- sessions themselves stayed valid at the authentication server, so a copied refresh token could keep reaching the
-- database directly. This ends (deletes) sessions older than the limit, which also revokes their refresh tokens.
-- Server only (service_role): run daily by /api/maintenance/sessions.
create or replace function public.expire_old_sessions(p_max_age_days integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_max_age_days is null or p_max_age_days < 1 or p_max_age_days > 365 then
    raise exception 'max age must be between 1 and 365 days';
  end if;
  delete from auth.sessions where created_at < now() - make_interval(days => p_max_age_days);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.expire_old_sessions(integer) from public, anon, authenticated;
grant execute on function public.expire_old_sessions(integer) to service_role;
