# GPS running, walking, outdoor cardio and treadmill tracking — audit (2026-11-07)

Branch under audit: `claude/faith-discipleship` at 4bdd1db (59c854e + docs). Worktree branch:
`worktree-agent-a22072019219a6932`. Status lines are appended as work proceeds; anything not marked "proved" was not run.

Environment note: Docker (and so local Supabase on 127.0.0.1:54321) was down for the whole audit (`docker info`: cannot
connect to the daemon). Per the brief, daemons were not restarted. Integration tests and the signed-in Playwright
flows could therefore not run; what was proved comes from unit tests on the pure functions, the component tests
(jsdom), the production build, and code review of the server action, database triggers and RLS.

## 1. Inventory

### Client (recording)
| File | Role |
| --- | --- |
| `src/components/run/gps-recorder.tsx` (681 lines) | Recorder screen: start / waiting for fix / recording / paused / finished-review / save, recovery offer, hand-over when leaving the screen, Free-plan lock (`canRecord`). Persists the track to `localStorage["run.recording.<userId>"]` every 5 s. |
| `src/lib/domain/gps-track.ts` (599 lines, pure) | State machine: accuracy gates (25 m; first fix 20 m), stale/out-of-order rejection, constant-velocity Kalman filter per axis, NIS outlier gate + speed caps (run 10 m/s, walk 4 m/s), restart after 3 agreeing outliers, standing-still rule (0.55 m/s), 6 m chords, 15 s signal loss, suspend-aware ticker, pause/resume/finish, interpolated splits, current pace, Douglas–Peucker route simplification (≤ 2,000 points, 5-decimal rounding), totals, draft recovery (12 h). |
| `src/lib/run/live-recording.ts` | Keeps the watcher and track alive while the member navigates elsewhere in the app ("Recording" pill); single `routeFix` entry point. |
| `src/lib/native/location.ts` | Fix source: `@capacitor-community/background-geolocation` 1.2.26 watcher in the native build (background title/message, `requestPermissions`, `stale: false`, `distanceFilter: 0`), else `navigator.geolocation.watchPosition` (`enableHighAccuracy`, `maximumAge: 0`, 30 s timeout). Error mapping denied / unavailable / unsupported / timeout. Wake Lock in the browser. Android 13 notification permission. |
| `src/lib/domain/run-session.ts` | Guided run scripts (warm-up / run / walk / cool-down phases from a program day) and running goals maths. |
| `src/lib/domain/activities.ts` | Units, pace, `formatHms`, weekly totals, personal bests (self-reported vs GPS), `localToUtcIso` (DST handling: earlier instant on a repeated hour). |
| `src/components/run/route-map.tsx` | Inline SVG route (no tile service), dashed breaks, km/mile markers, scale bar, live position. |
| `src/components/run/activity-form.tsx` | Manual / treadmill entry and edit form (no location access). |
| `src/components/run/activity-summary-ui.tsx`, `delete-activity-button.tsx`, `run-tabs.tsx`, `running-goals.tsx` | List items, source badges, delete, tabs, goals UI. |
| `src/components/shell/active-run-pill.tsx` | "Recording" pill while a kept recording runs in the background of the app. |
| `src/lib/opening.ts` (`GPS_RECORDING_PREFIX`, `GPS_RESUMABLE_MS`) | Skips the opening animation while a recording draft is live. |
| `src/lib/drafts.ts` (`clearAllDrafts` → `stopKept`) | Sign-out / account deletion stop a kept recording and clear the device draft. |

### Pages
| Route | File |
| --- | --- |
| `/run` (tabs outdoor / log / history) | `src/app/(app)/run/page.tsx` |
| `/run/record?kind=run\|walk`, `?day=&up=` (guided) | `src/app/(app)/run/record/page.tsx` — passes `canRecord={hasFeature(plan,"live_gps")}` |
| `/run/activities/[id]`, `/run/activities/[id]/edit` | detail (route, splits, GPS-quality note) and manual edit |

### Server
| File | Role |
| --- | --- |
| `src/server/actions/gps-activities.ts` | `saveGpsActivityAction` (zod schema, Pro check via `getUserPlan` + `hasFeature(plan,"live_gps")`, time/speed/route-vs-distance sanity checks, insert with client-generated UUID, `23505` → "Already saved", guided-run → `finishWorkout`), `addRunningGoalAction`, `removeRunningGoalAction`. |
| `src/server/actions/activities.ts` | `createActivityAction` / `updateActivityAction` (source restricted to manual \| treadmill, route and splits forced null), `deleteActivityAction` (soft delete that also nulls route / splits / gps_quality). |
| `src/server/services/activities.ts` | Reads: list (no route columns), one, runs for records, GPS detail (route/splits/quality) — all filtered by `user_id` and `deleted_at is null`. |
| `src/server/services/activity-summary.ts` | Weekly activity (workouts + runs + walks) in the member's time zone with a one-day margin either side of the week. |
| `src/server/auth.ts` `getUserPlan` | Server-side plan lookup (entitlements table), React-cached per request. |
| `src/app/api/health/route.ts`, `src/app/api/v1/*` | **No activity endpoints**: `grep -rln activities src/app/api` returns nothing. GPS saves go only through the server action. |

### Database (supabase/migrations)
| Migration | Content |
| --- | --- |
| `20261020000010_activities.sql` | `activities` table: kind/source checks, `distance_m` ≤ 500 km, `elapsed_s` 1..172800, `moving_s ≤ elapsed_s`, distance required unless manual, `route` only when `source='gps'`, unique `(user_id, source, external_id)`, unique `(user_id, source, started_at)` for live GPS rows, owner-only RLS for select/insert/update/delete. |
| `20261023000024_plan_enforcement.sql` | `plan_of(uuid)` (entitlements, default `free`), `plan_rank`. |
| `20261024000029_gps_running.sql` | `gps_quality` (≤ 1 kB object), `workout_session_id`, route ≤ 150 kB, splits ≤ 600, `running_goals` table with owner RLS and a 10-goal trigger. |
| `20261025000043_deleted_activities_no_route.sql` | Strips route/splits/gps_quality from already-deleted rows; check constraint: a deleted row cannot carry them. |
| `20261026000044_free_pro_memberships.sql` + `20261102000048_low_findings_hardening.sql` | Trigger `enforce_live_gps_plan` (security definer): an authenticated user whose `plan_rank(plan_of(uid)) < plan_rank('plus')` cannot insert `source='gps'` or a non-null route, nor update a row to add one. Service-role writes bypass it (`auth.uid()` is null). |

### Native
| Item | State |
| --- | --- |
| `ios/App/App/Info.plist` | `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`, `UIBackgroundModes: location`; `NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription` ("only reads"). |
| `ios/App/App/PrivacyInfo.xcprivacy` | Declares `NSPrivacyCollectedDataTypePreciseLocation` and `…Health`, tracking = false. |
| `android/app/src/main/AndroidManifest.xml` | `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS`; **no** `ACCESS_BACKGROUND_LOCATION` (by design: foreground service). Unused Health Connect write permissions removed with `tools:node="remove"`. |
| `package.json` | `@capacitor-community/background-geolocation` 1.2.26, `@capgo/capacitor-health` 8.11.4 (steps and sleep **read** only). |
| `capacitor.config.ts` | Native shell loads the deployed site (`CAP_SERVER_URL`); `npx cap sync` has not been run in this environment. |

### Apple Health workout sync
**Not implemented, by design.** `src/lib/native-health.ts` and `src/lib/native-sleep.ts` only read steps and sleep;
there is no `writeWorkout` / HKWorkout code anywhere in `src` (`grep -rn "HKWorkout\|writeWorkout\|saveWorkout"` is
empty), the privacy page states "we never write to Apple Health or Health Connect", `NSHealthUpdateUsageDescription`
says the same, and the Android manifest removes every Health Connect write permission. So there is no write path,
idempotency key or retry logic to audit; the de-duplication that exists is for *imports* (`external_id` unique per
user and source) and for live recordings (client UUID primary key plus unique `(user_id,'gps',started_at)`).

### Docs
`docs/GPS_ACCURACY.md` (controlled-trace results, browser vs native matrix, outdoor test plan),
`docs/GPS_BACKGROUND_IPHONE.md` (background behaviour, iPhone limitations, 9-step device test),
`docs/RUN_TRACKING_PLAN.md` (status; notes the native build has never been synced here).
`IMPLEMENTATION_STATUS.md` line 57 still says "live GPS tracking isn't built yet" — stale.

### Existing tests
| File | Coverage |
| --- | --- |
| `tests/unit/gps-track.test.ts` (19 tests) | first fix, steady run within 1 %, mile splits, jumps, jitter, pause, 15 s gap, recovery, out-of-order, route save, locked-phone ticker. |
| `tests/unit/gps-accuracy.test.ts` (15 tests) | 12 controlled scenarios (`tests/fixtures/gps-traces.ts`: open sky, city, intervals, pause, tunnels, multipath, slow walk, standing still, out-of-order + duplicates, bad first fix, precise-off) with tolerances; diagnostics. |
| `tests/unit/gps-recorder.test.tsx` (9) | recovery offers, lapsed Pro, watcher start/stop/leak, hand-over, sign-out. |
| `tests/unit/route-map.test.tsx` (3), `tests/unit/run-session.test.ts` (8), `tests/unit/activities.test.ts` | map markers / hydration, guided scripts and goals, activity maths. |
| `tests/integration/gps-running.test.ts` (5), `tests/integration/activities.test.ts` (11) | RLS, Pro trigger, size limits, duplicates, delete strips route — **need local Supabase (down)**. |
| `e2e/gps-run.spec.ts` (9), `e2e/run.spec.ts` (1) | Chromium geolocation override: walk with pause, guided run, denied, unavailable, approximate, sign-out, hand-over, reload — **need local Supabase (down)**. |
