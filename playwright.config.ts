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
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], browserName: "chromium" } },
    // WebKit (Safari's engine) at iPhone size, used by the iOS workflow; needs `npx playwright install webkit`.
    ...(process.env.E2E_WEBKIT ? [{ name: "iphone-webkit", use: { ...devices["iPhone 15"], browserName: "webkit" as const, launchOptions: {} } }] : []),
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run start", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
});
