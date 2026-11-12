/**
 * Words of Jesus in red ("red letter"). The Berean Standard Bible publisher's USFM edition marks which words are His;
 * scripts/build-bsb-red-letter.mjs turns those marks into [start, end) character offsets into the app's own verse text
 * (public/bible/bsb/wj.json), so the text itself is never changed. This file only splits a verse at those offsets.
 */

/** [start, end) character offsets of His words inside one verse's text. */
export type RedLetterSpan = readonly [number, number];

export interface TextPart {
  text: string;
  /** True for the words of Jesus. */
  jesus: boolean;
}

/**
 * Splits text into plain and red parts. Spans that are out of order, overlap or fall outside the text are ignored
 * rather than guessed at, so bad data can only ever leave words uncoloured, never colour the wrong ones or lose text.
 */
export function redLetterParts(text: string, spans?: readonly RedLetterSpan[] | null): TextPart[] {
  if (!spans?.length) return text ? [{ text, jesus: false }] : [];
  const parts: TextPart[] = [];
  let at = 0;
  for (const [start, end] of spans) {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < at || end <= start || end > text.length) continue;
    if (start > at) parts.push({ text: text.slice(at, start), jesus: false });
    parts.push({ text: text.slice(start, end), jesus: true });
    at = end;
  }
  if (at < text.length) parts.push({ text: text.slice(at), jesus: false });
  return parts;
}

/**
 * Parts for several verses shown as one passage, joined with a space (the way passageText joins them), so a red
 * stretch never runs across the gap between two verses unless both sides are His words.
 */
export function joinVerseParts(verses: readonly { text: string; jesus?: readonly RedLetterSpan[] | null }[]): TextPart[] {
  const out: TextPart[] = [];
  verses.forEach((v, i) => {
    if (i > 0) out.push({ text: " ", jesus: false });
    out.push(...redLetterParts(v.text, v.jesus));
  });
  // Merge neighbours of the same kind (and a single space between two red parts) so the markup stays small.
  const merged: TextPart[] = [];
  for (const p of out) {
    const last = merged.at(-1);
    if (last && last.jesus === p.jesus) last.text += p.text;
    else merged.push({ ...p });
  }
  for (let i = 1; i < merged.length - 1; i++) {
    if (!merged[i]!.jesus && merged[i]!.text === " " && merged[i - 1]!.jesus && merged[i + 1]!.jesus) {
      merged[i - 1]!.text += " " + merged[i + 1]!.text;
      merged.splice(i, 2);
      i--;
    }
  }
  return merged;
}

/**
 * For each whitespace-separated word of the parts' text (the same split as maskWords in lib/faith/memory), whether it
 * begins inside the words of Jesus.
 */
export function redLetterWordFlags(parts: readonly TextPart[]): boolean[] {
  const flags: boolean[] = [];
  let inWord = false;
  for (const p of parts) {
    for (const ch of p.text) {
      const space = /\s/.test(ch);
      if (!space && !inWord) flags.push(p.jesus);
      inWord = !space;
    }
  }
  return flags;
}

/** The parts covering [start, end) of their joined text. */
export function sliceParts(parts: readonly TextPart[], start: number, end: number): TextPart[] {
  const out: TextPart[] = [];
  let at = 0;
  for (const p of parts) {
    const a = Math.max(start, at);
    const b = Math.min(end, at + p.text.length);
    if (b > a) out.push({ text: p.text.slice(a - at, b - at), jesus: p.jesus });
    at += p.text.length;
  }
  return out;
}

/** True if any part is the words of Jesus. */
export const hasRedLetter = (parts: readonly TextPart[]) => parts.some((p) => p.jesus);
