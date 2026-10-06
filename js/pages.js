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
    <a class="arch arch-main" href="herb.html?id=${featured.id}">${visual(featured, true)}<span class="arch-label">Herb of the day · ${featured.name}</span></a>
    <a class="arch-circle c1" href="herb.html?id=${side[0].id}" aria-label="${side[0].name}">${visual(side[0])}</a>
    <a class="arch-circle c2" href="herb.html?id=${side[1].id}" aria-label="${side[1].name}">${visual(side[1])}</a>`;

  const marquee = Object.values(CATEGORIES).map((c) => `<span>${c}</span>${icon("leaf")}`).join("");
  $("#marquee").innerHTML = `<div class="marquee-track">${marquee}${marquee}</div>`;

  $("#category-grid").innerHTML = Object.entries(CATEGORIES)
    .map(([key, label]) => {
      const count = HERBS.filter((h) => h.cats.includes(key)).length;
      return `<a class="category-tile" href="herbs.html?cat=${key}">
        <span class="category-icon">${icon(CATEGORY_ICONS[key])}</span>
        <span class="category-name">${label}</span>
        <span class="category-count">${count} herbs</span>
      </a>`;
    })
    .join("");

  $("#feature").innerHTML = `
    <div class="feature-art">${visual(featured, true)}</div>
    <div class="feature-copy">
      <p class="eyebrow">Herb of the day</p>
      <h2>${featured.name}</h2>
      <p class="latin">${featured.latin}</p>
      <p class="lead">${featured.about}</p>
      <ul class="check-list">${featured.uses.map((u) => `<li>${icon("check")}${u}</li>`).join("")}</ul>
      <a class="btn btn-primary" href="herb.html?id=${featured.id}">Read the full profile</a>
    </div>`;

  const popular = ["chamomile", "lavender", "ginger", "turmeric", "peppermint", "elderberry", "holy-basil", "rosemary"];
  $("#popular-grid").innerHTML = popular.map((id) => herbCard(findHerb(id))).join("");

  $("#stack-grid").innerHTML = ["gentle-cleanse", "restful-sleep", "immune-syrup"].map((id) => stackCard(STACKS.find((x) => x.id === id))).join("");

  const verse = dailyPick(VERSES);
  $("#verse-band").innerHTML = `<blockquote><p>“${verse.text}”</p><cite>${verse.ref}</cite></blockquote>`;

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
  const h = findHerb(params.get("id"));
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
            <li><a href="#overview">Overview</a></li>
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
          <section id="overview"><h2>Overview</h2><p>${h.about}</p></section>
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
          </section>
        </article>
      </div>
    </section>

    <section class="section section-tint">
      <div class="container">
        <div class="section-head"><div><p class="eyebrow">Keep exploring</p><h2>Related herbs</h2></div>
          <a class="text-link" href="herbs.html?cat=${h.cats[0]}">More ${CATEGORIES[h.cats[0]]} ${icon("arrow")}</a></div>
        <div class="herb-grid">${related.map(herbCard).join("")}</div>
        <nav class="prev-next">
          <a href="herb.html?id=${prev.id}"><span>← Previous</span><strong>${prev.name}</strong></a>
          <a href="herb.html?id=${next.id}"><span>Next →</span><strong>${next.name}</strong></a>
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
      <div class="season-herbs">${s.herbs.map((id) => { const h = findHerb(id); return `<a href="herb.html?id=${id}"><span class="mini-art">${visual(h)}</span>${h.name}</a>`; }).join("")}</div>
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
          <div><p class="eyebrow">Featured herb</p><a href="herb.html?id=${h.id}"><strong>${h.name}</strong> — ${h.summary}</a></div>
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
          </div>
          <div class="stack-hero-photos">${st.herbs.slice(0, 4).map((x, i) => `<a href="herb.html?id=${x.id}" class="shp shp-${i}">${visual(findHerb(x.id), i === 0)}</a>`).join("")}</div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container narrow prose">
        <h2>Why it works</h2>
        <p>${st.intro}</p>

        <h2>What's in it</h2>
        <div class="stack-herb-list">${st.herbs.map((x) => { const h = findHerb(x.id); return `
          <a class="stack-herb" href="herb.html?id=${h.id}">
            <span class="stack-herb-photo">${visual(h)}</span>
            <span class="stack-herb-text">
              <span class="stack-herb-name"><strong>${h.name}</strong><span class="amount">${x.parts}</span></span>
              <em class="latin">${h.latin}</em>
              <span class="stack-herb-role">${x.role}</span>
            </span>
          </a>`; }).join("")}
        </div>

        <h2>How to make it</h2>
        <ol class="steps">${st.method.map((m) => `<li>${m}</li>`).join("")}</ol>

        <h2>Make it work better</h2>
        <ul class="check-list">${st.tips.map((t) => `<li>${icon("check")}${t}</li>`).join("")}</ul>

        <h2>Who should avoid this stack</h2>
        <div class="caution-card">${icon("shield", "icon info-icon")}
          <div><ul class="caution-list">${st.avoid.map((a) => `<li>${a}</li>`).join("")}</ul>
          <p class="small">This stack is for general education and is not medical advice. Stop if you notice any side effects, and talk with your doctor or pharmacist before using herbs if you take medicine or have a health condition.</p></div>
        </div>
      </div>
    </section>

    <section class="section section-tint">
      <div class="container">
        <div class="section-head"><div><p class="eyebrow">Keep exploring</p><h2>More herbal stacks</h2></div><a class="text-link" href="stacks.html">All stacks ${icon("arrow")}</a></div>
        <div class="stack-grid">${others.map(stackCard).join("")}</div>
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

({ home: initHome, herbs: initHerbs, stacks: initStacks, herb: initHerb, living: initLiving, journal: initJournal, about: initAbout })[document.body.dataset.page]?.();
