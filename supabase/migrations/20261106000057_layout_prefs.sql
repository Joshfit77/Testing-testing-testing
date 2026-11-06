-- Dashboard layout preferences: which Home modules a member hides or reorders, and which Faith sections they hide.
-- One nullable JSON column (null = the app's default order for the member's goal and experience). Additive and
-- reversible: rolling back is `alter table public.profiles drop column layout_prefs;` and nothing else reads it.
-- Shape (validated by the app, src/lib/layout-prefs.ts):
--   { "home": { "order": ["workout", "nutrition", ...], "hidden": ["sleep"] }, "faith": { "hidden": ["themes"] } }
alter table public.profiles
  add column if not exists layout_prefs jsonb check (layout_prefs is null or jsonb_typeof(layout_prefs) = 'object');

comment on column public.profiles.layout_prefs is 'Home and Faith dashboard layout chosen by the member (null = default for their goal).';

-- Self-editable like the other display preferences (column-level grant; row access stays owner-only by RLS).
grant update (layout_prefs) on public.profiles to authenticated;
