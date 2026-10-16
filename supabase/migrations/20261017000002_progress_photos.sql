-- Progress photos (private)
-- Each photo is an object in the PRIVATE `progress-photos` bucket under "<uid>/...",
-- plus a metadata row in public.progress_photos. Only the owner can see or change
-- either. Admins get NO access to other users' photos (no is_admin() clause anywhere).

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 3 and 300),
  taken_on date not null default current_date,
  pose text not null default 'front' check (pose in ('front', 'side', 'back', 'other')),
  weight_kg numeric(5, 2) check (weight_kg between 25 and 400),
  note text check (char_length(note) <= 280),
  created_at timestamptz not null default now(),
  -- The object must live in the owner's own folder.
  check (split_part(storage_path, '/', 1) = user_id::text)
);
create index progress_photos_user_idx on public.progress_photos (user_id, taken_on desc);

alter table public.progress_photos enable row level security;

create policy progress_photos_select_own on public.progress_photos
  for select to authenticated using (user_id = (select auth.uid()));
create policy progress_photos_insert_own on public.progress_photos
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy progress_photos_update_own on public.progress_photos
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy progress_photos_delete_own on public.progress_photos
  for delete to authenticated using (user_id = (select auth.uid()));

-- Storage bucket: private, images only, 8 MB max per object.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy progress_photos_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy progress_photos_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy progress_photos_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy progress_photos_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
