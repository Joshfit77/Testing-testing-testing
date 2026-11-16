# Investor IP and ownership checklist

Date: 2026-11-16. Branch: `claude/legal-remediation`. A checklist for the founder; not legal advice. **No document
listed here is assumed to exist**: the repository contains none of them. AI-authored commits are not evidence of
missing ownership; they mean the founder's direction of the work needs to be documented (see
`docs/legal-audit-2026-11-16/11_COMPANY_IP_OWNERSHIP_CHECKLIST.md`).

**Required** means required by a store, a licence, or an investor's standard diligence request.
**Recommended** means good practice that counsel may advise.

| # | Item | Required or recommended | By whom / why | What the repository shows | Document to produce |
|---|---|---|---|---|---|
| 1 | Legal entity (LLC or corporation) | **Required before investment** (an investor buys into an entity). **Recommended** before public launch to limit personal liability. **Not required** for private TestFlight or for an individual Apple or Google developer account | Investors; counsel | Draft Terms say the owner is an individual | Formation documents; certificate of good standing; EIN |
| 2 | Operating agreement or bylaws | Required once an entity exists | Investors | Nothing | Signed agreement |
| 3 | Founder ownership percentages and vesting | Required for investment | Investors | Nothing | Cap table; founder stock or membership-interest agreements |
| 4 | Assignment of the founder's IP to the entity | Required for investment if an entity is formed | Investors | Nothing | IP assignment agreement covering code, content, designs, the name and logo, domains |
| 5 | Record of the founder's authorship and direction of AI-assisted work | Recommended now; investors will ask | Counsel | Commits authored by an AI coding assistant; no record of direction | Founder's dated statement; list of AI tools, accounts and plans; the tools' terms on the dates used; conversation records kept |
| 6 | Co-founder contributions | Required if anyone else contributed or was promised a stake | Investors | No second contributor appears; not evidence there is none | Founder's statement; founders' agreement and assignments if applicable |
| 7 | Contractor agreements with IP assignment | Required for any contractor's work | Investors; copyright law | Nothing; origin of the badge artwork and one exercise clip unrecorded | Agreements, or a signed statement that no contractor contributed |
| 8 | Source-code ownership | Required for investment | Investors | Personal GitHub account; no licence file (`"license": "UNLICENSED"`) | Items 4–7 |
| 9 | Trademark ownership | Recommended before launch; investors will ask | Counsel | No search on an official register; no filing | Counsel's search and opinion; application in the owner's name when advised (`TRADEMARK_ATTORNEY_PACKAGE.md`) |
| 10 | Domain ownership | Required for control of the brand and email | Investors | `narrowgatefitness.com`, `narrowgate.fit` appear in code; registrant unknown | Registrar records; two-factor sign-in on |
| 11 | Apple Developer account | Required to publish; individual or organisation | Apple | Unknown | Enrolment record; transfer to the entity later if one is formed (Apple supports app transfers) |
| 12 | Google Play developer account | Required to publish; personal or organisation | Google | Unknown | Account record |
| 13 | GitHub repository control | Recommended: move to an organisation the entity controls | Investors | Personal account; placeholder repository name | Organisation; collaborator list; two-factor sign-in |
| 14 | Third-party licence records | Required (licence notice obligations) | Licences | `public/third-party-notices.txt`; `THIRD_PARTY_LICENSES.md` | Keep regenerating on dependency changes; dated copies of data and Scripture terms |
| 15 | Asset ownership records | Required for every shipped asset | Investors; copyright | See `ASSET_OWNERSHIP_MANIFEST.md` | Source, tool, account and terms for each asset; replace what cannot be documented |
| 16 | Company support email | Required (stores; privacy laws) | Apple, Google | None in the app | A mailbox on the brand domain that is monitored |
| 17 | Processor contracts (hosting, AI provider, payments, subscriptions, email) | Required by privacy law for processors of personal data | Counsel | Unknown | Signed data-processing terms in the owner's name; AI provider terms on retention and training |
| 18 | Insurance | Recommended: general liability, cyber, and professional/E&O for fitness and nutrition guidance | Counsel; broker | Unknown | Policies or quotes |
| 19 | Professional reviews behind any "reviewed by" claim | Required before any such claim; recommended before public launch | Consumer-protection law | None engaged | Engagement letters and written sign-offs (coach, dietitian, physiotherapist, theologian) |

## What an investor's diligence request list will contain (assemble in a data room)

Formation and governance documents; cap table; founder and contractor IP assignments; the AI-use record; trademark
search and filings; domain, developer and service account ownership; open-source inventory and notices; asset
ownership records; privacy policy, terms and processor contracts; a list of known legal risks and how each is being
addressed (`LEGAL_BLOCKERS_REMAINING.md`); insurance.
