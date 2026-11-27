-- ---------------------------------------------------------------------------------------------------------------
-- Smart reminders (Profile → Notifications). Account-level settings for the workout, food and recovery reminders
-- (the Faith ones stay in faith_reminders), shared preferences for every reminder (pause all, quiet hours, a daily
-- limit), and the member's phones, so a choice made on one device follows them and duplicates can be avoided.
-- Everything is off by default; nothing here sends anything: the iPhone / Android app schedules local notifications.
-- Owner-only. No marketing or promotional notification type exists.
-- ---------------------------------------------------------------------------------------------------------------

-- Two more optional Faith reminders: reading-plan progress and prayer follow-up (weekly).
alter table public.faith_reminders drop constraint if exists faith_reminders_kind_check;
alter table public.faith_reminders
  add constraint faith_reminders_kind_check check (kind in ('devotional', 'prayer', 'practices', 'reading', 'challenge', 'fitness',
                                                           'accountability', 'final', 'memorize', 'plan_progress', 'prayer_followup'));

create table public.notification_reminders (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('workout', 'plan_week', 'weekly_review', 'breakfast', 'lunch', 'dinner', 'snack', 'water',
                                     'recovery', 'winddown')),
  enabled boolean not null default false,
  remind_at time not null default '07:00',
  -- JavaScript weekdays: 0 = Sunday … 6 = Saturday.
  weekdays smallint[] not null default '{0,1,2,3,4,5,6}'
    check (cardinality(weekdays) <= 7 and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  -- Water only: every so many minutes until end_at.
  interval_minutes smallint check (interval_minutes in (60, 90, 120, 180, 240)),
  end_at time,
  -- Workout only: the message style.
  style text not null default 'friendly' check (style in ('friendly', 'faith')),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind),
  check (kind = 'water' or (interval_minutes is null and end_at is null)),
  check (kind <> 'water' or end_at is null or end_at > remind_at)
);
create trigger notification_reminders_updated_at before update on public.notification_reminders
  for each row execute function public.set_updated_at();

create table public.notification_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- "Pause all optional reminders": choices are kept, nothing is scheduled.
  paused boolean not null default false,
  -- No reminder of any kind is scheduled between these local times. Null: no quiet hours.
  quiet_start time,
  quiet_end time,
  -- The most optional reminders on any one day.
  daily_limit smallint not null default 8 check (daily_limit between 1 and 20),
  updated_at timestamptz not null default now(),
  check ((quiet_start is null) = (quiet_end is null))
);
create trigger notification_prefs_updated_at before update on public.notification_prefs
  for each row execute function public.set_updated_at();

-- Quiet hours chosen for Faith reminders now apply to every reminder: carry them over.
insert into public.notification_prefs (user_id, quiet_start, quiet_end)
select user_id, quiet_start, quiet_end from public.faith_reminder_prefs where quiet_start is not null
on conflict (user_id) do nothing;

create table public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- A random id the app keeps on the phone (not a hardware identifier).
  device_key text not null check (device_key ~ '^[A-Za-z0-9-]{16,64}$'),
  platform text not null check (platform in ('ios', 'android')),
  label text not null check (char_length(label) between 1 and 60),
  -- Whether this phone shows the member's reminders (turn one off to avoid duplicates on two phones).
  delivers boolean not null default true,
  timezone text check (char_length(timezone) <= 64),
  permission text not null default 'unknown' check (permission in ('granted', 'denied', 'prompt', 'unknown')),
  last_sync_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, device_key)
);
create index notification_devices_user_idx on public.notification_devices (user_id, last_sync_at desc);

alter table public.notification_reminders enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.notification_devices enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['notification_reminders', 'notification_prefs', 'notification_devices'] loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t || '_delete_own', t);
  end loop;
end $$;

-- At most 10 phones per member: the oldest is forgotten when an 11th checks in.
create or replace function public.notification_devices_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notification_devices
  where user_id = new.user_id
    and id in (select id from public.notification_devices where user_id = new.user_id order by last_sync_at desc offset 10);
  return null;
end $$;
revoke all on function public.notification_devices_limit() from public, anon, authenticated;
create trigger notification_devices_limit after insert on public.notification_devices
  for each row execute function public.notification_devices_limit();

comment on table public.notification_reminders is 'Optional workout, food, water and recovery reminder settings (off by default). Owner-only.';
comment on table public.notification_prefs is 'Reminder preferences for every reminder: pause all, quiet hours, daily limit. Owner-only.';
comment on table public.notification_devices is 'The member''s phones that schedule reminders, and whether each one shows them. Owner-only.';
comment on table public.faith_reminder_prefs is 'Superseded by notification_prefs (quiet hours now apply to every reminder); kept, not read.';
