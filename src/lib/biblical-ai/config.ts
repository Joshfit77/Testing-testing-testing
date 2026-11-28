/**
 * Narrow Gate Biblical AI: product configuration (pure; client and server). Limits are product defaults for the
 * founder to review (docs/biblical-ai/PRODUCT_DECISIONS.md); the server reads the environment overrides.
 */
import type { Plan } from "@/lib/domain/types";

export const BIBLICAL_AI_FLAG = "biblical_ai";
export const BIBLICAL_AI_NAME = "Narrow Gate Biblical AI";
export const BIBLICAL_AI_SUBTITLE = "Rooted in Scripture. Centered on Christ.";
export const BIBLICAL_AI_TAGLINE = "Know the Word. Defend the Truth. Grow in Christ.";

export type Depth = "quick" | "standard" | "deep";
export const DEPTHS: { id: Depth; label: string; description: string }[] = [
  { id: "quick", label: "Quick answer", description: "A direct biblical answer with the key passages." },
  { id: "standard", label: "Standard study", description: "Answer, supporting Scripture, context and application." },
  { id: "deep", label: "Deep study", description: "Literary and historical context, original languages, cross-references and reflection questions." },
];

export type CategoryId = "scripture" | "doctrine" | "apologetics" | "languages" | "history" | "personal";
export interface Category {
  id: CategoryId;
  title: string;
  description: string;
  /** Starting points the member can tap (each becomes the question; the member can edit it first). */
  topics: { label: string; prompt: string }[];
}

export const CATEGORIES: Category[] = [
  {
    id: "scripture",
    title: "Study Scripture",
    description: "Passages, chapters and books in their context.",
    topics: [
      { label: "Ask Scripture", prompt: "" },
      { label: "Verse-by-verse study", prompt: "Walk me through Philippians 2:5–11 verse by verse." },
      { label: "Chapter analysis", prompt: "What is the structure and main message of Romans 8?" },
      { label: "Book overview", prompt: "Give me an overview of the book of Hebrews: author, audience, purpose and structure." },
      { label: "Cross-references", prompt: "Which passages help explain Isaiah 53?" },
      { label: "Difficult passages", prompt: "How should Hebrews 6:4–6 be understood in its context?" },
      { label: "Interpretation", prompt: "How do I interpret a parable faithfully? Use the parable of the sower as an example." },
    ],
  },
  {
    id: "doctrine",
    title: "Gospel and Doctrine",
    description: "The Gospel and what the Bible teaches.",
    topics: [
      { label: "The Gospel", prompt: "What is the Gospel, according to 1 Corinthians 15:1–4?" },
      { label: "Salvation", prompt: "How does the Bible say a person is saved?" },
      { label: "Repentance", prompt: "What is genuine repentance according to Scripture?" },
      { label: "Saving faith", prompt: "What is saving faith, and how is it different from mere belief?" },
      { label: "The Trinity", prompt: "What does the Bible teach about the Trinity?" },
      { label: "Jesus Christ", prompt: "How does the New Testament show that Jesus is fully God and fully man?" },
      { label: "The Holy Spirit", prompt: "What does Scripture teach about the person and work of the Holy Spirit?" },
      { label: "Justification", prompt: "What does it mean to be justified by faith (Romans 3–5)?" },
      { label: "Sanctification", prompt: "How does a Christian grow in holiness?" },
      { label: "Discipleship", prompt: "What does it mean to follow Jesus as His disciple?" },
    ],
  },
  {
    id: "apologetics",
    title: "Apologetics and Evangelism",
    description: "Defend the faith and share the Gospel.",
    topics: [
      { label: "Defending Christianity", prompt: "What are the strongest reasons to believe Christianity is true?" },
      { label: "The resurrection", prompt: "What is the historical evidence for the resurrection of Jesus?" },
      { label: "Common objections", prompt: "How should a Christian respond to the problem of evil and suffering?" },
      { label: "Reliability of Scripture", prompt: "How do we know the New Testament was transmitted reliably?" },
      { label: "Alleged contradictions", prompt: "How do the resurrection accounts in the four Gospels fit together?" },
      { label: "Biblical worldview", prompt: "What is a biblical worldview, and how does it answer life's big questions?" },
      { label: "Gospel conversations", prompt: "Help me practise a respectful conversation sharing the Gospel with a friend who is an atheist." },
    ],
  },
  {
    id: "languages",
    title: "Original Languages",
    description: "Hebrew, Aramaic and Greek behind the text.",
    topics: [
      { label: "Greek word study", prompt: "What does the Greek word behind \"love\" in John 3:16 mean, and how is it used?" },
      { label: "Hebrew word study", prompt: "What does the Hebrew word behind \"steadfast love\" in Psalm 136:1 mean?" },
      { label: "Aramaic passages", prompt: "Which parts of Daniel are written in Aramaic, and why might that be?" },
      { label: "Grammar and morphology", prompt: "Explain the tense and voice of \"it is finished\" in John 19:30." },
      { label: "Translation comparison", prompt: "Why do translations differ on \"the Word was God\" in John 1:1? Explain the Greek." },
    ],
  },
  {
    id: "history",
    title: "History and Archaeology",
    description: "The world the Bible was written in.",
    topics: [
      { label: "Biblical history", prompt: "What was happening historically when Isaiah prophesied?" },
      { label: "Geography", prompt: "Describe the geography of Galilee in Jesus' ministry." },
      { label: "Ancient civilizations", prompt: "What do we know about the Babylonian exile from history and the Bible?" },
      { label: "Cultural background", prompt: "What was the cultural significance of Jesus eating with tax collectors?" },
      { label: "Manuscripts", prompt: "What are the Dead Sea Scrolls, and what do they show about the Old Testament text?" },
      { label: "Archaeology", prompt: "What archaeological discoveries relate to King David?" },
    ],
  },
  {
    id: "personal",
    title: "Personal Study",
    description: "Studies for your walk with Christ.",
    topics: [
      { label: "Personalized Bible study", prompt: "" },
      { label: "Christian living", prompt: "What does the Bible say about overcoming anxiety?" },
      { label: "Spiritual growth", prompt: "How can I grow in prayer according to Scripture?" },
      { label: "Fitness and faith", prompt: "What does the Bible say about stewarding my body and self-control, without making fitness an idol?" },
      { label: "Temptation", prompt: "How does Scripture teach believers to fight temptation?" },
      { label: "Suffering", prompt: "How can I keep faith during suffering, according to Scripture?" },
    ],
  },
];

export function categoryById(id: string | null | undefined): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

/** Reader actions for a selected passage ("Study with Biblical AI"). `{ref}` is replaced with the passage. */
export const PASSAGE_ACTIONS: { id: string; label: string; prompt: string; depth: Depth; category: CategoryId }[] = [
  { id: "explain", label: "Explain this passage", prompt: "Explain {ref} in its context.", depth: "standard", category: "scripture" },
  { id: "history", label: "Historical context", prompt: "What is the historical and cultural context of {ref}?", depth: "standard", category: "history" },
  { id: "languages", label: "Original-language meaning", prompt: "What do the key Hebrew, Aramaic or Greek words in {ref} mean in context?", depth: "deep", category: "languages" },
  { id: "related", label: "Related Scripture", prompt: "Which other passages relate to {ref}, and how do they help explain it?", depth: "standard", category: "scripture" },
  { id: "study", label: "Generate a Bible study", prompt: "Create a short Bible study on {ref} with questions for reflection.", depth: "deep", category: "personal" },
  { id: "commentary", label: "Theological commentary", prompt: "What do faithful interpreters teach about {ref}?", depth: "deep", category: "doctrine" },
  { id: "reflect", label: "Reflection questions", prompt: "Give me reflection questions on {ref}.", depth: "quick", category: "personal" },
  { id: "apply", label: "Practical application", prompt: "How can I apply {ref} faithfully in everyday life?", depth: "standard", category: "personal" },
];

/** The eleven approved modern teachers (founder's list, 2026-11-28). Only material from an approved source is used. */
export const APPROVED_TEACHERS: { slug: string; name: string; ministry: string | null }[] = [
  { slug: "john-macarthur", name: "John MacArthur", ministry: "Grace to You" },
  { slug: "ray-comfort", name: "Ray Comfort", ministry: "Living Waters" },
  { slug: "john-piper", name: "John Piper", ministry: "Desiring God" },
  { slug: "paul-washer", name: "Paul Washer", ministry: "HeartCry Missionary Society" },
  { slug: "tim-conway", name: "Tim Conway", ministry: "I'll Be Honest" },
  { slug: "voddie-baucham", name: "Voddie Baucham", ministry: null },
  { slug: "billy-graham", name: "Billy Graham", ministry: "Billy Graham Evangelistic Association" },
  { slug: "alistair-begg", name: "Alistair Begg", ministry: "Truth For Life" },
  { slug: "mark-spence", name: "Mark Spence", ministry: "Living Waters" },
  { slug: "frank-turk", name: "Frank Turk", ministry: null },
  { slug: "jeff-durbin", name: "Jeff Durbin", ministry: "Apologia Studios / Apologia Church" },
];

/** Surnames and full names that mark an attribution to a teacher (checked in every answer). */
export const TEACHER_NAME_PATTERN = new RegExp(`\\b(${APPROVED_TEACHERS.flatMap((t) => [t.name, t.name.split(" ").at(-1)!]).join("|")})\\b`, "i");

export interface Limits {
  perMinute: number;
  daily: number;
  monthly: number;
  depths: Depth[];
  studyPlans: boolean;
  /** Conversations kept in the history list (older ones remain until deleted, but aren't listed). */
  historyListed: number;
}

/** Defaults (founder review pending); the server applies BIBLICAL_AI_* environment overrides. */
export const DEFAULT_LIMITS: Record<"free" | "pro", Limits> = {
  free: { perMinute: 2, daily: 3, monthly: 60, depths: ["quick", "standard"], studyPlans: false, historyListed: 10 },
  pro: { perMinute: 5, daily: 40, monthly: 400, depths: ["quick", "standard", "deep"], studyPlans: true, historyListed: 200 },
};

/** Free members also get a small per-member money budget for Biblical AI (micro-dollars per month). */
export const FREE_MEMBER_BUDGET_MICROS = 300_000;

/**
 * Pro All Access gets the Pro limits. Everyone else, including legacy Plus (a plan with no AI), gets the Free
 * allowance, so no existing subscription's terms change.
 */
export function tierOf(plan: Plan): "free" | "pro" {
  return plan === "pro" ? "pro" : "free";
}

export const MAX_QUESTION = 1200;
export const STUDY_DURATIONS = [7, 14, 30, 60, 90] as const;
export type StudyDuration = (typeof STUDY_DURATIONS)[number];
export const STUDY_TOPICS = [
  "Understanding the Gospel",
  "Genuine repentance",
  "Growing in prayer",
  "Overcoming temptation",
  "Spiritual discipline",
  "Preparing for marriage",
  "Biblical marriage",
  "Biblical manhood",
  "Biblical womanhood",
  "Faith during suffering",
  "Forgiveness",
  "Humility",
  "Evangelism",
  "Christian apologetics",
  "Biblical stewardship",
  "Growing in holiness",
  "Glorifying God through physical activity",
] as const;

export const BIBLICAL_AI_DISCLAIMER =
  "Biblical AI is an AI study companion, not a pastor, and it can be wrong. Scripture is the authority: read every passage for yourself, and bring important questions to your pastor and local church.";
