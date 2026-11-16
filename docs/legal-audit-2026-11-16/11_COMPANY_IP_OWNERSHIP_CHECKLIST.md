# 11. IP ownership checklist

Date: 2026-11-16 (revised the same day at the owner's direction). A checklist of facts to confirm and documents to
assemble. Not a legal opinion.

**Two points of principle, so nothing below is misread:**

1. **AI-authored commits do not mean the company lacks ownership.** The commit history shows an AI coding assistant as
   the author of record. That is a fact about tooling. Who owns the work turns on who directed it, under which account
   and terms, what human selection, arrangement and editing went into it, and what the tool provider's terms assign to
   the customer. Those are questions for counsel with the founder's records. Many providers' terms assign the output to
   the customer; the terms that applied on the dates of use are what matter. Nothing here concludes either way.
2. **An individual can hold all of this.** A company is not required to own code, a trademark application or an Apple
   developer account. Forming one is a business and liability decision to take with counsel, and it becomes practical
   to settle before investment.

## What the repository shows, and what it cannot show

| Fact | Evidence | What it does not show |
|---|---|---|
| The code is hosted in a personal GitHub account | Git remote `Joshfit77/Testing-testing-testing` | Who else has access |
| Every commit visible in this checkout (the checkout is shallow; history before 2026-11-13 was not examined) is authored as "Claude" | `git log` | The person who directed each change, which is not recorded in git |
| No `LICENSE` file; `package.json` is private and now marked `UNLICENSED` | Repository root | Ownership. It shows only that no licence is granted to others |
| App identifier `com.narrowgatefitness.app`; domains `narrowgatefitness.com` and `narrowgate.fit` appear in code and documents | `capacitor.config.ts:63`; grep | That the domains or identifier are registered to the founder |
| The Terms and Privacy drafts have no named party, address or contact | `docs/legal/*.md` | — |
| No assignment, contractor agreement, licence receipt or release is stored in the repository | Search of the tree | Whether they exist elsewhere |

## A. The founder's own contributions

| # | To confirm | Document |
|---|---|---|
| A1 | The founder conceived the product, directed the work, and chose what was kept, changed and rejected | A short dated statement by the founder describing their role; the conversation and prompt records with the AI tools are the best evidence of direction and should be kept |
| A2 | Which accounts the work was done under (the AI coding assistant, any image or video tool), in whose name, on which plan | Account records; the provider's terms of service in force on the dates of use |
| A3 | No employer, school or client has a claim on the work | The founder's confirmation; a look at any employment or invention-assignment agreement in force during development |
| A4 | Anything the founder supplied personally: the supplied exercise clip, reference images, written content, the brand name and tagline | A list with dates and how each was made |

## B. Co-founder contributions

| # | To confirm | Document |
|---|---|---|
| B1 | Whether there is a co-founder or anyone with a promised stake | Founder's statement |
| B2 | What each contributed (ideas, content, design, money, testing) | A list |
| B3 | A written agreement on ownership of contributions and equity, including what happens if someone leaves | Founders' agreement; IP assignment to whichever person or entity will own the product |

The repository shows no second contributor. That is not evidence that there is none.

## C. AI-generated and AI-assisted work

| # | Item | What the repository shows | To confirm |
|---|---|---|---|
| C1 | Application code | Committed by an AI coding assistant at the founder's direction | Terms of the assistant's service on ownership of output; the founder's record of direction (A1). Counsel to advise on what to represent to investors |
| C2 | Written content: program descriptions, devotional and commentary text, coach rules, notification copy | Same | Same; plus the theological and professional reviews planned |
| C3 | Code-drawn artwork: the 2D exercise athlete, the opening gate, the app icon and SVG illustrations | Drawn by program code in the repository; the icon and illustrations were committed the same way | Same as C1. No third-party image is embedded in them, per the asset ledger's sample |
| C4 | `character-reference.png` | Carries an image generator's provenance record (dated 2026-10-29). Not shipped in the app; used as a visual reference | Which account generated it and that tool's terms. Whether the code-drawn athlete, made with it as a reference, raises any question |
| C5 | The investor presentation | Generated in this project from real screenshots and the financial model | Same as C1 |

## D. Exercise animations

| # | Item | Status | To confirm |
|---|---|---|---|
| D1 | The 218 2D demonstrations | Produced by the app's own code (C3). No video files are involved | As C1 |
| D2 | The one supplied clip labelled `original-owner` (a dumbbell curl) and its 57 derived files in `public/exercise-demos/` | "original-owner" is only the filename the import script gives any supplied clip. The clip is hidden in the app but its files are reachable by direct address. Its origin is not recorded | Who made the clip, with what tool, and under what terms. If that cannot be documented, remove the files |
| D3 | The retired 3D anatomy model (Creative Commons share-alike) | Not in the current tree; may remain in older history | Whether any derived asset survives. Counsel to advise whether history matters |

## E. Badge artwork

| # | Item | Status | To confirm |
|---|---|---|---|
| E1 | 27 badge images in `public/badges/` (also embedded in the offline build) | Cropped from three phone screenshots kept in `scripts/badge-art/posters/`. No creator, tool or licence is recorded. The project's own badge notes say rights need confirming | Who made the three source images, with what tool or from where, and under what terms. If they came from an AI image tool under the founder's account, record the account, date and terms. If that cannot be shown, replace them |

## F. Third-party assets and data

| # | Item | Status | Document to keep |
|---|---|---|---|
| F1 | Fonts: Inter, Plus Jakarta Sans, Cinzel, Lora | SIL Open Font License 1.1, verified in the font files; now attributed in the app | The licence file already in the repository |
| F2 | Open-source software | 175 production packages; notices file generated | `public/third-party-notices.txt`, regenerated when dependencies change |
| F3 | Scripture: Berean Standard Bible | Public-domain dedication per the repository's records; the publisher's page could not be reached to re-confirm | A dated copy of the publisher's dedication |
| F4 | Food data: Open Food Facts, USDA | Licence questions open (file 05) | Counsel's decision; dated copies of the terms |
| F5 | Home photographs | Not yet supplied | A licence or release for each photograph, with model and property releases where people or private places appear |
| F6 | Sound, video, stock imagery | None found | — |

## G. Accounts and registrations

| # | Item | Status | Note |
|---|---|---|---|
| G1 | GitHub repository | Personal account; placeholder repository name | Fine for an individual owner. Enable two-factor sign-in; list collaborators; consider renaming |
| G2 | Domains | Unknown | Registrar record showing the registrant |
| G3 | Apple Developer Program | Unknown | **An individual account is permitted and can run TestFlight.** With an individual account the seller name shown publicly is the person's legal name. Apple's guideline 5.1.1(ix) calls for a legal entity for apps in highly regulated fields; whether a fitness and wellness app falls there is a question for counsel, not a settled requirement |
| G4 | Google Play developer account | Unknown | A personal account is permitted; new personal accounts have had a closed-testing requirement before production (not verified from Google's page in this audit) |
| G5 | Hosting, database, payments, subscriptions, AI provider, email | Unknown | Account holder and plan for each; data-processing terms |
| G6 | Trademark application | None | See file 16 |

## H. Before public launch, and before investment

**Before public launch:** A1–A4, D2, E1, F3–F5, G2–G5.

**Before investment:** all of the above, plus B1–B3, a decision with counsel on the owning entity and a written
assignment of the founder's rights to it if one is formed, and counsel's view on C1–C5 for the representations an
investor will ask for.

## What cannot be verified from GitHub alone

Who directed the work; account ownership; any contract, assignment, release or licence receipt; whether a co-founder
or contractor exists; the full commit history; domain and developer-account records.
