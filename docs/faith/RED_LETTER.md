# Red Letter Bible

The words of Jesus are shown in red throughout the Berean Standard Bible in the app. It is free for every member,
on by default, and can be turned off. It is a display format only: the BSB text is never changed, and copy, share,
notes, exports and AI prompts always use the plain text.

## Source and editorial policy

1. **Source.** The BSB publisher's own red-letter marking: the `\wj` markers of its USFM edition
   (`https://bereanbible.com/bsb_usfm.zip`, SHA-256 `f0c56438eb89c98e8f62c5c00461e25cc35b098ad5b179bc350cede759ee5f87`,
   pinned in `.github/workflows/bsb-text.yml`). The app shows exactly that marking and nothing it doesn't mark. No
   speech boundary is decided by the app or by AI.
2. **What He quotes is His speech too** (owner's decision, 2026-11-03). Scripture He recites ("It is written: ‘…’"),
   what He reports others saying ("You have heard that it was said, ‘…’") and the dialogue of His parables are red,
   as in the publisher's edition and standard red-letter Bibles. When other people quote Him, only His words are red
   (Matthew 27:43: "For He said, ‘I am the Son of God.’").
3. **Word level.** Each red stretch is stored as `[start, end)` character offsets into the BSB verse text
   (`public/bible/bsb/wj.json`), so narration in the same verse ("He said", "Jesus answered") stays in the normal
   colour. Speech that runs across verses and chapters is marked verse by verse.
4. **Verified twice against the BSB text.** The build (`scripts/build-bsb-red-letter.mjs`) refuses any marked stretch
   whose words aren't found word for word in the app's verse. Then `src/lib/bible/red-letter-verify.ts` follows the
   BSB's own quotation marks through every book (nested quotations, apostrophes, speech continuing across paragraphs
   and chapters) and checks each stretch sits inside them. Result: 2,172 stretches in 2,047 verses, all verified, none
   needing review, no speech of His left open into an unmarked verse. The data is only used when its checksum of the
   Bible text matches the text the app ships.
5. **Disagreements are documented, not guessed.** Where red-letter Bibles disagree, the passage is listed in the
   register (`src/data/bible/red-letter-review.ts`) with what the app shows, what other editions do and the basis.
   Nothing uncertain is added. 11 entries await a reviewer, including John 3:16–21, Revelation 1:8 and 21:5–8,
   Revelation 22:14–15, 1 Timothy 5:18, Hebrews 2:12–13 and 10:5–9.
6. **Old Testament.** Passages sometimes read as appearances of the pre-incarnate Christ (the angel of the LORD, the
   commander of the LORD's army) are listed for review and never marked automatically.

## Whole-Bible review

All 31,086 verses of the 66 books were scanned (`src/lib/bible/red-letter-records.ts`):

- New Testament verses without red where speech is introduced: 60, each read and attributed (none is Jesus unmarked).
  A test fails if the scan ever finds a verse that hasn't been read.
- Old Testament verses where the angel of the LORD speaks: 27, listed, not marked.
- Cross-check with an independent red-letter Bible (World English Bible, eBible.org; workflow run 41644412507): it
  marks 2,036 of the same 2,047 verses. Every difference is explained in `docs/faith/REVIEW.md`.

## Records

- `docs/faith/red-letter/segments.csv`: every red stretch with its reference, start and end offsets, basis,
  verification status and the red words.
- `docs/faith/red-letter/VERIFICATION.md`: totals by book, the scan results and the register.

Both are generated (`npm run bible:red-letter-records`); `tests/unit/red-letter-records.test.ts` fails if they're
out of date.

## Display

- **Setting:** Bible reader → Reading display (the sliders button) → Red letters. On by default. Saved to the account
  (`profiles.bible_red_letters`, migration 054) and applied everywhere Scripture is shown; also kept on the device for
  the offline reader. Turning it off shows His words in the normal text colour; the text is the same either way.
- **Reading page:** Dark (default) or Light (`profiles.bible_page_theme`), in the reader and the offline reader.
- **Colours** (`src/lib/bible/reading-display.ts`): dark page red `#F0736A`, light page deep red `#9B1C24`. Every
  text colour, red letters and verse numbers included, is at least 4.5:1 against its page and against each of the
  four highlight colours over it (`tests/unit/reading-display.test.ts`). Font size changes scale the red text with
  everything else.
- **Where:** Bible reader, offline reader, search, My Bible (bookmarks, highlights), Continue reading, study passages
  and cross-references, memory practice, the Bible study helper's cited passages, the daily Faith challenge verse,
  verse of the day, Scripture by theme, the 40-day devotional and badge verses. Journey readings open in the reader.
  Not changed: the opening gate animation and the welcome page (Matthew 7:13–14 in the gold brand style; owner to
  decide), and notification text, which can't be coloured.
