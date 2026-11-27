/**
 * Exercise library search: matches the exercise name, its alternate names (EXERCISE_DETAILS aliases), primary muscles
 * and common gym abbreviations, so "rdl", "skull crusher" or "db press" find the right entries. Pure and synchronous:
 * the library is ~220 rows, filtered in memory on the server.
 */

/** Common gym shorthand, expanded before matching. */
const ABBREVIATIONS: Record<string, string> = {
  db: "dumbbell",
  dbs: "dumbbell",
  bb: "barbell",
  kb: "kettlebell",
  ohp: "overhead press",
  rdl: "romanian deadlift",
  sldl: "stiff leg deadlift",
  bss: "bulgarian split squat",
  ghr: "glute ham raise",
  tri: "triceps",
  tris: "triceps",
  bi: "biceps",
  bis: "biceps",
  lat: "lats",
  abs: "core",
  delt: "deltoids",
  delts: "deltoids",
  hams: "hamstrings",
  quads: "quadriceps",
  pullup: "pull up",
  pushup: "push up",
  chinup: "chin up",
};

export interface SearchableExercise {
  slug: string;
  name: string;
  primary: string[];
  aliases: string[];
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function queryTokens(q: string): string[] {
  return normalize(q)
    .split(" ")
    .filter(Boolean)
    .flatMap((t) => (ABBREVIATIONS[t] ?? t).split(" "));
}

function words(e: SearchableExercise): string[] {
  return normalize([e.name, e.slug.replace(/-/g, " "), ...e.aliases, ...e.primary].join(" ")).split(" ");
}

/** Every query word must start some word of the exercise's name, aliases, slug or primary muscles. */
export function matchesQuery(e: SearchableExercise, q: string): boolean {
  const tokens = queryTokens(q);
  if (!tokens.length) return true;
  const ws = words(e);
  return tokens.every((t) => ws.some((w) => w.startsWith(t) || (t.length >= 5 && w.startsWith(t.replace(/s$/, "")))));
}

/** Rank: name match first, then alias match, then muscle-only matches. */
export function searchRank(e: SearchableExercise, q: string): number {
  const nq = normalize(q);
  const name = normalize(e.name);
  if (name === nq) return 0;
  if (name.startsWith(nq)) return 1;
  if (e.aliases.some((a) => normalize(a) === nq)) return 1;
  if (name.includes(nq)) return 2;
  if (e.aliases.some((a) => normalize(a).includes(nq))) return 3;
  return 4;
}

export function searchExercises<T extends SearchableExercise>(list: T[], q: string): T[] {
  const nq = normalize(q);
  if (!nq) return list;
  return list
    .filter((e) => matchesQuery(e, q))
    .map((e, i) => ({ e, i, r: searchRank(e, q) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.e);
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 9;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/**
 * "Did you mean" suggestions when a search finds nothing: exercises whose name or alias words are within a small
 * typo distance of the query words (e.g. "bulgarain" → Bulgarian Split Squat).
 */
export function suggestExercises<T extends SearchableExercise>(list: T[], q: string, limit = 5): T[] {
  const tokens = queryTokens(q).filter((t) => t.length >= 3);
  if (!tokens.length) return [];
  const scored = list
    .map((e) => {
      const ws = words(e);
      let score = 0;
      for (const t of tokens) {
        const best = Math.min(...ws.map((w) => editDistance(t, w.slice(0, Math.max(t.length, Math.min(w.length, t.length + 1))))));
        if (best <= (t.length >= 6 ? 2 : 1)) score += 2 - Math.min(best, 2) + 1;
      }
      return { e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name));
  return scored.slice(0, limit).map((x) => x.e);
}
