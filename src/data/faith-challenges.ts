/**
 * Optional daily Faith challenges: one small, concrete act a day, each grounded in a passage. The passage text shown
 * with a challenge always comes from the verified BSB (src/server/bible/text.ts); only the reference is written here,
 * and tests/unit/faith-challenges.test.ts checks every reference against the text. The challenge wording is the app's
 * own application, not Scripture, and is listed for theological review (docs/faith/REVIEW.md).
 */
export interface FaithChallenge {
  id: string;
  text: string;
  reference: string;
}

export const FAITH_CHALLENGES: readonly FaithChallenge[] = [
  { id: "thanks-someone", text: "Thank someone today for something specific they did.", reference: "1 Thessalonians 5:18" },
  { id: "secret-help", text: "Do one helpful thing without being asked, and without telling anyone.", reference: "Matthew 6:3–4" },
  { id: "hide-word", text: "Learn one verse and say it from memory before bed.", reference: "Psalm 119:11" },
  { id: "pray-enemy", text: "Pray by name for someone who is hard for you to love.", reference: "Matthew 5:44" },
  { id: "be-still", text: "Spend ten quiet minutes with God, phone in another room.", reference: "Psalm 46:10" },
  { id: "encourage", text: "Encourage someone with a specific, honest word.", reference: "1 Thessalonians 5:11" },
  { id: "give-away", text: "Give away something you don't need to someone who could use it.", reference: "Acts 20:35" },
  { id: "listen", text: "Ask someone how they really are, and listen without interrupting.", reference: "James 1:19" },
  { id: "reconcile", text: "If you've wronged someone, take a first step to make it right.", reference: "Matthew 5:23–24" },
  { id: "fast-comfort", text: "Go without one small comfort today, and pray each time you'd reach for it.", reference: "Matthew 6:16–18" },
  { id: "count-gifts", text: "Write down three good things God has given you this week.", reference: "Psalm 103:2" },
  { id: "no-complaining", text: "Go the whole day without complaining.", reference: "Philippians 2:14" },
  { id: "psalm-aloud", text: "Read a psalm aloud as your own prayer.", reference: "Psalm 34:1" },
  { id: "forgive", text: "Forgive someone in your heart, and pray for their good.", reference: "Ephesians 4:32" },
  { id: "work-for-lord", text: "Do your work today as if for the Lord, including the parts no one sees.", reference: "Colossians 3:23" },
  { id: "hospitality", text: "Invite someone to share a meal or a walk.", reference: "Romans 12:13" },
  { id: "pray-leaders", text: "Pray for the leaders of your church and of your country.", reference: "1 Timothy 2:1–2" },
  { id: "morning-first", text: "Start the day with Scripture and prayer before your phone.", reference: "Psalm 5:3" },
  { id: "body-care", text: "Care for your body today: sleep, water and a good meal.", reference: "1 Corinthians 6:19–20" },
  { id: "walk-creation", text: "Take a walk outside and thank God for what you see.", reference: "Psalm 19:1" },
  { id: "gratitude-note", text: "Write a note of thanks to a parent, mentor or friend.", reference: "Philippians 1:3" },
  { id: "gentle-answer", text: "When you're tempted to answer harshly, answer gently.", reference: "Proverbs 15:1" },
  { id: "faithful-little", text: "Be honest in a small thing where it would be easy not to be.", reference: "Luke 16:10" },
  { id: "carry-burden", text: "Help one person carry a burden in a practical way.", reference: "Galatians 6:2" },
  { id: "lords-prayer", text: "Pray the Lord's Prayer slowly, one line at a time.", reference: "Matthew 6:9–13" },
  { id: "trust-tomorrow", text: "Name tomorrow's worries, hand them to God, and rest tonight.", reference: "Matthew 6:34" },
  { id: "worry-to-prayer", text: "Turn one worry into a prayer, and leave it with God.", reference: "Philippians 4:6–7" },
  { id: "share-hope", text: "Tell one person something God is teaching you.", reference: "1 Peter 3:15" },
  { id: "serve-home", text: "Look for one way to serve the people you live with.", reference: "Galatians 5:13" },
  { id: "give-thanks-meal", text: "Before each meal today, stop and give thanks.", reference: "1 Timothy 4:4–5" },
];

/** The challenge for a local date (YYYY-MM-DD): the same for everyone on that date, a new one each day. */
export function faithChallengeFor(date: string): FaithChallenge {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return FAITH_CHALLENGES[((day % FAITH_CHALLENGES.length) + FAITH_CHALLENGES.length) % FAITH_CHALLENGES.length]!;
}
