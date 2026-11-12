/**
 * Static content.
 *
 * Scripture text is from the Berean Standard Bible (BSB, public domain), copied from the official
 * BSB text via src/data/bsb-passages.json (see src/data/scripture.ts).
 */

import { ACTIVE_TRANSLATION, scriptureText } from "@/data/scripture";

/** The translation in use (see src/data/scripture.ts). */
export const TRANSLATION = ACTIVE_TRANSLATION;

export type FaithTheme = "perseverance" | "humility" | "discipline" | "self_control" | "stewardship" | "gratitude";

export const THEME_LABELS: Record<FaithTheme | "other", string> = {
  perseverance: "Perseverance",
  humility: "Humility",
  discipline: "Discipline",
  self_control: "Self-control",
  stewardship: "Stewardship",
  gratitude: "Gratitude",
  other: "Other",
};

export interface Scripture {
  reference: string;
  text: string;
  themes: FaithTheme[];
  reflection: string;
}

const SCRIPTURE_ENTRIES: Scripture[] = [
  {
    reference: "Matthew 7:13–14",
    text:
      "Enter through the narrow gate. For wide is the gate and broad is the way that leads to destruction, and many enter through it. But small is the gate and narrow the way that leads to life, and only a few find it.",
    themes: ["discipline", "perseverance"],
    reflection:
      "The narrow way is rarely the easy one. Where in your training or life are you tempted to take the broad, comfortable path today?",
  },
  {
    reference: "1 Corinthians 9:24–25",
    text:
      "Do you not know that in a race all the runners run, but only one receives the prize? Run in such a way as to take the prize. Everyone who competes in the games trains with strict discipline. They do it for a crown that is perishable, but we do it for a crown that is imperishable.",
    themes: ["discipline", "self_control"],
    reflection: "Athletes practise temperance for a fading prize. What lasting prize shapes how you train and live?",
  },
  {
    reference: "1 Timothy 4:8",
    text:
      "For physical exercise is of limited value, but godliness is valuable in every way, holding promise for the present life and for the one to come.",
    themes: ["stewardship", "humility"],
    reflection: "Training has real value, yet it is not the highest value. How can your training serve something greater?",
  },
  {
    reference: "Hebrews 12:1",
    text:
      "Therefore, since we are surrounded by such a great cloud of witnesses, let us throw off every encumbrance and the sin that so easily entangles, and let us run with endurance the race set out for us.",
    themes: ["perseverance"],
    reflection: "What weight could you lay aside this week to run your race with more patience?",
  },
  {
    reference: "Galatians 6:9",
    text: "Let us not grow weary in well-doing, for in due time we will reap a harvest if we do not give up.",
    themes: ["perseverance"],
    reflection: "Progress often feels invisible. Which small, faithful habit will you keep even when results feel slow?",
  },
  {
    reference: "Isaiah 40:31",
    text:
      "But those who wait upon the LORD will renew their strength; they will mount up with wings like eagles; they will run and not grow weary, they will walk and not faint.",
    themes: ["perseverance", "humility"],
    reflection: "Strength is renewed, not only built. How are you making space for rest and renewal?",
  },
  {
    reference: "Proverbs 16:32",
    text: "He who is slow to anger is better than a warrior, and he who controls his temper is greater than one who captures a city.",
    themes: ["self_control"],
    reflection: "Ruling your own spirit is a greater feat than any lift. Where can you practise self-control today?",
  },
  {
    reference: "Proverbs 25:28",
    text: "Like a city whose walls are broken down is a man who does not control his temper.",
    themes: ["self_control", "discipline"],
    reflection: "Discipline builds walls that protect what matters. Which boundary would serve you well this week?",
  },
  {
    reference: "1 Corinthians 6:19–20",
    text:
      "Do you not know that your body is a temple of the Holy Spirit who is in you, whom you have received from God? You are not your own; you were bought at a price. Therefore glorify God with your body.",
    themes: ["stewardship"],
    reflection: "Caring for your body can be an act of stewardship, not vanity. What does faithful care look like for you right now?",
  },
  {
    reference: "James 4:10",
    text: "Humble yourselves before the Lord, and He will exalt you.",
    themes: ["humility"],
    reflection: "Humility in training means honest loads, honest effort and honest rest. Where does ego need to step aside?",
  },
  {
    reference: "Micah 6:8",
    text:
      "He has shown you, O man, what is good. And what does the LORD require of you but to act justly, to love mercy, and to walk humbly with your God?",
    themes: ["humility"],
    reflection: "How can the strength you build be used to serve others with justice and mercy?",
  },
  {
    reference: "1 Peter 4:10",
    text:
      "As good stewards of the manifold grace of God, each of you should use whatever gift he has received to serve one another.",
    themes: ["stewardship", "gratitude"],
    reflection: "What gift — health, time, encouragement — can you steward for someone else this week?",
  },
  {
    reference: "Galatians 5:22–23",
    text:
      "But the fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faithfulness, gentleness, and self-control. Against such things there is no law.",
    themes: ["self_control", "humility"],
    reflection: "Temperance appears alongside love and joy. Which of these fruits do you most want to grow?",
  },
  {
    reference: "2 Timothy 1:7",
    text: "For God has not given us a spirit of fear, but of power, love, and self-control.",
    themes: ["discipline", "perseverance"],
    reflection: "Self-control is a gift, not a grind. What fear is holding back your next step?",
  },
  {
    reference: "Colossians 3:23",
    text: "Whatever you do, work at it with your whole being, as for the Lord and not for men,",
    themes: ["discipline", "stewardship"],
    reflection: "Train and work wholeheartedly — not for applause. What would 'heartily' look like in today's session?",
  },
  {
    reference: "Philippians 3:13–14",
    text:
      "Brothers, I do not consider myself yet to have taken hold of it. But one thing I do: Forgetting what is behind and straining toward what is ahead, I press on toward the goal to win the prize of God’s heavenly calling in Christ Jesus.",
    themes: ["perseverance", "humility"],
    reflection: "Yesterday's missed workout doesn't define today. What will you press toward next?",
  },
  {
    reference: "Romans 5:3–4",
    text: "Not only that, but we also rejoice in our sufferings, because we know that suffering produces perseverance; perseverance, character; and character, hope.",
    themes: ["perseverance"],
    reflection: "Difficulty can produce patience and hope. What hard thing is shaping you right now?",
  },
  {
    reference: "Psalm 118:24",
    text: "This is the day that the LORD has made; we will rejoice and be glad in it.",
    themes: ["gratitude"],
    reflection: "Name three things your body allowed you to do today that you're grateful for.",
  },
];

export const SCRIPTURES: Scripture[] = SCRIPTURE_ENTRIES.map((s) => ({ ...s, text: scriptureText(s.reference, s.text) }));

/** Deterministic "verse of the day" so every user sees the same verse on a given date. */
export function scriptureForDate(isoDate: string): Scripture {
  let hash = 0;
  for (const ch of isoDate) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return SCRIPTURES[hash % SCRIPTURES.length]!;
}

export const FAITH_MOTIVATIONS = [
  "Faithful in little things — show up for today's session.",
  "Discipline is a quiet form of worship when done with a grateful heart.",
  "Strength is a gift. Steward it well and use it to serve.",
  "Rest is not weakness. Even the strongest need renewal.",
  "Run with patience the race set before you — not someone else's race.",
];

export interface SeedContent {
  key: string;
  kind: "announcement" | "tip" | "devotional";
  title: string;
  body: string;
  scriptureRef?: string;
}

export const SEED_CONTENT: SeedContent[] = [
  {
    key: "tip-progressive-overload",
    kind: "tip",
    title: "Progress in small steps",
    body:
      "Progressive overload doesn't have to mean adding weight every session. One more rep, one more set, better technique or a little less rest all count as progress.",
  },
  {
    key: "tip-rpe",
    kind: "tip",
    title: "What does RPE mean?",
    body:
      "RPE (rate of perceived exertion) rates how hard a set felt from 1–10. RPE 8 means you could have done about two more reps with good form. It helps your program adapt to good and bad days.",
  },
  {
    key: "tip-sleep",
    kind: "tip",
    title: "Recovery is part of training",
    body:
      "Muscles adapt between sessions, not during them. Consistent sleep, enough protein and planned easier weeks help you keep progressing.",
  },
  {
    key: "devotional-narrow-gate",
    kind: "devotional",
    title: "The Narrow Gate",
    scriptureRef: "Matthew 7:13–14",
    body:
      "Jesus contrasts a wide, easy road with a narrow gate that few find. Training teaches a small version of this lesson every day: the comfortable choice is always available, and the better path usually asks for patience and discipline. Today, consider one area where you want to choose the narrow way — not out of guilt, but because it leads to life.",
  },
  {
    key: "devotional-temperance",
    kind: "devotional",
    title: "Temperate in All Things",
    scriptureRef: "1 Corinthians 9:24–25",
    body:
      "Paul uses the athlete as a picture of focused living. Temperance isn't harsh restriction; it's ordering our desires toward what matters most. Reflect on how your training, eating and resting could reflect a balanced, grateful life.",
  },
  {
    key: "devotional-stewardship",
    kind: "devotional",
    title: "Stewarding the Body",
    scriptureRef: "1 Corinthians 6:19–20",
    body:
      "Seeing the body as something entrusted to us reframes fitness. The aim isn't comparison or vanity, but faithful care — strength to serve family, community and neighbor.",
  },
];

export const FEATURE_FLAGS = [
  { key: "ai_coach", enabled: true, description: "Enable the AI coach for eligible plans." },
  { key: "ai_plan_generation", enabled: true, description: "Allow AI-generated workout plan proposals." },
  { key: "food_search", enabled: true, description: "Enable external food database search (requires USDA_FDC_API_KEY)." },
  { key: "faith_section", enabled: true, description: "Show the optional Faith section to users who opt in." },
  { key: "signups", enabled: true, description: "Allow new account registration." },
];

export interface RecoveryActivity {
  title: string;
  minutes: number;
  description: string;
}

export const REST_DAY_ACTIVITIES: RecoveryActivity[] = [
  { title: "Easy walk", minutes: 20, description: "A conversational-pace walk outdoors promotes blood flow without adding fatigue." },
  { title: "Mobility flow", minutes: 15, description: "Run the Daily Mobility Flow — hips, spine and shoulders through comfortable ranges." },
  { title: "Breathing reset", minutes: 5, description: "Slow nasal breathing: inhale 4 seconds, exhale 6 seconds. Helps you downshift after stress." },
  { title: "Light bike or swim", minutes: 20, description: "Very easy cardio. You should finish feeling fresher than when you started." },
  { title: "Sleep focus", minutes: 0, description: "Aim for a consistent bedtime and wake time. Sleep is the most powerful recovery tool available." },
];

export const EXERCISE_MODIFICATIONS: { situation: string; options: string[] }[] = [
  {
    situation: "A movement causes pain",
    options: [
      "Stop the exercise and skip it — the logger lets you mark it skipped for pain.",
      "Try a listed alternative that feels comfortable, or reduce the range of motion.",
      "Persistent, sharp or worsening pain should be assessed by a qualified healthcare professional.",
    ],
  },
  {
    situation: "Knees feel irritated",
    options: ["Swap jumps for step-ups or sled pushes", "Use a box squat to control depth", "Prefer reverse lunges over forward lunges"],
  },
  {
    situation: "Lower back feels fatigued",
    options: ["Swap barbell deadlifts for glute bridges or hip thrusts", "Use supported rows instead of bent-over rows", "Reduce load and focus on bracing"],
  },
  {
    situation: "Shoulders feel irritated with overhead work",
    options: ["Swap overhead press for landmine press", "Use a neutral grip with dumbbells", "Reduce range of motion to a comfortable height"],
  },
  {
    situation: "Joints prefer low impact",
    options: ["Swap running/jumping for cycling, rowing or brisk walking", "Use step-back burpees instead of jumping burpees", "Choose the Active Aging or Recovery programs"],
  },
];
