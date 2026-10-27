# Licence of the 3D athlete mesh

`athlete.bin` / `athlete.json` are derived from **BodyParts3D**:

> BodyParts3D, © The Database Center for Life Science, licensed under CC Attribution-Share Alike 2.1 Japan.
> https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html

Data obtained through the STL conversion at https://github.com/Kevin-Mattheus-Moerman/BodyParts3D (BodyParts3D 3.0).
Please also cite: Mitsuhashi N, et al. *BodyParts3D: 3D structure database for anatomical concepts.* Nucleic Acids
Res. 2009;37:D782-5. https://doi.org/10.1093/nar/gkn613

The muscles of the chest, abdomen and back (pectoralis major, rectus abdominis, external oblique, serratus anterior,
latissimus dorsi, trapezius, rhomboids, erector spinae) come from **Écorché**, modified (fitted to the BodyParts3D
skeleton, simplified, re-shaped, rigged):

> Écorché (github.com/Charleeh/ecorche), CC BY-SA 4.0. Based on BodyParts3D, © The Database Center for Life Science,
> CC BY 4.0, and Z-Anatomy by Gauthier Kervyn, CC BY-SA 4.0.
> https://creativecommons.org/licenses/by-sa/4.0/

The derived mesh (simplified, rigged, re-shaped, with added shorts and labels) is shared under **CC BY-SA 4.0**:
anyone receiving it may reuse and adapt it with attribution, and adaptations of the mesh must use the same licence.
Écorché's licence requires this (Section 3(b)), and CC BY-SA 2.1 JP lets adaptations of the BodyParts3D 3.0 data be
shared under a later version of the licence with the same elements. Under Section 2(a)(5)(C) of CC BY-SA 4.0 no
technological measure may restrict recipients' rights to the mesh. This applies to the mesh data, not to the app's
source code.

The head, face, ears, neck and eyes come from the **MakeHuman** base mesh and targets
(https://github.com/makehumancommunity/makehuman, `makehuman/data`), released as **CC0 1.0** (public domain) in
September 2020.

This is a summary for the project, not legal advice; please have the licence terms reviewed before release.

## athlete-raw.bin / athlete-raw.json (the raw Écorché athlete)

> Écorché (github.com/Charleeh/ecorche), CC BY-SA 4.0. Based on BodyParts3D, © The Database Center for Life Science,
> CC BY 4.0, and Z-Anatomy by Gauthier Kervyn, CC BY-SA 4.0.
> https://creativecommons.org/licenses/by-sa/4.0/

Modified: scaled and placed in the app's frame, rigged (skin weights and joints), muscle labels added, fitted shorts
added, and the anatomy under the shorts removed. The geometry, proportions and colours of every other part are as
published. This adapted mesh is shared under **CC BY-SA 4.0**. It is provided as is, without warranties. See
`docs/anatomy3d/ECORCHE_RAW.md` for the obligations this places on distribution.
