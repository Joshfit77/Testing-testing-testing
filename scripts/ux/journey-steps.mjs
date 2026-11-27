// The shortest path a member can see from Home for each task. Each step is a tap or a typed field the harness counts.
const vis = async (loc) => (await loc.count()) > 0 && (await loc.first().isVisible());

export async function j01({ page, tap }) {
  await tap(page.getByRole("link", { name: /Start (Today.s Workout|my first workout|workout)/i }), "Start Today's Workout");
  await page.waitForURL(/\/train\/workout/); await page.getByTestId("current-set-card").waitFor();
}
export async function j02({ page, tap, type, mark }) {
  await page.getByRole("link", { name: /Start (Today.s Workout|my first workout|workout)/i }).filter({ visible: true }).first().click();
  await page.waitForURL(/\/train\/workout/);
  const card = page.getByTestId("current-set-card"); await card.waitFor();
  mark();
  // Leave the step counter at the workout screen: logging starts here.
  const w = card.getByLabel("Weight (lb)"), r = card.getByLabel("Reps", { exact: true });
  if ((await w.count()) && !(await w.inputValue())) await type(w, "95", "weight");
  if ((await r.count()) && !(await r.inputValue())) await type(r, "8", "reps");
  await tap(card.getByTestId("complete-set"), "Complete set");
  const rest = page.getByRole("button", { name: /Skip rest/ }).first();
  const auto = await rest.waitFor({ timeout: 4000 }).then(() => true, () => false);
  // Clean up: discard the draft so no workout is saved.
  await page.getByRole("button", { name: /More: rest alerts, notes, discard/ }).click().catch(() => {});
  await page.getByRole("button", { name: /^Discard workout$/ }).first().click().catch(() => {});
  await page.getByRole("dialog").getByRole("button", { name: "Discard", exact: true }).click().catch(() => {});
  await page.waitForURL(/\/train$/, { timeout: 8000 }).catch(() => {});
  return auto ? "rest timer started automatically" : "NO automatic rest timer seen";
}
export async function j03({ page, tap, type, tab }) {
  await tap(tab("Nutrition"), "Nutrition tab"); await page.waitForURL(/\/nutrition/); await page.getByRole("heading", { level: 1 }).waitFor();
  const again = page.getByRole("button", { name: /^Add .+ again$/ }).filter({ visible: true });
  if (await vis(again)) {
    const name = (await again.first().getAttribute("aria-label")) ?? "";
    await tap(again, name);
    await page.getByText(/Added|Logged/i).first().waitFor({ timeout: 8000 }).catch(() => {});
    return `one-tap re-log: ${name}`;
  }
  await tap(page.getByRole("button", { name: /Add food/ }), "Add food");
  const searchTab = page.getByRole("dialog").getByRole("tab", { name: "Search" });
  let box = page.getByLabel("Search foods").or(page.getByPlaceholder(/^e\.g\. chicken/));
  if (!(await box.first().isVisible().catch(() => false)) && (await searchTab.count())) { await tap(searchTab, "Search tab"); box = page.getByLabel("Search foods").or(page.getByPlaceholder(/^e\.g\. chicken/)); }
  await type(box, "banana", "search");
  const pick = page.getByRole("dialog").getByRole("button", { name: /^Banana\b/ });
  await pick.first().waitFor({ timeout: 15000 });
  await tap(pick, "pick Banana");
  await tap(page.getByRole("button", { name: /^Log food$/ }), "Log food");
  await page.getByText(/Added|Logged/i).first().waitFor({ timeout: 8000 }).catch(() => {});
  return "search path";
}
export async function j04({ page, tap }) {
  await tap(page.getByRole("button", { name: "Quick add" }), "Quick add");
  await tap(page.getByRole("link", { name: /Outdoor run/ }), "Outdoor run");
  await page.waitForURL(/\/run\/record/);
  const start = page.getByRole("button", { name: /^Start( run| walk| recording)?$/i });
  if (!(await vis(start))) {
    const free = page.getByRole("link", { name: /Log a run or walk by hand/ });
    if (await vis(free)) return "BLOCKED (Free): GPS is Pro; offered 'Log a run or walk by hand (free)' as the first action";
    const body = (await page.locator("main").innerText()).slice(0, 160).replace(/\s+/g, " "); return `BLOCKED: no Start button and no free path: ${body}`;
  }
  await tap(start, "Start");
  await page.getByRole("button", { name: /^Pause/i }).first().waitFor({ timeout: 10000 });
  // Clean up: discard the recording.
  await page.getByRole("button", { name: /^Pause/i }).first().click().catch(() => {});
  await page.getByRole("button", { name: /Discard|End without saving/i }).first().click().catch(() => {});
  await page.getByRole("button", { name: /^(Discard|Yes)/i }).last().click().catch(() => {});
  return "recording started";
}
export async function j05({ page, tap, type, tab }) {
  await tap(tab("Train"), "Train tab"); await page.waitForURL(/\/train$/); await page.getByRole("heading", { level: 1 }).waitFor();
  const run = page.locator('main a[href="/run"]').filter({ visible: true });
  if (!(await vis(run))) throw new Error("no Run link visible on Train");
  await tap(run, "Run"); await page.waitForURL(/\/run/);
  await tap(page.getByRole("link", { name: /Treadmill \/ Manual/i }).or(page.getByRole("tab", { name: /Treadmill \/ Manual/i })), "Treadmill / Manual");
  await tap(page.getByText("Treadmill", { exact: true }), "Treadmill");
  await type(page.getByLabel(/Distance/i), "3", "distance");
  await type(page.getByLabel(/^(Duration|Time|Minutes)/i), "30", "time");
  await tap(page.getByRole("button", { name: /^(Save|Log)/i }), "Save");
  await page.waitForTimeout(1500);
}
export async function j06({ page, tap }) {
  const direct = page.locator('main a[href="/progress/sleep"]').filter({ visible: true });
  if (await vis(direct)) { await tap(direct, "Home sleep link"); }
  else { await tap(page.locator('nav[data-hide-with-keyboard]').getByRole("link", { name: "You", exact: true }), "You tab"); await page.waitForURL(/\/profile$/); await page.getByRole("heading", { level: 1 }).waitFor(); await tap(page.locator('main a[href="/progress/sleep"]').filter({ visible: true }), "Sleep & Recovery"); }
  await page.waitForURL(/\/progress\/sleep$/); await page.getByRole("heading", { level: 1 }).waitFor();
}
export async function j07({ page, tap }) {
  const reachTap = (loc) => tap(loc, "consent checkbox");
  await j06({ page, tap });
  const enter = page.getByRole("link", { name: /Enter sleep by hand|Log (a )?night/i }).filter({ visible: true });
  if (!(await enter.count())) {
    const box = page.getByRole("checkbox", { name: /I agree to store my sleep/ });
    if (await box.count()) { await reachTap(box); await tap(page.getByRole("button", { name: /Allow sleep logging/ }), "Allow sleep logging"); await page.waitForTimeout(1500); }
  }
  await tap(page.getByRole("link", { name: /Enter sleep by hand|Log (a )?night/i }), "Enter sleep by hand");
  await page.waitForURL(/sleep\/log/);
  const save = page.getByRole("button", { name: /^(Save|Log)/i });
  await tap(save, "Save (defaults)");
  await page.waitForURL(/\/progress\/sleep(\/night|$)/, { timeout: 10000 }).catch(() => {});
  const err = (await page.locator('[role="alert"]:not(#__next-route-announcer__)').filter({ hasNotText: /Narrow Gate Fitness/ }).first().textContent({ timeout: 1500 }).catch(() => "")) ?? "";
  return err ? `alert: ${err.slice(0, 100)}` : "saved with the prefilled times";
}
export async function j08({ page, tap }) {
  const cont = page.getByRole("link", { name: /Continue reading|Today.s reading|Read( now)?$|Bible reading/i });
  if (await vis(cont)) await tap(cont, "Home reading link");
  else { await tap(page.locator('nav[data-hide-with-keyboard]').getByRole("link", { name: "Faith", exact: true }), "Faith tab"); await page.waitForURL(/\/faith$/); await page.getByRole("heading", { level: 1 }).waitFor(); await tap(page.getByRole("link", { name: /Continue reading|Read the Bible|^Read$/ }), "Continue reading"); }
  await page.waitForURL(/\/faith\/bible\/[a-z0-9-]+\/\d+/, { timeout: 8000 }).catch(() => {});
  return `landed on ${page.url().replace(/^https?:\/\/[^/]+/, "")}`;
}
export async function j09({ page, tap, type }) {
  await tap(page.getByRole("button", { name: "Quick add" }), "Quick add");
  await tap(page.getByRole("link", { name: /Prayer|Journal/i }), "Prayer");
  await type(page.getByRole("textbox").first(), "Thank you for today's strength.", "prayer text");
  await tap(page.getByRole("button", { name: /^Save/i }), "Save");
  await page.waitForURL(/\/faith\/journal(\/[0-9a-f-]+)?$/, { timeout: 10000 }).catch(() => {});
}
export async function j10({ page, tap }) {
  await tap(page.getByRole("link", { name: /AI Coach/ }), "AI Coach");
  await page.waitForURL(/\/coach/);
  const upsell = page.getByTestId("coach-upsell");
  if (await upsell.isVisible().catch(() => false)) return `BLOCKED (Free): one card with the price — ${(await page.getByTestId("coach-upsell-price").innerText().catch(() => "")).replace(/\s+/g, " ")}`;
  const prompt = page.locator("main").getByRole("button", { name: /\?$/ }).first();
  const text = (await prompt.textContent())?.trim();
  if (await prompt.isDisabled().catch(() => false)) { const why = (await page.locator("main").innerText()).match(/[^.\n]*(Pro|plan|limit|allowance)[^.\n]*/)?.[0]; return `BLOCKED: prompt "${text}" disabled — ${why ?? "no reason shown"}`; }
  await tap(prompt, `prompt "${text}"`);
  const send = page.getByRole("button", { name: "Send message" });
  if (await send.isEnabled().catch(() => false)) await tap(send, "Send");
  await page.getByTestId("coach-reply").last().waitFor({ timeout: 30000 });
  return `prompt: ${text}`;
}
export async function j11({ page, tap }) {
  await tap(page.locator('nav[data-hide-with-keyboard]').getByRole("link", { name: "You", exact: true }), "You tab"); await page.waitForURL(/\/profile$/); await page.getByRole("heading", { level: 1 }).waitFor();
  await tap(page.locator('main a[href="/profile/billing"]').filter({ visible: true }), "Plans & billing");
  await page.waitForURL(/\/profile\/billing/);
}
export async function j12({ page, tap }) {
  await tap(page.locator('nav[data-hide-with-keyboard]').getByRole("link", { name: "You", exact: true }), "You tab"); await page.waitForURL(/\/profile$/); await page.getByRole("heading", { level: 1 }).waitFor();
  await tap(page.locator('main a[href="/progress"]').filter({ visible: true }), "My Progress");
  await page.waitForURL(/\/progress$/);
}
export async function j13({ page, tap }) {
  await tap(page.locator('nav[data-hide-with-keyboard]').getByRole("link", { name: "Train", exact: true }), "Train tab"); await page.waitForURL(/\/train$/); await page.getByRole("heading", { level: 1 }).waitFor();
  await tap(page.locator('main a[href="/train/programs"]').filter({ visible: true }), "Programs");
  await page.waitForURL(/\/train\/programs$/);
}

export async function j14({ page, tap }) {
  await tap(page.getByRole("button", { name: "Quick add" }), "Quick add");
  const sleep = page.getByTestId("quick-add-sheet").getByRole("link", { name: "Sleep" });
  if (!(await sleep.count())) return "BLOCKED: no Sleep tile in Quick add";
  await tap(sleep, "Sleep");
  await page.waitForURL(/sleep\/log/);
  const box = page.getByRole("checkbox", { name: /I agree to store my sleep/ });
  if (await box.count()) { await tap(box, "consent checkbox"); await tap(page.getByRole("button", { name: /Allow sleep logging/ }), "Allow sleep logging"); await page.waitForTimeout(1200); }
  await tap(page.getByRole("button", { name: /^(Save|Log)/i }), "Save (defaults)");
  await page.waitForURL(/\/progress\/sleep(\/night|$)/, { timeout: 10000 }).catch(() => {});
  const err = (await page.locator('[role="alert"]:not(#__next-route-announcer__)').filter({ hasNotText: /Narrow Gate Fitness/ }).first().textContent({ timeout: 1500 }).catch(() => "")) ?? "";
  return err ? `alert: ${err.slice(0, 100)}` : "saved";
}
export async function j15({ page, tap, tab }) {
  await tap(tab("Nutrition"), "Nutrition tab"); await page.waitForURL(/\/nutrition/);
  const again = page.getByRole("button", { name: /^Add .+ again$/ }).filter({ visible: true });
  if (!(await again.count())) return "SKIPPED: nothing recent to re-log";
  await tap(again, "one-tap re-log");
  // Exactly "Undo" inside Recent foods: the water card's "Undo last water entry" is always on the page.
  const undo = page.getByTestId("quick-relog-section").getByRole("button", { name: "Undo", exact: true }).filter({ visible: true });
  // isVisible() does not wait; give the server its time to answer before deciding there is no Undo.
  if (!(await undo.first().waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false))) return "BLOCKED: no Undo after logging";
  await tap(undo, "Undo");
  await page.getByText(/^Undone/).first().waitFor({ timeout: 8000 });
  return "logged and undone";
}
