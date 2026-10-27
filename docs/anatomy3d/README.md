# 3D anatomical athlete (work in progress)

Status: **not approved, not final.** A 3D anatomical athlete for the exercise demonstrations, checked on one exercise so
far (the barbell back squat). The existing 2D demonstrations are unchanged and remain what the app uses; nothing here is
wired into the app's pages yet.

**The character is the raw Écorché model** (github.com/Charleeh/ecorche), unaltered: red muscle, white tendons, ivory
bone, its own head, nothing covered. It is rigged for the exercises: `public/anatomy/athlete-raw.*`. See
[ECORCHE_RAW.md](ECORCHE_RAW.md) for what is kept, what is added, the renders, the known limits and the CC BY-SA 4.0
obligations.

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
