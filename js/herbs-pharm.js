// What each herb does in the body, how it works chemically, and typical adult doses.
//
// body:  [body system, what it does]
// chem:  [compound, type of compound, how it works]
// dose:  [form, min grams, max grams, how often]  — amounts are per serving, in grams.
//        If min is a string, it is shown as written (e.g. drops or ml).
// daily: [min grams, max grams] total per day, or null.
// limit: how long to use it / maximum.
// ext:   true when the herb is for use on the skin only, not to be swallowed.
//
// Doses are typical adult amounts drawn from traditional references (such as the German
// Commission E and ESCOP monographs) and doses used in clinical studies. They are for adults
// of about 100 lb (45 kg) and over and are not scaled up or down by body weight.

const PHARM = {
  chamomile: {
    body: [["Nervous system", "Gently calms and eases the body toward sleep."], ["Digestive system", "Relaxes cramping gut muscles and eases gas."], ["Skin", "Reduces redness and irritation."]],
    chem: [["Apigenin", "Flavonoid", "Binds to the benzodiazepine site on GABA-A receptors in the brain, mildly increasing the calming effect of GABA."], ["α-Bisabolol", "Sesquiterpene alcohol", "Lowers inflammatory prostaglandins and helps protect the stomach lining; also helps other compounds pass into the skin."], ["Chamazulene", "Sesquiterpene (forms when steamed)", "Blocks the formation of leukotrienes, inflammatory messengers, and acts as an antioxidant."]],
    dose: [["Dried flowers as tea (per cup)", 2, 3, "3–4 times a day"], ["Extract capsules", 0.22, 0.5, "1–3 times a day"]],
    daily: [6, 12], limit: "Safe for regular use."
  },
  peppermint: {
    body: [["Digestive system", "Relaxes intestinal muscle, easing spasms, gas and bloating."], ["Nervous system", "Cools and dulls pain signals when applied to the skin."], ["Respiratory system", "Creates a feeling of clearer airflow."]],
    chem: [["Menthol", "Monoterpene alcohol", "Activates TRPM8 'cold' receptors (the cooling feeling) and blocks calcium channels in gut smooth muscle so it can't contract as hard."], ["Menthone", "Monoterpene ketone", "Adds to the antispasmodic and antimicrobial effect."], ["Rosmarinic acid", "Polyphenol", "Antioxidant and mildly anti-allergic."]],
    dose: [["Dried leaf as tea (per cup)", 1.5, 3, "3 times a day"], ["Enteric-coated oil capsules (for IBS)", 0.18, 0.2, "3 times a day, before meals"]],
    daily: [4.5, 9], limit: "Oil capsules: usually taken for up to 8–12 weeks."
  },
  spearmint: {
    body: [["Digestive system", "Gently relaxes the gut after meals."], ["Hormonal system", "May lower free testosterone in women with PCOS."], ["Mouth", "Freshens breath."]],
    chem: [["Carvone", "Monoterpene ketone", "Relaxes smooth muscle in the digestive tract and gives the sweet minty scent."], ["Rosmarinic acid", "Polyphenol", "Antioxidant and anti-inflammatory."], ["Limonene", "Monoterpene", "Mild antimicrobial and helps move food through the stomach."]],
    dose: [["Dried leaf as tea (per cup)", 1, 2, "2 times a day"]],
    daily: [2, 4], limit: "Safe in tea amounts for regular use."
  },
  ginger: {
    body: [["Digestive system", "Settles nausea and helps the stomach empty."], ["Musculoskeletal system", "Eases joint and muscle pain."], ["Circulation", "Warms and slightly thins the blood."]],
    chem: [["Gingerols", "Phenolic ketones", "Block serotonin 5-HT3 receptors in the gut (the same target as anti-nausea medicines) and inhibit COX and LOX inflammation enzymes."], ["Shogaols", "Phenolic ketones (form on drying)", "Stronger anti-inflammatory and antioxidant versions of gingerols."], ["Zingerone", "Phenolic compound", "Formed on cooking; antioxidant and soothing to the gut."]],
    dose: [["Dried root powder (capsule)", 0.25, 0.5, "2–4 times a day"], ["Fresh root, sliced, as tea (per cup)", 2, 4, "2–3 times a day"]],
    daily: [1, 4], limit: "Daily total is for dried ginger — do not exceed about 4 g a day (fresh root weighs about 4–5 times more). In pregnancy keep to 1 g dried a day or less."
  },
  turmeric: {
    body: [["Musculoskeletal system", "Eases joint pain and stiffness."], ["Digestive system", "Stimulates bile flow and digestion."], ["Whole body", "Protects cells as an antioxidant."]],
    chem: [["Curcumin", "Curcuminoid (polyphenol)", "Switches off NF-κB, a master control for inflammation, lowers COX-2, and switches on Nrf2, the cell's antioxidant defense."], ["Demethoxycurcumins", "Curcuminoids", "Similar but milder anti-inflammatory activity."], ["Turmerones", "Sesquiterpenes", "Aromatic oils that may help curcumin absorb and support brain cells."]],
    dose: [["Ground turmeric in food", 1, 3, "Daily, divided among meals"], ["Curcumin extract (with black pepper)", 0.5, 0.5, "1–2 times a day with food"]],
    daily: [1, 3], limit: "Curcumin extracts: usually up to 1–1.5 g a day; take with fat and black pepper."
  },
  lavender: {
    body: [["Nervous system", "Calms anxiety and supports sleep."], ["Skin", "Soothes minor burns and bites."], ["Digestive system", "Eases nervous stomach upset."]],
    chem: [["Linalool", "Monoterpene alcohol", "Increases the calming effect of GABA and lowers excitatory glutamate signaling; works when inhaled or swallowed."], ["Linalyl acetate", "Ester", "Relaxes smooth muscle and has anti-inflammatory effects."], ["Camphor (small amounts)", "Monoterpene ketone", "Gives a fresh, slightly medicinal note; mildly antiseptic."]],
    dose: [["Dried flowers as tea (per cup)", 1, 2, "Up to 3 times a day"], ["Lavender oil capsules (Silexan)", 0.08, 0.08, "Once a day"], ["Essential oil for inhaling", "2–4 drops", null, "On a cloth or diffuser — never swallow"]],
    daily: [1, 6], limit: "Never swallow essential oil from a bottle. Daily total refers to dried flowers."
  },
  rosemary: {
    body: [["Nervous system", "Supports alertness and memory."], ["Skin & hair", "Improves scalp circulation for hair growth."], ["Digestive system", "Stimulates digestion of fats."]],
    chem: [["1,8-Cineole", "Monoterpene oxide", "Enters the blood when inhaled and inhibits acetylcholinesterase, which may leave more of the memory messenger acetylcholine."], ["Carnosic acid", "Diterpene", "Powerful antioxidant that switches on Nrf2 protection in cells."], ["Rosmarinic acid", "Polyphenol", "Anti-inflammatory and antioxidant."]],
    dose: [["Dried leaf as tea (per cup)", 1, 2, "Up to 3 times a day"], ["Essential oil for the scalp", "3–5 drops in 1 tbsp carrier oil", null, "2–3 times a week"]],
    daily: [3, 6], limit: "Avoid medicinal doses in pregnancy."
  },
  thyme: {
    body: [["Respiratory system", "Loosens mucus and calms coughing."], ["Immune system", "May help fight germs in the mouth and throat."], ["Digestive system", "Relieves gas."]],
    chem: [["Thymol", "Phenolic monoterpene", "Breaks open bacterial and fungal cell membranes and relaxes the smooth muscle of the airways."], ["Carvacrol", "Phenolic monoterpene", "Strong antimicrobial that also helps the tiny hairs (cilia) in the airways clear mucus."], ["Luteolin and other flavonoids", "Flavonoids", "Anti-inflammatory and antispasmodic."]],
    dose: [["Dried herb as tea (per cup)", 1, 2, "3–4 times a day"]],
    daily: [3, 10], limit: "Short-term use during coughs and colds."
  },
  sage: {
    body: [["Hormonal / nervous system", "Reduces hot flushes and sweating."], ["Mouth & throat", "Soothes and disinfects sore throats."], ["Brain", "May support memory and attention."]],
    chem: [["Rosmarinic acid & carnosol", "Polyphenol / diterpene", "Antioxidant, anti-inflammatory, and inhibit acetylcholinesterase (supporting memory signaling)."], ["Tannins", "Polyphenols", "Astringent: tighten tissue and reduce secretions, including sweat."], ["Thujone", "Monoterpene ketone", "Blocks GABA-A receptors — harmless in food amounts, but too much can cause seizures."]],
    dose: [["Dried leaf as tea (per cup)", 1, 2, "Up to 3 times a day"], ["Gargle (per 100 ml water)", 2.5, 2.5, "Several times a day"], ["Fresh sage extract tablet (hot flushes)", 0.28, 0.28, "Once a day"]],
    daily: [3, 6], limit: "Avoid long-term medicinal use (more than about 4 weeks) because of thujone."
  },
  oregano: {
    body: [["Immune system", "Antimicrobial activity against bacteria and fungi."], ["Respiratory system", "Eases coughs and congestion."], ["Whole body", "High antioxidant content."]],
    chem: [["Carvacrol", "Phenolic monoterpene", "Damages microbial cell membranes so bacteria and fungi leak and die."], ["Thymol", "Phenolic monoterpene", "Works alongside carvacrol as an antiseptic."], ["Rosmarinic acid", "Polyphenol", "Antioxidant and anti-inflammatory."]],
    dose: [["Dried leaf as tea (per cup)", 1, 2, "Up to 3 times a day"], ["In cooking", 0.5, 1, "As desired"]],
    daily: [1, 6], limit: "Oregano oil is very strong — use only diluted, short-term, and not in pregnancy."
  },
  basil: {
    body: [["Digestive system", "Relieves gas and bloating."], ["Whole body", "Anti-inflammatory and antioxidant."], ["Blood", "Provides vitamin K for clotting."]],
    chem: [["Eugenol", "Phenylpropanoid", "Inhibits COX enzymes that make inflammatory prostaglandins."], ["Linalool", "Monoterpene alcohol", "Relaxes the gut and calms."], ["Orientin & vicenin", "Flavonoids", "Protect cells and DNA from oxidative damage."]],
    dose: [["Dried leaf as tea (per cup)", 1, 2, "2–3 times a day"], ["Fresh leaves in food", 2, 5, "As desired"]],
    daily: [2, 6], limit: "Food amounts are safe."
  },
  "holy-basil": {
    body: [["Stress response (adrenal)", "Helps moderate cortisol and stress."], ["Metabolism", "May lower blood sugar."], ["Immune & respiratory", "Supports defenses during colds."]],
    chem: [["Eugenol", "Phenylpropanoid", "Anti-inflammatory (COX inhibition) and antimicrobial."], ["Ursolic acid", "Triterpene", "Anti-inflammatory and may improve insulin sensitivity."], ["Rosmarinic acid", "Polyphenol", "Antioxidant and anti-anxiety effects in studies."]],
    dose: [["Dried leaf as tea (per cup)", 2, 3, "1–2 times a day"], ["Leaf extract capsules", 0.3, 0.5, "2 times a day"]],
    daily: null, limit: "Studied for up to 8–12 weeks."
  },
  parsley: {
    body: [["Urinary system", "Mild diuretic."], ["Blood & bones", "Rich in vitamin K for clotting and bone health."], ["Digestive system", "Freshens breath and aids digestion."]],
    chem: [["Apiol & myristicin", "Phenylpropanoids", "Increase urine flow; in large amounts stimulate the uterus, which is why high doses are unsafe in pregnancy."], ["Apigenin", "Flavonoid", "Anti-inflammatory and mildly calming."], ["Vitamin K1", "Vitamin", "Needed to make blood-clotting proteins and bone proteins."]],
    dose: [["Fresh leaves in food", 5, 10, "Daily"], ["Dried leaf as tea (per cup)", 2, 2, "Up to 3 times a day"]],
    daily: [2, 6], limit: "Avoid parsley seed, oil and large medicinal amounts in pregnancy."
  },
  coriander: {
    body: [["Digestive system", "Eases gas, cramping and IBS discomfort."], ["Metabolism", "May help regulate blood sugar."], ["Whole body", "Antioxidant vitamins in the leaves."]],
    chem: [["Linalool", "Monoterpene alcohol", "Main oil of the seed; relaxes intestinal muscle and calms."], ["Petroselinic acid", "Fatty acid", "Anti-inflammatory fatty acid in the seed oil."], ["Quercetin", "Flavonoid", "Antioxidant in the fresh leaves."]],
    dose: [["Crushed seed as tea (per cup)", 1, 1, "Up to 3 times a day"], ["Fresh leaves in food", 2, 10, "As desired"]],
    daily: [1, 3], limit: "Food and tea amounts are safe."
  },
  dill: {
    body: [["Digestive system", "Relieves gas and colic."], ["Immune system", "Mild antimicrobial effect."], ["Bones", "Seeds provide calcium."]],
    chem: [["Carvone", "Monoterpene ketone", "Relaxes smooth muscle in the digestive tract."], ["Limonene", "Monoterpene", "Supports digestion and is mildly antimicrobial."], ["Dillapiole", "Phenylpropanoid", "Antimicrobial and antispasmodic."]],
    dose: [["Crushed seed as tea (per cup)", 1, 3, "Up to 3 times a day"]],
    daily: [1, 3], limit: "Food and tea amounts are safe."
  },
  fennel: {
    body: [["Digestive system", "Relaxes the gut and expels gas."], ["Reproductive system", "Eases menstrual cramps; traditionally supports milk supply."], ["Respiratory system", "Loosens mucus."]],
    chem: [["trans-Anethole", "Phenylpropanoid", "Relaxes smooth muscle (antispasmodic) and has weak estrogen-like activity."], ["Fenchone", "Monoterpene ketone", "Gives a bitter-camphor note; antimicrobial and helps loosen mucus."], ["Estragole", "Phenylpropanoid", "Natural flavor compound; avoid concentrated amounts long-term."]],
    dose: [["Crushed seed as tea (per cup)", 1.5, 2.5, "3 times a day"]],
    daily: [5, 7], limit: "Do not use fennel oil internally; avoid long-term use in infants."
  },
  "lemon-balm": {
    body: [["Nervous system", "Calms anxiety and lifts mood."], ["Sleep", "Improves sleep quality, especially with valerian."], ["Skin", "Speeds healing of cold sores (topical)."]],
    chem: [["Rosmarinic acid", "Polyphenol", "Inhibits GABA transaminase, the enzyme that breaks down GABA, so more of this calming messenger stays active."], ["Citral & citronellal", "Monoterpene aldehydes", "Give the lemon scent; calming and antispasmodic."], ["Caffeic acid derivatives", "Polyphenols", "Block the herpes virus from attaching to cells (cold sores)."]],
    dose: [["Dried leaf as tea (per cup)", 1.5, 4.5, "Several times a day"], ["Extract capsules", 0.3, 0.6, "1–2 times a day"]],
    daily: [1.5, 9], limit: "Safe for regular use."
  },
  lemongrass: {
    body: [["Digestive system", "Calms the stomach and eases cramps."], ["Nervous system", "Traditionally calming."], ["Immune system", "Antimicrobial and antifungal."]],
    chem: [["Citral (geranial + neral)", "Monoterpene aldehydes", "Antispasmodic, antimicrobial and responsible for the lemon aroma."], ["Myrcene", "Monoterpene", "Mild pain-relieving and relaxing effects in studies."], ["Geraniol", "Monoterpene alcohol", "Antimicrobial and anti-inflammatory."]],
    dose: [["Fresh or dried stalk as tea (per cup)", 2, 3, "Up to 3 times a day"]],
    daily: [2, 9], limit: "Food and tea amounts are safe."
  },
  "lemon-verbena": {
    body: [["Muscles", "Antioxidant protection after exercise."], ["Nervous system", "Relaxing evening tea."], ["Digestive system", "Eases indigestion."]],
    chem: [["Verbascoside (acteoside)", "Phenylpropanoid glycoside", "Strong antioxidant that reduces muscle damage markers after exercise."], ["Citral", "Monoterpene aldehydes", "Lemon aroma; antispasmodic."], ["Limonene", "Monoterpene", "Supports digestion."]],
    dose: [["Dried leaf as tea (per cup)", 1.5, 3, "Up to 3 times a day"]],
    daily: [1.5, 9], limit: "Safe in tea amounts."
  },
  garlic: {
    body: [["Heart & blood vessels", "Relaxes vessels to lower blood pressure; improves cholesterol."], ["Blood", "Makes platelets less sticky."], ["Immune system", "Antimicrobial and immune supporting."]],
    chem: [["Allicin", "Sulfur compound (thiosulfinate)", "Formed when alliin meets the enzyme alliinase as garlic is crushed; antimicrobial and breaks down into other active sulfur compounds."], ["S-allyl cysteine", "Sulfur amino acid", "The stable active in aged garlic; helps blood vessels make nitric oxide so they relax."], ["Ajoene", "Sulfur compound", "Stops platelets from clumping, thinning the blood."]],
    dose: [["Fresh clove, crushed", 3, 4, "Once a day"], ["Aged garlic extract capsules", 0.6, 1.2, "Once a day"]],
    daily: null, limit: "Stop supplements 7 days before surgery."
  },
  cinnamon: {
    body: [["Metabolism", "May improve insulin sensitivity and blood sugar."], ["Digestive system", "Warms digestion and eases gas."], ["Whole body", "Antioxidant."]],
    chem: [["Cinnamaldehyde", "Phenylpropanoid aldehyde", "Gives the flavor; antimicrobial and stimulates digestion."], ["Type-A procyanidins", "Polyphenols", "May mimic insulin and help cells take up glucose."], ["Coumarin (mostly in cassia)", "Benzopyrone", "Can harm the liver in high regular amounts — the reason to prefer Ceylon cinnamon."]],
    dose: [["Ground Ceylon cinnamon in food or drink", 0.5, 2, "Daily"]],
    daily: [0.5, 3], limit: "Cassia cinnamon: keep to about 1 g (½ tsp) a day or less."
  },
  clove: {
    body: [["Mouth & teeth", "Numbs tooth and gum pain; antiseptic."], ["Digestive system", "Eases gas and nausea."], ["Whole body", "Extremely high in antioxidants."]],
    chem: [["Eugenol", "Phenylpropanoid", "Blocks sodium channels in nerves (a local anesthetic effect), inhibits COX enzymes, and kills bacteria."], ["β-Caryophyllene", "Sesquiterpene", "Activates CB2 receptors that calm inflammation without affecting the mind."], ["Tannins", "Polyphenols", "Astringent and antimicrobial."]],
    dose: [["Whole cloves in tea or cooking", 0.1, 0.3, "1–3 times a day"], ["Clove oil for a toothache", "1 drop diluted in ½ tsp carrier oil", null, "On a cotton ball, short-term"]],
    daily: null, limit: "Never swallow clove oil; keep away from children."
  },
  cardamom: {
    body: [["Digestive system", "Relieves gas and heaviness."], ["Heart & blood vessels", "May lower blood pressure."], ["Mouth", "May help fight bad-breath bacteria."]],
    chem: [["1,8-Cineole", "Monoterpene oxide", "Antispasmodic and antimicrobial; also helps loosen mucus."], ["α-Terpinyl acetate", "Ester", "The main aroma; relaxes the gut."], ["Limonene", "Monoterpene", "Supports digestion."]],
    dose: [["Ground cardamom in food or drink", 0.5, 1.5, "1–2 times a day"]],
    daily: [1, 3], limit: "Food amounts are safe."
  },
  nutmeg: {
    body: [["Nervous system", "Very small amounts are traditionally relaxing."], ["Digestive system", "Eases gas and loose stools."], ["Mouth", "Antibacterial."]],
    chem: [["Myristicin", "Phenylpropanoid", "Weakly inhibits MAO and affects the nervous system — calming in pinches, but toxic (hallucinations, racing heart) in large amounts."], ["Elemicin", "Phenylpropanoid", "Adds to the psychoactive effect at high doses."], ["Sabinene & pinene", "Monoterpenes", "Aromatic oils that aid digestion."]],
    dose: [["Freshly grated nutmeg in food or warm milk", 0.1, 0.5, "Once a day"]],
    daily: [0.1, 0.5], limit: "Never more than ½ g (about ⅛ tsp) a day. 5 g or more can be poisonous."
  },
  "black-pepper": {
    body: [["Digestive system", "Stimulates digestive enzymes and stomach acid."], ["Absorption", "Increases how much of other nutrients and medicines the body absorbs."], ["Whole body", "Antioxidant."]],
    chem: [["Piperine", "Alkaloid", "Inhibits liver and gut enzymes (CYP3A4, glucuronidation) and the P-glycoprotein pump, so compounds like curcumin stay in the body longer."], ["Piperine (heat)", "Alkaloid", "Activates TRPV1 heat receptors, which stimulates saliva and digestive juices."], ["β-Caryophyllene", "Sesquiterpene", "Anti-inflammatory via CB2 receptors."]],
    dose: [["Ground pepper in food", 0.5, 1, "With meals"], ["Piperine with turmeric/curcumin", 0.005, 0.02, "With each curcumin dose"]],
    daily: null, limit: "Piperine supplements can change medicine levels — ask your pharmacist."
  },
  cayenne: {
    body: [["Nerves (skin)", "Reduces pain signals when applied to the skin."], ["Metabolism", "Slightly increases calorie burning and fullness."], ["Circulation", "Warms by widening surface blood vessels."]],
    chem: [["Capsaicin", "Capsaicinoid (alkaloid)", "Activates TRPV1 heat-pain receptors; with repeated use, nerve endings run out of substance P, the messenger that carries pain, so pain is reduced."], ["Dihydrocapsaicin", "Capsaicinoid", "Works the same way as capsaicin."], ["Carotenoids (capsanthin)", "Pigments", "Antioxidants that give the red color."]],
    dose: [["Ground cayenne in food", 0.25, 1, "With meals"], ["Capsaicin cream (0.025–0.1%)", "Thin layer", null, "3–4 times a day on unbroken skin"]],
    daily: null, limit: "Pain relief from creams builds over 1–2 weeks of regular use."
  },
  cumin: {
    body: [["Digestive system", "Stimulates enzymes and bile; eases IBS symptoms."], ["Metabolism", "May support weight and cholesterol."], ["Blood", "Contributes iron."]],
    chem: [["Cuminaldehyde", "Monoterpene aldehyde", "Main aroma; stimulates digestive enzymes and is antimicrobial."], ["γ-Terpinene & p-cymene", "Monoterpenes", "Antioxidant and antispasmodic."], ["Flavonoids", "Polyphenols", "Antioxidant."]],
    dose: [["Ground cumin in food", 1, 3, "Daily, divided"], ["Cumin seed water (seeds simmered)", 1, 2, "1–2 times a day"]],
    daily: [1, 3], limit: "Food amounts are safe."
  },
  fenugreek: {
    body: [["Metabolism", "Slows sugar absorption and lowers blood sugar."], ["Breast tissue", "Traditionally increases milk supply."], ["Digestive system", "Soothes and softens stools."]],
    chem: [["Galactomannan", "Soluble fiber", "Forms a gel in the gut that slows the absorption of sugar and fat."], ["4-Hydroxyisoleucine", "Amino acid", "Stimulates the pancreas to release insulin when blood sugar is high."], ["Diosgenin", "Steroidal saponin", "A plant steroid with hormone-like effects; may explain the effect on milk supply."], ["Sotolon", "Lactone", "Gives the maple-syrup smell to sweat and urine."]],
    dose: [["Seed powder or capsules", 1, 2, "3 times a day"]],
    daily: [3, 6], limit: "Avoid in pregnancy. Blood sugar studies used up to 10 g a day under supervision."
  },
  anise: {
    body: [["Digestive system", "Relieves indigestion and gas."], ["Respiratory system", "Loosens mucus."], ["Hormonal system", "Weak estrogen-like effects."]],
    chem: [["trans-Anethole", "Phenylpropanoid", "Antispasmodic on gut muscle, expectorant, and weakly estrogenic."], ["Anisaldehyde", "Aldehyde", "Antimicrobial and aromatic."], ["Estragole", "Phenylpropanoid", "Minor flavor compound; avoid concentrated amounts."]],
    dose: [["Crushed seed as tea (per cup)", 1, 1, "Up to 3 times a day"]],
    daily: [1, 3], limit: "Do not use anise oil internally."
  },
  "star-anise": {
    body: [["Respiratory system", "Warming during coughs and colds."], ["Digestive system", "Relieves gas."], ["Immune system", "Mild antimicrobial."]],
    chem: [["trans-Anethole", "Phenylpropanoid", "Antispasmodic and expectorant."], ["Shikimic acid", "Organic acid", "Used as a starting material to make the flu drug oseltamivir; not antiviral as a spice."], ["Flavonoids", "Polyphenols", "Antioxidant."]],
    dose: [["Whole star (about 1 g) in tea or broth", 1, 1, "Up to 3 times a day"]],
    daily: [1, 3], limit: "Never give to babies. Buy only Chinese star anise (Illicium verum) from food suppliers."
  },
  licorice: {
    body: [["Throat & airways", "Soothes and loosens mucus."], ["Digestive system", "Protects the stomach lining."], ["Kidneys & blood pressure", "Whole licorice causes salt and water retention and potassium loss."]],
    chem: [["Glycyrrhizin", "Triterpene saponin", "Very sweet; turns into glycyrrhetinic acid, which blocks the enzyme 11β-HSD2. Cortisol then acts like aldosterone, holding on to sodium and losing potassium — raising blood pressure."], ["Liquiritigenin & isoliquiritigenin", "Flavonoids", "Anti-inflammatory and antispasmodic."], ["Glabridin", "Isoflavan", "Antioxidant and anti-inflammatory."]],
    dose: [["Dried root as tea (per cup)", 1, 2, "Up to 3 times a day"], ["DGL chewable tablets", 0.38, 0.76, "Before meals, 2–3 times a day"]],
    daily: [2, 5], limit: "Whole licorice: no more than 4–6 weeks; keep glycyrrhizin under 100 mg a day."
  },
  "marshmallow-root": {
    body: [["Throat", "Coats and soothes a dry cough."], ["Digestive system", "Protects an irritated stomach lining."], ["Skin", "Softens and soothes."]],
    chem: [["Mucilage polysaccharides", "Rhamnogalacturonans and arabinogalactans", "Swell in water and stick to mucous membranes, forming a protective film that calms the cough reflex and irritation."], ["Pectin", "Fiber", "Adds to the soothing gel."], ["Flavonoids", "Polyphenols", "Mild anti-inflammatory effects."]],
    dose: [["Root as a cold infusion (per cup)", 2, 5, "Up to 3 times a day"]],
    daily: [2, 6], limit: "Take other medicines 1–2 hours apart."
  },
  "slippery-elm": {
    body: [["Throat", "Soothes sore throats."], ["Digestive system", "Coats and calms the gut lining."], ["Skin", "Soothing poultice."]],
    chem: [["Mucilage", "Polysaccharides (hexoses, pentoses)", "Forms a slippery gel that coats irritated tissue and may trigger the gut to produce protective mucus."], ["Tannins", "Polyphenols", "Mild astringent."], ["Phytosterols", "Plant sterols", "Mild anti-inflammatory."]],
    dose: [["Powdered inner bark in water or oatmeal", 1.5, 3, "Up to 3 times a day"]],
    daily: [1.5, 9], limit: "Take other medicines 1–2 hours apart."
  },
  echinacea: {
    body: [["Immune system", "Activates immune cells at the start of a cold."], ["Respiratory system", "May shorten colds."], ["Throat", "Soothes sore throats."]],
    chem: [["Alkamides", "Fatty acid amides", "Bind CB2 receptors on immune cells and adjust inflammatory messengers (cytokines); cause the tongue tingle."], ["Cichoric acid", "Caffeic acid derivative", "Antioxidant and supports immune cell activity."], ["Polysaccharides", "Complex sugars", "Activate macrophages, immune cells that swallow germs."]],
    dose: [["Dried herb or root as tea (per cup)", 1, 2, "3 times a day"], ["Extract capsules", 0.3, 0.5, "3 times a day"]],
    daily: [0.9, 6], limit: "Start at the first sign of a cold; use for up to 10 days at a time."
  },
  elderberry: {
    body: [["Immune system", "Shortens colds and flu."], ["Respiratory system", "Eases cold symptoms."], ["Whole body", "Antioxidant."]],
    chem: [["Anthocyanins (cyanidin glycosides)", "Flavonoids", "Strong antioxidants that may stop flu viruses from entering cells and stimulate immune messengers."], ["Flavonols (quercetin, rutin)", "Flavonoids", "Antioxidant and anti-inflammatory."], ["Sambunigrin", "Cyanogenic glycoside", "In raw berries, leaves and stems; can release cyanide — destroyed by cooking."]],
    dose: [["Standardized elderberry extract", 0.3, 0.3, "2–3 times a day"], ["Homemade syrup", "1 tbsp (15 ml)", null, "Once a day for prevention; up to 4 times a day when sick"]],
    daily: null, limit: "Use for 3–5 days when unwell, or daily through cold season."
  },
  elderflower: {
    body: [["Immune system", "Supports the body through feverish colds."], ["Respiratory system", "Eases sinus congestion."], ["Skin", "Gentle toner."]],
    chem: [["Flavonoids (rutin, quercetin)", "Polyphenols", "Anti-inflammatory and support small blood vessels."], ["Phenolic acids (chlorogenic acid)", "Polyphenols", "Antioxidant and promote sweating."], ["Triterpenes", "Terpenoids", "Anti-inflammatory."]],
    dose: [["Dried flowers as tea (per cup)", 3, 4, "3 times a day, hot"]],
    daily: [10, 15], limit: "Short-term use during colds."
  },
  calendula: {
    body: [["Skin", "Speeds wound healing and soothes inflammation."], ["Mouth", "Soothes mouth sores (rinse)."], ["Digestive system", "Traditionally soothing to the gut lining."]],
    chem: [["Faradiol esters", "Triterpenoids", "The main anti-inflammatory compounds; reduce swelling in skin."], ["Polysaccharides", "Complex sugars", "Encourage new blood vessels and tissue growth in wounds."], ["Carotenoids & flavonoids", "Pigments / polyphenols", "Antioxidant protection for healing skin."]],
    dose: [["Ointment or cream (2–5%)", "Thin layer", null, "2–4 times a day"], ["Dried petals as tea or rinse (per cup)", 1, 2, "Up to 3 times a day"]],
    daily: null, limit: "Mainly used on the skin."
  },
  rose: {
    body: [["Nervous system", "Calming and mood-lifting."], ["Reproductive system", "Eases period pain."], ["Skin", "Tones and calms redness."]],
    chem: [["2-Phenylethyl alcohol, citronellol, geraniol", "Aromatic alcohols", "The rose scent; calming through the sense of smell and mildly antimicrobial."], ["Quercetin & kaempferol glycosides", "Flavonoids", "Anti-inflammatory and antioxidant."], ["Gallic acid & tannins", "Polyphenols", "Astringent — tighten and tone skin."]],
    dose: [["Dried petals as tea (per cup)", 1, 2, "1–3 times a day"], ["Rosewater on the skin", "A light mist", null, "As desired"]],
    daily: [1, 6], limit: "Use only pesticide-free roses."
  },
  hibiscus: {
    body: [["Heart & blood vessels", "Lowers blood pressure."], ["Kidneys", "Mild diuretic."], ["Metabolism", "May improve cholesterol."]],
    chem: [["Delphinidin- & cyanidin-3-sambubioside", "Anthocyanins", "Inhibit ACE, the enzyme that makes the vessel-tightening hormone angiotensin II — similar to a mild blood pressure medicine."], ["Hibiscus acid & organic acids", "Organic acids", "Tart flavor and a mild diuretic effect."], ["Vitamin C", "Vitamin", "Antioxidant."]],
    dose: [["Dried calyces as tea (per cup)", 1.5, 2.5, "2–3 times a day"]],
    daily: [3, 7.5], limit: "Talk to your doctor if you take blood pressure medicine."
  },
  "aloe-vera": {
    body: [["Skin", "Cools and may help soothe minor burns and sunburn."], ["Skin", "Hydrates and calms irritation."], ["Gums", "Reduces gum inflammation (gels and rinses)."]],
    chem: [["Acemannan", "Polysaccharide", "Hydrates, encourages skin cells to multiply, and supports wound healing."], ["Glycoproteins & salicylic acid", "Proteins / phenolic acid", "Reduce inflammation and pain."], ["Aloin (in the yellow latex)", "Anthraquinone glycoside", "A strong laxative that irritates the bowel — the reason to drain the latex and avoid eating aloe."]],
    dose: [["Fresh inner-leaf gel on the skin", "Thin layer", null, "3–4 times a day"]],
    daily: null, limit: "For use on the skin. Do not eat aloe latex.", ext: true
  },
  dandelion: {
    body: [["Liver & gallbladder", "Stimulates bile flow."], ["Kidneys", "Increases urine (leaf); rich in potassium."], ["Gut", "Feeds beneficial bacteria (root inulin)."]],
    chem: [["Taraxacin & sesquiterpene lactones", "Bitter compounds", "Trigger bitter taste receptors, which signal the stomach, liver and gallbladder to release digestive juices and bile."], ["Inulin", "Prebiotic fiber", "Fermented by gut bacteria into short-chain fatty acids that nourish the gut lining."], ["Potassium", "Mineral", "Replaces the potassium lost through the diuretic effect."]],
    dose: [["Dried root as decoction (per cup)", 3, 4, "3 times a day"], ["Dried leaf as tea (per cup)", 4, 10, "Once a day, or split"]],
    daily: [3, 12], limit: "Usually used for 2–4 weeks at a time."
  },
  burdock: {
    body: [["Skin", "Traditionally clears acne and eczema."], ["Gut", "Prebiotic fiber feeds good bacteria."], ["Whole body", "Antioxidant and anti-inflammatory."]],
    chem: [["Inulin", "Prebiotic fiber", "Feeds bifidobacteria, which produce short-chain fatty acids that calm inflammation."], ["Arctigenin & arctiin", "Lignans", "Anti-inflammatory: block NF-κB and inflammatory messengers."], ["Chlorogenic acid", "Polyphenol", "Antioxidant."]],
    dose: [["Dried root as decoction (per cup)", 1, 2, "3 times a day"]],
    daily: [2, 6], limit: "Usually used for 2–6 weeks at a time."
  },
  nettle: {
    body: [["Immune system", "Calms allergic reactions."], ["Joints", "Reduces arthritis pain."], ["Prostate & urinary (root)", "Eases urinary symptoms of an enlarged prostate."]],
    chem: [["Quercetin & other flavonoids", "Flavonoids", "Stabilize mast cells so they release less histamine, and calm inflammation."], ["Lignans & sterols (root)", "Plant compounds", "Bind sex-hormone-binding globulin (SHBG) and may slow prostate tissue growth."], ["Minerals & silica", "Nutrients", "Iron, calcium, magnesium and silica nourish the body, hair and skin."]],
    dose: [["Dried leaf as tea (per cup)", 2, 4, "3 times a day"], ["Root extract (prostate)", 0.3, 0.6, "Once a day"]],
    daily: [8, 12], limit: "Drink plenty of water with nettle."
  },
  "red-clover": {
    body: [["Hormonal system", "Weak estrogen-like support during menopause."], ["Bones", "May slow bone loss after menopause."], ["Skin", "Traditional skin herb."]],
    chem: [["Biochanin A & formononetin", "Isoflavones", "Converted in the body into genistein and daidzein, which bind estrogen receptors (especially ERβ) weakly."], ["Coumarins", "Benzopyrones", "Can slightly thin the blood."], ["Flavonoids", "Polyphenols", "Antioxidant."]],
    dose: [["Isoflavone extract tablets", 0.04, 0.08, "Once a day"], ["Dried blossoms as tea (per cup)", 1, 2, "Up to 3 times a day"]],
    daily: null, limit: "Studies used up to 12 months; avoid with hormone-sensitive conditions."
  },
  "milk-thistle": {
    body: [["Liver", "Protects liver cells and supports repair."], ["Metabolism", "May lower blood sugar."], ["Whole body", "Raises antioxidant defenses."]],
    chem: [["Silybin (silibinin)", "Flavonolignan", "Stabilizes liver cell membranes and blocks toxins from entering liver cells through OATP transporters."], ["Silymarin complex", "Flavonolignans", "Raises glutathione, the liver's main antioxidant, and boosts protein synthesis for liver repair."], ["Taxifolin", "Flavonoid", "Antioxidant."]],
    dose: [["Silymarin extract capsules (70–80%)", 0.14, 0.14, "2–3 times a day"]],
    daily: [0.28, 0.42], limit: "Liver disease must be managed by a doctor."
  },
  hawthorn: {
    body: [["Heart", "Helps the heart muscle pump more efficiently."], ["Blood vessels", "Widens coronary arteries; may lower blood pressure."], ["Whole body", "Antioxidant."]],
    chem: [["Oligomeric procyanidins (OPCs)", "Polyphenols", "Help blood vessels release nitric oxide so they relax, and strengthen heart muscle contraction."], ["Vitexin & hyperoside", "Flavonoids", "Increase blood flow in the coronary arteries and act as antioxidants."], ["Triterpene acids", "Terpenoids", "Mild heart-protective effects."]],
    dose: [["Leaf & flower extract", 0.16, 0.45, "2 times a day"], ["Dried berries as decoction (per cup)", 1, 1.5, "3–4 times a day"]],
    daily: [0.16, 0.9], limit: "Daily total refers to extract. Only with your doctor's knowledge if you have a heart condition."
  },
  ginkgo: {
    body: [["Circulation", "Improves blood flow, especially to the legs and brain."], ["Blood", "Reduces platelet stickiness."], ["Brain", "Protects nerve cells."]],
    chem: [["Ginkgolides A, B, C", "Terpene lactones", "Block platelet-activating factor (PAF), so blood flows more easily and clots less."], ["Bilobalide", "Terpene lactone", "Protects nerve cells and supports their energy production."], ["Flavone glycosides", "Flavonoids", "Antioxidants that protect blood vessels and the brain."]],
    dose: [["Standardized leaf extract (EGb 761)", 0.06, 0.12, "2 times a day"]],
    daily: [0.12, 0.24], limit: "Stop 2–3 days before surgery. Effects take 4–12 weeks."
  },
  ginseng: {
    body: [["Energy & stress response", "Reduces fatigue and supports stamina."], ["Brain", "Supports memory and calm focus."], ["Metabolism & circulation", "Lowers blood sugar after meals; improves erectile function."]],
    chem: [["Ginsenoside Rg1", "Triterpene saponin", "Mildly stimulating; supports memory and the body's energy systems."], ["Ginsenoside Rb1", "Triterpene saponin", "Calming and nerve-protective — ginseng's balancing effect comes from this mix."], ["Ginsenosides (general)", "Saponins", "Boost nitric oxide in blood vessels and modulate the stress-hormone (HPA) axis."]],
    dose: [["Standardized root extract", 0.2, 0.4, "Once a day"], ["Dried root", 1, 2, "Once a day"]],
    daily: null, limit: "Use for up to 3 months, then take a 2–4 week break."
  },
  ashwagandha: {
    body: [["Stress response", "Lowers cortisol and stress."], ["Nervous system", "Improves sleep quality."], ["Muscles", "Supports strength and endurance."]],
    chem: [["Withanolides (withanolide A, withaferin A)", "Steroidal lactones", "Calm the stress-hormone axis to lower cortisol and act on GABA receptors for relaxation."], ["Sitoindosides", "Glycowithanolides", "Adaptogenic and antioxidant."], ["Triethylene glycol (leaves)", "Glycol", "Promotes sleep in animal studies."]],
    dose: [["Root extract (e.g. KSM-66)", 0.3, 0.3, "1–2 times a day"], ["Root powder in warm milk", 1, 3, "1–2 times a day"]],
    daily: null, limit: "Most studies lasted 8–12 weeks."
  },
  rhodiola: {
    body: [["Stress response", "Reduces fatigue and burnout."], ["Brain", "Improves focus under stress."], ["Muscles", "Supports endurance."]],
    chem: [["Salidroside", "Phenylethanoid glycoside", "Activates AMPK (an energy sensor in cells), protects nerve cells and helps regulate stress hormones."], ["Rosavins (rosavin, rosin, rosarin)", "Cinnamyl alcohol glycosides", "Unique to Rhodiola rosea; contribute to the anti-fatigue effect."], ["Tyrosol", "Phenol", "Antioxidant."]],
    dose: [["Standardized root extract (3% rosavins, 1% salidroside)", 0.2, 0.6, "Once a day, in the morning"]],
    daily: [0.2, 0.6], limit: "Take early in the day; can be stimulating."
  },
  valerian: {
    body: [["Nervous system", "Helps you fall asleep and improves sleep quality."], ["Nervous system", "Eases anxiety."], ["Muscles", "Relaxes tension and cramps."]],
    chem: [["Valerenic acid", "Sesquiterpene", "Binds GABA-A receptors (β2/β3 subunits) to boost calming signals and slows GABA breakdown."], ["Valepotriates", "Iridoids", "Mildly sedative; break down quickly in storage."], ["Isovaleric acid", "Fatty acid", "Responsible for the strong smell; mildly relaxant."]],
    dose: [["Dried root as tea (per cup)", 2, 3, "Once, 30–60 minutes before bed"], ["Root extract", 0.3, 0.6, "Once, 30–120 minutes before bed"]],
    daily: [2, 3], limit: "Works best after 2–4 weeks of nightly use."
  },
  passionflower: {
    body: [["Nervous system", "Eases anxiety and racing thoughts."], ["Sleep", "Improves sleep quality."], ["Muscles", "Mild antispasmodic."]],
    chem: [["Chrysin", "Flavone", "Binds the benzodiazepine site of GABA-A receptors in lab studies."], ["Vitexin & isovitexin", "C-glycosyl flavonoids", "Contribute to the calming and antispasmodic effect."], ["Harman alkaloids (trace)", "β-Carboline alkaloids", "Weakly inhibit MAO; present only in small amounts."]],
    dose: [["Dried herb as tea (per cup)", 1, 2, "2–3 times a day, or once at bedtime"]],
    daily: [2, 8], limit: "Avoid in pregnancy."
  },
  skullcap: {
    body: [["Nervous system", "Calms tension and anxiety."], ["Sleep", "Quiets a busy mind."], ["Muscles", "Eases tension."]],
    chem: [["Baicalin & baicalein", "Flavones", "Bind the benzodiazepine site of GABA-A receptors, increasing calming signals."], ["Wogonin", "Flavone", "Anti-anxiety effects in animal studies without heavy sedation."], ["Scutellarin", "Flavone glycoside", "Antioxidant and nerve-protective."]],
    dose: [["Dried herb as tea (per cup)", 1, 2, "3 times a day"]],
    daily: [3, 6], limit: "Buy from reputable suppliers (germander contamination risk)."
  },
  hops: {
    body: [["Nervous system", "Promotes sleep."], ["Hormonal system", "Plant estrogen that may ease hot flushes."], ["Digestive system", "Bitter that stimulates digestion."]],
    chem: [["2-Methyl-3-buten-2-ol", "Alcohol (from bitter acids)", "Forms as hop acids break down; has a sedative effect on the brain."], ["Humulone & lupulone", "Bitter acids", "Stimulate digestion and have mild sedative properties."], ["8-Prenylnaringenin", "Prenylflavonoid", "One of the strongest plant estrogens known."], ["Xanthohumol", "Prenylflavonoid", "Antioxidant and anti-inflammatory."]],
    dose: [["Dried strobiles as tea", 0.5, 1, "Once, at bedtime"]],
    daily: [0.5, 1], limit: "Often combined with valerian."
  },
  catnip: {
    body: [["Nervous system", "Gentle relaxation."], ["Digestive system", "Eases gas and colic."], ["Skin (outdoors)", "Repels mosquitoes."]],
    chem: [["Nepetalactone", "Iridoid", "Mildly sedative in humans (stimulating in cats) and repels insects."], ["β-Caryophyllene", "Sesquiterpene", "Anti-inflammatory via CB2 receptors."], ["Rosmarinic acid", "Polyphenol", "Antioxidant."]],
    dose: [["Dried leaf as tea (per cup)", 1, 2, "Up to 3 times a day"]],
    daily: [1, 6], limit: "Avoid in pregnancy."
  },
  linden: {
    body: [["Nervous system", "Calms tension."], ["Immune system", "Promotes sweating during fevers."], ["Throat", "Soothing mucilage."]],
    chem: [["Tiliroside, quercetin & kaempferol", "Flavonoids", "Anti-inflammatory and mildly anti-anxiety."], ["Mucilage", "Polysaccharides", "Soothes the throat."], ["Farnesol", "Sesquiterpene alcohol", "Part of the honey scent; mildly antispasmodic."]],
    dose: [["Dried flowers as tea (per cup)", 2, 4, "1–3 times a day"]],
    daily: [2, 4], limit: "Generally safe."
  },
  "oat-straw": {
    body: [["Skin", "Relieves itching and dryness."], ["Nervous system", "Nourishes and calms."], ["Brain", "Green oat extract may support attention."]],
    chem: [["Avenanthramides", "Polyphenols (unique to oats)", "Block NF-κB and histamine-driven itching — the reason oatmeal baths stop itch."], ["β-Glucans", "Soluble fiber", "Form a protective, moisturizing film on the skin."], ["Silica & minerals", "Nutrients", "Nourishing to hair, skin and nerves."]],
    dose: [["Dried oat straw as tea (per cup)", 3, 3, "Up to 3 times a day"], ["Colloidal oatmeal for a bath", "About 1 cup (100 g)", null, "In a warm bath, once a day"]],
    daily: [3, 9], limit: "Very safe."
  },
  horsetail: {
    body: [["Hair, skin & nails", "Supplies silica used to build collagen."], ["Kidneys", "Strong diuretic."], ["Bones", "May support bone density."]],
    chem: [["Silicic acid (silica)", "Mineral compound", "Used by the body to build collagen and connective tissue."], ["Isoquercitrin & other flavonoids", "Flavonoids", "Increase urine output (diuretic effect)."], ["Thiaminase (in untreated herb)", "Enzyme", "Destroys vitamin B1 — choose thiaminase-free products."]],
    dose: [["Dried herb as tea (per cup)", 2, 4, "2–3 times a day"]],
    daily: [4, 6], limit: "Use for up to 6 weeks, then take a break."
  },
  yarrow: {
    body: [["Skin", "Helps minor bleeding stop."], ["Digestive system", "Stimulates appetite; eases cramps."], ["Immune system", "Promotes sweating in fevers."]],
    chem: [["Achilleine", "Alkaloid", "May speed blood clotting."], ["Sesquiterpene lactones & chamazulene", "Terpenoids", "Bitter and anti-inflammatory."], ["Apigenin & luteolin", "Flavonoids", "Antispasmodic on the gut."]],
    dose: [["Dried herb as tea (per cup)", 1.5, 2, "3 times a day"]],
    daily: [4.5, 6], limit: "Avoid in pregnancy."
  },
  plantain: {
    body: [["Skin", "Soothes stings and helps healing."], ["Respiratory system", "Calms coughs and irritated throats."], ["Digestive system", "Mild soothing effect."]],
    chem: [["Aucubin", "Iridoid glycoside", "Anti-inflammatory (blocks NF-κB) and antimicrobial."], ["Allantoin", "Urea derivative", "Encourages skin cells to multiply and heal."], ["Mucilage", "Polysaccharides", "Coats and soothes irritated tissue."]],
    dose: [["Dried leaf as tea (per cup)", 1.5, 2, "3–4 times a day"], ["Fresh crushed leaf on the skin", "1–2 leaves", null, "As needed"]],
    daily: [3, 6], limit: "Very safe."
  },
  mullein: {
    body: [["Respiratory system", "Soothes coughs and loosens mucus."], ["Ears", "Eases ear pain (oil drops, intact eardrum only)."], ["Throat", "Soothing."]],
    chem: [["Mucilage", "Polysaccharides", "Coats and soothes the throat."], ["Saponins", "Glycosides", "Loosen mucus by mildly irritating the stomach, which triggers a reflex that thins airway secretions."], ["Verbascoside & aucubin", "Phenylpropanoid / iridoid", "Anti-inflammatory and antimicrobial."]],
    dose: [["Dried leaf or flower as tea (per cup)", 1.5, 2, "3–4 times a day"]],
    daily: [3, 8], limit: "Strain through fine cloth to remove hairs."
  },
  hyssop: {
    body: [["Respiratory system", "Loosens chest congestion."], ["Digestive system", "Relieves gas."], ["Immune system", "Mild antiviral activity."]],
    chem: [["Pinocamphone & isopinocamphone", "Monoterpene ketones", "Give the camphor note; in concentrated oil they can trigger seizures."], ["Rosmarinic acid", "Polyphenol", "Antioxidant and antiviral."], ["Flavonoids (diosmin)", "Polyphenols", "Anti-inflammatory."]],
    dose: [["Dried herb as tea (per cup)", 1, 2, "Up to 3 times a day"]],
    daily: [2, 6], limit: "Never use hyssop oil internally."
  },
  horehound: {
    body: [["Respiratory system", "Thins mucus and calms coughing."], ["Digestive system", "Stimulates appetite and digestion."], ["Throat", "Soothing (lozenges)."]],
    chem: [["Marrubiin", "Diterpene lactone", "Stimulates secretions in the airways (expectorant) and bitter receptors that start digestion."], ["Premarrubiin", "Diterpene", "Converts to marrubiin."], ["Flavonoids", "Polyphenols", "Mild anti-inflammatory."]],
    dose: [["Dried herb as tea (per cup)", 1, 2, "3 times a day"]],
    daily: [3, 4.5], limit: "Avoid in pregnancy."
  },
  eucalyptus: {
    body: [["Respiratory system", "Thins mucus and eases congestion."], ["Immune system", "Antibacterial."], ["Muscles", "Warming rubs for aches."]],
    chem: [["1,8-Cineole (eucalyptol)", "Monoterpene oxide", "Reduces inflammatory messengers in the airways, thins mucus and speeds the cilia that sweep it out."], ["α-Pinene", "Monoterpene", "Antimicrobial and opens airways slightly."], ["Flavonoids & tannins (leaf)", "Polyphenols", "Antioxidant."]],
    dose: [["Steam inhalation", "2–3 drops oil or 1 tbsp leaves in hot water", null, "1–3 times a day"], ["Enteric-coated cineole capsules", 0.2, 0.2, "3 times a day"]],
    daily: null, limit: "Never swallow eucalyptus oil from a bottle; keep away from children's faces."
  },
  "tea-tree": {
    body: [["Skin", "May help reduce acne."], ["Skin & nails", "Has antifungal activity."], ["Skin", "Antiseptic for minor cuts."]],
    chem: [["Terpinen-4-ol", "Monoterpene alcohol", "Damages the membranes of bacteria and fungi and reduces histamine-driven skin inflammation."], ["γ-Terpinene & α-terpinene", "Monoterpenes", "Support the antimicrobial action."], ["1,8-Cineole", "Monoterpene oxide", "Can irritate skin; good oils keep it low."]],
    dose: [["5% gel or diluted oil for acne", "Thin layer", null, "1–2 times a day"], ["25–50% solution for athlete's foot", "Thin layer", null, "2 times a day"]],
    daily: null, limit: "External use only — toxic if swallowed. Toxic to cats and dogs.", ext: true
  },
  "witch-hazel": {
    body: [["Skin", "Tightens and tones, reduces oiliness."], ["Skin", "Calms redness and itching."], ["Blood vessels (skin)", "Shrinks swollen tissue (hemorrhoids)."]],
    chem: [["Hamamelitannin", "Tannin", "Astringent: binds proteins on the skin surface, tightening tissue and reducing oozing."], ["Proanthocyanidins & gallic acid", "Polyphenols", "Anti-inflammatory and antioxidant."], ["Flavonoids", "Polyphenols", "Calm small blood vessels."]],
    dose: [["Distilled witch hazel", "Apply with a cotton pad", null, "2–3 times a day"], ["Ointment (5–10%)", "Thin layer", null, "Several times a day"]],
    daily: null, limit: "For use on the skin.", ext: true
  },
  arnica: {
    body: [["Skin & tissue", "Reduces bruising and swelling."], ["Joints", "Eases arthritis pain."], ["Muscles", "Soothes soreness."]],
    chem: [["Helenalin & its esters", "Sesquiterpene lactones", "Block NF-κB to reduce swelling and pain — but are toxic if swallowed."], ["Flavonoids", "Polyphenols", "Anti-inflammatory."], ["Thymol derivatives", "Phenolic terpenes", "Mildly antiseptic."]],
    dose: [["Arnica gel or cream", "Thin layer", null, "2–4 times a day on unbroken skin"]],
    daily: null, limit: "External use only. Never on broken skin.", ext: true
  },
  "st-johns-wort": {
    body: [["Brain", "Improves mild to moderate low mood."], ["Liver", "Speeds up the breakdown of many medicines."], ["Skin", "Increases sun sensitivity."]],
    chem: [["Hyperforin", "Phloroglucinol", "Raises sodium inside nerve cells (via TRPC6 channels), which reduces reuptake of serotonin, norepinephrine and dopamine. It also switches on the liver enzyme CYP3A4 and the P-glycoprotein pump — the cause of its many drug interactions."], ["Hypericin", "Naphthodianthrone", "Contributes to the mood effect and makes skin more sensitive to sunlight."], ["Flavonoids", "Polyphenols", "Antioxidant and supportive."]],
    dose: [["Standardized extract (0.3% hypericin)", 0.3, 0.3, "3 times a day — only with medical guidance"]],
    daily: [0.9, 0.9], limit: "Use only under medical supervision; never combine with antidepressants, birth control pills or other medicines without advice."
  },
  "saw-palmetto": {
    body: [["Prostate", "May ease urinary symptoms of an enlarged prostate."], ["Hair follicles", "May slow hair thinning."], ["Hormonal system", "Reduces conversion of testosterone to DHT."]],
    chem: [["Free fatty acids (lauric, oleic, myristic)", "Fatty acids", "Inhibit 5-α-reductase, the enzyme that converts testosterone to DHT."], ["β-Sitosterol", "Phytosterol", "May reduce inflammation in prostate tissue."], ["Flavonoids", "Polyphenols", "Antioxidant."]],
    dose: [["Lipidosterolic berry extract", 0.16, 0.16, "2 times a day"]],
    daily: [0.32, 0.32], limit: "See a doctor to rule out other causes of urinary symptoms."
  },
  chasteberry: {
    body: [["Pituitary gland", "Lowers prolactin."], ["Reproductive system", "Eases PMS and breast tenderness."], ["Menstrual cycle", "Helps balance the second half of the cycle."]],
    chem: [["Rotundifuran & other diterpenes", "Diterpenes", "Act like dopamine on D2 receptors in the pituitary gland, lowering prolactin release."], ["Agnuside & aucubin", "Iridoid glycosides", "Anti-inflammatory."], ["Casticin", "Flavonoid", "Anti-inflammatory and supports the hormonal effect."]],
    dose: [["Standardized fruit extract", 0.02, 0.04, "Once a day, in the morning"]],
    daily: [0.02, 0.04], limit: "Effects build over 2–3 cycles."
  },
  "raspberry-leaf": {
    body: [["Uterus", "Traditionally tones the uterine muscle."], ["Reproductive system", "Eases menstrual cramps."], ["Digestive system", "Astringent; settles loose stools."]],
    chem: [["Ellagitannins", "Tannins", "Astringent — tighten tissue and reduce secretions."], ["Fragarine", "Alkaloid (proposed)", "Thought to tone pelvic smooth muscle, though not well studied."], ["Flavonoids (kaempferol, quercetin)", "Polyphenols", "Antioxidant."]],
    dose: [["Dried leaf as tea (per cup)", 1.5, 2.5, "Up to 3 times a day"], ["Leaf tablets (late pregnancy, with midwife)", 1.2, 1.2, "2 times a day"]],
    daily: [1.5, 7.5], limit: "In pregnancy, only with your midwife's guidance (usually third trimester)."
  },
  moringa: {
    body: [["Whole body", "Supplies protein, iron, calcium and vitamins."], ["Metabolism", "May lower blood sugar after meals."], ["Whole body", "Anti-inflammatory and antioxidant."]],
    chem: [["Moringin (glucomoringin isothiocyanate)", "Isothiocyanate", "Switches on Nrf2 antioxidant defenses and calms inflammation."], ["Quercetin & chlorogenic acid", "Polyphenols", "Antioxidant; chlorogenic acid slows sugar absorption."], ["Protein, iron, calcium, vitamins A & C", "Nutrients", "Nourish the body, which is why it fights malnutrition."]],
    dose: [["Leaf powder in food or smoothies", 1, 3, "1–2 times a day"]],
    daily: [2, 6], limit: "Use leaves only; avoid root and bark."
  },
  "green-tea": {
    body: [["Brain", "Calm, focused alertness."], ["Heart & blood vessels", "Improves cholesterol and vessel health."], ["Metabolism", "Slightly increases fat burning."]],
    chem: [["Caffeine", "Methylxanthine alkaloid", "Blocks adenosine receptors — adenosine builds up to make you sleepy, so blocking it keeps you alert."], ["L-Theanine", "Amino acid", "Raises calming alpha brain waves and balances caffeine's jittery effects."], ["EGCG (epigallocatechin gallate)", "Catechin (polyphenol)", "Antioxidant that protects LDL cholesterol from oxidation and supports blood vessel function."]],
    dose: [["Dried leaf as tea (per cup, ~30–50 mg caffeine)", 2, 3, "2–4 times a day"]],
    daily: [4, 12], limit: "Keep total caffeine under 400 mg a day (200 mg in pregnancy). Avoid high-dose EGCG pills (over 800 mg)."
  },
  rooibos: {
    body: [["Whole body", "Antioxidant protection."], ["Heart", "May improve cholesterol."], ["Nervous system", "Caffeine-free relaxation."]],
    chem: [["Aspalathin", "Dihydrochalcone", "Unique to rooibos; antioxidant and may help muscle cells take up glucose (via AMPK)."], ["Nothofagin", "Dihydrochalcone", "Antioxidant and anti-inflammatory."], ["Quercetin & luteolin", "Flavonoids", "Antioxidant."]],
    dose: [["Dried leaf as tea (per cup)", 2, 3, "Up to 6 times a day"]],
    daily: [2, 18], limit: "Very safe; naturally caffeine-free."
  },
  "yerba-mate": {
    body: [["Brain", "Energy and focus."], ["Heart & blood", "May lower LDL cholesterol."], ["Whole body", "Antioxidant."]],
    chem: [["Caffeine", "Methylxanthine alkaloid", "Blocks adenosine receptors for alertness (about 70–80 mg per cup)."], ["Theobromine", "Methylxanthine alkaloid", "Gentle stimulant (also in chocolate) that relaxes blood vessels."], ["Chlorogenic acids", "Polyphenols", "Antioxidants that may improve cholesterol and blood sugar."]],
    dose: [["Dried leaf as tea (per cup)", 3, 5, "1–3 times a day"]],
    daily: [3, 15], limit: "Let it cool slightly — drinking it very hot regularly is linked to esophageal cancer."
  },
  "gotu-kola": {
    body: [["Skin", "Boosts collagen and wound repair."], ["Veins", "Improves circulation in the legs."], ["Brain", "May support memory and calm."]],
    chem: [["Asiaticoside & madecassoside", "Triterpene saponins", "Stimulate skin cells (fibroblasts) to make type I collagen and speed wound healing."], ["Asiatic & madecassic acid", "Triterpene acids", "Anti-inflammatory and strengthen vein walls."], ["Flavonoids", "Polyphenols", "Antioxidant and nerve-protective."]],
    dose: [["Dried leaf as tea (per cup)", 0.6, 2, "3 times a day"], ["Standardized extract (TTFCA)", 0.03, 0.06, "2 times a day"]],
    daily: [1.8, 6], limit: "Use for up to 6 weeks, then take a 2-week break."
  },
  bacopa: {
    body: [["Brain", "Improves memory and learning over time."], ["Nervous system", "Reduces anxiety."], ["Brain", "Antioxidant protection for nerve cells."]],
    chem: [["Bacoside A & B", "Triterpenoid saponins", "Enhance communication between nerve cells (synaptic transmission) and boost antioxidant enzymes in the memory center (hippocampus)."], ["Bacopasides", "Saponins", "Support acetylcholine signaling."], ["Alkaloids (brahmine)", "Alkaloids", "Minor calming compounds."]],
    dose: [["Standardized extract (50% bacosides)", 0.3, 0.45, "Once a day with food"]],
    daily: [0.3, 0.45], limit: "Takes 8–12 weeks to show effects."
  },
  schisandra: {
    body: [["Stress response", "Improves endurance and resistance to stress."], ["Liver", "Protects liver cells."], ["Brain", "Supports concentration."]],
    chem: [["Schisandrin A & B", "Dibenzocyclooctadiene lignans", "Protect liver cells, boost glutathione, and adjust stress hormones."], ["Gomisins", "Lignans", "Liver-protective; also change how the liver processes medicines (CYP enzymes)."], ["Organic acids (citric, malic)", "Acids", "Give the sour taste."]],
    dose: [["Dried berries as tea (per cup)", 1.5, 3, "1–2 times a day"], ["Extract capsules", 0.5, 1, "Once a day"]],
    daily: [1.5, 6], limit: "Check with your pharmacist if you take regular medicines."
  },
  astragalus: {
    body: [["Immune system", "Activates immune cells."], ["Energy", "Reduces fatigue."], ["Heart & kidneys", "Studied for protective effects."]],
    chem: [["Astragalus polysaccharides (APS)", "Polysaccharides", "Activate macrophages and other immune cells through Toll-like receptor 4."], ["Astragalosides (astragaloside IV)", "Triterpene saponins", "Anti-inflammatory and protective for heart and kidney cells."], ["Formononetin & calycosin", "Isoflavones", "Antioxidant and support blood vessels."]],
    dose: [["Sliced root simmered in soup or tea", 3, 10, "Once a day"], ["Root extract capsules", 0.25, 0.5, "2–3 times a day"]],
    daily: [3, 10], limit: "Avoid during acute infection with fever (traditional advice) and with immune-suppressing medicine."
  },
  reishi: {
    body: [["Immune system", "Balances immune activity."], ["Energy", "Reduces fatigue."], ["Nervous system", "Traditionally calming."]],
    chem: [["β-Glucans", "Polysaccharides", "Bind dectin-1 receptors on immune cells, increasing the activity of natural killer cells and macrophages."], ["Ganoderic acids", "Triterpenes", "Very bitter; anti-inflammatory, may reduce histamine release and lower blood pressure (ACE inhibition)."], ["Peptidoglycans", "Protein-sugar complexes", "Immune-modulating."]],
    dose: [["Dried mushroom slices simmered as tea", 1.5, 3, "1–3 times a day"], ["Extract powder", 1, 1.5, "Once a day"]],
    daily: [1.5, 9], limit: "Stop 2 weeks before surgery."
  },
  "olive-leaf": {
    body: [["Blood vessels", "Lowers blood pressure."], ["Metabolism", "Improves insulin sensitivity."], ["Immune system", "Antimicrobial."]],
    chem: [["Oleuropein", "Secoiridoid", "Inhibits ACE and calcium channels in blood vessel muscle so vessels relax, and acts as an antioxidant."], ["Hydroxytyrosol", "Phenol", "Powerful antioxidant formed from oleuropein."], ["Verbascoside", "Phenylpropanoid", "Anti-inflammatory."]],
    dose: [["Leaf extract capsules", 0.5, 0.5, "2 times a day"], ["Dried leaf as tea (per cup)", 2, 3, "1–3 times a day"]],
    daily: [1, 1], limit: "Daily total refers to extract."
  },
  bilberry: {
    body: [["Eyes", "Supports the retina and reduces eye fatigue."], ["Blood vessels", "Strengthens capillaries."], ["Digestive system", "Dried berries settle loose stools."]],
    chem: [["Anthocyanosides (delphinidin, cyanidin glycosides)", "Anthocyanins", "Stabilize collagen in tiny blood-vessel walls and help regenerate rhodopsin, the light-sensing pigment in the eye."], ["Tannins (dried berries)", "Polyphenols", "Astringent — firm loose stools."], ["Resveratrol & quercetin", "Polyphenols", "Antioxidant."]],
    dose: [["Standardized extract (25% anthocyanosides)", 0.08, 0.16, "2 times a day"], ["Fresh or frozen berries", 20, 60, "Daily"]],
    daily: [0.16, 0.32], limit: "Daily total refers to extract."
  },
  cranberry: {
    body: [["Urinary tract", "Helps prevent repeat infections."], ["Heart & blood vessels", "May improve cholesterol."], ["Mouth", "Reduces plaque bacteria sticking to teeth."]],
    chem: [["A-type proanthocyanidins (PACs)", "Polyphenols", "Block the hair-like fimbriae that E. coli bacteria use to cling to the bladder wall, so they are flushed out."], ["Quercetin & myricetin", "Flavonoids", "Antioxidant."], ["Ursolic acid", "Triterpene", "Anti-inflammatory."]],
    dose: [["Capsules standardized to 36 mg PACs", 0.5, 0.5, "1–2 times a day"], ["Unsweetened juice", "240–300 ml (1 cup)", null, "Once a day"]],
    daily: [0.5, 1], limit: "Prevention only — see a doctor for symptoms of a UTI."
  },
  marjoram: {
    body: [["Digestive system", "Relieves gas and aids digestion."], ["Hormonal system", "May improve insulin sensitivity in PCOS."], ["Nervous system", "Calming."]],
    chem: [["Terpinen-4-ol & sabinene hydrate", "Monoterpenes", "Antispasmodic and antimicrobial."], ["Arbutin", "Phenolic glycoside", "Found in marjoram; may affect hormone balance."], ["Rosmarinic acid", "Polyphenol", "Antioxidant and anti-inflammatory."]],
    dose: [["Dried leaf as tea (per cup)", 1, 2, "2 times a day"]],
    daily: [2, 4], limit: "Food amounts are safe."
  },
  tarragon: {
    body: [["Digestive system", "Stimulates appetite and digestion."], ["Metabolism", "May improve insulin sensitivity."], ["Mouth", "Mild numbing effect."]],
    chem: [["Estragole (methyl chavicol)", "Phenylpropanoid", "Main flavor compound; safe in food, but avoid concentrated amounts long-term."], ["Eugenol", "Phenylpropanoid", "Numbing and anti-inflammatory."], ["Herniarin & other coumarins", "Coumarins", "Mildly anti-inflammatory."]],
    dose: [["Fresh or dried leaf in food", 0.5, 2, "With meals"], ["Dried leaf as tea (per cup)", 1, 1, "Up to 2 times a day"]],
    daily: [0.5, 3], limit: "Food amounts are safe."
  },
  "bay-laurel": {
    body: [["Digestive system", "Aids digestion of heavy meals."], ["Metabolism", "May improve blood sugar and cholesterol."], ["Immune system", "Antimicrobial."]],
    chem: [["1,8-Cineole", "Monoterpene oxide", "Main aroma; antispasmodic and antimicrobial."], ["Eugenol & linalool", "Phenylpropanoid / terpene", "Anti-inflammatory and calming."], ["Costunolide", "Sesquiterpene lactone", "Protects the stomach lining in studies."]],
    dose: [["Whole leaves in cooking (removed before eating)", "1–2 leaves", null, "Per dish"], ["Ground bay leaf", 1, 3, "Once a day"]],
    daily: [1, 3], limit: "Always remove whole leaves before eating."
  },
  juniper: {
    body: [["Digestive system", "Stimulates digestion."], ["Kidneys", "Increases urine flow."], ["Whole body", "Antioxidant."]],
    chem: [["Terpinen-4-ol", "Monoterpene alcohol", "Increases filtration in the kidneys (diuretic) — and can irritate them in excess."], ["α-Pinene & myrcene", "Monoterpenes", "Antimicrobial and give the pine aroma."], ["Flavonoids", "Polyphenols", "Antioxidant."]],
    dose: [["Crushed dried berries as tea (per cup)", 1, 2, "Up to 3 times a day"]],
    daily: [2, 10], limit: "Use for no more than 4 weeks."
  },
  chicory: {
    body: [["Gut", "Feeds beneficial bacteria; relieves constipation."], ["Metabolism", "Steadies blood sugar."], ["Liver & digestion", "Bitter tonic."]],
    chem: [["Inulin", "Prebiotic fiber", "Fermented by gut bacteria into short-chain fatty acids; adds bulk and softens stools."], ["Lactucin & lactucopicrin", "Sesquiterpene lactones", "Bitter compounds that stimulate digestion and are mildly calming."], ["Chicoric acid", "Caffeic acid derivative", "Antioxidant."]],
    dose: [["Roasted root brewed like coffee (per cup)", 2, 4, "1–3 times a day"], ["Inulin powder", 2.5, 5, "1–2 times a day"]],
    daily: [2, 12], limit: "Increase slowly to avoid gas."
  },
  lovage: {
    body: [["Digestive system", "Relieves gas."], ["Urinary tract", "Gently increases urine flow."], ["Whole body", "Antioxidant."]],
    chem: [["Ligustilide & butylidenephthalide", "Phthalides", "Relax smooth muscle and increase urine output; give the celery aroma."], ["Furanocoumarins", "Coumarins", "Can make skin sensitive to sunlight."], ["Quercetin", "Flavonoid", "Antioxidant."]],
    dose: [["Dried root as tea (per cup)", 1.5, 3, "2–3 times a day"]],
    daily: [4, 8], limit: "Avoid with kidney problems or in pregnancy."
  },
  caraway: {
    body: [["Digestive system", "Relieves indigestion and bloating."], ["Gut", "Eases gas and colic."], ["Immune system", "Antimicrobial."]],
    chem: [["Carvone", "Monoterpene ketone", "Relaxes gut muscle by blocking calcium channels."], ["Limonene", "Monoterpene", "Supports digestion."], ["Flavonoids", "Polyphenols", "Antioxidant."]],
    dose: [["Crushed seed as tea (per cup)", 1, 2, "3 times a day"], ["Caraway + peppermint oil capsules", "50 mg caraway oil + 90 mg peppermint oil", null, "2 times a day"]],
    daily: [1.5, 6], limit: "Daily total refers to seed."
  },
  mustard: {
    body: [["Skin & circulation", "Warms and draws blood to the skin."], ["Digestive system", "Stimulates saliva and digestion."], ["Cells", "Protective isothiocyanates."]],
    chem: [["Sinigrin → allyl isothiocyanate", "Glucosinolate → isothiocyanate", "When mustard is crushed and wet, the enzyme myrosinase turns sinigrin into allyl isothiocyanate, which activates TRPA1 heat receptors (the sharp burn)."], ["Sinalbin (white mustard)", "Glucosinolate", "Gives a milder heat."], ["Omega-3 ALA & selenium", "Nutrients", "Anti-inflammatory nutrients."]],
    dose: [["Mustard seed or prepared mustard in food", 1, 5, "With meals"], ["Mustard plaster (adults, on the chest)", "1 tbsp mustard + 4 tbsp flour in cloth", null, "Maximum 15 minutes"]],
    daily: [1, 5], limit: "Never leave a plaster on longer than 15 minutes."
  },
  saffron: {
    body: [["Brain", "Lifts low mood."], ["Hormonal / mood", "Eases PMS symptoms."], ["Eyes", "Protects the retina."]],
    chem: [["Crocin", "Carotenoid", "Antioxidant that may increase serotonin activity and protect nerve and retina cells."], ["Safranal", "Monoterpene aldehyde", "The aroma; acts on GABA-A receptors and has anti-anxiety effects."], ["Picrocrocin", "Glycoside", "Gives the bitter taste; breaks down into safranal."]],
    dose: [["Saffron extract (mood)", 0.03, 0.03, "Once a day (or 15 mg twice)"], ["Threads in cooking", 0.05, 0.1, "Per dish"]],
    daily: [0.03, 0.1], limit: "Never exceed 1.5 g a day; 5 g can be poisonous."
  },
  vanilla: {
    body: [["Nervous system", "Comforting aroma."], ["Whole body", "Antioxidant."], ["Taste", "Enhances sweetness so you can use less sugar."]],
    chem: [["Vanillin", "Phenolic aldehyde", "The main flavor; antioxidant and anti-inflammatory in lab studies."], ["p-Hydroxybenzaldehyde", "Phenolic aldehyde", "Supporting flavor compound."], ["Vanillic acid", "Phenolic acid", "Antioxidant."]],
    dose: [["Pure vanilla extract in food", "1–2 tsp (5–10 ml)", null, "Per recipe"]],
    daily: null, limit: "Culinary use."
  },
  feverfew: {
    body: [["Brain & blood vessels", "Helps prevent migraines."], ["Whole body", "Anti-inflammatory."], ["Immune system", "Traditionally reduces fevers."]],
    chem: [["Parthenolide", "Sesquiterpene lactone", "Blocks NF-κB, reduces release of serotonin from platelets, and lowers inflammatory prostaglandins — processes involved in migraine."], ["Tanetin", "Flavonoid", "Anti-inflammatory."], ["Camphor", "Monoterpene ketone", "Aromatic."]],
    dose: [["Dried leaf capsules (0.2–0.4% parthenolide)", 0.05, 0.15, "Once a day"]],
    daily: [0.05, 0.15], limit: "Use daily for at least 4 weeks to judge; taper off slowly."
  },
  meadowsweet: {
    body: [["Stomach", "Soothes acid indigestion."], ["Joints", "Eases aches."], ["Whole body", "Anti-inflammatory."]],
    chem: [["Salicylaldehyde & methyl salicylate", "Salicylates", "Converted in the body to salicylic acid, which inhibits COX enzymes — the same pathway as aspirin."], ["Tannins", "Polyphenols", "Astringent; protect the stomach lining."], ["Spiraeoside", "Flavonoid", "Anti-inflammatory."]],
    dose: [["Dried flowers as tea (per cup)", 1, 2, "Up to 3 times a day"]],
    daily: [2.5, 3.5], limit: "Not for anyone allergic to aspirin or under 16."
  },
  chickweed: {
    body: [["Skin", "Cools and relieves itching."], ["Whole body", "Nutritious green."], ["Urinary system", "Gentle diuretic."]],
    chem: [["Saponins", "Glycosides", "Soften and soothe skin; mildly diuretic."], ["Apigenin C-glycosides", "Flavonoids", "Anti-inflammatory."], ["Vitamin C & minerals", "Nutrients", "Nourishing."]],
    dose: [["Fresh leaves in salads", 10, 30, "As desired"], ["Dried herb as tea (per cup)", 1, 2, "Up to 3 times a day"], ["Chickweed salve", "Thin layer", null, "As needed for itching"]],
    daily: null, limit: "Very safe."
  },
  violet: {
    body: [["Throat", "Soothes dry coughs."], ["Skin", "Soothes dryness."], ["Whole body", "Antioxidant."]],
    chem: [["Mucilage", "Polysaccharides", "Coats and soothes the throat."], ["Saponins", "Glycosides", "Help loosen mucus."], ["Rutin", "Flavonoid", "Antioxidant and supports small blood vessels."]],
    dose: [["Dried leaf and flower as tea (per cup)", 1, 2, "Up to 3 times a day"]],
    daily: [2, 6], limit: "Use flowers and leaves only."
  },
  "rose-hips": {
    body: [["Joints", "Eases osteoarthritis pain."], ["Immune system", "Supplies vitamin C."], ["Skin", "Improves elasticity."]],
    chem: [["GOPO (galactolipid)", "Glycolipid", "Reduces the movement of inflammatory white blood cells into joints."], ["Vitamin C (ascorbic acid)", "Vitamin", "Needed for collagen and immune function."], ["Lycopene & carotenoids", "Pigments", "Antioxidant."]],
    dose: [["Rose hip powder", 2.5, 5, "1–2 times a day"], ["Dried hips as tea (per cup)", 2, 3, "Up to 3 times a day"]],
    daily: [5, 5], limit: "Joint studies used 5 g a day for 3–4 months."
  },
  "black-seed": {
    body: [["Immune system", "Calms allergies and asthma."], ["Metabolism", "Modestly lowers blood sugar and cholesterol."], ["Whole body", "Antioxidant."]],
    chem: [["Thymoquinone", "Quinone", "Blocks NF-κB and 5-lipoxygenase and reduces histamine release, calming allergic inflammation."], ["Nigellone", "Dimer of thymoquinone", "Relaxes airway muscle."], ["Linoleic acid", "Omega-6 fatty acid", "Main fat in the oil."]],
    dose: [["Black seed oil", 1, 1.5, "1–2 times a day"], ["Ground seeds", 1, 2, "1–2 times a day"]],
    daily: [1, 3], limit: "Studies typically lasted 4–12 weeks."
  },
  neem: {
    body: [["Gums", "Reduces plaque and gingivitis."], ["Skin", "Antibacterial for blemishes."], ["Scalp", "Traditional for dandruff."]],
    chem: [["Nimbidin & nimbin", "Limonoids (triterpenes)", "Anti-inflammatory and antibacterial."], ["Azadirachtin", "Limonoid", "Insect-repellent and insecticidal; the reason neem is used in organic pest sprays."], ["Quercetin", "Flavonoid", "Antioxidant."]],
    dose: [["Neem oil diluted (1 part to 10 parts carrier oil)", "Thin layer", null, "1–2 times a day"], ["Neem gel or toothpaste", "As directed", null, "2 times a day"]],
    daily: null, limit: "For external use only — neem oil is toxic if swallowed, especially for children.", ext: true
  },
  "tongkat-ali": {
    body: [["Hormones", "Helps the testes make more testosterone and may free more of it."], ["Stress response", "Lowers cortisol."], ["Reproductive system", "Supports libido and sperm health."]],
    chem: [["Eurycomanone", "Quassinoid", "In lab studies on testosterone-making Leydig cells, it blocks aromatase (which turns testosterone into estrogen) and phosphodiesterase, boosting testosterone production."], ["Eurypeptides", "Small peptides", "Thought to help release bound testosterone and support energy."], ["Polysaccharides & glycoproteins", "Water-soluble compounds", "The main components of the standardized water extracts used in trials."]],
    dose: [["Standardized water extract (e.g. LJ100, Physta)", 0.2, 0.4, "Once a day, in the morning"]],
    daily: [0.2, 0.4], limit: "Studied for 4–12 weeks. Many people cycle it (for example 5 days on, 2 off, or 8–12 weeks then a break)."
  },
  "shilajit": {
    body: [["Hormones", "Raises total and free testosterone and DHEA."], ["Energy", "Supports cellular energy in the mitochondria."], ["Reproductive system", "Supports sperm count and movement."]],
    chem: [["Fulvic acid", "Humic substance", "Carries minerals into cells and acts as an antioxidant; may support mitochondrial energy."], ["Dibenzo-α-pyrones", "Aromatic compounds", "Support CoQ10 in the mitochondria, helping cells make energy."], ["Trace minerals", "Zinc, magnesium, iron and others", "Zinc and magnesium are needed for normal testosterone production."]],
    dose: [["Purified shilajit extract (e.g. PrimaVie)", 0.25, 0.25, "Twice a day, with food"]],
    daily: [0.5, 0.5], limit: "Studied for 90 days."
  },
  "mucuna": {
    body: [["Hormones", "Lowers prolactin and raises LH and testosterone."], ["Brain", "Raises dopamine, supporting mood and motivation."], ["Reproductive system", "Supports sperm health."]],
    chem: [["L-dopa (levodopa)", "Amino acid", "Becomes dopamine in the brain; dopamine lowers prolactin and supports the brain signal (GnRH → LH) that drives testosterone production."], ["Tetrahydroisoquinolines", "Alkaloids", "Minor compounds that may act on the brain."], ["Phenolic antioxidants", "Polyphenols", "Protect sperm from oxidative damage."]],
    dose: [["Seed powder (as used in fertility studies)", 2.5, 5, "Once a day, with food"], ["Standardized extract (15% L-dopa)", 0.3, 0.5, "1–2 times a day, with food"]],
    daily: [2.5, 5], limit: "Studies lasted 3 months. Best used with a doctor's guidance."
  },
  "tribulus": {
    body: [["Reproductive system", "May improve libido and erectile function."], ["Hormones", "Little effect on testosterone in most human trials."], ["Urinary system", "Traditionally a mild diuretic."]],
    chem: [["Protodioscin", "Steroidal saponin", "Proposed to raise luteinizing hormone and convert to DHEA; these effects have not been reliably seen in people."], ["Tribulosin & other saponins", "Steroidal saponins", "May relax blood vessels, supporting erectile function."], ["Kaempferol & quercetin glycosides", "Flavonoids", "Antioxidant."]],
    dose: [["Standardized fruit extract (40–60% saponins)", 0.25, 0.75, "1–2 times a day, with food"]],
    daily: [0.75, 1.5], limit: "Studied for up to 12 weeks."
  },
  "maca": {
    body: [["Brain", "Supports libido and mood."], ["Reproductive system", "Supports sperm health."], ["Energy", "A nourishing source of carbohydrates, protein and minerals."]],
    chem: [["Macamides", "Fatty acid amides", "Unique to maca; may act on the body's endocannabinoid system, influencing mood and desire."], ["Glucosinolates", "Sulfur compounds", "Break down into isothiocyanates — and are why raw maca can affect the thyroid."], ["Macaenes", "Polyunsaturated fatty acids", "May contribute to the effect on energy and libido."]],
    dose: [["Gelatinized root powder", 1.5, 3, "Once a day"]],
    daily: [1.5, 3], limit: "Studied for up to 4 months; safe as a regular food."
  },
  "horny-goat-weed": {
    body: [["Circulation", "May improve blood flow for erections."], ["Hormones", "Raised testosterone in animal studies."], ["Bones", "Supports bone density."]],
    chem: [["Icariin", "Prenylated flavonol glycoside", "Weakly inhibits PDE5 and boosts nitric oxide, relaxing blood vessels; raised testosterone in animal studies."], ["Epimedins A, B and C", "Flavonoid glycosides", "Related compounds that support bone-building cells."], ["Icaritin", "Flavonoid", "An active breakdown product with mild hormone-like effects."]],
    dose: [["Extract (10–20% icariin)", 0.25, 0.5, "Once or twice a day"], ["Dried leaf as tea", 3, 6, "Once a day"]],
    daily: [0.25, 1], limit: "Avoid high doses; usually taken for up to 3 months."
  },
  "cordyceps": {
    body: [["Energy", "Supports stamina and oxygen use."], ["Hormones", "Raised testosterone in animal studies."], ["Immune system", "Activates immune cells."]],
    chem: [["Cordycepin (3′-deoxyadenosine)", "Nucleoside", "Acts on energy-sensing (AMPK) pathways and stimulated testosterone production in Leydig cells in lab studies."], ["Beta-glucans", "Polysaccharides", "Activate immune cells."], ["Adenosine", "Nucleoside", "Supports blood flow and cellular energy."]],
    dose: [["Mushroom extract (Cs-4 or C. militaris)", 1, 3, "Once a day, or split"]],
    daily: [1, 3], limit: "Studied for up to 12 weeks."
  }
};
