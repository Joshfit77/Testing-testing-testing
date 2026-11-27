/**
 * Ranking for food search over USDA-style names such as
 * "Chicken, broilers or fryers, breast, meat only, cooked, roasted". Pure, so it can be unit-tested and
 * used for any list of names (the server-side USDA SR Legacy index, built-in foods, My foods).
 *
 * Rules:
 * - every query word must match the start of some word in the name (so "chick bre" finds chicken breast,
 *   and "eggs" also matches "egg");
 * - matches in the first comma segment (the food itself) count most;
 * - shorter names, plain forms ("raw", "cooked", "roasted"…) and names whose main words were all asked
 *   for rank higher, as does "meat only"; deli, restaurant and fast-food entries (via `boost`) and
 *   unasked-for extras in the food's own name rank lower.
 */

export interface SearchEntry {
  /** Lower-case words of the whole name, in order. */
  words: string[];
  /** How many of `words` belong to the first comma segment. */
  firstSegment: number;
  /** Comma-segment index of each word (0 = the food itself, 1–2 = its main qualifiers…). */
  segments: number[];
  /** Optional score adjustment (e.g. a penalty for restaurant foods). */
  boost: number;
}

const COOKED_FORMS = new Set(["cooked", "roasted", "boiled", "baked", "grilled", "broiled", "steamed", "plain"]);
/** Group words USDA puts first ("Fish, salmon, …", "Cereals, oats, …"); not asking for them costs nothing. */
const GENERIC_HEADS = new Set(["fish", "beverages", "beverage", "cereals", "cereal", "spices", "game", "alcoholic"]);
const PROCESSED = new Set(["breaded", "battered", "nuggets", "tenders", "patties", "patty", "imitation", "babyfood", "substitute", "dehydrated", "powder", "mix"]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/'s\b/g, "s")
    .split(/[^a-z0-9%]+/)
    .filter(Boolean);
}

export function prepareEntry(name: string, boost = 0): SearchEntry {
  const words: string[] = [];
  const segments: number[] = [];
  name.split(",").forEach((seg, i) => {
    for (const w of tokenize(seg)) {
      words.push(w);
      segments.push(i);
    }
  });
  const firstSegment = segments.filter((x) => x === 0).length;
  return { words, firstSegment, segments, boost };
}

/** Spellings to try for one query word: as typed, and singular forms of simple plurals. */
function variants(q: string): string[] {
  const out = [q];
  if (q.length > 3 && q.endsWith("ies")) out.push(`${q.slice(0, -3)}y`);
  if (q.length > 3 && q.endsWith("es")) out.push(q.slice(0, -2));
  if (q.length > 2 && q.endsWith("s")) out.push(q.slice(0, -1));
  return out;
}

/** Score of one entry for already-tokenized query words, or null when some word doesn't match. */
export function scoreEntry(entry: SearchEntry, queryWords: string[]): number | null {
  if (!queryWords.length) return null;
  const { words, firstSegment } = entry;
  const matched = new Set<number>();
  let score = entry.boost;
  for (const q of queryWords) {
    const forms = variants(q);
    let best = -1;
    let exact = false;
    // Prefer an exact word, then the earliest prefix match; skip words another query word already used.
    for (let i = 0; i < words.length; i++) {
      if (matched.has(i)) continue;
      const w = words[i]!;
      const ws = w.length > 4 && w.endsWith("ies") ? `${w.slice(0, -3)}y` : w;
      if (forms.some((f) => w === f || ws === f || w === `${f}s` || w === `${f}es`)) {
        best = i;
        exact = true;
        break;
      }
      if (best === -1 && forms.some((f) => w.startsWith(f))) best = i;
    }
    if (best === -1) return null;
    matched.add(best);
    const seg = entry.segments[best] ?? 99;
    score += seg === 0 ? 20 : seg <= 2 ? 14 : 8;
    if (exact) score += 4;
    score -= Math.min(best, 12) * 0.4;
  }
  // The food's own name (first segment) fully covered by the query: "Bananas, raw" for "banana".
  let unmatchedFirst = 0;
  for (let i = 0; i < firstSegment; i++) if (!matched.has(i) && !GENERIC_HEADS.has(words[i]!)) unmatchedFirst++;
  if (unmatchedFirst === 0) score += 8;
  score -= unmatchedFirst * 5;
  // Plain forms and shorter names first; processed variants later unless asked for.
  let form = 0;
  for (let i = 0; i < words.length; i++) {
    if (matched.has(i)) continue;
    const w = words[i]!;
    if (w === "raw") form = 3;
    else if (COOKED_FORMS.has(w)) form = Math.max(form, 2);
    if (w === "whole") score += 1;
    if (PROCESSED.has(w)) score -= 4;
  }
  score += form;
  // "meat only" is the plain cut (vs. "meat and skin").
  for (let i = 0; i + 1 < words.length; i++) if (words[i] === "meat" && words[i + 1] === "only") score += 3;
  score -= words.length * 0.6;
  return score;
}

/**
 * Ranks items by `entryOf(item)` for the query and returns the best `limit` (ties broken by shorter name).
 * Returns [] for an empty query.
 */
export function rankFoods<T>(items: readonly T[], query: string, entryOf: (item: T) => SearchEntry, limit = 30): T[] {
  const q = tokenize(query).slice(0, 8);
  if (!q.length) return [];
  const scored: { item: T; score: number; len: number }[] = [];
  for (const item of items) {
    const e = entryOf(item);
    const s = scoreEntry(e, q);
    if (s != null) scored.push({ item, score: s, len: e.words.length });
  }
  scored.sort((a, b) => b.score - a.score || a.len - b.len);
  return scored.slice(0, limit).map((s) => s.item);
}
