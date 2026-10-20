-- Display and Faith preferences shown in Profile & Settings (SPEC §1, §12).
--   text_size      : root text scale on top of the system text size.
--   reduce_motion  : turns off page animations and celebration confetti.
--   home_scripture : show the Scripture card on Home (Faith itself is always available).
alter table public.profiles
  add column if not exists text_size text not null default 'default' check (text_size in ('default', 'large', 'xlarge')),
  add column if not exists reduce_motion boolean not null default false,
  add column if not exists home_scripture boolean not null default true;

-- Self-editable like the other profile preferences (column-level grants).
grant update (text_size, reduce_motion, home_scripture) on public.profiles to authenticated;
