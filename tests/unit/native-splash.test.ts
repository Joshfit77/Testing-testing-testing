import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * One gate (launch-critical item 3). The native launch screens used to show a gold arch for 1.5 s before the web
 * opening's cinematic gate: on a phone, a gate and then another gate. They are now plain #090909 and hand over at once,
 * so the opening's gate is the only one. (scripts/native/blank-splash.mjs rewrites them; docs/OPENING.md.)
 */
const root = join(import.meta.dirname, "../..");
const iosSet = join(root, "ios/App/App/Assets.xcassets/Splash.imageset");
const res = join(root, "android/app/src/main/res");
const androidSplashes = readdirSync(res)
  .filter((d) => d.startsWith("drawable") && existsSync(join(res, d, "splash.png")))
  .map((d) => join(res, d, "splash.png"));
const iosSplashes = readdirSync(iosSet)
  .filter((f) => f.endsWith(".png"))
  .map((f) => join(iosSet, f));

vi.stubEnv("CAP_MODE", "standalone");
const { default: config } = await import("../../capacitor.config");
afterAll(() => vi.unstubAllEnvs());

describe("native launch screen: no second gate", () => {
  it("every iOS and Android splash image is plain #090909 (no arch, no logo)", async () => {
    expect(iosSplashes.length).toBeGreaterThanOrEqual(6);
    expect(androidSplashes.length).toBeGreaterThanOrEqual(20);
    const notPlain: string[] = [];
    for (const file of [...iosSplashes, ...androidSplashes]) {
      const { channels } = await sharp(file).removeAlpha().stats();
      const plain = channels.every((c) => c.min === 9 && c.max === 9);
      if (!plain) notPlain.push(file.slice(root.length + 1));
    }
    expect(notPlain).toEqual([]);
  });

  it("the iOS image set lists exactly the images it contains (no stray stock splash)", () => {
    const listed = (JSON.parse(readFileSync(join(iosSet, "Contents.json"), "utf8")) as { images: { filename?: string }[] }).images.map((i) => i.filename).filter(Boolean).sort();
    expect(listed).toEqual(iosSplashes.map((f) => f.slice(iosSet.length + 1)).sort());
  });

  it("the splash hands over to the opening at once, on the same black", () => {
    const splash = config.plugins?.SplashScreen as { launchShowDuration?: number; backgroundColor?: string; showSpinner?: boolean };
    expect(splash.launchShowDuration).toBe(0);
    expect(splash.backgroundColor).toBe("#090909");
    expect(splash.showSpinner).toBe(false);
    expect(config.backgroundColor).toBe("#090909");
  });
});
