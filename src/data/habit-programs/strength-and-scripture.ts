import type { HabitActivity, HabitProgram, HabitWeek } from "@/lib/domain/habit-programs";
import { bibleHref, checkin, COMPLETION_80, FAITH_NOTE, lesson, prayer, readingWeek, reflection } from "./shared";

const workout: HabitActivity = {
  key: "workout",
  kind: "workout",
  title: "Strength session",
  detail: "Today's session from Intermediate Strength Builder.",
  href: "/train",
  onDays: [1, 2, 4, 5],
};
const sleep: HabitActivity = {
  key: "sleep",
  kind: "sleep",
  title: "Wind down for your sleep goal",
  detail: "Same wake time daily; screens off 30 minutes before bed.",
  href: "/progress/sleep",
};
const recoveryWalk: HabitActivity = {
  key: "walk",
  kind: "walk",
  title: "Recovery walk",
  detail: "An easy walk at your walk-minutes goal on a non-lifting day.",
  href: "/run",
  onDays: [3, 6],
};
const mobility: HabitActivity = {
  key: "mobility",
  kind: "mobility",
  title: "Mobility routine",
  detail: "Ten to fifteen minutes for hips, thoracic spine and shoulders.",
  href: "/train",
  onDays: [3],
};
const postTraining: HabitActivity = {
  key: "post-training-meal",
  kind: "habit",
  title: "Balanced meal after training",
  detail: "A normal meal with protein, carbohydrate and vegetables within a few hours of lifting.",
  href: "/nutrition",
  onDays: [1, 2, 4, 5],
};
const water: HabitActivity = {
  key: "water",
  kind: "water",
  title: "Drink enough water",
  detail: "A glass with each meal and a bottle during training.",
  href: "/nutrition",
};
const restDay: HabitActivity = {
  key: "rest-day",
  kind: "habit",
  title: "A day of rest",
  detail: "Optional. No lifting: rest, worship and time with others.",
  optional: true,
  onDays: [7],
};

function memoryVerse(reference: string, book: string, chapter: number): HabitActivity {
  return {
    key: "memory-verse",
    kind: "scripture",
    title: `Memory verse: ${reference}`,
    detail: "Optional. Read it in context, then say it from memory by the end of the week.",
    href: bibleHref(book, chapter),
    optional: true,
  };
}

type Reading = [book: string, chapter: number, title: string];

function week(
  n: number,
  w: Omit<HabitWeek, "week" | "daily" | "weekly"> & {
    required: HabitActivity[];
    readings: Reading[];
    prayer: string;
    reflection: string;
    verse: [reference: string, book: string, chapter: number];
    extraWeekly?: HabitActivity[];
    questions: string[];
  },
): HabitWeek {
  return {
    week: n,
    title: w.title,
    objective: w.objective,
    lesson: w.lesson,
    milestone: w.milestone,
    daily: [...w.required, restDay, ...readingWeek(w.readings), prayer(w.prayer), reflection(w.reflection, [7])],
    weekly: [lesson(), memoryVerse(...w.verse), ...(w.extraWeekly ?? []), checkin(w.questions)],
  };
}

export const STRENGTH_AND_SCRIPTURE: HabitProgram = {
  slug: "strength-and-scripture",
  name: "Strength and Scripture",
  summary: "Twelve weeks of four-day strength training with optional daily readings, prayer, reflection and a weekly memory verse.",
  description:
    "For people who already train and want to grow stronger in body while making room for Scripture. You follow Intermediate Strength Builder four days a week, and each week layers on one recovery habit: sleep, walking, mobility, nutrition after training and hydration. Every day offers an optional chapter of the Bible, a prayer prompt and a journal reflection, and every week an optional memory verse. Themes move through wisdom, diligence, strength, rest, self-control, perseverance, stewardship, contentment, courage, humility, endurance and finishing well.",
  category: "faith_fitness",
  level: "intermediate",
  days: 84,
  schedule: "4 strength sessions a week (days 1, 2, 4 and 5) for 12 weeks, with optional daily Scripture, prayer and reflection",
  equipment: ["Barbell, rack and plates, or the equipment Intermediate Strength Builder uses"],
  instructions: [
    "Lift on days 1, 2, 4 and 5 of each program week; days 3, 6 and 7 are for recovery.",
    "Readings, prayer, reflection and memory verses are always optional and never count towards completion.",
    "Reflections go in your private prayer journal; only you can see them.",
    "A missed day is simply missed. Pick up with the next session; nothing restarts.",
    "Stop and seek advice for sharp or worsening pain, chest pain or dizziness.",
  ],
  goalFields: [
    { key: "sleep_hours", label: "Sleep", unit: "hours", min: 6, max: 10, default: 8, help: "Adults need at least 7 hours; hard training benefits from 8 or more." },
    { key: "walk_minutes", label: "Recovery walk", unit: "minutes", min: 10, max: 60, default: 25, help: "Easy pace: you should be able to hold a conversation." },
    { key: "water_ml", label: "Water", unit: "ml/day", min: 1000, max: 5000, default: 2500, help: "More on training days and in hot weather." },
  ],
  completion: COMPLETION_80,
  linkedProgramSlug: "intermediate-strength-builder",
  faithNote: FAITH_NOTE,
  weeks: [
    week(1, {
      title: "Wisdom for training",
      objective: "Complete four sessions, record your starting numbers on the main lifts and settle into the routine.",
      lesson: {
        title: "Start with wisdom, not ego",
        body: [
          "Proverbs opens by saying the fear of the Lord is the beginning of knowledge (Proverbs 1:7). Wisdom in training means choosing loads you can lift well, rather than the ones that impress.",
          "Record your starting numbers this week so you can see real progress later. Leave one or two reps in reserve on most sets; strength is built by accumulating good work, not by grinding out every set.",
          "The daily readings this week walk through the opening chapters of Proverbs. They are optional, as is everything faith-related in this program.",
        ],
      },
      required: [workout],
      readings: [
        ["proverbs", 1, "Proverbs 1: The beginning of knowledge"],
        ["proverbs", 2, "Proverbs 2: Search for wisdom"],
        ["proverbs", 3, "Proverbs 3: Trust in the Lord"],
        ["proverbs", 4, "Proverbs 4: Guard your heart"],
        ["proverbs", 5, "Proverbs 5: For lack of discipline"],
        ["proverbs", 6, "Proverbs 6: Go to the ant"],
        ["proverbs", 7, "Proverbs 7: Keep my commands and live"],
      ],
      prayer: "Ask for wisdom in how you train and how you live.",
      reflection: "What do you hope God will grow in you over these twelve weeks?",
      verse: ["Proverbs 3:5–6", "proverbs", 3],
      extraWeekly: [{ key: "starting-numbers", kind: "habit", title: "Record your starting lifts", detail: "Note the weights and reps on your main lifts.", href: "/train" }],
      questions: ["How did your first four sessions feel?", "Which lift do you most want to improve?"],
      milestone: "Starting numbers recorded and four sessions done.",
    }),
    week(2, {
      title: "Diligence",
      objective: "Keep four sessions and add a nightly wind-down to protect your sleep.",
      lesson: {
        title: "Doing the work faithfully",
        body: [
          "James calls us to be doers of the word and not hearers only (James 1:22). Diligence in training is similar: the plan works when you do it, week after week.",
          "Sleep is the most powerful recovery tool you have. Adults need at least seven hours; people training hard often do best with eight or more. A consistent wake time and a short wind-down without screens make a real difference.",
          "This week the readings move through the letter of James, a practical book about faith that shows itself in everyday life.",
        ],
      },
      required: [workout, sleep],
      readings: [
        ["james", 1, "James 1: Doers of the word"],
        ["james", 2, "James 2: Faith and works"],
        ["james", 3, "James 3: Taming the tongue"],
        ["james", 4, "James 4: Draw near to God"],
        ["james", 5, "James 5: Be patient"],
        ["psalms", 1, "Psalm 1: Like a tree planted by streams"],
        ["psalms", 19, "Psalm 19: The heavens declare"],
      ],
      prayer: "Ask for steadiness in the ordinary work of this week.",
      reflection: "Where is God asking you to act on what you already know?",
      verse: ["James 1:12", "james", 1],
      questions: ["How many nights did you sleep seven hours or more?", "Did better sleep change any session?"],
      milestone: "Training and sleep working together.",
    }),
    week(3, {
      title: "Strength from God",
      objective: "Add an easy recovery walk on days 3 and 6 to your lifting and sleep habits.",
      lesson: {
        title: "Whose strength?",
        body: [
          "The Psalms often speak of God as our strength (Psalm 18:32; Psalm 28:7). Physical strength is a good gift, but it is not where our security lies.",
          "Easy walking on non-lifting days helps recovery by keeping blood flowing without adding fatigue. Keep it conversational: this is not a workout.",
          "Readings this week are Psalms about strength, refuge and trust.",
        ],
      },
      required: [workout, sleep, recoveryWalk],
      readings: [
        ["psalms", 18, "Psalm 18: He trains my hands for war"],
        ["psalms", 28, "Psalm 28: The Lord is my strength and shield"],
        ["psalms", 46, "Psalm 46: Be still and know"],
        ["psalms", 62, "Psalm 62: My soul finds rest in God alone"],
        ["psalms", 73, "Psalm 73: My flesh and heart may fail"],
        ["psalms", 84, "Psalm 84: From strength to strength"],
        ["psalms", 121, "Psalm 121: My help comes from the Lord"],
      ],
      prayer: "Thank God for the strength you have, and trust him with what you lack.",
      reflection: "Where are you tempted to find your security in your own strength?",
      verse: ["Psalm 28:7", "psalms", 28],
      questions: ["How did the recovery walks affect your next sessions?", "Which lift is moving best so far?"],
      milestone: "Lifting, sleep and active recovery in place.",
    }),
    week(4, {
      title: "Rest",
      objective: "Add a mobility routine on day 3 and take recovery seriously; if your program has a lighter week, use it fully.",
      lesson: {
        title: "Rest is part of the program",
        body: [
          "Jesus invited his tired disciples to 'come away by yourselves to a desolate place and rest a while' (Mark 6:31). Rest was built into creation and into the Law, not as a reward for working hard but as a gift.",
          "Strength is built during recovery. Many programs include lighter weeks to let fatigue fall so you can keep progressing. Take them seriously rather than adding extra work.",
          "Ten to fifteen minutes of mobility helps you move well under load: hips, upper back and shoulders especially.",
        ],
      },
      required: [workout, sleep, recoveryWalk, mobility],
      readings: [
        ["genesis", 2, "Genesis 2: God rested"],
        ["exodus", 20, "Exodus 20: Remember the Sabbath"],
        ["psalms", 23, "Psalm 23: He restores my soul"],
        ["psalms", 127, "Psalm 127: He gives to his beloved sleep"],
        ["1-kings", 19, "1 Kings 19: Elijah sleeps and eats"],
        ["mark", 6, "Mark 6: Come away and rest a while"],
        ["matthew", 11, "Matthew 11: Come to me, all who are weary"],
      ],
      prayer: "Rest in God's care, without needing to achieve anything today.",
      reflection: "How do you feel about resting? What makes it hard?",
      verse: ["Matthew 11:28", "matthew", 11],
      extraWeekly: [{ key: "recovery-review", kind: "habit", title: "Review your recovery", detail: "Sleep, soreness, energy and mood: what needs attention?", href: "/progress/sleep" }],
      questions: ["How rested do you feel compared to week one?", "What did you do on your rest day?"],
      milestone: "A full month: you've trained and rested well.",
    }),
    week(5, {
      title: "Self-control",
      objective: "Eat a balanced meal with protein after each lifting session.",
      lesson: {
        title: "A fruit, not a performance",
        body: [
          "Self-control appears in Galatians 5 as part of the fruit of the Spirit. It grows in us as we walk with God; it is not a test we pass through effort alone.",
          "In training, self-control often looks like eating enough. A normal meal containing protein, carbohydrate and vegetables within a few hours of training supports recovery. Most people who train do well on roughly 1.4–2.0 g of protein per kg of body weight across the day, from ordinary food.",
          "This week's readings work through Galatians, Paul's letter about freedom in Christ.",
        ],
      },
      required: [workout, sleep, recoveryWalk, mobility, postTraining],
      readings: [
        ["galatians", 1, "Galatians 1: Not from man"],
        ["galatians", 2, "Galatians 2: Christ lives in me"],
        ["galatians", 3, "Galatians 3: By faith"],
        ["galatians", 4, "Galatians 4: Children, not slaves"],
        ["galatians", 5, "Galatians 5: The fruit of the Spirit"],
        ["galatians", 6, "Galatians 6: Let us not grow weary"],
        ["2-peter", 1, "2 Peter 1: Add self-control to knowledge"],
      ],
      prayer: "Ask the Spirit to grow self-control where you need it most.",
      reflection: "Where does freedom in Christ change how you think about discipline?",
      verse: ["Galatians 5:22–23", "galatians", 5],
      questions: ["Did you eat well after each session?", "How has your energy in training been?"],
      milestone: "Recovery covered: sleep, walking, mobility and food.",
    }),
    week(6, {
      title: "Perseverance",
      objective: "Keep every habit going and log at least one progression: more weight or more reps on a main lift.",
      lesson: {
        title: "Endurance produces character",
        body: [
          "Paul writes that suffering produces endurance, endurance produces character, and character produces hope (Romans 5:3–4). Mid-program is often when motivation dips and character is formed.",
          "Progressive overload is simple: over time, do a little more. Add a small amount of weight when you hit the top of your rep range with good form, or add a rep before adding weight.",
          "If a lift stalls for two or three weeks, check sleep, food and stress before blaming the program.",
        ],
      },
      required: [workout, sleep, recoveryWalk, mobility, postTraining],
      readings: [
        ["romans", 5, "Romans 5: Endurance, character, hope"],
        ["romans", 8, "Romans 8: More than conquerors"],
        ["2-corinthians", 4, "2 Corinthians 4: Renewed day by day"],
        ["hebrews", 10, "Hebrews 10: Hold fast"],
        ["hebrews", 11, "Hebrews 11: By faith"],
        ["psalms", 40, "Psalm 40: I waited patiently"],
        ["isaiah", 40, "Isaiah 40: They shall mount up with wings"],
      ],
      prayer: "Pray for someone who is struggling to keep going.",
      reflection: "Where have you seen endurance produce something good in you?",
      verse: ["Isaiah 40:31", "isaiah", 40],
      extraWeekly: [{ key: "progression", kind: "habit", title: "Log a progression", detail: "More weight or reps on a main lift, with good form.", href: "/train" }],
      questions: ["Which lift progressed?", "What has been hardest about keeping going?"],
      milestone: "Halfway through, and measurably stronger.",
    }),
    week(7, {
      title: "Stewardship of the body",
      objective: "Add a daily water habit to complete your recovery routine.",
      lesson: {
        title: "Whatever you do",
        body: [
          "'Whether you eat or drink, or whatever you do, do all to the glory of God' (1 Corinthians 10:31). Caring for the body is ordinary stewardship, not vanity and not salvation.",
          "Even mild dehydration can reduce performance and make training feel harder. Drink regularly through the day and bring water to every session; pale yellow urine is a good guide.",
          "Paul uses athletic pictures often in 1 Corinthians; this week's readings explore the body, self-discipline and love.",
        ],
      },
      required: [workout, sleep, recoveryWalk, mobility, postTraining, water],
      readings: [
        ["1-corinthians", 6, "1 Corinthians 6: Glorify God in your body"],
        ["1-corinthians", 9, "1 Corinthians 9: I discipline my body"],
        ["1-corinthians", 10, "1 Corinthians 10: Do all to the glory of God"],
        ["1-corinthians", 12, "1 Corinthians 12: One body, many parts"],
        ["1-corinthians", 13, "1 Corinthians 13: The greatest is love"],
        ["romans", 12, "Romans 12: A living sacrifice"],
        ["1-timothy", 4, "1 Timothy 4: Bodily training is of some value"],
      ],
      prayer: "Offer your training, your work and your rest to God.",
      reflection: "What does it mean for you to honour God with your body?",
      verse: ["1 Corinthians 10:31", "1-corinthians", 10],
      questions: ["How many days did you reach your water goal?", "Which recovery habit is helping most?"],
      milestone: "Your complete recovery routine is in place.",
    }),
    week(8, {
      title: "Contentment",
      objective: "Keep the routine and list three non-scale wins from the program so far.",
      lesson: {
        title: "I can do all things?",
        body: [
          "Philippians 4:13 is often printed on gym walls, but Paul wrote it about contentment in hunger and plenty (Philippians 4:11–13). Christ's strength helps us be content whether or not we hit a personal best.",
          "Comparison steals joy. Your lifts are your own; measure against your past self and be grateful for what your body can do.",
          "If you're carrying fatigue, this is a good week to make sessions a little lighter and let recovery catch up.",
        ],
      },
      required: [workout, sleep, recoveryWalk, mobility, postTraining, water],
      readings: [
        ["philippians", 1, "Philippians 1: To live is Christ"],
        ["philippians", 2, "Philippians 2: The mind of Christ"],
        ["philippians", 3, "Philippians 3: I press on"],
        ["philippians", 4, "Philippians 4: I have learned to be content"],
        ["psalms", 131, "Psalm 131: A quieted soul"],
        ["psalms", 16, "Psalm 16: The lines have fallen in pleasant places"],
        ["1-timothy", 6, "1 Timothy 6: Godliness with contentment"],
      ],
      prayer: "Give thanks for what your body can do today.",
      reflection: "Where does comparison steal your joy, in training or elsewhere?",
      verse: ["Philippians 4:12–13", "philippians", 4],
      extraWeekly: [{ key: "non-scale-wins", kind: "habit", title: "List three non-scale wins", detail: "Strength, energy, sleep, mood or everyday life." }],
      questions: ["What are your three wins?", "How are you feeling about your progress?"],
      milestone: "Two months in, with gratitude for the progress made.",
    }),
    week(9, {
      title: "Courage",
      objective: "Keep every habit and take on one small, safe challenge in training.",
      lesson: {
        title: "Be strong and courageous",
        body: [
          "God told Joshua to be strong and courageous because 'the Lord your God is with you wherever you go' (Joshua 1:9). Courage is acting rightly while still afraid.",
          "In training, courage might be attempting a weight you've been avoiding, learning a lift properly with a coach, or filming your technique to review it honestly. Use safety bars or a spotter for heavy attempts.",
          "This week's readings tell stories of people who acted with courage because they trusted God.",
        ],
      },
      required: [workout, sleep, recoveryWalk, mobility, postTraining, water],
      readings: [
        ["joshua", 1, "Joshua 1: Be strong and courageous"],
        ["1-samuel", 17, "1 Samuel 17: David and Goliath"],
        ["nehemiah", 4, "Nehemiah 4: Remember the Lord"],
        ["nehemiah", 6, "Nehemiah 6: The wall was finished"],
        ["psalms", 27, "Psalm 27: Whom shall I fear?"],
        ["daniel", 3, "Daniel 3: Even if he does not"],
        ["acts", 4, "Acts 4: Boldness"],
      ],
      prayer: "Bring one fear to God, in training or in life.",
      reflection: "Where is God asking you to be brave right now?",
      verse: ["Joshua 1:9", "joshua", 1],
      extraWeekly: [{ key: "challenge", kind: "habit", title: "Take one safe challenge", detail: "A heavier single, a new lift learned properly, or a technique review on video.", href: "/train" }],
      questions: ["What challenge did you take on?", "What did it teach you?"],
      milestone: "You've trained bravely and safely.",
    }),
    week(10, {
      title: "Humility and service",
      objective: "Keep every habit, and train with or help someone else this week.",
      lesson: {
        title: "Strength for serving",
        body: [
          "Jesus washed his disciples' feet and said he came not to be served but to serve (John 13; Mark 10:45). Strength is meant to be used for others.",
          "Being stronger makes everyday service easier: carrying shopping for a neighbour, playing with children, helping someone move house. Training with a friend or encouraging a newer lifter builds community too.",
          "Humility also means accepting coaching, adjusting technique and letting go of ego lifting.",
        ],
      },
      required: [workout, sleep, recoveryWalk, mobility, postTraining, water],
      readings: [
        ["john", 13, "John 13: Jesus washes the disciples' feet"],
        ["mark", 10, "Mark 10: Not to be served but to serve"],
        ["luke", 14, "Luke 14: Take the lowest place"],
        ["micah", 6, "Micah 6: Walk humbly with your God"],
        ["1-peter", 5, "1 Peter 5: Clothe yourselves with humility"],
        ["james", 4, "James 4: God gives grace to the humble"],
        ["matthew", 20, "Matthew 20: Whoever would be great"],
      ],
      prayer: "Ask God to show you someone you can serve this week.",
      reflection: "How could your strength be used for someone else?",
      verse: ["Micah 6:8", "micah", 6],
      extraWeekly: [{ key: "serve", kind: "habit", title: "Train with or help someone", detail: "Invite a friend, encourage a beginner, or use your strength to help someone." }],
      questions: ["Who did you train with or help?", "What did you learn from it?"],
      milestone: "Strength put to use for others.",
    }),
    week(11, {
      title: "Endurance in hard seasons",
      objective: "Keep the routine through the hardest weeks of training and write a simple plan for disrupted weeks.",
      lesson: {
        title: "When the fig tree does not blossom",
        body: [
          "Habakkuk resolved to rejoice in God even when everything failed, and ends: 'He makes my feet like the deer's' (Habakkuk 3:17–19). Hard seasons come in life and in training.",
          "Late in a program, fatigue accumulates. Prioritise sleep and food, keep technique sharp, and don't add extra work. Missing a session is not failure.",
          "A plan for disrupted weeks helps: a minimum session of two main lifts in 30 minutes, or a walk and mobility when lifting isn't possible.",
        ],
      },
      required: [workout, sleep, recoveryWalk, mobility, postTraining, water],
      readings: [
        ["2-corinthians", 12, "2 Corinthians 12: My grace is sufficient"],
        ["habakkuk", 3, "Habakkuk 3: Yet I will rejoice"],
        ["psalms", 42, "Psalm 42: Why are you cast down, O my soul?"],
        ["psalms", 63, "Psalm 63: My soul thirsts for you"],
        ["lamentations", 3, "Lamentations 3: His mercies are new every morning"],
        ["2-timothy", 2, "2 Timothy 2: An athlete competes by the rules"],
        ["1-peter", 1, "1 Peter 1: A living hope"],
      ],
      prayer: "Bring the hardest part of this season honestly to God.",
      reflection: "What is helping you endure right now?",
      verse: ["2 Corinthians 12:9", "2-corinthians", 12],
      extraWeekly: [{ key: "minimum-plan", kind: "habit", title: "Write your minimum plan", detail: "What you'll do when a week falls apart: a short session, a walk, mobility." }],
      questions: ["How is your body handling the training load?", "What is your minimum plan?"],
      milestone: "You know how to keep going through a hard week.",
    }),
    week(12, {
      title: "Finishing well",
      objective: "Complete your final sessions, retest your main lifts against week one and plan your next block.",
      lesson: {
        title: "Run with endurance",
        body: [
          "Hebrews calls us to 'run with endurance the race that is set before us, looking to Jesus' (Hebrews 12:1–2). Paul, near the end of his life, wrote that he had finished the race and kept the faith (2 Timothy 4:7).",
          "Compare your lifts with week one and give thanks for the progress. Whatever the numbers, they don't measure your worth or your standing before God.",
          "Plan your next block now while you're motivated: another strength program, a lighter maintenance phase, or a new goal, keeping the recovery habits and rhythms of rest that helped.",
        ],
      },
      required: [workout, sleep, recoveryWalk, mobility, postTraining, water],
      readings: [
        ["hebrews", 12, "Hebrews 12: Run with endurance"],
        ["2-timothy", 4, "2 Timothy 4: I have finished the race"],
        ["acts", 20, "Acts 20: Finish my course with joy"],
        ["john", 17, "John 17: I have finished the work"],
        ["psalms", 90, "Psalm 90: Establish the work of our hands"],
        ["colossians", 3, "Colossians 3: Work heartily, as for the Lord"],
        ["revelation", 21, "Revelation 21: All things new"],
      ],
      prayer: "Thank God for these twelve weeks and ask for direction for what comes next.",
      reflection: "What has God shown you through these twelve weeks?",
      verse: ["Hebrews 12:1–2", "hebrews", 12],
      extraWeekly: [
        { key: "retest", kind: "habit", title: "Compare your lifts with week one", href: "/train" },
        { key: "next-block", kind: "habit", title: "Choose your next program", href: "/train/programs" },
      ],
      questions: ["How much stronger are you than in week one?", "What are you most thankful for?", "Which habits will you carry into the next block?"],
      milestone: "Program complete: twelve weeks of strength and Scripture.",
    }),
  ],
};
