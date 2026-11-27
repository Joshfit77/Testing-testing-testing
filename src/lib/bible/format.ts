import { bookById } from "./books";

/** [start, start+1, …, end]. */
export function verseRange(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
}

/** Contiguous runs of verse numbers: [1,2,3,5] → [[1,3],[5,5]]. */
export function verseRuns(verses: number[]): [number, number][] {
  const sorted = [...new Set(verses)].sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const v of sorted) {
    const last = runs.at(-1);
    if (last && v === last[1] + 1) last[1] = v;
    else runs.push([v, v]);
  }
  return runs;
}

/** "John 3:16–18, 20" for a selection of verses in one chapter. */
export function selectionReference(bookId: string, chapter: number, verses: number[]): string {
  const book = bookById(bookId);
  const name = book ? (book.id === "PSA" ? "Psalm" : book.name) : bookId;
  const runs = verseRuns(verses).map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`));
  if (!runs.length) return `${name} ${chapter}`;
  // Single-chapter books are cited by verse alone (Jude 3).
  return book && book.chapters === 1 ? `${name} ${runs.join(", ")}` : `${name} ${chapter}:${runs.join(", ")}`;
}

/** The text a member copies or shares: the verses' words exactly, then the reference and translation. */
export function shareableText(bookId: string, chapter: number, selected: [number, string][]): string {
  const sorted = [...selected].sort((a, b) => a[0] - b[0]);
  const text = sorted.map(([, t]) => t).join(" ");
  return `${text}\n— ${selectionReference(bookId, chapter, sorted.map(([v]) => v))} (BSB)`;
}
