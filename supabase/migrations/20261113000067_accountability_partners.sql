-- ROLLBACK (removes accountability partners only; workouts, programs, food, sleep, journal and every other table untouched):
--   drop function if exists public.send_accountability_nudge(uuid, text);
--   drop function if exists public.end_accountability_partnership(uuid);
--   drop function if exists public.accept_accountability_invite(text);
--   drop function if exists public.accountability_summary(uuid);
--   drop table if exists public.accountability_nudges;
--   drop table if exists public.accountability_shares;
--   drop table if exists public.accountability_partnerships;
--   drop table if exists public.accountability_invites;
--   drop function if exists public.accountability_can_invite();
--   drop function if exists public.accountability_enabled();
--   delete from public.feature_flags where key = 'accountability_partners';
-- Roll back the app code first: /profile/accountability reads and writes these tables.
--
-- Accountability partners (opt-in). A member shares an invite code; whoever enters it becomes their partner. Each
-- member chooses, per partner, what the other sees: a count of workouts in the last 7 days, their workout streak, and
-- (off by default) their active program and week. The partner never reads workout rows: only
-- accountability_summary() below, which returns the chosen numbers and nothing else. Never shared: food, weight, sleep,
-- body scans, photos, prayer and journal, AI coach chats. Either member can end it at any time; sharing stops at once.
--
-- It is OFF: the flag below is inserted disabled, the app shows no entry point and the page 404s (src/server/flags.ts
-- `isFlagOn`, which treats a missing flag as off), and the database itself refuses new invites, partnerships, nudges
-- and summaries while the flag is off. Ending a partnership always works.
--
-- Limits: at most 3 active partners per member; invite codes are random, single use and expire after 7 days; at most
-- 5 open invites per member; at most 3 encouragements (from a fixed list, no free text) per sender per partnership in
-- any 24 hours.

insert into public.feature_flags (key, enabled, description)
values ('accountability_partners', false, 'Accountability partners: invite up to 3 partners and share workout counts, streak and (optionally) program progress. Off until the owner approves it (and the privacy policy is updated).')
on conflict (key) do nothing;

create or replace function public.accountability_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select f.enabled from public.feature_flags f where f.key = 'accountability_partners'), false);
$$;
revoke all on function public.accountability_enabled() from public, anon;
grant execute on function public.accountability_enabled() to authenticated;

create table if not exists public.accountability_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users (id) on delete cascade,
  -- 10 characters from a 32-letter alphabet without look-alikes (no I, O, 0 or 1): about 10^15 possible codes.
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  check (expires_at <= created_at + interval '7 days')
);
create index if not exists accountability_invites_inviter on public.accountability_invites (inviter_id, created_at desc);

create table if not exists public.accountability_partnerships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  -- Ordered pair: one row per pair, and never a partnership with yourself.
  check (user_a < user_b),
  check ((status = 'ended') = (ended_at is not null))
);
-- One active partnership per pair (a pair that ended can partner again later).
create unique index if not exists accountability_partnerships_active_pair on public.accountability_partnerships (user_a, user_b) where status = 'active';
create index if not exists accountability_partnerships_user_b on public.accountability_partnerships (user_b);

create table if not exists public.accountability_shares (
  partnership_id uuid not null references public.accountability_partnerships (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  share_workouts boolean not null default true,
  share_streak boolean not null default true,
  share_program_progress boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (partnership_id, user_id)
);
create index if not exists accountability_shares_user on public.accountability_shares (user_id);
drop trigger if exists accountability_shares_updated_at on public.accountability_shares;
create trigger accountability_shares_updated_at before update on public.accountability_shares
  for each row execute function public.set_updated_at();

create table if not exists public.accountability_nudges (
  id uuid primary key default gen_random_uuid(),
  partnership_id uuid not null references public.accountability_partnerships (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  -- A fixed set of short messages (src/lib/domain/accountability.ts NUDGE_MESSAGES): no free text to moderate.
  message_key text not null check (message_key in ('proud', 'keep_going', 'lets_train', 'rest_well', 'praying', 'be_strong')),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index if not exists accountability_nudges_sender on public.accountability_nudges (partnership_id, sender_id, created_at desc);
create index if not exists accountability_nudges_sender_user on public.accountability_nudges (sender_id);
create index if not exists accountability_nudges_recipient on public.accountability_nudges (recipient_id, created_at desc);

alter table public.accountability_invites enable row level security;
alter table public.accountability_partnerships enable row level security;
alter table public.accountability_shares enable row level security;
alter table public.accountability_nudges enable row level security;

-- Whether the signed-in member may create another invite: the feature is on and they have fewer than 5 open codes.
-- (A function, so the insert policy doesn't query its own table under RLS.)
create or replace function public.accountability_can_invite()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.accountability_enabled()
    and (select count(*) from public.accountability_invites i
         where i.inviter_id = auth.uid() and i.used_at is null and i.expires_at > now()) < 5;
$$;
revoke all on function public.accountability_can_invite() from public, anon;
grant execute on function public.accountability_can_invite() to authenticated;

-- Invites: the inviter reads, creates (code only: expiry and use are set by the database) and withdraws their own.
drop policy if exists accountability_invites_select_own on public.accountability_invites;
create policy accountability_invites_select_own on public.accountability_invites for select to authenticated
  using (inviter_id = (select auth.uid()));
drop policy if exists accountability_invites_insert_own on public.accountability_invites;
create policy accountability_invites_insert_own on public.accountability_invites for insert to authenticated
  with check (inviter_id = (select auth.uid()) and public.accountability_can_invite());
drop policy if exists accountability_invites_delete_own on public.accountability_invites;
create policy accountability_invites_delete_own on public.accountability_invites for delete to authenticated
  using (inviter_id = (select auth.uid()));
revoke insert, update on public.accountability_invites from authenticated, anon;
grant insert (inviter_id, code) on public.accountability_invites to authenticated;

-- Partnerships: members read the ones they are in. Created only by accept_accountability_invite and ended only by
-- end_accountability_partnership (no insert, update or delete policies).
drop policy if exists accountability_partnerships_select_member on public.accountability_partnerships;
create policy accountability_partnerships_select_member on public.accountability_partnerships for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

-- Share settings: both members of an active partnership see both rows (what each has chosen to share); each member
-- changes only their own row, and only the three switches.
drop policy if exists accountability_shares_select_member on public.accountability_shares;
create policy accountability_shares_select_member on public.accountability_shares for select to authenticated
  using (exists (
    select 1 from public.accountability_partnerships p
    where p.id = partnership_id and p.status = 'active' and (select auth.uid()) in (p.user_a, p.user_b)
  ));
drop policy if exists accountability_shares_update_own on public.accountability_shares;
create policy accountability_shares_update_own on public.accountability_shares for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.accountability_partnerships p where p.id = partnership_id and p.status = 'active')
  )
  with check (user_id = (select auth.uid()));
revoke insert, update, delete on public.accountability_shares from authenticated, anon;
grant update (share_workouts, share_streak, share_program_progress) on public.accountability_shares to authenticated;

-- Encouragements: sender and recipient read them while the partnership is active. Sent only through
-- send_accountability_nudge (which applies the daily limit).
drop policy if exists accountability_nudges_select_member on public.accountability_nudges;
create policy accountability_nudges_select_member on public.accountability_nudges for select to authenticated
  using (
    (select auth.uid()) in (sender_id, recipient_id)
    and exists (select 1 from public.accountability_partnerships p where p.id = partnership_id and p.status = 'active')
  );
revoke insert, update, delete on public.accountability_nudges from authenticated, anon;

-- What a member's partner has chosen to share with them, as numbers only. Null for anyone who isn't in this active
-- partnership (or while the feature is off). Keys appear only for what the partner shares:
--   partner_name                       always (their display name, so the member knows who this is)
--   workouts_last_7_days               share_workouts: completed workouts in the partner's last 7 days
--   streak_days, streak_weeks          share_streak: consecutive training days / Monday-based weeks
--   program {name, week, weeks}|null   share_program_progress: active program (a member-made program shows as
--                                      "Custom program"), current week and length
create or replace function public.accountability_summary(p_partnership_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_partner uuid;
  v_share public.accountability_shares;
  v_name text;
  v_tz text;
  v_today date;
  v_out jsonb;
  v_days int;
  v_weeks int;
  v_program jsonb;
begin
  if v_uid is null or not public.accountability_enabled() then
    return null;
  end if;
  select case when p.user_a = v_uid then p.user_b else p.user_a end into v_partner
  from public.accountability_partnerships p
  where p.id = p_partnership_id and p.status = 'active' and v_uid in (p.user_a, p.user_b);
  if v_partner is null then
    return null;
  end if;
  select * into v_share from public.accountability_shares s where s.partnership_id = p_partnership_id and s.user_id = v_partner;
  select pr.display_name, pr.timezone into v_name, v_tz from public.profiles pr where pr.id = v_partner;
  begin
    v_today := (now() at time zone coalesce(v_tz, 'UTC'))::date;
  exception when others then
    v_tz := 'UTC';
    v_today := (now() at time zone 'UTC')::date;
  end;
  v_tz := coalesce(v_tz, 'UTC');
  v_out := jsonb_build_object('partner_name', coalesce(nullif(btrim(v_name), ''), 'Your partner'));

  if coalesce(v_share.share_workouts, false) then
    v_out := v_out || jsonb_build_object('workouts_last_7_days', (
      select count(*) from public.workout_sessions w
      where w.user_id = v_partner and w.status = 'completed'
        and w.started_at >= now() - interval '9 days'
        and (w.started_at at time zone v_tz)::date between v_today - 6 and v_today
    ));
  end if;

  if coalesce(v_share.share_streak, false) then
    -- Streaks over the last year of training. A day streak runs to today or yesterday; the current week counts once
    -- trained and an unfinished week doesn't break the week streak (as src/lib/domain/streak.ts).
    with days as (
      select distinct (w.started_at at time zone v_tz)::date as d
      from public.workout_sessions w
      where w.user_id = v_partner and w.status = 'completed' and w.started_at >= now() - interval '400 days'
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
    v_out := v_out || jsonb_build_object('streak_days', coalesce(v_days, 0), 'streak_weeks', coalesce(v_weeks, 0));
  end if;

  if coalesce(v_share.share_program_progress, false) then
    select jsonb_build_object(
      'name', case when tp.owner_id is null and tp.is_published then tp.name else 'Custom program' end,
      'week', least(up.current_week, tp.duration_weeks),
      'weeks', tp.duration_weeks
    ) into v_program
    from public.user_programs up
    join public.training_programs tp on tp.id = up.program_id
    where up.user_id = v_partner and up.status = 'active'
    limit 1;
    v_out := v_out || jsonb_build_object('program', v_program);
  end if;

  return v_out;
end;
$$;
revoke all on function public.accountability_summary(uuid) from public, anon;
grant execute on function public.accountability_summary(uuid) to authenticated;

-- Accept a partner's invite code: creates the partnership (with default share settings for both) and uses up the code.
-- Errors (the message is the reason): invite_not_found, invite_used, invite_expired, own_invite, already_partners,
-- partner_limit (you have 3), inviter_partner_limit (they have 3), accountability_off, not_signed_in.
create or replace function public.accept_accountability_invite(p_code text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
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
  if not found then
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
revoke all on function public.accept_accountability_invite(text) from public, anon;
grant execute on function public.accept_accountability_invite(text) to authenticated;

-- End a partnership (either member, any time, even while the feature is off). Sharing stops immediately: the share
-- settings and encouragements are deleted; the ended partnership stays visible to its two members only.
create or replace function public.end_accountability_partnership(p_partnership_id uuid)
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
  update public.accountability_partnerships p set status = 'ended', ended_at = now()
  where p.id = p_partnership_id and p.status = 'active' and v_uid in (p.user_a, p.user_b);
  if not found then
    return false;
  end if;
  delete from public.accountability_shares where partnership_id = p_partnership_id;
  delete from public.accountability_nudges where partnership_id = p_partnership_id;
  return true;
end;
$$;
revoke all on function public.end_accountability_partnership(uuid) from public, anon;
grant execute on function public.end_accountability_partnership(uuid) to authenticated;

-- Send one of the fixed encouragements to the partner: at most 3 per sender per partnership in any 24 hours.
-- Errors: not_partners, nudge_limit, unknown_message, accountability_off, not_signed_in.
create or replace function public.send_accountability_nudge(p_partnership_id uuid, p_message_key text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_partner uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.accountability_enabled() then
    raise exception 'accountability_off';
  end if;
  if p_message_key is null or p_message_key not in ('proud', 'keep_going', 'lets_train', 'rest_well', 'praying', 'be_strong') then
    raise exception 'unknown_message';
  end if;
  select case when p.user_a = v_uid then p.user_b else p.user_a end into v_partner
  from public.accountability_partnerships p
  where p.id = p_partnership_id and p.status = 'active' and v_uid in (p.user_a, p.user_b)
  for update;
  if v_partner is null then
    raise exception 'not_partners';
  end if;
  if (select count(*) from public.accountability_nudges n
      where n.partnership_id = p_partnership_id and n.sender_id = v_uid and n.created_at > now() - interval '24 hours') >= 3 then
    raise exception 'nudge_limit';
  end if;
  insert into public.accountability_nudges (partnership_id, sender_id, recipient_id, message_key)
  values (p_partnership_id, v_uid, v_partner, p_message_key)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.send_accountability_nudge(uuid, text) from public, anon;
grant execute on function public.send_accountability_nudge(uuid, text) to authenticated;
