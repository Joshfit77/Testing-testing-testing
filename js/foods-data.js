// The Beauty & Praise food library: everyday foods (fruits live in fruits-data.js).
//
// Every food and fruit page uses the same structure (see foodProfile below):
//   what · key nutrients · potential benefits · best ways to eat it · typical serving · when to eat it ·
//   who may benefit · possible downsides · allergies & interactions · pregnancy & breastfeeding · sources
//
// Food fields:
//   group:     a FOOD_GROUPS key           cats:  FOOD_CATEGORIES keys (the "Food as the Foundation" cards)
//   goals:     wellness guide ids (guides.js) this food supports
//   art:       "bowl" or a fruit shape (round, long, pear, melon, berry) for the fallback illustration
//   benefits:  [evidence, title, explanation] — the same R / P / T evidence labels used across the site
//   serving:   [typical serving, grams]
//   sources:   extra FOOD_SOURCES keys (nutrient fact sheets are added automatically from the nutrients)
//
// Language is deliberately conservative: foods "may support" or "have been studied for" — they do not cure anything.

const FOOD_GROUPS = {
  protein: "Meat & eggs", dairy: "Dairy & fermented", seafood: "Fish & seafood", legumes: "Beans & lentils",
  grains: "Whole grains", vegetables: "Vegetables", nuts: "Nuts & seeds", fats: "Oils & healthy fats", pantry: "Pantry & treats"
};

// The "Food as the Foundation" categories. keywords help search ("high-protein foods" → Protein-rich foods).
const FOOD_CATEGORIES = [
  { id: "protein", label: "Protein-rich foods", icon: "egg", text: "Build and repair muscle, stay full longer and keep energy steady.", keywords: ["protein", "high protein", "muscle"] },
  { id: "anti-inflammatory", label: "Anti-inflammatory foods", icon: "leaf", text: "Colorful plants, olive oil and oily fish that may help calm inflammation.", keywords: ["inflammation", "anti-inflammatory", "joint"] },
  { id: "digestion", label: "Foods for digestion", icon: "cup", text: "Fiber and fermented foods that may support regularity and a healthy gut.", keywords: ["digestion", "gut", "fiber", "constipation", "bloating", "probiotic"] },
  { id: "energy", label: "Foods for energy", icon: "sun", text: "Slow-burning carbs, iron and B vitamins for steadier energy through the day.", keywords: ["energy", "tired", "fatigue", "iron"] },
  { id: "sleep", label: "Foods for sleep", icon: "moon", text: "Foods with magnesium, tryptophan and melatonin that may support restful sleep.", keywords: ["sleep", "insomnia", "rest", "magnesium"] },
  { id: "immunity", label: "Foods for immunity", icon: "shield", text: "Vitamin C, zinc and protein your immune system relies on.", keywords: ["immune", "immunity", "cold", "zinc", "vitamin c"] },
  { id: "heart", label: "Heart-healthy foods", icon: "heart", text: "Fiber, healthy fats and potassium that may support heart and blood pressure.", keywords: ["heart", "cholesterol", "blood pressure"] },
  { id: "women", label: "Foods for women's wellness", icon: "flower", text: "Iron, folate, calcium and omega-3s for every season of a woman's life.", keywords: ["women", "pregnancy", "period", "menopause", "hormone", "folate"] },
  { id: "healthy-fats", label: "Healthy fats", icon: "drop", text: "Olive oil, nuts, seeds, avocado and fish — fats your body needs.", keywords: ["fat", "fats", "omega", "healthy fat"] },
  { id: "fruits-veg", label: "Fruits & vegetables", icon: "apple", text: "The colorful foundation of every healthy plate.", keywords: ["fruit", "vegetable", "veggie", "produce", "greens"] }
];

// Fruits use the herb/fruit CATEGORIES; this maps them onto the food categories above.
const FRUIT_FOOD_CATS = { digestion: "digestion", immunity: "immunity", heart: "heart", energy: "energy", sleep: "sleep", women: "women", aches: "anti-inflammatory" };
const FRUIT_HEALTHY_FATS = ["avocado", "olive", "coconut"];

// Reference links. Nutrient fact sheets from the NIH Office of Dietary Supplements are matched automatically.
const FOOD_SOURCES = {
  fdc: ["USDA FoodData Central — nutrient values", "https://fdc.nal.usda.gov/"],
  dga: ["Dietary Guidelines for Americans, 2020–2025", "https://www.dietaryguidelines.gov/"],
  fish: ["FDA & EPA — Advice about eating fish", "https://www.fda.gov/food/consumers/advice-about-eating-fish"],
  allergens: ["FDA — Food allergies", "https://www.fda.gov/food/food-labeling-nutrition/food-allergies"],
  temps: ["FoodSafety.gov — Safe minimum cooking temperatures", "https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures"],
  pregnancy: ["FoodSafety.gov — Food safety during pregnancy", "https://www.foodsafety.gov/people-at-risk/pregnant-women"],
  botulism: ["CDC — Botulism (why babies can't have honey)", "https://www.cdc.gov/botulism/"],
  probiotics: ["NIH NCCIH — Probiotics: what you need to know", "https://www.nccih.nih.gov/health/probiotics-what-you-need-to-know"],
  flax: ["NIH NCCIH — Flaxseed and flaxseed oil", "https://www.nccih.nih.gov/health/flaxseed-and-flaxseed-oil"]
};
const ODS_SHEETS = [
  [/omega-3|ala\b|epa|dha/i, "Omega3FattyAcids", "Omega-3 fatty acids"], [/choline/i, "Choline", "Choline"], [/calcium/i, "Calcium", "Calcium"],
  [/magnesium/i, "Magnesium", "Magnesium"], [/\biron\b/i, "Iron", "Iron"], [/vitamin d\b/i, "VitaminD", "Vitamin D"],
  [/potassium/i, "Potassium", "Potassium"], [/folate/i, "Folate", "Folate"], [/vitamin k/i, "VitaminK", "Vitamin K"], [/zinc/i, "Zinc", "Zinc"],
  [/selenium/i, "Selenium", "Selenium"], [/b12/i, "VitaminB12", "Vitamin B12"], [/vitamin a|beta-carotene/i, "VitaminA", "Vitamin A"],
  [/vitamin c/i, "VitaminC", "Vitamin C"], [/vitamin e/i, "VitaminE", "Vitamin E"]
];

const FOODS = [
  {
    id: "eggs", name: "Eggs", group: "protein", cats: ["protein", "energy", "women"], goals: ["energy", "memory", "hair", "womens-cycle"], color: "#e9c27a", art: "round", wiki: "Egg as food",
    what: "Eggs are one of the most affordable sources of complete protein, with all nine essential amino acids. The yolk carries most of the vitamins, choline and healthy fats, so the whole egg is the most nourishing choice.",
    nutrients: ["6 g protein per large egg", "Choline (about 150 mg)", "Vitamin B12", "Vitamin D (small amount)", "Lutein & zeaxanthin", "Selenium"],
    benefits: [["R", "Protein for muscle and fullness", "Eggs provide high-quality protein that supports muscle repair. Studies suggest a protein-rich breakfast such as eggs may help people feel full longer."],
      ["P", "Brain and baby development", "Eggs are one of the richest food sources of choline, a nutrient used for memory and mood signaling and important for a baby's brain development during pregnancy."],
      ["P", "Eye health", "The lutein and zeaxanthin in yolks collect in the retina and have been studied for supporting eye health with age."]],
    uses: ["Scramble with spinach and peppers for a veggie-packed breakfast.", "Hard-boil a batch for quick snacks and salads.", "Top a grain bowl or toast with a soft-cooked egg.", "Bake into an egg muffin cup with vegetables."],
    serving: ["1–2 large eggs", 100],
    when: "Breakfast is a great time — a protein-rich start may help with steady energy and fullness until lunch. Also handy as a post-workout snack.",
    who: ["Anyone wanting more protein at breakfast", "Pregnant and breastfeeding women (for choline — fully cooked)", "Active people and older adults maintaining muscle", "People who don't eat meat but do eat eggs"],
    downsides: ["Fry in a little olive oil rather than lots of butter, and pair with vegetables rather than processed meats.", "People with diabetes or high LDL cholesterol may be advised to keep yolks moderate — follow your doctor's guidance.", "Raw or runny eggs can carry Salmonella."],
    allergies: "Egg is one of the most common food allergies, especially in children. Egg allergy can be serious — avoid eggs and foods containing them if you are allergic.",
    pregnancy: "Eggs are a great pregnancy food for protein and choline. Cook until the yolk and white are firm, and avoid raw-egg foods such as homemade mayonnaise, raw cookie dough or eggnog.",
    sources: ["allergens", "temps", "pregnancy"]
  },
  {
    id: "greek-yogurt", name: "Greek Yogurt", group: "dairy", cats: ["protein", "digestion", "women"], goals: ["digestion", "immunity", "energy"], color: "#ece6d8", art: "bowl", wiki: "Strained yogurt",
    what: "Greek yogurt is yogurt that has been strained to remove much of the liquid whey, making it thicker and higher in protein. Choose plain yogurt with \"live and active cultures\" and add your own fruit and honey.",
    nutrients: ["15–20 g protein per 6 oz (170 g)", "Calcium", "Live cultures (probiotics)", "Vitamin B12", "Iodine"],
    benefits: [["R", "High-protein snack", "One serving gives roughly as much protein as three eggs, which may support fullness and muscle maintenance."],
      ["P", "Gut health", "Yogurts with live cultures supply beneficial bacteria. Fermented dairy has been studied for supporting digestion and a healthy gut microbiome."],
      ["P", "Bone health", "Its calcium and protein support bones — especially important for women as they age."]],
    uses: ["Top with berries, nuts and a drizzle of honey.", "Use instead of sour cream on tacos and potatoes.", "Blend into smoothies for creaminess and protein.", "Stir with garlic, cucumber and dill for tzatziki."],
    serving: ["¾ cup (6 oz)", 170],
    when: "Breakfast or an afternoon snack. A small bowl in the evening can be a satisfying, protein-rich treat.",
    who: ["Anyone looking for an easy high-protein snack", "People supporting gut health", "Women needing more calcium", "People with mild lactose intolerance (Greek yogurt is lower in lactose)"],
    downsides: ["Flavored yogurts can contain a lot of added sugar — choose plain.", "Dairy doesn't agree with everyone."],
    allergies: "Contains milk, a common allergen. Usually tolerated better than milk by people with lactose intolerance, but not safe for anyone with a milk allergy.",
    pregnancy: "A great choice during pregnancy and breastfeeding for protein and calcium. Choose yogurt made from pasteurized milk.",
    sources: ["probiotics", "allergens", "pregnancy"]
  },
  {
    id: "salmon", name: "Salmon", group: "seafood", cats: ["protein", "anti-inflammatory", "heart", "healthy-fats", "women"], goals: ["heart", "memory", "joints", "skin", "stress"], color: "#e8836a", art: "long", wiki: "Salmon as food",
    what: "Salmon is an oily fish rich in the long-chain omega-3 fats EPA and DHA, plus high-quality protein and vitamin D. It is one of the FDA's \"best choices\" for low-mercury fish.",
    nutrients: ["About 22 g protein per 3 oz (85 g)", "Omega-3s EPA + DHA (about 1–1.8 g)", "Vitamin D", "Vitamin B12", "Selenium"],
    benefits: [["R", "Heart health", "Eating fatty fish about twice a week is linked with a lower risk of dying from heart disease in large studies, and omega-3s help lower triglycerides."],
      ["P", "Brain and mood", "DHA is a building block of the brain. Diets with regular fish have been studied for supporting memory with age and mood."],
      ["P", "Calmer inflammation", "EPA and DHA are turned into compounds that help the body resolve inflammation, which has been studied for joint comfort."]],
    uses: ["Bake with lemon, garlic and dill at 400°F (200°C) for 12–15 minutes.", "Flake into salads or grain bowls.", "Make salmon patties with canned salmon (bones add calcium).", "Grill on a cedar plank in summer."],
    serving: ["3–4 oz cooked (85–113 g), 2 times a week", 113],
    when: "Lunch or dinner, about twice a week. Pair with vegetables and a whole grain.",
    who: ["Anyone supporting heart health", "Pregnant and breastfeeding women (DHA for baby's brain — cooked)", "People who rarely eat fish", "Older adults supporting memory"],
    downsides: ["Smoked and cured salmon can be high in salt.", "Large amounts of omega-3 supplements (not food) may increase bleeding risk with blood thinners."],
    allergies: "Fish is a major food allergen. People allergic to one fish are often allergic to others — ask your allergist.",
    pregnancy: "The FDA advises 2–3 servings a week of low-mercury fish like salmon during pregnancy and breastfeeding. Cook to 145°F (63°C); avoid raw sushi and refrigerated smoked salmon unless cooked into a hot dish.",
    sources: ["fish", "temps", "pregnancy", "allergens"]
  },
  {
    id: "sardines", name: "Sardines", group: "seafood", cats: ["protein", "anti-inflammatory", "heart", "healthy-fats"], goals: ["heart", "joints", "memory", "energy"], color: "#8a9aa8", art: "long", wiki: "Sardines as food",
    what: "Sardines are small, oily fish usually sold canned. Because they're eaten bones and all, they're one of the best non-dairy sources of calcium, and they're low in mercury.",
    nutrients: ["About 20 g protein per can", "Omega-3s EPA + DHA", "Calcium (from soft bones)", "Vitamin B12", "Vitamin D", "Selenium"],
    benefits: [["P", "Heart health", "Like other oily fish, sardines supply omega-3s that may help lower triglycerides and support heart health."],
      ["P", "Bone health", "A can of sardines with bones can provide about a third of the daily calcium most adults need, along with vitamin D."],
      ["P", "Energy", "Sardines are rich in vitamin B12, which is needed for healthy red blood cells and energy."]],
    uses: ["Mash onto whole-grain toast with lemon and pepper.", "Toss with pasta, olive oil, garlic and parsley.", "Add to a salad for an easy protein.", "Make sardine \"tuna salad\" with Greek yogurt and celery."],
    serving: ["1 can (about 3.75 oz / 92 g), 2 times a week", 92],
    when: "Lunch or dinner. Keep a few cans in the pantry for quick, protein-rich meals.",
    who: ["Anyone wanting affordable omega-3s", "People who don't eat dairy (for calcium)", "Older adults supporting bones", "Pregnant women looking for low-mercury fish"],
    downsides: ["Canned sardines can be high in sodium — rinse or choose low-sodium.", "High in purines, which may trigger flares in people with gout."],
    allergies: "Fish is a major food allergen.",
    pregnancy: "Sardines are on the FDA's \"best choices\" list for low-mercury fish — 2–3 servings a week is encouraged during pregnancy and breastfeeding.",
    sources: ["fish", "pregnancy", "allergens"]
  },
  {
    id: "chicken-breast", name: "Chicken Breast", group: "protein", cats: ["protein", "energy"], goals: ["energy", "mens-health", "hair"], color: "#e8c9a0", art: "pear", wiki: "Chicken as food",
    what: "Skinless chicken breast is a lean, versatile protein that takes on the flavor of whatever you cook it with. It's low in fat and rich in B vitamins.",
    nutrients: ["About 26 g protein per 3 oz (85 g) cooked", "Niacin (vitamin B3)", "Vitamin B6", "Selenium", "Phosphorus"],
    benefits: [["R", "Lean protein for muscle", "Chicken provides high-quality protein with little saturated fat, which supports muscle repair and fullness."],
      ["P", "Energy metabolism", "Its niacin and vitamin B6 help the body turn food into energy."],
      ["T", "Comfort when unwell", "Chicken soup is a time-honored comfort food during colds; warm broth also helps with hydration."]],
    uses: ["Bake or grill with herbs and slice over salads.", "Simmer into soup with vegetables.", "Shred for tacos, wraps and grain bowls.", "Marinate in yogurt, lemon and spices for tender kebabs."],
    serving: ["3–4 oz cooked (85–113 g)", 113],
    when: "Lunch or dinner. Including protein at each meal may help keep energy steadier.",
    who: ["Anyone increasing protein", "Active people building muscle", "People managing weight who want filling meals", "Older adults maintaining strength"],
    downsides: ["Breaded, fried and processed chicken products add salt and unhealthy fats.", "Undercooked chicken can carry Salmonella and Campylobacter."],
    allergies: "Chicken allergy is uncommon. Always wash hands, boards and knives after handling raw chicken.",
    pregnancy: "A good protein during pregnancy. Cook to 165°F (74°C) and avoid cold deli chicken unless reheated until steaming.",
    sources: ["temps", "pregnancy"]
  },
  {
    id: "lean-beef", name: "Lean Beef", group: "protein", cats: ["protein", "energy", "women"], goals: ["energy", "mens-health", "hair", "womens-cycle"], color: "#a8443a", art: "round", wiki: "Beef",
    what: "Lean cuts of beef such as sirloin, round or 90% lean ground beef provide protein plus heme iron — the form of iron your body absorbs most easily — and zinc.",
    nutrients: ["About 22 g protein per 3 oz (85 g)", "Heme iron", "Zinc", "Vitamin B12", "Selenium"],
    benefits: [["R", "Iron for energy", "Heme iron from meat is absorbed two to three times better than iron from plants, which may help women with heavy periods maintain iron levels."],
      ["P", "Zinc for immunity and hormones", "Beef is one of the richest food sources of zinc, which the immune system and testosterone production rely on."],
      ["R", "Protein for muscle", "Beef supplies complete protein and creatine that support muscle strength."]],
    uses: ["Grill or pan-sear sirloin and slice thin over salad.", "Make a lean beef and vegetable stir-fry.", "Use 90% lean ground beef in chili with beans.", "Slow-cook a lean roast with root vegetables."],
    serving: ["3 oz cooked (85 g), a few times a week", 85],
    when: "Lunch or dinner. Pair with vitamin C–rich vegetables (peppers, broccoli) to help absorb the iron.",
    who: ["Women with heavy periods or low iron", "Active people building muscle", "Men supporting zinc intake", "Older adults with low appetite needing nutrient-dense protein"],
    downsides: ["Health organizations suggest limiting red meat and avoiding processed meats (bacon, hot dogs, deli meats), which are linked with higher risk of heart disease and colon cancer.", "Choose lean cuts and avoid charring."],
    allergies: "Alpha-gal syndrome (a red-meat allergy that can follow a tick bite) causes delayed reactions to beef, pork and lamb. People with iron overload (hemochromatosis) should limit iron-rich red meat.",
    pregnancy: "Lean beef is a good iron source during pregnancy. Cook ground beef to 160°F (71°C) and steaks to at least 145°F (63°C) with a 3-minute rest; avoid rare meat.",
    sources: ["temps", "pregnancy"]
  },
  {
    id: "tofu", name: "Tofu", group: "legumes", cats: ["protein", "heart", "women"], goals: ["heart", "menopause", "energy"], color: "#efe6cf", art: "bowl", wiki: "Tofu",
    what: "Tofu is made by curdling soy milk and pressing it into blocks. It's a complete plant protein, and tofu made with calcium sulfate is also a good source of calcium.",
    nutrients: ["About 10–20 g protein per ½ cup (126 g), depending on firmness", "Calcium (if calcium-set)", "Iron", "Isoflavones", "Magnesium"],
    benefits: [["R", "Plant protein", "Soy is one of the few plant foods with complete protein, making tofu a helpful swap for some meat."],
      ["P", "Heart health", "Replacing some animal protein with soy has been studied for modestly lowering LDL cholesterol."],
      ["P", "Menopause comfort", "Soy isoflavones are plant compounds that have been studied for easing hot flashes in some women."]],
    uses: ["Press, cube and bake or air-fry until crisp.", "Scramble with turmeric and vegetables.", "Add to stir-fries and soups.", "Blend silken tofu into smoothies or creamy dressings."],
    serving: ["½ cup (about 126 g)", 126],
    when: "Lunch or dinner, or scrambled at breakfast.",
    who: ["Vegetarians and vegans", "People cutting back on red meat", "Women in menopause", "Anyone supporting heart health"],
    downsides: ["Some people find soy causes bloating.", "Flavored or fried tofu products can be high in sodium and oil."],
    allergies: "Soy is a major food allergen. Soy can reduce absorption of thyroid medicine (levothyroxine) — take your medicine about 4 hours apart from soy foods.",
    pregnancy: "Tofu is a good protein during pregnancy and breastfeeding as part of a varied diet. Food amounts of soy are considered fine; concentrated isoflavone supplements are not recommended.",
    sources: ["allergens"]
  },
  {
    id: "lentils", name: "Lentils", group: "legumes", cats: ["protein", "digestion", "heart", "energy", "women"], goals: ["heart", "blood-sugar", "digestion", "energy", "womens-cycle"], color: "#b8743a", art: "bowl", wiki: "Lentil",
    what: "Lentils are small, quick-cooking legumes that don't need soaking. They pack protein, fiber, folate and iron into an inexpensive pantry staple.",
    nutrients: ["9 g protein per ½ cup cooked (100 g)", "8 g fiber", "Folate (about 45% of daily needs)", "Iron", "Potassium"],
    benefits: [["R", "Heart health", "Eating beans and lentils regularly has been linked with lower LDL cholesterol in clinical trials."],
      ["R", "Steadier blood sugar", "Their fiber and protein slow digestion, so lentils raise blood sugar gently — helpful for people managing blood sugar."],
      ["P", "Gut health and regularity", "Lentil fiber feeds healthy gut bacteria and supports regular bowel movements."]],
    uses: ["Simmer into lentil soup with carrots, celery and cumin.", "Toss cooked lentils into salads and grain bowls.", "Make a lentil Bolognese or shepherd's pie.", "Blend red lentils into dal with turmeric and ginger."],
    serving: ["½ cup cooked", 100],
    when: "Lunch or dinner. Start with small portions if you're not used to fiber, and drink extra water.",
    who: ["People managing blood sugar", "Anyone supporting heart health", "Women who need folate and iron", "Vegetarians and families on a budget"],
    downsides: ["Can cause gas and bloating at first — increase gradually and rinse canned lentils.", "Plant (non-heme) iron is absorbed better with vitamin C foods."],
    allergies: "Lentil allergy is uncommon but can occur, sometimes alongside pea or chickpea allergy.",
    pregnancy: "An excellent pregnancy food for folate, iron, protein and fiber (which also helps with pregnancy constipation).",
    sources: ["dga"]
  },
  {
    id: "chickpeas", name: "Chickpeas", group: "legumes", cats: ["protein", "digestion", "heart", "energy"], goals: ["digestion", "blood-sugar", "heart", "energy"], color: "#d9b26a", art: "bowl", wiki: "Chickpea",
    what: "Chickpeas (garbanzo beans) are nutty, versatile legumes and the base of hummus. They provide plant protein, fiber and minerals.",
    nutrients: ["7 g protein per ½ cup cooked (82 g)", "6 g fiber", "Folate", "Iron", "Manganese"],
    benefits: [["R", "Fullness and blood sugar", "Chickpeas' fiber and protein slow digestion and have been studied for helping people feel full and keep blood sugar steadier."],
      ["P", "Heart health", "As part of a legume-rich diet, chickpeas may help lower LDL cholesterol."],
      ["P", "Digestive health", "Their fiber supports regularity and feeds beneficial gut bacteria."]],
    uses: ["Blend into hummus with tahini, lemon and garlic.", "Roast with olive oil and spices for a crunchy snack.", "Add to salads, soups and curries.", "Mash with Greek yogurt for a sandwich filling."],
    serving: ["½ cup cooked", 82],
    when: "Lunch, dinner or as a snack with vegetables.",
    who: ["People managing blood sugar or weight", "Vegetarians", "Anyone wanting more fiber"],
    downsides: ["May cause gas at first — rinse canned chickpeas and increase slowly.", "Store-bought hummus can be salty."],
    allergies: "Chickpea allergy is uncommon; some people allergic to peas or lentils also react to chickpeas.",
    pregnancy: "A great source of folate, fiber and protein during pregnancy.",
    sources: ["dga"]
  },
  {
    id: "black-beans", name: "Black Beans", group: "legumes", cats: ["protein", "digestion", "heart"], goals: ["digestion", "blood-sugar", "heart"], color: "#3a2f3a", art: "bowl", wiki: "Black turtle bean",
    what: "Black beans are a staple of Latin American cooking, rich in fiber, plant protein and deeply colored anthocyanin antioxidants.",
    nutrients: ["7.5 g protein per ½ cup cooked (86 g)", "7.5 g fiber", "Folate", "Magnesium", "Anthocyanins"],
    benefits: [["R", "Heart health", "Regular bean eaters tend to have lower LDL cholesterol, and bean fiber helps carry cholesterol out of the body."],
      ["R", "Blood sugar balance", "Beans digest slowly and have been studied for blunting the blood-sugar rise of a meal, especially when paired with rice."],
      ["P", "Gut health", "Their fiber and resistant starch feed beneficial gut bacteria."]],
    uses: ["Add to tacos, burritos and rice bowls.", "Make black bean soup with cumin and lime.", "Mash into bean burgers.", "Toss with corn, tomato and cilantro for a salsa salad."],
    serving: ["½ cup cooked", 86],
    when: "Lunch or dinner. Pairing beans with rice is a classic, balanced combination.",
    who: ["People managing blood sugar", "Anyone supporting heart health", "Budget-conscious families"],
    downsides: ["Can cause gas — soak dried beans, rinse canned ones and increase slowly."],
    allergies: "Bean allergies are uncommon.",
    pregnancy: "A great source of folate and fiber during pregnancy.",
    sources: ["dga"]
  },
  {
    id: "cottage-cheese", name: "Cottage Cheese", group: "dairy", cats: ["protein", "sleep"], goals: ["energy", "sleep"], color: "#f2eee4", art: "bowl", wiki: "Cottage cheese",
    what: "Cottage cheese is a fresh, mild cheese made of soft curds. It's very high in protein, mostly slow-digesting casein.",
    nutrients: ["About 12–14 g protein per ½ cup (113 g)", "Calcium", "Vitamin B12", "Selenium", "Casein protein"],
    benefits: [["R", "High-protein snack", "Cottage cheese packs a lot of protein for few calories, which may help with fullness and muscle maintenance."],
      ["P", "Overnight muscle repair", "Its casein protein digests slowly; a small bedtime serving has been studied for supporting overnight muscle repair in active people."],
      ["P", "Bone support", "Provides calcium and protein for bones."]],
    uses: ["Top with fruit and cinnamon.", "Blend into pancake batter or smoothies.", "Spread on toast with tomato and pepper.", "Stir into scrambled eggs for creaminess."],
    serving: ["½ cup", 113],
    when: "Breakfast, a snack, or a small serving in the evening.",
    who: ["Anyone wanting more protein", "Active people and older adults maintaining muscle"],
    downsides: ["Many brands are high in sodium — compare labels."],
    allergies: "Contains milk, a major allergen. Has some lactose.",
    pregnancy: "A good protein source during pregnancy — choose cottage cheese made from pasteurized milk.",
    sources: ["allergens", "pregnancy"]
  },
  {
    id: "kefir", name: "Kefir", group: "dairy", cats: ["digestion", "immunity", "protein"], goals: ["digestion", "immunity"], color: "#efe9dc", art: "bowl", wiki: "Kefir",
    what: "Kefir is a tangy, drinkable fermented milk made with kefir \"grains\" — a mix of bacteria and yeasts. It usually contains more types of microbes than yogurt.",
    nutrients: ["About 9 g protein per cup (240 ml)", "Calcium", "Many probiotic strains", "Vitamin B12", "Riboflavin"],
    benefits: [["P", "Gut health", "Kefir supplies a wide range of live microbes, and small studies suggest it may support digestion and a diverse gut microbiome."],
      ["P", "Easier on lactose", "The fermentation breaks down much of the lactose, and kefir has been studied for improving lactose digestion."],
      ["T", "Immune support", "Fermented milks have a long tradition of use for resilience; early studies suggest probiotics may modestly support immune health."]],
    uses: ["Drink plain or blend with berries.", "Use in overnight oats instead of milk.", "Make a tangy salad dressing with herbs.", "Use in pancakes and baking like buttermilk."],
    serving: ["1 cup (240 ml)", 240],
    when: "Morning or as a snack. Start with ½ cup if you're new to fermented foods.",
    who: ["People supporting gut health", "People with mild lactose intolerance", "Anyone looking for a probiotic food"],
    downsides: ["Flavored kefir often has added sugar.", "May cause temporary bloating when you first start."],
    allergies: "Contains milk, a major allergen. People with a weakened immune system should ask their doctor before using probiotic foods.",
    pregnancy: "Choose kefir made from pasteurized milk during pregnancy.",
    sources: ["probiotics", "allergens", "pregnancy"]
  },
  {
    id: "oats", name: "Oats", group: "grains", cats: ["digestion", "energy", "heart", "sleep"], goals: ["heart", "blood-sugar", "digestion", "energy", "skin"], color: "#d8c08a", art: "bowl", wiki: "Oatmeal",
    what: "Oats are a whole grain rich in beta-glucan, a soluble fiber that forms a gel in the gut. Rolled and steel-cut oats are less processed than instant oats.",
    nutrients: ["About 5 g protein per ½ cup dry (40 g)", "4 g fiber, including beta-glucan", "Manganese", "Magnesium", "Iron"],
    benefits: [["R", "Cholesterol", "About 3 g of oat beta-glucan a day (around 1½ cups of cooked oatmeal) has been shown to lower LDL cholesterol; the FDA allows a heart-health claim for it."],
      ["P", "Steady energy", "Oats digest slowly and may help keep blood sugar and energy steadier than refined cereals."],
      ["P", "Digestive comfort", "Oat fiber supports regularity and feeds healthy gut bacteria."]],
    uses: ["Make oatmeal topped with berries and nuts.", "Prepare overnight oats with yogurt or kefir.", "Blend into smoothies or grind into flour for baking.", "Use in a soothing oatmeal bath for itchy skin (colloidal oats)."],
    serving: ["½ cup dry (about 1 cup cooked)", 40],
    when: "Breakfast is classic. A small bowl in the evening is also a calming, filling snack.",
    who: ["Anyone supporting cholesterol and heart health", "People managing blood sugar", "Anyone needing more fiber"],
    downsides: ["Instant flavored packets can be high in sugar — choose plain oats.", "Add fiber gradually to avoid bloating."],
    allergies: "Oats are naturally gluten-free but are often contaminated with wheat. People with celiac disease should choose certified gluten-free oats.",
    pregnancy: "A great everyday grain during pregnancy and breastfeeding, providing fiber and iron.",
    sources: ["dga"]
  },
  {
    id: "quinoa", name: "Quinoa", group: "grains", cats: ["protein", "energy", "digestion"], goals: ["energy", "blood-sugar"], color: "#d6b98a", art: "bowl", wiki: "Quinoa",
    what: "Quinoa is a seed cooked like a grain. It's naturally gluten-free and one of the few plant foods with complete protein.",
    nutrients: ["8 g protein per cup cooked (185 g)", "5 g fiber", "Magnesium", "Iron", "Folate"],
    benefits: [["P", "Complete plant protein", "Quinoa contains all nine essential amino acids, making it a useful protein for vegetarians."],
      ["P", "Steady energy", "Its fiber and protein help it digest more slowly than white rice."],
      ["P", "Minerals", "A good source of magnesium and iron, which many people fall short on."]],
    uses: ["Use as a base for grain bowls.", "Toss with vegetables and lemon dressing for a salad.", "Cook as a warm breakfast porridge with fruit.", "Add to soups."],
    serving: ["1 cup cooked", 185],
    when: "Lunch or dinner, or as a breakfast porridge.",
    who: ["Vegetarians", "People with celiac disease or gluten sensitivity", "Active people"],
    downsides: ["Rinse before cooking to remove bitter saponins.", "Contains oxalates — people prone to kidney stones may need to limit it."],
    allergies: "Quinoa allergy is uncommon.",
    pregnancy: "A nourishing grain during pregnancy, providing folate, iron and protein.",
    sources: ["dga"]
  },
  {
    id: "spinach", name: "Spinach", group: "vegetables", cats: ["fruits-veg", "women", "sleep", "energy"], goals: ["energy", "womens-cycle", "sleep", "heart"], color: "#3f7a3a", art: "berry", wiki: "Spinach",
    what: "Spinach is a tender leafy green that cooks down quickly. It's rich in folate, vitamin K, magnesium and plant compounds such as lutein and nitrates.",
    nutrients: ["Vitamin K (very high)", "Folate", "Magnesium", "Iron (plant form)", "Vitamin A (beta-carotene)", "Lutein"],
    benefits: [["P", "Folate and iron", "Spinach provides folate and plant iron, which support healthy red blood cells — eat with vitamin C foods to help absorb the iron."],
      ["P", "Magnesium for relaxation", "Magnesium supports muscle and nerve relaxation and has been studied for sleep quality."],
      ["P", "Blood pressure and eyes", "Its natural nitrates may help relax blood vessels, and its lutein supports eye health."]],
    uses: ["Wilt into eggs, soups and pasta.", "Blend a handful into smoothies.", "Use raw in salads with strawberries and walnuts.", "Sauté with garlic and olive oil."],
    serving: ["1 cup raw or ½ cup cooked", 90],
    when: "Any meal. Add to breakfast eggs, lunch salads or dinner sides.",
    who: ["Women needing folate and iron", "Anyone eating more greens", "People supporting heart health"],
    downsides: ["High in oxalates, which may contribute to kidney stones in people prone to them.", "Wash well — leafy greens can carry germs."],
    allergies: "Very high in vitamin K: if you take warfarin, keep the amount of leafy greens you eat consistent from week to week and tell your doctor about big changes.",
    pregnancy: "An excellent folate source during pregnancy. Wash thoroughly.",
    sources: ["dga"]
  },
  {
    id: "kale", name: "Kale", group: "vegetables", cats: ["fruits-veg", "immunity", "anti-inflammatory"], goals: ["immunity", "heart", "skin"], color: "#2f5a3a", art: "berry", wiki: "Kale",
    what: "Kale is a hearty leafy green in the cabbage family, rich in vitamins K, A and C and in protective plant compounds.",
    nutrients: ["Vitamin K (very high)", "Vitamin C", "Vitamin A (beta-carotene)", "Calcium", "Glucosinolates"],
    benefits: [["P", "Immune support", "Kale is rich in vitamin C and vitamin A, both used by the immune system."],
      ["P", "Antioxidant protection", "Like other cabbage-family vegetables, kale contains glucosinolates that have been studied for supporting the body's natural detox enzymes."],
      ["P", "Bone health", "Provides vitamin K and calcium for bones."]],
    uses: ["Massage raw kale with lemon and olive oil for salads.", "Bake into kale chips.", "Add to soups and stews.", "Blend into green smoothies."],
    serving: ["1 cup raw or ½ cup cooked", 65],
    when: "Lunch or dinner.",
    who: ["Anyone supporting immunity", "People eating more greens"],
    downsides: ["Very large amounts of raw kale (in smoothies) contain goitrogens that may affect the thyroid in people with low iodine — cooking reduces them."],
    allergies: "Very high in vitamin K: keep intake consistent if you take warfarin.",
    pregnancy: "A healthy green during pregnancy; wash well.",
    sources: ["dga"]
  },
  {
    id: "broccoli", name: "Broccoli", group: "vegetables", cats: ["fruits-veg", "immunity", "anti-inflammatory", "digestion"], goals: ["immunity", "digestion", "heart"], color: "#4a7a34", art: "berry", wiki: "Broccoli",
    what: "Broccoli is a cruciferous vegetable rich in vitamin C, fiber and glucoraphanin, which becomes the studied compound sulforaphane when chopped or chewed.",
    nutrients: ["Vitamin C (about half a day's needs per ½ cup cooked)", "Vitamin K", "Folate", "Fiber", "Sulforaphane"],
    benefits: [["P", "Immune support", "Broccoli is one of the best vegetable sources of vitamin C."],
      ["P", "Natural detox support", "Sulforaphane has been studied for switching on the body's own antioxidant and detox enzymes."],
      ["P", "Digestive health", "Its fiber supports regularity and gut bacteria."]],
    uses: ["Roast with olive oil and garlic until crisp-edged.", "Steam lightly to keep more vitamin C.", "Chop and let sit 10 minutes before cooking to boost sulforaphane.", "Add to stir-fries, soups and pasta."],
    serving: ["½ cup cooked or 1 cup raw", 78],
    when: "Lunch or dinner.",
    who: ["Anyone supporting immunity", "People wanting more fiber and vegetables"],
    downsides: ["Can cause gas in some people."],
    allergies: "Contains vitamin K: keep intake steady if you take warfarin.",
    pregnancy: "A nourishing vegetable during pregnancy for folate and vitamin C.",
    sources: ["dga"]
  },
  {
    id: "sweet-potato", name: "Sweet Potato", group: "vegetables", cats: ["fruits-veg", "energy", "digestion"], goals: ["energy", "skin", "blood-sugar"], color: "#d46a2e", art: "long", wiki: "Sweet potato",
    what: "Sweet potatoes are orange-fleshed root vegetables loaded with beta-carotene, fiber and potassium.",
    nutrients: ["Beta-carotene (more than a day's vitamin A per medium potato)", "Fiber", "Potassium", "Vitamin C", "Vitamin B6"],
    benefits: [["P", "Skin and eye health", "Beta-carotene becomes vitamin A, which supports healthy skin, vision and immunity."],
      ["P", "Steady energy", "Eaten with the skin, sweet potatoes provide fiber-rich carbohydrates for longer-lasting energy."],
      ["P", "Blood pressure", "A good source of potassium, which helps balance sodium."]],
    uses: ["Bake whole and top with Greek yogurt and cinnamon.", "Roast cubes with olive oil and rosemary.", "Mash as a side.", "Add to chili or curry."],
    serving: ["1 medium (about 5 inches)", 114],
    when: "Lunch or dinner, or before exercise for energy.",
    who: ["Active people", "Anyone wanting more vitamin A and fiber"],
    downsides: ["Candied or fried sweet potatoes add sugar and fat."],
    allergies: "Allergy is rare. High in potassium — people on a kidney diet may need to limit it.",
    pregnancy: "A great source of vitamin A from food during pregnancy (food beta-carotene is safe; high-dose vitamin A supplements are not).",
    sources: ["dga"]
  },
  {
    id: "carrots", name: "Carrots", group: "vegetables", cats: ["fruits-veg", "immunity"], goals: ["skin", "immunity"], color: "#ec8a2a", art: "long", wiki: "Carrot",
    what: "Carrots are crunchy root vegetables famous for beta-carotene, which your body turns into vitamin A.",
    nutrients: ["Beta-carotene (vitamin A)", "Fiber", "Vitamin K", "Potassium"],
    benefits: [["P", "Eye health", "Vitamin A is essential for vision, especially in dim light."],
      ["P", "Skin and immunity", "Vitamin A supports healthy skin and the linings that help defend against germs."],
      ["P", "Digestion", "Raw carrots provide fiber that supports regularity."]],
    uses: ["Snack on raw carrot sticks with hummus.", "Roast with honey and thyme.", "Grate into salads or muffins.", "Simmer into soups and broths."],
    serving: ["½ cup chopped or 1 medium carrot", 64],
    when: "Any time — an easy snack between meals.",
    who: ["Anyone wanting an easy, crunchy vegetable snack", "Children (cut safely for age)"],
    downsides: ["Eating very large amounts can harmlessly turn the skin slightly orange."],
    allergies: "People with birch pollen allergy may feel mouth itching from raw carrots (oral allergy syndrome); cooking usually helps.",
    pregnancy: "A healthy source of food-based vitamin A during pregnancy.",
    sources: ["dga"]
  },
  {
    id: "beets", name: "Beets", group: "vegetables", cats: ["fruits-veg", "heart", "energy"], goals: ["heart", "energy"], color: "#8a1f45", art: "round", wiki: "Beetroot",
    what: "Beets are deep red root vegetables rich in natural nitrates, folate and betalain pigments.",
    nutrients: ["Dietary nitrates", "Folate", "Fiber", "Potassium", "Betalains"],
    benefits: [["R", "Blood pressure", "Beet juice nitrates are turned into nitric oxide, which helps relax blood vessels; trials found modest drops in blood pressure."],
      ["P", "Exercise stamina", "Beet juice taken 2–3 hours before exercise has been studied for improving endurance in some people."],
      ["P", "Antioxidant support", "Betalain pigments act as antioxidants."]],
    uses: ["Roast whole wrapped in foil, then peel and slice.", "Grate raw into salads.", "Blend a small piece into smoothies.", "Pair with goat cheese and walnuts."],
    serving: ["½ cup cooked", 85],
    when: "Lunch or dinner, or 2–3 hours before a workout.",
    who: ["People supporting healthy blood pressure", "Endurance athletes"],
    downsides: ["Can harmlessly turn urine and stools pink or red.", "High in oxalates — limit if you're prone to kidney stones."],
    allergies: "Allergy is rare.",
    pregnancy: "A healthy vegetable during pregnancy, providing folate.",
    sources: ["dga"]
  },
  {
    id: "sauerkraut", name: "Sauerkraut", group: "vegetables", cats: ["digestion", "fruits-veg", "immunity"], goals: ["digestion", "immunity"], color: "#d9cf8a", art: "bowl", wiki: "Sauerkraut",
    what: "Sauerkraut is finely shredded cabbage fermented with salt. Raw, refrigerated sauerkraut contains live microbes; shelf-stable jars are usually pasteurized and don't.",
    nutrients: ["Fiber", "Vitamin C", "Vitamin K", "Live microbes (if raw)", "Sodium"],
    benefits: [["P", "Gut health", "Fermented vegetables supply beneficial bacteria and have been studied for supporting a more diverse gut microbiome."],
      ["P", "Digestion", "A small forkful with meals is a traditional digestive aid."],
      ["T", "Immune support", "Fermented cabbage has a long tradition as a winter food for health."]],
    uses: ["Add a forkful to sandwiches, salads and grain bowls.", "Serve beside eggs or roasted meats.", "Make your own with cabbage and salt in a jar."],
    serving: ["2 tablespoons to ¼ cup", 35],
    when: "With meals. Start with a small forkful if you're new to fermented foods.",
    who: ["People supporting gut health", "Anyone wanting more fermented foods"],
    downsides: ["High in sodium — use small portions if you watch your salt.", "May cause gas or bloating at first."],
    allergies: "Fermented foods contain tyramine — avoid with MAOI antidepressants. People with histamine intolerance may react. Ask your doctor before eating raw fermented foods if your immune system is weakened.",
    pregnancy: "Generally considered fine as a food during pregnancy; mind the sodium.",
    sources: ["probiotics"]
  },
  {
    id: "almonds", name: "Almonds", group: "nuts", cats: ["healthy-fats", "heart", "protein", "sleep"], goals: ["heart", "blood-sugar", "skin", "sleep"], color: "#b07a4a", art: "bowl", wiki: "Almond",
    what: "Almonds are nutrient-dense tree nuts rich in vitamin E, magnesium, fiber and heart-healthy fats.",
    nutrients: ["6 g protein per 1 oz (about 23 almonds)", "Vitamin E (about half a day's needs)", "Magnesium", "Fiber", "Monounsaturated fat"],
    benefits: [["R", "Heart health", "Eating nuts regularly is linked with lower heart disease risk, and almond studies show modest drops in LDL cholesterol."],
      ["P", "Blood sugar", "Eating almonds with a carbohydrate food has been studied for blunting the blood-sugar rise."],
      ["P", "Skin protection", "Vitamin E is an antioxidant that helps protect skin cells."]],
    uses: ["Snack on a small handful.", "Add slivered almonds to oatmeal, salads and yogurt.", "Spread almond butter on apple slices.", "Use almond flour in baking."],
    serving: ["1 oz (a small handful)", 28],
    when: "As a snack between meals, or a small handful in the evening for magnesium.",
    who: ["Anyone supporting heart health", "People managing blood sugar", "Anyone wanting a satisfying snack"],
    downsides: ["Calorie-dense — a small handful is a serving.", "Choose unsalted or lightly salted."],
    allergies: "Tree nuts are a major allergen and can cause severe reactions. Whole nuts are a choking hazard for children under 4.",
    pregnancy: "A healthy snack during pregnancy unless you are allergic.",
    sources: ["allergens"]
  },
  {
    id: "walnuts", name: "Walnuts", group: "nuts", cats: ["healthy-fats", "heart", "anti-inflammatory", "sleep"], goals: ["heart", "memory", "sleep"], color: "#9a6a3a", art: "bowl", wiki: "Walnut",
    what: "Walnuts are the tree nut richest in ALA, the plant form of omega-3 fat, along with polyphenol antioxidants.",
    nutrients: ["Omega-3 ALA (about 2.5 g per oz)", "4 g protein", "Polyphenols", "Magnesium", "Melatonin (small amounts)"],
    benefits: [["R", "Heart health", "Walnut-rich diets have been shown to lower LDL cholesterol in clinical trials."],
      ["P", "Brain health", "Walnuts have been studied for supporting memory and thinking as part of a Mediterranean-style diet."],
      ["P", "Calmer inflammation", "Their ALA and polyphenols may help lower inflammation markers."]],
    uses: ["Sprinkle on oatmeal, salads and yogurt.", "Toast and add to roasted vegetables.", "Blend into pesto.", "Snack with dried fruit."],
    serving: ["1 oz (about 14 halves)", 28],
    when: "Any time; a small handful in the evening is a gentle, sleep-friendly snack.",
    who: ["Anyone supporting heart and brain health", "Vegetarians wanting plant omega-3s"],
    downsides: ["Calorie-dense — keep to a small handful.", "Store in the fridge so the oils don't go rancid."],
    allergies: "Tree nuts are a major allergen. Whole nuts are a choking hazard for young children.",
    pregnancy: "A healthy snack during pregnancy unless allergic.",
    sources: ["allergens"]
  },
  {
    id: "chia-seeds", name: "Chia Seeds", group: "nuts", cats: ["digestion", "healthy-fats", "heart"], goals: ["digestion", "heart", "blood-sugar"], color: "#5a5a5a", art: "bowl", wiki: "Chia seed",
    what: "Chia seeds are tiny seeds that soak up liquid and form a gel. They're one of the richest plant sources of fiber and omega-3 ALA.",
    nutrients: ["About 10 g fiber per 1 oz (2 tbsp)", "Omega-3 ALA", "Calcium", "Magnesium", "4–5 g protein"],
    benefits: [["P", "Regularity", "Chia's soluble fiber forms a gel that supports regular, comfortable bowel movements."],
      ["P", "Fullness and blood sugar", "The gel slows digestion and has been studied for reducing blood-sugar spikes after meals."],
      ["P", "Heart health", "Provides plant omega-3s and fiber that support heart health."]],
    uses: ["Make chia pudding: 2 tbsp chia + ½ cup milk, chill overnight.", "Stir into oatmeal or yogurt.", "Blend into smoothies.", "Use \"chia eggs\" (1 tbsp chia + 3 tbsp water) in baking."],
    serving: ["1–2 tablespoons", 15],
    when: "Breakfast or a snack. Drink plenty of water with chia.",
    who: ["People wanting more fiber", "People managing blood sugar", "Vegetarians wanting plant omega-3s"],
    downsides: ["Always soak or mix with liquid — dry chia seeds can swell in the throat.", "Increase slowly to avoid bloating."],
    allergies: "Allergy is rare. May slightly lower blood pressure and blood sugar — use normal food amounts if you take medicines for these.",
    pregnancy: "Generally fine in food amounts during pregnancy and helpful for constipation.",
    sources: ["dga"]
  },
  {
    id: "flaxseed", name: "Ground Flaxseed", group: "nuts", cats: ["digestion", "healthy-fats", "heart", "women"], goals: ["digestion", "heart", "menopause"], color: "#a8783a", art: "bowl", wiki: "Flax",
    what: "Flaxseeds are small seeds rich in fiber, omega-3 ALA and lignans. Grind them first — whole seeds often pass through undigested.",
    nutrients: ["Omega-3 ALA (about 1.6 g per tbsp)", "Fiber (about 2 g per tbsp)", "Lignans", "Magnesium"],
    benefits: [["P", "Regularity", "Ground flaxseed has been studied for relieving constipation thanks to its fiber."],
      ["P", "Heart and blood pressure", "Trials found daily ground flaxseed modestly lowered blood pressure and LDL cholesterol in some people."],
      ["P", "Menopause", "Flax lignans are plant compounds studied for hot flashes, with mixed results."]],
    uses: ["Stir 1–2 tablespoons into oatmeal, yogurt or smoothies.", "Mix into muffins and pancakes.", "Use as a \"flax egg\" (1 tbsp + 3 tbsp water)."],
    serving: ["1–2 tablespoons ground", 10],
    when: "Breakfast or with meals. Take medicines 1–2 hours apart from flaxseed, as fiber can slow their absorption.",
    who: ["People with constipation", "Anyone supporting heart health", "Women in menopause"],
    downsides: ["Drink extra water — too much fiber without fluid can worsen constipation.", "Store ground flax in the fridge."],
    allergies: "Allergy is uncommon. Large amounts may add to bleeding risk with blood thinners and may lower blood sugar. People with hormone-sensitive conditions should ask their doctor.",
    pregnancy: "Small food amounts are likely fine; avoid large amounts and flaxseed supplements during pregnancy and breastfeeding, as safety hasn't been well studied.",
    sources: ["flax"]
  },
  {
    id: "pumpkin-seeds", name: "Pumpkin Seeds", group: "nuts", cats: ["sleep", "immunity", "protein", "healthy-fats"], goals: ["sleep", "mens-health", "immunity"], color: "#5a7a3a", art: "bowl", wiki: "Pumpkin seed",
    what: "Pumpkin seeds (pepitas) are green, hulled seeds that are one of the best food sources of magnesium and zinc.",
    nutrients: ["Magnesium (over a third of daily needs per oz)", "Zinc", "About 8 g protein per oz", "Iron", "Tryptophan"],
    benefits: [["P", "Magnesium for sleep and relaxation", "Magnesium supports muscle and nerve relaxation; low magnesium has been linked with poorer sleep."],
      ["P", "Zinc for immunity and men's health", "Zinc supports immune cells and normal testosterone production."],
      ["P", "Prostate health", "Pumpkin seed products have been studied for easing urinary symptoms of an enlarged prostate."]],
    uses: ["Sprinkle on salads, soups and oatmeal.", "Roast with a pinch of salt and spices.", "Add to trail mix.", "Blend into pesto."],
    serving: ["1 oz (about ¼ cup)", 28],
    when: "A small handful in the evening or as an afternoon snack.",
    who: ["Men supporting zinc intake", "People with poor sleep or muscle cramps", "Vegetarians"],
    downsides: ["Calorie-dense; choose unsalted."],
    allergies: "Seed allergies are uncommon but possible.",
    pregnancy: "A healthy snack during pregnancy, providing iron, zinc and magnesium.",
    sources: ["dga"]
  },
  {
    id: "olive-oil", name: "Extra Virgin Olive Oil", group: "fats", cats: ["healthy-fats", "heart", "anti-inflammatory"], goals: ["heart", "joints", "memory", "skin"], color: "#9aa83a", art: "bowl", wiki: "Olive oil",
    what: "Extra virgin olive oil is cold-pressed from olives without chemicals or heat. It's the main fat of the Mediterranean diet and rich in monounsaturated fat and polyphenols.",
    nutrients: ["Monounsaturated fat (oleic acid)", "Polyphenols (oleocanthal, hydroxytyrosol)", "Vitamin E", "Vitamin K"],
    benefits: [["R", "Heart health", "In the large PREDIMED trial, a Mediterranean diet with extra virgin olive oil was linked with fewer heart attacks and strokes than a low-fat diet."],
      ["P", "Calmer inflammation", "Oleocanthal has an anti-inflammatory action in the lab similar in kind to ibuprofen, though much milder."],
      ["P", "Better nutrient absorption", "Cooking vegetables in olive oil helps your body absorb their fat-soluble vitamins and carotenoids."]],
    uses: ["Drizzle over salads, vegetables and soups.", "Sauté vegetables over medium heat.", "Mix with lemon and herbs for dressings.", "Use instead of butter on bread."],
    serving: ["1–2 tablespoons", 14],
    when: "With meals throughout the day, in place of butter and other fats.",
    who: ["Anyone supporting heart health", "People following a Mediterranean-style diet"],
    downsides: ["Calorie-dense (about 120 calories per tablespoon).", "Store away from light and heat to keep it fresh."],
    allergies: "Olive oil allergy is very rare.",
    pregnancy: "A healthy fat during pregnancy and breastfeeding.",
    sources: ["dga"]
  },
  {
    id: "honey", name: "Raw Honey", group: "pantry", cats: ["immunity"], goals: ["cold-flu", "immunity"], color: "#e0a02a", art: "bowl", wiki: "Honey",
    what: "Honey is the natural sweetener bees make from flower nectar. Raw honey is minimally processed. It's still a sugar, so a little goes a long way.",
    nutrients: ["About 17 g natural sugars per tablespoon", "Small amounts of antioxidants", "Enzymes (in raw honey)"],
    benefits: [["R", "Cough relief", "Reviews of studies found honey may ease cough symptoms in children over 1 year and adults about as well as some over-the-counter cough medicines."],
      ["P", "Soothing a sore throat", "Honey coats the throat, and warm water with honey and lemon is a classic comfort when unwell."],
      ["P", "Wound care (medical honey)", "Medical-grade honey is used in some wound dressings — kitchen honey should not be used on wounds."]],
    uses: ["Stir into warm water or tea with lemon.", "Drizzle on yogurt or oatmeal.", "Take 1–2 teaspoons at bedtime for a cough (ages 1 and up).", "Use in salad dressings."],
    serving: ["1–2 teaspoons", 10],
    when: "As needed; a spoonful at bedtime has been studied for nighttime coughs.",
    who: ["People with a cough or sore throat (ages 1 and up)", "Anyone replacing refined sugar in small amounts"],
    downsides: ["Still a sugar — count it if you manage blood sugar or weight.", "Can contribute to tooth decay."],
    allergies: "Never give honey to babies under 1 year — it can cause infant botulism. People with pollen or bee allergies may rarely react.",
    pregnancy: "Honey is considered safe for pregnant and breastfeeding adults.",
    sources: ["botulism"]
  },
  {
    id: "dark-chocolate", name: "Dark Chocolate", group: "pantry", cats: ["heart"], goals: ["heart", "stress"], color: "#4a2a1f", art: "bowl", wiki: "Dark chocolate",
    what: "Dark chocolate with 70% or more cocoa contains cocoa flavanols, minerals and less sugar than milk chocolate.",
    nutrients: ["Cocoa flavanols", "Iron", "Magnesium", "Fiber", "Caffeine & theobromine (small amounts)"],
    benefits: [["P", "Heart and blood flow", "Cocoa flavanols have been studied for helping blood vessels relax and modestly lowering blood pressure."],
      ["P", "Mood", "A small piece of dark chocolate may lift mood, possibly through its flavanols and the pleasure of a mindful treat."],
      ["P", "Minerals", "Dark chocolate provides magnesium and iron."]],
    uses: ["Enjoy 1–2 squares slowly as a treat.", "Melt over strawberries.", "Add cocoa powder to oatmeal or smoothies."],
    serving: ["1 oz (2–3 squares)", 28],
    when: "Earlier in the day if you're sensitive to caffeine.",
    who: ["Anyone wanting a more nourishing treat"],
    downsides: ["Still high in calories and fat.", "Testing has found lead and cadmium in some dark chocolates — enjoy it as an occasional treat and vary brands.", "May trigger heartburn or migraines in some people."],
    allergies: "Contains caffeine. Many chocolates contain milk, soy or nuts — check labels.",
    pregnancy: "Fine in small amounts; count its caffeine toward the 200 mg daily limit during pregnancy.",
    sources: ["pregnancy"]
  },
  {
    id: "bone-broth", name: "Bone Broth", group: "pantry", cats: ["immunity", "protein"], goals: ["cold-flu", "joints", "skin"], color: "#c99a5a", art: "bowl", wiki: "Broth",
    what: "Bone broth is made by simmering bones with vegetables and herbs for many hours. It's rich in gelatin and is a comforting, hydrating drink when unwell.",
    nutrients: ["Protein (amount varies)", "Gelatin & collagen", "Sodium & potassium (electrolytes)", "Glycine"],
    benefits: [["P", "Comfort and hydration when unwell", "Warm broths help with fluids and may ease congestion. A lab study suggested chicken soup may calm the movement of inflammatory white blood cells."],
      ["T", "Joints, skin and gut", "Bone broth is a traditional food for joints, skin and the gut. Its collagen is broken down during digestion, and research on broth itself is limited."],
      ["T", "Gentle nourishment", "Easy to digest when appetite is low."]],
    uses: ["Sip warm from a mug.", "Use as the base for soups, stews and grains.", "Simmer chicken or beef bones with carrots, onion, celery and herbs for 8–24 hours."],
    serving: ["1 cup (240 ml)", 240],
    when: "Any time; especially comforting when you're sick or the weather is cold.",
    who: ["People recovering from a cold or flu", "Anyone with a low appetite"],
    downsides: ["Store-bought broth can be very high in sodium — choose low-sodium."],
    allergies: "People with histamine intolerance may react to long-simmered broths.",
    pregnancy: "Fine during pregnancy when made and stored safely; bring to a boil before drinking.",
    sources: ["temps"]
  }
];

/* ---------- Shared helpers (used by the browser pages and scripts/build.js) ---------- */

const findFood = (id) => FOODS.find((f) => f.id === id);

// Food-category membership for any food or fruit.
function foodCatsOf(item, kind) {
  if (kind === "food") return item.cats;
  const cats = ["fruits-veg", ...new Set(item.cats.map((c) => FRUIT_FOOD_CATS[c]).filter(Boolean))];
  if (FRUIT_HEALTHY_FATS.includes(item.id)) cats.push("healthy-fats");
  return cats;
}

// Reference links for a food page: USDA data, matching nutrient fact sheets, then any extras.
function foodSourcesFor(nutrients, extra = []) {
  const out = [FOOD_SOURCES.fdc];
  const text = nutrients.join(" ");
  ODS_SHEETS.filter(([re]) => re.test(text)).slice(0, 4).forEach(([, slug, label]) =>
    out.push([`NIH Office of Dietary Supplements — ${label} fact sheet`, `https://ods.od.nih.gov/factsheets/${slug}-Consumer/`]));
  extra.forEach((k) => FOOD_SOURCES[k] && out.push(FOOD_SOURCES[k]));
  if (!extra.includes("dga")) out.push(FOOD_SOURCES.dga);
  return out;
}

// One shape for every food and fruit page. ix = the INTERACTIONS list (passed in so this works in Node too).
const WHO_FOR_CAT = {
  protein: "People wanting more protein to stay full and maintain muscle", "anti-inflammatory": "Anyone eating to support joint comfort and calmer inflammation",
  digestion: "People supporting digestion and regularity", energy: "Anyone wanting steadier energy", sleep: "People working on restful sleep",
  immunity: "Anyone supporting their immune system, especially in cold season", heart: "People supporting heart health and blood pressure",
  women: "Women at any life stage", "healthy-fats": "Anyone adding healthy fats to their plate", "fruits-veg": "Anyone working toward more fruits and vegetables each day"
};
function foodProfile(item, kind, ix) {
  if (kind === "food") {
    return { ...item, kind, key: "food:" + item.id, sub: FOOD_GROUPS[item.group], foodCats: item.cats, refs: foodSourcesFor(item.nutrients, item.sources), pick: null };
  }
  const key = "fruit:" + item.id;
  const foodCats = foodCatsOf(item, "fruit");
  const flagged = (id) => ix.find((x) => x.id === id);
  const preg = ["pregnancy", "breastfeeding"].map((id) => { const e = flagged(id); const n = e && (e.avoid[key] || e.caution[key]); return n ? `${e.label}: ${n}` : ""; }).filter(Boolean);
  const when = item.cats.includes("sleep") ? "An evening snack about an hour before bed may suit it best."
    : item.cats.includes("energy") ? "Morning, or as a snack before activity, for natural energy."
    : item.cats.includes("digestion") ? "With or after meals, or as a between-meal snack."
    : "Any time of day — with breakfast, as a snack or as a naturally sweet dessert.";
  return {
    ...item, kind, key, sub: item.latin, foodCats,
    what: `${item.name} is a fruit from the ${item.family.replace(/\s*\(.*\)/, "")} family (${item.family.match(/\((.*)\)/)?.[1] || "plant family"}), known botanically as ${item.latin}. In season: ${item.season.toLowerCase()}.`,
    when,
    who: foodCats.slice(0, 4).map((c) => WHO_FOR_CAT[c]),
    downsides: [item.caution],
    allergies: "",
    pregnancy: preg.length ? preg.join(" ") : "As a food, it is generally considered fine during pregnancy and breastfeeding as part of a varied diet. Wash well before eating.",
    refs: foodSourcesFor(item.nutrients, ["pregnancy"])
  };
}
