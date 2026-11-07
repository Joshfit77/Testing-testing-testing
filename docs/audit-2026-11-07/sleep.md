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

