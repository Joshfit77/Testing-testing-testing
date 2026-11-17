# 04 — Asset rights ledger (copyright and asset ownership)

**App:** Narrow Gate Fitness (pre-launch) · **Audit date:** 2026-11-16 · **Branch examined:** `claude/friends-challenges`
**Readers:** the founder and a US copyright/IP attorney.
**Prepared by:** an AI assistant working from the repository only. This is a factual inventory, not legal advice. Nothing here is a conclusion about who owns anything or whether any item is protected by copyright; those are questions for counsel.

## Summary for a reader in a hurry

1. **No asset in this repository has an ownership record.** There is no assignment, contractor agreement, stock licence, AI-tool account record, model release or source file for any picture or video. The only statements are in-repo notes that images "came from the owner", and the repo's own badge document tells the owner to confirm commercial rights before the App Store (`docs/BADGES.md` lines 163–165).
2. **The 27 badge images that every member sees are crops of three phone screenshots** (`scripts/badge-art/posters/*.webp`). The screenshots still show a Photos-app toolbar, a "Crop" button and a status clock. Who made the underlying artwork, and with what tool, is not recorded anywhere. This is the highest-exposure item because it ships in the app, in the offline edition and in the gamification UI.
3. **`original-owner` is a file name written by a script, not an ownership finding.** It means "the file exactly as the owner handed it over". The one clip that carries it looks like a recording of a screen showing an animated, illustrated athlete. Its origin is unrecorded, and the pipeline's own comments call such clips "generated".
4. **One image is cryptographically marked as AI-generated:** `assets/exercise-demos-src/_character/character-reference.png` carries a C2PA manifest signed by OpenAI (ChatGPT, `gpt-image`, 2026-10-29). It is not shipped to users, but it is the declared design reference for the athlete drawn in code and for the grading of the curl clip.
5. **Everything else that ships is either drawn by the app's own code or scripts** (icon, three illustrations, opening gate, 2D exercise athlete, splash screens), **open-licensed** (four font families under SIL OFL 1.1; lucide icons under ISC) **or public-domain text** (Berean Standard Bible). The commit history shows that this code and code-drawn art was committed by an AI coding assistant.
6. **Git history cannot establish authorship.** The clone is shallow; every asset first appears in one import commit of 1,732 files on 2026-11-13, authored by "Claude <noreply@anthropic.com>".

---

## 1. Scope, method and limits

### 1.1 Scope

Every non-code asset tracked in git on this branch, plus artwork that is drawn by program code at build time or run time. 217 tracked binary asset files were found (126 WebP, 72 PNG, 3 JPEG, 4 MP4, 2 WebM, 5 SVG, 5 WOFF2), plus 68 Bible data files and three text-only HTML shells.

Not in scope here (other workstreams): trademark clearance of the name and mark, open-source code licences in general, food and exercise text data, privacy.

### 1.2 Method

| Step | What was done |
| --- | --- |
| Inventory | `git ls-files` filtered by media extension, counted per directory; `ls` of `public/`, `assets/`, `resources/`, `ios/`, `android/`, `native-shell/`, `standalone/`, `src/app`. Searched for sound, Lottie, Rive, `.ico`, Open Graph images and base64-embedded media. |
| History | `git log --diff-filter=A` per asset directory; author and committer counts; commit trailers; `.git/shallow`; asset counts on the four other remote branches. |
| Generators | Read `scripts/render-icons.mjs`, `scripts/native/blank-splash.mjs`, `scripts/opening/render_gate.py`, `scripts/badge-art/*`, `scripts/exercise-demos/ingest.mjs`, `scripts/generate-video-prompts.ts` (headers and relevant logic). |
| Embedded metadata | `strings` scan of all 217 files for C2PA, generator names (OpenAI, ChatGPT, DALL·E, Midjourney, Firefly, Stable Diffusion, Sora, Runway, Kling), stock-site names (Shutterstock, Getty, iStock, Adobe Stock, Unsplash, Pexels, Freepik), Canva/Figma/Inkscape/Illustrator, EXIF, XMP and copyright strings; `identify -verbose` on selected images; `ffprobe` on videos; `fc-scan` and a Brotli decompression of each WOFF2 to read its name-table copyright and licence strings. `exiftool` and `fontTools` are not installed. |
| Documents | `docs/BADGES.md`, `docs/BADGE_ART_SPEC.md`, `docs/EXERCISE_DEMOS_25D.md`, `docs/EXERCISE_DEMOS_2D.md`, `docs/EXERCISE_ATHLETE_LOOK.md`, `docs/exercise-video-prompts.md`, `docs/design/HOME_BACKGROUNDS.md`, `docs/OPENING.md`, `docs/SCRIPTURE.md`, `docs/DATA.md` (relevant parts), `assets/badge-masters/README.md`, `public/home-backgrounds/README.md`, `assets/exercise-demos-src/dumbbell-curl/meta.json`, `src/app/legal/notices/page.tsx`, `src/app/fonts/OFL.txt`. |
| Visual sample | See §1.3. |

### 1.3 What was actually looked at

| Group | Files in group | Viewed | How |
| --- | --- | --- | --- |
| Shipped badges `public/badges` | 27 | 27 | One contact sheet at about native size (files are 362 × 181) |
| Badge posters `scripts/badge-art/posters` | 3 | 3 | Each at half size |
| Opening gate `public/opening` | 4 | 4 | Contact sheet, reduced |
| Illustrations `public/illustrations` | 3 SVG | 3 | Rendered in headless Chromium; source of one read |
| App icon | 6 in `public/icons`, 5 in `resources`, 1 iOS, 24 Android | 1 viewed (`resources/icon.png`); `public/icons/icon.svg` source read | The rest were not viewed; they are produced from the same two SVGs by script |
| Splash screens | 32 (6 iOS, 26 Android) | 0 viewed; all 32 checked by pixel statistics | Every one is a single flat colour, `#090909` |
| Character reference | 1 | 1 | Full size |
| `original-owner.mp4` | 1 (224 frames) | 9 frames | 8-frame contact sheet plus frame 60 at full size |
| `loop.mp4` (corrected clip) | 1 (98 frames) | 6 frames | Contact sheet |
| Other shipped curl files (`loop.webm`, two half-speed files, `poster/thumb/phase-1/phase-2.webp`, 49 scrub frames) | 55 | 0 | Not viewed; the docs say they are derived from the same frames |
| `original-owner-poster.jpg`, `poster.png` (source folder) | 2 | 0 | Metadata only |
| Docs images | 45 | 3 | `docs/design/reference-five-screens.png`, `docs/exercise-review/before-after-1.jpg`, `docs/screenshots/character-designs-2026-11-10/studio.webp` |

Statements below about what an image shows apply only to the files marked as viewed.

### 1.4 What cannot be established from the repository

- **Who the human author of any image or clip was.** No file carries an author, artist or copyright field.
- **Whether any contributor was an employee, contractor, friend or the founder personally,** and whether any written assignment or work-for-hire agreement exists.
- **Which AI tools were used for the badge posters and the curl clip,** under which account, on which plan, and which terms of service were accepted on the dates of generation.
- **Whether any stock or marketplace licence is held.** No licence receipts or IDs are in the repo.
- **Whether any picture was derived from, traced from, or prompted with someone else's work.** Metadata cannot show this.
- **Original commit dates and authors.** The clone is shallow (`.git/shallow` lists `223ee96`). Every asset path's first commit is `223ee96`, 2026-11-13, a 1,732-file import. Documents refer to earlier work (for example a commit `20fc052`) that is not present in this clone.
- **What is in the Supabase `exercise-media` storage bucket** (`docs/DATA.md` line 23: a public catalogue bucket that administrators upload to). Its contents are not in the repository and were not examined.
- **What the App Store / Play Store listing screenshots and marketing graphics will be.** None are in the repo.
- **Whether the entity that will publish the app owns what the founder owns personally.** No company-to-founder IP assignment is in the repo.

---

## 2. Asset-rights ledger

Classification vocabulary: ORIGINAL OWNER-CREATED / EMPLOYEE-OR-CONTRACTOR / AI-GENERATED / CODE-GENERATED BY THE APP'S OWN SCRIPTS / LICENSED STOCK / OPEN-SOURCE / THIRD-PARTY-UNCERTAIN / UNKNOWN.

"First commit" is `223ee96` (author and committer "Claude <noreply@anthropic.com>", 2026-11-13, trailer `Co-Authored-By: Claude Opus 5.5`) for every row unless stated. Because that commit is a bulk import into a shallow clone, it shows only when the file entered this history, not who made it.

Risk scale: High / Medium / Low / Minimal — an indication of how much is unknown and how exposed the item is to users, not a legal assessment.

### 2.1 Shipped to users

| ID | Path(s) and count | What it is | Where users see it | How it was made (evidence) | Classification | Ownership evidence present? | Licence or terms | Commercial-use right evidenced? | Third-party marks visible? | Risk | Recommended action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | `public/badges/*.webp` — 27 (362 × 181) | Rank badge pictures: 9 Fitness (shields, helmet, lion, anvil, diamond, crown, winged cross shield), 9 Food (spark to phoenix), 9 Faith (seed to cedar) | Badges page, rank board, rank ladder, celebration dialogs (`src/components/badges/*`); also embedded as base64 in `standalone/index.html` | Cropped by `scripts/badge-art/crop-posters.py` from the three posters in A2 (`docs/BADGES.md` lines 113–117). One badge (Conqueror) was edited by `scripts/badge-art/edit_conqueror.py` to shrink the cross. No metadata in the files | **UNKNOWN** (derivative of A2; visual style is consistent with AI image generation, which is an impression, not evidence) | No. Only the statement "these images came from the owner" | None recorded | No. `docs/BADGES.md` 163–165 and `docs/BADGE_ART_SPEC.md` 52–53 both say rights still need confirming | None seen in the 27 crops. Generic subjects (helmets, lion, crown, cross, trees, flames) | **High** | Founder to state in writing how the posters were made (tool, account, date, prompts, or artist). Keep A1 flagged. Safer replacement: the planned 27 masters (`docs/BADGE_ART_SPEC.md`) produced under a written commission with assignment, or under an AI service whose terms are saved with the files. The code-drawn vector badges in `badge-art.tsx` are an existing fallback |
| A2 | `scripts/badge-art/posters/{fitness,food,faith}.webp` — 3 (1290 × 2796, lossless) | Phone screenshots of three "poster" mock-ups, each a full app-style screen with nine badges, titles and verse references | Not served by the app (excluded from Vercel by `.vercelignore`); they are in the repository and in the artist hand-off pack | Described in the docs as "the owner's three poster screenshots". The images show iOS Photos-app chrome: a "Crop" pill, a back arrow, "Tuesday 9:24 PM", share/heart/info/trash icons. `fitness.webp` shows "JOSH LEVEL 6" and a round avatar of a man with head bowed; `faith.webp` shows a figure walking to a lit gate. No embedded metadata | **UNKNOWN** | No | None recorded | No | Apple Photos interface elements are visible in the screenshots (not in the crops). No brand logos seen | **High** (as the source of A1) | Obtain the original, un-screenshotted files and their creation record. Counsel to advise whether the screenshots with Apple UI chrome should stay in a repository that is sent to outside artists |
| A3 | `standalone/index.html` — 1 (5.4 MB) with 27 base64 WebP and 2 base64 SVG inside | Offline single-file demo edition of the app | Used by the offline Android APK workflow (`docs/LAUNCH_AUDIT_2026-11-08.md` line 92) | "Generated outside this repo" (`docs/FOOD_IQ_FORM_GPS_REPORT.md` line 125). Embeds the A1 badge images. Loads Inter, Plus Jakarta Sans, Lora and Cinzel from `fonts.googleapis.com` | Mixed: carries A1 (**UNKNOWN**) plus code | No | Same as A1; fonts as F1 | No | Not examined beyond the embedded-media count | **High** (inherits A1) | Treat as a second distribution of A1. Decide whether it is distributed at all at launch. The generator is not in the repo: record where it is |
| A4 | `public/exercise-demos/dumbbell-curl/` — 57 files: `loop.mp4`, `loop.webm`, `loop-half.mp4`, `loop-half.webm`, `poster.webp`, `thumb.webp`, `phase-1.webp`, `phase-2.webp`, 49 `scrub/*.webp` | The corrected dumbbell-curl demonstration (3.27 s, 540 × 788) and stills derived from it | **Not shown in the app UI**: status is `review`, and `shownDemoAsset()` in `src/lib/exercise-demos.ts` returns only `approved` assets. **But the files sit in `public/`, so they are deployed and reachable by direct URL** | Made by `scripts/exercise-demos/correct.py` and `build.mjs` from `original-owner.mp4` (see A5 in §2.2 and §3): frames 43–92 played forward then reversed, colour-graded toward the character reference | **UNKNOWN** (derivative of an unrecorded source clip; the pipeline calls input clips "generated") | No | None recorded | No | The 6 frames viewed show an illustrated shirtless male athlete, dark shorts with a small pale mark on the left leg (unreadable at this size; resembles an arch), dark trainers with no readable branding, plain dumbbells. No readable third-party logo. Not a photograph of an identifiable real person as far as could be seen | **Medium–High** (publicly reachable although hidden) | Flag. Until provenance is documented, counsel to decide whether these files should remain in `public/`. Safer alternative already in use: the code-drawn 2D athlete (C3) |
| A5-ship | `public/icons/` — 6 (`icon.svg`, `maskable.svg`, `icon-192.png`, `icon-512.png`, `maskable-512.png`, `apple-touch-icon.png`); `resources/` — 5 (`icon.png`, `icon-only.png`, `icon-foreground.png`, `icon-background.png`, `splash.png`); `ios/…/AppIcon.appiconset/AppIcon-512@2x.png` — 1; `android/…/mipmap-*/ic_launcher*.png` — 24, plus launcher XML | The app mark: a gold arch with a smaller arched door inside, on near-black | Home-screen icon on iOS, Android and PWA; store listing icon | SVG masters are 16-line hand-written vector files with no editor metadata. PNGs rendered by `scripts/render-icons.mjs` (headless Chromium), native sizes by `capacitor-assets generate` (`package.json` script `icons`). `resources/icon.png` viewed: matches the SVG | **CODE-GENERATED BY THE APP'S OWN SCRIPTS** from SVG authored in the repo (committed by the AI coding assistant; see §4) | Partly: generator and source are in the repo. No human-author record | Not applicable (own work, subject to §4) | Not applicable | The mark itself is the app's. Whether it resembles another party's mark is a trademark question for another workstream | **Low** (copyright); trademark clearance separate | Record who designed the mark and when. Keep SVG masters |
| A6 | `public/illustrations/{sunrise-cross,cross-dusk,mountains-sunrise}.svg` — 3 | Flat vector scenes: a cross on a summit at sunrise, a cross at dusk, layered mountains | Faith page and scene hero (`src/components/common/scene-hero.tsx`, `src/app/(app)/faith/page.tsx`) | Hand-written SVG (54–80 lines each), gradients and polygons, no editor or stock metadata. Each has a comment "Original artwork for Narrow Gate Fitness…". All three rendered and viewed | **CODE-GENERATED** (SVG authored in the repo, committed by the AI coding assistant). The "original artwork" comment is a claim in the file, not verified | Partly: source is the file itself. No human-author record | Not applicable | Not applicable | None | **Low** | Keep. Note for counsel under §4 |
| A7 | `public/opening/{gate-base,gate-light,gate-door,gate-haze}.webp` — 4; `src/components/common/gate-geometry.json` | The opening sequence: dark wall, narrow arched doorway, door leaf, mist | The "Enter Narrow Gate" intro on launch (`src/lib/opening.ts`) | Rendered by `scripts/opening/render_gate.py`, a numpy ray-tracing renderer in the repo (`docs/OPENING.md` line 106). No external textures or models are referenced in the script header. All four viewed: plain architecture, no text or marks | **CODE-GENERATED BY THE APP'S OWN SCRIPTS** | Yes for process (script is in the repo and re-runnable). No human-author record | Not applicable | Not applicable | None | **Low** | Keep. Optionally re-run the script and compare, to confirm the shipped files are its output (technical test) |
| A8 | iOS `Splash.imageset/*.png` — 6; Android `drawable*/splash.png` — 26 | Launch screens | Native app launch | Written by `scripts/native/blank-splash.mjs`. All 32 verified as a single flat colour `#090909` | **CODE-GENERATED** | Yes (trivial) | Not applicable | Not applicable | None | **Minimal** | None |
| F1 | `src/app/fonts/*.woff2` — 5: Inter, Plus Jakarta Sans, Cinzel, Lora (regular and italic); `src/app/fonts/OFL.txt` | Typefaces | All app text, loaded with `next/font/local` in `src/app/layout.tsx` | `OFL.txt` says "from Fontsource 5.3.0 (the Google Fonts files)". Name tables read from each file: Inter © 2016 The Inter Project Authors, v4.001; Plus Jakarta Sans © 2020 The Plus Jakarta Sans Project Authors, v2.071; Cinzel © 2020 The Cinzel Project Authors; Lora © 2011 The Lora Project Authors, Reserved Font Name "Lora". Each carries the `scripts.sil.org/OFL` licence URL | **OPEN-SOURCE (SIL Open Font License 1.1)** | Yes: licence and copyright strings are inside the font files and in `OFL.txt` | SIL OFL 1.1; text in `src/app/fonts/OFL.txt` (source tree only) | Yes — OFL permits bundling and commercial use; fonts may not be sold on their own | None | **Low** | The in-app notices page (`src/app/legal/notices/page.tsx`) does **not** list the fonts or the OFL. `OFL.txt` is not served to users. Add a fonts entry to Notices; counsel to confirm that satisfies the OFL's requirement to include the notice with copies. Lora has a Reserved Font Name: do not rename a modified copy "Lora" |
| F2 | Google Fonts stylesheet link in `standalone/index.html` (line 6) | The same four families, fetched from Google at run time | Offline edition only | Remote load | **OPEN-SOURCE (OFL 1.1)** | Not applicable (not redistributed) | Google Fonts terms | Yes | None | **Low** | Privacy point (request to Google) belongs to the privacy workstream |
| B1 | `public/bible/bsb/` — 68 files (66 books, `meta.json`, `wj.json`), 4.2 MB; `public/bible-offline.html`, `public/bible-offline.js` | Full text of the Berean Standard Bible and an offline reader | Faith section, verse cards, offline Bible | Built by `scripts/build-bsb-bible.mjs` from `https://bereanbible.com/bsb.txt`; `meta.json` records source URL, download time 2026-11-03 and SHA-256 | **THIRD-PARTY, stated public domain** (publisher's dedication; not independently verified here) | Source URL and hash recorded. The publisher's public-domain dedication is not saved in the repo | Public domain per `docs/SCRIPTURE.md` line 3 | Stated yes | None | **Low** | Save a dated copy of the publisher's public-domain statement next to the data. Red-letter data (`wj.json`) has its own sources: see `docs/SCRIPTURE.md` and the Scripture workstream |
| I1 | `lucide-react` 1.58.0 (npm), imported in 183 source files | Interface icons | Throughout the UI | npm package | **OPEN-SOURCE (ISC)** per `package-lock.json` | Yes | ISC | Yes | Not examined icon by icon (lucide removed brand icons in v1; not verified here) | **Low** | Add to Notices with the other packages |
| T1 | `native-shell/{index,error,privacypolicy}.html`, `standalone/privacypolicy.html`, `public/offline.html` | Text-only fallback pages, system fonts | Native shell when offline or on error | Hand-written HTML, no images | **CODE-GENERATED / authored in repo** | n/a | n/a | n/a | None | **Minimal** | None |

### 2.2 In the repository but not shipped to users

| ID | Path(s) and count | What it is | Where it is used | How it was made (evidence) | Classification | Ownership evidence present? | Licence or terms | Commercial-use right evidenced? | Third-party marks visible? | Risk | Recommended action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A5 | `assets/exercise-demos-src/dumbbell-curl/original-owner.mp4` (7.47 s, 540 × 788, 30 fps, no audio; SHA-256 `07e8da80…dc33`, matching `meta.json`) and `original-owner-poster.jpg` | The clip as supplied by the owner, and its poster | Source for A4. Not in `public/`; not in `.vercelignore` either, but not served | Supplied by the owner; no origin recorded. Container metadata: re-encoded with FFmpeg (`Lavf61.7.103`), video handler name "Core Media Video" (an Apple-device origin somewhere in its chain). No C2PA or generator tag. See §3 for what the frames show | **UNKNOWN** — labelled "owner", pipeline calls such clips "generated" | No | None recorded | No | 9 frames viewed: illustrated shirtless male athlete with glowing muscle highlights, olive shorts with a small pale mark, dark trainers, plain dumbbells; visible glare and a skewed frame edge suggest it was filmed or recorded from a screen. No readable third-party logo; the figure is a rendering, not obviously a real person | **High** (as the source of A4) | Founder to document: which tool made it, on what account, from what prompt or reference image, and when |
| A9 | `assets/exercise-demos-src/_character/character-reference.png` — 1 (1122 × 1402) | A poster-style image of the black-and-gold athlete doing a dumbbell curl, with "NARROW GATE FITNESS", the arch mark, "DUMBBELL BICEPS CURL", "STRENGTH / HYPERTROPHY / BETTER YOU" and two small panels "1. START", "2. CURL" | Design reference for the code-drawn athlete look (`docs/EXERCISE_ATHLETE_LOOK.md`) and colour-grading target for A4; attached to every video prompt in `PROMPTS.md` | **Embedded C2PA manifest signed by OpenAI**: claim generator "ChatGPT", version `gpt-image`, `digitalSourceType` = `trainedAlgorithmicMedia`, action `c2pa.created` at 2026-10-29T17:20:38Z | **AI-GENERATED (OpenAI ChatGPT image generation)** — confirmed by signed metadata | Account holder and plan not recorded | OpenAI terms in force on 2026-10-29 for the account used (not in repo) | Not evidenced in repo | Shows the app's own arch mark on dumbbells, shorts and trainers. No third-party logo seen. The athlete is a synthetic figure; whether the face resembles a real person cannot be judged here | **Medium** | Record the account and plan; save the terms as of that date. Counsel to assess (a) rights in the output, (b) its role as the reference for C3 and A4 |
| A10 | `assets/exercise-demos-src/dumbbell-curl/{loop.mp4,poster.png,meta.json}`; `assets/exercise-demos-src/PROMPTS.md` (223 KB), `SHEET.md`; `docs/exercise-video-prompts.md` and `.csv` (95 prompts) | Working copy of the corrected clip; ready-to-paste text prompts for AI video generation of 157 (and an earlier 95) exercises | Planning material for future AI-generated clips | Prompts are generated by `scripts/generate-video-prompts.ts` from the app's own exercise data | Clip: **UNKNOWN** (as A4). Prompts: **CODE-GENERATED** text | n/a | n/a | n/a | n/a | **Medium (forward-looking)** | Before any clip from these prompts ships: choose the video tool for its commercial terms, save terms and outputs, and keep a per-clip record. The docs already require human review of each clip for form |
| A11 | `assets/badge-masters/README.md` only (folder is git-ignored) | Placeholder for 27 future high-resolution badge masters | None yet | Not yet produced | n/a | n/a | n/a | n/a | n/a | **Forward-looking** | When masters arrive, store source, author/tool, licence and date beside each file |
| A12 | `public/home-backgrounds/README.md` only | Placeholder for seven day-of-week photographs | None; `HOME_BACKGROUND_PHOTOS_READY` is false and Home shows a plain panel | A first, code-drawn set was committed in `7b8852a` and removed in `56500ff` (2026-11-15) after the owner rejected it. Seven of those code-drawn WebP files are still present on the remote branch `claude/pro-premium` | n/a now | n/a | `docs/design/HOME_BACKGROUNDS.md` line 49 requires a recorded licence | n/a | The brief asks for realistic photographs of athletes | **Forward-looking: High if done informally** | Real photographs of people need a licence that covers app use and, for identifiable people, a model release; locations may need a property release. AI-generated "photographs" need saved terms. Record source, licence and date next to each file, as the doc already says |
| D1 | `docs/design/reference-five-screens.png` — 1 (1290 × 2796) | A phone screenshot (XMP `UserComment: Screenshot`, 2026-10-20) of a five-phone mock-up titled "NARROW GATE FITNESS" with small photographs inside (food, a map, a hill with a cross, a gym scene) | Design reference only | Origin unrecorded | **UNKNOWN** | No | None | No | Small embedded photos of unknown origin; a map graphic. Too small to identify sources | **Low** while internal; **Medium** if ever published | Do not use in marketing. Record who made it |
| D2 | `docs/screenshots/**` — 39 WebP; `docs/launch-preview/*.png` — 3; `docs/exercise-review/before-after-{1,2}.jpg` — 2 | Screenshots and contact sheets of the app's own screens and code-drawn athlete | Internal documentation (excluded from Vercel) | Captured by the repo's own Playwright scripts (`scripts/ux`, `scripts/exercise-review`) | **CODE-GENERATED** (pictures of the app itself; any that include badges carry A1) | n/a | n/a | n/a | 2 of 44 viewed: only the code-drawn figure | **Minimal** | If reused as store screenshots, the A1 badge question travels with them |

### 2.3 Artwork that is program output, not files

| ID | Code | What it draws | Where users see it | Evidence | Classification | Risk | Recommended action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C3 | `src/lib/exercise-motion/` (16 files incl. `athlete.ts`, `athlete-next.ts`, `skeleton.ts`, `render.ts`, `props*.ts`, `patterns/`), `src/data/exercise-motions.ts` | The 2D exercise athlete and equipment for 157 exercises, drawn on a canvas each frame | Exercise library, exercise pages, workout logger | Docs describe "157 hand-made motions" and "shaped paths drawn on a canvas… No images or videos". `docs/EXERCISE_ATHLETE_LOOK.md` states the newer look follows "the black-and-gold muscular athlete of the owner's reference image" (A9). One screenshot viewed: a generic flat-shaded male figure, black shorts, plain dumbbells and barbell, no marks | **CODE-GENERATED** (code committed by the AI coding assistant), with an **AI-GENERATED image as its stated visual reference** | **Low–Medium** | Counsel to note the dependency on A9. No motion-capture data, third-party rig or dataset is referenced in the docs read (the earlier CC BY-SA 3D anatomy model was removed, per `docs/EXERCISE_DEMOS_2D.md`; it is absent from all five branches checked) |
| C4 | `src/components/badges/badge-art.tsx` | Vector badge drawings, frames, labels and animated details (shimmer, flames) | Fallback when a badge image is missing; frames around A1 | Source in repo | **CODE-GENERATED** | **Low** | Available as the replacement if A1 must be withdrawn |
| C5 | `src/lib/opening.ts`, `globals.css` | The drawn fallback gate (lit arch) and the animation that composes A7 | Opening sequence | Source in repo | **CODE-GENERATED** | **Low** | None |
| C6 | `src/components/workout/workout-logger.tsx` (Web Audio) | Timer tones synthesised at run time | Rest timer | No sound files exist in the repo | **CODE-GENERATED** | **Minimal** | None |
| C7 | `src/components/run/route-map.tsx`, `src/lib/domain/map-tiles.ts` | Route drawing; optional third-party map tiles if the owner configures a provider | Run screen | Tiles are remote and configurable; attribution string is rendered | Third-party service if enabled | **Low** | Tile-provider terms belong to the third-party-services workstream |

### 2.4 What was looked for and not found

No sound or music files; no Lottie, Rive or 3D model files; no `favicon.ico`, Open Graph or Twitter card images in `src/app`; no stock-site names, watermarks, camera EXIF, Adobe Stock/Getty/Shutterstock/Unsplash/Pexels markers or URLs in any of the 217 files; no marketing graphics or store screenshots; no photographs of real people (the avatar and figure inside the badge posters are small illustrated images of unknown origin).

---

## 3. Exercise assets labelled `original-owner`

### 3.1 What the label is

`original-owner` is a **file name**, not a metadata field, a licence tag or a review status. A search of the repository (excluding dependencies) finds it in exactly these places:

| Where | What it says |
| --- | --- |
| `scripts/exercise-demos/ingest.mjs` lines 2, 42, 51 | For every incoming clip, "keeps the file as `original-owner.<ext>`": the script copies whatever file it is given into `assets/exercise-demos-src/<slug>/original-owner.<ext>` (or `…/angles/<view>/original-owner.<ext>`). The same script writes `meta.json` with `source: "Owner-supplied <filename> …"` |
| `assets/exercise-demos-src/dumbbell-curl/meta.json` line 4 and its copy in `src/data/exercise-demos.json` line 12 | "Corrected 2026-10-30 from the owner's clip (original-owner.mp4; dumbbell-curl.mp4, 540x788, 30 fps, 7.47 s, H.264 High, no audio, sha256 07e8da80…)" |
| `docs/EXERCISE_DEMOS_25D.md` line 29 | "The owner's original clip and poster stay in the source folder as `original-owner.*`." |

So the label means **"the unmodified file as received from the owner"**, as opposed to the corrected `loop.mp4`. The script applies it automatically to any file passed in; it performs no check of authorship, origin or licence. The first line of the same script describes its input as "**generated** exercise clips", and `docs/EXERCISE_DEMOS_25D.md` says the remaining 156 clips are missing because "generating a clip needs a video model".

### 3.2 What carries the label today

Two files, both for one exercise: `assets/exercise-demos-src/dumbbell-curl/original-owner.mp4` and `original-owner-poster.jpg`. Everything in `public/exercise-demos/dumbbell-curl/` (57 files) and `assets/exercise-demos-src/dumbbell-curl/loop.mp4` and `poster.png` derives from that clip.

### 3.3 Evidence for and against "the owner made this"

| Evidence | What it supports |
| --- | --- |
| File name and `meta.json` wording ("the owner's clip", "Owner-supplied") | That the owner **supplied** the file. Nothing more |
| SHA-256 in `meta.json` matches the file | That the stored file is the one that was ingested |
| Container: FFmpeg re-encode; handler "Core Media Video"; no C2PA, no creation tool, no author | An Apple device or app was in the chain. The generator, if any, is not identified |
| Frames viewed (9 of 224): an illustrated, glowing-muscle athlete; glare, a lit backdrop and a skewed dark edge at the top and left of the frame | Consistent with a phone recording of a screen that was playing an animated clip. Not consistent with the owner filming a real person |
| `meta.json` flags: "the stitch between two takes at 3.9 s", "dumbbell smears", "a doubled dumbbell outline", "Needs a regenerated clip" | Artefacts typical of machine-generated video; the docs themselves use "regenerated" |
| The character in the clip (light skin, olive shorts) differs from the character reference A9 (graphite skin, black shorts) | The clip was not simply produced from A9 as it stands |

**Result:** the repository evidences that the owner *provided* the clip. It does not evidence who or what *created* it, under what terms, or from what source material. Classification: **UNKNOWN**, suspected AI-generated and screen-recorded.

### 3.4 Current exposure

- In the app UI: none. The asset's status is `review`; only `approved` assets are shown.
- On the web: the 57 derived files are in `public/` and therefore served at `/exercise-demos/dumbbell-curl/…` on any deployment.
- In the repository: the source clip is tracked in git on this branch.

### 3.5 Questions for the founder

1. Which tool or person produced the clip? On which account and date?
2. Was it recorded off a screen from another app or website? If so, which, and what do that service's terms say about downloads and commercial use?
3. Was a reference image or an existing video uploaded to produce it? Whose?
4. Was A9 (the ChatGPT image) made before or after it, and from what prompt?

---

## 4. AI-generated and AI-assisted material

Reported as facts for counsel to assess. No view is offered here on whether any item is protectable.

### 4.1 Confirmed by signed metadata

| Item | Evidence |
| --- | --- |
| `assets/exercise-demos-src/_character/character-reference.png` (A9) | C2PA manifest: issuer "OpenAI OpCo, LLC" certificates; claim generator "ChatGPT", `gpt-image`; `digitalSourceType: trainedAlgorithmicMedia`; `c2pa.created` 2026-10-29T17:20:38Z, then `c2pa.converted` |

It was the only one of the 217 files with any provenance manifest.

### 4.2 Suspected, not confirmed

| Item | Why suspected | What would confirm or refute |
| --- | --- | --- |
| Badge posters A2 and the 27 badges A1 | Visual style; the repo's own rights note offers "AI images you generated" as one possibility; the future masters are specified with a "prompt template" for "an artist or an image-generation service" | The founder's account history in the image tool; the original (non-screenshot) files, which may carry C2PA data |
| `original-owner.mp4` A5 and its derivatives A4 | §3.3 | The founder's account history in the video tool; the original download |
| Small avatar and banner pictures inside the posters A2; the photographs inside `reference-five-screens.png` D1 | Same style; unknown origin | Founder's statement |

### 4.3 Planned AI generation

- 157 video prompts (`assets/exercise-demos-src/PROMPTS.md`) and 95 earlier prompts (`docs/exercise-video-prompts.md`), each to be used with the A9 image attached.
- 27 badge masters (`docs/BADGE_ART_SPEC.md`), by "an artist or an image-generation service".
- Seven Home photographs, where option 2 in `docs/design/HOME_BACKGROUNDS.md` is to generate them.

### 4.4 Code and code-drawn artwork: what the commit history shows

| Fact | Value |
| --- | --- |
| Commits reachable on this branch | 76 (2026-11-13 to 2026-11-16) |
| Author of all 76 | `Claude <noreply@anthropic.com>` |
| Committer of all 76 | `Claude <noreply@anthropic.com>` |
| Trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` | 55 commits |
| Trailer `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>` | 18 commits |
| Trailer `Claude-Session: https://claude.ai/code/session_…` | 73 commits |
| Commits with a human author or committer identity | 0 |
| Repository state | Shallow clone; history begins at `223ee96`, a 1,732-file, 266,664-line import |

What follows from this, factually:

- The history records an AI coding assistant as the author of every commit. It does not record which human directed each change, how much a human edited, or what was written by hand before the import.
- The code-drawn artwork in §2.3 (2D athlete, vector badges, opening animation), the SVG icon and illustrations (A5-ship, A6), the gate renderer (A7) and the documentation all entered the history through these commits.
- The documents repeatedly attribute *decisions* to "the owner" (art direction, approvals, rejections), which is evidence of human direction and selection but not of human authorship of specific expression.
- A file comment such as "Original artwork for Narrow Gate Fitness" (A6) and README statements about originality were written in the same commits and are claims, not verification.

Questions this raises for counsel: the copyright status of AI-assisted code and AI-drawn art; what the app's copyright notices and any registration should claim or disclaim; whether the founder's agreement with the AI-tool provider assigns output to the founder or to a company; and whether App Store or other representations about ownership can be made as drafted.

---

## 5. Missing documentation

| # | Missing item | Affects |
| --- | --- | --- |
| M1 | Source record for the three badge posters: creator (person or tool), account, date, prompts or brief, original files | A1, A2, A3 |
| M2 | Licence or terms of service evidencing commercial-use rights in the badge artwork | A1, A2, A3 |
| M3 | Source record for `original-owner.mp4`: tool, account, date, inputs; terms of any service it was recorded from | A4, A5, A10 |
| M4 | OpenAI account holder, plan and terms as of 2026-10-29 for the character reference; the prompt and any uploaded reference images | A9, and by reference C3, A4 |
| M5 | Written assignment or work-for-hire agreement from anyone other than the founder who contributed artwork or direction (none is in the repo; whether anyone did is unknown) | All |
| M6 | IP assignment from the founder personally to the entity that will publish the app (if an entity exists) | All |
| M7 | Terms of the AI coding assistant under which the code and code-drawn art were produced, and the account holder | A5-ship, A6, A7, C3–C6, all code |
| M8 | Model releases — none exist. None appears to be needed for current assets (no identifiable real person seen in the sample). **Will be needed** for the seven planned Home photographs if they show identifiable people | A12 |
| M9 | Property releases — none exist; relevant only to the planned photographs (recognisable private locations, church interiors) | A12 |
| M10 | Stock licences — none exist and no stock asset was detected. Required if the Home photographs are licensed | A12 |
| M11 | Font attribution in the in-app Notices page; a copy of the OFL reachable by users | F1 |
| M12 | lucide-react (ISC) and other bundled-asset packages in the Notices list | I1 |
| M13 | Saved copy of the Berean Standard Bible public-domain dedication, dated | B1 |
| M14 | Origin of `docs/design/reference-five-screens.png` and the photographs inside it | D1 |
| M15 | The generator and source for `standalone/index.html` ("generated outside this repo") | A3 |
| M16 | Inventory and rights records for the Supabase `exercise-media` bucket | Not examined |
| M17 | Full git history (un-shallowed) or any earlier repository showing original commit dates and human authors | All |
| M18 | A standing asset register: one line per future asset with source, author/tool, licence, date and releases | Future badge masters, clips, photographs, store screenshots |

---

## 6. Findings

Severity reflects exposure and how much is unknown, for prioritisation only.

### F-01 — Shipped badge artwork has no provenance or licence record

| | |
| --- | --- |
| Severity | **High** |
| Confirmed or suspected | **Confirmed** that no record exists and that the 27 shipped images are crops of phone screenshots. **Suspected** (not shown) that the art is AI-generated. Nothing indicates it was copied from a third party, and nothing excludes it |
| Evidence | `docs/BADGES.md` 113–117, 163–165, 184; `docs/BADGE_ART_SPEC.md` 5, 52–53; the three posters viewed (Photos-app "Crop" button, toolbar and clock visible); no metadata in any badge file |
| Business impact | Badges are a core, always-visible feature and are duplicated in the offline edition. If rights cannot be shown, the images could have to be withdrawn after launch, and a statement to Apple or Google that the developer holds rights to all content would rest on an undocumented assumption |
| Recommended action | Flag; do not remove. Founder writes down how the posters were made and attaches the originals and the tool terms. If that cannot be done, replace with the planned masters under documented terms, or switch to the existing code-drawn vector badges (`badge-art.tsx`) |
| Counsel must decide | **Y** |
| Blocks public launch | **Counsel** |
| Can technical testing resolve it | **No.** A reverse-image search of the 27 crops and of the posters can look for earlier publication, which reduces uncertainty but does not prove ownership |

### F-02 — `original-owner` clip: origin unrecorded, derivatives publicly reachable

| | |
| --- | --- |
| Severity | **High** for the record gap; **Medium** for present exposure |
| Confirmed or suspected | **Confirmed**: the label is an automatic file name; no origin is recorded; 57 derived files are in `public/`. **Suspected**: AI-generated and recorded from a screen |
| Evidence | §3; `scripts/exercise-demos/ingest.mjs`; `meta.json`; `ffprobe` output; 9 source frames and 6 corrected frames viewed; `src/lib/exercise-demos.ts` (`shownDemoAsset`) |
| Business impact | Not visible in the UI today, so user-facing impact is small. The files are nevertheless published by any deployment, and the clip is the template for a planned library of 157 |
| Recommended action | Flag; do not remove. Document the origin (§3.5). Counsel to decide whether unapproved, undocumented media should sit in `public/` at launch; a technically simple alternative is to keep `review`-status assets out of the served folder until approved. The code-drawn athlete already covers every exercise |
| Counsel must decide | **Y** |
| Blocks public launch | **N** for the app UI as it stands; **Counsel** on the publicly reachable files |
| Can technical testing resolve it | **Partly.** Testing can confirm what is reachable by URL on the deployed site. It cannot establish origin |

### F-03 — Character reference image is AI-generated (OpenAI), with no account or terms record

| | |
| --- | --- |
| Severity | **Medium** |
| Confirmed or suspected | **Confirmed** (signed C2PA manifest) |
| Evidence | §4.1; image viewed |
| Business impact | Not shipped. It is the stated visual reference for the code-drawn athlete look and the grading target for the curl clip, and it is to be attached to every future video prompt, so its status flows into shipped and planned material |
| Recommended action | Record account, plan, prompt and the terms in force on 2026-10-29. Counsel to assess rights in the output and the downstream dependency |
| Counsel must decide | **Y** |
| Blocks public launch | **N** (counsel may differ) |
| Can technical testing resolve it | **No** (the technical fact is already established) |

### F-04 — All commits are authored by an AI coding assistant; no human authorship record for code or code-drawn art

| | |
| --- | --- |
| Severity | **Medium** (information for counsel; breadth is the whole product) |
| Confirmed or suspected | **Confirmed** as to what the history shows. What humans contributed is not recorded |
| Evidence | §4.4 |
| Business impact | Affects what the company can claim to own and register, how copyright notices are worded, and representations to app stores, investors or acquirers |
| Recommended action | Founder to give counsel a factual account of how the app was built (who prompted, who reviewed, what was hand-written) and the AI-tool terms. No change to the repository is needed |
| Counsel must decide | **Y** |
| Blocks public launch | **Counsel** |
| Can technical testing resolve it | **No** |

### F-05 — No chain of title of any kind is in the repository

| | |
| --- | --- |
| Severity | **Medium** |
| Confirmed or suspected | **Confirmed** absent from the repo. Whether documents exist elsewhere is unknown |
| Evidence | No assignment, contractor agreement, licence, release or receipt found; shallow history; §5 M5–M7, M17 |
| Business impact | Ownership cannot be demonstrated on request |
| Recommended action | Assemble an IP file outside the repo: founder declaration, any contributor agreements, founder-to-entity assignment, tool terms. Start the asset register (M18) |
| Counsel must decide | **Y** |
| Blocks public launch | **Counsel** |
| Can technical testing resolve it | **No** |

### F-06 — Bundled fonts are OFL-licensed but not attributed in the app

| | |
| --- | --- |
| Severity | **Low** |
| Confirmed or suspected | **Confirmed** |
| Evidence | Name tables of all five WOFF2 files; `src/app/fonts/OFL.txt`; `src/app/legal/notices/page.tsx` has sections for food data, Scripture, software and trademarks, none for fonts |
| Business impact | Small. The font files themselves carry their copyright and licence URL; the full licence text is in the source tree but not delivered to users |
| Recommended action | Add a Fonts paragraph to Notices naming Inter, Plus Jakarta Sans, Cinzel and Lora, their copyright lines and the SIL OFL 1.1 with a link or the text. Add lucide (ISC) at the same time |
| Counsel must decide | **N** (confirm wording) |
| Blocks public launch | **N** |
| Can technical testing resolve it | **Yes** — a check that the Notices page lists every bundled font |

### F-07 — Planned Home photographs, badge masters and exercise clips have no rights process yet

| | |
| --- | --- |
| Severity | **Medium (forward-looking)** |
| Confirmed or suspected | **Confirmed** that the assets are planned and that the docs ask for rights to be recorded; no template or register exists |
| Evidence | `docs/design/HOME_BACKGROUNDS.md` 18–57; `docs/BADGE_ART_SPEC.md`; `PROMPTS.md`; `public/home-backgrounds/README.md`; `assets/badge-masters/README.md` |
| Business impact | The most likely place for a real third-party claim to arise later: sports photographs of identifiable people, branded clothing or equipment in photos, stock licences that exclude app use, AI outputs under non-commercial plans |
| Recommended action | Before any of these are added: a one-page intake checklist (source, licence scope incl. mobile apps and marketing, model and property releases, visible logos removed, AI-tool terms saved). For photographs prefer a written commission with assignment, or a stock licence whose terms are saved with the file |
| Counsel must decide | **Y** (the checklist and licence standards) |
| Blocks public launch | **N** (nothing is shipped yet) |
| Can technical testing resolve it | **Partly** — a build check can refuse an asset that has no register entry |

### F-08 — Screenshots with third-party interface elements and undocumented imagery are kept as reference material

| | |
| --- | --- |
| Severity | **Low** |
| Confirmed or suspected | **Confirmed** |
| Evidence | A2 posters (Apple Photos UI chrome, a first name "JOSH"); D1 mock-up with embedded photographs of unknown origin |
| Business impact | Internal only today; the posters are included in the artist hand-off pack by `scripts/badge-art/make-handoff-pack.py`. Risk arises if either is published or used in marketing |
| Recommended action | Keep internal. Do not use in store listings or advertising. Replace with original files when obtained |
| Counsel must decide | **N** |
| Blocks public launch | **N** |
| Can technical testing resolve it | **No** |

### F-09 — Rejected and retired assets persist on other branches or outside this clone

| | |
| --- | --- |
| Severity | **Low** |
| Confirmed or suspected | **Confirmed** for the seven code-drawn Home backgrounds on `origin/claude/pro-premium`. The retired CC BY-SA 3D anatomy model is **not present** on any of the five branches in this clone; `docs/EXERCISE_DEMOS_2D.md` says it "stays in git history… and on its remote branches", which could not be checked because the clone is shallow |
| Evidence | Branch tree listings; `docs/EXERCISE_DEMOS_2D.md` |
| Business impact | Only if an old branch is deployed or the full repository is made public, at which point the CC BY-SA attribution and share-alike terms for the anatomy model would matter |
| Recommended action | Keep the repository private. Check the full remote history for `public/anatomy/` before any open-sourcing or due-diligence disclosure |
| Counsel must decide | **N** |
| Blocks public launch | **N** |
| Can technical testing resolve it | **Yes** — a full (non-shallow) clone and a path search |

### F-10 — Contents of the public `exercise-media` storage bucket were not examined

| | |
| --- | --- |
| Severity | **Unknown** (gap in the audit) |
| Confirmed or suspected | **Confirmed** that the bucket exists by design (`docs/DATA.md` line 23) and is public; contents unknown |
| Evidence | `docs/DATA.md`; `scripts/import-exercise-videos.ts` exists |
| Business impact | Anything uploaded there is published to members outside the repository's review trail |
| Recommended action | List the bucket's contents in each environment and add them to this ledger |
| Counsel must decide | **N** until contents are known |
| Blocks public launch | **Counsel**, if the bucket is not empty |
| Can technical testing resolve it | **Yes** — listing the bucket |

---

## 7. Launch view, in one table

| Asset group | Shipped? | Rights position on the repository evidence |
| --- | --- | --- |
| Badge images (A1, A3) | Yes | **Undocumented.** Counsel decision needed |
| Curl clip derivatives (A4) | Served but hidden | **Undocumented.** Counsel decision needed |
| App icon, illustrations, opening gate, splash, 2D athlete, vector badges | Yes | Made in the repo by code committed by an AI assistant; no third-party source detected. Subject to F-04 and, for the athlete look, F-03 |
| Fonts | Yes | SIL OFL 1.1, verified in the files; add attribution |
| Bible text | Yes | Stated public domain; source and hash recorded |
| Sounds, photographs, stock media, marketing graphics | None exist | Nothing to clear yet; process needed before they are added |

No asset was removed, moved or changed in preparing this ledger.
