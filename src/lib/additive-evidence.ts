/**
 * Food IQ ingredient analysis: what each additive (and added sugar or sodium source) is for, and what regulators and
 * the evidence actually say about it. Pure data and functions.
 *
 * Rules (docs/FOOD_IQ_METHOD.md, "Ingredient evidence"):
 *   - The presence of an additive is never treated as proof of harm. Hazard and real-world exposure are kept apart,
 *     and dose dependence is stated.
 *   - Every statement comes from a named regulatory text or scientific body. An additive that hasn't been reviewed for
 *     this list shows "Insufficient information" instead of an AI-written or guessed assessment.
 *   - What the label says (the product data) and what the evidence says (this table) are shown as separate things.
 */
import { addedSugarIngredients, describeAdditive, type QualityProduct } from "./food-quality";

export type EvidenceClass = "established" | "regulatory" | "mixed" | "no_concern" | "insufficient";
export const EVIDENCE_LABEL: Record<EvidenceClass, string> = {
  established: "Established concern under specified conditions",
  regulatory: "Regulatory warning",
  mixed: "Evidence mixed or limited",
  no_concern: "No established concern at typical permitted uses",
  insufficient: "Insufficient information",
};
export const EVIDENCE_HELP: Record<EvidenceClass, string> = {
  established: "A recognised risk, but only for particular people or at particular intakes, which are named.",
  regulatory: "A regulator requires a warning, restricts or has banned it somewhere.",
  mixed: "Some studies raise questions, but the evidence is limited or conflicting; regulators still permit it.",
  no_concern: "Regulators have assessed it and found no safety concern at the levels permitted in food.",
  insufficient: "This app hasn't reviewed reliable evidence for it yet, so it makes no assessment.",
};

export interface Source {
  label: string;
  url?: string;
}
interface Evidence {
  classes: EvidenceClass[];
  regulatory?: string;
  concern?: string;
  affected?: string;
  dose?: string;
  sources: Source[];
}

const S = {
  reg1333: { label: "Regulation (EC) No 1333/2008 on food additives (EU)", url: "https://eur-lex.europa.eu/eli/reg/2008/1333/oj" },
  reg1169: { label: "Regulation (EU) No 1169/2011 on food information to consumers", url: "https://eur-lex.europa.eu/eli/reg/2011/1169/oj" },
  reg2022_63: { label: "Commission Regulation (EU) 2022/63 (titanium dioxide)", url: "https://eur-lex.europa.eu/eli/reg/2022/63/oj" },
  efsaTio2: { label: "EFSA (2021): Titanium dioxide: E171 no longer considered safe when used as a food additive", url: "https://www.efsa.europa.eu/en/news/titanium-dioxide-e171-no-longer-considered-safe-when-used-food-additive" },
  whoAspartame: { label: "WHO, IARC and JECFA (2023): Aspartame hazard and risk assessment results released", url: "https://www.who.int/news/item/14-07-2023-aspartame-hazard-and-risk-assessment-results-released" },
  whoNss: { label: "WHO (2023) guideline on non-sugar sweeteners (summary)", url: "https://www.paho.org/en/news/15-5-2023-who-advises-not-use-non-sugar-sweeteners-weight-control-newly-released-guideline" },
  efsaErythritol: { label: "EFSA (2023): Re-evaluation of erythritol (E 968) as a food additive", url: "https://www.efsa.europa.eu/en/efsajournal/pub/8430" },
  witkowski: { label: "Witkowski et al. (2023), Nature Medicine: erythritol and cardiovascular event risk (observational study)" },
  efsaAceK: { label: "EFSA (2025): Re-evaluation of acesulfame K (E 950) as food additive", url: "https://www.efsa.europa.eu/en/node/19722" },
  efsaNitrite: { label: "EFSA (2017): EFSA confirms safe levels for nitrites and nitrates added to food", url: "https://www.efsa.europa.eu/en/press/news/170615" },
  iarcMeat: { label: "IARC (2015): Q&A on the carcinogenicity of red and processed meat", url: "https://www.iarc.who.int/wp-content/uploads/2018/11/Monographs-QA_Vol114.pdf" },
  efsaCarrageenan: { label: "EFSA (2018): Re-evaluation of carrageenan (E 407) and processed Eucheuma seaweed (E 407a)", url: "https://pubmed.ncbi.nlm.nih.gov/32625873/" },
  efsaPhosphates: { label: "EFSA (2019): EFSA issues new advice on phosphates", url: "https://www.efsa.europa.eu/en/press/news/190612" },
  fdaRed3: { label: "US FDA (2025): revocation of Red No. 3 in food and ingested drugs", url: "https://www.fda.gov/food/hfp-constituent-updates/fda-revoke-authorization-use-red-no-3-food-and-ingested-drugs" },
  mccann: { label: "McCann et al. (2007), The Lancet: food additives and hyperactive behaviour in children (the \"Southampton study\")" },
  chassaing: { label: "Chassaing et al. (2015), Nature: dietary emulsifiers and the mouse gut microbiota" },
  iarc4mei: { label: "IARC Monographs volume 101: 4-methylimidazole (Group 2B)" },
  whoSugars: { label: "WHO (2015) Guideline: sugars intake for adults and children" },
  whoSodium: { label: "WHO (2012) Guideline: sodium intake for adults and children" },
} satisfies Record<string, Source>;

const AZO: Evidence = {
  classes: ["regulatory"],
  regulatory: "In the EU, foods containing this colour must carry the warning \"may have an adverse effect on activity and attention in children\".",
  concern:
    "A 2007 UK study linked mixtures of six colours (with the preservative sodium benzoate) to increased hyperactivity in some children. EFSA judged that evidence limited, but the EU kept the warning and lowered the acceptable daily intake of some of these colours.",
  affected: "Children (activity and attention).",
  dose: "The study tested mixtures at amounts children could eat; how much is eaten matters.",
  sources: [S.reg1333, S.mccann],
};
const POLYOL: Evidence = {
  classes: ["regulatory"],
  regulatory: "In the EU, foods with more than 10% added polyols must state \"excessive consumption may produce laxative effects\".",
  concern: "Polyols are only partly absorbed, so larger amounts can cause bloating and diarrhoea.",
  affected: "Anyone eating large amounts; people with sensitive digestion (such as IBS) may react to less.",
  dose: "Yes: effects depend on the amount eaten at once.",
  sources: [S.reg1169],
};
const SULPHITE: Evidence = {
  classes: ["established"],
  regulatory: "Must be declared as an allergen above 10 mg per kg or litre (EU).",
  concern: "Can trigger asthma symptoms and other reactions in people sensitive to sulphites.",
  affected: "People with sulphite sensitivity, often people with asthma.",
  dose: "Sensitive people can react to small amounts; others are not affected at permitted levels.",
  sources: [S.reg1169],
};
const PHOSPHATE: Evidence = {
  classes: ["established"],
  concern:
    "EFSA (2019) set a group acceptable daily intake of 40 mg phosphorus per kg of body weight and noted it doesn't protect people with moderate to severe kidney disease. Some children's intakes from all sources can exceed it.",
  affected: "People with chronic kidney disease; children with high intakes.",
  dose: "Yes: total phosphorus intake from all foods is what matters.",
  sources: [S.efsaPhosphates],
};
const NITRITE: Evidence = {
  classes: ["established", "mixed"],
  concern:
    "Nitrites and nitrates protect cured meats from the bacteria that cause botulism, but can form nitrosamines. IARC classifies processed meat as carcinogenic to humans (Group 1), mainly for bowel cancer. EFSA (2017) found the permitted additive levels within safe intakes for most people, with a slight exceedance for children who eat a lot of these foods.",
  affected: "People who eat processed meat regularly; children with high intakes.",
  dose: "Yes: IARC estimates bowel-cancer risk rises by about 18% for every 50 g of processed meat eaten daily.",
  sources: [S.iarcMeat, S.efsaNitrite],
};
const EMULSIFIER_MIXED: Evidence = {
  classes: ["mixed"],
  concern: "Mouse studies found that this emulsifier changed gut bacteria and promoted inflammation. Evidence in people is limited, and regulators still permit it at set levels.",
  affected: "Unclear; most research is in animals.",
  dose: "Animal studies used amounts set relative to diet; effects in people at typical intakes aren't established.",
  sources: [S.chassaing],
};
const NO_CONCERN = (note: string, sources: Source[] = [S.reg1333]): Evidence => ({ classes: ["no_concern"], concern: note, sources });
const NSS_NOTE = "The WHO (2023) advises against relying on non-sugar sweeteners for weight control (a conditional recommendation based on long-term studies); this is about diet patterns, not a finding that it's unsafe.";

/** Reviewed additives. Anything not here is shown as "Insufficient information". */
export const ADDITIVE_EVIDENCE: Record<string, Evidence> = {
  e102: { ...AZO, affected: "Children (activity and attention); rarely, people sensitive to tartrazine." },
  e104: AZO,
  e110: AZO,
  e122: AZO,
  e124: AZO,
  e129: AZO,
  e127: {
    classes: ["regulatory"],
    regulatory: "The US FDA revoked its authorization in food in January 2025 (food makers must reformulate by January 2027). In the EU it's permitted only in a few products, such as cocktail cherries.",
    concern: "The FDA acted under a law that bans additives found to cause cancer in animals (thyroid tumours in male rats at high doses); it states those findings don't apply to people.",
    affected: "No established effect in people at typical intakes.",
    dose: "The rat findings were at high doses.",
    sources: [S.fdaRed3],
  },
  e171: {
    classes: ["regulatory"],
    regulatory: "Banned as a food additive in the EU since 2022. Still permitted in the US and some other countries.",
    concern: "EFSA (2021) couldn't rule out damage to genetic material (genotoxicity) from titanium dioxide particles, so it couldn't set a safe daily intake.",
    affected: "Everyone (no safe intake could be set).",
    dose: "Absorption is low, but particles can build up in the body; no safe threshold could be established.",
    sources: [S.efsaTio2, S.reg2022_63],
  },
  e120: {
    classes: ["established"],
    concern: "Rare allergic reactions, including severe ones, have been reported; the US requires it to be named on labels. Made from insects, so not vegetarian or vegan.",
    affected: "People allergic to carmine.",
    dose: "Allergic people can react to small amounts.",
    sources: [S.reg1333],
  },
  e150c: { classes: ["mixed"], concern: "Can contain 4-methylimidazole (4-MEI), which IARC classifies as possibly carcinogenic (Group 2B, from animal studies). Authorities limit 4-MEI in these colours.", affected: "Unclear at typical intakes.", dose: "Yes: assessments depend on the amount consumed.", sources: [S.iarc4mei] },
  e150d: { classes: ["mixed"], concern: "Can contain 4-methylimidazole (4-MEI), which IARC classifies as possibly carcinogenic (Group 2B, from animal studies). Authorities limit 4-MEI in these colours.", affected: "Unclear at typical intakes.", dose: "Yes: assessments depend on the amount consumed.", sources: [S.iarc4mei] },
  e100: NO_CONCERN("A natural yellow colour from turmeric, assessed by EFSA with an acceptable daily intake."),
  e101: NO_CONCERN("Vitamin B2, used as a colour."),
  e133: NO_CONCERN("Assessed by EFSA with an acceptable daily intake; no specific concern at permitted levels."),
  e140: NO_CONCERN("Chlorophyll, the natural green pigment of plants."),
  e160a: NO_CONCERN("Carotenes, natural orange pigments (as in carrots)."),
  e160c: NO_CONCERN("A natural colour extracted from paprika."),
  e162: NO_CONCERN("A natural red colour from beetroot."),
  e200: NO_CONCERN("Sorbic acid: re-evaluated by EFSA, which set an acceptable daily intake."),
  e202: NO_CONCERN("Potassium sorbate: re-evaluated by EFSA, which set an acceptable daily intake."),
  e211: {
    classes: ["mixed"],
    concern: "In drinks that also contain vitamin C, small amounts of benzene can form with heat and light; manufacturers have reformulated to limit this. It was also part of the additive mixtures in the 2007 Southampton study.",
    affected: "Unclear at typical intakes.",
    dose: "Yes: benzene formation depends on storage conditions and amounts.",
    sources: [S.mccann],
  },
  e220: SULPHITE,
  e221: SULPHITE,
  e222: SULPHITE,
  e223: SULPHITE,
  e224: SULPHITE,
  e226: SULPHITE,
  e228: SULPHITE,
  e249: NITRITE,
  e250: NITRITE,
  e251: NITRITE,
  e252: NITRITE,
  e270: NO_CONCERN("Lactic acid, also made naturally by fermentation."),
  e282: NO_CONCERN("Calcium propionate, a common bread preservative, permitted at set levels."),
  e290: NO_CONCERN("Carbon dioxide, the gas in fizzy drinks."),
  e296: NO_CONCERN("Malic acid, naturally found in fruit."),
  e300: NO_CONCERN("Vitamin C."),
  e301: NO_CONCERN("A form of vitamin C."),
  e306: NO_CONCERN("Vitamin E."),
  e320: { classes: ["mixed"], concern: "IARC classifies BHA as possibly carcinogenic (Group 2B), based on animal studies at high doses. EFSA set an acceptable daily intake and permits it at low levels.", affected: "Unclear at typical intakes.", dose: "The animal findings were at high doses.", sources: [S.reg1333] },
  e322: NO_CONCERN("Lecithins: re-evaluated by EFSA, which found no need for a numerical acceptable daily intake. Often made from soy (declared as soy) or sunflower."),
  e330: NO_CONCERN("Citric acid, naturally found in citrus fruit."),
  e331: NO_CONCERN("Sodium citrates; they add a little sodium."),
  e332: NO_CONCERN("Potassium citrates."),
  e334: NO_CONCERN("Tartaric acid, naturally found in grapes."),
  e338: PHOSPHATE,
  e339: PHOSPHATE,
  e340: PHOSPHATE,
  e341: PHOSPHATE,
  e343: PHOSPHATE,
  e450: PHOSPHATE,
  e451: PHOSPHATE,
  e452: PHOSPHATE,
  e401: NO_CONCERN("Sodium alginate, from seaweed."),
  e407: {
    classes: ["mixed"],
    concern: "EFSA (2018) kept the acceptable daily intake of 75 mg per kg of body weight but made it temporary because of gaps in the data, and asked for more data, particularly for infants.",
    affected: "Uncertain; the data gaps concern infants in particular.",
    dose: "Assessments are based on intake.",
    sources: [S.efsaCarrageenan],
  },
  e407a: {
    classes: ["mixed"],
    concern: "Assessed together with carrageenan: EFSA (2018) made the acceptable daily intake temporary because of gaps in the data.",
    affected: "Uncertain; the data gaps concern infants in particular.",
    dose: "Assessments are based on intake.",
    sources: [S.efsaCarrageenan],
  },
  e410: NO_CONCERN("Locust bean gum, from carob seeds; re-evaluated by EFSA with no need for a numerical acceptable daily intake."),
  e412: NO_CONCERN("Guar gum, from guar beans; re-evaluated by EFSA with no need for a numerical acceptable daily intake."),
  e414: NO_CONCERN("Gum arabic, from acacia trees; re-evaluated by EFSA with no need for a numerical acceptable daily intake."),
  e415: NO_CONCERN("Xanthan gum, made by fermentation; re-evaluated by EFSA with no need for a numerical acceptable daily intake."),
  e440: NO_CONCERN("Pectins, naturally found in fruit; re-evaluated by EFSA with no need for a numerical acceptable daily intake."),
  e433: EMULSIFIER_MIXED,
  e466: EMULSIFIER_MIXED,
  e471: NO_CONCERN("Mono- and diglycerides: re-evaluated by EFSA, which found no need for a numerical acceptable daily intake."),
  e420: POLYOL,
  e421: POLYOL,
  e953: POLYOL,
  e965: POLYOL,
  e966: POLYOL,
  e967: POLYOL,
  e968: {
    classes: ["regulatory", "mixed"],
    regulatory: POLYOL.regulatory,
    concern:
      "EFSA (2023) set an acceptable daily intake of 0.5 g per kg of body weight (based on laxative effects) and found that high consumers may exceed it. A 2023 observational study linked higher blood erythritol to cardiovascular events; it couldn't show cause and effect.",
    affected: "High consumers; people with sensitive digestion.",
    dose: "Yes: effects depend on the amount eaten.",
    sources: [S.efsaErythritol, S.witkowski, S.reg1169],
  },
  e500: NO_CONCERN("Sodium carbonates (baking soda); they add sodium."),
  e551: NO_CONCERN("Silicon dioxide, an anti-caking agent."),
  e621: {
    classes: ["no_concern"],
    concern:
      "EFSA (2017) set a group acceptable daily intake of 30 mg per kg of body weight for glutamates and noted some high consumers may exceed it. Reported reactions such as headache haven't been consistently confirmed in controlled studies. It adds sodium.",
    affected: "High consumers.",
    dose: "Yes: assessments depend on total intake.",
    sources: [S.reg1333],
  },
  e924: { classes: ["regulatory"], regulatory: "Not permitted in the EU, UK or Canada; still permitted in bread-making in the US.", concern: "IARC classifies potassium bromate as possibly carcinogenic (Group 2B), from animal studies.", affected: "Unclear at typical intakes.", dose: "Most should break down during baking; residues depend on use.", sources: [S.reg1333] },
  e443: { classes: ["regulatory"], regulatory: "The US FDA revoked its authorization in 2024; it isn't permitted in the EU.", concern: "Animal studies raised concerns about effects on the thyroid and other organs.", affected: "Unclear at typical intakes.", dose: "Effects in studies depended on dose.", sources: [S.reg1333] },
  e950: { classes: ["no_concern"], concern: `EFSA's 2025 re-evaluation found no genotoxicity concern and set an acceptable daily intake of 15 mg per kg of body weight. ${NSS_NOTE}`, affected: "None identified at permitted levels.", dose: "Safety assessments assume intake below the acceptable daily intake.", sources: [S.efsaAceK, S.whoNss] },
  e951: {
    classes: ["established", "mixed"],
    regulatory: "EU labels must state that it contains a source of phenylalanine.",
    concern: `People with phenylketonuria (PKU) must limit phenylalanine. In 2023 IARC classed aspartame as possibly carcinogenic (Group 2B, limited evidence), while JECFA kept the acceptable daily intake of 40 mg per kg of body weight. ${NSS_NOTE}`,
    affected: "People with phenylketonuria (PKU).",
    dose: "Yes: WHO estimates a 70 kg adult would need more than about 9–14 cans of diet soft drink a day to exceed the acceptable daily intake.",
    sources: [S.whoAspartame, S.reg1169, S.whoNss],
  },
  e952: { classes: ["regulatory"], regulatory: "Not permitted in the US; permitted in the EU with an acceptable daily intake.", concern: NSS_NOTE, affected: "None identified at permitted EU levels.", dose: "Safety assessments assume intake below the acceptable daily intake.", sources: [S.reg1333, S.whoNss] },
  e954: { classes: ["no_concern"], concern: `Once suspected from bladder tumours in rats; IARC moved it to Group 3 ("not classifiable") in 1999 because that mechanism doesn't apply to people. ${NSS_NOTE}`, affected: "None identified at permitted levels.", dose: "Safety assessments assume intake below the acceptable daily intake.", sources: [S.whoNss] },
  e955: { classes: ["no_concern"], concern: `Permitted in the EU and US with an acceptable daily intake. ${NSS_NOTE}`, affected: "None identified at permitted levels.", dose: "Safety assessments assume intake below the acceptable daily intake.", sources: [S.reg1333, S.whoNss] },
  e960: { classes: ["no_concern"], concern: `EFSA and JECFA set an acceptable daily intake of 4 mg per kg of body weight (as steviol). ${NSS_NOTE}`, affected: "None identified at permitted levels.", dose: "Safety assessments assume intake below the acceptable daily intake.", sources: [S.reg1333, S.whoNss] },
  e901: NO_CONCERN("Beeswax, a glazing agent; not vegan."),
  e903: NO_CONCERN("Carnauba wax, a glazing agent from palm leaves."),
};

export type AlertGroup =
  | "Sweetener"
  | "Colour"
  | "Preservative"
  | "Antioxidant"
  | "Emulsifier"
  | "Thickener or stabiliser"
  | "Flavour enhancer"
  | "Acidity regulator"
  | "Other additive"
  | "Added sugars"
  | "Sodium sources";

export interface IngredientAlert {
  key: string;
  title: string;
  code: string | null;
  group: AlertGroup;
  purpose: string;
  /** The first class is the headline one. */
  classes: EvidenceClass[];
  regulatory: string | null;
  concern: string | null;
  affected: string | null;
  dose: string | null;
  sources: Source[];
}

function groupFor(role: string): AlertGroup {
  if (/sweetener|polyol/i.test(role)) return "Sweetener";
  if (/colour/i.test(role)) return "Colour";
  if (/preservative/i.test(role)) return "Preservative";
  if (/emulsif/i.test(role)) return "Emulsifier";
  if (/thicken|stabilis|gelling/i.test(role)) return "Thickener or stabiliser";
  if (/flavour enhancer/i.test(role)) return "Flavour enhancer";
  if (/antioxidant/i.test(role)) return "Antioxidant";
  if (/acid/i.test(role)) return "Acidity regulator";
  return "Other additive";
}
const PRIORITY: Record<EvidenceClass, number> = { regulatory: 0, established: 1, mixed: 2, insufficient: 3, no_concern: 4 };

const SODIUM_TERMS = /\b(sea salt|salt|sodium [a-z]+|monosodium glutamate|baking soda|bicarbonate of soda|soy sauce|soya sauce|fish sauce|stock cube|bouillon|brine)\b/gi;

/** Ingredients that deserve attention, most important first. Every additive in the data appears, with its evidence class. */
export function ingredientAlerts(p: QualityProduct): IngredientAlert[] {
  const out: IngredientAlert[] = [];
  for (const code of p.additives) {
    const info = describeAdditive(code);
    const key = code.toLowerCase();
    const ev = ADDITIVE_EVIDENCE[key] ?? ADDITIVE_EVIDENCE[key.replace(/(i{1,3}|iv|v)$/, "")];
    out.push({
      key,
      title: `${info.code} ${info.name}`,
      code: info.code,
      group: groupFor(info.role),
      purpose: info.role,
      classes: ev?.classes ?? ["insufficient"],
      regulatory: ev?.regulatory ?? null,
      concern: ev?.concern ?? (ev ? null : "This additive hasn't been reviewed for this app yet, so no assessment is given. Check the regulator in your country for its status."),
      affected: ev?.affected ?? null,
      dose: ev?.dose ?? null,
      sources: ev?.sources ?? [],
    });
  }
  out.sort((a, b) => PRIORITY[a.classes[0]!] - PRIORITY[b.classes[0]!]);

  const sugars = addedSugarIngredients(p.ingredientsText);
  if (sugars.length) {
    const amount = p.per100.added_sugars_g != null ? `${p.per100.added_sugars_g} g of added sugars per 100 ${p.unit} on the label` : p.per100.sugars_g != null ? `${p.per100.sugars_g} g of total sugars per 100 ${p.unit} (added sugars aren't listed separately)` : "amount not available";
    out.push({
      key: "added_sugars",
      title: "Added sugars",
      code: null,
      group: "Added sugars",
      purpose: `Named in the ingredients: ${sugars.join(", ")}. ${amount[0]!.toUpperCase() + amount.slice(1)}.`,
      classes: ["established"],
      regulatory: null,
      concern: "The WHO strongly recommends keeping free sugars below 10% of daily energy, and suggests below 5%, mainly for weight and dental health.",
      affected: "Everyone, depending on total intake across the day.",
      dose: "Yes: what matters is how much free sugar you eat in total.",
      sources: [S.whoSugars],
    });
  }
  const sodiumTerms = [...new Set((p.ingredientsText?.match(SODIUM_TERMS) ?? []).map((t) => t.toLowerCase()))].slice(0, 6);
  if (sodiumTerms.length) {
    out.push({
      key: "sodium_sources",
      title: "Sodium sources",
      code: null,
      group: "Sodium sources",
      purpose: `Named in the ingredients: ${sodiumTerms.join(", ")}.${p.per100.salt_g != null ? ` ${p.per100.salt_g} g of salt per 100 ${p.unit}.` : ""}`,
      classes: ["established"],
      regulatory: null,
      concern: "High sodium intake raises blood pressure. The WHO recommends adults eat less than 2 g of sodium (5 g of salt) a day.",
      affected: "Everyone, especially people with high blood pressure.",
      dose: "Yes: what matters is total salt across the day.",
      sources: [S.whoSodium],
    });
  }
  return out;
}

/** True when an additive has been reviewed for this list. */
export function hasEvidence(code: string): boolean {
  const c = code.toLowerCase();
  return c in ADDITIVE_EVIDENCE || c.replace(/(i{1,3}|iv|v)$/, "") in ADDITIVE_EVIDENCE;
}
