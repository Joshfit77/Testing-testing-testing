# Sleep, recovery and Apple Health audit (2026-11-07)

Worktree: `.claude/worktrees/agent-a64d537e0ac0c4eec`, branch `worktree-agent-a64d537e0ac0c4eec`, based on
`claude/faith-discipleship` @ 59c854e. Owner's hard rule for this area: never generate sleep metrics the data does not
support; recommendations must distinguish measured observations from estimates.

Environment note: the Docker daemon was not running when this audit started (`docker info` → "Cannot connect to the
Docker daemon"; `curl http://127.0.0.1:54321/rest/v1/` → 000). Integration tests (tests/integration/sleep*.test.ts)
and Playwright e2e (e2e/sleep.spec.ts) therefore could NOT be run in this worktree; they are reported as "not run"
below, never as passed. Everything else was verified with vitest unit tests, `tsc`, eslint and code reading.

## 1. Inventory

### Pages (`src/app/(app)/progress/sleep/`)
| Route | File | Purpose |
| --- | --- | --- |
| /progress/sleep | page.tsx (316 lines) | Hub: last night, score card, goal, timer, source card, import card, quick check-in, tips |
| /progress/sleep/log | log/page.tsx | Manual night/nap entry (session-form) |
| /progress/sleep/night/[date] | night/[date]/page.tsx | One night's report: durations, stages timeline, vitals, check-in |
| /progress/sleep/history | history/page.tsx | 7/30/90/365-day trends, weekday vs weekend (Plus), habit patterns |
| /progress/sleep/debt | debt/page.tsx | Estimated sleep debt over 14 nights (Plus) |
| /progress/sleep/energy | energy/page.tsx | Estimated daily energy curve (Plus) |
| /progress/sleep/schedule | schedule/page.tsx | Suggested bedtime/wake windows, consistency (Plus) |
| /progress/sleep/checkin | checkin/page.tsx | Morning check-in form |
| /progress/sleep/alarm | alarm/page.tsx | Wake-up alarm (native notifications) |
| /progress/sleep/settings | settings/page.tsx | Goal, consent, import, target wake time, data deletion |
| /progress/sleep/training | training/page.tsx | Sleep ↔ training-load view |
| /progress/sleep/method | method/page.tsx | In-app rendering of the method |
| /train/recovery | train/recovery/page.tsx | Readiness check-in (uses sleep hours self-report) |

### Components (`src/components/sleep/`)
alarm-form, checkin-form, consent-card, goal-form, import-card, night-bars, quick-checkin, score-card, session-form,
session-list, source-card, stage-timeline, target-wake-form, timer-card, trend-bars, vitals-cards. Also
`src/components/recovery/checkin-form.tsx` (readiness) and `src/components/coach/ai-consent-card.tsx` (AI consent
mentions sleep).

### Domain logic (`src/lib/domain/`, pure, unit-tested)
sleep.ts (calc v1: validation, nightOf, durations, overlap, DST-safe zoned time, circular medians, summarizeNights),
sleep-score.ts (score v1), sleep-debt.ts (debt v1), sleep-stats.ts (typical times), sleep-schedule.ts (schedule v1),
sleep-energy.ts (energy v1), sleep-analytics.ts (analytics v1), sleep-habits.ts (habits v1), sleep-alarm.ts (alarm v1),
sleep-checkins.ts, sleep-import.ts (HealthKit / Health Connect mapping, stage dedupe, vitals summary),
sleep-training.ts, readiness.ts (training readiness from the recovery check-in).

### Native / platform wiring
`src/lib/native-health.ts` (Capacitor plugin bridge: HealthKit / Health Connect availability, permission, read),
`src/lib/native-sleep.ts` (import orchestration from the device), `src/lib/native-alarm.ts`,
`src/lib/native-notifications.ts`, `src/components/shell/native-init.tsx`.
iOS: `ios/App/App/Info.plist`, `ios/App/App/App.entitlements`, `ios/App/App/PrivacyInfo.xcprivacy`,
`ios/App/CapApp-SPM/Package.swift`. Android: `android/app/src/main/AndroidManifest.xml`,
`android/app/capacitor.build.gradle`, `android/capacitor.settings.gradle`.

### Server
Actions: `src/server/actions/sleep.ts` (save/delete sessions, timer, goal, alarm, tips), `sleep-import.ts` (persist
imported sessions, stages, vitals; import runs), `sleep-checkins.ts`, `recovery.ts` (readiness check-in), `profile.ts`
(sleep goal / consent). Services: `src/server/services/sleep.ts` (reads), `notifications.ts` (planner persistence),
`ai-coach.ts`. Coach: `src/server/coach/sleep-summary.ts`, `snapshot.ts`, `tools.ts`; `src/lib/coach/prompt.ts`,
`src/lib/coach/tools.ts`, `src/lib/coach/knowledge.ts`. Notifications: `src/lib/notifications/planner.ts`,
`catalog.ts`. API route: `src/app/api/health/route.ts` (this is the service health check, NOT Apple Health; there is
no HTTP Apple Health endpoint — imports go through the server action from the native bridge).

### Database (supabase/migrations)
| Migration | Contents |
| --- | --- |
| 20261024000034_sleep.sql | `profiles.sleep_goal_minutes` (240–720); `can_log_sleep()` (requires wellness consent); `sleep_sessions` (checks: ended>started, ≤24 h, onset/final-wake ordering, source↔source_id, `unique (user_id, source, source_id)`, GiST `exclude` on `tstzrange(started_at, overlap_until)` per user → DB-level overlap refusal; `overlap_until` trigger = ended_at or +20 h for running timers); `sleep_stages` (stage enum, ≤24 h, insert only for own imported session); RLS select/insert/update/delete own; 4,000-session cap trigger |
| 20261024000035_sleep_checkins.sql | `sleep_checkins` (1–5 ratings, habit booleans, disturbances enum array, notes ≤280); RLS own + consent on write |
| 20261024000036_sleep_imports.sql | `sleep_import_runs` (source, range, added/duplicates/conflicts counts, device); RLS own |
| 20261024000037_sleep_schedule.sql | `profiles.sleep_tips_dismissed`, target wake |
| 20261024000038_sleep_alarm.sql | `profiles.sleep_alarm` jsonb |
| 20261024000039_sleep_hardening.sql | size caps on alarm/tips jsonb; limit triggers skip other users' rows; 1,000-stage-per-session cap |
| 20261024000041_sleep_vitals.sql | `device_name`, hr_*/hrv_*/rr_* columns with plausibility checks; `sleep_sessions_vitals_imported_check` (manual/timer rows can never carry vitals or device name); shape checks; `sleep_import_runs.updated/with_vitals`; `profiles.sleep_import_source` |

### Docs
docs/SLEEP_METHOD.md (method, versions), docs/SLEEP_PLAN.md, docs/SLEEP_DEVICE_CHECKLIST.md, docs/WEARABLES.md,
docs/SLEEP_AND_PRELAUNCH_REPORT.md.

### Existing tests
Unit (tests/unit): sleep, sleep-score, sleep-debt, sleep-stats, sleep-schedule, sleep-energy, sleep-analytics,
sleep-habits, sleep-alarm, sleep-checkins, sleep-import, sleep-training, sleep-session-form (tsx), native-sleep,
health-route. Integration (tests/integration): sleep, sleep-checkins, sleep-imports. E2E: e2e/sleep.spec.ts.
Added by this audit: tests/unit/sleep-audit.test.ts (15 cases), tests/unit/sleep-import-action.test.ts (6 cases).

## 2. Workflows tested

All "how" entries are unit tests or code reading unless stated. Integration and e2e need the local Supabase, which
was down (Docker daemon not running); they are listed as not run.

| Workflow | How | Result |
| --- | --- | --- |
| Apple Health import: in-bed envelope vs stage samples → time in bed / asleep, onset, final wake, awake minutes, awakenings, device name; stage minutes never exceed the night | sleep-audit.test.ts "maps the in-bed envelope…" + existing sleep-import.test.ts | Pass |
| Phone-only record (in bed, nothing else) → no onset, no efficiency, no wake-ups, no stages; score "based on duration" only | sleep-audit.test.ts | Pass |
| Overnight vitals: none / implausible → null, not zero; partial → only the series with samples | sleep-audit.test.ts | Pass |
| Re-import idempotency (same ids on second read; server skips known ids; vitals filled only where missing; never overwrites) | sleep-import-action.test.ts "adds nothing on a re-import…" | Pass |
| Overlapping records (hand entry vs import; platform re-labels a record) → skipped as conflict, never merged | sleep-import-action.test.ts | Pass |
| Partial / malformed records rejected individually; stray stage intervals outside the night dropped | sleep-import-action.test.ts | Pass |
| Split night (two platform records >30 min apart) → two sessions, summed as one night | sleep-audit.test.ts | Pass |
| Imported daytime nap kept out of the night (new rule) | sleep-audit.test.ts, sleep-import-action.test.ts | Pass after fix (failed before: see Bug 1) |
| Manual logging validation: end before start, crossing midnight, over 24 h, nap over 6 h, DST spring night (7 real hours for 8 clock hours) | sleep-audit.test.ts + existing sleep.test.ts | Pass |
| Durations across autumn DST (9 real hours), nightOf by zone (Tokyo vs New York for the same instants) | sleep-audit.test.ts + sleep.test.ts | Pass |
| Sleep debt with missing nights (11 of 14 unlogged → no change, nothing invented), in-bed-only nights flagged, empty window → nothing to say | sleep-audit.test.ts + sleep-debt.test.ts | Pass |
| Weekly/monthly trends with empty buckets, weekday vs weekend, typical times need 3 nights | existing sleep-analytics.test.ts, sleep-stats.test.ts | Pass |
| Bedtime ("wind down") reminder: quiet hours suppress it, times follow the account zone, device zone ≠ account zone | existing notification-planner.test.ts | Pass |
| Alarm next-times in the profile zone | existing sleep-alarm.test.ts | Pass |
| AI coach stage summary: device without stage detail → deep/REM/light null | sleep-audit.test.ts "stage shares…" | Pass after fix (Bug 2) |
| AI coach payload content | Code reading of src/server/coach/sleep-summary.ts | Only computed figures from the same domain code as the pages; check-in notes, sleep-aid text and session notes are NOT sent; every estimate is labelled ("An estimate from entries, not a measurement"); rules forbid inventing figures, diagnosing or comparing with population norms |
| Native read path (readRecentSleep) | existing native-sleep.test.ts (plugin mocked) | Pass; newest-first within limit; Android denial messages; iOS silent-denial message; no-op on web |
| Full unit suite | `npx vitest run` | 169 files passed, 49 skipped (integration, no Supabase); 3,271 tests passed, 319 skipped |
| Typecheck / lint | `npx tsc --noEmit -p .`; `npx eslint` on changed files | Clean |
| Integration tests (tests/integration/sleep*.test.ts) | — | NOT RUN: Docker daemon down, Supabase at 127.0.0.1:54321 unreachable |
| E2E (e2e/sleep.spec.ts) | — | NOT RUN: needs Supabase for sign-up |

Failure scenarios tested: see rows above (bad payload, unknown zone, no consent, import switched off, backwards
record, >24 h record, overlapping record, re-labelled record, implausible vitals, empty debt window, no nights).

## 3. Bugs found

| # | Severity | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| 1 | Medium (accuracy; owner's hard rule) | Every imported record was stored as `kind: "night"`. `summarizeNights` adds up all night sessions of one `night_of`, so an afternoon nap recorded by a watch on day D was summed into "last night" of D: a 7h30 night + 1h nap showed as 8h30 asleep, inflated the goal %, the score, the debt and every average. | src/server/actions/sleep-import.ts:163 (was `kind: "night"`); probe test showed 510 min for the two records; docs/SLEEP_METHOD.md promised "naps … never counted in nightly figures" | Fixed: `importedSessionKind()` (≤3 h starting 9 AM–8 PM local → nap) in src/lib/domain/sleep-import.ts, used by the action; method doc updated; regression tests in sleep-audit.test.ts and sleep-import-action.test.ts |
| 2 | Medium (AI invents a metric) | `describeRecorded` in the coach summary reported `deep: "0m", rem: "0m", light: "0m"` whenever a device recorded sleep without stage detail (phone-only or WHOOP-style "asleep" records), so the model could tell an athlete they had "no deep sleep". | src/server/coach/sleep-summary.ts (old `shares()` used `minutes.deep ?? 0`) | Fixed: pure `stageShares()` returns null for stages the device never recorded plus a `stage_detail` sentence; test "reports deep, REM and light as unknown (null), not zero" |
| 3 | Low (labelling) | Debt table's "Asleep" column showed time in bed for nights without detail with no marker; `DebtDay` had no estimated flag. | src/app/(app)/progress/sleep/debt/page.tsx:103 | Fixed: `DebtDay.estimated`, "in bed" marker, explanatory sentence; coach gap note now also covers a mix of in-bed-only and detailed nights |
| 4 | Low (estimate from nothing) | Daily energy drew a full hour-by-hour curve from an assumed 7:00 AM wake time when no night was logged and no wake time existed (disclosed in small text). | src/app/(app)/progress/sleep/energy/page.tsx (`w.anchorWake ?? 7 * 60`) | Fixed: the curve section is replaced by a "nothing to estimate from yet" notice until a night or a wake time exists |
| 5 | Low (labelling) | Readiness score (0–100) had no statement that it is derived from four self-ratings. | src/app/(app)/train/recovery/page.tsx | Fixed: one-line note |
| 6 | Low (wording) | Import summary said "skipped (overlap an entry you made)" although the overlap may be with an earlier import. | sleep-import.ts:229 | Fixed wording |
| 7 | Low (not fixed) | A night logged as two sessions where only one has fell-asleep/awake detail: `asleepEstimated` is false for the whole night and efficiency = (detailed asleep + other part's time in bed) ÷ time in bed, slightly overstated. | src/lib/domain/sleep.ts:360-374 | Open; rare (needs a split night with mixed detail). Suggest `asleepEstimated = parts.some(...)` or per-part labelling |
| 8 | Low (not fixed) | Imported sessions take the device's zone at import time for all 14 days; after travel, older nights get the new zone (clock times and `night_of` shift by a day in extreme cases). HealthKit carries a per-sample time zone in metadata that the plugin does not expose. | src/lib/native-sleep.ts:96 | Open; document, or store per-session zone when the plugin exposes `HKMetadataKeyTimeZone` |
| 9 | Low (not fixed) | Hub "Last night" shows the stage total ("asleep (recorded)") while the goal % and score beside it use the session's asleep minutes (onset→final wake − awake); the two can differ by gap minutes between stage intervals. | src/app/(app)/progress/sleep/page.tsx:178 vs :98-99 | Open; cosmetic inconsistency, both figures are device-derived |
| 10 | Low (not fixed) | Profile zone vs device zone: hub/debt/week windows use the profile zone's "today"; a session logged in a device zone ahead of the profile zone can carry `night_of` = tomorrow and drop out of "This week" and the debt window until the profile zone is updated. | page.tsx:48,94-101 | Open; a profile-zone mismatch prompt exists elsewhere in the app |

## 4. Security, data isolation, subscription enforcement

- RLS: every sleep table (`sleep_sessions`, `sleep_stages`, `sleep_checkins`, `sleep_import_runs`) is owner-only for
  select/insert/update/delete; inserts/updates additionally require `can_log_sleep()` (wellness consent); stage inserts
  require the parent session to be the member's own imported session. Viewing/deleting never needs consent, so
  withdrawing consent never traps data. Limit triggers skip rows that aren't the caller's so another member can't take
  a victim's advisory lock. (Policy text verified by reading migrations 34–41; the integration tests that exercise them
  could not run here.)
- DB constraints back the owner's rule: manual/timer rows cannot carry vitals or a device name
  (`sleep_sessions_vitals_imported_check`); vitals have plausibility and shape checks; `(source in manual/timer) =
  (source_id is null)`; overlaps are refused for every source by a GiST exclusion constraint; imports are unique per
  (user, source, source_id).
- Server actions re-check consent and the import switch (`importSleepAction`), validate every record with the same
  domain validator as manual entry, sanitise the device name (control characters stripped), cap sessions per
  import (200), stages per session (500) and the range (93 days).
- Subscription: `sleep_analytics` (debt, energy, schedule, score breakdown, weekday/weekend) and `sleep_ai_coaching`
  are checked server-side in the page components via `getUserPlan(user.id)` + `hasFeature`; locked pages render
  `PlanLocked`. The coach tool `get_sleep_summary` runs inside the AI coach, whose access is gated separately. No
  client-side plan state is trusted for these.
- Privacy: the coach summary excludes check-in notes, sleep-aid text and session notes; raw heart-rate samples never
  leave the phone (only per-night averages). Prayer content is not part of this area.

## 5. Browser-tested vs needs a physical device

| Capability | Browser / unit | Physical device |
| --- | --- | --- |
| Manual logging, timer, nightly report, history, debt, energy, schedule, check-ins, tips, method page | Unit-tested domain code; pages typecheck; e2e spec exists but NOT RUN this session (Supabase down) | n/a |
| Apple Health read (HealthKit permission sheet, sample shapes, `asleepCore`→light mapping, silent read denial) | Plugin mocked in native-sleep.test.ts; plugin's Swift mapping read in node_modules (`asleepCore`→`light`, `asleepUnspecified`→`asleep`, each sample emitted with a one-element `stages` array) | NEEDS iPhone (iOS 16+/17+) with a watch: checklist A1–A15 in docs/SLEEP_DEVICE_CHECKLIST.md, none run |
| Health Connect read (denial reporting, stage lists) | Mocked | NEEDS Android 13+/14 with Health Connect and a Fitbit/Pixel/Samsung/Oura source: A1–A15 |
| iOS entitlements (`com.apple.developer.healthkit`), `NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription`, PrivacyInfo `NSPrivacyCollectedDataTypeHealth`, SPM `CapgoCapacitorHealth` | Present and consistent (read by file) | Build + App Review on device |
| Android manifest: unused health permissions removed via `tools:node="remove"`; capgo module linked | Present (read by file) | Merged-manifest check on a real build |
| Wake-up alarm (weekly repeating notifications ids 5401–5407, snooze 5410) | sleep-alarm.test.ts | NEEDS device: B1–B10 |
| Bedtime wind-down reminder (planner, quiet hours, zones) | notification-planner.test.ts | Delivery timing on device after a DST change (schedule is rebuilt only when the app opens) |
| Background sync | Not built (documented as blocked by the plugin) | n/a |

## 6. Remaining launch blockers in this area (ranked)

1. No physical-device verification of HealthKit / Health Connect import or the alarm (docs/SLEEP_DEVICE_CHECKLIST.md
   A1–A15, B1–B10 all unrun). Until then the feature must stay labelled "needs a physical iPhone/Android".
2. Integration tests for the sleep tables (RLS, exclusion constraint, vitals constraints) were not run in this audit
   because local Supabase was down; the lead should re-run `npx vitest run tests/integration/sleep` once Docker is up.
3. e2e/sleep.spec.ts not run for the same reason.
4. Open low findings 7–10 above (mixed-detail split nights, import zone after travel, hub stage-total vs session
   figure, profile-zone vs device-zone window edge).

## 7. Scores (0–10)

- Functionality: 8 — complete logging, import, report, trends, debt, schedule, energy, alarm, coach tool; native paths
  unverified on hardware.
- Reliability: 7 — idempotent import with DB-level uniqueness and overlap exclusion, every number from tested pure code;
  integration/e2e not re-run here; zone edge cases open.
- Security: 8 — owner-only RLS with consent on writes, server-side plan checks, no private text to the AI; could not
  execute the RLS integration suite in this session.
- Accuracy: 7 → 8 after fixes — two real violations of the owner's rule were found and fixed (imported naps inflating
  nights; "0m deep/REM" sent to the coach); labelling of in-bed-only figures is now consistent across debt, hub, report
  and coach; remaining gaps are the open low findings.

