# The Recipe Therapist website

A small static site for Celene Calvagna (The Recipe Therapist): custom cakes, healthy meal plans and catering trays. It's plain HTML, CSS and JavaScript with no build step, so it can be hosted on Netlify, Cloudflare Pages, GitHub Pages, or any web host.

## Pages

| File | What it is |
| --- | --- |
| `index.html` | Home: services, how ordering works, about Celene |
| `menu.html` | The full menu, generated from `js/menu-data.js`, with category filters and search |
| `meal-plans.html` | How personalized meal plans work, plus FAQ |
| `order.html` | Order request form (catering, cake, meal plan) |

## How ordering works

There is no checkout. Customers tap **Add to request** on menu items, then send an order request with the date, guests, pickup or delivery, and dietary needs. Celene confirms the price and availability and sends a payment link herself (Square, Venmo, etc.).

By default, submitting the form opens the customer's email app with the full request filled in. To receive requests without relying on their email app, create a free form at a service like Formspree and paste its endpoint into `formEndpoint` in `js/config.js`.

## Editing

- **Business details** (email, phone, Instagram, YouTube, notice days): `js/config.js`
- **Menu items**: `js/menu-data.js`. One entry per dish, no new pages needed. Leave `price` empty to show "Ask for pricing".
- **Photos**: put images in `images/` and set `photo: "images/your-file.jpg"` on a menu item. Hero and portrait spots are marked in `index.html`.
- Text marked `TODO` in the HTML needs Celene's confirmation (her story, meal plan tiers, FAQ answers).

## Preview locally

```sh
python3 -m http.server --directory recipe-therapist 8000
```

Then open http://localhost:8000.
