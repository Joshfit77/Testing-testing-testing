import { describe, expect, it } from "vitest";
import { demoMoves, EXERCISE_DEMOS, getDemoAsset, has25dDemo } from "@/lib/exercise-demos";

describe("2.5D exercise demonstrations manifest", () => {
  it("lists the frame and the assets the app can show", () => {
    expect(EXERCISE_DEMOS.frame).toEqual({ width: 1200, height: 900 });
    for (const [slug, a] of Object.entries(EXERCISE_DEMOS.demos)) {
      expect(a.poster).toBe(`/exercise-demos/${slug}/poster.webp`);
      expect(a.thumb).toBe(`/exercise-demos/${slug}/thumb.webp`);
      expect(["stand-in", "review", "approved"]).toContain(a.status);
      expect(["video", "sequence", "keyframes", "poster"]).toContain(a.mode);
      if (a.mode === "video" || a.mode === "sequence") expect(a.mp4 ?? a.webm).toBeTruthy();
      if (a.mode === "keyframes") expect(a.phases.length).toBeGreaterThan(1);
    }
  });

  it("answers only for exercises with an asset", () => {
    expect(has25dDemo("no-such-exercise")).toBe(false);
    expect(getDemoAsset("no-such-exercise")).toBeNull();
    for (const slug of Object.keys(EXERCISE_DEMOS.demos)) expect(has25dDemo(slug)).toBe(true);
  });

  it("tells a still from something that moves", () => {
    const base = { status: "review" as const, poster: "p", thumb: "t", width: 1200, height: 900, highlighted: [] };
    expect(demoMoves({ ...base, mode: "poster", phases: [] })).toBe(false);
    expect(demoMoves({ ...base, mode: "keyframes", phases: [{ label: "Start", src: "a" }, { label: "Top", src: "b" }] })).toBe(true);
    expect(demoMoves({ ...base, mode: "video", mp4: "/x.mp4", phases: [] })).toBe(true);
  });
});

describe("the dumbbell curl's moving demonstration", () => {
  const a = getDemoAsset("dumbbell-curl");
  it("is a real video, in its own portrait shape, looping (the corrected clip's loop closes)", () => {
    expect(a?.mode).toBe("video");
    expect(a?.mp4).toBe("/exercise-demos/dumbbell-curl/loop.mp4");
    expect(a?.webm).toBe("/exercise-demos/dumbbell-curl/loop.webm");
    expect(a?.width).toBe(540);
    expect(a?.height).toBe(788);
    expect(a?.loop).toBe(true);
    expect(a?.durationMs).toBeGreaterThan(3000);
    expect(a?.phases.map((p) => p.label)).toEqual(["Start", "Top"]);
  });
  it("is the corrected version 2, still awaiting the owner's approval", () => {
    expect(a?.version).toBe(2);
    expect(a?.status).not.toBe("approved");
  });
});
