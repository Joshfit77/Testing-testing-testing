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
