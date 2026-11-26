-- Photo upload limits that hold under simultaneous uploads without storage triggers, and no more overwriting.
--
-- Progress photos (migration 086) and Body Scan photos (088) are limited per member: count, uploads in the last 24 hours
-- and bytes. The storage insert policy checks the limit, but the storage service evaluates policies in a transaction it
-- rolls back, so a burst of simultaneous uploads all see the same count (measured: 60 at once let 36 through a limit of
-- 30). Those migrations closed the gap with a trigger on storage.objects that locks and counts again. A hosted project
-- may not allow triggers on storage.objects (the migration then only warns), and the gap reopens there.
--
-- Fix, without any trigger: an upload needs a reservation, taken through reserve_storage_upload() BEFORE the upload.
-- That function runs in a real, committed transaction: it takes the member's lock (the same lock the triggers use),
-- counts stored files PLUS reservations not yet uploaded, and records the reservation only while there is room. The
-- storage insert policies now also require a live reservation for exactly that file name. Simultaneous uploads
-- therefore take turns at the reservation, and a burst can't get more reservations than the limit allows.
-- The triggers stay where they are installed (a second, independent check).
--
-- Bytes: a reservation counts as the bucket's largest allowed file (8 MB) until its file exists, so concurrent uploads
-- can't jointly pass the byte limit either. With nothing pending, the rule is exactly the old one.
--
-- Overwriting: progress photos had an UPDATE policy on storage.objects (own folder). The limit only looked at NEW
-- files, so a member could upload small files and then replace them with large ones, past the 1 GiB limit. The app
-- never replaces a file (every upload uses a new name with upsert off), so the policy is removed. Body Scan photos
-- never had one. Nothing stored is changed.
--
-- Deploy order: the web app first (it reserves before uploading and carries on without a reservation while this
-- function doesn't exist yet), then this migration. Applied first, uploads from a page loaded before the web deploy
-- are refused with the usual "couldn't upload" message until the page reloads.
--
-- Rollback: restore the two insert policies from migrations 086 and 088 and the update policy from 017, then
-- drop function public.reserve_storage_upload(text, text), public.has_upload_reservation(text, text),
-- public.storage_folder_usage(text, uuid) and table public.storage_upload_reservations.

create table if not exists public.storage_upload_reservations (
  bucket_id text not null,
  name text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (bucket_id, name)
);
create index if not exists storage_upload_reservations_user_idx
  on public.storage_upload_reservations (user_id, bucket_id, expires_at);

comment on table public.storage_upload_reservations is
  'A member''s right to upload one named photo, taken under the member''s lock while the photo limits had room. Read only by the storage policies through has_upload_reservation(); no direct access.';

alter table public.storage_upload_reservations enable row level security;
revoke all on table public.storage_upload_reservations from public, anon, authenticated;

-- Stored files in one member's folder of a photo bucket, through the (bucket_id, name) index.
create or replace function public.storage_folder_usage(p_bucket text, p_user uuid,
  out files bigint, out today bigint, out bytes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*),
         count(*) filter (where o.created_at > now() - interval '24 hours'),
         coalesce(sum(coalesce((o.metadata ->> 'size')::bigint, 0)), 0)
  from storage.objects o
  where o.bucket_id = p_bucket
    and o.name collate "C" >= (p_user::text || '/')
    and o.name collate "C" < (p_user::text || '0');
$$;
revoke all on function public.storage_folder_usage(text, uuid) from public, anon, authenticated;

-- 'ok' when the signed-in member may upload the file `p_name` to `p_bucket` (and it is now reserved for 15 minutes),
-- 'limit' when one of the photo limits is reached. Taking the same reservation again (a retry) refreshes it.
create or replace function public.reserve_storage_upload(p_bucket text, p_name text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_max_files bigint;
  v_max_bytes bigint;
  v_max_day bigint := 30;
  v_file_bytes bigint;
  v_usage record;
  v_pending bigint;
begin
  if v_user is null then
    raise exception 'sign in to upload' using errcode = '42501';
  end if;
  if p_bucket = 'progress-photos' then
    v_max_files := 500;
    v_max_bytes := 1073741824;
  elsif p_bucket = 'body-scans' then
    v_max_files := 750;
    v_max_bytes := 2147483648;
  else
    raise exception 'uploads to this bucket need no reservation' using errcode = '22023';
  end if;
  if p_name is null or length(p_name) > 300 or split_part(p_name, '/', 1) <> v_user::text
     or position('..' in p_name) > 0 or right(p_name, 1) = '/' then
    raise exception 'not a file in your own folder' using errcode = '42501';
  end if;

  -- The same per-member lock as the upload triggers (migrations 086, 088), so reservations and uploads take turns.
  perform pg_advisory_xact_lock(hashtextextended(
    case when p_bucket = 'progress-photos' then 'ngf.progress_photos:' else 'ngf.body_scan_photos:' end || v_user::text, 0));

  -- Expired reservations and ones whose file now exists no longer hold room.
  delete from public.storage_upload_reservations r
  where r.user_id = v_user and r.bucket_id = p_bucket
    and r.name <> p_name
    and (r.expires_at <= now()
         or exists (select 1 from storage.objects o where o.bucket_id = r.bucket_id and o.name = r.name));

  if exists (select 1 from public.storage_upload_reservations r
             where r.bucket_id = p_bucket and r.name = p_name and r.user_id = v_user and r.expires_at > now()) then
    update public.storage_upload_reservations set expires_at = now() + interval '15 minutes'
    where bucket_id = p_bucket and name = p_name;
    return 'ok';
  end if;

  select * into v_usage from public.storage_folder_usage(p_bucket, v_user);
  select count(*) into v_pending from public.storage_upload_reservations r
  where r.user_id = v_user and r.bucket_id = p_bucket and r.expires_at > now() and r.name <> p_name;
  select coalesce(b.file_size_limit, 8388608) into v_file_bytes from storage.buckets b where b.id = p_bucket;
  v_file_bytes := coalesce(v_file_bytes, 8388608);

  if v_usage.files + v_pending >= v_max_files
     or v_usage.today + v_pending >= v_max_day
     or v_usage.bytes + v_pending * v_file_bytes >= v_max_bytes then
    return 'limit';
  end if;

  insert into public.storage_upload_reservations (bucket_id, name, user_id, expires_at)
  values (p_bucket, p_name, v_user, now() + interval '15 minutes')
  on conflict (bucket_id, name) do update
    set user_id = excluded.user_id, expires_at = excluded.expires_at, created_at = now();
  return 'ok';
end;
$$;

comment on function public.reserve_storage_upload(text, text) is
  'Reserve one progress-photo or Body Scan upload for the signed-in member while the photo limits have room (counting other reservations not yet uploaded): ''ok'' or ''limit''. The storage insert policies require it.';

revoke all on function public.reserve_storage_upload(text, text) from public, anon;
grant execute on function public.reserve_storage_upload(text, text) to authenticated;

-- For the storage policies: the signed-in member holds a live reservation for this exact file.
create or replace function public.has_upload_reservation(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.storage_upload_reservations r
    where r.bucket_id = p_bucket and r.name = p_name
      and r.user_id = (select auth.uid()) and r.expires_at > now()
  );
$$;
revoke all on function public.has_upload_reservation(text, text) from public, anon;
grant execute on function public.has_upload_reservation(text, text) to authenticated, service_role;

drop policy if exists progress_photos_owner_insert on storage.objects;
create policy progress_photos_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.can_add_progress_photo()
    and public.has_upload_reservation(bucket_id, name)
  );

drop policy if exists body_scans_owner_insert on storage.objects;
create policy body_scans_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'body-scans'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.can_add_body_scan()
    and public.can_add_body_scan_photo()
    and public.has_upload_reservation(bucket_id, name)
  );

drop policy if exists progress_photos_owner_update on storage.objects;
