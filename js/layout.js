// Shared site chrome (announcement bar, header, footer, search) and helpers.

const SITE = {
  name: "Beauty & Praise",
  tagline: "Herbs · Wellness · Gratitude",
  // Change this to your real email address so the contact form can fall back to email.
  email: "",
  // Free form services (see README): paste your endpoints here to make the forms work.
  //   contactEndpoint:    a Formspree form URL, e.g. "https://formspree.io/f/abcdwxyz"
  //   newsletterEndpoint: a Formspree form URL or your newsletter provider's embed form URL
  contactEndpoint: "",
  newsletterEndpoint: "",
  // Affiliate or shop links shown on herb pages, keyed by herb id, e.g. { ashwagandha: "https://..." }
  shop: {},
  nav: [
    { href: "index.html", label: "Home", page: "home", drawerOnly: true },
    { href: "herbs.html", label: "Herbs", page: "herbs" },
    { href: "fruits.html", label: "Fruits", page: "fruits" },
    { href: "stacks.html", label: "Stacks", page: "stacks" },
    { href: "guides.html", label: "Guides", page: "guides" },
    { href: "interactions.html", label: "Safety Checker", page: "interactions" },
    { href: "quiz.html", label: "Quiz", page: "quiz" },
    { href: "bible.html", label: "Bible", page: "bible" },
    { href: "reminders.html", label: "Healthy Living", page: "living" },
    { href: "journal.html", label: "Journal", page: "journal", drawerOnly: true },
    { href: "about.html", label: "About", page: "about", drawerOnly: true }
  ],
  tools: [
    { href: "interactions.html", label: "Herb & medicine safety checker" },
    { href: "guides.html#safety", label: "Pregnancy, children & safety guides" },
    { href: "finder.html", label: "What should I take? quiz" },
    { href: "quiz.html", label: "Herb & fruit knowledge quiz" },
    { href: "bible.html", label: "Herbs & fruits of the Bible" },
    { href: "guides.html", label: "Wellness guides" }
  ]
};

// Page addresses for individual herbs and fruits (one real page each, built by scripts/build.js).
const herbUrl = (id) => `herbs/${id}.html`;
const fruitUrl = (id) => `fruits/${id}.html`;

// Herb and fruit pages live in subfolders and use <base href="../">, so in-page "#section" links
// would otherwise jump to the home page. Scroll to the section instead.
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.getAttribute("href").length < 2) return;
  const target = document.getElementById(a.getAttribute("href").slice(1));
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", location.pathname + location.search + a.getAttribute("href"));
});

// Send a form to a form service. Resolves true when it was accepted.
async function postForm(endpoint, data) {
  try {
    const res = await fetch(endpoint, { method: "POST", body: data, headers: { Accept: "application/json" } });
    return res.ok;
  } catch {
    return false;
  }
}

// localStorage can be unavailable (private mode, blocked storage), so wrap it.
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

// Pick an item that stays the same for the whole day.
function dailyPick(list, offset = 0) {
  const d = new Date();
  const day = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
  return list[(day + offset) % list.length];
}

const findHerb = (id) => HERBS.find((h) => h.id === id);

const favorites = {
  all: () => store.get("bp-favorites", []),
  has: (id) => favorites.all().includes(id),
  toggle(id) {
    const list = favorites.all();
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    store.set("bp-favorites", next);
    return next.includes(id);
  }
};

const ICONS = {
  search: '<path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm10 17-5-5" />',
  menu: '<path d="M3 6h18M3 12h18M3 18h18" />',
  close: '<path d="M6 6l12 12M18 6 6 18" />',
  heart: '<path d="M12 20s-7-4.4-9-8.6C1.6 8.3 3.4 5 6.6 5c2 0 3.4 1.2 4.1 2.4h.6C12 6.2 13.4 5 15.4 5c3.2 0 5 3.3 3.6 6.4C19 15.6 12 20 12 20z" />',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6" />',
  check: '<path d="M5 12.5 10 17 19 7" />',
  leaf: '<path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15zM5 19l8-8" />',
  sun: '<circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />',
  sunrise: '<path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 4v4M5.6 9.6l1.4 1.4M18.4 9.6 17 11M2 22h20" />',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z" />',
  pot: '<path d="M5 10h14l-1.5 10h-11L5 10zM12 10V5M12 7c-2-3-5-3-6-2 1 2 4 3 6 2zm0-1c2-3 5-3 6-2-1 2-4 3-6 2z" />',
  cup: '<path d="M4 8h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6V8zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v2M12 3v2" />',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM4 19a2 2 0 0 1 2-2h13" />',
  print: '<path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7z" />',
  mail: '<path d="M3 6h18v12H3zM3 7l9 6 9-6" />',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" />',
  pinterest: '<circle cx="12" cy="12" r="9" /><path d="M11 8.5c3-1 5 .5 5 3s-2 4-4 3.5M11.5 10 9 21" />',
  facebook: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z" />'
};

function icon(name, cls = "icon") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

const LOGO_MARK = `<svg class="logo-mark" viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="32" cy="32" r="30.5" fill="#f6f1e7" stroke="#2e4636" stroke-width="1.6"/>
    <circle cx="32" cy="32" r="27" fill="none" stroke="#2e4636" stroke-width="0.6" stroke-dasharray="1.2 2.2"/>
    <path d="M32 9.5V13M24.2 11.6l1.6 2.8M39.8 11.6l-1.6 2.8M18.6 16.6l2.6 1.8M45.4 16.6l-2.6 1.8" stroke="#b5654a" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M32 53V30" stroke="#2e4636" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M31.4 50C20.5 47 13.5 38 15.5 24.5C25.5 23.5 31.4 31 31.4 41Z" fill="#2e4636"/>
    <path d="M32.6 50C43.5 47 50.5 38 48.5 24.5C38.5 23.5 32.6 31 32.6 41Z" fill="#4f7259"/>
    <path d="M30 46.5C25 41 21 34 17.6 26.6M24.6 39.5l-4.4.4M27.4 43.2l-3.6 1.2M22.4 35.4l-3.6-.6" stroke="#f6f1e7" stroke-width="0.9" stroke-linecap="round" fill="none" opacity="0.85"/>
    <path d="M34 46.5C39 41 43 34 46.4 26.6M39.4 39.5l4.4.4M36.6 43.2l3.6 1.2M41.6 35.4l3.6-.6" stroke="#f6f1e7" stroke-width="0.9" stroke-linecap="round" fill="none" opacity="0.85"/>
    <path d="M32 16.5C36.2 20 36.6 25.6 32 30.5C27.4 25.6 27.8 20 32 16.5Z" fill="#b5654a"/>
    <path d="M32 19.5V28" stroke="#f6f1e7" stroke-width="0.8" stroke-linecap="round" opacity="0.8"/>
</svg>`;

function herbCard(h) {
  const saved = favorites.has(h.id);
  return `<article class="herb-card">
    <a href="${herbUrl(h.id)}" class="herb-card-link" aria-label="${h.name}">
      <div class="herb-card-art">${visual(h)}</div>
      <div class="herb-card-body">
        <p class="herb-card-cat">${CATEGORIES[h.cats[0]]}</p>
        <h3>${h.name}</h3>
        <p class="latin">${h.latin}</p>
        <p class="herb-card-summary">${h.summary}</p>
      </div>
    </a>
    <button class="fav-btn${saved ? " saved" : ""}" data-fav="${h.id}" aria-pressed="${saved}" aria-label="Save ${h.name} to favorites">${icon("heart")}</button>
  </article>`;
}

// Delegate favorite button clicks anywhere on the page.
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-fav]");
  if (!btn) return;
  e.preventDefault();
  const on = favorites.toggle(btn.dataset.fav);
  document.querySelectorAll(`[data-fav="${btn.dataset.fav}"]`).forEach((b) => {
    b.classList.toggle("saved", on);
    b.setAttribute("aria-pressed", on);
  });
  toast(on ? "Saved to your favorites" : "Removed from favorites");
  document.dispatchEvent(new CustomEvent("favorites-changed"));
});

function toast(message) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2200);
}

function formatDate(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// The main menu: a few clear groups instead of many separate links.
function siteMenu() {
  return [
    { id: "browse", label: "Herbs & Fruits", items: [
      { href: "herbs.html", label: "Herb Library", desc: "100 herbs from A to Z" },
      { href: "fruits.html", label: "Fruit Library", desc: "100 fruits and what they do" },
      { href: "stacks.html", label: "Herbal Stacks", desc: "Herbs that work well together" }
    ] },
    { id: "help", label: "Help Me With", wide: true, items: [
      { href: "finder.html", label: "What should I take?", desc: "6 quick questions → your personal plan", highlight: true },
      ...TOPIC_GUIDES.map((g) => ({ href: `guides/${g.id}.html`, label: g.short, small: true })),
      { href: "guides.html", label: "All guides →", small: true }
    ] },
    { id: "safety", label: "Safety", items: [
      { href: "interactions.html", label: "Safety Checker", desc: "Is it safe with my medicines?", highlight: true },
      ...SAFETY_GUIDES.map((g) => ({ href: `safety/${g.id}.html`, label: g.short, small: true }))
    ] },
    { id: "bible", label: "Bible", href: "bible.html" },
    { id: "learn", label: "Learn", items: [
      { href: "reminders.html", label: "Healthy Living", desc: "Daily checklist, water & reminders" },
      { href: "quiz.html", label: "Knowledge Quiz", desc: "Test what you know" },
      { href: "journal.html", label: "Journal", desc: "Articles & seasonal tips" },
      { href: "about.html", label: "About Us", desc: "Our story & contact" }
    ] }
  ];
}

const PAGE_GROUP = {
  herbs: "browse", herb: "browse", fruits: "browse", fruit: "browse", stacks: "browse",
  guides: "help", guide: "help", finder: "help",
  interactions: "safety", safetyguide: "safety",
  bible: "bible",
  living: "learn", quiz: "learn", journal: "learn", about: "learn", legal: "learn"
};

// Search across herbs, fruits, guides and stacks. Fills a <ul> with suggestions.
function fillSuggestions(q, list) {
  q = q.trim().toLowerCase();
  list.innerHTML = "";
  if (q.length < 2) return;
  const rows = [];
  const has = (...t) => t.join(" ").toLowerCase().includes(q);
  TOPIC_GUIDES.filter((g) => has(g.short, g.title)).slice(0, 2).forEach((g) =>
    rows.push(`<a href="${guideUrlFor(g.id)}"><span class="mini-art suggest-icon">${icon(g.icon)}</span><span><strong>${g.short}</strong><em>Guide</em></span></a>`));
  SAFETY_GUIDES.filter((g) => has(g.short, g.title)).slice(0, 1).forEach((g) =>
    rows.push(`<a href="safety/${g.id}.html"><span class="mini-art suggest-icon">${icon("shield")}</span><span><strong>${g.title}</strong><em>Safety guide</em></span></a>`));
  STACKS.filter((st) => has(st.name, st.tagline)).slice(0, 2).forEach((st) =>
    rows.push(`<a href="stacks.html?s=${st.id}"><span class="mini-art">${visual(findHerb(st.herbs[0].id))}</span><span><strong>${st.name}</strong><em>Herbal stack</em></span></a>`));
  searchHerbs(q).slice(0, 4).forEach((h) =>
    rows.push(`<a href="${herbUrl(h.id)}"><span class="mini-art">${visual(h)}</span><span><strong>${h.name}</strong><em>${h.latin} · Herb</em></span></a>`));
  searchFruits(q).slice(0, 3).forEach((fr) =>
    rows.push(`<a href="${fruitUrl(fr.id)}"><span class="mini-art">${fruitVisual(fr)}</span><span><strong>${fr.name}</strong><em>${fr.latin} · Fruit</em></span></a>`));
  list.innerHTML = rows.length ? rows.map((r) => `<li>${r}</li>`).join("") : `<li class="no-match">No matches — try a herb, fruit or need like “sleep”.</li>`;
}
const guideUrlFor = (id) => `guides/${id}.html`;

function attachSearch(input, list) {
  input.addEventListener("input", () => fillSuggestions(input.value, list));
  input.form?.addEventListener("submit", (e) => {
    const first = list.querySelector("a");
    if (first) { e.preventDefault(); location.href = first.getAttribute("href"); }
  });
}

function renderChrome() {
  const page = document.body.dataset.page;
  const group = PAGE_GROUP[page] || "";
  const menu = siteMenu();

  const desktop = menu.map((m) => m.href
    ? `<li><a class="nav-top" href="${m.href}"${group === m.id ? ' aria-current="page"' : ""}>${m.label}</a></li>`
    : `<li class="nav-group${m.wide ? " wide" : ""}">
        <button class="nav-top" aria-expanded="false"${group === m.id ? ' aria-current="page"' : ""}>${m.label}<svg class="caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></button>
        <div class="nav-panel">${m.items.map((i) => `<a href="${i.href}" class="${i.highlight ? "nav-highlight" : ""}${i.small ? " nav-small" : ""}"><strong>${i.label}</strong>${i.desc ? `<span>${i.desc}</span>` : ""}</a>`).join("")}</div>
      </li>`).join("");

  const mobile = `<a class="drawer-home" href="index.html">Home</a>` + menu.map((m) => m.href
    ? `<a class="drawer-link" href="${m.href}">${m.label}</a>`
    : `<details class="drawer-group"${group === m.id ? " open" : ""}><summary>${m.label}</summary>${m.items.map((i) => `<a href="${i.href}"${i.highlight ? ' class="nav-highlight"' : ""}>${i.label}</a>`).join("")}</details>`).join("");

  document.getElementById("site-header").innerHTML = `
    <div class="announce">
      <p>Not sure where to start? <a href="finder.html">Take the 1-minute “What should I take?” quiz</a></p>
    </div>
    <header class="header">
      <div class="container header-inner">
        <button class="icon-btn menu-btn" aria-label="Open menu" aria-expanded="false">${icon("menu")}</button>
        <a href="index.html" class="logo" aria-label="${SITE.name} home">
          ${LOGO_MARK}
          <span class="logo-text"><span class="logo-name">Beauty <em>&amp;</em> Praise</span><span class="logo-tag">${SITE.tagline}</span></span>
        </a>
        <nav class="main-nav" aria-label="Main"><ul>${desktop}</ul></nav>
        <div class="header-actions">
          <a href="finder.html" class="btn btn-primary btn-small header-cta">What should I take?</a>
          <button class="icon-btn search-btn" aria-label="Search">${icon("search")}</button>
          <a href="herbs.html?saved=1" class="icon-btn" aria-label="Your saved herbs">${icon("heart")}</a>
        </div>
      </div>
    </header>
    <div class="drawer" hidden>
      <div class="drawer-panel">
        <button class="icon-btn drawer-close" aria-label="Close menu">${icon("close")}</button>
        <a href="finder.html" class="btn btn-primary drawer-cta">What should I take?</a>
        <nav class="drawer-nav" aria-label="Menu">${mobile}</nav>
        <p class="drawer-verse">“${dailyPick(VERSES).text}”</p>
      </div>
    </div>
    <div class="search-overlay" hidden>
      <form class="search-form" action="herbs.html" role="search">
        ${icon("search")}
        <input type="search" name="q" placeholder="Search herbs, fruits or needs — try “sleep” or “mango”" aria-label="Search" autocomplete="off">
        <button type="button" class="icon-btn search-close" aria-label="Close search">${icon("close")}</button>
      </form>
      <ul class="search-suggest"></ul>
    </div>`;

  const footCol = (m) => `<div><h3>${m.label}</h3><ul>${(m.items || [{ href: m.href, label: "Herbs & fruits of the Bible" }]).filter((i) => !i.small || m.id === "safety").slice(0, 6).map((i) => `<li><a href="${i.href}">${i.label}</a></li>`).join("")}</ul></div>`;
  document.getElementById("site-footer").innerHTML = `
    <section class="newsletter">
      <div class="container newsletter-inner">
        <div>
          <p class="eyebrow light">The Beauty &amp; Praise Letter</p>
          <h2>Seasonal herbs, gentle reminders &amp; encouragement</h2>
        </div>
        <form class="newsletter-form">
          <input type="email" required placeholder="Your email address" aria-label="Email address">
          <button class="btn btn-light" type="submit">Subscribe</button>
        </form>
      </div>
    </section>
    <footer class="footer">
      <div class="container footer-grid">
        <div class="footer-brand">
          <a href="index.html" class="logo logo-light">${LOGO_MARK}<span class="logo-text"><span class="logo-name">Beauty <em>&amp;</em> Praise</span><span class="logo-tag">${SITE.tagline}</span></span></a>
          <p>Celebrating the gifts of creation and the small daily habits that help us flourish — body, mind and spirit.</p>
          <div class="socials">
            <a href="#" aria-label="Instagram">${icon("instagram")}</a>
            <a href="#" aria-label="Pinterest">${icon("pinterest")}</a>
            <a href="#" aria-label="Facebook">${icon("facebook")}</a>
          </div>
        </div>
        ${footCol(menu[0])}
        <div><h3>Help Me With</h3><ul><li><a href="finder.html">What should I take?</a></li>${TOPIC_GUIDES.slice(0, 4).map((g) => `<li><a href="guides/${g.id}.html">${g.short}</a></li>`).join("")}<li><a href="guides.html">All guides</a></li></ul></div>
        ${footCol(menu[2])}
        <div><h3>Learn</h3><ul><li><a href="bible.html">Herbs &amp; fruits of the Bible</a></li>${menu[4].items.map((i) => `<li><a href="${i.href}">${i.label}</a></li>`).join("")}</ul></div>
      </div>
      <div class="container footer-bottom">
        <p>© ${new Date().getFullYear()} Beauty &amp; Praise. All rights reserved.</p>
        <p class="legal-links"><a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a> · <a href="disclaimer.html">Medical disclaimer</a></p>
        <p>Herb and fruit photographs from <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a> contributors — credits on each page.</p>
        <p>For education only — not medical advice. Always consult your healthcare provider.</p>
        <p class="scripture-copyright">${typeof BIBLE_COPYRIGHT !== "undefined" ? BIBLE_COPYRIGHT : ""}</p>
      </div>
    </footer>`;

  // Desktop dropdowns: open on hover (CSS) or click/keyboard (here).
  const groups = document.querySelectorAll(".nav-group");
  const closeAll = (except) => groups.forEach((g) => { if (g !== except) { g.classList.remove("open"); g.querySelector(".nav-top").setAttribute("aria-expanded", "false"); } });
  groups.forEach((g) => {
    const btn = g.querySelector(".nav-top");
    btn.addEventListener("click", () => {
      const open = !g.classList.contains("open");
      closeAll(g);
      g.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", open);
    });
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".nav-group")) closeAll(); });

  // Mobile drawer
  const drawer = document.querySelector(".drawer");
  const menuBtn = document.querySelector(".menu-btn");
  const setDrawer = (open) => {
    drawer.hidden = !open;
    menuBtn.setAttribute("aria-expanded", open);
    document.body.classList.toggle("no-scroll", open);
  };
  menuBtn.addEventListener("click", () => setDrawer(true));
  drawer.addEventListener("click", (e) => {
    if (e.target === drawer || e.target.closest(".drawer-close")) setDrawer(false);
  });

  // Search overlay with live suggestions
  const overlay = document.querySelector(".search-overlay");
  const input = overlay.querySelector("input");
  const suggest = overlay.querySelector(".search-suggest");
  const setSearch = (open) => {
    overlay.hidden = !open;
    if (open) input.focus();
  };
  document.querySelector(".search-btn").addEventListener("click", () => setSearch(true));
  overlay.querySelector(".search-close").addEventListener("click", () => setSearch(false));
  overlay.addEventListener("click", (e) => { if (e.target === overlay) setSearch(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { setSearch(false); setDrawer(false); closeAll(); }
  });
  attachSearch(input, suggest);

  // Newsletter: posts to SITE.newsletterEndpoint when one is set.
  const newsletter = document.querySelector(".newsletter-form");
  newsletter.querySelector("input").name = "email";
  newsletter.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!SITE.newsletterEndpoint) {
      toast("Thank you! Our newsletter is launching soon.");
      newsletter.reset();
      return;
    }
    const ok = await postForm(SITE.newsletterEndpoint, new FormData(newsletter));
    toast(ok ? "You're subscribed — welcome to the Beauty & Praise Letter!" : "Sorry, something went wrong. Please try again.");
    if (ok) newsletter.reset();
  });
}

function searchFruits(q) {
  q = q.toLowerCase();
  const catHits = Object.entries(CATEGORIES).filter(([, label]) => label.toLowerCase().includes(q)).map(([k]) => k);
  return FRUITS.filter((fr) =>
    [fr.name, fr.latin, fr.summary, fr.nutrients.join(" ")].join(" ").toLowerCase().includes(q) ||
    fr.cats.some((c) => catHits.includes(c))
  ).sort((a, b) => (b.name.toLowerCase().startsWith(q) ? 1 : 0) - (a.name.toLowerCase().startsWith(q) ? 1 : 0));
}

function searchHerbs(q) {
  q = q.toLowerCase();
  const catHits = Object.entries(CATEGORIES).filter(([, label]) => label.toLowerCase().includes(q)).map(([k]) => k);
  return HERBS.filter((h) =>
    [h.name, h.latin, h.summary, h.about, h.uses.join(" ")].join(" ").toLowerCase().includes(q) ||
    h.cats.some((c) => catHits.includes(c))
  ).sort((a, b) => (b.name.toLowerCase().startsWith(q) ? 1 : 0) - (a.name.toLowerCase().startsWith(q) ? 1 : 0));
}

renderChrome();
