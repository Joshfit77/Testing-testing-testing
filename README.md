# Beauty & Praise 🌿

A food-first wellness website: real food, natural remedies, healthy habits and herbs as a supporting category — with practical amounts, safety notes and a faith-friendly heart.

## Pages
The site is kept simple: five tabs — **Home · Foods · Remedies · Herbs · Our Story**.

| Page | File | What's on it |
|---|---|---|
| Home | `index.html` | The cross emblem, a verse, search, Amanda's testimony, three paths (Foods, Remedies, Herbs) and the "What should I eat?" invitation |
| Foods | `foods.html` | Everyday foods and fruits with 10 categories (`foods.html?cat=protein`) and search |
| Food & fruit pages | `foods/<id>.html`, `fruits/<id>.html` | What it is, nutrients, benefits, serving, timing, who may benefit, downsides, allergies, pregnancy, sources |
| Natural Remedies | `remedies.html`, `remedies/<id>.html` | Home and food-based remedies with amounts, evidence and when to see a doctor |
| Herbs | `herbs.html`, `herbs/<id>.html` | A curated set of herbs with doses and safety; `stacks.html` for herbal stacks |
| Our Story | `about.html` | Amanda's story, values, FAQ and contact |
| Tools (linked from pages and the footer) | `finder.html`, `interactions.html`, `reminders.html`, `bible.html` | "What should I eat?" planner, safety checker, 100 body reminders, herbs & fruits of the Bible |
| Legal & Spanish | `privacy.html`, `terms.html`, `disclaimer.html`, `es/` | |

**Which herbs and fruits appear** is set in `js/prune.js` (`KEEP_HERBS`, `KEEP_FRUITS`). Add an id there and rebuild to bring one back — all original data is still in `herbs-data.js` and `fruits-data.js`. Removed pages (quiz, journal, devotional, My Plan, recipes, guide pages) are still in the git history if you ever want them back.

## Building the pages
The pages in `herbs/`, `fruits/`, `foods/` and `remedies/`, plus `js/my-photos.js`, `sitemap.xml` and `robots.txt`, are generated. After changing any herb, fruit, guide or recipe data, or adding photos, run:

```
node scripts/build.js
```

The build also stamps every CSS/JS/icon link with a version (`?v=…`) so visitors see updates right away instead of an old cached copy — always run it before pushing.

Open `scripts/build.js` and set `SITE_URL` to your live address first (for example `https://www.yourdomain.com/`). It's currently set to the GitHub Pages address.

After the site is live, submit `sitemap.xml` in [Google Search Console](https://search.google.com/search-console) so Google finds every page.

## Making the forms work
The contact form and newsletter sign-up work once you connect a free form service:
1. Create a free account at [formspree.io](https://formspree.io) and create a form for each (or use your newsletter provider's form address).
2. In `js/layout.js`, paste the addresses into `SITE.contactEndpoint` and `SITE.newsletterEndpoint`.

Until then, the forms show a friendly "coming soon" message.

## Affiliate / shop links
Add links to `SITE.shop` in `js/layout.js`, keyed by herb id, e.g. `{ ashwagandha: "https://..." }`. A "Shop recommended" button then appears in the buying tips on that herb's page.

If you sell products or use affiliate links, keep claims educational: in the U.S., herbs and supplements can't be marketed as diagnosing, treating, curing or preventing a disease, and supplement marketing should carry the FDA disclaimer statement. The privacy policy already mentions affiliate links.

## Edit content
- `js/herbs-data.js` — the 107 herbs and the categories
- `js/herbs-summary.js` — the 5-sentence "Benefits at a glance" for every herb
- `js/herbs-benefits.js` — the "Benefits explained" section for every herb
- `js/herbs-pharm.js` — body effects, active compounds and detailed doses
- `js/herbs-caps.js` — the capsule (mg) and herb-by-itself doses
- `js/fruits-data.js` — the 100 fruits
- `js/foods-data.js` — everyday foods, the Food as the Foundation categories, reference links, and the shared food/fruit page structure (`foodProfile`)
- `js/remedies.js` — natural remedies and their categories
- `js/stacks.js` — the herbal stacks
- `js/interactions.js` — the safety checker's medicine groups, health situations, flagged herbs/fruits, and "what could happen / what to do" text
- `js/drugs.js` — medicine names (generic and brand) the safety checker recognizes
- `js/guides.js` — the wellness and safety guides, and the verses used on herb and fruit pages
- `js/quiz-questions.js` — quiz questions (the first option is the right answer; options are shuffled on screen)
- `js/bible.js` — the Bible page and its reflections
- `js/devotional.js` — the 12-week devotional
- `js/recipes.js` — the recipes
- `es/` — the Spanish pages (edit the HTML directly)
- `js/content.js` — reminders, checklist, verses, daily rhythm, seasons and journal articles
- `js/layout.js` — site name, menu, header, footer, form and shop settings. Replace the `#` social links in the footer with your own profiles.

## Photos
**Lifestyle photographs** (the homepage, the top of each page and beside each verse) are real photographs from [Unsplash](https://unsplash.com), free to use under the Unsplash License. They are listed by name in `SCENES` at the end of `js/layout.js`, and the footer of each page names the photographers shown on it. To use your own photo instead — always the best choice — save it in `images/scenes/` with the same name (for example `images/scenes/hero-figs.jpg`) and run `node scripts/build.js`. If a photo ever fails to load, a plain linen frame shows in its place.

Herb and fruit photos load in the visitor's browser from Wikipedia / Wikimedia Commons (free-licensed images); each page credits the photographer and license. If a photo can't load, a drawn illustration is shown instead. **To use your own photos:** put them in `images/herbs/`, `images/fruits/` or `images/foods/`, named exactly like the page address — e.g. `images/herbs/chamomile.jpg` for `herbs/chamomile.html`, `images/fruits/apple.jpg` for `fruits/apple.html` (.jpg, .png or .webp; about 1200 px wide is plenty) — then run `node scripts/build.js`. Your photo replaces the Wikipedia one everywhere on the site. To choose a different credit line, add it to `PHOTO_OVERRIDES` in `js/photos.js` instead (fruits use keys like `"fruit:apple"`). If a Wikipedia photo is a poor match, change the article in `WIKI_TITLES` or `FRUIT_WIKI_TITLES` in the same file.

## Wording
Keep wellness language conservative: foods, remedies and herbs "may support", "may help" or "have been studied for" — never "cures" or "treats". Food and remedy pages link to their sources (USDA FoodData Central, NIH fact sheets, FDA, CDC); please spot-check those links after launch.

## Scripture
English verses use the NASB 1995 and Spanish verses use La Biblia de las Américas (LBLA), both from The Lockman Foundation; the copyright notices are in the footers. Verses were typed in by hand, so please check each one against a printed Bible before launch. Each inner page shows one verse chosen for its topic — edit them in `PAGE_SCRIPTURE` in `js/layout.js`.

## Logo
- `images/logo-mark.svg` — the emblem: a wooden cross in morning light framed by a wreath of leaves and blossoms (also the browser-tab icon)
- `images/logo.svg` — the full logo with the name
- `images/og-image.png` — the preview image shown when the site is shared

## Other files
- `css/styles.css` — the original styling
- `css/site.css` — the global design system (colors, type, buttons, hero, Scripture, story, paths, editorial grid, forms, notices, footer, reveals)
- `css/editorial.css` — the migration layer: maps the site's existing components onto `site.css` and protects working parts from its global element rules
- `js/site.js` — scroll reveals and smooth in-page links
- `images/olive-branch.svg` — the one small botanical drawing, used as an accent beside verse references and in the footer
- `images/amanda.jpg` — Amanda's photo, shown unaltered on the homepage and Our Story page
- `js/art.js` — fallback illustrations for herbs and fruits
- `js/pages.js` — page behavior
- `js/photos.js` — loads and credits photos

Herb and fruit information is for general education only and is not medical advice.
