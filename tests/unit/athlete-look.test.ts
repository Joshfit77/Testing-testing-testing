import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/data/exercises";
import { highlightFor } from "@/lib/exercise-motion/athlete";
import { ATHLETE_LOOK_PREVIEW, athleteLookInReview, usesAthleteLook } from "@/lib/athlete-look";
import { getDemoAsset, shownDemoAsset } from "@/lib/exercise-demos";

describe("the athlete look", () => {
  it("is previewed on the squat, the curl and the cable row only, with the classic figure for everything else", () => {
    expect([...ATHLETE_LOOK_PREVIEW].sort()).toEqual(["back-squat", "dumbbell-curl", "seated-cable-row"]);
    for (const slug of ATHLETE_LOOK_PREVIEW) {
      expect(usesAthleteLook(slug)).toBe(true);
      expect(athleteLookInReview(slug)).toBe(true);
    }
    expect(EXERCISES.filter((e) => usesAthleteLook(e.slug))).toHaveLength(3);
  });

  it("takes the curl's place over its 2.5D clip while previewed (the clip stays in the manifest)", () => {
    expect(getDemoAsset("dumbbell-curl")).not.toBeNull();
    expect(shownDemoAsset("dumbbell-curl")).toBeNull();
  });

  it("lights each exercise's primary muscles fully and its secondary muscles softly", () => {
    expect(highlightFor(["biceps"], ["forearms"])).toEqual({ biceps: 1, forearms: 0.42 });
    expect(highlightFor(["quadriceps", "glutes"], ["core"])).toEqual({ quads: 1, glutes: 1, abs: 0.42, obliques: 0.42 });
    expect(highlightFor(["upper back", "lats"], ["biceps", "rear deltoids"])).toEqual({ upperBack: 1, traps: 1, lats: 1, biceps: 0.42, rearDelts: 0.42 });
    // A muscle listed as both keeps the stronger glow.
    expect(highlightFor(["core"], ["core"]).abs).toBe(1);
  });

  it("knows every muscle named in the catalog (except whole-body systems)", () => {
    const systems = new Set(["cardiovascular system", "heart and lungs", ""]);
    for (const e of EXERCISES) {
      for (const m of [...e.primary, ...e.secondary]) {
        if (systems.has(m.trim().toLowerCase())) continue;
        expect(Object.keys(highlightFor([m])).length, `${e.slug}: ${m}`).toBeGreaterThan(0);
      }
      // Every exercise lights something, so the trained muscles always show.
      const any = Object.keys(highlightFor(e.primary, e.secondary)).length > 0;
      const onlySystems = [...e.primary, ...e.secondary].every((m) => systems.has(m.trim().toLowerCase()));
      expect(any || onlySystems, e.slug).toBe(true);
    }
  });
});
