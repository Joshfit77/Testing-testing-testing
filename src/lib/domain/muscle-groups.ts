/**
 * Muscle-group filter for the exercise library (SPEC §6): plain groups mapped onto the muscle names used in
 * the catalog's `primary_muscles`.
 */
export const MUSCLE_GROUPS = [
  { id: "chest", label: "Chest", muscles: ["chest", "upper chest"] },
  { id: "back", label: "Back", muscles: ["lats", "upper back", "traps", "spinal erectors", "lower back"] },
  { id: "shoulders", label: "Shoulders", muscles: ["shoulders", "front delts", "front deltoids", "side delts", "side deltoids", "rear delts", "rear deltoids", "rotator cuff"] },
  { id: "arms", label: "Arms & grip", muscles: ["biceps", "triceps", "forearms", "brachialis", "grip"] },
  { id: "quads", label: "Quads", muscles: ["quadriceps", "legs"] },
  { id: "glutes-hamstrings", label: "Glutes & hamstrings", muscles: ["glutes", "hamstrings", "adductors", "hip rotators"] },
  { id: "calves", label: "Calves & ankles", muscles: ["calves", "calves (soleus)", "ankles", "foot and ankle stabilizers"] },
  { id: "core", label: "Core", muscles: ["core", "obliques", "abdominals", "abs", "hip flexors"] },
  { id: "full-body", label: "Full body & cardio", muscles: ["full body", "cardiovascular system"] },
  { id: "mobility", label: "Hips, spine & neck", muscles: ["hips", "thoracic spine", "spine", "neck"] },
] as const;
export type MuscleGroupId = (typeof MUSCLE_GROUPS)[number]["id"];

export function muscleGroup(id: string | null | undefined) {
  return MUSCLE_GROUPS.find((g) => g.id === id);
}

/** True when any of the exercise's primary muscles is in the group. */
export function inMuscleGroup(primary: string[], id: MuscleGroupId): boolean {
  const g = muscleGroup(id)!;
  return primary.some((m) => (g.muscles as readonly string[]).includes(m));
}
