/** Shortest cut we accept when a single sentence is too long: anything shorter reads as a fragment ("Therefore…"). */
const MIN_EXCERPT = 40;

/**
 * The verse as shown on Home and Faith: the whole verse when it fits in `max` characters; otherwise as many
 * whole sentences as fit; and only if the first sentence alone is too long, a cut at the last clause mark (or
 * word gap) before `max`, marked with an ellipsis. Never cuts mid-word and never returns a one- or two-word
 * fragment. The result is always the start of the verse (plus "…"), so red-letter colouring still lines up.
 */
export function verseExcerpt(text: string, max = 220): string {
  const full = text.trim();
  if (full.length <= max) return full;

  // Sentence ends: . ? ! (optionally followed by a closing quote) and then a space.
  let best = 0;
  for (const m of full.matchAll(/[.?!][”’"')]*(?=\s)/g)) {
    const end = m.index + m[0].length;
    if (end > max) break;
    best = end;
  }
  if (best >= MIN_EXCERPT) return full.slice(0, best);

  // One long sentence: cut at the last clause mark, else the last word gap, before the limit.
  const head = full.slice(0, max);
  let cut = -1;
  for (const m of head.matchAll(/[,;:—–](?=\s)/g)) if (m.index >= MIN_EXCERPT) cut = m.index;
  if (cut < 0) cut = head.lastIndexOf(" ");
  if (cut < MIN_EXCERPT) cut = head.lastIndexOf(" ") > 0 ? head.lastIndexOf(" ") : max;
  return `${full.slice(0, cut).replace(/[\s,;:—–]+$/, "")}…`;
}
