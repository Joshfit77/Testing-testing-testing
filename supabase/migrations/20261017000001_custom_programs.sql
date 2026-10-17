-- Custom program builder (/train/build): users can save private programs with source = 'custom'.
-- Custom programs follow the same rules as starter and AI programs: private to their owner,
-- never published, and free for the owner.

alter table public.training_programs drop constraint if exists training_programs_source_check;
alter table public.training_programs
  add constraint training_programs_source_check check (source in ('curated', 'starter', 'ai', 'custom'));

drop policy if exists training_programs_insert on public.training_programs;
create policy training_programs_insert on public.training_programs
  for insert to authenticated with check (
    (owner_id = (select auth.uid()) and is_published = false and source in ('starter', 'ai', 'custom'))
    or (owner_id is null and public.is_admin())
  );

-- Supports the per-user build rate limit (recent custom programs by owner).
create index if not exists training_programs_owner_source_created_idx
  on public.training_programs (owner_id, source, created_at desc)
  where owner_id is not null;
