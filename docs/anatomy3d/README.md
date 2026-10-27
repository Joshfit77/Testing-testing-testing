# 3D anatomical athlete (work in progress)

Status: **not approved, not final.** A 3D anatomical athlete for the exercise demonstrations, checked on one exercise so
far (the barbell back squat). The existing 2D demonstrations are unchanged and remain what the app uses; nothing here is
wired into the app's pages yet.

## Milestone 1: the original model in the player

The exercise player opens on the **original Écorché model file**, `public/anatomy/ecorche.glb`, byte-identical to the
published `model/ecorche.glb` (sha256 `9744d3df…326c`, checked by the page before it shows the model). It is loaded as
it is, with its own meshes, vertex colours and materials: nothing is rebuilt, rigged, recoloured or covered. The one
addition, at the owner's request: the published eyes are blank white, so the viewer paints a brown iris and a pupil onto
each cornea in the shader (`paintEyes`); the file and its geometry are unchanged. The model
stands still; one finger turns it a full 360°, a pinch zooms, two fingers move along the body, and front, side and rear
buttons reset the view.

## Milestone 2 (current, awaiting approval): the original model performs the barbell back squat

The same file now moves. Each of its 634 meshes becomes a skinned mesh with its own geometry and material, bound to the
exercise rig with skin weights transferred from the rigged copy of the same model (`public/anatomy/ecorche-skin.*`, built
by `scripts/anatomy/build-ecorche-skin.mts`: an affine fit of the file onto the copy, median match 1 µm, 34 of 486,005
vertices more than 3 mm away). The motion and the barbell come from the app's exercise engine; the fingers close round
the bar. The page has play/pause, a scrubber and speeds. The camera follows the hips at full view and, zoomed in, the
part of the body in view, so a close-up of the face stays on the face through the rep. No muscle glow yet.

- Video (simulated phone, headless Chromium with software WebGL; not a physical device):
  `renders/raw-ecorche/squat-phone.mp4`.

- Viewer: `src/lib/anatomy3d/model-viewer.ts` (`mountModel`). Lighting: the studio of the reference renders (ACES tone
  mapping, room environment at 0.6, warm key light, white rim light).
- Page: `scripts/anatomy/preview/` (`bash scripts/anatomy/preview/build.sh`, open `.anatomy-preview/index.html`).
  The exercise player with the rigged athlete is still there for later milestones (`?ex=back-squat`).
- Test: `scripts/anatomy/preview/model-controls-test.mjs` (phone-sized touch screen, real touch input).

## Later milestones

Muscle highlighting, the other exercises and any coverage come only after the owner approves the squat. An experimental rigged copy of the same model already exists for that work
(`public/anatomy/athlete-raw.*`, shown only with `?ex=…`); [ECORCHE_RAW.md](ECORCHE_RAW.md) describes it and the
CC BY-SA 4.0 obligations.

The earlier gold athlete (BodyParts3D, Écorché torso, MakeHuman head, gold material) was dropped at the owner's
request: its asset and renders are removed. The builder still has its code paths (`ECORCHE_USE=torso|all`), and the
files are in the git history if they are ever wanted.

## Where things are

| Concern | Where |
|---|---|
| Which anatomy parts are used, and each part's glow region and kind (muscle / bone / tendon) | `scripts/anatomy/bp3d-regions.ts` |
| Building the athlete from the Écorché file (`ECORCHE_USE=raw`): fit to the app frame, joints, muscle labels, limbs | `scripts/anatomy/build-athlete.mts` |
| **Skin weights** (rigging, hip bones following the glutes) and baked ambient occlusion | `scripts/anatomy/weights.ts`, `scripts/anatomy/reweight.mts` |
| Joint centres measured from the skeleton (generated) | `src/lib/anatomy3d/athlete-bind.generated.ts`, `bind.ts` |
| Loading the mesh, the skeleton | `src/lib/anatomy3d/mesh.ts` |
| **Rig**: 2D motion frame → 3D joints (IK for elbows/knees), bone posing and stretching | `src/lib/anatomy3d/rig.ts` |
| Hand grip (finger curl morph) | `src/lib/anatomy3d/grip.ts` |
| **Material / glow**: the Écorché look (its own vertex colours, red muscle, white tendons, ivory bone), per-muscle orange glow | `src/lib/anatomy3d/material.ts` (`makeEcorcheMaterial`) |
| Which muscles glow per exercise (all catalogue exercises) | `src/lib/anatomy3d/muscle-map.ts` (+ `tests/unit/anatomy-muscle-map.test.ts`) |
| Glow timing through each rep (effort curve) | `src/lib/anatomy3d/effort.ts` |
| Scene, lights, bloom, backdrop | `src/lib/anatomy3d/scene.ts` (`ecorcheStage`) |
| Equipment (barbell with NGF plates, rack, benches, machines, cables…) | `src/lib/anatomy3d/equipment.ts` |
| Player: playback, speed, cameras, glow toggle, stills | `src/lib/anatomy3d/player.ts` |
| Stand-alone squat preview page (reference layout) and review renders | `scripts/anatomy/preview/` |

## Rebuild

Needs the Écorché file and the BodyParts3D STL folder (~0.5 GB, used for the joint measurement); neither is checked in.

```bash
git clone https://github.com/Charleeh/ecorche /tmp/ecorche                                        # model/ecorche.glb
git clone --filter=blob:none https://github.com/Kevin-Mattheus-Moerman/BodyParts3D /tmp/bp3d    # then check out the STLs used
ECORCHE=/tmp/ecorche/model/ecorche.glb ECORCHE_USE=raw \
  npx tsx scripts/anatomy/build-athlete.mts /tmp/bp3d/assets/BodyParts3D_data
ATHLETE=public/anatomy/athlete-raw npx tsx scripts/anatomy/reweight.mts   # skin weights + ambient occlusion
bash scripts/anatomy/preview/build.sh                                      # .anatomy-preview/index.html
```

Player controls (play/pause, 360° drag, wheel and pinch zoom, camera presets, slow motion) are checked by
`scripts/anatomy/preview/controls-test.mjs`.
