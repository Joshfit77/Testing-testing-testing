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
