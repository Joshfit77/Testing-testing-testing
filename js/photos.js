// Real herb and fruit photographs from Wikipedia / Wikimedia Commons, loaded in the visitor's browser.
//
// Every herb image on the site is rendered as <span class="pf" data-photo="herb-id"> containing
// the drawn illustration. Once the photo list arrives, a photo is laid over the illustration;
// if a photo can't be found or the request fails, the illustration simply stays.
//
// To use your own photo, the easy way: put it in images/herbs/ or images/fruits/, named after the
// herb or fruit (images/herbs/chamomile.jpg, images/fruits/apple.jpg), then run `node scripts/build.js`.
// Or add it to PHOTO_OVERRIDES below by hand to choose your own credit line, e.g.
//   chamomile: { src: "images/chamomile.jpg", credit: "Photo by Jane Doe" }

const PHOTO_OVERRIDES = Object.assign({}, typeof MY_PHOTOS !== "undefined" ? MY_PHOTOS : {}, {
});

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
  caraway: "Caraway", moringa: "Moringa oleifera", neem: "Azadirachta indica", "tea-tree": "Melaleuca alternifolia",
  "tongkat-ali": "Eurycoma longifolia", shilajit: "Shilajit", mucuna: "Mucuna pruriens", tribulus: "Tribulus terrestris",
  maca: "Maca", "horny-goat-weed": "Epimedium", cordyceps: "Cordyceps militaris"
};

// Wikipedia article titles for fruits, where the plain name isn't the best match.
const FRUIT_WIKI_TITLES = {
  "tart-cherry": "Prunus cerasus", "dragon-fruit": "Pitaya", "goji-berry": "Goji", kiwi: "Kiwifruit",
  "passion-fruit": "Passion fruit", starfruit: "Carambola", acai: "Açaí palm", acerola: "Malpighia emarginata",
  "asian-pear": "Pyrus pyrifolia", "red-currant": "Redcurrant", kiwano: "Horned melon", "maqui-berry": "Aristotelia chilensis",
  "miracle-fruit": "Synsepalum dulcificum", "monk-fruit": "Siraitia grosvenorii", noni: "Morinda citrifolia",
  pawpaw: "Asimina triloba", "plantain-fruit": "Cooking banana", "prickly-pear": "Opuntia ficus-indica",
  "sea-buckthorn": "Hippophae rhamnoides", honeyberry: "Lonicera caerulea", "mamey-sapote": "Pouteria sapota",
  "bitter-melon": "Momordica charantia", amla: "Phyllanthus emblica", baobab: "Adansonia digitata",
  "camu-camu": "Myrciaria dubia", "sugar-apple": "Annona squamosa", serviceberry: "Amelanchier alnifolia",
  goldenberry: "Physalis peruviana", "black-sapote": "Diospyros nigra", bael: "Aegle marmelos",
  mangosteen: "Purple mangosteen", jabuticaba: "Plinia cauliflora", honeydew: "Honeydew (melon)",
  persimmon: "Japanese persimmon", date: "Date palm", fig: "Common fig", "blood-orange": "Blood orange", prune: "Prune"
};

const Photos = (() => {
  const KEY = "bp-photos-v2";
  const MAX_AGE = 7 * 24 * 3600 * 1000;
  const API = "https://en.wikipedia.org/w/api.php";

  // Photo keys: an herb id ("chamomile") or "fruit:" + a fruit id ("fruit:apple").
  function itemFor(key) {
    if (key.startsWith("fruit:")) {
      const fr = typeof FRUITS !== "undefined" && FRUITS.find((x) => x.id === key.slice(6));
      return fr ? { item: fr, titles: [FRUIT_WIKI_TITLES[fr.id], fr.name.replace(/\s*\(.*\)/, ""), fr.latin] } : null;
    }
    const h = HERBS.find((x) => x.id === key);
    return h ? { item: h, titles: [WIKI_TITLES[h.id], h.latin, h.name.replace(/\s*\(.*\)/, "")] } : null;
  }
  const candidates = (key) => [...new Set((itemFor(key)?.titles || []).filter(Boolean))];

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

  // Cache: { t: time saved, m: { key: photo | 0 } } — 0 means "looked up, no photo".
  let cache = store.get(KEY, null);
  if (!cache || Date.now() - cache.t > MAX_AGE) cache = { t: Date.now(), m: {} };
  const inflight = {};

  async function load(keys) {
    const missing = [...new Set(keys)].filter((k) => !(k in cache.m) && !PHOTO_OVERRIDES[k]);
    const waits = [...new Set(keys)].map((k) => inflight[k]).filter(Boolean);
    if (missing.length) {
      const job = (async () => {
        const titles = [...new Set(missing.flatMap(candidates))];
        const batches = [];
        for (let i = 0; i < titles.length; i += 50) batches.push(titles.slice(i, i + 50));
        const results = await Promise.all(batches.map((b) => queryTitles(b).catch(() => null)));
        if (results.every((r) => r === null)) return; // offline or blocked: try again next visit
        const found = Object.assign({}, ...results.filter(Boolean));
        missing.forEach((k) => { cache.m[k] = candidates(k).map((t) => found[t]).find(Boolean) || 0; });
        store.set(KEY, cache);
      })();
      missing.forEach((k) => (inflight[k] = job));
      waits.push(job);
    }
    await Promise.all(waits);
    const out = {};
    keys.forEach((k) => { out[k] = PHOTO_OVERRIDES[k] || cache.m[k] || null; });
    return out;
  }

  // Bigger version of a Wikimedia thumbnail (for hero images).
  const sized = (src, px) => src.replace(/\/(\d+)px-/, `/${px}px-`);

  function apply(root = document) {
    const frames = root.querySelectorAll ? [...root.querySelectorAll(".pf[data-photo]:not([data-state])")] : [];
    if (!frames.length) return;
    frames.forEach((el) => (el.dataset.state = "loading"));
    load(frames.map((el) => el.dataset.photo)).then((map) => {
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

  // Look up the photographer and license for the credit line on herb and fruit pages.
  async function credit(key) {
    const p = (await load([key]))[key];
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

// Same for a fruit.
function fruitVisual(fr, large = false) {
  return `<span class="pf${large ? " pf-large" : ""}" data-photo="fruit:${fr.id}" role="img" aria-label="${fr.name} (${fr.latin})">${Art.fruit(fr)}</span>`;
}
