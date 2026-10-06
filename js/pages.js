// Page-specific behaviour. Each page sets <body data-page="..."> to pick its initializer.

const params = new URLSearchParams(location.search);
const $ = (sel, root = document) => root.querySelector(sel);

const CATEGORY_ICONS = {
  calming: "leaf", sleep: "moon", digestion: "cup", immunity: "shield", respiratory: "leaf",
  skin: "drop", heart: "heart", energy: "sun", women: "leaf", men: "leaf", aches: "leaf", kitchen: "pot"
};

function articleCard(a, big = false) {
  const h = findHerb(a.herb);
  return `<article class="article-card${big ? " article-card-big" : ""}">
    <a href="journal.html?a=${a.id}">
      <div class="article-art">${visual(h)}</div>
      <div class="article-body">
        <p class="meta"><span>${a.category}</span> · ${formatDate(a.date)} · ${a.read} min read</p>
        <h3>${a.title}</h3>
        <p>${a.excerpt}</p>
        <span class="text-link">Read article ${icon("arrow")}</span>
      </div>
    </a>
  </article>`;
}

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
  const featured = dailyPick(HERBS);
  const side = [dailyPick(HERBS, 37), dailyPick(HERBS, 71)];
  $("#hero-art").innerHTML = `
    <a class="arch arch-main" href="${herbUrl(featured.id)}">${visual(featured, true)}<span class="arch-label">Herb of the day · ${featured.name}</span></a>
    <a class="arch-circle c1" href="${herbUrl(side[0].id)}" aria-label="${side[0].name}">${visual(side[0])}</a>
    <a class="arch-circle c2" href="${herbUrl(side[1].id)}" aria-label="${side[1].name}">${visual(side[1])}</a>`;

  attachSearch($("#hero-search"), $("#hero-suggest"));

  $("#need-grid").innerHTML = TOPIC_GUIDES.map((g) => `<a class="need-tile" href="${guideUrl(g.id)}">
    <span class="category-icon">${icon(g.icon)}</span><span class="need-name">${g.short}</span></a>`).join("");
  $("#safety-links").innerHTML = SAFETY_GUIDES.map((g) => `<a href="${safetyUrl(g.id)}">${g.short}</a>`).join(" · ");

  $("#feature").innerHTML = `
    <div class="feature-art">${visual(featured, true)}</div>
    <div class="feature-copy">
      <p class="eyebrow">Herb of the day</p>
      <h2>${featured.name}</h2>
      <p class="latin">${featured.latin}</p>
      <p class="lead">${SUMMARY[featured.id]}</p>
      <a class="btn btn-primary" href="${herbUrl(featured.id)}">Read the full profile</a>
    </div>`;

  const herbs = ["chamomile", "ginger", "turmeric", "elderberry"].map((id) => herbCard(findHerb(id)));
  const fruits = ["blueberry", "pomegranate", "kiwi", "avocado"].map((id) => fruitCard(FRUITS.find((f) => f.id === id)));
  $("#popular-grid").innerHTML = herbs.concat(fruits).join("");

  const verse = dailyPick(VERSES);
  $("#verse-band").innerHTML = `<blockquote><p>“${verse.text}”</p><cite>${verse.ref} (${BIBLE_VERSION})</cite></blockquote>`;

  $("#journal-grid").innerHTML = ARTICLES.slice(0, 3).map((a) => articleCard(a)).join("");
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
              <button class="btn btn-outline" onclick="window.print()">${icon("print")}<span>Print profile</span></button>
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

    <section class="section section-tint">
      <div class="container">
        <div class="section-head"><div><p class="eyebrow">Keep exploring</p><h2>Related herbs</h2></div>
          <a class="text-link" href="herbs.html?cat=${h.cats[0]}">More ${CATEGORIES[h.cats[0]]} ${icon("arrow")}</a></div>
        <div class="herb-grid">${related.map(herbCard).join("")}</div>
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
  let tip = Math.floor(Math.random() * REMINDERS.length);
  const showTip = () => {
    tipText.classList.remove("fade");
    void tipText.offsetWidth;
    tipText.textContent = REMINDERS[tip];
    tipText.classList.add("fade");
  };
  $("#next-tip").addEventListener("click", () => { tip = (tip + 1) % REMINDERS.length; showTip(); });
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
function initJournal() {
  const a = ARTICLES.find((x) => x.id === params.get("a"));
  const main = $("#journal-main");
  if (!a) {
    const [first, ...rest] = ARTICLES;
    main.innerHTML = `
      <section class="page-hero">
        <div class="container">
          <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><span aria-current="page">Journal</span></nav>
          <h1>The Journal</h1>
          <p class="lead">Guides, seasonal wisdom and gentle encouragement for a healthier, more grateful life.</p>
        </div>
      </section>
      <section class="section">
        <div class="container">
          ${articleCard(first, true)}
          <div class="journal-grid">${rest.map((x) => articleCard(x)).join("")}</div>
        </div>
      </section>`;
    return;
  }

  document.title = `${a.title} — Beauty & Praise`;
  const h = findHerb(a.herb);
  const body = a.body.map((b) =>
    b.h ? `<h2>${b.h}</h2>` : b.list ? `<ul class="check-list">${b.list.map((x) => `<li>${icon("check")}${x}</li>`).join("")}</ul>` : `<p>${b.p}</p>`
  ).join("");
  const more = ARTICLES.filter((x) => x !== a).slice(0, 3);
  main.innerHTML = `
    <article>
      <header class="article-hero">
        <div class="container narrow">
          <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><a href="journal.html">Journal</a><span>/</span><span aria-current="page">${a.category}</span></nav>
          <p class="eyebrow">${a.category}</p>
          <h1>${a.title}</h1>
          <p class="meta">${formatDate(a.date)} · ${a.read} min read · By the Beauty &amp; Praise team</p>
        </div>
        <div class="container article-banner">${visual(h, true)}</div>
      </header>
      <div class="container narrow prose article-prose">
        <p class="lead">${a.excerpt}</p>
        ${body}
        <div class="article-herb">
          <span class="mini-art">${visual(h)}</span>
          <div><p class="eyebrow">Featured herb</p><a href="${herbUrl(h.id)}"><strong>${h.name}</strong> — ${h.summary}</a></div>
        </div>
      </div>
    </article>
    <section class="section section-tint">
      <div class="container">
        <div class="section-head"><h2>Keep reading</h2><a class="text-link" href="journal.html">All articles ${icon("arrow")}</a></div>
        <div class="journal-grid">${more.map((x) => articleCard(x)).join("")}</div>
      </div>
    </section>`;
}

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
          <div class="note-card">${icon("shield", "icon info-icon")}<p><strong>Before you start a stack:</strong> combining herbs combines their cautions too. Read the "Who should avoid" list for each stack, and check with your doctor or pharmacist if you are pregnant, breastfeeding, taking medicine or have a health condition.</p></div>
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
            <button class="btn btn-outline print-btn" onclick="window.print()">${icon("print")}<span>Print recipe card</span></button>
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

    <section class="section section-tint">
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
  return `<article class="herb-card">
    <a href="${fruitUrl(fr.id)}" class="herb-card-link" aria-label="${fr.name}">
      <div class="herb-card-art">${fruitVisual(fr)}</div>
      <div class="herb-card-body">
        <p class="herb-card-cat">${CATEGORIES[fr.cats[0]]}</p>
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

function initFruits() {
  const PAGE = 24;
  const state = { q: params.get("q") || "", cat: params.get("cat") || "all", season: "all", sort: "az", letter: "", saved: params.get("saved") === "1", shown: PAGE };
  const search = $("#fruit-search"), catSel = $("#fruit-cat"), seasonSel = $("#fruit-season"), sortSel = $("#fruit-sort");
  const savedBox = $("#fruit-saved"), grid = $("#fruit-grid"), count = $("#fruit-count"), more = $("#fruit-more");

  const usedCats = Object.keys(CATEGORIES).filter((k) => FRUITS.some((fr) => fr.cats.includes(k)));
  catSel.innerHTML = `<option value="all">All benefits</option>` + usedCats.map((k) => `<option value="${k}">${CATEGORIES[k]}</option>`).join("");
  seasonSel.innerHTML = `<option value="all">Any season</option>` + SEASON_NAMES.map((n) => `<option value="${n}">${n}</option>`).join("");
  search.value = state.q;
  catSel.value = CATEGORIES[state.cat] ? state.cat : "all";
  savedBox.checked = state.saved;

  const letters = [...new Set(FRUITS.map((fr) => fr.name[0].toUpperCase()))];
  $("#fruit-az").innerHTML = `<button class="az-btn active" data-letter="">All</button>` +
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => `<button class="az-btn" data-letter="${l}" ${letters.includes(l) ? "" : "disabled"}>${l}</button>`).join("");

  function results() {
    let list = state.q.trim() ? searchFruits(state.q.trim()) : [...FRUITS];
    if (state.cat !== "all") list = list.filter((fr) => fr.cats.includes(state.cat));
    if (state.season === "Year-round") list = list.filter((fr) => /year-round/i.test(fr.season));
    else if (state.season !== "all") list = list.filter((fr) => seasonsOf(fr.season).includes(state.season.toLowerCase()));
    if (state.letter) list = list.filter((fr) => fr.name[0].toUpperCase() === state.letter);
    if (state.saved) { const fav = favorites.all(); list = list.filter((fr) => fav.includes("fruit:" + fr.id)); }
    if (!state.q.trim() || state.sort !== "az") { list.sort((a, b) => a.name.localeCompare(b.name)); if (state.sort === "za") list.reverse(); }
    return list;
  }
  function render() {
    const list = results();
    grid.innerHTML = list.slice(0, state.shown).map(fruitCard).join("");
    count.textContent = `${list.length} ${list.length === 1 ? "fruit" : "fruits"}`;
    more.hidden = list.length <= state.shown;
    $("#fruit-empty").hidden = list.length > 0;
  }
  const reset = () => { state.shown = PAGE; render(); };
  search.addEventListener("input", () => { state.q = search.value; reset(); });
  catSel.addEventListener("change", () => { state.cat = catSel.value; reset(); });
  seasonSel.addEventListener("change", () => { state.season = seasonSel.value; reset(); });
  sortSel.addEventListener("change", () => { state.sort = sortSel.value; reset(); });
  savedBox.addEventListener("change", () => { state.saved = savedBox.checked; reset(); });
  $("#fruit-az").addEventListener("click", (e) => {
    const b = e.target.closest(".az-btn");
    if (!b || b.disabled) return;
    state.letter = b.dataset.letter;
    document.querySelectorAll("#fruit-az .az-btn").forEach((x) => x.classList.toggle("active", x === b));
    reset();
  });
  more.addEventListener("click", () => { state.shown += PAGE; render(); });
  document.addEventListener("favorites-changed", () => { if (state.saved) render(); });
  render();
}

function initFruit() {
  const fr = FRUITS.find((x) => x.id === (document.body.dataset.id || params.get("id")));
  const main = $("#fruit-main");
  if (!fr) {
    main.innerHTML = `<section class="section"><div class="container narrow center"><h1>Fruit not found</h1><p class="lead">We couldn't find that fruit.</p><a class="btn btn-primary" href="fruits.html">Browse the fruit library</a></div></section>`;
    return;
  }
  const key = "fruit:" + fr.id;
  const sorted = [...FRUITS].sort((a, b) => a.name.localeCompare(b.name));
  const idx = sorted.indexOf(fr);
  const prev = sorted[(idx - 1 + sorted.length) % sorted.length], next = sorted[(idx + 1) % sorted.length];
  const related = FRUITS.filter((x) => x !== fr && x.cats.some((c) => fr.cats.includes(c)))
    .sort((a, b) => b.cats.filter((c) => fr.cats.includes(c)).length - a.cats.filter((c) => fr.cats.includes(c)).length).slice(0, 4);
  const saved = favorites.has(key);
  const [servingText, servingG] = fr.serving;

  main.innerHTML = `
    <section class="herb-hero">
      <div class="container">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><a href="fruits.html">Fruit Library</a><span>/</span><span aria-current="page">${fr.name}</span></nav>
        <div class="herb-hero-grid">
          <figure class="herb-hero-figure">
            <div class="herb-hero-art arch">${fruitVisual(fr, true)}</div>
            <figcaption class="photo-credit" id="photo-credit"></figcaption>
          </figure>
          <div class="herb-hero-copy">
            <div class="tag-row">${fr.cats.map((c) => `<a class="tag" href="fruits.html?cat=${c}">${CATEGORIES[c]}</a>`).join("")}</div>
            <h1>${fr.name}</h1>
            <p class="latin big">${fr.latin}</p>
            <p class="lead">${fr.summary.split(/(?<=\.)\s/)[0]}</p>
            <dl class="facts">
              <div><dt>Botanical family</dt><dd>${fr.family}</dd></div>
              <div><dt>In season</dt><dd>${fr.season}</dd></div>
              <div><dt>One serving</dt><dd>${servingText}</dd></div>
            </dl>
            <div class="herb-actions">
              <button class="btn btn-primary fav-inline${saved ? " saved" : ""}" data-fav="${key}" aria-pressed="${saved}">${icon("heart")}<span>Save fruit</span></button>
              <button class="btn btn-outline" onclick="window.print()">${icon("print")}<span>Print guide</span></button>
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
            <li><a href="#glance">What it does</a></li>
            <li><a href="#nutrients">Key nutrients</a></li>
            <li><a href="#scripture">Scripture</a></li>
            <li><a href="#benefits">Benefits explained</a></li>
            <li><a href="#use">How to use it</a></li>
            <li><a href="#amount">How much to eat</a></li>
            <li><a href="#store">Choosing &amp; storing</a></li>
            <li><a href="#safety">Safety &amp; cautions</a></li>
          </ul>
        </aside>
        <article class="prose">
          <section id="glance" class="glance">
            <p class="eyebrow">What ${fr.name.split(" (")[0].toLowerCase()} does for you</p>
            <p class="glance-text">${fr.summary}</p>
          </section>
          <section id="nutrients"><h2>Key nutrients</h2>
            <div class="nutrient-chips">${fr.nutrients.map((n) => `<span class="nutrient">${n}</span>`).join("")}</div>
          </section>
          ${scriptureCard("fruit", fr)}
          <section id="benefits"><h2>Benefits explained</h2>
            <div class="benefit-list">${fr.benefits.map(([e, t, d]) => `
              <div class="benefit">
                <div class="benefit-head"><h3>${t}</h3><span class="evidence ev-${e}" title="${EVIDENCE[e].note}">${EVIDENCE[e].label}</span></div>
                <p>${d}</p>
              </div>`).join("")}
            </div>
          </section>
          <section id="use"><h2>How to use it</h2>
            <ul class="check-list">${fr.uses.map((u) => `<li>${icon("check")}${u}</li>`).join("")}</ul>
          </section>
          <section id="amount"><h2>How much to eat</h2>
            <div class="quick-doses one">
              <div class="qd-card">
                <div class="qd-head"><span class="qd-icon">${icon("leaf")}</span><div><p class="eyebrow">One serving</p><p class="qd-per">Per person</p></div></div>
                <p class="qd-amount qd-text">${servingText}</p>
                <p class="qd-units">${range(servingG, servingG, "g")} · ${range(servingG / OZ, servingG / OZ, "oz")}</p>
                <p class="qd-freq">${icon("check")}Most adults do well with about 2 servings of fruit a day as part of a varied diet.</p>
              </div>
            </div>
          </section>
          <section id="store"><h2>Choosing &amp; storing</h2>
            <div class="info-card">${icon("pot", "icon info-icon")}<p>${fr.pick}</p></div>
          </section>
          <section id="safety"><h2>Safety &amp; cautions</h2>
            <div class="caution-card">${icon("shield", "icon info-icon")}<div><p>${fr.caution}</p>
              <p class="small">For general education, not medical advice. Ask your doctor or dietitian if you follow a special diet or take medicine.</p></div></div>
            <h3 class="ix-title">Medicines &amp; health situations to watch</h3>
            ${interactionList(key)}
            <a class="text-link" href="interactions.html?item=${key}">Check with your medicines ${icon("arrow")}</a>
          </section>
        </article>
      </div>
    </section>

    <section class="section section-tint">
      <div class="container">
        <div class="section-head"><div><p class="eyebrow">Keep exploring</p><h2>Related fruits</h2></div>
          <a class="text-link" href="fruits.html?cat=${fr.cats[0]}">More for ${CATEGORIES[fr.cats[0]]} ${icon("arrow")}</a></div>
        <div class="herb-grid">${related.map(fruitCard).join("")}</div>
        <nav class="prev-next">
          <a href="${fruitUrl(prev.id)}"><span>← Previous</span><strong>${prev.name}</strong></a>
          <a href="${fruitUrl(next.id)}"><span>Next →</span><strong>${next.name}</strong></a>
        </nav>
      </div>
    </section>`;

  Photos.credit(key).then((c) => {
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

/* ---------------- Interaction checker (step by step) ---------------- */
const itemName = (key) => key.startsWith("fruit:") ? FRUITS.find((f) => f.id === key.slice(6))?.name : findHerb(key)?.name;
const itemUrl = (key) => key.startsWith("fruit:") ? fruitUrl(key.slice(6)) : herbUrl(key);

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
  $("#ix-who").innerHTML = WHO_OPTIONS.map((w) => `<label class="quiz-card who-card"><input type="radio" name="who" value="${w.id}" ${state.who === w.id ? "checked" : ""}><span><strong>${w.label}</strong>${w.sub ? `<em>${w.sub}</em>` : ""}</span></label>`).join("");
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
    <optgroup label="Fruits">${[...FRUITS].sort((a, b) => a.name.localeCompare(b.name)).map((f) => `<option value="fruit:${f.id}">${f.name}</option>`).join("")}</optgroup>`;
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
    const trimester = who.trimester ? `<div class="note-card trimester-note">${icon("leaf", "icon info-icon")}<p>${TRIMESTER_NOTES[who.trimester]} <a href="safety/pregnancy.html">Read the full pregnancy guide</a>.</p></div>` : "";

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

/* ---------------- "What should I take?" quiz ---------------- */
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
    { key: "goal", title: "What would you like help with?", render: () => `<div class="quiz-grid finder-goals">${TOPIC_GUIDES.map((g) => `<label class="quiz-card"><input type="radio" name="goal" value="${g.id}" ${a.goal === g.id ? "checked" : ""}><span>${icon(g.icon)}${g.short}</span></label>`).join("")}</div>` },
    { key: "duration", title: "How long has this been bothering you?", render: () => `<div class="who-grid">${[["days", "It just started", "a few days"], ["weeks", "A few weeks", ""], ["months", "Months or longer", ""], ["well", "It's not a problem", "I just want to stay well"]].map(([v, l, sub]) => `<label class="quiz-card who-card"><input type="radio" name="duration" value="${v}" ${a.duration === v ? "checked" : ""}><span><strong>${l}</strong>${sub ? `<em>${sub}</em>` : ""}</span></label>`).join("")}</div>` },
    { key: "who", title: "Who is this for?", render: () => `<div class="who-grid">${WHO_OPTIONS.map((w) => `<label class="quiz-card who-card"><input type="radio" name="who" value="${w.id}" ${a.who === w.id ? "checked" : ""}><span><strong>${w.label}</strong>${w.sub ? `<em>${w.sub}</em>` : ""}</span></label>`).join("")}</div>` },
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
    { key: "form", title: "How do you like to take herbs?", render: () => `<div class="who-grid">${[["tea", "As a tea"], ["capsule", "Capsules"], ["food", "In my food"], ["any", "Any way"]].map(([v, l]) => `<label class="quiz-card who-card"><input type="radio" name="form" value="${v}" ${a.form === v ? "checked" : ""}><span><strong>${l}</strong></span></label>`).join("")}</div>` }
  ];

  function show() {
    const st = STEPS[step];
    app.innerHTML = `<div class="card finder-step">
      <div class="quiz-progress"><span>Question ${step + 1} of ${STEPS.length}</span><span>${Math.round((step / STEPS.length) * 100)}% done</span></div>
      <div class="progress"><div class="progress-bar" style="width:${(step / STEPS.length) * 100}%"></div></div>
      <h2>${st.title}</h2>
      <div class="finder-body">${st.render()}</div>
      <div class="finder-nav">
        ${step ? `<button class="btn btn-outline" data-back>Back</button>` : "<span></span>"}
        <button class="btn btn-primary" data-next ${!st.optional && !a[st.key] ? "disabled" : ""}>${step === STEPS.length - 1 ? "See my plan" : "Next"}</button>
      </div>
    </div>`;
    const next = app.querySelector("[data-next]");
    app.querySelectorAll('input[type="radio"]').forEach((r) => r.addEventListener("change", () => {
      a[st.key] = r.value; next.disabled = false;
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
    const who = WHO_OPTIONS.find((w) => w.id === a.who);
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
    const leftOut = pool.filter((id) => levelFor(id) === "avoid" && g.herbs.includes(id));
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
        ${a.duration === "months" ? `<div class="note-card plan-doctor">${icon("shield", "icon info-icon")}<div><p><strong>Because this has lasted months, please also see your doctor.</strong> Ongoing problems can have causes that need treatment. Get help especially if you notice:</p><ul>${g.doctor.map((d) => `<li>${d}</li>`).join("")}</ul></div></div>` : ""}
        ${who.flags.includes("pregnancy") ? `<div class="note-card">${icon("leaf", "icon info-icon")}<p>${who.trimester ? TRIMESTER_NOTES[who.trimester] : "When you're trying to conceive, follow the same care as early pregnancy."} <a href="${safetyUrl("pregnancy")}">Read the pregnancy guide</a>.</p></div>` : ""}
        ${a.who === "breastfeeding" ? `<div class="note-card">${icon("leaf", "icon info-icon")}<p>Introduce one herbal tea at a time and watch your baby for changes. <a href="${safetyUrl("breastfeeding")}">Read the breastfeeding guide</a>.</p></div>` : ""}
        ${isChild ? `<div class="note-card">${icon("shield", "icon info-icon")}<p><strong>For children, please ask your pediatrician before giving any herb.</strong> Fruits and healthy habits are the safest place to start. <a href="${safetyUrl("children")}">Read the children's guide</a>.</p></div>` : ""}
      </div>

      <div class="card"><h3 class="plan-h">1. Start with these habits</h3><ul class="check-list">${g.lifestyle.slice(0, 3).map((t) => `<li>${icon("check")}${t}</li>`).join("")}</ul></div>

      ${top.length ? `<div class="card"><h3 class="plan-h">2. Your top herbs</h3>${top.map(herbCardPlan).join("")}
        ${more.length ? `<p class="plan-more"><strong>Also worth a look:</strong> ${more.map((id) => `<a class="ix-chip" href="${herbUrl(id)}">${findHerb(id).name}${levelFor(id) === "caution" ? " (caution)" : ""}</a>`).join(" ")}</p>` : ""}
      </div>` : `<div class="card"><h3 class="plan-h">2. Herbs</h3><p>We couldn't find an herb for this goal that's a good fit for your situation. Please talk with your doctor or pharmacist about safe options.</p></div>`}

      ${stacks.length && !isChild ? `<div class="card"><h3 class="plan-h">3. A stack to try</h3><div class="stack-grid">${stacks.map(stackCard).join("")}</div></div>` : ""}

      <div class="card"><h3 class="plan-h">${stacks.length && !isChild ? "4" : "3"}. Fruits that help</h3><div class="herb-grid">${fruits.map((id) => fruitCard(FRUITS.find((f) => f.id === id))).join("")}</div></div>

      ${leftOut.length ? `<div class="card"><h3 class="plan-h">Left out for your safety</h3><ul class="ix-list">${leftOut.map((id) => `<li class="ix-avoid"><span class="ix-badge">Avoid</span><span><a href="${herbUrl(id)}"><strong>${findHerb(id).name}</strong></a> — ${hitsFor(id).filter((x) => x.level === "avoid").map((x) => `${x.e.label}: ${x.note}`).join(" ")}</span></li>`).join("")}</ul></div>` : ""}

      <section class="verse-band plan-verse"><blockquote><p>“${g.verse.text}”</p><cite>${g.verse.ref} (${BIBLE_VERSION})</cite></blockquote></section>

      <div class="btn-row center-row plan-actions">
        <button class="btn btn-primary" data-print>Print my plan</button>
        <button class="btn btn-outline" data-restart>Start over</button>
        <a class="btn btn-outline" href="${guideUrl(g.id)}">Read the full ${g.short.toLowerCase()} guide</a>
      </div>
      <p class="small muted center">These suggestions are for education only and are not medical advice. Please check with your doctor or pharmacist before starting any herb, especially if you take medicine.</p>
    </div>`;
    app.querySelector("[data-print]").addEventListener("click", () => window.print());
    app.querySelector("[data-restart]").addEventListener("click", () => { Object.assign(a, { goal: null, duration: null, who: null, drugs: [], meds: [], conds: [], form: null }); step = 0; show(); });
    app.scrollIntoView({ behavior: "smooth", block: "start" });
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
  return `<section id="scripture" class="scripture-card">
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

function initQuiz() {
  const app = $("#quiz-app");
  const best = store.get("bp-quiz-best", {});
  let game = null;

  function startScreen() {
    const topics = [["mixed", "Mixed — a bit of everything"], ...Object.entries(QUIZ_TOPICS)];
    app.innerHTML = `<a class="card finder-promo" href="finder.html">
      <span class="category-icon">${icon("leaf")}</span>
      <span><strong>What should I take?</strong><em>Answer 6 quick questions and get a personal plan of herbs, doses, fruits and habits — safely matched to your medicines and situation.</em></span>
      ${icon("arrow")}
    </a>
    <div class="card quiz-start">
      <h2>Or test your knowledge</h2>
      <p class="muted">10 questions · instant answers with explanations · your best score is saved on this device</p>
      <div class="quiz-topic-grid">${topics.map(([id, label]) => `<button class="quiz-topic" data-topic="${id}"><strong>${label}</strong><span>${id === "mixed" ? QUIZ_QUESTIONS.length : QUIZ_QUESTIONS.filter((q) => q.t === id).length} questions${best[id] !== undefined ? ` · Best: ${best[id]}/10` : ""}</span></button>`).join("")}</div>
    </div>`;
  }

  function start(topic) {
    const pool = topic === "mixed" ? QUIZ_QUESTIONS : QUIZ_QUESTIONS.filter((q) => q.t === topic);
    game = { topic, questions: shuffle(pool).slice(0, 10).map((q) => ({ ...q, options: shuffle(q.o) })), i: 0, score: 0, missed: [] };
    question();
  }

  const learnLink = (link) => link.bible ? `<a class="text-link" href="bible.html">Herbs &amp; fruits of the Bible ${icon("arrow")}</a>`
    : link.herb ? `<a class="text-link" href="${herbUrl(link.herb)}">Learn about ${findHerb(link.herb).name} ${icon("arrow")}</a>`
    : `<a class="text-link" href="${fruitUrl(link.fruit)}">Learn about ${FRUITS.find((f) => f.id === link.fruit).name} ${icon("arrow")}</a>`;

  function question() {
    const q = game.questions[game.i];
    const n = game.questions.length;
    app.innerHTML = `<div class="card quiz-q">
      <div class="quiz-progress"><span>Question ${game.i + 1} of ${n}</span><span>Score: ${game.score}</span></div>
      <div class="progress"><div class="progress-bar" style="width:${(game.i / n) * 100}%"></div></div>
      <p class="eyebrow">${QUIZ_TOPICS[q.t]}</p>
      <h2>${q.q}</h2>
      <div class="quiz-options">${q.options.map((o) => `<button class="quiz-option" data-answer="${o.replace(/"/g, "&quot;")}">${o}</button>`).join("")}</div>
      <div class="quiz-feedback" aria-live="polite"></div>
    </div>`;
    app.querySelector(".quiz-options").addEventListener("click", (e) => {
      const btn = e.target.closest(".quiz-option");
      if (!btn || app.querySelector(".quiz-option[disabled]")) return;
      const correct = q.o[0];
      const right = btn.dataset.answer === correct;
      if (right) game.score++; else game.missed.push({ q, chosen: btn.dataset.answer });
      app.querySelectorAll(".quiz-option").forEach((b) => {
        b.disabled = true;
        if (b.dataset.answer === correct) b.classList.add("right");
        else if (b === btn) b.classList.add("wrong");
      });
      app.querySelector(".quiz-feedback").innerHTML = `<div class="quiz-explain ${right ? "is-right" : "is-wrong"}">
        <p class="quiz-verdict">${right ? "✓ Correct!" : `✗ Not quite — the answer is <strong>${correct}</strong>.`}</p>
        <p>${q.e}</p>
        ${learnLink(q.link)}
      </div>
      <button class="btn btn-primary quiz-next">${game.i + 1 < n ? "Next question" : "See my score"}</button>`;
      app.querySelector(".quiz-next").addEventListener("click", () => { game.i++; game.i < n ? question() : finish(); });
      app.querySelector(".quiz-next").focus();
    });
  }

  function finish() {
    const n = game.questions.length, pct = game.score / n;
    if (best[game.topic] === undefined || game.score > best[game.topic]) { best[game.topic] = game.score; store.set("bp-quiz-best", best); }
    const message = pct === 1 ? "Perfect score — you're a true herbalist!" : pct >= 0.8 ? "Wonderful! You really know your stuff." : pct >= 0.5 ? "Good job! A little more reading and you'll ace it." : "A great start — every question is a chance to learn.";
    app.innerHTML = `<div class="card quiz-end">
      <p class="eyebrow">${game.topic === "mixed" ? "Mixed quiz" : QUIZ_TOPICS[game.topic]}</p>
      <div class="quiz-score"><span>${game.score}</span>/ ${n}</div>
      <h2>${message}</h2>
      <p class="muted">Best score: ${best[game.topic]}/${n}</p>
      <div class="btn-row center-row"><button class="btn btn-primary" data-again>Play again</button><button class="btn btn-outline" data-topics>Choose another topic</button></div>
      ${game.missed.length ? `<h3 class="quiz-sub">Review the ones you missed</h3><div class="quiz-review">${game.missed.map(({ q, chosen }) => `<div class="quiz-review-item"><p><strong>${q.q}</strong></p><p>Your answer: ${chosen} · Correct: <strong>${q.o[0]}</strong></p><p class="muted">${q.e}</p>${learnLink(q.link)}</div>`).join("")}</div>` : ""}
    </div>`;
    app.querySelector("[data-again]").addEventListener("click", () => start(game.topic));
    app.querySelector("[data-topics]").addEventListener("click", startScreen);
  }

  app.addEventListener("click", (e) => { const t = e.target.closest("[data-topic]"); if (t) start(t.dataset.topic); });
  startScreen();
}

/* ---------------- Wellness & safety guides ---------------- */
const guideUrl = (id) => `guides/${id}.html`;
const safetyUrl = (id) => `safety/${id}.html`;

function doseLine(id) {
  const c = CAPS[id];
  if (!c) return "";
  if (Array.isArray(c.cap)) return `Capsule: ${range(c.cap[0], c.cap[1], "mg")}, ${c.cap[3].toLowerCase()}`;
  if (c.herb && typeof c.herb[0] === "number") return `Herb: ${range(c.herb[0], c.herb[1], "g")} — ${c.herb[2].toLowerCase()}, ${c.herb[3].toLowerCase()}`;
  return "";
}

function initGuides() {
  $("#guide-grid").innerHTML = TOPIC_GUIDES.map((g) => `<a class="guide-card" href="${guideUrl(g.id)}">
    <span class="guide-photos">${g.herbs.slice(0, 3).map((id) => `<span class="mini-art">${visual(findHerb(id))}</span>`).join("")}</span>
    <h3>${g.short}</h3>
    <p>${g.intro.split(/(?<=\.)\s/)[0]}</p>
    <span class="text-link">Read the guide ${icon("arrow")}</span>
  </a>`).join("");
  $("#safety-grid").innerHTML = SAFETY_GUIDES.map((g) => `<a class="guide-card safety" href="${safetyUrl(g.id)}">
    <span class="category-icon">${icon("shield")}</span>
    <h3>${g.short}</h3>
    <p>${g.intro.split(/(?<=\.)\s/)[0]}</p>
    <span class="text-link">Read the guide ${icon("arrow")}</span>
  </a>`).join("");
}

function initGuide() {
  const g = TOPIC_GUIDES.find((x) => x.id === document.body.dataset.id);
  if (!g) return;
  const herbRow = (id) => {
    const h = findHerb(id), b = (BENEFITS[id] || [])[0];
    return `<a class="guide-herb" href="${herbUrl(id)}">
      <span class="stack-herb-photo">${visual(h)}</span>
      <span class="stack-herb-text">
        <span class="stack-herb-name"><strong>${h.name}</strong>${b ? `<span class="evidence ev-${b[0]}">${EVIDENCE[b[0]].label}</span>` : ""}</span>
        <span class="stack-herb-role">${b ? `<strong>${b[1]}:</strong> ${b[2]}` : h.summary}</span>
        <span class="guide-dose">${doseLine(id)}</span>
      </span>
    </a>`;
  };
  $("#guide-main").innerHTML = `
    <section class="stack-hero">
      <div class="container">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><a href="guides.html">Guides</a><span>/</span><span aria-current="page">${g.short}</span></nav>
        <div class="stack-hero-grid">
          <div>
            <p class="eyebrow">Wellness guide</p>
            <h1>${g.title}</h1>
            <p class="lead">${g.intro}</p>
            <a class="btn btn-primary" href="finder.html?goal=${g.id}">Get my personal plan ${icon("arrow")}</a>
          </div>
          <div class="stack-hero-photos">${g.herbs.slice(0, 4).map((id, i) => `<a href="${herbUrl(id)}" class="shp shp-${i}">${visual(findHerb(id), i === 0)}</a>`).join("")}</div>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container narrow prose">
        <h2>Start with the basics</h2>
        <ul class="check-list">${g.lifestyle.map((t) => `<li>${icon("check")}${t}</li>`).join("")}</ul>
        <h2>Herbs that may help</h2>
        <p class="muted">Listed with their best-supported benefit and a typical adult dose (100 lb and over). Tap any herb for the full profile.</p>
        <div class="stack-herb-list">${g.herbs.map(herbRow).join("")}</div>
        <h2>Safety first</h2>
        <div class="caution-card">${icon("shield", "icon info-icon")}<div><p>${g.cautions}</p>
          <p class="small">Check your own medicines and situation with our <a href="interactions.html">interaction checker</a>.</p></div></div>
        <h2>When to see a doctor</h2>
        <ul class="doctor-list">${g.doctor.map((d) => `<li>${d}</li>`).join("")}</ul>
      </div>
    </section>
    <section class="verse-band"><blockquote><p>“${g.verse.text}”</p><cite>${g.verse.ref} (${BIBLE_VERSION})</cite></blockquote></section>
    <section class="section section-tint">
      <div class="container">
        <div class="section-head"><div><p class="eyebrow">Nourish from the inside</p><h2>Fruits that help</h2></div></div>
        <div class="herb-grid">${g.fruits.map((id) => fruitCard(FRUITS.find((f) => f.id === id))).join("")}</div>
        ${g.stacks.length ? `<div class="section-head stack-head"><div><p class="eyebrow">Better together</p><h2>Herbal stacks</h2></div></div><div class="stack-grid">${g.stacks.map((id) => stackCard(STACKS.find((s) => s.id === id))).join("")}</div>` : ""}
        <div class="section-head stack-head"><div><p class="eyebrow">Keep exploring</p><h2>More guides</h2></div></div>
        <div class="bible-links">${TOPIC_GUIDES.filter((x) => x !== g).map((x) => `<a class="ix-chip" href="${guideUrl(x.id)}">${x.short}</a>`).join("")}</div>
      </div>
    </section>`;
}

function initSafetyGuide() {
  const g = SAFETY_GUIDES.find((x) => x.id === document.body.dataset.id);
  if (!g) return;
  const ix = INTERACTIONS.find((x) => x.id === g.ix);
  const whoParam = { pregnancy: "preg1", breastfeeding: "breastfeeding", children: "child", "older-adults": "senior", surgery: "adult" }[g.id];
  const list = (obj, level) => Object.entries(obj).map(([k, n]) => `<li class="ix-${level}"><span class="ix-badge">${level === "avoid" ? "Avoid" : "Caution"}</span><span><a href="${itemUrl(k)}"><strong>${itemName(k)}</strong></a> — ${n}</span></li>`).join("");
  $("#safety-main").innerHTML = `
    <section class="page-hero">
      <div class="container">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><a href="guides.html">Guides</a><span>/</span><span aria-current="page">${g.short}</span></nav>
        <p class="eyebrow">Safety guide</p>
        <h1>${g.title}</h1>
        <p class="lead">${g.intro}</p>
        <a class="btn btn-primary" href="interactions.html?who=${whoParam}">Check my medicines ${icon("arrow")}</a>
      </div>
    </section>
    <section class="section section-top-tight">
      <div class="container narrow prose">
        ${g.sections.map((sec) => `<h2>${sec.h}</h2>${sec.list ? `<ul class="check-list">${sec.list.map((t) => `<li>${icon("check")}${t}</li>`).join("")}</ul>` : `<p>${sec.p}</p>`}`).join("")}
        <h2>What could happen &amp; what to do</h2>
        <div class="ix-explain"><p><strong>What could happen:</strong> ${IX_DETAILS[ix.id].what}</p><p><strong>What to do:</strong> ${IX_DETAILS[ix.id].todo}</p></div>
        ${Object.keys(ix.avoid).length ? `<h2>Herbs &amp; fruits to avoid</h2><ul class="ix-list">${list(ix.avoid, "avoid")}</ul>` : ""}
        ${Object.keys(ix.caution).length ? `<h2>Use with caution</h2><ul class="ix-list">${list(ix.caution, "caution")}</ul>` : ""}
        <h2>Get help right away if…</h2>
        <ul class="doctor-list emergency">${g.emergency.map((d) => `<li>${d}</li>`).join("")}</ul>
        <p class="small muted">In an emergency call your local emergency number. In the U.S., Poison Control is 1-800-222-1222.</p>
        <h2>Other safety guides</h2>
        <div class="bible-links">${SAFETY_GUIDES.filter((x) => x !== g).map((x) => `<a class="ix-chip" href="${safetyUrl(x.id)}">${x.short}</a>`).join("")}</div>
      </div>
    </section>`;
}

/* ---------------- About ---------------- */
function initAbout() {
  $("#about-art").innerHTML = ["rose", "lavender", "chamomile"].map((id, i) =>
    `<div class="about-art-${i}">${visual(findHerb(id))}</div>`).join("");

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

({ home: initHome, herbs: initHerbs, fruits: initFruits, fruit: initFruit, interactions: initInteractions, quiz: initQuiz, finder: initFinder, guides: initGuides, guide: initGuide, safetyguide: initSafetyGuide, bible: initBible, stacks: initStacks, herb: initHerb, living: initLiving, journal: initJournal, about: initAbout })[document.body.dataset.page]?.();
