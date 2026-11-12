import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/data/exercises";
import { highlightFor } from "@/lib/exercise-motion/athlete";
import { getDemoAsset, shownDemoAsset } from "@/lib/exercise-demos";
import { demoCaption, demoReadiness, ownerApproved, readinessEntries, READINESS_REVIEW } from "@/lib/exercise-demo-readiness";

/**
 * The 2D exercise demonstrations (docs/EXERCISE_DEMOS_2D.md): one character for every exercise, an honest readiness
 * per exercise, nothing marked approved by code, and no 3D left in the app.
 */
describe("2D exercise demonstrations", () => {
  it("has a reviewed readiness for every catalog exercise, and nothing else", () => {
    const slugs = EXERCISES.map((e) => e.slug).sort();
    expect(readinessEntries().map(([s]) => s).sort()).toEqual(slugs);
    expect(READINESS_REVIEW.reviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(READINESS_REVIEW.method.length).toBeGreaterThan(20);
    for (const [slug, e] of readinessEntries()) {
      expect(["animated", "poses", "placeholder"], slug).toContain(e.readiness);
      // Anything short of the moving demo says why, for the status report.
      if (e.readiness !== "animated") expect(e.note?.trim().length ?? 0, slug).toBeGreaterThan(0);
    }
  });

  it("never treats an unreviewed exercise as finished, and nothing is owner-approved by code", () => {
    expect(demoReadiness("an-exercise-added-later")).toBe("placeholder");
    for (const e of EXERCISES) expect(ownerApproved(e.slug), e.slug).toBe(false);
  });

  it("says what each state is in the caption", () => {
    expect(demoCaption("animated")).toMatch(/Animated 2D demonstration/);
    expect(demoCaption("poses")).toMatch(/pose frames.*still being finished/i);
    expect(demoCaption("placeholder")).toMatch(/still being made.*written steps/i);
  });

  it("shows a 2.5D clip only once the owner has approved it (the curl's clip waits on the backlog)", () => {
    expect(getDemoAsset("dumbbell-curl")?.status).not.toBe("approved");
    expect(shownDemoAsset("dumbbell-curl")).toBeNull();
  });

  it("has no 3D left in the app: no three.js, no 3D module, page or model files", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    for (const dep of ["three", "@types/three", "meshoptimizer", "three-mesh-bvh"]) {
      expect(pkg.dependencies[dep], dep).toBeUndefined();
      expect(pkg.devDependencies[dep], dep).toBeUndefined();
    }
    for (const path of ["src/lib/anatomy3d", "src/components/train/exercise-demo-3d.tsx", "src/components/train/showcase-3d.tsx", "src/app/(app)/train/3d", "public/anatomy"]) {
      expect(existsSync(path), path).toBe(false);
    }
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
