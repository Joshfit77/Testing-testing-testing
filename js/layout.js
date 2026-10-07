// Shared site chrome (announcement bar, header, footer, search) and helpers.

const SITE = {
  name: "Beauty & Praise",
  tagline: "Food · Wellness · Gratitude",
  // Change this to your real email address so the contact form can fall back to email.
  email: "",
  // Free form services (see README): paste your endpoints here to make the forms work.
  //   contactEndpoint:    a Formspree form URL, e.g. "https://formspree.io/f/abcdwxyz"
  //   newsletterEndpoint: a Formspree form URL or your newsletter provider's embed form URL
  contactEndpoint: "",
  newsletterEndpoint: "",
  // Affiliate or shop links shown on herb pages, keyed by herb id, e.g. { ashwagandha: "https://..." }
  shop: {}
};

// Page addresses for individual herbs and fruits (one real page each, built by scripts/build.js).
const herbUrl = (id) => `herbs/${id}.html`;
const fruitUrl = (id) => `fruits/${id}.html`;
const foodUrl = (id) => `foods/${id}.html`;
const remedyUrl = (id) => `remedies/${id}.html`;

// Items are keyed as an herb id ("ginger"), "fruit:<id>" or "food:<id>" across the site.
const itemOf = (key) => key.startsWith("fruit:") ? FRUITS.find((f) => f.id === key.slice(6))
  : key.startsWith("food:") ? FOODS.find((f) => f.id === key.slice(5)) : HERBS.find((h) => h.id === key);
const itemName = (key) => itemOf(key)?.name;
const itemUrl = (key) => key.startsWith("fruit:") ? fruitUrl(key.slice(6)) : key.startsWith("food:") ? foodUrl(key.slice(5)) : herbUrl(key);

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
  clock: '<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />',
  egg: '<path d="M12 3c3.6 0 7 5.6 7 10.2A7 7 0 0 1 5 13.2C5 8.6 8.4 3 12 3z" />',
  apple: '<path d="M12 7.5c-2-1.6-6.2-1.4-7 2.8-.8 4.1 1.8 9.6 4.6 10.2 1 .2 1.6-.5 2.4-.5s1.4.7 2.4.5c2.8-.6 5.4-6.1 4.6-10.2-.8-4.2-5-4.4-7-2.8zM12 7.5c0-2 .8-3.6 2.8-4.5" />',
  flower: '<circle cx="12" cy="12" r="2.5" /><path d="M12 9.5C10 6 10.5 3 12 3s2 3 0 6.5zM12 14.5c2 3.5 1.5 6.5 0 6.5s-2-3 0-6.5zM9.5 12C6 14 3 13.5 3 12s3-2 6.5 0zM14.5 12c3.5-2 6.5-1.5 6.5 0s-3 2-6.5 0z" />',
  sparkle: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3" />',
  print: '<path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7z" />',
  mail: '<path d="M3 6h18v12H3zM3 7l9 6 9-6" />',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" />',
  pinterest: '<circle cx="12" cy="12" r="9" /><path d="M11 8.5c3-1 5 .5 5 3s-2 4-4 3.5M11.5 10 9 21" />',
  facebook: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z" />'
};

function icon(name, cls = "icon") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

// The emblem: a wooden cross in morning light, framed by a wreath of leaves and blossoms.
const LOGO_MARK = `<svg class="logo-mark" viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="bpGlow" cx="50%" cy="38%" r="55%"><stop offset="0" stop-color="#f7d99a" stop-opacity=".95"/><stop offset=".55" stop-color="#f3dfb8" stop-opacity=".55"/><stop offset="1" stop-color="#f6f1e7" stop-opacity="0"/></radialGradient><linearGradient id="bpWood" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#9a6436"/><stop offset=".45" stop-color="#b98150"/><stop offset="1" stop-color="#7c4c27"/></linearGradient><linearGradient id="bpWoodH" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#bd8754"/><stop offset=".55" stop-color="#a26b3b"/><stop offset="1" stop-color="#80502a"/></linearGradient></defs><circle cx="32" cy="32" r="31" fill="#f6f1e7"/><circle cx="32" cy="30" r="22" fill="url(#bpGlow)"/><path d="M19.44 15.75L15.11 13.25M21.75 12.75L18.21 9.21M24.75 10.44L22.25 6.11M28.25 8.99L26.95 4.16M32 8.5L32 3.5M35.75 8.99L37.05 4.16M39.25 10.44L41.75 6.11M42.25 12.75L45.79 9.21M44.56 15.75L48.89 13.25" stroke="#d9a55a" stroke-width=".7" stroke-linecap="round" opacity=".75"/><circle cx="32" cy="32" r="30.2" fill="none" stroke="#2e4636" stroke-width="1.5"/><circle cx="32" cy="32" r="27.6" fill="none" stroke="#2e4636" stroke-width=".45" stroke-dasharray="1 1.8" opacity=".7"/><path d="M15 52.5C21 48.6 26.5 47.6 32 47.6S43 48.6 49 52.5C44 56 39 57.6 32 57.6S20 56 15 52.5Z" fill="#5f8a62" opacity=".35"/><path d="M29.3 11.2h5.4c.4 0 .7.3.7.7v39.4H28.6V11.9c0-.4.3-.7.7-.7Z" fill="url(#bpWood)" stroke="#5a3a1f" stroke-width=".7"/><path d="M19.4 19.6h25.2c.4 0 .7.3.7.7v4.6c0 .4-.3.7-.7.7H19.4c-.4 0-.7-.3-.7-.7v-4.6c0-.4.3-.7.7-.7Z" fill="url(#bpWoodH)" stroke="#5a3a1f" stroke-width=".7"/><path d="M30.6 13.5v5.2M33.2 13v5.6M30.4 26.6c.3 4 .1 8 .5 12s-.2 7 .2 10M33.4 27c-.3 3.5.3 7.5 0 11.5s.4 6 .1 9.5M21.5 21.4c3 .3 6 -.2 6.5.1M37 23.2c2.6-.3 4.8.2 6.6-.1M22 23.6c1.8-.2 3.6.2 5-.1M36.6 21.2c2.2.2 4.6-.2 6.9.1" stroke="#6b4322" stroke-width=".4" stroke-linecap="round" fill="none" opacity=".55"/><circle cx="32" cy="22.3" r=".7" fill="#5a3a1f" opacity=".8"/><path transform="translate(28.4 51.6) rotate(-38)" d="M0 0C2.73 -2.38 2.42 -6.63 0 -8.5C-2.42 -6.63 -2.73 -2.38 0 0Z" fill="#2e4636"/><path transform="translate(28.4 51.6) rotate(-38)" d="M0 -1.02V-6.97" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(35.6 51.6) rotate(38)" d="M0 0C2.73 -2.38 2.42 -6.63 0 -8.5C-2.42 -6.63 -2.73 -2.38 0 0Z" fill="#2e4636"/><path transform="translate(35.6 51.6) rotate(38)" d="M0 -1.02V-6.97" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(27.4 52.4) rotate(-68)" d="M0 0C2.36 -1.9 2.09 -5.3 0 -6.8C-2.09 -5.3 -2.36 -1.9 0 0Z" fill="#5f8a62"/><path transform="translate(27.4 52.4) rotate(-68)" d="M0 -0.82V-5.58" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(36.6 52.4) rotate(68)" d="M0 0C2.36 -1.9 2.09 -5.3 0 -6.8C-2.09 -5.3 -2.36 -1.9 0 0Z" fill="#5f8a62"/><path transform="translate(36.6 52.4) rotate(68)" d="M0 -0.82V-5.58" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(30.4 52) rotate(-14)" d="M0 0C1.98 -1.68 1.76 -4.68 0 -6C-1.76 -4.68 -1.98 -1.68 0 0Z" fill="#86a97f"/><path transform="translate(30.4 52) rotate(-14)" d="M0 -0.72V-4.92" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(33.6 52) rotate(14)" d="M0 0C1.98 -1.68 1.76 -4.68 0 -6C-1.76 -4.68 -1.98 -1.68 0 0Z" fill="#86a97f"/><path transform="translate(33.6 52) rotate(14)" d="M0 -0.72V-4.92" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path d="M32 50.5c-3-1.6-2.6-4.2 0-5.4s3-4 .2-5.6-2.8-4.2 0-5.6" fill="none" stroke="#2e4636" stroke-width=".75" stroke-linecap="round"/><path transform="translate(29.6 46.8) rotate(-60)" d="M0 0C1.61 -1.23 1.43 -3.43 0 -4.4C-1.43 -3.43 -1.61 -1.23 0 0Z" fill="#5f8a62"/><path transform="translate(29.6 46.8) rotate(-60)" d="M0 -0.53V-3.61" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(34.6 42) rotate(58)" d="M0 0C1.61 -1.23 1.43 -3.43 0 -4.4C-1.43 -3.43 -1.61 -1.23 0 0Z" fill="#86a97f"/><path transform="translate(34.6 42) rotate(58)" d="M0 -0.53V-3.61" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(29.8 37.4) rotate(-62)" d="M0 0C1.49 -1.12 1.32 -3.12 0 -4C-1.32 -3.12 -1.49 -1.12 0 0Z" fill="#2e4636"/><path transform="translate(29.8 37.4) rotate(-62)" d="M0 -0.48V-3.28" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(33.4 33.4) rotate(48)" d="M0 0C1.3 -0.95 1.16 -2.65 0 -3.4C-1.16 -2.65 -1.3 -0.95 0 0Z" fill="#5f8a62"/><path transform="translate(33.4 33.4) rotate(48)" d="M0 -0.41V-2.79" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path d="M29 54.5C16 54 8 42 11 22" fill="none" stroke="#2e4636" stroke-width=".9" stroke-linecap="round"/><path transform="translate(25.26 54.01) rotate(-114.96)" d="M0 0C2.56 -1.99 2.27 -5.54 0 -7.1C-2.27 -5.54 -2.56 -1.99 0 0Z" fill="#2e4636"/><path transform="translate(25.26 54.01) rotate(-114.96)" d="M0 -0.85V-5.83" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(25.26 54.01) rotate(-38.96)" d="M0 0C2.56 -1.99 2.27 -5.54 0 -7.1C-2.27 -5.54 -2.56 -1.99 0 0Z" fill="#5f8a62"/><path transform="translate(25.26 54.01) rotate(-38.96)" d="M0 -0.85V-5.83" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(21.12 52.49) rotate(-100.5)" d="M0 0C2.43 -1.89 2.15 -5.26 0 -6.74C-2.15 -5.26 -2.43 -1.89 0 0Z" fill="#5f8a62"/><path transform="translate(21.12 52.49) rotate(-100.5)" d="M0 -0.81V-5.53" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(21.12 52.49) rotate(-24.5)" d="M0 0C2.43 -1.89 2.15 -5.26 0 -6.74C-2.15 -5.26 -2.43 -1.89 0 0Z" fill="#86a97f"/><path transform="translate(21.12 52.49) rotate(-24.5)" d="M0 -0.81V-5.53" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(17.56 50) rotate(-85.69)" d="M0 0C2.3 -1.79 2.04 -4.97 0 -6.38C-2.04 -4.97 -2.3 -1.79 0 0Z" fill="#86a97f"/><path transform="translate(17.56 50) rotate(-85.69)" d="M0 -0.77V-5.23" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(17.56 50) rotate(-9.69)" d="M0 0C2.3 -1.79 2.04 -4.97 0 -6.38C-2.04 -4.97 -2.3 -1.79 0 0Z" fill="#2e4636"/><path transform="translate(17.56 50) rotate(-9.69)" d="M0 -0.77V-5.23" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(14.64 46.58) rotate(-71.66)" d="M0 0C2.17 -1.68 1.92 -4.69 0 -6.01C-1.92 -4.69 -2.17 -1.68 0 0Z" fill="#2e4636"/><path transform="translate(14.64 46.58) rotate(-71.66)" d="M0 -0.72V-4.93" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(14.64 46.58) rotate(4.34)" d="M0 0C2.17 -1.68 1.92 -4.69 0 -6.01C-1.92 -4.69 -2.17 -1.68 0 0Z" fill="#5f8a62"/><path transform="translate(14.64 46.58) rotate(4.34)" d="M0 -0.72V-4.93" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(12.42 42.27) rotate(-59.17)" d="M0 0C2.04 -1.58 1.81 -4.41 0 -5.65C-1.81 -4.41 -2.04 -1.58 0 0Z" fill="#5f8a62"/><path transform="translate(12.42 42.27) rotate(-59.17)" d="M0 -0.68V-4.63" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(12.42 42.27) rotate(16.83)" d="M0 0C2.04 -1.58 1.81 -4.41 0 -5.65C-1.81 -4.41 -2.04 -1.58 0 0Z" fill="#86a97f"/><path transform="translate(12.42 42.27) rotate(16.83)" d="M0 -0.68V-4.63" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(10.98 37.1) rotate(-48.46)" d="M0 0C1.9 -1.48 1.69 -4.12 0 -5.29C-1.69 -4.12 -1.9 -1.48 0 0Z" fill="#86a97f"/><path transform="translate(10.98 37.1) rotate(-48.46)" d="M0 -0.63V-4.33" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(10.98 37.1) rotate(27.54)" d="M0 0C1.9 -1.48 1.69 -4.12 0 -5.29C-1.69 -4.12 -1.9 -1.48 0 0Z" fill="#2e4636"/><path transform="translate(10.98 37.1) rotate(27.54)" d="M0 -0.63V-4.33" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(10.38 31.12) rotate(-39.4)" d="M0 0C1.77 -1.38 1.57 -3.84 0 -4.92C-1.57 -3.84 -1.77 -1.38 0 0Z" fill="#2e4636"/><path transform="translate(10.38 31.12) rotate(-39.4)" d="M0 -0.59V-4.04" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(10.38 31.12) rotate(36.6)" d="M0 0C1.77 -1.38 1.57 -3.84 0 -4.92C-1.57 -3.84 -1.77 -1.38 0 0Z" fill="#5f8a62"/><path transform="translate(10.38 31.12) rotate(36.6)" d="M0 -0.59V-4.04" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(10.69 24.36) rotate(-31.72)" d="M0 0C1.64 -1.28 1.46 -3.56 0 -4.56C-1.46 -3.56 -1.64 -1.28 0 0Z" fill="#5f8a62"/><path transform="translate(10.69 24.36) rotate(-31.72)" d="M0 -0.55V-3.74" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(10.69 24.36) rotate(44.28)" d="M0 0C1.64 -1.28 1.46 -3.56 0 -4.56C-1.46 -3.56 -1.64 -1.28 0 0Z" fill="#86a97f"/><path transform="translate(10.69 24.36) rotate(44.28)" d="M0 -0.55V-3.74" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(11 22) rotate(8.53)" d="M0 0C1.86 -1.46 1.65 -4.06 0 -5.2C-1.65 -4.06 -1.86 -1.46 0 0Z" fill="#5f8a62"/><path transform="translate(11 22) rotate(8.53)" d="M0 -0.62V-4.26" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path d="M35 54.5C48 54 56 42 53 22" fill="none" stroke="#2e4636" stroke-width=".9" stroke-linecap="round"/><path transform="translate(38.74 54.01) rotate(38.96)" d="M0 0C2.56 -1.99 2.27 -5.54 0 -7.1C-2.27 -5.54 -2.56 -1.99 0 0Z" fill="#2e4636"/><path transform="translate(38.74 54.01) rotate(38.96)" d="M0 -0.85V-5.83" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(38.74 54.01) rotate(114.96)" d="M0 0C2.56 -1.99 2.27 -5.54 0 -7.1C-2.27 -5.54 -2.56 -1.99 0 0Z" fill="#5f8a62"/><path transform="translate(38.74 54.01) rotate(114.96)" d="M0 -0.85V-5.83" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(42.88 52.49) rotate(24.5)" d="M0 0C2.43 -1.89 2.15 -5.26 0 -6.74C-2.15 -5.26 -2.43 -1.89 0 0Z" fill="#5f8a62"/><path transform="translate(42.88 52.49) rotate(24.5)" d="M0 -0.81V-5.53" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(42.88 52.49) rotate(100.5)" d="M0 0C2.43 -1.89 2.15 -5.26 0 -6.74C-2.15 -5.26 -2.43 -1.89 0 0Z" fill="#86a97f"/><path transform="translate(42.88 52.49) rotate(100.5)" d="M0 -0.81V-5.53" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(46.44 50) rotate(9.69)" d="M0 0C2.3 -1.79 2.04 -4.97 0 -6.38C-2.04 -4.97 -2.3 -1.79 0 0Z" fill="#86a97f"/><path transform="translate(46.44 50) rotate(9.69)" d="M0 -0.77V-5.23" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(46.44 50) rotate(85.69)" d="M0 0C2.3 -1.79 2.04 -4.97 0 -6.38C-2.04 -4.97 -2.3 -1.79 0 0Z" fill="#2e4636"/><path transform="translate(46.44 50) rotate(85.69)" d="M0 -0.77V-5.23" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(49.36 46.58) rotate(-4.34)" d="M0 0C2.17 -1.68 1.92 -4.69 0 -6.01C-1.92 -4.69 -2.17 -1.68 0 0Z" fill="#2e4636"/><path transform="translate(49.36 46.58) rotate(-4.34)" d="M0 -0.72V-4.93" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(49.36 46.58) rotate(71.66)" d="M0 0C2.17 -1.68 1.92 -4.69 0 -6.01C-1.92 -4.69 -2.17 -1.68 0 0Z" fill="#5f8a62"/><path transform="translate(49.36 46.58) rotate(71.66)" d="M0 -0.72V-4.93" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(51.58 42.27) rotate(-16.83)" d="M0 0C2.04 -1.58 1.81 -4.41 0 -5.65C-1.81 -4.41 -2.04 -1.58 0 0Z" fill="#5f8a62"/><path transform="translate(51.58 42.27) rotate(-16.83)" d="M0 -0.68V-4.63" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(51.58 42.27) rotate(59.17)" d="M0 0C2.04 -1.58 1.81 -4.41 0 -5.65C-1.81 -4.41 -2.04 -1.58 0 0Z" fill="#86a97f"/><path transform="translate(51.58 42.27) rotate(59.17)" d="M0 -0.68V-4.63" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(53.02 37.1) rotate(-27.54)" d="M0 0C1.9 -1.48 1.69 -4.12 0 -5.29C-1.69 -4.12 -1.9 -1.48 0 0Z" fill="#86a97f"/><path transform="translate(53.02 37.1) rotate(-27.54)" d="M0 -0.63V-4.33" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(53.02 37.1) rotate(48.46)" d="M0 0C1.9 -1.48 1.69 -4.12 0 -5.29C-1.69 -4.12 -1.9 -1.48 0 0Z" fill="#2e4636"/><path transform="translate(53.02 37.1) rotate(48.46)" d="M0 -0.63V-4.33" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(53.62 31.12) rotate(-36.6)" d="M0 0C1.77 -1.38 1.57 -3.84 0 -4.92C-1.57 -3.84 -1.77 -1.38 0 0Z" fill="#2e4636"/><path transform="translate(53.62 31.12) rotate(-36.6)" d="M0 -0.59V-4.04" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(53.62 31.12) rotate(39.4)" d="M0 0C1.77 -1.38 1.57 -3.84 0 -4.92C-1.57 -3.84 -1.77 -1.38 0 0Z" fill="#5f8a62"/><path transform="translate(53.62 31.12) rotate(39.4)" d="M0 -0.59V-4.04" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(53.31 24.36) rotate(-44.28)" d="M0 0C1.64 -1.28 1.46 -3.56 0 -4.56C-1.46 -3.56 -1.64 -1.28 0 0Z" fill="#5f8a62"/><path transform="translate(53.31 24.36) rotate(-44.28)" d="M0 -0.55V-3.74" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(53.31 24.36) rotate(31.72)" d="M0 0C1.64 -1.28 1.46 -3.56 0 -4.56C-1.46 -3.56 -1.64 -1.28 0 0Z" fill="#86a97f"/><path transform="translate(53.31 24.36) rotate(31.72)" d="M0 -0.55V-3.74" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><path transform="translate(53 22) rotate(-8.53)" d="M0 0C1.86 -1.46 1.65 -4.06 0 -5.2C-1.65 -4.06 -1.86 -1.46 0 0Z" fill="#5f8a62"/><path transform="translate(53 22) rotate(-8.53)" d="M0 -0.62V-4.26" stroke="#f6f1e7" stroke-width=".35" stroke-linecap="round" opacity=".55"/><ellipse cx="15.8" cy="36.27" rx="1.87" ry="1.22" transform="rotate(-90 15.8 36.27)" fill="#c0715a"/><ellipse cx="17.92" cy="37.81" rx="1.87" ry="1.22" transform="rotate(-18 17.92 37.81)" fill="#c0715a"/><ellipse cx="17.11" cy="40.31" rx="1.87" ry="1.22" transform="rotate(54 17.11 40.31)" fill="#c0715a"/><ellipse cx="14.49" cy="40.31" rx="1.87" ry="1.22" transform="rotate(126 14.49 40.31)" fill="#c0715a"/><ellipse cx="13.68" cy="37.81" rx="1.87" ry="1.22" transform="rotate(198 13.68 37.81)" fill="#c0715a"/><circle cx="15.8" cy="38.5" r="1.15" fill="#e7c27a"/><ellipse cx="48.2" cy="36.27" rx="1.87" ry="1.22" transform="rotate(-90 48.2 36.27)" fill="#c0715a"/><ellipse cx="50.32" cy="37.81" rx="1.87" ry="1.22" transform="rotate(-18 50.32 37.81)" fill="#c0715a"/><ellipse cx="49.51" cy="40.31" rx="1.87" ry="1.22" transform="rotate(54 49.51 40.31)" fill="#c0715a"/><ellipse cx="46.89" cy="40.31" rx="1.87" ry="1.22" transform="rotate(126 46.89 40.31)" fill="#c0715a"/><ellipse cx="46.08" cy="37.81" rx="1.87" ry="1.22" transform="rotate(198 46.08 37.81)" fill="#c0715a"/><circle cx="48.2" cy="38.5" r="1.15" fill="#e7c27a"/><ellipse cx="21.2" cy="46.14" rx="1.56" ry="1.02" transform="rotate(-90 21.2 46.14)" fill="#e8897a"/><ellipse cx="22.97" cy="47.43" rx="1.56" ry="1.02" transform="rotate(-18 22.97 47.43)" fill="#e8897a"/><ellipse cx="22.29" cy="49.5" rx="1.56" ry="1.02" transform="rotate(54 22.29 49.5)" fill="#e8897a"/><ellipse cx="20.11" cy="49.5" rx="1.56" ry="1.02" transform="rotate(126 20.11 49.5)" fill="#e8897a"/><ellipse cx="19.43" cy="47.43" rx="1.56" ry="1.02" transform="rotate(198 19.43 47.43)" fill="#e8897a"/><circle cx="21.2" cy="48" r="0.96" fill="#e7c27a"/><ellipse cx="42.8" cy="46.14" rx="1.56" ry="1.02" transform="rotate(-90 42.8 46.14)" fill="#e8897a"/><ellipse cx="44.57" cy="47.43" rx="1.56" ry="1.02" transform="rotate(-18 44.57 47.43)" fill="#e8897a"/><ellipse cx="43.89" cy="49.5" rx="1.56" ry="1.02" transform="rotate(54 43.89 49.5)" fill="#e8897a"/><ellipse cx="41.71" cy="49.5" rx="1.56" ry="1.02" transform="rotate(126 41.71 49.5)" fill="#e8897a"/><ellipse cx="41.03" cy="47.43" rx="1.56" ry="1.02" transform="rotate(198 41.03 47.43)" fill="#e8897a"/><circle cx="42.8" cy="48" r="0.96" fill="#e7c27a"/><ellipse cx="13.4" cy="25.39" rx="1.35" ry="0.88" transform="rotate(-90 13.4 25.39)" fill="#e3a08a"/><ellipse cx="14.93" cy="26.5" rx="1.35" ry="0.88" transform="rotate(-18 14.93 26.5)" fill="#e3a08a"/><ellipse cx="14.35" cy="28.3" rx="1.35" ry="0.88" transform="rotate(54 14.35 28.3)" fill="#e3a08a"/><ellipse cx="12.45" cy="28.3" rx="1.35" ry="0.88" transform="rotate(126 12.45 28.3)" fill="#e3a08a"/><ellipse cx="11.87" cy="26.5" rx="1.35" ry="0.88" transform="rotate(198 11.87 26.5)" fill="#e3a08a"/><circle cx="13.4" cy="27" r="0.83" fill="#e7c27a"/><ellipse cx="50.6" cy="25.39" rx="1.35" ry="0.88" transform="rotate(-90 50.6 25.39)" fill="#e3a08a"/><ellipse cx="52.13" cy="26.5" rx="1.35" ry="0.88" transform="rotate(-18 52.13 26.5)" fill="#e3a08a"/><ellipse cx="51.55" cy="28.3" rx="1.35" ry="0.88" transform="rotate(54 51.55 28.3)" fill="#e3a08a"/><ellipse cx="49.65" cy="28.3" rx="1.35" ry="0.88" transform="rotate(126 49.65 28.3)" fill="#e3a08a"/><ellipse cx="49.07" cy="26.5" rx="1.35" ry="0.88" transform="rotate(198 49.07 26.5)" fill="#e3a08a"/><circle cx="50.6" cy="27" r="0.83" fill="#e7c27a"/><ellipse cx="26.5" cy="51.51" rx="1.25" ry="0.82" transform="rotate(-90 26.5 51.51)" fill="#f4c26b"/><ellipse cx="27.92" cy="52.54" rx="1.25" ry="0.82" transform="rotate(-18 27.92 52.54)" fill="#f4c26b"/><ellipse cx="27.37" cy="54.2" rx="1.25" ry="0.82" transform="rotate(54 27.37 54.2)" fill="#f4c26b"/><ellipse cx="25.63" cy="54.2" rx="1.25" ry="0.82" transform="rotate(126 25.63 54.2)" fill="#f4c26b"/><ellipse cx="25.08" cy="52.54" rx="1.25" ry="0.82" transform="rotate(198 25.08 52.54)" fill="#f4c26b"/><circle cx="26.5" cy="53" r="0.77" fill="#c0715a"/><ellipse cx="37.5" cy="51.51" rx="1.25" ry="0.82" transform="rotate(-90 37.5 51.51)" fill="#f4c26b"/><ellipse cx="38.92" cy="52.54" rx="1.25" ry="0.82" transform="rotate(-18 38.92 52.54)" fill="#f4c26b"/><ellipse cx="38.37" cy="54.2" rx="1.25" ry="0.82" transform="rotate(54 38.37 54.2)" fill="#f4c26b"/><ellipse cx="36.63" cy="54.2" rx="1.25" ry="0.82" transform="rotate(126 36.63 54.2)" fill="#f4c26b"/><ellipse cx="36.08" cy="52.54" rx="1.25" ry="0.82" transform="rotate(198 36.08 52.54)" fill="#f4c26b"/><circle cx="37.5" cy="53" r="0.77" fill="#c0715a"/><ellipse cx="30.2" cy="30.02" rx="0.99" ry="0.65" transform="rotate(-90 30.2 30.02)" fill="#f7ece0"/><ellipse cx="31.32" cy="30.84" rx="0.99" ry="0.65" transform="rotate(-18 31.32 30.84)" fill="#f7ece0"/><ellipse cx="30.89" cy="32.15" rx="0.99" ry="0.65" transform="rotate(54 30.89 32.15)" fill="#f7ece0"/><ellipse cx="29.51" cy="32.15" rx="0.99" ry="0.65" transform="rotate(126 29.51 32.15)" fill="#f7ece0"/><ellipse cx="29.08" cy="30.84" rx="0.99" ry="0.65" transform="rotate(198 29.08 30.84)" fill="#f7ece0"/><circle cx="30.2" cy="31.2" r="0.61" fill="#c0715a"/><ellipse cx="34.2" cy="39.51" rx="0.83" ry="0.54" transform="rotate(-90 34.2 39.51)" fill="#f7ece0"/><ellipse cx="35.14" cy="40.19" rx="0.83" ry="0.54" transform="rotate(-18 35.14 40.19)" fill="#f7ece0"/><ellipse cx="34.78" cy="41.3" rx="0.83" ry="0.54" transform="rotate(54 34.78 41.3)" fill="#f7ece0"/><ellipse cx="33.62" cy="41.3" rx="0.83" ry="0.54" transform="rotate(126 33.62 41.3)" fill="#f7ece0"/><ellipse cx="33.26" cy="40.19" rx="0.83" ry="0.54" transform="rotate(198 33.26 40.19)" fill="#f7ece0"/><circle cx="34.2" cy="40.5" r="0.51" fill="#c0715a"/></svg>`;

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

// The main menu: just five simple tabs.
function siteMenu() {
  return [
    { id: "home", label: "Home", href: "index.html" },
    { id: "foods", label: "Foods", href: "foods.html" },
    { id: "remedies", label: "Remedies", href: "remedies.html" },
    { id: "herbs", label: "Herbs", href: "herbs.html" },
    { id: "story", label: "Our Story", href: "about.html" }
  ];
}

const PAGE_GROUP = {
  home: "home", foods: "foods", food: "foods", fruit: "foods",
  remedies: "remedies", remedy: "remedies",
  herbs: "herbs", herb: "herbs", stacks: "herbs",
  about: "story"
};

// Search across foods, remedies, guides, herbs, fruits and stacks. Fills a <ul> with suggestions.
// Light plural handling so "blueberries" finds Blueberry and "headaches" finds Headaches.
const singular = (q) => q.replace(/ies$/, "y").replace(/([^s])s$/, "$1");
function fillSuggestions(q, list) {
  q = q.trim().toLowerCase().replace(/-/g, " ");
  list.innerHTML = "";
  if (q.length < 2) return;
  const one = singular(q);
  const rows = [];
  const has = (...t) => { const text = t.join(" ").toLowerCase().replace(/-/g, " "); return text.includes(q) || text.includes(one); };
  FOOD_CATEGORIES.filter((c) => has(c.label) || c.keywords.some((k) => q.includes(k))).slice(0, 2).forEach((c) =>
    rows.push(`<a href="foods.html?cat=${c.id}"><span class="mini-art suggest-icon">${icon(c.icon)}</span><span><strong>${c.label}</strong><em>Food category</em></span></a>`));
  Object.entries(REMEDY_CATS).filter(([, c]) => has(c.label)).slice(0, 1).forEach(([k, c]) =>
    rows.push(`<a href="remedies.html?cat=${k}"><span class="mini-art suggest-icon">${icon(c.icon)}</span><span><strong>Remedies for ${c.label.toLowerCase()}</strong><em>Natural remedies</em></span></a>`));
  TOPIC_GUIDES.filter((g) => has(g.short, g.title)).slice(0, 2).forEach((g) =>
    rows.push(`<a href="${guideUrlFor(g.id)}"><span class="mini-art suggest-icon">${icon(g.icon)}</span><span><strong>${g.short}</strong><em>Wellness goal</em></span></a>`));
  searchFoods(one).slice(0, 3).forEach((fd) =>
    rows.push(`<a href="${foodUrl(fd.id)}"><span class="mini-art">${foodVisual(fd)}</span><span><strong>${fd.name}</strong><em>${FOOD_GROUPS[fd.group]} · Food</em></span></a>`));
  REMEDIES.filter((r) => has(r.name, r.helps.join(" "))).slice(0, 2).forEach((r) =>
    rows.push(`<a href="${remedyUrl(r.id)}"><span class="mini-art">${keyVisual(r.items[0])}</span><span><strong>${r.name}</strong><em>Natural remedy</em></span></a>`));
  searchFruits(one).slice(0, 3).forEach((fr) =>
    rows.push(`<a href="${fruitUrl(fr.id)}"><span class="mini-art">${fruitVisual(fr)}</span><span><strong>${fr.name}</strong><em>${fr.latin} · Fruit</em></span></a>`));
  searchHerbs(one).slice(0, 3).forEach((h) =>
    rows.push(`<a href="${herbUrl(h.id)}"><span class="mini-art">${visual(h)}</span><span><strong>${h.name}</strong><em>${h.latin} · Herb</em></span></a>`));
  STACKS.filter((st) => has(st.name, st.tagline)).slice(0, 1).forEach((st) =>
    rows.push(`<a href="stacks.html?s=${st.id}"><span class="mini-art">${visual(findHerb(st.herbs[0].id))}</span><span><strong>${st.name}</strong><em>Herbal stack</em></span></a>`));
  list.innerHTML = rows.length ? rows.slice(0, 10).map((r) => `<li>${r}</li>`).join("") : `<li class="no-match">No matches — try a food, remedy or need like “sleep”.</li>`;
}
const guideUrlFor = (id) => `finder.html?goal=${id}`;

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

  const mobile = `<a class="drawer-home" href="index.html">Home</a>` + menu.filter((m) => m.id !== "home").map((m) => m.href
    ? `<a class="drawer-link" href="${m.href}">${m.label}</a>`
    : `<details class="drawer-group"${group === m.id ? " open" : ""}><summary>${m.label}</summary>${m.items.map((i) => `<a href="${i.href}"${i.highlight ? ' class="nav-highlight"' : ""}>${i.label}</a>`).join("")}</details>`).join("");

  document.getElementById("site-header").innerHTML = `
    <header class="header">
      <div class="container header-inner">
        <button class="icon-btn menu-btn" aria-label="Open menu" aria-expanded="false">${icon("menu")}</button>
        <a href="index.html" class="logo" aria-label="${SITE.name} home">
          ${LOGO_MARK}
          <span class="logo-text"><span class="logo-name">Beauty <em>&amp;</em> Praise</span><span class="logo-tag">${SITE.tagline}</span></span>
        </a>
        <nav class="main-nav" aria-label="Main"><ul>${desktop}</ul></nav>
        <div class="header-actions">
          <a href="finder.html" class="btn btn-primary btn-small header-cta">What should I eat?</a>
          <button class="icon-btn search-btn" aria-label="Search">${icon("search")}</button>
        </div>
      </div>
    </header>
    <div class="drawer" hidden>
      <div class="drawer-panel">
        <button class="icon-btn drawer-close" aria-label="Close menu">${icon("close")}</button>
        <a href="finder.html" class="btn btn-primary drawer-cta">What should I eat?</a>
        <nav class="drawer-nav" aria-label="Menu">${mobile}</nav>
        <p class="drawer-extra"><a href="interactions.html">${icon("shield")} Safety checker</a><a href="es/index.html" lang="es">Español</a></p>
        <p class="drawer-verse">“${dailyPick(VERSES).text}”</p>
      </div>
    </div>
    <div class="search-overlay" hidden>
      <form class="search-form" action="foods.html" role="search">
        ${icon("search")}
        <input type="search" name="q" placeholder="Search foods, remedies or needs — try “sleep”, “headache” or “high-protein foods”" aria-label="Search" autocomplete="off">
        <button type="button" class="icon-btn search-close" aria-label="Close search">${icon("close")}</button>
      </form>
      <ul class="search-suggest"></ul>
    </div>`;

  const footCol = (title, links) => `<div><h3>${title}</h3><ul>${links.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join("")}</ul></div>`;
  document.getElementById("site-footer").innerHTML = `
    <section class="newsletter">
      <div class="container newsletter-inner">
        <div>
          <p class="eyebrow light">The Beauty &amp; Praise Letter</p>
          <h2>Seasonal foods, simple remedies &amp; encouragement</h2>
        </div>
        <form class="newsletter-form">
          <input type="email" required placeholder="Your email address" aria-label="Email address">
          <button class="btn btn-light" type="submit">Subscribe</button>
        </form>
      </div>
    </section>
    <footer class="footer">
      <div class="footer-verse container">
        <img class="footer-olive" src="images/olive-branch.svg" alt="" aria-hidden="true" width="530" height="150">
        <p class="script">Let everything that has breath praise the LORD.</p>
        <cite>Psalm 150:6 (NASB 1995)</cite>
      </div>
      <div class="container footer-grid">
        <div class="footer-brand">
          <a href="index.html" class="logo logo-light">${LOGO_MARK}<span class="logo-text"><span class="logo-name">Beauty <em>&amp;</em> Praise</span><span class="logo-tag">${SITE.tagline}</span></span></a>
          <p>Real food, simple natural remedies and the small daily habits that help us flourish — body, mind and spirit.</p>
          <div class="socials">
            <a href="#" aria-label="Instagram">${icon("instagram")}</a>
            <a href="#" aria-label="Pinterest">${icon("pinterest")}</a>
            <a href="#" aria-label="Facebook">${icon("facebook")}</a>
          </div>
        </div>
        ${footCol("Explore", [["foods.html", "Foods"], ["remedies.html", "Natural Remedies"], ["herbs.html", "Herbs"], ["about.html", "Our Story"]])}
        ${footCol("Helpful tools", [["finder.html", "What should I eat?"], ["interactions.html", "Safety Checker"], ["reminders.html", "Daily reminders"], ["stacks.html", "Herbal stacks"]])}
        ${footCol("Faith", [["bible.html", "Herbs &amp; Fruits of the Bible"], ["es/index.html", "Español"]])}
      </div>
      <div class="container footer-bottom">
        <p>© ${new Date().getFullYear()} Beauty &amp; Praise. All rights reserved.</p>
        <p class="legal-links"><a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a> · <a href="disclaimer.html">Medical disclaimer</a></p>
        <p>Lifestyle photographs from <a href="https://unsplash.com" target="_blank" rel="noopener">Unsplash</a> photographers; herb and fruit photographs from <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a> contributors — credits on each page.</p>
        <p>For education only — not medical advice. Always consult your healthcare provider.</p>
        <p class="photo-credits"></p>
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

function searchFoods(q) {
  q = q.toLowerCase();
  return FOODS.filter((fd) => [fd.name, FOOD_GROUPS[fd.group], fd.what, fd.nutrients.join(" ")].join(" ").toLowerCase().includes(q))
    .sort((a, b) => (b.name.toLowerCase().startsWith(q) ? 1 : 0) - (a.name.toLowerCase().startsWith(q) ? 1 : 0));
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

// Keep the logo and the menu from ever overlapping. Fonts and screen sizes vary, so measure:
// if the full menu doesn't fit beside the logo, switch to the ☰ menu button instead.
function fitHeader() {
  const header = document.querySelector(".header");
  const logo = header && header.querySelector(".logo");
  const nav = header && header.querySelector(".main-nav");
  const actions = header && header.querySelector(".header-actions");
  if (!header || !logo || !nav || !actions) return;
  header.classList.remove("nav-compact", "no-cta");
  if (getComputedStyle(nav).display === "none") return;
  const fits = () => {
    const l = logo.getBoundingClientRect(), a = actions.getBoundingClientRect(), list = nav.querySelector("ul");
    return list.scrollWidth <= nav.clientWidth + 1 && nav.getBoundingClientRect().left >= l.right + 28 && list.getBoundingClientRect().right <= a.left - 8;
  };
  if (fits()) return;
  header.classList.add("no-cta");          // 1) drop the header button (it's also in the top bar)
  if (!fits()) header.classList.add("nav-compact"); // 2) still too tight: use the ☰ menu
}
fitHeader();
window.addEventListener("resize", fitHeader);
window.addEventListener("load", fitHeader);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitHeader);

// ---------- Real photography ----------
// Lifestyle photographs from Unsplash (free to use under the Unsplash License), each shot on a real camera.
// To use your own photo instead, save it as images/scenes/<name>.jpg (e.g. images/scenes/hero-figs.jpg)
// and run `node scripts/build.js` — it replaces the photo everywhere that name is used.
// [image address, description (alt text), photographer]
const SCENES = {
  "hero-figs": ["https://images.unsplash.com/photo-1569243177055-f4855fc83949", "Sliced lemons and fresh figs on a plate in morning sunlight", "Weronika Karczewska"],
  "hero-tea": ["https://images.unsplash.com/38/QoR8Bv1S2SEqH6UcSJCA_Tea.jpg", "A ceramic teacup resting on an open book beside pink flowers", "Carli Jeen"],
  "hero-berries": ["https://images.unsplash.com/photo-1457347876270-97799484c564", "Two ceramic cups of fresh blueberries on a brown cloth", "Joanna Kosinska"],
  "pressed-flowers": ["https://images.unsplash.com/photo-1568884209881-a474eb38199d", "Dried flowers lying on creased linen", "Weronika Karczewska"],
  "bible-tea": ["https://images.unsplash.com/photo-1580651521938-df6336ec8bde", "An open Bible with flowers and a cup of tea", "Sixteen Miles Out"],
  "bible-rose": ["https://images.unsplash.com/photo-1573177201559-b6eed209d3dc", "An open Bible with a pink rose and petals", "Alabaster Co"],
  "bible-psalms": ["https://images.unsplash.com/photo-1571167530149-c1105da4c2c7", "The Book of Psalms beside fresh green leaves and flowers", "Alabaster Co"],
  "foods-board": ["https://images.unsplash.com/photo-1555521275-c51f3e4a95c3", "A sliced pomegranate on a wooden chopping board", "Pratiksha Mohanty"],
  "remedy-tea": ["https://images.unsplash.com/photo-1571742457994-1ff4736ebfe7", "A warm mug on a woven saucer beside books and autumn leaves", "Olesia Buiar"],
  "herb-basket": ["https://images.unsplash.com/photo-1496660988113-291c5f308503", "A wicker basket of freshly gathered hedgerow plants", "Annie Spratt"],
  "plan-notebook": ["https://images.unsplash.com/photo-1571785880387-a37073314dea", "An open notebook beside a mug and a candle", "Kevin Wiegand"],
  "window-flowers": ["https://images.unsplash.com/photo-1591880908902-d02f5e1db88f", "Wild cow parsley in a ceramic vase by a window", "Elena Kloppenburg"],
  "dahlia-jars": ["https://images.unsplash.com/photo-1448216118999-7a3f98dc37f2", "Garden dahlias in simple glass jars", "Maria"],
  "window-plants": ["https://images.unsplash.com/photo-1584555912530-1b2c29c946e9", "Small potted plants on a wooden table by a window", "Jornada Produtora"],
  "garden-bed": ["https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e", "Herbs and salad greens growing in a raised garden bed", "Markus Spiske"],
  "bread-linen": ["https://images.unsplash.com/photo-1586871309760-4cceac05ea12", "Fresh bread on a linen cloth", "Camille Brodard"],
  "lemons-basket": ["https://images.unsplash.com/photo-1554884133-995b1e4c1645", "Yellow lemons in a woven wicker basket", "Hayley Maxwell"],
  "windowsill": ["https://images.unsplash.com/photo-1591133569797-227d95ea8fd8", "Spring flowers on a sunny window sill", "Tetiana Shadrina"],
  "peony-jar": ["https://images.unsplash.com/photo-1565889673228-c963fae33465", "A blush peony in a mason jar", "Jessica Johnston"],
  "hands-flowers": ["https://images.unsplash.com/photo-1429341565469-c014916dc816", "Hands tending small white flowers in a glass jar", "SnapbyThree"]
};
const sceneUrl = (slot, w) => {
  const mine = typeof MY_SCENES !== "undefined" && MY_SCENES[slot];
  if (mine) return mine;
  return SCENES[slot] ? `${SCENES[slot][0]}?auto=format&fit=crop&w=${w}&q=72` : "";
};
const sceneSrcset = (slot) => (typeof MY_SCENES !== "undefined" && MY_SCENES[slot]) ? "" : [520, 900, 1400, 2000].map((w) => `${sceneUrl(slot, w)} ${w}w`).join(", ");
// A photograph, printed on paper; if it can't load, a plain linen frame stays instead.
function scene(slot, cls = "", sizes = "(max-width: 700px) 92vw, 46vw") {
  if (!SCENES[slot]) return "";
  return `<figure class="photo ${cls}"><img src="${sceneUrl(slot, 1200)}" srcset="${sceneSrcset(slot)}" sizes="${sizes}" alt="${SCENES[slot][1]}" loading="lazy" decoding="async" data-credit="Photo: ${SCENES[slot][2]} / Unsplash" onerror="this.closest('.photo').classList.add('photo-missing')"></figure>`;
}
// Static pages mark photo spots with <img data-scene="name">; fill them in here.
function fillScenes() {
  document.querySelectorAll("img[data-scene]:not([src])").forEach((img) => {
    const slot = img.dataset.scene;
    if (!SCENES[slot]) return;
    img.src = sceneUrl(slot, 1200);
    const set = sceneSrcset(slot);
    if (set) img.srcset = set;
    if (!img.alt) img.alt = SCENES[slot][1];
    img.dataset.credit = `Photo: ${SCENES[slot][2]} / Unsplash`;
    img.addEventListener("error", () => img.closest(".photo")?.classList.add("photo-missing"));
  });
}

// ---------- Scripture woven into each page (NASB 1995), each beside a fitting photograph ----------
// Herb, food and fruit profiles already carry their own verse card, so they are not listed here.
const PAGE_SCRIPTURE = {
  foods: ["after", "Whether, then, you eat or drink or whatever you do, do all to the glory of God.", "1 Corinthians 10:31", "bread-linen"],
  herbs: ["after", "He causes the grass to grow for the cattle, and vegetation for the labor of man, so that he may bring forth food from the earth.", "Psalm 104:14", "bible-psalms"],
  remedies: ["after", "Do not be wise in your own eyes; fear the LORD and turn away from evil. It will be healing to your body and refreshment to your bones.", "Proverbs 3:7–8", "bible-rose"],
  remedy: ["end", "My son, give attention to my words; incline your ear to my sayings. Do not let them depart from your sight; keep them in the midst of your heart. For they are life to those who find them and health to all their body.", "Proverbs 4:20–22", "bible-tea"],
  stacks: ["after", "Behold, I have given you every plant yielding seed that is on the surface of all the earth, and every tree which has fruit yielding seed; it shall be food for you.", "Genesis 1:29", "garden-bed"],
  finder: ["after", "Be anxious for nothing, but in everything by prayer and supplication with thanksgiving let your requests be made known to God.", "Philippians 4:6", "bible-tea"],
  interactions: ["after", "Or do you not know that your body is a temple of the Holy Spirit who is in you, whom you have from God, and that you are not your own? For you have been bought with a price: therefore glorify God in your body.", "1 Corinthians 6:19–20", "bible-rose"],
  living: ["after", "Look at the birds of the air, that they do not sow, nor reap nor gather into barns, and yet your heavenly Father feeds them. Are you not worth much more than they?", "Matthew 6:26", "window-flowers"],
  about: ["after", "And do not be conformed to this world, but be transformed by the renewing of your mind, so that you may prove what the will of God is, that which is good and acceptable and perfect.", "Romans 12:2", "bible-psalms"]
};
const scriptureBlock = ([, text, ref, photo]) => `<section class="page-scripture"><div class="container verse-spread">
  ${scene(photo, "print verse-photo", "(max-width: 700px) 80vw, 30vw")}
  <blockquote class="scripture verse-paper"><p>“${text}”</p><cite>${ref} · NASB 1995</cite></blockquote>
</div></section>`;

// A photograph for the top of each list page.
const PAGE_PHOTO = { foods: "lemons-basket", remedies: "remedy-tea", herbs: "garden-bed", stacks: "dahlia-jars", finder: "plan-notebook",
  interactions: "window-plants", living: "windowsill", about: "hands-flowers", bible: "bible-psalms", legal: "peony-jar" };

// Name the photographers whose pictures appear on this page, at the foot of the page.
function creditPhotos() {
  const el = document.querySelector(".photo-credits");
  if (!el) return;
  const names = [...new Set([...document.querySelectorAll("img[data-credit]")].map((i) => i.dataset.credit.replace(/^Photo: | \/ Unsplash$/g, "")))];
  el.textContent = names.length ? `Photography on this page: ${names.join(", ")} (Unsplash).` : "";
}

// Dress every inner page: a real photograph in the hero and a verse that fits the page.
function decorateArt() {
  fillScenes();
  const page = document.body.dataset.page;
  if (page === "home") { creditPhotos(); return initMotion(); }
  document.body.classList.add("artful");
  const hero = document.querySelector("main .page-hero, main .herb-hero, main .stack-hero, main > .hero");
  if (!hero || hero.classList.contains("art-page-hero")) return initMotion();
  hero.classList.add("art-page-hero");
  const title = hero.classList.contains("page-hero") && hero.querySelector("h1");
  if (title && !title.children.length) { // editorial accent: the last word in italic
    const words = title.textContent.trim().split(/\s+/);
    if (words.length > 1) {
      const em = document.createElement("em");
      em.textContent = words.pop();
      title.textContent = words.join(" ") + " ";
      title.append(em);
    }
  }
  const photo = hero.classList.contains("page-hero") && PAGE_PHOTO[page];
  if (photo) {
    hero.classList.add("has-photo");
    hero.querySelector(".container").insertAdjacentHTML("beforeend", `<div class="hero-photo">${scene(photo, "print", "(max-width: 900px) 92vw, 40vw").replace(' loading="lazy"', ' fetchpriority="high"')}</div>`);
  }
  const verse = PAGE_SCRIPTURE[page];
  if (verse && !document.querySelector(".page-scripture")) {
    if (verse[0] === "after") hero.insertAdjacentHTML("afterend", scriptureBlock(verse));
    else document.querySelector("main").insertAdjacentHTML("beforeend", scriptureBlock(verse));
  }
  creditPhotos();
  initMotion();
}

// Calm motion: sections fade up as they arrive, photographs drift a touch on scroll.
function initMotion() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("motion");
  initMotion.io = initMotion.io || new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); initMotion.io.unobserve(e.target); }
  }), { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
  document.querySelectorAll("main > section:not(.reveal), .footer-verse:not(.reveal)").forEach((el) => {
    el.classList.add("reveal");
    initMotion.io.observe(el);
  });
  if (initMotion.drift) return;
  initMotion.drift = true;
  let queued = false;
  const drift = () => {
    queued = false;
    document.querySelectorAll("[data-parallax]").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) return;
      el.style.setProperty("--py", `${((r.top + r.height / 2 - innerHeight / 2) * parseFloat(el.dataset.parallax)).toFixed(1)}px`);
    });
  };
  addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(drift); } }, { passive: true });
  drift();
}
// (pages.js calls decorateArt() once each page has drawn its content.)
document.addEventListener("DOMContentLoaded", fillScenes);
