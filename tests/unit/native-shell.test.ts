import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * The native shell around the deployed site (capacitor.config.ts, native-shell/). Capacitor shows the offline page
 * from inside the app bundle (capacitor://localhost/error.html on iPhone), so reloading that page can never reach the
 * site again: "Try again" has to go back to the deployed address, which `npx cap sync` writes next to it.
 */
const root = join(import.meta.dirname, "../..");
const errorPage = readFileSync(join(root, "native-shell/error.html"), "utf8");

vi.stubEnv("CAP_MODE", "standalone"); // load the config without writing anything
const { default: config, serverAddressScript } = await import("../../capacitor.config");
afterAll(() => vi.unstubAllEnvs());

/** Run the offline page's inline script against a stand-in window and return its retry(). */
function retryWith(win: { NGF_SERVER_URL?: string; location: { replace: (u: string) => void; reload: () => void } }) {
  const inline = [...errorPage.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
  return new Function("window", `${inline}\nreturn retry;`)(win) as () => void;
}

describe("offline page in the phone app", () => {
  it("loads the deployed address before its own script, and Try again calls retry()", () => {
    const addressAt = errorPage.indexOf('<script src="server-url.js"></script>');
    expect(addressAt).toBeGreaterThan(-1);
    expect(addressAt).toBeLessThan(errorPage.indexOf("function retry"));
    expect(errorPage).toContain('onclick="retry()"');
    expect(errorPage).not.toContain('onclick="location.reload()"');
  });

  it("Try again goes back to the site, not to the bundled page", () => {
    const location = { replace: vi.fn(), reload: vi.fn() };
    retryWith({ NGF_SERVER_URL: "https://app.example.org", location })();
    expect(location.replace).toHaveBeenCalledWith("https://app.example.org");
    expect(location.reload).not.toHaveBeenCalled();
  });

  it("falls back to a reload when no address was written (an old build)", () => {
    const location = { replace: vi.fn(), reload: vi.fn() };
    retryWith({ location })();
    expect(location.reload).toHaveBeenCalledTimes(1);
    expect(location.replace).not.toHaveBeenCalled();
  });

  it("writes the address as a safely quoted script", () => {
    const win: { NGF_SERVER_URL?: string } = {};
    const tricky = 'https://app.example.org/";alert(1);//';
    new Function("window", serverAddressScript(tricky))(win);
    expect(win.NGF_SERVER_URL).toBe(tricky);
  });
});

describe("Capacitor iOS settings", () => {
  it("builds the Xcode scheme that exists (the App target), so `npx cap run ios` can install on a phone", () => {
    expect(config.ios?.scheme).toBe("App");
    const pbxproj = readFileSync(join(root, "ios/App/App.xcodeproj/project.pbxproj"), "utf8");
    expect(pbxproj).toMatch(/\bname = App;/);
  });
});
