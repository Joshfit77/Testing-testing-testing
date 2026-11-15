# Home backgrounds — one picture for each day of the week

Added 2026-11-14 (application audit, Part 4).

## Status: the illustrations were rejected (owner, 2026-11-15)

The owner reviewed the seven illustrations below and rejected them: they read as generic minimalist wallpapers, not
premium Christian fitness imagery. They are placeholders only. The rotation, caching and offline code stays as it is;
only the seven picture files are to be replaced, and only after the owner has approved the new pictures.

No image generator is available in the environment where this work is done (no image tool, no image-API key, no GPU),
so the new pictures were **not** made there. Nothing procedural is to be substituted for them.

### Art direction for the replacements (owner's brief)

Premium athletic campaign photography combined with Christian faith, in the black-and-gold identity. Cinematic,
realistic, powerful, detailed. Photorealistic or very high-end cinematic illustration.

Must have: seven distinct compositions; realistic anatomy and exercise form; detailed environments; charcoal, black
and warm gold grading; strong contrast without crushing detail into black; room for the Home text; the same quality
on all seven days.

Must not have: cartoon silhouettes; floating equipment; cheap glowing symbols; a generic AI-wallpaper look; any text
in the picture; third-party athletic brand logos.

| Day | Theme | Scene |
|---|---|---|
| Monday | Strength | A muscular athlete preparing for a heavy deadlift in a premium dark gym, a large cross subtly lit behind him |
| Tuesday | Discipline | An athlete performing a heavy barbell squat, realistic equipment, dramatic shadows, subtle Christian symbolism |
| Wednesday | Faith | An open Bible beside a loaded barbell on a gym bench, golden sunlight on the pages |
| Thursday | The Narrow Gate | An athletic figure walking toward a beautiful ancient stone gateway, gym equipment subtly part of the setting |
| Friday | Perseverance | An exhausted athlete kneeling in prayer beside a barbell after hard training, golden light through a cross-shaped window |
| Saturday | Endurance | An athlete running uphill toward a distant cross at sunrise, outdoors |
| Sunday | Rest | A peaceful, detailed gym with an open Bible, training shoes and a cross lit by warm morning sunlight |

### Prompts for an image generator

Use the shared style line with each scene line. Generate each day separately at full resolution (never a collage).

**Shared style:** "Cinematic photograph, premium athletic campaign, shot on a full-frame camera with a 35mm lens,
shallow depth of field, low-key lighting with one warm golden key light and soft fill so shadow detail is kept, rich
charcoal and black tones with warm gold highlights, fine film grain, realistic skin, sweat and chalk, realistic steel
and rubber gym equipment with no brand names or logos, no text or lettering anywhere, landscape 3:2. Composition: the
subject sits in the right third of the frame; the left half is darker, uncluttered background for overlaid text."

1. **Monday:** "A muscular male athlete in plain black training clothes, chalked hands gripping a loaded barbell on the
   floor, hips set and back flat, about to deadlift, in a dark high-end gym with concrete walls. On the wall behind him
   a large plain wooden cross is softly lit from above. Low camera angle from the front quarter."
2. **Tuesday:** "An athlete at the bottom of a heavy barbell back squat inside a steel power rack, bar across the upper
   back, knees over toes, chest up, thighs below parallel, visible effort. Hard side light casts long shadows across a
   dark gym; the window frame behind throws a faint cross-shaped shadow on the far wall."
3. **Wednesday:** "A still life on a black leather gym bench: an open leather-bound Bible with thin gilt-edged pages,
   beside it a loaded barbell resting in the rack, steel plates in soft focus. A shaft of golden morning sunlight from
   a high window falls across the open pages, dust in the light."
4. **Thursday:** "Seen from behind, an athletic figure in training clothes with a gym bag over one shoulder walks along
   a narrow stone path toward an ancient weathered stone gateway with a narrow arched opening, warm sunrise light
   coming through the arch. Beside the path, an old iron kettlebell and a stack of steel plates rest against the stone
   wall as part of the place."
5. **Friday:** "An exhausted athlete, drenched in sweat, kneeling on one knee on a rubber gym floor beside a loaded
   barbell, head bowed, hands clasped in prayer, chalk on the hands. Behind, a tall window in the shape of a cross lets
   in golden late-afternoon light that rakes across the floor."
6. **Saturday:** "A powerful runner mid-stride climbing a steep mountain trail at sunrise, seen from behind and slightly
   below, breath visible in cold air. On the distant ridge ahead a wooden cross stands against a gold and charcoal
   sky, mist in the valleys."
7. **Sunday:** "A quiet, empty premium gym in early morning. In the foreground on a wooden bench: an open Bible and a
   pair of worn training shoes set neatly beside it. On the far wall a plain wooden cross is lit by warm sunlight
   coming through tall windows, racks and dumbbells in soft focus."

Check every result before use: hands and fingers, the number of plates and that the bar is straight, squat and
deadlift positions, no stray lettering or logos, and that the left half is dark enough for text. Then crop to
1600 × 1040 as described below and run the contrast test.

## What is in the app today

The Home screen's hero shows a different background each day, Monday to Sunday:

| Day | Theme (shown above the greeting) | Scene | File |
|---|---|---|---|
| Monday | Strength through Christ | A cross behind a loaded barbell and a kettlebell | `public/home-backgrounds/monday.webp` |
| Tuesday | Discipline | A squat rack with a racked bar; a cross of light inside the rack | `tuesday.webp` |
| Wednesday | Faith first | An open Bible on a gym bench under a shaft of light | `wednesday.webp` |
| Thursday | The narrow gate | An athlete walking toward a narrow lit gateway | `thursday.webp` |
| Friday | Perseverance | An athlete kneeling in prayer beside a loaded barbell | `friday.webp` |
| Saturday | Endurance | A runner on a mountain ridge; a cross on the summit | `saturday.webp` |
| Sunday | Rest and worship | A quiet gym: bench, closed Bible, arched window, golden light | `sunday.webp` |

**These seven pictures are original illustrations drawn by code. They are not photographs and were not made by
an image generator** — no image generator was available in the environment where this work was done. Each one is
a dark, backlit, black-and-gold scene. The people in them are the app's own 2D athlete (the exercise engine's
figure), drawn as a silhouette, so the character matches the exercise demonstrations.

They are seven separate files, 1600 × 1040 px, WebP, 36–42 kB each (about 270 kB for the whole week).

## What is still needed for a photographic look

The request was for premium, realistic pictures. Illustrations do not meet "realistic". To get there, supply seven
photographs or rendered images and drop them in; nothing else in the app has to change.

Brief for each replacement picture:

- **Size and format:** 1600 × 1040 px or larger at the same 20:13 shape; WebP or AVIF; under 150 kB each (a unit
  test enforces 150 kB).
- **Where the subject goes:** centred about 77 % across and 40 % down, and no wider than a fifth of the picture.
  A phone shows only the middle-right 60 % of the picture's width (the app crops with the focal point at 70 % across,
  40 % down, at a fixed height of 416 px), and the greeting fills the left two thirds of what it shows. Wide subjects
  (a barbell, a rack) run off the right edge on a phone; a narrow, bright subject must not.
- **Where it must stay dark:** the left 70 % and the bottom third. The greeting, date and verse sit there. The app
  lays a dark fade over that area too, but a bright picture underneath still lowers contrast. After swapping a
  picture, run `e2e/home-backgrounds.spec.ts`: it measures every line of text over every picture and fails under
  4.5:1.
- **Look:** near-black and charcoal, one warm gold light source, no other colours, no readable text, no logos or
  brand marks on equipment, no recognisable faces.
- **Subjects:** as in the table above, one per day.
- **Rights:** the owner must hold the licence for each picture; record the source next to the file.

To swap a picture:

1. Replace `public/home-backgrounds/<day>.webp` (keep the file name).
2. Raise `HOME_BACKGROUND_VERSION` in `src/lib/home-backgrounds.ts` by one, so phones fetch the new file.
3. Raise `VERSION` in `public/sw.js`, so the offline copy is replaced.
4. Run `npx vitest run --project unit tests/unit/home-backgrounds.test.ts` and look at Home on a phone-size screen
   for each day (see "How it was checked").

To redraw the illustrations instead: edit `scripts/home-backgrounds/scenes.js`, then run
`CHROMIUM=/path/to/chrome node scripts/home-backgrounds/render.mjs [--only=monday] [--preview=<folder>]`.
The film grain is random, so a re-render changes every file slightly.

## How the day is chosen

- The server renders Home with the member's date in the time zone saved on their profile. That date already drives
  the date line, the daily verse and today's workout. The first paint uses the picture for that date.
- In the browser, `DailyHero` (`src/components/home/daily-hero.tsx`) then checks the **phone's own local date**
  and uses the picture for it. If the two dates differ (travel, or a profile with a different time zone), the
  picture follows the phone immediately.
- It checks again when the app comes back to the foreground (`visibilitychange`, `focus`, `pageshow`), when the
  connection returns (`online`), and at the next local midnight (a timer set for that moment).
- When the phone's date moves past the date the page was rendered for, it asks the server for a fresh Home once
  (only while online), so the date line, verse and workout move to the new day too.
- All seven pictures are fetched once Home is idle (about 270 kB in total) and are served as immutable, so the next
  day's picture is already on the phone at midnight or after a resume.
- Offline in a browser: the service worker also stores all seven when it installs. Offline in the native app, which
  has no service worker: the picture comes from the web view's own cache (checked in Chromium only, see "Known
  limits"). If a picture cannot be loaded at all, the hero falls back to a plain dark panel with a soft gold glow;
  the text stays readable.

The daily verse logic (`scriptureForDate`) was not changed.

## How it was checked

`e2e/home-backgrounds.spec.ts`, run in Chromium at phone size against a production build on 2026-11-15, 5 of 5 passed:

1. Seven days, seven different pictures, the right theme line for each, no page errors, and the contrast of every
   line of hero text against the brightest part of the picture behind it. Lowest result per day: Monday 9.3,
   Tuesday 9.3, Wednesday 12.0, Thursday 10.5, Friday 7.9, Saturday 10.8, Sunday 7.5 (WCAG AA needs 4.5). The first
   version measured 1.4 on Sunday (the lit window sat behind the greeting); the subjects were moved right, the fade
   behind the text was strengthened and the verse was given a narrower column on phones.
2. The picture changes at local midnight (clock moved from 23:59:50 on Friday) and when the app becomes visible again
   three days later.
3. With the connection off, the next day's picture still shows (service worker).
4. The same with service workers blocked, as in the native app (browser cache).
5. With every picture request failing, the hero shows its dark panel and the text passes the same contrast check.

The picture does not fade in on first load (it fades only when the day changes under an open page): fading held the
page's largest paint at about 700 ms on a local server; without it the median was 312 ms.

`tests/unit/home-backgrounds.test.ts` checks the seven files exist, differ, are WebP under 150 kB, and that dates map
to the right weekday (including a leap day).

## Known limits

- These are illustrations, not photographs (see the top of this page).
- On a phone, wide subjects are cropped at the right edge (Monday's barbell, Tuesday's rack).
- The contrast check ran with a short first name and "Good morning". A longer greeting ("Good afternoon,") or a long
  name wraps or reaches further right; it was not measured.
- The picture follows the phone's clock; the date line and verse follow the profile time zone until the page
  refreshes. Offline, with a profile time zone different from the phone's, the picture and the date line can show
  different days until the connection returns.
- A change of the phone's time zone is handled by the same check as a change of date, but could not be simulated
  in the browser test (a browser's time zone cannot be changed mid-session).
- Not checked on a physical iPhone or in WKWebView: picture sharpness on a real screen, whether the web view keeps
  the cached pictures for offline use, and behaviour when iOS suspends and resumes the app across midnight.
