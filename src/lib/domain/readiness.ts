export interface RecoveryCheckinInput {
  sleepQuality: number; // 1 (poor) – 5 (great)
  energy: number; // 1 (drained) – 5 (energized)
  soreness: number; // 1 (none) – 5 (very sore)
  stress: number; // 1 (calm) – 5 (very stressed)
}

/** 0–100 readiness score. Higher is better. */
export function readinessScore(i: RecoveryCheckinInput): number {
  const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(n)));
  const positive = (clamp(i.sleepQuality) - 1) / 4 + (clamp(i.energy) - 1) / 4;
  const negative = (5 - clamp(i.soreness)) / 4 + (5 - clamp(i.stress)) / 4;
  return Math.round(((positive + negative) / 4) * 100);
}

export type ReadinessBand = "high" | "moderate" | "low";

export function readinessBand(score: number): ReadinessBand {
  if (score >= 70) return "high";
  if (score >= 45) return "moderate";
  return "low";
}

/** General training notes. Not medical advice. */
export function readinessNote(band: ReadinessBand): string {
  switch (band) {
    case "high":
      return "You're reporting good recovery. Train as planned and push where your program calls for it.";
    case "moderate":
      return "Recovery looks moderate. Train as planned but consider keeping RPE a point lower and trimming a set if warm-ups feel heavy.";
    case "low":
      return "Recovery looks low today. Consider a lighter session, mobility, an easy walk, or a rest day. If you feel unwell or have pain, rest and consult a qualified professional.";
  }
}
