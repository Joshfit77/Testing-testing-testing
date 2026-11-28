import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { completeOnboarding, serviceRest, signUpAndConfirm, uniqueEmail, userIdFor } from "./helpers";

/**
 * Narrow Gate Biblical AI in the browser, against the production build with a local stand-in for the AI API (port
 * E2E_ANTHROPIC_MOCK_PORT, shared with the other AI specs). One flow, so the global `biblical_ai` flag is on only while
 * it runs; it is switched off again at the end.
 */
const MOCK_PORT = Number(process.env.E2E_ANTHROPIC_MOCK_PORT ?? 4777);
const ANSWER = {
  title: "God's love in John 3:16",
  answer: "John 3:16 shows that God loved the world by giving His Son, so that whoever believes in Him has eternal life. Compare Romans 5:8.",
  scripture: [{ reference: "John 3:16", quote: "For God so loved the world" }, { reference: "Romans 5:8" }],
  context: "Jesus speaks with Nicodemus about the new birth (John 3:1-15).",
  application: "Trust Christ, and thank God for His love.",
  reflection_questions: ["What does it mean to believe in Him?"],
};

async function setFlag(on: boolean) {
  await serviceRest("feature_flags?key=eq.biblical_ai", { method: "PATCH", body: { enabled: on } });
}

test.describe.configure({ mode: "serial" });

test.describe("Narrow Gate Biblical AI", () => {
  test("hidden while off; with it on: ask, verified Scripture, save, report, reader peek, study actions, word study", async ({ page }) => {
    test.setTimeout(240_000);
    let mock: Server | undefined;
    const seen: { tool_choice?: { name: string }; messages: { content: unknown }[] }[] = [];
    try {
      mock = createServer((req, res) => {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          const parsed = JSON.parse(body);
          seen.push(parsed);
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              id: `msg_bai_${seen.length}`,
              type: "message",
              role: "assistant",
              model: "claude-haiku-5-5",
              content: [{ type: "tool_use", id: `toolu_${seen.length}`, name: parsed.tool_choice?.name ?? "submit_study", input: ANSWER }],
              stop_reason: "tool_use",
              stop_sequence: null,
              usage: { input_tokens: 1200, output_tokens: 200 },
            }),
          );
        });
      });
      await new Promise<void>((resolve, reject) => {
        mock!.once("error", reject);
        mock!.listen(MOCK_PORT, "127.0.0.1", () => resolve());
      });
    } catch {
      test.skip(true, `port ${MOCK_PORT} is in use (another AI mock is running)`);
    }

    const email = uniqueEmail("bai");
    try {
      await setFlag(false);
      await signUpAndConfirm(page, email);
      await completeOnboarding(page);

      // Off: nothing of Biblical AI shows, and its pages don't exist.
      await page.goto("/faith");
      await expect(page.getByTestId("biblical-ai-card")).toHaveCount(0);
      const off = await page.goto("/faith/biblical-ai");
      expect(off?.status()).toBe(404);

      await setFlag(true);
      await page.goto("/faith");
      const card = page.getByTestId("biblical-ai-card");
      await expect(card).toBeVisible();
      await expect(card).toContainText("Rooted in Scripture. Centered on Christ.");

      // The dashboard: six study areas, folded.
      await page.goto("/faith/biblical-ai");
      await expect(page.getByRole("heading", { name: "Narrow Gate Biblical AI" })).toBeVisible();
      for (const id of ["scripture", "doctrine", "apologetics", "languages", "history", "personal"]) await expect(page.getByTestId(`category-${id}`)).toBeVisible();
      await page.getByTestId("category-doctrine").locator("summary").click();
      await expect(page.getByTestId("category-doctrine").getByRole("link", { name: "The Gospel" })).toBeVisible();

      // Consent first: no question box until the member allows AI data sharing.
      await page.getByTestId("biblical-ai-ask-cta").click();
      await page.waitForURL(/\/faith\/biblical-ai\/ask/);
      await expect(page.getByTestId("biblical-ai-consent")).toBeVisible();
      await expect(page.getByLabel("Your question")).toHaveCount(0);
      await page.getByRole("button", { name: "Allow and continue" }).click();
      await expect(page.getByTestId("biblical-ai-remaining")).toHaveText("3 questions left today");

      // Free: Deep study is Pro.
      await expect(page.getByRole("radio", { name: /Deep study · Pro/ })).toBeDisabled();
      await page.getByLabel("Your question").fill("What does John 3:16 mean?");
      await page.getByRole("button", { name: "Ask" }).click();
      const answer = page.getByTestId("biblical-ai-answer").last();
      await expect(answer).toContainText("God loved the world by giving His Son");
      // Scripture shown from the BSB, not from the AI.
      const scripture = answer.getByTestId("biblical-ai-scripture");
      await expect(scripture).toContainText("Scripture · Berean Standard Bible");
      await expect(scripture).toContainText("For God so loved the world that He gave His one and only Son");
      await expect(scripture).toContainText("But God proves His love for us in this");
      await expect(page.getByTestId("biblical-ai-remaining")).toHaveText("2 questions left today");
      await expect(page).toHaveURL(/\/faith\/biblical-ai\/ask\?c=[0-9a-f-]{36}$/);
      // What the AI received: a forced tool call and the verified passage; nothing about the account.
      const sent = seen.at(-1)!;
      expect(sent.tool_choice?.name).toBe("submit_study");
      expect(JSON.stringify(sent.messages.at(-1)!.content)).toContain("John 3:16: For God so loved the world");
      expect(JSON.stringify(sent)).not.toMatch(/@example|journal/i);

      // Sections fold; save; report (an inaccuracy report says what is sent).
      await answer.getByTestId("section-context").locator("summary").click();
      await expect(answer.getByTestId("section-context")).toContainText("Nicodemus");
      await answer.getByRole("button", { name: "Save" }).click();
      await expect(answer.getByRole("button", { name: "Saved" })).toBeVisible();
      await answer.getByRole("button", { name: "Report" }).click();
      await expect(page.getByText(/Your question and this answer will be sent to the Narrow Gate team/)).toBeVisible();
      await page.getByRole("button", { name: "Send" }).click();
      await expect(page.getByText("Thank you. Your report was sent.")).toBeVisible();

      // A reference opens the reader in peek mode: a way back, and the reading position isn't moved.
      const userId = await userIdFor(email);
      const before = await serviceRest<{ book_id: string; chapter: number }[]>(`bible_reading_state?user_id=eq.${userId}&select=book_id,chapter`);
      await scripture.getByRole("link", { name: "Romans 5:8" }).click();
      await page.waitForURL(/\/faith\/bible\/romans\/5\?v=8&from=ai/);
      await expect(page.getByRole("link", { name: "Back to your study" })).toBeVisible();
      await page.waitForTimeout(1600);
      const after = await serviceRest<{ book_id: string; chapter: number }[]>(`bible_reading_state?user_id=eq.${userId}&select=book_id,chapter`);
      expect(after).toEqual(before);
      await page.getByRole("link", { name: "Back to your study" }).click();
      await page.waitForURL(/\/faith\/biblical-ai\/ask\?c=/);
      await expect(page.getByTestId("biblical-ai-answer")).toHaveCount(1);

      // Saved studies.
      await page.goto("/faith/biblical-ai/saved");
      await expect(page.getByTestId("saved-studies")).toContainText("God's love in John 3:16");

      // The reader's Study actions prepare a question about the selected passage (nothing is sent until Ask).
      const calls = seen.length;
      await page.goto("/faith/bible/john/3");
      await page.locator("#v16 button").first().click();
      await page.getByRole("toolbar", { name: "Actions for John 3:16" }).getByRole("button", { name: "Study" }).click();
      await expect(page.getByTestId("study-actions")).toBeVisible();
      await page.getByTestId("study-actions").getByRole("link", { name: "Explain this passage" }).click();
      await page.waitForURL(/\/faith\/biblical-ai\/ask\?/);
      await expect(page.getByLabel("Your question")).toHaveValue("Explain John 3:16 in its context.");
      expect(seen.length).toBe(calls);

      // Word study: Greek for John 3:16, Hebrew right to left for Genesis 1:1.
      await page.goto("/faith/bible/words/john/3/16");
      await expect(page.getByTestId("words-original")).toHaveAttribute("lang", "grc");
      await expect(page.getByTestId("words-list").getByRole("listitem").first()).toBeVisible();
      await page.goto("/faith/bible/words/genesis/1/1");
      await expect(page.getByTestId("words-original")).toHaveAttribute("dir", "rtl");
      await expect(page.getByTestId("words-original")).toContainText("בָּרָ֣א");
      await page.goto("/faith/bible/words/mark/16/9");
      await expect(page.getByTestId("words-disputed")).toContainText("main critical text");

      // Conversations: rename and delete.
      await page.goto("/faith/biblical-ai");
      const list = page.getByTestId("biblical-ai-conversations");
      await list.getByRole("button", { name: /^Rename/ }).first().click();
      await page.getByLabel(/^New title for/).fill("John 3 study");
      await page.getByRole("button", { name: "Save title" }).click();
      await expect(list).toContainText("John 3 study");
      await list.getByRole("button", { name: "Delete John 3 study" }).click();
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(page.getByText("Your studies will appear here.")).toBeVisible();
    } finally {
      await setFlag(false);
      await new Promise((r) => (mock ? mock.close(r) : r(null)));
    }
  });
});
