import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";
import { HOME_BACKGROUND_PHOTOS_READY as PHOTOS } from "../src/lib/home-backgrounds";

/**
 * Home shows one background for each day of the week (docs/design/HOME_BACKGROUNDS.md). The picture follows the
 * phone's own local date: at midnight, when the app comes back to the foreground on another day, and without a
 * connection. The greeting and the verse stay readable over every picture.
 */
const WEEK = [
  ["2026-11-09", "monday", "Strength"],
  ["2026-11-10", "tuesday", "Faith first"],
  ["2026-11-11", "wednesday", "Prayer"],
  ["2026-11-12", "thursday", "Endurance"],
  ["2026-11-13", "friday", "Perseverance"],
  ["2026-11-14", "saturday", "Rest and worship"],
  ["2026-11-15", "sunday", "The cross"],
] as const;

const hero = (page: Page) => page.getByTestId("home-hero");

/**
 * Open Home with the test clock in place. Under load the fake clock can land a moment after the page's first date
 * check; the page checks again whenever it becomes visible, as it does on a phone, so ask for that once.
 */
async function openHome(page: Page) {
  await page.goto("/home");
  await page.waitForLoadState("load");
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
}

async function pictureLoaded(page: Page, day: string, opts: { noPicture?: boolean } = {}) {
  // On a slow machine the page can take seconds to become interactive; it checks the date then, and again whenever it
  // becomes visible (as on a phone). Ask until it shows the test clock's day.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          document.dispatchEvent(new Event("visibilitychange"));
          return document.querySelector('[data-testid="home-hero"]')?.getAttribute("data-day") ?? "";
        }),
      { message: `the hero shows ${day}`, timeout: 30_000 },
    )
    .toBe(day);
  // Until the owner's photographs are in, the hero is a plain panel: there is no picture to wait for.
  if (!PHOTOS || opts.noPicture) return;
  await expect
    .poll(() => hero(page).locator("img").evaluate((img: HTMLImageElement) => (img.complete && img.naturalWidth > 0 ? img.currentSrc : "")), { message: `the ${day} picture is drawn` })
    .toContain(`/home-backgrounds/${day}.webp`);
}

/**
 * Contrast of each line of hero text against the brightest part of the picture behind it (WCAG relative luminance;
 * the 98th-percentile pixel, so a single speck of film grain doesn't decide it). The text is hidden for the
 * measurement and the screenshot is read back in the page.
 */
async function worstContrast(page: Page) {
  const lines = await hero(page).evaluate((root) => {
    const out: { name: string; x: number; y: number; w: number; h: number; color: string; alpha: number }[] = [];
    // Any CSS colour (rgb, oklab, color-mix) as plain RGBA, by painting one pixel with it.
    const dot = document.createElement("canvas");
    dot.width = dot.height = 1;
    const g = dot.getContext("2d", { willReadFrequently: true })!;
    const rgba = (css: string) => {
      g.clearRect(0, 0, 1, 1);
      g.fillStyle = css;
      g.fillRect(0, 0, 1, 1);
      const d = g.getImageData(0, 0, 1, 1).data;
      const a = d[3]! / 255;
      // Canvas pixels are stored premultiplied; undo it.
      return { color: a ? `${Math.round(d[0]! )},${Math.round(d[1]!)},${Math.round(d[2]!)}` : "0,0,0", alpha: a };
    };
    // Every line of every piece of text in the hero, measured where the letters are (not the element's box, which
    // for a heading runs the full width, over the bright subject of the picture).
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = (n.textContent ?? "").trim();
      const el = n.parentElement;
      if (!text || !el || el.closest("[aria-hidden='true'], .sr-only, button")) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const c = rgba(style.color);
      Array.from(range.getClientRects())
        .filter((r) => r.width > 1 && r.height > 1)
        .forEach((r, i) => out.push({ name: `"${text.slice(0, 28)}"${i ? ` (line ${i + 1})` : ""}`, x: r.x, y: r.y, w: r.width, h: r.height, ...c }));
    }
    return out;
  });
  await page.addStyleTag({ content: `[data-testid="home-hero"] > .relative { visibility: hidden !important }` });
  const shot = (await hero(page).screenshot({ animations: "disabled" })).toString("base64");
  const box = (await hero(page).boundingBox())!;
  const result = await page.evaluate(
    async ({ shot, lines, box }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${shot}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0);
      const k = img.naturalWidth / box.width;
      const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      const lum = (r: number, gr: number, b: number) => 0.2126 * lin(r / 255) + 0.7152 * lin(gr / 255) + 0.0722 * lin(b / 255);
      return lines.map((l) => {
        const x = Math.max(0, Math.round((l.x - box.x) * k));
        const y = Math.max(0, Math.round((l.y - box.y) * k));
        const w = Math.max(1, Math.min(c.width - x, Math.round(l.w * k)));
        const h = Math.max(1, Math.min(c.height - y, Math.round(l.h * k)));
        const d = g.getImageData(x, y, w, h).data;
        const ls: number[] = [];
        for (let i = 0; i < d.length; i += 4) ls.push(lum(d[i]!, d[i + 1]!, d[i + 2]!));
        ls.sort((a, b) => a - b);
        const bg = ls[Math.floor(ls.length * 0.98)]!;
        const [r, gr, b] = l.color.split(",").map(Number) as [number, number, number];
        // Semi-transparent text (white at 80 %) is blended over that background first.
        const fg = l.alpha * lum(r, gr, b) + (1 - l.alpha) * bg;
        return { name: l.name, ratio: Math.round(((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)) * 10) / 10 };
      });
    },
    { shot, lines, box },
  );
  return result;
}

test("Home: a different background each day of the week, with readable text over every one", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndConfirm(page, uniqueEmail("bg"));
  await completeOnboarding(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const seen = new Set<string>();
  const report: Record<string, unknown> = {};
  for (const [date, day, theme] of WEEK) {
    // The phone's clock says it is noon on that day.
    await page.clock.setFixedTime(new Date(`${date}T12:00:00`));
    await openHome(page);
    await pictureLoaded(page, day);
    await expect(page.getByTestId("home-theme")).toHaveText(theme);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    seen.add(PHOTOS ? await hero(page).locator("img").evaluate((img: HTMLImageElement) => img.currentSrc) : day);
    const contrast = await worstContrast(page);
    report[day] = contrast;
    for (const line of contrast) {
      // 4.5:1 is the WCAG AA level for normal text; the greeting is large text (3:1) but is held to the same bar.
      expect.soft(line.ratio, `${day}: ${line.name} contrast`).toBeGreaterThanOrEqual(4.5);
    }
  }
  expect(seen.size, "seven different pictures").toBe(7);
  expect(errors, "no page errors").toEqual([]);
  test.info().annotations.push({ type: "contrast", description: JSON.stringify(report) });
  console.log("home hero contrast", JSON.stringify(report));
});

test("Home: the picture changes at local midnight and when the app comes back on another day", async ({ page }) => {
  await signUpAndConfirm(page, uniqueEmail("bg"));
  await completeOnboarding(page);

  // Ten seconds before midnight on Friday.
  await page.clock.install({ time: new Date("2026-11-13T23:59:50") });
  await openHome(page);
  await pictureLoaded(page, "friday");
  await page.clock.fastForward(15_000);
  await pictureLoaded(page, "saturday");
  await expect(page.getByTestId("home-theme")).toHaveText("Rest and worship");

  // The app sat in the background until Monday afternoon: nothing ran in between, then it becomes visible again.
  await page.clock.setSystemTime(new Date("2026-11-16T15:00:00"));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await pictureLoaded(page, "monday");
  await expect(page.getByTestId("home-theme")).toHaveText("Strength");
});

test("Home: without a connection the next day's picture still shows", async ({ page, context }) => {
  test.skip(!PHOTOS, "no photographs yet (HOME_BACKGROUND_PHOTOS_READY)");
  await signUpAndConfirm(page, uniqueEmail("bg"));
  await completeOnboarding(page);
  const fetched = new Set<string>();
  page.on("requestfinished", (r) => {
    const m = r.url().match(/\/home-backgrounds\/(\w+)\.webp/);
    if (m) fetched.add(m[1]!);
  });
  await page.clock.install({ time: new Date("2026-11-11T10:00:00") });
  await openHome(page);
  await pictureLoaded(page, "wednesday");
  // The other six pictures are fetched once the page is idle.
  await page.clock.fastForward(6_000);
  await expect.poll(() => fetched.size, { timeout: 15_000, message: "all seven pictures were fetched" }).toBe(7);
  await page.waitForLoadState("networkidle");

  await context.setOffline(true);
  await page.clock.setSystemTime(new Date("2026-11-12T08:00:00"));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await pictureLoaded(page, "thursday");
});

// The native app has no service worker, so there the pictures come from the browser's own cache (they are served as
// immutable) or, failing that, the hero falls back to its plain panel.
test.describe("without a service worker (as in the native app)", () => {
  test.use({ serviceWorkers: "block" });

  test("Home: the next day's picture comes from the browser cache when offline", async ({ page, context }) => {
    test.skip(!PHOTOS, "no photographs yet (HOME_BACKGROUND_PHOTOS_READY)");
    await signUpAndConfirm(page, uniqueEmail("bg"));
    await completeOnboarding(page);
    const fetched = new Set<string>();
    page.on("requestfinished", (r) => {
      const m = r.url().match(/\/home-backgrounds\/(\w+)\.webp/);
      if (m) fetched.add(m[1]!);
    });
    await page.clock.install({ time: new Date("2026-11-11T10:00:00") });
    await openHome(page);
    await pictureLoaded(page, "wednesday");
    await page.clock.fastForward(6_000);
    await expect.poll(() => fetched.size, { timeout: 15_000, message: "all seven pictures were fetched" }).toBe(7);
    await page.waitForLoadState("networkidle");

    await context.setOffline(true);
    await page.clock.setSystemTime(new Date("2026-11-12T08:00:00"));
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await pictureLoaded(page, "thursday");
  });

  test("Home: when no picture can be loaded the hero keeps its dark panel and readable text", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("bg"));
    await completeOnboarding(page);
    await page.route("**/home-backgrounds/**", (r) => r.abort());
    await page.clock.setFixedTime(new Date("2026-11-13T08:00:00"));
    await openHome(page);
    await pictureLoaded(page, "friday", { noPicture: true });
    await expect(hero(page).locator("img")).toHaveCount(0);
    await expect(page.getByTestId("home-theme")).toHaveText("Perseverance");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const line of await worstContrast(page)) expect.soft(line.ratio, `no picture: ${line.name} contrast`).toBeGreaterThanOrEqual(4.5);
  });
});
