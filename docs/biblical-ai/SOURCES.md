# Biblical AI: sources, licensing and approval

The database holds the inventory itself (`biblical_ai_sources`, migration 100). Administrators see it at Admin →
Biblical AI. Only **approved** sources are ever used. Approving a teacher's material needs a founder
(`FOUNDER_USER_IDS`), and every status change is audited (`biblical_ai_source_audit`).

**The teachers are internal knowledge sources** (founder clarification, 2026-11-28). Members never see a teacher
directory, profiles, photographs, biographies, selection menus or teacher-specific modes. Nothing suggests that any
teacher endorses or is affiliated with Narrow Gate Fitness. Approved material is retrieved on the server as
`<knowledge>`, and the one Biblical AI assistant synthesises it with Scripture in its own words. Scripture is the
final authority above every human teacher.

- **Where the list lives:** `src/lib/biblical-ai/teachers.ts`, which is server-only. Members have no access to the
  database inventory.
- **What the checks enforce:** a sentence naming a teacher is removed unless the member's own question asks about that
  teacher and a provided document by them was used. Quotations that aren't Scripture are removed.
- **Credits:** where a source's licence requires a credit (`attribution_required`), its `attribution` text is shown
  with answers that used it; otherwise nothing about the source is shown. A source that requires a credit can't be
  approved until the text is recorded.
- **Guard test:** `tests/unit/biblical-ai-teachers-internal.test.ts` fails if any other source file names a teacher,
  or if browser code imports the list.

## Data in use (approved)

| Source | What | Licence | Commercial use | Attribution shown | Where |
|---|---|---|---|---|---|
| Berean Standard Bible | The only English Scripture text: reader, quotations, validation | Public domain (dedicated by the publisher) | Yes | "Scripture quotations are from the Berean Standard Bible (BSB), public domain." | `public/bible/bsb`; integrity: `tests/unit/bible-dataset.test.ts` (66 books, 1,189 chapters, 31,102 verse numbers, content SHA-256) |
| STEPBible TAHOT (Tyndale House) | Hebrew and Aramaic OT words, transliteration, glosses, morphology | CC BY 4.0 | Yes, with attribution | On the word-study page | `data/original-languages` (built by `scripts/build-original-languages.mjs`; input SHA-256s in `meta.json`) |
| STEPBible TAGNT | Greek NT words, editions, variants, morphology | CC BY 4.0 as declared by STEPBible ("Include any part of STEPBible-Data in any software or publications without requesting permission") | Yes, with attribution | As above | As above |
| STEPBible TBESH and TBESG | Brief lexicons (abridged BDB; Abbott-Smith and similar) | CC BY 4.0 | Yes, with attribution | As above | As above |
| STEPBible TEHMC and TEGMC | Morphology code explanations | CC BY 4.0 | Yes, with attribution | As above | As above |
| OpenBible.info cross references | Up to 12 cross references per verse, by votes | CC BY (the file's own header: "www.openbible.info CC-BY 2024-11-04") | Yes, with attribution | Credit in this file and the source inventory; **to do:** add to the app's third-party notices before launch | `data/cross-references` (from the scrollmapper/bible_databases mirror; SHA-256 in `meta.json`) |

**Legal check recommended.** TAGNT records, for each Greek word, which printed editions contain it, including
NA27/28. The NA text is copyrighted by the German Bible Society. STEPBible publishes TAGNT under CC BY 4.0, and
the app shows words and edition sigla, not the NA apparatus. The attorney should confirm this is acceptable for
commercial use.

**Changes made, as CC BY asks:**

- converted to JSON;
- main-text selection rules (recorded in `meta.json`);
- HTML stripped from lexicon entries;
- definitions shortened to 1,200 characters.

No word, gloss or definition was altered.

## The eleven approved teachers (internal): pending review, no content loaded

| Teacher | Ministry | Official site (as listed in the directive) | Status |
|---|---|---|---|
| John MacArthur | Grace to You | https://www.gty.org | Pending review |
| Ray Comfort | Living Waters | https://livingwaters.com | Pending review |
| John Piper | Desiring God | https://www.desiringgod.org | Pending review |
| Paul Washer | HeartCry Missionary Society | https://heartcrymissionary.com | Pending review |
| Tim Conway | I'll Be Honest | https://illbehonest.com | Pending review |
| Voddie Baucham | Not yet verified | — | Pending review; official site to be confirmed |
| Billy Graham | Billy Graham Evangelistic Association | https://billygraham.org | Pending review; author-level checks needed |
| Alistair Begg | Truth For Life | https://www.truthforlife.org | Pending review |
| Mark Spence | Living Waters | https://livingwaters.com | Pending review; author-level checks needed |
| Frank Turk | Not yet verified | — | Pending review; identity and Pyromaniacs authorship to verify |
| Jeff Durbin | Apologia Studios / Apologia Church | Not yet verified | Pending review |

Why none is approved:

- Publicly readable material is not automatically licensed for commercial AI storage, retrieval or reproduction.
- No ministry's permission was obtained or checked here. This session can't contact ministries or agree to terms.
- No website was scraped.

**What the software does meanwhile:**

- Biblical AI answers from Scripture.
- The model is told it may summarise a teacher only from a provided document.
- Software removes any sentence that attributes a view, quotation, sermon or book to an approved teacher without one.
- The model is told to say plainly that verified material from that teacher isn't available.

Tests: `tests/unit/biblical-ai-validation.test.ts` and `tests/integration/biblical-ai.test.ts`.

**To use a teacher's material:**

1. Obtain written permission, or confirm the terms that apply. The permission should cover commercial use, storage,
   retrieval and short summaries with attribution and a link.
2. Record the licence and the permissions on the source.
3. Have a founder approve it (Admin → Biblical AI).
4. Load documents into `biblical_ai_source_documents`. Each needs:
   - the actual author, verified per document (not per website);
   - title, URL, date and text, at most 6,000 characters per passage.

Answers then show the author, title, date and a link from the document itself; the model never supplies them. Each
summary also carries this statement: "A summary of the source, not the teacher's own words. No teacher or ministry
endorses or is affiliated with this app."

## Historical and archaeological sources

None is loaded. History answers label every claim with its kind of evidence:

- biblical account;
- ancient source;
- archaeological evidence;
- scholarly consensus;
- disputed among scholars;
- Christian tradition.

They also say where evidence is limited. A licensed historical reference (kind `history`) can be added the same way
as a teacher, with founder-approved policies.
