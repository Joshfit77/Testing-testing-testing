-- ROLLBACK (removes Friends only; accounts, workouts, accountability partners and every other table untouched):
--   drop function if exists public.admin_user_reports(text);
--   drop function if exists public.friend_profile(uuid);
--   drop function if exists public.friends_overview();
--   drop function if exists public.search_users(text);
--   drop function if exists public.accept_friend_invite(text);
--   drop function if exists public.report_user(uuid, text, text);
--   drop function if exists public.unblock_user(uuid);
--   drop function if exists public.block_user(uuid);
--   drop function if exists public.remove_friend(uuid);
--   drop function if exists public.cancel_friend_request(uuid);
--   drop function if exists public.respond_friend_request(uuid, boolean);
--   drop function if exists public.send_friend_request(uuid);
--   drop function if exists public.claim_username(text);
--   drop function if exists public.friends_workout_stats(uuid);
--   drop function if exists public.friends_make_friends(uuid, uuid);
--   drop table if exists public.friend_invites;
--   drop function if exists public.friends_can_invite();
--   drop table if exists public.user_reports;
--   drop table if exists public.user_blocks;
--   drop table if exists public.friendships;
--   drop table if exists public.friend_requests;
--   drop table if exists public.social_profiles;
--   drop function if exists public.friends_blocked(uuid, uuid);
--   drop function if exists public.friends_enabled();
--   delete from public.feature_flags where key = 'friends_challenges';
-- Roll back the app code first: /friends reads and writes these tables.
--
-- Friends (phase 1 of Friends & Challenges). A member chooses a unique username; others find them by it, or use an
-- invite link. A friend request must be accepted before anything is shared. Friends then see only what the member's
-- own switches allow, and only through friend_profile() below: no member can read another member's rows in any table.
-- Private by default, whatever the friendship: weight and measurements, nutrition, Faith activity. Never shared at
-- all: prayer journal, notes, sleep, photos, body scans, AI coach chats, individual sets.
--
-- It is OFF: the flag below is inserted disabled; the app shows no entry point and the pages 404; the database itself
-- refuses usernames, searches, requests and invites while the flag is off. Removing a friend, blocking, unblocking,
-- reporting and declining or withdrawing a request always work.
--
-- Limits: 200 friends per member; 20 friend requests per sender in any 24 hours; a declined request can't be repeated
-- for 30 days; a username can be changed once in 30 days; 5 open invite links (single use, 7 days); 5 reports per
-- reporter in any 24 hours. No free text travels between members (a report's details go to administrators only).

insert into public.feature_flags (key, enabled, description)
values ('friends_challenges', false, 'Friends & Challenges: usernames, friend requests, friend profiles, blocking and reporting. Off until the owner approves it (and the privacy policy and terms cover sharing between members).')
on conflict (key) do nothing;

create or replace function public.friends_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select f.enabled from public.feature_flags f where f.key = 'friends_challenges'), false);
$$;
revoke all on function public.friends_enabled() from public, anon;
grant execute on function public.friends_enabled() to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per member who has joined Friends: their username and what friends may see. Created by claim_username().
create table if not exists public.social_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Lower-case letters, digits and underscores; 3 to 20 characters. Unique across all members.
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  username_changed_at timestamptz not null default now(),
  -- Whether others can find this member by username. Off: only invite links and requests the member sends.
  searchable boolean not null default true,
  -- Whether friends see a profile at all (off: friends see the username and display name only).
  profile_visible boolean not null default true,
  show_workouts boolean not null default true,
  show_records boolean not null default false,
  -- Private unless the member turns them on.
  show_body boolean not null default false,
  show_nutrition boolean not null default false,
  show_faith boolean not null default false,
  show_in_leaderboards boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists social_profiles_username_prefix on public.social_profiles (username text_pattern_ops);
drop trigger if exists social_profiles_updated_at on public.social_profiles;
create trigger social_profiles_updated_at before update on public.social_profiles
  for each row execute function public.set_updated_at();

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> recipient_id),
  check ((status = 'pending') = (responded_at is null))
);
-- One pending request per pair, whichever of the two sent it.
create unique index if not exists friend_requests_pending_pair
  on public.friend_requests (least(sender_id, recipient_id), greatest(sender_id, recipient_id)) where status = 'pending';
create index if not exists friend_requests_recipient on public.friend_requests (recipient_id, status, created_at desc);
create index if not exists friend_requests_sender on public.friend_requests (sender_id, created_at desc);

create table if not exists public.friendships (
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Ordered pair: one row per friendship, and never with yourself.
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index if not exists friendships_user_b on public.friendships (user_b);

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked on public.user_blocks (blocked_id);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reported_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('harassment', 'inappropriate_name', 'impersonation', 'spam', 'other')),
  -- Read by administrators only; never shown to the reported member.
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (reporter_id <> reported_id)
);
create index if not exists user_reports_reporter on public.user_reports (reporter_id, created_at desc);
create index if not exists user_reports_reported on public.user_reports (reported_id);
create index if not exists user_reports_open on public.user_reports (created_at) where status = 'open';

create table if not exists public.friend_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users (id) on delete cascade,
  -- Same shape as accountability codes: 10 characters from a 32-letter alphabet without look-alikes.
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  check (expires_at <= created_at + interval '7 days')
);
create index if not exists friend_invites_inviter on public.friend_invites (inviter_id, created_at desc);

alter table public.social_profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;
alter table public.friend_invites enable row level security;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Whether either member has blocked the other. Internal: only the functions in this file call it.
create or replace function public.friends_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$$;
revoke all on function public.friends_blocked(uuid, uuid) from public, anon, authenticated;

create or replace function public.friends_can_invite()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.friends_enabled()
    and exists (select 1 from public.social_profiles sp where sp.user_id = auth.uid())
    and (select count(*) from public.friend_invites i
         where i.inviter_id = auth.uid() and i.used_at is null and i.expires_at > now()) < 5;
$$;
revoke all on function public.friends_can_invite() from public, anon;
grant execute on function public.friends_can_invite() to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security: a member reads only their own rows; every change that involves a second member goes through a
-- function below.
-- ---------------------------------------------------------------------------

drop policy if exists social_profiles_select_own on public.social_profiles;
create policy social_profiles_select_own on public.social_profiles for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists social_profiles_update_own on public.social_profiles;
create policy social_profiles_update_own on public.social_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke insert, update, delete on public.social_profiles from authenticated, anon;
grant update (searchable, profile_visible, show_workouts, show_records, show_body, show_nutrition, show_faith, show_in_leaderboards)
  on public.social_profiles to authenticated;

-- Requests: the recipient reads the ones sent to them; the sender reads their own unless it was declined (a decline
-- isn't announced to the sender).
drop policy if exists friend_requests_select_own on public.friend_requests;
create policy friend_requests_select_own on public.friend_requests for select to authenticated
  using (recipient_id = (select auth.uid()) or (sender_id = (select auth.uid()) and status <> 'declined'));
revoke insert, update, delete on public.friend_requests from authenticated, anon;

drop policy if exists friendships_select_member on public.friendships;
create policy friendships_select_member on public.friendships for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));
revoke insert, update, delete on public.friendships from authenticated, anon;

-- Blocks: only the member who blocked reads them (the blocked member is never told).
drop policy if exists user_blocks_select_own on public.user_blocks;
create policy user_blocks_select_own on public.user_blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
revoke insert, update, delete on public.user_blocks from authenticated, anon;

-- Reports: the reporter reads their own; administrators read and close all of them.
drop policy if exists user_reports_select_own_or_admin on public.user_reports;
create policy user_reports_select_own_or_admin on public.user_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_admin());
drop policy if exists user_reports_update_admin on public.user_reports;
create policy user_reports_update_admin on public.user_reports for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
revoke insert, update, delete on public.user_reports from authenticated, anon;
grant update (status, admin_note, reviewed_at) on public.user_reports to authenticated;

drop policy if exists friend_invites_select_own on public.friend_invites;
create policy friend_invites_select_own on public.friend_invites for select to authenticated
  using (inviter_id = (select auth.uid()));
drop policy if exists friend_invites_insert_own on public.friend_invites;
create policy friend_invites_insert_own on public.friend_invites for insert to authenticated
  with check (inviter_id = (select auth.uid()) and public.friends_can_invite());
drop policy if exists friend_invites_delete_own on public.friend_invites;
create policy friend_invites_delete_own on public.friend_invites for delete to authenticated
  using (inviter_id = (select auth.uid()));
revoke insert, update on public.friend_invites from authenticated, anon;
grant insert (inviter_id, code) on public.friend_invites to authenticated;

-- ---------------------------------------------------------------------------
-- Username
-- ---------------------------------------------------------------------------

-- Choose or change my username (this is what joins a member to Friends). Returns the stored username.
-- Errors: username_invalid, username_reserved, username_taken, username_change_wait, friends_off, not_signed_in.
create or replace function public.claim_username(p_username text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := lower(btrim(regexp_replace(coalesce(p_username, ''), '^@', '')));
  v_cur public.social_profiles;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.friends_enabled() then
    raise exception 'friends_off';
  end if;
  if v_name !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'username_invalid';
  end if;
  -- Names that could pass for the app or its staff.
  if v_name in ('admin', 'administrator', 'support', 'staff', 'official', 'moderator', 'mod', 'system', 'help', 'team',
                'narrowgate', 'narrow_gate', 'narrowgatefitness', 'narrow_gate_fitness', 'ngf', 'coach', 'aicoach', 'ai_coach')
     or v_name like 'narrowgate%' or v_name like 'narrow_gate%' then
    raise exception 'username_reserved';
  end if;
  select * into v_cur from public.social_profiles sp where sp.user_id = v_uid for update;
  if found then
    if v_cur.username = v_name then
      return v_name;
    end if;
    if v_cur.username_changed_at > now() - interval '30 days' then
      raise exception 'username_change_wait';
    end if;
    begin
      update public.social_profiles set username = v_name, username_changed_at = now() where user_id = v_uid;
    exception when unique_violation then
      raise exception 'username_taken';
    end;
    return v_name;
  end if;
  begin
    insert into public.social_profiles (user_id, username) values (v_uid, v_name);
  exception when unique_violation then
    raise exception 'username_taken';
  end;
  return v_name;
end;
$$;
revoke all on function public.claim_username(text) from public, anon;
grant execute on function public.claim_username(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Requests and friendships
-- ---------------------------------------------------------------------------

-- Internal: make two members friends (idempotent), applying the 200-friend limit to both. Returns false when one of
-- them is at the limit. The caller holds the pair's locks.
create or replace function public.friends_make_friends(p_one uuid, p_two uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_a uuid := least(p_one, p_two);
  v_b uuid := greatest(p_one, p_two);
begin
  if exists (select 1 from public.friendships f where f.user_a = v_a and f.user_b = v_b) then
    return true;
  end if;
  if (select count(*) from public.friendships f where p_one in (f.user_a, f.user_b)) >= 200
     or (select count(*) from public.friendships f where p_two in (f.user_a, f.user_b)) >= 200 then
    return false;
  end if;
  insert into public.friendships (user_a, user_b) values (v_a, v_b);
  return true;
end;
$$;
revoke all on function public.friends_make_friends(uuid, uuid) from public, anon, authenticated;

-- Send a friend request. Returns 'requested', or 'accepted' when that member had already asked me (the two requests
-- meet, so we become friends).
-- Errors: username_required, self_request, user_not_found (also when either has blocked the other, so a block is never
-- revealed), already_friends, already_requested, request_cooldown, request_limit, friend_limit, friends_off,
-- not_signed_in.
create or replace function public.send_friend_request(p_user_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
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
revoke all on function public.send_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;

-- Accept or decline a request sent to me. Declining always works; accepting needs the feature on.
-- Errors: request_not_found, friend_limit, friends_off, not_signed_in.
create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
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
  if public.friends_blocked(v_uid, v_req.sender_id) then
    update public.friend_requests set status = 'declined', responded_at = now() where id = v_req.id;
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
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

-- Withdraw a request I sent. Always works.
create or replace function public.cancel_friend_request(p_request_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return false;
  end if;
  update public.friend_requests set status = 'cancelled', responded_at = now()
  where id = p_request_id and sender_id = v_uid and status = 'pending';
  return found;
end;
$$;
revoke all on function public.cancel_friend_request(uuid) from public, anon;
grant execute on function public.cancel_friend_request(uuid) to authenticated;

-- Remove a friend. Always works; nothing more is shared from that moment. The other member isn't told.
create or replace function public.remove_friend(p_user_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or p_user_id is null then
    return false;
  end if;
  delete from public.friendships f where f.user_a = least(v_uid, p_user_id) and f.user_b = greatest(v_uid, p_user_id);
  return found;
end;
$$;
revoke all on function public.remove_friend(uuid) from public, anon;
grant execute on function public.remove_friend(uuid) to authenticated;

-- Block a member. Always works. Ends the friendship, closes any request between the two, and ends an accountability
-- partnership between them (with its share settings and encouragements). From then on neither finds the other in
-- search and requests between them are refused as "not found". The blocked member isn't told.
create or replace function public.block_user(p_user_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_a uuid;
  v_b uuid;
  v_partnership uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_user_id is null or p_user_id = v_uid or not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'user_not_found';
  end if;
  v_a := least(v_uid, p_user_id);
  v_b := greatest(v_uid, p_user_id);
  insert into public.user_blocks (blocker_id, blocked_id) values (v_uid, p_user_id) on conflict do nothing;
  delete from public.friendships f where f.user_a = v_a and f.user_b = v_b;
  update public.friend_requests r
    set status = case when r.sender_id = v_uid then 'cancelled' else 'declined' end, responded_at = now()
  where r.status = 'pending' and least(r.sender_id, r.recipient_id) = v_a and greatest(r.sender_id, r.recipient_id) = v_b;
  for v_partnership in
    update public.accountability_partnerships p set status = 'ended', ended_at = now()
    where p.user_a = v_a and p.user_b = v_b and p.status = 'active'
    returning p.id
  loop
    delete from public.accountability_shares where partnership_id = v_partnership;
    delete from public.accountability_nudges where partnership_id = v_partnership;
  end loop;
  return true;
end;
$$;
revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(p_user_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or p_user_id is null then
    return false;
  end if;
  delete from public.user_blocks b where b.blocker_id = v_uid and b.blocked_id = p_user_id;
  return found;
end;
$$;
revoke all on function public.unblock_user(uuid) from public, anon;
grant execute on function public.unblock_user(uuid) to authenticated;

-- Report a member to the administrators. Always works. One open report per pair (a repeat returns the open one).
-- Errors: user_not_found, unknown_reason, details_too_long, report_limit, not_signed_in.
create or replace function public.report_user(p_user_id uuid, p_reason text, p_details text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_user_id is null or p_user_id = v_uid or not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'user_not_found';
  end if;
  if p_reason is null or p_reason not in ('harassment', 'inappropriate_name', 'impersonation', 'spam', 'other') then
    raise exception 'unknown_reason';
  end if;
  if char_length(coalesce(v_details, '')) > 500 then
    raise exception 'details_too_long';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('friends-report:' || v_uid::text, 0));
  select r.id into v_id from public.user_reports r
  where r.reporter_id = v_uid and r.reported_id = p_user_id and r.status = 'open';
  if v_id is not null then
    return v_id;
  end if;
  if (select count(*) from public.user_reports r where r.reporter_id = v_uid and r.created_at > now() - interval '24 hours') >= 5 then
    raise exception 'report_limit';
  end if;
  insert into public.user_reports (reporter_id, reported_id, reason, details)
  values (v_uid, p_user_id, p_reason, v_details)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.report_user(uuid, text, text) from public, anon;
grant execute on function public.report_user(uuid, text, text) to authenticated;

-- Use a friend's invite link: the inviter asked for this, so the two become friends at once and the code is used up.
-- Returns the inviter's user id.
-- Errors: invite_not_found (also when either has blocked the other), invite_used, invite_expired, own_invite,
-- username_required, already_friends, friend_limit, friends_off, not_signed_in.
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
  select * into v_inv from public.friend_invites i
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

-- ---------------------------------------------------------------------------
-- Reading other members: only through these three functions
-- ---------------------------------------------------------------------------

-- Find members by the start of their username (at least 3 characters; up to 10 results). Returns the username and how
-- I relate to them, nothing else: no display name, no email, no activity. Never returns me, members who turned search
-- off, or anyone blocked in either direction.
create or replace function public.search_users(p_query text)
returns table (user_id uuid, username text, relation text)
language plpgsql
stable
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

-- Internal: a member's completed workouts in their last 7 days and their day and week streaks, in their own time
-- zone (the same rules as accountability_summary and src/lib/domain/streak.ts). Only friend_profile() calls it.
create or replace function public.friends_workout_stats(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz text;
  v_today date;
  v_last7 int;
  v_days int;
  v_weeks int;
begin
  select pr.timezone into v_tz from public.profiles pr where pr.id = p_user_id;
  begin
    v_today := (now() at time zone coalesce(v_tz, 'UTC'))::date;
  exception when others then
    v_tz := 'UTC';
    v_today := (now() at time zone 'UTC')::date;
  end;
  v_tz := coalesce(v_tz, 'UTC');
  select count(*) into v_last7 from public.workout_sessions w
  where w.user_id = p_user_id and w.status = 'completed'
    and w.started_at >= now() - interval '9 days'
    and (w.started_at at time zone v_tz)::date between v_today - 6 and v_today;
  with days as (
    select distinct (w.started_at at time zone v_tz)::date as d
    from public.workout_sessions w
    where w.user_id = p_user_id and w.status = 'completed' and w.started_at >= now() - interval '400 days'
  ),
  dg as (
    select d, d - (row_number() over (order by d))::int as g from days where d <= v_today
  ),
  start_day as (
    select case when exists (select 1 from dg where d = v_today) then v_today else v_today - 1 end as d
  ),
  weeks as (
    select distinct date_trunc('week', d)::date as w from dg
  ),
  wg as (
    select w, w - 7 * (row_number() over (order by w))::int as g from weeks
  ),
  start_week as (
    select case when exists (select 1 from wg where w = date_trunc('week', v_today)::date)
      then date_trunc('week', v_today)::date else date_trunc('week', v_today)::date - 7 end as w
  )
  select
    (select count(*) from dg where dg.g = (select dg2.g from dg dg2 join start_day s on dg2.d = s.d)),
    (select count(*) from wg where wg.g = (select wg2.g from wg wg2 join start_week s on wg2.w = s.w))
  into v_days, v_weeks;
  return jsonb_build_object('workouts_last_7_days', coalesce(v_last7, 0), 'streak_days', coalesce(v_days, 0), 'streak_weeks', coalesce(v_weeks, 0));
end;
$$;
revoke all on function public.friends_workout_stats(uuid) from public, anon, authenticated;

-- Everything the Friends screen lists, in one read: my friends (username, display name, since), requests to me and
-- from me (username only: a display name is shown between friends only), and members I blocked. Null while the
-- feature is off or when not signed in.
create or replace function public.friends_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.friends_enabled() then
    return null;
  end if;
  return jsonb_build_object(
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', o.other, 'username', sp.username,
        'display_name', coalesce(nullif(btrim(pr.display_name), ''), sp.username), 'since', o.created_at
      ) order by sp.username)
      from (select case when f.user_a = v_uid then f.user_b else f.user_a end as other, f.created_at
            from public.friendships f where v_uid in (f.user_a, f.user_b)) o
      join public.social_profiles sp on sp.user_id = o.other
      left join public.profiles pr on pr.id = o.other
    ), '[]'::jsonb),
    'incoming', coalesce((
      select jsonb_agg(jsonb_build_object('request_id', r.id, 'user_id', r.sender_id, 'username', sp.username, 'at', r.created_at) order by r.created_at desc)
      from public.friend_requests r join public.social_profiles sp on sp.user_id = r.sender_id
      where r.recipient_id = v_uid and r.status = 'pending' and not public.friends_blocked(v_uid, r.sender_id)
    ), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(jsonb_build_object('request_id', r.id, 'user_id', r.recipient_id, 'username', sp.username, 'at', r.created_at) order by r.created_at desc)
      from public.friend_requests r join public.social_profiles sp on sp.user_id = r.recipient_id
      where r.sender_id = v_uid and r.status = 'pending'
    ), '[]'::jsonb),
    'blocked', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', b.blocked_id, 'username', sp.username, 'at', b.created_at) order by b.created_at desc)
      from public.user_blocks b left join public.social_profiles sp on sp.user_id = b.blocked_id
      where b.blocker_id = v_uid
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.friends_overview() from public, anon;
grant execute on function public.friends_overview() to authenticated;

-- What a friend has chosen to let me see. Null for anyone who isn't my friend, when either has blocked the other, or
-- while the feature is off. Keys appear only for what the friend shares:
--   user_id, username, display_name, since     always, between friends
--   profile_visible                            false: nothing below is present
--   workouts_last_7_days, streak_days, streak_weeks     show_workouts
-- Weight, measurements, nutrition and Faith activity are not returned by this version at all, whatever the switches.
create or replace function public.friend_profile(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sp public.social_profiles;
  v_since timestamptz;
  v_name text;
  v_out jsonb;
begin
  if v_uid is null or p_user_id is null or not public.friends_enabled() then
    return null;
  end if;
  select f.created_at into v_since from public.friendships f
  where f.user_a = least(v_uid, p_user_id) and f.user_b = greatest(v_uid, p_user_id);
  if v_since is null or public.friends_blocked(v_uid, p_user_id) then
    return null;
  end if;
  select * into v_sp from public.social_profiles sp where sp.user_id = p_user_id;
  if not found then
    return null;
  end if;
  select pr.display_name into v_name from public.profiles pr where pr.id = p_user_id;
  v_out := jsonb_build_object(
    'user_id', p_user_id, 'username', v_sp.username,
    'display_name', coalesce(nullif(btrim(v_name), ''), v_sp.username),
    'since', v_since, 'profile_visible', v_sp.profile_visible
  );
  if not v_sp.profile_visible then
    return v_out;
  end if;
  if v_sp.show_workouts then
    v_out := v_out || public.friends_workout_stats(p_user_id);
  end if;
  return v_out;
end;
$$;
revoke all on function public.friend_profile(uuid) from public, anon;
grant execute on function public.friend_profile(uuid) to authenticated;

-- For administrators only (refused inside for anyone else): the reports with both members' usernames, newest open
-- first. Members' Friends rows are not readable by administrators through the tables; this is the one place the
-- usernames of a reporter and a reported member are shown to them.
create or replace function public.admin_user_reports(p_status text default 'open')
returns table (id uuid, reporter_id uuid, reporter_username text, reported_id uuid, reported_username text, reason text, details text, status text, admin_note text, created_at timestamptz, reviewed_at timestamptz, open_reports_against bigint)
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
  select r.id, r.reporter_id, a.username, r.reported_id, b.username, r.reason, r.details, r.status, r.admin_note, r.created_at, r.reviewed_at,
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
