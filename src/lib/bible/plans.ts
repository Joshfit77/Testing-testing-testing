/**
 * Reading journeys: what each plan reads and how it is divided into days. Pure functions; the server supplies the
 * verse list (with word counts) from the verified BSB text (src/server/bible/plans.ts).
 *
 * Division: each plan (or each track of the guided plan) is split into exactly `days` parts of about equal length in
 * words. When the plan has at least as many chapters as days, every day ends at the end of a chapter; otherwise days
 * end at verse boundaries, preferring a chapter end when one is close. Nothing is skipped or repeated: the days
 * together cover the whole plan, in order.
 */
import { BIBLE_BOOKS, bookById } from "./books";
import { formatReference, parseReference, type ScriptureRef } from "./reference";

export const PLAN_KINDS = ["guided", "gospels", "new_testament", "old_testament", "chronological", "full_bible", "book", "topic"] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];
export const JOURNEY_DURATIONS = [30, 60, 90, 180, 365] as const;
export type JourneyDuration = (typeof JOURNEY_DURATIONS)[number];

/** Silent reading pace used for time estimates (words per minute). */
export const READING_WPM = 200;
/** A day must have at least this many verses, or the plan is too short for the duration. */
export const MIN_VERSES_PER_DAY = 3;

export const PLAN_INFO: Record<PlanKind, { label: string; description: string }> = {
  guided: { label: "Guided reading", description: "The New Testament with the Psalms and Proverbs alongside, a portion of each every day." },
  gospels: { label: "The Gospels", description: "Matthew, Mark, Luke and John: the life, teaching, death and resurrection of Jesus." },
  new_testament: { label: "New Testament", description: "Matthew to Revelation, in order." },
  old_testament: { label: "Old Testament", description: "Genesis to Malachi, in order." },
  chronological: { label: "Chronological", description: "The whole Bible in an approximate order of events (one common arrangement)." },
  full_bible: { label: "Whole Bible", description: "Genesis to Revelation, every chapter, in order." },
  book: { label: "One book", description: "A single book of your choice." },
  topic: { label: "By topic", description: "Selected passages on one theme." },
};

/** [book, first chapter, last chapter] */
type Segment = [string, number, number];

const whole = (ids: string[]): Segment[] => ids.map((id) => [id, 1, bookById(id)!.chapters]);
const range = (from: string, to: string) => {
  const a = BIBLE_BOOKS.findIndex((b) => b.id === from);
  const b = BIBLE_BOOKS.findIndex((x) => x.id === to);
  return BIBLE_BOOKS.slice(a, b + 1).map((x) => x.id);
};

/**
 * An approximate chronological order (book and chapter blocks). Placements such as Job, the Psalms and the prophets
 * follow one common arrangement; scholars differ on several of them. Flagged for theological review.
 */
export const CHRONOLOGICAL: Segment[] = [
  ["GEN", 1, 11], ["JOB", 1, 42], ["GEN", 12, 50], ["EXO", 1, 40], ["LEV", 1, 27], ["NUM", 1, 36], ["DEU", 1, 34], ["PSA", 90, 90],
  ["JOS", 1, 24], ["JDG", 1, 21], ["RUT", 1, 4], ["1SA", 1, 31], ["2SA", 1, 24], ["1CH", 1, 29], ["PSA", 1, 89], ["PSA", 91, 106],
  ["1KI", 1, 11], ["PRO", 1, 31], ["ECC", 1, 12], ["SNG", 1, 8], ["2CH", 1, 9], ["1KI", 12, 22], ["2KI", 1, 17],
  ["JOL", 1, 3], ["JON", 1, 4], ["AMO", 1, 9], ["HOS", 1, 14], ["ISA", 1, 66], ["MIC", 1, 7], ["2KI", 18, 25], ["2CH", 10, 36],
  ["NAM", 1, 3], ["ZEP", 1, 3], ["HAB", 1, 3], ["JER", 1, 52], ["LAM", 1, 5], ["PSA", 107, 150], ["OBA", 1, 1], ["EZK", 1, 48],
  ["DAN", 1, 12], ["EZR", 1, 6], ["HAG", 1, 2], ["ZEC", 1, 14], ["EST", 1, 10], ["EZR", 7, 10], ["NEH", 1, 13], ["MAL", 1, 4],
  ["MAT", 1, 28], ["MRK", 1, 16], ["LUK", 1, 24], ["JHN", 1, 21], ["ACT", 1, 12], ["JAS", 1, 5], ["ACT", 13, 14], ["GAL", 1, 6],
  ["ACT", 15, 18], ["1TH", 1, 5], ["2TH", 1, 3], ["ACT", 19, 20], ["1CO", 1, 16], ["2CO", 1, 13], ["ROM", 1, 16], ["ACT", 21, 28],
  ["EPH", 1, 6], ["PHP", 1, 4], ["COL", 1, 4], ["PHM", 1, 1], ["1TI", 1, 6], ["TIT", 1, 3], ["1PE", 1, 5], ["2TI", 1, 4],
  ["2PE", 1, 3], ["HEB", 1, 13], ["JUD", 1, 1], ["1JN", 1, 5], ["2JN", 1, 1], ["3JN", 1, 1], ["REV", 1, 22],
];

/** Topic plans: selected passages per theme. Flagged for theological review. */
export const TOPICS: Record<string, { label: string; description: string; passages: string[] }> = {
  prayer: {
    label: "Prayer",
    description: "How Jesus taught us to pray, and the prayers of God's people.",
    passages: [
      "Matthew 6:5–15", "Luke 11:1–13", "Luke 18:1–14", "John 17:1–26", "Matthew 26:36–46", "Mark 11:20–25", "Psalm 5", "Psalm 23",
      "Psalm 51", "Psalm 63", "Psalm 86", "Psalm 139", "Psalm 145", "1 Samuel 1:1–28", "1 Kings 8:22–53", "2 Chronicles 7:11–22",
      "Nehemiah 1:1–11", "Daniel 9:1–19", "Jonah 2:1–10", "Habakkuk 3:1–19", "Ephesians 1:15–23", "Ephesians 3:14–21",
      "Ephesians 6:10–20", "Philippians 4:4–9", "Colossians 1:9–14", "Colossians 4:2–6", "1 Thessalonians 5:16–18",
      "1 Timothy 2:1–8", "Hebrews 4:14–16", "James 5:13–18", "1 John 5:13–15", "Romans 8:18–30",
    ],
  },
  trust: {
    label: "Faith and trusting God",
    description: "Trusting God in uncertainty, fear and trouble.",
    passages: [
      "Genesis 22:1–19", "Joshua 1:1–9", "2 Kings 6:8–23", "Psalm 27", "Psalm 37", "Psalm 46", "Psalm 62", "Psalm 91", "Psalm 121",
      "Proverbs 3:1–12", "Isaiah 26:1–4", "Isaiah 40:12–31", "Isaiah 41:8–13", "Jeremiah 17:5–8", "Lamentations 3:19–33",
      "Daniel 3:1–30", "Daniel 6:1–28", "Habakkuk 3:17–19", "Matthew 6:25–34", "Matthew 14:22–33", "Mark 4:35–41",
      "Luke 12:22–34", "John 14:1–27", "Romans 4:16–25", "Romans 8:28–39", "2 Corinthians 4:7–18", "2 Corinthians 12:7–10",
      "Philippians 4:10–13", "Hebrews 11:1–40", "1 Peter 5:6–11",
    ],
  },
  gospel: {
    label: "Grace and the Gospel",
    description: "Sin, grace, the cross and new life in Christ.",
    passages: [
      "Genesis 3:1–24", "Psalm 32", "Psalm 103", "Isaiah 53:1–12", "John 1:1–18", "John 3:1–21", "Luke 15:1–32",
      "Luke 23:32–49", "John 19:16–30", "John 20:1–31", "Acts 2:22–41", "Romans 3:9–31", "Romans 5:1–21", "Romans 6:1–23",
      "Romans 8:1–17", "Romans 10:5–17", "1 Corinthians 15:1–28", "2 Corinthians 5:11–21", "Galatians 2:15–21",
      "Ephesians 2:1–22", "Philippians 2:1–11", "Colossians 1:15–23", "Titus 2:11–14", "Titus 3:3–8", "Hebrews 9:11–28",
      "1 Peter 1:3–25", "1 John 1:5–2:2", "1 John 4:7–21", "Revelation 21:1–7", "Revelation 22:1–21",
    ],
  },
  discipline: {
    label: "Discipline and perseverance",
    description: "Self-control, endurance and faithfulness, in body and soul.",
    passages: [
      "Genesis 39:1–23", "Joshua 1:1–9", "Nehemiah 4:1–23", "Daniel 1:1–21", "Psalm 1", "Psalm 119:9–16", "Proverbs 4",
      "Proverbs 6:6–19", "Ecclesiastes 12:1–14", "Isaiah 40:27–31", "Matthew 4:1–11", "Luke 9:23–27", "Luke 14:25–35",
      "Romans 5:1–5", "Romans 12:1–21", "1 Corinthians 6:12–20", "1 Corinthians 9:19–27", "Galatians 5:13–26",
      "Philippians 3:7–21", "Colossians 3:1–17", "1 Timothy 4:6–16", "2 Timothy 2:1–13", "2 Timothy 4:1–8", "Titus 2:1–15",
      "Hebrews 12:1–17", "James 1:2–27", "1 Peter 1:13–25", "1 Peter 4:1–11", "2 Peter 1:3–11",
    ],
  },
  wisdom: {
    label: "Wisdom",
    description: "The fear of the Lord and wisdom for daily life.",
    passages: [
      "Deuteronomy 6:1–9", "1 Kings 3:1–28", "Job 28", "Psalm 19", "Psalm 90", "Psalm 111", "Psalm 119:97–112", "Proverbs 1",
      "Proverbs 2", "Proverbs 3", "Proverbs 8", "Proverbs 9", "Proverbs 10", "Proverbs 15", "Proverbs 16", "Proverbs 31",
      "Ecclesiastes 3:1–15", "Ecclesiastes 12:9–14", "Matthew 7:24–29", "1 Corinthians 1:18–31", "1 Corinthians 2:1–16",
      "Ephesians 5:15–21", "Colossians 2:1–10", "James 1:5–8", "James 3:13–18",
    ],
  },
  love: {
    label: "Love and relationships",
    description: "Love for God and neighbour, friendship, marriage and forgiveness.",
    passages: [
      "Genesis 50:15–21", "Ruth 1", "Ruth 2", "Ruth 3", "Ruth 4", "1 Samuel 18:1–4", "1 Samuel 20:1–42", "Matthew 5:38–48",
      "Matthew 18:15–35", "Luke 6:27–38", "Luke 10:25–37", "John 13:1–35", "John 15:9–17", "Romans 12:9–21", "Romans 13:8–14",
      "1 Corinthians 13", "Ephesians 4:1–32", "Ephesians 5:21–33", "Colossians 3:12–21", "1 John 3:11–24", "1 John 4:7–21",
    ],
  },
};

/** One verse of a plan, with its word count. */
export interface PlanVerse {
  bookId: string;
  chapter: number;
  verse: number;
  words: number;
  /** Index of the chapter or passage this verse belongs to within its track (a new value starts a new chapter). */
  group: number;
}

/** What a plan needs from the Bible: the verses of a chapter with their word counts, in order. */
export interface VerseSource {
  verses(bookId: string, chapter: number): { verse: number; words: number }[];
}

export interface PlanSpec {
  kind: PlanKind;
  /** The book id for "book", the topic key for "topic". */
  param?: string | null;
}

/** The plan's tracks (one, or three for the guided plan) as verse lists. Null for an unknown plan. */
export function planTracks(spec: PlanSpec, src: VerseSource): PlanVerse[][] | null {
  const fromSegments = (segs: Segment[]): PlanVerse[] => {
    const out: PlanVerse[] = [];
    let g = 0;
    for (const [id, a, b] of segs) for (let c = a; c <= b; c++) {
      for (const v of src.verses(id, c)) out.push({ bookId: id, chapter: c, verse: v.verse, words: v.words, group: g });
      g++;
    }
    return out;
  };
  const fromRefs = (refs: ScriptureRef[]): PlanVerse[] => {
    const out: PlanVerse[] = [];
    refs.forEach((r, g) => {
      const last = r.chapterEnd ?? r.chapter;
      for (let c = r.chapter; c <= last; c++) {
        for (const v of src.verses(r.bookId, c)) {
          if (c === r.chapter && r.verseStart !== undefined && v.verse < r.verseStart) continue;
          if (c === last && r.verseEnd !== undefined && v.verse > r.verseEnd) continue;
          if (c === last && r.chapterEnd === undefined && r.verseStart !== undefined && r.verseEnd === undefined && v.verse > r.verseStart) continue;
          out.push({ bookId: r.bookId, chapter: c, verse: v.verse, words: v.words, group: g });
        }
      }
    });
    return out;
  };
  switch (spec.kind) {
    case "full_bible":
      return [fromSegments(whole(BIBLE_BOOKS.map((b) => b.id)))];
    case "old_testament":
      return [fromSegments(whole(range("GEN", "MAL")))];
    case "new_testament":
      return [fromSegments(whole(range("MAT", "REV")))];
    case "gospels":
      return [fromSegments(whole(["MAT", "MRK", "LUK", "JHN"]))];
    case "chronological":
      return [fromSegments(CHRONOLOGICAL)];
    case "guided":
      return [fromSegments(whole(range("MAT", "REV"))), fromSegments(whole(["PSA"])), fromSegments(whole(["PRO"]))];
    case "book": {
      const b = spec.param ? bookById(spec.param) : undefined;
      return b ? [fromSegments(whole([b.id]))] : null;
    }
    case "topic": {
      const t = spec.param ? TOPICS[spec.param] : undefined;
      if (!t) return null;
      const refs = t.passages.map((p) => parseReference(p));
      if (refs.some((r) => !r)) return null;
      return [fromRefs(refs as ScriptureRef[])];
    }
  }
}

/** Day boundaries: for each day, the index one past its last verse. Null when there are fewer verses than days. */
export function divideTrack(verses: PlanVerse[], days: number): number[] | null {
  const n = verses.length;
  if (n < days || days < 1) return null;
  const cum: number[] = [];
  let total = 0;
  for (const v of verses) cum.push((total += Math.max(1, v.words)));
  // Indices that end a chapter / passage.
  const ends: number[] = [];
  for (let i = 0; i < n; i++) if (i === n - 1 || verses[i + 1]!.group !== verses[i]!.group) ends.push(i);
  const T = total / days;
  const bounds: number[] = [];
  if (ends.length >= days) {
    // Whole chapters: choose, for each day, the chapter end closest to the ideal cut, leaving enough for the rest.
    let prev = -1; // index into `ends`
    for (let k = 1; k < days; k++) {
      const lo = prev + 1;
      const hi = ends.length - 1 - (days - k);
      let best = lo;
      for (let e = lo; e <= hi; e++) {
        if (Math.abs(cum[ends[e]!]! - k * T) < Math.abs(cum[ends[best]!]! - k * T)) best = e;
        if (cum[ends[e]!]! > k * T) break;
      }
      bounds.push(ends[best]! + 1);
      prev = best;
    }
  } else {
    let prev = -1; // verse index
    let e = 0;
    for (let k = 1; k < days; k++) {
      const lo = prev + 1;
      const hi = n - 1 - (days - k);
      const target = k * T;
      // Closest verse boundary.
      let i = lo;
      while (i < hi && cum[i]! < target) i++;
      if (i > lo && Math.abs(cum[i - 1]! - target) <= Math.abs(cum[i]! - target)) i--;
      // A chapter end within 20% of a day's reading wins.
      while (e < ends.length && ends[e]! < lo) e++;
      let bestEnd = -1;
      for (let x = e; x < ends.length && ends[x]! <= hi; x++) {
        if (Math.abs(cum[ends[x]!]! - target) <= 0.2 * T && (bestEnd < 0 || Math.abs(cum[ends[x]!]! - target) < Math.abs(cum[bestEnd]! - target))) bestEnd = ends[x]!;
        if (cum[ends[x]!]! > target + 0.2 * T) break;
      }
      const cut = bestEnd >= 0 ? bestEnd : i;
      bounds.push(cut + 1);
      prev = cut;
    }
  }
  bounds.push(n);
  return bounds;
}

/** A day's reading as references ("Genesis 1–3", "Matthew 5:1–26", "Psalm 119:1–40"). */
export function versesToRefs(verses: PlanVerse[], chapterLength: (bookId: string, chapter: number) => number): ScriptureRef[] {
  const refs: ScriptureRef[] = [];
  let i = 0;
  while (i < verses.length) {
    const first = verses[i]!;
    let j = i;
    while (j + 1 < verses.length && verses[j + 1]!.bookId === first.bookId && verses[j + 1]!.chapter === first.chapter && verses[j + 1]!.group === first.group) j++;
    const last = verses[j]!;
    const whole = first.verse === 1 && last.verse >= chapterLength(first.bookId, first.chapter);
    const prev = refs.at(-1);
    if (whole && prev && prev.bookId === first.bookId && prev.verseStart === undefined && (prev.chapterEnd ?? prev.chapter) === first.chapter - 1) {
      prev.chapterEnd = first.chapter;
    } else if (whole) {
      refs.push({ bookId: first.bookId, chapter: first.chapter });
    } else {
      refs.push({ bookId: first.bookId, chapter: first.chapter, verseStart: first.verse, ...(last.verse !== first.verse ? { verseEnd: last.verse } : {}) });
    }
    i = j + 1;
  }
  return refs;
}

export interface PlanDay {
  day: number;
  refs: ScriptureRef[];
  label: string;
  words: number;
  minutes: number;
  /** Chapters' worth of reading (whole chapters count 1; part of a chapter counts its share of the words). */
  chapters: number;
}

export interface JourneyPlan {
  spec: PlanSpec;
  days: number;
  schedule: PlanDay[];
  totalWords: number;
  totalChapters: number;
  avgMinutes: number;
  maxMinutes: number;
  avgChapters: number;
}

export function isFeasible(tracks: PlanVerse[][], days: number): boolean {
  return tracks.every((t) => t.length >= days * MIN_VERSES_PER_DAY);
}

/** The full day-by-day schedule, or null when the plan is too short for the duration (or unknown). */
export function buildJourneyPlan(spec: PlanSpec, days: number, src: VerseSource, chapterWords: (bookId: string, chapter: number) => number): JourneyPlan | null {
  const tracks = planTracks(spec, src);
  if (!tracks || !isFeasible(tracks, days)) return null;
  const lastVerse = (b: string, c: number) => src.verses(b, c).at(-1)?.verse ?? 0;
  const divided = tracks.map((t) => divideTrack(t, days));
  if (divided.some((d) => !d)) return null;
  const schedule: PlanDay[] = [];
  const starts = tracks.map(() => 0);
  for (let d = 0; d < days; d++) {
    const refs: ScriptureRef[] = [];
    let words = 0;
    let chapters = 0;
    tracks.forEach((t, ti) => {
      const end = divided[ti]![d]!;
      const part = t.slice(starts[ti], end);
      starts[ti] = end;
      refs.push(...versesToRefs(part, lastVerse));
      words += part.reduce((n, v) => n + v.words, 0);
      // Chapter-equivalents: each chapter touched contributes its share of words read.
      const byChapter = new Map<string, number>();
      for (const v of part) byChapter.set(`${v.bookId}:${v.chapter}`, (byChapter.get(`${v.bookId}:${v.chapter}`) ?? 0) + v.words);
      for (const [key, w] of byChapter) {
        const [b, c] = key.split(":");
        chapters += Math.min(1, w / Math.max(1, chapterWords(b!, Number(c))));
      }
    });
    schedule.push({ day: d + 1, refs, label: refs.map(formatReference).join("; "), words, minutes: Math.max(1, Math.ceil(words / READING_WPM)), chapters: Math.round(chapters * 10) / 10 });
  }
  const totalWords = schedule.reduce((n, s) => n + s.words, 0);
  return {
    spec,
    days,
    schedule,
    totalWords,
    totalChapters: Math.round(schedule.reduce((n, s) => n + s.chapters, 0)),
    avgMinutes: Math.round(totalWords / days / READING_WPM),
    maxMinutes: Math.max(...schedule.map((s) => s.minutes)),
    avgChapters: Math.round((schedule.reduce((n, s) => n + s.chapters, 0) / days) * 10) / 10,
  };
}

export function planTitle(spec: PlanSpec): string {
  if (spec.kind === "book") return bookById(spec.param ?? "")?.name ?? "One book";
  if (spec.kind === "topic") return TOPICS[spec.param ?? ""]?.label ?? "By topic";
  return PLAN_INFO[spec.kind].label;
}
