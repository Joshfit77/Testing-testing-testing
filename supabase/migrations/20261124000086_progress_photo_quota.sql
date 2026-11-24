-- Progress photos: a per-member upload limit, enforced by the database itself (a direct API call can't skip it).
--
-- Photos go from the device straight to the private "progress-photos" bucket. Before this, the only checks were the
-- member's own folder, image types and 8 MB per file, so one account could store an unlimited number of files.
-- A new upload is now refused when the member already has:
--   * 500 photos (about 3 photos a week for 3 years; a 1,600-pixel JPEG from the app is usually under 1 MB), or
--   * 30 photos uploaded in the last 24 hours (stops scripted bulk uploads), or
--   * 1 GiB of photos in total (bounds storage per member even for files sent outside the app).
-- Nothing already stored is removed or changed: the limit only applies to NEW uploads. Viewing, replacing and
-- deleting are unaffected, and deleting photos frees room. The app says so when an upload is refused
-- (src/lib/domain/progress-photos.ts, PHOTO_LIMITS).
--
-- Two layers, one rule:
--   1. The storage insert policy calls can_add_progress_photo(): a quick refusal before the file is stored. The
--      storage service evaluates policies in a transaction it then rolls back, so on its own this can't stop a burst
--      of simultaneous uploads (measured locally: 60 at once let 36 through a limit of 30).
--   2. A trigger on the row the storage service really writes (as its own privileged user) takes a per-member lock
--      for the rest of that transaction and counts again, so simultaneous uploads by one member take turns and a
--      burst can't slip past the limit. Triggers run whatever the role.

-- The counts for one member's folder ("<uid>/..."), through the (bucket_id, name) index.
create or replace function public.progress_photo_quota_ok(p_user uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count bigint;
  v_today bigint;
  v_bytes bigint;
begin
  if p_user is null then
    return false;
  end if;
  select count(*),
         count(*) filter (where o.created_at > now() - interval '24 hours'),
         coalesce(sum(coalesce((o.metadata ->> 'size')::bigint, 0)), 0)
    into v_count, v_today, v_bytes
  from storage.objects o
  where o.bucket_id = 'progress-photos'
    and o.name collate "C" >= (p_user::text || '/')
    and o.name collate "C" < (p_user::text || '0');
  return v_count < 500 and v_today < 30 and v_bytes < 1073741824;
end;
$$;
revoke all on function public.progress_photo_quota_ok(uuid) from public, anon, authenticated;

-- Layer 1: for the storage policy (the signed-in member only; no arguments).
create or replace function public.can_add_progress_photo()
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select public.progress_photo_quota_ok(auth.uid());
$$;

comment on function public.can_add_progress_photo() is
  'True while the signed-in member may upload another progress photo: fewer than 500 stored, fewer than 30 in the last 24 hours, under 1 GiB in total.';

revoke all on function public.can_add_progress_photo() from public, anon;
grant execute on function public.can_add_progress_photo() to authenticated, service_role;

-- Same rule as before (own folder only), plus the limit.
drop policy if exists progress_photos_owner_insert on storage.objects;
create policy progress_photos_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.can_add_progress_photo()
  );

-- Layer 2: the row actually written. The member is the folder owner (the policy above already requires the folder to
-- be the caller's own). The advisory lock lasts until the upload's transaction commits, so the next simultaneous
-- upload by the same member waits, then counts with this one included.
create or replace function public.enforce_progress_photo_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  begin
    v_user := split_part(new.name, '/', 1)::uuid;
  exception when invalid_text_representation then
    raise exception 'progress photo limit: not in a member folder' using errcode = '42501';
  end;
  perform pg_advisory_xact_lock(hashtextextended('ngf.progress_photos:' || v_user::text, 0));
  if not public.progress_photo_quota_ok(v_user) then
    raise exception 'progress photo limit reached (new row violates row-level security policy)' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_progress_photo_quota() from public, anon, authenticated;

drop trigger if exists progress_photos_quota on storage.objects;
create trigger progress_photos_quota
  before insert on storage.objects
  for each row
  when (new.bucket_id = 'progress-photos')
  execute function public.enforce_progress_photo_quota();
