# Evaluation: Écorché and Innerscene as sources for the anatomical athlete

Status: **evaluation only.** Nothing in the app or in `public/anatomy/athlete.*` was replaced. The Écorché-based build is
a separate file (`public/anatomy/athlete-eco.*`, not committed) made with the same pipeline.

## 1. What the assets are

| | Écorché (github.com/Charleeh/ecorche, commit 320805e) | Innerscene "Male Base Mesh, rigged, A-pose" |
|---|---|---|
| Downloaded | Yes, cloned into a separate workspace | **No.** The environment's network policy blocks `innerscene.com` (HTTP 403 at the proxy). Not inspected; nothing stands in for it. |
| Content | 634 named meshes: 198 bones, 159 deep and 203 superficial muscles, cartilage, teeth, eyes. 985k triangles. No skin, no rig, no poses. | (per the listing) a rigged base human mesh |
| Source data | **The same BodyParts3D subject we already use** (v4.0 OBJ), plus Z-Anatomy for latissimus dorsi, rectus abdominis, internal oblique, transversus abdominis, back muscles and face muscles | n/a |
| Licence (as published) | Model: **CC BY-SA 4.0**. Code: MIT. | CC0 according to you; not verified |

## 2. Is Écorché better than our geometry? Partly.

It is **not** higher-detail overall. Per muscle it is often lighter than ours (gluteus maximus 1,094 triangles, deltoid
parts 584-984); most of its triangle count is the skeleton (255k), the rebuilt external obliques (47.6k each) and the
Z-Anatomy rectus abdominis (16k each).

What it does better, and why it matters for us:

- **Clean layering.** Where the two source datasets cross, it fixes the order (trapezius over lats, lats over erector
  spinae, oblique sheath over rectus), and resolves hairline overlaps. Our raw BodyParts3D meshes cross in places,
  which shows as torn or flickering patches.
- **The external oblique and serratus anterior are rebuilt as single smooth surfaces.** In raw BodyParts3D they are
  overlapping fibre bundles; that is a direct cause of the "feathered", blotchy flanks on our athlete.
- **A better six-pack** (Z-Anatomy rectus abdominis) and cleaner lats and lower back.
- **Exact left/right symmetry**, outward-facing surfaces, and a tendon/aponeurosis tint per vertex.

What it does not solve: it is the same average-build subject, has no skin, no face (the head is facial muscles with
lidless eyes and teeth), and no rig.

## 3. Integration test

`ECORCHE=<path to ecorche.glb> npx tsx scripts/anatomy/build-athlete.mts …` takes every muscle, tendon and bone from
Écorché instead of BodyParts3D 3.0, and keeps everything else of the pipeline: the BodyParts3D skeleton for the joints
(so the rig is identical), the skin for hands, feet, fascia and shorts, the MakeHuman face, the athletic proportions,
the fitted shorts, the skin weights and the gold material with per-muscle glow. Écorché's own tendon tint replaces our
heuristic, and its white aponeurosis over the six-pack is left out so the abs can show and glow.

- Fit: scale 1.074 and offset onto 87 matching bones, **average residual 1.2 cm** (BodyParts3D 4.0 vs 3.0 differ
  slightly; no rotation is fitted yet).
- Size: 678k triangles, 17.3 MB (current: 427k, 11.2 MB). Mobile index buffer: 305k triangles.
- Glow labels: the muscle names match ours, so the per-muscle glow works unchanged.

### Results (same renderer, same cameras: current | Écorché-based | raw Écorché)

| | |
|---|---|
| ![](renders/ecorche-eval/05-torso.jpg) | ![](renders/ecorche-eval/02-rear.jpg) |
| ![](renders/ecorche-eval/06-pelvis-front.jpg) | ![](renders/ecorche-eval/09-squat-bottom.jpg) |

Also in `renders/ecorche-eval/`: front, side, face, squat bottom from the front and rear.

**Better** in the Écorché-based build: abdominal definition, cleaner obliques and flanks, a more legible back (lats,
thoracolumbar region), hamstrings and calves.

**Worse / new defects** (integration problems, not the asset's):

- thin spikes from the shoulders and flanks in the squat (some Écorché vertices get the wrong skin weights);
- loose shards over the front of the shorts and at the waist (pieces of the lower abdominal wall that the "covered by
  the shorts" test misses because of the 1.2 cm misfit);
- 60% heavier.

**Unchanged** (neither source fixes it): the face (MakeHuman in both), overall polish and the painted look of your
reference, and deformation quality in deep flexion (linear blend skinning without corrective shapes).

## 4. Verdict

Écorché is a **real but targeted** improvement in torso and back muscle quality, and it is the better source for the
muscles we highlight most (abs, obliques, lats). It is not a different class of model: it will not by itself make the
athlete look like your reference. Worth adopting **if** the spikes and shards are fixed (rotation fit, weight fix for the
Z-Anatomy pieces, removal test against the shorts). Not ready to replace the current asset today.

## 5. Licensing notes (not legal advice; please have counsel confirm before release)

- **Écorché, CC BY-SA 4.0.** Commercial use is allowed. Required: attribution (their suggested credit line, e.g. in the
  app's credits/licences screen and in `public/anatomy/LICENSE.md`), a link to the licence, and an indication of
  changes. **Share-alike:** our athlete mesh built from it is an adaptation and must itself be offered under
  CC BY-SA 4.0. That covers the mesh data, not the app's source code. The licence also forbids applying
  "effective technological measures" that restrict the licensed rights; whether App Store/Play distribution (FairPlay
  and similar) counts as that is a known open question to put to counsel.
- **Current asset**: BodyParts3D 3.0 data is under CC BY-SA 2.1 JP, so the mesh in PR #8 already carries a share-alike
  obligation of the same kind. (Écorché notes that BodyParts3D is now published under CC BY 4.0; a rebuild from the
  current BodyParts3D release *without* the Z-Anatomy pieces would need attribution only, no share-alike.)
- **MakeHuman** head: CC0. **Innerscene**: CC0 per you, but not verified, because the site is not reachable from here.
  CC0 and CC BY-SA content can be combined; the combined mesh would then be offered under CC BY-SA 4.0.
