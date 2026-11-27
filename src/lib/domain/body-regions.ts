/**
 * The twelve body regions used by the training review and the muscle map, mapped from the muscle names in the
 * exercise catalog (`primary_muscles` / `secondary_muscles`). Muscles outside the twelve (adductors, hip flexors,
 * neck, the cardiovascular system…) aren't counted towards any region.
 */
export const BODY_REGIONS = [
  "chest",
  "upper_back",
  "lower_back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "abdominals",
  "glutes",
  "quadriceps",
  "hamstrings",
  "calves",
] as const;
export type BodyRegion = (typeof BODY_REGIONS)[number];

export const BODY_REGION_LABELS: Record<BodyRegion, string> = {
  chest: "Chest",
  upper_back: "Upper back",
  lower_back: "Lower back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  abdominals: "Abdominals",
  glutes: "Glutes",
  quadriceps: "Quadriceps",
  hamstrings: "Hamstrings",
  calves: "Calves",
};

const MUSCLE_TO_REGION: Record<string, BodyRegion> = {
  chest: "chest",
  "upper chest": "chest",
  serratus: "chest",
  "upper back": "upper_back",
  lats: "upper_back",
  traps: "upper_back",
  "upper traps": "upper_back",
  "middle traps": "upper_back",
  rhomboids: "upper_back",
  "teres major": "upper_back",
  "spinal erectors": "lower_back",
  "lower back": "lower_back",
  spine: "lower_back",
  shoulders: "shoulders",
  "front delts": "shoulders",
  "front deltoids": "shoulders",
  "side delts": "shoulders",
  "side deltoids": "shoulders",
  "rear delts": "shoulders",
  "rear deltoids": "shoulders",
  "rotator cuff": "shoulders",
  biceps: "biceps",
  brachialis: "biceps",
  triceps: "triceps",
  "triceps (long head)": "triceps",
  forearms: "forearms",
  grip: "forearms",
  core: "abdominals",
  abs: "abdominals",
  abdominals: "abdominals",
  obliques: "abdominals",
  glutes: "glutes",
  "hip rotators": "glutes",
  quadriceps: "quadriceps",
  legs: "quadriceps",
  hamstrings: "hamstrings",
  calves: "calves",
  "calves (soleus)": "calves",
  "calves (gastrocnemius)": "calves",
};

export function regionOfMuscle(muscle: string): BodyRegion | null {
  return MUSCLE_TO_REGION[muscle.trim().toLowerCase()] ?? null;
}

/**
 * How much one working set counts towards each region: 1 for a primary muscle, 0.5 for a secondary one (a common
 * convention for counting weekly volume). A region named both ways counts once, as primary.
 */
export function regionShares(primary: string[], secondary: string[] = []): Map<BodyRegion, number> {
  const out = new Map<BodyRegion, number>();
  for (const m of secondary) {
    const r = regionOfMuscle(m);
    if (r) out.set(r, 0.5);
  }
  for (const m of primary) {
    const r = regionOfMuscle(m);
    if (r) out.set(r, 1);
  }
  return out;
}

/** The regions an exercise mainly trains. */
export function primaryRegions(primary: string[]): BodyRegion[] {
  return [...new Set(primary.map(regionOfMuscle).filter((r): r is BodyRegion => r != null))];
}

/**
 * Weekly working-set ranges commonly used for muscle growth (the same ranges as the coach's training principles).
 * Regions without a well-established range (lower back, forearms, abdominals) have none, so the review never
 * suggests volume changes for them.
 */
export const WEEKLY_SET_RANGES: Partial<Record<BodyRegion, [number, number]>> = {
  chest: [10, 20],
  upper_back: [12, 22],
  shoulders: [8, 22],
  biceps: [8, 18],
  triceps: [6, 16],
  quadriceps: [8, 18],
  hamstrings: [6, 14],
  glutes: [4, 12],
  calves: [8, 16],
};

/** Lower-body regions progress in bigger load jumps. */
export const LOWER_BODY: ReadonlySet<BodyRegion> = new Set(["quadriceps", "glutes", "hamstrings", "lower_back"]);
