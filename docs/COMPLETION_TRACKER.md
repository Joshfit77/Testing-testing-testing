# Completion tracker

Branch `claude/sharp-cray-8y0uuv`. Labels are only ever one of: **Complete and tested** · **Implemented,
physical-device testing needed** · **Partially complete** · **Blocked by external dependency** · **Not started**.
"Tested" means the named tests ran in this environment on the named commit; nothing here has run on a physical
phone, and the AI coach ran against a stand-in server, never a live model. Test totals are from the Stage E1
regression run recorded at the end of this file.

## Phase A: existing app corrections

| Stage | Label | Summary | Evidence |
| --- | --- | --- | --- |
| A1 Repository inspection and baseline tests | Complete and tested | Repository, branch and baseline suites inspected before any change; the E1 run below is the final baseline. | `docs/FOOD_IQ_FORM_GPS_REPORT.md` §Test results; E1 below |
| A2 Exercise form and animation corrections | Partially complete | Whole catalog rendered to contact sheets at six phases; 13 demonstrations corrected with form regression tests (limb lengths, joint limits, equipment contact, feet, floor, smoothness). Not reviewed by a qualified coach, which the report says plainly. | Commits `4f83cd3`, `f332817`, `25d5dc3`; `docs/exercise-review/`; report §2 |
| A3 Food IQ scoring and ingredient analysis | Partially complete | Scanner renamed Narrow Gate Food IQ; 0–100 score behind the `FOOD_IQ_SCORE` flag with a documented method and version; ingredient evidence entries with the eight fields; nutrient classes per serving and per 100 g; Fits Your Goals separate from quality. Live Open Food Facts lookups are mocked in tests. Flag stays off until the method is evaluated. | Commits `72676ad`, `b7b01c4`; `docs/FOOD_IQ_METHOD.md`; report §1 |
| A4 GPS corrections and diagnostics | Implemented, physical-device testing needed | Outlier rejection, standing-still rejection, gap handling without invented distance, Kalman-smoothed distance, diagnostics panel, controlled-trace error tests, browser-vs-native distinction, free map tiles. Locked-screen and native GPS unverified. | Commits `20cc8b9`, `e810c7e`; `docs/GPS_ACCURACY.md`; report §3 |
| A5 Verification of the nine major features | (filled from the E-phase review below) | | |
| A6 Security, subscription and data integrity | (filled from the E-phase review below) | | |

## Phase B–D: Sleep, circadian rhythm and recovery

Design: `docs/SLEEP_PLAN.md`. Member-facing method: `docs/SLEEP_METHOD.md`. Device checklist:
`docs/SLEEP_DEVICE_CHECKLIST.md`. Entry: My Progress → Sleep & Recovery, with a Home shortcut; the five tabs and
the AI Coach header are unchanged.

| Stage | Label | Implementation | Files | Migrations | Tests | Remaining / needs |
| --- | --- | --- | --- | --- | --- | --- |
| B1 Database and manual tracking | Complete and tested | `sleep_sessions` / `sleep_stages` with owner-only RLS, consent gate, overlap exclusion, 4,000-row cap; timer; manual entry with edit/delete | `src/lib/domain/sleep.ts`, `src/server/services/sleep.ts`, `src/server/actions/sleep.ts`, `src/components/sleep/{consent-card,timer-card,session-form,session-list}.tsx`, `progress/sleep/{page,log}` | `20261024000034_sleep.sql` | `tests/unit/sleep.test.ts`, `tests/integration/sleep.test.ts`, `e2e/sleep.spec.ts` | Commit `226a438` |
| B2 Dashboard and nightly report | Complete and tested | Dashboard, nightly report with "Not recorded" rows, Home shortcut, My Progress card | `progress/sleep/night/[date]`, `home/page.tsx`, `progress/page.tsx`, `night-bars.tsx` | — | `tests/unit/sleep-stats.test.ts`, e2e | Commit `226a438` |
| B3 Goals, scoring, history | Complete and tested | Goal 4–12 h; score v1 (duration 50 / efficiency 20 / timing 20 / awakenings 10, missing parts excluded); history 7d–1y; method page | `sleep-score.ts`, `sleep-stats.ts`, `goal-form.tsx`, `score-card.tsx`, `progress/sleep/{history,settings,method}` | — | `tests/unit/sleep-score.test.ts`, e2e | Commit `226a438` |
| B4 Health-platform and wearable import | Implemented, physical-device testing needed | Apple Health / Health Connect sleep (with stages) read on the device, normalised, de-duplicated by source id, overlaps refused, runs recorded; import can be switched off and imported entries deleted | `sleep-import.ts`, `native-sleep.ts`, `actions/sleep-import.ts`, `import-card.tsx` | `20261024000036_sleep_imports.sql` | `tests/unit/sleep-import.test.ts`, `tests/integration/sleep-imports.test.ts` | Commit `957ecea`; checklist §A |
| B5 Morning and daily check-ins | Complete and tested | One-tap restedness, full check-in, associations worded as "on N nights after X… not proof" | `sleep-checkins.ts`, `actions/sleep-checkins.ts`, `checkin-form.tsx`, `quick-checkin.tsx`, `progress/sleep/checkin` | `20261024000035_sleep_checkins.sql` | `tests/unit/sleep-checkins.test.ts`, `tests/integration/sleep-checkins.test.ts`, e2e | Commit `52e4850` |
| B6 Estimated sleep debt and trends | Complete and tested | Debt v1 over 14 nights (Plus), locked state for Free | `sleep-debt.ts`, `progress/sleep/debt` | — | `tests/unit/sleep-debt.test.ts`, e2e (locked state) | Commit `52e4850` |
| C1 Schedule and circadian guidance | Complete and tested | Windows v1 from chosen/typical wake time, 15 min/night shift, weekend drift (Plus) | `sleep-schedule.ts`, `target-wake-form.tsx`, `progress/sleep/schedule` | `20261024000037_sleep_schedule.sql` | `tests/unit/sleep-schedule.test.ts` | Commit `b45ad82` |
| C2 Daily energy rhythm | Complete and tested | Energy v1 hourly estimate with printed assumptions, next to reported energy (Plus) | `sleep-energy.ts`, `progress/sleep/energy` | — | `tests/unit/sleep-energy.test.ts` | Commit `b45ad82` |
| C3 Habit coaching | Complete and tested | Ten rules with evidence, max three, dismissible, no medication | `sleep-habits.ts`, dashboard | — | `tests/unit/sleep-habits.test.ts` | Commit `b45ad82` |
| C4 AI sleep coaching | Partially complete | `get_sleep_summary` tool and one-line snapshot in the existing coach, same consent and quota (Pro). Live model answers not verified (stand-in server only). | `server/coach/sleep-summary.ts`, `coach/tools.ts`, `lib/coach/{context,knowledge,tools}.ts` | — | existing coach unit tests; `tests/unit/sleep-training.test.ts` | Commit `f5d7c81`; needs a live model run |
| C5 Sleep and training integration | Complete and tested | Adaptive training sees last night and debt; easier-day suggestion through the existing accept/decline cards; Sleep & training page (Pro) | `sleep-training.ts`, `adaptive-training.ts` (lib + service), `progress/sleep/training` | — | `tests/unit/sleep-training.test.ts`, `tests/unit/adaptive-training.test.ts` | Commit `f5d7c81` |
| C6 Advanced analytics | Complete and tested | Night/week/month charts for every range; weekday vs weekend comparison with typical times and shifts (Plus) | `sleep-analytics.ts`, `trend-bars.tsx`, `progress/sleep/history` | — | `tests/unit/sleep-analytics.test.ts`, e2e | Commit `6fc61ad` |
| D1 Automatic sleep detection | Implemented, physical-device testing needed | Health-platform records are the automatic source (B4). Motion/microphone detection not built: it could only invent sleep without a validated native service. | as B4 | — | as B4 | Checklist §A; `SLEEP_PLAN.md` §7 |
| D2 Smart alarm and fixed-time fallback | Implemented, physical-device testing needed | Fixed-time weekly alarm with Snooze / I'm up on the phone, next alarms in the member's zone, exact-alarm handling on Android. Smart window stored but inactive: nothing sounds before the set time. | `sleep-alarm.ts`, `native-alarm.ts`, `alarm-form.tsx`, `progress/sleep/alarm`, `shell/native-init.tsx` | `20261024000038_sleep_alarm.sql` | `tests/unit/sleep-alarm.test.ts`, e2e | Commit `578c173`; checklist §B |
| D3 Nighttime sound analysis | Not started | Design only (on-device levels → events, no audio stored, separate consent). No native background-audio plugin or measured classifier exists. | — | — | — | `SLEEP_PLAN.md` §7 |
| D4 Native-device verification | Blocked by external dependency | Checklist written; needs a phone with the Capacitor build. | `docs/SLEEP_DEVICE_CHECKLIST.md` | — | — | A physical iPhone and Android phone |

Membership: sleep features sit under two new keys, `sleep_analytics` (Plus) and `sleep_ai_coaching` (Pro), as a
proposal; prices are untouched (Free $0 / Plus $11.99 / Pro $24.99). The owner decides the final split.

## Phase E: final quality assurance

(filled in as each stage completes)
