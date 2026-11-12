-- Runs and walks deleted before 2026-10-25 kept their GPS route, splits and signal summary in the soft-deleted row
-- (the app only set deleted_at), and the data export returns soft-deleted rows. This removes the location data from
-- every row the member has already deleted, and makes the rule structural: a deleted activity can't carry a route.
--
-- Irreversible for those rows (the route can't be recovered), and intended to be: the member deleted them. Only rows
-- with deleted_at set are touched; live runs and walks, workouts and accounts are untouched. On a live database this
-- is to be applied only with the owner's approval (docs/launch-audit/D_CODE_CHANGES_AND_TESTS.md).
update public.activities
   set route = null, splits = null, gps_quality = null
 where deleted_at is not null
   and (route is not null or splits is not null or gps_quality is not null);

alter table public.activities
  add constraint activities_deleted_no_route
  check (deleted_at is null or (route is null and splits is null and gps_quality is null));
