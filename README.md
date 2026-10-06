# Beauty & Praise 🌿

A website about herbs and healthy reminders.

## Pages
| Page | File | What's on it |
|---|---|---|
| Home | `index.html` | Hero, browse-by-need categories, herb of the day, popular herbs, verse of the day, latest articles |
| Herb Library | `herbs.html` | All 100 herbs with search, category / part filters, A–Z jump, saved-herbs filter |
| Herb profile | `herb.html?id=…` | Detailed profile for each herb: overview, traditional uses, preparation, growing, safety, related herbs |
| Healthy Living | `reminders.html` | Reminder of the moment, daily checklist, water tracker, daily rhythm, seasonal wellness |
| Journal | `journal.html` | Six articles (each opens at `journal.html?a=…`) |
| About | `about.html` | Story, values, FAQ, contact form |

## Run it
No build step — open `index.html` in a browser, or publish with GitHub Pages.

## Edit content
- `js/herbs-data.js` — the 100 herbs and the categories
- `js/content.js` — reminders, default checklist, verses, daily rhythm, seasons and journal articles
- `js/layout.js` — site name, navigation, header and footer. Set `SITE.email` to your email address so the contact form works, and replace the `#` social links in the footer with your own profiles.

## Other files
- `css/styles.css` — all styling
- `js/art.js` — draws the botanical illustration for each herb
- `js/pages.js` — page behavior

Herb information is for general education only and is not medical advice.
