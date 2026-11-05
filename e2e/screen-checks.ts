import type { Page } from "@playwright/test";

/**
 * The screen checks shared by the phone sweep (e2e/phone-sweep.spec.ts: iPhone widths, largest text) and the device
 * matrix (e2e/device-matrix.spec.ts: every iPhone and Android model in Playwright's device list).
 */

/** Every signed-in screen a member can reach without data of their own (detail screens: see detailPages). */
export const STATIC = [
  "/home", "/plan", "/calendar",
  "/train", "/train/programs", "/train/exercises", "/train/history", "/train/templates", "/train/templates/new", "/train/build", "/train/recovery", "/train/review",
  "/run", "/run?tab=log", "/run/record",
  "/nutrition", "/nutrition/diets", "/nutrition/recipes", "/nutrition/recipes/new", "/nutrition/planner", "/nutrition/grocery", "/nutrition/insights", "/nutrition/saved-meals", "/nutrition/supplements", "/nutrition/compare", "/nutrition/photo", "/nutrition/scanner",
  "/faith", "/faith/journal", "/faith/practices", "/profile/notifications",
  "/faith/bible", "/faith/bible/john", "/faith/bible/john/3", "/faith/bible/psalms/119", "/faith/bible/search?q=peace", "/faith/bible/saved", "/faith/bible/history",
  "/faith/journey", "/faith/journey/new", "/faith/journey/new?kind=book", "/faith/journey/new?kind=full_bible", "/faith/journey/new?kind=gospels&days=90",
  "/faith/journal/new?kind=daily", "/faith/memory", "/faith/studies", "/faith/studies/gospel", "/faith/studies/gospel/good-news", "/faith/ask",
  "/progress", "/progress/overview", "/progress/badges", "/progress/body-map", "/progress/body-scan", "/progress/body-scan/new",
  "/progress/sleep", "/progress/sleep/log", "/progress/sleep/checkin", "/progress/sleep/history", "/progress/sleep/debt", "/progress/sleep/energy", "/progress/sleep/schedule", "/progress/sleep/alarm", "/progress/sleep/training", "/progress/sleep/method", "/progress/sleep/settings",
  "/coach", "/coach/memory",
  "/profile", "/profile/preferences", "/profile/billing",
];

export async function watch(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`script error: ${e.message.slice(0, 160)}`));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __csp?: string[] }).__csp = [...((window as unknown as { __csp?: string[] }).__csp ?? []), `${e.violatedDirective} ${e.blockedURI || "inline"}`];
    });
  });
  return errors;
}

/** What's wrong with the screen as laid out at `width` (empty when nothing is). */
export async function problems(page: Page, width: number): Promise<string[]> {
  return page.evaluate(async (w) => {
    const out: string[] = [];
    const text = document.body.innerText;
    if (/Application error|Something went wrong|Unhandled Runtime Error|This page couldn.t load/i.test(text)) out.push("crash screen");
    const csp = (window as unknown as { __csp?: string[] }).__csp ?? [];
    if (csp.length) out.push(`blocked by the CSP: ${csp.slice(0, 2).join(", ")}`);
    // Sideways scroll, measured against the width set (a phone browser widens innerWidth to fit overflowing content).
    const scroll = document.documentElement.scrollWidth;
    if (scroll > w + 1) {
      const leaves = [...document.querySelectorAll("body *")]
        .filter((el) => el.getBoundingClientRect().right > w + 0.5 && getComputedStyle(el).position !== "fixed")
        .filter((el) => ![...el.children].some((c) => c.getBoundingClientRect().right > w + 0.5))
        .slice(0, 3)
        .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}" → ${Math.round(el.getBoundingClientRect().right)} px`);
      out.push(`${scroll} px wide: ${leaves.join("; ")}`);
    }
    // At the end of the page, the last content must sit above the fixed tab bar (and so above the home indicator).
    // (Instant: the page scrolls smoothly, and a measurement mid-scroll would see the content still under the bar.)
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const bar = [...document.querySelectorAll("nav")].find((n) => getComputedStyle(n).position === "fixed" && n.getBoundingClientRect().bottom >= window.innerHeight - 2 && n.getBoundingClientRect().height < 140);
    const main = document.querySelector("main");
    if (bar && main) {
      const top = bar.getBoundingClientRect().top;
      const hidden = [...main.querySelectorAll("a, button, input, select, textarea, p, h1, h2, h3, li")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          // (Screen-reader-only text, e.g. a chart's data list, is 1 px and clipped: not something the eye has to find.)
          return r.height > 1 && r.width > 1 && s.visibility !== "hidden" && s.position !== "fixed" && s.position !== "sticky" && !el.closest("[role=dialog], [data-state=closed], [aria-hidden=true], .sr-only");
        })
        .filter((el) => el.getBoundingClientRect().bottom > top + 2);
      if (hidden.length) out.push(`under the tab bar at the end of the page: ${hidden.slice(0, 2).map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}"`).join("; ")}`);
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    return out;
  }, width);
}

/** One of each kind of detail screen, found the way a member would. */
export async function detailPages(page: Page): Promise<string[]> {
  await page.goto("/train/exercises");
  const exercise = await page.locator('a[href^="/train/exercises/"]').first().getAttribute("href");
  await page.goto("/train/programs");
  const program = await page.locator('a[href^="/train/programs/"]').first().getAttribute("href");
  await page.goto("/nutrition/recipes");
  const recipe = await page.locator('a[href^="/nutrition/recipes/app/"]').first().getAttribute("href");
  return [exercise!, `${exercise!}/history`, program!, "/train/programs/half-marathon-base-80-20", recipe!].filter(Boolean);
}
