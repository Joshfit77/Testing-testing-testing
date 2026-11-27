/**
 * Red letter: the editorial register. Every passage where red-letter Bibles disagree, where the speaker needs care, or
 * which the owner asked to have examined, with what the app shows and why.
 *
 * Editorial policy (owner's decision, 2026-11-03):
 * 1. The app shows exactly the BSB publisher's red-letter marking (bereanbible.com/bsb_usfm.zip, \wj), and nothing it
 *    doesn't mark. No speech boundary is decided by the app or by AI.
 * 2. Everything Jesus says is red, including Scripture He recites and the dialogue of His parables (standard
 *    red-letter practice, and the publisher's).
 * 3. Every red stretch must match the BSB text word for word and sit inside the BSB text's own quotation marks
 *    (src/lib/bible/red-letter-verify.ts). A stretch that doesn't is shown plain and listed for review.
 * 4. Where editions disagree, the passage is listed here with the difference; it stays as the publisher marks it until
 *    a reviewer decides. Nothing uncertain is added.
 * 5. Old Testament passages sometimes read as appearances of the pre-incarnate Christ are reviewed separately and are
 *    never marked automatically.
 */
export type RedLetterShown = "red" | "plain" | "partly red" | "no text";

export interface RedLetterReviewItem {
  /** e.g. "John 3:16–21" */
  reference: string;
  topic: "boundary" | "speaker" | "quoted saying" | "others quoting Him" | "textual" | "old testament";
  question: string;
  /** What the app shows (the publisher's marking). */
  shown: RedLetterShown;
  /** What other red-letter editions do, where checked. */
  otherEditions: string;
  basis: string;
  status: "awaiting review" | "settled";
}

export const RED_LETTER_REVIEW: readonly RedLetterReviewItem[] = [
  {
    reference: "John 3:16–21",
    topic: "boundary",
    question: "Does Jesus' speech to Nicodemus end at 3:15, with 3:16–21 the Gospel writer's comment, or run through 3:21?",
    shown: "red",
    otherEditions: "World English Bible: red through 3:21. Some editions and commentators end His words at 3:15.",
    basis: "Publisher's marking; the BSB text itself closes the quotation at the end of 3:21.",
    status: "awaiting review",
  },
  {
    reference: "John 3:31–36",
    topic: "speaker",
    question: "John the Baptist or the Gospel writer? (Not Jesus either way.)",
    shown: "plain",
    otherEditions: "Plain in the World English Bible.",
    basis: "The BSB text keeps 3:27–36 inside John the Baptist's quotation.",
    status: "settled",
  },
  {
    reference: "Revelation 1:8",
    topic: "speaker",
    question: "“I am the Alpha and the Omega,” says the Lord God: the Father or the Son?",
    shown: "plain",
    otherEditions: "World English Bible: red.",
    basis: "Publisher's marking.",
    status: "awaiting review",
  },
  {
    reference: "Revelation 21:5–8",
    topic: "speaker",
    question: "“The One seated on the throne”: the Father or the Son?",
    shown: "plain",
    otherEditions: "World English Bible: red.",
    basis: "Publisher's marking.",
    status: "awaiting review",
  },
  {
    reference: "Revelation 22:14–15",
    topic: "boundary",
    question: "Does Jesus' speech from 22:12 continue through 22:15?",
    shown: "plain",
    otherEditions: "World English Bible: red.",
    basis: "Publisher's marking; the BSB text closes His quotation at the end of 22:13 and reopens it at 22:16.",
    status: "awaiting review",
  },
  {
    reference: "1 Timothy 5:18",
    topic: "quoted saying",
    question: "“The worker is worthy of his wages” is Jesus' saying (Luke 10:7), quoted here as Scripture: red?",
    shown: "plain",
    otherEditions: "World English Bible: red. Many red-letter editions: plain.",
    basis: "Publisher's marking; the text attributes it to “the Scripture”, not to Jesus speaking.",
    status: "awaiting review",
  },
  {
    reference: "Hebrews 2:12–13",
    topic: "quoted saying",
    question: "Jesus (named in 2:11) speaking the words of Psalm 22 and Isaiah 8: red, as Hebrews 10:5–9 is?",
    shown: "plain",
    otherEditions: "Plain in the World English Bible.",
    basis: "Publisher's marking (which does mark the similar Hebrews 10:5–9). Listed for consistency.",
    status: "awaiting review",
  },
  {
    reference: "Hebrews 10:5–9",
    topic: "quoted saying",
    question: "“When Christ came into the world, He said” the words of Psalm 40: red?",
    shown: "red",
    otherEditions: "Plain in the World English Bible.",
    basis: "Publisher's marking; the text attributes the words to Christ.",
    status: "awaiting review",
  },
  {
    reference: "Hebrews 1:8–9; 7:21",
    topic: "speaker",
    question: "God speaking to or about the Son, not the Son speaking.",
    shown: "plain",
    otherEditions: "Plain in the World English Bible.",
    basis: "The text names the Father as the speaker.",
    status: "settled",
  },
  {
    reference: "Acts 10:13, 15; 11:7, 9",
    topic: "speaker",
    question: "The voice in Peter's vision (“Lord” in 10:14): Jesus?",
    shown: "red",
    otherEditions: "Red in the World English Bible.",
    basis: "Publisher's marking.",
    status: "awaiting review",
  },
  {
    reference: "Revelation 4:1",
    topic: "speaker",
    question: "“The voice I had previously heard speak to me like a trumpet” (1:10): Jesus?",
    shown: "red",
    otherEditions: "Plain in the World English Bible.",
    basis: "Publisher's marking; 1:10–20 identifies that voice as the risen Jesus.",
    status: "awaiting review",
  },
  {
    reference: "Revelation 16:15",
    topic: "speaker",
    question: "“Behold, I am coming like a thief” interrupts the vision: Jesus.",
    shown: "red",
    otherEditions: "Red in the World English Bible.",
    basis: "Publisher's marking.",
    status: "settled",
  },
  {
    reference: "Acts 20:35; 1 Corinthians 11:24–25; 2 Corinthians 12:9",
    topic: "quoted saying",
    question: "Jesus' words quoted outside the Gospels, attributed to Him in the text.",
    shown: "red",
    otherEditions: "Red in the World English Bible.",
    basis: "Publisher's marking; the text says the Lord Jesus said them.",
    status: "settled",
  },
  {
    reference: "1 Corinthians 7:10; 9:14; 1 Thessalonians 4:15; 1 John 3:23",
    topic: "quoted saying",
    question: "The Lord's command reported in other words, not quoted.",
    shown: "plain",
    otherEditions: "Plain in the World English Bible.",
    basis: "Indirect speech: no words of His are quoted.",
    status: "settled",
  },
  {
    reference: "Matthew 27:43, 63; Mark 5:31; Luke 24:7",
    topic: "others quoting Him",
    question: "Others repeating His exact words: red?",
    shown: "partly red",
    otherEditions: "Plain in the World English Bible.",
    basis: "Publisher's marking: only His quoted words are red; the speakers' own words stay plain.",
    status: "settled",
  },
  {
    reference: "John 5:12; 8:33; 8:52; 9:11; 12:34",
    topic: "others quoting Him",
    question: "Others paraphrasing what He said.",
    shown: "plain",
    otherEditions: "World English Bible: red.",
    basis: "In the BSB these are reported in the speakers' own words, not quoted.",
    status: "settled",
  },
  {
    reference: "Matthew 17:21; 18:11; 23:14; Mark 7:16; 9:44, 46; 11:26; Luke 17:36",
    topic: "textual",
    question: "Words of Jesus found in later manuscripts.",
    shown: "no text",
    otherEditions: "World English Bible: included and red.",
    basis: "The BSB keeps these verses in its footnotes, so there is no text to colour; the reader says so.",
    status: "settled",
  },
  {
    reference: "Luke 9:55–56",
    topic: "textual",
    question: "The longer reading (“You do not know what kind of spirit you are of…”).",
    shown: "plain",
    otherEditions: "World English Bible: included and red.",
    basis: "Not in the BSB's main text.",
    status: "settled",
  },
  {
    reference: "Mark 16:9–20; John 7:53–8:11",
    topic: "textual",
    question: "Passages some early manuscripts lack.",
    shown: "partly red",
    otherEditions: "Red in the World English Bible.",
    basis: "The BSB includes them; His words in them (Mark 16:15–18; John 8:7, 10–11) are red as the publisher marks.",
    status: "settled",
  },
  {
    reference: "Matthew 27:46; Mark 5:41; 7:34; 15:34",
    topic: "boundary",
    question: "His Aramaic words and the Gospel writer's translation of them.",
    shown: "red",
    otherEditions: "Red in the World English Bible.",
    basis: "Publisher's marking colours both the words and their translation; the joining “which means” stays plain.",
    status: "settled",
  },
  {
    reference:
      "Genesis 16:7–13; 21:17–18; 22:11–18; 31:11–13; Exodus 3:2–6; Numbers 22:22–35; Joshua 5:13–15; Judges 2:1–4; 6:11–24; 13:3–23; Zechariah 1:12–13; 3:1–6",
    topic: "old testament",
    question: "The angel of the LORD / the commander of the LORD's army, which some read as appearances of the pre-incarnate Christ.",
    shown: "plain",
    otherEditions: "Plain in the World English Bible and in standard red-letter editions.",
    basis: "Policy: Old Testament passages are never marked automatically; listed for the reviewer.",
    status: "awaiting review",
  },
];

/**
 * Every New Testament verse the whole-Bible scan (src/lib/bible/red-letter-records.ts) flags as possible unmarked
 * speech, read and attributed. None is Jesus speaking unmarked. A test fails if the scan ever finds a verse not listed
 * here, so new or changed data is read before it is trusted.
 */
export const SCAN_REVIEWED_NEW_TESTAMENT: Readonly<Record<string, string>> = {
  "Matthew 1:20": "an angel of the Lord",
  "Matthew 9:14": "John's disciples",
  "Matthew 12:10": "those trying to accuse Him",
  "Matthew 13:10": "the disciples",
  "Matthew 17:19": "the disciples",
  "Matthew 18:1": "the disciples",
  "Matthew 18:21": "Peter",
  "Matthew 20:30": "two blind men",
  "Matthew 21:10": "the people of Jerusalem",
  "Matthew 26:17": "the disciples",
  "Matthew 26:49": "Judas",
  "Mark 2:16": "the scribes",
  "Mark 2:18": "people asking about fasting",
  "Mark 3:32": "the crowd (“He was told”)",
  "Mark 6:35": "the disciples",
  "Mark 9:28": "the disciples",
  "Mark 10:35": "James and John",
  "Mark 12:28": "a scribe",
  "Mark 13:1": "one of the disciples",
  "Mark 14:12": "the disciples",
  "Mark 14:45": "Judas",
  "Mark 15:39": "the centurion",
  "Luke 7:20": "John the Baptist's messengers",
  "Luke 7:39": "the Pharisee",
  "Luke 8:20": "people (“He was told”)",
  "Luke 9:12": "the Twelve",
  "Luke 10:27": "the expert in the law",
  "Luke 10:40": "Martha",
  "Luke 13:31": "some Pharisees",
  "Luke 22:49": "the disciples",
  "John 1:15": "John the Baptist",
  "John 1:20": "John the Baptist",
  "John 1:21": "the priests and Levites, and John the Baptist",
  "John 1:29": "John the Baptist",
  "John 1:36": "John the Baptist",
  "John 1:41": "Andrew",
  "John 2:3": "Jesus' mother",
  "John 3:2": "Nicodemus",
  "John 6:14": "the people",
  "John 7:3": "Jesus' brothers",
  "John 9:11": "the man born blind (paraphrasing Jesus)",
  "John 9:25": "the man born blind",
  "John 9:27": "the man born blind",
  "John 11:32": "Mary",
  "John 13:6": "Simon Peter",
  "John 13:25": "the disciple whom Jesus loved",
  "John 18:25": "people in the courtyard, and Peter",
  "John 18:33": "Pilate",
  "John 21:7": "the disciple whom Jesus loved",
  "Acts 2:34": "Peter, quoting David (Psalm 110)",
  "Acts 8:26": "an angel of the Lord",
  "Acts 9:40": "Peter",
  "Acts 10:28": "Peter",
  "Acts 13:2": "the Holy Spirit",
  "Acts 23:20": "Paul's nephew",
  "Hebrews 1:8": "God, about the Son",
  "Hebrews 7:21": "God's oath to the Son",
  "1 John 3:23": "John (indirect: “as He commanded us”)",
  "Revelation 21:5": "the One seated on the throne (see the register)",
  "Revelation 21:6": "the One seated on the throne (see the register)",
};
