// Simple home and food-based natural remedies.
//
// Each remedy page shows: what it may help with · ingredients · exact preparation · suggested amount ·
// how often · evidence level (R / P / T, as elsewhere) · safety warnings · when to seek medical care instead.
// items: herb ids, "fruit:<id>" or "food:<id>" — linked on the page and checked against the safety checker.
// Language is conservative on purpose: remedies "may help" — they do not cure or replace medical care.

const REMEDY_CATS = {
  digestion: { label: "Digestion", icon: "cup", guide: "digestion", text: "Gentle teas and seeds for bloating, gas and an unsettled stomach." },
  sleep: { label: "Sleep", icon: "moon", guide: "sleep", text: "Calming bedtime drinks and routines." },
  stress: { label: "Stress", icon: "leaf", guide: "stress", text: "Simple ways to settle body and mind." },
  headaches: { label: "Headaches", icon: "sparkle", guide: null, text: "Soothing, drug-free comfort for everyday tension headaches." },
  "sore-throat": { label: "Sore throat", icon: "cup", guide: "cold-flu", text: "Gargles and warm drinks that coat and calm." },
  colds: { label: "Colds", icon: "shield", guide: "cold-flu", text: "Comfort for stuffiness, coughs and feeling run-down." },
  energy: { label: "Energy", icon: "sun", guide: "energy", text: "Food and daily habits for steadier energy." },
  menstrual: { label: "Menstrual comfort", icon: "flower", guide: "womens-cycle", text: "Warmth and ginger for period cramps." },
  skin: { label: "Skin", icon: "drop", guide: "skin", text: "Soothing remedies for itchy, irritated or sun-touched skin." },
  hydration: { label: "Hydration", icon: "drop", guide: null, text: "Drinks that help you replace fluids." }
};

const REMEDY_SOURCES = {
  nccihGinger: ["NIH NCCIH — Ginger", "https://www.nccih.nih.gov/health/ginger"],
  nccihPeppermint: ["NIH NCCIH — Peppermint oil", "https://www.nccih.nih.gov/health/peppermint-oil"],
  nccihChamomile: ["NIH NCCIH — Chamomile", "https://www.nccih.nih.gov/health/chamomile"],
  nccihLavender: ["NIH NCCIH — Lavender", "https://www.nccih.nih.gov/health/lavender"],
  nccihAloe: ["NIH NCCIH — Aloe vera", "https://www.nccih.nih.gov/health/aloe-vera"],
  netiPot: ["FDA — Rinsing your sinuses with neti pots", "https://www.fda.gov/consumers/consumer-updates/rinsing-your-sinuses-neti-pots-safe"],
  botulism: ["CDC — Botulism (why babies can't have honey)", "https://www.cdc.gov/botulism/"],
  ors: ["WHO — Diarrhoeal disease fact sheet (oral rehydration)", "https://www.who.int/news-room/fact-sheets/detail/diarrhoeal-disease"],
  lifeline: ["988 Suicide & Crisis Lifeline", "https://988lifeline.org/"]
};

const REMEDIES = [
  // ---------- Digestion ----------
  {
    id: "peppermint-tea-bloating", name: "Peppermint Tea for Bloating", cat: "digestion", time: "10 minutes", items: ["peppermint"], recipe: null,
    helps: ["Gas and bloating after meals", "A heavy, too-full feeling", "Mild stomach cramping"],
    intro: "Peppermint relaxes the smooth muscle of the gut, which may help trapped gas move along. A warm cup after a big meal is one of the oldest home remedies for bloating.",
    ingredients: [["1 tsp (about 1.5 g)", "dried peppermint leaves, or 1 peppermint tea bag"], ["1 cup (240 ml)", "just-boiled water"]],
    steps: ["Put the peppermint in a mug or teapot.", "Pour the just-boiled water over it and cover the mug (this keeps the oils in).", "Steep for 5–10 minutes.", "Strain, let it cool enough to sip, and drink slowly after your meal."],
    amount: "1 cup (240 ml).", often: "Up to 3 cups a day, after meals.",
    evidence: ["P", "Enteric-coated peppermint oil capsules are well studied for IBS symptoms like bloating and pain. Peppermint tea has less direct research but is a long-standing traditional remedy."],
    safety: ["Peppermint relaxes the valve at the top of the stomach and can make heartburn or acid reflux worse.", "Don't give peppermint tea or oil to babies and very young children.", "If you're pregnant or breastfeeding, ask your provider about regular use — large amounts may reduce milk supply."],
    seekCare: ["Severe or worsening belly pain, or pain with fever", "Vomiting blood or having black, tarry stools", "Bloating that lasts more than a few weeks, or comes with unexplained weight loss", "Trouble swallowing"],
    sources: ["nccihPeppermint"]
  },
  {
    id: "ginger-tea-nausea", name: "Fresh Ginger Tea for Nausea", cat: "digestion", time: "15 minutes", items: ["ginger", "food:honey", "fruit:lemon"], recipe: "ginger-lemon-honey",
    helps: ["Mild nausea and queasiness", "Motion sickness", "An unsettled stomach"],
    intro: "Ginger is one of the best-studied natural options for nausea. Its gingerols act on the stomach and on nausea signals in the body.",
    ingredients: [["1-inch (2.5 cm) piece", "fresh ginger, thinly sliced (about 5–10 g)"], ["1½ cups (360 ml)", "water"], ["1 tsp (optional)", "honey"], ["1 squeeze (optional)", "lemon juice"]],
    steps: ["Add the sliced ginger and water to a small pot.", "Bring to a boil, then lower the heat and simmer for 10 minutes.", "Strain into a mug.", "Stir in honey and lemon if you like, and sip slowly."],
    amount: "1 cup at a time. Keep total ginger to about 4 g of dried ginger (or roughly 1 oz / 30 g fresh) a day or less; in pregnancy, about 1 g dried a day is the amount usually studied.", often: "Up to 3 cups a day.",
    evidence: ["R", "Many clinical trials have studied ginger for nausea, including pregnancy nausea and motion sickness, with modest benefits for many people."],
    safety: ["Larger amounts may increase bleeding risk with blood thinners.", "Ask your doctor first if you have gallstones.", "In pregnancy, ginger is commonly used for morning sickness in modest amounts — check with your provider first.", "Never give honey to babies under 1 year."],
    seekCare: ["You can't keep fluids down for more than 24 hours (12 hours for a child)", "Signs of dehydration: very little or dark urine, dizziness, dry mouth", "Vomit that is bloody or looks like coffee grounds", "Severe belly pain, a stiff neck, or vomiting after a head injury", "Severe vomiting in pregnancy"],
    sources: ["nccihGinger", "botulism"]
  },
  {
    id: "fennel-seeds-after-meals", name: "Fennel Seeds After Meals", cat: "digestion", time: "2 minutes", items: ["fennel"], recipe: "digestive-fennel-tea",
    helps: ["Gas after meals", "Bloating", "Freshening the breath"],
    intro: "In India, a small spoonful of fennel seeds after a meal is a centuries-old habit. The seeds' oils may help relax the gut and ease gas.",
    ingredients: [["½ tsp", "fennel seeds (plain or lightly toasted)"]],
    steps: ["After your meal, put about half a teaspoon of fennel seeds in your mouth.", "Chew slowly for a minute or two to release the sweet, licorice-like oils.", "Or, crush 1 tsp of seeds and steep in 1 cup of just-boiled water for 10 minutes as a tea."],
    amount: "½ tsp to chew, or 1 cup of tea made with 1 tsp crushed seeds.", often: "After meals, up to 3 times a day.",
    evidence: ["T", "Fennel is a traditional digestive aid in many cultures. A few small studies suggest benefits for gas and infant colic, but research in adults is limited."],
    safety: ["Avoid if you're allergic to celery, carrot or mugwort (related plants).", "Avoid large amounts and fennel oil during pregnancy.", "Don't give fennel oil or concentrated fennel tea to babies without your pediatrician's guidance."],
    seekCare: ["Ongoing belly pain or a big change in bowel habits", "Blood in the stool", "Bloating with unexplained weight loss"],
    sources: []
  },
  // ---------- Sleep ----------
  {
    id: "chamomile-bedtime-tea", name: "Chamomile Bedtime Tea", cat: "sleep", time: "10 minutes", items: ["chamomile", "food:honey"], recipe: "sleepy-time-tea",
    helps: ["Winding down before bed", "Mild trouble falling asleep", "A restless, busy mind at night"],
    intro: "A warm cup of chamomile is a gentle signal to your body that the day is done. Chamomile's apigenin acts mildly on the brain's calming GABA receptors.",
    ingredients: [["1–2 tsp (2–3 g)", "dried chamomile flowers, or 1–2 tea bags"], ["1 cup (240 ml)", "just-boiled water"], ["1 tsp (optional)", "honey"]],
    steps: ["Put the chamomile in a mug or infuser.", "Pour the just-boiled water over it and cover.", "Steep for 5–10 minutes (longer makes it stronger).", "Strain, add honey if you like, and sip 30–60 minutes before bed."],
    amount: "1 cup.", often: "Once nightly. It's fine to drink every night.",
    evidence: ["P", "Small clinical trials found chamomile improved sleep quality in older adults and eased mild anxiety. Results for insomnia are mixed."],
    safety: ["Avoid if you're allergic to ragweed, daisies or marigolds.", "May add to drowsiness from sleep medicines, sedatives or alcohol.", "Large amounts may affect warfarin — tell your doctor if you drink it daily.", "If pregnant, ask your provider about regular use."],
    seekCare: ["Trouble sleeping most nights for more than a month", "Loud snoring, gasping or stopping breathing at night (possible sleep apnea)", "Sleep problems with low mood, anxiety or thoughts of self-harm — call or text 988 in the U.S."],
    sources: ["nccihChamomile", "lifeline"]
  },
  {
    id: "tart-cherry-juice", name: "Tart Cherry Juice Before Bed", cat: "sleep", time: "2 minutes", items: ["fruit:tart-cherry"], recipe: "tart-cherry-sleep-mocktail",
    helps: ["Getting a little more sleep", "Muscle soreness after exercise"],
    intro: "Tart (Montmorency) cherries naturally contain small amounts of melatonin, the body's sleep hormone, plus compounds that help the body use tryptophan.",
    ingredients: [["1 cup (240 ml)", "unsweetened tart cherry juice — or 2 tbsp (30 ml) tart cherry concentrate mixed into 1 cup of water"]],
    steps: ["Pour the juice (or stir the concentrate into water).", "Drink one glass in the morning and one about 1–2 hours before bed, as in the studies.", "Brush your teeth afterwards — it's acidic and sweet."],
    amount: "1 cup (240 ml) of juice.", often: "Twice a day (morning and 1–2 hours before bed) for 1–2 weeks, as studied.",
    evidence: ["P", "Small studies found tart cherry juice modestly increased total sleep time in adults with insomnia and older adults."],
    safety: ["Juice is high in natural sugar and calories — count it if you manage blood sugar or weight.", "Can loosen stools in some people.", "Choose unsweetened juice."],
    seekCare: ["Insomnia lasting more than a month", "Daytime sleepiness that affects driving or work", "Loud snoring or gasping during sleep"],
    sources: []
  },
  // ---------- Stress ----------
  {
    id: "lemon-balm-tea", name: "Lemon Balm Calming Tea", cat: "stress", time: "10 minutes", items: ["lemon-balm"], recipe: null,
    helps: ["Feeling tense or on edge", "Mild, everyday stress", "Restlessness in the evening"],
    intro: "Lemon balm is a gentle, lemon-scented mint used since the Middle Ages to \"gladden the heart.\" It may support calm by acting on GABA, the brain's calming messenger.",
    ingredients: [["1–2 tsp (1.5–4.5 g)", "dried lemon balm leaves"], ["1 cup (240 ml)", "just-boiled water"]],
    steps: ["Place the leaves in a mug or infuser.", "Pour the just-boiled water over them and cover.", "Steep for 5–10 minutes.", "Strain and sip slowly, taking a few deep breaths as you do."],
    amount: "1 cup.", often: "Up to 3 cups a day.",
    evidence: ["P", "Small clinical trials, mostly of lemon balm extracts, found improvements in calmness and mild anxiety."],
    safety: ["May add to the effect of sleep medicines and sedatives.", "May affect thyroid medicine — ask your doctor if you have a thyroid condition.", "Ask your provider before regular use if pregnant or breastfeeding."],
    seekCare: ["Anxiety or low mood most days for two weeks or more", "Panic attacks, or stress that keeps you from daily life", "Thoughts of harming yourself — call or text 988 (U.S.) or your local emergency number right away"],
    sources: ["lifeline"]
  },
  {
    id: "box-breathing", name: "Box Breathing (4-4-4-4)", cat: "stress", time: "2–5 minutes", items: [], recipe: null,
    helps: ["Calming a racing heart or mind", "Stress before a hard conversation or test", "Winding down before sleep"],
    intro: "Slow, even breathing is a free, always-available remedy. Long, steady breaths may activate the body's \"rest and digest\" nervous system.",
    ingredients: [["2–5 minutes", "in a quiet spot (sitting or lying down)"]],
    steps: ["Sit comfortably with your feet on the floor, or lie down. Relax your shoulders.", "Breathe in slowly through your nose for a count of 4.", "Hold your breath gently for a count of 4.", "Breathe out slowly through your mouth for a count of 4.", "Hold for a count of 4, then repeat. Do 4–6 rounds, or continue for up to 5 minutes."],
    amount: "4–6 rounds (about 2–5 minutes).", often: "As often as needed, several times a day.",
    evidence: ["P", "Slow, paced breathing has been studied for lowering stress, heart rate and blood pressure. The studies are promising but mostly small."],
    safety: ["If you feel dizzy or lightheaded, stop and breathe normally.", "Skip the breath holds if you're pregnant or have a heart or lung condition — just breathe slowly in and out."],
    seekCare: ["Chest pain, trouble breathing or fainting — call 911", "Frequent panic attacks", "Thoughts of harming yourself — call or text 988 (U.S.)"],
    sources: ["lifeline"]
  },
  {
    id: "lavender-aromatherapy", name: "Lavender Aromatherapy", cat: "stress", time: "2 minutes", items: ["lavender"], recipe: null,
    helps: ["Unwinding in the evening", "Feeling stressed or tense", "Creating a calming bedtime routine"],
    intro: "Breathing in lavender's scent is one of the most popular aromatherapy remedies. Its linalool has been studied for calming effects.",
    ingredients: [["2–3 drops", "pure lavender essential oil"], ["A diffuser with water, or a tissue or cotton ball", ""]],
    steps: ["Add 2–3 drops of lavender oil to a diffuser filled with water, following its instructions.", "Or put 1–2 drops on a tissue and breathe in gently for a few minutes.", "Run a diffuser for 30–60 minutes at a time, in a ventilated room."],
    amount: "2–3 drops.", often: "Once or twice a day, such as in the evening.",
    evidence: ["P", "Small studies of lavender aromatherapy found modest improvements in anxiety and sleep quality. Lavender oil capsules have more research, but should only be used as directed on the product."],
    safety: ["Never swallow essential oils, and keep them away from children.", "Don't put undiluted oil on skin — dilute in a carrier oil and patch-test first.", "Diffused oils can be harmful to cats and other pets — keep pets out of the room.", "Can irritate asthma in some people."],
    seekCare: ["Stress or anxiety that affects daily life for two weeks or more", "Thoughts of harming yourself — call or text 988 (U.S.)"],
    sources: ["nccihLavender", "lifeline"]
  },
  // ---------- Headaches ----------
  {
    id: "peppermint-oil-temples", name: "Peppermint Oil Temple Rub", cat: "headaches", time: "5 minutes", items: ["peppermint"], recipe: null,
    helps: ["Tension headaches", "A tight, pressing feeling across the forehead"],
    intro: "Peppermint oil creates a cooling feeling on the skin that may dull pain signals. Diluted peppermint oil has been studied for tension headaches.",
    ingredients: [["2 drops", "peppermint essential oil"], ["1 tsp (5 ml)", "carrier oil, such as olive, almond or jojoba oil"]],
    steps: ["Mix the peppermint oil into the carrier oil in a small dish.", "Dab a little on your fingertips and gently massage it into your temples and forehead, and the back of your neck.", "Keep it well away from your eyes, and wash your hands afterwards.", "Rest in a quiet room. You can reapply after 15 and 30 minutes."],
    amount: "A fingertip of the diluted oil.", often: "Up to 3 applications per headache.",
    evidence: ["P", "Small trials found a 10% peppermint oil solution on the temples eased tension headaches about as well as a standard dose of acetaminophen."],
    safety: ["Never use peppermint oil on or near the face of babies or young children — it can affect their breathing.", "Keep away from the eyes; if it gets in, rinse with plain water or milk.", "Patch-test on your arm first — it can irritate sensitive skin.", "Never swallow essential oils."],
    seekCare: ["A sudden, severe \"worst headache of my life\" — call 911", "Headache with fever and a stiff neck, confusion, weakness, numbness, trouble speaking or vision loss", "A headache after a head injury", "New headaches after age 50, or headaches that keep getting worse", "In pregnancy: a headache with vision changes or swelling of the face or hands"],
    sources: ["nccihPeppermint"]
  },
  {
    id: "cool-compress-water", name: "Cool Compress & a Big Glass of Water", cat: "headaches", time: "15–20 minutes", items: [], recipe: null,
    helps: ["Headaches from dehydration, heat or a long day", "Throbbing headaches"],
    intro: "Not drinking enough is a common headache trigger, and cold therapy may calm throbbing pain. This simple combination is a good first step.",
    ingredients: [["2 cups (480 ml)", "water"], ["1", "clean washcloth soaked in cool water, or an ice pack wrapped in a thin towel"]],
    steps: ["Drink 2 cups of water slowly over 10–15 minutes.", "Lie down in a dark, quiet room.", "Place the cool cloth or wrapped ice pack on your forehead, temples or the back of your neck.", "Rest for 15–20 minutes, then remove the compress."],
    amount: "2 cups of water and one 15–20 minute compress.", often: "Up to every 1–2 hours, with breaks for your skin.",
    evidence: ["P", "Small studies found that drinking more water eased headaches in some people prone to them, and cold therapy may reduce migraine pain."],
    safety: ["Always wrap ice in a cloth and limit it to 20 minutes to protect your skin.", "If you have heart or kidney disease and limit fluids, follow your doctor's fluid advice."],
    seekCare: ["A sudden, severe headache — call 911", "Headache with fever, stiff neck, confusion, weakness or vision changes", "Headaches that wake you from sleep or are getting more frequent"],
    sources: []
  },
  // ---------- Sore throat ----------
  {
    id: "salt-water-gargle", name: "Warm Salt Water Gargle", cat: "sore-throat", time: "5 minutes", items: [], recipe: null,
    helps: ["Scratchy or sore throat", "Throat irritation from a cold or postnasal drip"],
    intro: "Gargling warm salt water is one of the simplest, most widely recommended sore-throat remedies. Salt draws fluid from swollen tissue and may help loosen mucus.",
    ingredients: [["½ tsp (about 3 g)", "table salt"], ["1 cup (240 ml)", "warm water (comfortably warm, not hot)"]],
    steps: ["Stir the salt into the warm water until dissolved.", "Take a sip, tilt your head back and gargle for about 30 seconds.", "Spit it out — don't swallow.", "Repeat until the cup is finished."],
    amount: "1 cup, gargled in sips.", often: "Every 3–4 hours as needed.",
    evidence: ["P", "Widely recommended by doctors for comfort. A Japanese study found regular gargling was linked with fewer upper respiratory infections."],
    safety: ["Don't swallow the salt water.", "Not for young children who can't gargle safely (usually under about 6).", "If you're on a strict low-sodium diet, ask your doctor."],
    seekCare: ["Trouble breathing or swallowing, or drooling — seek care right away", "Fever over 101°F (38.3°C), or white patches on the tonsils with fever (possible strep)", "A sore throat lasting more than a week", "A rash, or a very swollen neck or jaw"],
    sources: []
  },
  {
    id: "honey-lemon-warm-water", name: "Honey & Lemon Warm Water", cat: "sore-throat", time: "5 minutes", items: ["food:honey", "fruit:lemon"], recipe: "ginger-lemon-honey",
    helps: ["A sore, scratchy throat", "Coughing, especially at night (ages 1 and up)"],
    intro: "Honey coats and soothes the throat, and it has more research for coughs than most home remedies.",
    ingredients: [["1–2 tsp", "honey"], ["1 cup (240 ml)", "warm water or caffeine-free tea"], ["1 tbsp", "fresh lemon juice"]],
    steps: ["Warm the water until comfortably hot (not boiling).", "Stir in the honey until dissolved.", "Add the lemon juice.", "Sip slowly while warm."],
    amount: "1 cup, with 1–2 tsp honey. For a nighttime cough: ½ tsp honey for ages 1–5, 1 tsp for ages 6–11, 2 tsp for 12 and up, at bedtime.", often: "Up to 3–4 times a day.",
    evidence: ["R", "Reviews of studies found honey may ease cough symptoms and help sleep in children over 1 and adults, about as well as some over-the-counter cough medicines."],
    safety: ["Never give honey to babies under 1 year — it can cause infant botulism.", "Honey is a sugar; count it if you manage blood sugar.", "Lemon is acidic — rinse your mouth with plain water afterwards to protect tooth enamel."],
    seekCare: ["A cough lasting more than 3 weeks, or coughing up blood", "Shortness of breath, wheezing, or chest pain", "High fever, or a baby under 3 months with any fever"],
    sources: ["botulism"]
  },
  // ---------- Colds ----------
  {
    id: "steam-inhalation", name: "Steam Inhalation", cat: "colds", time: "10 minutes", items: [], recipe: null,
    helps: ["A stuffy nose", "Thick mucus", "Dry, irritated airways"],
    intro: "Breathing warm, moist air may help loosen mucus and make a stuffy nose feel more comfortable.",
    ingredients: [["A bowl of hot water", "(steaming, not boiling)"], ["1", "towel"]],
    steps: ["Pour hot (not boiling) water into a large bowl on a table.", "Sit, lean over the bowl at a comfortable distance (about 12 inches / 30 cm), and drape a towel over your head.", "Breathe slowly through your nose for 5–10 minutes.", "Easier option: sit in a steamy bathroom with the shower running."],
    amount: "5–10 minutes.", often: "2–3 times a day.",
    evidence: ["P", "Steam may make congestion feel better for a while, but studies show it doesn't shorten colds."],
    safety: ["Scalds are a real risk — never use boiling water, and keep the bowl stable.", "Never use a steam bowl with children — use a steamy bathroom instead.", "Don't add essential oils for children or if you have asthma."],
    seekCare: ["Trouble breathing or wheezing", "Symptoms lasting more than 10 days, or getting better then worse", "Fever above 102°F (38.9°C) or lasting more than 3 days", "Severe facial pain or swelling"],
    sources: []
  },
  {
    id: "chicken-vegetable-soup", name: "Chicken & Vegetable Soup", cat: "colds", time: "45 minutes", items: ["food:chicken-breast", "food:carrots", "garlic", "food:bone-broth"], recipe: null,
    helps: ["Feeling run-down with a cold", "Staying hydrated when appetite is low", "A stuffy nose"],
    intro: "Grandma was onto something. Warm soup provides fluids, salt, protein and vegetables when you don't feel like eating, and the steam may ease congestion.",
    ingredients: [["1 tbsp", "olive oil"], ["1", "onion, chopped"], ["2", "carrots, sliced"], ["2", "celery stalks, sliced"], ["3", "garlic cloves, minced"], ["6 cups (1.4 L)", "low-sodium chicken broth or bone broth"], ["2 (about 12 oz / 340 g)", "boneless chicken breasts"], ["1 tsp", "dried thyme"], ["To taste", "salt, pepper and fresh parsley"]],
    steps: ["Warm the olive oil in a large pot over medium heat. Add onion, carrots and celery and cook for 5 minutes.", "Add the garlic and thyme and cook for 1 minute.", "Add the broth and whole chicken breasts. Bring to a boil, then simmer gently for 20 minutes, until the chicken reaches 165°F (74°C).", "Lift out the chicken, shred it with two forks and return it to the pot.", "Season, add parsley, and serve hot."],
    amount: "1–2 bowls (1–2 cups).", often: "1–2 times a day while you're unwell.",
    evidence: ["P", "A lab study found chicken soup may slow the movement of inflammatory white blood cells, and warm fluids help with hydration and congestion. It isn't a cure."],
    safety: ["Store-bought broth can be very salty — choose low-sodium if you watch your salt.", "Cool leftovers quickly and refrigerate within 2 hours; eat within 3–4 days."],
    seekCare: ["Trouble breathing", "Signs of dehydration", "Fever lasting more than 3 days, or very high fever", "Symptoms in a baby under 3 months"],
    sources: []
  },
  {
    id: "saline-nasal-rinse", name: "Saline Nasal Rinse", cat: "colds", time: "5 minutes", items: [], recipe: null,
    helps: ["A blocked or stuffy nose", "Sinus pressure", "Allergy symptoms and postnasal drip"],
    intro: "Rinsing the nose with salt water washes out mucus and irritants. Doctors commonly recommend it for colds, sinus symptoms and allergies — but the water must be safe.",
    ingredients: [["1 cup (240 ml)", "distilled or sterile water, or tap water boiled for 1 minute and cooled to lukewarm"], ["¼–½ tsp", "non-iodized salt (canning or pickling salt)"], ["1 pinch", "baking soda"], ["A clean neti pot or squeeze bottle", ""]],
    steps: ["Mix the salt and baking soda into the lukewarm safe water until dissolved.", "Lean over a sink and tilt your head to one side.", "Gently pour or squeeze half the solution into your upper nostril so it drains out the lower one. Breathe through your mouth.", "Gently blow your nose, then repeat on the other side.", "Wash the device with safe water and let it air-dry."],
    amount: "About 1 cup, split between both nostrils.", often: "1–2 times a day.",
    evidence: ["R", "Saline rinses have been studied for sinus and nasal symptoms and are widely recommended by doctors."],
    safety: ["NEVER use untreated tap water — rare but deadly infections have occurred. Use distilled, sterile, or boiled-and-cooled water.", "Don't use if your ears are blocked or you have an ear infection.", "Ask your pediatrician before using with children."],
    seekCare: ["Symptoms lasting more than 10 days", "Fever over 102°F (38.9°C), or severe headache or facial pain", "Swelling or redness around the eyes", "A stiff neck or confusion"],
    sources: ["netiPot"]
  },
  // ---------- Energy ----------
  {
    id: "steady-energy-snack", name: "Steady-Energy Snack: Apple & Almonds", cat: "energy", time: "2 minutes", items: ["fruit:apple", "food:almonds"], recipe: null,
    helps: ["The mid-afternoon slump", "Energy crashes after sugary snacks", "Staying full between meals"],
    intro: "Pairing a fiber-rich fruit with protein and healthy fat slows how fast sugar enters your blood, which may mean fewer energy crashes.",
    ingredients: [["1 medium", "apple (or pear)"], ["1 oz (a small handful, about 23)", "almonds — or 1–2 tbsp almond or peanut butter"], ["1 glass", "water"]],
    steps: ["Wash and slice the apple, leaving the skin on for fiber.", "Serve with the almonds or nut butter.", "Drink a glass of water — mild dehydration can feel like tiredness.", "Eat slowly, away from screens."],
    amount: "1 apple + 1 oz nuts.", often: "Once a day as an afternoon snack.",
    evidence: ["P", "Studies show adding protein, fat and fiber to carbohydrates slows the blood-sugar rise, and almonds eaten with carbohydrate foods have been studied for this effect."],
    safety: ["Skip the nuts (or use seeds) if you have a nut allergy.", "Whole nuts are a choking hazard for children under 4."],
    seekCare: ["Tiredness lasting more than 2–3 weeks despite good sleep", "Fatigue with shortness of breath, weight loss, heavy periods, or low mood", "Feeling very thirsty and urinating often (possible high blood sugar)"],
    sources: []
  },
  {
    id: "morning-light-walk", name: "Morning Light Walk", cat: "energy", time: "10–20 minutes", items: [], recipe: null,
    helps: ["Morning grogginess", "Low energy during the day", "A body clock thrown off by late nights"],
    intro: "Bright morning light tells your internal clock that the day has started, and gentle movement gets blood flowing. Together they're a simple energy habit.",
    ingredients: [["10–20 minutes", "outdoors, within 1–2 hours of waking"], ["Comfortable shoes", ""]],
    steps: ["Within an hour or two of waking, step outside — even on a cloudy day.", "Walk at an easy, comfortable pace for 10–20 minutes.", "Don't wear sunglasses unless you need them, and never look directly at the sun.", "Drink a glass of water when you get back."],
    amount: "10–20 minutes.", often: "Daily, especially on workdays.",
    evidence: ["P", "Morning light exposure has been studied for supporting the body clock and sleep timing, and regular walking has been studied for reducing fatigue."],
    safety: ["Use sunscreen and protect your eyes in strong sun.", "In very hot or cold weather, keep it short and dress for the conditions.", "If you have heart or lung disease, ask your doctor what activity level is right for you."],
    seekCare: ["Fatigue that doesn't improve after a few weeks of good habits", "Chest pain, dizziness or unusual shortness of breath when walking — stop and seek care"],
    sources: []
  },
  {
    id: "green-tea-pick-me-up", name: "Green Tea Pick-Me-Up", cat: "energy", time: "5 minutes", items: ["green-tea"], recipe: null,
    helps: ["Gentle, steady alertness", "Focus without the jitters of strong coffee"],
    intro: "Green tea has less caffeine than coffee plus L-theanine, an amino acid that may smooth out caffeine's edge for calm alertness.",
    ingredients: [["1 tsp (about 2 g)", "green tea leaves, or 1 tea bag"], ["1 cup (240 ml)", "hot water, about 175°F (80°C) — just off the boil"]],
    steps: ["Heat water until steaming but not boiling (or let boiled water cool for 2 minutes).", "Pour over the tea.", "Steep for 2–3 minutes (longer makes it bitter).", "Remove the leaves and sip."],
    amount: "1 cup (about 30–50 mg caffeine).", often: "1–3 cups a day, before about 2 p.m.",
    evidence: ["P", "Studies of caffeine together with L-theanine found improved alertness and attention."],
    safety: ["Contains caffeine — limit to about 200 mg of caffeine a day in pregnancy.", "Drink between meals rather than with them if you have low iron (tea reduces iron absorption).", "May worsen anxiety or sleep problems; avoid with ADHD stimulants unless your doctor agrees.", "Avoid concentrated green tea extract pills, which have been linked with liver injury."],
    seekCare: ["Ongoing exhaustion despite rest", "A racing or irregular heartbeat"],
    sources: []
  },
  // ---------- Menstrual comfort ----------
  {
    id: "ginger-for-cramps", name: "Ginger for Period Cramps", cat: "menstrual", time: "15 minutes", items: ["ginger"], recipe: "ginger-lemon-honey",
    helps: ["Period cramps", "Nausea that comes with your period"],
    intro: "Ginger calms the body's production of prostaglandins — the same messengers that cause period cramps.",
    ingredients: [["1-inch (2.5 cm) piece", "fresh ginger, sliced — or capsules of powdered ginger (250 mg each)"], ["1½ cups (360 ml)", "water (for tea)"], ["1 tsp (optional)", "honey"]],
    steps: ["Simmer the sliced ginger in water for 10 minutes, then strain.", "Sip a cup up to 3 times a day during the first days of your period.", "Or, as in studies, take 250 mg of ginger powder 4 times a day for the first 3 days of your period."],
    amount: "1 cup of tea, or 250 mg capsules as described (about 1 g a day).", often: "Up to 3–4 times a day, for the first 2–3 days of your period.",
    evidence: ["P", "Several small trials found ginger eased period pain, and some found effects similar to ibuprofen. The studies are small."],
    safety: ["May increase bleeding with blood thinners; ask your doctor if your periods are very heavy.", "Ask your doctor first if you have gallstones.", "Stop if you might be pregnant and check with your provider."],
    seekCare: ["Pain that keeps you from daily activities or is getting worse each month", "Very heavy bleeding (soaking a pad or tampon every hour), or bleeding between periods", "Pain with fever or unusual discharge", "Severe pain and you might be pregnant — seek care right away"],
    sources: ["nccihGinger"]
  },
  {
    id: "heat-therapy-cramps", name: "Warm Heat Pack for Cramps", cat: "menstrual", time: "20 minutes", items: [], recipe: null,
    helps: ["Period cramps", "Lower back aches during your period"],
    intro: "Warmth relaxes tight muscles and improves blood flow. It's simple, drug-free and surprisingly effective.",
    ingredients: [["1", "heating pad on low, a hot water bottle, or a microwavable heat pack"], ["1", "thin towel or cloth"]],
    steps: ["Fill a hot water bottle with warm (not boiling) water, or warm a heat pack as directed.", "Wrap it in a thin towel.", "Place it on your lower belly or lower back while you rest.", "Leave it on for about 20 minutes, then take a break."],
    amount: "20 minutes at a time.", often: "As needed throughout the day, with breaks for your skin.",
    evidence: ["P", "Small studies found continuous low-level heat eased period cramps about as well as some pain relievers."],
    safety: ["Always use a cloth layer and a low setting to avoid burns.", "Don't fall asleep with a heating pad on.", "Use extra care if you have diabetes or reduced feeling in your skin."],
    seekCare: ["Severe pain, or pain that is getting worse over time", "Very heavy bleeding or bleeding between periods", "Pain with fever"],
    sources: []
  },
  // ---------- Skin ----------
  {
    id: "oatmeal-soak", name: "Soothing Oatmeal Soak", cat: "skin", time: "20 minutes", items: ["food:oats"], recipe: "soothing-oatmeal-bath",
    helps: ["Itchy, dry or irritated skin", "Mild eczema flares", "Itchy bug bites or mild sunburn"],
    intro: "Finely ground (colloidal) oatmeal forms a protective film on the skin and contains avenanthramides, compounds that calm itching.",
    ingredients: [["1 cup (about 80 g)", "plain rolled oats, ground to a very fine powder in a blender — or store-bought colloidal oatmeal"], ["A bathtub", "of lukewarm water"]],
    steps: ["Blend the oats until they're a fine powder that turns the water milky when stirred in.", "Run a lukewarm (not hot) bath and sprinkle the powder in, swishing to mix.", "Soak for 15–20 minutes.", "Pat — don't rub — your skin dry, then apply a fragrance-free moisturizer right away."],
    amount: "1 cup ground oats per bath.", often: "Once a day, or up to twice a day during flares.",
    evidence: ["R", "Colloidal oatmeal is an FDA-recognized over-the-counter skin protectant for itching and irritation, and studies support its use in eczema care."],
    safety: ["The tub will be slippery — step in and out carefully.", "Rarely, people with oat allergy react — test on a small patch first.", "Use lukewarm, not hot, water."],
    seekCare: ["A rash with fever, blisters, or spreading redness and warmth (possible infection)", "Swelling of the face, lips or tongue, or trouble breathing — call 911", "Itching that keeps you from sleeping or doesn't improve in 2 weeks"],
    sources: []
  },
  {
    id: "aloe-for-sunburn", name: "Aloe Vera for Mild Sunburn", cat: "skin", time: "5 minutes", items: ["aloe-vera"], recipe: null,
    helps: ["Mild sunburn", "Minor skin irritation"],
    intro: "The clear gel inside aloe leaves is cooling and moisturizing, which is why it's a classic for mild sunburn.",
    ingredients: [["1 aloe leaf", "or pure aloe vera gel (look for few added ingredients and no alcohol)"]],
    steps: ["If using a fresh leaf, wash it, slice it open and scoop out only the clear gel (avoid the yellow sap just under the skin).", "Cool your skin first with a cool shower or damp cloth.", "Gently spread a thin layer of gel over the sunburn.", "Chill the gel in the fridge for extra cooling."],
    amount: "A thin layer.", often: "2–3 times a day.",
    evidence: ["P", "Aloe gel is widely used for minor burns. Some studies suggest it helps minor burns heal, but results for sunburn are mixed."],
    safety: ["For skin use only — don't swallow aloe latex (the yellow sap), which is a strong laxative.", "Stop if you get a rash or more redness; people allergic to onions, garlic or tulips may react.", "Don't use on deep or open wounds."],
    seekCare: ["Blistering over a large area", "Fever, chills, headache or confusion with sunburn", "Severe pain, or signs of dehydration", "Signs of infection: increasing redness, warmth, pus or red streaks"],
    sources: ["nccihAloe"]
  },
  // ---------- Hydration ----------
  {
    id: "homemade-rehydration-drink", name: "Homemade Rehydration Drink", cat: "hydration", time: "5 minutes", items: [], recipe: null,
    helps: ["Replacing fluids and salts after diarrhea or vomiting", "Mild dehydration in adults"],
    intro: "The right balance of water, sugar and salt helps the gut absorb water faster than plain water alone. This is the World Health Organization's simple home recipe.",
    ingredients: [["1 liter (about 4¼ cups)", "clean drinking water"], ["6 level teaspoons", "sugar"], ["½ level teaspoon", "salt"]],
    steps: ["Measure carefully with level measuring spoons — the amounts matter.", "Stir the sugar and salt into the water until completely dissolved.", "Sip small amounts often, every few minutes, rather than drinking a lot at once.", "Make a fresh batch each day and throw away anything left after 24 hours."],
    amount: "Small sips often; adults can drink up to about 2–3 liters a day while unwell.", often: "Throughout the day until urine is pale yellow again.",
    evidence: ["R", "Oral rehydration solution is a WHO-recommended treatment for dehydration from diarrhea and has saved millions of lives."],
    safety: ["Measure exactly — too much salt can be dangerous.", "For babies and young children, use a store-bought oral rehydration solution and call your pediatrician.", "If you have kidney disease, heart failure or high blood pressure, ask your doctor first."],
    seekCare: ["No urine for 8 hours, or very dark urine", "Dizziness, fainting, confusion or a racing heart", "Blood or black color in the stool, or vomiting blood", "Diarrhea lasting more than 2 days in adults (sooner for children)", "A baby with fewer wet diapers, no tears, or a sunken soft spot — call your pediatrician right away"],
    sources: ["ors"]
  },
  {
    id: "fruit-infused-water", name: "Fruit & Herb Infused Water", cat: "hydration", time: "5 minutes + chilling", items: ["fruit:cucumber", "fruit:lemon", "peppermint"], recipe: "mint-cucumber-water",
    helps: ["Drinking more water through the day", "Cutting back on soda and sweet drinks"],
    intro: "If plain water feels boring, a little fruit and fresh herbs make it taste like a treat — with almost no sugar.",
    ingredients: [["2 quarts (2 L)", "cold water"], ["½", "cucumber, thinly sliced"], ["1", "lemon, sliced"], ["1 handful", "fresh mint leaves, lightly crushed"]],
    steps: ["Wash the cucumber, lemon and mint well.", "Add them to a large pitcher.", "Fill with cold water and refrigerate for at least 1 hour.", "Refill the pitcher with water once or twice, then start fresh."],
    amount: "A glass at a time; most adults need about 8–12 cups of fluids a day from all drinks and foods.", often: "Throughout the day.",
    evidence: ["T", "Flavoring water is a practical way to drink more; staying hydrated supports energy, focus and digestion."],
    safety: ["Use within 24 hours and keep refrigerated.", "Citrus is acidic — rinse with plain water to protect tooth enamel.", "If you're on a fluid restriction for heart or kidney disease, follow your doctor's limit."],
    seekCare: ["Constant thirst with frequent urination (possible high blood sugar)", "Signs of dehydration that don't improve with drinking"],
    sources: []
  }
];

const findRemedy = (id) => REMEDIES.find((r) => r.id === id);
