import { describe, expect, it } from "vitest";
import { LIGHTER_RPE_CAP, lighterTargets } from "@/lib/domain/readiness";

describe("lighter session after a low check-in (this session only)", () => {
  it("takes one set off each exercise but never goes below one", () => {
    expect(lighterTargets({ sets: 4, rpe: 8 }).sets).toBe(3);
    expect(lighterTargets({ sets: 1, rpe: 8 }).sets).toBe(1);
  });

  it("caps effort at RPE 7 and never raises an easier target", () => {
    expect(lighterTargets({ sets: 3, rpe: 9 }).rpe).toBe(LIGHTER_RPE_CAP);
    expect(lighterTargets({ sets: 3, rpe: 6 }).rpe).toBe(6);
    expect(lighterTargets({ sets: 3, rpe: null }).rpe).toBe(LIGHTER_RPE_CAP);
  });

  it("keeps everything else (reps, time, intensity notes) and never invents a load", () => {
    const t = { sets: 3, rpe: 8, reps: "8-10", seconds: null, intensity: "Leave 2 reps in reserve" };
    const out = lighterTargets(t);
    expect(out).toEqual({ ...t, sets: 2, rpe: 7 });
    expect(out).not.toHaveProperty("weightKg");
  });
});
