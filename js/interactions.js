// Herb & fruit interaction checker data.
// Each entry: type ("med" or "condition"), label, examples, and herbs/fruits to avoid or use with caution.
// Fruit ids are prefixed with "fruit:". Notes explain why.

const INTERACTIONS = [
  {
    id: "blood-thinners", type: "med", label: "Blood thinners", examples: "warfarin (Coumadin), aspirin, clopidogrel (Plavix), apixaban (Eliquis), rivaroxaban (Xarelto)",
    avoid: {
      ginkgo: "Makes platelets less sticky — adds to bleeding risk.",
      "st-johns-wort": "Speeds up the breakdown of warfarin, making it less effective.",
      feverfew: "Slows clotting.",
      meadowsweet: "Contains salicylates, like aspirin.",
      "fruit:goji-berry": "May strongly increase the effect of warfarin."
    },
    caution: {
      garlic: "Supplements may increase bleeding risk; food amounts are fine.",
      ginger: "Larger amounts (over about 4 g a day) may increase bleeding.",
      turmeric: "Curcumin supplements may increase bleeding.",
      ginseng: "May change warfarin's effect.",
      chamomile: "May increase warfarin's effect in large amounts.",
      fenugreek: "May increase bleeding risk.",
      "red-clover": "Contains coumarins.",
      reishi: "May slow clotting.",
      "holy-basil": "May slow clotting.",
      bilberry: "Extracts may slow clotting.",
      cranberry: "Large amounts may increase warfarin's effect.",
      "black-seed": "May slow clotting.",
      clove: "Eugenol may slow clotting.",
      "saw-palmetto": "Rare reports of bleeding.",
      parsley: "High in vitamin K — keep intake consistent with warfarin.",
      nettle: "Contains vitamin K — keep intake consistent with warfarin.",
      "green-tea": "Contains vitamin K; extracts may affect warfarin.",
      "fruit:pomegranate": "Juice may increase warfarin's effect.",
      "fruit:mangosteen": "Supplements may slow clotting.",
      "fruit:sea-buckthorn": "May slow clotting in large amounts.",
      "fruit:amla": "May slow clotting.",
      "fruit:pineapple": "Bromelain supplements (not normal fruit) may increase bleeding."
    }
  },
  {
    id: "diabetes", type: "med", label: "Diabetes medicines", examples: "metformin, insulin, glipizide, sitagliptin, semaglutide",
    avoid: {},
    caution: {
      fenugreek: "Lowers blood sugar — may add to your medicine's effect.",
      cinnamon: "May lower blood sugar.",
      "holy-basil": "May lower blood sugar.",
      ginseng: "Lowers blood sugar after meals.",
      "milk-thistle": "May lower blood sugar.",
      "bay-laurel": "May lower blood sugar.",
      "olive-leaf": "May lower blood sugar.",
      moringa: "May lower blood sugar.",
      "black-seed": "May lower blood sugar.",
      burdock: "May lower blood sugar.",
      nettle: "May lower blood sugar.",
      cumin: "May lower blood sugar.",
      "marshmallow-root": "May lower blood sugar.",
      ashwagandha: "May lower blood sugar.",
      "gotu-kola": "May affect blood sugar.",
      "fruit:bitter-melon": "Lowers blood sugar — can cause lows with medicine.",
      "fruit:guava": "Guava leaf tea may lower blood sugar.",
      "fruit:mulberry": "Leaf supplements lower blood sugar after meals.",
      "fruit:amla": "May lower blood sugar.",
      "fruit:bael": "May lower blood sugar.",
      "fruit:date": "High in natural sugar — keep portions small.",
      "fruit:tart-cherry": "Juice is high in sugar — choose unsweetened."
    }
  },
  {
    id: "blood-pressure", type: "med", label: "Blood pressure medicines", examples: "lisinopril, amlodipine, losartan, metoprolol, hydrochlorothiazide",
    avoid: {
      licorice: "Raises blood pressure and lowers potassium — works against your medicine.",
      "fruit:grapefruit": "Blocks the breakdown of some blood pressure medicines (such as amlodipine, felodipine, nifedipine)."
    },
    caution: {
      hibiscus: "Lowers blood pressure — may add to your medicine.",
      hawthorn: "May lower blood pressure.",
      "olive-leaf": "Lowers blood pressure.",
      garlic: "Supplements may lower blood pressure.",
      reishi: "May lower blood pressure.",
      "black-seed": "May lower blood pressure.",
      moringa: "May lower blood pressure.",
      nettle: "May affect blood pressure.",
      ginseng: "May raise or lower blood pressure.",
      "yerba-mate": "Caffeine may raise blood pressure.",
      "green-tea": "Caffeine may raise blood pressure.",
      "fruit:pomelo": "Like grapefruit, may affect some blood pressure medicines.",
      "fruit:noni": "Very high in potassium — caution with ACE inhibitors and ARBs.",
      "fruit:coconut": "Coconut water is high in potassium — caution with ACE inhibitors, ARBs and spironolactone."
    }
  },
  {
    id: "antidepressants", type: "med", label: "Antidepressants & mood medicines", examples: "sertraline, fluoxetine, escitalopram, venlafaxine, bupropion, MAOIs, triptans",
    avoid: {
      "st-johns-wort": "Risk of serotonin syndrome — a dangerous reaction.",
      nutmeg: "Large amounts affect brain chemistry — keep to culinary pinches."
    },
    caution: {
      rhodiola: "May interact with antidepressants.",
      saffron: "May add to serotonin effects.",
      ginseng: "May interact with MAOIs and other mood medicines.",
      ginkgo: "May interact with some antidepressants.",
      passionflower: "May add to sedation and interact with MAOIs.",
      "yerba-mate": "Caffeine with MAOIs can raise blood pressure.",
      "green-tea": "Caffeine with MAOIs can raise blood pressure."
    }
  },
  {
    id: "sedatives", type: "med", label: "Sleep medicines, sedatives & alcohol", examples: "zolpidem, lorazepam, diazepam, trazodone, opioid pain relievers, alcohol",
    avoid: {},
    caution: {
      valerian: "Adds to drowsiness.",
      passionflower: "Adds to drowsiness.",
      hops: "Adds to drowsiness.",
      skullcap: "Adds to drowsiness.",
      "lemon-balm": "Adds to drowsiness.",
      chamomile: "May add to drowsiness.",
      lavender: "Oral lavender may add to drowsiness.",
      ashwagandha: "May add to sedation.",
      catnip: "May add to drowsiness.",
      "gotu-kola": "May add to drowsiness.",
      "fruit:jujube": "May add to drowsiness.",
      "fruit:durian": "Avoid with alcohol — may cause nausea and flushing."
    }
  },
  {
    id: "hormones", type: "med", label: "Birth control & hormone therapy", examples: "birth control pills, patch or ring, HRT, fertility treatment, tamoxifen",
    avoid: {
      "st-johns-wort": "Makes birth control pills less effective — risk of pregnancy.",
      chasteberry: "Acts on hormones; may interfere with birth control and fertility treatment."
    },
    caution: {
      "red-clover": "Contains plant estrogens.",
      hops: "Contains a strong plant estrogen.",
      fennel: "Weak estrogen-like effects.",
      anise: "Weak estrogen-like effects.",
      "saw-palmetto": "Affects hormones.",
      licorice: "May affect hormone levels.",
      "fruit:grapefruit": "May raise estrogen levels from some medicines."
    }
  },
  {
    id: "thyroid", type: "med", label: "Thyroid medicines", examples: "levothyroxine (Synthroid), liothyronine, methimazole",
    avoid: {},
    caution: {
      ashwagandha: "May raise thyroid hormone levels.",
      "lemon-balm": "May reduce thyroid activity.",
      moringa: "May affect thyroid medicine.",
      bacopa: "May affect thyroid hormone levels.",
      "fruit:grapefruit": "May slightly reduce levothyroxine absorption."
    }
  },
  {
    id: "immunosuppressants", type: "med", label: "Immune-suppressing medicines", examples: "cyclosporine, tacrolimus (transplants), methotrexate, prednisone, biologics for autoimmune disease",
    avoid: {
      "st-johns-wort": "Lowers cyclosporine and tacrolimus levels — risk of transplant rejection.",
      echinacea: "Stimulates the immune system — works against your medicine.",
      astragalus: "Stimulates the immune system.",
      "fruit:grapefruit": "Raises levels of cyclosporine and tacrolimus.",
      "fruit:pomelo": "May raise levels of transplant medicines."
    },
    caution: {
      elderberry: "Stimulates the immune system.",
      elderflower: "May stimulate the immune system.",
      reishi: "Affects immune activity.",
      ashwagandha: "May stimulate the immune system.",
      "holy-basil": "May affect immune activity."
    }
  },
  {
    id: "lithium", type: "med", label: "Lithium", examples: "lithium carbonate",
    avoid: {},
    caution: {
      dandelion: "Diuretic — can raise lithium to harmful levels.",
      horsetail: "Diuretic — can raise lithium levels.",
      nettle: "Diuretic — can raise lithium levels.",
      parsley: "Large amounts are diuretic.",
      juniper: "Diuretic.",
      burdock: "Diuretic.",
      lovage: "Diuretic.",
      "green-tea": "Caffeine can lower lithium levels; changes in intake affect levels."
    }
  },
  {
    id: "diuretics", type: "med", label: "Diuretics (water pills)", examples: "furosemide, hydrochlorothiazide, spironolactone",
    avoid: {
      licorice: "Adds to potassium loss — risk of dangerous heart rhythms."
    },
    caution: {
      dandelion: "Adds a diuretic effect.",
      horsetail: "Adds a diuretic effect and potassium loss.",
      nettle: "Adds a diuretic effect.",
      juniper: "Adds a diuretic effect.",
      burdock: "Adds a diuretic effect.",
      hibiscus: "Mild diuretic.",
      parsley: "Large amounts are diuretic.",
      "fruit:noni": "High in potassium — caution with spironolactone."
    }
  },
  {
    id: "heart", type: "med", label: "Heart rhythm & heart failure medicines", examples: "digoxin, amiodarone, beta blockers",
    avoid: {
      licorice: "Lowers potassium, which increases digoxin's toxic effects.",
      "st-johns-wort": "Lowers digoxin levels."
    },
    caution: {
      hawthorn: "Adds to the effect of heart medicines — use only with your doctor.",
      ginseng: "May interfere with digoxin and its blood tests.",
      horsetail: "Lowers potassium.",
      "fruit:grapefruit": "Raises levels of some heart rhythm medicines (such as amiodarone)."
    }
  },
  {
    id: "statins", type: "med", label: "Cholesterol medicines (statins)", examples: "atorvastatin, simvastatin, lovastatin, rosuvastatin",
    avoid: {
      "fruit:grapefruit": "Raises levels of simvastatin, lovastatin and atorvastatin — risk of muscle damage.",
      "fruit:pomelo": "Like grapefruit, may raise statin levels."
    },
    caution: {
      "st-johns-wort": "May lower levels of some statins.",
      "fruit:pomegranate": "Juice may affect how some statins are processed."
    }
  },
  {
    id: "liver-processed", type: "med", label: "Other prescription medicines processed by the liver", examples: "HIV medicines, cancer treatments, seizure medicines, anti-anxiety medicines, many others",
    avoid: {
      "st-johns-wort": "Switches on liver enzymes that break down many medicines, making them less effective."
    },
    caution: {
      schisandra: "Changes how the liver processes many medicines.",
      "black-pepper": "Piperine supplements (not food amounts) change medicine levels.",
      garlic: "Supplements may lower levels of some HIV medicines.",
      "milk-thistle": "May affect how some medicines are processed.",
      "fruit:grapefruit": "Blocks the breakdown of many medicines.",
      "fruit:pomelo": "Blocks the breakdown of many medicines."
    }
  },

  // ---------- Health situations ----------
  {
    id: "pregnancy", type: "condition", label: "Pregnant or trying to conceive", examples: "",
    avoid: {
      sage: "Thujone in medicinal amounts.", "holy-basil": "Avoid when pregnant or trying to conceive.", parsley: "Large medicinal amounts, seed and oil can stimulate the uterus.",
      fenugreek: "May stimulate contractions.", licorice: "Linked to pregnancy complications.", "slippery-elm": "Traditional caution.", hibiscus: "Avoid in pregnancy.",
      "aloe-vera": "Do not take aloe by mouth.", "red-clover": "Hormonal effects.", ginseng: "Avoid in pregnancy.", ashwagandha: "Avoid in pregnancy.",
      valerian: "Not studied in pregnancy.", passionflower: "May stimulate the uterus.", skullcap: "Avoid.", catnip: "Avoid.", yarrow: "Avoid.", hyssop: "Avoid.",
      horehound: "Avoid.", hops: "Contains a strong plant estrogen.", "st-johns-wort": "Avoid.", "saw-palmetto": "Hormonal effects.", chasteberry: "Hormonal effects.", "gotu-kola": "Avoid.",
      schisandra: "Avoid.", reishi: "Avoid.", juniper: "Avoid.", lovage: "Avoid.", feverfew: "Avoid.", meadowsweet: "Avoid.", neem: "Avoid.",
      horsetail: "Avoid.", "yerba-mate": "High caffeine — limit.", tarragon: "Avoid medicinal amounts.", rosemary: "Avoid medicinal amounts.",
      "fruit:papaya": "Unripe green papaya contains latex that may trigger contractions.", "fruit:bitter-melon": "Avoid during pregnancy."
    },
    caution: {
      ginger: "Up to about 1 g dried a day is generally considered safe for morning sickness — ask your midwife.",
      "raspberry-leaf": "Only with your midwife's guidance, usually in the third trimester.",
      turmeric: "Food amounts are fine; avoid supplements.", "green-tea": "Limit caffeine to 200 mg a day.", fennel: "Food amounts only.",
      nutmeg: "Culinary pinches only.", saffron: "Culinary amounts only.", "black-seed": "Food amounts only.", marjoram: "Food amounts only.",
      cinnamon: "Food amounts only.", "fruit:date": "Eating dates in late pregnancy may help labor — talk to your midwife.", "fruit:pineapple": "Normal amounts are safe; avoid bromelain supplements."
    }
  },
  {
    id: "breastfeeding", type: "condition", label: "Breastfeeding", examples: "",
    avoid: { sage: "May reduce milk supply.", "st-johns-wort": "Passes into milk.", ginseng: "Not enough safety information.", chasteberry: "May reduce milk supply.", "red-clover": "Hormonal effects.", licorice: "Avoid large amounts." },
    caution: { peppermint: "Large amounts may reduce milk supply.", parsley: "Large amounts may reduce milk supply.", fenugreek: "Commonly used to support milk — can upset baby's stomach; talk to a lactation consultant.", fennel: "Used for milk supply; avoid fennel oil.", valerian: "Not well studied." }
  },
  {
    id: "children", type: "condition", label: "For a child or baby", examples: "",
    avoid: {
      eucalyptus: "Oil is dangerous for young children — never near the face or swallowed.", "tea-tree": "Toxic if swallowed.", neem: "Neem oil can be fatal to children.",
      "star-anise": "Never give to babies.", nutmeg: "Toxic in larger amounts.", meadowsweet: "Salicylates — risk of Reye's syndrome under 16.",
      "st-johns-wort": "Not for children.", ginseng: "Not for children.", licorice: "Avoid.", "fruit:lychee": "Never give unripe lychee or lychee on an empty stomach.",
      "fruit:ackee": "Unripe ackee is poisonous."
    },
    caution: {
      peppermint: "Never apply peppermint oil near a baby's or young child's face.", chamomile: "Weak tea is traditionally used — ask your pediatrician.",
      valerian: "Not recommended under 3.", "fruit:grape": "Cut lengthwise for young children to prevent choking.", "fruit:cherry": "Pit cherries for children.",
      "fruit:honeydew": "Wash rind well.", elderberry: "Syrup with honey is not for babies under 1."
    }
  },
  {
    id: "surgery", type: "condition", label: "Surgery in the next 2 weeks", examples: "",
    avoid: { ginkgo: "Increases bleeding.", garlic: "Supplements increase bleeding.", ginseng: "Affects bleeding and blood sugar.", feverfew: "Increases bleeding.", reishi: "Increases bleeding.", valerian: "Interacts with anesthesia — taper off.", "st-johns-wort": "Interacts with anesthesia medicines." },
    caution: { ginger: "Supplements may increase bleeding.", turmeric: "Supplements may increase bleeding.", fenugreek: "May affect bleeding and blood sugar.", "black-seed": "May slow clotting.", cumin: "May affect blood sugar." }
  },
  {
    id: "liver", type: "condition", label: "Liver disease", examples: "",
    avoid: { ashwagandha: "Rare cases of liver injury.", skullcap: "Products contaminated with germander can harm the liver.", "gotu-kola": "Avoid with liver disease.", "fruit:noni": "Rare reports of liver injury." },
    caution: { "green-tea": "High-dose extracts linked to liver injury; tea is fine.", turmeric: "High-dose supplements rarely linked to liver injury.", cinnamon: "Cassia's coumarin can harm the liver.", reishi: "Rare liver problems with powder.", "milk-thistle": "Used for the liver — but only under your doctor's care." }
  },
  {
    id: "kidney", type: "condition", label: "Kidney disease", examples: "",
    avoid: { "fruit:starfruit": "Contains a toxin that damaged kidneys cannot remove — can be fatal.", "fruit:noni": "Very high in potassium.", juniper: "Can irritate the kidneys.", licorice: "Affects potassium and fluid balance.", horsetail: "Avoid.", lovage: "Avoid." },
    caution: { parsley: "Avoid large amounts.", "fruit:banana": "High in potassium — follow your kidney diet.", "fruit:coconut": "Coconut water is high in potassium.", "fruit:avocado": "High in potassium.", cranberry: "May increase kidney stone risk.", "rose-hips": "High vitamin C may increase kidney stones.", "fruit:acerola": "Very high vitamin C." }
  },
  {
    id: "high-bp", type: "condition", label: "High blood pressure", examples: "",
    avoid: { licorice: "Raises blood pressure." },
    caution: { ginseng: "May raise blood pressure.", "yerba-mate": "Caffeine.", "green-tea": "Caffeine.", "fruit:olive": "Cured olives are high in salt." }
  },
  {
    id: "autoimmune", type: "condition", label: "Autoimmune condition", examples: "lupus, rheumatoid arthritis, MS, Hashimoto's, type 1 diabetes",
    avoid: { echinacea: "Stimulates the immune system.", astragalus: "Stimulates the immune system." },
    caution: { elderberry: "Stimulates the immune system.", elderflower: "May stimulate the immune system.", ashwagandha: "May stimulate the immune system.", reishi: "Affects immune activity." }
  },
  {
    id: "hormone-sensitive", type: "condition", label: "Hormone-sensitive condition", examples: "breast, uterine, ovarian or prostate cancer, endometriosis, fibroids",
    avoid: { "red-clover": "Plant estrogens.", hops: "Strong plant estrogen.", chasteberry: "Hormonal effects.", "saw-palmetto": "Hormonal effects." },
    caution: { fennel: "Weak estrogen-like effects.", anise: "Weak estrogen-like effects.", licorice: "May affect hormones.", fenugreek: "May affect hormones.", ashwagandha: "May raise testosterone." }
  },
  {
    id: "daisy-allergy", type: "condition", label: "Ragweed, daisy or marigold allergy", examples: "",
    avoid: {},
    caution: { chamomile: "Same plant family.", echinacea: "Same plant family.", calendula: "Same plant family.", dandelion: "Same plant family.", burdock: "Same plant family.", "milk-thistle": "Same plant family.", yarrow: "Same plant family.", feverfew: "Same plant family.", arnica: "Same plant family.", chicory: "Same plant family.", tarragon: "Same plant family." }
  },
  {
    id: "latex-allergy", type: "condition", label: "Latex allergy", examples: "",
    avoid: {},
    caution: { "fruit:avocado": "Common cross-reaction.", "fruit:banana": "Common cross-reaction.", "fruit:kiwi": "Common cross-reaction.", "fruit:papaya": "Possible cross-reaction.", "fruit:passion-fruit": "Possible cross-reaction.", "fruit:fig": "Possible cross-reaction.", "fruit:jackfruit": "Possible cross-reaction.", "fruit:breadfruit": "Possible cross-reaction." }
  },
  {
    id: "aspirin-allergy", type: "condition", label: "Aspirin allergy or sensitivity", examples: "",
    avoid: { meadowsweet: "Contains salicylates." },
    caution: { "fruit:tamarind": "May increase aspirin absorption." }
  },
  {
    id: "gallstones", type: "condition", label: "Gallstones or gallbladder problems", examples: "",
    avoid: {},
    caution: { turmeric: "Stimulates the gallbladder.", dandelion: "Stimulates bile flow.", chicory: "Stimulates bile flow.", ginger: "Ask your doctor first.", cardamom: "Large amounts may trigger pain." }
  },
  {
    id: "epilepsy", type: "condition", label: "Epilepsy or seizures", examples: "",
    avoid: { hyssop: "The oil can trigger seizures.", sage: "Thujone can trigger seizures in large amounts." },
    caution: { rosemary: "Avoid rosemary essential oil.", ginkgo: "Rare reports of seizures.", schisandra: "Traditional caution.", "fruit:starfruit": "Can cause seizures in kidney disease." }
  },
  {
    id: "bipolar", type: "condition", label: "Bipolar disorder", examples: "",
    avoid: { "st-johns-wort": "May trigger mania.", rhodiola: "May trigger mania." },
    caution: { ginseng: "May trigger mania.", saffron: "Affects mood." }
  },
  {
    id: "reflux", type: "condition", label: "Heartburn or acid reflux", examples: "",
    avoid: {},
    caution: { peppermint: "Relaxes the valve at the top of the stomach.", "fruit:orange": "Citrus may trigger heartburn.", "fruit:grapefruit": "Citrus may trigger heartburn.", "fruit:lemon": "Acidic.", "fruit:tomato": "May trigger heartburn.", cayenne: "May worsen reflux.", turmeric: "May worsen reflux.", schisandra: "Traditional caution." }
  }
];

// ---------- Extra medicine groups ----------
INTERACTIONS.splice(INTERACTIONS.findIndex((x) => x.type === "condition"), 0,
  {
    id: "pain-relievers", type: "med", label: "Anti-inflammatory pain relievers (NSAIDs)", examples: "ibuprofen (Advil, Motrin), naproxen (Aleve), diclofenac, celecoxib (Celebrex), meloxicam",
    avoid: { meadowsweet: "Contains salicylates — doubles up on the same effect and stomach risk." },
    caution: {
      ginkgo: "Both can increase bleeding.", garlic: "Supplements may add to bleeding risk.", ginger: "Large amounts may add to bleeding risk.",
      turmeric: "Supplements may add to bleeding and stomach irritation.", feverfew: "May add to bleeding risk.", "black-seed": "May slow clotting.",
      "fruit:tamarind": "May increase absorption of some pain relievers."
    }
  },
  {
    id: "stimulants", type: "med", label: "ADHD stimulants", examples: "methylphenidate (Ritalin, Concerta), amphetamine (Adderall, Vyvanse)",
    avoid: {},
    caution: {
      "green-tea": "Caffeine adds to stimulant effects — racing heart, jitters, poor sleep.", "yerba-mate": "Caffeine adds to stimulant effects.",
      ginseng: "May add to stimulation and raise blood pressure.", rhodiola: "May add to stimulation.", "fruit:grapefruit": "May change levels of some stimulants."
    }
  }
);

INTERACTIONS.push({
  id: "older-adults", type: "condition", label: "Age 65 or older", examples: "",
  avoid: { licorice: "Raises blood pressure and lowers potassium — risky with heart and kidney changes of aging." },
  caution: {
    valerian: "Drowsiness raises the risk of falls.", passionflower: "Drowsiness raises the risk of falls.", hops: "Drowsiness raises the risk of falls.",
    skullcap: "Drowsiness raises the risk of falls.", ginkgo: "Bleeding risk, especially with aspirin or blood thinners.", garlic: "Supplements may increase bleeding.",
    "st-johns-wort": "Interacts with many common medicines.", ginseng: "May affect blood pressure and blood sugar.", hawthorn: "Adds to heart medicines.",
    dandelion: "Diuretic — can cause dehydration.", horsetail: "Diuretic and lowers potassium.", "fruit:grapefruit": "Interacts with many common medicines for older adults.",
    "fruit:starfruit": "Dangerous if kidney function is reduced."
  }
});

// Plain-language detail for each medicine group or situation: what could happen, and what to do.
const IX_DETAILS = {
  "blood-thinners": { what: "Some herbs also thin the blood or change how blood thinners work. Together they can cause easy bruising, nosebleeds, bleeding gums — or dangerous internal bleeding. Others make warfarin weaker, raising the risk of clots and stroke.", todo: "Don't start any herb or supplement without asking the doctor or clinic that manages your blood thinner. Keep vitamin K foods (greens, parsley) steady from day to day. Get help right away for black stools, blood in urine, a bad headache or bleeding that won't stop." },
  "pain-relievers": { what: "NSAIDs already thin the blood a little and can irritate the stomach. Herbs that do the same can add up, raising the risk of stomach bleeding and bruising.", todo: "Use the lowest NSAID dose for the shortest time, take it with food, and check with a pharmacist before adding herbs that affect bleeding." },
  diabetes: { what: "Many herbs gently lower blood sugar. On top of diabetes medicine — especially insulin or sulfonylureas like glipizide — this can push blood sugar too low (shakiness, sweating, confusion).", todo: "Add one herb at a time, check your blood sugar more often for the first two weeks, and tell your doctor. Keep a fast-acting sugar nearby." },
  "blood-pressure": { what: "Some herbs lower blood pressure, which can add to your medicine and cause dizziness or fainting. Others — like licorice — raise blood pressure and work against your medicine. Grapefruit can make some blood pressure pills much stronger.", todo: "Check your blood pressure at home when you start an herb, stand up slowly, and ask your doctor before combining. Avoid grapefruit if you take amlodipine, felodipine or nifedipine." },
  antidepressants: { what: "St. John's wort plus an antidepressant can cause serotonin syndrome: agitation, fast heartbeat, high temperature, muscle twitching. Other herbs can change mood medicines or add to their effects.", todo: "Never combine St. John's wort with antidepressants. Talk to your prescriber before adding any mood herb, and don't stop antidepressants suddenly. Seek emergency care for serotonin syndrome symptoms." },
  sedatives: { what: "Calming herbs add to the drowsiness from sleep medicines, anxiety medicines, opioid pain relievers and alcohol. This can slow breathing and cause falls or car accidents.", todo: "Don't combine calming herbs with sleep or anxiety medicines or alcohol unless your doctor agrees. Never drive after taking them together." },
  stimulants: { what: "Caffeine-containing and energizing herbs add to stimulant medicines, causing a racing heart, anxiety, high blood pressure and poor sleep.", todo: "Limit caffeine from tea and mate, avoid energizing herbs, and ask the prescriber before adding any." },
  hormones: { what: "St. John's wort speeds up how the body clears birth control hormones, which can cause breakthrough bleeding and unplanned pregnancy. Herbs with hormone-like effects may interfere with hormone therapy or fertility treatment.", todo: "Avoid St. John's wort entirely with hormonal birth control — or use a backup method. Tell your fertility or menopause doctor about every herb you take." },
  thyroid: { what: "Some herbs change thyroid hormone levels or how well thyroid medicine is absorbed, which can make you feel hyper (jittery) or hypo (tired).", todo: "Take thyroid medicine on an empty stomach, apart from herbs and supplements, and recheck thyroid blood tests 6–8 weeks after starting an herb." },
  immunosuppressants: { what: "Herbs that stimulate the immune system work against these medicines. St. John's wort and grapefruit change transplant drug levels, which can lead to organ rejection or toxicity.", todo: "Transplant patients should avoid all herbal supplements unless their transplant team approves. Others should check with their specialist first." },
  lithium: { what: "Diuretic herbs and changes in caffeine change how the kidneys clear lithium. Lithium levels can rise to toxic levels (shaking, confusion, vomiting).", todo: "Don't add diuretic herbs. Keep caffeine and fluid intake steady, and get lithium levels checked if anything changes." },
  diuretics: { what: "Herbs that also make you pass water can add to dehydration and low potassium. Licorice drains potassium further, which can cause dangerous heart rhythms.", todo: "Avoid licorice. Ask your doctor before diuretic herbs, and watch for dizziness, cramps or weakness." },
  heart: { what: "Licorice and diuretic herbs lower potassium, making digoxin more toxic. Hawthorn adds to heart medicines. St. John's wort lowers digoxin levels.", todo: "Only use heart-related herbs under your cardiologist's care, and report any palpitations or dizziness." },
  statins: { what: "Grapefruit and pomelo block the enzyme that breaks down several statins, raising levels and the risk of muscle damage. St. John's wort can make some statins weaker.", todo: "Avoid grapefruit with simvastatin, lovastatin and atorvastatin. Report unexplained muscle pain or dark urine to your doctor." },
  "liver-processed": { what: "Most prescription medicines are broken down by liver enzymes. St. John's wort speeds these enzymes up (medicines stop working well); grapefruit slows some down (medicines build up).", todo: "Ask your pharmacist about each herb and fruit juice you use — they can check your exact medicines." },
  pregnancy: { what: "Some herbs can stimulate the womb, act like hormones, or harm a developing baby. Others are fine in food amounts but not as teas, capsules or extracts.", todo: "Stick to food amounts of culinary herbs, ask your midwife or doctor before any herbal tea or supplement, and never use essential oils by mouth. See the pregnancy guide for trimester-by-trimester tips." },
  breastfeeding: { what: "Many herbs pass into breast milk, and a few (like sage and peppermint in large amounts) may reduce milk supply.", todo: "Use food amounts, introduce one herbal tea at a time, and watch your baby for fussiness, rash or changes in feeding. Ask a lactation consultant before using herbs for milk supply." },
  children: { what: "Children's bodies process herbs differently, and some — like eucalyptus oil, neem oil and star anise — can be dangerous even in small amounts.", todo: "Ask your pediatrician before giving any herb. Never give honey under age 1, never put essential oils near a young child's face, and keep all oils and supplements locked away." },
  surgery: { what: "Herbs that thin the blood, change blood sugar or interact with anesthesia can cause bleeding or complications during and after surgery.", todo: "Stop herbal supplements 2 weeks before surgery (or as your surgeon advises) and tell your surgical team everything you take." },
  liver: { what: "A few herbs have rare links to liver injury, and a damaged liver clears herbs and medicines more slowly.", todo: "Avoid the herbs listed, don't take high-dose extracts, and ask your liver specialist before using anything new. Report yellow skin, dark urine or tummy pain right away." },
  kidney: { what: "Weak kidneys can't clear potassium, oxalate or certain toxins well. Starfruit can be fatal, and high-potassium foods need to follow your kidney diet.", todo: "Never eat starfruit, follow your kidney diet for potassium, and ask your nephrologist before any herb." },
  "high-bp": { what: "Licorice, ginseng and caffeine-containing herbs can raise blood pressure.", todo: "Avoid licorice and check your blood pressure if you use energizing herbs." },
  autoimmune: { what: "Immune-boosting herbs may stir up an overactive immune system and trigger flares.", todo: "Avoid immune stimulants like echinacea and astragalus, and ask your specialist first." },
  "hormone-sensitive": { what: "Herbs with estrogen-like or hormonal effects could, in theory, feed hormone-sensitive tissue.", todo: "Avoid hormonal herbs and discuss any herb with your oncologist or gynecologist." },
  "daisy-allergy": { what: "Herbs from the daisy family can trigger the same allergy — itching, rash, wheezing or, rarely, a severe reaction.", todo: "Avoid these herbs or try a tiny amount first. Get emergency help for swelling of the face or trouble breathing." },
  "latex-allergy": { what: "Proteins in some fruits look like latex to the immune system (latex-fruit syndrome), causing itching, swelling or worse.", todo: "Be careful with these fruits, and carry your emergency medicine if you've had a severe latex reaction." },
  "aspirin-allergy": { what: "Meadowsweet contains natural salicylates, the same family as aspirin.", todo: "Avoid meadowsweet entirely." },
  gallstones: { what: "Herbs that stimulate bile can trigger gallbladder pain if a stone blocks the duct.", todo: "Ask your doctor before using bile-stimulating herbs." },
  epilepsy: { what: "A few herbs and essential oils can lower the seizure threshold.", todo: "Avoid hyssop and sage in medicinal amounts and never use rosemary oil internally." },
  bipolar: { what: "Some mood herbs can trigger mania or interact with mood stabilizers.", todo: "Avoid St. John's wort and rhodiola, and ask your psychiatrist about any herb." },
  reflux: { what: "Some herbs and acidic fruits relax the valve at the top of the stomach or irritate it.", todo: "Notice your triggers, try smaller portions, and choose gentler options like chamomile or ginger." },
  "older-adults": { what: "With age the body clears herbs and medicines more slowly, and many people take several medicines. Drowsiness can lead to falls, and bleeding risk rises.", todo: "Bring every bottle — prescriptions, herbs, vitamins — to a pharmacist for a 'brown bag' review once a year." }
};
