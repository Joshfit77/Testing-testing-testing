# Can the app use the Écorché model? (licence check)

Status: research for the owner, **not legal advice and not legal clearance**. Have the terms reviewed before release.

## Short answer

**Yes, with conditions.** Nothing in the model's licences forbids commercial use (a paid app with subscriptions is
fine). The conditions:
- credit the sources;
- say what was changed;
- share the changed model files under the same licence (CC BY-SA 4.0);
- add no terms or copy protection that stop people using the model under that licence.

The app's own code and content do not have to be opened up.

## What the licences are (checked from the source files)

- **Écorché** (github.com/Charleeh/ecorche, commit `320805e`, the file used here, byte for byte): its LICENSE.md puts the
  3D model under **CC BY-SA 4.0** and its code under MIT. It asks: "credit those sources and this project, and share
  modified meshes under CC BY-SA 4.0." There is no non-commercial clause and no extra terms. The GLB carries the same
  notice in its own metadata.
- **Its sources** (from its ATTRIBUTION.md):
  - BodyParts3D, © The Database Center for Life Science, **CC BY 4.0**. Older copies were CC BY-SA 2.1 Japan. DBCLS's own
    licence page could not be opened from this environment; search results show the current CC BY 4.0 notice, dated
    2025-02-27.
  - Z-Anatomy by Gauthier Kervyn, **CC BY-SA 4.0**. Z-Anatomy has a few non-commercial parts (inner ear, kidney); the
    structures Écorché lists from it are not among them.
- These licences fit together: CC BY 4.0 and CC BY-SA 2.1 JP material may be shared on under CC BY-SA 4.0.

## What CC BY-SA 4.0 requires of the app

1. **Credit** (section 3(a)): the creators, the licence with a link, the no-warranty notice, a link to the model, and a
   note of what was modified, keeping the earlier changes. A "Credits" link on the exercise screen is enough (3(a)(2)).
   The preview page's credit already says all of this; **the app's own notices page (`src/app/legal/notices`) does not
   include it yet**.
2. **ShareAlike** (section 3(b)) applies to the *changed* model files, not to the app:
   - `ecorche-skin.*` (rigging);
   - `ecorche-face.*` (the added face);
   - `athlete-raw.*` (rigged copy).

   These are marked CC BY-SA 4.0 in `public/anatomy/LICENSE.md`. Before release they should also be available to
   download, without copy protection, at a public link given in the credit.
3. **No extra restrictions** (sections 2(a)(5)(C), 3(b)(3)): the app's terms must not forbid what the licence allows for
   the model. The draft Terms of Service forbid copying, reverse-engineering and commercial use of "the Service" and
   its content, and give users a non-commercial licence. **Before release, add Écorché to the "Third-party materials"
   list with a sentence that nothing in the terms limits rights under CC BY-SA 4.0** (same in any custom EULA).
4. **Anyone may take the model**: anyone, competitors included, may extract the model and the changed files from the
   app and reuse them under CC BY-SA 4.0. The app's code, motion data and other content stay yours.
5. **No trademark or patent rights** come with the licence, and the app must not suggest that the model's authors
   endorse it.

## Open risks

- **App Store copy protection**:
  - CC BY-SA 4.0 forbids copy protection that restricts the licence, and Apple wraps App Store apps in FairPlay.
  - Two things reduce the risk: the app loads its content from the website over HTTPS rather than inside the protected
    app package, and a copy-protection-free download of the files is offered.
  - This conflict has not been tested anywhere; it is the main item to put to a lawyer.
- **Not yet verified**:
  - Creative Commons' FAQ and Apple's standard EULA could not be opened from this environment.
  - BodyParts3D's current CC BY 4.0 grant was confirmed only through search results and Écorché's own notes.
- **Young upstream**: the Écorché repository has a single commit, so its account of where the meshes came from rests on
  its author.

## Before release (checklist)

- [ ] Credit (as on the preview page) in the app's notices page and on the exercise screen.
- [ ] Publish `ecorche-skin.*`, `ecorche-face.*` (and `athlete-raw.*` if shipped) at a public link, CC BY-SA 4.0, and
      link it in the credit.
- [ ] Add the CC BY-SA carve-out to the Terms of Service (and any custom EULA).
- [ ] Legal review of the App Store copy-protection question.
