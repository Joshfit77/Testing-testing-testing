// Renders PNG app icons (PWA + native) from the SVG masters using Playwright's Chromium.
// Usage: node scripts/render-icons.mjs
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";

const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(exe) ? { executablePath: exe } : {});
const page = await browser.newPage();
const targets = [
  ["public/icons/icon.svg", "public/icons/icon-192.png", 192],
  ["public/icons/icon.svg", "public/icons/icon-512.png", 512],
  ["public/icons/maskable.svg", "public/icons/maskable-512.png", 512],
  ["public/icons/maskable.svg", "public/icons/apple-touch-icon.png", 180],
  ["public/icons/maskable.svg", "resources/icon.png", 1024],
  ["public/icons/maskable.svg", "resources/icon-foreground.png", 1024],
];
mkdirSync("resources", { recursive: true });
for (const [src, out, size] of targets) {
  const svg = readFileSync(src, "utf8");
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.locator("svg").screenshot({ path: out, omitBackground: true });
  console.log("wrote", out);
}
// Splash: centered mark on brand black.
await page.setViewportSize({ width: 2732, height: 2732 });
const mark = readFileSync("public/icons/maskable.svg", "utf8").replace("<svg ", '<svg width="900" height="900" ');
await page.setContent(`<html><body style="margin:0;width:2732px;height:2732px;display:flex;align-items:center;justify-content:center;background:#090909">${mark}</body></html>`);
await page.screenshot({ path: "resources/splash.png" });
await page.screenshot({ path: "resources/splash-dark.png" });
console.log("wrote resources/splash.png");
await browser.close();
