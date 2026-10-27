# Evaluation: Écorché as the anatomy source for the athlete

Status: **adopted for the torso and back** (approved by the owner after the comparison below). The shipped athlete
(`public/anatomy/athlete.*`) now takes the chest, abdomen and back muscles from Écorché and everything else from
BodyParts3D (see section 7). The full Écorché build used for the evaluation can still be made as a separate file
(`public/anatomy/athlete-eco.*`, not committed).

## 1. What the asset is

Écorché (github.com/Charleeh/ecorche, commit 320805e), cloned into a separate workspace:

- 634 named meshes: 198 bones, 159 deep and 203 superficial muscles, cartilage, teeth and eyes; 985k triangles.
- **No skin, no rig, no poses.** The head is facial muscles (lidless eyes, teeth), not a face.
- Source data: **the same BodyParts3D subject we already use** (version 4.0), plus Z-Anatomy for the latissimus dorsi,
  rectus abdominis, internal oblique, transversus abdominis, back muscles and the face muscles.

(The Innerscene rigged base mesh could not be inspected: the environment's network policy blocks `innerscene.com`.)

## 2. Is it a genuine improvement? Partly.

**Muscle detail.** Not higher overall: many muscles have fewer triangles than ours (gluteus maximus 1,094; deltoid parts
584-984). Most of its triangles are the skeleton (255k), the rebuilt external obliques (47.6k each) and the Z-Anatomy
rectus abdominis (16k each).

**Mesh quality.** Yes, in specific places:

- the external oblique and serratus anterior are single smooth surfaces (in raw BodyParts3D they are overlapping fibre
  bundles, a direct cause of the blotchy, "feathered" flanks on our athlete);
- the Z-Anatomy rectus abdominis gives a crisper six-pack, and the lats and lower back read more clearly;
- crossings between the two datasets are fixed, and left and right are exact mirrors.

**Body proportions.** No change: it is the same average-build subject. The athletic proportions come from our own
morph in both builds.

## 3. Integration test

`ECORCHE=<path to ecorche.glb> npx tsx scripts/anatomy/build-athlete.mts …` takes every muscle, tendon and bone from
Écorché, welded and fitted onto our BodyParts3D skeleton by rotation, scale and offset (Horn's method: 87 matching bones,
**1.16 cm average residual**, 0.48° rotation; the remaining misfit is genuine shape difference between BodyParts3D
4.0 and 3.0). Everything else is the same pipeline: the skeleton gives the joints (identical rig), the skin gives the
hands, feet, fascia and shorts, the MakeHuman face, athletic proportions, fitted shorts, skin weights, gold material and
per-muscle glow (the muscle names match, so the glow works unchanged). Écorché's own tendon tint replaces our heuristic,
and its white aponeurosis over the six-pack is left out so the abs can show and glow.

Problems found and fixed during the test (the fixes apply to both builds):

| Problem | Cause | Fix |
|---|---|---|
| Long sliver from armpit to hip in the squat | Z-Anatomy latissimus runs into the armpit; its arm-to-torso weight change was a narrow band | Weights spread over the whole latissimus so it stretches evenly |
| Fragments on the front of the shorts | Fascia over the groin kept the scanned skin's shape in front of the fabric; folded fabric showed as see-through holes | All fascia inside the shorts band removed; the fabric is drawn two-sided |
| Pieces of abdominal muscle poking through | The 1.2 cm misfit put them just outside the fabric | Anatomy less than 1.5 cm outside the fabric inside the band counts as covered (never the forearms) |

Verified by casting rays from the front over the groin: in the current build the only non-fabric first hits are now the
legitimate dark gap between the thighs below the hem and the inner-thigh muscles.

### Results (same renderer and cameras: current | Écorché-based | raw Écorché)

| | |
|---|---|
| ![](renders/ecorche-eval/01-front.jpg) | ![](renders/ecorche-eval/02-rear.jpg) |
| ![](renders/ecorche-eval/03-side.jpg) | ![](renders/ecorche-eval/05-torso.jpg) |
| ![](renders/ecorche-eval/06-pelvis-front.jpg) | ![](renders/ecorche-eval/09-squat-bottom.jpg) |

Animated squat rep, both builds side by side: `renders/ecorche-eval/squat-rep.gif`. Also: face, squat bottom from the
front and rear, glow off and on.

**Better** in the Écorché-based build: abs, flanks, lats and lower back; hamstrings and calves.
**Worse:** a few more remnants at the waistband edge than the current build; 60% heavier (~654k triangles, 16.7 MB vs
~410k, 10.5 MB).
**Unchanged** (neither source fixes it): the face (MakeHuman in both), the jagged edge where the waistband and hems meet
the muscles, deformation in deep flexion (linear blend skinning without corrective shapes), and the overall gap to
the painted look of the reference.

## 4. Verdict

Écorché is a **real but targeted** improvement in the muscles the app highlights most (abs, obliques, lats), and its
integration now animates as cleanly as the current build. It is not a different class of model and will not by itself
reach the reference. Recommendation (adopted): use it for the torso and back once the waistband edge is cleaned up, and
budget for the extra weight on phones.

## 5. Player controls (both builds)

Checked in Chromium by `scripts/anatomy/preview/controls-test.mjs`: play/pause, 360° drag rotation, mouse-wheel zoom,
**two-finger pinch zoom (new)**, front/side/rear presets, slow motion (0.35×) and full speed. All pass. Not tested on a
physical phone.

## 6. Licensing (CC BY-SA 4.0, checked against the licence text in the repository; not legal advice)

- **Commercial use is allowed.**
- **Attribution (Section 3(a)):** keep the creator credit and notices, say that the material was modified, and include the
  licence or its URL. Écorché's suggested credit: "Écorché (github.com/Charleeh/ecorche), CC BY-SA 4.0. Based on
  BodyParts3D, © The Database Center for Life Science, CC BY 4.0, and Z-Anatomy by Gauthier Kervyn, CC BY-SA 4.0." This
  belongs in the app's credits/licences screen and in `public/anatomy/LICENSE.md`.
- **ShareAlike (Section 3(b)):** our athlete mesh built from it is Adapted Material and must be licensed CC BY-SA 4.0
  (or a compatible licence). This covers the mesh data, not the app's code.
- **No downstream restrictions (Sections 2(a)(5)(C) and 3(b)(3)):** we may not apply "Effective Technological
  Measures" that restrict recipients' rights to the mesh. Whether App Store / Play distribution counts as such a
  measure is an open question for counsel before release.
- The current asset already carries a similar share-alike obligation (BodyParts3D 3.0 data, CC BY-SA 2.1 JP). Écorché
  notes BodyParts3D is now published under CC BY 4.0: a rebuild from the current BodyParts3D release *without* the
  Z-Anatomy pieces would need attribution only.
- MakeHuman (head): CC0. CC0 content combines freely with CC BY-SA.

## 7. Adoption: Écorché torso and back (hybrid build)

`ECORCHE=<path to ecorche.glb> ECORCHE_USE=torso npx tsx scripts/anatomy/build-athlete.mts …` builds the shipped
athlete: 42 Écorché muscles (pectorals, rectus abdominis, external obliques, serratus anterior, latissimus dorsi,
trapezius, rhomboids, erector spinae) replace their BodyParts3D counterparts; limbs, neck, skeleton (and so the rig),
hands, feet and the MakeHuman head are unchanged.

Close-up review of that build found three defects, two of them present in the earlier build as well, now fixed:

| Problem | Cause | Fix |
|---|---|---|
| Crumpled fabric over the groin (both builds) | The shorts were cut from the scanned skin, which includes the genitals; flattening it front-to-back left folded-over fabric | The shorts are now a smooth closed envelope 5 mm over the hip and thigh muscles and bones (voxel field, morphological closing, surface nets), bridging creases; nothing of the skin is used |
| Bright shards between the abdominal muscles and at the waistband (both builds; worse with Écorché) | The fascia sheet was the scanned skin pushed in along its normals; neighbouring points sank to different depths and the sheet folded over itself between the muscles. The skin mesh also has internal layers in the abdomen | The fascia is now the same kind of envelope, 1 cm under the muscle surface, bridging gaps under 2.5 cm; a disc closes the bottom of the (organ-less) pelvis so it cannot leak into the trunk |
| Knee-to-knee sheet in the squat descent (both builds) | The inner thighs nearly touch, so the shorts bridged them down to the hem; the knees stretched that panel apart | Separate leg tubes below a 5 cm crotch gusset |

The darker gold (`#8c6124`, was `#ad7a30`) keeps the approved brightness: the old folded fascia had darkened the
muscles' baked occlusion (mean 0.09, now 0.17), so the same base colour now rendered about 20% lighter.

Verified: front rays over the groin hit only the shorts and the inner-thigh muscles below the hem; front rays over the
abdomen hit muscle 92% of the time, the rest being the dark groove of the linea alba and tendons; controls test passes.

Size: ~493k triangles, 15.4 MB (was ~410k, 10.5 MB); the mobile index buffer is ~221k triangles. Not measured on a
phone.

Still visible: a narrow dark gap between the shorts' legs in front views (the legs are separate below the gusset);
the aponeurotic parts of Écorché's obliques and the thoracolumbar fascia read as pale gold (anatomically right, but
lighter than the painted reference); a small flap at the knees in deep flexion (from the BodyParts3D leg muscles, not
fixed); the face, neck base and deep-flexion pinching listed in the README.
