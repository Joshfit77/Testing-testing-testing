import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

/**
 * scripts/ios-verify/check-archive.py checks the iPhone app against App Store Connect's requirements: on every push
 * (unsigned archive) and in the TestFlight job on the signed build before it is uploaded. Here it runs on a fake app
 * folder, so a change to the script is tested without a Mac (`lipo`, a macOS tool, is stood in for).
 */
const SCRIPT = join(process.cwd(), "scripts/ios-verify/check-archive.py");
const python = spawnSync("python3", ["--version"]).status === 0;
const root = mkdtempSync(join(tmpdir(), "ngf-archive-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

type Plist = string | number | boolean | Plist[] | { [k: string]: Plist };
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function node(v: Plist): string {
  if (typeof v === "string") return `<string>${esc(v)}</string>`;
  if (typeof v === "boolean") return v ? "<true/>" : "<false/>";
  if (typeof v === "number") return `<integer>${v}</integer>`;
  if (Array.isArray(v)) return `<array>${v.map(node).join("")}</array>`;
  return `<dict>${Object.entries(v).map(([k, x]) => `<key>${esc(k)}</key>${node(x)}`).join("")}</dict>`;
}
const plist = (v: Plist) => `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">${node(v)}</plist>\n`;
const why = "Narrow Gate Fitness uses this for the feature that asks.";

/** A complete app folder as a good Release build has it; `change` edits it before the check runs. */
function fakeApp(name: string, change: (app: string, info: Record<string, Plist>) => void = () => {}): string {
  const app = join(root, name, "App.app");
  const pub = join(app, "public");
  mkdirSync(join(pub, "bible", "bsb", "books"), { recursive: true });
  const info: Record<string, Plist> = {
    CFBundleIdentifier: "com.narrowgatefitness.app",
    CFBundleDisplayName: "Narrow Gate Fitness",
    CFBundleShortVersionString: "1.0.0",
    CFBundleVersion: "101.1",
    CFBundleExecutable: "App",
    DTSDKName: "iphoneos26.5",
    DTPlatformVersion: "26.5",
    DTXcode: "2660",
    DTXcodeBuild: "17F113",
    MinimumOSVersion: "16.0",
    UIRequiredDeviceCapabilities: ["arm64"],
    LSRequiresIPhoneOS: true,
    ITSAppUsesNonExemptEncryption: false,
    NSCameraUsageDescription: why,
    NSHealthShareUsageDescription: why,
    NSHealthUpdateUsageDescription: why,
    NSLocationWhenInUseUsageDescription: why,
    NSLocationAlwaysAndWhenInUseUsageDescription: why,
    UIBackgroundModes: ["location"],
    UILaunchStoryboardName: "LaunchScreen",
  };
  writeFileSync(join(app, "App"), "binary");
  writeFileSync(join(app, "Assets.car"), "");
  writeFileSync(join(app, "AppIcon60x60@2x.png"), "");
  const kinds = ["Health", "Fitness", "PreciseLocation", "PhotosorVideos", "EmailAddress", "UserID", "PurchaseHistory"];
  writeFileSync(
    join(app, "PrivacyInfo.xcprivacy"),
    plist({
      NSPrivacyTracking: false,
      NSPrivacyCollectedDataTypes: kinds.map((k) => ({ NSPrivacyCollectedDataType: `NSPrivacyCollectedDataType${k}` })),
      NSPrivacyAccessedAPITypes: [{ NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults" }],
    }),
  );
  writeFileSync(join(app, "capacitor.config.json"), JSON.stringify({ appId: "com.narrowgatefitness.app", webDir: "native-shell", server: { url: "https://staging.narrowgate.app", errorPath: "error.html" } }));
  for (const f of ["error.html", "server-url.js", "bible-offline.html", "bible-offline.js", "bible/bsb/meta.json", "bible/bsb/wj.json"]) writeFileSync(join(pub, f), "x");
  for (let i = 1; i <= 66; i++) writeFileSync(join(pub, "bible", "bsb", "books", `${String(i).padStart(2, "0")}.json`), "{}");
  change(app, info);
  writeFileSync(join(app, "Info.plist"), plist(info));
  return app;
}

/** Runs the check with a stand-in `lipo` that reports an arm64-only binary. */
function check(app: string, env: Record<string, string> = {}) {
  const bin = join(root, "bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "lipo"), "#!/bin/sh\necho arm64\n");
  chmodSync(join(bin, "lipo"), 0o755);
  const r = spawnSync("python3", [SCRIPT, app, "26"], { encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, ...env } });
  return { ok: r.status === 0, out: `${r.stdout}${r.stderr}` };
}

describe.skipIf(!python)("iPhone archive check (scripts/ios-verify/check-archive.py)", () => {
  it("passes a complete build, with a re-run's build number (101.1) and the offline Bible inside", () => {
    const r = check(fakeApp("good"));
    expect(r.out).toContain("ok   build number is numeric (101.1)");
    expect(r.out).toContain("ok   offline Bible inside the app (reader and all 66 books)");
    expect(r.out).toContain("All archive checks passed.");
    expect(r.ok).toBe(true);
  });

  it("fails when a book of the offline Bible, the offline reader or the site's address is missing", () => {
    const noBook = check(fakeApp("no-book", (app) => rmSync(join(app, "public", "bible", "bsb", "books", "66.json"))));
    expect(noBook.ok).toBe(false);
    expect(noBook.out).toContain("FAIL offline Bible inside the app (reader and all 66 books) (65 books)");
    const noReader = check(fakeApp("no-reader", (app) => rmSync(join(app, "public", "bible-offline.js"))));
    expect(noReader.ok).toBe(false);
    const noAddress = check(fakeApp("no-address", (app) => rmSync(join(app, "public", "server-url.js"))));
    expect(noAddress.ok).toBe(false);
    expect(noAddress.out).toContain("FAIL offline page knows the site's address");
  });

  it("checks the bundle ID the TestFlight job signs with (EXPECTED_BUNDLE_ID), and the default otherwise", () => {
    const other = (app: string, info: Record<string, Plist>) => {
      info.CFBundleIdentifier = "com.example.ngf";
      writeFileSync(join(app, "capacitor.config.json"), JSON.stringify({ appId: "com.example.ngf", webDir: "native-shell", server: { url: "https://staging.narrowgate.app", errorPath: "error.html" } }));
    };
    expect(check(fakeApp("other-id", other), { EXPECTED_BUNDLE_ID: "com.example.ngf" }).ok).toBe(true);
    const r = check(fakeApp("other-id-default", other));
    expect(r.ok).toBe(false);
    expect(r.out).toContain("FAIL bundle ID is com.narrowgatefitness.app (com.example.ngf)");
  });

  it("still fails a build that would load the offline edition or plain http", () => {
    const http = check(fakeApp("http", (app) => writeFileSync(join(app, "capacitor.config.json"), JSON.stringify({ appId: "com.narrowgatefitness.app", server: { url: "http://staging.narrowgate.app", cleartext: true, errorPath: "error.html" } }))));
    expect(http.ok).toBe(false);
    expect(http.out).toContain("FAIL loads the online app over HTTPS");
  });
});
