-- Bible reader display preferences (Faith is free: no plan check anywhere).
--   bible_red_letters : show the words of Jesus in red (default on). Display only; the text is never changed.
--   bible_page_theme  : the reading page in the Bible reader, dark (default) or light.
alter table public.profiles
  add column if not exists bible_red_letters boolean not null default true,
  add column if not exists bible_page_theme text not null default 'dark' check (bible_page_theme in ('dark', 'light'));

-- Self-editable like the other display preferences (column-level grants; row access stays owner-only by RLS).
grant update (bible_red_letters, bible_page_theme) on public.profiles to authenticated;
