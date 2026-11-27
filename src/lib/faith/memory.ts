import { addDays } from "@/lib/domain/dates";

/**
 * Scripture memory practice. A verse moves through five levels (0 = read it, 4 = say it with every word hidden); each
 * successful review raises the level and spaces the next review further out, a struggle lowers it and brings the
 * review back tomorrow. Practice never changes the verse: hidden words are shown again exactly as written.
 */

export const MEMORY_LEVELS = 5;
/** Days until the next review after a success at each new level (1…4). */
const SPACING = [1, 2, 4, 7, 14];

export type ReviewResult = "remembered" | "struggled";

export interface ReviewOutcome {
  level: number;
  status: "learning" | "memorized";
  nextReviewOn: string;
}

export function reviewOutcome(level: number, result: ReviewResult, today: string, status: "learning" | "memorized" = "learning"): ReviewOutcome {
  if (result === "struggled") {
    const next = Math.max(0, level - 1);
    return { level: next, status: "learning", nextReviewOn: addDays(today, 1) };
  }
  if (level >= MEMORY_LEVELS - 1) {
    // Remembered with every word hidden: memorized. Keep reviewing now and then so it stays.
    return { level: MEMORY_LEVELS - 1, status: "memorized", nextReviewOn: addDays(today, status === "memorized" ? 30 : SPACING[4]!) };
  }
  const next = level + 1;
  return { level: next, status: "learning", nextReviewOn: addDays(today, SPACING[next]!) };
}

export interface MaskedWord {
  word: string;
  hidden: boolean;
  /** What a hidden word shows: its first letter, then a line. */
  hint: string;
}

/** Share of words hidden at each level. */
const HIDE_SHARE = [0, 0.25, 0.5, 0.75, 1];

/**
 * Split the text into words and hide a share of them for the level. Which words are hidden is fixed for a given
 * text, level and seed (a different seed each practice gives a different set), and punctuation stays visible.
 */
export function maskWords(text: string, level: number, seed = 0): MaskedWord[] {
  const words = text.split(/\s+/).filter(Boolean);
  const share = HIDE_SHARE[Math.max(0, Math.min(MEMORY_LEVELS - 1, level))]!;
  const target = Math.round(words.length * share);
  // A deterministic order of the words to hide (a small LCG over the indices).
  const order = words.map((_, i) => i);
  let x = (seed * 2654435761 + text.length * 40503) >>> 0;
  for (let i = order.length - 1; i > 0; i--) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    const j = x % (i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const hide = new Set(order.slice(0, target));
  return words.map((word, i) => {
    const letters = word.match(/[A-Za-z0-9’']+/)?.[0] ?? "";
    const lead = word.slice(0, word.indexOf(letters.charAt(0)) < 0 ? 0 : word.indexOf(letters.charAt(0)));
    const tail = letters ? word.slice(word.indexOf(letters) + letters.length) : "";
    const hidden = hide.has(i) && letters.length > 0;
    return { word, hidden, hint: hidden ? `${lead}${letters.charAt(0)}${"_".repeat(Math.max(1, letters.length - 1))}${tail}` : word };
  });
}

export const LEVEL_LABELS = ["Read it", "A quarter hidden", "Half hidden", "Three quarters hidden", "All hidden"] as const;

export interface MemoryRow {
  id: string;
  book_id: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  status: "learning" | "memorized";
  level: number;
  review_count: number;
  next_review_on: string | null;
}

/** The passage a memory row covers, as a reference. */
export const memoryRef = (r: Pick<MemoryRow, "book_id" | "chapter" | "verse_start" | "verse_end">) => ({
  bookId: r.book_id,
  chapter: r.chapter,
  verseStart: r.verse_start,
  verseEnd: r.verse_end === r.verse_start ? undefined : r.verse_end,
});
