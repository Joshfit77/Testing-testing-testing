# Licence of the 3D anatomical model

`ecorche.glb` is the Écorché model file itself, unmodified (byte-identical to `model/ecorche.glb` at commit 320805e
of github.com/Charleeh/ecorche, sha256 `9744d3dffced835961104447d23a781ad469588289ce322d84d000e0d498326c`):

> Écorché (github.com/Charleeh/ecorche), CC BY-SA 4.0. Based on BodyParts3D, © The Database Center for Life Science,
> CC BY 4.0, and Z-Anatomy by Gauthier Kervyn, CC BY-SA 4.0.
> https://creativecommons.org/licenses/by-sa/4.0/

It is redistributed as published under **CC BY-SA 4.0**, as is, without warranties. Its own attribution file lists the
sources and the changes its author made to them.

`athlete-raw.bin` / `athlete-raw.json` (the raw Écorché athlete, the only character) are adapted from **Écorché**:

> Écorché (github.com/Charleeh/ecorche), CC BY-SA 4.0. Based on BodyParts3D, © The Database Center for Life Science,
> CC BY 4.0, and Z-Anatomy by Gauthier Kervyn, CC BY-SA 4.0.
> https://creativecommons.org/licenses/by-sa/4.0/

Modified: scaled and placed in the app's frame, rigged (skin weights and joints), and muscle labels added. The geometry,
proportions and colours of every part are as published (nothing added, covered or removed).
This adapted mesh is shared under **CC BY-SA 4.0**. It is provided as is, without warranties. See
`docs/anatomy3d/ECORCHE_RAW.md` for the obligations this places on distribution.

`ecorche-skin.bin` / `ecorche-skin.json` (skin weights and joints that rig `ecorche.glb`, per vertex of the file) and
`ecorche-face.bin` / `ecorche-face.json` (the filled-in face: red layers shaped from the face's bones and cartilages,
lifted to the level of the muscles, coloured from the nearest muscle; the viewer also hides the teeth) are adapted from
**Écorché** (credit as above). Built by `scripts/anatomy/build-ecorche-skin.mts` and
`scripts/anatomy/build-ecorche-face.mts`. They are shared under **CC BY-SA 4.0**, as is, without warranties.

What the app shows is the model as modified: rigged and animated, iris and pupil painted on the eyes, face filled in.
The credit on the exercise screen says so and links the licence.

This is a summary for the project, not legal advice; please have the licence terms reviewed before release.
