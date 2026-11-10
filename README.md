# 3D athlete prototype (experiment)

A standalone, interactive 3D exercise demonstration viewer made to answer one question: could premium 3D eventually
beat the 2D demonstrations in Narrow Gate Fitness? **It is not part of the app.** This branch has its own history and
contains no application code; nothing here is imported by, built with, or deployed with the app.

## What it is

- `public/` — the viewer: a static page (`index.html`, `main.js`), Three.js r160 vendored in `public/vendor/`, and
  `athlete.json` (the body). Serve the folder with any static server: `npm run serve`, then open http://localhost:4173.
- `build.mjs` — builds `athlete.json` from the source data in `src-assets/` (`npm run build`).
- `shots.mjs` — takes screenshots through headless Chromium (needs Playwright).
- `screenshots/` — the review captures.

Controls: drag to rotate (360°), pinch or scroll to zoom, exercise switch, play / pause, ¼× ½× 1× speed, front / side /
rear views, a turntable, and a Muscles toggle (primary muscles a strong gold tint, secondary a light one; off shows the
plain anatomy).

## Where the athlete comes from

- **Body, skeleton, skin weights**: the MakeHuman base mesh, the "muscular young male" body shape at 75%, and the
  53-bone "game engine" rig with its weights, taken from the MPFB2 project
  (https://github.com/makehumancommunity/mpfb2, `src/mpfb/data`). These assets are released under **CC0 1.0** (see
  `src-assets/LICENSE.md`, section C). 13,380 vertices, 26,756 triangles, 1.75 m tall.
- **Three.js**: MIT licence.
- **Everything else is constructed in `main.js`**: the skin material (a single tone, no texture), shorts, shoes and hair
  (shells grown from the body mesh), eyes (spheres with a drawn iris), the barbell, bench and dumbbells, the muscle
  regions, and all three movements (computed poses with two-bone inverse kinematics; no motion capture).

## Honest limitations

- No skin texture, pores, veins, body hair, eyebrows or eyelashes: MakeHuman's skin, hair and clothing asset packs could
  not be downloaded in the build environment, so the skin is one flat tone and the hair is a rough cap with a jagged edge.
- Shorts and shoes are skin-tight shells, not tailored garments; the shoes still show the toes.
- Muscle definition comes only from the mesh shape (no normal map), so it is softer than a sculpted athlete.
- Linear skinning with no corrective shapes: shoulders, elbows, hips and knees pinch or flatten at deep angles.
- Movements are computed, not captured: timing is eased and the bar path is constrained, but there is no weight shift,
  breathing, or small stabilising motion. Fingers close around the bar by a fixed curl, not a fitted grip.
- Muscle regions are chosen by rules on the mesh (which bone moves a vertex, where it is, which way it faces). They are
  plausible but have not been checked by an anatomist. Biomechanics have not been reviewed by a coach.
- Rendered in real time with standard lights and shadows; no subsurface scattering, ambient occlusion or studio HDRI.
- Performance was only observed in headless software rendering; it has not been measured on a phone.
