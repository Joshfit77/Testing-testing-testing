// Benefits explained, for each herb: [evidence, title, explanation].
// Evidence: "R" = well researched (multiple human trials or reviews),
//           "P" = some research (small or early human studies, or lab work),
//           "T" = traditional use (long history, little modern research).

const EVIDENCE = {
  R: { label: "Well researched", note: "Supported by several human clinical trials or systematic reviews." },
  P: { label: "Some research", note: "Small or early human studies, or mainly laboratory research." },
  T: { label: "Traditional use", note: "A long history of use, with little modern research so far." }
};

const BENEFITS = {
  chamomile: [
    ["P", "Calm and better sleep", "Chamomile contains apigenin, a flavonoid that binds to the same calming GABA receptors in the brain targeted by some anti-anxiety medicines, giving a mild relaxing effect. Small clinical trials found chamomile extract improved sleep quality in older adults and eased symptoms of generalized anxiety."],
    ["P", "Digestive comfort", "Compounds in chamomile relax the smooth muscle of the gut, which helps explain why it eases cramping, gas and that uncomfortable 'too full' feeling. It is a key ingredient in several European digestive remedies."],
    ["T", "Soothing irritated skin", "Bisabolol and chamazulene — the oils that turn chamomile oil blue — calm inflammation. Cooled chamomile compresses and creams have long been used for mild rashes, sunburn and tired eyes."]
  ],
  peppermint: [
    ["R", "Bloating and IBS relief", "Menthol relaxes the muscles of the intestines by blocking calcium channels, easing spasms. Many clinical trials and reviews show enteric-coated peppermint oil capsules reduce abdominal pain and bloating in irritable bowel syndrome."],
    ["P", "Tension headaches", "Diluted peppermint oil rubbed on the temples creates a cooling sensation that dampens pain signals. In small studies, it relieved tension headaches about as well as a standard dose of acetaminophen."],
    ["T", "Feeling of clearer breathing", "Menthol stimulates cold receptors in the nose, creating the sensation of air flowing more freely. It doesn't physically open the airways, but it can make a stuffy nose feel much more comfortable."]
  ],
  spearmint: [
    ["T", "Gentle digestion", "Like other mints, spearmint relaxes the digestive tract, easing gas and fullness after meals. Its carvone content gives a softer flavor than peppermint, so it suits people who find peppermint too strong."],
    ["P", "Hormone balance in women", "Small trials in women with polycystic ovary syndrome (PCOS) found that two cups of spearmint tea a day lowered free testosterone levels, which may help reduce unwanted hair growth. Larger studies are still needed."],
    ["T", "Fresh breath", "Spearmint's clean, sweet aroma masks odors, and its oils have mild antibacterial action — which is why it's a classic in chewing gum and toothpaste."]
  ],
  ginger: [
    ["R", "Nausea relief", "Gingerols and shogaols act on the stomach and on serotonin receptors involved in feeling sick. Clinical trials support ginger for pregnancy-related nausea and motion sickness, and many pregnancy guidelines list it as a first option to try."],
    ["P", "Joint and muscle comfort", "Ginger blocks some of the same inflammation pathways (COX enzymes) as common pain relievers. Studies suggest modest reductions in osteoarthritis pain and in muscle soreness after exercise."],
    ["P", "Healthy digestion", "Ginger helps the stomach empty more quickly, which can reduce heaviness, bloating and indigestion after meals."]
  ],
  turmeric: [
    ["P", "Joint comfort", "Curcumin turns down inflammatory signals in the body (such as NF-κB). Several clinical trials found curcumin extracts eased knee osteoarthritis pain about as well as ibuprofen for some people, though products and doses varied."],
    ["P", "Antioxidant protection", "Curcumin neutralizes free radicals and boosts the body's own antioxidant enzymes. On its own it is poorly absorbed, so it's best taken with black pepper and a little fat."],
    ["T", "Digestive support", "In Ayurveda, turmeric is a warming spice that supports digestion and bile flow. Some studies suggest it may ease indigestion, although it can aggravate reflux in some people."]
  ],
  lavender: [
    ["R", "Calm and anxiety relief", "A standardized oral lavender oil (Silexan) reduced anxiety in several clinical trials, with effects comparable to some medicines but without sedation. Linalool and linalyl acetate in lavender appear to calm overactive nerve signaling."],
    ["P", "Better sleep", "Studies on breathing in lavender's scent found small improvements in sleep quality, especially for people with mild sleep problems or in noisy settings like hospitals."],
    ["T", "Skin and bites", "Properly diluted lavender oil has mild antiseptic and soothing properties and has long been used on minor burns, insect bites and blemishes."]
  ],
  rosemary: [
    ["P", "Alertness and memory", "1,8-cineole from rosemary's aroma is absorbed into the bloodstream and may influence brain chemistry. Small studies linked breathing in rosemary aroma with better performance on memory and alertness tasks."],
    ["P", "Hair growth", "In one six-month trial, rosemary oil massaged into the scalp regrew hair about as well as 2% minoxidil in people with pattern hair loss, with less scalp itching. It is thought to improve circulation to hair follicles."],
    ["T", "Digesting rich foods", "Rosemary's bitter, aromatic compounds encourage digestive juices, which is why it pairs so naturally with roasts and potatoes."]
  ],
  thyme: [
    ["P", "Cough relief", "Thymol and carvacrol relax the airway muscles and help loosen mucus. Clinical trials of thyme combined with ivy leaf found people with acute bronchitis stopped coughing sooner than with placebo."],
    ["P", "Fights germs", "Thyme oil is strongly antimicrobial in laboratory studies. Thymol is the active ingredient in some well-known antiseptic mouthwashes."],
    ["T", "Sore throats", "Warm thyme tea with honey is a traditional European throat remedy, and thyme is officially approved in Germany for symptoms of bronchitis."]
  ],
  sage: [
    ["P", "Hot flushes and sweating", "In small studies, a fresh sage extract reduced the number and intensity of menopausal hot flushes over eight weeks. Sage has long been used for excessive sweating in general."],
    ["P", "Sore throats", "A sage throat spray reduced sore-throat pain in clinical trials. Its tannins tighten and soothe tissue, and its oils are antimicrobial."],
    ["P", "Memory and mood", "Early trials suggest sage may improve memory and alertness in healthy adults, possibly by protecting acetylcholine, a brain messenger important for learning."]
  ],
  oregano: [
    ["P", "Rich in antioxidants", "Dried oregano is one of the most antioxidant-rich culinary herbs, thanks mainly to rosmarinic acid, carvacrol and thymol."],
    ["P", "Fights germs", "Carvacrol and thymol show strong antibacterial and antifungal activity in laboratory studies. Human research is still limited, so oregano oil is not a replacement for medical treatment."],
    ["T", "Coughs and congestion", "Oregano tea and steam are traditional Mediterranean remedies to ease coughs and clear a stuffy nose."]
  ],
  basil: [
    ["T", "Digestive comfort", "Basil's eugenol and linalool relax the gut, and it is traditionally taken after meals as a tea to ease gas and bloating."],
    ["P", "Anti-inflammatory compounds", "Eugenol in basil blocks COX enzymes in laboratory studies — the same target as some pain relievers — and its flavonoids help protect cells from damage."],
    ["T", "Nutrient boost", "A generous handful of fresh basil adds vitamin K, vitamin A and manganese to everyday meals."]
  ],
  "holy-basil": [
    ["P", "Stress resilience", "Clinical trials found tulsi reduced stress, anxiety and low-mood scores and improved sleep after six to eight weeks. It is thought to help regulate cortisol, the body's main stress hormone."],
    ["P", "Healthy blood sugar", "Small studies show tulsi may lower fasting and after-meal blood sugar in people with type 2 diabetes when used alongside their usual care."],
    ["T", "Breathing and immunity", "Ayurveda uses tulsi for coughs and colds. Laboratory studies show antimicrobial and immune-balancing effects."]
  ],
  parsley: [
    ["P", "Packed with nutrients", "Just two tablespoons of fresh parsley supply more than a day's vitamin K, which supports healthy blood clotting and bones, plus useful vitamin C and folate."],
    ["T", "Fresh breath and digestion", "Parsley's chlorophyll and aromatic oils freshen the breath, and it has long been served with meals to aid digestion."],
    ["T", "Gentle diuretic", "Parsley is traditionally used to increase urine flow, and animal studies support a mild diuretic effect."]
  ],
  coriander: [
    ["P", "Digestive relief", "Coriander seed relaxes the digestive tract. In one clinical trial, a remedy containing coriander reduced pain and bloating in irritable bowel syndrome."],
    ["P", "Blood sugar balance", "Animal studies show coriander seed may help lower blood sugar; human studies are still limited."],
    ["T", "Antioxidants and vitamins", "Fresh cilantro is rich in vitamin K, vitamin A and antioxidants such as quercetin."]
  ],
  dill: [
    ["T", "Gas and colic", "Dill seed oil (carvone and limonene) relaxes the digestive tract. 'Gripe water' made with dill has been given for colic for centuries."],
    ["P", "Fights germs", "Dill oil shows antibacterial activity in laboratory studies, one reason it was traditionally used in pickling."],
    ["T", "Minerals and vitamins", "Dill seed contains calcium and other minerals, and fresh fronds add vitamins A and C."]
  ],
  fennel: [
    ["P", "Bloating and colic", "Anethole relaxes the muscles of the intestines. A clinical trial found a fennel seed oil emulsion reduced colic in infants, and fennel is widely used for gas and bloating in adults."],
    ["P", "Period pain", "Several small trials found fennel extract eased menstrual cramps about as well as the pain reliever mefenamic acid."],
    ["T", "Breastfeeding support", "Fennel is a traditional galactagogue — an herb used to support breast milk — though scientific evidence is limited."]
  ],
  "lemon-balm": [
    ["P", "Calm and mood", "Rosmarinic acid in lemon balm slows the breakdown of GABA, a calming brain messenger. Trials found improved calmness and reduced anxiety after a single dose and over several weeks."],
    ["P", "Sleep quality", "Combined with valerian, lemon balm improved sleep quality in small studies, including in children with restlessness."],
    ["P", "Cold sores", "A lemon balm cream applied at the first tingle shortened healing time and reduced redness of cold sores in clinical studies."]
  ],
  lemongrass: [
    ["T", "Digestive aid", "Citral, lemongrass's main oil, relaxes the stomach. It is a traditional remedy for indigestion and cramps in Brazil and Southeast Asia."],
    ["P", "Fights germs", "Lemongrass oil is active against many fungi and bacteria in laboratory studies, which is why it's popular in natural cleaners."],
    ["T", "Relaxation", "In Brazilian folk medicine, lemongrass tea (capim-santo) is a beloved calming drink, though human studies are mixed."]
  ],
  "lemon-verbena": [
    ["P", "Antioxidant protection", "Lemon verbena is rich in verbascoside, a powerful antioxidant studied for protecting muscles from damage after exercise."],
    ["T", "Relaxation and sleep", "A traditional evening tea in France and Spain, enjoyed to unwind and encourage sleep."],
    ["T", "Digestive comfort", "Taken after meals to ease indigestion and gas."]
  ],
  garlic: [
    ["R", "Healthy blood pressure", "Allicin and the sulfur compounds it forms help blood vessels relax. Reviews of clinical trials found aged garlic extract lowered systolic blood pressure by around 8 mmHg in people with high blood pressure."],
    ["P", "Cholesterol", "Garlic modestly lowers total and LDL ('bad') cholesterol in several studies, especially in people whose levels are high."],
    ["P", "Immune support", "In one trial, people taking garlic daily caught fewer colds. Allicin is antimicrobial in laboratory studies."]
  ],
  cinnamon: [
    ["P", "Blood sugar balance", "Cinnamon may help cells respond better to insulin and slow the absorption of sugar after meals. Some studies show small reductions in fasting blood sugar, though results are inconsistent."],
    ["P", "Antioxidant", "Cinnamon is very rich in polyphenols that protect cells from oxidative stress."],
    ["T", "Warming digestion", "Cinnamaldehyde stimulates digestion and has long been used to ease gas, nausea and sluggish digestion."]
  ],
  clove: [
    ["R", "Tooth and gum pain", "Eugenol is a natural anesthetic and antiseptic. In a dental study, a clove gel numbed the gums about as well as benzocaine gel."],
    ["P", "Antioxidant powerhouse", "Ground cloves rank among the highest of all foods for antioxidant capacity."],
    ["T", "Digestion", "Clove is used in Ayurvedic and Chinese medicine to ease gas, nausea and hiccups."]
  ],
  cardamom: [
    ["T", "Easing bloating", "Cardamom's cineole and terpinyl acetate relax the gut and help release trapped gas, making it a classic after-meal spice."],
    ["P", "Blood pressure", "In one small study, people with high blood pressure who took cardamom powder daily saw their blood pressure fall over 12 weeks."],
    ["P", "Fresh breath", "Cardamom's oils fight the mouth bacteria that cause bad breath — which is why chewing a pod after meals is a tradition across India and the Middle East."]
  ],
  nutmeg: [
    ["T", "Restful sleep", "A tiny pinch in warm milk is a traditional bedtime remedy. Myristicin may have mild sedative effects, but evidence is anecdotal — and larger amounts are harmful."],
    ["T", "Settling digestion", "Used in small amounts in traditional medicine to ease diarrhea, gas and indigestion."],
    ["P", "Fights mouth bacteria", "Laboratory studies show nutmeg compounds are active against bacteria that cause tooth decay."]
  ],
  "black-pepper": [
    ["R", "Better absorption of nutrients", "Piperine slows the enzymes that break down certain compounds in the gut and liver. In one study, it increased the absorption of curcumin from turmeric by up to 2,000%."],
    ["P", "Digestive stimulation", "Black pepper stimulates digestive enzymes and stomach acid, helping the body break down food."],
    ["P", "Antioxidant", "Piperine has antioxidant and anti-inflammatory properties in laboratory studies."]
  ],
  cayenne: [
    ["R", "Pain relief on the skin", "Capsaicin depletes 'substance P,' a messenger that carries pain signals. Capsaicin creams and patches are approved treatments for arthritis and nerve pain."],
    ["P", "Metabolism and appetite", "Capsaicin slightly increases the calories the body burns and can help you feel full sooner, according to several small studies."],
    ["P", "Warming circulation", "Capsaicin widens blood vessels near the skin, creating the familiar feeling of warmth."]
  ],
  cumin: [
    ["P", "Digestive comfort", "Cumin stimulates digestive enzymes and bile. A small trial found cumin extract improved symptoms of irritable bowel syndrome."],
    ["P", "Weight and cholesterol", "Small studies found that adding cumin powder to a healthy diet supported weight loss and improved cholesterol levels."],
    ["T", "A source of iron", "One teaspoon of ground cumin supplies a meaningful amount of iron, which is important for energy."]
  ],
  fenugreek: [
    ["P", "Blood sugar balance", "Fenugreek's soluble fiber (galactomannan) slows the absorption of carbohydrates. Several studies found it lowered blood sugar in people with type 2 diabetes."],
    ["P", "Breast milk supply", "Some small studies suggest fenugreek may increase breast milk production, though results are mixed."],
    ["T", "Soothing the gut", "Soaked fenugreek seeds become gel-like and have long been used to soothe the stomach and ease constipation."]
  ],
  anise: [
    ["P", "Indigestion", "Anethole relaxes the digestive tract. A clinical trial found anise powder improved symptoms of functional dyspepsia (ongoing indigestion)."],
    ["T", "Loosening coughs", "Anise is a traditional expectorant, helping to thin and loosen mucus so coughs are more productive."],
    ["P", "Menopause and period pain", "Small studies suggest anise may reduce hot flushes and menstrual cramps, likely due to weak estrogen-like effects."]
  ],
  "star-anise": [
    ["T", "Coughs and colds", "Star anise is used in Chinese medicine to warm the body and ease coughs during colds."],
    ["T", "Digestive comfort", "Like anise and fennel, its anethole helps relieve gas and bloating."],
    ["P", "A source of medicine", "Shikimic acid extracted from star anise is the starting material for the flu medicine oseltamivir (Tamiflu) — though the spice itself won't treat the flu."]
  ],
  licorice: [
    ["P", "Soothing sore throats", "Licorice coats and soothes the throat. In a hospital study, a licorice gargle before surgery reduced sore throat afterwards."],
    ["P", "Protecting the stomach lining", "DGL licorice may help the stomach produce more protective mucus, easing occasional heartburn and indigestion."],
    ["P", "Anti-inflammatory", "Glycyrrhizin has anti-inflammatory and antiviral effects in laboratory studies — but it is also the compound that raises blood pressure."]
  ],
  "marshmallow-root": [
    ["P", "Dry coughs", "Marshmallow's mucilage forms a protective film over irritated membranes in the throat. A study found marshmallow syrup reduced dry, irritating coughs."],
    ["T", "Calming the digestive tract", "Traditionally used to soothe heartburn, gastritis and an irritated gut lining."],
    ["T", "Skin soothing", "Applied as a poultice to soften and calm dry, irritated skin."]
  ],
  "slippery-elm": [
    ["T", "Sore throats", "Mucilage in the inner bark coats and soothes the throat. It is an approved soothing ingredient in throat lozenges in the U.S."],
    ["P", "Digestive comfort", "Traditionally used for heartburn and irritable bowels. A small study found a formula containing slippery elm improved bowel habits and bloating."],
    ["T", "Skin poultice", "Native American and early American healers used slippery elm paste on wounds, boils and burns."]
  ],
  echinacea: [
    ["P", "Fewer and shorter colds", "Reviews of clinical trials suggest echinacea may modestly reduce the chance of catching a cold and may shorten colds slightly when started early. Results vary by product."],
    ["P", "Activating immune cells", "Alkamides and polysaccharides in echinacea stimulate immune cells in laboratory studies."],
    ["P", "Sore throats", "In one trial, an echinacea-and-sage throat spray worked about as well as a standard medicated spray."]
  ],
  elderberry: [
    ["P", "Shorter colds and flu", "Several clinical trials found elderberry extract shortened flu and cold symptoms by two to four days, especially when started within the first 48 hours."],
    ["P", "Travel colds", "In a study of air travelers, those taking elderberry had shorter, milder colds."],
    ["P", "Antioxidant", "Elderberries are packed with anthocyanins, the deep purple pigments that give strong antioxidant activity."]
  ],
  elderflower: [
    ["T", "Colds and fevers", "Elderflower tea is diaphoretic — it encourages gentle sweating, which has long been used to help the body through feverish colds."],
    ["T", "Sinus congestion", "Elderflower is included in European combination remedies used for sinus congestion."],
    ["P", "Anti-inflammatory", "Elderflower's flavonoids show anti-inflammatory activity in laboratory studies."]
  ],
  calendula: [
    ["P", "Wound healing", "Calendula's triterpenoids encourage new tissue and blood vessel growth. Studies found calendula ointment helped wounds heal and reduced skin irritation during radiation therapy."],
    ["P", "Diaper rash", "In one study of babies, calendula ointment improved diaper rash more than aloe gel."],
    ["T", "Calming sensitive skin", "Used in balms for eczema, chapped skin and minor irritation for centuries."]
  ],
  rose: [
    ["P", "Easing anxiety", "Small studies found that rose oil aroma reduced anxiety and promoted relaxation."],
    ["P", "Period pain", "A trial in teenage girls found rose tea reduced menstrual pain and anxiety compared with no treatment."],
    ["T", "Skin toning", "Rosewater is mildly astringent and anti-inflammatory, helping calm redness and refresh the skin."]
  ],
  hibiscus: [
    ["R", "Healthy blood pressure", "Hibiscus anthocyanins act a little like a mild ACE inhibitor and diuretic. In clinical trials, two to three cups a day lowered systolic blood pressure by about 7 mmHg in people with mildly high blood pressure."],
    ["P", "Cholesterol", "Some studies show modest improvements in cholesterol levels with regular hibiscus tea."],
    ["P", "Antioxidant and vitamin C", "Hibiscus is rich in vitamin C and anthocyanin antioxidants."]
  ],
  "aloe-vera": [
    ["P", "Burns and sunburn", "Studies found aloe gel helped first- and second-degree burns heal faster than some conventional dressings."],
    ["P", "Skin hydration", "Aloe's polysaccharides draw moisture into the skin and calm irritation."],
    ["P", "Gum health", "Aloe mouthwash and gels reduced plaque and gum inflammation in small studies."]
  ],
  dandelion: [
    ["T", "Supporting the liver and digestion", "Dandelion's bitter compounds stimulate bile flow and digestive juices. This is why it has been a classic 'liver herb' and spring tonic for centuries."],
    ["P", "Natural diuretic", "A small human study found dandelion leaf extract increased how often people urinated, supporting its traditional use for water retention. The leaves are naturally high in potassium."],
    ["P", "Feeding good gut bacteria", "Dandelion root is rich in inulin, a prebiotic fiber that feeds beneficial gut bacteria."]
  ],
  burdock: [
    ["T", "Clearer skin", "Burdock is a traditional 'blood purifier' used for acne, eczema and boils. Evidence is mainly traditional, but its anti-inflammatory compounds may help."],
    ["P", "Prebiotic fiber", "Burdock root is rich in inulin, which feeds beneficial gut bacteria and supports regularity."],
    ["P", "Antioxidant", "Burdock contains quercetin, luteolin and phenolic acids that protect cells from oxidative damage."]
  ],
  nettle: [
    ["P", "Seasonal allergies", "Nettle may reduce the release of histamine and other inflammatory chemicals. A small study found freeze-dried nettle helped hay fever symptoms."],
    ["P", "Joint pain", "In some studies, nettle leaf extract or applying fresh nettle to painful joints reduced arthritis pain."],
    ["P", "Prostate health", "Nettle root extract improved urinary symptoms of an enlarged prostate in several clinical trials."]
  ],
  "red-clover": [
    ["P", "Menopause support", "Red clover's isoflavones are plant compounds with weak estrogen-like effects. Some trials found they slightly reduced hot flushes; others found no effect."],
    ["P", "Bone health", "Some studies suggest red clover isoflavones may slow bone loss after menopause."],
    ["T", "Skin and coughs", "Traditionally used in remedies for eczema, psoriasis and coughs."]
  ],
  "milk-thistle": [
    ["P", "Protecting the liver", "Silymarin stabilizes liver cell membranes and raises glutathione, the liver's main antioxidant. Studies show improved liver enzyme levels in some liver conditions."],
    ["R", "Mushroom poisoning antidote", "Intravenous silibinin, made from milk thistle, is used in European hospitals to treat death cap mushroom poisoning."],
    ["P", "Blood sugar", "Several trials found milk thistle lowered fasting blood sugar in people with type 2 diabetes."]
  ],
  hawthorn: [
    ["P", "Supporting the heart", "Hawthorn's flavonoids and procyanidins help the heart muscle pump more efficiently and relax blood vessels. A review of trials found improved exercise tolerance and fewer symptoms in mild heart failure — always under a doctor's care."],
    ["P", "Blood pressure", "Small studies found hawthorn modestly lowered blood pressure."],
    ["T", "Antioxidant protection", "The berries, leaves and flowers are rich in antioxidant flavonoids that protect blood vessels."]
  ],
  ginkgo: [
    ["P", "Circulation", "Ginkgolides improve blood flow and make platelets less sticky. Studies found ginkgo modestly increased pain-free walking distance in people with poor leg circulation."],
    ["P", "Memory", "Some studies show small benefits for memory and thinking in people with dementia, but large trials found ginkgo did not prevent dementia in healthy older adults."],
    ["P", "Protecting nerve cells", "Ginkgo flavonoids protect nerve cells from oxidative stress in laboratory studies."]
  ],
  ginseng: [
    ["P", "Energy and fatigue", "Ginsenosides influence how the body produces and uses energy. Clinical trials found ginseng reduced fatigue, including in people with chronic illness."],
    ["P", "Mental performance", "Some trials report improved memory, calmness and mental arithmetic after taking ginseng."],
    ["P", "Blood sugar and erectile function", "Ginseng may lower blood sugar after meals, and several trials found Korean red ginseng improved erectile function."]
  ],
  ashwagandha: [
    ["R", "Stress and cortisol", "Several randomized trials found ashwagandha root extract reduced stress scores and lowered cortisol — the main stress hormone — by roughly 20–30% over eight weeks."],
    ["P", "Better sleep", "Trials show ashwagandha helped people fall asleep faster and improved sleep quality, including in people with insomnia."],
    ["P", "Strength and stamina", "Studies found that people doing strength training gained more muscle strength when taking ashwagandha, and endurance (VO2 max) improved in athletes."]
  ],
  rhodiola: [
    ["P", "Reducing fatigue", "Rhodiola's salidroside and rosavins appear to help regulate the body's stress response. Trials found reduced fatigue and exhaustion in people with burnout."],
    ["P", "Focus under pressure", "Studies found improved concentration and mental performance in stressful situations such as night shifts and exams."],
    ["P", "Exercise endurance", "Some studies show improved endurance and faster recovery after exercise."]
  ],
  valerian: [
    ["P", "Falling asleep", "Valerenic acid acts on GABA receptors in the brain, the same calming system targeted by sleep medicines. Some studies show faster sleep and better sleep quality, though results are mixed."],
    ["P", "Easing anxiety", "Small studies found valerian reduced anxious feelings, particularly in stressful situations."],
    ["T", "Muscle tension", "Valerian has traditionally been used to ease muscle cramps and tension."]
  ],
  passionflower: [
    ["P", "Calming anxiety", "Flavonoids such as chrysin interact with GABA receptors. In one trial, passionflower eased generalized anxiety about as well as the medicine oxazepam, with less impact on daily performance."],
    ["P", "Sleep quality", "A small study found that a cup of passionflower tea before bed improved sleep quality."],
    ["P", "Pre-surgery nerves", "Clinical trials found passionflower reduced anxiety before surgery without causing excess sedation."]
  ],
  skullcap: [
    ["P", "Calm and mood", "Skullcap's baicalin and baicalein act on GABA receptors. A small trial found American skullcap improved mood without reducing energy."],
    ["T", "Nervous tension", "Skullcap has been a favorite 'nervine' — an herb for frazzled nerves — in North American herbalism for over 200 years."],
    ["T", "Sleep", "Used for sleeplessness caused by a busy, worried mind."]
  ],
  hops: [
    ["P", "Better sleep", "Hops contain sedating compounds that act on the brain's sleep-wake system. Combined with valerian, hops improved sleep in several trials."],
    ["P", "Menopause symptoms", "Hops contain 8-prenylnaringenin, a strong plant estrogen. Small trials found hop extracts reduced hot flushes."],
    ["T", "Appetite and digestion", "Hops' bitter acids stimulate digestive secretions and appetite."]
  ],
  catnip: [
    ["T", "Gentle calm", "Nepetalactone, the compound that excites cats, has mild calming effects in people. Catnip tea is a traditional remedy for restlessness, including in children."],
    ["T", "Digestive comfort", "Used for colic, gas and an upset stomach."],
    ["P", "Insect repellent", "In laboratory tests, nepetalactone repelled mosquitoes as effectively as or better than DEET."]
  ],
  linden: [
    ["T", "Relaxation", "Linden's flavonoids and volatile oils have made it one of Europe's favorite calming teas for nervous tension and irritability."],
    ["T", "Colds and fevers", "Linden encourages gentle sweating and contains soothing mucilage for the throat, making it a traditional cold-season tea."],
    ["P", "Calming effects", "Laboratory studies show linden extracts have mild anti-anxiety effects."]
  ],
  "oat-straw": [
    ["R", "Itchy, dry skin", "Colloidal oatmeal contains avenanthramides, which reduce inflammation and itching. It is an officially recognized skin protectant used for eczema and dry skin."],
    ["P", "Mental focus", "Small trials found green oat extract improved attention and concentration."],
    ["T", "Nerve tonic", "Milky oats are a traditional tonic for stress, exhaustion and frazzled nerves."]
  ],
  horsetail: [
    ["T", "Hair and nails", "Horsetail is one of the richest plant sources of silica, which the body uses to build collagen. It's traditionally used for brittle hair and nails, but evidence is limited."],
    ["P", "Diuretic", "A clinical trial found horsetail extract increased urine output about as much as the diuretic medicine hydrochlorothiazide."],
    ["P", "Bone health", "Silica may support bone density; early studies are promising but limited."]
  ],
  yarrow: [
    ["T", "Minor cuts", "Yarrow's achilleine may help blood clot, which is why it was used on the battlefield to stop minor bleeding."],
    ["P", "Digestion", "Yarrow is bitter and relaxes the gut. It is approved in Germany for loss of appetite and indigestion."],
    ["T", "Fevers", "A hot yarrow tea encourages sweating, traditionally used to help the body through fevers."]
  ],
  plantain: [
    ["T", "Bites and stings", "Plantain's aucubin and allantoin calm inflammation and support skin repair, making it a famous field remedy for stings and bites."],
    ["P", "Soothing coughs", "Its mucilage soothes irritated throats. Ribwort plantain is approved in Germany for irritation of the mouth, throat and airways."],
    ["P", "Wound healing", "Laboratory studies show plantain extracts reduce inflammation and help skin heal."]
  ],
  mullein: [
    ["T", "Dry coughs", "Mullein's mucilage soothes, and its saponins help loosen mucus, making it a classic lung herb."],
    ["P", "Ear pain", "In a study of children with ear pain, herbal ear drops containing mullein relieved pain as well as anesthetic ear drops (only use if the eardrum is intact)."],
    ["T", "Respiratory support", "Traditionally used for bronchitis and chest colds."]
  ],
  hyssop: [
    ["T", "Coughs and congestion", "Hyssop is a traditional expectorant used to loosen phlegm during chest colds."],
    ["T", "Digestion", "Its aromatic oils relieve gas and bloating."],
    ["P", "Antiviral activity", "Laboratory studies show hyssop extracts are active against some viruses, including herpes viruses."]
  ],
  horehound: [
    ["P", "Coughs", "Marrubiin helps thin mucus. Horehound is approved in Germany for coughs and loss of appetite."],
    ["T", "Appetite and digestion", "As a strong bitter, horehound stimulates digestive juices and appetite."],
    ["T", "Soothing throats", "Horehound candies and syrups have been used for sore throats since the 1800s."]
  ],
  eucalyptus: [
    ["P", "Clearing congestion", "Eucalyptol (1,8-cineole) helps thin mucus and calm airway inflammation. Clinical trials of cineole capsules found faster relief in sinusitis and bronchitis."],
    ["P", "Fights germs", "Eucalyptus oil is antibacterial and is used in some mouthwashes and wound products."],
    ["T", "Muscle aches", "Eucalyptus is a common ingredient in warming rubs for sore muscles."]
  ],
  "tea-tree": [
    ["P", "Acne", "In clinical trials, 5% tea tree oil gel reduced acne lesions compared with placebo. It works more slowly than benzoyl peroxide but with less dryness."],
    ["P", "Athlete's foot and nails", "Tea tree oil reduced symptoms of athlete's foot in trials, and higher strengths improved nail fungus."],
    ["P", "Antiseptic", "Terpinen-4-ol, its main compound, kills many bacteria and fungi."]
  ],
  "witch-hazel": [
    ["R", "Hemorrhoid relief", "Witch hazel is an officially approved astringent for temporary relief of hemorrhoid itching and discomfort."],
    ["P", "Calming skin redness", "Its tannins and polyphenols reduce inflammation; studies show it eases sunburn redness and irritated skin."],
    ["T", "Toning oily skin", "Witch hazel tightens the skin and reduces shine, making it a classic toner."]
  ],
  arnica: [
    ["P", "Bruises", "Some studies found topical arnica reduced bruising and swelling, for example after cosmetic surgery."],
    ["P", "Arthritis pain", "In a trial of people with hand arthritis, arnica gel relieved pain about as well as ibuprofen gel."],
    ["T", "Sore muscles", "Arnica has long been rubbed on aching muscles and sprains."]
  ],
  "st-johns-wort": [
    ["R", "Mild to moderate low mood", "Hyperforin and hypericin affect serotonin, dopamine and norepinephrine. A Cochrane review found St. John's wort worked better than placebo and similarly to standard antidepressants for mild to moderate depression — but only use it with medical guidance because of its many interactions."],
    ["P", "Menopausal mood", "Combined with black cohosh, it improved mood and hot flushes in some menopause trials."],
    ["T", "Nerve pain and minor burns", "The red oil made from its flowers is a traditional rub for nerve pain and minor burns."]
  ],
  "saw-palmetto": [
    ["P", "Urinary symptoms in men", "Saw palmetto may block the enzyme that converts testosterone to DHT. Early studies were promising, but large trials found little benefit over placebo for enlarged prostate symptoms."],
    ["P", "Thinning hair", "Small studies suggest saw palmetto, taken by mouth or applied to the scalp, may improve hair density in pattern hair loss."],
    ["T", "Traditional tonic", "Indigenous peoples of Florida ate the berries as a food and tonic."]
  ],
  chasteberry: [
    ["R", "PMS relief", "Chasteberry acts on dopamine receptors in the pituitary gland, lowering prolactin. Several trials found it reduced PMS symptoms such as irritability, mood swings, headaches and breast tenderness."],
    ["P", "Breast tenderness", "Trials found it eased cyclical breast pain."],
    ["P", "Cycle regularity", "It may help balance the second half of the menstrual cycle; evidence for fertility is limited."]
  ],
  "raspberry-leaf": [
    ["T", "Toning the uterus", "Raspberry leaf contains fragarine, believed to tone the muscles of the pelvic area. It's a traditional women's tonic."],
    ["P", "Preparing for labor", "One study suggested a slightly shorter pushing stage of labor and no harmful effects, but evidence is limited. Only use in pregnancy with your midwife's guidance."],
    ["T", "Period cramps", "Used traditionally to ease menstrual cramps."]
  ],
  moringa: [
    ["P", "Nutrition", "Moringa leaves contain protein with all essential amino acids, plus iron, calcium, and vitamins A and C — which is why they are used to fight malnutrition."],
    ["P", "Blood sugar balance", "Small studies found moringa leaf powder lowered blood sugar after meals."],
    ["P", "Antioxidant", "Moringa is rich in quercetin and chlorogenic acid, which protect cells."]
  ],
  "green-tea": [
    ["R", "Calm focus", "Green tea's caffeine combined with L-theanine improves attention and alertness with fewer jitters than coffee, according to multiple studies."],
    ["P", "Heart health", "Catechins such as EGCG may lower LDL cholesterol. Large Japanese population studies found people who drank more green tea had lower rates of death from heart disease."],
    ["P", "Metabolism", "Green tea catechins may slightly increase fat burning, though the effect is small."]
  ],
  rooibos: [
    ["P", "Antioxidants", "Rooibos contains aspalathin and nothofagin, antioxidants found almost nowhere else, which protect cells from oxidative stress."],
    ["P", "Heart health", "In a small study, adults who drank six cups of rooibos daily for six weeks had improved cholesterol and antioxidant levels."],
    ["T", "Caffeine-free calm", "Naturally caffeine-free and low in tannins, rooibos is a gentle drink for evenings, children and anyone avoiding caffeine."]
  ],
  "yerba-mate": [
    ["P", "Energy and focus", "Yerba mate combines caffeine with theobromine (also found in chocolate), giving a steady lift that many describe as smoother than coffee."],
    ["P", "Cholesterol", "Studies found daily mate drinking lowered LDL cholesterol, especially when combined with healthy eating."],
    ["P", "Antioxidant", "Mate is very rich in chlorogenic acid and other polyphenols."]
  ],
  "gotu-kola": [
    ["P", "Skin repair", "Asiaticoside and madecassoside stimulate collagen production. Gotu kola is used in creams for scars, stretch marks and sensitive skin."],
    ["P", "Circulation in the legs", "Trials found gotu kola extract improved symptoms of poor vein circulation, such as swelling and heaviness in the legs."],
    ["P", "Mental clarity", "Small studies suggest gotu kola may support memory and mood, in line with its use in Ayurveda."]
  ],
  bacopa: [
    ["R", "Memory and learning", "Bacosides support communication between nerve cells. A review of trials found bacopa improved memory recall and attention after about 12 weeks of daily use."],
    ["P", "Calm", "Some studies found reduced anxiety alongside memory improvements."],
    ["T", "Ayurvedic brain tonic", "Used for thousands of years in India to help students learn and remember."]
  ],
  schisandra: [
    ["P", "Stress and endurance", "Schisandra's lignans may help the body adapt to physical and mental stress. Studies found improved endurance and concentration."],
    ["P", "Liver protection", "Schisandrins protect liver cells in laboratory and animal studies, and a derivative is used in Chinese liver medicines."],
    ["T", "Radiant skin", "Traditionally taken to nourish and brighten the complexion."]
  ],
  astragalus: [
    ["P", "Immune support", "Astragalus polysaccharides stimulate immune cells in laboratory studies, supporting its traditional use for building resistance."],
    ["P", "Energy and fatigue", "Studies, mostly from China, found astragalus reduced fatigue, including in people receiving cancer treatment."],
    ["P", "Heart and kidneys", "Research in China has explored astragalus for heart and kidney health, with early promising results."]
  ],
  reishi: [
    ["P", "Immune balance", "Reishi's beta-glucans and triterpenes appear to increase the activity of certain white blood cells in some studies."],
    ["P", "Fatigue and wellbeing", "Small studies found reishi reduced fatigue and improved wellbeing."],
    ["T", "Calm and sleep", "In Chinese medicine, reishi is considered calming for the spirit and is used for restless sleep."]
  ],
  "olive-leaf": [
    ["P", "Healthy blood pressure", "Oleuropein helps relax blood vessels. In one clinical trial, olive leaf extract lowered blood pressure about as well as the medicine captopril in people with mild hypertension."],
    ["P", "Blood sugar", "A small trial found olive leaf extract improved insulin sensitivity in overweight men."],
    ["P", "Fights germs", "Olive leaf extract shows antibacterial and antiviral activity in laboratory studies."]
  ],
  bilberry: [
    ["P", "Eye health", "Bilberry anthocyanins support the retina and may reduce eye fatigue, though the wartime 'night vision' story was likely a myth."],
    ["P", "Circulation", "Bilberry extracts may strengthen tiny blood vessels and ease symptoms of poor vein circulation."],
    ["P", "Antioxidant", "Bilberries are among the richest fruits in anthocyanin antioxidants."]
  ],
  cranberry: [
    ["R", "Preventing urinary infections", "Cranberry's proanthocyanidins stop E. coli bacteria from sticking to the bladder wall. A 2023 Cochrane review found cranberry products reduced repeat urinary tract infections in women, children and people prone to them."],
    ["P", "Heart health", "Cranberry polyphenols may improve cholesterol and blood vessel function."],
    ["P", "Oral health", "The same anti-sticking effect may help prevent plaque bacteria from clinging to teeth."]
  ],
  marjoram: [
    ["T", "Digestion", "Marjoram's aromatic oils relieve gas and stimulate digestion."],
    ["P", "Hormone balance", "A small trial in women with PCOS found marjoram tea improved insulin sensitivity and lowered certain male hormones."],
    ["T", "Calming", "A traditional soothing tea for nervous tension and headaches."]
  ],
  tarragon: [
    ["T", "Appetite and digestion", "Tarragon stimulates digestive juices and has long been used to encourage appetite."],
    ["P", "Blood sugar", "A small study found a tarragon extract improved insulin sensitivity."],
    ["T", "Toothache numbing", "Tarragon contains eugenol, the numbing compound in cloves, and was once chewed for toothache."]
  ],
  "bay-laurel": [
    ["T", "Digestion", "Bay leaves help with the digestion of heavy dishes and are traditionally used for gas and bloating."],
    ["P", "Blood sugar and cholesterol", "A small study found ground bay leaves improved blood sugar and cholesterol in people with type 2 diabetes."],
    ["T", "Fights germs", "Bay leaf oil is antibacterial and antifungal in laboratory studies."]
  ],
  juniper: [
    ["T", "Digestion", "Juniper's bitter, aromatic compounds stimulate digestion, which is why it is paired with rich meats and cabbage."],
    ["T", "Diuretic", "Terpinen-4-ol in juniper increases urine flow; it was traditionally used for water retention (short-term only)."],
    ["P", "Antioxidant", "Juniper berries contain antioxidant flavonoids and essential oils."]
  ],
  chicory: [
    ["P", "Gut health", "Chicory root is one of the richest sources of inulin, which increases beneficial bifidobacteria and may help with constipation."],
    ["P", "Blood sugar", "Inulin slows the absorption of sugar and may help balance blood sugar."],
    ["T", "Coffee alternative", "Roasted chicory gives a coffee-like flavor without caffeine."]
  ],
  lovage: [
    ["T", "Digestion", "Lovage's aromatic oils relieve gas and support digestion."],
    ["T", "Urinary flushing", "Lovage root is approved in Germany for flushing the urinary tract."],
    ["P", "Antioxidant", "Lovage leaves are one of the richest plant sources of quercetin, an antioxidant flavonoid."]
  ],
  caraway: [
    ["R", "Indigestion", "Clinical trials found caraway oil combined with peppermint oil relieved fullness, bloating and pain in functional dyspepsia."],
    ["T", "Gas and colic", "Caraway relaxes the digestive tract and is a traditional remedy for gas and colic."],
    ["P", "Fights germs", "Caraway oil shows antibacterial and antifungal activity in laboratory studies."]
  ],
  mustard: [
    ["T", "Warming plasters", "Mustard plasters increase blood flow to the skin, traditionally used to ease chest congestion and muscle aches."],
    ["P", "Protective compounds", "Mustard seeds contain glucosinolates, which are converted into isothiocyanates — compounds studied for protective effects on cells."],
    ["T", "Digestion", "Mustard stimulates saliva and digestive juices."]
  ],
  saffron: [
    ["R", "Mood support", "Reviews of clinical trials found saffron extract (about 30 mg daily) improved symptoms of mild to moderate depression compared with placebo, and similarly to some antidepressants."],
    ["P", "PMS", "Trials found saffron reduced PMS symptoms such as irritability and mood swings."],
    ["P", "Eye health", "Crocin and safranal may protect the retina; a small trial found improved vision in early macular degeneration."]
  ],
  vanilla: [
    ["T", "Comforting aroma", "Vanilla's scent is widely considered calming, and it's often used in relaxation products."],
    ["P", "Antioxidant", "Vanillin has antioxidant and anti-inflammatory properties in laboratory studies."],
    ["T", "Using less sugar", "Vanilla's aroma makes foods taste sweeter, helping you cut back on added sugar."]
  ],
  feverfew: [
    ["P", "Migraine prevention", "Parthenolide may reduce blood vessel inflammation and the release of serotonin from platelets. A Cochrane review found feverfew may slightly reduce how often migraines occur."],
    ["T", "Fevers", "As its name suggests, feverfew was traditionally used to reduce fevers."],
    ["P", "Anti-inflammatory", "Parthenolide reduces inflammation in laboratory studies."]
  ],
  meadowsweet: [
    ["T", "Acid indigestion", "Meadowsweet's tannins and mucilage soothe the stomach lining, making it a traditional remedy for heartburn."],
    ["T", "Joint pain", "Its natural salicylates — the same family as aspirin — are traditionally used for aches and rheumatic pain."],
    ["P", "Anti-inflammatory", "Laboratory studies confirm anti-inflammatory activity."]
  ],
  chickweed: [
    ["T", "Itchy skin", "Chickweed is cooling and soothing, used in salves for itchy rashes, eczema and insect bites."],
    ["T", "Nutritious green", "Chickweed is rich in vitamin C, minerals and fiber."],
    ["T", "Gentle diuretic", "Traditionally eaten as a spring tonic to support the body's elimination."]
  ],
  violet: [
    ["T", "Dry coughs", "Violet's mucilage soothes the throat; violet syrup is a traditional cough remedy."],
    ["T", "Soothing skin", "Violet leaf salves are used for dry and irritated skin."],
    ["P", "Antioxidant", "Violets contain rutin and other antioxidant flavonoids."]
  ],
  "rose-hips": [
    ["P", "Joint comfort", "Rose hips contain a galactolipid (GOPO) with anti-inflammatory effects. A review of trials found rose hip powder reduced osteoarthritis pain."],
    ["P", "Vitamin C", "Fresh rose hips are one of the richest plant sources of vitamin C, important for immunity and collagen."],
    ["P", "Skin aging", "A trial found rose hip powder improved skin elasticity and moisture."]
  ],
  "black-seed": [
    ["P", "Allergies and asthma", "Thymoquinone reduces inflammation. Trials found black seed oil improved allergic rhinitis symptoms and asthma control."],
    ["P", "Blood sugar and cholesterol", "Reviews of studies found black seed modestly lowered blood sugar and cholesterol."],
    ["P", "Antioxidant", "Thymoquinone is a powerful antioxidant and anti-inflammatory compound."]
  ],
  neem: [
    ["P", "Gum health", "Neem gel reduced plaque and gum inflammation in clinical studies."],
    ["P", "Blemish-prone skin", "Neem is antibacterial and anti-inflammatory, which may help with acne."],
    ["T", "Scalp care", "Neem oil is traditionally used for dandruff and to keep head lice away."]
  ],
  "tongkat-ali": [
    ["R", "Higher total testosterone", "A 2022 systematic review and meta-analysis of randomized trials found tongkat ali extract significantly raised total testosterone. The effect was strongest in men with low testosterone and in older men; men with normal levels saw small or no change."],
    ["P", "More free testosterone", "In men with age-related low testosterone, 200 mg a day of standardized extract for one month raised both total and free testosterone, and many men moved back into the normal range. Lab work suggests it lowers SHBG, the protein that binds testosterone so the body can't use it."],
    ["P", "Lower stress hormones", "In a 4-week trial in moderately stressed adults, 200 mg a day lowered cortisol by about 16% and raised testosterone by about 37%, while improving tension, anger and fatigue scores."],
    ["P", "Libido and sperm health", "Small trials found improved sexual desire, erectile function scores, and sperm count, movement and shape in men with fertility problems."]
  ],
  "shilajit": [
    ["P", "Higher total and free testosterone", "In a 90-day randomized, placebo-controlled trial in healthy men aged 45–55, purified shilajit (250 mg twice a day) significantly raised total testosterone, free testosterone and DHEA compared with placebo."],
    ["P", "Sperm health", "In a small study of men with low sperm counts, purified shilajit for 90 days raised sperm count and motility as well as testosterone."],
    ["P", "Energy and fatigue", "Animal and small human studies suggest shilajit supports mitochondrial energy, reduces fatigue and helps retain muscle strength."],
    ["T", "Ayurvedic rejuvenator", "A classic rasayana in Ayurveda, used for strength, longevity and male vitality for centuries."]
  ],
  "mucuna": [
    ["P", "Higher testosterone in infertile men", "In clinical studies of infertile men, 5 g of seed powder a day for three months raised testosterone and luteinizing hormone (LH) and lowered prolactin."],
    ["P", "Sperm quality", "The same studies found improved sperm count and motility and lower oxidative stress in semen, and some couples went on to conceive."],
    ["P", "Mood and motivation", "Its L-dopa raises dopamine in the brain. Small trials in Parkinson's disease found it worked about as quickly as standard L-dopa medicine — but that use belongs only under a doctor's care."],
    ["T", "Ayurvedic vitality tonic", "Known as kapikacchu, it has a long history as a tonic for male strength and fertility."]
  ],
  "tribulus": [
    ["P", "Libido and erectile function", "Several randomized trials found tribulus extract (around 750–1,500 mg a day) improved sexual desire and erectile function scores in men and women compared with placebo."],
    ["P", "Testosterone — mostly no effect", "A systematic review found tribulus did not raise testosterone in healthy men or athletes in most trials. A few small studies in men with low testosterone or fertility problems saw modest rises, so results are mixed at best."],
    ["T", "Traditional men's tonic", "In Ayurveda (gokshura) and Chinese medicine, tribulus fruit has been used for vitality, urinary health and fertility for centuries."]
  ],
  "maca": [
    ["P", "Libido", "Randomized trials found 1.5–3 g of maca a day improved sexual desire in healthy men after 8–12 weeks, with similar benefits reported in women."],
    ["P", "Testosterone — no change", "In the same trials, maca did not change blood testosterone, estrogen or other reproductive hormones — its effect on desire seems to work independently of hormones."],
    ["P", "Sperm quality", "Small studies found improved semen volume, sperm count and motility after 3–4 months."],
    ["P", "Mood and energy", "Small trials found maca eased anxiety and low mood and improved energy, especially in women after menopause."]
  ],
  "horny-goat-weed": [
    ["P", "Erectile function", "Icariin weakly blocks PDE5, the enzyme targeted by erectile-dysfunction medicines, and raised nitric oxide in lab studies. Human trials are few and small."],
    ["P", "Testosterone (animal studies)", "Icariin raised testosterone and improved sperm in animal studies; this has not yet been shown in men."],
    ["P", "Bone strength", "A two-year trial in women after menopause found Epimedium flavonoids helped prevent bone loss."],
    ["T", "Traditional libido tonic", "Used in Chinese medicine (yin yang huo) for drive, stamina and vitality for centuries."]
  ],
  "cordyceps": [
    ["P", "Stamina and exercise", "In a 12-week trial in older adults, the Cs-4 extract (1 g three times a day) improved aerobic capacity; results in young athletes are mixed."],
    ["P", "Testosterone (animal studies)", "Cordyceps extracts and cordycepin raised testosterone in animal and cell studies by stimulating testosterone-making Leydig cells. Human trials have not confirmed this."],
    ["P", "Immune support", "Its polysaccharides activate immune cells such as natural killer cells in lab and early human studies."],
    ["T", "Traditional vitality tonic", "Used in Tibetan and Chinese medicine for the lungs, kidneys, energy and libido."]
  ]
};
