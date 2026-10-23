-- Body Scan (Pro): guided front, side and optional rear photos with optional measurements, kept apart from the
-- ordinary progress photos. Photos live in the PRIVATE `body-scans` bucket under "<uid>/<scan id>/...". Only the
-- owner can read or delete them; there is no admin access anywhere. Nothing here estimates body fat, and no image is
-- sent to the AI coach or any other service.
--
-- New scans need Pro and the member's explicit consent (recorded with the time). Viewing and deleting never need
-- either, so a member who downgrades or withdraws consent can still see and remove what they stored.

alter table public.profiles add column if not exists body_scan_consent_at timestamptz;
grant update (body_scan_consent_at) on public.profiles to authenticated;

create or replace function public.can_add_body_scan()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_plan('pro')
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.body_scan_consent_at is not null);
$$;
revoke all on function public.can_add_body_scan() from public, anon;
grant execute on function public.can_add_body_scan() to authenticated, service_role;

create table public.body_scans (
  -- Generated on the device before upload, so a retried save can't create a second scan.
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  taken_on date not null,
  weight_kg numeric(5, 2) check (weight_kg between 25 and 400),
  -- Measurements entered with the scan are stored in the ordinary measurement history.
  measurement_id uuid references public.measurement_entries (id) on delete set null,
  note text check (char_length(note) <= 280),
  created_at timestamptz not null default now()
);
create index body_scans_user_idx on public.body_scans (user_id, taken_on desc);

create table public.body_scan_photos (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.body_scans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  pose text not null check (pose in ('front', 'side', 'back')),
  storage_path text not null unique check (char_length(storage_path) between 3 and 300),
  created_at timestamptz not null default now(),
  unique (scan_id, pose),
  -- The object must live in the owner's folder for this scan.
  check (split_part(storage_path, '/', 1) = user_id::text),
  check (split_part(storage_path, '/', 2) = scan_id::text)
);
create index body_scan_photos_user_idx on public.body_scan_photos (user_id);

alter table public.body_scans enable row level security;
alter table public.body_scan_photos enable row level security;

create policy body_scans_select_own on public.body_scans
  for select to authenticated using (user_id = (select auth.uid()));
create policy body_scans_delete_own on public.body_scans
  for delete to authenticated using (user_id = (select auth.uid()));
create policy body_scans_insert_own on public.body_scans
  for insert to authenticated with check (user_id = (select auth.uid()) and public.can_add_body_scan());

create policy body_scan_photos_select_own on public.body_scan_photos
  for select to authenticated using (user_id = (select auth.uid()));
create policy body_scan_photos_delete_own on public.body_scan_photos
  for delete to authenticated using (user_id = (select auth.uid()));
create policy body_scan_photos_insert_own on public.body_scan_photos
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and public.can_add_body_scan()
    and exists (select 1 from public.body_scans b where b.id = scan_id and b.user_id = (select auth.uid()))
  );

-- At most 200 scans per member (about four years of weekly scans), checked under a per-member lock.
create or replace function public.body_scan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('body_scans:' || new.user_id::text));
  if (select count(*) from public.body_scans where user_id = new.user_id) >= 200 then
    raise exception 'body_scan_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger body_scans_limit before insert on public.body_scans for each row execute function public.body_scan_limit();

-- Storage: private, images only, 8 MB per object. Read and delete your own folder; upload only with Pro and consent.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('body-scans', 'body-scans', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy body_scans_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'body-scans' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy body_scans_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'body-scans' and (storage.foldername(name))[1] = (select auth.uid())::text and public.can_add_body_scan());
create policy body_scans_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'body-scans' and (storage.foldername(name))[1] = (select auth.uid())::text);
