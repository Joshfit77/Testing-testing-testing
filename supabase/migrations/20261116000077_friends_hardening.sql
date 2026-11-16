-- ROLLBACK (restores migration 076's versions; no member data is lost except administrators' notes, of which none
-- can exist: no screen ever wrote one):
--   alter table public.user_reports add column if not exists admin_note text check (admin_note is null or char_length(admin_note) <= 500);
--   grant update (status, admin_note, reviewed_at) on public.user_reports to authenticated;
--   then re-run the definitions of search_users, accept_friend_invite and admin_user_reports from migration 076.
--
-- Friends hardening from the 2026-11-16 privacy audit (docs/legal-audit-2026-11-16/08_FRIENDS_PRIVACY_AUDIT.md):
--   F-05  A member who sent a report could read the administrators' internal note on it (the row is theirs to read,
--         and row-level security cannot hide one column). The note was never written by any screen: the column is
--         removed. A decision is still recorded in `status` and `reviewed_at`.
--   F-02  The limit on username searches existed only in the app's server action, so a member calling the database
--         function directly could list usernames without limit. The function now counts its own calls.
--   F-08  The same for guessing invite codes. A code that isn't found now returns null instead of raising
--         invite_not_found, so the attempt is counted (an error would undo the count).
-- Nothing else changes: same results, same errors, same grants.

drop function if exists public.admin_user_reports(text);
alter table public.user_reports drop column if exists admin_note;
revoke update on public.user_reports from authenticated, anon;
grant update (status, reviewed_at) on public.user_reports to authenticated;

create or replace function public.admin_user_reports(p_status text default 'open')
returns table (id uuid, reporter_id uuid, reporter_username text, reported_id uuid, reported_username text, reason text, details text, status text, created_at timestamptz, reviewed_at timestamptz, open_reports_against bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return query
  select r.id, r.reporter_id, a.username, r.reported_id, b.username, r.reason, r.details, r.status, r.created_at, r.reviewed_at,
    (select count(*) from public.user_reports x where x.reported_id = r.reported_id and x.status = 'open')
  from public.user_reports r
  left join public.social_profiles a on a.user_id = r.reporter_id
  left join public.social_profiles b on b.user_id = r.reported_id
  where p_status is null or r.status = p_status
  order by r.created_at desc
  limit 200;
end;
$$;
revoke all on function public.admin_user_reports(text) from public, anon;
grant execute on function public.admin_user_reports(text) to authenticated;

create or replace function public.search_users(p_query text)
returns table (user_id uuid, username text, relation text)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_q text := lower(btrim(regexp_replace(coalesce(p_query, ''), '^@', '')));
begin
  if v_uid is null or not public.friends_enabled() or v_q !~ '^[a-z0-9_]{3,20}$' then
    return;
  end if;
  -- At most 60 searches a minute per member, counted here so the limit holds for direct API calls too.
  if not (select r.allowed from public.rate_limit_hit('friends-search-db:' || v_uid::text, 60, 60) r) then
    return;
  end if;
  return query
  select sp.user_id, sp.username,
    case
      when exists (select 1 from public.friendships f where f.user_a = least(v_uid, sp.user_id) and f.user_b = greatest(v_uid, sp.user_id)) then 'friend'
      when exists (select 1 from public.friend_requests r where r.sender_id = v_uid and r.recipient_id = sp.user_id and r.status = 'pending') then 'requested'
      when exists (select 1 from public.friend_requests r where r.sender_id = sp.user_id and r.recipient_id = v_uid and r.status = 'pending') then 'incoming'
      else 'none'
    end
  from public.social_profiles sp
  where sp.username like replace(v_q, '_', '\_') || '%'
    and sp.user_id <> v_uid
    and (sp.searchable or exists (select 1 from public.friendships f where f.user_a = least(v_uid, sp.user_id) and f.user_b = greatest(v_uid, sp.user_id)))
    and not public.friends_blocked(v_uid, sp.user_id)
  order by (sp.username = v_q) desc, sp.username
  limit 10;
end;
$$;
revoke all on function public.search_users(text) from public, anon;
grant execute on function public.search_users(text) to authenticated;

create or replace function public.accept_friend_invite(p_code text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.friend_invites;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.friends_enabled() then
    raise exception 'friends_off';
  end if;
  -- At most 20 attempts in 10 minutes per member, counted here so codes can't be guessed through direct API calls.
  if not (select r.allowed from public.rate_limit_hit('friends-invite-db:' || v_uid::text, 20, 600) r) then
    raise exception 'invite_rate_limited';
  end if;
  select * into v_inv from public.friend_invites i
  where i.code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
  for update;
  -- Returns null rather than raising: an error would roll back the attempt count above, and the limit would never
  -- be reached by someone guessing codes.
  if not found or public.friends_blocked(v_uid, v_inv.inviter_id) then
    return null;
  end if;
  if v_inv.used_at is not null then
    raise exception 'invite_used';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'invite_expired';
  end if;
  if v_inv.inviter_id = v_uid then
    raise exception 'own_invite';
  end if;
  if not exists (select 1 from public.social_profiles sp where sp.user_id = v_uid) then
    raise exception 'username_required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('friends:' || least(v_uid, v_inv.inviter_id)::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('friends:' || greatest(v_uid, v_inv.inviter_id)::text, 0));
  if exists (select 1 from public.friendships f where f.user_a = least(v_uid, v_inv.inviter_id) and f.user_b = greatest(v_uid, v_inv.inviter_id)) then
    raise exception 'already_friends';
  end if;
  if not public.friends_make_friends(v_uid, v_inv.inviter_id) then
    raise exception 'friend_limit';
  end if;
  update public.friend_requests r set status = 'accepted', responded_at = now()
  where r.status = 'pending'
    and least(r.sender_id, r.recipient_id) = least(v_uid, v_inv.inviter_id)
    and greatest(r.sender_id, r.recipient_id) = greatest(v_uid, v_inv.inviter_id);
  update public.friend_invites set used_at = now() where id = v_inv.id;
  return v_inv.inviter_id;
end;
$$;
revoke all on function public.accept_friend_invite(text) from public, anon;
grant execute on function public.accept_friend_invite(text) to authenticated;
