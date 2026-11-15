# Home backgrounds — one photograph for each day of the week

Updated 2026-11-15 after the owner's second brief.

## Status

**There are no pictures in the app.** The first set, drawn by code, was rejected by the owner as artificial and
fantasy-like and has been removed, together with the script that drew it. Home shows a plain dark panel with the day's
theme, greeting, date and verse until seven real photographs are supplied and approved.

No photograph was produced in the environment where this work is done: it has no image generator, and stock-photo
sites are not reachable from it. Nothing drawn or generated-looking is to be put in their place.

Everything else is built and tested and waits for the files: the day-of-week rotation on the phone's local date
(midnight, app resume, offline), the fetch-ahead of the other six pictures, long-lived caching, the service worker's
offline copies, the dark overlays behind the text, and the fallback when a picture cannot load.

## The seven photographs (owner's brief)

Real photography: not illustration, not 3D, not video-game or fantasy imagery. Realistic anatomy, skin, clothing and
places. Natural sunlight and shadow, real textures. Professional sports photography with subtle Christian symbolism.
Sophisticated, masculine, premium; black and gold in the grading, no exaggerated golden glow, no artificial light
beams, no plastic skin.

| Day | File | Theme line on Home | Photograph |
|---|---|---|---|
| Sunday | `sunday.webp` | The cross | A real wooden cross on a hillside at sunrise |
| Monday | `monday.webp` | Strength | A muscular athlete training in a dark, realistic gym |
| Tuesday | `tuesday.webp` | Faith first | An open Bible beside gym equipment, natural window light |
| Wednesday | `wednesday.webp` | Prayer | An athlete praying alone in a quiet gym |
| Thursday | `thursday.webp` | Endurance | A runner climbing a rugged mountain trail at sunrise |
| Friday | `friday.webp` | Perseverance | An athlete boxing or strength training, dramatic but natural light |
| Saturday | `saturday.webp` | Rest and worship | A peaceful church interior, sunlight through the windows |

The theme lines are short labels chosen during development, not the owner's wording; change them in
`src/lib/home-backgrounds.ts`.

## What each file must be

- **Shape and size:** landscape 3:2 or wider, at least 1600 px wide; delivered as WebP (or JPEG, which will be
  converted), under 150 kB after conversion.
- **Where the subject goes:** in the right third, in the upper two thirds. A phone shows only the middle-right 60 %
  of the width (the app crops with the focal point 70 % across and 40 % down, at a fixed height of 416 px), and the
  greeting fills the left two thirds of what it shows.
- **Where it must be dark and calm:** the left 70 % and the bottom third, behind the greeting, date and verse. The app
  adds a subtle dark overlay there; a bright or busy picture underneath still hurts readability.
- **No text, no logos, no brand marks** on clothing or equipment. No recognisable faces unless the person has signed a
  release.
- **Rights:** a licence that allows use in a commercial app, recorded next to the file (source, licence, date).

## Ways to supply them

1. Commission or license photographs (the only way to be certain they are real photography).
2. Generate them in a tool the owner has, using the scene lines above with: "cinematic photograph, full-frame camera,
   35 mm lens, natural light, realistic skin and fabric texture, film grain, charcoal and black tones with warm
   highlights, no text, no logos, subject in the right third, left half dark and uncluttered". Generated pictures must
   be checked for hands, anatomy, lettering and a generated look, and rejected if they show any.
3. Upload the seven files in the conversation, or put them in a Google Drive folder; they are then cropped, converted,
   checked and shown back for approval before anything is switched on.

## Switching them on

1. Put the seven files in `public/home-backgrounds/`.
2. Set `HOME_BACKGROUND_PHOTOS_READY` to `true` in `src/lib/home-backgrounds.ts` (and raise `HOME_BACKGROUND_VERSION`
   whenever a file is later replaced; raise `VERSION` in `public/sw.js` too).
3. Run `npx vitest run --project unit tests/unit/home-backgrounds.test.ts` (seven different WebP files, each under
   150 kB) and `e2e/home-backgrounds.spec.ts`, which measures every line of Home's text against the brightest part of
   each picture behind it and fails under 4.5:1.
4. Look at Home for each day at phone size before approving.

## How the day is chosen

- The server renders Home for the member's date in their saved time zone (this also drives the date line, the verse
  and today's workout).
- In the browser the hero then follows the phone's own local date: on load, whenever the app becomes visible again,
  when the connection returns, and at local midnight. When the phone's date has moved on, the page refreshes once so
  the date line, verse and workout follow.
- The daily verse logic is unchanged.

## Not checked on a physical iPhone

Sharpness on a real screen, whether the web view keeps cached pictures for offline use, and the change at midnight
after iOS has suspended the app.
