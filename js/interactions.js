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
