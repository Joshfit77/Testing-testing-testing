// Real herb and fruit photographs from Wikipedia / Wikimedia Commons, loaded in the visitor's browser.
//
// Every herb image on the site is rendered as <span class="pf" data-photo="herb-id"> containing
// the drawn illustration. Once the photo list arrives, a photo is laid over the illustration;
// if a photo can't be found or the request fails, the illustration simply stays.
//
// To use your own photo, the easy way: put it in images/herbs/, images/fruits/ or images/foods/, named after the
// herb, fruit or food (images/herbs/chamomile.jpg, images/fruits/apple.jpg, images/foods/eggs.jpg), then run `node scripts/build.js`.
// Or add it to PHOTO_OVERRIDES below by hand to choose your own credit line, e.g.
//   chamomile: { src: "images/chamomile.jpg", credit: "Photo by Jane Doe" }

// Stock photographs for the foods, fruits and remedies: free-licensed images on Wikimedia Commons
// (many are Unsplash and Pexels photographs). Each is the Commons file name; if one ever fails to load,
// the site's own oil painting shows instead. Your own photo in images/foods/ or images/fruits/ wins over both.
const STOCK_PHOTOS = {
  "food:kale": "Vegetable Salad (Unsplash).jpg",
  "food:cottage-cheese": "Cottagecheese200px.jpg",
  "remedy:salt-water-gargle": "Emptying a glass bottle (Unsplash).jpg",
  "remedy:saline-nasal-rinse": "Salt and pepper on table (Unsplash).jpg",
  "remedy:steam-inhalation": "Cozy Christmas coffee (Unsplash).jpg",
  "remedy:peppermint-oil-temples": "PeppermintEssentialOil.png",
  "remedy:chicken-vegetable-soup": "Bowl of chicken soup.jpg",
  "remedy:fruit-infused-water": "Brooke Lark 2017-02-19 (Unsplash).jpg",
  "food:eggs": "How Do You Like Your Eggs In The Morning (Unsplash).jpg",
  "food:greek-yogurt": "Joseph Gonzalez 2017-01-11 (Unsplash).jpg",
  "food:salmon": "Grilled plated salmon fillet.jpg",
  "food:sardines": "Fish for Lunch (Unsplash).jpg",
  "food:chicken-breast": "Roasted Chicken Dinner Plate, Broccoli, Stuffing, Potatoes, Demi Glace.jpg",
  "food:lean-beef": "Steak Dinner (Unsplash).jpg",
  "food:tofu": "Wensi Tofu.jpg",
  "food:lentils": "Healthy Lentil Salad (Unsplash).jpg",
  "food:chickpeas": "Colorful healthy Chickpea Salad - 49859083608.jpg",
  "food:black-beans": "Black bean soup (3370127734).jpg",
  "food:kefir": "Kefir in a glass.JPG",
  "food:oats": "Berries n oatmeal mod.jpg",
  "food:quinoa": "The Approvin' Peruvian- red pepper quinoa.jpg",
  "food:spinach": "Eating Healthy (Unsplash).jpg",
  "food:broccoli": "Eat Your Vegetables (Unsplash).jpg",
  "food:sweet-potato": "Roasted sweet potato.jpg",
  "food:carrots": "Carrots (Unsplash).jpg",
  "food:beets": "Uncommon beetroot colours.jpg",
  "food:sauerkraut": "Sauerkraut Jar.jpg",
  "food:almonds": "Healthy Almond Snack (Unsplash).jpg",
  "food:walnuts": "Walnuts - whole and open with halved kernel.jpg",
  "food:chia-seeds": "Chia jars with bleuberries (Unsplash).jpg",
  "food:flaxseed": "Ground Golden Flax Seeds (8594315026).jpg",
  "food:pumpkin-seeds": "Close-up On Pumpkin Seeds.jpg",
  "food:olive-oil": "Olive Oil (Unsplash).jpg",
  "food:honey": "Runny hunny.jpg",
  "food:dark-chocolate": "Dark chocolate Blanxart.jpg",
  "food:bone-broth": "Broth hg.jpg",
  "fruit:apple": "Apples 2016 (Unsplash).jpg",
  "fruit:avocado": "Avocado Rose Toast (Unsplash).jpg",
  "fruit:banana": "Timothy Lamm 2017 (Unsplash).jpg",
  "fruit:blackberry": "Blackberry Basket (Unsplash).jpg",
  "fruit:blueberry": "Bundle of Blueberries (Unsplash).jpg",
  "fruit:cherry": "Pile of Cherries (Unsplash).jpg",
  "fruit:tart-cherry": "Cherries With Stems (Unsplash).jpg",
  "fruit:coconut": "Coconut (Unsplash).jpg",
  "fruit:date": "Bowl of Dates.jpg",
  "fruit:fig": "Fig (Ficus carica) fruits.jpg",
  "fruit:grape": "Brooke Lark 2016-11-02 (Unsplash).jpg",
  "fruit:grapefruit": "Shady Grapefruit (Unsplash).jpg",
  "fruit:kiwi": "Kiwi aka.jpg",
  "fruit:lemon": "Gala Rodriguez 2016 (Unsplash).jpg",
  "fruit:lime": "Limes in Nature (Unsplash).jpg",
  "fruit:mango": "Collection of fruits (Unsplash).jpg",
  "fruit:orange": "Fruit on Display (Unsplash).jpg",
  "fruit:papaya": "Papaya - longitudinal section.jpg",
  "fruit:peach": "Assorted Peaches 2816px.jpg",
  "fruit:pear": "Sergey Zolkin 2014-10-19 (Unsplash).jpg",
  "fruit:pineapple": "Two pineapples (Unsplash).jpg",
  "fruit:pomegranate": "Pomegranate fruit - whole and piece with arils.jpg",
  "fruit:prune": "Plums (Unsplash).jpg",
  "fruit:raspberry": "Fresh Raspberries (Unsplash).jpg",
  "fruit:strawberry": "Bowl of Strawberries (Unsplash).jpg",
  "fruit:watermelon": "Tropical Fruits (Unsplash).jpg",
  "fruit:olive": "Winter Fruit Platter (Unsplash).jpg",
  "fruit:tomato": "Tomato & Potato (Unsplash).jpg",
  "fruit:cucumber": "Cucumbers (Unsplash).jpg",
  "fruit:pumpkin": "Scott Webb Photography pumpkin (Unsplash).jpg",
  "remedy:peppermint-tea-bloating": "Pexels-iconcom-214165.jpg",
  "remedy:ginger-tea-nausea": "Pitcher of tea (Unsplash).jpg",
  "remedy:fennel-seeds-after-meals": "Fragrant Spices (Unsplash).jpg",
  "remedy:chamomile-bedtime-tea": "Tea time (Unsplash).jpg",
  "remedy:tart-cherry-juice": "Pile of Cherries (Unsplash).jpg",
  "remedy:lemon-balm-tea": "Fresh Ingredients (Unsplash).jpg",
  "remedy:box-breathing": "Candle 1 (Unsplash).jpg",
  "remedy:lavender-aromatherapy": "Worker bee on purple lavender (Unsplash).jpg",
  "remedy:cool-compress-water": "Water droplets (Unsplash).jpg",
  "remedy:honey-lemon-warm-water": "Honey dipper stirring rod (Unsplash).jpg",
  "remedy:steady-energy-snack": "A Fresh Healthy Snack (Unsplash).jpg",
  "remedy:morning-light-walk": "Morning sunlight between trees (Unsplash).jpg",
  "remedy:green-tea-pick-me-up": "Alisher Sharip 2016 (Unsplash).jpg",
  "remedy:ginger-for-cramps": "Ginger Root.jpg",
  "remedy:heat-therapy-cramps": "Cozy Den (Unsplash).jpg",
  "remedy:oatmeal-soak": "Healthy Breakfast (Unsplash).jpg",
  "remedy:aloe-for-sunburn": "Cut Aloe Vera Leaf.jpg",
  "remedy:homemade-rehydration-drink": "Priscilla Du Preez 2017-04-22 (Unsplash).jpg",
};
const commonsUrl = (file, width = 1000) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, "_"))}?width=${width}`;
const stockPhoto = (key) => {
  const file = STOCK_PHOTOS[key];
  if (!file) return null;
  const [kind, name] = key.split(":");
  return { src: commonsUrl(file), small: commonsUrl(file, 640), credit: "Photo: Wikimedia Commons" };
};
const remedyPainting = (id) => ({
  "peppermint-tea-bloating": "images/oil-peppermint.jpg", "ginger-tea-nausea": "images/oil-ginger.jpg",
  "chamomile-bedtime-tea": "images/oil-chamomile.jpg", "honey-lemon-warm-water": "images/oil-honey-lemon.jpg",
  "tart-cherry-juice": "images/paintings/fruits/tart-cherry.jpg", "oatmeal-soak": "images/paintings/foods/oats.jpg",
})[id] || `images/remedies/${id}.jpg`;
const paintingOf = (kind, id) => ({ src: `images/paintings/${kind}s/${id}.jpg`, credit: "Image: Beauty & Praise" });
const PHOTO_OVERRIDES = Object.assign({},
  Object.fromEntries([...(typeof FOODS !== "undefined" ? FOODS : []).map((f) => [`food:${f.id}`, paintingOf("food", f.id)]),
    ...(typeof FRUITS !== "undefined" ? FRUITS : []).map((f) => [`fruit:${f.id}`, paintingOf("fruit", f.id)])]),
  Object.fromEntries(Object.keys(STOCK_PHOTOS).map((k) => [k, stockPhoto(k)])),
  typeof MY_PHOTOS !== "undefined" ? MY_PHOTOS : {});

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

  // Photo keys: an herb id ("chamomile"), "fruit:" + a fruit id ("fruit:apple") or "food:" + a food id ("food:eggs").
  function itemFor(key) {
    if (key.startsWith("food:")) {
      const fd = typeof FOODS !== "undefined" && FOODS.find((x) => x.id === key.slice(5));
      return fd ? { item: fd, titles: [fd.wiki, fd.name] } : null;
    }
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
        // Large pictures ask Wikimedia for a bigger standard size; if that size isn't available
        // (the original is smaller, or the size isn't offered), fall back to the size the lookup returned.
        const big = el.classList.contains("pf-large") && !p.credit ? sized(p.src, 1280) : p.src;
        img.onerror = () => {
          if (img.src !== p.src && big !== p.src) { img.src = p.src; return; }
          if (p.fallback && !img.src.endsWith(p.fallback)) { img.src = p.fallback; return; }
          img.remove(); el.dataset.state = "none";
        };
        img.src = big;
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

// Same for a food.
function foodVisual(fd, large = false) {
  return `<span class="pf${large ? " pf-large" : ""}" data-photo="food:${fd.id}" role="img" aria-label="${fd.name}">${Art.food(fd)}</span>`;
}

// Any herb, fruit or food by key ("ginger", "fruit:lemon", "food:honey"). No key → a simple leaf.
function keyVisual(key, large = false) {
  if (!key) return `<span class="pf pf-icon">${icon("leaf")}</span>`;
  const it = itemOf(key);
  if (!it) return "";
  return key.startsWith("fruit:") ? fruitVisual(it, large) : key.startsWith("food:") ? foodVisual(it, large) : visual(it, large);
}

// Same for a fruit.
function fruitVisual(fr, large = false) {
  return `<span class="pf${large ? " pf-large" : ""}" data-photo="fruit:${fr.id}" role="img" aria-label="${fr.name} (${fr.latin})">${Art.fruit(fr)}</span>`;
}
