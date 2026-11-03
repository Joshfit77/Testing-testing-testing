# Scripture in Narrow Gate Fitness

The app quotes the **Berean Standard Bible (BSB)**, which is public domain. Attribution (appreciated by
the publisher, not legally required) is shown on the Faith page and in the Terms:

> Scripture quotations are from the Berean Standard Bible (BSB), public domain. [berean.bible](https://berean.bible/)

## Where the text comes from

Verse text is never typed by hand.

1. `scripts/bsb-references.json` lists every passage the app quotes, written as the app writes it ("Matthew 7:13–14").
2. `.github/workflows/bsb-text.yml` downloads the official BSB plain-text file linked from
   <https://berean.bible/downloads.htm> (`https://bereanbible.com/bsb.txt`) and runs `scripts/extract-bsb.mjs`.
   It publishes `bsb-passages.json` as the `bsb-text` release. The workflow runs on GitHub because the development
   sandbox can't reach berean.bible.
3. That file is copied to `src/data/bsb-passages.json`. It records the source URL, the download time and the
   SHA-256 of the BSB file it was extracted from.

`src/data/scripture.ts` is the single place the translation is chosen (`ACTIVE_TRANSLATION_ID = "BSB"`). Everything
that shows Scripture reads from it, including:

- the Home verse card, the Faith tab and its verse list (`src/data/content.ts`);
- the 40-day devotional (`src/data/devotionals.ts`);
- the welcome page and sign-up;
- workout and faith reminders;
- the AI coach's list of quotable verses (`src/lib/coach/knowledge.ts`).

The coach may quote only verses from that list, word for word, labelled "(BSB)".

## Checks

`tests/unit/scripture.test.ts` fails if any of the following happens:

- any daily verse, devotional verse or coach verse differs from the official BSB text;
- a reminder fragment isn't an exact part of its verse;
- a Scripture quotation inside the devotional prose doesn't match the BSB wording;
- KJV wording (thee, thou, ye, hath, unto, …) appears in any verse, title, devotional, prayer or reflection;
- the attribution or link changes.

## Adding or changing a verse

1. Add the reference to `scripts/bsb-references.json` and push. The workflow republishes `bsb-passages.json`.
2. Download it from the `bsb-text` release into `src/data/bsb-passages.json`.
3. Use the reference in `content.ts` or `devotionals.ts` and copy the text from the JSON. The test checks it matches.
4. Run `npx vitest run tests/unit/scripture.test.ts`.

## Notes

- Psalm 23:1 in the BSB file begins with the heading "A Psalm of David." It is kept, because the app shows the
  official text exactly.
- Colossians 3:23 and Joshua 1:9 end mid-sentence or with a closing quotation mark in the BSB, because the sentence
  continues into the next verse. They are shown exactly as published.
- Devotional titles that were KJV phrases ("Iron Sharpeneth Iron", "Come Ye Apart…") now use the BSB wording of
  the same verse. The topics and teaching are unchanged.
- The offline edition (`standalone/index.html`, the Android APK) carries the same BSB text and attribution.

## The complete Bible (reader, plans, search, AI helper)

The Bible reader, reading plans, search, memory practice, studies and the Bible study helper use the whole BSB, built
from the same official `bsb.txt` (pinned SHA-256 `2ac3af1de52d4e68261cba91d85c320b7eadc6560e830d99e591767b8ff5ca96`):

1. `.github/workflows/bsb-text.yml` runs `scripts/build-bsb-bible.mjs`, which validates the file against the canon in
   `src/data/bible/books.json` (66 books, 1,189 chapters, verse order, no duplicates) and writes
   `public/bible/bsb/meta.json` and one JSON file per book.
2. The result was committed to `public/bible/bsb` (31,102 verse numbers; 31,086 with text; the 16 the BSB keeps in
   footnotes are recorded as such and shown as such, never filled in).
3. `tests/unit/bible-dataset.test.ts` checks the canon, the counts, the content checksum and agreement with every
   independently extracted passage in `src/data/bsb-passages.json`.

The server reads the files from disk (`src/server/bible/text.ts`); `next.config.ts` traces them into server builds.
Everything shown as Scripture (reader, search results, journey readings, challenge verses, study passages, memory
verses, passages cited by the AI helper) is read from this dataset at render time, never typed by hand.
See `docs/faith/README.md` for the features and `docs/faith/REVIEW.md` for content needing theological review.

## Words of Jesus in red

Wherever the app shows Bible text, the words of Jesus are in red (`--red-letter`, #F0736A: at least 4.5:1 contrast on
the page, cards and every highlight colour). Which words are His is never decided by hand:

1. `.github/workflows/bsb-text.yml` downloads the publisher's own USFM edition of the BSB
   (`https://bereanbible.com/bsb_usfm.zip`, pinned SHA-256 `f0c56438eb89c98e8f62c5c00461e25cc35b098ad5b179bc350cede759ee5f87`),
   whose `\wj` markers mark the words of Jesus, and runs `scripts/build-bsb-red-letter.mjs`.
2. The script records, for each marked verse, where His words begin and end inside the app's own verse text
   (character offsets), so the text itself is never changed. Every marked stretch must be found word for word in the
   app's text; only typesetting may differ (spaces around dashes and inside quotation marks, and bracketed closing
   quotes such as "[’’]" that the plain text leaves out). Any other difference fails the run.
3. The result is `public/bible/bsb/wj.json` (2,047 verses: Matthew, Mark, Luke, John, Acts, 1 and 2 Corinthians,
   Hebrews, Revelation). It records the content checksum of the Bible text it was built for; the app and the offline
   reader use it only when that matches, so offsets can never colour the wrong words. Without it the text shows plain.
4. `tests/unit/red-letter.test.ts` checks the source and checksum pin, that every span lies inside its verse, and known
   verses (His words red, narration such as "He said" or "Jesus wept" plain).

Shown in red: the Bible reader and the offline reader, search results and reference search, My Bible, Continue
reading, study passages and cross-references, memory practice, the Bible study helper's cited passages, the daily
Faith challenge verse, the verse of the day (Home and Faith), Scripture by theme, the 40-day devotional, and badge verses.
Not changed: the opening gate animation and the welcome page, where Matthew 7:13–14 is part of the gold brand design,
and notification text, which can't be coloured.

