# Content needing theological review

Nothing below is Scripture. Scripture itself is the verified BSB text (checksum-pinned, see `docs/SCRIPTURE.md`) and
is never edited. Each item was written for the app, with AI assistance, and should be reviewed by a pastor or
qualified theological reviewer before release. Studies stay hidden from members until approved (see the last section).

## 1. Journey rule wording (`src/lib/faith/journey-copy.ts`)

- The rule (owner's wording): "If you miss your daily Bible reading or prayer, your current journey restarts at Day 1.
  Your previous reading history and notes will still be saved."
- Restart message (owner's wording): "Your journey begins again today. God's mercies are new every morning. —
  Lamentations 3:22–23". The app shows the BSB text of Lamentations 3:22–23 under it. Please confirm the summary line
  is a fair paraphrase to show beside the reference.
- Added by the app: "This is a discipline you choose. A restart is a fresh start at the habit; it does not change
  God's love for you." Please confirm or reword.
- Reminder texts (`src/lib/faith-reminders.ts`), e.g. "Today's Bible reading and prayer aren't marked yet. There's
  still time today."

## 2. Reading plans (`src/lib/bible/plans.ts`)

- **Chronological order:** one common arrangement of books and chapter blocks (Job after Genesis 11, Psalm 90 after
  Deuteronomy, Psalms grouped with David's and later periods, prophets interleaved with Kings and Chronicles, the
  epistles interleaved with Acts). Scholars differ on several placements.
- **Topic plans:** prayer, trust, the gospel, discipline, wisdom, love (21–32 passages each). Please review the
  selections and their order.
- **Guided plan:** the New Testament with Psalms and Proverbs alongside.

## 3. Daily Faith challenges (`src/data/faith-challenges.ts`)

30 short applications, each tied to a passage (references verified against the text). The application wording is
the app's own; please check each pairing is faithful to its passage, for example "Go without one small comfort today,
and pray each time you'd reach for it" with Matthew 6:16–18.

## 4. Guided studies (`src/data/studies.ts`)

- The catalogue: 26 studies, their summaries, lesson titles, passages and cross-references.
- **Fully drafted notes** (context, explanation, themes, questions, application, prayer) for *The Gospel*, four
  lessons: Mark 1:1–15, Romans 3:9–26, 1 Corinthians 15:1–11, Acts 2:22–41. The other studies have passages,
  cross-references and lesson titles only; their notes are still to be written.
- Sensitive studies to review with particular care: Biblical Manhood, Biblical Womanhood, Marriage (passages such as
  Ephesians 5, 1 Peter 3, Titus 2 and Matthew 19 are read differently across traditions), Anxiety and Peace (must not
  read as a substitute for care), Stewardship of the Body (fitness application comes only after the exposition).
- **How approval works:** each study has `review: { status: "draft" }`. To publish one, a reviewer changes it to
  `{ status: "approved", reviewedBy: "<name>", reviewedOn: "<date>" }`. Until then members see only the passages,
  cross-references and their own notes; administrators see the draft notes under a "Draft, awaiting theological
  review" banner. `tests/unit/studies.test.ts` currently requires every study to be a draft, so publishing is a
  deliberate change to that test too.

## 5. Bible study helper (`src/lib/bible/ai.ts`)

The instructions the AI follows (`BIBLE_AI_SYSTEM`): base answers on the provided BSB passages, separate text from
interpretation and present differing Christian views fairly, no Greek/Hebrew/Aramaic word claims, never speak for God,
not a pastor, point crises to real help. Please review the instructions. The answers themselves are generated and are
labelled "Bible study helper (AI)", with "This is an AI, not a pastor, and it can be wrong" on the page.

## 6. Footnoted verses

Where the BSB keeps a verse number without text (16 verses, such as Matthew 17:21 and John 5:4), the reader shows:
"Verse N is not in the Berean Standard Bible's main text; the translation gives it in a footnote, which this app does
not show." Please confirm this description.

## Words of Jesus in red

The red-letter marking follows the publisher's USFM edition exactly; the app makes no choices of its own. Most of it is
Jesus speaking in the Gospels, Acts 1 and 9, 1 Corinthians 11:24–25, 2 Corinthians 12:9 and Revelation 1–3 and 22.
For review, the publisher also marks: the voice in Peter's vision (Acts 10:13, 15; 11:7, 9), Hebrews 10:5–9 (Christ
speaking in the words of Psalm 40), Revelation 4:1 and 16:15. It does not mark Revelation 1:8 ("says the Lord God").
If the reviewer would mark these differently, the change belongs in the source data, not in the app.

Cross-check (2026-11-03, `bsb-text` workflow run 41644412507): the World English Bible's red-letter edition (eBible.org)
marks 2,036 of the same 2,047 verses. Where they differ:

- Verses the BSB keeps only in footnotes, so there is no text to colour: Matthew 17:21, 18:11, 23:14; Mark 7:16, 9:44,
  9:46, 11:26; and the longer reading of Luke 9:55–56.
- Wording differences: Luke 20:23 (the BSB starts His words in 20:24); Mark 8:23 (the BSB gives His question directly).
- Others repeating His words: the BSB colours exact quotations (Matthew 27:43, 27:63; Mark 5:31; Luke 24:7) but not
  indirect ones (John 5:12, 8:33, 8:52, 9:11, 12:34), which the WEB colours.
- Interpretive calls the reviewer may want to decide: Revelation 1:8 and 21:5–8 (the Lord God / the One on the throne:
  red in the WEB, plain in the BSB); Revelation 22:14–15 (the BSB closes His quotation at 22:13); 1 Timothy 5:18 ("The
  worker is worthy of his wages", Jesus' saying quoted as Scripture: red in the WEB); Hebrews 10:5–9 and Revelation 4:1
  (red in the BSB only).

A local scan of the BSB text (every "Jesus said", "He answered" and similar, and every verse inside an open quotation of
His) found no verse where He speaks without being marked.

Not red by design (owner to decide): Matthew 7:13–14 in the opening gate animation and on the welcome page, where it is
set in the gold brand style.

