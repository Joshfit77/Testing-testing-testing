import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/data/exercises";
import { IN_APP_3D, has3dDemo } from "@/lib/anatomy3d/in-app";
import { hasSpec } from "@/lib/anatomy3d/motion3d/specs";

/** The exercises shown in the app as the 3D figure must be real, have their own motion, and have a baked motion to play. */
describe("in-app 3D demonstrations", () => {
  const index = JSON.parse(readFileSync("public/anatomy/bake/index.json", "utf8")) as Record<string, { frames: number; duration: number }>;

  it("lists exercises from the catalogue only", () => {
    for (const slug of IN_APP_3D) expect(EXERCISES.some((e) => e.slug === slug), slug).toBe(true);
  });

  it("every listed exercise has its own 3D motion (no fallback spec) and a baked motion", () => {
    for (const slug of IN_APP_3D) {
      expect(hasSpec(slug), `${slug} has a motion spec`).toBe(true);
      expect(index[slug]?.frames ?? 0, `${slug} is in the bake index`).toBeGreaterThan(0);
      expect(existsSync(`public/anatomy/bake/${slug}.ngb`), `${slug}.ngb exists`).toBe(true);
    }
  });

  it("the model's files the app fetches are present", () => {
    for (const f of ["ecorche.glb", "ecorche-rig.json", "ecorche-rig.bin", "ecorche-face.json", "ecorche-face.bin"]) expect(existsSync(`public/anatomy/${f}`), f).toBe(true);
  });

  it("every other exercise keeps the animated illustration", () => {
    const others = EXERCISES.filter((e) => !IN_APP_3D.includes(e.slug));
    expect(others.length).toBe(EXERCISES.length - IN_APP_3D.length);
    for (const e of others) expect(has3dDemo(e.slug)).toBe(false);
    expect(has3dDemo("kettlebell-swing")).toBe(true);
  });
});
