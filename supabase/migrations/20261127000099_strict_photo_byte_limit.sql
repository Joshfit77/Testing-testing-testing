-- Photo byte limits enforced exactly: stored bytes plus the new file may not pass the limit.
--
-- Until now the byte rule asked only "is the member under the limit before this file?" (migrations 086, 088, 097), so
-- the last upload could end up to one file (8 MB) over 1 GiB (progress photos) or 2 GiB (Body Scan). Measured on the
-- local storage server: the row the storage service really writes (as its own privileged user, after the file is
-- stored) carries the file's size in metadata, and refusing that row rolls the whole upload back. (The earlier
-- permission check that runs as the member has no size; that is why the storage policy can't do this.)
--
-- 1. The quota triggers (where installed) now refuse a file that would take the member past the byte limit, counting
--    its real size. Only the trigger functions are replaced, so this needs no TRIGGER privilege; where the triggers
--    aren't installed it changes nothing.
-- 2. reserve_storage_upload takes the file's size (p_bytes, optional): the app passes it, and a reservation is refused
--    when stored bytes, plus every pending reservation at the largest allowed file, plus this file would pass the
--    limit. On a project without the triggers that is exact for the app; a client that declares a smaller size than
--    it sends can still end at most one file (8 MB) over, once, and is refused from then on.
--
-- Rollback: re-run the enforce_* function definitions from migrations 086 and 088, drop
-- public.reserve_storage_upload(text, text, bigint), and re-run the reserve_storage_upload definition from 097.

-- 1. Exact byte check on the row actually written.
create or replace function public.enforce_progress_photo_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_usage record;
  v_size bigint := greatest(coalesce((new.metadata ->> 'size')::bigint, 0), 1);
begin
  begin
    v_user := split_part(new.name, '/', 1)::uuid;
  exception when invalid_text_representation then
    raise exception 'progress photo limit: not in a member folder' using errcode = '42501';
  end;
  perform pg_advisory_xact_lock(hashtextextended('ngf.progress_photos:' || v_user::text, 0));
  select * into v_usage from public.storage_folder_usage('progress-photos', v_user);
  if v_usage.files >= 500 or v_usage.today >= 30 or v_usage.bytes + v_size > 1073741824 then
    raise exception 'progress photo limit reached (new row violates row-level security policy)' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_progress_photo_quota() from public, anon, authenticated;

create or replace function public.enforce_body_scan_photo_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_usage record;
  v_size bigint := greatest(coalesce((new.metadata ->> 'size')::bigint, 0), 1);
begin
  begin
    v_user := split_part(new.name, '/', 1)::uuid;
  exception when invalid_text_representation then
    raise exception 'body scan photo limit: not in a member folder' using errcode = '42501';
  end;
  perform pg_advisory_xact_lock(hashtextextended('ngf.body_scan_photos:' || v_user::text, 0));
  select * into v_usage from public.storage_folder_usage('body-scans', v_user);
  if v_usage.files >= 750 or v_usage.today >= 30 or v_usage.bytes + v_size > 2147483648 then
    raise exception 'body scan photo limit reached (new row violates row-level security policy)' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_body_scan_photo_quota() from public, anon, authenticated;

-- 2. Reservations that know the file's size.
drop function if exists public.reserve_storage_upload(text, text);
create or replace function public.reserve_storage_upload(p_bucket text, p_name text, p_bytes bigint default null)
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
  v_size bigint;
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
  select coalesce(b.file_size_limit, 8388608) into v_file_bytes from storage.buckets b where b.id = p_bucket;
  v_file_bytes := coalesce(v_file_bytes, 8388608);
  if p_bytes is not null and (p_bytes < 0 or p_bytes > v_file_bytes) then
    raise exception 'file larger than this bucket accepts' using errcode = '22023';
  end if;
  -- Unknown size (an older app): at least one byte must fit, as before.
  v_size := greatest(coalesce(p_bytes, 1), 1);

  -- The same per-member lock as the upload triggers (migrations 086, 088), so reservations and uploads take turns.
  perform pg_advisory_xact_lock(hashtextextended(
    case when p_bucket = 'progress-photos' then 'ngf.progress_photos:' else 'ngf.body_scan_photos:' end || v_user::text, 0));

  -- Reservations whose file now exists, or that stopped being usable more than 2 hours ago (no URL signed with them
  -- can still be used; migration 097), no longer hold room.
  delete from public.storage_upload_reservations r
  where r.user_id = v_user and r.bucket_id = p_bucket
    and r.name <> p_name
    and (r.expires_at <= now() - interval '2 hours'
         or exists (select 1 from storage.objects o where o.bucket_id = r.bucket_id and o.name = r.name));

  if exists (select 1 from public.storage_upload_reservations r
             where r.bucket_id = p_bucket and r.name = p_name and r.user_id = v_user and r.expires_at > now()) then
    update public.storage_upload_reservations set expires_at = now() + interval '15 minutes'
    where bucket_id = p_bucket and name = p_name;
    return 'ok';
  end if;

  -- Stored files and pending reservations in one statement (one snapshot; migration 097).
  select u.files, u.today, u.bytes,
         (select count(*) from public.storage_upload_reservations r
          where r.user_id = v_user and r.bucket_id = p_bucket and r.expires_at > now() - interval '2 hours' and r.name <> p_name
            and not exists (select 1 from storage.objects o where o.bucket_id = r.bucket_id and o.name = r.name)) as pending
    into v_usage
    from public.storage_folder_usage(p_bucket, v_user) u;
  v_pending := v_usage.pending;

  if v_usage.files + v_pending >= v_max_files
     or v_usage.today + v_pending >= v_max_day
     or v_usage.bytes + v_pending * v_file_bytes + v_size > v_max_bytes then
    return 'limit';
  end if;

  insert into public.storage_upload_reservations (bucket_id, name, user_id, expires_at)
  values (p_bucket, p_name, v_user, now() + interval '15 minutes')
  on conflict (bucket_id, name) do update
    set user_id = excluded.user_id, expires_at = excluded.expires_at, created_at = now();
  return 'ok';
end;
$$;

comment on function public.reserve_storage_upload(text, text, bigint) is
  'Reserve one progress-photo or Body Scan upload of p_bytes (optional) for the signed-in member while the photo limits have room, counting pending reservations at the largest allowed file: ''ok'' or ''limit''. The storage insert policies require it.';

revoke all on function public.reserve_storage_upload(text, text, bigint) from public, anon;
grant execute on function public.reserve_storage_upload(text, text, bigint) to authenticated;
