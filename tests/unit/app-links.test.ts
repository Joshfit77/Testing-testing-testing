// @vitest-environment node
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { androidAssetLinks, appLinkTarget, appLinksConfig, appleAssociation } from "@/lib/app-links";

/** O-05: email links (confirmation, sign-in, reset) can open the app; everything stays off until configured. */
const FP = Array.from({ length: 32 }, (_, i) => (i * 7 % 256).toString(16).padStart(2, "0").toUpperCase()).join(":");

describe("universal links / App Links", () => {
  it("serve nothing until configured, and reject malformed values", () => {
    const cfg = appLinksConfig({});
    expect(appleAssociation(cfg)).toBeNull();
    expect(androidAssetLinks(cfg)).toBeNull();
    expect(appleAssociation(appLinksConfig({ APPLE_TEAM_ID: "not-a-team" }))).toBeNull();
    expect(androidAssetLinks(appLinksConfig({ ANDROID_APP_CERT_SHA256: "AB:CD" }))).toBeNull();
  });

  it("claim only the auth paths for this app's id", () => {
    const cfg = appLinksConfig({ APPLE_TEAM_ID: "ab12cd34ef", ANDROID_APP_CERT_SHA256: ` ${FP} `, CAP_APP_ID: "com.example.ngf" });
    expect(appleAssociation(cfg)).toEqual({
      applinks: {
        details: [
          {
            appIDs: ["AB12CD34EF.com.example.ngf"],
            components: [{ "/": "/auth/confirm" }, { "/": "/auth/confirm/*" }, { "/": "/auth/callback" }, { "/": "/auth/callback/*" }, { "/": "/reset-password" }, { "/": "/reset-password/*" }],
          },
        ],
      },
    });
    expect(androidAssetLinks(cfg)).toEqual([
      { relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: "com.example.ngf", sha256_cert_fingerprints: [FP] } },
    ]);
  });

  it("the app opens only this site's claimed links, keeping the query (the confirmation token)", () => {
    const site = "https://app.example.com";
    expect(appLinkTarget("https://app.example.com/auth/confirm?token_hash=abc&type=email", site)).toBe("/auth/confirm?token_hash=abc&type=email");
    expect(appLinkTarget("https://app.example.com/home", site)).toBeNull();
    expect(appLinkTarget("https://evil.example/auth/confirm?token_hash=abc", site)).toBeNull();
    expect(appLinkTarget("http://app.example.com/auth/confirm", site)).toBeNull();
    expect(appLinkTarget("not a url", site)).toBeNull();
  });

  it("the native script adds the domain once (iOS entitlement, verified Android intent filter) and is a no-op without one", () => {
    const dir = mkdtempSync(join(tmpdir(), "applinks-"));
    cpSync("ios/App/App/App.entitlements", join(dir, "ios/App/App/App.entitlements"));
    cpSync("android/app/src/main/AndroidManifest.xml", join(dir, "android/app/src/main/AndroidManifest.xml"));
    const run = (env: Record<string, string>) => execFileSync("node", ["scripts/native/app-links.mjs", "--root", dir], { env: { ...process.env, ...env }, encoding: "utf8" });
    expect(run({ APP_LINKS_DOMAIN: "" })).toMatch(/nothing changed/);
    run({ APP_LINKS_DOMAIN: "app.example.com" });
    run({ APP_LINKS_DOMAIN: "app.example.com" });
    const ent = readFileSync(join(dir, "ios/App/App/App.entitlements"), "utf8");
    const man = readFileSync(join(dir, "android/app/src/main/AndroidManifest.xml"), "utf8");
    expect(ent.match(/applinks:app\.example\.com/g)).toHaveLength(1);
    expect(ent).toContain("<key>com.apple.developer.healthkit</key>");
    expect(man.match(/android:autoVerify="true"/g)).toHaveLength(1);
    expect(man.match(/android:host="app\.example\.com"/g)).toHaveLength(3);
    expect(man).toContain('android:name="android.intent.category.LAUNCHER"');
    // The committed projects themselves claim nothing yet (signing would fail before the capability is enabled).
    expect(readFileSync("ios/App/App/App.entitlements", "utf8")).not.toContain("associated-domains");
  });
});
