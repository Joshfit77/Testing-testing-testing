/**
 * Guided Bible studies. Each lesson is built around a passage the member reads in full from the verified BSB (the
 * text is never stored here, only references, and tests/unit/studies.test.ts checks each one). Study notes (context,
 * explanation, themes, questions, application, prayer) are commentary, not Scripture, and are shown to members only
 * once a person has reviewed and approved them (`review.status: "approved"` with who and when). Until then a study
 * shows its passages, cross-references and the member's own notes; administrators can preview the draft notes.
 *
 * All draft notes below were written with AI assistance and are awaiting theological review (docs/faith/REVIEW.md).
 * Nothing here is published automatically.
 */

export type StudyCategory = "foundations" | "living" | "books";

export interface StudyNotes {
  context: string;
  explanation: string;
  themes: string[];
  questions: string[];
  /** How the passage is lived out; always after the explanation of the text itself. */
  application: string;
  prayer: string;
}

export interface StudyLesson {
  slug: string;
  title: string;
  passage: string;
  crossReferences: string[];
  notes?: StudyNotes;
}

export interface Study {
  slug: string;
  title: string;
  category: StudyCategory;
  summary: string;
  lessons: StudyLesson[];
  review: { status: "draft" } | { status: "approved"; reviewedBy: string; reviewedOn: string };
}

export const STUDY_CATEGORIES: Record<StudyCategory, string> = {
  foundations: "Foundations",
  living: "Christian living",
  books: "Books of the Bible",
};

const L = (slug: string, title: string, passage: string, crossReferences: string[] = [], notes?: StudyNotes): StudyLesson => ({ slug, title, passage, crossReferences, notes });
const DRAFT = { status: "draft" } as const;

export const STUDIES: readonly Study[] = [
  // ------------------------------------------------------------------------------------------------ Foundations
  {
    slug: "gospel",
    title: "The Gospel",
    category: "foundations",
    summary: "The good news of Jesus Christ: who He is, why we need Him, and what He has done.",
    review: DRAFT,
    lessons: [
      L("good-news", "Good news announced", "Mark 1:1–15", ["Isaiah 52:7", "Romans 1:16–17"], {
        context:
          "Mark's account opens without a birth story. It moves straight from the prophets' promises to John the Baptist in the wilderness and to Jesus beginning His public ministry in Galilee, under Roman rule and in a land waiting for God to act.",
        explanation:
          "Mark calls his whole account “the gospel of Jesus Christ, the Son of God” (v. 1). John prepares the way by calling people to repent. At Jesus' baptism the Father speaks and the Spirit descends, marking out Jesus as the beloved Son. Jesus is tested in the wilderness, then proclaims that the time is fulfilled and the kingdom of God is near, and He calls people to repent and believe the gospel (v. 15).",
        themes: ["The gospel is about a person, Jesus", "God keeps His promises", "Repentance and faith are the response"],
        questions: [
          "What does Mark tell us about Jesus in the first verse?",
          "Why do you think John's message began with repentance?",
          "What two things does Jesus call people to do in verse 15?",
          "What would it mean for you to “believe the gospel” today?",
        ],
        application:
          "The gospel is first news to believe, not advice to follow. Before asking what you must do, notice what God has done in sending His Son. Then answer Jesus' call personally: turn from what you know is wrong, and trust Him.",
        prayer: "Father, thank You for sending Your Son. Help me to hear the good news with fresh ears, to turn from my sin, and to trust Jesus today. Amen.",
      }),
      L("our-need", "Our need", "Romans 3:9–26", ["Isaiah 53:6", "Psalm 14:1–3"], {
        context:
          "Paul wrote Romans to believers in Rome, both Jewish and Gentile. In chapters 1–3 he shows that everyone, whatever their background, stands in need of God's mercy.",
        explanation:
          "Paul gathers Old Testament passages to show that “there is no one righteous, not even one” (v. 10). The law shows us our sin but cannot remove it (v. 20). Then comes the turn: “But now” (v. 21) a righteousness from God has been revealed, received through faith in Jesus Christ. All have sinned, and all who believe are justified freely by His grace through the redemption in Christ Jesus (vv. 23–24). God presented Him as the one whose sacrificial death deals with sin, so that God is both just and the one who justifies those who have faith in Jesus (vv. 25–26).",
        themes: ["Everyone needs God's mercy", "The law reveals sin", "Righteousness is a gift received by faith"],
        questions: [
          "Why does Paul include everyone in verses 9–20?",
          "What changes with the words “But now” in verse 21?",
          "How does this passage describe what Jesus did?",
          "How does seeing your own need change the way you see the gospel?",
        ],
        application:
          "It is humbling to admit that we cannot make ourselves right with God, and it is freeing. You do not have to earn what God gives freely. When you are tempted to compare yourself with others, remember that we all come to God the same way: by grace, through faith.",
        prayer: "Lord, I confess that I have sinned and fallen short of Your glory. Thank You that in Jesus You freely give what I could never earn. Amen.",
      }),
      L("christ-died-and-rose", "Christ died and rose", "1 Corinthians 15:1–11", ["Isaiah 53:4–6", "Luke 24:44–47"], {
        context:
          "Some in the church at Corinth were confused about the resurrection. Paul reminds them of the message he first preached, which he had himself received.",
        explanation:
          "Paul names what is “of first importance” (v. 3): Christ died for our sins according to the Scriptures, He was buried, He was raised on the third day according to the Scriptures, and He appeared to Peter, to the Twelve, to more than five hundred at once, to James, and finally to Paul himself. The gospel rests on events in history, witnessed by many, and fulfilling what God had promised.",
        themes: ["The death and resurrection of Jesus are the heart of the gospel", "The gospel fulfils the Scriptures", "God's grace changes people"],
        questions: [
          "What four events does Paul list in verses 3–5?",
          "Why do you think Paul mentions so many witnesses?",
          "How does Paul describe himself in verses 9–10, and why?",
          "What difference does it make that Jesus actually rose?",
        ],
        application:
          "Christian hope is not wishful thinking; it rests on what happened. When you doubt or feel unworthy, return to these facts, as Paul did: Christ died for our sins and was raised. By the grace of God we are what we are (v. 10).",
        prayer: "Lord Jesus, thank You that You died for my sins and rose again. Let Your grace in me not be in vain. Amen.",
      }),
      L("repent-and-believe", "Responding to the gospel", "Acts 2:22–41", ["Mark 1:15", "Romans 10:9–13"], {
        context:
          "On the day of Pentecost, after the Holy Spirit came upon the disciples, Peter preached to a crowd in Jerusalem, many of whom had witnessed the events of the previous weeks.",
        explanation:
          "Peter proclaims Jesus as the man accredited by God, crucified according to God's plan, and raised from the dead, whom God has made both Lord and Christ (v. 36). The listeners are “cut to the heart” and ask what to do. Peter answers: repent and be baptized in the name of Jesus Christ for the forgiveness of sins, and receive the gift of the Holy Spirit (v. 38). The promise is for them, their children and all who are far off (v. 39).",
        themes: ["Jesus is Lord and Christ", "Repentance, forgiveness and the gift of the Spirit", "The promise is for all whom God calls"],
        questions: [
          "What does Peter say God has done through Jesus?",
          "What did the crowd ask, and how did Peter answer?",
          "Who is the promise for (v. 39)?",
          "Is there a step of response you have not yet taken?",
        ],
        application:
          "The gospel invites a response. If you have never turned to Christ in repentance and faith, you can do that today, and it is good to tell a pastor or a trusted Christian. If you already follow Him, ask God for the courage to share this good news with someone.",
        prayer: "Lord, You are Lord and Christ. I turn to You, asking for forgiveness and for the gift of Your Spirit. Give me courage to share this good news. Amen.",
      }),
    ],
  },
  {
    slug: "grace-through-faith",
    title: "Grace through Faith",
    category: "foundations",
    summary: "Saved not by our works but by God's grace, received through faith.",
    review: DRAFT,
    lessons: [
      L("dead-made-alive", "Dead, then made alive", "Ephesians 2:1–10", ["Titus 3:3–8"]),
      L("credited-as-righteousness", "Faith credited as righteousness", "Romans 4:1–8", ["Genesis 15:1–6"]),
      L("not-by-works-of-the-law", "Not by works of the law", "Galatians 2:15–21", ["Philippians 3:7–11"]),
      L("saved-for-good-works", "Saved for good works", "Titus 3:3–8", ["James 2:14–26"]),
    ],
  },
  {
    slug: "who-jesus-is",
    title: "Who Jesus Is",
    category: "foundations",
    summary: "The Word made flesh: fully God and fully man, Saviour and Lord.",
    review: DRAFT,
    lessons: [
      L("the-word", "The Word became flesh", "John 1:1–18", ["Genesis 1:1–3"]),
      L("image-of-god", "The image of the invisible God", "Colossians 1:15–23", ["Hebrews 1:1–4"]),
      L("servant-and-lord", "Servant and Lord", "Philippians 2:5–11", ["Isaiah 53:3–5"]),
      L("you-are-the-christ", "You are the Christ", "Mark 8:27–38", ["Matthew 16:13–20"]),
    ],
  },
  {
    slug: "trinity",
    title: "The Trinity",
    category: "foundations",
    summary: "One God in three persons: Father, Son and Holy Spirit.",
    review: DRAFT,
    lessons: [
      L("the-lord-is-one", "The Lord is one", "Deuteronomy 6:4–9", ["Mark 12:28–31"]),
      L("father-son-spirit", "Father, Son and Spirit at the Jordan", "Matthew 3:13–17", ["Mark 1:9–11"]),
      L("another-advocate", "Another Advocate", "John 14:15–26", ["John 16:7–15"]),
      L("in-the-name", "In the name of the Father, Son and Holy Spirit", "Matthew 28:16–20", ["2 Corinthians 13:14"]),
    ],
  },
  {
    slug: "repentance",
    title: "Repentance",
    category: "foundations",
    summary: "Turning from sin to God, and the joy of being received.",
    review: DRAFT,
    lessons: [
      L("create-in-me", "Create in me a clean heart", "Psalm 51", ["2 Samuel 12:1–13"]),
      L("the-father-runs", "The father who runs", "Luke 15:11–32", ["Luke 15:1–10"]),
      L("godly-sorrow", "Godly sorrow", "2 Corinthians 7:8–11", ["Joel 2:12–13"]),
      L("walking-in-the-light", "Walking in the light", "1 John 1:5–2:2", ["Proverbs 28:13"]),
    ],
  },
  {
    slug: "prayer",
    title: "Prayer",
    category: "foundations",
    summary: "How Jesus taught us to pray, and the confidence we have in Him.",
    review: DRAFT,
    lessons: [
      L("our-father", "Our Father in heaven", "Matthew 6:5–15", ["Luke 11:1–4"]),
      L("ask-seek-knock", "Ask, seek, knock", "Luke 11:5–13", ["Matthew 7:7–11"]),
      L("do-not-be-anxious", "Prayer instead of anxiety", "Philippians 4:4–9", ["1 Peter 5:6–7"]),
      L("jesus-prays", "Jesus prays for His people", "John 17:1–26", ["Hebrews 7:25"]),
    ],
  },
  {
    slug: "understanding-scripture",
    title: "Understanding Scripture",
    category: "foundations",
    summary: "What the Bible is, why it can be trusted, and how to read it well.",
    review: DRAFT,
    lessons: [
      L("god-breathed", "All Scripture is God-breathed", "2 Timothy 3:10–17", ["2 Peter 1:19–21"]),
      L("the-law-is-perfect", "The heavens and the law", "Psalm 19", ["Psalm 119:105"]),
      L("reading-with-understanding", "Reading with understanding", "Nehemiah 8:1–12", ["Acts 8:26–35"]),
      L("beginning-with-moses", "Christ in all the Scriptures", "Luke 24:13–35", ["John 5:39–40"]),
      L("examining-daily", "Examining the Scriptures daily", "Acts 17:10–12", ["Psalm 1:1–3"]),
    ],
  },
  {
    slug: "discipleship",
    title: "Discipleship",
    category: "foundations",
    summary: "Following Jesus: the cost, the call and the fruit.",
    review: DRAFT,
    lessons: [
      L("take-up-your-cross", "Take up your cross", "Luke 9:18–27", ["Mark 8:34–38"]),
      L("counting-the-cost", "Counting the cost", "Luke 14:25–33", ["Philippians 3:7–8"]),
      L("abide-in-me", "Abide in Me", "John 15:1–17", ["Galatians 5:22–23"]),
      L("make-disciples", "Go and make disciples", "Matthew 28:16–20", ["2 Timothy 2:1–2"]),
    ],
  },

  // ------------------------------------------------------------------------------------------- Christian living
  {
    slug: "manhood",
    title: "Biblical Manhood",
    category: "living",
    summary: "Strength under God: courage, love, self-control and faithful leadership.",
    review: DRAFT,
    lessons: [
      L("be-strong-and-courageous", "Be strong and courageous", "Joshua 1:1–9", ["1 Corinthians 16:13–14"]),
      L("love-as-christ-loved", "Love as Christ loved", "Ephesians 5:25–33", ["Colossians 3:19"]),
      L("self-control", "Self-control and integrity", "Titus 2:1–8", ["1 Timothy 4:12"]),
      L("faithful-leadership", "Faithful character", "1 Timothy 3:1–7", ["1 Peter 5:1–4"]),
    ],
  },
  {
    slug: "womanhood",
    title: "Biblical Womanhood",
    category: "living",
    summary: "Women of faith: wisdom, strength, devotion and the hidden beauty of the heart.",
    review: DRAFT,
    lessons: [
      L("woman-of-strength", "A woman of strength", "Proverbs 31:10–31", ["Proverbs 31:30"]),
      L("ruth-loyal-love", "Ruth's loyal love", "Ruth 1:6–18", ["Ruth 2:10–12"]),
      L("the-better-part", "The better part", "Luke 10:38–42", ["Psalm 27:4"]),
      L("inner-beauty", "The beauty of a gentle spirit", "1 Peter 3:1–6", ["Titus 2:3–5"]),
    ],
  },
  {
    slug: "marriage",
    title: "Marriage",
    category: "living",
    summary: "God's design for marriage, and the love that reflects Christ and the church.",
    review: DRAFT,
    lessons: [
      L("one-flesh", "One flesh", "Genesis 2:18–25", ["Matthew 19:3–9"]),
      L("christ-and-the-church", "Christ and the church", "Ephesians 5:21–33", ["Colossians 3:18–19"]),
      L("love-is-patient", "Love is patient", "1 Corinthians 13:1–13", ["1 John 4:7–12"]),
      L("what-god-has-joined", "What God has joined together", "Matthew 19:3–9", ["Malachi 2:13–16"]),
    ],
  },
  {
    slug: "friendship",
    title: "Friendship",
    category: "living",
    summary: "Faithful friends who sharpen, encourage and lay down their lives.",
    review: DRAFT,
    lessons: [
      L("jonathan-and-david", "Jonathan and David", "1 Samuel 18:1–4", ["1 Samuel 20:12–17"]),
      L("two-are-better", "Two are better than one", "Ecclesiastes 4:9–12", ["Proverbs 17:17"]),
      L("iron-sharpens-iron", "Faithful wounds and sharpening", "Proverbs 27:5–17", ["Hebrews 10:24–25"]),
      L("greater-love", "Greater love", "John 15:12–17", ["Romans 12:9–13"]),
    ],
  },
  {
    slug: "temptation",
    title: "Facing Temptation",
    category: "living",
    summary: "How Jesus overcame temptation, and the way of escape God provides.",
    review: DRAFT,
    lessons: [
      L("it-is-written", "It is written", "Matthew 4:1–11", ["Hebrews 4:14–16"]),
      L("joseph-flees", "Joseph flees", "Genesis 39:1–23", ["2 Timothy 2:22"]),
      L("a-way-of-escape", "A way of escape", "1 Corinthians 10:1–13", ["Psalm 119:9–11"]),
      L("desire-and-death", "Where temptation comes from", "James 1:12–18", ["Galatians 5:16–17"]),
    ],
  },
  {
    slug: "humility",
    title: "Humility",
    category: "living",
    summary: "The mind of Christ: lowering ourselves to serve.",
    review: DRAFT,
    lessons: [
      L("mind-of-christ", "The mind of Christ", "Philippians 2:1–11", ["Romans 12:3"]),
      L("two-men-praying", "Two men praying", "Luke 18:9–14", ["Proverbs 3:34"]),
      L("washing-feet", "Washing feet", "John 13:1–17", ["Mark 10:42–45"]),
      L("humble-yourselves", "Humble yourselves before the Lord", "James 4:1–10", ["1 Peter 5:5–6"]),
    ],
  },
  {
    slug: "forgiveness",
    title: "Forgiveness",
    category: "living",
    summary: "Forgiven by God, and learning to forgive others.",
    review: DRAFT,
    lessons: [
      L("seventy-seven-times", "Seventy-seven times", "Matthew 18:21–35", ["Matthew 6:14–15"]),
      L("joseph-forgives", "Joseph forgives his brothers", "Genesis 50:15–21", ["Romans 12:17–21"]),
      L("father-forgive-them", "Father, forgive them", "Luke 23:32–43", ["Acts 7:59–60"]),
      L("as-the-lord-forgave-you", "As the Lord forgave you", "Colossians 3:12–17", ["Ephesians 4:31–32"]),
    ],
  },
  {
    slug: "spiritual-discipline",
    title: "Spiritual Discipline",
    category: "living",
    summary: "Training for godliness: running the race with endurance.",
    review: DRAFT,
    lessons: [
      L("train-for-godliness", "Train yourself for godliness", "1 Timothy 4:6–16", ["2 Peter 1:3–8"]),
      L("run-to-win", "Run to win the prize", "1 Corinthians 9:24–27", ["Philippians 3:12–14"]),
      L("the-race-and-discipline", "The race and the Father's discipline", "Hebrews 12:1–13", ["Proverbs 3:11–12"]),
      L("daniels-habit", "Daniel's habit of prayer", "Daniel 6:1–23", ["Psalm 55:16–17"]),
    ],
  },
  {
    slug: "anxiety",
    title: "Anxiety and Peace",
    category: "living",
    summary: "Casting our cares on God, who cares for us.",
    review: DRAFT,
    lessons: [
      L("do-not-worry", "Do not worry about tomorrow", "Matthew 6:25–34", ["Luke 12:22–31"]),
      L("the-peace-of-god", "The peace of God", "Philippians 4:4–9", ["Isaiah 26:3"]),
      L("god-is-our-refuge", "God is our refuge", "Psalm 46", ["Psalm 62:5–8"]),
      L("cast-your-cares", "Cast all your anxiety on Him", "1 Peter 5:6–11", ["Psalm 55:22"]),
    ],
  },
  {
    slug: "stewardship-of-the-body",
    title: "Stewardship of the Body",
    category: "living",
    summary: "Your body, made by God and redeemed by Christ: honouring God with it, in training and in rest.",
    review: DRAFT,
    lessons: [
      L("fearfully-made", "Fearfully and wonderfully made", "Psalm 139:13–16", ["Genesis 1:26–31"]),
      L("temple-of-the-spirit", "A temple of the Holy Spirit", "1 Corinthians 6:12–20", ["Romans 6:12–13"]),
      L("living-sacrifice", "A living sacrifice", "Romans 12:1–2", ["Colossians 3:17"]),
      L("bodily-training", "Bodily training and godliness", "1 Timothy 4:6–10", ["1 Corinthians 9:24–27"]),
      L("rest-and-food", "Rest and food for the weary", "1 Kings 19:1–8", ["Mark 6:30–32"]),
    ],
  },

  // ---------------------------------------------------------------------------------------------- Books
  {
    slug: "john",
    title: "John",
    category: "books",
    summary: "That you may believe that Jesus is the Christ, the Son of God.",
    review: DRAFT,
    lessons: [
      L("prologue", "The Word", "John 1:1–18", ["Genesis 1:1–5"]),
      L("born-again", "Born again", "John 3:1–21", ["Ezekiel 36:25–27"]),
      L("bread-of-life", "The bread of life", "John 6:25–51", ["Exodus 16:13–18"]),
      L("resurrection-and-life", "The resurrection and the life", "John 11:1–44", ["1 Corinthians 15:20–26"]),
      L("that-you-may-believe", "That you may believe", "John 20:1–31", ["1 John 5:13"]),
    ],
  },
  {
    slug: "romans",
    title: "Romans",
    category: "books",
    summary: "The righteousness of God revealed in the gospel.",
    review: DRAFT,
    lessons: [
      L("power-of-god", "The power of God for salvation", "Romans 1:16–32", ["Habakkuk 2:4"]),
      L("justified-by-faith", "Justified by faith", "Romans 3:21–31", ["Galatians 2:16"]),
      L("peace-with-god", "Peace with God", "Romans 5:1–11", ["Ephesians 2:13–18"]),
      L("no-condemnation", "No condemnation", "Romans 8:1–39", ["John 10:27–30"]),
      L("living-sacrifices", "Living sacrifices", "Romans 12:1–21", ["1 Peter 4:7–11"]),
    ],
  },
  {
    slug: "james",
    title: "James",
    category: "books",
    summary: "Faith that works: wisdom for everyday life.",
    review: DRAFT,
    lessons: [
      L("trials-and-wisdom", "Trials, wisdom and the word", "James 1:1–27", ["Romans 5:3–5"]),
      L("faith-and-works", "Faith and works", "James 2:1–26", ["Ephesians 2:8–10"]),
      L("the-tongue", "The tongue and true wisdom", "James 3:1–18", ["Proverbs 18:21"]),
      L("draw-near", "Draw near to God", "James 4:1–17", ["Psalm 73:28"]),
      L("patience-and-prayer", "Patience and prayer", "James 5:1–20", ["1 Kings 18:41–45"]),
    ],
  },
  {
    slug: "ephesians",
    title: "Ephesians",
    category: "books",
    summary: "Every spiritual blessing in Christ, and a life worthy of the calling.",
    review: DRAFT,
    lessons: [
      L("every-blessing", "Every spiritual blessing", "Ephesians 1:1–23", []),
      L("by-grace", "By grace you have been saved", "Ephesians 2:1–22", []),
      L("the-mystery-revealed", "The mystery revealed", "Ephesians 3:1–21", []),
      L("walk-worthy", "Walk worthy of the calling", "Ephesians 4:1–32", []),
      L("walk-in-love", "Walk in love and light", "Ephesians 5:1–33", []),
      L("armour-of-god", "The armour of God", "Ephesians 6:1–24", []),
    ],
  },
  {
    slug: "philippians",
    title: "Philippians",
    category: "books",
    summary: "Joy in Christ, in every circumstance.",
    review: DRAFT,
    lessons: [
      L("to-live-is-christ", "To live is Christ", "Philippians 1:1–30", []),
      L("the-mind-of-christ", "The mind of Christ", "Philippians 2:1–30", []),
      L("knowing-christ", "Knowing Christ", "Philippians 3:1–21", []),
      L("rejoice-in-the-lord", "Rejoice in the Lord", "Philippians 4:1–23", []),
    ],
  },
  {
    slug: "1-timothy",
    title: "1 Timothy",
    category: "books",
    summary: "Sound teaching and godly living in the household of God.",
    review: DRAFT,
    lessons: [
      L("mercy-to-sinners", "Mercy for the worst of sinners", "1 Timothy 1:1–20", []),
      L("pray-for-all", "Pray for everyone", "1 Timothy 2:1–15", []),
      L("household-of-god", "The household of God", "1 Timothy 3:1–16", []),
      L("set-an-example", "Set an example", "1 Timothy 4:1–16", []),
      L("care-for-one-another", "Caring for one another", "1 Timothy 5:1–25", []),
      L("godliness-with-contentment", "Godliness with contentment", "1 Timothy 6:1–21", []),
    ],
  },
  {
    slug: "psalms",
    title: "Psalms",
    category: "books",
    summary: "Prayer and praise for every season of life.",
    review: DRAFT,
    lessons: [
      L("two-ways", "The two ways", "Psalm 1", ["Jeremiah 17:7–8"]),
      L("the-lord-my-shepherd", "The Lord is my shepherd", "Psalm 23", ["John 10:11–15"]),
      L("have-mercy", "Have mercy on me", "Psalm 51", []),
      L("bless-the-lord", "Bless the Lord, O my soul", "Psalm 103", []),
      L("you-know-me", "You have searched me and known me", "Psalm 139", []),
    ],
  },
  {
    slug: "proverbs",
    title: "Proverbs",
    category: "books",
    summary: "The fear of the Lord is the beginning of wisdom.",
    review: DRAFT,
    lessons: [
      L("wisdom-calls", "Wisdom calls out", "Proverbs 1:1–33", ["James 1:5"]),
      L("trust-in-the-lord", "Trust in the Lord", "Proverbs 3:1–35", []),
      L("guard-your-heart", "Guard your heart", "Proverbs 4:1–27", []),
      L("the-lord-directs", "The Lord directs our steps", "Proverbs 16:1–33", []),
      L("the-woman-of-strength", "A woman of strength", "Proverbs 31:1–31", []),
    ],
  },
];

export function findStudy(slug: string): Study | undefined {
  return STUDIES.find((s) => s.slug === slug);
}

export function findLesson(study: Study, slug: string): StudyLesson | undefined {
  return study.lessons.find((l) => l.slug === slug);
}

/** Study notes are shown to members only after a person approved them. */
export function notesVisible(study: Study, viewerIsAdmin: boolean): "approved" | "preview" | "hidden" {
  if (study.review.status === "approved") return "approved";
  return viewerIsAdmin ? "preview" : "hidden";
}
