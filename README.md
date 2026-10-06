# Beauty & Praise 🌿

A website about herbs, fruits and healthy reminders.

## Pages
| Page | File | What's on it |
|---|---|---|
| Home | `index.html` | Hero, categories, herb of the day, popular herbs, fruits, stacks, verse, tools, articles |
| Herb Library | `herbs.html` | All 107 herbs with search, filters, A–Z, saved herbs |
| Herb pages | `herbs/<id>.html` | One page per herb: benefits at a glance, body effects, chemistry, benefits explained, capsule & herb doses, uses, preparation, growing, safety, medicine interactions, buying tips |
| Fruit Library | `fruits.html` | All 100 fruits with search, benefit, season and A–Z filters |
| Fruit pages | `fruits/<id>.html` | One page per fruit: what it does, nutrients, benefits, how to use, serving size, choosing & storing, safety, interactions |
| Herbal Stacks | `stacks.html` | 14 herb combinations with shopping list, printable recipe card and medicine checks (`stacks.html?s=<id>`) |
| Guides | `guides.html` | Hub for the wellness and safety guides |
| Wellness guides | `guides/<id>.html` | 15 guides (sleep, stress, digestion, immunity, colds & flu, heart, blood sugar, skin, hair, joints, energy, memory, monthly cycle, menopause, men's health) with habits, herbs + doses, fruits, stacks, a verse, safety and when to see a doctor |
| Safety guides | `safety/<id>.html` | Pregnancy (by trimester), breastfeeding, children (by age), adults 65+, before surgery |
| Safety checker | `interactions.html` | Step by step: who it's for (incl. pregnancy trimester, breastfeeding, child, 65+), type medicine names (brand or generic), health conditions → what to avoid, what could happen and what to do; printable |
| Quiz | `quiz.html` | 10-question multiple-choice quiz on herbs, fruits, safety or plants of the Bible, with explanations and best scores |
| What should I take? quiz | `finder.html` | Six questions, one at a time → a personal plan of herbs with doses, a stack, fruits and habits, leaving out anything unsafe for your medicines or situation (`finder.html?goal=sleep` starts on a goal) |
| Herbs & fruits of the Bible | `bible.html` | 24 scripture passages (NASB 1995) naming herbs and fruits on the site, with reflections and links to each plant; every herb and fruit page also has a scripture card |
| My Plan | `myplan.html` | Saved herbs & fruits, the latest "What should I take?" plan (`finder.html?plan=saved` reopens it), today's checklist and water, this week's devotional, safety-checker answers, recipes. Everything is stored only in the visitor's browser |
| Recipes | `recipes.html` | 14 step-by-step recipes (teas, drinks, syrups, kitchen, skin & bath) with a type filter |
| Recipe pages | `recipes/<id>.html` | Ingredients checklist, numbered steps, tips, storage, safety, links to the herbs, fruits and guide; printable. Herb, fruit and guide pages show matching recipes |
| Weekly Devotional | `devotional.html` | A 12-week series (verse, reflection, prayer, habit, herb/fruit/recipe of the week) that changes every Monday, plus a weekly calendar reminder (.ics) for phones. This week's devotional also shows on Healthy Living and My Plan |
| Español | `es/index.html`, `es/seguridad.html` | Hand-written Spanish home page and safety guide (pregnancy, breastfeeding, children, medicines, Poison Control), plus a "Traducir todo el sitio" button that opens the rest of the site in Google Translate (machine translation) |
| Healthy Living | `reminders.html` | Reminders, daily checklist, water tracker, daily rhythm, seasons |
| Journal | `journal.html` | Articles (`journal.html?a=<id>`) |
| About | `about.html` | Story, values, FAQ, contact form |
| Legal | `privacy.html`, `terms.html`, `disclaimer.html` | Privacy policy, terms of use, medical disclaimer (templates — have them reviewed for your situation) |

## Building the herb and fruit pages
The 234 pages in `herbs/`, `fruits/`, `guides/`, `safety/` and `recipes/`, plus `js/my-photos.js`, `sitemap.xml` and `robots.txt`, are generated. After changing any herb, fruit, guide or recipe data, or adding photos, run:

```
node scripts/build.js
```

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
Herb and fruit photos load in the visitor's browser from Wikipedia / Wikimedia Commons (free-licensed images); each page credits the photographer and license. If a photo can't load, a drawn illustration is shown instead. **To use your own photos:** put them in `images/herbs/` or `images/fruits/`, named exactly like the page address — e.g. `images/herbs/chamomile.jpg` for `herbs/chamomile.html`, `images/fruits/apple.jpg` for `fruits/apple.html` (.jpg, .png or .webp; about 1200 px wide is plenty) — then run `node scripts/build.js`. Your photo replaces the Wikipedia one everywhere on the site. To choose a different credit line, add it to `PHOTO_OVERRIDES` in `js/photos.js` instead (fruits use keys like `"fruit:apple"`). If a Wikipedia photo is a poor match, change the article in `WIKI_TITLES` or `FRUIT_WIKI_TITLES` in the same file.

## Scripture
English verses use the NASB 1995 and Spanish verses use La Biblia de las Américas (LBLA), both from The Lockman Foundation; the copyright notices are in the footers. Verses were typed in by hand, so please check each one against a printed Bible before launch.

## Logo
- `images/logo-mark.svg` — the emblem (also the browser-tab icon)
- `images/logo.svg` — the full logo with the name
- `images/og-image.png` — the preview image shown when the site is shared

## Other files
- `css/styles.css` — all styling
- `js/art.js` — fallback illustrations for herbs and fruits
- `js/pages.js` — page behavior
- `js/photos.js` — loads and credits photos

Herb and fruit information is for general education only and is not medical advice.
