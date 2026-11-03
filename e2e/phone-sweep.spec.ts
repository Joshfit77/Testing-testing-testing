import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, grantPlan, serviceRest, signUpAndConfirm, uniqueEmail, userIdFor } from "./helpers";

/**
 * Every signed-in screen a member can reach, at iPhone widths from the SE (375 pt) to the Pro Max (440 pt), plus a
 * 320 pt pass (an SE with Display Zoom) and the largest in-app text size with reduced motion. On each screen: it loads,
 * no script error or blocked script, no crash screen, nothing scrolls sideways, and the end of the page can be scrolled
 * clear of the tab bar. Pro member, so the Pro screens are reached too; the Free view of Run is in csp-and-layout.
 */
const STATIC = [
  "/home", "/plan", "/calendar",
  "/train", "/train/programs", "/train/exercises", "/train/history", "/train/templates", "/train/templates/new", "/train/build", "/train/recovery", "/train/review", "/train/3d",
  "/run", "/run?tab=log", "/run/record",
  "/nutrition", "/nutrition/diets", "/nutrition/recipes", "/nutrition/recipes/new", "/nutrition/planner", "/nutrition/grocery", "/nutrition/insights", "/nutrition/saved-meals", "/nutrition/supplements", "/nutrition/compare", "/nutrition/photo", "/nutrition/scanner",
  "/faith", "/faith/journal", "/faith/practices", "/faith/reminders",
  "/faith/bible", "/faith/bible/john", "/faith/bible/john/3", "/faith/bible/psalms/119", "/faith/bible/search?q=peace", "/faith/bible/saved", "/faith/bible/history",
  "/faith/journey", "/faith/journey/new", "/faith/journey/new?kind=book", "/faith/journey/new?kind=full_bible", "/faith/journey/new?kind=gospels&days=90",
  "/faith/journal/new?kind=daily", "/faith/memory", "/faith/studies", "/faith/studies/gospel", "/faith/studies/gospel/good-news", "/faith/ask",
  "/progress", "/progress/overview", "/progress/badges", "/progress/body-map", "/progress/body-scan", "/progress/body-scan/new",
  "/progress/sleep", "/progress/sleep/log", "/progress/sleep/checkin", "/progress/sleep/history", "/progress/sleep/debt", "/progress/sleep/energy", "/progress/sleep/schedule", "/progress/sleep/alarm", "/progress/sleep/training", "/progress/sleep/method", "/progress/sleep/settings",
  "/coach", "/coach/memory",
  "/profile", "/profile/preferences", "/profile/billing",
];

async function watch(page: Page) {
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
async function problems(page: Page, width: number): Promise<string[]> {
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

test.describe("every signed-in screen on iPhone sizes", () => {
  test.setTimeout(900_000);

  test("loads cleanly and fits, from the SE to the Pro Max, with the largest text and reduced motion", async ({ page }) => {
    const email = uniqueEmail("sweep");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "pro");
    const errors = await watch(page);

    // One of each kind of detail screen, found the way a member would.
    await page.goto("/train/exercises");
    const exercise = await page.locator('a[href^="/train/exercises/"]').first().getAttribute("href");
    await page.goto("/train/programs");
    const program = await page.locator('a[href^="/train/programs/"]').first().getAttribute("href");
    await page.goto("/nutrition/recipes");
    const recipe = await page.locator('a[href^="/nutrition/recipes/app/"]').first().getAttribute("href");
    const pages = [...STATIC, exercise!, `${exercise!}/history`, program!, "/train/programs/half-marathon-base-80-20", recipe!].filter(Boolean);

    const found: string[] = [];
    const visit = async (label: string, width: number) => {
      for (const path of pages) {
        errors.length = 0;
        const res = await page.goto(path);
        if ((res?.status() ?? 0) >= 400) found.push(`${label} ${path}: HTTP ${res?.status()}`);
        await page.waitForLoadState("networkidle").catch(() => null);
        for (const p of [...(await problems(page, width)), ...errors]) found.push(`${label} ${path}: ${p}`);
      }
    };

    for (const [width, height] of [[375, 667], [393, 852], [440, 956]] as const) {
      await page.setViewportSize({ width, height });
      await visit(`${width} pt`, width);
    }
    await page.setViewportSize({ width: 320, height: 568 });
    await visit("320 pt", 320);

    // The largest in-app text size (Profile > Preferences), with reduced motion, on the smallest current iPhone.
    const id = await userIdFor(email);
    await serviceRest(`profiles?id=eq.${id}`, { method: "PATCH", body: { text_size: "xlarge", reduce_motion: true } });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/home");
    await expect(page.locator("html")).toHaveAttribute("data-text-size", "xlarge");
    await visit("375 pt, largest text", 375);

    expect(found, found.join("\n")).toEqual([]);
  });
});
