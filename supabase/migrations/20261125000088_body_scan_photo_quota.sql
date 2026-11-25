-- Body Scan photos: a per-member upload limit on the private "body-scans" bucket, enforced by the database itself.
--
-- Scans were already limited to 200 per member (body_scan_limit, migration 031), but the storage rule only checked the
-- member's own folder, Pro and consent, so files could be uploaded to the bucket without limit (each upload from the
-- app uses a new file name, and an upload whose scan is never saved leaves its file behind). A new upload is now
-- refused when the member already has:
--   * 750 photos in the bucket (200 scans x 3 poses = 600, plus room for retakes and unfinished scans), or
--   * 30 photos uploaded in the last 24 hours (10 full scans; stops scripted bulk uploads), or
--   * 2 GiB of photos in total (a 1,600-pixel JPEG from the app is usually under 1 MB).
-- Nothing already stored is removed or changed: the limit only applies to NEW uploads. Viewing and deleting are
-- unaffected, and deleting scans frees room. The app says so when an upload is refused
-- (src/lib/domain/body-scan.ts, SCAN_PHOTO_LIMITS).
--
-- The same two layers as the progress-photo limit (migration 086), for the same reason:
--   1. The storage insert policy calls can_add_body_scan_photo(): a quick refusal before the file is stored.
--   2. A trigger on the row the storage service really writes takes a per-member lock for the rest of that transaction
--      and counts again, so a burst of simultaneous uploads can't slip past the limit (the storage service evaluates
--      policies in a transaction it rolls back, which releases any lock taken there).

-- The counts for one member's folder ("<uid>/..."), through the (bucket_id, name) index.
create or replace function public.body_scan_photo_quota_ok(p_user uuid)
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
  where o.bucket_id = 'body-scans'
    and o.name collate "C" >= (p_user::text || '/')
    and o.name collate "C" < (p_user::text || '0');
  return v_count < 750 and v_today < 30 and v_bytes < 2147483648;
end;
$$;
revoke all on function public.body_scan_photo_quota_ok(uuid) from public, anon, authenticated;

-- Layer 1: for the storage policy (the signed-in member only; no arguments).
create or replace function public.can_add_body_scan_photo()
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select public.body_scan_photo_quota_ok(auth.uid());
$$;

comment on function public.can_add_body_scan_photo() is
  'True while the signed-in member may upload another Body Scan photo: fewer than 750 stored, fewer than 30 in the last 24 hours, under 2 GiB in total.';

revoke all on function public.can_add_body_scan_photo() from public, anon;
grant execute on function public.can_add_body_scan_photo() to authenticated, service_role;

-- Same rule as before (own folder, Pro and consent), plus the limit.
drop policy if exists body_scans_owner_insert on storage.objects;
create policy body_scans_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'body-scans'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.can_add_body_scan()
    and public.can_add_body_scan_photo()
  );

-- Layer 2: the row actually written. The member is the folder owner (the policy above already requires the folder to
-- be the caller's own). The advisory lock lasts until the upload's transaction commits, so the next simultaneous
-- upload by the same member waits, then counts with this one included.
create or replace function public.enforce_body_scan_photo_quota()
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
    raise exception 'body scan photo limit: not in a member folder' using errcode = '42501';
  end;
  perform pg_advisory_xact_lock(hashtextextended('ngf.body_scan_photos:' || v_user::text, 0));
  if not public.body_scan_photo_quota_ok(v_user) then
    raise exception 'body scan photo limit reached (new row violates row-level security policy)' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_body_scan_photo_quota() from public, anon, authenticated;

drop trigger if exists body_scan_photos_quota on storage.objects;
create trigger body_scan_photos_quota
  before insert on storage.objects
  for each row
  when (new.bucket_id = 'body-scans')
  execute function public.enforce_body_scan_photo_quota();
