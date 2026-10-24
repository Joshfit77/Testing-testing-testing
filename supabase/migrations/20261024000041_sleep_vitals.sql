-- Sleep & Recovery: wearable-recorded detail on imported sessions. The recording device's name, and the overnight
-- heart rate, heart-rate variability and respiratory rate summarised from the health platform's samples inside the
-- session (averages, lows and highs, how many samples). Only imported sessions may carry them: the app never
-- measures anything itself, so a hand-logged or timer session has nothing to put here.

alter table public.sleep_sessions
  add column if not exists device_name text check (char_length(device_name) <= 120),
  add column if not exists hr_avg smallint check (hr_avg between 20 and 250),
  add column if not exists hr_min smallint check (hr_min between 20 and 250),
  add column if not exists hr_max smallint check (hr_max between 20 and 250),
  add column if not exists hr_samples integer check (hr_samples between 1 and 100000),
  -- HealthKit reports SDNN, Health Connect RMSSD: different statistics, so the method is kept with the number.
  add column if not exists hrv_avg_ms numeric(6, 1) check (hrv_avg_ms between 1 and 500),
  add column if not exists hrv_method text check (hrv_method in ('sdnn', 'rmssd')),
  add column if not exists hrv_samples integer check (hrv_samples between 1 and 100000),
  add column if not exists rr_avg numeric(4, 1) check (rr_avg between 4 and 60),
  add column if not exists rr_min numeric(4, 1) check (rr_min between 4 and 60),
  add column if not exists rr_max numeric(4, 1) check (rr_max between 4 and 60),
  add column if not exists rr_samples integer check (rr_samples between 1 and 100000);

alter table public.sleep_sessions
  add constraint sleep_sessions_vitals_imported_check
    check (source not in ('manual', 'timer') or (hr_avg is null and hrv_avg_ms is null and rr_avg is null and device_name is null)),
  add constraint sleep_sessions_hr_shape_check
    check ((hr_avg is null) = (hr_samples is null) and (hr_min is null or hr_max is null or hr_avg is null or (hr_min <= hr_avg and hr_avg <= hr_max))),
  add constraint sleep_sessions_hrv_shape_check
    check ((hrv_avg_ms is null) = (hrv_method is null) and (hrv_avg_ms is null) = (hrv_samples is null)),
  add constraint sleep_sessions_rr_shape_check
    check ((rr_avg is null) = (rr_samples is null) and (rr_min is null or rr_max is null or rr_avg is null or (rr_min <= rr_avg and rr_avg <= rr_max)));

-- Which platform the member connected and when; shown as the connection status and cleared on disconnect.
alter table public.profiles
  add column if not exists sleep_import_source text check (sleep_import_source in ('apple_health', 'health_connect')),
  add column if not exists sleep_import_connected_at timestamptz;
grant update (sleep_import_source, sleep_import_connected_at) on public.profiles to authenticated;

-- A sync can also complete earlier imports with vitals that weren't read before.
alter table public.sleep_import_runs
  add column if not exists updated integer not null default 0 check (updated between 0 and 10000),
  add column if not exists with_vitals integer not null default 0 check (with_vitals between 0 and 10000);
