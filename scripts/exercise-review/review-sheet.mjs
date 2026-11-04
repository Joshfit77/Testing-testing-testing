/**
 * Builds the owner's visual review sheet for the 2D exercise demonstrations: one page with every catalog exercise
 * playing in the app's own player (same athlete, same controls, 0.5× and scrubbing), its six key positions as stills,
 * what the app currently shows for it (animation, pose frames or a placeholder), its written steps, cues, mistakes and
 * review notes, and an Approve / Needs work record per exercise that only the page's owner can write.
 *
 *   node scripts/exercise-review/review-sheet.mjs <out.html>
 *
 * Each decision is stored with the animation's fingerprint (scripts/exercise-review/fingerprint.mjs), so an approval
 * covers exactly the version that was reviewed: when the animation changes, the sheet asks for a new review. Nothing
 * here changes the app; approvals reach `ownerApproved` in src/data/exercise-demo-readiness.json only when the owner
 * asks for them to be copied there.
 */
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const out = resolve(process.argv[2] ?? "review-sheet.html");

const data = JSON.parse(execFileSync("npx", ["tsx", "--tsconfig", "tsconfig.json", join(here, "review-data.ts")], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
const tmp = mkdtempSync(join(tmpdir(), "review-sheet-"));
execFileSync("node", [join(here, "fingerprint.mjs"), `--out=${join(tmp, "fp.json")}`], { cwd: root, stdio: "ignore" });
const fp = JSON.parse(readFileSync(join(tmp, "fp.json"), "utf8"));
const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const dirty = execFileSync("git", ["status", "--porcelain", "--", "src/lib/exercise-motion", "src/data/exercise-motions.ts", "src/data/exercise-demo-readiness.json"], { cwd: root, encoding: "utf8" }).trim();
for (const r of data.rows) r.version = fp[r.slug]?.hash ?? "unknown";

const bundle = await build({
  entryPoints: [join(here, "review-sheet-entry.ts")],
  bundle: true,
  minify: true,
  format: "iife",
  globalName: "EM",
  write: false,
  platform: "browser",
  alias: { "@": resolve(root, "src") },
  logLevel: "silent",
});
const engine = bundle.outputFiles[0].text;
const today = new Date().toISOString().slice(0, 10);
const json = JSON.stringify({ ...data, commit: dirty ? `${commit}+local changes` : commit, generated: today }).replace(/</g, "\\u003c");

const html = `<title>2D Demo Review</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap">
<style>
/* Layout: one sticky control bar over a grid of exercise cards; each card is player, key positions, text, decision.
   Deliberately dark only: the app's black-and-gold look, so the athlete is judged on the background members see. */
:root {
  --bg: #070707; --surface: #131211; --surface-2: #1b1a18; --line: #2b2824;
  --text: #f6f4ef; --muted: #b3b0aa; --faint: #7d7973;
  --gold: #c9a54c; --gold-hi: #e2c477; --gold-lo: #8c6a2f;
  --ok: #6fbf8b; --warn: #d9a441; --bad: #e06c5a; --idle: #8a8780;
  --f-display: "Cinzel", "Trajan Pro", Georgia, serif;
  --f-head: "Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif;
  --f-body: "Inter", "Segoe UI", system-ui, sans-serif;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--text); font: 15px/1.5 var(--f-body); }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--bg); }
.wrap { max-width: 1320px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
header.top { padding-block: 28px 8px; }
h1 { font: 700 clamp(1.7rem, 4vw, 2.4rem)/1.1 var(--f-display); letter-spacing: .04em; margin: 0; color: var(--gold-hi); text-wrap: balance; }
.sub { color: var(--muted); margin: 6px 0 0; font-size: .92rem; }
.how { margin: 16px 0 0; max-width: 75ch; color: var(--text); }
.how li { margin: 4px 0; }
.summary { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 16px 0 0; font-variant-numeric: tabular-nums; }
.summary b { font: 700 1.25rem var(--f-head); }
.summary span { color: var(--muted); font-size: .85rem; display: block; }
.bar { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(6px); border-bottom: 1px solid var(--line); }
.bar .wrap { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; padding-block: 10px; }
.group { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.group > span { color: var(--faint); font-size: .72rem; text-transform: uppercase; letter-spacing: .08em; margin-right: 2px; }
.chip { font: 600 .82rem var(--f-head); color: var(--muted); background: var(--surface); border: 1px solid var(--line); border-radius: 999px; padding: 5px 11px; cursor: pointer; }
.chip[aria-pressed="true"] { color: #0b0a08; background: var(--gold); border-color: var(--gold); }
.chip:focus-visible, button:focus-visible, textarea:focus-visible, input:focus-visible, summary:focus-visible { outline: 2px solid var(--gold-hi); outline-offset: 2px; }
#q { flex: 1 1 200px; min-width: 0; background: var(--surface); color: var(--text); border: 1px solid var(--line); border-radius: 8px; padding: 7px 10px; font: inherit; }
.count { color: var(--muted); font-size: .85rem; font-variant-numeric: tabular-nums; }
main { padding-block: 18px 60px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); gap: 18px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; min-width: 0; }
.card[data-state="poses"] { border-color: color-mix(in srgb, var(--warn) 45%, var(--line)); }
.card[data-state="placeholder"] { border-color: color-mix(in srgb, var(--bad) 40%, var(--line)); }
.head { padding: 14px 14px 10px; display: grid; gap: 6px; }
.head h2 { margin: 0; font: 700 1.08rem/1.25 var(--f-head); text-wrap: balance; }
.meta { color: var(--muted); font-size: .8rem; }
.meta code { font: .78rem ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--faint); }
.pills { display: flex; flex-wrap: wrap; gap: 6px; }
.pill { font: 600 .74rem var(--f-head); border-radius: 6px; padding: 2px 8px; border: 1px solid currentColor; letter-spacing: .02em; }
.pill.tier { color: var(--gold); }
.pill.animated { color: var(--ok); }
.pill.poses { color: var(--warn); }
.pill.placeholder { color: var(--bad); }
.pill.d-approve { color: #0b0a08; background: var(--ok); border-color: var(--ok); }
.pill.d-needs-work { color: #0b0a08; background: var(--bad); border-color: var(--bad); }
.pill.d-none, .pill.d-stale { color: var(--idle); }
.stage-wrap { position: relative; background: #0a0a09; border-block: 1px solid var(--line); }
.stage { width: 100%; aspect-ratio: 4 / 3; max-width: 100%; position: relative; }
.ribbon { padding: 6px 12px; font: 600 .78rem var(--f-head); background: var(--surface-2); border-top: 1px solid var(--line); color: var(--warn); }
.card[data-state="placeholder"] .ribbon { color: var(--bad); }
.phases { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; padding: 8px 10px 4px; }
.phase { display: grid; gap: 2px; min-width: 0; }
.phase canvas { width: 100%; aspect-ratio: 4 / 3; background: #0a0a09; border-radius: 4px; display: block; }
.phase small { color: var(--faint); font-size: .62rem; text-align: center; line-height: 1.2; }
.body { padding: 8px 14px 4px; display: grid; gap: 6px; }
.shows { font-size: .82rem; color: var(--muted); margin: 0; }
.note { font-size: .82rem; margin: 0; padding: 7px 9px; border-radius: 8px; background: var(--surface-2); border-left: 3px solid var(--warn); }
details { border-top: 1px solid var(--line); padding-block: 6px; }
summary { cursor: pointer; font: 600 .84rem var(--f-head); color: var(--gold-hi); }
details ol, details ul { margin: 6px 0 4px; padding-left: 20px; font-size: .86rem; }
details li { margin: 3px 0; }
details h3 { font: 600 .75rem var(--f-head); text-transform: uppercase; letter-spacing: .08em; color: var(--faint); margin: 10px 0 0; }
.decision { margin-top: auto; padding: 10px 14px 14px; border-top: 1px solid var(--line); display: grid; gap: 8px; background: var(--surface-2); }
.choices { display: flex; gap: 8px; flex-wrap: wrap; }
.choice { flex: 1 1 120px; font: 700 .85rem var(--f-head); padding: 8px 10px; border-radius: 9px; border: 1px solid var(--line); background: var(--surface); color: var(--text); cursor: pointer; }
.choice[data-v="approve"][aria-pressed="true"] { background: var(--ok); border-color: var(--ok); color: #0b0a08; }
.choice[data-v="needs-work"][aria-pressed="true"] { background: var(--bad); border-color: var(--bad); color: #0b0a08; }
.decision textarea { width: 100%; min-height: 54px; resize: vertical; background: var(--surface); color: var(--text); border: 1px solid var(--line); border-radius: 8px; padding: 7px 9px; font: inherit; font-size: .88rem; }
.row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.save { font: 700 .85rem var(--f-head); background: var(--gold); color: #0b0a08; border: 0; border-radius: 9px; padding: 8px 16px; cursor: pointer; }
.save[disabled] { opacity: .5; cursor: default; }
.status { font-size: .8rem; color: var(--muted); }
.status.stale { color: var(--warn); }
.readonly { font-size: .82rem; color: var(--muted); margin: 0; }
footer { color: var(--faint); font-size: .8rem; padding-block: 0 40px; }
@media (max-width: 520px) { .phases { grid-template-columns: repeat(3, 1fr); } }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
</style>

<header class="top"><div class="wrap">
  <h1>2D Demo Review</h1>
  <p class="sub" id="sub">Narrow Gate Fitness · every exercise demonstration in the app</p>
  <ul class="how">
    <li>Each card plays the demonstration in the app's own player. Use <b>0.5×</b> to study each phase and drag on the figure to scrub.</li>
    <li>The six stills underneath are the key positions of one repetition, in order.</li>
    <li>The coloured label says what members see today: the animation, two pose frames, or a "demonstration in progress" box. Cards that are not shown in the app yet are marked on the player.</li>
    <li>Choose <b>Approve</b> only for a demonstration you would show members as it is, or <b>Needs work</b> with a short note. Each decision covers the exact animation you watched: if it changes later, the card asks you to look again.</li>
    <li>Nothing here changes the app. When you have finished, tell Claude which approvals to copy into the app's owner-approved list.</li>
  </ul>
  <div class="summary" id="summary"></div>
</div></header>

<div class="bar"><div class="wrap">
  <div class="group" role="group" aria-label="What the app shows"><span>App shows</span>
    <button class="chip" data-f="state" data-v="all" aria-pressed="true">All</button>
    <button class="chip" data-f="state" data-v="animated" aria-pressed="false">Animated</button>
    <button class="chip" data-f="state" data-v="poses" aria-pressed="false">Pose frames</button>
    <button class="chip" data-f="state" data-v="placeholder" aria-pressed="false">Placeholder</button>
  </div>
  <div class="group" role="group" aria-label="Launch priority"><span>Priority</span>
    <button class="chip" data-f="tier" data-v="all" aria-pressed="true">All</button>
    <button class="chip" data-f="tier" data-v="1" aria-pressed="false">Tier 1</button>
    <button class="chip" data-f="tier" data-v="2" aria-pressed="false">Tier 2</button>
    <button class="chip" data-f="tier" data-v="3" aria-pressed="false">Tier 3</button>
  </div>
  <div class="group" role="group" aria-label="Your decision"><span>Yours</span>
    <button class="chip" data-f="dec" data-v="all" aria-pressed="true">All</button>
    <button class="chip" data-f="dec" data-v="none" aria-pressed="false">Not reviewed</button>
    <button class="chip" data-f="dec" data-v="approve" aria-pressed="false">Approved</button>
    <button class="chip" data-f="dec" data-v="needs-work" aria-pressed="false">Needs work</button>
  </div>
  <input id="q" type="search" placeholder="Search exercises" aria-label="Search exercises">
  <span class="count" id="count"></span>
</div></div>

<main><div class="wrap"><div class="grid" id="grid"></div></div></main>
<footer><div class="wrap" id="foot"></div></footer>

<script type="application/json" id="data">${json}</script>
<script>${engine}</script>
<script>
(() => {
  const DATA = JSON.parse(document.getElementById("data").textContent);
  const ROWS = DATA.rows;
  const PHASES = [["Start", 0], ["Early", 1 / 6], ["Middle", 2 / 6], ["Deepest / peak", 3 / 6], ["Return", 4 / 6], ["End", 5 / 6]];
  const STATE = { animated: "Animated", poses: "Pose frames", placeholder: "Placeholder" };
  const SHOWS = {
    animated: "The app shows this animation.",
    poses: "The app shows two still pose frames (start and mid-rep), labelled “animation in progress”. The animation above is not shown to members yet.",
    placeholder: "The app shows a “demonstration in progress” box with the written steps. The animation above is not shown to members yet.",
  };
  const RIBBON = { poses: "In progress · members see pose frames", placeholder: "In progress · members see a placeholder" };
  const filters = { state: "all", tier: "all", dec: "all", q: "" };
  try { Object.assign(filters, JSON.parse(localStorage.getItem("review-filters") || "{}"), { q: "" }); } catch { /* storage unavailable */ }
  let decisions = {};
  let db = null;
  let canWrite = false;
  const cards = new Map();
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else n.setAttribute(k, v);
    }
    for (const k of kids) if (k) n.append(k);
    return n;
  };

  document.getElementById("sub").textContent = "Narrow Gate Fitness · " + ROWS.length + " exercise demonstrations · built " + DATA.generated + " from " + DATA.commit;
  document.getElementById("foot").textContent = "Engineering review (" + (DATA.reviewed || "not dated") + "): " + (DATA.method || "") + " Owner approval is separate and only you can record it.";

  const decisionOf = (r) => {
    const d = decisions[r.slug];
    if (!d) return { kind: "none" };
    if (d.version !== r.version) return { kind: "stale", d };
    return { kind: d.decision, d };
  };

  function card(r) {
    const hl = EM.highlightFor(r.primary, r.secondary);
    const stage = el("div", { class: "stage", role: "img", "aria-label": r.name + ": " + r.motionLabel });
    const stageWrap = el("div", { class: "stage-wrap" }, stage, RIBBON[r.readiness] ? el("div", { class: "ribbon", text: RIBBON[r.readiness] }) : null);
    const phases = el("div", { class: "phases", "aria-label": "Key positions of one repetition" });
    for (const [name] of PHASES) phases.append(el("div", { class: "phase" }, el("canvas", { "aria-hidden": "true" }), el("small", { text: name })));
    const decPill = el("span", { class: "pill d-none", text: "Not reviewed" });
    const head = el("div", { class: "head" },
      el("h2", { text: r.name }),
      el("div", { class: "meta" }, el("code", { text: r.slug }), document.createTextNode(" · " + (r.programs ? "in " + r.programs + " program" + (r.programs === 1 ? "" : "s") + " (" + r.groups + ")" : "library only") + " · " + (r.view === "front" ? "front view" : "side view"))),
      el("div", { class: "pills" }, el("span", { class: "pill tier", text: "Tier " + r.tier }), el("span", { class: "pill " + r.readiness, text: "App shows: " + STATE[r.readiness] }), decPill));
    const body = el("div", { class: "body" }, el("p", { class: "shows", text: SHOWS[r.readiness] }), r.note ? el("p", { class: "note", text: "Known limitation: " + r.note } ) : null);
    const det = el("details", {}, el("summary", { text: "How to do it, cues and common mistakes" }));
    const list = (title, items, ordered) => { if (!items.length) return; det.append(el("h3", { text: title })); const l = el(ordered ? "ol" : "ul"); for (const t of items) l.append(el("li", { text: t })); det.append(l); };
    list("How to do it", r.instructions, true);
    list("Form cues", r.cues, false);
    list("Common mistakes", r.mistakes, false);
    body.append(det);

    const approve = el("button", { class: "choice", type: "button", "data-v": "approve", "aria-pressed": "false", text: "Approve" });
    const needs = el("button", { class: "choice", type: "button", "data-v": "needs-work", "aria-pressed": "false", text: "Needs work" });
    const noteId = "note-" + r.slug;
    const note = el("textarea", { id: noteId, placeholder: "What should change? (optional for Approve)", "aria-label": "Note for " + r.name });
    const save = el("button", { class: "save", type: "button", text: "Save decision", disabled: "" });
    const status = el("span", { class: "status", role: "status" });
    const ro = el("p", { class: "readonly", text: "Decisions load when the page is open in your Claude account." });
    const form = el("div", { class: "decision" }, el("div", { class: "choices" }, approve, needs), note, el("div", { class: "row" }, save, status), ro);
    let pick = null;
    const setPick = (v) => { pick = v; approve.setAttribute("aria-pressed", String(v === "approve")); needs.setAttribute("aria-pressed", String(v === "needs-work")); save.disabled = !canWrite || !pick; };
    approve.addEventListener("click", () => setPick("approve"));
    needs.addEventListener("click", () => setPick("needs-work"));
    save.addEventListener("click", async () => {
      if (!db || !canWrite || !pick) return;
      if (pick === "needs-work" && !note.value.trim()) { status.textContent = "Add a short note about what should change."; note.focus(); return; }
      save.disabled = true; status.textContent = "Saving…";
      try {
        await db.doc("decisions/" + r.slug).set({ decision: pick, note: note.value.trim().slice(0, 1000), version: r.version, name: r.name, state: r.readiness, at: new Date().toISOString() });
        status.textContent = "Saved.";
      } catch (e) {
        status.textContent = e && e.code === "invalid_argument" ? "Only the owner of this page can record decisions." : "Couldn't save. Try again.";
        save.disabled = false;
      }
    });
    const c = el("article", { class: "card", "data-state": r.readiness, "data-slug": r.slug }, head, stageWrap, phases, body, form);
    cards.set(r.slug, { r, c, stage, phases, hl, decPill, status, ro, setPick, note, save, ctrl: null, drawn: false });
    return c;
  }

  const grid = document.getElementById("grid");
  for (const r of ROWS) grid.append(card(r));

  // Players run only while their card is on screen; the stills are drawn once, when first near the screen.
  const playIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const k = cards.get(e.target.dataset.slug);
      if (e.isIntersecting && !k.ctrl) {
        k.ctrl = EM.mountExerciseMotion(k.stage, k.r.slug, { style: "athlete", highlight: k.hl, controls: true, controlsInset: 64, badge: k.r.readiness === "animated" ? "Animated demo" : "Work in progress", meta: { slug: k.r.slug, name: k.r.name }, label: k.r.name + ". " + k.r.motionLabel });
      } else if (!e.isIntersecting && k.ctrl) {
        k.ctrl.destroy(); k.ctrl = null; k.stage.replaceChildren();
      }
    }
  }, { rootMargin: "120px 0px" });
  const stillIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const k = cards.get(e.target.dataset.slug);
      if (k.drawn) continue;
      k.drawn = true;
      const canvases = k.phases.querySelectorAll("canvas");
      PHASES.forEach(([, phase], i) => EM.drawExerciseStill(canvases[i], k.r.slug, { phase, width: 120, height: 90, style: "athlete", highlight: k.hl }));
      stillIO.unobserve(e.target);
    }
  }, { rootMargin: "600px 0px" });
  for (const { c } of cards.values()) { playIO.observe(c); stillIO.observe(c); }

  function refresh() {
    const counts = { approve: 0, "needs-work": 0, stale: 0, none: 0 };
    for (const k of cards.values()) {
      const d = decisionOf(k.r);
      counts[d.kind] = (counts[d.kind] || 0) + 1;
      k.decPill.className = "pill d-" + d.kind;
      k.decPill.textContent = d.kind === "approve" ? "You approved" : d.kind === "needs-work" ? "You: needs work" : d.kind === "stale" ? "Changed since your review" : "Not reviewed";
      if (d.d && !k.status.textContent.startsWith("Saving")) {
        const when = new Date(d.d.at).toLocaleDateString();
        k.status.className = "status" + (d.kind === "stale" ? " stale" : "");
        k.status.textContent = d.kind === "stale" ? "You reviewed an earlier version on " + when + ". Please look again." : "Recorded " + when + ".";
        if (d.kind !== "stale" && !k.note.matches(":focus")) { k.setPick(d.d.decision); k.note.value = d.d.note || ""; }
      }
      k.ro.hidden = canWrite;
      if (!canWrite) k.save.disabled = true;
    }
    const st = (s) => ROWS.filter((r) => r.readiness === s).length;
    const sum = document.getElementById("summary");
    sum.replaceChildren(...[[st("animated"), "animated in the app"], [st("poses"), "pose frames"], [st("placeholder"), "placeholders"], [counts.approve, "you approved"], [counts["needs-work"], "need work"], [counts.none + counts.stale, "not reviewed yet"]].map(([n, t]) => el("div", {}, el("b", { text: String(n) }), el("span", { text: t }))));
    applyFilters();
  }

  function applyFilters() {
    let shown = 0;
    const q = filters.q.trim().toLowerCase();
    for (const k of cards.values()) {
      const d = decisionOf(k.r).kind;
      const ok = (filters.state === "all" || k.r.readiness === filters.state) && (filters.tier === "all" || String(k.r.tier) === filters.tier) &&
        (filters.dec === "all" || (filters.dec === "none" ? d === "none" || d === "stale" : d === filters.dec)) &&
        (!q || k.r.name.toLowerCase().includes(q) || k.r.slug.includes(q));
      k.c.hidden = !ok;
      if (ok) shown++;
    }
    document.getElementById("count").textContent = shown + " of " + ROWS.length + " shown";
    for (const b of document.querySelectorAll(".chip")) b.setAttribute("aria-pressed", String(filters[b.dataset.f] === b.dataset.v));
    try { localStorage.setItem("review-filters", JSON.stringify({ state: filters.state, tier: filters.tier, dec: filters.dec })); } catch { /* storage unavailable */ }
  }
  for (const b of document.querySelectorAll(".chip")) b.addEventListener("click", () => { filters[b.dataset.f] = b.dataset.v; applyFilters(); });
  document.getElementById("q").addEventListener("input", (e) => { filters.q = e.target.value; applyFilters(); });
  refresh();

  // Decisions: the page's shared store, written only by the page's owner (declared rule), read live.
  (async () => {
    if (!window.claude || !window.claude.use) return;
    const [store, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
    if (!store) return;
    db = store;
    canWrite = user ? await user.isOwner() : false;
    for (const k of cards.values()) { k.ro.textContent = "Only the owner of this page can record decisions."; k.save.disabled = !canWrite; }
    db.collection("decisions").onSnapshot((snap) => {
      decisions = {};
      for (const d of snap.docs) if (d.exists) decisions[d.id] = d.data();
      refresh();
    }, () => { for (const k of cards.values()) k.ro.textContent = "Decisions couldn't be loaded right now. Reload the page to try again."; });
    refresh();
  })();
})();
</script>
`;
writeFileSync(out, html);
console.log(`${out}: ${ROWS_SUMMARY(data.rows)}; ${(html.length / 1024).toFixed(0)} KB`);

function ROWS_SUMMARY(rows) {
  const c = (s) => rows.filter((r) => r.readiness === s).length;
  return `${rows.length} exercises (animated ${c("animated")}, pose frames ${c("poses")}, placeholder ${c("placeholder")})`;
}
