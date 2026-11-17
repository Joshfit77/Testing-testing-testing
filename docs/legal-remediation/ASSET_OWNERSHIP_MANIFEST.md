# Asset ownership manifest: Narrow Gate Fitness

**Date:** 2026-11-16 · **Branch:** `claude/legal-remediation` · **For:** the founder and a US copyright/IP attorney

**Limits.** A record of what the repository shows about each asset, prepared by a non-lawyer. It does not say who owns anything or whether anything is protected or cleared.
An AI-authored commit neither proves nor disproves ownership; who owns the work depends on the founder's records and the AI tools' terms, which are not in the repository.

Detail and evidence: `docs/legal-audit-2026-11-16/04_ASSET_RIGHTS_LEDGER.md` (IDs A1–A12, C3–C7, D1–D2, F1 below are its IDs) and `11_COMPANY_IP_OWNERSHIP_CHECKLIST.md`. Paths and counts below were re-checked on this branch with `find` and `git ls-files` (217 tracked media files: 126 WebP, 72 PNG, 3 JPEG, 4 MP4, 2 WebM, 5 SVG, 5 WOFF2). Nothing was removed, moved or changed.

## 1. Classification used

Exactly one per row:

| # | Classification | Meaning here |
|---|---|---|
| 1 | Ownership supported by evidence | The repository holds the source and the program that made the asset, and no third-party input was detected. Still subject to the founder's record of direction and the AI-tool terms (section 4, row X1). |
| 2 | Commercial licence verified | A licence permitting commercial use was read in or beside the files. |
| 3 | Ownership documentation missing | How the asset was made, by whom or under what terms is not recorded. |
| 4 | Third-party permission needed | A licence, release or permission from someone else will be needed. |
| 5 | Replacement recommended | The asset should be replaced rather than documented. |

## 2. Manifest

| ID | Asset | Paths and count (verified) | How it was made (repository evidence) | Class | Exclude from public distribution until documented? |
|---|---|---|---|---|---|
| A5-ship | App icon / logo (gold arch with inner door) | `public/icons/` 6; `resources/` 5; iOS `AppIcon.appiconset` 1 PNG; Android `mipmap-*` 24 PNG | Two hand-written SVG masters (`public/icons/icon.svg`, `maskable.svg`) with no editor metadata; PNGs rendered by `scripts/render-icons.mjs` and `capacitor-assets generate`. Who designed the mark is not recorded | 1 | **N.** Generator and source are in the repo. Record who designed it and when (trademark package asks the same) |
| A8 | Native splash screens | iOS `Splash.imageset` 6; Android `drawable*/splash.png` 26 | Written by `scripts/native/blank-splash.mjs`; each is one flat colour `#090909` | 1 | **N.** No artwork content |
| A7 | Opening gate art | `public/opening/` 4 WebP; `src/components/common/gate-geometry.json` | Rendered by `scripts/opening/render_gate.py` (in-repo ray tracer; no external textures referenced) | 1 | **N.** Script is in the repo and re-runnable |
| A6 | Illustrations | `public/illustrations/` 3 SVG | Hand-written SVG; each carries a comment "Original artwork for Narrow Gate Fitness" (a claim in the file, not verification) | 1 | **N** |
| C3 | 2D exercise character and animations | `src/lib/exercise-motion/` 28 files; `src/data/exercise-motions.ts` | Drawn on a canvas by code each frame; no image or video files. Docs say 157 motions (`docs/EXERCISE_DEMOS_2D.md:29`); checklist 11 says 218 — not reconciled. Its look follows the AI-generated reference image (A9) | 1 | **N.** Note the dependency on A9 for counsel |
| C4 | Code-drawn vector badges (fallback) | `src/components/badges/badge-art.tsx` | Code in repo | 1 | **N.** This is the existing replacement for A1 |
| A1 | Badge artwork | `public/badges/` 27 WebP | Cropped by `scripts/badge-art/crop-posters.py` from the three screenshots in A2; one edited by `edit_conqueror.py`. No creator, tool, licence or metadata. `docs/BADGES.md:163-165` says rights need confirming | 3 | **Y.** Seen by every member; no record at all; the code-drawn badges (C4) can stand in. Counsel to confirm whether private TestFlight is affected |
| A2 | Badge source "posters" | `scripts/badge-art/posters/` 3 WebP | Phone screenshots showing Apple Photos interface chrome and a first name; origin unrecorded. Not served (`.vercelignore` lists `scripts/badge-art`) | 3 | **Y** for any outside hand-off or publication (they are in the artist hand-off pack per file 04); not served today |
| A3 | Offline single-file edition | `standalone/index.html` 1 (embeds the 27 badges as base64, per file 04) | "Generated outside this repo"; generator not present | 3 | **Y.** Carries A1; described as test-only |
| A4 | Dumbbell-curl clip, derived files | `public/exercise-demos/dumbbell-curl/` **57**: `loop.mp4`, `loop.webm`, `loop-half.mp4`, `loop-half.webm`, `poster.webp`, `thumb.webp`, `phase-1.webp`, `phase-2.webp`, `scrub/001.webp`–`scrub/049.webp` | Made by `scripts/exercise-demos/correct.py` and `build.mjs` from A5 (frames 43–92, colour-graded toward A9). Status `review`; the app shows only `approved` assets (`src/lib/exercise-demos.ts:119-122`) | 3 | **Y.** Hidden in the app but reachable by URL (section 3). No product loss: the 2D athlete covers every exercise |
| A5 | Supplied clip labelled `original-owner` | `assets/exercise-demos-src/dumbbell-curl/original-owner.mp4`, `original-owner-poster.jpg` (2); working copies `loop.mp4`, `poster.png`, `meta.json` | `original-owner` is the file name `scripts/exercise-demos/ingest.mjs` gives any supplied clip. Repository shows the owner supplied it, not who made it. Frames suggest an animated figure recorded from a screen; the pipeline calls inputs "generated" (file 04 §3) | 3 | **N** (not served; outside `public/`). Keep the repository private. If it was recorded from another app, class 4 would apply |
| — | Any other exercise videos | None in git (the 4 MP4 and 2 WebM are all A4/A5). Supabase `exercise-media` bucket is public by design (`docs/DATA.md:23`) and was never listed. Administrators can link YouTube/Vimeo videos (`src/lib/media.ts`) | Unknown | 3 | **Y** for anything found in the bucket or linked, until each item has a record |
| A9 | AI-generated character reference | `assets/exercise-demos-src/_character/character-reference.png` 1 | Signed C2PA manifest: OpenAI, ChatGPT `gpt-image`, created 2026-10-29. Account holder, plan and terms not recorded | 3 | **N** (not shipped). It is the stated reference for C3 and A4 and is attached to every planned video prompt |
| A12 | Home backgrounds | `public/home-backgrounds/` README only (1 file); `HOME_BACKGROUND_PHOTOS_READY = false` (`src/lib/home-backgrounds.ts:28`). Seven rejected code-drawn files remain on `origin/claude/pro-premium` (file 04) | None shipped; the brief asks for photographs of athletes | 4 | **N** (nothing to exclude). Before any photo is added: licence, model release for identifiable people, property release where needed |
| F1 | Fonts: Inter, Plus Jakarta Sans, Cinzel, Lora | `src/app/fonts/` 5 WOFF2 + `OFL.txt` | From Fontsource 5.3.0; copyright and SIL OFL 1.1 strings read inside each file (file 04). Now credited on `/legal/notices` and in `public/third-party-notices.txt` | 2 | **N** |
| I1 | Interface icons | `lucide-react` 1.58.0 (npm) | ISC licence, listed in `public/third-party-notices.txt` | 2 | **N** |
| D2 | App screenshots in docs | `docs/screenshots/` 39; `docs/launch-preview/` 3; `docs/exercise-review/` 2 JPEG | Captured by the repo's own Playwright scripts; any showing badges carry A1 | 1 | **N** while internal; **Y** for any that show A1 badges if used in a store listing or marketing |
| D1 | Design mock-up with embedded photos | `docs/design/reference-five-screens.png` 1 | Phone screenshot of a five-phone mock-up; small embedded photos of unknown origin | 3 | **Y.** Do not use in marketing |
| — | Marketing, store screenshots, investor deck | **None in the repository or on any branch** (searched names: deck, investor, pitch, pptx, store screenshots). Checklist 11 C5 and file 13 Q35 refer to an investor presentation that is not here | Not inventoried | 3 | **Y** for any image in it that shows A1, A4, D1 or A9 until those are documented |

Scripture text and food data are third-party data, not artwork: see `THIRD_PARTY_LICENSES.md`.

## 3. The undocumented clip: what is reachable, and how it could be excluded

**Reachable by URL on any deployment** (Next.js serves `public/` at the site root; the phone apps load the same site):

- `/exercise-demos/dumbbell-curl/loop.mp4`, `/loop.webm`, `/loop-half.mp4`, `/loop-half.webm`
- `/exercise-demos/dumbbell-curl/poster.webp`, `/thumb.webp`, `/phase-1.webp`, `/phase-2.webp`
- `/exercise-demos/dumbbell-curl/scrub/001.webp` to `/scrub/049.webp`

**Referenced from:** `src/data/exercise-demos.json:8-73` (all URLs above, the scrub base and the `source` text naming `original-owner.mp4` and its SHA-256). That JSON is imported by `src/lib/exercise-demos.ts:11`, which client components import, so its text is probably in the browser bundle (not confirmed by a build). No service-worker, `native-shell/` or `standalone/` reference was found.

**Non-destructive exclusion options (proposals; none implemented):**

| Option | Exact change | Effect | Caveat |
|---|---|---|---|
| A. Redirect the folder | In `next.config.ts` `redirects()`, add `{ source: "/exercise-demos/dumbbell-curl/:path*", destination: "/train/exercises", permanent: false }` | Every URL above stops serving the file. Files stay in the repo and build | Confirm on a preview deployment that the redirect wins over the static file (Next.js applies redirects before the filesystem) |
| B. Block in middleware | In `src/middleware.ts`, return 404 for paths starting `/exercise-demos/dumbbell-curl/`; **also** remove `webp` from the matcher's extension exclusion at `src/middleware.ts:27` or add a separate matcher entry, because `.webp` requests skip the middleware today | Same as A, with a 404 instead of a redirect | Touches the security middleware; test that other images still load |
| C. Leave out of Vercel uploads | Add `public/exercise-demos` to `.vercelignore` | Files absent from Vercel deployments only | Other hosts unaffected; confirm the build does not need them |
| D. Remove the manifest entry | Delete the `dumbbell-curl` object from `src/data/exercise-demos.json` (git keeps it) | Removes the URLs and source text from the app bundle | **Does not stop the files being served**; use with A, B or C |
| E. Keep `review` assets out of `public/` | Pipeline change: `build.mjs` writes to a non-public folder until status is `approved` | Future clips are not published early | A process change; moves files, so do it only on the owner's instruction |

`X-Robots-Tag: noindex` headers would only discourage indexing and are not an exclusion.

## 4. Questions the founder must answer

| Asset | Questions |
|---|---|
| X1 · All code and code-drawn art (A5-ship, A6, A7, A8, C3, C4) | Which AI coding tool and account, on which plan, and the terms in force when used? A dated statement of your role: what you directed, chose, rejected and wrote by hand. Did anyone else contribute? |
| A5-ship · Logo | Who designed the arch mark, with what tool, on what date? Was it based on any reference image? |
| A1, A2, A3 · Badges | Who made the three poster images, with what tool or from what source, on which account and date? Can you supply the original files (not screenshots) and the tool's terms? If not, will you switch to the code-drawn badges (C4) or commission new masters with a written assignment? |
| A4, A5 · Curl clip | Which tool or person made the clip, on which account and date? Was it recorded from another app or website, and which? Was any reference image or video uploaded to make it? Was A9 made before or after it? |
| A9 · Character reference | Which OpenAI account and plan produced it on 2026-10-29? What prompt, and were any images uploaded? |
| Other exercise videos | What, if anything, is in the `exercise-media` bucket in each environment, and has any YouTube or Vimeo video been linked? Who made each? |
| A12 · Home backgrounds | Will the photos be commissioned, licensed from stock or AI-generated? Who appears in them, and where were they taken? |
| D1, D2, deck | Who made `reference-five-screens.png` and its small photos? Where is the investor deck, which images does it use, and who made each? Which screenshots will go in the store listings? |
| F1, I1 · Fonts, icons | None beyond keeping the notices file regenerated when dependencies change. |
