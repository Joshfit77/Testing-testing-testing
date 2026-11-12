/**
 * Launch priority of each catalog exercise, from how the programs use it (shared by readiness-report.ts and the owner
 * review sheet). Tier 1 = in a starter program (beginner, home, active-aging, women's strength) or in 5+ programs;
 * tier 2 = in any other program; tier 3 = in the library only.
 */
import { EXERCISES } from "@/data/exercises";
import { PROGRAMS } from "@/data/programs";
import { ownerApproved, readinessEntries, type DemoReadiness } from "@/lib/exercise-demo-readiness";

export const GROUPS: Record<string, string[]> = {
  starter: ["beginner", "home-workouts", "active-aging", "womens-strength"],
  strength: ["strength", "powerlifting", "powerbuilding", "bench-press", "squat-specialization", "deadlift-specialization", "strongman"],
  bodybuilding: ["hypertrophy", "show-prep"],
  "fat loss / general": ["weight-loss-cardio", "cardiovascular", "functional-conditioning", "hybrid-training", "mobility-flexibility", "recovery-deload", "calisthenics"],
  "MMA / conditioning": ["mma-conditioning", "boxing-conditioning", "grappling-conditioning", "athletic-performance", "speed", "agility"],
};
const groupOf = (category: string) => Object.entries(GROUPS).find(([, cats]) => cats.includes(category))?.[0] ?? "other";

export interface ExerciseRow {
  slug: string;
  name: string;
  tier: 1 | 2 | 3;
  programs: number;
  groups: string;
  readiness: DemoReadiness;
  note: string;
  owner: boolean;
  primary: string[];
  secondary: string[];
  instructions: string[];
  cues: string[];
  mistakes: string[];
}

interface DayLike {
  exercises?: { ex: string }[];
}

/** Every catalog exercise with its launch tier and 2D demo state, in launch-priority order. */
export function exerciseRows(): ExerciseRow[] {
  const usage = new Map<string, { programs: Set<string>; groups: Set<string> }>();
  for (const p of PROGRAMS as unknown as Record<string, unknown>[]) {
    const days: DayLike[] = [];
    for (const v of Object.values(p)) {
      if (!Array.isArray(v)) continue;
      for (const item of v as Record<string, unknown>[]) {
        if (item && Array.isArray(item.exercises)) days.push(item as DayLike);
        if (item && Array.isArray(item.days)) days.push(...(item.days as DayLike[]));
      }
    }
    for (const d of days)
      for (const e of d.exercises ?? []) {
        const u = usage.get(e.ex) ?? { programs: new Set(), groups: new Set() };
        u.programs.add(p.slug as string);
        u.groups.add(groupOf(p.category as string));
        usage.set(e.ex, u);
      }
  }
  const entries = new Map(readinessEntries());
  return EXERCISES.map((e) => {
    const u = usage.get(e.slug);
    const n = u?.programs.size ?? 0;
    const tier: 1 | 2 | 3 = u && (u.groups.has("starter") || n >= 5) ? 1 : u ? 2 : 3;
    const r = entries.get(e.slug);
    return {
      slug: e.slug,
      name: e.name,
      tier,
      programs: n,
      groups: u ? [...u.groups].sort().join(", ") : "library only",
      readiness: r?.readiness ?? "placeholder",
      note: r?.note ?? "",
      owner: ownerApproved(e.slug),
      primary: [...e.primary],
      secondary: [...e.secondary],
      instructions: [...e.instructions],
      cues: [...e.cues],
      mistakes: [...e.mistakes],
    };
  }).sort((a, b) => a.tier - b.tier || b.programs - a.programs || a.name.localeCompare(b.name));
}
