import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Release guards: launch-critical settings that live outside the code paths other tests exercise (native iPhone
 * configuration, build hooks, the scheduled reconciliation workflow). If one of these is removed by accident, the app
 * still builds and most tests still pass, so they are checked here directly.
 */
const read = (p: string) => readFileSync(p, "utf8");

describe("background GPS on iPhone", () => {
  const plist = read("ios/App/App/Info.plist");
  const stringAfter = (key: string) => plist.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`))?.[1] ?? "";

  it("Info.plist allows location in the background and explains why", () => {
    expect(plist).toMatch(/<key>UIBackgroundModes<\/key>\s*<array>[\s\S]*?<string>location<\/string>[\s\S]*?<\/array>/);
    expect(stringAfter("NSLocationWhenInUseUsageDescription").length).toBeGreaterThan(20);
    expect(stringAfter("NSLocationAlwaysAndWhenInUseUsageDescription").length).toBeGreaterThan(20);
  });

  it("the background-location plugin is installed at a pinned version", () => {
    const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string> };
    expect(pkg.dependencies["@capacitor-community/background-geolocation"]).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("the recorder and the in-app keeper use the lock-aware clock (fixes queued while locked are counted)", () => {
    expect(read("src/components/run/gps-recorder.tsx")).toContain("suspendAwareTicker(");
    expect(read("src/lib/run/live-recording.ts")).toContain("suspendAwareTicker(");
  });
});

describe("hydration fix stays wired into install and build (docs/HYDRATION_418.md)", () => {
  it("package.json runs the fix on install, before dev and build, and checks the bundle after build", () => {
    const { scripts } = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(scripts.postinstall).toContain("react-hydration-replay-fix.mjs");
    expect(scripts.predev).toContain("react-hydration-replay-fix.mjs");
    expect(scripts.prebuild).toContain("react-hydration-replay-fix.mjs");
    expect(scripts.postbuild).toContain("react-hydration-replay-fix.mjs --verify-build");
  });
});

describe("billing reconciliation workflow refuses unsafe settings", () => {
  // Runs the workflow's own "is it configured" step (the bash in the YAML) with different settings.
  const yml = read(".github/workflows/billing-reconcile.yml");
  const start = yml.indexOf("id: cfg");
  const body = yml.slice(yml.indexOf("run: |", start) + 6, yml.indexOf("- name: Reconcile", start));
  const script = body
    .split("\n")
    .map((l) => (l.startsWith(" ".repeat(10)) ? l.slice(10) : l.trim()))
    .join("\n");

  function cfg(url: string, secret: string) {
    const dir = mkdtempSync(join(tmpdir(), "reconcile-cfg-"));
    try {
      const out = join(dir, "out");
      writeFileSync(out, "");
      writeFileSync(join(dir, "step.sh"), script);
      const r = spawnSync("bash", [join(dir, "step.sh")], { env: { PATH: process.env.PATH, GITHUB_OUTPUT: out, BASE_URL: url, CRON_SECRET: secret } });
      return { code: r.status, on: read(out).trim() };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  const secret = "a".repeat(24);

  it("skips quietly when not configured", () => expect(cfg("", "")).toEqual({ code: 0, on: "on=false" }));
  it("refuses http and placeholder addresses, and short secrets", () => {
    for (const url of ["http://staging.narrowgate.app", "https://app.example.org", "https://example.com", "https://staging.test", "https://localhost:3000", "https://x.invalid"]) {
      expect(cfg(url, secret).code, url).toBe(1);
    }
    expect(cfg("https://staging.narrowgate.app", "short").code).toBe(1);
  });
  it("runs for a real https address with a long enough secret", () => {
    expect(cfg("https://staging.narrowgate.app", secret)).toEqual({ code: 0, on: "on=true" });
    expect(cfg("https://exampleapp.org/", secret)).toEqual({ code: 0, on: "on=true" });
  });
});
