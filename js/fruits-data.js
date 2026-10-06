// The Beauty & Praise fruit library.
// F(id, name, latin, family, shape, color, season, cats, summary, nutrients, benefits, uses, serving, pick, caution)
//   shape:    drawing style for the fallback illustration (round, citrus, long, berry, melon, spiky, pear)
//   cats:     keys from CATEGORIES (shared with the herbs)
//   benefits: [evidence, title, explanation] — evidence uses the same R / P / T labels as the herbs
//   serving:  [typical serving, grams]

const FRUITS = [];
function F(id, name, latin, family, shape, color, season, cats, summary, nutrients, benefits, uses, serving, pick, caution) {
  FRUITS.push({ id, name, latin, family, shape, color, season, cats, summary, nutrients, benefits, uses, serving, pick, caution });
}

F("apple", "Apple", "Malus domestica", "Rosaceae (rose family)", "round", "#c8283a", "Late summer to winter", ["heart", "digestion", "kitchen"],
  "Apples are one of the world's most loved fruits and a simple daily habit for good health. Their soluble fiber, pectin, feeds healthy gut bacteria and helps lower LDL cholesterol. The skin is packed with quercetin and other polyphenols that protect the heart and blood vessels. People who eat apples regularly tend to have a lower risk of heart disease and type 2 diabetes. Crisp, portable and filling, an apple is one of the easiest healthy snacks there is.",
  ["Fiber (pectin)", "Vitamin C", "Quercetin", "Potassium"],
  [["P", "Heart health", "Pectin binds cholesterol in the gut, and apple polyphenols help blood vessels relax. Studies found eating two apples a day modestly lowered cholesterol."], ["P", "Gut health", "Apple pectin is a prebiotic that feeds beneficial bacteria, which produce compounds that nourish the gut lining."], ["P", "Blood sugar", "Apple fiber and polyphenols slow the absorption of sugar, and regular apple eaters have a lower risk of type 2 diabetes in large studies."]],
  ["Eat whole with the skin for the most fiber and antioxidants.", "Slice with peanut butter or cheese for a balanced snack.", "Bake with cinnamon for a warm, naturally sweet dessert.", "Grate into oatmeal, salads or slaws."],
  ["1 medium apple", 180], "Choose firm apples with no soft spots. Store in the fridge crisper drawer, where they keep for weeks, away from leafy greens.",
  "Apple seeds contain amygdalin, which releases cyanide when crushed — avoid chewing large amounts of seeds. Some people with birch pollen allergy feel itching in the mouth from raw apples.");

F("apricot", "Apricot", "Prunus armeniaca", "Rosaceae (rose family)", "round", "#f0a23a", "Early summer", ["skin", "digestion", "kitchen"],
  "Apricots are small golden fruits rich in beta-carotene, which the body turns into vitamin A. Vitamin A supports healthy skin, vision and immune defenses. Apricots also provide fiber and potassium for digestion and heart health. Dried apricots are a convenient source of iron and fiber. Their sweet-tart flavor makes them perfect fresh, dried or baked.",
  ["Beta-carotene (vitamin A)", "Vitamin C", "Fiber", "Potassium"],
  [["P", "Eye and skin health", "Beta-carotene and lutein help protect the eyes and skin from damage by light and free radicals."], ["T", "Regularity", "Fresh and dried apricots provide fiber that helps keep digestion moving."], ["P", "Antioxidant protection", "Apricots contain chlorogenic acid and catechins that help protect cells."]],
  ["Eat fresh, skin and all.", "Chop dried apricots into oatmeal or trail mix.", "Grill or roast halves with honey.", "Add to tagines and grain salads."],
  ["2 fresh apricots", 70], "Choose fragrant, orange fruit that gives slightly to pressure. Ripen at room temperature, then refrigerate for up to 5 days.",
  "Do not eat the kernels inside the pit — they contain amygdalin, which can cause cyanide poisoning. Dried apricots are often treated with sulfites, which can trigger asthma in sensitive people.");

F("avocado", "Avocado", "Persea americana", "Lauraceae (laurel family)", "pear", "#4f7a2e", "Year-round", ["heart", "skin", "kitchen"],
  "Avocado is a creamy fruit packed with heart-healthy monounsaturated fats. These fats help lower LDL cholesterol and help the body absorb fat-soluble vitamins from other foods. Avocados are rich in fiber, potassium and folate. Their lutein supports eye health, and their healthy fats nourish the skin. Avocado keeps you full and satisfied, making it a smart addition to meals.",
  ["Monounsaturated fat (oleic acid)", "Fiber", "Potassium", "Folate", "Vitamin K"],
  [["R", "Heart health", "Replacing saturated fats with avocado's oleic acid lowers LDL cholesterol, as shown in controlled feeding studies."], ["P", "Better nutrient absorption", "Adding avocado to a salad increased absorption of carotenoids from the vegetables several times over."], ["P", "Fullness", "Its fat and fiber slow digestion, helping you feel satisfied longer after meals."]],
  ["Mash on toast with lemon and salt.", "Slice into salads and grain bowls.", "Blend into smoothies for creaminess.", "Make guacamole with lime, onion and cilantro."],
  ["⅓ medium avocado", 50], "Ripe avocados yield to gentle pressure. Ripen on the counter (faster in a paper bag), then refrigerate. Squeeze lemon on cut halves to slow browning.",
  "Avocados are high in calories, so watch portions if managing weight. People with latex allergy may react to avocado.");

F("banana", "Banana", "Musa acuminata", "Musaceae (banana family)", "long", "#f2d23c", "Year-round", ["energy", "heart", "digestion"],
  "Bananas are a convenient source of quick, natural energy. They are famous for potassium, which supports healthy blood pressure and muscle function. Slightly green bananas contain resistant starch that feeds good gut bacteria. Bananas are gentle on the stomach and a classic food during upset digestion. Naturally sweet and portable, they're perfect before exercise.",
  ["Potassium", "Vitamin B6", "Vitamin C", "Fiber", "Resistant starch (when green)"],
  [["R", "Blood pressure", "Potassium helps the kidneys remove sodium and relaxes blood vessel walls, which lowers blood pressure."], ["P", "Exercise fuel", "In a study of cyclists, bananas fueled performance as well as a sports drink."], ["P", "Gut health", "The resistant starch in greener bananas acts as a prebiotic and supports regularity."]],
  ["Eat as a quick snack before or after exercise.", "Slice onto oatmeal or yogurt.", "Freeze and blend into creamy 'nice cream.'", "Mash into pancakes or banana bread to replace some sugar."],
  ["1 medium banana", 118], "Buy slightly green for later and yellow for now. Keep at room temperature; once ripe, the fridge slows ripening (the peel darkens but the fruit stays fine).",
  "People with kidney disease or on potassium-sparing medicines may need to limit high-potassium foods. Very ripe bananas raise blood sugar faster than greener ones.");

F("blackberry", "Blackberry", "Rubus fruticosus", "Rosaceae (rose family)", "berry", "#3a1f45", "Summer", ["immunity", "digestion", "skin"],
  "Blackberries are juicy, deep purple berries bursting with antioxidants. Their dark color comes from anthocyanins, which help protect cells and blood vessels. They are one of the highest-fiber fruits, supporting digestion and steady blood sugar. Blackberries are also rich in vitamin C and vitamin K. Low in sugar, they're a delicious way to boost nutrition.",
  ["Fiber", "Vitamin C", "Vitamin K", "Manganese", "Anthocyanins"],
  [["P", "Antioxidant protection", "Anthocyanins and ellagic acid neutralize free radicals and calm inflammation."], ["P", "Digestion", "About 8 g of fiber per cup supports regularity and a healthy gut."], ["T", "Gum and mouth health", "Blackberry leaf tea has long been used as a gargle for mouth sores."]],
  ["Eat fresh by the handful.", "Top yogurt, oatmeal or cereal.", "Blend into smoothies.", "Simmer into a quick no-added-sugar compote."],
  ["1 cup", 144], "Choose plump, glossy, fully black berries. Refrigerate unwashed and eat within 2–3 days; rinse just before eating.",
  "Generally very safe. Rinse well and remove any moldy berries.");

F("blackcurrant", "Blackcurrant", "Ribes nigrum", "Grossulariaceae (currant family)", "berry", "#2a1a33", "Summer", ["immunity", "heart"],
  "Blackcurrants are tart little berries with extraordinary amounts of vitamin C. Just a handful provides more than a day's worth. They are rich in anthocyanins that support circulation and eye comfort. Blackcurrant seed oil contains GLA, an anti-inflammatory fat. Their bold flavor shines in jams, cordials and baking.",
  ["Vitamin C (very high)", "Anthocyanins", "Fiber", "Potassium"],
  [["P", "Immune support", "Their exceptional vitamin C content supports immune cell function."], ["P", "Circulation and eyes", "Blackcurrant anthocyanins improved blood flow and reduced eye fatigue from screen work in small studies."], ["P", "Exercise recovery", "Blackcurrant extract improved recovery and performance in some sports studies."]],
  ["Cook into jam or a lightly sweetened compote.", "Add to smoothies.", "Bake into crumbles with apples.", "Make a cordial to mix with sparkling water."],
  ["½ cup", 56], "Choose firm, shiny, dark berries. Refrigerate and use within a few days, or freeze.",
  "Very tart raw — usually sweetened. Blackcurrant products may slow blood clotting slightly in large amounts.");

F("blueberry", "Blueberry", "Vaccinium corymbosum", "Ericaceae (heath family)", "berry", "#3b4a8c", "Summer", ["heart", "energy", "immunity"],
  "Blueberries are one of the most researched berries for brain and heart health. Their anthocyanins protect blood vessels and may support memory as we age. Studies link regular blueberry eating with healthier blood pressure and better insulin sensitivity. They are low in calories yet rich in fiber, vitamin C and vitamin K. Fresh or frozen, they are an easy daily superfood.",
  ["Anthocyanins", "Vitamin C", "Vitamin K", "Fiber", "Manganese"],
  [["P", "Brain and memory", "Trials in older adults found daily blueberries improved some measures of memory and thinking."], ["R", "Heart and blood vessels", "In a 6-month trial, one cup a day improved blood vessel function and cholesterol in people with metabolic syndrome."], ["P", "Blood sugar", "Blueberry anthocyanins improved insulin sensitivity in small trials."]],
  ["Add to oatmeal, yogurt or cereal.", "Blend frozen blueberries into smoothies.", "Bake into muffins or pancakes.", "Eat a handful as a snack."],
  ["1 cup", 148], "Choose firm, dusty-blue berries. Refrigerate unwashed for up to a week. Frozen blueberries are just as nutritious.",
  "Very safe. Large amounts may affect blood sugar medication slightly.");

F("cantaloupe", "Cantaloupe", "Cucumis melo var. cantalupensis", "Cucurbitaceae (gourd family)", "melon", "#f1a35e", "Summer", ["skin", "immunity", "energy"],
  "Cantaloupe is a sweet, juicy melon that is about 90% water, making it wonderfully hydrating. Its orange flesh is rich in beta-carotene for healthy eyes, skin and immunity. It also provides vitamin C and potassium. Low in calories and naturally sweet, it is a refreshing summer treat. It makes a perfect breakfast fruit or post-exercise snack.",
  ["Beta-carotene (vitamin A)", "Vitamin C", "Potassium", "Water"],
  [["P", "Hydration", "Its high water and potassium content helps replenish fluids and electrolytes."], ["P", "Eye and skin health", "Beta-carotene supports vision and protects skin from sun damage."], ["T", "Immunity", "One cup supplies most of a day's vitamin C."]],
  ["Eat chilled slices for breakfast.", "Wrap with prosciutto or pair with feta and mint.", "Blend into a cold melon soup or smoothie.", "Add to fruit salads."],
  ["1 cup cubes", 160], "A ripe cantaloupe smells sweet at the stem end and feels heavy. Store whole at room temperature until ripe, then refrigerate cut melon for 3–5 days.",
  "Scrub the rind before cutting — bacteria on the netted rind can be carried into the flesh. Refrigerate cut melon promptly.");

F("cherry", "Sweet Cherry", "Prunus avium", "Rosaceae (rose family)", "berry", "#8a0e22", "Early summer", ["sleep", "aches", "heart"],
  "Sweet cherries are juicy summer fruits rich in antioxidants. Their deep red color comes from anthocyanins that calm inflammation. Cherries contain small amounts of natural melatonin, the hormone that regulates sleep. They provide vitamin C, potassium and fiber. Studies suggest cherries may lower uric acid and reduce gout flare-ups.",
  ["Anthocyanins", "Vitamin C", "Potassium", "Melatonin", "Fiber"],
  [["P", "Gout and joints", "A large study found people who ate cherries had about 35% fewer gout attacks."], ["P", "Inflammation", "Eating sweet cherries lowered markers of inflammation in healthy adults."], ["P", "Sleep", "Cherries contain melatonin and tryptophan, which help regulate sleep."]],
  ["Eat fresh as a snack.", "Pit and add to salads or yogurt.", "Bake into clafoutis or pies.", "Freeze for smoothies."],
  ["1 cup (about 20 cherries)", 138], "Choose firm, shiny cherries with green stems. Refrigerate unwashed and eat within a week.",
  "Do not crush or eat the pits, which contain amygdalin. Watch for choking in young children — always pit for them.");

F("tart-cherry", "Tart Cherry", "Prunus cerasus", "Rosaceae (rose family)", "berry", "#b0122c", "Summer", ["sleep", "aches"],
  "Tart cherries are sour cherries well studied for sleep and muscle recovery. They contain more natural melatonin than sweet cherries. Their anthocyanins strongly calm inflammation. Tart cherry juice has helped athletes recover faster and reduced muscle soreness. It may also lower uric acid levels involved in gout.",
  ["Anthocyanins", "Melatonin", "Vitamin A", "Vitamin C"],
  [["P", "Better sleep", "In small trials, drinking tart cherry juice twice a day increased sleep time and efficiency."], ["R", "Muscle recovery", "Several studies found tart cherry juice reduced muscle soreness and strength loss after hard exercise."], ["P", "Gout", "Tart cherry concentrate lowered uric acid in small studies."]],
  ["Drink 1 cup (240 ml) of unsweetened juice twice a day.", "Add dried tart cherries to salads and granola.", "Bake into pies and crumbles.", "Stir concentrate into sparkling water."],
  ["1 cup juice or ½ cup dried", 240], "Fresh tart cherries are rarely sold — look for frozen, dried, or 100% juice without added sugar.",
  "Juice is high in natural sugar — choose unsweetened and watch portions if you have diabetes.");

F("coconut", "Coconut", "Cocos nucifera", "Arecaceae (palm family)", "round", "#7a4e2d", "Year-round", ["energy", "skin", "kitchen"],
  "Coconut gives us water, meat, milk and oil, all used around the tropics. Coconut water is naturally rich in potassium and helps with hydration. The meat is high in fiber and contains medium-chain fats that the body burns quickly for energy. Coconut oil is a soothing moisturizer for skin and hair. It is rich and satisfying, so a little goes a long way.",
  ["Fiber", "Manganese", "Copper", "Potassium (water)", "Medium-chain fats"],
  [["P", "Hydration", "Coconut water rehydrated people after exercise about as well as a sports drink."], ["P", "Skin moisture", "Virgin coconut oil improved dry skin and mild eczema in small trials."], ["T", "Energy", "Medium-chain fats are absorbed quickly and used for energy rather than stored."]],
  ["Drink fresh coconut water after exercise.", "Add unsweetened flakes to granola.", "Cook curries with coconut milk.", "Use virgin coconut oil as a skin and hair moisturizer."],
  ["2 tbsp shredded or 1 cup water", 15], "Choose a heavy coconut that sloshes when shaken. Refrigerate fresh meat and use within a week.",
  "Coconut oil and meat are high in saturated fat, which can raise LDL cholesterol — use in moderation. Tree nut allergy does not usually include coconut, but some people react.");

F("date", "Date", "Phoenix dactylifera", "Arecaceae (palm family)", "long", "#7b3f1e", "Autumn", ["energy", "digestion", "women"],
  "Dates are the sweet fruit of the date palm, eaten for thousands of years in the Middle East. They provide quick natural energy along with fiber, potassium and magnesium. Their fiber helps keep digestion regular. Studies suggest eating dates in late pregnancy may help labor progress. They are a wholesome natural sweetener for snacks and baking.",
  ["Natural sugars", "Fiber", "Potassium", "Magnesium", "Copper"],
  [["P", "Quick energy", "Their natural sugars provide fast fuel, which is why dates are used to break the fast in Ramadan."], ["P", "Late pregnancy", "Several studies found women who ate about six dates a day in late pregnancy had more favorable labor — talk to your midwife."], ["T", "Regularity", "Fiber in dates supports healthy digestion."]],
  ["Stuff with nut butter or almonds.", "Blend into smoothies as a sweetener.", "Make energy balls with nuts and oats.", "Chop into baking instead of sugar."],
  ["2–3 dates", 48], "Choose plump, glossy dates. Store in an airtight container in the fridge for months.",
  "Dates are high in natural sugar — keep portions small if you have diabetes.");

F("dragon-fruit", "Dragon Fruit", "Selenicereus undatus", "Cactaceae (cactus family)", "spiky", "#e0357a", "Summer to autumn", ["digestion", "immunity"],
  "Dragon fruit, or pitaya, is the striking fruit of a climbing cactus. Its mild, sweet flesh is speckled with tiny edible seeds. It provides fiber and prebiotics that feed beneficial gut bacteria. Red-fleshed varieties are rich in betalain antioxidants. It is low in calories and beautiful in smoothie bowls.",
  ["Fiber", "Vitamin C", "Magnesium", "Iron", "Betalains (red types)"],
  [["P", "Gut health", "Dragon fruit oligosaccharides acted as prebiotics in studies, feeding probiotic bacteria."], ["P", "Antioxidants", "Red-fleshed pitaya contains betalains, the same antioxidants found in beets."], ["T", "Iron", "Dragon fruit provides iron along with vitamin C, which helps the body absorb it."]],
  ["Scoop and eat with a spoon.", "Blend into a bright pink smoothie bowl.", "Cube into fruit salads.", "Freeze for sorbet."],
  ["1 cup cubes", 227], "Choose evenly colored fruit that gives slightly to pressure. Refrigerate and eat within a few days.",
  "Red dragon fruit can harmlessly turn urine or stool pink. Rarely causes allergy.");

F("durian", "Durian", "Durio zibethinus", "Malvaceae (mallow family)", "spiky", "#b9a34a", "Summer", ["energy"],
  "Durian is the famous 'king of fruits' of Southeast Asia, known for its powerful smell. Its creamy, custard-like flesh is rich in energy, fiber and B vitamins. It provides potassium, vitamin C and healthy plant compounds. It is very filling and traditionally eaten as a special treat. Its strong aroma has gotten it banned on many trains and hotels.",
  ["Fiber", "Vitamin C", "B vitamins", "Potassium", "Healthy fats"],
  [["T", "Energy", "Durian is calorie-dense and traditionally eaten to restore strength."], ["P", "Antioxidants", "Durian contains polyphenols and flavonoids with antioxidant activity."], ["T", "Gut health", "Its fiber supports regular digestion."]],
  ["Eat fresh pods with a spoon.", "Blend into smoothies or ice cream.", "Use in Southeast Asian desserts like durian sticky rice.", "Freeze pods for a creamy treat."],
  ["½ cup", 120], "Choose fruit with a strong aroma and stem that's still moist. Eat soon after opening; store in a sealed container in the fridge.",
  "Avoid drinking alcohol with durian — its sulfur compounds may slow alcohol breakdown and cause nausea and flushing. High in calories and sugar.");

F("feijoa", "Feijoa", "Acca sellowiana", "Myrtaceae (myrtle family)", "pear", "#5f8f3e", "Autumn", ["immunity", "digestion"],
  "Feijoa, also called pineapple guava, is a fragrant green fruit with a sweet, tangy flavor. It is rich in vitamin C and fiber. Its gritty, aromatic flesh tastes like pineapple, mint and guava combined. It contains antioxidant polyphenols with antibacterial activity in lab studies. It's a beloved autumn fruit in New Zealand.",
  ["Vitamin C", "Fiber", "Folate", "Polyphenols"],
  [["P", "Immunity", "Feijoas are a strong source of vitamin C."], ["P", "Digestion", "High fiber supports regularity."], ["P", "Antioxidants", "Feijoa extracts show antioxidant and antimicrobial activity in the lab."]],
  ["Cut in half and scoop with a spoon.", "Blend into smoothies.", "Make chutney or jam.", "Bake into muffins."],
  ["2 feijoas", 100], "Ripe feijoas fall from the tree and feel slightly soft. Refrigerate and eat within a few days.",
  "Generally safe. Some people find the skin bitter.");

F("fig", "Fig", "Ficus carica", "Moraceae (mulberry family)", "pear", "#5e2b4f", "Late summer", ["digestion", "heart", "women"],
  "Figs are soft, honey-sweet fruits treasured since biblical times. They are one of the best fruit sources of fiber, supporting regular digestion. Figs provide potassium, calcium and magnesium for heart and bone health. Dried figs are a traditional remedy for constipation. Their natural sweetness makes them a wholesome treat.",
  ["Fiber", "Potassium", "Calcium", "Magnesium", "Polyphenols"],
  [["P", "Constipation relief", "A clinical trial found eating dried figs daily improved constipation."], ["P", "Bone health", "Figs supply calcium, potassium and magnesium, minerals important for bones."], ["P", "Blood sugar", "Fig leaf extract lowered after-meal blood sugar in small studies."]],
  ["Eat fresh with yogurt or cheese.", "Chop dried figs into oatmeal.", "Roast with honey and walnuts.", "Add to salads with goat cheese."],
  ["2 fresh or 3 dried figs", 80], "Fresh figs are delicate — choose soft, fragrant fruit and eat within 1–2 days. Dried figs keep for months.",
  "Figs can have a laxative effect in large amounts. Fig sap can irritate skin. People with birch pollen or latex allergy may react.");

F("goji-berry", "Goji Berry", "Lycium barbarum", "Solanaceae (nightshade family)", "berry", "#d8402a", "Late summer", ["immunity", "energy", "skin"],
  "Goji berries, or wolfberries, have been used in Chinese medicine for centuries. They are rich in zeaxanthin, an antioxidant that protects the eyes. Their unique polysaccharides support immune function in studies. Goji berries provide vitamin A, vitamin C and iron. Dried goji berries make a chewy, tangy snack.",
  ["Zeaxanthin", "Vitamin A", "Vitamin C", "Iron", "Polysaccharides"],
  [["P", "Eye health", "Daily goji berries increased protective pigment in the macula of older adults in a trial."], ["P", "Immune support", "Goji polysaccharides boosted immune responses in older adults in studies."], ["T", "Energy and wellbeing", "A small trial found goji juice improved feelings of energy and calm."]],
  ["Add dried berries to trail mix or granola.", "Soak and add to oatmeal or tea.", "Blend into smoothies.", "Add to soups in Chinese cooking."],
  ["2 tbsp dried", 28], "Choose bright red, soft dried berries. Store in an airtight container away from light.",
  "Goji may increase the effect of warfarin — avoid if you take blood thinners. It belongs to the nightshade family.");

F("gooseberry", "Gooseberry", "Ribes uva-crispa", "Grossulariaceae (currant family)", "berry", "#8fb34a", "Summer", ["immunity", "digestion"],
  "Gooseberries are tart, translucent berries popular in European cooking. They are rich in vitamin C and fiber. Their tart flavor comes from natural acids that brighten desserts and sauces. They contain antioxidant polyphenols. They are delicious in jams, crumbles and fools.",
  ["Vitamin C", "Fiber", "Vitamin A", "Polyphenols"],
  [["P", "Immunity", "Gooseberries provide a good dose of vitamin C."], ["T", "Digestion", "Their fiber supports regularity."], ["P", "Antioxidants", "Contain flavonols that help protect cells."]],
  ["Cook into a crumble or pie.", "Make gooseberry fool with cream.", "Add to sauces for fish or pork.", "Eat ripe dessert varieties fresh."],
  ["1 cup", 150], "Choose firm berries; dessert varieties soften when ripe. Refrigerate for up to a week.",
  "Very tart unripe. Generally safe.");

F("grape", "Grape", "Vitis vinifera", "Vitaceae (grape family)", "berry", "#6b2f6b", "Late summer to autumn", ["heart", "immunity"],
  "Grapes have been cultivated for over 8,000 years. Red and purple grapes contain resveratrol and other polyphenols that support heart health. They are hydrating and provide vitamin K and vitamin C. Grape polyphenols help blood vessels relax and may improve circulation. Frozen grapes make a refreshing natural treat.",
  ["Vitamin K", "Vitamin C", "Resveratrol", "Anthocyanins", "Potassium"],
  [["P", "Heart health", "Grape polyphenols improved blood vessel function and blood pressure in some studies."], ["P", "Antioxidants", "Red grapes contain resveratrol, quercetin and anthocyanins."], ["T", "Hydration", "Grapes are about 80% water."]],
  ["Eat fresh as a snack.", "Freeze for a cold treat.", "Roast with chicken or sausages.", "Add to chicken or grain salads."],
  ["1 cup", 151], "Choose plump grapes firmly attached to green stems. Refrigerate unwashed for up to 2 weeks.",
  "Cut grapes lengthwise for young children to prevent choking. Grapes are very toxic to dogs.");

F("grapefruit", "Grapefruit", "Citrus × paradisi", "Rutaceae (citrus family)", "citrus", "#f06a5a", "Winter", ["immunity", "heart"],
  "Grapefruit is a tangy citrus fruit rich in vitamin C. Pink and red grapefruit also contain lycopene and beta-carotene. It is low in calories and high in water, which helps with fullness. Some studies link grapefruit to modest improvements in weight and cholesterol. However, it interacts with many medicines.",
  ["Vitamin C", "Vitamin A", "Lycopene (pink/red)", "Fiber", "Potassium"],
  [["P", "Immunity", "Half a grapefruit supplies most of a day's vitamin C."], ["P", "Weight and fullness", "Eating grapefruit before meals helped modest weight loss in a small study."], ["P", "Cholesterol", "Red grapefruit lowered cholesterol in a small trial."]],
  ["Halve and eat with a spoon.", "Segment into salads with avocado.", "Broil with a drizzle of honey.", "Juice fresh."],
  ["½ grapefruit", 123], "Choose heavy, firm fruit. Store at room temperature for a week or in the fridge for 2–3 weeks.",
  "Grapefruit blocks the enzyme CYP3A4 and interacts with many medicines, including some statins, blood pressure drugs and anti-anxiety medicines. Ask your pharmacist before eating it if you take any medication.");

F("guava", "Guava", "Psidium guajava", "Myrtaceae (myrtle family)", "round", "#8bbf54", "Winter", ["immunity", "digestion", "heart"],
  "Guava is a tropical fruit with one of the highest vitamin C levels of any fruit. One guava provides more than a day's worth. It is very rich in fiber, supporting digestion and blood sugar. Pink guava contains lycopene for heart health. Guava leaf tea is used in traditional medicine for diarrhea and blood sugar.",
  ["Vitamin C (very high)", "Fiber", "Folate", "Potassium", "Lycopene (pink)"],
  [["P", "Immunity", "One guava provides about twice the daily requirement of vitamin C."], ["P", "Blood sugar", "Guava leaf tea lowered after-meal blood sugar in small studies."], ["P", "Digestion", "Guava's fiber supports regularity, and guava leaf extract eased diarrhea in studies."]],
  ["Eat whole, skin and seeds included.", "Blend into juice or smoothies.", "Make guava paste or jam.", "Slice with chili and lime."],
  ["1 guava", 55], "Ripe guavas are fragrant and give slightly to pressure. Refrigerate ripe fruit for a few days.",
  "Generally very safe. Guava leaf tea may lower blood sugar further in people on diabetes medicine.");

F("honeydew", "Honeydew", "Cucumis melo (Inodorus group)", "Cucurbitaceae (gourd family)", "melon", "#c8dc8a", "Summer", ["skin", "heart"],
  "Honeydew is a sweet, pale green melon that is about 90% water. It hydrates and provides potassium for healthy blood pressure. It is a good source of vitamin C for immunity and skin. Low in calories, it makes a refreshing snack. Its mild sweetness pairs beautifully with mint and lime.",
  ["Vitamin C", "Potassium", "Vitamin B6", "Water"],
  [["T", "Hydration", "Its high water and electrolyte content helps hydration."], ["P", "Blood pressure", "Potassium supports healthy blood pressure."], ["T", "Skin", "Vitamin C supports collagen production."]],
  ["Eat chilled cubes.", "Blend into agua fresca.", "Toss with mint, lime and feta.", "Add to fruit salads."],
  ["1 cup cubes", 170], "Ripe honeydew has a waxy, slightly sticky rind and sweet smell. Refrigerate cut melon for 3–5 days.",
  "Wash the rind before cutting. Generally safe.");

F("jackfruit", "Jackfruit", "Artocarpus heterophyllus", "Moraceae (mulberry family)", "spiky", "#c3b545", "Summer", ["energy", "digestion"],
  "Jackfruit is the largest tree fruit in the world, sometimes weighing over 40 kg. Ripe jackfruit is sweet and tastes like a mix of banana, pineapple and mango. Young green jackfruit has a meaty texture and is popular as a plant-based meat substitute. It provides fiber, potassium and vitamin C. Its seeds are also edible when cooked.",
  ["Fiber", "Vitamin C", "Potassium", "Vitamin B6", "Magnesium"],
  [["T", "Energy", "Ripe jackfruit provides natural carbohydrates for energy."], ["P", "Digestion", "Its fiber supports gut health."], ["P", "Blood sugar", "Green jackfruit flour lowered blood sugar in a small trial."]],
  ["Eat ripe pods fresh.", "Cook young jackfruit as 'pulled pork' with barbecue sauce.", "Add to curries.", "Boil or roast the seeds."],
  ["1 cup", 165], "Buy pre-cut pods or canned young jackfruit in water. Refrigerate fresh pods for a few days.",
  "Latex allergy may cross-react. Jackfruit seeds must be cooked.");

F("kiwi", "Kiwi", "Actinidia deliciosa", "Actinidiaceae", "round", "#7a9a2e", "Winter", ["sleep", "digestion", "immunity"],
  "Kiwifruit is a small fuzzy fruit with bright green flesh and more vitamin C than an orange. Two kiwis a day improved constipation in several clinical trials. They contain actinidin, an enzyme that helps digest protein. A study found eating two kiwis before bed improved sleep. Kiwis are also rich in vitamin K, vitamin E and fiber.",
  ["Vitamin C", "Vitamin K", "Vitamin E", "Fiber", "Actinidin"],
  [["R", "Constipation", "Several trials found two green kiwifruit daily relieved constipation as well as prunes or psyllium, with less discomfort."], ["P", "Sleep", "Eating two kiwis an hour before bed improved sleep onset and duration over four weeks in a small study."], ["P", "Protein digestion", "Actinidin helps break down proteins, easing heaviness after meals."]],
  ["Halve and scoop with a spoon.", "Slice into fruit salads.", "Blend into green smoothies.", "Use to tenderize meat in marinades."],
  ["2 kiwis", 150], "Ripe kiwis give slightly when pressed. Ripen at room temperature, then refrigerate for up to 2 weeks.",
  "Kiwi is a common allergen and may cross-react with latex. Actinidin makes kiwi curdle dairy and stops gelatin from setting.");

F("kumquat", "Kumquat", "Citrus japonica", "Rutaceae (citrus family)", "citrus", "#f39a1e", "Winter", ["immunity", "digestion"],
  "Kumquats are tiny citrus fruits eaten whole, peel and all. The peel is sweet while the flesh is tart, giving a delightful burst of flavor. Eating the peel provides extra fiber and antioxidant compounds. They are rich in vitamin C. Kumquats are a traditional symbol of good fortune at Lunar New Year.",
  ["Vitamin C", "Fiber", "Flavonoids", "Calcium"],
  [["P", "Immunity", "Kumquats provide vitamin C and peel flavonoids."], ["P", "Digestion", "Eating the whole fruit including peel gives a good dose of fiber."], ["T", "Coughs and throats", "In Chinese tradition, kumquats steeped with honey soothe sore throats."]],
  ["Eat whole after rolling between your fingers to release the oils.", "Slice into salads.", "Candy or make marmalade.", "Steep with honey for a soothing drink."],
  ["5 kumquats", 95], "Choose firm, bright orange fruit. Refrigerate for up to 2 weeks.",
  "Generally safe. The seeds are bitter but harmless.");

F("lemon", "Lemon", "Citrus limon", "Rutaceae (citrus family)", "citrus", "#f2d43a", "Year-round", ["immunity", "digestion", "kitchen"],
  "Lemons bring bright flavor and vitamin C to food and drink. Their citric acid may help prevent some kidney stones. Lemon water is an easy way to drink more water through the day. The peel is rich in flavonoids and aromatic oils. A squeeze of lemon also helps the body absorb iron from plant foods.",
  ["Vitamin C", "Citric acid", "Flavonoids (hesperidin)", "Fiber (pectin)"],
  [["P", "Kidney stones", "Citrate from lemon juice can raise urine citrate, which may help prevent calcium kidney stones."], ["P", "Iron absorption", "Vitamin C greatly increases absorption of iron from beans, greens and grains."], ["T", "Sore throats", "Warm lemon and honey is a classic remedy for scratchy throats."]],
  ["Squeeze into water or tea.", "Use juice and zest in dressings and marinades.", "Finish fish, vegetables and grains with a squeeze.", "Mix with honey and ginger for a soothing drink."],
  ["Juice of ½ lemon", 25], "Choose heavy, glossy lemons. Refrigerate in a bag for up to a month.",
  "Lemon's acid can erode tooth enamel — drink lemon water with a straw and rinse after. May trigger heartburn.");

F("lime", "Lime", "Citrus × aurantiifolia", "Rutaceae (citrus family)", "citrus", "#6fb03a", "Year-round", ["immunity", "kitchen"],
  "Limes are small green citrus fruits with a sharp, refreshing flavor. Like lemons, they are rich in vitamin C and flavonoid antioxidants. Their juice brightens food, allowing you to use less salt. Limes famously protected British sailors from scurvy. They are essential to Mexican, Thai and Caribbean cooking.",
  ["Vitamin C", "Flavonoids", "Citric acid"],
  [["T", "Immunity", "Vitamin C supports immune function and skin repair."], ["P", "Iron absorption", "Lime juice boosts absorption of plant-based iron."], ["P", "Antioxidants", "Lime flavonoids like hesperidin protect cells."]],
  ["Squeeze over tacos, curries and salads.", "Add to water with mint.", "Use in salsas and guacamole.", "Make lime and chili dressings."],
  ["Juice of 1 lime", 30], "Choose glossy, heavy limes that give slightly. Refrigerate for up to 3 weeks.",
  "Lime juice on skin in the sun can cause painful burns (phytophotodermatitis) — wash hands after handling.");

F("lychee", "Lychee", "Litchi chinensis", "Sapindaceae (soapberry family)", "spiky", "#d8435a", "Summer", ["immunity", "skin"],
  "Lychees are fragrant tropical fruits with bumpy red shells and juicy white flesh. They are rich in vitamin C, with just a handful providing a day's worth. They contain polyphenols such as epicatechin and rutin. Their floral sweetness makes them a popular summer treat in Asia. They are delicious fresh or in desserts.",
  ["Vitamin C", "Copper", "Polyphenols", "Potassium"],
  [["P", "Immunity", "About 10 lychees provide a full day's vitamin C."], ["P", "Antioxidants", "Lychee polyphenols protect cells in laboratory studies."], ["T", "Hydration", "Lychees are juicy and refreshing in hot weather."]],
  ["Peel and eat fresh.", "Add to fruit salads.", "Blend into smoothies or sorbet.", "Use in cocktails and mocktails."],
  ["10 lychees", 100], "Choose bright red, heavy lychees. Refrigerate for up to a week.",
  "Never eat unripe lychees on an empty stomach — unripe fruit contains compounds that can drop blood sugar dangerously, especially in undernourished children.");

F("mango", "Mango", "Mangifera indica", "Anacardiaceae (cashew family)", "pear", "#f5a623", "Spring to summer", ["immunity", "skin", "digestion"],
  "Mango is the beloved king of fruits in India, sweet, juicy and fragrant. It is rich in vitamin C and vitamin A for immunity, skin and eyes. Mangoes contain mangiferin, a unique antioxidant. A small trial found mango improved constipation more than an equal amount of fiber supplement. It is perfect fresh, in smoothies or in salsas.",
  ["Vitamin C", "Vitamin A", "Folate", "Fiber", "Mangiferin"],
  [["P", "Digestion", "In a 4-week trial, eating mango daily improved chronic constipation better than a fiber supplement."], ["P", "Skin", "Older women who ate mango regularly had fewer facial wrinkles in a small study."], ["P", "Immunity", "One cup provides most of a day's vitamin C."]],
  ["Eat fresh slices or cubes.", "Blend into lassi or smoothies.", "Make mango salsa with lime and chili.", "Freeze cubes for sorbet."],
  ["1 cup", 165], "Judge ripeness by a sweet smell and slight give, not color. Ripen at room temperature, then refrigerate.",
  "Mango skin contains urushiol (like poison ivy) and can cause a rash in sensitive people. Peel carefully.");

F("mangosteen", "Mangosteen", "Garcinia mangostana", "Clusiaceae", "round", "#4a1f3a", "Summer", ["immunity", "skin"],
  "Mangosteen is the 'queen of fruits,' with a purple rind and sweet, tangy white segments. Its rind is rich in xanthones, antioxidants studied for calming inflammation. The flesh provides vitamin C and fiber. Its delicate, peach-and-lychee flavor is prized across Southeast Asia. It is a rare and special treat.",
  ["Vitamin C", "Fiber", "Folate", "Xanthones (rind)"],
  [["P", "Anti-inflammatory", "Mangosteen xanthones reduce inflammation in laboratory studies and small trials."], ["P", "Skin", "A small trial found mangosteen extract improved skin elasticity."], ["T", "Immunity", "Provides vitamin C."]],
  ["Twist open the rind and eat the white segments.", "Add to fruit salads.", "Blend into smoothies.", "Serve chilled as a dessert."],
  ["½ cup segments", 100], "Choose fruit with a deep purple rind that gives slightly. Refrigerate and eat within a few days.",
  "Concentrated mangosteen supplements may slow blood clotting. Do not eat the rind.");

F("mulberry", "Mulberry", "Morus alba / Morus nigra", "Moraceae (mulberry family)", "berry", "#3d1a3a", "Summer", ["heart", "immunity"],
  "Mulberries are sweet, juicy berries that grow on trees. They are rich in vitamin C, iron and anthocyanins. White mulberry leaf is studied for helping control blood sugar after meals. Mulberries are delicious fresh or dried. They have been grown for silkworms and food for thousands of years.",
  ["Vitamin C", "Iron", "Vitamin K", "Anthocyanins", "Fiber"],
  [["P", "Blood sugar", "Mulberry leaf extract (DNJ) reduced the rise in blood sugar after meals in several studies."], ["P", "Antioxidants", "Black mulberries are rich in anthocyanins."], ["T", "Iron", "Mulberries are a good fruit source of iron."]],
  ["Eat fresh off the tree.", "Add dried mulberries to granola.", "Bake into pies.", "Blend into smoothies."],
  ["1 cup", 140], "Very delicate — eat within a day or two, or freeze. Dried mulberries keep for months.",
  "Mulberry leaf supplements can lower blood sugar further with diabetes medicine. Mulberry juice stains.");

F("nectarine", "Nectarine", "Prunus persica var. nucipersica", "Rosaceae (rose family)", "round", "#e8573a", "Summer", ["skin", "digestion"],
  "Nectarines are smooth-skinned peaches with juicy, sweet flesh. They provide vitamin C, vitamin A and fiber. Their skin holds most of their antioxidant polyphenols. They are hydrating and low in calories. They are perfect fresh, grilled or baked.",
  ["Vitamin C", "Vitamin A", "Fiber", "Potassium", "Polyphenols"],
  [["P", "Skin", "Vitamins A and C support collagen and protect skin."], ["T", "Digestion", "Fiber in the skin supports regularity."], ["P", "Antioxidants", "Nectarine polyphenols protect cells in studies."]],
  ["Eat fresh with the skin.", "Grill halves and serve with yogurt.", "Slice into salads with burrata.", "Bake into crisps."],
  ["1 medium nectarine", 140], "Choose fragrant fruit that gives slightly. Ripen at room temperature, then refrigerate.",
  "Do not eat the pit kernel. May cross-react with birch pollen allergy.");

F("orange", "Orange", "Citrus × sinensis", "Rutaceae (citrus family)", "citrus", "#f28a1a", "Winter", ["immunity", "heart"],
  "Oranges are the classic vitamin C fruit, with one orange supplying a full day's needs. They are rich in hesperidin, a flavonoid that supports healthy blood vessels. The fiber in whole oranges supports digestion and steady blood sugar. Orange juice provides citrate, which may help prevent kidney stones. Whole oranges are more filling than juice.",
  ["Vitamin C", "Folate", "Potassium", "Fiber", "Hesperidin"],
  [["P", "Immunity", "Vitamin C supports immune cells and may slightly shorten colds."], ["P", "Heart health", "Orange juice and hesperidin improved blood pressure and vessel function in some trials."], ["P", "Iron absorption", "Eating oranges with plant foods boosts iron absorption."]],
  ["Peel and eat segments.", "Add to salads with fennel.", "Squeeze fresh juice.", "Use zest in baking."],
  ["1 medium orange", 130], "Choose heavy, firm oranges. Store at room temperature for a week or refrigerate for longer.",
  "Citrus can trigger heartburn. Choose whole fruit over juice to limit sugar.");

F("papaya", "Papaya", "Carica papaya", "Caricaceae", "pear", "#f7883a", "Year-round", ["digestion", "immunity", "skin"],
  "Papaya is a tropical fruit with sweet orange flesh and a buttery texture. It contains papain, an enzyme that helps digest protein. Papaya is rich in vitamin C, vitamin A and folate. It is traditionally eaten for digestive comfort and constipation. Its antioxidants also support healthy skin.",
  ["Vitamin C", "Vitamin A", "Folate", "Fiber", "Papain"],
  [["P", "Digestion", "A papaya preparation improved constipation and bloating in a clinical study."], ["P", "Immunity", "One cup provides more than a day's vitamin C."], ["P", "Skin", "Carotenoids like lycopene and beta-carotene protect the skin."]],
  ["Halve, scoop seeds and squeeze lime over it.", "Blend into smoothies.", "Make green papaya salad.", "Use to tenderize meat."],
  ["1 cup cubes", 145], "Ripe papaya is mostly yellow and gives to gentle pressure. Refrigerate ripe fruit for a few days.",
  "Unripe (green) papaya contains latex that may trigger contractions — avoid green papaya during pregnancy. Latex allergy may cross-react.");

F("passion-fruit", "Passion Fruit", "Passiflora edulis", "Passifloraceae", "round", "#5a2a4a", "Summer to autumn", ["digestion", "calming", "immunity"],
  "Passion fruit is a tangy, fragrant tropical fruit filled with juicy edible seeds. It is one of the highest-fiber fruits by weight. It provides vitamin C, vitamin A and antioxidants. Passion fruit peel extract has been studied for easing asthma and blood pressure. Its intense flavor brightens desserts and drinks.",
  ["Fiber", "Vitamin C", "Vitamin A", "Iron", "Polyphenols"],
  [["P", "Digestion", "Passion fruit pulp and seeds provide a lot of fiber for its size."], ["P", "Antioxidants", "Contains piceatannol, a polyphenol studied for blood vessel health."], ["T", "Relaxation", "Like its passionflower relative, it is traditionally associated with calm."]],
  ["Halve and scoop out the pulp.", "Spoon over yogurt or pavlova.", "Blend into juices and smoothies.", "Make passion fruit curd."],
  ["2 passion fruits", 36], "Choose heavy, wrinkled fruit — wrinkles mean it's ripe. Refrigerate for up to a week.",
  "Latex allergy may cross-react. Generally safe.");

F("peach", "Peach", "Prunus persica", "Rosaceae (rose family)", "round", "#f6a07a", "Summer", ["skin", "digestion"],
  "Peaches are fuzzy, juicy summer fruits native to China. They provide vitamin C, vitamin A, potassium and fiber. Their skin is rich in antioxidant polyphenols. Peaches are low in calories and hydrating. They are wonderful fresh, grilled or baked.",
  ["Vitamin C", "Vitamin A", "Potassium", "Fiber", "Polyphenols"],
  [["P", "Antioxidants", "Peach skin and flesh contain chlorogenic acid and other polyphenols."], ["T", "Digestion", "Fiber supports regularity."], ["P", "Skin", "Vitamins A and C support healthy skin."]],
  ["Eat fresh.", "Grill halves with honey.", "Slice into yogurt or salads.", "Bake into cobblers."],
  ["1 medium peach", 150], "Choose fragrant peaches that give slightly. Ripen on the counter, then refrigerate.",
  "Peach pits contain amygdalin — do not eat the kernel. May cross-react with birch pollen allergy.");

F("pear", "Pear", "Pyrus communis", "Rosaceae (rose family)", "pear", "#b9c24a", "Autumn", ["digestion", "heart"],
  "Pears are sweet, juicy fruits that are one of the best fruit sources of fiber. Much of their fiber is in the skin, so eat them unpeeled. They are gentle on the stomach and a classic first food for babies. Pears provide vitamin C, vitamin K and copper. Their natural sorbitol and fructose can help relieve constipation.",
  ["Fiber", "Vitamin C", "Vitamin K", "Copper", "Polyphenols"],
  [["P", "Digestion", "Pears' fiber, fructose and sorbitol help soften stools and relieve constipation."], ["P", "Heart health", "Eating pears and apples is linked with lower stroke risk in large studies."], ["P", "Blood sugar", "Despite their sweetness, pears have a low glycemic index."]],
  ["Eat fresh with the skin.", "Poach in spiced tea.", "Slice into salads with walnuts and blue cheese.", "Bake with oats and cinnamon."],
  ["1 medium pear", 178], "Pears ripen from the inside — check the neck near the stem for slight give. Ripen at room temperature, then refrigerate.",
  "Pears may cause bloating in people sensitive to fructose or sorbitol (FODMAPs).");

F("persimmon", "Persimmon", "Diospyros kaki", "Ebenaceae (ebony family)", "round", "#ef7c1f", "Autumn", ["heart", "skin", "digestion"],
  "Persimmons are honey-sweet autumn fruits popular in Japan, Korea and China. They are very rich in vitamin A and provide vitamin C and fiber. Their tannins and fiber may help lower cholesterol. Fuyu persimmons are eaten crisp, while Hachiya persimmons must be very soft. Dried persimmon is a traditional winter treat.",
  ["Vitamin A", "Vitamin C", "Fiber", "Manganese", "Tannins"],
  [["P", "Heart health", "Eating persimmons lowered cholesterol in a small study."], ["P", "Eye health", "Rich in beta-carotene, lutein and zeaxanthin."], ["T", "Digestion", "Provides fiber for regularity."]],
  ["Slice crisp Fuyu persimmons into salads.", "Scoop soft Hachiya with a spoon.", "Bake into breads and puddings.", "Dry into hoshigaki."],
  ["1 persimmon", 168], "Fuyu: firm and orange. Hachiya: wait until jelly-soft or it will be very astringent.",
  "Eating large amounts of unripe persimmons on an empty stomach can rarely form a 'bezoar' blockage in the stomach.");

F("pineapple", "Pineapple", "Ananas comosus", "Bromeliaceae", "spiky", "#e6c03a", "Spring to summer", ["digestion", "aches", "immunity"],
  "Pineapple is a sweet, tangy tropical fruit full of vitamin C and manganese. It is the only major source of bromelain, an enzyme that digests protein. Bromelain has been studied for reducing swelling and inflammation. Pineapple supports immunity and bone health. It is refreshing fresh, grilled or in smoothies.",
  ["Vitamin C", "Manganese", "Bromelain", "Fiber", "Vitamin B6"],
  [["P", "Swelling and inflammation", "Bromelain supplements reduced swelling after surgery and injuries in several studies."], ["P", "Protein digestion", "Bromelain breaks down proteins, easing digestion."], ["P", "Immunity", "One cup provides about a day's vitamin C."]],
  ["Eat fresh chunks.", "Grill slices.", "Add to stir-fries and salsas.", "Blend into smoothies."],
  ["1 cup chunks", 165], "Choose fragrant, heavy pineapples. Store at room temperature for a day or two, then refrigerate cut fruit.",
  "Bromelain can make the mouth tingle or sore. Bromelain supplements may increase bleeding with blood thinners.");

F("plum", "Plum", "Prunus domestica", "Rosaceae (rose family)", "round", "#6b2a5e", "Summer", ["digestion", "heart"],
  "Plums are juicy stone fruits that come in many colors. They are rich in antioxidants, especially in their skin. Plums provide vitamin C, vitamin K and fiber. Dried plums, or prunes, are famous for relieving constipation. Their sweet-tart flavor is delicious fresh or baked.",
  ["Vitamin C", "Vitamin K", "Fiber", "Polyphenols", "Potassium"],
  [["P", "Antioxidants", "Plums contain chlorogenic and neochlorogenic acids that protect cells."], ["P", "Digestion", "Fiber and sorbitol support regularity."], ["P", "Bone health", "Plums supply vitamin K important for bones."]],
  ["Eat fresh.", "Bake into tarts and crumbles.", "Roast with meat.", "Make plum jam."],
  ["2 plums", 130], "Choose plump, fragrant plums that give slightly. Refrigerate ripe plums for a few days.",
  "Do not eat the pit kernel.");

F("pomegranate", "Pomegranate", "Punica granatum", "Lythraceae", "round", "#b0182e", "Autumn to winter", ["heart", "immunity", "men"],
  "Pomegranate is an ancient fruit filled with jewel-like seeds called arils. It is rich in punicalagins, powerful antioxidants found mostly in the juice. Studies suggest pomegranate juice may lower blood pressure. It provides vitamin C, vitamin K and fiber. Pomegranate has symbolized abundance and fertility for thousands of years.",
  ["Vitamin C", "Vitamin K", "Fiber", "Punicalagins", "Folate"],
  [["P", "Blood pressure", "A review found pomegranate juice lowered systolic blood pressure by about 5 mmHg."], ["P", "Antioxidants", "Pomegranate juice has some of the highest antioxidant activity of any fruit juice."], ["P", "Exercise recovery", "Pomegranate extract reduced muscle soreness in some studies."]],
  ["Sprinkle arils on salads and yogurt.", "Drink unsweetened juice.", "Use pomegranate molasses in dressings.", "Add to grain bowls."],
  ["½ cup arils", 87], "Choose heavy fruit with firm, glossy skin. Store whole in the fridge for weeks.",
  "Pomegranate juice may interact with some medicines, like grapefruit — ask your pharmacist if you take blood thinners or statins.");

F("prune", "Prune (Dried Plum)", "Prunus domestica", "Rosaceae (rose family)", "round", "#3a1f2a", "Year-round (dried)", ["digestion", "women"],
  "Prunes are dried plums famous for relieving constipation. They contain fiber, sorbitol and polyphenols that soften stools. Research shows prunes may also help protect bone density in women after menopause. They provide vitamin K, potassium and boron. Prunes are naturally sweet and filling.",
  ["Fiber", "Sorbitol", "Vitamin K", "Potassium", "Boron"],
  [["R", "Constipation", "Clinical trials found prunes worked as well as or better than psyllium fiber for constipation."], ["P", "Bone health", "Eating 5–6 prunes daily helped prevent bone loss in postmenopausal women in a 1-year trial."], ["P", "Fullness", "Prunes as a snack increased fullness and supported weight management in a study."]],
  ["Eat 5–6 as a snack.", "Chop into oatmeal.", "Stew with spices.", "Add to tagines and stews."],
  ["5–6 prunes", 50], "Store in an airtight container in a cool place for up to 6 months.",
  "Large amounts can cause gas and loose stools. Increase slowly.");

F("quince", "Quince", "Cydonia oblonga", "Rosaceae (rose family)", "pear", "#e6cf4a", "Autumn", ["digestion", "respiratory"],
  "Quince is an aromatic golden fruit that must be cooked to be enjoyed. Cooking turns its hard, astringent flesh soft, sweet and rosy pink. It is rich in pectin, fiber and vitamin C. Quince is a traditional remedy for coughs and digestive upset. It makes famous jams and Spanish membrillo paste.",
  ["Fiber (pectin)", "Vitamin C", "Copper", "Polyphenols"],
  [["T", "Digestion", "Quince is traditionally used to soothe the stomach and ease diarrhea."], ["P", "Reflux", "A quince syrup reduced reflux symptoms in children in a small trial."], ["T", "Coughs", "Quince seed mucilage is a traditional throat soother."]],
  ["Poach slowly in syrup.", "Make membrillo (quince paste).", "Bake with apples.", "Add to stews."],
  ["½ cooked quince", 90], "Choose fragrant, yellow quince. Store at room temperature for a week or refrigerate for longer.",
  "Do not eat raw in large amounts — very astringent. Seeds contain amygdalin.");

F("raspberry", "Raspberry", "Rubus idaeus", "Rosaceae (rose family)", "berry", "#d42a4a", "Summer", ["digestion", "heart", "women"],
  "Raspberries are delicate berries with one of the highest fiber contents of any fruit. They are rich in vitamin C, manganese and ellagic acid antioxidants. Their low sugar and high fiber help keep blood sugar steady. Raspberry polyphenols support heart and blood vessel health. Raspberry leaf is also a traditional women's herb.",
  ["Fiber (8 g per cup)", "Vitamin C", "Manganese", "Ellagitannins", "Anthocyanins"],
  [["P", "Blood sugar", "Eating raspberries with a meal lowered blood sugar and insulin in a small trial."], ["P", "Digestion", "One cup provides about 8 g of fiber."], ["P", "Antioxidants", "Ellagitannins and anthocyanins protect cells."]],
  ["Eat fresh by the handful.", "Top oatmeal, yogurt or pancakes.", "Blend into smoothies.", "Mash into a quick chia jam."],
  ["1 cup", 123], "Very delicate — eat within 1–2 days of buying. Freeze extras on a tray.",
  "Generally very safe.");

F("starfruit", "Starfruit", "Averrhoa carambola", "Oxalidaceae", "long", "#e3cb3a", "Autumn to winter", ["immunity"],
  "Starfruit, or carambola, is a juicy tropical fruit shaped like a star when sliced. It is low in calories and provides vitamin C and fiber. Its antioxidants include quercetin and epicatechin. It has a crisp, sweet-tart flavor. However, it can be dangerous for people with kidney disease.",
  ["Vitamin C", "Fiber", "Copper", "Polyphenols"],
  [["P", "Immunity", "Provides vitamin C."], ["P", "Antioxidants", "Contains quercetin and gallic acid."], ["T", "Hydration", "Juicy and refreshing."]],
  ["Slice into stars for salads.", "Garnish drinks and desserts.", "Eat fresh.", "Add to salsas."],
  ["1 medium starfruit", 91], "Choose yellow fruit with light brown edges on the ribs. Refrigerate for up to a week.",
  "People with kidney disease must not eat starfruit — it contains a neurotoxin (caramboxin) that healthy kidneys remove but damaged kidneys cannot, and it can be fatal. It is also high in oxalate.");

F("strawberry", "Strawberry", "Fragaria × ananassa", "Rosaceae (rose family)", "berry", "#e03a3a", "Spring to summer", ["heart", "immunity", "skin"],
  "Strawberries are America's favorite berry and one of the best fruit sources of vitamin C. One cup provides more vitamin C than an orange. Their anthocyanins and ellagic acid support heart health. Studies suggest strawberries can lower cholesterol and inflammation. They are low in sugar and delicious in endless ways.",
  ["Vitamin C", "Manganese", "Folate", "Fiber", "Anthocyanins"],
  [["P", "Heart health", "Daily strawberries lowered LDL cholesterol and inflammation in several small trials."], ["P", "Blood sugar", "Strawberries reduced the blood sugar spike after a starchy meal."], ["P", "Skin", "Vitamin C supports collagen production."]],
  ["Eat fresh.", "Slice into salads with spinach and balsamic.", "Blend into smoothies.", "Dip in dark chocolate for a treat."],
  ["1 cup halves", 152], "Choose bright red berries with fresh green caps. Refrigerate unwashed and eat within 3 days.",
  "Strawberries can trigger allergy and are often high in pesticide residues — rinse well or choose organic.");

F("tangerine", "Tangerine", "Citrus reticulata", "Rutaceae (citrus family)", "citrus", "#f47c20", "Winter", ["immunity", "skin"],
  "Tangerines are small, sweet, easy-to-peel citrus fruits. They are rich in vitamin C and beta-cryptoxanthin, which the body turns into vitamin A. They make a convenient snack for adults and children. Their peel is used in Chinese medicine for digestion. They are hydrating and low in calories.",
  ["Vitamin C", "Vitamin A", "Beta-cryptoxanthin", "Fiber"],
  [["P", "Immunity", "Two tangerines provide most of a day's vitamin C."], ["P", "Bone and joint health", "Beta-cryptoxanthin is linked with better bone density in studies."], ["T", "Digestion", "Dried tangerine peel (chenpi) is a traditional digestive aid."]],
  ["Peel and eat as a snack.", "Add segments to salads.", "Use zest in baking.", "Dry the peel for tea."],
  ["2 tangerines", 150], "Choose heavy, fragrant fruit. Store at room temperature for a week or refrigerate.",
  "Generally safe. Citrus may trigger heartburn.");

F("watermelon", "Watermelon", "Citrullus lanatus", "Cucurbitaceae (gourd family)", "melon", "#e8424d", "Summer", ["heart", "energy"],
  "Watermelon is about 92% water, making it one of the most hydrating foods. It is rich in lycopene, the same red antioxidant found in tomatoes. It contains citrulline, which may improve blood flow and exercise recovery. It is low in calories and naturally sweet. It's the perfect summer snack.",
  ["Water (92%)", "Lycopene", "Citrulline", "Vitamin C", "Vitamin A"],
  [["P", "Hydration", "Its water and electrolytes help keep you hydrated in hot weather."], ["P", "Blood flow", "Watermelon's citrulline is converted to arginine, which helps blood vessels relax; it lowered blood pressure in small studies."], ["P", "Muscle soreness", "Watermelon juice reduced muscle soreness after exercise in a small study."]],
  ["Eat chilled slices.", "Blend into agua fresca.", "Toss with feta and mint.", "Freeze into popsicles."],
  ["2 cups cubes", 300], "Choose a heavy melon with a creamy yellow ground spot. Refrigerate cut melon for 3–5 days.",
  "High glycemic index — pair with protein if you have diabetes.");

F("acai", "Açaí", "Euterpe oleracea", "Arecaceae (palm family)", "berry", "#3a1f4a", "Year-round (frozen)", ["heart", "energy"],
  "Açaí berries are small purple palm fruits from the Amazon. They are rich in anthocyanins and healthy fats. Açaí is usually sold as frozen pulp or powder for smoothie bowls. Small studies suggest it may improve cholesterol and antioxidant levels. Choose unsweetened açaí for the most benefit.",
  ["Anthocyanins", "Healthy fats", "Fiber", "Vitamin A"],
  [["P", "Antioxidants", "Açaí pulp raised antioxidant levels in the blood in a small study."], ["P", "Cholesterol", "A small trial found açaí pulp improved cholesterol in overweight adults."], ["T", "Energy", "Traditionally eaten as a staple food in the Amazon."]],
  ["Blend frozen pulp into a smoothie bowl.", "Top with fruit, nuts and seeds.", "Add powder to smoothies or oatmeal.", "Mix into yogurt."],
  ["100 g frozen pulp", 100], "Buy unsweetened frozen packs or pure powder. Keep frozen.",
  "Many açaí bowls are loaded with sugar — choose unsweetened and watch toppings.");

F("acerola", "Acerola Cherry", "Malpighia emarginata", "Malpighiaceae", "berry", "#d8202e", "Summer", ["immunity", "skin"],
  "Acerola, or Barbados cherry, is one of the richest natural sources of vitamin C on Earth. A single small cherry can provide a full day's vitamin C. It is often dried into powder for natural vitamin C supplements. It also contains carotenoids and anthocyanins. Its tart flavor shines in juices and smoothies.",
  ["Vitamin C (extremely high)", "Vitamin A", "Anthocyanins", "Magnesium"],
  [["P", "Immunity", "Acerola's vitamin C supports immune cells and antioxidant defenses."], ["P", "Skin", "Vitamin C is essential for collagen production."], ["P", "Vitamin C absorption", "Natural acerola vitamin C was absorbed slightly better than synthetic vitamin C in a small study."]],
  ["Blend into juices and smoothies.", "Stir acerola powder into water or yogurt.", "Make jam or sorbet.", "Eat fresh where available."],
  ["3–4 cherries or ¼ tsp powder", 20], "Fresh acerola spoils within days — usually found frozen or as powder.",
  "Very high doses of vitamin C can upset the stomach and increase kidney stone risk in prone people.");

F("aronia", "Aronia (Chokeberry)", "Aronia melanocarpa", "Rosaceae (rose family)", "berry", "#1f1530", "Late summer", ["heart", "immunity"],
  "Aronia berries are dark purple North American berries with one of the highest antioxidant levels of any fruit. They are very rich in anthocyanins and procyanidins. Studies suggest aronia may support healthy blood pressure and cholesterol. Their strong, astringent taste makes them better in juices and baking than eaten raw. They are also known as chokeberries.",
  ["Anthocyanins", "Procyanidins", "Vitamin C", "Fiber", "Vitamin K"],
  [["P", "Blood pressure", "Aronia juice lowered blood pressure in small trials."], ["P", "Cholesterol", "Aronia extract improved cholesterol in people with metabolic syndrome."], ["P", "Antioxidants", "Aronia has among the highest antioxidant capacity of berries tested."]],
  ["Add to smoothies with sweeter fruit.", "Bake into muffins.", "Drink diluted juice.", "Make jam."],
  ["¼ cup or 100 ml juice", 30], "Usually sold frozen, dried or as juice.",
  "Very astringent. Generally safe.");

F("asian-pear", "Asian Pear", "Pyrus pyrifolia", "Rosaceae (rose family)", "round", "#d6b25a", "Autumn", ["digestion", "respiratory"],
  "Asian pears are crisp, juicy, apple-shaped pears from East Asia. They are very hydrating and provide fiber, vitamin C and copper. In Korea and China, steamed Asian pear with honey is a traditional cough remedy. They are refreshing and less sweet than European pears. Asian pear juice is even used in Korea to ease hangovers.",
  ["Fiber", "Vitamin C", "Copper", "Potassium"],
  [["T", "Coughs and throats", "Steamed Asian pear with honey and ginger is a traditional remedy for dry coughs."], ["P", "Digestion", "Fiber supports regularity."], ["P", "Hangover", "A small study found Asian pear juice before drinking lowered blood alcohol and hangover symptoms."]],
  ["Eat fresh and crisp.", "Slice into salads.", "Steam with honey for a cough.", "Grate into Korean marinades."],
  ["1 medium Asian pear", 120], "Unlike European pears, Asian pears are ripe when firm. Refrigerate for weeks.",
  "May cause bloating in fructose-sensitive people.");

F("blood-orange", "Blood Orange", "Citrus × sinensis (blood varieties)", "Rutaceae (citrus family)", "citrus", "#b02a2a", "Winter", ["immunity", "heart"],
  "Blood oranges are oranges with striking crimson flesh. Their red color comes from anthocyanins, which ordinary oranges don't contain. They provide plenty of vitamin C and fiber. Their flavor has hints of raspberry. They add stunning color to salads and desserts.",
  ["Vitamin C", "Anthocyanins", "Fiber", "Folate"],
  [["P", "Immunity", "One fruit supplies most of a day's vitamin C."], ["P", "Antioxidants", "Anthocyanins add antioxidant protection beyond normal oranges."], ["P", "Weight and metabolism", "Blood orange extract reduced weight gain in some studies."]],
  ["Eat segments fresh.", "Slice into salads with fennel and olives.", "Juice.", "Use in desserts and cocktails."],
  ["1 medium blood orange", 130], "Choose heavy fruit. Refrigerate for up to 3 weeks.",
  "Generally safe.");

F("breadfruit", "Breadfruit", "Artocarpus altilis", "Moraceae (mulberry family)", "spiky", "#9cbf4a", "Summer to autumn", ["energy", "kitchen"],
  "Breadfruit is a starchy tropical fruit that tastes like fresh bread when cooked. It is a staple food across the Pacific and Caribbean. It provides complex carbohydrates, fiber, potassium and vitamin C. It is naturally gluten-free. One tree can feed a family for years.",
  ["Complex carbohydrates", "Fiber", "Potassium", "Vitamin C"],
  [["T", "Sustained energy", "Its starch and fiber give long-lasting energy."], ["P", "Digestion", "Breadfruit is a good source of fiber."], ["T", "Gluten-free staple", "Breadfruit flour is a nutritious gluten-free alternative."]],
  ["Roast whole and slice like bread.", "Boil and mash like potatoes.", "Fry into chips.", "Use in curries."],
  ["1 cup cooked", 220], "Use when the skin starts to yellow. Cook within a couple of days.",
  "Must be cooked. Latex allergy may cross-react.");

F("cherimoya", "Cherimoya", "Annona cherimola", "Annonaceae (custard apple family)", "round", "#9cbf6a", "Winter to spring", ["energy", "digestion"],
  "Cherimoya, or custard apple, has creamy flesh that tastes like banana, pineapple and vanilla. Mark Twain called it 'the most delicious fruit known to men.' It provides vitamin C, vitamin B6 and fiber. It is rich in natural sugars for energy. It is best eaten chilled with a spoon.",
  ["Vitamin C", "Vitamin B6", "Fiber", "Potassium"],
  [["T", "Energy", "Natural sugars provide quick energy."], ["P", "Mood and nerves", "Vitamin B6 supports the production of brain messengers like serotonin."], ["T", "Digestion", "Provides fiber."]],
  ["Halve and scoop with a spoon.", "Blend into smoothies.", "Freeze into sorbet.", "Add to fruit salads."],
  ["½ cherimoya", 160], "Ripens at room temperature until it gives slightly; then refrigerate.",
  "Never eat the seeds or skin — they contain toxic compounds.");

F("cloudberry", "Cloudberry", "Rubus chamaemorus", "Rosaceae (rose family)", "berry", "#f0a83a", "Late summer", ["immunity", "skin"],
  "Cloudberries are rare amber berries that grow in Arctic bogs. They are prized in Scandinavia and contain about four times more vitamin C than oranges. They are rich in ellagitannins and vitamin E. Their seed oil is used in skin care. They are usually enjoyed as jam with waffles or cheese.",
  ["Vitamin C", "Vitamin E", "Ellagitannins", "Omega fatty acids (seeds)"],
  [["P", "Immunity", "Very high in vitamin C."], ["P", "Skin", "Cloudberry seed oil is rich in omega-3, omega-6 and vitamin E."], ["P", "Antioxidants", "Rich in ellagitannins."]],
  ["Spoon cloudberry jam over waffles or cheese.", "Top desserts.", "Eat fresh if foraged.", "Mix into yogurt."],
  ["½ cup", 70], "Usually sold as jam or frozen.",
  "Generally safe.");

F("red-currant", "Red Currant", "Ribes rubrum", "Grossulariaceae (currant family)", "berry", "#e0202e", "Summer", ["immunity"],
  "Red currants are glossy, jewel-like berries with a bright, tart flavor. They are rich in vitamin C and fiber. They contain antioxidant anthocyanins and flavonols. They are classic in jellies, sauces and summer puddings. Their beauty makes them a favorite garnish.",
  ["Vitamin C", "Fiber", "Vitamin K", "Anthocyanins"],
  [["P", "Immunity", "A good source of vitamin C."], ["T", "Digestion", "Provides fiber."], ["P", "Antioxidants", "Contains flavonols like quercetin."]],
  ["Make red currant jelly.", "Garnish desserts.", "Add to summer pudding.", "Sprinkle on yogurt."],
  ["1 cup", 112], "Choose plump, glossy berries on the stem. Refrigerate and use within a few days.",
  "Very tart; generally safe.");

F("huckleberry", "Huckleberry", "Vaccinium membranaceum", "Ericaceae (heath family)", "berry", "#3a2a5a", "Late summer", ["heart", "immunity"],
  "Huckleberries are wild berries closely related to blueberries, beloved in the mountains of the American West. They have an intense sweet-tart flavor. They are rich in anthocyanins, vitamin C and iron. They cannot be farmed easily, so most are hand-picked. They are prized in jams, pies and pancakes.",
  ["Anthocyanins", "Vitamin C", "Iron", "Fiber"],
  [["P", "Antioxidants", "Wild huckleberries are very rich in anthocyanins."], ["T", "Heart health", "Like blueberries, their polyphenols support blood vessels."], ["T", "Immunity", "Provide vitamin C."]],
  ["Bake into pies and muffins.", "Make jam.", "Add to pancakes.", "Eat fresh if foraged."],
  ["1 cup", 140], "Usually sold frozen or as jam. Refrigerate fresh berries and use quickly.",
  "When foraging, be completely sure of identification.");

F("jabuticaba", "Jabuticaba", "Plinia cauliflora", "Myrtaceae (myrtle family)", "berry", "#2a1a2a", "Spring", ["immunity"],
  "Jabuticaba is a Brazilian fruit that grows directly on the tree trunk. Its dark skin hides sweet, grape-like white flesh. The skin is rich in anthocyanins and ellagitannins. It is eaten fresh or made into jams, juices and wine. It spoils quickly, so it's rarely found outside Brazil.",
  ["Anthocyanins", "Vitamin C", "Fiber", "Ellagitannins"],
  [["P", "Antioxidants", "The peel is very rich in anthocyanins."], ["P", "Blood sugar", "Jabuticaba peel improved blood sugar response in a small study."], ["T", "Digestion", "Traditionally used for diarrhea."]],
  ["Pop the flesh out of the skin and eat.", "Make jam or juice.", "Blend into smoothies.", "Use in desserts."],
  ["1 cup", 140], "Eat within 2–3 days of picking.",
  "Generally safe.");

F("jujube", "Jujube (Red Date)", "Ziziphus jujuba", "Rhamnaceae (buckthorn family)", "round", "#9a2a1a", "Autumn", ["sleep", "calming", "digestion"],
  "Jujubes, or Chinese red dates, have been used in Chinese medicine for thousands of years. They are traditionally used to calm the mind and improve sleep. They are rich in vitamin C, fiber and saponins. Dried jujubes taste like dates. They are often simmered in teas and soups.",
  ["Vitamin C", "Fiber", "Potassium", "Saponins"],
  [["P", "Sleep and calm", "Jujube saponins acted on calming GABA pathways in laboratory studies."], ["P", "Constipation", "Jujube extract improved chronic constipation in a small trial."], ["T", "Energy", "A traditional tonic for tiredness."]],
  ["Simmer dried jujubes in tea.", "Add to soups and congee.", "Eat fresh like an apple.", "Snack on dried jujubes."],
  ["5 dried jujubes", 30], "Fresh jujubes look like small apples; dried ones keep for months.",
  "Jujube may increase drowsiness with sleep medicines.");

F("kiwano", "Kiwano (Horned Melon)", "Cucumis metuliferus", "Cucurbitaceae (gourd family)", "spiky", "#f09a2a", "Summer", ["energy", "skin"],
  "Kiwano is a spiky orange melon with bright green, jelly-like flesh. It tastes like cucumber, banana and lime. It is very hydrating and low in calories. It provides vitamin C, magnesium and iron. It makes a striking, refreshing snack.",
  ["Water", "Vitamin C", "Magnesium", "Iron"],
  [["T", "Hydration", "Kiwano is mostly water and refreshing in heat."], ["P", "Magnesium", "Provides magnesium for muscles and nerves."], ["T", "Skin", "Vitamin C supports collagen."]],
  ["Halve and scoop the jelly.", "Add to smoothies.", "Use in salsas.", "Garnish drinks."],
  ["½ kiwano", 100], "Ripe kiwano is bright orange. Store at room temperature.",
  "Generally safe.");

F("lingonberry", "Lingonberry", "Vaccinium vitis-idaea", "Ericaceae (heath family)", "berry", "#c41e3a", "Late summer", ["heart", "women"],
  "Lingonberries are small red berries treasured in Scandinavia. They are related to cranberries and rich in anthocyanins and procyanidins. Studies suggest they may help balance blood sugar after meals. Lingonberry juice may help prevent urinary tract infections. They are famous as a sauce with Swedish meatballs.",
  ["Anthocyanins", "Procyanidins", "Vitamin C", "Manganese"],
  [["P", "Blood sugar", "Eating lingonberries with a meal reduced blood sugar and insulin spikes in small studies."], ["P", "Urinary health", "Cranberry-lingonberry juice reduced repeat UTIs in a trial."], ["P", "Gut health", "Lingonberries changed gut bacteria favorably in animal studies."]],
  ["Serve lingonberry sauce with meats.", "Stir into porridge.", "Add to smoothies.", "Bake into desserts."],
  ["½ cup", 70], "Usually sold frozen or as jam. Choose low-sugar versions.",
  "Generally safe.");

F("longan", "Longan", "Dimocarpus longan", "Sapindaceae (soapberry family)", "berry", "#c8a46a", "Summer", ["calming", "sleep", "immunity"],
  "Longan, or 'dragon's eye,' is a sweet, juicy relative of the lychee. It is rich in vitamin C. In Chinese medicine, dried longan is used to calm the mind and help sleep. It contains polyphenols with antioxidant activity. It tastes like a muskier, sweeter lychee.",
  ["Vitamin C", "Potassium", "Polyphenols"],
  [["T", "Calm and sleep", "Dried longan is a traditional remedy for restlessness and poor sleep."], ["P", "Immunity", "Very rich in vitamin C."], ["P", "Antioxidants", "Contains gallic acid and ellagic acid."]],
  ["Peel and eat fresh.", "Add dried longan to tea.", "Use in sweet soups.", "Add to fruit salads."],
  ["10 longans", 30], "Choose firm, tan fruit. Refrigerate for up to a week.",
  "Generally safe.");

F("loquat", "Loquat", "Eriobotrya japonica", "Rosaceae (rose family)", "round", "#f2b33a", "Spring", ["respiratory", "skin"],
  "Loquats are small orange fruits with a sweet, apricot-like flavor. They are rich in vitamin A and provide fiber and potassium. Loquat leaf syrup is a traditional Chinese cough remedy. They are among the first fruits of spring. Enjoy them fresh or in jams.",
  ["Vitamin A", "Fiber", "Potassium", "Manganese"],
  [["T", "Coughs", "Loquat leaf syrup (pipa gao) is a traditional cough remedy in Chinese medicine."], ["P", "Eye and skin health", "Rich in beta-carotene."], ["T", "Digestion", "Provides fiber."]],
  ["Eat fresh, peeled.", "Make jam or chutney.", "Add to fruit salads.", "Poach."],
  ["5 loquats", 50], "Choose orange, slightly soft fruit. Eat within a few days.",
  "Never eat the seeds — they contain cyanide-forming compounds.");

F("lucuma", "Lúcuma", "Pouteria lucuma", "Sapotaceae", "round", "#c79a3a", "Year-round (powder)", ["energy", "kitchen"],
  "Lúcuma is a Peruvian fruit with sweet, maple-like flesh. It is usually sold as powder and used as a natural sweetener. It provides fiber, beta-carotene and minerals. Its low glycemic index makes it gentler on blood sugar than sugar. It is Peru's most popular ice cream flavor.",
  ["Fiber", "Beta-carotene", "Iron", "Zinc"],
  [["P", "Blood sugar", "Lúcuma extracts slowed sugar-digesting enzymes in laboratory studies."], ["T", "Natural sweetener", "Adds sweetness with fiber."], ["P", "Antioxidants", "Contains polyphenols and carotenoids."]],
  ["Blend powder into smoothies.", "Stir into oatmeal.", "Bake into treats.", "Make ice cream."],
  ["1 tbsp powder", 10], "Store powder airtight in a cool place.",
  "Generally safe.");

F("maqui-berry", "Maqui Berry", "Aristotelia chilensis", "Elaeocarpaceae", "berry", "#2a1530", "Summer", ["heart", "immunity"],
  "Maqui berries are deep purple berries from Patagonia in Chile. They are among the richest known sources of anthocyanins, especially delphinidins. Studies suggest maqui may help balance blood sugar. It may also support eye comfort and dry eyes. It is usually sold as powder or juice.",
  ["Anthocyanins (delphinidins)", "Vitamin C", "Fiber"],
  [["P", "Blood sugar", "A maqui extract lowered blood sugar in people with prediabetes in a small study."], ["P", "Dry eyes", "Maqui extract improved dry eye symptoms in small trials."], ["P", "Antioxidants", "Very high anthocyanin content."]],
  ["Add powder to smoothies.", "Stir into yogurt or oatmeal.", "Drink diluted juice.", "Bake into treats."],
  ["1 tsp powder", 5], "Store powder airtight.",
  "Generally safe.");

F("miracle-fruit", "Miracle Fruit", "Synsepalum dulcificum", "Sapotaceae", "berry", "#d42a2a", "Year-round", ["kitchen"],
  "Miracle fruit is a small red berry from West Africa that makes sour foods taste sweet. Its protein, miraculin, binds to sweet taste receptors for about an hour. Lemons taste like lemonade after eating one. It is being studied to help people reduce sugar. It is also used to help chemotherapy patients with taste changes.",
  ["Miraculin", "Vitamin C", "Antioxidants"],
  [["P", "Reducing sugar", "Miraculin can make sour foods taste sweet without added sugar."], ["P", "Taste changes", "Miracle fruit improved taste in people undergoing chemotherapy in a small study."], ["T", "Fun food experience", "Popular in 'flavor tripping' parties."]],
  ["Chew a berry for a minute, then taste lemons or vinegar.", "Use before sour foods.", "Try tablets of freeze-dried fruit.", "Pair with plain yogurt."],
  ["1 berry", 2], "Fresh berries spoil quickly; freeze-dried tablets keep longer.",
  "Generally safe.");

F("monk-fruit", "Monk Fruit", "Siraitia grosvenorii", "Cucurbitaceae (gourd family)", "round", "#7a5a2a", "Year-round (dried)", ["kitchen", "respiratory"],
  "Monk fruit, or luo han guo, is a small Chinese melon used as a natural sweetener. Its mogrosides are about 150–250 times sweeter than sugar with almost no calories. It does not raise blood sugar. In Chinese medicine, it is used in tea for coughs and sore throats. Monk fruit sweetener is popular for low-sugar diets.",
  ["Mogrosides", "Antioxidants"],
  [["P", "Zero-calorie sweetness", "Mogrosides are intensely sweet without raising blood sugar."], ["T", "Coughs and sore throats", "Dried monk fruit tea is a traditional throat remedy."], ["P", "Antioxidants", "Mogrosides have antioxidant activity in lab studies."]],
  ["Use monk fruit sweetener in drinks and baking.", "Simmer dried fruit as tea.", "Sweeten yogurt and oatmeal.", "Make sugar-free syrups."],
  ["To taste (small amounts)", 1], "Check labels — many blends contain erythritol or other sweeteners.",
  "Monk fruit itself is considered safe; some blends contain erythritol, which may be linked to heart risks in some research.");

F("noni", "Noni", "Morinda citrifolia", "Rubiaceae (coffee family)", "spiky", "#d9d6a0", "Year-round", ["immunity"],
  "Noni is a bumpy tropical fruit from the Pacific known for its strong smell. It has been used in Polynesian traditional medicine for centuries. It is usually sold as juice. Research suggests possible antioxidant effects, but evidence is limited. Its taste is famously unpleasant.",
  ["Vitamin C", "Potassium", "Polyphenols"],
  [["T", "Traditional tonic", "Used in Polynesian medicine for many complaints."], ["P", "Antioxidants", "Noni juice showed antioxidant activity in small studies."], ["P", "Joint comfort", "A small study found noni reduced arthritis pain."]],
  ["Drink small amounts of juice mixed with other juices.", "Add to smoothies.", "Use as part of a traditional diet.", "Avoid large amounts."],
  ["30 ml juice", 30], "Buy pasteurized juice.",
  "Noni juice is very high in potassium — avoid with kidney disease. Rare cases of liver injury have been reported.");

F("olive", "Olive", "Olea europaea", "Oleaceae (olive family)", "round", "#556b2f", "Autumn", ["heart", "kitchen"],
  "Olives are the fruit of the ancient olive tree and the heart of the Mediterranean diet. They are rich in monounsaturated fat and the antioxidant hydroxytyrosol. Extra virgin olive oil is strongly linked to lower heart disease risk. Olives provide vitamin E and iron. They must be cured before eating to remove bitterness.",
  ["Monounsaturated fat", "Vitamin E", "Hydroxytyrosol", "Iron"],
  [["R", "Heart health", "The PREDIMED trial found a Mediterranean diet with extra olive oil reduced heart attacks and strokes by about 30%."], ["P", "Anti-inflammatory", "Oleocanthal in olive oil acts on the same enzymes as ibuprofen."], ["P", "Antioxidants", "Hydroxytyrosol protects LDL cholesterol from oxidation."]],
  ["Snack on a handful of olives.", "Use extra virgin olive oil for dressings and cooking.", "Add to salads and pasta.", "Make tapenade."],
  ["5–10 olives or 1 tbsp oil", 30], "Store cured olives in their brine in the fridge.",
  "Cured olives are high in salt — rinse or choose lower-sodium options if you watch your blood pressure.");

F("pawpaw", "Pawpaw", "Asimina triloba", "Annonaceae (custard apple family)", "pear", "#9bb84a", "Late summer to autumn", ["energy", "immunity"],
  "Pawpaw is the largest fruit native to North America, with custardy flesh that tastes like banana and mango. It is rich in vitamin C, magnesium and manganese. It provides more protein than most fruits. It is rarely sold in stores because it bruises easily. It is a beloved wild treat in the eastern United States.",
  ["Vitamin C", "Magnesium", "Manganese", "Iron", "Protein"],
  [["T", "Energy", "Rich in natural sugars and nutrients."], ["P", "Antioxidants", "Contains polyphenols."], ["T", "Minerals", "Good source of magnesium and iron."]],
  ["Scoop and eat fresh.", "Blend into smoothies.", "Bake into breads.", "Make ice cream."],
  ["½ cup", 100], "Ripe pawpaws are soft and fragrant. Eat within 2–3 days.",
  "Do not eat the skin or seeds. Some people experience stomach upset.");

F("plantain-fruit", "Plantain", "Musa × paradisiaca", "Musaceae (banana family)", "long", "#b8c23a", "Year-round", ["energy", "digestion", "kitchen"],
  "Plantains are starchy cooking bananas, a staple in Africa, Latin America and the Caribbean. They provide potassium, vitamin A, vitamin C and fiber. Green plantains are rich in resistant starch, which feeds healthy gut bacteria. They must be cooked before eating. They can be savory when green or sweet when ripe.",
  ["Potassium", "Vitamin A", "Vitamin C", "Fiber", "Resistant starch"],
  [["P", "Gut health", "Resistant starch in green plantains acts as a prebiotic."], ["P", "Blood pressure", "High in potassium."], ["T", "Sustained energy", "Complex carbohydrates provide lasting energy."]],
  ["Fry ripe plantains as maduros.", "Twice-fry green plantains as tostones.", "Bake into chips.", "Mash into mofongo."],
  ["½ cup cooked", 100], "Green for savory, yellow-black for sweet. Store at room temperature.",
  "Must be cooked. Fried plantains are high in fat — baking is healthier.");

F("pomelo", "Pomelo", "Citrus maxima", "Rutaceae (citrus family)", "citrus", "#cfe08a", "Winter", ["immunity", "digestion"],
  "Pomelo is the largest citrus fruit, an ancestor of the grapefruit. It has a mild, sweet flavor. One pomelo provides several days' worth of vitamin C. It is rich in fiber and potassium. It's a symbol of prosperity at Lunar New Year.",
  ["Vitamin C", "Fiber", "Potassium"],
  [["P", "Immunity", "Extremely rich in vitamin C."], ["P", "Digestion", "Provides fiber for regularity."], ["P", "Antioxidants", "Contains naringenin."]],
  ["Peel and eat segments.", "Toss into Thai pomelo salad.", "Add to seafood dishes.", "Candy the peel."],
  ["1 cup segments", 190], "Choose heavy, fragrant fruit. Store in the fridge for weeks.",
  "Like grapefruit, pomelo can interact with many medicines — ask your pharmacist.");

F("prickly-pear", "Prickly Pear", "Opuntia ficus-indica", "Cactaceae (cactus family)", "pear", "#c42a5a", "Late summer", ["heart", "digestion"],
  "Prickly pear, or tuna, is the sweet fruit of the nopal cactus. It is rich in fiber, magnesium and betalain antioxidants. Studies suggest it may help lower blood sugar. Prickly pear extract has been studied for reducing hangover symptoms. It has a melon-like flavor.",
  ["Fiber", "Magnesium", "Vitamin C", "Betalains"],
  [["P", "Blood sugar", "Nopal cactus lowered blood sugar spikes after meals in small studies."], ["P", "Hangovers", "A prickly pear extract reduced hangover nausea and dry mouth in one trial."], ["P", "Antioxidants", "Rich in betalains."]],
  ["Peel and eat chilled.", "Blend into agua fresca.", "Make syrup or jam.", "Add to salads."],
  ["1 fruit", 100], "Handle with tongs or gloves — tiny spines. Refrigerate.",
  "Remove all spines. Seeds are hard; large amounts may cause constipation.");

F("rambutan", "Rambutan", "Nephelium lappaceum", "Sapindaceae (soapberry family)", "spiky", "#d8303a", "Summer", ["immunity", "digestion"],
  "Rambutan is a hairy red fruit from Southeast Asia, closely related to lychee. Its sweet, juicy flesh provides vitamin C and fiber. It contains copper and manganese. Its name comes from the Malay word for hair. It is a refreshing tropical treat.",
  ["Vitamin C", "Fiber", "Copper", "Manganese"],
  [["P", "Immunity", "About 5–6 rambutans provide half a day's vitamin C."], ["P", "Digestion", "Provides fiber."], ["P", "Antioxidants", "Its peel and seeds contain polyphenols (not eaten)."]],
  ["Peel and eat fresh.", "Add to fruit salads.", "Use in cocktails.", "Make sorbet."],
  ["6 rambutans", 150], "Choose bright red fruit with fresh hairs. Refrigerate for a few days.",
  "Don't eat the raw seed or peel.");

F("salak", "Salak (Snake Fruit)", "Salacca zalacca", "Arecaceae (palm family)", "pear", "#6b3a1a", "Year-round", ["digestion"],
  "Salak, or snake fruit, has scaly reddish-brown skin like a snake. Inside are sweet, crunchy, apple-like lobes. It provides fiber, potassium and antioxidants. It is popular in Indonesia and Malaysia. It has a sweet-tart, slightly astringent flavor.",
  ["Fiber", "Potassium", "Vitamin C", "Polyphenols"],
  [["T", "Digestion", "Traditionally eaten to help with loose stools."], ["P", "Antioxidants", "Contains chlorogenic acid and other polyphenols."], ["T", "Energy", "Provides natural sugars."]],
  ["Peel the scaly skin and eat the lobes.", "Add to fruit salads.", "Make pickles.", "Eat chilled."],
  ["3 fruits", 100], "Store at room temperature for a few days.",
  "Generally safe; eating many unripe fruits can cause constipation.");

F("sapodilla", "Sapodilla", "Manilkara zapota", "Sapotaceae", "round", "#a07a4a", "Winter to spring", ["energy", "digestion"],
  "Sapodilla, or chikoo, is a brown tropical fruit with sweet, malty flesh like brown sugar. It is rich in fiber and natural sugars. It provides vitamin C, potassium and copper. Its tree sap, chicle, was the original chewing gum base. It is a popular milkshake in India.",
  ["Fiber", "Vitamin C", "Potassium", "Copper"],
  [["T", "Energy", "Provides quick natural energy."], ["P", "Digestion", "High fiber supports regularity."], ["P", "Antioxidants", "Contains tannins and polyphenols."]],
  ["Scoop the flesh when soft.", "Blend into chikoo milkshakes.", "Add to fruit salads.", "Make ice cream."],
  ["1 fruit", 170], "Ripe sapodillas yield to gentle pressure.",
  "Don't eat the seeds, which have a hook that can lodge in the throat.");

F("sea-buckthorn", "Sea Buckthorn", "Hippophae rhamnoides", "Elaeagnaceae", "berry", "#f08a1a", "Autumn", ["skin", "immunity", "heart"],
  "Sea buckthorn berries are bright orange, intensely tart berries from cold regions. They are rich in vitamin C, vitamin E and carotenoids. They contain rare omega-7 fatty acids that nourish skin and mucous membranes. Sea buckthorn oil has been studied for dry eyes and dry skin. Its juice is popular in Russia and Scandinavia.",
  ["Vitamin C", "Vitamin E", "Omega-7 (palmitoleic acid)", "Carotenoids"],
  [["P", "Skin and dry eyes", "Sea buckthorn oil improved dry eye symptoms and skin moisture in small trials."], ["P", "Heart health", "Its oil and juice improved cholesterol in some studies."], ["P", "Immunity", "Very rich in vitamin C."]],
  ["Mix juice with sweeter juices.", "Take sea buckthorn oil capsules.", "Make jam.", "Add to smoothies."],
  ["30 ml juice", 30], "Usually sold as juice, oil or frozen.",
  "Generally safe. May slow blood clotting in large amounts.");

F("soursop", "Soursop", "Annona muricata", "Annonaceae (custard apple family)", "spiky", "#7a9a3a", "Summer", ["immunity", "digestion"],
  "Soursop, or graviola, is a spiky green fruit with creamy white flesh. It tastes like strawberry, pineapple and citrus combined. It provides vitamin C and fiber. Lab studies have looked at its compounds, but no human studies show it treats disease. It is popular in juices across Latin America and the Caribbean.",
  ["Vitamin C", "Fiber", "Potassium"],
  [["P", "Immunity", "A good source of vitamin C."], ["T", "Digestion", "Provides fiber."], ["P", "Antioxidants", "Contains polyphenols."]],
  ["Scoop the flesh and remove seeds.", "Blend into juice or smoothies.", "Make ice cream.", "Use in desserts."],
  ["½ cup", 112], "Ripe soursop gives to gentle pressure.",
  "The seeds and leaves contain annonacin, linked to nerve damage — do not eat seeds or drink large amounts of leaf tea. Not a cancer treatment.");

F("tamarind", "Tamarind", "Tamarindus indica", "Fabaceae (pea family)", "long", "#6b3a1a", "Winter to spring", ["digestion", "kitchen"],
  "Tamarind is a pod fruit with tangy-sweet sticky pulp. It is used in cooking from India to Mexico. It provides magnesium, potassium and polyphenols. It is a traditional natural laxative. Its tart flavor balances curries, chutneys and drinks.",
  ["Magnesium", "Potassium", "Iron", "Fiber", "Tartaric acid"],
  [["T", "Digestion", "Traditionally used as a gentle laxative."], ["P", "Antioxidants", "Rich in polyphenols."], ["T", "Cooling", "Tamarind drinks are traditionally refreshing in heat."]],
  ["Use paste in pad thai and curries.", "Make agua de tamarindo.", "Blend into chutneys.", "Add to marinades."],
  ["1 tbsp paste", 20], "Store pulp blocks in the fridge.",
  "High in natural sugar. May slightly increase absorption of aspirin.");

F("tomato", "Tomato", "Solanum lycopersicum", "Solanaceae (nightshade family)", "round", "#e03a2a", "Summer", ["heart", "men", "skin"],
  "Tomatoes are botanically a fruit and one of the most nutritious foods in the kitchen. They are the richest common source of lycopene, an antioxidant linked to heart and prostate health. Cooking tomatoes with olive oil makes lycopene easier to absorb. They provide vitamin C, potassium and vitamin K. Lycopene may also help protect skin from sunburn.",
  ["Lycopene", "Vitamin C", "Potassium", "Vitamin K", "Folate"],
  [["P", "Heart health", "Higher tomato and lycopene intake is linked with lower heart disease risk."], ["P", "Prostate health", "Men who eat more cooked tomatoes have lower prostate cancer risk in observational studies."], ["P", "Sun protection", "Tomato paste with olive oil reduced sunburn redness in a small trial."]],
  ["Cook into sauces with olive oil.", "Slice fresh with basil and mozzarella.", "Roast cherry tomatoes.", "Blend into gazpacho."],
  ["1 medium tomato", 123], "Store at room temperature for best flavor until ripe.",
  "Tomatoes may trigger heartburn. Green tomato leaves and stems contain solanine.");

F("yuzu", "Yuzu", "Citrus junos", "Rutaceae (citrus family)", "citrus", "#e8c83a", "Winter", ["immunity", "calming"],
  "Yuzu is a fragrant Japanese citrus with a flavor between lemon, grapefruit and mandarin. It has more vitamin C than a lemon. Its aromatic peel is prized in Japanese cooking. A yuzu bath on the winter solstice is a Japanese tradition for health. Its scent has been studied for relaxation.",
  ["Vitamin C", "Flavonoids", "Limonene"],
  [["P", "Calm", "Inhaling yuzu scent reduced stress markers in a small study."], ["P", "Immunity", "Rich in vitamin C."], ["P", "Blood flow", "Yuzu peel compounds supported blood flow in lab studies."]],
  ["Use juice in ponzu sauce.", "Grate zest over dishes.", "Make yuzu tea with honey (yuja-cha).", "Add to dressings."],
  ["1 tbsp juice", 15], "Usually sold as juice or marmalade outside Asia.",
  "Generally safe.");

F("honeyberry", "Honeyberry (Haskap)", "Lonicera caerulea", "Caprifoliaceae (honeysuckle family)", "long", "#3a3a7a", "Early summer", ["heart", "immunity"],
  "Honeyberries, or haskap, are elongated blue berries from cold northern regions. They taste like a mix of blueberry and raspberry. They are very rich in anthocyanins and vitamin C. They ripen earlier than any other berry. They are popular in Japan and Canada.",
  ["Anthocyanins", "Vitamin C", "Fiber", "Vitamin A"],
  [["P", "Antioxidants", "Higher anthocyanin levels than blueberries."], ["P", "Memory", "Haskap extract improved some memory measures in a small trial."], ["P", "Immunity", "Good source of vitamin C."]],
  ["Eat fresh.", "Bake into muffins.", "Make jam.", "Add to smoothies."],
  ["1 cup", 140], "Refrigerate and eat within a few days, or freeze.",
  "Only eat edible haskap varieties — many other honeysuckle berries are toxic.");

F("cucumber", "Cucumber", "Cucumis sativus", "Cucurbitaceae (gourd family)", "long", "#4f8a3a", "Summer", ["skin", "kitchen"],
  "Cucumbers are botanically a fruit and are about 95% water. They are very hydrating and low in calories. They provide vitamin K and small amounts of antioxidants. Cucumber slices are a classic for soothing puffy eyes. They add crisp freshness to salads and water.",
  ["Water (95%)", "Vitamin K", "Potassium", "Cucurbitacins"],
  [["T", "Hydration", "Mostly water."], ["T", "Skin soothing", "Cool slices calm puffy eyes and sunburn."], ["P", "Bone health", "Provides vitamin K."]],
  ["Slice into salads.", "Add to water with mint.", "Make tzatziki.", "Pickle."],
  ["1 cup slices", 120], "Choose firm cucumbers. Refrigerate for up to a week.",
  "Generally safe; very bitter cucumbers can upset the stomach.");

F("mamey-sapote", "Mamey Sapote", "Pouteria sapota", "Sapotaceae", "pear", "#e0603a", "Summer", ["energy", "skin"],
  "Mamey sapote is a large tropical fruit with salmon-colored flesh. It tastes like sweet potato, pumpkin and almond. It is rich in vitamin B6, vitamin C, vitamin E and fiber. It is a beloved milkshake fruit in Cuba and Mexico. It is creamy and filling.",
  ["Vitamin B6", "Vitamin C", "Vitamin E", "Fiber", "Potassium"],
  [["P", "Energy and mood", "Rich in vitamin B6, needed for energy and brain messengers."], ["P", "Skin", "Vitamins C and E protect skin."], ["P", "Digestion", "Very high in fiber."]],
  ["Blend into batidos (milkshakes).", "Scoop fresh.", "Make ice cream.", "Use in desserts."],
  ["½ cup", 100], "Ripe when it gives slightly and the flesh under a scratch is pink-orange.",
  "Generally safe.");

F("ackee", "Ackee", "Blighia sapida", "Sapindaceae (soapberry family)", "pear", "#d8402a", "Year-round", ["kitchen"],
  "Ackee is Jamaica's national fruit, famous in the dish ackee and saltfish. When properly ripened and cooked, its creamy arils taste buttery and mild. It provides healthy fats, protein and fiber. However, unripe ackee contains a dangerous toxin. It must only be eaten when it opens naturally on the tree.",
  ["Healthy fats", "Protein", "Fiber", "Vitamin C"],
  [["T", "Healthy fats", "Ripe ackee is rich in oleic and linoleic acids."], ["T", "Protein", "Provides more protein than most fruits."], ["T", "Cultural staple", "A traditional, nourishing Caribbean food."]],
  ["Cook canned ackee with saltfish, onions and peppers.", "Serve with fried dumplings.", "Use only canned or properly prepared ackee.", "Never eat unripe ackee."],
  ["½ cup cooked", 100], "Buy canned ackee from reputable brands.",
  "Unripe ackee contains hypoglycin A, which causes 'Jamaican vomiting sickness' and can drop blood sugar fatally. Only eat fruit that has opened naturally, with the seeds and pink membrane removed.");

F("bitter-melon", "Bitter Melon", "Momordica charantia", "Cucurbitaceae (gourd family)", "long", "#4a8a3a", "Summer", ["heart", "digestion"],
  "Bitter melon is a warty green fruit used as a vegetable across Asia. It is one of the bitterest foods eaten. It contains charantin and polypeptide-p, compounds studied for lowering blood sugar. It provides vitamin C and folate. It is traditionally used to support digestion and blood sugar.",
  ["Vitamin C", "Folate", "Charantin", "Fiber"],
  [["P", "Blood sugar", "Bitter melon lowered blood sugar modestly in some studies, though results are mixed."], ["T", "Digestion", "Bitter foods stimulate digestive juices."], ["P", "Antioxidants", "Contains polyphenols."]],
  ["Stir-fry with garlic and egg.", "Stuff and steam.", "Add to curries.", "Salt slices first to reduce bitterness."],
  ["½ cup cooked", 60], "Choose firm, green fruit. Refrigerate.",
  "Can lower blood sugar further with diabetes medicine. Avoid during pregnancy. Seeds can be toxic to children.");

F("amla", "Amla (Indian Gooseberry)", "Phyllanthus emblica", "Phyllanthaceae", "round", "#a8c25a", "Winter", ["immunity", "skin", "heart"],
  "Amla is a sour green fruit central to Ayurveda. It is one of the richest sources of vitamin C. It is the main ingredient in the classic tonic chyawanprash and triphala. Studies suggest amla may help with cholesterol and blood sugar. It is traditionally used for healthy hair and skin.",
  ["Vitamin C (very high)", "Polyphenols", "Tannins", "Fiber"],
  [["P", "Cholesterol", "Amla extract lowered LDL cholesterol in several small trials."], ["P", "Blood sugar", "Amla powder lowered blood sugar in small studies."], ["T", "Hair and skin", "A traditional tonic for strong hair."]],
  ["Take amla powder in water or smoothies.", "Eat pickled amla.", "Drink amla juice diluted.", "Use amla oil for hair."],
  ["1 fresh fruit or 1 tsp powder", 5], "Fresh amla is seasonal; powder and juice are available year-round.",
  "Very sour. May slow blood clotting.");

F("baobab", "Baobab", "Adansonia digitata", "Malvaceae (mallow family)", "long", "#c8b48a", "Year-round (powder)", ["immunity", "digestion"],
  "Baobab is the fruit of Africa's iconic 'tree of life.' Its pulp dries naturally in the pod into a tangy powder. It is very rich in vitamin C and soluble fiber. It also provides calcium, potassium and magnesium. It adds a citrusy tang to smoothies.",
  ["Vitamin C", "Soluble fiber", "Calcium", "Potassium", "Magnesium"],
  [["P", "Gut health", "Baobab fiber acts as a prebiotic."], ["P", "Blood sugar", "Adding baobab to bread lowered its blood sugar response in a study."], ["P", "Immunity", "Very high in vitamin C."]],
  ["Stir powder into water or smoothies.", "Add to yogurt or oatmeal.", "Mix into energy bars.", "Use in dressings."],
  ["1–2 tsp powder", 8], "Store powder airtight.",
  "Generally safe.");

F("camu-camu", "Camu Camu", "Myrciaria dubia", "Myrtaceae (myrtle family)", "berry", "#c8203a", "Year-round (powder)", ["immunity", "calming"],
  "Camu camu is a sour Amazonian berry with one of the highest vitamin C contents of any food. It is usually sold as powder. It is rich in polyphenols and ellagic acid. Small studies suggest it may calm inflammation. It is a natural way to boost vitamin C.",
  ["Vitamin C (extremely high)", "Polyphenols", "Ellagic acid"],
  [["P", "Inflammation", "Camu camu juice lowered inflammation markers in smokers in a small study."], ["P", "Immunity", "Very high vitamin C."], ["P", "Antioxidants", "Rich in polyphenols."]],
  ["Stir ¼–½ tsp powder into smoothies or juice.", "Add to yogurt.", "Mix into water with honey.", "Blend into energy balls."],
  ["½ tsp powder", 2], "Store powder airtight and away from light.",
  "Too much may cause stomach upset due to high vitamin C.");

F("boysenberry", "Boysenberry", "Rubus ursinus × idaeus", "Rosaceae (rose family)", "berry", "#5a1f4a", "Summer", ["heart", "immunity"],
  "Boysenberries are large, juicy hybrid berries made from blackberries and raspberries. They are rich in anthocyanins, fiber and vitamin C. Studies suggest boysenberry polyphenols may support lung and blood vessel health. They are sweet-tart and delicious in pies and jams. They were made famous by Knott's Berry Farm in California.",
  ["Anthocyanins", "Fiber", "Vitamin C", "Vitamin K"],
  [["P", "Antioxidants", "Very high in anthocyanins."], ["P", "Blood vessels", "Boysenberry juice improved blood vessel function in animal studies."], ["T", "Digestion", "High fiber."]],
  ["Bake into pies.", "Make jam.", "Top yogurt.", "Blend into smoothies."],
  ["1 cup", 132], "Usually sold frozen or as jam.",
  "Generally safe.");

F("sugar-apple", "Sugar Apple (Sweetsop)", "Annona squamosa", "Annonaceae (custard apple family)", "spiky", "#9ac06a", "Summer to autumn", ["energy", "immunity"],
  "Sugar apple is a sweet tropical fruit with knobby green segments. Its creamy flesh tastes like custard. It provides vitamin C, vitamin B6 and fiber. It's rich in natural sugars for energy. It is a favorite in India and the Caribbean.",
  ["Vitamin C", "Vitamin B6", "Fiber", "Magnesium"],
  [["T", "Energy", "Rich in natural sugars."], ["P", "Immunity", "Good source of vitamin C."], ["P", "Antioxidants", "Contains polyphenols."]],
  ["Pull apart segments and eat the flesh.", "Blend into milkshakes.", "Make ice cream.", "Eat chilled."],
  ["½ fruit", 100], "Ripe when segments separate slightly.",
  "Seeds are toxic — do not eat or crush them.");

F("citron", "Citron (Etrog)", "Citrus medica", "Rutaceae (citrus family)", "citrus", "#e8d84a", "Autumn", ["immunity", "digestion"],
  "Citron is one of the original citrus fruits, with a thick, fragrant peel. It is used as the etrog during the Jewish festival of Sukkot. Its peel is candied for baking. It provides vitamin C and fiber. Its aromatic oils are prized in perfume.",
  ["Vitamin C", "Fiber", "Flavonoids"],
  [["T", "Digestion", "Citron peel is traditionally used for nausea and digestion."], ["P", "Immunity", "Provides vitamin C."], ["P", "Antioxidants", "Contains flavonoids."]],
  ["Candy the peel.", "Use zest in baking.", "Infuse in syrups.", "Slice thin into salads."],
  ["1 tbsp candied peel", 15], "Store whole fruit in the fridge.",
  "Candied peel is high in sugar.");

F("serviceberry", "Serviceberry (Saskatoon)", "Amelanchier alnifolia", "Rosaceae (rose family)", "berry", "#4a2a5a", "Early summer", ["heart", "immunity"],
  "Serviceberries, or Saskatoon berries, are sweet North American berries with a nutty almond flavor. They are rich in fiber, iron and manganese. They are full of anthocyanins. They were a key ingredient in Indigenous pemmican. They are delicious fresh or baked.",
  ["Fiber", "Iron", "Manganese", "Anthocyanins"],
  [["P", "Antioxidants", "Rich in anthocyanins."], ["T", "Iron", "Good fruit source of iron."], ["T", "Digestion", "High fiber."]],
  ["Eat fresh.", "Bake into pies.", "Make jam.", "Add to pancakes."],
  ["1 cup", 145], "Refrigerate and use quickly, or freeze.",
  "Seeds contain small amounts of cyanide-forming compounds — eat whole berries normally but don't grind large amounts of seeds.");

F("goldenberry", "Goldenberry", "Physalis peruviana", "Solanaceae (nightshade family)", "berry", "#f0b23a", "Year-round", ["immunity", "skin"],
  "Goldenberries, or cape gooseberries, are small golden fruits wrapped in a papery husk. They taste sweet-tart like pineapple and tomato. They are rich in vitamin A, vitamin C and withanolides. Dried goldenberries make a tangy snack. They are beautiful as a garnish.",
  ["Vitamin A", "Vitamin C", "Fiber", "Withanolides"],
  [["P", "Antioxidants", "Contain withanolides and polyphenols."], ["P", "Immunity", "Good source of vitamin C."], ["P", "Eye health", "Rich in beta-carotene."]],
  ["Eat fresh after removing the husk.", "Dip in chocolate.", "Add dried berries to trail mix.", "Make jam."],
  ["1 cup", 140], "Store in the husk at room temperature or refrigerate.",
  "Unripe berries and husks are toxic — only eat ripe golden fruit.");

F("calamansi", "Calamansi", "Citrus × microcarpa", "Rutaceae (citrus family)", "citrus", "#8ab83a", "Year-round", ["immunity", "respiratory"],
  "Calamansi is a tiny Filipino citrus that tastes like a lime crossed with a mandarin. It is rich in vitamin C. Calamansi juice with honey is a traditional cough remedy in the Philippines. It brightens marinades and dipping sauces. It makes a refreshing juice.",
  ["Vitamin C", "Flavonoids", "Citric acid"],
  [["T", "Coughs", "Calamansi juice with honey is a traditional cough and sore throat remedy."], ["P", "Immunity", "Rich in vitamin C."], ["P", "Antioxidants", "Contains flavonoids."]],
  ["Squeeze into water with honey.", "Add to soy sauce for dipping.", "Use in marinades.", "Make calamansi juice."],
  ["Juice of 3 calamansi", 15], "Refrigerate for up to 2 weeks.",
  "Acid may erode tooth enamel.");

F("pumpkin", "Pumpkin", "Cucurbita pepo", "Cucurbitaceae (gourd family)", "melon", "#e8761e", "Autumn", ["immunity", "skin", "men"],
  "Pumpkin is botanically a fruit, rich in beta-carotene that turns flesh bright orange. It supports eyes, skin and immunity. It is high in fiber and low in calories. Pumpkin seeds are rich in zinc and magnesium, important for men's health and sleep. It's comforting in soups and baking.",
  ["Beta-carotene (vitamin A)", "Fiber", "Vitamin C", "Potassium", "Zinc (seeds)"],
  [["P", "Eye health", "Beta-carotene, lutein and zeaxanthin protect the eyes."], ["P", "Prostate health", "Pumpkin seed oil improved urinary symptoms in men in some trials."], ["P", "Immunity", "Vitamin A supports the immune barrier."]],
  ["Roast cubes with olive oil.", "Make pumpkin soup.", "Add purée to oatmeal or smoothies.", "Roast the seeds."],
  ["1 cup cooked", 245], "Choose heavy, firm pumpkins. Store whole in a cool place for months.",
  "Pumpkin pie and lattes are high in sugar — enjoy the real pumpkin.");

F("black-sapote", "Black Sapote", "Diospyros nigra", "Ebenaceae (ebony family)", "round", "#2a2a1a", "Winter", ["immunity", "energy"],
  "Black sapote is the 'chocolate pudding fruit,' with soft dark flesh that tastes like chocolate custard. It is related to persimmon. It is very rich in vitamin C. It is low in fat and makes a healthy dessert. It must be eaten very ripe and soft.",
  ["Vitamin C", "Fiber", "Potassium"],
  [["P", "Immunity", "Very high in vitamin C."], ["T", "Healthy dessert", "A naturally low-fat chocolate-like treat."], ["P", "Digestion", "Provides fiber."]],
  ["Scoop when very soft.", "Blend with milk for a 'chocolate' smoothie.", "Use in baking instead of chocolate.", "Make mousse."],
  ["½ cup", 100], "Ripe when the skin turns olive-brown and very soft.",
  "Unripe black sapote is bitter and irritating.");

F("bael", "Bael (Wood Apple)", "Aegle marmelos", "Rutaceae (citrus family)", "round", "#c8a83a", "Spring", ["digestion"],
  "Bael is a hard-shelled fruit sacred in India, with aromatic orange pulp. It is a classic Ayurvedic remedy for digestion. Unripe bael is used for diarrhea, while ripe bael is used for constipation. It is rich in vitamin C, fiber and tannins. Bael sharbat is a cooling summer drink.",
  ["Fiber", "Vitamin C", "Tannins", "Mucilage"],
  [["T", "Diarrhea", "Unripe bael's tannins and mucilage firm stools."], ["T", "Constipation", "Ripe bael pulp has a gentle laxative effect."], ["P", "Antimicrobial", "Bael extracts fight gut bacteria in lab studies."]],
  ["Make bael sharbat with water and jaggery.", "Eat ripe pulp.", "Use bael powder.", "Make bael candy."],
  ["½ cup pulp", 100], "Crack the hard shell with a hammer.",
  "May lower blood sugar with diabetes medicine.");

F("raisin", "Raisin", "Vitis vinifera (dried)", "Vitaceae (grape family)", "berry", "#4a2a2a", "Year-round", ["energy", "digestion"],
  "Raisins are dried grapes that concentrate sugar, fiber and minerals. They provide quick energy for exercise. They are rich in potassium, iron and polyphenols. Studies suggest raisins may support blood pressure. They are convenient and long-lasting.",
  ["Fiber", "Potassium", "Iron", "Polyphenols", "Natural sugar"],
  [["P", "Exercise fuel", "Raisins fueled endurance exercise as well as sports chews in a study."], ["P", "Blood pressure", "Eating raisins three times a day lowered blood pressure in a small trial."], ["T", "Digestion", "Provide fiber."]],
  ["Add to oatmeal.", "Mix into trail mix.", "Bake into breads.", "Add to curries and pilafs."],
  ["¼ cup", 40], "Store airtight in a cool place.",
  "High in natural sugar; very toxic to dogs.");
