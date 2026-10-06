# Beauty & Praise 🌿

A website about herbs and healthy reminders.

## Pages
| Page | File | What's on it |
|---|---|---|
| Home | `index.html` | Hero, browse-by-need categories, herb of the day, popular herbs, verse of the day, latest articles |
| Herb Library | `herbs.html` | All 100 herbs with search, category / part filters, A–Z jump, saved-herbs filter |
| Herb profile | `herb.html?id=…` | Detailed profile for each herb: real photo, overview, benefits explained (with evidence level), traditional uses, preparation, growing, safety, stacks it appears in, related herbs |
| Herbal Stacks | `stacks.html` | 13 herb combinations (Gentle Cleanse, Restful Sleep, Immune Syrup…) with amounts, recipe, dose, duration and who should avoid them; each opens at `stacks.html?s=…` |
| Healthy Living | `reminders.html` | Reminder of the moment, daily checklist, water tracker, daily rhythm, seasonal wellness |
| Journal | `journal.html` | Six articles (each opens at `journal.html?a=…`) |
| About | `about.html` | Story, values, FAQ, contact form |

## Run it
No build step — open `index.html` in a browser, or publish with GitHub Pages.

## Edit content
- `js/herbs-data.js` — the 100 herbs and the categories
- `js/herbs-benefits.js` — the "Benefits explained" section for every herb
- `js/herbs-caps.js` — the two headline doses on each herb page: capsule form (mg) and the herb by itself (g), per person 100 lb and over
- `js/herbs-pharm.js` — what each herb does in the body, its active compounds and how they work, and typical adult doses (shown in mg, g and oz)
- `js/stacks.js` — the herbal stacks
- `js/content.js` — reminders, default checklist, verses, daily rhythm, seasons and journal articles
- `js/layout.js` — site name, navigation, header and footer. Set `SITE.email` to your email address so the contact form works, and replace the `#` social links in the footer with your own profiles.

## Photos
Herb photos load in the visitor's browser from Wikipedia / Wikimedia Commons (free-licensed images); each herb page credits the photographer and license. If a photo can't load, a drawn illustration is shown instead. To use your own photo for an herb, put it in an `images/` folder and add it to `PHOTO_OVERRIDES` in `js/photos.js`. If a Wikipedia photo is a poor match, change that herb's article in `WIKI_TITLES` in the same file.

## Other files
- `css/styles.css` — all styling
- `js/photos.js` — loads and credits the herb photos
- `js/art.js` — draws the fallback botanical illustration for each herb
- `js/pages.js` — page behavior

Herb information is for general education only and is not medical advice.
