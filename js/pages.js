// Page-specific behaviour. Each page sets <body data-page="..."> to pick its initializer.

const params = new URLSearchParams(location.search);
const $ = (sel, root = document) => root.querySelector(sel);

const CATEGORY_ICONS = {
  calming: "leaf", sleep: "moon", digestion: "cup", immunity: "shield", respiratory: "leaf",
  skin: "drop", heart: "heart", energy: "sun", women: "leaf", men: "leaf", aches: "leaf", kitchen: "pot"
};


// Which medicines and health situations flag this herb ("chamomile") or fruit ("fruit:apple").
function interactionsFor(key) {
  const out = [];
  INTERACTIONS.forEach((entry) => {
    if (entry.avoid[key]) out.push({ entry, level: "avoid", note: entry.avoid[key] });
    else if (entry.caution[key]) out.push({ entry, level: "caution", note: entry.caution[key] });
  });
  return out;
}

function interactionList(key) {
  const hits = interactionsFor(key);
  if (!hits.length) return `<p class="muted">No major interactions are listed for this in our checker. Always tell your doctor and pharmacist about everything you take.</p>`;
  return `<ul class="ix-list">${hits.map((x) => `<li class="ix-${x.level}"><span class="ix-badge">${x.level === "avoid" ? "Avoid" : "Caution"}</span><span><strong>${x.entry.label}</strong> — ${x.note}</span></li>`).join("")}</ul>`;
}

function buyingTips(name) {
  return `<div class="buy-card">
    <h3>Buying tips</h3>
    <ul class="check-list">
      <li>${icon("check")}Look for the Latin name on the label so you know you're getting the right plant.</li>
      <li>${icon("check")}Choose products with third-party testing seals such as USP, NSF or ConsumerLab.</li>
      <li>${icon("check")}For dried herbs, choose organic, fragrant and brightly colored material; store away from light and heat.</li>
      <li>${icon("check")}For extracts, check that the label lists the standardization (for example, "5% withanolides").</li>
    </ul>
    ${SITE.shop && SITE.shop[name] ? `<a class="btn btn-primary" href="${SITE.shop[name]}" target="_blank" rel="sponsored noopener">Shop recommended ${name}</a>` : ""}
  </div>`;
}

function stackCard(st) {
  return `<article class="stack-card">
    <a href="stacks.html?s=${st.id}">
      <div class="stack-photos">
        <div class="sp-main">${visual(findHerb(st.herbs[0].id))}</div>
        <div class="sp-side">${st.herbs.slice(1, 4).map((x) => visual(findHerb(x.id))).join("")}</div>
      </div>
      <div class="stack-body">
        <p class="eyebrow">${STACK_GROUPS[st.group]}</p>
        <h3>${st.name}</h3>
        <p>${st.tagline}</p>
        <p class="stack-herbs">${st.herbs.map((x) => findHerb(x.id).name.split(" (")[0]).join(" · ")}</p>
      </div>
    </a>
  </article>`;
}

/* ---------------- Home ---------------- */
function initHome() {
  attachSearch($("#hero-search"), $("#hero-suggest"));

  const paths = [
    { href: "foods.html", photo: "foods-board", title: "Foods", kicker: "The foundation", text: "Real, everyday foods — what they offer, how much to eat and when to eat them.", cta: "Explore foods" },
    { href: "remedies.html", photo: "remedy-tea", title: "Natural Remedies", kicker: "From the kitchen", text: "Gentle teas, soaks and home remedies with clear amounts and safety.", cta: "Find a remedy" },
    { href: "herbs.html", photo: "herb-basket", title: "Herbs", kicker: "A supporting role", text: "Time-honored herbs as a supporting role — with research and doses.", cta: "Meet the herbs" }
  ];
  // Three paths: one large feature beside a stack of two (css/site.css .paths-grid)
  const pathCard = (p, i, cls) => `<a class="${cls}" href="${p.href}">
    <img src="${sceneUrl(p.photo, i ? 900 : 1400)}" srcset="${sceneSrcset(p.photo)}" sizes="${i ? "(max-width: 900px) 92vw, 34vw" : "(max-width: 900px) 92vw, 56vw"}" alt="${SCENES[p.photo][1]}" loading="lazy" decoding="async" data-credit="Photo: ${SCENES[p.photo][2]} / Unsplash">
    <div class="path-content"><p class="eyebrow">0${i + 1} · ${p.kicker}</p><h3>${p.title}</h3><p>${p.text}</p><span class="path-cta">${p.cta} ${icon("arrow")}</span></div>
  </a>`;
  $("#art-paths").innerHTML = pathCard(paths[0], 0, "path-feature") + `<div class="path-stack">${paths.slice(1).map((p, i) => pathCard(p, i + 1, "path-small")).join("")}</div>`;

}

/* ---------------- Herb library ---------------- */
function initHerbs() {
  const PAGE = 24;
  const state = {
    q: params.get("q") || "",
    cat: params.get("cat") || "all",
    part: "all",
    sort: "az",
    letter: "",
    saved: params.get("saved") === "1",
    shown: PAGE
  };

  const search = $("#herb-search"), catSel = $("#cat-filter"), partSel = $("#part-filter"), sortSel = $("#sort");
  const savedBox = $("#saved-only"), grid = $("#herb-grid"), count = $("#result-count"), more = $("#load-more");

  catSel.innerHTML = `<option value="all">All categories</option>` +
    Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  const parts = [...new Set(HERBS.map((h) => h.part))].sort();
  partSel.innerHTML = `<option value="all">Any part used</option>` +
    parts.map((p) => `<option value="${p}">${p[0].toUpperCase() + p.slice(1)}</option>`).join("");

  search.value = state.q;
  catSel.value = CATEGORIES[state.cat] ? state.cat : "all";
  savedBox.checked = state.saved;

  if (state.cat !== "all" && CATEGORIES[state.cat]) {
    $("#page-title").textContent = CATEGORIES[state.cat];
    $("#crumb-current").textContent = CATEGORIES[state.cat];
  }

  const letters = [...new Set(HERBS.map((h) => h.name[0].toUpperCase()))].sort();
  $("#az").innerHTML = `<button class="az-btn active" data-letter="">All</button>` +
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) =>
      `<button class="az-btn" data-letter="${l}" ${letters.includes(l) ? "" : "disabled"}>${l}</button>`).join("");

  function results() {
    let list = state.q.trim() ? searchHerbs(state.q.trim()) : [...HERBS];
    if (state.cat !== "all") list = list.filter((h) => h.cats.includes(state.cat));
    if (state.part !== "all") list = list.filter((h) => h.part === state.part);
    if (state.letter) list = list.filter((h) => h.name[0].toUpperCase() === state.letter);
    if (state.saved) { const fav = favorites.all(); list = list.filter((h) => fav.includes(h.id)); }
    if (!state.q.trim() || state.sort !== "az") {
      list.sort((a, b) => a.name.localeCompare(b.name));
      if (state.sort === "za") list.reverse();
    }
    return list;
  }

  function render() {
    const list = results();
    grid.innerHTML = list.slice(0, state.shown).map(herbCard).join("");
    count.textContent = `${list.length} ${list.length === 1 ? "herb" : "herbs"}`;
    more.hidden = list.length <= state.shown;
    $("#no-results").hidden = list.length > 0;
    $("#no-results-text").textContent = state.saved && !favorites.all().length
      ? "You haven't saved any herbs yet. Tap the heart on any herb to save it here."
      : "No herbs match those filters. Try a different search or category.";
  }

  const reset = () => { state.shown = PAGE; render(); };
  search.addEventListener("input", () => { state.q = search.value; reset(); });
  catSel.addEventListener("change", () => { state.cat = catSel.value; reset(); });
  partSel.addEventListener("change", () => { state.part = partSel.value; reset(); });
  sortSel.addEventListener("change", () => { state.sort = sortSel.value; reset(); });
  savedBox.addEventListener("change", () => { state.saved = savedBox.checked; reset(); });
  $("#az").addEventListener("click", (e) => {
    const b = e.target.closest(".az-btn");
    if (!b || b.disabled) return;
    state.letter = b.dataset.letter;
    document.querySelectorAll(".az-btn").forEach((x) => x.classList.toggle("active", x === b));
    reset();
  });
  more.addEventListener("click", () => { state.shown += PAGE; render(); });
  $("#clear-filters").addEventListener("click", () => {
    Object.assign(state, { q: "", cat: "all", part: "all", letter: "", saved: false });
    search.value = ""; catSel.value = "all"; partSel.value = "all"; savedBox.checked = false;
    document.querySelectorAll(".az-btn").forEach((x) => x.classList.toggle("active", !x.dataset.letter));
    reset();
  });
  document.addEventListener("favorites-changed", () => { if (state.saved) render(); });
  render();
}

/* ---------------- Dose formatting ---------------- */
const OZ = 28.3495;
function sig(n) {
  if (n >= 100) return Math.round(n).toLocaleString("en-US");
  if (n >= 10) return String(Math.round(n * 10) / 10);
  return String(Number(n.toPrecision(2)));
}
function range(a, b, unit) {
  return a === b ? `${sig(a)} ${unit}` : `${sig(a)}–${sig(b)} ${unit}`;
}
// Grams → "300 mg · 0.3 g · 0.011 oz"
function amountUnits(min, max) {
  return `<span class="u"><b>${range(min * 1000, max * 1000, "mg")}</b></span><span class="u">${range(min, max, "g")}</span><span class="u">${range(min / OZ, max / OZ, "oz")}</span>`;
}

function quickDoses(h) {
  const c = CAPS[h.id];
  if (!c) return "";
  const capHtml = typeof c.cap === "string"
    ? `<p class="qd-none">${c.cap}</p>`
    : `<p class="qd-amount">${range(c.cap[0], c.cap[1], "mg")}</p>
       <p class="qd-units">${range(c.cap[0] / 1000, c.cap[1] / 1000, "g")} · ${range(c.cap[0] / 1000 / OZ, c.cap[1] / 1000 / OZ, "oz")}</p>
       <p class="qd-what">${c.cap[2]}</p>
       <p class="qd-freq">${icon("check")}${c.cap[3]}</p>`;
  let herbHtml;
  if (!c.herb) herbHtml = `<p class="qd-none">For use on the skin only — do not swallow.</p>`;
  else if (typeof c.herb[0] === "string") herbHtml = `<p class="qd-amount qd-text">${c.herb[0]}</p><p class="qd-what">${c.herb[2]}</p>${c.herb[3] ? `<p class="qd-freq">${icon("check")}${c.herb[3]}</p>` : ""}`;
  else herbHtml = `<p class="qd-amount">${range(c.herb[0], c.herb[1], "g")}</p>
       <p class="qd-units">${range(c.herb[0] * 1000, c.herb[1] * 1000, "mg")} · ${range(c.herb[0] / OZ, c.herb[1] / OZ, "oz")}</p>
       <p class="qd-what">${c.herb[2]}</p>
       <p class="qd-freq">${icon("check")}${c.herb[3]}</p>`;
  return `<div class="quick-doses">
    <div class="qd-card">
      <div class="qd-head"><span class="qd-icon">${icon("shield")}</span><div><p class="eyebrow">Capsule form</p><p class="qd-per">Per person · 100 lb and over</p></div></div>
      ${capHtml}
    </div>
    <div class="qd-card">
      <div class="qd-head"><span class="qd-icon">${icon("leaf")}</span><div><p class="eyebrow">The herb by itself</p><p class="qd-per">Per person · 100 lb and over</p></div></div>
      ${herbHtml}
    </div>
  </div>`;
}

function doseSection(h, ph) {
  const rows = ph.dose.map(([form, min, max, freq]) => `
    <tr>
      <th scope="row">${form}</th>
      <td class="units">${typeof min === "string" ? `<span class="u"><b>${min}</b></span>` : amountUnits(min, max)}</td>
      <td>${freq}</td>
    </tr>`).join("");
  return `<section id="dose"><h2>How much to take</h2>
    ${quickDoses(h)}
    ${ph.ext ? `<div class="caution-card ext-card">${icon("shield", "icon info-icon")}<p><strong>For use on the skin only — do not swallow.</strong></p></div>` : ""}
    <div class="dose-card">
      <div class="dose-head">
        <div><p class="eyebrow">Every form in detail</p><h3>For adults 100 lb (45 kg) and over</h3></div>
        <span class="dose-badge">Per serving</span>
      </div>
      <div class="table-wrap"><table class="dose-table">
        <thead><tr><th>How it's taken</th><th>Amount (mg · g · oz)</th><th>How often</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      ${ph.daily ? `<p class="dose-daily"><span>Usual daily total</span>${amountUnits(ph.daily[0], ph.daily[1])}</p>` : ""}
      ${ph.limit ? `<p class="dose-limit">${icon("check")}${ph.limit}</p>` : ""}
    </div>
    <details class="evidence-key dose-notes"><summary>How to read these amounts</summary>
      <ul>
        <li>These are typical adult amounts from traditional herbal references (such as the German Commission E and ESCOP monographs) and the doses used in clinical studies.</li>
        <li><strong>"Per person, 100 lb and over" means one adult serving.</strong> Herbal doses are not multiplied by body weight — the same adult dose applies whether you weigh 100 lb or 250 lb, and taking more because you weigh more can be unsafe.</li>
        <li>Capsule amounts are what each dose should contain, as listed on the supplement label (often 1–2 capsules). Check the label: if it gives a lower "per capsule" amount, you may need two.</li>
        <li>Not for children or anyone under 100 lb unless a doctor or qualified herbalist advises a child's dose.</li>
        <li>Start at the low end, take one new herb at a time, and stop if you notice side effects.</li>
        <li>For reference: 1 teaspoon of dried leaf or flower weighs roughly 1–2 g; 1 teaspoon of seeds or powder roughly 2–3 g; 1 ounce = 28.35 g = 28,350 mg.</li>
      </ul>
    </details>
  </section>`;
}

/* ---------------- Single herb ---------------- */
function initHerb() {
  // Old links (herb.html?id=…) forward to the herb's own page.
  if (!document.body.dataset.id && params.get("id") && findHerb(params.get("id"))) {
    location.replace(herbUrl(params.get("id")));
    return;
  }
  const h = findHerb(document.body.dataset.id || params.get("id"));
  const main = $("#herb-main");
  if (!h) {
    main.innerHTML = `<section class="section"><div class="container narrow center">
      <h1>Herb not found</h1><p class="lead">We couldn't find that herb. It may have moved.</p>
      <a class="btn btn-primary" href="herbs.html">Browse the herb library</a></div></section>`;
    return;
  }
  document.title = `${h.name} (${h.latin}) — Beauty & Praise`;

  const sorted = [...HERBS].sort((a, b) => a.name.localeCompare(b.name));
  const idx = sorted.indexOf(h);
  const prev = sorted[(idx - 1 + sorted.length) % sorted.length];
  const next = sorted[(idx + 1) % sorted.length];
  const related = HERBS.filter((x) => x !== h && x.cats.some((c) => h.cats.includes(c)))
    .sort((a, b) => b.cats.filter((c) => h.cats.includes(c)).length - a.cats.filter((c) => h.cats.includes(c)).length)
    .slice(0, 4);
  const saved = favorites.has(h.id);
  const partLabel = h.part[0].toUpperCase() + h.part.slice(1);
  const ph = PHARM[h.id];
  const inStacks = STACKS.filter((st) => st.herbs.some((x) => x.id === h.id));

  main.innerHTML = `
    <section class="herb-hero">
      <div class="container">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><a href="herbs.html">Herb Library</a><span>/</span><span aria-current="page">${h.name}</span></nav>
        <div class="herb-hero-grid">
          <figure class="herb-hero-figure">
            <div class="herb-hero-art arch">${visual(h, true)}</div>
            <figcaption class="photo-credit" id="photo-credit"></figcaption>
          </figure>
          <div class="herb-hero-copy">
            <div class="tag-row">${h.cats.map((c) => `<a class="tag" href="herbs.html?cat=${c}">${CATEGORIES[c]}</a>`).join("")}</div>
            <h1>${h.name}</h1>
            <p class="latin big">${h.latin}</p>
            <p class="lead">${h.summary}</p>
            <dl class="facts">
              <div><dt>Botanical family</dt><dd>${h.family}</dd></div>
              <div><dt>Part used</dt><dd>${partLabel}</dd></div>
              <div><dt>Flavor &amp; aroma</dt><dd>${h.flavor}</dd></div>
            </dl>
            <div class="herb-actions">
              <button class="btn btn-primary fav-inline${saved ? " saved" : ""}" data-fav="${h.id}" aria-pressed="${saved}">${icon("heart")}<span>Save herb</span></button>
              <button class="btn btn-secondary" onclick="window.print()">${icon("print")}<span>Print profile</span></button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container herb-layout">
        <aside class="toc">
          <p class="eyebrow">On this page</p>
          <ul>
            <li><a href="#glance">Benefits at a glance</a></li>
            <li><a href="#overview">Overview</a></li>
            <li><a href="#scripture">Scripture</a></li>
            <li><a href="#body">What it does in your body</a></li>
            <li><a href="#chemistry">How it works chemically</a></li>
            <li><a href="#benefits">Benefits explained</a></li>
            <li><a href="#dose">How much to take</a></li>
            <li><a href="#uses">Traditional uses</a></li>
            <li><a href="#prepare">How to prepare</a></li>
            <li><a href="#grow">Growing &amp; harvesting</a></li>
            <li><a href="#safety">Safety &amp; cautions</a></li>
          </ul>
        </aside>
        <article class="prose">
          <section id="glance" class="glance">
            <p class="eyebrow">Benefits at a glance</p>
            <p class="glance-text">${SUMMARY[h.id]}</p>
          </section>
          <section id="overview"><h2>Overview</h2><p>${h.about}</p></section>
          ${scriptureCard("herb", h)}
          <section id="body"><h2>What it does in your body</h2>
            <div class="body-grid">${ph.body.map(([sys, txt]) => `<div class="body-item"><p class="eyebrow">${sys}</p><p>${txt}</p></div>`).join("")}</div>
          </section>
          <section id="chemistry"><h2>How it works chemically</h2>
            <p class="muted">The active compounds in ${h.name.split(" (")[0].toLowerCase()}, what kind of molecule each one is, and what it does in the body.</p>
            <div class="chem-list">${ph.chem.map(([c, type, how]) => `
              <div class="chem">
                <div class="chem-name"><strong>${c}</strong><span>${type}</span></div>
                <p>${how}</p>
              </div>`).join("")}
            </div>
          </section>
          <section id="benefits"><h2>Benefits explained</h2>
            <p class="muted">What ${h.name.split(" (")[0].toLowerCase()} may do for you, how it works, and how strong the evidence is.</p>
            <div class="benefit-list">${(BENEFITS[h.id] || []).map(([e, t, d]) => `
              <div class="benefit">
                <div class="benefit-head"><h3>${t}</h3><span class="evidence ev-${e}" title="${EVIDENCE[e].note}">${EVIDENCE[e].label}</span></div>
                <p>${d}</p>
              </div>`).join("")}
            </div>
            <details class="evidence-key"><summary>What do the evidence labels mean?</summary>
              <ul>${Object.entries(EVIDENCE).map(([k, v]) => `<li><span class="evidence ev-${k}">${v.label}</span> ${v.note}</li>`).join("")}</ul>
            </details>
          </section>
          ${doseSection(h, ph)}
          ${inStacks.length ? `<section id="stacks"><h2>Found in these herbal stacks</h2>
            <div class="stack-mini-list">${inStacks.map((st) => `<a class="stack-mini" href="stacks.html?s=${st.id}"><span class="stack-mini-photos">${st.herbs.slice(0, 3).map((x) => `<span class="mini-art">${visual(findHerb(x.id))}</span>`).join("")}</span><span><strong>${st.name}</strong><em>${st.herbs.find((x) => x.id === h.id).role}</em></span></a>`).join("")}</div>
          </section>` : ""}
          <section id="uses"><h2>Traditional uses</h2>
            <ul class="check-list">${h.uses.map((u) => `<li>${icon("check")}${u}</li>`).join("")}</ul>
          </section>
          <section id="prepare"><h2>How to prepare</h2>
            <div class="info-card">${icon("cup", "icon info-icon")}<p>${h.prep}</p></div>
          </section>
          <section id="grow"><h2>Growing &amp; harvesting</h2>
            <div class="info-card">${icon("pot", "icon info-icon")}<p>${h.grow}</p></div>
          </section>
          <section id="safety"><h2>Safety &amp; cautions</h2>
            <div class="caution-card">${icon("shield", "icon info-icon")}
              <div><p>${h.caution}</p>
              <p class="small">This profile is for general education and is not medical advice. Talk with your doctor or pharmacist before using herbs medicinally, especially if you are pregnant, breastfeeding, taking medicine or caring for a child.</p></div>
            </div>
            <h3 class="ix-title">Medicines &amp; health situations to watch</h3>
            ${interactionList(h.id)}
            <a class="text-link" href="interactions.html?item=${h.id}">Check with your medicines ${icon("arrow")}</a>
          </section>
          <section id="buying">${buyingTips(h.id)}</section>
        </article>
      </div>
    </section>

    <section class="section section--cream section-tint">
      <div class="container">
        <div class="section-head"><div><p class="eyebrow">Keep exploring</p><h2>Related herbs</h2></div>
          <a class="text-link" href="herbs.html?cat=${h.cats[0]}">More ${CATEGORIES[h.cats[0]]} ${icon("arrow")}</a></div>
        <div class="herb-grid editorial-grid">${related.map(herbCard).join("")}</div>
        <nav class="prev-next">
          <a href="${herbUrl(prev.id)}"><span>← Previous</span><strong>${prev.name}</strong></a>
          <a href="${herbUrl(next.id)}"><span>Next →</span><strong>${next.name}</strong></a>
        </nav>
      </div>
    </section>`;

  Photos.credit(h.id).then((c) => {
    const el = $("#photo-credit");
    if (!c || !el) return;
    if (c.text) { el.textContent = c.text; return; }
    el.innerHTML = `Photo: <span></span> · <a target="_blank" rel="noopener"></a>`;
    el.querySelector("span").textContent = c.artist;
    const a = el.querySelector("a");
    a.href = c.url;
    a.textContent = c.license ? `${c.license} via Wikimedia Commons` : "Wikimedia Commons";
  });
}

/* ---------------- Healthy living ---------------- */
function initLiving() {
  const today = todayKey();

  // Reminder of the moment
  const tipText = $("#tip-text");
  const TIPS = [...REMINDERS, ...BODY_REMINDERS.map((r) => r[1])];
  let tip = Math.floor(Math.random() * TIPS.length);
  const showTip = () => {
    tipText.classList.remove("fade");
    void tipText.offsetWidth;
    tipText.textContent = TIPS[tip];
    tipText.classList.add("fade");
  };
  $("#next-tip").addEventListener("click", () => { tip = (tip + 1) % TIPS.length; showTip(); });
  showTip();

  // Checklist
  let habits = store.get("bp-habits", DEFAULT_HABITS);
  let done = store.get("bp-done", { date: today, items: [] });
  if (done.date !== today) done = { date: today, items: [] };
  const list = $("#checklist");
  const save = () => { store.set("bp-habits", habits); store.set("bp-done", done); };

  function renderChecklist() {
    list.innerHTML = "";
    habits.forEach((habit, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<input type="checkbox" id="habit-${i}"><label for="habit-${i}"></label>
        <button class="remove" aria-label="Remove">${icon("close")}</button>`;
      const box = li.querySelector("input");
      box.checked = done.items.includes(habit);
      li.querySelector("label").textContent = habit;
      box.addEventListener("change", () => {
        done.items = box.checked ? [...done.items, habit] : done.items.filter((x) => x !== habit);
        save(); progress();
      });
      li.querySelector(".remove").addEventListener("click", () => {
        habits = habits.filter((_, j) => j !== i);
        done.items = done.items.filter((x) => x !== habit);
        save(); renderChecklist();
      });
      list.appendChild(li);
    });
    progress();
  }
  function progress() {
    const n = habits.filter((x) => done.items.includes(x)).length;
    const pct = habits.length ? Math.round((n / habits.length) * 100) : 0;
    $("#progress-bar").style.width = pct + "%";
    $("#progress-label").textContent = `${n} of ${habits.length} complete`;
    $("#progress-ring").style.setProperty("--p", pct);
    $("#progress-pct").textContent = pct + "%";
  }
  $("#add-habit").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#habit-input");
    const v = input.value.trim();
    if (v && !habits.includes(v)) { habits.push(v); save(); renderChecklist(); }
    input.value = "";
  });
  $("#reset-habits").addEventListener("click", () => {
    habits = [...DEFAULT_HABITS];
    done = { date: today, items: [] };
    save(); renderChecklist();
  });
  renderChecklist();

  // Water tracker
  const GOAL = 8;
  let water = store.get("bp-water", { date: today, count: 0 });
  if (water.date !== today) water = { date: today, count: 0 };
  function renderWater() {
    const glasses = $("#glasses");
    glasses.innerHTML = "";
    for (let i = 0; i < GOAL; i++) {
      const b = document.createElement("button");
      b.className = "glass" + (i < water.count ? " full" : "");
      b.innerHTML = icon("drop");
      b.setAttribute("aria-label", `Glass ${i + 1}`);
      b.addEventListener("click", () => {
        water.count = water.count === i + 1 ? i : i + 1;
        store.set("bp-water", water);
        renderWater();
      });
      glasses.appendChild(b);
    }
    $("#water-count").textContent = `${water.count} of ${GOAL} glasses`;
  }
  renderWater();

  // Daily rhythm
  const hour = new Date().getHours();
  const nowIdx = hour < 11 ? 0 : hour < 14 ? 1 : hour < 18 ? 2 : 3;
  $("#rhythm").innerHTML = DAILY_RHYTHM.map((r, i) => `
    <div class="rhythm-card${i === nowIdx ? " now" : ""}">
      <div class="rhythm-head">${icon(r.icon)}<h3>${r.time}</h3>${i === nowIdx ? '<span class="pill">Now</span>' : ""}</div>
      <ul>${r.items.map((x) => `<li>${x}</li>`).join("")}</ul>
    </div>`).join("");


  // 100 natural reminders for the body
  let group = "all";
  const bodyList = $("#body-list");
  $("#body-chips").innerHTML = [["all", "All 100"], ...Object.entries(BODY_REMINDER_GROUPS).map(([k, g]) => [k, g.label])].map(([k, l]) => `<button class="chip" data-g="${k}">${l}</button>`).join("");
  function renderBody() {
    $("#body-chips").querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.g === group));
    bodyList.innerHTML = BODY_REMINDERS.map(([g, text], i) => ({ g, text, i })).filter((r) => group === "all" || r.g === group).map(({ g, text, i }) => `
      <li class="body-reminder" id="reminder-${i + 1}">
        <span class="br-num">${i + 1}</span>
        <span class="br-icon">${icon(BODY_REMINDER_GROUPS[g].icon)}</span>
        <p><em>${BODY_REMINDER_GROUPS[g].label}</em>${text}</p>
        <button class="br-add${habits.includes(text) ? " added" : ""}" data-add="${i}" aria-label="Add to my daily checklist">${habits.includes(text) ? `${icon("check")} Added` : "+ Checklist"}</button>
      </li>`).join("");
  }
  $("#body-chips").addEventListener("click", (e) => { const c = e.target.closest("[data-g]"); if (c) { group = c.dataset.g; renderBody(); } });
  bodyList.addEventListener("click", (e) => {
    const b = e.target.closest("[data-add]"); if (!b) return;
    const text = BODY_REMINDERS[+b.dataset.add][1];
    if (!habits.includes(text)) { habits.push(text); save(); renderChecklist(); toast("Added to your daily checklist."); }
    renderBody();
  });
  $("#random-reminder").addEventListener("click", () => {
    group = "all"; renderBody();
    const i = Math.floor(Math.random() * BODY_REMINDERS.length);
    const el = $(`#reminder-${i + 1}`);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    list.querySelectorAll(".body-reminder.spot").forEach((x) => x.classList.remove("spot"));
    el.classList.add("spot");
  });
  renderBody();

  // Seasons
  const month = new Date().getMonth();
  $("#seasons").innerHTML = SEASONS.map((s) => {
    const current = s.months.includes(month);
    return `<div class="season-card${current ? " current" : ""}">
      <div class="season-head"><h3>${s.name}</h3>${current ? '<span class="pill">This season</span>' : ""}</div>
      <p>${s.text}</p>
      <div class="season-herbs">${s.herbs.map((id) => { const h = findHerb(id); return `<a href="${herbUrl(id)}"><span class="mini-art">${visual(h)}</span>${h.name}</a>`; }).join("")}</div>
    </div>`;
  }).join("");
}

/* ---------------- Journal ---------------- */

/* ---------------- Herbal stacks ---------------- */
function initStacks() {
  const main = $("#stacks-main");
  const st = STACKS.find((x) => x.id === params.get("s"));
  if (!st) {
    let group = params.get("g") || "all";
    main.innerHTML = `
      <section class="page-hero">
        <div class="container">
          <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><span aria-current="page">Herbal Stacks</span></nav>
          <h1>Herbal Stacks</h1>
          <p class="lead">Herbs work beautifully together. Each stack combines herbs with complementary benefits for one goal — with exact amounts, a simple recipe, how long to use it, and who should avoid it.</p>
        </div>
      </section>
      <section class="section section-top-tight">
        <div class="container">
          <div class="chips" id="stack-chips">${[["all", "All stacks"], ...Object.entries(STACK_GROUPS)].map(([k, v]) => `<button class="chip" data-g="${k}">${v}</button>`).join("")}</div>
          <div class="stack-grid" id="stack-grid"></div>
          <div class="notice note-card">${icon("shield", "icon info-icon")}<p><strong>Before you start a stack:</strong> combining herbs combines their cautions too. Read the "Who should avoid" list for each stack, and check with your doctor or pharmacist if you are pregnant, breastfeeding, taking medicine or have a health condition.</p></div>
        </div>
      </section>`;
    const render = () => {
      $("#stack-grid").innerHTML = STACKS.filter((x) => group === "all" || x.group === group).map(stackCard).join("");
      document.querySelectorAll("#stack-chips .chip").forEach((c) => c.classList.toggle("active", c.dataset.g === group));
    };
    $("#stack-chips").addEventListener("click", (e) => {
      const c = e.target.closest(".chip");
      if (c) { group = c.dataset.g; render(); }
    });
    render();
    return;
  }

  document.title = `${st.name} Herbal Stack — Beauty & Praise`;
  const others = STACKS.filter((x) => x !== st && x.group === st.group).concat(STACKS.filter((x) => x !== st && x.group !== st.group)).slice(0, 3);
  main.innerHTML = `
    <section class="stack-hero">
      <div class="container">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><a href="stacks.html">Herbal Stacks</a><span>/</span><span aria-current="page">${st.name}</span></nav>
        <div class="stack-hero-grid">
          <div>
            <p class="eyebrow">${STACK_GROUPS[st.group]} · ${st.herbs.length} herbs</p>
            <h1>${st.name}</h1>
            <p class="lead">${st.tagline}</p>
            <dl class="facts">
              <div><dt>How much</dt><dd>${st.dose}</dd></div>
              <div><dt>How long</dt><dd>${st.duration}</dd></div>
            </dl>
            <button class="btn btn-secondary print-btn" onclick="window.print()">${icon("print")}<span>Print recipe card</span></button>
          </div>
          <div class="stack-hero-photos">${st.herbs.slice(0, 4).map((x, i) => `<a href="${herbUrl(x.id)}" class="shp shp-${i}">${visual(findHerb(x.id), i === 0)}</a>`).join("")}</div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container narrow prose">
        <h2>Why it works</h2>
        <p>${st.intro}</p>

        <h2>What's in it</h2>
        <div class="stack-herb-list">${st.herbs.map((x) => { const h = findHerb(x.id); return `
          <a class="stack-herb" href="${herbUrl(h.id)}">
            <span class="stack-herb-photo">${visual(h)}</span>
            <span class="stack-herb-text">
              <span class="stack-herb-name"><strong>${h.name}</strong><span class="amount">${x.parts}</span></span>
              <em class="latin">${h.latin}</em>
              <span class="stack-herb-role">${x.role}</span>
            </span>
          </a>`; }).join("")}
        </div>

        <h2>Shopping list</h2>
        <ul class="shopping-list">${st.herbs.map((x) => { const h = findHerb(x.id); return `<li><label><input type="checkbox"> <strong>${h.name}</strong> <em>(${h.latin})</em> — ${x.parts}</label></li>`; }).join("")}</ul>

        <h2>How to make it</h2>
        <ol class="steps">${st.method.map((m) => `<li>${m}</li>`).join("")}</ol>

        <h2>Make it work better</h2>
        <ul class="check-list">${st.tips.map((t) => `<li>${icon("check")}${t}</li>`).join("")}</ul>

        <h2>Who should avoid this stack</h2>
        <div class="caution-card">${icon("shield", "icon info-icon")}
          <div><ul class="caution-list">${st.avoid.map((a) => `<li>${a}</li>`).join("")}</ul>
          <p class="small">This stack is for general education and is not medical advice. Stop if you notice any side effects, and talk with your doctor or pharmacist before using herbs if you take medicine or have a health condition.</p></div>
        </div>
        <h3 class="ix-title">Medicine checks for the herbs in this stack</h3>
        ${(() => { const seen = {}; st.herbs.forEach((x) => interactionsFor(x.id).forEach((hit) => { if (hit.level === "avoid" || !seen[hit.entry.id]) seen[hit.entry.id] = { ...hit, herb: findHerb(x.id).name, level: seen[hit.entry.id]?.level === "avoid" ? "avoid" : hit.level }; })); const list = Object.values(seen); return list.length ? `<ul class="ix-list">${list.map((x) => `<li class="ix-${x.level}"><span class="ix-badge">${x.level === "avoid" ? "Avoid" : "Caution"}</span><span><strong>${x.entry.label}</strong> — ${x.herb}: ${x.note}</span></li>`).join("")}</ul>` : ""; })()}
        <p class="print-only small">Printed from Beauty &amp; Praise · For education only — not medical advice.</p>
      </div>
    </section>

    <section class="section section--cream section-tint">
      <div class="container">
        <div class="section-head"><div><p class="eyebrow">Keep exploring</p><h2>More herbal stacks</h2></div><a class="text-link" href="stacks.html">All stacks ${icon("arrow")}</a></div>
        <div class="stack-grid">${others.map(stackCard).join("")}</div>
      </div>
    </section>`;
}


/* ---------------- Fruits ---------------- */
function fruitCard(fr) {
  const key = "fruit:" + fr.id;
  const saved = favorites.has(key);
  return `<article class="herb-card editorial-item">
    <a href="${fruitUrl(fr.id)}" class="herb-card-link" aria-label="${fr.name}">
      <div class="herb-card-art editorial-image">${fruitVisual(fr)}</div>
      <div class="herb-card-body">
        <p class="herb-card-cat editorial-meta">${CATEGORIES[fr.cats[0]]}</p>
        <h3>${fr.name}</h3>
        <p class="latin">${fr.latin}</p>
        <p class="herb-card-summary">${fr.summary.split(/(?<=\.)\s/)[0]}</p>
      </div>
    </a>
    <button class="fav-btn${saved ? " saved" : ""}" data-fav="${key}" aria-pressed="${saved}" aria-label="Save ${fr.name} to favorites">${icon("heart")}</button>
  </article>`;
}

const SEASON_NAMES = ["Spring", "Summer", "Autumn", "Winter", "Year-round"];
const SEASON_ORDER = ["spring", "summer", "autumn", "winter"];

// "Late summer to winter" → ["summer", "autumn", "winter"]; "Year-round" → all four.
function seasonsOf(text) {
  const t = text.toLowerCase();
  if (t.includes("year-round")) return SEASON_ORDER;
  const found = SEASON_ORDER.filter((x) => t.includes(x));
  if (!t.includes(" to ") || found.length < 2) return found;
  const [from, to] = t.split(" to ").map((part) => SEASON_ORDER.findIndex((x) => part.includes(x)));
  const out = [];
  for (let i = from; ; i = (i + 1) % 4) { out.push(SEASON_ORDER[i]); if (i === to || out.length > 4) break; }
  return out;
}


function initFruit() {
  const fr = FRUITS.find((x) => x.id === (document.body.dataset.id || params.get("id")));
  if (!fr) return notFound($("#fruit-main"), "Fruit", "foods.html", "Browse foods & fruits");
  renderFoodProfile(foodProfile(fr, "fruit", INTERACTIONS), $("#fruit-main"));
}

/* ---------------- Interaction checker (step by step) ---------------- */

const WHO_OPTIONS = [
  { id: "adult", label: "An adult", sub: "18–64, not pregnant", flags: [] },
  { id: "preg1", label: "Pregnant — 1st trimester", sub: "weeks 1–13", flags: ["pregnancy"], trimester: 1 },
  { id: "preg2", label: "Pregnant — 2nd trimester", sub: "weeks 14–27", flags: ["pregnancy"], trimester: 2 },
  { id: "preg3", label: "Pregnant — 3rd trimester", sub: "weeks 28–40", flags: ["pregnancy"], trimester: 3 },
  { id: "ttc", label: "Trying to get pregnant", sub: "", flags: ["pregnancy"] },
  { id: "breastfeeding", label: "Breastfeeding", sub: "", flags: ["breastfeeding"] },
  { id: "child", label: "A child or teen", sub: "under 18", flags: ["children"] },
  { id: "senior", label: "An adult 65 or older", sub: "", flags: ["older-adults"] }
];

// The "Who is this for?" choices that make sense for each goal — no pregnancy questions for
// men's health or menopause, for example. Labels can be reworded per goal; ids and flags stay the same.
const WHO_BY_GOAL = {
  "mens-health": [["adult", "A man", "18–64"], ["senior", "A man 65 or older"], ["child", "A teen boy", "under 18"]],
  menopause: [["adult", "A woman in perimenopause or menopause", "under 65"], ["senior", "A woman 65 or older"]],
  "womens-cycle": [["adult", "A woman", "18 or older, not pregnant"], ["ttc", "Trying to get pregnant"], ["breastfeeding", "Breastfeeding"], ["child", "A teen girl", "under 18"]]
};
function whoOptionsFor(goal) {
  const custom = WHO_BY_GOAL[goal];
  if (!custom) return WHO_OPTIONS;
  return custom.map(([id, label, sub]) => ({ ...WHO_OPTIONS.find((w) => w.id === id), label, sub: sub || "" }));
}

const TRIMESTER_NOTES = {
  1: "First trimester: this is when the baby's organs form, so keep herbs to food amounts. For nausea, ginger up to about 1 g dried a day (or a weak cup of ginger tea) is widely used — ask your midwife.",
  2: "Second trimester: keep avoiding the herbs below. For heartburn try smaller meals (and skip peppermint); for constipation try kiwi, prunes and water.",
  3: "Third trimester: some midwives suggest raspberry leaf tea from about 32 weeks and dates from 36 weeks — only with your midwife's agreement. Avoid herbs that stimulate the womb until your care team says otherwise."
};

function initInteractions() {
  const state = Object.assign({ who: "adult", meds: [], drugs: [], conds: [], item: "" }, store.get("bp-ix2", {}));
  const save = () => store.set("bp-ix2", state);
  if (WHO_OPTIONS.some((w) => w.id === params.get("who"))) state.who = params.get("who");
  const meds = INTERACTIONS.filter((x) => x.type === "med");
  const conds = INTERACTIONS.filter((x) => x.type === "condition" && !["pregnancy", "breastfeeding", "children", "older-adults"].includes(x.id));

  // Step 1: who
  $("#ix-who").innerHTML = WHO_OPTIONS.map((w) => `<label class="quiz-card who-card"><input type="radio" name="who" value="${w.id}" ${state.who === w.id ? "checked" : ""}><span class="option"><strong>${w.label}</strong>${w.sub ? `<em>${w.sub}</em>` : ""}</span></label>`).join("");
  $("#ix-who").addEventListener("change", (e) => { state.who = e.target.value; render(); });

  // Step 2: medicines — type a name, or tick a group
  const input = $("#ix-drug"), suggest = $("#ix-drug-suggest");
  const norm = (t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  function findDrugs(q) {
    q = norm(q);
    if (q.length < 2) return [];
    return DRUGS.filter(([name, , brands]) => norm(name).includes(q) || norm(brands).split(" ").some((w) => w.startsWith(q)) || norm(brands).includes(q)).slice(0, 8);
  }
  function addDrug(name) {
    if (!state.drugs.includes(name)) state.drugs.push(name);
    input.value = ""; suggest.innerHTML = ""; render();
  }
  input.addEventListener("input", () => {
    const hits = findDrugs(input.value);
    suggest.innerHTML = hits.map(([name, groups, brands]) => `<li><button type="button" data-drug="${name}"><strong>${name}</strong>${brands ? ` <em>(${brands})</em>` : ""}<span>${groups.map((g) => INTERACTIONS.find((x) => x.id === g).label).join(" · ")}</span></button></li>`).join("") ||
      (input.value.trim().length > 2 ? `<li class="no-match">Not in our list yet — tick the type of medicine below, or ask your pharmacist.</li>` : "");
  });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); const first = findDrugs(input.value)[0]; if (first) addDrug(first[0]); } });
  suggest.addEventListener("click", (e) => { const b = e.target.closest("[data-drug]"); if (b) addDrug(b.dataset.drug); });
  $("#ix-drug-chips").addEventListener("click", (e) => { const b = e.target.closest("[data-remove]"); if (b) { state.drugs = state.drugs.filter((d) => d !== b.dataset.remove); render(); } });

  $("#ix-meds").innerHTML = meds.map((x) => `<label class="ix-option"><input type="checkbox" value="${x.id}" ${state.meds.includes(x.id) ? "checked" : ""}><span><strong>${x.label}</strong><em>${x.examples}</em></span></label>`).join("");
  $("#ix-meds").addEventListener("change", () => { state.meds = [...document.querySelectorAll("#ix-meds input:checked")].map((i) => i.value); render(); });

  // Step 3: health conditions
  $("#ix-conds").innerHTML = conds.map((x) => `<label class="ix-option"><input type="checkbox" value="${x.id}" ${state.conds.includes(x.id) ? "checked" : ""}><span><strong>${x.label}</strong>${x.examples ? `<em>${x.examples}</em>` : ""}</span></label>`).join("");
  $("#ix-conds").addEventListener("change", () => { state.conds = [...document.querySelectorAll("#ix-conds input:checked")].map((i) => i.value); render(); });

  // Optional: check one item
  $("#ix-item").innerHTML = `<option value="">Show everything to watch</option>
    <optgroup label="Herbal stacks">${STACKS.map((st) => `<option value="stack:${st.id}">${st.name}</option>`).join("")}</optgroup>
    <optgroup label="Herbs">${[...HERBS].sort((a, b) => a.name.localeCompare(b.name)).map((h) => `<option value="${h.id}">${h.name}</option>`).join("")}</optgroup>
    <optgroup label="Fruits">${[...FRUITS].sort((a, b) => a.name.localeCompare(b.name)).map((f) => `<option value="fruit:${f.id}">${f.name}</option>`).join("")}</optgroup>
    <optgroup label="Foods">${[...FOODS].sort((a, b) => a.name.localeCompare(b.name)).map((f) => `<option value="food:${f.id}">${f.name}</option>`).join("")}</optgroup>`;
  const startItem = params.get("item") || state.item;
  if ([...$("#ix-item").options].some((o) => o.value === startItem)) { $("#ix-item").value = startItem; state.item = startItem; }
  $("#ix-item").addEventListener("change", () => { state.item = $("#ix-item").value; render(); });

  $("#ix-clear").addEventListener("click", () => {
    Object.assign(state, { who: "adult", meds: [], drugs: [], conds: [], item: "" });
    document.querySelectorAll("#ix-meds input, #ix-conds input").forEach((i) => (i.checked = false));
    document.querySelector('#ix-who input[value="adult"]').checked = true;
    $("#ix-item").value = "";
    render();
  });
  $("#ix-print").addEventListener("click", () => window.print());

  function selectedEntries() {
    const who = WHO_OPTIONS.find((w) => w.id === state.who) || WHO_OPTIONS[0];
    const fromDrugs = state.drugs.flatMap((d) => (DRUGS.find((x) => x[0] === d) || [, []])[1]);
    const ids = [...new Set([...who.flags, ...state.meds, ...fromDrugs, ...state.conds])];
    return { who, entries: INTERACTIONS.filter((x) => ids.includes(x.id)) };
  }

  function render() {
    save();
    $("#ix-drug-chips").innerHTML = state.drugs.map((d) => { const g = (DRUGS.find((x) => x[0] === d) || [, []])[1]; return `<span class="drug-chip"><strong>${d}</strong> <em>${g.map((id) => INTERACTIONS.find((x) => x.id === id).label).join(", ")}</em><button type="button" data-remove="${d}" aria-label="Remove ${d}">${icon("close")}</button></span>`; }).join("");
    const { who, entries } = selectedEntries();
    const out = $("#ix-results");
    const summary = [who.label, ...state.drugs, ...entries.filter((e) => e.type === "med" && state.meds.includes(e.id)).map((e) => e.label), ...entries.filter((e) => state.conds.includes(e.id)).map((e) => e.label)];
    $("#ix-summary").innerHTML = `<strong>Checking for:</strong> ${summary.join(" · ")}`;
    if (!entries.length) {
      out.innerHTML = `<div class="ix-empty">${icon("shield", "icon info-icon")}<p>Choose who this is for, add your medicines, and tick any health conditions. Your results will appear here.</p></div>`;
      return;
    }
    const trimester = who.trimester ? `<div class="notice note-card trimester-note">${icon("leaf", "icon info-icon")}<p>${TRIMESTER_NOTES[who.trimester]} <a href="safety/pregnancy.html">Read the full pregnancy guide</a>.</p></div>` : "";

    if (state.item) {
      const keys = state.item.startsWith("stack:") ? STACKS.find((st) => st.id === state.item.slice(6)).herbs.map((x) => x.id) : [state.item];
      const rows = [];
      entries.forEach((entry) => keys.forEach((k) => {
        if (entry.avoid[k]) rows.push({ level: "avoid", entry, k, note: entry.avoid[k] });
        else if (entry.caution[k]) rows.push({ level: "caution", entry, k, note: entry.caution[k] });
      }));
      const worst = rows.some((r) => r.level === "avoid") ? "avoid" : rows.length ? "caution" : "ok";
      const title = state.item.startsWith("stack:") ? STACKS.find((st) => st.id === state.item.slice(6)).name : itemName(state.item);
      const verdict = { avoid: "Avoid — talk to your doctor first", caution: "Use with caution — check with your doctor or pharmacist", ok: "No problems found in our list" }[worst];
      out.innerHTML = `${trimester}<div class="ix-verdict ix-${worst}"><p class="eyebrow">${title}</p><h3>${verdict}</h3></div>
        ${rows.map((r) => `<div class="ix-detail ix-${r.level}">
          <p class="ix-head"><span class="ix-badge">${r.level === "avoid" ? "Avoid" : "Caution"}</span> <strong>${r.entry.label}</strong> + <a href="${itemUrl(r.k)}">${itemName(r.k)}</a></p>
          <p>${r.note}</p>
          <p class="ix-what"><strong>What could happen:</strong> ${IX_DETAILS[r.entry.id].what}</p>
          <p class="ix-todo"><strong>What to do:</strong> ${IX_DETAILS[r.entry.id].todo}</p>
        </div>`).join("") || `<p class="muted">Our checker doesn't list a problem, but it can't cover every medicine. Always tell your pharmacist about everything you take.</p>`}`;
      return;
    }

    out.innerHTML = trimester + entries.map((entry) => {
      const chip = (k, note, level) => `<li class="ix-${level}"><span class="ix-badge">${level === "avoid" ? "Avoid" : "Caution"}</span><span><a href="${itemUrl(k)}"><strong>${itemName(k)}</strong></a> — ${note}</span></li>`;
      const av = Object.entries(entry.avoid), ca = Object.entries(entry.caution);
      return `<details class="ix-section" open>
        <summary><span class="ix-section-title">${entry.label}</span><span class="ix-counts">${av.length ? `<span class="ix-count ix-avoid">${av.length} avoid</span>` : ""}${ca.length ? `<span class="ix-count ix-caution">${ca.length} caution</span>` : ""}</span></summary>
        <div class="ix-explain">
          <p><strong>What could happen:</strong> ${IX_DETAILS[entry.id].what}</p>
          <p><strong>What to do:</strong> ${IX_DETAILS[entry.id].todo}</p>
        </div>
        ${av.length ? `<h4 class="ix-subhead">Avoid</h4><ul class="ix-list">${av.map(([k, n]) => chip(k, n, "avoid")).join("")}</ul>` : ""}
        ${ca.length ? `<h4 class="ix-subhead">Use with caution</h4><ul class="ix-list">${ca.map(([k, n]) => chip(k, n, "caution")).join("")}</ul>` : ""}
      </details>`;
    }).join("");
  }
  render();
}

/* ---------------- "What should I eat?" quiz ---------------- */
const GUIDE_CATS = { sleep: "sleep", stress: "calming", digestion: "digestion", immunity: "immunity", "cold-flu": "respiratory", heart: "heart", "blood-sugar": null, skin: "skin", hair: "skin", joints: "aches", energy: "energy", memory: "energy", "womens-cycle": "women", menopause: "women", "mens-health": "men" };

function drugMatches(q) {
  const norm = (t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  q = norm(q);
  if (q.length < 2) return [];
  return DRUGS.filter(([name, , brands]) => norm(name).includes(q) || norm(brands).includes(q)).slice(0, 8);
}

function initFinder() {
  const app = $("#finder-app");
  const a = { goal: null, duration: null, who: null, drugs: [], meds: [], conds: [], form: null };
  let step = 0;
  const condOptions = INTERACTIONS.filter((x) => x.type === "condition" && !["pregnancy", "breastfeeding", "children", "older-adults"].includes(x.id));

  const STEPS = [
    { key: "goal", title: "What would you like help with?", render: () => `<div class="quiz-grid finder-goals">${TOPIC_GUIDES.map((g) => `<label class="quiz-card"><input type="radio" name="goal" value="${g.id}" ${a.goal === g.id ? "checked" : ""}><span class="option">${icon(g.icon)}${g.short}</span></label>`).join("")}</div>` },
    { key: "duration", title: "How long has this been bothering you?", render: () => `<div class="who-grid">${[["days", "It just started", "a few days"], ["weeks", "A few weeks", ""], ["months", "Months or longer", ""], ["well", "It's not a problem", "I just want to stay well"]].map(([v, l, sub]) => `<label class="quiz-card who-card"><input type="radio" name="duration" value="${v}" ${a.duration === v ? "checked" : ""}><span class="option"><strong>${l}</strong>${sub ? `<em>${sub}</em>` : ""}</span></label>`).join("")}</div>` },
    { key: "who", title: "Who is this for?", render: () => `<div class="who-grid">${whoOptionsFor(a.goal).map((w) => `<label class="quiz-card who-card"><input type="radio" name="who" value="${w.id}" ${a.who === w.id ? "checked" : ""}><span class="option"><strong>${w.label}</strong>${w.sub ? `<em>${w.sub}</em>` : ""}</span></label>`).join("")}</div>` },
    { key: "meds", title: "Do you take any medicines?", optional: true, render: () => `
      <label class="ix-item-label">Type the name on your bottle (brand or generic)
        <input type="search" id="f-drug" class="field" placeholder="e.g. Eliquis, Zoloft, metformin, birth control…" autocomplete="off">
      </label>
      <ul class="drug-suggest" id="f-suggest"></ul>
      <div class="drug-chips" id="f-chips"></div>
      <details class="ix-groups"><summary>Or choose the type of medicine</summary>
        <div class="ix-options">${INTERACTIONS.filter((x) => x.type === "med").map((x) => `<label class="ix-option"><input type="checkbox" name="med" value="${x.id}" ${a.meds.includes(x.id) ? "checked" : ""}><span><strong>${x.label}</strong><em>${x.examples}</em></span></label>`).join("")}</div>
      </details>
      <p class="muted small">No medicines? Just tap Next.</p>` },
    { key: "conds", title: "Do any of these apply to you?", optional: true, render: () => `<div class="ix-options">${condOptions.map((x) => `<label class="ix-option"><input type="checkbox" name="cond" value="${x.id}" ${a.conds.includes(x.id) ? "checked" : ""}><span><strong>${x.label}</strong>${x.examples ? `<em>${x.examples}</em>` : ""}</span></label>`).join("")}</div><p class="muted small">None of these? Just tap Next.</p>` },
    { key: "form", title: "How do you like to take herbs?", render: () => `<div class="who-grid">${[["tea", "As a tea"], ["capsule", "Capsules"], ["food", "In my food"], ["any", "Any way"]].map(([v, l]) => `<label class="quiz-card who-card"><input type="radio" name="form" value="${v}" ${a.form === v ? "checked" : ""}><span class="option"><strong>${l}</strong></span></label>`).join("")}</div>` }
  ];

  function show() {
    const st = STEPS[step];
    app.innerHTML = `<div class="card finder-step tool-shell">
      <div class="quiz-progress"><span>Question ${step + 1} of ${STEPS.length}</span><span>${Math.round((step / STEPS.length) * 100)}% done</span></div>
      <div class="progress progress-track"><div class="progress-bar" style="width:${(step / STEPS.length) * 100}%"></div></div>
      <h2>${st.title}</h2>
      <div class="finder-body">${st.render()}</div>
      <div class="finder-nav">
        ${step ? `<button class="btn btn-secondary" data-back>Back</button>` : "<span></span>"}
        <button class="btn btn-primary" data-next ${!st.optional && !a[st.key] ? "disabled" : ""}>${step === STEPS.length - 1 ? "See my plan" : "Next"}</button>
      </div>
    </div>`;
    const next = app.querySelector("[data-next]");
    app.querySelectorAll('input[type="radio"]').forEach((r) => r.addEventListener("change", () => {
      a[st.key] = r.value; next.disabled = false;
      if (st.key === "goal" && !whoOptionsFor(a.goal).some((w) => w.id === a.who)) a.who = null;
      setTimeout(() => { step++; step < STEPS.length ? show() : results(); }, 220);
    }));
    app.querySelectorAll('input[name="med"]').forEach((c) => c.addEventListener("change", () => { a.meds = [...app.querySelectorAll('input[name="med"]:checked')].map((i) => i.value); }));
    app.querySelectorAll('input[name="cond"]').forEach((c) => c.addEventListener("change", () => { a.conds = [...app.querySelectorAll('input[name="cond"]:checked')].map((i) => i.value); }));
    if (st.key === "meds") {
      const input = $("#f-drug"), sug = $("#f-suggest"), chips = $("#f-chips");
      const drawChips = () => { chips.innerHTML = a.drugs.map((d) => `<span class="drug-chip"><strong>${d}</strong><button type="button" data-remove="${d}" aria-label="Remove ${d}">${icon("close")}</button></span>`).join(""); };
      const add = (name) => { if (!a.drugs.includes(name)) a.drugs.push(name); input.value = ""; sug.innerHTML = ""; drawChips(); };
      input.addEventListener("input", () => {
        const hits = drugMatches(input.value);
        sug.innerHTML = hits.map(([n, , b]) => `<li><button type="button" data-drug="${n}"><strong>${n}</strong>${b ? ` <em>(${b})</em>` : ""}</button></li>`).join("") ||
          (input.value.trim().length > 2 ? `<li class="no-match">Not in our list yet — choose the type of medicine below.</li>` : "");
      });
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); const h = drugMatches(input.value)[0]; if (h) add(h[0]); } });
      sug.addEventListener("click", (e) => { const b = e.target.closest("[data-drug]"); if (b) add(b.dataset.drug); });
      chips.addEventListener("click", (e) => { const b = e.target.closest("[data-remove]"); if (b) { a.drugs = a.drugs.filter((d) => d !== b.dataset.remove); drawChips(); } });
      drawChips();
    }
    next.addEventListener("click", () => { step++; step < STEPS.length ? show() : results(); });
    app.querySelector("[data-back]")?.addEventListener("click", () => { step--; show(); });
    app.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function results() {
    const g = TOPIC_GUIDES.find((x) => x.id === a.goal);
    const who = whoOptionsFor(a.goal).find((w) => w.id === a.who) || WHO_OPTIONS.find((w) => w.id === a.who);
    const ids = [...new Set([...who.flags, ...a.meds, ...a.drugs.flatMap((d) => (DRUGS.find((x) => x[0] === d) || [, []])[1]), ...a.conds])];
    const entries = INTERACTIONS.filter((x) => ids.includes(x.id));
    const hitsFor = (key) => entries.map((e) => e.avoid[key] ? { level: "avoid", e, note: e.avoid[key] } : e.caution[key] ? { level: "caution", e, note: e.caution[key] } : null).filter(Boolean);
    const levelFor = (key) => { const h = hitsFor(key); return h.some((x) => x.level === "avoid") ? "avoid" : h.length ? "caution" : "ok"; };
    const skinGoal = ["skin", "hair"].includes(g.id);
    const cat = GUIDE_CATS[g.id];
    const pool = [...new Set([...g.herbs, ...(cat ? HERBS.filter((h) => h.cats.includes(cat)).map((h) => h.id) : [])])].filter((id) => id !== "nutmeg" && (skinGoal || !PHARM[id]?.ext));
    const score = (id) => {
      const b = BENEFITS[id] || [], c = CAPS[id];
      let n = (g.herbs.includes(id) ? (8 - g.herbs.indexOf(id)) * 2 : 0) + b.filter(([e]) => e === "R").length * 3 + b.filter(([e]) => e === "P").length;
      if (a.form === "capsule" && c && Array.isArray(c.cap)) n += 3;
      if (a.form === "tea" && c && c.herb && /tea/i.test(c.herb[2] || "")) n += 3;
      if (a.form === "food" && findHerb(id).cats.includes("kitchen")) n += 4;
      if (levelFor(id) === "caution") n -= 4;
      return n;
    };
    const safe = pool.filter((id) => levelFor(id) !== "avoid").sort((x, y) => score(y) - score(x));
    const goalFoods = guideFoods(g).map((fd) => "food:" + fd.id);
    const foods = goalFoods.filter((k) => levelFor(k) !== "avoid").slice(0, 4);
    const leftOut = [...goalFoods.filter((k) => levelFor(k) === "avoid"), ...pool.filter((id) => levelFor(id) === "avoid" && g.herbs.includes(id))];
    const remedies = REMEDIES.filter((r) => REMEDY_CATS[r.cat].guide === g.id && !r.items.some((k) => levelFor(k) === "avoid")).slice(0, 3);
    let n = 1;
    const top = safe.slice(0, 3), more = safe.slice(3, 7);
    const stacks = g.stacks.map((id) => STACKS.find((s) => s.id === id)).filter((st) => !st.herbs.some((x) => levelFor(x.id) === "avoid"));
    const fruits = [...new Set([...g.fruits, ...FRUITS.filter((f) => cat && f.cats.includes(cat)).map((f) => f.id)])].filter((id) => levelFor("fruit:" + id) !== "avoid").slice(0, 4);
    const isChild = a.who === "child";

    const doseFor = (id) => {
      const c = CAPS[id]; if (!c) return "";
      const capTxt = Array.isArray(c.cap) ? `Capsule: ${range(c.cap[0], c.cap[1], "mg")} ${c.cap[2].toLowerCase()}, ${c.cap[3].toLowerCase()}` : "";
      const herbTxt = c.herb ? (typeof c.herb[0] === "number" ? `${c.herb[2]}: ${range(c.herb[0], c.herb[1], "g")}, ${c.herb[3].toLowerCase()}` : `${c.herb[2]}`) : "For use on the skin only.";
      return a.form === "capsule" ? (capTxt || herbTxt) : a.form === "any" ? [herbTxt, capTxt].filter(Boolean).join(" · ") : (herbTxt || capTxt);
    };
    const herbCardPlan = (id, i) => {
      const h = findHerb(id), b = (BENEFITS[id] || [])[0], hits = hitsFor(id);
      return `<div class="plan-herb">
        <span class="plan-rank">${i + 1}</span>
        <a class="stack-herb-photo" href="${herbUrl(id)}">${visual(h)}</a>
        <div>
          <h3><a href="${herbUrl(id)}">${h.name}</a> ${b ? `<span class="evidence ev-${b[0]}">${EVIDENCE[b[0]].label}</span>` : ""}</h3>
          ${b ? `<p><strong>Why:</strong> ${b[2]}</p>` : `<p>${h.summary}</p>`}
          ${isChild ? `<p class="plan-dose">Ask your pediatrician for a child's dose.</p>` : `<p class="plan-dose"><strong>How much (adults 100 lb+):</strong> ${doseFor(id)}</p>`}
          ${hits.map((x) => `<p class="plan-caution"><span class="ix-badge ix-caution-badge">Caution</span> ${x.e.label}: ${x.note}</p>`).join("")}
        </div>
      </div>`;
    };

    app.innerHTML = `<div class="plan">
      <div class="card plan-head">
        <p class="eyebrow">Your plan</p>
        <h2>${g.title.replace("Natural ", "")}</h2>
        <p class="muted">For: ${who.label}${a.drugs.length || a.meds.length ? " · taking " + [...a.drugs, ...a.meds.map((m) => INTERACTIONS.find((x) => x.id === m).label)].join(", ") : ""}${a.conds.length ? " · " + a.conds.map((c) => INTERACTIONS.find((x) => x.id === c).label).join(", ") : ""}</p>
        ${a.duration === "months" ? `<div class="notice note-card plan-doctor">${icon("shield", "icon info-icon")}<div><p><strong>Because this has lasted months, please also see your doctor.</strong> Ongoing problems can have causes that need treatment. Get help especially if you notice:</p><ul>${g.doctor.map((d) => `<li>${d}</li>`).join("")}</ul></div></div>` : ""}
        ${who.flags.includes("pregnancy") ? `<div class="notice note-card">${icon("leaf", "icon info-icon")}<p>${who.trimester ? TRIMESTER_NOTES[who.trimester] : "When you're trying to conceive, follow the same care as early pregnancy."} <a href="${safetyUrl("pregnancy")}">Read the pregnancy guide</a>.</p></div>` : ""}
        ${a.who === "breastfeeding" ? `<div class="notice note-card">${icon("leaf", "icon info-icon")}<p>Introduce one herbal tea at a time and watch your baby for changes. <a href="${safetyUrl("breastfeeding")}">Read the breastfeeding guide</a>.</p></div>` : ""}
        ${isChild ? `<div class="notice note-card">${icon("shield", "icon info-icon")}<p><strong>For children, please ask your pediatrician before giving any herb.</strong> Fruits and healthy habits are the safest place to start. <a href="${safetyUrl("children")}">Read the children's guide</a>.</p></div>` : ""}
      </div>

      <div class="card"><h3 class="plan-h">${n++}. Start with these habits</h3><ul class="check-list">${g.lifestyle.slice(0, 3).map((t) => `<li>${icon("check")}${t}</li>`).join("")}</ul></div>

      <div class="card"><h3 class="plan-h">${n++}. Foods to focus on</h3><p class="muted">Food is the foundation — build your meals around these.</p><div class="herb-grid editorial-grid">${[...foods.map((k) => cardFor(k)), ...fruits.slice(0, 8 - foods.length).map((id) => fruitCard(FRUITS.find((f) => f.id === id)))].join("")}</div></div>

      ${remedies.length ? `<div class="card"><h3 class="plan-h">${n++}. Simple natural remedies</h3><div class="recipe-grid">${remedies.map(remedyCard).join("")}</div></div>` : ""}

      ${top.length ? `<div class="card"><h3 class="plan-h">${n++}. Herbs that may help</h3>${top.map(herbCardPlan).join("")}
        ${more.length ? `<p class="plan-more"><strong>Also worth a look:</strong> ${more.map((id) => `<a class="ix-chip" href="${herbUrl(id)}">${findHerb(id).name}${levelFor(id) === "caution" ? " (caution)" : ""}</a>`).join(" ")}</p>` : ""}
      </div>` : `<div class="card"><h3 class="plan-h">${n++}. Herbs</h3><p>We couldn't find an herb for this goal that's a good fit for your situation. Please talk with your doctor or pharmacist about safe options.</p></div>`}

      ${stacks.length && !isChild ? `<div class="card"><h3 class="plan-h">${n++}. An herbal stack to consider</h3><div class="stack-grid">${stacks.map(stackCard).join("")}</div></div>` : ""}

      ${leftOut.length ? `<div class="card"><h3 class="plan-h">Left out for your safety</h3><ul class="ix-list">${leftOut.map((k) => `<li class="ix-avoid"><span class="ix-badge">Avoid</span><span><a href="${itemUrl(k)}"><strong>${itemName(k)}</strong></a> — ${hitsFor(k).filter((x) => x.level === "avoid").map((x) => `${x.e.label}: ${x.note}`).join(" ")}</span></li>`).join("")}</ul></div>` : ""}


      <section class="verse-band plan-verse"><blockquote><p>“${g.verse.text}”</p><cite>${g.verse.ref} (${BIBLE_VERSION})</cite></blockquote></section>

      <div class="btn-row center-row plan-actions">
        <button class="btn btn-primary" data-print>Print my plan</button>
        <button class="btn btn-secondary" data-restart>Start over</button>
        <a class="btn btn-secondary" href="${guideUrl(g.id)}">Read the full ${g.short.toLowerCase()} guide</a>
      </div>
      <p class="small muted center">These suggestions are for education only and are not medical advice. Please check with your doctor or pharmacist before starting any herb, especially if you take medicine.</p>
    </div>`;
    const d = new Date();
    store.set("bp-plan", { ...a, top, fruits, date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` });
    app.querySelector("[data-print]").addEventListener("click", () => window.print());
    app.querySelector("[data-restart]").addEventListener("click", () => { Object.assign(a, { goal: null, duration: null, who: null, drugs: [], meds: [], conds: [], form: null }); step = 0; show(); });
    app.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const saved = store.get("bp-plan", null);
  if (params.get("plan") === "saved" && saved && TOPIC_GUIDES.some((g) => g.id === saved.goal) && WHO_OPTIONS.some((w) => w.id === saved.who)) {
    ["goal", "duration", "who", "drugs", "meds", "conds", "form"].forEach((k) => { if (k in saved) a[k] = saved[k]; });
    return results();
  }
  const preset = params.get("goal");
  if (TOPIC_GUIDES.some((g) => g.id === preset)) { a.goal = preset; step = 1; }
  show();
}

/* ---------------- Herbs & fruits of the Bible ---------------- */
function initBible() {
  $("#bible-intro").innerHTML = `<blockquote><p>“${BIBLE_INTRO.text.replace(/^Then God said, "|"$/g, "")}”</p><cite>${BIBLE_INTRO.ref} (${BIBLE_VERSION})</cite></blockquote>`;
  const linkFor = (l) => l.herb
    ? { url: herbUrl(l.herb), name: findHerb(l.herb).name, vis: visual(findHerb(l.herb)) }
    : (() => { const f = FRUITS.find((x) => x.id === l.fruit); return { url: fruitUrl(f.id), name: f.name, vis: fruitVisual(f) }; })();
  const card = (b) => {
    const links = [b.link, ...(b.extra || [])].map(linkFor);
    return `<article class="bible-card">
      <a class="bible-art" href="${links[0].url}">${links[0].vis}</a>
      <div class="bible-body">
        <p class="eyebrow">${b.ref}</p>
        <h3>${b.name}</h3>
        <blockquote>“${b.verse}”</blockquote>
        <p class="muted">${b.note}</p>
        ${BIBLE_REFLECTIONS[b.name] ? `<p class="bible-reflect">${icon("leaf")}<span><strong>Reflect:</strong> ${BIBLE_REFLECTIONS[b.name]}</span></p>` : ""}
        <div class="bible-links">${links.map((l) => `<a class="ix-chip" href="${l.url}">${l.name} ${icon("arrow")}</a>`).join("")}</div>
      </div>
    </article>`;
  };
  $("#bible-list").innerHTML = `
    <div class="section-head"><div><p class="eyebrow">${BIBLE_PLANTS.filter((b) => b.kind === "herb").length} passages</p><h2>Herbs in Scripture</h2></div></div>
    ${BIBLE_PLANTS.filter((b) => b.kind === "herb").map(card).join("")}
    <div class="section-head bible-fruit-head"><div><p class="eyebrow">${BIBLE_PLANTS.filter((b) => b.kind === "fruit").length} passages</p><h2>Fruits in Scripture</h2></div></div>
    ${BIBLE_PLANTS.filter((b) => b.kind === "fruit").map(card).join("")}
    <p class="small muted bible-copyright">${BIBLE_COPYRIGHT}</p>`;
}


/* ---------------- Scripture cards (herb & fruit pages) ---------------- */
function scriptureCard(kind, item) {
  const entry = bibleEntryFor(kind, item.id);
  const verse = entry ? { text: entry.verse, ref: entry.ref } : CATEGORY_VERSES[item.cats.find((c) => CATEGORY_VERSES[c])] || CATEGORY_VERSES.kitchen;
  return `<section id="scripture" class="scripture scripture-card">
    <p class="eyebrow">${entry ? `${item.name.split(" (")[0]} in the Bible` : "A verse to carry with you"}</p>
    <blockquote>“${verse.text}”</blockquote>
    <cite>${verse.ref} (${BIBLE_VERSION})</cite>
    ${entry ? `<p class="scripture-note">${entry.note}</p>` : ""}
    <a class="text-link" href="bible.html">Herbs &amp; fruits of the Bible ${icon("arrow")}</a>
  </section>`;
}

/* ---------------- Trivia quiz ---------------- */
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}


/* ---------------- Wellness & safety guides ---------------- */
const guideUrl = (id) => `finder.html?goal=${id}`; // each wellness goal opens the "What should I eat?" planner
const SAFETY_WHO = { pregnancy: "preg1", breastfeeding: "breastfeeding", children: "child", "older-adults": "senior" };
const safetyUrl = (id) => SAFETY_WHO[id] ? `interactions.html?who=${SAFETY_WHO[id]}` : "interactions.html";

function doseLine(id) {
  const c = CAPS[id];
  if (!c) return "";
  if (Array.isArray(c.cap)) return `Capsule: ${range(c.cap[0], c.cap[1], "mg")}, ${c.cap[3].toLowerCase()}`;
  if (c.herb && typeof c.herb[0] === "number") return `Herb: ${range(c.herb[0], c.herb[1], "g")} — ${c.herb[2].toLowerCase()}, ${c.herb[3].toLowerCase()}`;
  return "";
}


const guideFoods = (g) => FOODS.filter((fd) => fd.goals.includes(g.id));



/* ---------------- About ---------------- */
function initAbout() {
  $("#about-art").innerHTML = ["bread-linen", "lemons-basket", "dahlia-jars"].map((slot, i) =>
    `<div class="about-art-${i}">${scene(slot, "print", "(max-width: 900px) 70vw, 30vw")}</div>`).join("");

  const form = $("#contact-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    if (SITE.contactEndpoint) {
      postForm(SITE.contactEndpoint, data).then((ok) => {
        toast(ok ? "Thank you! Your message has been sent." : "Sorry, something went wrong. Please try again.");
        if (ok) form.reset();
      });
      return;
    }
    if (!SITE.email) {
      toast("Thank you! Our contact form is coming soon.");
      form.reset();
      return;
    }
    const subject = encodeURIComponent(`[Beauty & Praise] ${data.get("topic")}`);
    const bodyText = encodeURIComponent(`${data.get("message")}\n\n— ${data.get("name")} (${data.get("email")})`);
    location.href = `mailto:${SITE.email}?subject=${subject}&body=${bodyText}`;
  });
}

/* ---------------- Recipes ---------------- */






// A calendar file with a weekly repeating reminder (works with Apple, Google and Outlook calendars).


/* ---------------- My Plan ---------------- */

/* ---------------- Foods, fruits & remedies: shared cards ---------------- */
const foodCat = (id) => FOOD_CATEGORIES.find((c) => c.id === id);

function foodCard(fd) {
  const key = "food:" + fd.id;
  const saved = favorites.has(key);
  return `<article class="herb-card editorial-item">
    <a href="${foodUrl(fd.id)}" class="herb-card-link" aria-label="${fd.name}">
      <div class="herb-card-art editorial-image">${foodVisual(fd)}</div>
      <div class="herb-card-body">
        <p class="herb-card-cat editorial-meta">${foodCat(fd.cats[0]).label}</p>
        <h3>${fd.name}</h3>
        <p class="latin">${FOOD_GROUPS[fd.group]}</p>
        <p class="herb-card-summary">${fd.what.split(/(?<=\.)\s/)[0]}</p>
      </div>
    </a>
    <button class="fav-btn${saved ? " saved" : ""}" data-fav="${key}" aria-pressed="${saved}" aria-label="Save ${fd.name} to favorites">${icon("heart")}</button>
  </article>`;
}

// A card for any herb, fruit or food key.
function cardFor(key) {
  const it = itemOf(key);
  if (!it) return "";
  return key.startsWith("fruit:") ? fruitCard(it) : key.startsWith("food:") ? foodCard(it) : herbCard(it);
}

// Foods and fruits that belong to a food category (foods first).
function foodCatItems(catId) {
  return [...FOODS.filter((fd) => fd.cats.includes(catId)).map((fd) => "food:" + fd.id),
    ...FRUITS.filter((fr) => foodCatsOf(fr, "fruit").includes(catId)).map((fr) => "fruit:" + fr.id)];
}

function foodCatCard(c) {
  const keys = foodCatItems(c.id);
  return `<a class="guide-card" href="foods.html?cat=${c.id}">
    <span class="guide-photos">${keys.slice(0, 3).map((k) => `<span class="mini-art">${keyVisual(k)}</span>`).join("")}</span>
    <h3>${c.label}</h3>
    <p>${c.text}</p>
    <span class="text-link">Explore ${icon("arrow")}</span>
  </a>`;
}

function remedyVisual(r, large = false) {
  return r.items.length ? keyVisual(r.items[0], large) : `<span class="pf pf-icon" role="img" aria-label="${r.name}">${icon(REMEDY_CATS[r.cat].icon)}</span>`;
}

function remedyCatCard(id) {
  const c = REMEDY_CATS[id], list = REMEDIES.filter((r) => r.cat === id);
  return `<a class="guide-card" href="remedies.html?cat=${id}">
    <span class="guide-photos">${list.slice(0, 3).map((r) => `<span class="mini-art">${remedyVisual(r)}</span>`).join("")}</span>
    <h3>${c.label}</h3>
    <p>${c.text}</p>
    <span class="text-link">${list.length} ${list.length === 1 ? "remedy" : "remedies"} ${icon("arrow")}</span>
  </a>`;
}

function remedyCard(r) {
  return `<a class="recipe-card" href="${remedyUrl(r.id)}">
    <span class="recipe-photo">${remedyVisual(r)}</span>
    <span class="recipe-body">
      <span class="recipe-type">${REMEDY_CATS[r.cat].label}</span>
      <strong>${r.name}</strong>
      <span class="recipe-meta">${icon("clock")} ${r.time} · <span class="evidence ev-${r.evidence[0]}">${EVIDENCE[r.evidence[0]].label}</span></span>
    </span>
  </a>`;
}

function remedySection(list, title = "Natural remedies to try") {
  return list.length ? `<div class="section-head stack-head"><div><p class="eyebrow">Simple home remedies</p><h2>${title}</h2></div><a class="text-link" href="remedies.html">All remedies ${icon("arrow")}</a></div>
    <div class="recipe-grid">${list.map(remedyCard).join("")}</div>` : "";
}

const sourceList = (refs) => `<ol class="source-list">${refs.map(([label, url]) => `<li><a href="${url}" target="_blank" rel="noopener">${label}</a></li>`).join("")}</ol>`;

/* ---------------- Food library ---------------- */
// Foods page (foods.html holds the editorial layout; this fills its pictures and runs the food guide).
function initFoods() {
  paintFoodArt();
  const state = { cat: foodCat(params.get("cat")) ? params.get("cat") : "all", q: params.get("q") || "" };
  $("#food-chips").innerHTML = FOOD_CATEGORIES.map((c, i) => `<button class="fd-cat" type="button" data-cat="${c.id}"><span class="fd-cat-n">${String(i + 1).padStart(2, "0")}</span><span class="fd-cat-t">${c.label}</span><span class="fd-cat-d">${c.text}</span></button>`).join("");
  const search = $("#food-search");
  const introText = $("#food-cat-intro").textContent;
  search.value = state.q;
  function render() {
    const q = state.q.trim().toLowerCase();
    const c = foodCat(state.cat);
    let foods = q ? searchFoods(singular(q)) : [...FOODS];
    let fruits = q ? searchFruits(singular(q)) : [...FRUITS];
    if (c) { foods = foods.filter((fd) => fd.cats.includes(c.id)); fruits = fruits.filter((fr) => foodCatsOf(fr, "fruit").includes(c.id)); }
    $("#food-chips").querySelectorAll("[data-cat]").forEach((b) => b.classList.toggle("active", b.dataset.cat === state.cat));
    $("#food-list-title").textContent = c ? c.label : q ? `Foods matching “${q}”` : "Every food in the guide";
    $("#food-cat-intro").textContent = c ? c.text : introText;
    $("#food-count").textContent = `${foods.length} foods · ${fruits.length} fruits`;
    $("#food-reset").hidden = !c && !q;
    $("#food-grid").innerHTML = foods.map((f) => foodSwatch(f, "food")).join("");
    $("#food-empty").hidden = foods.length + fruits.length > 0;
    $("#food-fruits").innerHTML = fruits.length ? `<div class="fd-subhead"><h3>${c ? `Fruits for ${c.label.replace(/^Foods for /, "").toLowerCase()}` : q ? "Matching fruits" : "Fruits"}</h3></div>
      <div class="swatch-grid">${fruits.map((f) => foodSwatch(f, "fruit")).join("")}</div>` : "";
    paintSwatches();
  }
  const sync = () => history.replaceState(null, "", "foods.html" + (state.cat !== "all" ? `?cat=${state.cat}` : ""));
  const toList = () => $("#all-foods").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  $("#food-chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]"); if (!b) return;
    state.cat = state.cat === b.dataset.cat ? "all" : b.dataset.cat;
    sync(); render();
  });
  $("#food-reset").addEventListener("click", () => { state.cat = "all"; state.q = ""; search.value = ""; sync(); render(); });
  search.addEventListener("input", () => { state.q = search.value; render(); });
  render();
  if (state.cat !== "all" || state.q) requestAnimationFrame(toList);
}

// Each frame names its painting. A file uploaded as images/<name>.jpg (e.g. images/oil-berries.jpg)
// always wins, with nothing to rebuild; until then the frame hangs a lush public-domain museum oil
// painting from Wikimedia Commons, with a small plaque naming it.
// [Commons file, search for the same painting if the file is ever renamed, title, artist, year]
const PAINTINGS = {
  "oil-food-abundance": ["Jan van Huysum - Fruit Piece - Google Art Project.jpg", "Jan van Huysum fruit piece", "Fruit Piece", "Jan van Huysum", "1722"],
  "oil-berries": ["Jan Davidsz. de Heem - Still-Life with Flowers and Fruit - WGA11281.jpg", "de Heem still life flowers fruit", "Still Life with Flowers and Fruit", "Jan Davidsz. de Heem", "17th c."],
  "oil-citrus": ["Luis Egidio Meléndez - Still-Life with Oranges and Walnuts, 1772.jpg", "Meléndez oranges walnuts", "Still Life with Oranges and Walnuts", "Luis Meléndez", "1772"],
  "oil-roots": ["James Peale - Still Life with Vegetables - Google Art Project.jpg", "James Peale still life vegetables", "Still Life with Vegetables", "James Peale", "c. 1826"],
  "oil-avocado-olive": ["Jean Siméon Chardin - Still-Life with Jar of Olives - WGA04777.jpg", "Chardin jar of olives", "Still Life with Jar of Olives", "Jean-Siméon Chardin", "1760"],
  "oil-herbs": ["Rachel Ruysch - Still Life with Fruit, a Bird's Nest and Insects NTII DMS 814164.jpg", "Rachel Ruysch still life fruit", "Fruit, a Bird's Nest and Insects", "Rachel Ruysch", "c. 1710"],
  "oil-pomegranate": ["Tom Roberts, 1883 - Still life with pomegranates.jpg", "still life pomegranates painting", "Still Life with Pomegranates", "Tom Roberts", "1883"],
  "oil-honey": ["Luis Meléndez - Still Life with Oranges, Jars, and Boxes of Sweets - Google Art Project.jpg", "Meléndez oranges jars boxes of sweets", "Oranges, Jars and Boxes of Sweets", "Luis Meléndez", "1760s"],
  "oil-ginger": ["Jean Siméon Chardin - Still Life with Teapot, Grapes, Chestnuts, and a Pear - 83.177 - Museum of Fine Arts.jpg", "Chardin teapot grapes chestnuts pear", "Teapot, Grapes, Chestnuts and a Pear", "Jean-Siméon Chardin", "1764"],
  "oil-honey-lemon": ["Raphaelle Peale - Lemons and Sugar - 1946.150.1 - Reading Public Museum.jpg", "Raphaelle Peale lemons sugar", "Lemons and Sugar", "Raphaelle Peale", "c. 1822"],
  "oil-peppermint": ["Liotard, Jean-Étienne - Still Life- Tea Set - Google Art Project.jpg", "Liotard still life tea set", "Still Life: Tea Set", "Jean-Étienne Liotard", "c. 1781"],
  "oil-chamomile": ["Henri Fantin-Latour (1836-1904) - Still Life, Pansies and Daisies - WA1937.66 - Ashmolean Museum.jpg", "Fantin-Latour daisies still life", "Still Life, Pansies and Daisies", "Henri Fantin-Latour", "19th c."],
  "oil-turmeric": ["Still Life with Teapot and Fruit MET DT1027.jpg", "still life teapot fruit Metropolitan", "Still Life with Teapot and Fruit", "The Met collection", ""],
  "oil-elderberry": ["Coorte 5.jpg", "Adriaen Coorte still life", "Still Life", "Adriaen Coorte", "c. 1700"],
  "oil-garlic": ["Vincent van Gogh - Red cabbages and garlic - Google Art Project.jpg", "van Gogh red cabbages garlic", "Red Cabbages and Garlic", "Vincent van Gogh", "1887"],
  "oil-cinnamon": ["Paul Cézanne, Still Life With Apples, c. 1890.jpg", "Cézanne still life apples", "Still Life with Apples", "Paul Cézanne", "c. 1890"],
  "oil-rosemary": ["Luis Meléndez - Still Life with Fruit and Jug - Google Art Project.jpg", "Meléndez still life fruit jug", "Still Life with Fruit and Jug", "Luis Meléndez", "1760s"],
  "oil-thyme": ["Adriaen Coorte - Still Life with Wild Strawberries - 1106 - Mauritshuis.jpg", "Adriaen Coorte wild strawberries", "Still Life with Wild Strawberries", "Adriaen Coorte", "1705"],
};
// Frames painted in the browser (js/oilpaint.js) from a photograph of the food itself.
const PAINTED_FRAMES = {
  "oil-greens": { photos: ["food:spinach", "food:kale"], placard: ["Leafy Greens"] },
};
const COMMONS_API = "https://commons.wikimedia.org/w/api.php?format=json&origin=*&action=query&prop=imageinfo&iiprop=url&iiurlwidth=1000";

// Looks up every painting in one request; a file that has been renamed is found again by search.
function findPaintings(keys) {
  const file = (k) => "File:" + PAINTINGS[k][0].replace(/_/g, " ");
  const search = (k) => fetch(`${COMMONS_API}&generator=search&gsrnamespace=6&gsrlimit=1&gsrsearch=${encodeURIComponent(PAINTINGS[k][1] + " filetype:bitmap")}`)
    .then((r) => r.json())
    .then((d) => { const pg = Object.values((d.query && d.query.pages) || {})[0]; const ii = pg && pg.imageinfo && pg.imageinfo[0]; return ii ? ii.thumburl || ii.url : null; })
    .catch(() => null);
  return fetch(`${COMMONS_API}&titles=${encodeURIComponent(keys.map(file).join("|"))}`)
    .then((r) => r.json())
    .then((data) => {
      const q = data.query || {};
      const norm = Object.fromEntries((q.normalized || []).map((n) => [n.from, n.to]));
      const found = {};
      Object.values(q.pages || {}).forEach((pg) => { const ii = pg.imageinfo && pg.imageinfo[0]; if (ii) found[pg.title] = ii.thumburl || ii.url; });
      return Object.fromEntries(keys.map((k) => [k, found[norm[file(k)] || file(k)] || null]));
    })
    .catch(() => ({}))
    .then((urls) => (k) => (urls[k] ? Promise.resolve(urls[k]) : search(k)));
}

function paintFoodArt() {
  const art = typeof MY_ART !== "undefined" ? MY_ART : {};
  const frames = [...document.querySelectorAll("figure.gilt[data-art]")];
  if (!frames.length) return;
  const nameOf = (fig) => (fig.closest("[class*=card], section")?.querySelector("h3") || {}).textContent || "Beauty & Praise";
  const emptyFrame = (fig) => {
    const name = nameOf(fig).replace(/,.*$/, "");
    fig.classList.add("unhung");
    fig.innerHTML = `<div class="gilt-canvas" role="img" aria-label="${name}"><span>${name}</span></div>`;
  };
  const hang = (fig, img, placard) => {
    img.alt = `Oil painting: ${placard ? placard[0] : nameOf(fig)}`;
    fig.innerHTML = `<div class="gilt-canvas"></div>` + (placard ? `<figcaption class="placard"><em>${placard[0]}</em></figcaption>` : "");
    fig.firstChild.append(img);
    fig.classList.add("hung");
  };
  const load = (src, ok, fail) => {
    const img = new Image();
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.onload = () => ok(img);
    img.onerror = fail;
    img.src = src;
  };
  const lookup = findPaintings(frames.map((f) => f.dataset.art).filter((k) => PAINTINGS[k]));
  frames.forEach((fig) => {
    const key = fig.dataset.art;
    const museum = () => {
      const painted = PAINTED_FRAMES[key];
      if (painted) {
        return Photos.load(painted.photos)
          .then((map) => { const p = painted.photos.map((k) => map[k]).find(Boolean); if (!p) throw 0; const big = p.src.replace(/\/(\d+)px-/, "/1280px-"); return OilPaint.paint(big, 1000, 750).catch(() => OilPaint.paint(p.src, 1000, 750)); })
          .then((url) => load(url, (img) => hang(fig, img, painted.placard), () => emptyFrame(fig)))
          .catch(() => emptyFrame(fig));
      }
      if (!PAINTINGS[key]) return emptyFrame(fig);
      lookup.then((get) => get(key)).then((url) => url ? load(url, (img) => hang(fig, img, PAINTINGS[key].slice(2)), () => emptyFrame(fig)) : emptyFrame(fig));
    };
    load(art[key] || `images/${key}.jpg`, (img) => hang(fig, img, null), museum);
  });
}

/* ---------------- Food & fruit pages (one shared layout) ---------------- */
function renderFoodProfile(p, main) {
  const isFruit = p.kind === "fruit";
  const list = isFruit ? [...FRUITS] : [...FOODS];
  const sorted = list.sort((a, b) => a.name.localeCompare(b.name));
  const idx = sorted.findIndex((x) => x.id === p.id);
  const prev = sorted[(idx - 1 + sorted.length) % sorted.length], next = sorted[(idx + 1) % sorted.length];
  const pageUrl = isFruit ? fruitUrl : foodUrl;
  const related = list.filter((x) => x.id !== p.id && foodCatsOf(x, p.kind).some((c) => p.foodCats.includes(c)))
    .sort((a, b) => foodCatsOf(b, p.kind).filter((c) => p.foodCats.includes(c)).length - foodCatsOf(a, p.kind).filter((c) => p.foodCats.includes(c)).length).slice(0, 4);
  const saved = favorites.has(p.key);
  const [servingText, servingG] = p.serving;
  const short = p.name.split(" (")[0];
  const recipes = [];
  const remedies = REMEDIES.filter((r) => r.items.includes(p.key));
  const vis = isFruit ? fruitVisual(p, true) : foodVisual(p, true);
  const toc = [["what", "What it is"], ["nutrients", "Key nutrients"], ["benefits", "Potential benefits"], ["use", "Best ways to eat it"], ["amount", "Serving & when to eat"],
    ["who", "Who may benefit"], ["downsides", "Possible downsides"], ["safety", "Allergies & interactions"], ["pregnancy", "Pregnancy & breastfeeding"], ...(p.pick ? [["store", "Choosing & storing"]] : []), ["sources", "Sources"]];

  main.innerHTML = `
    <section class="herb-hero">
      <div class="container">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><a href="foods.html">Foods</a><span>/</span><span aria-current="page">${p.name}</span></nav>
        <div class="herb-hero-grid">
          <figure class="herb-hero-figure">
            <div class="herb-hero-art arch">${vis}</div>
            <figcaption class="photo-credit" id="photo-credit"></figcaption>
          </figure>
          <div class="herb-hero-copy">
            <div class="tag-row">${p.foodCats.map((c) => `<a class="tag" href="foods.html?cat=${c}">${foodCat(c).label}</a>`).join("")}</div>
            <h1>${p.name}</h1>
            <p class="latin big">${p.sub}</p>
            <p class="lead">${(isFruit ? p.summary : p.what).split(/(?<=\.)\s/)[0]}</p>
            <dl class="facts">
              ${isFruit ? `<div><dt>Botanical family</dt><dd>${p.family}</dd></div><div><dt>In season</dt><dd>${p.season}</dd></div>` : `<div><dt>Food group</dt><dd>${FOOD_GROUPS[p.group]}</dd></div>`}
              <div><dt>Typical serving</dt><dd>${servingText}</dd></div>
            </dl>
            <div class="herb-actions">
              <button class="btn btn-primary fav-inline${saved ? " saved" : ""}" data-fav="${p.key}" aria-pressed="${saved}">${icon("heart")}<span>Save</span></button>
              <button class="btn btn-secondary" onclick="window.print()">${icon("print")}<span>Print guide</span></button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container herb-layout">
        <aside class="toc">
          <p class="eyebrow">On this page</p>
          <ul>${toc.map(([id, l]) => `<li><a href="#${id}">${l}</a></li>`).join("")}</ul>
        </aside>
        <article class="prose">
          <section id="what" class="glance">
            <p class="eyebrow">What it is</p>
            <p class="glance-text">${p.what}</p>
            ${isFruit ? `<p>${p.summary}</p>` : ""}
          </section>
          <section id="nutrients"><h2>Key nutrients</h2>
            <div class="nutrient-chips">${p.nutrients.map((n) => `<span class="nutrient">${n}</span>`).join("")}</div>
            <p class="small muted">Amounts are approximate and vary by variety, size and preparation.</p>
          </section>
          <section id="benefits"><h2>Potential benefits</h2>
            <div class="benefit-list">${p.benefits.map(([e, t, d]) => `
              <div class="benefit">
                <div class="benefit-head"><h3>${t}</h3><span class="evidence ev-${e}" title="${EVIDENCE[e].note}">${EVIDENCE[e].label}</span></div>
                <p>${d}</p>
              </div>`).join("")}
            </div>
            <p class="small muted">Foods may support health as part of an overall healthy way of eating. They don't cure or prevent disease on their own.</p>
          </section>
          ${scriptureCard(p.kind, p)}
          <section id="use"><h2>Best ways to eat it</h2>
            <ul class="check-list">${p.uses.map((u) => `<li>${icon("check")}${u}</li>`).join("")}</ul>
          </section>
          <section id="amount"><h2>Typical serving &amp; when to eat it</h2>
            <div class="quick-doses">
              <div class="qd-card">
                <div class="qd-head"><span class="qd-icon">${icon("leaf")}</span><div><p class="eyebrow">Typical serving</p><p class="qd-per">Per person</p></div></div>
                <p class="qd-amount qd-text">${servingText}</p>
                <p class="qd-units">${range(servingG, servingG, "g")} · ${range(servingG / OZ, servingG / OZ, "oz")}</p>
                ${isFruit ? `<p class="qd-freq">${icon("check")}Most adults do well with about 2 servings of fruit a day as part of a varied diet.</p>` : ""}
              </div>
              <div class="qd-card">
                <div class="qd-head"><span class="qd-icon">${icon("clock")}</span><div><p class="eyebrow">When to eat it</p><p class="qd-per">Timing tips</p></div></div>
                <p class="qd-when">${p.when}</p>
              </div>
            </div>
          </section>
          <section id="who"><h2>Who may benefit</h2>
            <ul class="check-list">${p.who.map((w) => `<li>${icon("check")}${w}</li>`).join("")}</ul>
          </section>
          <section id="downsides"><h2>Possible downsides</h2>
            <ul class="doctor-list">${p.downsides.map((d) => `<li>${d}</li>`).join("")}</ul>
          </section>
          <section id="safety"><h2>Allergies &amp; interactions</h2>
            ${p.allergies ? `<div class="caution-card">${icon("shield", "icon info-icon")}<div><p>${p.allergies}</p></div></div>` : ""}
            <h3 class="ix-title">Medicines &amp; health situations to watch</h3>
            ${interactionList(p.key)}
            <a class="text-link" href="interactions.html?item=${p.key}">Check with your medicines ${icon("arrow")}</a>
          </section>
          <section id="pregnancy"><h2>Pregnancy &amp; breastfeeding</h2>
            <div class="info-card">${icon("flower", "icon info-icon")}<p>${p.pregnancy}</p></div>
          </section>
          ${p.pick ? `<section id="store"><h2>Choosing &amp; storing</h2><div class="info-card">${icon("pot", "icon info-icon")}<p>${p.pick}</p></div></section>` : ""}
          <section id="sources"><h2>Sources &amp; references</h2>
            ${sourceList(p.refs)}
            <p class="small muted">For general education, not medical advice. Ask your doctor or a registered dietitian about your own needs, especially if you take medicine, are pregnant or follow a special diet.</p>
          </section>
        </article>
      </div>
    </section>

    <section class="section section--cream section-tint">
      <div class="container">
        ${remedySection(remedies, `Remedies with ${short}`)}
        <div class="section-head${recipes.length || remedies.length ? " stack-head" : ""}"><div><p class="eyebrow">Keep exploring</p><h2>Related ${isFruit ? "fruits" : "foods"}</h2></div>
          <a class="text-link" href="foods.html?cat=${p.foodCats[0]}">More ${foodCat(p.foodCats[0]).label.toLowerCase()} ${icon("arrow")}</a></div>
        <div class="herb-grid editorial-grid">${related.map(isFruit ? fruitCard : foodCard).join("")}</div>
        <nav class="prev-next">
          <a href="${pageUrl(prev.id)}"><span>← Previous</span><strong>${prev.name}</strong></a>
          <a href="${pageUrl(next.id)}"><span>Next →</span><strong>${next.name}</strong></a>
        </nav>
      </div>
    </section>`;

  Photos.credit(p.key).then((c) => {
    const el = $("#photo-credit");
    if (!c || !el) return;
    if (c.text) { el.textContent = c.text; return; }
    el.innerHTML = `Photo: <span></span> · <a target="_blank" rel="noopener"></a>`;
    el.querySelector("span").textContent = c.artist;
    const a = el.querySelector("a");
    a.href = c.url;
    a.textContent = c.license ? `${c.license} via Wikimedia Commons` : "Wikimedia Commons";
  });
}

function notFound(main, what, href, label) {
  main.innerHTML = `<section class="section"><div class="container narrow center"><h1>${what} not found</h1><p class="lead">We couldn't find that page.</p><a class="btn btn-primary" href="${href}">${label}</a></div></section>`;
}

function initFood() {
  const fd = findFood(document.body.dataset.id || params.get("id"));
  if (!fd) return notFound($("#food-main"), "Food", "foods.html", "Browse the food library");
  renderFoodProfile(foodProfile(fd, "food", INTERACTIONS), $("#food-main"));
}

/* ---------------- Natural remedies ---------------- */
function initRemedies() {
  let cat = REMEDY_CATS[params.get("cat")] ? params.get("cat") : "all";
  document.body.classList.add("remedies-page");
  $("#remedies-main").innerHTML = `
    <section class="remedies-hero">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><span aria-current="page">Natural Remedies</span></nav>
      <span class="art-food-label">THE NATURAL CABINET</span>
      <h1>Natural <em>Remedies</em></h1>
      <p class="remedies-lead">Simple home and food-based remedies for everyday wellness needs — with exact amounts, how often to use them, how strong the evidence is, and when to see a doctor instead.</p>
    </section>
    <div class="remedy-filters" id="remedy-chips">${[["all", "All remedies"], ...Object.entries(REMEDY_CATS).map(([k, c]) => [k, c.label])].map(([k, l]) => `<button type="button" data-cat="${k}">${l}</button>`).join("")}</div>
    <div id="remedy-intro"></div>
    <section class="remedy-gallery" id="remedy-grid"></section>
    <section class="art-scripture">
      <blockquote>“Do not be wise in your own eyes; fear the LORD and turn away from evil. It will be healing to your body and refreshment to your bones.”</blockquote>
      <cite>PROVERBS 3:7–8 · NASB 1995</cite>
    </section>
    <section class="remedy-note-wrap">
      <div class="notice note-card food-note">${icon("shield", "icon info-icon")}<p><strong>Home remedies are for mild, everyday symptoms.</strong> They may help you feel more comfortable, but they don't replace medical care. Each remedy lists warning signs that mean it's time to call a doctor — and in an emergency, call 911.</p></div>
    </section>`;
  const draw = () => {
    $("#remedy-chips").querySelectorAll("[data-cat]").forEach((b) => b.classList.toggle("active", b.dataset.cat === cat));
    const c = REMEDY_CATS[cat];
    const guide = c && TOPIC_GUIDES.find((g) => g.id === c.guide);
    $("#remedy-intro").innerHTML = c ? `<div class="remedy-cat-intro"><span class="art-food-label">NATURAL REMEDIES</span><h2>${c.label}</h2><p>${c.text}</p>${guide ? `<a class="text-link" href="${guideUrl(guide.id)}">${guide.short} guide ${icon("arrow")}</a>` : ""}</div>` : "";
    $("#remedy-grid").innerHTML = REMEDIES.filter((r) => cat === "all" || r.cat === cat).map(remedyArtCard).join("");
  };
  $("#remedy-chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]"); if (!b) return;
    cat = b.dataset.cat;
    history.replaceState(null, "", cat === "all" ? "remedies.html" : `remedies.html?cat=${cat}`);
    draw();
  });
  draw();
}

// A remedy as a colored card: words only, no picture (colors come from the card's position).
function remedyArtCard(r) {
  const [ev] = r.evidence;
  return `<a class="remedy-art-card no-art" href="${remedyUrl(r.id)}">
    <div class="remedy-art-copy">
      <small>${REMEDY_CATS[r.cat].label.toUpperCase()}</small>
      <h3>${r.name}</h3>
      <p>${r.intro.split(/(?<=\.)\s/)[0]}</p>
      <p class="remedy-art-meta">${icon("clock")} ${r.time} · <span class="evidence ev-${ev}">${EVIDENCE[ev].label}</span></p>
    </div>
  </a>`;
}

// A food or fruit as a colored card for the Foods page guide: words only, no photograph.
// Each card in the food guide shows its own food as an oil painting (js/oilpaint.js), painted
// from the food's photograph as the card scrolls into view. No photo, no painting: the card keeps its color.
let swatchWatch;
function paintSwatches() {
  if (typeof OilPaint === "undefined") return;
  const paintOne = (el) => {
    el.dataset.state = "loading";
    Photos.load([el.dataset.paint])
      .then((map) => { const p = map[el.dataset.paint]; if (!p) throw 0; return /^https?:/.test(p.src) ? OilPaint.paint(p.src, 480, 360) : p.src; })
      .then((url) => { el.innerHTML = `<img src="${url}" alt="">`; el.dataset.state = "painted"; })
      .catch(() => { el.dataset.state = "none"; });
  };
  swatchWatch = swatchWatch || ("IntersectionObserver" in window
    ? new IntersectionObserver((list) => list.forEach((e) => { if (e.isIntersecting) { swatchWatch.unobserve(e.target); paintOne(e.target); } }), { rootMargin: "300px 0px" })
    : null);
  document.querySelectorAll(".swatch-art[data-paint]:not([data-state])").forEach((el) => (swatchWatch ? swatchWatch.observe(el) : paintOne(el)));
}

function foodSwatch(item, kind) {
  const isFruit = kind === "fruit";
  const href = isFruit ? fruitUrl(item.id) : foodUrl(item.id);
  const label = isFruit ? (CATEGORIES[item.cats[0]] || "Fruit") : foodCat(item.cats[0]).label;
  const sub = isFruit ? item.latin : FOOD_GROUPS[item.group];
  const text = (isFruit ? item.summary : item.what).split(/(?<=\.)\s/)[0];
  return `<a class="food-swatch" href="${href}"><span class="swatch-art" data-paint="${kind}:${item.id}" aria-hidden="true"></span><small>${label}</small><strong>${item.name}</strong><em>${sub}</em><span>${text}</span></a>`;
}

function initRemedy() {
  const r = findRemedy(document.body.dataset.id || params.get("id"));
  const main = $("#remedy-main");
  if (!r) return notFound(main, "Remedy", "remedies.html", "Browse natural remedies");
  const c = REMEDY_CATS[r.cat];
  const guide = TOPIC_GUIDES.find((g) => g.id === c.guide);
  const recipe = null;
  const more = REMEDIES.filter((x) => x !== r && x.cat === r.cat).concat(REMEDIES.filter((x) => x !== r && x.cat !== r.cat && REMEDY_CATS[x.cat].guide && REMEDY_CATS[x.cat].guide === c.guide)).slice(0, 4);
  const [ev, evText] = r.evidence;
  const refs = r.sources.map((k) => REMEDY_SOURCES[k]).filter(Boolean);
  main.innerHTML = `
    <section class="stack-hero">
      <div class="container">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><a href="remedies.html">Natural Remedies</a><span>/</span><a href="remedies.html?cat=${r.cat}">${c.label}</a><span>/</span><span aria-current="page">${r.name}</span></nav>
        <div class="stack-hero-grid">
          <div>
            <p class="eyebrow">Natural remedy · ${c.label}</p>
            <h1>${r.name}</h1>
            <p class="lead">${r.intro}</p>
            <div class="recipe-facts"><span>${icon("clock")} ${r.time}</span><span class="evidence ev-${ev}" title="${EVIDENCE[ev].note}">Evidence: ${EVIDENCE[ev].label}</span></div>
            <button class="btn btn-secondary" data-print>${icon("print")} Print remedy</button>
          </div>
          <div class="stack-hero-photos">${r.items.length ? r.items.slice(0, 4).map((k, i) => `<a href="${itemUrl(k)}" class="shp shp-${i}">${keyVisual(k, i === 0)}</a>`).join("") : `<div class="shp shp-0">${remedyVisual(r, true)}</div>`}</div>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container recipe-layout">
        <aside class="card recipe-ingredients">
          <h2>Ingredients</h2>
          <ul class="ingredient-list">${r.ingredients.map(([amt, item], i) => `<li><input type="checkbox" id="ing-${i}"><label for="ing-${i}"><strong>${amt}</strong> ${item}</label></li>`).join("")}</ul>
          <div class="remedy-dose">
            <p class="eyebrow">Suggested amount</p><p>${r.amount}</p>
            <p class="eyebrow">How often</p><p>${r.often}</p>
          </div>
        </aside>
        <div class="recipe-steps-col">
          <h2>What it may help with</h2>
          <ul class="check-list">${r.helps.map((t) => `<li>${icon("check")}${t}</li>`).join("")}</ul>
          <h2>How to make it</h2>
          <ol class="recipe-steps">${r.steps.map((t) => `<li>${t}</li>`).join("")}</ol>
          <h2>Evidence level</h2>
          <div class="benefit"><div class="benefit-head"><h3>How strong is the evidence?</h3><span class="evidence ev-${ev}">${EVIDENCE[ev].label}</span></div><p>${evText}</p><p class="small muted">${EVIDENCE[ev].note}</p></div>
          <h2>Safety warnings</h2>
          <div class="caution-card">${icon("shield", "icon info-icon")}<div><ul class="plain-list">${r.safety.map((t) => `<li>${t}</li>`).join("")}</ul>
            ${r.items.length ? `<p class="small">Taking medicine, pregnant or have allergies? <a href="interactions.html?item=${r.items[0]}">Check it with the safety checker</a>.</p>` : ""}</div></div>
          <h2>When to seek medical care instead</h2>
          <p class="muted">A home remedy isn't the right choice if you notice any of these. In an emergency, call 911.</p>
          <ul class="doctor-list">${r.seekCare.map((t) => `<li>${t}</li>`).join("")}</ul>
          ${r.items.length || guide || recipe ? `<h2>Learn more</h2>
          <div class="bible-links">${r.items.map((k) => `<a class="ix-chip" href="${itemUrl(k)}">${itemName(k)} ${icon("arrow")}</a>`).join("")}${guide ? `<a class="ix-chip" href="${guideUrl(guide.id)}">Guide: ${guide.short} ${icon("arrow")}</a>` : ""}</div>` : ""}
          ${refs.length ? `<h2>Sources</h2>${sourceList(refs)}` : ""}
          <p class="small muted">For general education, not medical advice. Home remedies may help with comfort for mild symptoms; they do not cure illness.</p>
        </div>
      </div>
    </section>
    <section class="section section--cream section-tint">
      <div class="container">${remedySection(more, "More remedies")}</div>
    </section>`;
  $("#remedy-main [data-print]").addEventListener("click", () => window.print());
}

({ home: initHome, herbs: initHerbs, fruit: initFruit, interactions: initInteractions, finder: initFinder, bible: initBible, stacks: initStacks, herb: initHerb, living: initLiving, about: initAbout, foods: initFoods, food: initFood, remedies: initRemedies, remedy: initRemedy })[document.body.dataset.page]?.();
decorateArt();
