# Faith & discipleship

Everything in the Faith tab is free on every plan. This page describes how it works; `REVIEW.md` lists the content
that needs theological review before release, and `PHASE1_INVENTORY.md` records what existed before this work.

## What a member can do

| Area | Where | Notes |
| --- | --- | --- |
| Today | Faith tab, first card | The journey's required Bible reading and prayer, plus the optional Faith challenge and Fitness goal. |
| Bible reader | `/faith/bible`, `/faith/bible/<book>/<chapter>` | All 66 books and 1,189 chapters of the BSB. Verse selection, four highlight colours, verse and chapter bookmarks, private notes, copy and share (exact words plus the reference), save to memory, text size, previous/next across books, Continue Reading, reading history. |
| Search | `/faith/bible/search` | References ("Romans 8:28–30", "Ps 23", "Jude 3") and whole-word or "quoted phrase" keyword search, with an Old/New Testament filter and paging. |
| My Bible | `/faith/bible/saved`, `/faith/bible/history` | Bookmarks, highlights, notes; chapters opened by day. |
| Offline | Bible page → Save for offline | See "Offline" below. |
| Reading journeys | `/faith/journey` | Guided, Gospels, New Testament, Old Testament, Chronological, Whole Bible, one book, or a topic, over 30, 60, 90, 180 or 365 days, from a chosen start date (today to 30 days ahead). |
| Prayer journal | `/faith/journal` | Daily prayer, requests, prayer for others, praise and thanksgiving, confession, reflections; answered-prayer timeline; search and filters; archive; edit and delete. Private by default. |
| Scripture memory | `/faith/memory` | Hidden-word practice, reference recall, spaced reviews. |
| Guided studies | `/faith/studies` | 26 studies (foundations, Christian living, books). |
| Bible study helper | `/faith/ask` | An AI helper, separate from the fitness coach. |
| Reminders | `/faith/reminders` | See "Reminders" below. |
| 40-day challenge, practices, devotionals, Scripture by theme | Faith tab | Unchanged. |

## The daily rule

A journey needs **both** Bible reading and prayer every local calendar day. The member marks each one complete
themselves (opening a chapter never marks anything). If a day ends without both, the current attempt is marked
interrupted (with the date and what was missing) and a new attempt starts at Day 1. Reading history, notes,
highlights, bookmarks, journal entries, workouts and every earlier attempt are kept.

The rule is shown before joining and must be acknowledged:

> If you miss your daily Bible reading or prayer, your current journey restarts at Day 1. Your previous reading
> history and notes will still be saved.

After a restart the member sees "Your journey begins again today. God's mercies are new every morning. —
Lamentations 3:22–23", with the BSB text of the passage. The wording never ties a missed day to salvation or God's love.

### Where it is enforced

All of it is in the database (`supabase/migrations/20261103000053_faith_discipleship.sql`). Members can read their
journey rows but cannot write them; every change goes through `SECURITY DEFINER` functions:

- `faith_journey_check_in(activity, occurred_at)` records reading or prayer for the member's own local date.
- `faith_journey_settle_at(journey, now, force_through)` applies the rule, idempotently, serialized on the journey row
  (`FOR UPDATE`), so several devices and the scheduled job can't double-count or double-reset.
- **Automatic:** `pg_cron` runs `faith_journeys_settle_due()` every 15 minutes, so a reset happens whether or not the
  app is opened. Every Faith page load and every check-in settle the member's own journey too.
- Days follow the member's saved time zone (`profiles.timezone`); an invalid zone falls back to UTC. Midnight, the
  two DST changes, far-east time zones and long absences are covered by `tests/integration/faith-journeys.test.ts`.
- A long absence produces one interruption, not one per missed day: a restarted attempt with nothing done simply
  moves its Day 1 forward.

### Offline rule (abuse-resistant, nothing silently lost)

A check-in made without a connection is kept on the device (activity and time only, no prayer text, under the
member's draft key so sign-out clears it) and sent with the time it was made when the connection returns.

- It counts for the day it was made, never another day.
- A day becomes final **3 hours after local midnight** (the grace period lets a phone that was offline at midnight
  deliver what it recorded in time), or as soon as the member checks in online for the new day.
- After that it is refused with `faith_offline_too_late`, and the member is told it couldn't count. It is never moved.
- Times in the future, or more than a day old, are refused.

## Reading plans

`src/lib/bible/plans.ts` divides each plan by words, not chapters, so days are balanced:

- With at least one chapter per day, days end at chapter ends (whole chapters only).
- With fewer, days end at verse boundaries, preferring a chapter end within 20% of the balanced cut.
- At least 3 verses a day; a plan too short for a length isn't offered (Philemon over 30 days).
- Estimated time assumes 200 words a minute. The chooser shows each length's average minutes, chapters a day and
  longest day before enrolling.
- `tests/unit/bible-plans.test.ts` checks every plan kind at every length: complete, in order, each verse once.

Daily load (from the plan generator, BSB word counts):

| Plan | 30 days | 60 | 90 | 180 | 365 |
| --- | --- | --- | --- | --- | --- |
| Whole Bible | 39.6 ch, ~121 min | 19.8 ch, ~60 min | 13.2 ch, ~40 min | 6.6 ch, ~20 min | 3.3 ch, ~10 min |
| Chronological | 39.6 ch, ~121 min | 19.8 ch, ~60 min | 13.2 ch, ~40 min | 6.6 ch, ~20 min | 3.3 ch, ~10 min |
| Old Testament | 31 ch, ~92 min | 15.5 ch, ~46 min | 10.3 ch, ~31 min | 5.2 ch, ~15 min | 2.5 ch, ~8 min |
| New Testament | 8.7 ch, ~29 min | 4.3 ch, ~14 min | 2.9 ch, ~10 min | 1.4 ch, ~5 min | 0.7 ch, ~2 min |
| Gospels | 3 ch, ~13 min | 1.5 ch, ~7 min | 1 ch, ~4 min | 0.5 ch, ~2 min | 0.2 ch, ~1 min |
| Guided (NT + Psalms + Proverbs) | 14.7 ch, ~38 min | 7.3 ch, ~19 min | 4.9 ch, ~13 min | 2.5 ch, ~6 min | not offered |

## The four daily activities

1. **Bible reading** (required for a journey): marked complete only by the member's tap.
2. **Prayer** (required for a journey): marked complete by the member; writing a prayer is optional and never
   decides whether the day counts.
3. **Faith challenge** (optional): a small act grounded in a passage (`src/data/faith-challenges.ts`); the verse text
   shown comes from the BSB dataset.
4. **Fitness** (optional): reads the active training program (a workout or a rest day; rest counts) and the training
   log (a completed workout ticks it). It never changes the program, and it never affects the journey.

## Reminders

Each kind has its own on/off, time and days, and all are off by default: Bible reading, prayer, Faith challenge,
Fitness goal, memory practice, devotional, practices, an opt-in evening check, and an optional last call before
midnight. The evening and final reminders are only sent while a journey is active.

- Reading, prayer, challenge, fitness, evening and final reminders are scheduled **per date** for the next seven days
  (`buildDatedFaithNotifications`), in the member's saved time zone, so DST never shifts them; one per kind per day.
  Today's is left out when the activity is already done, and cancelled on the device the moment it's marked done.
- Quiet hours (which may cross midnight) suppress anything inside them, and the settings warn when a reminder falls
  inside them.
- Delivery is local notifications in the iPhone/Android app (the existing Capacitor setup); a browser can't deliver
  them while closed, and the screen says so.
- **Limitation:** a device only learns about an activity done on *another* device when the app is next opened there.
  Until then, that device may still show today's reminder. Server push would remove this and was out of scope.
- Device delivery must be verified on physical iPhones; it has not been.

## Offline

- **Browser:** "Save for offline" stores the public-domain BSB text (about 4 MB) and a static reader in the
  `ngf-bible-v1` cache. Without a connection, the service worker answers any `/faith/bible/...` page with that reader,
  opened at the chapter the member was going to. It shows Scripture only; highlights, notes and journeys need a
  connection. The reader is a static page with its own fixed Content-Security-Policy and no inline script.
- **Native app:** `npx cap sync` copies the same reader and text into `native-shell/`, and the app's offline page
  offers "Read the Bible".
- Signed-in pages are still never cached.

## Bible study helper

- Separate from the fitness coach: its own instructions, history (`bible_ai_messages`) and quota
  (`bible_ai_usage`, `reserve_bible_ai_usage`); the coach's allowance (Free = 0) is untouched.
- Free for everyone within limits: 3 a minute, 10 a day, 60 a month (Pro: 5, 40, 400), fast model only
  (`BIBLE_AI_MODEL`, default `claude-haiku-5-5`), 700 output tokens at most.
- Passages are retrieved from the verified text (references named in the question, then verses with its distinctive
  words) and sent with the question. Every reference the answer cites is checked against the BSB; any that doesn't
  exist is marked "[reference not found in the BSB]". Cited passages are shown from the dataset, not from the model.
- Instructions forbid Greek/Hebrew/Aramaic word claims, speaking for God, and a pastor persona; crises are pointed
  to real help.
- The prayer journal, notes and account data are never sent. History is private and can be deleted.

## Privacy and data

- Every new table is owner-only under RLS; journeys, attempts, check-ins and AI usage are read-only to members.
- All new tables are in the account export and deletion (`src/server/services/account.ts`), and covered by
  `tests/integration/cross-user-isolation.test.ts`.
- **For counsel:** the privacy policy draft (`src/app/legal/privacy/page.tsx`) is version-locked, so it was not edited
  here. Proposed additions to "What we collect":
  - "Bible reading and discipleship records: your reading position and history, highlights, bookmarks, Bible notes,
    Scripture memory verses, study notes, reading-journey check-ins and attempts, daily goals and reminder settings,
    readable only by you. If you save the Bible for offline reading, only the public-domain Bible text is stored on
    your device."
  - "Questions you ask the Bible study helper, which are sent to our AI provider together with Bible passages so it
    can answer; your prayer journal, notes and other account data are never sent with them. You can delete this
    history at any time."

## Tests

- Unit: `bible-dataset`, `bible-reader`, `bible-plans`, `bible-offline` (service worker, offline reader, native
  bundle), `bible-ai`, `studies`, `faith-memory-challenges`, `faith-reminders`, `faith-reminders-dated`.
- Integration (local Supabase): `faith-journeys` (the rule), `faith-features`, `cross-user-isolation`.
- End to end: `e2e/bible-reader.spec.ts`, `e2e/faith-journey.spec.ts`, plus the existing `challenge` and
  `faith-calendar` specs.
