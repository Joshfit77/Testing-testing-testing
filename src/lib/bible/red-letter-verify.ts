import type { RedLetterSpan } from "./red-letter";

/**
 * Independent check of the red-letter data against the BSB's own punctuation. The publisher's marking says which words
 * are His; this confirms each marked stretch sits where the BSB text itself has a quotation open, so a stretch that
 * began in narration, or stopped part-way through a quotation, is caught and sent for review instead of trusted.
 *
 * Quotation marks are followed through each book in order (a speech can run across verses and chapters) with their
 * nesting: “…” for speech, ‘…’ for a quotation inside it, and “…” again a level further in (a parable character quoting
 * someone). A ’ followed by a letter is an apostrophe ("David’s"), not a closing mark. A second “ while a speech is
 * already open is the BSB's mark for a speech continuing into a new paragraph.
 */
export interface SegmentCheck {
  chapter: number;
  verse: number;
  index: number;
  start: number;
  end: number;
  text: string;
  status: "verified" | "review";
  notes: string[];
}

export interface BookCheck {
  segments: SegmentCheck[];
  /** Verses where a red speech is still open at the end of the verse but the next verse begins without red. */
  continuationGaps: { chapter: number; verse: number }[];
}

type Level = "d" | "s" | "d3";

export function checkBookRedLetter(chapters: readonly (readonly (readonly [number, string])[])[], marks: Record<string, Record<string, readonly RedLetterSpan[]>> | undefined): BookCheck {
  const segments: SegmentCheck[] = [];
  const continuationGaps: { chapter: number; verse: number }[] = [];
  const stack: Level[] = [];
  let pendingOpen: { chapter: number; verse: number } | null = null;

  chapters.forEach((verses, ci) => {
    const chapter = ci + 1;
    for (const [verse, text] of verses) {
      // Quotation state before each character, and after the last.
      const inside: boolean[] = new Array(text.length + 1);
      const depth: number[] = new Array(text.length + 1);
      for (let i = 0; i < text.length; i++) {
        inside[i] = stack.length > 0;
        depth[i] = stack.length;
        const ch = text[i];
        const top = stack.at(-1);
        if (ch === "“") {
          if (top === "s") stack.push("d3");
          else if (!top) stack.push("d");
          // "d" or "d3" already open: a continuation into a new paragraph; the level stays as it is.
        } else if (ch === "”") {
          while (stack.length) {
            const popped = stack.pop();
            if (popped === "d" || popped === "d3") break;
          }
        } else if (ch === "‘") {
          if (stack.length) stack.push("s");
        } else if (ch === "’") {
          if (top === "s" && !/[A-Za-z]/.test(text[i + 1] ?? "")) stack.pop();
        }
      }
      inside[text.length] = stack.length > 0;
      depth[text.length] = stack.length;

      const spans = marks?.[chapter]?.[verse] ?? [];
      if (pendingOpen && spans.length === 0) continuationGaps.push(pendingOpen);
      pendingOpen = null;

      spans.forEach(([start, end], index) => {
        const seg = text.slice(start, end);
        const notes: string[] = [];
        if (!(start >= 0 && end > start && end <= text.length)) notes.push("outside the verse");
        if (/^\s|\s$/.test(seg)) notes.push("starts or ends with a space");
        const opensHere = seg[0] === "“" || seg[0] === "‘";
        if (!opensHere && !inside[start]) notes.push("begins outside any quotation in the BSB text");
        for (let i = start + 1; i < end; i++) {
          if (!inside[i] && !(text[i] === "“" || text[i] === "‘")) {
            notes.push("runs past the end of a quotation in the BSB text");
            break;
          }
        }
        const closesHere = /[”’]$/.test(seg);
        if (!closesHere && end < text.length && inside[end] && /\S/.test(text.slice(end))) notes.push("stops while the BSB quotation continues in the verse");
        segments.push({ chapter, verse, index, start, end, text: seg, status: notes.length ? "review" : "verified", notes });
      });

      // His speech still open at the end of the verse, at the outermost level (not His words quoted inside someone
      // else's speech, which carries on as theirs): the next verse should continue in red.
      const last = spans.at(-1);
      if (last && last[1] >= text.trimEnd().length && inside[text.length]) {
        const startDepth = depth[last[0]]! + (text[last[0]] === "“" || text[last[0]] === "‘" ? 1 : 0);
        if (startDepth <= 1) pendingOpen = { chapter, verse };
      }
    }
  });
  return { segments, continuationGaps };
}
