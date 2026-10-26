import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

const chromium = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  // The shared Open Food Facts mock (when E2E_OFF_MOCK_PORT is set).
  globalSetup: "./e2e/global-setup.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    // The opening plays on every full page load; every spec except e2e/opening-gate.spec.ts starts with it switched
    // off (OPENING_TEST_FLAG in src/lib/opening.ts) so pages are usable straight away.
    storageState: { cookies: [], origins: [{ origin: new URL(baseURL).origin, localStorage: [{ name: "ngf.e2e.noIntro", value: "1" }] }] },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: existsSync(chromium) ? { executablePath: chromium } : {},
    // A protected Vercel preview (the demo-preview workflow) is reached with its automation bypass secret.
    ...(process.env.E2E_VERCEL_BYPASS ? { extraHTTPHeaders: { "x-vercel-protection-bypass": process.env.E2E_VERCEL_BYPASS, "x-vercel-set-bypass-cookie": "true" } } : {}),
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], browserName: "chromium" } },
    // WebKit (Safari's engine) at iPhone size, used by the iOS workflow; needs `npx playwright install webkit`. Drawn at
    // 1x: on a CI machine without a GPU, WebKit at the iPhone's 3x can't keep up with the opening's animations (they
    // stay pending). The checks measure CSS pixels, so the pixel density doesn't change what they test.
    ...(process.env.E2E_WEBKIT ? [{
          name: "iphone-webkit",
          // A CI machine without a GPU can go over a second without drawing a frame, which ends the opening's move
          // into the light before it was seen; a retry is a fresh page, and Playwright reports the test as flaky.
          retries: 2,
          use: { ...devices["iPhone 15"], deviceScaleFactor: 1, browserName: "webkit" as const, launchOptions: {} },
        }] : []),
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run start", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
});
