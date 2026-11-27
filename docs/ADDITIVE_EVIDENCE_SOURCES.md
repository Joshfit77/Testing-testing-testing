# Ingredient evidence: sources register and verification

**Checked:** 2026-11-03, against `src/lib/additive-evidence.ts` (the `S` table and every entry that cites it).

**How it was checked:**
- Every source and every specific claim (IARC groups, ADIs, dates, legal thresholds) was looked up with web search.
- Primary pages (iarc.who.int, efsa.europa.eu, fda.gov, ecfr.gov, federalregister.gov, eur-lex.europa.eu, who.int)
  were preferred.
- This environment can't open some primary sites directly (EFSA, PubMed, legislation.gov.uk and food.gov.uk were
  blocked), so a "confirmed" result means the search results quoted the primary page or a faithful copy.
- **No citation was invented.** Where a document is cited by name without a link, the link couldn't be confirmed.

**The rules the evidence follows** (`docs/FOOD_IQ_METHOD.md`, "Ingredient evidence"):
- An additive being present is never presented as proof of harm.
- **Hazard and risk are kept apart.** A hazard is what a substance can do at some dose (for example IARC's
  classifications). Risk is the chance of harm at the amounts people eat. Each entry says whether the amount matters.
- **Each entry states the strength of the evidence:** strong, limited, uncertain, assessed by regulators, or not
  reviewed. This is separate from what regulators did, because a warning or a ban can rest on limited evidence.
- **Where an additive comes from** (natural source, manufactured, or both) is shown, with the note that origin says
  nothing about safety (`src/lib/additive-origins.ts`).
- **Additives this app hasn't reviewed** say "Insufficient information" and make no assessment.

## Sources

| Key | Source | Status |
|---|---|---|
| `reg1333` | Regulation (EC) No 1333/2008, incl. Annex V warning for E110, E104, E122, E129, E102, E124 | Confirmed |
| `reg1169` | Regulation (EU) No 1169/2011 (polyols > 10 % warning; sulphites > 10 mg/kg or /L; aspartame wording; Annex XIII reference intakes) | Confirmed |
| `reg2022_63` | Commission Regulation (EU) 2022/63 (E171), applies from 7 Aug 2022 | Confirmed |
| `efsaTio2` | EFSA news, 6 May 2021: E171 no longer considered safe | Confirmed |
| `whoAspartame` | WHO news, 14 Jul 2023: IARC Group 2B; JECFA ADI 0–40 mg/kg kept | Confirmed |
| `whoNss` | WHO guideline on non-sugar sweeteners, 15 May 2023 (conditional; polyols excluded) | Confirmed |
| `efsaErythritol` | EFSA Journal 2023;21(12):8430, ADI 0.5 g/kg bw | Confirmed |
| `witkowski` | Witkowski et al., Nat Med 2023;29:710–718 (cohort + laboratory experiments) | Confirmed (label corrected) |
| `efsaAceK` | EFSA Journal 2025;23(4):9317, ADI 15 mg/kg bw | Confirmed |
| `efsaNitrite` | EFSA press release, 15 Jun 2017 | Confirmed |
| `iarcMeat` | IARC Q&A, Monographs vol. 114: processed meat Group 1; +18 % colorectal cancer per 50 g/day | Confirmed |
| `efsaCarrageenan` | EFSA Journal 2018;16(4):5238 (PMID 32625873); temporary ADI 75 mg/kg | Confirmed |
| `efsaPhosphates` | EFSA press release, 12 Jun 2019: group ADI 40 mg P/kg bw | Confirmed |
| `fdaRed3` | US FDA, 15 Jan 2025: Red No. 3 authorization revoked (food by 15 Jan 2027) | Confirmed |
| `mccann` | McCann et al., Lancet 2007;370(9598):1560–67 | Confirmed |
| `chassaing` | Chassaing et al., Nature 2015;519(7541):92–96 (CMC and P80 in mice) | Confirmed |
| `iarc4mei` | IARC Monographs vol. 101: 4-MEI, Group 2B | Confirmed |
| `whoSugars` | WHO 2015 sugars guideline (< 10 % strong, < 5 % conditional) | Confirmed |
| `whoSodium` | WHO 2012 sodium guideline (< 2 g sodium / 5 g salt) | Confirmed |
| `iarcVol40` | IARC Monographs vol. 40 (1986) and Supplement 7 (1987): BHA, Group 2B | Partly confirmed: the Group 2B label is from Supplement 7 (label corrected to say so) |
| `iarcVol73` | IARC Monographs vol. 73 (1999): potassium bromate 2B; saccharin and its salts 3 | Confirmed |
| `efsaBha` | EFSA Journal 2011;9(10):2392, ADI 1.0 mg/kg bw | Confirmed |
| `efsaGlutamate` | EFSA Journal 2017;15(7):4910, group ADI 30 mg/kg bw | Confirmed |
| `fdaBvo` | US FDA final rule, 89 FR 55040 (3 Jul 2024), effective 2 Aug 2024 | Confirmed |
| `cfrBromatedFlour` | 21 CFR 137.155 (bromated flour, ≤ 50 ppm potassium bromate) | Confirmed |
| `cfrCarmine` | 21 CFR 73.100(d)(2): cochineal extract / carmine declared by name (effective 5 Jan 2011) | Confirmed |
| `efsaSteviol` | EFSA 2010 and JECFA 2008: steviol glycosides ADI 4 mg/kg bw as steviol | Confirmed (added) |
| `efsaMcCann` | EFSA 2008 opinion on the McCann study (evidence limited; no basis to change ADIs) | Confirmed in substance; cited by name (added) |
| `fdaBenzene` | US FDA Q&A on benzene in soft drinks | Link seen in search results (added) |
| `jecfaBromate` | JECFA 1992: acceptable level for flour treatment withdrawn | Confirmed in substance; cited by name (added) |
| `fdaCyclamate` | US FDA 1969–70: cyclamate removed from food use | Confirmed in substance; cited by name (added) |

**Thresholds behind the nutrient classes and the Nutrition Score**, all confirmed:
- **UK DH/FSA front-of-pack guidance (2016), foods per 100 g:** fat 3 / 17.5, saturates 1.5 / 5, sugars 5 / 22.5,
  salt 0.3 / 1.5 (low / high).
- **The same guidance, drinks per 100 ml:** fat 1.5 / 8.75, saturates 0.75 / 2.5, sugars 2.5 / 11.25, salt 0.3 / 0.75.
- **EU claims (Reg. 1924/2006):**
  - low sugars 5 g (2.5 g for liquids);
  - low saturated fat 1.5 g (0.75 g for liquids) and no more than 10 % of energy;
  - low sodium 0.12 g;
  - source of fibre 3 g, high fibre 6 g;
  - source of protein 12 % of energy, high protein 20 %;
  - sugars-free 0.5 g; energy-free 4 kcal / 100 ml.
- **EU reference intake (Reg. 1169/2011, Annex XIII):** 2,000 kcal.

## Corrections made on 2026-11-03

1. **Azo colours:**
   - **Removed:** "the EU kept the warning and lowered the ADI". The warning was introduced by Regulation 1333/2008,
     and EFSA's 2009 ADI changes were unrelated to the McCann study.
   - **Now says:** EFSA (2008) judged the evidence limited and said it couldn't change the ADIs.
2. **MSG (E621):**
   - **Removed:** "reactions haven't been consistently confirmed". EFSA (2017) itself used human data on headache.
   - **Class changed:** from "no established concern" to "evidence mixed or limited".
   - **Now says:** intake may exceed the ADI for high consumers in every age group.
3. **Nitrites and nitrates outside processed meat:**
   - EFSA's slight exceedance for additive nitrite is now stated as applying to highly exposed children.
   - Nitrate intake from all foods is stated separately.
   - The cheese example now names nitrates (E251/E252), the ones permitted in cheese.
4. **Erythritol:** EFSA's intake estimates exceeded the ADI even on average for children, and EFSA called them
   overestimates.
5. **Phosphates:** EFSA's full finding is now stated: infants, toddlers and children at average intakes, and
   adolescents at high intakes.
6. **Emulsifiers (mouse study):** the emulsifier was given in drinking water. The previous text said "amounts set
   relative to diet".
7. **Sodium benzoate (E211):** the benzene statement now cites the FDA (it previously cited only McCann).
8. **Erythrosine (E127):** the EU restriction now cites Regulation 1333/2008.
9. **Titanium dioxide (E171):** the uncited "still permitted in the US" was replaced by "its status differs in other
   countries".
10. **Caramel colours (E150c/d):** the uncited "authorities limit 4-MEI" was removed.
11. **Potassium bromate (E924):** "most should break down during baking" was replaced by JECFA's 1992 finding that
    residues can remain.
12. **Cyclamate (E952):** the US position now has a source.
13. **Steviol glycosides (E960):** the ADI now has a source.
14. **BHA and the erythritol study:** source labels made precise (IARC Supplement 7; cohort plus laboratory
    experiments).
15. **`docs/FOOD_QUALITY.md`:** "drinks use half" corrected. The salt "low" limit for drinks stays at 0.3 g; the code
    was already right.

## Still open (for a qualified reviewer)

- **Gums and emulsifiers (E410–E471):** the "no need for a numerical ADI" notes still cite only the authorising
  regulation. EFSA's individual re-evaluation opinions should be added.
- **Not yet reviewed:** 11 additives in the app's list still show "Insufficient information": E150a, E170, E422, E460,
  E472e, E476, E503, E509, E627, E631, E635.
- **EU cocktail-cherry limits for E127:** the 200 / 150 mg/kg limits were found only in secondary sources. The text
  doesn't state numbers.
- **Missing links:** links for sources cited by name should be added once the primary pages can be opened.
- **Expert review:** a registered dietitian or food scientist should review this table before launch, as
  `docs/FOOD_IQ_METHOD.md` already requires.
