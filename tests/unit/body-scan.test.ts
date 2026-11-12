import { describe, expect, it } from "vitest";
import { canUseBodyScan, compareScans, isOwnScanPath, REQUIRED_POSES, SCAN_GUIDANCE, scanPhotoPath, tiltFromUpright, type ScanSummary } from "@/lib/domain/body-scan";

const U = "11111111-2222-4333-8444-555555555555";
const S = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const F = "99999999-8888-4777-8666-555555555555";

describe("body scan", () => {
  it("is a Pro feature", () => {
    expect(canUseBodyScan("pro")).toBe(true);
    expect(canUseBodyScan("plus")).toBe(false);
    expect(canUseBodyScan("free")).toBe(false);
    expect(REQUIRED_POSES).toEqual(["front", "side"]);
  });

  it("accepts only photos in the owner's folder for that scan and view", () => {
    const p = scanPhotoPath(U, S, "front", F);
    expect(p).toBe(`${U}/${S}/front-${F}.jpg`);
    expect(isOwnScanPath(U, S, "front", p)).toBe(true);
    expect(isOwnScanPath(U, S, "side", p)).toBe(false); // wrong view
    expect(isOwnScanPath(U, F, "front", p)).toBe(false); // another scan
    expect(isOwnScanPath(F, S, "front", p)).toBe(false); // another member
    expect(isOwnScanPath(U, S, "front", `${U}/${S}/../front-${F}.jpg`)).toBe(false);
    expect(isOwnScanPath(U, S, "front", `${U}/${S}/front-${F}.png`)).toBe(false);
    expect(isOwnScanPath("not-a-uuid", S, "front", p)).toBe(false);
  });

  it("compares two scans only where both have a value", () => {
    const a: ScanSummary = { id: "a", takenOn: "2026-09-01", weightKg: 90, measurements: { waist: 96, chest: 104 }, photos: {}, note: null };
    const b: ScanSummary = { id: "b", takenOn: "2026-10-13", weightKg: 87.4, measurements: { waist: 92.5, arm: 38 }, photos: {}, note: null };
    expect(compareScans(a, b)).toEqual({ days: 42, weightKg: -2.6, measurements: { waist: -3.5 } });
    expect(compareScans(a, { ...b, weightKg: null }).weightKg).toBeNull();
  });

  it("reads the phone's tilt from upright", () => {
    expect(tiltFromUpright(90, 0)).toBe(0);
    expect(tiltFromUpright(80, 3)).toBe(10);
    expect(tiltFromUpright(88, -12)).toBe(12);
    expect(tiltFromUpright(null, 0)).toBeNull();
  });

  it("gives lighting, distance, pose and consistency guidance, and never promises body fat", () => {
    expect(SCAN_GUIDANCE.map((g) => g.title)).toEqual(["Lighting", "Distance and framing", "Pose", "Consistency"]);
    expect(JSON.stringify(SCAN_GUIDANCE)).not.toMatch(/body fat|visceral/i);
  });
});
