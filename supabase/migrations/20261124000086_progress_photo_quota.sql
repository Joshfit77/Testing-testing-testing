-- Progress photos: a per-member upload limit, enforced by the storage rule itself (a direct API call can't skip it).
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

create or replace function public.can_add_progress_photo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    -- The member's own folder in the bucket ("<uid>/..."), found through the (bucket_id, name) index.
    select o.created_at, coalesce((o.metadata ->> 'size')::bigint, 0) as bytes
    from storage.objects o
    where o.bucket_id = 'progress-photos'
      and o.name collate "C" >= ((select auth.uid())::text || '/')
      and o.name collate "C" < ((select auth.uid())::text || '0')
  )
  select (select auth.uid()) is not null
     and (select count(*) from mine) < 500
     and (select count(*) from mine where created_at > now() - interval '24 hours') < 30
     and (select coalesce(sum(bytes), 0) from mine) < 1073741824;
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
