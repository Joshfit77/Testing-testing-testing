// Herbal stacks: herbs combined for a goal. Amounts are in "parts" by volume of dried herb
// (1 part = 1 tablespoon for a small jar) unless a recipe says otherwise.

const STACK_GROUPS = {
  cleanse: "Cleanse & Digestion",
  calm: "Sleep & Calm",
  immune: "Immunity & Breathing",
  vitality: "Energy & Beauty",
  body: "Heart & Body",
  women: "Women's Wellness",
  men: "Men's Vitality"
};

const STACKS = [
  {
    id: "gentle-cleanse", name: "Gentle Cleanse", group: "cleanse", color: "#a9b84a",
    tagline: "Support the organs that cleanse your body every day — liver, gut and kidneys.",
    intro: "Your liver, kidneys, gut and skin are already cleansing your body around the clock. No herb 'detoxes' you on its own, and extreme cleanses can do more harm than good. What this stack does is support those organs: bitter roots encourage bile flow and digestion, prebiotic fibers feed healthy gut bacteria, and milk thistle helps protect liver cells. Paired with water, fiber and whole foods, it's a gentle seasonal reset.",
    herbs: [
      { id: "dandelion", parts: "2 parts root", role: "Bitter compounds stimulate bile and digestive juices; inulin feeds good gut bacteria." },
      { id: "burdock", parts: "1 part root", role: "Prebiotic fiber and the classic traditional herb for clear skin." },
      { id: "milk-thistle", parts: "1 part crushed seed", role: "Silymarin helps protect liver cells and supports the liver's own antioxidant, glutathione." },
      { id: "ginger", parts: "1 part dried root", role: "Warms digestion and helps the stomach empty, easing heaviness." },
      { id: "peppermint", parts: "1 part leaf", role: "Relaxes the gut, eases bloating and makes the blend taste fresh." }
    ],
    method: [
      "Mix the dandelion root, burdock root, milk thistle seed and ginger. Store peppermint separately.",
      "For one day's tea, add 2 tablespoons of the root mix to 3 cups of cold water in a pot.",
      "Bring to a boil, cover, and simmer gently for 15 minutes.",
      "Turn off the heat, add 1 tablespoon of peppermint, cover and steep for 5 more minutes.",
      "Strain and drink warm, with a squeeze of lemon if you like."
    ],
    dose: "1 cup, 2 times a day, about 20 minutes before meals.",
    duration: "2–3 weeks, then take at least a week off. Ideal in spring.",
    tips: ["Drink plenty of water — at least 8 glasses a day.", "Eat fiber: vegetables, beans, oats, fruit and flaxseed.", "Cut back on alcohol, sugar and highly processed foods.", "Move every day and get to bed on time — the body repairs during sleep.", "Skip extreme fasts, juice-only cleanses and laxative teas."],
    avoid: ["Pregnancy or breastfeeding", "Gallstones or a blocked bile duct", "Allergy to ragweed, daisies or chrysanthemums", "Taking diuretics, lithium, diabetes medicine or blood thinners", "Liver or kidney disease — talk to your doctor first"]
  },
  {
    id: "digestive-comfort", name: "After-Meal Digestive", group: "cleanse", color: "#5cae6a",
    tagline: "A soothing tea to ease bloating, gas and heaviness after meals.",
    intro: "These four herbs relax the muscles of the digestive tract and help trapped gas move along. Peppermint and fennel are carminatives — herbs that relieve gas — while chamomile calms the gut and ginger helps the stomach empty. Together they make a delicious after-dinner tea.",
    herbs: [
      { id: "peppermint", parts: "2 parts", role: "Menthol relaxes intestinal muscles, easing spasms and bloating." },
      { id: "fennel", parts: "1 part crushed seed", role: "Anethole relieves gas and adds natural sweetness." },
      { id: "chamomile", parts: "1 part", role: "Calms the gut and the nerves after a busy meal." },
      { id: "ginger", parts: "½ part dried root", role: "Helps the stomach empty and settles queasiness." }
    ],
    method: ["Lightly crush the fennel seeds just before mixing.", "Use 1–2 teaspoons of the blend per cup of just-boiled water.", "Cover and steep for 8–10 minutes, then strain."],
    dose: "1 cup after meals, up to 3 times a day.",
    duration: "Safe for regular use. See a doctor if digestive problems persist for more than a few weeks.",
    tips: ["Eat slowly and chew well.", "Take a gentle 10-minute walk after meals.", "Notice which foods trigger bloating."],
    avoid: ["Heartburn or acid reflux (peppermint can worsen it — leave it out)", "Allergy to daisies or ragweed (chamomile)", "Hormone-sensitive conditions (fennel)"]
  },
  {
    id: "restful-sleep", name: "Restful Sleep", group: "calm", color: "#8c74c4",
    tagline: "A bedtime blend to quiet the mind and ease you into sleep.",
    intro: "Each herb here acts on the brain's GABA system — the natural 'brake pedal' that calms nerve activity. Chamomile and lemon balm gently relax, passionflower quiets racing thoughts, and a pinch of lavender adds a soothing aroma. A warm cup also becomes a signal to your body that it's time to wind down.",
    herbs: [
      { id: "chamomile", parts: "2 parts", role: "Apigenin gently calms; studies show improved sleep quality." },
      { id: "lemon-balm", parts: "2 parts", role: "Slows the breakdown of calming GABA and lifts the mood." },
      { id: "passionflower", parts: "1 part", role: "Quiets a busy, worried mind; improved sleep quality in a small trial." },
      { id: "lavender", parts: "¼ part", role: "A small amount adds a relaxing aroma (too much tastes soapy)." }
    ],
    method: ["Use 1 heaped tablespoon of the blend per mug of just-boiled water.", "Cover and steep for 10 minutes, then strain.", "Sip slowly 30–60 minutes before bed."],
    dose: "1 cup each evening.",
    duration: "Fine to use nightly. Effects are often stronger after a week or two of regular use.",
    tips: ["Dim the lights and put screens away an hour before bed.", "Keep a regular bedtime and wake-up time.", "Keep your bedroom cool, dark and quiet.", "Avoid caffeine after early afternoon."],
    avoid: ["Pregnancy (passionflower)", "Taking sedatives, sleep medicines or drinking alcohol", "Daisy or ragweed allergy (chamomile)", "Driving or operating machinery after drinking"]
  },
  {
    id: "calm-resilience", name: "Calm & Resilience", group: "calm", color: "#7a5a8c",
    tagline: "A daytime blend for steady calm during stressful seasons.",
    intro: "Holy basil is an adaptogen — an herb thought to help the body handle stress more evenly. Lemon balm lightens tension without making you sleepy, milky oats nourish frazzled nerves, and rose brings comfort to the heart. This is a blend to drink daily for several weeks.",
    herbs: [
      { id: "holy-basil", parts: "2 parts", role: "Adaptogen shown to reduce stress and anxiety scores over 6–8 weeks." },
      { id: "lemon-balm", parts: "1 part", role: "Calms tension and anxiety without drowsiness at normal amounts." },
      { id: "oat-straw", parts: "2 parts", role: "A gentle, nourishing tonic for stressed and exhausted nerves." },
      { id: "rose", parts: "1 part petals", role: "Uplifting and soothing; rose aroma reduced anxiety in studies." }
    ],
    method: ["Use 1 tablespoon of the blend per cup of just-boiled water.", "Cover and steep 10 minutes, then strain.", "Delicious hot or iced with a little honey."],
    dose: "1–2 cups daily, morning or afternoon.",
    duration: "Use for 4–8 weeks, then take a week's break.",
    tips: ["Take short breathing breaks — 3 slow breaths.", "Spend time outdoors every day.", "Write down worries, then one thing you're thankful for."],
    avoid: ["Pregnancy or trying to conceive (holy basil)", "Thyroid medicine (lemon balm)", "Diabetes medicine (holy basil may lower blood sugar)", "Blood thinners"]
  },
  {
    id: "immune-syrup", name: "Winter Immune Syrup", group: "immune", color: "#4a2a4f",
    tagline: "A classic elderberry syrup for cold and flu season.",
    intro: "Elderberries are rich in anthocyanins, and trials found elderberry extract shortened colds and flu when taken early. Ginger and cinnamon add warmth, cloves add antimicrobial eugenol, and rose hips contribute vitamin C. Raw honey soothes the throat and preserves the syrup.",
    herbs: [
      { id: "elderberry", parts: "⅔ cup dried berries", role: "Shown to shorten cold and flu symptoms by 2–4 days when started early." },
      { id: "ginger", parts: "2 tbsp fresh, sliced", role: "Warming and soothing; eases nausea and aches." },
      { id: "cinnamon", parts: "1 stick", role: "Warming spice rich in antioxidants." },
      { id: "rose-hips", parts: "2 tbsp dried", role: "One of nature's richest sources of vitamin C." },
      { id: "clove", parts: "4 whole cloves", role: "Eugenol adds antimicrobial power and warmth." }
    ],
    method: ["Add the elderberries, ginger, cinnamon, rose hips and cloves to 3½ cups of water.", "Bring to a boil, then simmer uncovered for 40–45 minutes, until reduced by about half.", "Mash the berries, then strain through a fine cloth (to catch rose hip hairs).", "Let cool until warm — not hot — then stir in 1 cup of raw honey.", "Pour into a clean glass jar and refrigerate for up to 2 months."],
    dose: "Adults: 1 tablespoon daily during cold season, or 1 tablespoon every 3–4 hours for a few days at the first sign of a cold. Children over 1 year: 1 teaspoon.",
    duration: "Daily through winter, or for 3–5 days when unwell.",
    tips: ["Wash hands often.", "Get enough sleep — it strengthens immunity.", "Stay up to date with vaccines your doctor recommends.", "Rest at home when you are sick."],
    avoid: ["Never give honey to babies under 1 year", "Always cook elderberries well — raw berries can cause vomiting", "Autoimmune conditions or immune-suppressing medicine", "Diabetes (the syrup contains sugar from honey)"]
  },
  {
    id: "throat-cough", name: "Soothing Throat & Cough", group: "immune", color: "#b5b48a",
    tagline: "Coat, calm and loosen — for scratchy throats and chesty coughs.",
    intro: "This blend combines two kinds of help. Marshmallow root and licorice are demulcents: their silky mucilage coats and soothes irritated throats. Thyme and mullein are expectorants that help loosen mucus so coughs become more productive.",
    herbs: [
      { id: "thyme", parts: "2 parts", role: "Thymol relaxes airways and helps clear mucus; approved in Germany for bronchitis." },
      { id: "marshmallow-root", parts: "2 parts", role: "Mucilage coats and soothes a raw, dry throat." },
      { id: "licorice", parts: "½ part", role: "Soothes the throat and naturally sweetens the tea." },
      { id: "mullein", parts: "1 part leaf", role: "A traditional lung herb that soothes and loosens coughs." }
    ],
    method: ["Simmer the marshmallow root and licorice in 2 cups of water on low heat for 10 minutes.", "Turn off the heat, add the thyme and mullein, cover and steep for 10 minutes.", "Strain through a coffee filter or fine cloth to catch mullein's tiny hairs.", "Stir in a spoonful of honey."],
    dose: "1 cup, up to 3 times a day.",
    duration: "Up to 1 week (licorice should be used short-term).",
    tips: ["Gargle with warm salt water.", "Breathe steam from a hot shower.", "Rest your voice and stay hydrated."],
    avoid: ["High blood pressure, heart or kidney disease, or pregnancy (licorice)", "Take other medicines 1–2 hours apart (marshmallow slows absorption)", "Children under 1 (honey)", "See a doctor for a cough lasting over 3 weeks, high fever, chest pain or trouble breathing"]
  },
  {
    id: "clear-breathing", name: "Clear Breathing Steam", group: "immune", color: "#6d9fa0",
    tagline: "An herbal steam to open a stuffy nose and soothe the sinuses.",
    intro: "Warm, moist air loosens mucus, and the aromatic oils in these herbs add a feeling of clear, easy breathing. Eucalyptol from eucalyptus thins mucus, thyme fights germs, and menthol from peppermint triggers the nose's cool receptors.",
    herbs: [
      { id: "eucalyptus", parts: "1 tbsp leaf (or 2 drops oil)", role: "Eucalyptol helps thin mucus and ease congestion." },
      { id: "thyme", parts: "1 tbsp", role: "Antimicrobial thymol and a warm, herbal scent." },
      { id: "peppermint", parts: "1 tbsp", role: "Menthol creates a feeling of clear airflow." }
    ],
    method: ["Place the herbs in a large heat-proof bowl.", "Pour over 4 cups of just-boiled water and let it cool for 1–2 minutes.", "Sit with your face about 12 inches (30 cm) above the bowl, drape a towel over your head, close your eyes and breathe gently.", "Steam for 5–10 minutes, taking breaks as needed."],
    dose: "1–3 times a day while congested.",
    duration: "During colds and sinus congestion.",
    tips: ["Keep tissues nearby.", "Follow with a warm drink.", "A eucalyptus bundle hung in the shower gives a gentler steam."],
    avoid: ["Never for babies or young children — burns and strong vapors are dangerous", "Asthma (strong vapors can trigger symptoms)", "Never swallow eucalyptus oil", "Keep eucalyptus oil away from cats and dogs"]
  },
  {
    id: "morning-focus", name: "Morning Focus", group: "vitality", color: "#6b9b3a",
    tagline: "Clear, steady energy without the coffee jitters.",
    intro: "Green tea brings caffeine balanced by L-theanine for calm alertness. Holy basil helps buffer stress, peppermint brightens the senses, and rosemary — the herb of remembrance — adds an aroma linked to alertness in small studies.",
    herbs: [
      { id: "green-tea", parts: "2 parts", role: "Caffeine plus L-theanine for focused, calm energy." },
      { id: "holy-basil", parts: "1 part", role: "Adaptogen that helps steady the stress response." },
      { id: "peppermint", parts: "1 part", role: "Refreshing aroma that lifts energy." },
      { id: "rosemary", parts: "½ part", role: "Its aroma has been linked with better memory and alertness." }
    ],
    method: ["Use 1–2 teaspoons per cup.", "Use water just off the boil (about 175°F / 80°C) so the green tea doesn't turn bitter.", "Steep 3 minutes and strain."],
    dose: "1–2 cups in the morning or early afternoon.",
    duration: "Daily use is fine for most people.",
    tips: ["Drink a glass of water first thing.", "Get morning daylight.", "Take a 5-minute movement break every hour."],
    avoid: ["Caffeine sensitivity, anxiety or insomnia", "Pregnancy (limit caffeine; avoid holy basil)", "Low iron (drink between meals)", "Late afternoon or evening use"]
  },
  {
    id: "glowing-skin", name: "Glowing Skin", group: "vitality", color: "#d9667a",
    tagline: "Beauty from within — a mineral-rich, antioxidant tea for the skin.",
    intro: "Healthy skin starts with nourishment. Nettle supplies minerals, rooibos and rose provide antioxidants that help protect skin cells, and calendula is the classic skin-soothing flower. Pair this tea with water, sleep and sunscreen for best results.",
    herbs: [
      { id: "nettle", parts: "2 parts", role: "Rich in minerals; traditionally used for skin and hair." },
      { id: "rooibos", parts: "2 parts", role: "Unique antioxidants such as aspalathin protect cells." },
      { id: "rose", parts: "1 part petals", role: "Anti-inflammatory and calming for skin and spirit." },
      { id: "calendula", parts: "1 part petals", role: "The traditional herb for calm, healthy skin." }
    ],
    method: ["Use 1 tablespoon per cup of boiling water.", "Cover and steep 10 minutes.", "Strain and enjoy warm or iced."],
    dose: "1–2 cups daily.",
    duration: "Ongoing; skin changes are best judged after 4–6 weeks.",
    tips: ["Wear sunscreen daily.", "Drink water and eat colorful fruits and vegetables.", "Mist your face with rosewater after cleansing.", "Sleep 7–9 hours."],
    avoid: ["Daisy family allergy (calendula)", "Pregnancy (calendula by mouth)", "Diuretic or blood pressure medicine (nettle)"]
  },
  {
    id: "heart-harmony", name: "Heart Harmony", group: "body", color: "#b81f4a",
    tagline: "A ruby-red tea to support healthy blood pressure and circulation.",
    intro: "Hibiscus tea lowered blood pressure in several clinical trials, hawthorn is the classic heart tonic of European herbalism, and cinnamon adds warmth and antioxidants. Enjoy it as part of a heart-healthy lifestyle — not instead of your medicine.",
    herbs: [
      { id: "hibiscus", parts: "2 parts", role: "Shown to lower systolic blood pressure by about 7 mmHg in mild hypertension." },
      { id: "hawthorn", parts: "2 parts berries", role: "Flavonoids support heart muscle and relax blood vessels." },
      { id: "cinnamon", parts: "1 part chips", role: "Warming antioxidant spice that may support healthy blood sugar." }
    ],
    method: ["Simmer the hawthorn berries and cinnamon in 2 cups of water for 10 minutes.", "Turn off the heat, add the hibiscus and steep 5–10 minutes.", "Strain; sweeten lightly with honey if desired. Delicious iced."],
    dose: "2 cups daily.",
    duration: "Ongoing, with your doctor's knowledge.",
    tips: ["Walk 30 minutes most days.", "Cook with garlic and olive oil.", "Eat less salt and more vegetables.", "Check your blood pressure regularly."],
    avoid: ["Talk to your doctor first if you have a heart condition or take blood pressure or heart medicine", "Pregnancy", "Low blood pressure"]
  },
  {
    id: "golden-joint", name: "Golden Joint Comfort", group: "body", color: "#e0a019",
    tagline: "A warming golden milk for stiff joints and tired muscles.",
    intro: "Turmeric's curcumin and ginger's gingerols both calm inflammatory pathways in the body, and studies suggest they may ease joint pain. Black pepper boosts curcumin absorption dramatically, and a little fat in the milk helps too.",
    herbs: [
      { id: "turmeric", parts: "1 tsp ground", role: "Curcumin turns down inflammatory signals; studied for knee arthritis." },
      { id: "ginger", parts: "½ tsp ground", role: "Eases joint pain and muscle soreness." },
      { id: "cinnamon", parts: "½ tsp ground", role: "Warmth, sweetness and antioxidants." },
      { id: "black-pepper", parts: "A pinch", role: "Piperine increases curcumin absorption." }
    ],
    method: ["Warm 1 cup of milk (dairy, oat, almond or coconut) in a small pot.", "Whisk in the turmeric, ginger, cinnamon and black pepper.", "Simmer gently for 5 minutes — don't boil.", "Sweeten with a teaspoon of honey and add a few drops of vanilla if you like."],
    dose: "1 cup daily, often in the evening.",
    duration: "Ongoing. Joint benefits in studies appeared after 4–8 weeks.",
    tips: ["Keep moving — gentle walking, swimming and stretching help joints.", "Maintain a healthy weight.", "Eat oily fish, nuts and olive oil."],
    avoid: ["Gallbladder problems or gallstones", "Taking blood thinners or diabetes medicine", "Before surgery", "Acid reflux (turmeric and pepper can aggravate it)"]
  },
  {
    id: "cycle-comfort", name: "Moon Cycle Comfort", group: "women", color: "#9d3a50",
    tagline: "A warming blend for crampy, uncomfortable days of the month.",
    intro: "Raspberry leaf is the traditional women's tonic. Ginger and fennel have both eased menstrual pain about as well as common pain relievers in small trials, and chamomile relaxes muscle tension and lifts the mood.",
    herbs: [
      { id: "raspberry-leaf", parts: "2 parts", role: "Traditional tonic for the uterus and cramps." },
      { id: "ginger", parts: "1 part dried root", role: "Eased period pain in small trials, similar to ibuprofen." },
      { id: "fennel", parts: "1 part crushed seed", role: "Relaxes muscles; eased cramps in small trials." },
      { id: "chamomile", parts: "1 part", role: "Relaxes cramping muscles and calms the mood." }
    ],
    method: ["Use 1 tablespoon per cup of just-boiled water.", "Cover and steep 10–15 minutes, then strain.", "Pair with a warm hot water bottle on your tummy."],
    dose: "1 cup, 2–3 times a day.",
    duration: "Start 2–3 days before your period and continue for the first few days.",
    tips: ["Gentle movement and stretching can ease cramps.", "Use warmth on your lower abdomen.", "Rest well and eat iron-rich foods.", "See a doctor for very heavy or severe pain."],
    avoid: ["Pregnancy (unless advised by your midwife)", "Hormone-sensitive conditions (fennel)", "Daisy allergy (chamomile)", "Blood thinners (ginger in larger amounts)"]
  },
  {
    id: "testosterone-support", name: "Men's Testosterone Support", group: "men", color: "#8a5a2e",
    tagline: "A research-based stack to support healthy testosterone, strength, drive and stamina in men.",
    intro: "Testosterone naturally declines with age, stress, poor sleep and extra body fat. This stack combines the herbs with the best human evidence for supporting healthy testosterone. In clinical trials, ashwagandha raised testosterone by roughly 15–20% in men while lowering the stress hormone cortisol, which competes with testosterone production. Fenugreek extract improved libido, strength and, in some trials, testosterone levels. Nettle root binds sex-hormone-binding globulin (SHBG), which may leave more 'free' testosterone available to the body, and Korean ginseng supports energy and improved erectile function in several trials. Ginger adds antioxidant support for male reproductive health. Herbs support healthy levels; they are not a replacement for medical testosterone treatment, and the biggest gains come from sleep, strength training and a healthy weight.",
    herbs: [
      { id: "ashwagandha", parts: "300 mg extract, twice a day", role: "Raised testosterone about 15–20% and lowered cortisol in clinical trials; also improved strength and sperm quality." },
      { id: "fenugreek", parts: "500–600 mg seed extract, once a day", role: "Improved libido and strength, and raised testosterone in some trials, likely through its saponins." },
      { id: "nettle", parts: "300 mg root extract, once a day", role: "Root lignans bind SHBG, which may free up more active testosterone; also supports prostate health." },
      { id: "ginseng", parts: "200 mg Korean red ginseng extract, once a day", role: "Supports energy, stamina and erectile function; reduces fatigue." },
      { id: "ginger", parts: "500 mg powdered root, once a day", role: "Antioxidant that may protect testosterone-producing cells; one small study in infertile men found higher testosterone and better sperm health." }
    ],
    method: [
      "Morning, with breakfast: ashwagandha 300 mg, fenugreek 500–600 mg, Korean ginseng 200 mg and ginger 500 mg.",
      "Evening, with dinner: ashwagandha 300 mg and nettle root 300 mg.",
      "Take capsules with a full glass of water and food to avoid stomach upset.",
      "Start with ashwagandha alone for one week, then add the others one at a time so you can spot any side effects.",
      "Ask your doctor for a blood test before you start and after 8–12 weeks to see how your levels respond."
    ],
    dose: "Per person, adult men 18 and over (100 lb and up): the amounts above, split between morning and evening.",
    duration: "8–12 weeks, then take a 2–4 week break. Ginseng should be paused after 3 months.",
    tips: ["Sleep 7–9 hours — testosterone is made mostly during deep sleep.", "Lift weights or do resistance training 3 times a week.", "Reach and keep a healthy weight; belly fat converts testosterone to estrogen.", "Get enough zinc (meat, shellfish, pumpkin seeds) and vitamin D (sunlight, eggs, fish).", "Limit alcohol and manage stress, which raises cortisol."],
    avoid: ["Women, teenagers and anyone under 18", "Prostate or breast cancer, or other hormone-sensitive conditions", "Already on testosterone therapy or other hormone medicines — talk to your doctor", "Thyroid conditions or thyroid medicine (ashwagandha)", "Diabetes medicine (fenugreek and ginseng lower blood sugar)", "Blood thinners or upcoming surgery (ginger, ginseng, fenugreek)", "High blood pressure, insomnia or anxiety (ginseng can be stimulating)", "Liver disease (rare liver problems reported with ashwagandha)", "See a doctor for symptoms of low testosterone such as constant fatigue, low drive or erectile problems — they can have other causes"]
  },
  {
    id: "hair-nails", name: "Hair & Nail Nourish", group: "vitality", color: "#5d8c55",
    tagline: "A mineral-rich infusion for stronger hair and nails.",
    intro: "Hair and nails are built from protein, minerals and collagen. Nettle and oat straw are mineral-rich nourishing herbs, horsetail is one of the richest plant sources of silica, and a rosemary rinse supports a healthy scalp from the outside.",
    herbs: [
      { id: "nettle", parts: "2 parts", role: "Rich in iron, calcium and other minerals." },
      { id: "oat-straw", parts: "2 parts", role: "Gentle, mineral-rich and nourishing." },
      { id: "horsetail", parts: "½ part (thiaminase-free)", role: "One of the richest plant sources of silica, used for collagen." },
      { id: "rosemary", parts: "For a rinse", role: "Used on the scalp to support hair growth." }
    ],
    method: ["Steep 4 tablespoons of nettle, oat straw and horsetail in a quart jar of boiling water for 4 hours or overnight.", "Strain and drink through the day.", "For a hair rinse, steep 2 tablespoons of rosemary in 2 cups of hot water, cool, and pour through clean hair as a final rinse."],
    dose: "1–2 cups of the infusion daily; rosemary rinse 2–3 times a week.",
    duration: "Up to 6 weeks for horsetail, then take a break.",
    tips: ["Eat enough protein, iron and zinc.", "Be gentle with heat styling.", "Massage your scalp a few minutes a day."],
    avoid: ["Kidney or heart conditions", "Taking lithium or diuretics", "Pregnancy (horsetail)", "Celiac disease — choose certified gluten-free oat straw"]
  }
];
