#!/usr/bin/env node
// Builds one real page per herb, fruit, food and remedy (herbs/<id>.html, fruits/<id>.html, …),
// the list of your own photos (js/my-photos.js), plus
// sitemap.xml and robots.txt, so search engines can find and index every page.
//
// Run from the project folder whenever you change herb or fruit data:
//   node scripts/build.js
//
// Set SITE_URL to your live address (with a trailing slash). If you use a custom domain,
// change it to e.g. "https://www.yourdomain.com/".

const SITE_URL = process.env.SITE_URL || "https://joshfit77.github.io/Testing-testing-testing/";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

// Load the site's data files the same way the browser does.
const ctx = {};
vm.createContext(ctx);
vm.runInContext(
  ["js/herbs-data.js", "js/herbs-summary.js", "js/herbs-benefits.js", "js/herbs-pharm.js", "js/herbs-caps.js", "js/fruits-data.js", "js/foods-data.js", "js/remedies.js", "js/stacks.js", "js/content.js", "js/interactions.js", "js/guides.js", "js/bible.js", "js/prune.js"]
    .map(read).join("\n") +
    "\nthis.D = { HERBS, SUMMARY, BENEFITS, PHARM, CAPS, FRUITS, CATEGORIES, EVIDENCE, STACKS, ARTICLES, INTERACTIONS, IX_DETAILS, TOPIC_GUIDES, SAFETY_GUIDES, FOODS, FOOD_GROUPS, REMEDIES, REMEDY_CATS, REMEDY_SOURCES, foodProfile };",
  ctx
);
const { HERBS, SUMMARY, BENEFITS, PHARM, CAPS, FRUITS, CATEGORIES, EVIDENCE, STACKS, ARTICLES, INTERACTIONS, IX_DETAILS, TOPIC_GUIDES, SAFETY_GUIDES, FOODS, FOOD_GROUPS, REMEDIES, REMEDY_CATS, REMEDY_SOURCES, foodProfile } = ctx.D;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const firstSentences = (text, max = 155) => {
  let out = "";
  for (const s of text.split(/(?<=\.)\s+/)) {
    if ((out + " " + s).trim().length > max) break;
    out = (out + " " + s).trim();
  }
  return out || text.slice(0, max - 1) + "…";
};

function page(template, { title, description, url, image, id, main, jsonld }) {
  let html = template.replace(/\n  <meta (property="og:|name="twitter:)[^>]*>/g, "");
  html = html.replace("<head>", `<head>\n  <base href="../">`);
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Beauty &amp; Praise">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${image}">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>`);
  html = html.replace(/<body data-page="(\w+)">/, `<body data-page="$1" data-id="${id}">`);
  html = html.replace(/<main id="(\w+)-main"><\/main>/, `<main id="$1-main">\n${main}\n  </main>`);
  return html;
}

const ogImage = SITE_URL + "images/og-image.png";
const breadcrumb = (section, sectionUrl, name, url) => ({
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: section, item: SITE_URL + sectionUrl },
    { "@type": "ListItem", position: 3, name, item: url }
  ]
});

// ---------- Cache-busting ----------
// Stamp every local stylesheet, script and icon link with a version so visitors get the newest
// files right after an update instead of an old copy their browser saved.
const STAMP = Date.now().toString(36);
for (const file of fs.readdirSync(root).filter((f) => f.endsWith(".html")).concat(["es/index.html", "es/seguridad.html"])) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  const html = fs.readFileSync(full, "utf8");
  const next = html.replace(/((?:src|href)="(?:css|js|images)\/[^"?]+\.(?:css|js|svg))(?:\?v=[\w]+)?"/g, `$1?v=${STAMP}"`);
  if (next !== html) fs.writeFileSync(full, next);
}

// ---------- Your own photos ----------
// Drop a photo named after an herb, fruit or food into images/herbs/, images/fruits/ or images/foods/
// (e.g. images/herbs/chamomile.jpg, images/fruits/apple.jpg, images/foods/chicken-breast.jpg) and it replaces the Wikipedia photo.
const PHOTO_EXT = /\.(jpe?g|png|webp|avif)$/i; // .svg drawings are left for photos.js overrides
const myPhotos = {};
const unknownPhotos = [];
for (const [dir, list, prefix] of [["herbs", HERBS, ""], ["fruits", FRUITS, "fruit:"], ["foods", FOODS, "food:"]]) {
  const folder = path.join(root, "images", dir);
  fs.mkdirSync(folder, { recursive: true });
  for (const file of fs.readdirSync(folder).filter((f) => PHOTO_EXT.test(f)).sort()) {
    const id = file.replace(PHOTO_EXT, "").toLowerCase();
    if (list.some((x) => x.id === id)) myPhotos[prefix + id] = { src: `images/${dir}/${file}`, credit: "Photo: Beauty & Praise" };
    else unknownPhotos.push(`images/${dir}/${file}`);
  }
}
// Your own lifestyle photos: images/scenes/<name>.jpg replaces the photo of that name in SCENES (js/layout.js).
const myScenes = {};
const scenesDir = path.join(root, "images", "scenes");
fs.mkdirSync(scenesDir, { recursive: true });
for (const file of fs.readdirSync(scenesDir).filter((f) => PHOTO_EXT.test(f)).sort()) myScenes[file.replace(PHOTO_EXT, "").toLowerCase()] = `images/scenes/${file}`;
fs.writeFileSync(path.join(root, "js", "my-photos.js"),
  `// Made by scripts/build.js from the photos in images/herbs/, images/fruits/, images/foods/ and images/scenes/. Don't edit by hand.\nconst MY_PHOTOS = ${JSON.stringify(myPhotos, null, 2)};\nconst MY_SCENES = ${JSON.stringify(myScenes, null, 2)};\n`);
if (unknownPhotos.length) console.warn(`These photos don't match an herb or fruit id and were skipped:\n  ${unknownPhotos.join("\n  ")}`);

// Start each section fresh so pages for removed items don't linger.
for (const dir of ["herbs", "fruits", "foods", "remedies"]) {
  const d = path.join(root, dir);
  if (fs.existsSync(d)) fs.readdirSync(d).filter((f) => f.endsWith(".html")).forEach((f) => fs.unlinkSync(path.join(d, f)));
}

// ---------- Herbs ----------
const herbTemplate = read("herb.html");
fs.mkdirSync(path.join(root, "herbs"), { recursive: true });
for (const h of HERBS) {
  const url = `${SITE_URL}herbs/${h.id}.html`;
  const title = `${h.name} (${h.latin}): Benefits, Uses, Dosage & Safety — Beauty & Praise`;
  const description = firstSentences(SUMMARY[h.id]);
  const caps = CAPS[h.id];
  const capText = Array.isArray(caps.cap) ? `Capsule form: ${caps.cap[0]}${caps.cap[1] !== caps.cap[0] ? "–" + caps.cap[1] : ""} mg (${caps.cap[2]}), ${caps.cap[3]}.` : caps.cap;
  const herbText = caps.herb ? (typeof caps.herb[0] === "number" ? `The herb by itself: ${caps.herb[0]}${caps.herb[1] !== caps.herb[0] ? "–" + caps.herb[1] : ""} g (${caps.herb[2]}), ${caps.herb[3]}.` : `The herb by itself: ${caps.herb[0]}. ${caps.herb[2]}.`) : "For use on the skin only — do not swallow.";
  const main = `    <article class="container narrow prose static-content">
      <p><a href="index.html">Home</a> / <a href="herbs.html">Herb Library</a> / ${esc(h.name)}</p>
      <h1>${esc(h.name)}</h1>
      <p><em>${esc(h.latin)}</em> · ${esc(h.family)} · ${h.cats.map((c) => esc(CATEGORIES[c])).join(", ")}</p>
      <h2>Benefits at a glance</h2>
      <p>${esc(SUMMARY[h.id])}</p>
      <h2>Overview</h2>
      <p>${esc(h.about)}</p>
      <h2>What it does in your body</h2>
      <ul>${PHARM[h.id].body.map(([s, t]) => `<li><strong>${esc(s)}:</strong> ${esc(t)}</li>`).join("")}</ul>
      <h2>How it works chemically</h2>
      <ul>${PHARM[h.id].chem.map(([c, t, d]) => `<li><strong>${esc(c)}</strong> (${esc(t)}): ${esc(d)}</li>`).join("")}</ul>
      <h2>Benefits explained</h2>
      ${BENEFITS[h.id].map(([e, t, d]) => `<h3>${esc(t)} (${EVIDENCE[e].label})</h3><p>${esc(d)}</p>`).join("\n      ")}
      <h2>How much to take (adults 100 lb and over)</h2>
      <p>${esc(capText)}</p>
      <p>${esc(herbText)}</p>
      <h2>Traditional uses</h2>
      <ul>${h.uses.map((u) => `<li>${esc(u)}</li>`).join("")}</ul>
      <h2>How to prepare</h2>
      <p>${esc(h.prep)}</p>
      <h2>Safety &amp; cautions</h2>
      <p>${esc(h.caution)}</p>
      <p><small>For education only — not medical advice.</small></p>
    </article>`;
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", headline: `${h.name} (${h.latin})`, description, url, image: ogImage, publisher: { "@type": "Organization", name: "Beauty & Praise" }, about: { "@type": "Thing", name: h.name, alternateName: h.latin } },
      breadcrumb("Herb Library", "herbs.html", h.name, url)
    ]
  };
  fs.writeFileSync(path.join(root, "herbs", `${h.id}.html`), page(herbTemplate, { title, description, url, image: ogImage, id: h.id, main, jsonld }));
}

// ---------- Fruits & foods (one shared page structure) ----------
const evidenceLabel = { R: "Well researched", P: "Some research", T: "Traditional use" };
function foodArticle(p, crumb, crumbUrl) {
  return `    <article class="container narrow prose static-content">
      <p><a href="index.html">Home</a> / <a href="${crumbUrl}">${crumb}</a> / ${esc(p.name)}</p>
      <h1>${esc(p.name)}</h1>
      <p><em>${esc(p.sub)}</em></p>
      <h2>What it is</h2>
      <p>${esc(p.what)}</p>
      ${p.kind === "fruit" ? `<p>${esc(p.summary)}</p>` : ""}
      <h2>Key nutrients</h2>
      <ul>${p.nutrients.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
      <h2>Potential benefits</h2>
      ${p.benefits.map(([e, t, d]) => `<h3>${esc(t)} (${evidenceLabel[e]})</h3><p>${esc(d)}</p>`).join("\n      ")}
      <h2>Best ways to eat it</h2>
      <ul>${p.uses.map((u) => `<li>${esc(u)}</li>`).join("")}</ul>
      <h2>Typical serving</h2>
      <p>${esc(p.serving[0])} (about ${p.serving[1]} g).</p>
      <h2>When to eat it</h2>
      <p>${esc(p.when)}</p>
      <h2>Who may benefit</h2>
      <ul>${p.who.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
      <h2>Possible downsides</h2>
      <ul>${p.downsides.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
      ${p.allergies ? `<h2>Allergies &amp; interactions</h2><p>${esc(p.allergies)}</p>` : ""}
      <h2>Pregnancy &amp; breastfeeding</h2>
      <p>${esc(p.pregnancy)}</p>
      <h2>Sources &amp; references</h2>
      <ul>${p.refs.map(([l, u]) => `<li><a href="${u}">${esc(l)}</a></li>`).join("")}</ul>
      <p><small>For education only — not medical advice.</small></p>
    </article>`;
}
const articleLd = (headline, description, url, alt, section, sectionUrl) => ({
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Article", headline, description, url, image: ogImage, publisher: { "@type": "Organization", name: "Beauty & Praise" }, about: { "@type": "Thing", name: headline, ...(alt ? { alternateName: alt } : {}) } },
    breadcrumb(section, sectionUrl, headline, url)
  ]
});

const fruitTemplate = read("fruit.html");
fs.mkdirSync(path.join(root, "fruits"), { recursive: true });
for (const fr of FRUITS) {
  const url = `${SITE_URL}fruits/${fr.id}.html`;
  const title = `${fr.name}: Benefits, Nutrition & How to Eat It — Beauty & Praise`;
  const description = firstSentences(fr.summary);
  const main = foodArticle(foodProfile(fr, "fruit", INTERACTIONS), "Fruit Library", "fruits.html");
  fs.writeFileSync(path.join(root, "fruits", `${fr.id}.html`), page(fruitTemplate, { title, description, url, image: ogImage, id: fr.id, main, jsonld: articleLd(fr.name, description, url, fr.latin, "Fruit Library", "fruits.html") }));
}

const foodTemplate = read("food.html");
fs.mkdirSync(path.join(root, "foods"), { recursive: true });
for (const fd of FOODS) {
  const url = `${SITE_URL}foods/${fd.id}.html`;
  const title = `${fd.name}: Nutrition, Benefits, Serving Size & Safety — Beauty & Praise`;
  const description = firstSentences(fd.what);
  const main = foodArticle(foodProfile(fd, "food", INTERACTIONS), "Food Library", "foods.html");
  fs.writeFileSync(path.join(root, "foods", `${fd.id}.html`), page(foodTemplate, { title, description, url, image: ogImage, id: fd.id, main, jsonld: articleLd(fd.name, description, url, null, "Food Library", "foods.html") }));
}

// ---------- Natural remedies ----------
const remedyTemplate = read("remedy.html");
fs.mkdirSync(path.join(root, "remedies"), { recursive: true });
for (const r of REMEDIES) {
  const url = `${SITE_URL}remedies/${r.id}.html`;
  const title = `${r.name}: How to Make It, Amounts & Safety — Beauty & Praise`;
  const description = firstSentences(r.intro);
  const main = `    <article class="container narrow prose static-content">
      <p><a href="index.html">Home</a> / <a href="remedies.html">Natural Remedies</a> / ${esc(r.name)}</p>
      <h1>${esc(r.name)}</h1>
      <p>${esc(r.intro)}</p>
      <h2>What it may help with</h2>
      <ul>${r.helps.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      <h2>Ingredients</h2>
      <ul>${r.ingredients.map(([a, i]) => `<li>${esc(a)} ${esc(i)}</li>`).join("")}</ul>
      <h2>How to make it</h2>
      <ol>${r.steps.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>
      <h2>Suggested amount</h2>
      <p>${esc(r.amount)}</p>
      <h2>How often</h2>
      <p>${esc(r.often)}</p>
      <h2>Evidence level: ${evidenceLabel[r.evidence[0]]}</h2>
      <p>${esc(r.evidence[1])}</p>
      <h2>Safety warnings</h2>
      <ul>${r.safety.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      <h2>When to seek medical care instead</h2>
      <ul>${r.seekCare.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      <p><small>For education only — not medical advice.</small></p>
    </article>`;
  const jsonld = { "@context": "https://schema.org", "@graph": [
    { "@type": "HowTo", name: r.name, description, url, image: ogImage,
      supply: r.ingredients.map(([a, i]) => ({ "@type": "HowToSupply", name: `${a} ${i}`.trim() })),
      step: r.steps.map((t) => ({ "@type": "HowToStep", text: t })) },
    breadcrumb("Natural Remedies", "remedies.html", r.name, url)
  ] };
  fs.writeFileSync(path.join(root, "remedies", `${r.id}.html`), page(remedyTemplate, { title, description, url, image: ogImage, id: r.id, main, jsonld }));
}

// ---------- Sitemap & robots ----------
const today = new Date().toISOString().slice(0, 10);
const rootPages = ["", "foods.html", "remedies.html", "herbs.html", "about.html", "finder.html", "interactions.html", "stacks.html", "bible.html", "reminders.html", "privacy.html", "terms.html", "disclaimer.html", "es/", "es/seguridad.html"];
const urls = [
  ...rootPages.map((p) => SITE_URL + p),
  ...HERBS.map((h) => `${SITE_URL}herbs/${h.id}.html`),
  ...FRUITS.map((f) => `${SITE_URL}fruits/${f.id}.html`),
  ...FOODS.map((f) => `${SITE_URL}foods/${f.id}.html`),
  ...REMEDIES.map((r) => `${SITE_URL}remedies/${r.id}.html`),
  ...STACKS.map((s) => `${SITE_URL}stacks.html?s=${s.id}`)
];
fs.writeFileSync(path.join(root, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
fs.writeFileSync(path.join(root, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`);

console.log(`Built ${HERBS.length} herb pages, ${FRUITS.length} fruit pages, ${FOODS.length} food pages, ${REMEDIES.length} remedy pages, ${Object.keys(myPhotos).length} of your own photos and a sitemap with ${urls.length} URLs for ${SITE_URL}`);
