// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * O-06: Android 15+ (targetSdk 35+) always draws apps edge to edge. Capacitor 8's built-in SystemBars plugin either pads
 * the web view (older WebViews) or passes the insets to CSS env(safe-area-inset-*) (newer WebViews, which need
 * viewport-fit=cover). These checks keep the pieces that makes work from being switched off by accident; the look on
 * a real phone is IPHONE/ANDROID_DEVICE_TESTING.md (Android test 3).
 */
const read = (p: string) => readFileSync(p, "utf8");

describe("Android edge-to-edge", () => {
  it("the page asks for viewport-fit=cover", () => {
    expect(read("src/app/layout.tsx")).toMatch(/viewportFit:\s*"cover"/);
  });

  it("SystemBars inset handling is left on (not 'disable')", () => {
    expect(read("capacitor.config.ts")).not.toMatch(/insetsHandling:\s*["']disable["']/);
  });

  it("the app shell pads its top and bottom bars with the safe-area insets", () => {
    const css = read("src/app/globals.css");
    expect(css).toMatch(/padding-top:\s*env\(safe-area-inset-top\)/);
    expect(css).toMatch(/padding-bottom:\s*env\(safe-area-inset-bottom\)/);
  });

  it("targets an SDK where edge-to-edge applies (so the device test is meaningful)", () => {
    expect(Number(read("android/variables.gradle").match(/targetSdkVersion\s*=\s*(\d+)/)![1])).toBeGreaterThanOrEqual(35);
  });
});
