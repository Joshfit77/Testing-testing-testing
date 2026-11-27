-- ROLLBACK (restores the state after migration 092; no member data is touched in either direction):
--   alter table public.social_profiles alter column show_workouts set default true;
--   grant select on public.social_profiles, public.friend_requests, public.friendships, public.user_blocks,
--     public.user_reports, public.friend_invites, public.accountability_partnerships, public.accountability_invites,
--     public.accountability_shares, public.accountability_nudges to anon;
--   grant delete on public.friend_invites, public.accountability_invites to anon;
--   grant insert, update, delete on public.accountability_partnerships to anon, authenticated;
--   grant insert, update, delete on public.feature_flags to anon;
--   then, for each of the 24 functions listed under (1) below:
--     alter function public.<name>(<arguments>) set search_path = public;
--   then re-run the definitions of send_friend_request and respond_friend_request from migration 091 and of
--   accept_accountability_invite from migration 067.
-- The app code that goes with this migration (workouts shown as off for a new member) still works against the older
-- database, so either can be rolled back first.
--
-- Friends and accountability partners: privacy defaults and hardening from the 2026-11-16 privacy audit
-- (docs/legal-audit-2026-11-16/08_FRIENDS_PRIVACY_AUDIT.md). Both features stay OFF: this migration does not touch
-- public.feature_flags rows.
--
--   F-07  Privacy by default. The owner's rule: "No user should gain access to private information merely by becoming
--         a friend". social_profiles.show_workouts now defaults to false, so a new member shares only their username
--         and display name with a friend until they switch workouts on. Whether sharing may start on at all, and what
--         consent it needs, is an owner and counsel decision recorded in the audit (F-07); this is the conservative
--         setting until they decide. Existing rows are left alone (there are no real members). `searchable` and
--         `profile_visible` keep their defaults: neither shares activity.
--   F-14  Every SECURITY DEFINER function from migrations 067, 076 and 077 ran with search_path = public, which
--         searches the caller's temporary schema first for unqualified table names. Each now lists pg_temp last.
--   F-15  The signed-out role (anon) held table privileges on the Friends and accountability tables that no screen,
--         policy or function uses; row-level security was the only layer stopping it. They are revoked. So are the
--         insert/update/delete privileges on accountability_partnerships (for anon and authenticated: only functions
--         write that table) and anon's write privileges on feature_flags (anon still reads the flags).
--         No function privilege changes: none of the 24 functions was executable by anon or PUBLIC (checked with
--         has_function_privilege before and after).
--   F-16  respond_friend_request declined a request and then raised, which undid the decline. The update that never
--         took effect is removed; the outcome (request_not_found) is unchanged.
--   F-12  A member who switched "Let people find me by username" off could still be sent a request by anyone holding
--         their account id (a former friend, for example), although the screen says only people they contact can
--         connect with them. send_friend_request now refuses with user_not_found unless that member has already sent
--         the caller a request.
--   F-21  accept_accountability_invite did not look at blocks, so a blocked member holding the blocker's code became
--         their partner and saw their name and activity. It now refuses with invite_not_found.
--
-- Correction to comments in earlier migrations (they cannot be edited). Migration 076 says a block "is never
-- revealed" (line 341-342) and that the blocked member "is never told" / "isn't told" (lines 221, 497), and that a
-- decline "isn't announced to the sender" (line 209-210). What the database delivers is narrower: the other member is
-- NOT NOTIFIED. They can still work it out: after a block, a member they could see reads as "not found"; after a
-- decline, the request leaves the sender's list and a repeat is refused for 30 days (audit F-03, F-04). That inference
-- is inherent and is not hidden here. No screen, policy or document should say that a block or a decline cannot be
-- detected.

-- ---------------------------------------------------------------------------
-- (0) Functions whose bodies change (F-16, F-12, F-21). Grants are kept by "create or replace".
-- ---------------------------------------------------------------------------

-- Accept or decline a request sent to me. Declining always works; accepting needs the feature on.
-- Errors: request_not_found (also when either has blocked the other), friend_limit, friends_off, not_signed_in.
create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.friend_requests;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select * into v_req from public.friend_requests r
  where r.id = p_request_id and r.recipient_id = v_uid and r.status = 'pending'
  for update;
  if not found then
    raise exception 'request_not_found';
  end if;
  if not coalesce(p_accept, false) then
    update public.friend_requests set status = 'declined', responded_at = now() where id = v_req.id;
    return true;
  end if;
  if not public.friends_enabled() then
    raise exception 'friends_off';
  end if;
  -- block_user() already closes pending requests between the two, so this is a second guard only. (Migration 076
  -- also updated the request here before raising; the raise undid it.)
  if public.friends_blocked(v_uid, v_req.sender_id) then
    raise exception 'request_not_found';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('friends:' || least(v_uid, v_req.sender_id)::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('friends:' || greatest(v_uid, v_req.sender_id)::text, 0));
  if not public.friends_make_friends(v_uid, v_req.sender_id) then
    raise exception 'friend_limit';
  end if;
  update public.friend_requests set status = 'accepted', responded_at = now() where id = v_req.id;
  return true;
end;
$$;

-- Send a friend request. Returns 'requested', or 'accepted' when that member had already asked me (the two requests
-- meet, so we become friends).
-- Errors: username_required, self_request, user_not_found (also when either has blocked the other, or when that member
-- has switched search off and hasn't asked me first; the member isn't notified, but the caller can infer it),
-- already_friends, already_requested, request_cooldown, request_limit, friend_limit, friends_off, not_signed_in.
create or replace function public.send_friend_request(p_user_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_a uuid;
  v_b uuid;
  v_incoming uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.friends_enabled() then
    raise exception 'friends_off';
  end if;
  if not exists (select 1 from public.social_profiles sp where sp.user_id = v_uid) then
    raise exception 'username_required';
  end if;
  if p_user_id is null or p_user_id = v_uid then
    raise exception 'self_request';
  end if;
  if not exists (select 1 from public.social_profiles sp where sp.user_id = p_user_id) or public.friends_blocked(v_uid, p_user_id) then
    raise exception 'user_not_found';
  end if;
  v_a := least(v_uid, p_user_id);
  v_b := greatest(v_uid, p_user_id);
  -- Serialize changes for both members (always locked in the same order: no deadlock).
  perform pg_advisory_xact_lock(hashtextextended('friends:' || v_a::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('friends:' || v_b::text, 0));
  if exists (select 1 from public.friendships f where f.user_a = v_a and f.user_b = v_b) then
    raise exception 'already_friends';
  end if;
  if exists (select 1 from public.friend_requests r where r.sender_id = v_uid and r.recipient_id = p_user_id and r.status = 'pending') then
    raise exception 'already_requested';
  end if;
  select r.id into v_incoming from public.friend_requests r
  where r.sender_id = p_user_id and r.recipient_id = v_uid and r.status = 'pending';
  if v_incoming is not null then
    if not public.friends_make_friends(v_uid, p_user_id) then
      raise exception 'friend_limit';
    end if;
    update public.friend_requests set status = 'accepted', responded_at = now() where id = v_incoming;
    return 'accepted';
  end if;
  -- A member who switched search off is reached only by their own requests and invite links (they asked first: the
  -- branch above), whoever holds their account id.
  if not coalesce((select sp.searchable from public.social_profiles sp where sp.user_id = p_user_id), false) then
    raise exception 'user_not_found';
  end if;
  if exists (select 1 from public.friend_requests r
             where r.sender_id = v_uid and r.recipient_id = p_user_id and r.status = 'declined'
               and r.responded_at > now() - interval '30 days') then
    raise exception 'request_cooldown';
  end if;
  if (select count(*) from public.friend_requests r where r.sender_id = v_uid and r.created_at > now() - interval '24 hours') >= 20 then
    raise exception 'request_limit';
  end if;
  insert into public.friend_requests (sender_id, recipient_id) values (v_uid, p_user_id);
  return 'requested';
end;
$$;

-- Accept a partner's invite code: creates the partnership (with default share settings for both) and uses up the code.
-- Errors (the message is the reason): invite_not_found (also when either has blocked the other), invite_used,
-- invite_expired, own_invite, already_partners, partner_limit (you have 3), inviter_partner_limit (they have 3),
-- accountability_off, not_signed_in.
create or replace function public.accept_accountability_invite(p_code text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.accountability_invites;
  v_a uuid;
  v_b uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.accountability_enabled() then
    raise exception 'accountability_off';
  end if;
  select * into v_inv from public.accountability_invites i
  where i.code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
  for update;
  if not found or public.friends_blocked(v_uid, v_inv.inviter_id) then
    raise exception 'invite_not_found';
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
  v_a := least(v_uid, v_inv.inviter_id);
  v_b := greatest(v_uid, v_inv.inviter_id);
  -- Serialize partner-count changes for both members (always locked in the same order: no deadlock).
  perform pg_advisory_xact_lock(hashtextextended('accountability:' || v_a::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('accountability:' || v_b::text, 0));
  if exists (select 1 from public.accountability_partnerships p where p.user_a = v_a and p.user_b = v_b and p.status = 'active') then
    raise exception 'already_partners';
  end if;
  if (select count(*) from public.accountability_partnerships p where p.status = 'active' and v_uid in (p.user_a, p.user_b)) >= 3 then
    raise exception 'partner_limit';
  end if;
  if (select count(*) from public.accountability_partnerships p where p.status = 'active' and v_inv.inviter_id in (p.user_a, p.user_b)) >= 3 then
    raise exception 'inviter_partner_limit';
  end if;
  insert into public.accountability_partnerships (user_a, user_b) values (v_a, v_b) returning id into v_id;
  insert into public.accountability_shares (partnership_id, user_id) values (v_id, v_a), (v_id, v_b);
  update public.accountability_invites set used_at = now() where id = v_inv.id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- (1) F-14: search_path = public, pg_temp on every SECURITY DEFINER function of migrations 067, 076 and 077.
-- Verify: select oid::regprocedure, proconfig from pg_proc where prosecdef and pronamespace = 'public'::regnamespace;
-- ---------------------------------------------------------------------------

-- Migration 067 (accountability partners): 6 functions.
alter function public.accountability_enabled() set search_path = public, pg_temp;
alter function public.accountability_can_invite() set search_path = public, pg_temp;
alter function public.accountability_summary(uuid) set search_path = public, pg_temp;
alter function public.accept_accountability_invite(text) set search_path = public, pg_temp;
alter function public.end_accountability_partnership(uuid) set search_path = public, pg_temp;
alter function public.send_accountability_nudge(uuid, text) set search_path = public, pg_temp;

-- Migrations 076 and 077 (Friends): 18 functions (077 redefined search_users, accept_friend_invite, admin_user_reports).
alter function public.friends_enabled() set search_path = public, pg_temp;
alter function public.friends_blocked(uuid, uuid) set search_path = public, pg_temp;
alter function public.friends_can_invite() set search_path = public, pg_temp;
alter function public.claim_username(text) set search_path = public, pg_temp;
alter function public.friends_make_friends(uuid, uuid) set search_path = public, pg_temp;
alter function public.send_friend_request(uuid) set search_path = public, pg_temp;
alter function public.respond_friend_request(uuid, boolean) set search_path = public, pg_temp;
alter function public.cancel_friend_request(uuid) set search_path = public, pg_temp;
alter function public.remove_friend(uuid) set search_path = public, pg_temp;
alter function public.block_user(uuid) set search_path = public, pg_temp;
alter function public.unblock_user(uuid) set search_path = public, pg_temp;
alter function public.report_user(uuid, text, text) set search_path = public, pg_temp;
alter function public.accept_friend_invite(text) set search_path = public, pg_temp;
alter function public.search_users(text) set search_path = public, pg_temp;
alter function public.friends_workout_stats(uuid) set search_path = public, pg_temp;
alter function public.friends_overview() set search_path = public, pg_temp;
alter function public.friend_profile(uuid) set search_path = public, pg_temp;
alter function public.admin_user_reports(text) set search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- (2) F-15: privileges nothing uses. Every policy on these tables is for `authenticated` only, and members reach
-- other members' rows through the functions above, never as the signed-out role.
-- ---------------------------------------------------------------------------

revoke all on public.social_profiles, public.friend_requests, public.friendships, public.user_blocks,
  public.user_reports, public.friend_invites from anon;
revoke all on public.accountability_partnerships, public.accountability_invites, public.accountability_shares,
  public.accountability_nudges from anon;
-- Partnerships are created and ended by accept_accountability_invite, end_accountability_partnership and block_user
-- only; no policy lets a member write one. Members keep SELECT (their own, by policy).
revoke insert, update, delete on public.accountability_partnerships from authenticated;
-- A signed-out visitor reads the flags (the app decides what to show) and never writes them. Administrators write
-- them as `authenticated`, under the feature_flags_admin_write policy.
revoke insert, update, delete on public.feature_flags from anon;

-- ---------------------------------------------------------------------------
-- (3) F-07: a new member shares no activity until they switch it on. Existing rows are not changed.
-- ---------------------------------------------------------------------------

alter table public.social_profiles alter column show_workouts set default false;
