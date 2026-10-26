# Gold anatomical athlete (work in progress)

Status: **not approved, not final.** A code-generated 3D anatomical athlete for the exercise demonstrations, built as a
technical checkpoint (one exercise, the barbell back squat). The existing 2D demonstrations are unchanged and remain
what the app uses; nothing here is wired into the app's pages yet.

Renders below are from the actual model (headless Chromium, WebGL via SwiftShader), not concept art.

| | |
|---|---|
| ![front](renders/athlete-front.png) | ![rear](renders/athlete-rear.png) |
| ![face](renders/athlete-face.png) | ![face, profile](renders/athlete-face-profile.png) |
| ![quadriceps glowing](renders/athlete-quads.png) | ![hamstrings](renders/athlete-hamstrings.png) |
| ![squat, bottom, glow](renders/athlete-squat-bottom-glow.jpg) | ![squat, side](renders/athlete-squat-side.jpg) |

## How the character is made

The mesh is built offline from **BodyParts3D** (open anatomical data from medical imaging, CC BY-SA 2.1 JP, see
`public/anatomy/LICENSE.md`); the **head, face, ears, neck and eyes** come from the **MakeHuman** base mesh and shape
targets (CC0) — and saved as `public/anatomy/athlete.bin` + `athlete.json` (~440k triangles, 11.6 MB).

| Concern | Where |
|---|---|
| **Head / face**: MakeHuman base mesh + face recipe (targets and weights), cut below the neck, Catmull-Clark smoothing, fitted by eyes and chin-to-crown height | `scripts/anatomy/makehuman-head.ts` (`FACE_RECIPE`) |
| Which anatomy parts are used, and each part's glow region and kind (muscle / bone / tendon) | `scripts/anatomy/bp3d-regions.ts` |
| Building the athlete: loading, simplification, joint measurement, muscles, bones, tendons, eyes, face/hands/feet skin, fascia layer, pelvic cover, **shorts**, **athletic proportions** (upper-body morph, crown), **hair mask**, six-pack carving | `scripts/anatomy/build-athlete.mts` |
| **Skin weights** (rigging) and baked ambient occlusion | `scripts/anatomy/weights.ts`, `scripts/anatomy/reweight.mts` |
| Joint centres measured from the skeleton (generated) | `src/lib/anatomy3d/athlete-bind.generated.ts`, `bind.ts` |
| Loading the mesh, the skeleton | `src/lib/anatomy3d/mesh.ts` |
| **Rig**: 2D motion frame → 3D joints (IK for elbows/knees), bone posing and stretching | `src/lib/anatomy3d/rig.ts` |
| Hand grip (finger curl morph) | `src/lib/anatomy3d/grip.ts` |
| **Material / glow shader**: satin gold, fibre bump, tendon ends, bone, eyes, hair, shorts, fascia, per-muscle emissive glow, AO | `src/lib/anatomy3d/material.ts` |
| Which muscles glow per exercise (all catalogue exercises) | `src/lib/anatomy3d/muscle-map.ts` (+ `tests/unit/anatomy-muscle-map.test.ts`) |
| Glow timing through each rep (effort curve) | `src/lib/anatomy3d/effort.ts` |
| Scene, lights, bloom, backdrop | `src/lib/anatomy3d/scene.ts` |
| Equipment (barbell with NGF plates, rack, benches, machines, cables…) | `src/lib/anatomy3d/equipment.ts` |
| Player: playback, speed, cameras, glow toggle, stills | `src/lib/anatomy3d/player.ts` |
| Stand-alone squat preview page (reference layout) and review renders | `scripts/anatomy/preview/` |

Rebuild (needs the BodyParts3D STL folder, ~0.5 GB, not checked in):

```bash
git clone --filter=blob:none https://github.com/Kevin-Mattheus-Moerman/BodyParts3D /tmp/bp3d   # then check out the STLs used
git clone --filter=blob:none https://github.com/makehumancommunity/makehuman /tmp/mh            # then check out base.obj + the targets in FACE_RECIPE
npx tsx scripts/anatomy/build-athlete.mts /tmp/bp3d/assets/BodyParts3D_data /tmp/mh/makehuman/data
npx tsx scripts/anatomy/reweight.mts          # skin weights + ambient occlusion (seconds)
bash scripts/anatomy/preview/build.sh          # .anatomy-preview/index.html
```

## Known problems (honest list)

- **Face**: replaced with a MakeHuman head shaped by targets (stronger jaw, chin and cheekbones, heavier brow, real
  ears, thicker neck) plus a procedural buzz cut. It is a generic, untextured face: no skin pores, eyelashes or
  eyebrows, and the eyes are simple shaded spheres. The neck is smooth skin from the jaw to the collarbones (the
  sternocleidomastoids still show through at the front).
- **Muscle definition**: the muscles come from an average (non-athletic) subject; the "athletic" shape is a smooth
  upper-body morph plus small per-muscle thickening. Pectorals/abs/obliques are less defined than in the reference.
- **Thin strands** appear between the hands and the hips/thighs in some poses (forearm-tendon/skin weighting).
- **Shorts** are fitted from the skin surface; their hems are single-sided, and the groin area still needs polish.
- **Rendering**: single-sided faces are required (double-sided let the fascia layer show over the muscles).
- **Size/performance**: 11.6 MB, ~440k triangles: too heavy for phones as-is (needs quantisation, LOD, compression).
- Only the squat has been checked visually; the other exercises and the 143 planned new exercises are not done.
