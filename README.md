# Beauty & Praise 🌿

A website about herbs, fruits and healthy reminders.

## Pages
| Page | File | What's on it |
|---|---|---|
| Home | `index.html` | Hero, categories, herb of the day, popular herbs, fruits, stacks, verse, tools, articles |
| Herb Library | `herbs.html` | All 100 herbs with search, filters, A–Z, saved herbs |
| Herb pages | `herbs/<id>.html` | One page per herb: benefits at a glance, body effects, chemistry, benefits explained, capsule & herb doses, uses, preparation, growing, safety, medicine interactions, buying tips |
| Fruit Library | `fruits.html` | All 100 fruits with search, benefit, season and A–Z filters |
| Fruit pages | `fruits/<id>.html` | One page per fruit: what it does, nutrients, benefits, how to use, serving size, choosing & storing, safety, interactions |
| Herbal Stacks | `stacks.html` | 14 herb combinations with shopping list, printable recipe card and medicine checks (`stacks.html?s=<id>`) |
| Interaction checker | `interactions.html` | Tick medicines and health situations to see herbs, fruits and stacks to avoid or use with caution |
| Find my herb quiz | `quiz.html` | Three questions → personal herb, stack and fruit suggestions that skip unsafe matches |
| Herbs & fruits of the Bible | `bible.html` | Scripture (KJV) with links to each plant |
| Healthy Living | `reminders.html` | Reminders, daily checklist, water tracker, daily rhythm, seasons |
| Journal | `journal.html` | Articles (`journal.html?a=<id>`) |
| About | `about.html` | Story, values, FAQ, contact form |
| Legal | `privacy.html`, `terms.html`, `disclaimer.html` | Privacy policy, terms of use, medical disclaimer (templates — have them reviewed for your situation) |

## Building the herb and fruit pages
The 200 pages in `herbs/` and `fruits/`, plus `sitemap.xml` and `robots.txt`, are generated. After changing any herb or fruit data, run:

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
- `js/herbs-data.js` — the 100 herbs and the categories
- `js/herbs-summary.js` — the 5-sentence "Benefits at a glance" for every herb
- `js/herbs-benefits.js` — the "Benefits explained" section for every herb
- `js/herbs-pharm.js` — body effects, active compounds and detailed doses
- `js/herbs-caps.js` — the capsule (mg) and herb-by-itself doses
- `js/fruits-data.js` — the 100 fruits
- `js/stacks.js` — the herbal stacks
- `js/interactions.js` — the interaction checker's medicines, health situations and flagged herbs/fruits
- `js/bible.js` — the Bible page
- `js/content.js` — reminders, checklist, verses, daily rhythm, seasons and journal articles
- `js/layout.js` — site name, menu, header, footer, form and shop settings. Replace the `#` social links in the footer with your own profiles.

## Photos
Herb and fruit photos load in the visitor's browser from Wikipedia / Wikimedia Commons (free-licensed images); each page credits the photographer and license. If a photo can't load, a drawn illustration is shown instead. To use your own photo, add it to `images/` and to `PHOTO_OVERRIDES` in `js/photos.js` (fruits use keys like `"fruit:apple"`). If a Wikipedia photo is a poor match, change the article in `WIKI_TITLES` or `FRUIT_WIKI_TITLES` in the same file.

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
