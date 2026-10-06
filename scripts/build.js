#!/usr/bin/env node
// Builds one real page per herb (herbs/<id>.html) and per fruit (fruits/<id>.html), plus
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
  ["js/herbs-data.js", "js/herbs-summary.js", "js/herbs-benefits.js", "js/herbs-pharm.js", "js/herbs-caps.js", "js/fruits-data.js", "js/stacks.js", "js/content.js"]
    .map(read).join("\n") +
    "\nthis.D = { HERBS, SUMMARY, BENEFITS, PHARM, CAPS, FRUITS, CATEGORIES, EVIDENCE, STACKS, ARTICLES };",
  ctx
);
const { HERBS, SUMMARY, BENEFITS, PHARM, CAPS, FRUITS, CATEGORIES, EVIDENCE, STACKS, ARTICLES } = ctx.D;

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

// ---------- Fruits ----------
const fruitTemplate = read("fruit.html");
fs.mkdirSync(path.join(root, "fruits"), { recursive: true });
for (const fr of FRUITS) {
  const url = `${SITE_URL}fruits/${fr.id}.html`;
  const title = `${fr.name}: Benefits, Nutrition & How to Eat It — Beauty & Praise`;
  const description = firstSentences(fr.summary);
  const main = `    <article class="container narrow prose static-content">
      <p><a href="index.html">Home</a> / <a href="fruits.html">Fruit Library</a> / ${esc(fr.name)}</p>
      <h1>${esc(fr.name)}</h1>
      <p><em>${esc(fr.latin)}</em> · ${esc(fr.family)} · In season: ${esc(fr.season)}</p>
      <h2>What it does for you</h2>
      <p>${esc(fr.summary)}</p>
      <h2>Key nutrients</h2>
      <ul>${fr.nutrients.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
      <h2>Benefits explained</h2>
      ${fr.benefits.map(([e, t, d]) => `<h3>${esc(t)} (${EVIDENCE[e].label})</h3><p>${esc(d)}</p>`).join("\n      ")}
      <h2>How to use it</h2>
      <ul>${fr.uses.map((u) => `<li>${esc(u)}</li>`).join("")}</ul>
      <h2>How much to eat</h2>
      <p>One serving: ${esc(fr.serving[0])} (about ${fr.serving[1]} g).</p>
      <h2>Choosing &amp; storing</h2>
      <p>${esc(fr.pick)}</p>
      <h2>Safety &amp; cautions</h2>
      <p>${esc(fr.caution)}</p>
    </article>`;
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", headline: fr.name, description, url, image: ogImage, publisher: { "@type": "Organization", name: "Beauty & Praise" }, about: { "@type": "Thing", name: fr.name, alternateName: fr.latin } },
      breadcrumb("Fruit Library", "fruits.html", fr.name, url)
    ]
  };
  fs.writeFileSync(path.join(root, "fruits", `${fr.id}.html`), page(fruitTemplate, { title, description, url, image: ogImage, id: fr.id, main, jsonld }));
}

// ---------- Sitemap & robots ----------
const today = new Date().toISOString().slice(0, 10);
const rootPages = ["", "herbs.html", "fruits.html", "stacks.html", "interactions.html", "quiz.html", "bible.html", "reminders.html", "journal.html", "about.html", "privacy.html", "terms.html", "disclaimer.html"];
const urls = [
  ...rootPages.map((p) => SITE_URL + p),
  ...HERBS.map((h) => `${SITE_URL}herbs/${h.id}.html`),
  ...FRUITS.map((f) => `${SITE_URL}fruits/${f.id}.html`),
  ...STACKS.map((s) => `${SITE_URL}stacks.html?s=${s.id}`),
  ...ARTICLES.map((a) => `${SITE_URL}journal.html?a=${a.id}`)
];
fs.writeFileSync(path.join(root, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
fs.writeFileSync(path.join(root, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`);

console.log(`Built ${HERBS.length} herb pages, ${FRUITS.length} fruit pages and a sitemap with ${urls.length} URLs for ${SITE_URL}`);
