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

### Added by this audit
`tests/unit/gps-audit-edge-cases.test.ts` (24), `tests/unit/gps-save-action.test.ts` (16),
`tests/unit/gps-recorder-audit.test.tsx` (13), `docs/audit-2026-11-07/gps-device-test-script.md`.

## 2. Workflows tested

Legend: **proved** = ran here with the stated result; **code-reviewed** = read, not executed; **device** = needs a phone.

| Workflow | How | Result |
| --- | --- | --- |
| Start → waiting for fix → recording → distance / pace / splits | Unit (`gps-track`, `gps-accuracy`, `gps-audit-edge-cases`): straight line 1 km at 3 m/s within 1 %, km split interpolated (330–338 s), mile splits at 1609 m, live pace 5:33 /km | **proved** (74 existing + 24 new tests pass) |
| Pause / Resume | Unit: moving time excludes the pause (421 s elapsed, 121 s moving), fixes during a pause rejected, route breaks, nothing counted across; component: Pause stops the watcher, Resume starts a new one | **proved** |
| Total time while paused | Component test with fake timers | **bug found and fixed** (see §4 B1) |
| Finish → review → save | Component: review screen, payload shape (13 keys, no plan data), one request per double tap, `router.push(/run/activities/<id>?saved=1)` and the draft removed only after `ok` | **proved** |
| Save path server-side | Unit on `saveGpsActivityAction` with mocked session/plan/DB (16 tests) | **proved**: Free refused before any DB call; Plus/Pro insert `source='gps'`, `is_private=true`, `user_id` from the session; tampered payloads refused |
| Route storage | Unit: `routeForSave` gives `[lng, lat]` at 5 decimals, one line per stretch, ≤ 2,000 points, length within the server's 20 % + 100 m check | **proved** |
| Route map | Existing `route-map.test.tsx` (markers, breaks, hydration-safe title) | **proved** (existing) |
| Session recovery after reload / crash | Unit: 12 h window, `recoverTrack` adds a gap and never counts the missing stretch, v1 drafts upgrade; component (existing): finished-but-unsaved offered back, old drafts removed | **proved** |
| Loss of internet | Component: offline save → "You're offline…", draft kept with status finished; online but unreachable → "Couldn't reach the server…"; later retry succeeds with the **same id** (idempotent on the server: `23505` → "Already saved") | **proved** |
| Treadmill / manual entry independent of GPS | Component: `ActivityForm` renders and previews pace with `navigator.geolocation` spied — never called; server action schema restricts `source` to manual/treadmill and forces `route: null` | **proved** |
| Free vs Pro | Server action unit tests + DB trigger `enforce_live_gps_plan` (reviewed; integration test exists but Supabase was down) + recorder lock (`canRecord=false`: no Start, no location request) | **proved (action), code-reviewed (trigger)** |
| Guided run (program day) | Existing unit (`run-session`) and code review of `logProgramRun` (`finishWorkout` keyed on `client_id = activity id`, so a retry does not double-log) | **code-reviewed** |
| Background recording, locked screen, interruptions, battery, real accuracy | — | **device** (script: `gps-device-test-script.md`) |
| e2e (`e2e/gps-run.spec.ts`, 9 scenarios; `e2e/run.spec.ts`) | Need sign-up against local Supabase | **not run**: Docker daemon down for the whole audit (`docker info` fails). The earlier auditors' baseline had e2e core subsets passing; these specs were not in that subset, so their current status is **unknown**. |
| Full unit suite after the changes | `npx vitest run` | **proved**: 170 files passed, 49 skipped (integration, no Supabase); 3,303 tests passed, 319 skipped |

## 3. Failure scenarios tested

| Scenario | How | Result |
| --- | --- | --- |
| Permission denied (browser) | Component: watcher error `denied` | Message "Location permission is off…", no Settings button, clock keeps running — **proved** |
| Permission denied (native) | Component with `hasNativeBackgroundLocation()` true | "Open Settings" button calls `openLocationSettings()` — **proved** (the plugin call itself: device) |
| Position unavailable / timeout | Component | Each explained; the next good fix clears the warning — **proved** |
| Approximate location (precise off) | Component + unit: fixes at ±2500 m | Distance stays 0.00, `gps-hint-precise` names the iPhone/Android setting — **proved** |
| Poor signal: accuracy spikes 26–526 m | Unit | All rejected as inaccurate, distance unchanged, `lastAccuracy` shown — **proved** |
| Multipath: 60 m jump with "fair" accuracy | Unit | Rejected as an outlier; track continues on the same line when honest fixes return — **proved** |
| Consistent "outliers" (bad first fix) | Unit | Filter restarts after 3 agreeing fixes; the jump is never counted; `restarts=1` — **proved** |
| Tunnel 40 s | Unit | Signal lost after 15 s, gap counted once, straight-line ≈120 m reported as *not counted*, time keeps running — **proved** |
| Duplicate timestamps, late (older) fixes, cached pre-start fix | Unit | `out_of_order` / `stale`, distance unchanged, stream continues — **proved** |
| Jitter while standing still (5 min, 3–6 m wobble) | Unit | < 10 m added, no gap, no outliers — **proved** |
| DST / time zone | Unit: run across the 2026-11-01 US fall-back; `localToUtcIso` on the repeated and skipped hour; `activityDay` in NY / Tokyo / LA | Elapsed stays 3600 s (epoch maths); repeated hour → earlier instant; skipped hour → a real instant within the hour; local day correct — **proved** |
| Walk kind while jogging > 4 m/s | Unit | Held at the cap (only the ramp counts); documented limitation, not a bug — **proved** |
| Phone locking (JavaScript suspended) | Existing unit "a locked phone": suspend-aware ticker waits 15 s for queued fixes | **proved at unit level; real behaviour: device** |
| Hand-over when leaving the screen; sign-out mid-recording | Existing component tests | **proved** (existing) |
| Server refuses save (lapsed plan / failed check) | Component | Reason shown, draft kept — **proved** |
| Double tap Save | Component | One request — **proved** |

## 4. Bugs found

| # | Severity | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| B1 | Low (UX / what is shown) | While paused, the recorder's "Time" (total) froze and then jumped on Resume: the 1-second clock only ran for `recording`/`acquiring`. Moving time and the saved totals were correct. | `src/components/run/gps-recorder.tsx:260` (before fix); test "total time keeps counting through a pause" failed with `expected 5 to be >= 14` | **Fixed** (commit 53a5369): clock runs until Finish; `tick()` ignores a paused track. Regression test in `tests/unit/gps-recorder-audit.test.tsx`. |
| B2 | Low (docs) | `IMPLEMENTATION_STATUS.md` said "live GPS tracking isn't built yet". | line 57 | **Fixed** in the same commit. |
| B3 | Low (behaviour to confirm with the owner) | After a crash/force-quit, "Continue recording" counts the whole time away as *moving* time (the UI says the time is kept as a gap with no distance). A member who reopens after 3 hours gets a 3-hour run at a very slow pace. Pausing the recovered track at recovery (so the member chooses Resume) would be more honest. | `src/lib/domain/gps-track.ts:594-599`; test "recovery … time away as a gap" (`moving_s` = 720 for 60 s of fixes) | Not changed (product decision; a one-line change if wanted). |
| B4 | Low | A recording left while **acquiring** (e.g. permission denied, no fix ever) is still handed to the keeper when the member navigates away, so the "Recording run: 0.00 km" pill stays until they come back and discard; the kept clock never marks a gap because `lastFixAt` is null. | `src/lib/run/live-recording.ts:208-210`, `gps-track.ts:446` | Not changed; low impact. |
| B5 | Info | The first fix after Resume is ignored when its GPS timestamp is ≤ the resume instant (`resumeTrack` sets `lastFixAt = now`); costs at most ~1 s of data per resume. | `gps-track.ts:481` | Not changed. |

No distance, pace or split maths error was found: the new scenario assertions on synthetic traces (plus the 12 existing
controlled scenarios) all hold.

## 5. Security, data isolation and subscription enforcement

- **Pro gate is server-side twice.** (1) `saveGpsActivityAction` reads the plan with `getUserPlan(user.id)` (entitlements table, session user) and refuses Free before parsing or touching the database — proved by unit test with a perfect payload and with `plan: "pro"` / `user_id` tampering in the payload. (2) The `activities_live_gps_plan` trigger (security definer) refuses `source='gps'` or a non-null `route` for `plan_rank(plan_of(uid)) < 'plus'` on insert **and** update, so even a direct PostgREST call with the user's JWT cannot save a live recording or attach a route to a manual entry (`20261102000048_low_findings_hardening.sql:52-75`; integration test `gps-running.test.ts` "live GPS is Pro…" exists — **not run here**, Supabase down). The client lock (`canRecord`) is convenience only.
- **No API bypass.** No `/api/health` or `/api/v1/*` route reads or writes `activities`; the only write paths are the two server actions, both on the cookie session, so RLS and the trigger apply. `createActivityAction`'s zod schema only accepts `source` manual|treadmill and writes `route: null, splits: null`.
- **Ownership.** All reads filter `user_id = session user` and `deleted_at is null`; RLS is owner-only for select/insert/update/delete; no admin policy on `activities` (routes are private data). `user_id` in a payload is ignored (proved).
- **Route data at rest.** `activities.route` jsonb, `[lng, lat]` at 5 decimals (~1 m), ≤ 150 kB, `is_private=true` default; start/finish points are stored as recorded — there is **no privacy-zone trimming** around home (routes are owner-only, so the exposure is limited to the owner's own account/export; noted as a product choice).
- **Deletion.** Soft delete nulls route/splits/gps_quality in the same statement, and a check constraint makes a deleted row with a route impossible; account deletion cascades; sign-out clears the on-device draft and stops a kept watcher.
- **On-device storage.** The in-progress track (positions included) lives in `localStorage["run.recording.<userId>"]` in plain text for up to 12 h; a shared device is the only exposure (same as other drafts in the app).
- **No third-party map service**: the route is drawn as inline SVG from the member's own points.
- **Apple Health**: read-only; nothing is written (see Inventory). Privacy page and `Info.plist` strings agree with the code.

## 6. Browser-tested vs needs-physical-device

| Capability | Browser / unit (this audit) | Physical iPhone / Android |
| --- | --- | --- |
| Distance, pace, splits maths; outlier/jitter/gap rules | Proved (unit, synthetic and controlled traces) | Real-world accuracy vs a reference (script B1–B6) |
| Permission denied / unavailable / timeout / approximate messages | Proved (component) | Real prompts, "Open Settings" deep link, "Allow Once" behaviour (A1–A7) |
| Pause / Resume / Finish / Discard, draft persistence, recovery offer | Proved (component + unit) | Force-quit recovery, >12 h expiry (C7–C8) |
| Offline save → retry once | Proved (component + server-action unit) | Airplane-mode save and later sync (D2) |
| Free vs Pro refusal on the server | Proved (action unit); trigger code-reviewed | Lapsed-Pro behaviour on device (D5–D6) |
| Treadmill / manual entry never touches location | Proved (component) | D8 |
| Background / locked-screen recording, blue pill / foreground notification | **Not possible here** | C1–C3, C9 (the main launch risk) |
| Interruptions (calls), Low Power Mode, battery, update rate | Not possible here | C5, C6, C10 |
| Native plugin present in the build at all | Not possible here (`npx cap sync` never run in this environment) | Pre-flight check in the script |
| Apple Health workout write | N/A (not implemented, by design) | E (confirm nothing is written) |
| e2e Playwright flows (signed-in) | **Blocked this session** (Supabase down) | — |

## 7. Remaining launch blockers in this area (ranked)

1. **Native background recording has never run on a phone** (plugin never synced into a build here; iOS web-view
   suspension and content-process termination risks in `docs/GPS_BACKGROUND_IPHONE.md`). Until script section C passes,
   the store listing must not promise locked-screen recording; the Run tab already says "the phone app is being prepared
   to keep recording with the screen locked".
2. **e2e and integration suites for GPS not executed this session** (infrastructure). Re-run `e2e/gps-run.spec.ts`,
   `tests/integration/gps-running.test.ts` and `tests/integration/activities.test.ts` once Docker is back.
3. Decide B3 (time away after a crash counted as moving time) before launch; a one-line change if the owner wants it paused.
4. Real-world accuracy figures are unknown (only controlled traces): keep marketing to "measured from your phone's GPS".
5. (Low) B4: the "Recording" pill after an abandoned permission-denied start.

## 8. Scores (0–10)

| Area | Score | Why |
| --- | --- | --- |
| Functionality | 8 | Complete recording flow, guided runs, goals, history, idempotent save, honest gap handling; background mode built but unverified; no auto-pause. |
| Reliability | 7 | Pure, well-tested state machine; offline/retry and recovery paths proved; the real unknowns are all native (JS suspension, process kills). |
| Security | 9 | Server-side plan gate in the action and the database, owner-only RLS, no API side door, deletion strips routes; only soft points are plain-text device drafts and no home privacy zone. |
| Accuracy | 8 | Within 1–3 % on synthetic and controlled traces with no invented distance across gaps; unproven against real GPS hardware. |

## 9. Test commands run (real results)

```
npx vitest run tests/unit/gps-track.test.ts tests/unit/gps-accuracy.test.ts tests/unit/gps-recorder.test.tsx \
  tests/unit/route-map.test.tsx tests/unit/run-session.test.ts tests/unit/activities.test.ts tests/unit/activity-week.test.ts
  → 7 files, 74 passed (baseline, before changes)
npx vitest run tests/unit/gps-audit-edge-cases.test.ts tests/unit/gps-save-action.test.ts        → 2 files, 40 passed
npx vitest run tests/unit/gps-recorder-audit.test.tsx -t "clock while paused"                     → 1 failed (bug B1, before the fix)
npx vitest run <the six GPS unit files>                                                            → 6 files, 90 passed (after the fix)
npx vitest run (full suite)                                                                        → 170 files passed, 49 skipped; 3,303 tests passed, 319 skipped
npx tsc --noEmit -p .                                                                              → exit 0
npx next build                                                                                     → "Compiled successfully", exit 0 (/run/record, /run/activities/[id] built)
npx eslint <changed files>                                                                         → clean
e2e / integration                                                                                  → not run (Docker daemon down; Supabase 127.0.0.1:54321 unreachable)
```
