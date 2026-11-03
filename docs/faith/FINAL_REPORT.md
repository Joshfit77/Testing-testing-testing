# Faith & Discipleship: final report (2026-11-03)

Details of how everything works are in `README.md`; content for theological review is in `REVIEW.md`.

## 1. Branch

`claude/faith-discipleship`. It is based on `security/payment-hardening-prelaunch` at `cb831d2`, the newest
authoritative branch, which contains the earlier verified `claude/exercise-demo-25d` (`03f815a`) plus 48 later
commits (`PHASE1_INVENTORY.md`). Nothing was merged into `main`, nothing was deployed or published, and no pull
request was opened. Supporting branch: `bsb-bible-data` (`9e88eaf`), produced by the BSB workflow, holds the
validated Bible files that were copied into this branch.

## 2. Latest SHA

The head of `claude/faith-discipleship` (see `git log -1`). All commits are pushed.

## 3. Preserved

- The 40-day Faith & Fitness challenge: component, data, check-ins and e2e test (`e2e/challenge.spec.ts`) unchanged
  and passing.
- Prayer journal: every existing entry and kind, answered prayers, search, filters, edit and delete; "Share with AI
  Coach" still off by default. New kinds and archiving were added beside them.
- Daily practices, devotionals, Scripture by theme, verse of the day, Faith reminders (devotional, practices; the
  saved prayer reminder settings are kept), achievements, habits and all user records.
- Fitness: training programs, the subscription system, billing, entitlements and TestFlight configuration were not
  touched. The Fitness goal only reads the program and training log.
- Black-and-gold design, reused components and tokens throughout.

## 4. New

Complete BSB reader (search, highlights, bookmarks, notes, copy/share, text size, history, Continue Reading,
offline); reading journeys over 30/60/90/180/365 days in eight plan kinds with the strict daily rule and automatic
restart; the four daily activities on the Faith tab; reminders (reading, prayer, challenge, fitness, evening check,
last call, memory practice) with quiet hours; expanded prayer journal; Scripture memory; 26 guided studies; the
Bible study helper; a redesigned Faith tab. All of it is free.

## 5. Bible verification

From the official `bsb.txt`, SHA-256 `2ac3af1de52d4e68261cba91d85c320b7eadc6560e830d99e591767b8ff5ca96`, validated
against an independent canon: 66 books, 1,189 chapters, 31,102 verse numbers, 31,086 with text. The 16 the BSB
keeps in footnotes are recorded and shown as such, never filled in. Content checksum
`515ba91d9d4596b8a6595648eec097cd7458fd69ba30736eb5320cd01148afb1`. Verified by
`tests/unit/bible-dataset.test.ts`, including agreement with all 68 independently extracted passages the app
already quoted. Every verse shown anywhere is read from this dataset at render time.

## 6. Plan generation

Plans are divided by words; each covers its passages exactly once, in order (every plan kind × every length tested,
81 cases). The daily load table is in `README.md`. Plans too short for a length aren't offered (Philemon over 30
days; the Guided plan over 365).

## 7. Reset

Enforced in the database (migration 053): members can't write journey rows; check-ins, settlement, enrolment and
undo are `SECURITY DEFINER` functions. Settlement is idempotent and serialized per journey, runs every 15 minutes
via `pg_cron` (so it doesn't depend on the app being opened) and on every Faith page load and check-in, and uses
the member's saved time zone. A missed day marks the attempt interrupted with the date and reason and starts Day 1;
nothing is deleted; a long absence produces one interruption. Offline rule: a check-in counts only for the day it
happened and only if it arrives within 3 hours after that local midnight (or before an online check-in for the new
day); otherwise it is refused and the member is told. Tested against the real database: midnight, grace window,
DST (both changes), Auckland, long absence, concurrency, duplicates, every duration run to completion, nothing
deleted on reset (23 tests), plus the restart end to end in the browser.

**Hosted setup needed:** `pg_cron` must be enabled on the hosted Supabase project for the 15-minute job. The
migration schedules it if the extension is available and otherwise only logs a notice; settlement on page load and
check-in still applies the rule either way.

## 8. Reminders

Each kind has its own time and days, all off by default. Tracked kinds are scheduled per date for the next week in
the saved time zone (DST-safe), one per kind per day, never inside quiet hours, left out once today's activity is
done and cancelled on the device when it is marked done. The evening and last-call reminders only apply while a
journey is active. Reuses the existing Capacitor local-notification setup, with its own id range (5500-5566;
an overlap with the sleep alarm was found by the tests and fixed). Limitation: completion on another device reaches
this device only when the app is next opened there. **Not verified on a physical device.**

## 9. Daily goals

Bible reading and prayer (required for the journey, marked only by the member), Faith challenge (optional, 30
challenges each tied to a verified passage), Fitness (optional; reads the program's workout or rest day and the
training log, never changes them). The optional two never restart a journey (tested).

## 10. Migrations

One migration, `20261103000053_faith_discipleship.sql`: new tables, helper and rule functions, RLS, grants, indexes,
the `pg_cron` job. Additive: two existing check constraints were widened (journal kinds, reminder kinds) and
`faith_journal_entries.archived_at` was added; no existing data is changed. `supabase/setup-all.sql` regenerated.
Applied and exercised on the local Supabase only.

## 11. Privacy

Owner-only RLS on every new table (read-only for journeys, check-ins and AI usage); all new tables in account export
and deletion; cross-member isolation tested. Offline storage holds Scripture only; the offline check-in queue holds
activity and time, no prayer text, and is cleared at sign-out. The Bible helper never receives the journal, notes or
account data. The privacy policy draft is version-locked and was not edited; proposed wording for counsel is in
`README.md`.

## 12. Free-account tests

Every Faith e2e test signs up a new Free account: reader, offline, journeys, restart, goals, memory, studies, journal
and the Bible helper (free quota: 10 a day, 60 a month).

## 13. Automated test results (this environment, local Supabase, production build)

| Check | Result |
| --- | --- |
| TypeScript (`tsc --noEmit`) | Pass |
| ESLint | 0 errors; 1 warning that predates this work (`plan-locked.tsx`) |
| Unit (vitest) | 144 files, 2,991 tests passed |
| Integration (real local database) | 45 files, 302 passed; 1 skipped (live Open Food Facts test, needs a network flag) |
| Production build | Pass |
| End to end, full suite (Pixel 7 profile) | 93 passed, 2 failed, 17 skipped |
| Faith e2e on the final code (`bible-reader`, `faith-journey`, `challenge`, `faith-calendar`) | 9 of 9 passed |

The 2 full-suite failures: `faith-calendar` (two links named "History" on the Faith tab, caused by this work; fixed,
now passing) and `journeys.spec.ts:182` (Train exercise-list scroll position), which fails the same way on the base
commit `cb831d2` before any of this work. It was not changed. The 17 skips are existing environment conditions:
demo-mode server, the Open Food Facts mock, and an unconfigured-AI case. The Bible helper was tested only against a
local stand-in for the AI API; it has not been run against the real API.

Found afterwards while capturing the iPhone-size demo, and fixed:

- In a long chapter the verse action bar (highlight, note, copy, share, memorize) was drawn at the bottom of the
  chapter instead of the screen, so it couldn't be seen after tapping a verse. Cause: the page entrance animation
  leaves a `transform` on the page container, which turns `position: fixed` into "fixed to the page". The bar is now
  rendered into `<body>`; `bible-reader.spec.ts` checks it is fully on screen (2 of 2 passed). The existing
  celebration effect (`components/common/celebration.tsx`) uses the same pattern and was not changed.
- The Guided studies page was wider than the phone (one long description stretched the grid): fixed.
- At the largest text size on a 375-point screen, the My Bible tabs and the memory practice toggle were wider than
  the screen: they now wrap.
- The phone sweep (`phone-sweep.spec.ts`: every signed-in screen from the iPhone SE to the Pro Max, largest text,
  reduced motion) now includes the new Faith screens; 1 of 1 passed after these fixes.

## 14. Physical iPhone tests needed

- Notifications: each reminder kind fires at its time; none after the activity is done; quiet hours; a DST change;
  permission prompts; the sleep alarm still works with Faith reminders on.
- Offline: "Read the Bible" from the app's offline page (bundled reader at `capacitor://localhost`); an offline
  check-in sent on reconnect.
- Share sheet and copy in the WebView; text size; safe areas and the verse action bar above the tab bar; long
  chapters (Psalm 119) scrolling.
- The journey across a real midnight in the device's time zone.

## 15. Remaining

- Theological review of everything in `REVIEW.md`; approve studies one by one to publish their notes.
- Study notes for the 22 studies that have passages only (the Gospel study is fully drafted).
- Enable `pg_cron` on the hosted project; counsel to update the privacy policy.
- Optional: server push so a completion on one device silences reminders on another.
- Run the Bible helper against the real API with a review set (cost and answer quality), as was done for the coach.
- Android device checks.

## 16. Content needing theological review

See `REVIEW.md`: journey wording and reminder texts, chronological and topic plans, the 30 daily challenges, the
study catalogue and the drafted Gospel lessons (and the sensitive Christian-living studies), the Bible helper's
instructions, and the footnoted-verse note.
