// Real herb photographs from Wikipedia / Wikimedia Commons, loaded in the visitor's browser.
//
// Every herb image on the site is rendered as <span class="pf" data-photo="herb-id"> containing
// the drawn illustration. Once the photo list arrives, a photo is laid over the illustration;
// if a photo can't be found or the request fails, the illustration simply stays.
//
// To use your own photo for an herb instead, add it to PHOTO_OVERRIDES below, e.g.
//   chamomile: { src: "images/chamomile.jpg", credit: "Photo by Jane Doe" }

const PHOTO_OVERRIDES = {};

// Wikipedia article titles where the herb's common or Latin name isn't the best match.
const WIKI_TITLES = {
  coriander: "Coriander", cinnamon: "Cinnamon", clove: "Clove", cardamom: "Cardamom", nutmeg: "Nutmeg",
  "black-pepper": "Black pepper", cayenne: "Cayenne pepper", cumin: "Cumin", fenugreek: "Fenugreek",
  "star-anise": "Illicium verum", licorice: "Liquorice", turmeric: "Turmeric", ginger: "Ginger",
  garlic: "Garlic", saffron: "Saffron", vanilla: "Vanilla", mustard: "Mustard seed", "rose-hips": "Rose hip",
  "oat-straw": "Oat", hops: "Hops", "green-tea": "Green tea", rooibos: "Rooibos", "yerba-mate": "Yerba mate",
  "olive-leaf": "Olea europaea", cranberry: "Cranberry", reishi: "Lingzhi (mushroom)", rose: "Rosa × damascena",
  "aloe-vera": "Aloe vera", "holy-basil": "Ocimum tenuiflorum", chasteberry: "Vitex agnus-castus",
  "raspberry-leaf": "Rubus idaeus", elderflower: "Sambucus nigra", parsley: "Parsley", dill: "Dill",
  "bay-laurel": "Laurus nobilis", "black-seed": "Nigella sativa", chicory: "Chicory", lovage: "Lovage",
  caraway: "Caraway", moringa: "Moringa oleifera", neem: "Azadirachta indica", "tea-tree": "Melaleuca alternifolia"
};

const Photos = (() => {
  const KEY = "bp-photos-v1";
  const MAX_AGE = 7 * 24 * 3600 * 1000;
  const API = "https://en.wikipedia.org/w/api.php";
  let pending = null;

  const candidates = (h) => [...new Set([WIKI_TITLES[h.id], h.latin, h.name.replace(/\s*\(.*\)/, "")].filter(Boolean))];

  async function queryTitles(titles) {
    const url = `${API}?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=thumbnail|name&pithumbsize=800&pilicense=free&titles=${encodeURIComponent(titles.join("|"))}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Photo lookup failed");
    const data = await res.json();
    const q = data.query || {};
    // Follow normalization and redirects back to the title we asked for.
    const alias = {};
    (q.normalized || []).forEach((n) => (alias[n.from] = n.to));
    (q.redirects || []).forEach((r) => (alias[r.from] = r.to));
    const resolve = (t) => { let seen = 0; while (alias[t] && seen++ < 5) t = alias[t]; return t; };
    const byTitle = {};
    Object.values(q.pages || {}).forEach((p) => {
      if (p.thumbnail && p.pageimage) byTitle[p.title] = { src: p.thumbnail.source, file: p.pageimage, page: p.title };
    });
    const out = {};
    titles.forEach((t) => { const hit = byTitle[resolve(t)]; if (hit) out[t] = hit; });
    return out;
  }

  function load() {
    if (pending) return pending;
    const cached = store.get(KEY, null);
    if (cached && Date.now() - cached.t < MAX_AGE && cached.m) {
      pending = Promise.resolve({ ...cached.m, ...PHOTO_OVERRIDES });
      return pending;
    }
    pending = (async () => {
      const titles = [...new Set(HERBS.flatMap(candidates))];
      const batches = [];
      for (let i = 0; i < titles.length; i += 50) batches.push(titles.slice(i, i + 50));
      const found = Object.assign({}, ...(await Promise.all(batches.map((b) => queryTitles(b).catch(() => ({}))))));
      const map = {};
      HERBS.forEach((h) => {
        const hit = candidates(h).map((t) => found[t]).find(Boolean);
        if (hit) map[h.id] = hit;
      });
      if (Object.keys(map).length) store.set(KEY, { t: Date.now(), m: map });
      return { ...map, ...PHOTO_OVERRIDES };
    })().catch(() => ({ ...PHOTO_OVERRIDES }));
    return pending;
  }

  // Bigger version of a Wikimedia thumbnail (for hero images).
  const sized = (src, px) => src.replace(/\/(\d+)px-/, `/${px}px-`);

  function apply(root = document) {
    const frames = root.querySelectorAll ? root.querySelectorAll(".pf[data-photo]:not([data-state])") : [];
    if (!frames.length) return;
    frames.forEach((el) => (el.dataset.state = "loading"));
    load().then((map) => {
      frames.forEach((el) => {
        const p = map[el.dataset.photo];
        if (!p) { el.dataset.state = "none"; return; }
        const img = new Image();
        img.alt = el.getAttribute("aria-label") || "";
        img.decoding = "async";
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        img.onload = () => { el.dataset.state = "photo"; };
        img.onerror = () => { img.remove(); el.dataset.state = "none"; };
        img.src = el.classList.contains("pf-large") ? sized(p.src, 1200) : p.src;
        el.appendChild(img);
      });
    });
  }

  // Look up the photographer and license for the credit line on herb pages.
  async function credit(id) {
    const map = await load();
    const p = map[id];
    if (!p) return null;
    if (p.credit) return { text: p.credit };
    const fileUrl = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(p.file)}`;
    try {
      const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=extmetadata&titles=${encodeURIComponent("File:" + p.file)}`;
      const data = await (await fetch(url)).json();
      const meta = Object.values(data.query.pages)[0].imageinfo[0].extmetadata;
      const strip = (html) => { const d = document.createElement("div"); d.innerHTML = html || ""; return d.textContent.trim(); };
      return { artist: strip(meta.Artist?.value) || "Unknown", license: strip(meta.LicenseShortName?.value), url: fileUrl };
    } catch {
      return { artist: "Wikimedia Commons contributor", license: "", url: fileUrl };
    }
  }

  // Apply automatically to anything added to the page.
  new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && apply(n.parentNode || n)))).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", () => apply());

  return { load, apply, credit };
})();

// Markup for an herb image: illustration now, real photo when it arrives.
function visual(h, large = false) {
  return `<span class="pf${large ? " pf-large" : ""}" data-photo="${h.id}" role="img" aria-label="${h.name} (${h.latin})">${Art.herb(h)}</span>`;
}
