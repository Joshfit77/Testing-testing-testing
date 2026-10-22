/**
 * Long-term coaching memory: short notes the coach keeps about a member across conversations (pure helpers,
 * unit-tested). Storage and access rules are in supabase/migrations/20261024000026_coach_memory.sql.
 *
 * Memories hold only what the structured data doesn't. The goal, experience level, equipment list, schedule,
 * program, logs and targets live in their own tables and reach the coach fresh every turn, so they are never
 * copied into memories. Nothing is saved without the member: the coach can only suggest a memory, and the
 * member saves, edits or declines it.
 */
import { z } from "zod";

export const MEMORY_CATEGORIES = [
  "goals",
  "experience",
  "exercise_preferences",
  "equipment",
  "schedule",
  "nutrition",
  "training_changes",
  "recovery",
  "milestones",
  "coaching_style",
  "other",
] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string> = {
  goals: "Goals",
  experience: "Training background",
  exercise_preferences: "Exercise preferences",
  equipment: "Equipment & places",
  schedule: "Schedule",
  nutrition: "Food preferences",
  training_changes: "Approved changes",
  recovery: "Recovery preferences",
  milestones: "Milestones",
  coaching_style: "Coaching style",
  other: "Other",
};

/** Most memories a member can keep (the database enforces the same number). */
export const MEMORY_LIMIT = 100;
/** Longest memory, in characters (also a database check). */
export const MEMORY_MAX_CHARS = 300;
/** Memories and characters sent to the AI per request, newest first, so memory can't grow the prompt unboundedly. */
export const MEMORY_CONTEXT_LIMIT = 50;
export const MEMORY_CONTEXT_CHARS = 6_000;

export const memoryInputSchema = z.object({
  category: z.enum(MEMORY_CATEGORIES),
  content: z
    .string()
    .trim()
    .min(3, "Write at least a few words.")
    .max(MEMORY_MAX_CHARS, `Keep it under ${MEMORY_MAX_CHARS} characters.`)
    .transform((s) => s.replace(/\s+/g, " ")),
});
export type MemoryInput = z.infer<typeof memoryInputSchema>;

export interface CoachMemory {
  id: string;
  category: MemoryCategory;
  content: string;
  source: "coach" | "member" | "approved_change";
  created_at: string;
  updated_at?: string;
}

/** Short, stable reference the coach uses to point at a memory ("forget m-1a2b3c4d"). */
export const memoryRef = (id: string) => `m-${id.replace(/-/g, "").slice(0, 8)}`;

function words(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/** Jaccard similarity of the two texts' words (0–1). */
export function memorySimilarity(a: string, b: string): number {
  const wa = new Set(words(a));
  const wb = new Set(words(b));
  if (!wa.size || !wb.size) return a.trim().toLowerCase() === b.trim().toLowerCase() ? 1 : 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / (wa.size + wb.size - inter);
}

/** An existing memory that already says (nearly) the same thing, if any. */
export function findDuplicateMemory<T extends { content: string }>(content: string, existing: T[], threshold = 0.8): T | null {
  return existing.find((m) => memorySimilarity(content, m.content) >= threshold) ?? null;
}

/**
 * Does the text repeat part of a prayer-journal entry? Journal entries the member shared with the coach are for
 * that conversation only; the coach may not turn them into lasting memories.
 */
export function overlapsJournal(content: string, journalExcerpts: string[]): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const c = norm(content);
  for (const raw of journalExcerpts) {
    const j = norm(raw);
    if (j.length < 12) continue;
    // Any run of 6+ words from the entry, or more than half of the memory's words in common.
    const jw = j.split(" ");
    for (let i = 0; i + 6 <= jw.length; i++) if (c.includes(jw.slice(i, i + 6).join(" "))) return true;
    if (memorySimilarity(c, j) > 0.5) return true;
  }
  return false;
}

/**
 * Health and medical details the coach must not keep as memories (they belong in Profile → limitations, which
 * is only shared with the coach under the separate wellness consent). Members can still write anything they like
 * on the memory screen themselves.
 */
const SENSITIVE = /\b(diagnos\w*|medication\w*|medicine|prescri\w*|surgery|surgeries|operation|disorder|disease|diabet\w*|asthma|cancer|depress\w*|anxiety|bipolar|adhd|pregnan\w*|miscarr\w*|eating disorder|anorexi\w*|bulimi\w*|binge\w*|purg\w*|self[- ]harm|suicid\w*|therap(y|ist)|hiv|blood pressure|cholesterol|thyroid|steroid\w*)\b/i;

export function isSensitiveHealthDetail(content: string): boolean {
  return SENSITIVE.test(content);
}

/** Why the coach's suggested memory can't be offered, or null when it can. */
export function checkProposedMemory(
  input: MemoryInput,
  ctx: { enabled: boolean; chatMemoryOff: boolean; existing: { content: string }[]; journalExcerpts: string[] },
): string | null {
  if (!ctx.enabled) return "Memory is switched off for this athlete. Don't offer to remember things; they can turn it on in AI Coach → Memory.";
  if (ctx.chatMemoryOff) return "The athlete asked not to remember anything from this chat. Don't save it.";
  if (ctx.existing.length >= MEMORY_LIMIT) return `The athlete already has ${MEMORY_LIMIT} memories, the maximum. Suggest they review them in AI Coach → Memory.`;
  if (isSensitiveHealthDetail(input.content)) return "Don't keep health or medical details as memories. If relevant, suggest the athlete records limitations in their profile instead.";
  if (overlapsJournal(input.content, ctx.journalExcerpts)) return "Prayer-journal entries are never turned into memories.";
  const dup = findDuplicateMemory(input.content, ctx.existing);
  if (dup) return `Already remembered: "${dup.content}". No need to save it again.`;
  return null;
}

/**
 * The memory block for the AI context, newest first, capped by count and characters. Recovery notes are only
 * included while the member allows wellness data to be shared with the coach.
 */
export function formatMemoriesForContext(memories: CoachMemory[], opts: { wellnessConsent: boolean; chatMemoryOff: boolean }): string {
  const usable = [...memories]
    .filter((m) => m.category !== "recovery" || opts.wellnessConsent)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, MEMORY_CONTEXT_LIMIT);
  const lines: string[] = [];
  let chars = 0;
  for (const m of usable) {
    const line = `- [${memoryRef(m.id)}] ${MEMORY_CATEGORY_LABELS[m.category]}: ${m.content} (${m.created_at.slice(0, 10)}${m.source === "approved_change" ? ", approved change" : ""})`;
    if (chars + line.length > MEMORY_CONTEXT_CHARS) break;
    lines.push(line);
    chars += line.length;
  }
  const head = opts.chatMemoryOff
    ? "Coaching memory: the athlete asked you not to remember anything from THIS chat (use the notes below, but don't suggest new memories)."
    : "Coaching memory: notes the athlete chose to keep. Use them when relevant; never invent memories. The structured data above is the source of truth if they disagree.";
  return lines.length ? `${head}\n${lines.join("\n")}` : `${head}\n(No memories saved yet.)`;
}

/** The note recorded when a member confirms a coach-suggested change (only while memory is on). */
export function approvedChangeMemory(change: { kind: "exercise_swap"; from: string; to: string; scope: "next_workout" | "rest_of_program"; reason: string } | { kind: "nutrition_targets"; calories: number; protein_g: number; reason: string }, date: string): MemoryInput {
  const text =
    change.kind === "exercise_swap"
      ? `${date}: approved swapping ${change.from} for ${change.to} (${change.scope === "next_workout" ? "next session" : "rest of the program"}). Reason: ${change.reason}`
      : `${date}: approved new nutrition targets of ${change.calories} kcal and ${change.protein_g} g protein. Reason: ${change.reason}`;
  return { category: "training_changes", content: text.slice(0, MEMORY_MAX_CHARS) };
}
