import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { completeOnboarding, serviceRest, signUpAndConfirm, uniqueEmail, userIdFor } from "./helpers";

/**
 * The discipleship features end to end, on a Free account: choosing a reading journey (daily load shown first, the
 * rule acknowledged), the two required daily check-ins, an automatic restart after a missed prayer, the optional
 * goals tracked separately, Scripture memory, a guided study, the prayer journal's new kinds, and the Bible study
 * helper against a local stand-in for the AI API (the app server runs with ANTHROPIC_BASE_URL at port 4777).
 */
const RULE = "If you miss your daily Bible reading or prayer, your current journey restarts at Day 1. Your previous reading history and notes will still be saved.";

test.describe("Faith discipleship", () => {
  test("choose a journey, check in, restart after a missed prayer, and keep the optional goals separate", async ({ page }) => {
    const email = uniqueEmail("journey");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);

    await page.goto("/faith");
    const today = page.getByRole("region", { name: "Begin a reading journey" });
    await expect(today.getByText(RULE)).toBeVisible();
    await today.getByRole("link", { name: "Choose a journey" }).click();
    await page.waitForURL(/\/faith\/journey\/new$/);

    // Plan → length (each with its daily load) → start date and the rule.
    await page.getByRole("link", { name: /^The Gospels/ }).click();
    const lengths = page.getByRole("link", { name: /^\d+ days/ });
    await expect(lengths).toHaveCount(5);
    await expect(page.getByRole("link", { name: /^30 days/ })).toContainText(/about \d+ min a day/);
    await expect(page.getByRole("link", { name: /^30 days/ })).toContainText(/chapters a day/);
    await page.getByRole("link", { name: /^30 days/ }).click();
    await expect(page.getByText("Day 1:")).toBeVisible();
    await expect(page.getByText(/Matthew 1/).first()).toBeVisible();
    await expect(page.getByText(RULE)).toBeVisible();
    // The rule must be acknowledged.
    await page.getByRole("button", { name: "Begin the journey" }).click();
    await expect(page).toHaveURL(/\/faith\/journey\/new\?/);
    await page.getByLabel(/I understand that missing a day/).check();
    await page.getByRole("button", { name: "Begin the journey" }).click();
    await page.waitForURL(/\/faith\/journey\?started=1/);
    await expect(page.getByRole("heading", { name: "The Gospels" })).toBeVisible();
    await expect(page.getByText("Day 1 of 30 · 0 complete")).toBeVisible();

    // Reading first: the day isn't complete until prayer is marked too.
    const todaySection = page.getByRole("region", { name: "Today · Day 1" });
    await todaySection.getByRole("button", { name: "Mark reading complete" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Bible reading marked complete." })).toBeVisible();
    await expect(todaySection.getByText("Both are needed before midnight (your time) to keep going.")).toBeVisible();

    // Upcoming days are listed but not complete; reading ahead completes nothing.
    await page.getByRole("link", { name: /Full schedule/ }).click();
    await expect(page.locator("#day-2")).toContainText("Upcoming");
    await expect(page.locator("#day-1")).toContainText("Today");
    await page.goBack();

    // The optional goals on the Faith tab are tracked on their own.
    await page.goto("/faith");
    const card = page.getByRole("region", { name: "The Gospels" });
    await expect(card.getByText("Day 1 of 30")).toBeVisible();
    await card.getByRole("button", { name: "Mark done" }).first().click();
    await expect(card.getByRole("button", { name: "Done" }).first()).toBeVisible();
    await expect(card.getByText("These two are optional and tracked on their own: they never restart your reading journey.")).toBeVisible();

    // Midnight passes without prayer (simulated: the rule is applied as of 28 hours from now). The journey restarts.
    const uid = await userIdFor(email);
    const [journey] = await serviceRest<{ id: string }[]>(`faith_journeys?user_id=eq.${uid}&status=eq.active&select=id`);
    await serviceRest("rpc/faith_journey_settle_at", { method: "POST", body: { p_journey_id: journey!.id, p_now: new Date(Date.now() + 28 * 3600_000).toISOString() } });
    await page.goto("/faith/journey");
    await expect(page.getByRole("heading", { name: "A new beginning" })).toBeVisible();
    await expect(page.getByText("Your journey begins again today. God's mercies are new every morning.")).toBeVisible();
    await expect(page.getByText("— Lamentations 3:22–23", { exact: true })).toBeVisible();
    await expect(page.getByText(/prayer wasn't marked complete, so the journey restarted at Day 1/)).toBeVisible();
    await expect(page.getByText(/Attempt 1 · began .* restarted after/)).toBeVisible();
    // Nothing was deleted: the reading check-in and the attempt are still recorded.
    const rows = await serviceRest<{ reading_completed_at: string | null }[]>(`faith_journey_checkins?user_id=eq.${uid}&select=reading_completed_at`);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.reading_completed_at).not.toBeNull();
  });

  test("both check-ins complete the day; memory practice; a study lesson; journal kinds", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("journey2"));
    await completeOnboarding(page);
    await page.goto("/faith/journey/new?kind=book&param=JHN&days=30");
    await page.getByLabel(/I understand that missing a day/).check();
    await page.getByRole("button", { name: "Begin the journey" }).click();
    await page.waitForURL(/\/faith\/journey\?started=1/);
    const todaySection = page.getByRole("region", { name: "Today · Day 1" });
    await todaySection.getByRole("button", { name: "Mark prayer complete" }).click();
    await expect(todaySection.getByText("Done for today.")).toHaveCount(1);
    await todaySection.getByRole("button", { name: "Mark reading complete" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Day 1 complete." })).toBeVisible();
    await expect(page.getByText("Day 1 of 30 · 1 complete")).toBeVisible();
    // Undo works for today.
    await todaySection.getByRole("button", { name: "Undo" }).first().click();
    await expect(page.getByText("Day 1 of 30 · 0 complete")).toBeVisible();

    // Scripture memory: add by reference, practise.
    await page.goto("/faith/memory");
    await page.getByLabel("Add a passage").fill("Philippians 4:6–7");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Philippians 4:6–7 saved." })).toBeVisible();
    await page.getByRole("link", { name: /Philippians 4:6–7/ }).click();
    await expect(page.getByTestId("memory-text")).toContainText("Be anxious for nothing");
    await page.getByRole("button", { name: "I remembered it" }).click();
    await expect(page.getByText(/· A quarter hidden/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Hidden word: tap to show" }).first()).toBeVisible();

    // A study lesson: the passage in full; draft notes aren't shown to members; own notes saved; complete.
    await page.goto("/faith/studies/gospel/good-news");
    await expect(page.getByRole("region", { name: "Mark 1:1–15" })).toContainText("This is the beginning of the gospel of Jesus Christ, the Son of God.");
    await expect(page.getByText("Study notes for this lesson are being reviewed and will appear here once approved.")).toBeVisible();
    await expect(page.getByText("Study notes (not Scripture)")).toHaveCount(0);
    await page.getByLabel("Your notes").fill("The time is fulfilled.");
    await page.getByRole("button", { name: "Save notes" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Notes saved. Only you can see them." })).toBeVisible();
    await page.getByRole("button", { name: "Mark lesson complete" }).click();
    await expect(page.getByRole("button", { name: "Lesson complete" })).toBeVisible();

    // The prayer journal's new kinds, and archiving.
    await page.goto("/faith/journal/new?kind=intercession");
    await expect(page.getByRole("heading", { name: "For others" })).toBeVisible();
    await page.getByLabel("Who and what you're praying for").fill("For my brother's new job.");
    await page.getByRole("button", { name: "Save entry" }).click();
    await page.waitForURL(/\/faith\/journal$/);
    await page.getByRole("link", { name: /For my brother's new job/ }).click();
    await expect(page.getByRole("heading", { name: "Has God answered this prayer?" })).toBeVisible();
    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText(/Archived\. It’s hidden from your journal but kept/)).toBeVisible();
    await page.goto("/faith/journal");
    await expect(page.getByRole("link", { name: /For my brother's new job/ })).toHaveCount(0);
    await page.goto("/faith/journal?filter=archived");
    await expect(page.getByRole("link", { name: /For my brother's new job/ })).toBeVisible();
  });

  test("the Bible study helper answers from the BSB, shows the passages, and marks references that don't exist", async ({ page }) => {
    let mock: Server | null = null;
    const seen: string[] = [];
    try {
      mock = createServer((req, res) => {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          seen.push(body);
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              id: "msg_bible_e2e",
              type: "message",
              role: "assistant",
              model: "claude-haiku-5-5",
              content: [{ type: "text", text: "John 3:16 says God gave His one and only Son. Compare Psalm 151:2. What does this show you about God's love?" }],
              stop_reason: "end_turn",
              stop_sequence: null,
              usage: { input_tokens: 900, output_tokens: 60 },
            }),
          );
        });
      });
      await new Promise<void>((resolve, reject) => {
        mock!.once("error", reject);
        mock!.listen(4777, "127.0.0.1", () => resolve());
      });
    } catch {
      test.skip(true, "port 4777 is in use (another AI mock is running)");
    }
    try {
      await signUpAndConfirm(page, uniqueEmail("ask"));
      await completeOnboarding(page);
      await page.goto("/faith/ask");
      await expect(page.getByText(/This is an AI, not a pastor/)).toBeVisible();
      await expect(page.getByText("10 questions left today")).toBeVisible();
      await page.getByLabel("Your question").fill("What does John 3:16 mean?");
      await page.getByRole("button", { name: "Ask" }).click();
      const answer = page.getByRole("list", { name: "Conversation" }).getByRole("listitem").last();
      await expect(answer).toContainText("John 3:16 says God gave His one and only Son.");
      await expect(answer).toContainText("Psalm 151:2 [reference not found in the BSB]");
      await expect(answer).toContainText("Passages cited · BSB");
      await expect(answer).toContainText("For God so loved the world that He gave His one and only Son");
      await expect(page.getByText("9 questions left today")).toBeVisible();
      // What the AI received: the question and verified passages; no journal, no account details.
      const sent = JSON.parse(seen.at(-1)!) as { system: string; messages: { content: string }[] };
      expect(sent.system).toMatch(/Bible study helper/);
      expect(sent.messages.at(-1)!.content).toContain("John 3:16: For God so loved the world");
      expect(JSON.stringify(sent)).not.toMatch(/@example|journal/i);
      // History survives a reload and can be deleted.
      await page.reload();
      await expect(page.getByText("John 3:16 says God gave His one and only Son.")).toBeVisible();
    } finally {
      await new Promise((r) => mock?.close(r));
    }
  });
});
