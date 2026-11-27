# Faith & Discipleship: Phase 1 inventory (before any change)

Recorded 2026-11-03.

- **Base branch:** `security/payment-hardening-prelaunch` at `cb831d2`, the newest branch. It contains
  `claude/exercise-demo-25d` (`03f815a`) plus 48 later commits.
- **Work branch:** `claude/faith-discipleship`, cut from that commit, keeps unfinished Faith work isolated from
  TestFlight preparation.

## What exists, and how it is reused

| Area | Where | Reused / extended |
| --- | --- | --- |
| Faith dashboard | `src/app/(app)/faith/page.tsx`: verse of the day, 40-day challenge, daily practices, prayer journal, recent entries, reminders link | Redesigned around "Today's Journey"; every existing section is kept and reachable |
| Daily Scripture | `scriptureForDate` (`src/data/content.ts`), `src/data/scripture.ts` (`ACTIVE_TRANSLATION_ID = "BSB"`) | Kept; the full Bible adds every other verse |
| BSB integration | `scripts/extract-bsb.mjs`, `scripts/bsb-references.json`, `.github/workflows/bsb-text.yml` (official `bsb.txt`, pinned SHA-256 `2ac3af1d…`), `src/data/bsb-passages.json` (68 passages) | Extended: the same workflow and pinned file now also build the whole Bible (`scripts/build-bsb-bible.mjs`); the 68 passages are cross-checked against it |
| 40-day challenge | `src/components/faith/faith-challenge.tsx`, `src/server/services/challenge.ts`, `src/data/devotionals.ts`; tables `challenge_enrollments`, `challenge_checkins` | Preserved unchanged; linked from Spiritual Growth |
| Prayer journal | `src/app/(app)/faith/journal`, `faith-forms.tsx`, `src/server/actions/faith.ts`; table `faith_journal_entries` (kinds reflection / request / praise, `scripture_ref`, `answered_on` / `answered_note`, `share_with_coach` off by default) | Extended in place: new kinds, archiving, search and filters. Existing rows are untouched |
| Answered prayers | `answered_on`, `answered_note`, `markPrayerAnsweredAction` | Reused for the answered-prayer timeline |
| Daily practices | `src/app/(app)/faith/practices`, `practices-panel.tsx`; tables `discipline_goals` (`practice` preset), `discipline_checkins` | Preserved; separate from the new journey |
| Faith reminders | `src/lib/faith-reminders.ts`, `src/lib/native-reminders.ts` (Capacitor local notifications, ids 5300–5326); table `faith_reminders` (devotional / prayer / practices) | Extended: new reminder kinds on the same table and scheduler |
| Attribution | `ScriptureNotice`, Terms; `docs/SCRIPTURE.md` | Kept; the reader shows the same attribution |
| AI | `src/server/services/ai-coach.ts`, `reserve_ai_usage` (coach quota; Free = 0) | Bible study uses its own table and allowance, so the fitness coach quota is untouched |
| Offline | `public/sw.js` (static assets only; never caches signed-in pages; not used inside the native app) | Extended for public Scripture files only |

All Faith tables have owner-only RLS (select / insert / update / delete where `user_id = auth.uid()`) and cascade
on account deletion. They are listed in `USER_TABLES` (export and deletion).

## Tests found

- **Unit:** `scripture`, `devotionals`, `faith-calendar`, `faith-reminders`, `practices`, `challenge`,
  `scripture-excerpt` and `coach-journal`; 49 tests, all pass on `cb831d2`.
- **Integration:** `challenges`.
- **e2e:** `challenge.spec.ts`, `faith-calendar.spec.ts`.

## Previous audit

`docs/audit/3-workouts-nutrition-progress-faith.md` rows 60–64 passed every check:
- BSB source;
- licensing notes;
- references;
- Free access with no paywall;
- owner-only writes.

## Gaps this phase fills

- The full Bible and the reader.
- Reading journeys with the strict daily rule and the automatic reset.
- The four daily activities.
- New reminder kinds.
- Journal categories and archiving.
- Memorization.
- Studies.
- AI Bible study.
