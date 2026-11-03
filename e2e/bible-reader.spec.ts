import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * The Bible reader (src/app/(app)/faith/bible): the complete BSB from the Faith tab, verse actions that persist, reference
 * and keyword search, history, and reading without a connection (service worker + offline reader). The verse wording is
 * checked against public/bible/bsb, which tests/unit/bible-dataset.test.ts verifies against the official file.
 */
const JOHN_3_16 = "For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.";
const wj = JSON.parse(readFileSync("public/bible/bsb/wj.json", "utf8")) as { books: Record<string, Record<string, Record<string, [number, number][]>>> };
const redCount = (book: string, chapter: number) => Object.values(wj.books[book]?.[chapter] ?? {}).reduce((n, s) => n + s.length, 0);
const colorOf = (page: Page, selector: string) => page.locator(selector).first().evaluate((e) => getComputedStyle(e).color);
/** Opens the reader's display options and returns the Red Letters switch. */
async function displayOptions(page: Page) {
  const button = page.getByRole("button", { name: "Reading display" });
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
  return page.getByRole("switch", { name: /Red letters/ });
}
/** The display setting's save (not the reading-history POST to the same page). */
const whenSaved = (page: Page) => page.waitForResponse((r) => r.request().method() === "POST" && /redLetters|biblePageTheme/.test(r.request().postData() ?? ""));

test.describe("Bible reader", () => {
  test("read, highlight, bookmark, note, search, history and text size; all free", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("bible"));
    await completeOnboarding(page);

    await page.goto("/faith");
    await page.getByRole("link", { name: /^Bible The complete Berean Standard Bible/ }).click();
    await page.waitForURL(/\/faith\/bible$/);
    await expect(page.getByRole("heading", { name: "Bible", exact: true })).toBeVisible();
    await expect(page.getByText(/66 books, 1,189 chapters/)).toBeVisible();

    // Book → chapter grid → chapter.
    await page.getByRole("region", { name: "New Testament" }).getByRole("link", { name: /^John\s*21$/ }).click();
    await page.waitForURL(/\/faith\/bible\/john$/);
    // Opening the chapter saves the place (Continue Reading) and the day's history, a second after it opens.
    const saved = page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith("/faith/bible/john/3"));
    await page.getByRole("link", { name: "John 3", exact: true }).click();
    await page.waitForURL(/\/faith\/bible\/john\/3$/);
    await saved;
    await expect(page.getByRole("heading", { name: "John 3" })).toBeVisible();
    const verse16 = page.locator("#v16").getByRole("button");
    await expect(verse16).toContainText(JOHN_3_16);
    // The words of Jesus are in red (the publisher's red-letter marking): all of 3:16 is His; 3:1 is narration.
    await expect(page.locator("#v16 [data-words-of-jesus]")).toHaveText(JOHN_3_16);
    await expect(page.locator("#v16 [data-words-of-jesus]")).toHaveCSS("color", "rgb(240, 115, 106)");
    await expect(page.locator("#v1 [data-words-of-jesus]")).toHaveCount(0);

    // Highlight in gold, bookmark, and a note: each survives a reload.
    await verse16.click();
    const bar = page.getByRole("toolbar", { name: "Actions for John 3:16" });
    await expect(bar).toBeVisible();
    // On the screen, above the tab bar, even this far down a long chapter.
    await expect(bar).toBeInViewport({ ratio: 1 });
    await bar.getByRole("button", { name: "Highlight gold" }).click();
    await expect(bar).toBeHidden();
    await verse16.click();
    await bar.getByRole("button", { name: "Bookmark" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Bookmarked John 3:16" })).toBeVisible();
    await page.locator("#v17").getByRole("button").click();
    await page.locator("#v16").getByRole("button").click();
    await expect(page.getByRole("toolbar", { name: "Actions for John 3:16–17" })).toBeVisible();
    await page.getByRole("toolbar").getByRole("button", { name: "Note", exact: true }).click();
    const note = page.getByRole("dialog");
    await expect(note.getByRole("heading", { name: "Note on John 3:16–17" })).toBeVisible();
    await note.getByLabel("Note").fill("God's love gives, and keeps.");
    await note.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Note saved. Only you can see it." })).toBeVisible();

    await page.reload();
    await expect(page.locator("#v16").getByRole("button")).toHaveClass(/bg-\[#C9A54C\]/);
    await expect(page.locator("#v16").getByLabel("Bookmarked")).toBeVisible();
    await page.locator("#v17").getByRole("button", { name: "Note", exact: true }).click();
    await expect(page.getByRole("dialog").getByText("God's love gives, and keeps.")).toBeVisible();
    await page.keyboard.press("Escape");

    // Copy gives the exact words and the reference.
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.locator("#v16").getByRole("button").click();
    await page.getByRole("toolbar").getByRole("button", { name: "Copy" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${JOHN_3_16}\n— John 3:16 (BSB)`);

    // Red Letters (on by default, free): off shows His words in the normal colour with the text unchanged, and the
    // choice is kept after a reload. The light page has its own deep red.
    const textBefore = await page.getByTestId("bible-text").innerText();
    const redLetters = await displayOptions(page);
    await expect(redLetters).toBeChecked();
    let save = whenSaved(page);
    await redLetters.click();
    await save;
    const plain = await colorOf(page, "#v1 button");
    await expect.poll(() => colorOf(page, "#v16 [data-words-of-jesus]")).toBe(plain);
    expect(await page.getByTestId("bible-text").innerText()).toBe(textBefore);
    await page.reload();
    await expect.poll(() => colorOf(page, "#v16 [data-words-of-jesus]")).toBe(plain);
    expect(await page.getByTestId("bible-text").innerText()).toBe(textBefore);
    await expect(await displayOptions(page)).not.toBeChecked();
    save = whenSaved(page);
    await page.getByRole("button", { name: "Light", exact: true }).click();
    await save;
    save = whenSaved(page);
    await (await displayOptions(page)).click();
    await save;
    await expect(page.getByTestId("bible-text")).toHaveCSS("background-color", "rgb(248, 244, 234)");
    await expect(page.locator("#v16 [data-words-of-jesus]")).toHaveCSS("color", "rgb(155, 28, 36)");
    await page.reload();
    await expect(page.getByTestId("bible-text")).toHaveAttribute("data-page-theme", "light");
    await expect(page.locator("#v16 [data-words-of-jesus]")).toHaveCSS("color", "rgb(155, 28, 36)");
    // The highlight made earlier still shows on the light page.
    await expect(page.locator("#v16").getByRole("button")).toHaveClass(/bg-\[#C9A54C\]/);
    await displayOptions(page);
    save = whenSaved(page);
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await save;
    await expect(page.locator("#v16 [data-words-of-jesus]")).toHaveCSS("color", "rgb(240, 115, 106)");

    // Text size, remembered after a reload.
    await page.getByRole("button", { name: "Larger text" }).click();
    await expect(page.getByRole("group", { name: "Text size" })).toContainText("110%");
    await page.waitForTimeout(1200); // the saved size is written after a short pause
    await page.reload();
    await expect(page.getByRole("group", { name: "Text size" })).toContainText("110%");

    // Previous / next cross into the neighbouring chapter.
    await page.getByRole("link", { name: /Next\s*John 4/ }).click();
    await page.waitForURL(/\/faith\/bible\/john\/4$/);
    await page.getByRole("link", { name: /Previous\s*John 3/ }).click();
    await page.waitForURL(/\/faith\/bible\/john\/3$/);

    // A verse the BSB keeps in a footnote is shown as such, not invented.
    await page.goto("/faith/bible/john/5");
    await expect(page.locator("#v4")).toContainText("Verse 4 is not in the Berean Standard Bible’s main text");

    // Only His words are red, never the narration around them.
    await page.goto("/faith/bible/john/11");
    await expect(page.locator("#v25 [data-words-of-jesus]")).toHaveText("“I am the resurrection and the life. Whoever believes in Me will live, even though he dies.");
    await expect(page.locator("#v25").getByRole("button")).toContainText("Jesus said to her, “I am the resurrection");
    await expect(page.locator("#v35 [data-words-of-jesus]")).toHaveCount(0);

    // Reference search shows the passage; keyword and phrase search find whole words.
    await page.goto("/faith/bible/search?q=John+3%3A16");
    await expect(page.getByRole("region", { name: "John 3:16" })).toContainText(JOHN_3_16);
    await page.goto(`/faith/bible/search?q=${encodeURIComponent('"narrow gate"')}`);
    await expect(page.getByRole("link", { name: /Matthew 7:13/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /verses?$/ })).toContainText(/^\d+ verses?/);
    await page.goto("/faith/bible/search?q=zzzzqx");
    await expect(page.getByText("No verses contain “zzzzqx”.")).toBeVisible();

    // Saved items and history.
    await page.goto("/faith/bible/saved?tab=bookmarks");
    await expect(page.getByRole("link", { name: /John 3:16/ })).toBeVisible();
    await page.getByRole("link", { name: "Highlights" }).click();
    await expect(page.getByRole("link", { name: /John 3:16/ })).toContainText(JOHN_3_16);
    await page.getByRole("link", { name: "Notes" }).click();
    await expect(page.getByRole("link", { name: /John 3:16–17/ })).toContainText("God's love gives, and keeps.");
    await page.goto("/faith/bible/history");
    await expect(page.getByRole("link", { name: "John 3", exact: true })).toBeVisible();

    // Long chapters: one red element per marked stretch (no per-word markup), quick to open.
    for (const [path, book, chapter, last] of [["/faith/bible/luke/12", "LUK", 12, 59], ["/faith/bible/psalms/119", "PSA", 119, 176]] as const) {
      const t0 = Date.now();
      await page.goto(path);
      await expect(page.locator(`#v${last}`)).toBeVisible();
      expect(Date.now() - t0).toBeLessThan(8000);
      await expect(page.locator("[data-words-of-jesus]")).toHaveCount(redCount(book, chapter));
    }

    // Continue Reading picks up where the member was.
    await page.goto("/faith/bible");
    await expect(page.getByRole("link", { name: /^Continue reading/ })).toBeVisible();
  });

  test("saved for offline, a Bible page opens without a connection and shows Scripture only", async ({ page, context }) => {
    await signUpAndConfirm(page, uniqueEmail("bible-offline"));
    await completeOnboarding(page);
    await page.goto("/faith/bible");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // so the service worker controls the page
    await page.getByRole("button", { name: "Save for offline" }).click();
    await expect(page.getByText(/Saved on this device/)).toBeVisible({ timeout: 60_000 });

    await context.setOffline(true);
    await page.goto("/faith/bible/john/3").catch(() => undefined);
    await expect(page.getByText(/You're offline\. This is the Bible saved on this device/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "John 3" })).toBeVisible();
    await expect(page.locator("#v16")).toContainText(JOHN_3_16);
    await expect(page.locator("#v16 .wj")).toHaveText(JOHN_3_16);
    await expect(page.locator("#v16 .wj")).toHaveCSS("color", "rgb(240, 115, 106)");
    await expect(page.locator("#v1 .wj")).toHaveCount(0);
    await page.getByRole("link", { name: /Next\s*John 4/ }).click();
    await expect(page.getByRole("heading", { name: "John 4" })).toBeVisible();
    await page.getByRole("link", { name: "← John" }).click();
    await page.getByRole("link", { name: "21", exact: true }).click();
    await expect(page.getByRole("heading", { name: "John 21" })).toBeVisible();
    // Only Scripture: no account details on the offline page.
    expect(await page.locator("body").innerText()).not.toMatch(/@|Test Athlete/);

    // Turning Red Letters off in the app reaches the offline reader on this device; the text is unchanged.
    await context.setOffline(false);
    await page.goto("/faith/bible/john/3");
    const save = whenSaved(page);
    await (await displayOptions(page)).click();
    await save;
    await expect.poll(() => page.evaluate(() => localStorage.getItem("ngf.bible.redLetters"))).toBe("0");
    await context.setOffline(true);
    await page.goto("/faith/bible/john/3").catch(() => undefined);
    await expect(page.locator("#v16 .wj")).toHaveText(JOHN_3_16);
    expect(await colorOf(page, "#v16 .wj")).toBe(await colorOf(page, "#v16"));
    await context.setOffline(false);
  });
});
