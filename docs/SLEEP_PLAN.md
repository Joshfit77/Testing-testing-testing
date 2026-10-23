# Sleep, Circadian Rhythm & Recovery: implementation plan

_Prepared 2026-10-23 on `claude/sharp-cray-8y0uuv` after inspecting the repository. This is the plan the stages below
follow; `docs/SLEEP_METHOD.md` (written with Stage B3) documents the calculations and their versions._

## 1. Where it fits

- **Navigation.** A new section **Sleep & Recovery** under My Progress (`/progress/sleep`), with a shortcut card on
  Home. The five tabs (Home · Train · Run · Food · Faith) and the AI Coach header are unchanged.
- **Existing pieces it builds on** (reused, not replaced):
  - `recovery_checkins` (`/train/recovery`): one check-in a day with sleep quality, energy, soreness, stress and a
    readiness score, gated by `profiles.wellness_consent_at` ("optional wellness information"). Sleep logging and
    the new check-ins reuse that same consent.
  - `daily_steps` + `src/lib/native-health.ts`: the Apple Health / Health Connect read pattern (plugin availability
    check, permission request, day-bucketed samples, server-side validation of the window, `source` column).
  - `src/lib/native-reminders.ts`: local notifications with fixed id ranges; the alarm reuses this plugin.
  - The AI coach's tool set (`src/lib/coach/tools.ts`) and athlete snapshot (`src/lib/coach/context.ts`), which
    already carry the latest readiness check-in.
  - Migration conventions (`20261024000031_body_scans.sql` is the model): owner-only policies using
    `(select auth.uid())`, security-definer helpers with a pinned `search_path`, per-member limits under an advisory
    lock, `set_updated_at` trigger, column-level grants on `profiles`.
  - Coverage tests that must keep passing: `tests/unit/account-coverage.test.ts` (every new table is exported and
    cascades on deletion: add it to `USER_TABLES` in `src/server/services/account.ts`) and
    `tests/unit/rls-coverage.test.ts` (RLS on, no anon policies).

## 2. Data model (Stage B1, migration `20261024000034_sleep.sql`)

| Table / column | Purpose | Notes |
| --- | --- | --- |
| `sleep_sessions` | One night or nap | `id` generated on the device (retried saves can't duplicate). `kind` night/nap. `started_at` (in bed), `ended_at` (out of bed, null while a timed session runs), optional `onset_at` (estimated fell asleep), `final_wake_at`, `awakenings`, `awake_minutes`. `timezone` (IANA, as logged). `night_of` date (the local date of waking; the server computes it). `source` manual / timer / apple_health / health_connect / wearable, `source_id` for imported records, unique per user and source. Overlapping sessions are refused by an exclusion constraint (`btree_gist`), so duplicates and double imports can't both exist. Limits: 24 h max, at most 4,000 rows per member. |
| `sleep_stages` | Stage intervals supplied by a health platform or wearable | `stage` awake / light / deep / rem / unknown; never written by the app's own logic. |
| `sleep_checkins` | Morning and daily check-ins (Feature 11) | One row per user and day; every field optional; `disturbances` as a short list; sleep-aid as free text (not a recommendation). |
| `sleep_import_runs` | Each health-platform import | Source, window, counts of added / skipped-as-duplicate / skipped-as-conflict, so a failed import can be retried safely. |
| `profiles` | Settings | `sleep_goal_minutes` (240–720, default 480), `sleep_schedule_bedtime` / `sleep_schedule_wake` (optional targets), `sleep_alarm` JSON (Stage D2). |

Nothing computed is stored: nightly scores, sleep debt, windows and energy estimates are recalculated from the
sessions by versioned domain code, so an improved formula applies to history too, and no stale number can disagree
with the data. Sound events (Stage D3) get their own table when that stage is built.

## 3. Calculations (all deterministic, in `src/lib/domain/sleep.ts`)

- **Durations.** Time in bed = `ended_at − started_at`. Estimated time asleep = (`final_wake_at` or `ended_at`) −
  (`onset_at` or `started_at`) − `awake_minutes`. All arithmetic is on epoch milliseconds, so daylight-saving changes
  and time-zone travel never add or lose an hour; the stored `timezone` is only used to display clock times and to
  assign the night. Imported sessions keep their source's time zone offsets.
- **Night assignment.** A session belongs to the local date it ended on ("last night" is shown on the day you woke).
  Naps are listed under their own date and excluded from nightly figures.
- **Nightly score v1 (Plus detail, Free sees duration vs goal).** Weighted parts, each only when its inputs exist:
  duration vs goal, efficiency (needs onset or awake time), timing consistency vs the member's own 14-night median,
  awakenings (needs a count). Missing parts are left out and the score is scaled over the parts that exist, with a
  label saying what it was based on. Missing data never lowers a score.
- **Sleep debt v1 (Plus).** Rolling 14 nights: shortfall `max(0, goal − asleep)` adds in full; a night over the goal
  repays at half rate and only against outstanding debt; nights without data are skipped, not counted as zero sleep.
  Kept separate from the score.
- **Schedule windows (Plus).** From 14 nights of bed and wake times (median and spread): a suggested bedtime window
  (median wake − goal − typical time to fall asleep ± 30 min) and a wake window (median wake ± 15 min). With fewer
  than 3 nights only consistency guidance is shown, never a precise window.
- **Daily energy rhythm (Plus).** An hourly estimate from two stated assumptions (sleep pressure rising since
  waking; an early-afternoon dip and a late-evening wind-down) scaled by debt, drawn next to the reported energy
  check-ins so predicted and reported are never confused.

## 4. Stage order and dependencies

| Stage | Depends on | Delivers |
| --- | --- | --- |
| B1 Database + manual tracking | — | Migration, domain functions, timer and manual entry, edit/delete, history list, export/deletion coverage, unit + integration tests |
| B2 Dashboard + nightly report | B1 | `/progress/sleep`, `/progress/sleep/night/[date]`, Home shortcut |
| B3 Goals, score, history views | B1, B2 | Goal setting, score v1 with `docs/SLEEP_METHOD.md`, 7/30/90-day charts, empty states |
| B4 Import architecture | B1 | Native read of sleep sessions and stages (same plugin as steps), server-side dedupe/conflicts, `sleep_import_runs`, revocation and disconnect handling; device testing needed |
| B5 Check-ins | B1 | Morning + daily check-in form and history; associations shown as "on nights when…" |
| B6 Sleep debt + trends | B3 | Debt v1 page and card, trend views |
| C1 Schedule / circadian guidance | B3, B6 | Windows, consistency score, gradual adjustment plan |
| C2 Energy rhythm | C1, B5 | Hourly estimate + reported energy |
| C3 Habit coaching | B5, B6 | Rule-based recommendations with reasons, dismissible |
| C4 AI sleep coach | B3–B6 | Read-only `get_sleep_summary` tool for the existing coach; same consent and quotas |
| C5 Sleep × training | B6, adaptive training | Combined dashboard; suggestions go through the existing approval cards |
| C6 Advanced analytics | C1–C5 | Night/week/month charts on Sleep history for every range; weekday vs weekend comparison (Plus) with typical times and shifts (`sleep-analytics.ts`) |
| D1 Automatic detection | B4 | Health-platform sleep records are the automatic source; motion/microphone detection only if it can be made honest |
| D2 Wake-up alarm | B1 | Settings on the profile (`sleep_alarm`), `/progress/sleep/alarm`, weekly local notifications with Snooze and I'm up on the phone (`src/lib/native-alarm.ts`); the smart window is stored but not active until background detection exists |
| D3 Sound analysis | consent model | On-device only, events not audio; blocker documented if classification can't be made reliable |
| D4 Device verification | D1–D3 | Checklist for a physical phone |

## 5. Membership (proposal: needs the owner's approval before launch)

| Free | Plus | Pro |
| --- | --- | --- |
| Manual logging and the sleep timer, history, sleep goal, duration chart, simple schedule tracking (bed/wake times and consistency) | Nightly score detail, sleep debt, suggested windows, energy rhythm, longer comparisons | AI sleep coaching, sleep-and-training insights |

Implemented as two new feature keys (`sleep_analytics` on Plus, `sleep_ai_coaching` on Pro) so the split can be
changed in one place. Native automatic detection and the smart alarm are **not** assigned to a tier here; that is a
product decision to confirm.

## 6. What cannot be finished in this environment

- Anything on a physical phone: HealthKit / Health Connect sleep reads, alarm delivery, background audio or motion,
  battery use. These stages end as "Implemented, physical-device testing needed" or "Blocked".
- Live AI replies (the coach runs against a stand-in server here).

## 7. Phase D status (native work; nothing here is device-verified)

| Stage | Status | What exists | What is missing |
| --- | --- | --- | --- |
| D1 Automatic detection | Implemented, physical-device testing needed | Apple Health / Health Connect sleep records (with stages where the watch recorded them) are the automatic source: `src/lib/native-sleep.ts` reads them through the same plugin as steps, `sleep-import.ts` normalises them, the server de-duplicates by source id and refuses overlaps (B4). Watches and rings that write to the health platform are covered this way. | Detection from the phone's own motion or microphone is **not built**. It would need a native background service (a Capacitor plugin with iOS background modes / an Android foreground service), a published validation of its labelling, and battery testing; without those it could only invent sleep, so it is left out rather than faked. |
| D2 Wake-up alarm | Implemented, physical-device testing needed | Settings on the profile, `/progress/sleep/alarm`, weekly local notifications with Snooze and I'm up (`src/lib/native-alarm.ts`), exact-alarm handling on Android, honest "what to expect" notes. | Delivery on a real iPhone and Android phone (see `docs/SLEEP_DEVICE_CHECKLIST.md`). The smart window (sounding earlier in light sleep) needs D1's background detection and is **not active**: no alarm ever sounds before the set time. |
| D3 Sound analysis | Not started (design only) | Design: microphone levels sampled on the device while the timer runs, reduced on the phone to events (snoring-like, talking-like, loud noise; start, length, peak level) with **no audio stored or uploaded**; a separate opt-in consent; events shown on the nightly report; deleted with the night. | A native background audio plugin, a classifier whose accuracy has been measured on real recordings, iOS background-audio entitlement review, and battery measurement. Until a classifier has measured accuracy the feature would be guesswork, so no table, code or UI exists for it. |
| D4 Device verification | Blocked by external dependency | `docs/SLEEP_DEVICE_CHECKLIST.md`: step-by-step checks for a physical iPhone and Android phone, with the expected result of each. | A physical device with the Capacitor build installed. Nothing in this environment can run HealthKit, Health Connect or local notifications. |

