import fs from "node:fs";
import path from "node:path";
import { devices, expect, test } from "@playwright/test";
import { completeOnboarding, grantPlan, signUpAndConfirm, uniqueEmail } from "./helpers";
import { detailPages, problems, STATIC, visit, watch } from "./screen-checks";

/**
 * Every iPhone and Android phone in Playwright's device list, portrait: each signed-in screen (the phone sweep's list)
 * at that model's own browser viewport, user agent and touch, checked the same way as e2e/phone-sweep.spec.ts (loads,
 * no script error or blocked script, no crash screen, nothing scrolls sideways, the end of the page clears the tab
 * bar). Models with the same viewport and platform share one run. A few main screens are also photographed per run.
 *
 * Emulation, not the phones themselves: the engine is whichever browser the project runs (Chromium locally; the iOS
 * workflow runs WebKit, Safari's engine), drawn at 1x for speed (layout is measured in CSS pixels, so the density
 * doesn't change what is checked). Real-device checks are in docs/device-testing/DEVICE_TEST_SCRIPT.md.
 *
 *   E2E_DEVICE_MATRIX=1 npx playwright test e2e/device-matrix.spec.ts --project=mobile --workers=4
 *   E2E_DEVICE_MATRIX=ios | android   only that platform's phones
 *   E2E_DEVICE_MATRIX=tablets         iPads and Galaxy Tabs instead (portrait), with the side menu layout
 *   E2E_MATRIX_OUT=dir                results (one JSON per run) and photos; default test-results/device-matrix
 */
const which = process.env.E2E_DEVICE_MATRIX ?? "";
test.skip(!which, "audit: set E2E_DEVICE_MATRIX=1 (or ios / android)");
test.describe.configure({ mode: "parallel" });

/** Screens a full app doesn't run on (a flip phone's small outer display shows widgets, not apps like this one). */
const NOT_AN_APP_SCREEN = new Set(["Galaxy Z Flip 6 Cover", "Galaxy Z Flip 7 Cover"]);
const PHOTOS = ["/home", "/train", "/nutrition", "/faith", "/coach", "/progress", "/progress/sleep", "/profile/billing"];
const OUT = process.env.E2E_MATRIX_OUT ?? "test-results/device-matrix";

type Group = { key: string; ios: boolean; width: number; height: number; models: string[] };
const groups = new Map<string, Group>();
for (const [name, d] of Object.entries(devices)) {
  if (/landscape/i.test(name) || !d.isMobile || NOT_AN_APP_SCREEN.has(name)) continue;
  const tablet = /^(iPad|Galaxy Tab)/.test(name);
  if (which === "tablets" ? !tablet : tablet || !/^(iPhone|Pixel|Galaxy)/.test(name)) continue;
  const ios = /^iP(hone|ad)/.test(name);
  if (which === "ios" && !ios) continue;
  if (which === "android" && ios) continue;
  const key = `${ios ? "ios" : "android"}-${d.viewport.width}x${d.viewport.height}`;
  const g = groups.get(key) ?? { key, ios, width: d.viewport.width, height: d.viewport.height, models: [] };
  g.models.push(name);
  groups.set(key, g);
}

for (const g of [...groups.values()].sort((a, b) => a.width - b.width || a.height - b.height)) {
  test(`${g.models.join(", ")} (${g.width}×${g.height})`, async ({ browser, baseURL }) => {
    test.setTimeout(30 * 60_000);
    const { defaultBrowserType: _engine, ...device } = devices[g.models[0]!]!;
    const context = await browser.newContext({
      ...device,
      deviceScaleFactor: 1,
      baseURL,
      storageState: { cookies: [], origins: [{ origin: new URL(baseURL!).origin, localStorage: [{ name: "ngf.e2e.noIntro", value: "1" }] }] },
    });
    const page = await context.newPage();
    const email = uniqueEmail(`dm${g.width}`);
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "pro");
    const errors = await watch(page, new URL(baseURL!).origin);
    const retries: string[] = [];
    const pages = [...STATIC, ...(await detailPages(page, retries))];

    const found: string[] = [];
    for (const p of pages) {
      errors.length = 0;
      const res = await visit(page, p, retries);
      if ((res?.status() ?? 0) >= 400) found.push(`${p}: HTTP ${res?.status()}`);
      await page.waitForLoadState("networkidle").catch(() => null);
      for (const issue of [...(await problems(page, g.width)), ...errors]) found.push(`${p}: ${issue}`);
    }
    const shots = path.join(OUT, "photos", g.key);
    fs.mkdirSync(shots, { recursive: true });
    for (const [i, p] of PHOTOS.entries()) {
      await visit(page, p, retries);
      await page.waitForLoadState("networkidle").catch(() => null);
      await page.screenshot({ path: path.join(shots, `${String(i).padStart(2, "0")}-${p.replace(/\W+/g, "-").replace(/^-/, "")}.png`) });
    }
    fs.writeFileSync(path.join(OUT, `${g.key}.json`), JSON.stringify({ ...g, engine: browser.browserType().name(), screens: pages.length, problems: found, cancelledPrefetches: errors.cancelledPrefetches, navigationRetries: retries }, null, 1));
    await context.close();
    expect(found, found.join("\n")).toEqual([]);
  });
}
