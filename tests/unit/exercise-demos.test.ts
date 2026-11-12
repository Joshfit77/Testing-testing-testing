import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { demoMoves, EXERCISE_DEMOS, getDemoAsset, has25dDemo, hasBothSpeeds, scrubFrameSrc } from "@/lib/exercise-demos";

const onDisk = (url: string) => fs.existsSync(path.join(process.cwd(), "public", url));

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

  it("gives every clip a 0.5x file twice its length and scrub frames, all on disk", () => {
    for (const a of Object.values(EXERCISE_DEMOS.demos)) {
      if (!(a.mp4 || a.webm)) continue;
      expect(hasBothSpeeds(a)).toBe(true);
      for (const f of [a.mp4, a.webm, a.slow?.mp4, a.slow?.webm]) if (f) expect(onDisk(f)).toBe(true);
      expect(Math.abs((a.slow?.durationMs ?? 0) - 2 * (a.durationMs ?? 0))).toBeLessThan(120);
      expect(a.scrub?.count).toBeGreaterThanOrEqual(12);
      for (let i = 0; i < (a.scrub?.count ?? 0); i++) expect(onDisk(scrubFrameSrc(a.scrub!, i))).toBe(true);
      expect(onDisk(scrubFrameSrc(a.scrub!, a.scrub!.count))).toBe(false);
      for (const v of a.angles ?? []) {
        expect(v.slow?.mp4 ?? v.slow?.webm).toBeTruthy();
        expect(v.scrub?.count).toBeGreaterThanOrEqual(12);
      }
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
  it("has a normal-speed and a 0.5x file, and frames for scrubbing", () => {
    expect(a?.slow?.mp4).toBe("/exercise-demos/dumbbell-curl/loop-half.mp4");
    expect(a?.slow?.webm).toBe("/exercise-demos/dumbbell-curl/loop-half.webm");
    expect(a?.scrub?.base).toBe("/exercise-demos/dumbbell-curl/scrub/");
    expect(a?.scrub?.count).toBe(49);
  });
  it("is the corrected version 2, still awaiting the owner's approval", () => {
    expect(a?.version).toBe(2);
    expect(a?.status).not.toBe("approved");
  });
});
