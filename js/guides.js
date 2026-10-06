// Wellness guides (one page per goal) and safety guides (pregnancy, children, etc.).
// Herbs, fruits and stacks are listed by id; details are pulled from their own data.
// Verses are quoted from the King James Version (public domain).

const TOPIC_GUIDES = [
  {
    id: "sleep", title: "Natural Help for Better Sleep", short: "Sleep", icon: "moon",
    intro: "Good sleep is one of the most powerful things you can do for your health — it repairs the body, steadies mood and strengthens immunity. Most adults need 7–9 hours a night. Calming herbs can help you wind down, but they work best alongside a steady sleep routine. Here is what the research and generations of tradition suggest.",
    lifestyle: ["Go to bed and wake up at the same times every day, even on weekends.", "Get bright daylight in the morning and dim the lights after dinner.", "Put screens away 60 minutes before bed.", "Avoid caffeine after early afternoon and alcohol close to bedtime.", "Keep your bedroom cool, dark and quiet, and reserve your bed for sleep."],
    herbs: ["chamomile", "valerian", "lemon-balm", "passionflower", "lavender", "ashwagandha"],
    fruits: ["tart-cherry", "kiwi", "cherry", "jujube"], stacks: ["restful-sleep"],
    verse: { text: "I will both lay me down in peace, and sleep: for thou, LORD, only makest me dwell in safety.", ref: "Psalm 4:8" },
    cautions: "Calming herbs add to the drowsiness of sleep medicines, anxiety medicines, opioid pain relievers and alcohol — don't combine them without your doctor. Never drive after taking sedating herbs.",
    doctor: ["Loud snoring, gasping or stopping breathing at night (possible sleep apnea)", "Trouble sleeping most nights for more than 3 months", "Falling asleep during the day, especially while driving", "Restless, crawling feelings in the legs at night"]
  },
  {
    id: "stress", title: "Natural Help for Stress & Anxiety", short: "Stress & Anxiety", icon: "leaf",
    intro: "Everyone feels stress, but when it lingers it can disturb sleep, digestion, mood and the immune system. Adaptogens like ashwagandha and holy basil help the body handle stress more evenly, while gentle nervines like lemon balm and lavender ease tension in the moment. Pair them with simple daily practices that calm the nervous system.",
    lifestyle: ["Take three slow breaths, breathing out longer than you breathe in, several times a day.", "Move your body daily — a 20-minute walk lowers stress hormones.", "Write down worries, then one thing you're thankful for.", "Spend time in prayer, quiet reflection or nature.", "Limit caffeine and news before bed."],
    herbs: ["ashwagandha", "lavender", "holy-basil", "lemon-balm", "rhodiola", "passionflower"],
    fruits: ["blueberry", "avocado", "orange", "banana"], stacks: ["calm-resilience"],
    verse: { text: "Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.", ref: "John 14:27" },
    cautions: "Never combine St. John's wort with antidepressants. Calming herbs can add to sleep and anxiety medicines. Herbs are not a substitute for treatment of anxiety disorders or depression.",
    doctor: ["Panic attacks or anxiety that stops you doing daily activities", "Low mood most days for two weeks or more", "Thoughts of harming yourself — call or text 988 (U.S. Suicide & Crisis Lifeline) right away"]
  },
  {
    id: "digestion", title: "Natural Help for Digestion & Bloating", short: "Digestion", icon: "cup",
    intro: "A comfortable gut affects energy, mood and immunity. Many of the best-studied digestive herbs are already in your kitchen: peppermint relaxes the intestines, ginger settles nausea, and fennel and caraway relieve gas. Fiber-rich fruits like kiwi and prunes keep things moving. Small daily habits make the biggest difference.",
    lifestyle: ["Eat slowly and chew well.", "Take a 10-minute walk after meals.", "Drink water through the day and add fiber gradually.", "Notice trigger foods — a food diary helps.", "Eat your last meal 2–3 hours before bed."],
    herbs: ["peppermint", "ginger", "fennel", "caraway", "chamomile", "dandelion"],
    fruits: ["kiwi", "prune", "papaya", "pineapple"], stacks: ["digestive-comfort", "gentle-cleanse"],
    verse: { text: "Whether therefore ye eat, or drink, or whatsoever ye do, do all to the glory of God.", ref: "1 Corinthians 10:31" },
    cautions: "Peppermint can worsen heartburn. Bitter herbs like dandelion may trigger gallbladder pain if you have gallstones. Ongoing digestive symptoms need a medical check.",
    doctor: ["Blood in your stool or black, tarry stools", "Unexplained weight loss or trouble swallowing", "Severe or worsening belly pain", "A change in bowel habits lasting more than 3 weeks", "Age 45 or older and not yet screened for colon cancer"]
  },
  {
    id: "immunity", title: "Natural Support for the Immune System", short: "Immune Support", icon: "shield",
    intro: "Your immune system depends on the basics: sleep, nourishing food, movement and managing stress. Some herbs give extra support during cold season — elderberry and echinacea have been studied for shortening colds, and garlic for preventing them. Vitamin C-rich fruits help immune cells do their job.",
    lifestyle: ["Sleep 7–9 hours — even one short night weakens immune defenses.", "Wash hands often, especially before eating.", "Eat a rainbow of fruits and vegetables every day.", "Stay active and manage stress.", "Stay up to date with the vaccines your doctor recommends."],
    herbs: ["elderberry", "echinacea", "garlic", "astragalus", "ginger", "holy-basil"],
    fruits: ["acerola", "guava", "kiwi", "orange"], stacks: ["immune-syrup"],
    verse: { text: "Beloved, I wish above all things that thou mayest prosper and be in health, even as thy soul prospereth.", ref: "3 John 1:2" },
    cautions: "Immune-stimulating herbs like echinacea and astragalus are not for people with autoimmune conditions or on immune-suppressing medicines. Always cook elderberries.",
    doctor: ["Frequent, severe or unusual infections", "Infections that don't improve with usual treatment", "Fever with a stiff neck, rash or confusion — seek urgent care"]
  },
  {
    id: "cold-flu", title: "Natural Comfort for Colds, Flu & Coughs", short: "Colds & Flu", icon: "leaf",
    intro: "Most colds clear on their own in 7–10 days, but the right herbs can make you more comfortable. Thyme loosens coughs, marshmallow root soothes a raw throat, eucalyptus steam opens a stuffy nose, and elderberry may shorten the flu when started early. Rest and fluids remain the foundation of recovery.",
    lifestyle: ["Rest — your body heals while you sleep.", "Drink plenty of warm fluids: tea, broth and water.", "Gargle with warm salt water for a sore throat.", "Use a humidifier or steamy shower to loosen mucus.", "Stay home to protect others while you're sick."],
    herbs: ["thyme", "elderberry", "ginger", "marshmallow-root", "eucalyptus", "mullein"],
    fruits: ["lemon", "kiwi", "pineapple", "orange"], stacks: ["throat-cough", "clear-breathing", "immune-syrup"],
    verse: { text: "The Spirit of God hath made me, and the breath of the Almighty hath given me life.", ref: "Job 33:4" },
    cautions: "Never give honey to babies under 1. Keep eucalyptus oil away from young children's faces and never swallow it. Licorice should be short-term only.",
    doctor: ["Trouble breathing, chest pain or blue lips — call emergency services", "Fever above 103°F (39.4°C) or lasting more than 3 days", "Symptoms that improve and then suddenly get worse", "A cough lasting more than 3 weeks", "Babies under 3 months with any fever"]
  },
  {
    id: "heart", title: "Natural Support for Heart Health & Blood Pressure", short: "Heart & Blood Pressure", icon: "heart",
    intro: "Heart disease is the leading cause of death worldwide, yet much of it can be prevented through daily habits. Hibiscus tea and garlic have lowered blood pressure in clinical trials, and a Mediterranean diet rich in olive oil, berries and pomegranate protects the heart. Herbs support — but never replace — blood pressure and heart medicines.",
    lifestyle: ["Walk at least 30 minutes on most days.", "Cook with olive oil, garlic and plenty of vegetables.", "Cut back on salt, processed meats and sugary drinks.", "Don't smoke, and limit alcohol.", "Check your blood pressure regularly at home."],
    herbs: ["hibiscus", "garlic", "hawthorn", "olive-leaf", "green-tea", "cinnamon"],
    fruits: ["pomegranate", "blueberry", "avocado", "olive"], stacks: ["heart-harmony"],
    verse: { text: "Keep thy heart with all diligence; for out of it are the issues of life.", ref: "Proverbs 4:23" },
    cautions: "Several heart herbs add to blood pressure and heart medicines. Grapefruit interacts with many heart medicines. Licorice raises blood pressure. Always involve your doctor.",
    doctor: ["Chest pain, pressure or pain spreading to the arm or jaw — call emergency services", "Blood pressure above 180/120", "Sudden shortness of breath, fainting or a racing irregular heartbeat", "Swelling in the legs with breathlessness"]
  },
  {
    id: "blood-sugar", title: "Natural Support for Healthy Blood Sugar", short: "Blood Sugar", icon: "leaf",
    intro: "Steady blood sugar means steadier energy, mood and long-term health. Fiber-rich meals, regular movement and good sleep are the foundation. Some herbs and spices — like fenugreek and cinnamon — have modestly lowered blood sugar in studies. If you take diabetes medicine, these can add up, so check your levels more often.",
    lifestyle: ["Fill half your plate with non-starchy vegetables.", "Pair carbohydrates with protein, fiber or healthy fat.", "Take a 10–15 minute walk after meals.", "Choose whole fruit over juice.", "Sleep well — poor sleep raises blood sugar."],
    herbs: ["fenugreek", "cinnamon", "holy-basil", "ginseng", "olive-leaf", "moringa"],
    fruits: ["bitter-melon", "blueberry", "apple", "raspberry"], stacks: [],
    verse: { text: "Prove thy servants, I beseech thee, ten days; and let them give us pulse to eat, and water to drink.", ref: "Daniel 1:12" },
    cautions: "Blood-sugar herbs can push sugar too low with insulin or sulfonylureas. Check your blood sugar more often when starting an herb, and never stop diabetes medicine on your own.",
    doctor: ["Extreme thirst, frequent urination or blurred vision", "Blood sugar readings repeatedly above your target", "Shakiness, sweating or confusion (low blood sugar)", "Slow-healing sores on the feet"]
  },
  {
    id: "skin", title: "Natural Care for Healthy Skin", short: "Skin", icon: "drop",
    intro: "Your skin reflects what you eat, how you sleep and how you protect it. Calendula and aloe soothe and heal, tea tree oil helps blemishes, and gotu kola supports collagen. From the inside, fruits rich in vitamin C and carotenoids help protect against sun damage and support repair.",
    lifestyle: ["Wear sunscreen every day — it's the best anti-aging step there is.", "Cleanse gently and moisturize while skin is damp.", "Drink water and eat colorful fruits and vegetables.", "Sleep 7–9 hours — skin repairs overnight.", "Patch-test any new product on a small area first."],
    herbs: ["calendula", "aloe-vera", "tea-tree", "gotu-kola", "rose", "witch-hazel"],
    fruits: ["tomato", "mango", "avocado", "sea-buckthorn"], stacks: ["glowing-skin"],
    verse: { text: "I will praise thee; for I am fearfully and wonderfully made: marvellous are thy works; and that my soul knoweth right well.", ref: "Psalm 139:14" },
    cautions: "Tea tree oil must always be diluted and never swallowed. Calendula and other daisy-family herbs can cause allergy. Stop any product that causes redness or itching.",
    doctor: ["A mole that changes size, shape or color, or bleeds", "A sore that doesn't heal in 3 weeks", "Severe acne, eczema or a rash with fever"]
  },
  {
    id: "hair", title: "Natural Care for Hair & Nails", short: "Hair & Nails", icon: "leaf",
    intro: "Strong hair and nails depend on protein, iron, zinc and gentle care. Rosemary oil regrew hair about as well as minoxidil in one study, and mineral-rich nettle and horsetail are traditional hair tonics. If hair loss is sudden or patchy, a doctor should check for thyroid problems or low iron.",
    lifestyle: ["Eat enough protein, iron and zinc.", "Massage your scalp for a few minutes daily.", "Limit heat styling and tight hairstyles.", "Manage stress — it can trigger shedding months later.", "Be gentle with nails and keep them moisturized."],
    herbs: ["rosemary", "nettle", "horsetail", "saw-palmetto", "oat-straw", "neem"],
    fruits: ["pumpkin", "avocado", "amla", "guava"], stacks: ["hair-nails"],
    verse: { text: "But even the very hairs of your head are all numbered. Fear not therefore: ye are of more value than many sparrows.", ref: "Luke 12:7" },
    cautions: "Horsetail should be thiaminase-free and used short-term. Neem oil is for the scalp only — never swallow it.",
    doctor: ["Sudden, patchy or rapid hair loss", "Hair loss with fatigue, weight changes or feeling cold (possible thyroid problem)", "Brittle, spoon-shaped nails (possible low iron)"]
  },
  {
    id: "joints", title: "Natural Help for Joints & Aches", short: "Joints & Pain", icon: "leaf",
    intro: "Joint pain often comes from wear and tear, inflammation or overuse. Turmeric and ginger calm the same inflammation pathways targeted by common pain relievers, and rose hip powder has eased osteoarthritis pain in trials. Movement is medicine for joints — gentle, regular activity keeps them lubricated and strong.",
    lifestyle: ["Keep moving: walking, swimming and cycling are joint-friendly.", "Strengthen the muscles around sore joints.", "Maintain a healthy weight — every pound lost takes pressure off the knees.", "Use warmth for stiffness and cold for swelling.", "Eat oily fish, olive oil and colorful fruits."],
    herbs: ["turmeric", "ginger", "rose-hips", "arnica", "cayenne", "nettle"],
    fruits: ["tart-cherry", "cherry", "pineapple", "olive"], stacks: ["golden-joint"],
    verse: { text: "He healeth the broken in heart, and bindeth up their wounds.", ref: "Psalm 147:3" },
    cautions: "Turmeric and ginger supplements may add to bleeding with blood thinners. Arnica is for unbroken skin only and must never be swallowed.",
    doctor: ["A hot, red, swollen joint, especially with fever", "Joint pain after an injury, or you can't bear weight", "Morning stiffness lasting more than an hour (possible inflammatory arthritis)", "Pain that wakes you at night"]
  },
  {
    id: "energy", title: "Natural Support for Energy & Focus", short: "Energy & Focus", icon: "sun",
    intro: "Lasting energy comes from sleep, steady blood sugar, movement and purpose — not just caffeine. Green tea combines caffeine with calming L-theanine for smoother focus, rhodiola reduces fatigue during stressful times, and ginseng supports stamina. Natural sugars in dates and bananas give quick fuel for activity.",
    lifestyle: ["Get morning daylight to set your body clock.", "Eat regular meals with protein and fiber.", "Drink water — mild dehydration causes fatigue.", "Take short movement breaks every hour.", "Protect your sleep."],
    herbs: ["green-tea", "rhodiola", "ginseng", "ashwagandha", "yerba-mate", "moringa"],
    fruits: ["banana", "date", "raisin", "coconut"], stacks: ["morning-focus"],
    verse: { text: "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.", ref: "Isaiah 40:31" },
    cautions: "Caffeine-containing herbs add to ADHD stimulants and can raise blood pressure. Ginseng and rhodiola can disturb sleep if taken late in the day.",
    doctor: ["Tiredness lasting more than a few weeks despite good sleep", "Fatigue with shortness of breath, pale skin or feeling cold (possible anemia or thyroid problem)", "Low mood or loss of interest in things you enjoy"]
  },
  {
    id: "memory", title: "Natural Support for Memory & Brain Health", short: "Memory & Brain", icon: "sun",
    intro: "A healthy brain thrives on sleep, exercise, social connection and learning. Bacopa improved memory after 12 weeks in several trials, and the aroma of rosemary has been linked with better alertness. Berries rich in anthocyanins, like blueberries, support memory as we age.",
    lifestyle: ["Exercise regularly — it grows new brain connections.", "Keep learning: read, memorize scripture, learn a skill.", "Stay connected with friends and family.", "Sleep 7–9 hours — the brain clears waste during sleep.", "Protect your hearing and control blood pressure."],
    herbs: ["bacopa", "ginkgo", "rosemary", "sage", "gotu-kola", "green-tea"],
    fruits: ["blueberry", "honeyberry", "pomegranate", "avocado"], stacks: ["morning-focus"],
    verse: { text: "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.", ref: "2 Timothy 1:7" },
    cautions: "Ginkgo increases bleeding risk, especially with blood thinners or before surgery. Bacopa can upset the stomach — take it with food.",
    doctor: ["Memory problems that affect daily life or that others notice", "Getting lost in familiar places", "Sudden confusion, slurred speech or face drooping — call emergency services (possible stroke)"]
  },
  {
    id: "womens-cycle", title: "Natural Comfort for Your Monthly Cycle", short: "Monthly Cycle", icon: "leaf",
    intro: "Cramps, bloating and mood changes are common, but they don't have to rule your month. Chasteberry is one of the best-studied herbs for PMS, while ginger and fennel eased period pain about as well as common pain relievers in small trials. Warmth, rest and nourishing food all help.",
    lifestyle: ["Use a hot water bottle on your lower belly for cramps.", "Keep gently active — walking and stretching ease cramps.", "Eat iron-rich foods during and after your period.", "Cut back on salt and caffeine before your period to reduce bloating.", "Track your cycle so you can plan ahead."],
    herbs: ["chasteberry", "ginger", "fennel", "raspberry-leaf", "chamomile", "saffron"],
    fruits: ["banana", "raspberry", "pomegranate", "date"], stacks: ["cycle-comfort"],
    verse: { text: "Strength and honour are her clothing; and she shall rejoice in time to come.", ref: "Proverbs 31:25" },
    cautions: "Chasteberry interferes with hormonal birth control and fertility treatment. Avoid hormonal herbs if you are pregnant or trying to conceive.",
    doctor: ["Bleeding that soaks a pad or tampon every hour", "Severe pain that stops daily activities", "Missed periods (when not pregnant) or bleeding between periods", "PMS mood changes that feel overwhelming"]
  },
  {
    id: "menopause", title: "Natural Support Through Menopause", short: "Menopause", icon: "leaf",
    intro: "Menopause is a natural season of life, but hot flushes, poor sleep and mood changes can be challenging. Sage reduced hot flushes in small studies, and red clover and hops contain plant estrogens. Protecting bones and heart becomes especially important now, so strength training and calcium-rich foods matter.",
    lifestyle: ["Dress in layers and keep your bedroom cool.", "Do weight-bearing exercise and strength training for bones.", "Eat calcium-rich foods and get enough vitamin D.", "Limit alcohol, spicy foods and hot drinks if they trigger flushes.", "Keep a steady sleep routine."],
    herbs: ["sage", "red-clover", "hops", "valerian", "anise", "st-johns-wort"],
    fruits: ["prune", "fig", "kiwi", "tart-cherry"], stacks: ["restful-sleep"],
    verse: { text: "And even to your old age I am he; and even to hoar hairs will I carry you:", ref: "Isaiah 46:4" },
    cautions: "Avoid plant-estrogen herbs with breast cancer or other hormone-sensitive conditions. St. John's wort interacts with many medicines and should only be used with your doctor.",
    doctor: ["Any bleeding after menopause", "Symptoms that seriously affect your sleep, work or relationships", "Low mood or anxiety", "Questions about bone density testing or hormone therapy"]
  },
  {
    id: "mens-health", title: "Natural Support for Men's Health", short: "Men's Health", icon: "leaf",
    intro: "Men's health covers energy, strength, heart, prostate and hormones. Ashwagandha raised testosterone in several trials, nettle root and saw palmetto are traditional prostate herbs, and lycopene from cooked tomatoes and watermelon supports prostate and heart health. Regular check-ups catch problems early.",
    lifestyle: ["Do strength training at least twice a week.", "Sleep 7–9 hours — testosterone is made during deep sleep.", "Keep a healthy waistline.", "Limit alcohol and don't smoke.", "Get regular check-ups, including blood pressure and prostate screening as advised."],
    herbs: ["ashwagandha", "fenugreek", "nettle", "saw-palmetto", "ginseng", "ginger"],
    fruits: ["pomegranate", "tomato", "pumpkin", "watermelon"], stacks: ["testosterone-support"],
    verse: { text: "Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.", ref: "Joshua 1:9" },
    cautions: "Hormonal herbs are not for anyone with prostate cancer or on testosterone therapy. Ginseng can raise blood pressure and affect blood sugar.",
    doctor: ["Changes in urination: weak stream, getting up often at night, or blood", "Erectile problems — they can be an early sign of heart disease", "Constant fatigue, low drive or mood changes"]
  }
];

const SAFETY_GUIDES = [
  {
    id: "pregnancy", ix: "pregnancy", title: "Herbs & Fruits During Pregnancy", short: "Pregnancy",
    intro: "Pregnancy is a time to be especially careful. Many herbs are safe in normal food amounts — a sprinkle of basil or cinnamon — but teas, capsules and extracts deliver much stronger doses. Some herbs can stimulate the womb, act like hormones, or affect a growing baby. This guide explains what to know at each stage.",
    sections: [
      { h: "The golden rules", list: ["Culinary amounts of herbs and spices in food are generally fine.", "Ask your midwife or doctor before any herbal tea, capsule, tincture or extract.", "Never take essential oils by mouth, and dilute any oil used on the skin.", "Avoid 'detox', weight-loss and 'cleanse' products entirely.", "Introduce one new thing at a time so you can spot any reaction."] },
      { h: "First trimester (weeks 1–13)", p: "This is when the baby's organs form, so it's the most important time for caution. Keep to food amounts of herbs. For morning sickness, small frequent meals, plain crackers, and ginger (up to about 1 g dried a day, or a cup of weak ginger tea) are widely used — ask your midwife about vitamin B6 too." },
      { h: "Second trimester (weeks 14–27)", p: "Many women feel better now. Keep avoiding the herbs listed below. Heartburn and constipation are common: try smaller meals, staying upright after eating, and fiber-rich fruits like kiwi and prunes with plenty of water. Peppermint can make heartburn worse." },
      { h: "Third trimester (weeks 28–40)", p: "Some midwives suggest red raspberry leaf tea from around 32 weeks, and studies suggest eating about six dates a day from 36 weeks may help labor — only with your midwife's agreement. Avoid herbs that stimulate the womb until your care team says otherwise." },
      { h: "Gentle comfort for common complaints", list: ["Nausea: small frequent meals, ginger (food amounts or up to 1 g dried a day), fresh air, lemon.", "Constipation: kiwi, prunes, pears, water and gentle walking.", "Heartburn: smaller meals, avoid lying down after eating; avoid peppermint.", "Trouble sleeping: a pregnancy pillow, a warm bath and a calm routine — ask before using calming herbs."] }
    ],
    emergency: ["Vaginal bleeding or fluid leaking", "Severe headache, vision changes or sudden swelling of the face and hands", "Severe belly pain", "Fewer baby movements than usual", "Fever, or vomiting so severe you can't keep fluids down"]
  },
  {
    id: "breastfeeding", ix: "breastfeeding", title: "Herbs & Fruits While Breastfeeding", short: "Breastfeeding",
    intro: "What you eat and drink can pass into breast milk, usually in small amounts. Food amounts of herbs and fruits are almost always fine, but concentrated teas and supplements need more care. A few herbs may lower milk supply, while others are traditionally used to support it.",
    sections: [
      { h: "The golden rules", list: ["Food amounts of herbs and spices are generally safe.", "Try one herbal tea at a time and watch your baby for fussiness, rash, sleepiness or feeding changes.", "Avoid essential oils near your baby's face.", "Ask your doctor or a lactation consultant before supplements."] },
      { h: "Supporting milk supply", p: "Frequent feeding or pumping, good latch, rest, food and fluids are the most important ways to build supply. Fenugreek and fennel are traditionally used to support milk, but evidence is limited and fenugreek can upset some babies' stomachs. Talk to a lactation consultant first." },
      { h: "Herbs that may lower supply", p: "Sage, and large amounts of peppermint and parsley, are traditionally used to reduce milk supply — enjoy them only in small food amounts if you want to keep your supply up." }
    ],
    emergency: ["Your baby is unusually sleepy, floppy or hard to wake", "Your baby has a rash, swelling or trouble breathing", "Fewer wet diapers than usual", "A hot, red, painful area on your breast with fever (possible mastitis)"]
  },
  {
    id: "children", ix: "children", title: "Herbs & Fruits for Children", short: "Children",
    intro: "Children are not small adults — their bodies process herbs differently, and some products that are safe for grown-ups can be dangerous for them. Fresh fruits and gentle culinary herbs in food are wonderful for kids. Medicinal herbs, essential oils and supplements need a pediatrician's guidance.",
    sections: [
      { h: "Babies under 1 year", list: ["Never give honey — it can cause infant botulism.", "Don't give herbal teas or remedies unless your pediatrician advises it.", "Never use essential oils like eucalyptus or peppermint near a baby's face.", "Breast milk or formula is all a baby under 6 months needs."] },
      { h: "Toddlers and young children (1–5)", list: ["Cut grapes and cherry tomatoes lengthwise and remove pits and seeds to prevent choking.", "Offer a rainbow of fresh fruits daily.", "Weak chamomile tea is traditionally used, but ask your pediatrician first.", "Keep all oils, supplements and medicines locked away."] },
      { h: "School-age children (6–12)", list: ["Never give adult doses — ask your pediatrician for a child's amount.", "Honey with warm water is a soothing remedy for coughs over age 1.", "Encourage fruit as snacks instead of juice."] },
      { h: "Teenagers", list: ["Avoid energy, 'fat-burner' and muscle-building supplements.", "Talk openly about the risks of mixing supplements with medicines and alcohol.", "Teens should follow adult guidance only with a doctor's okay."] }
    ],
    emergency: ["A child swallowed an essential oil, supplement or medicine — call Poison Control (U.S. 1-800-222-1222) right away", "Trouble breathing, swelling of the lips or face, or hives", "Unusual sleepiness, vomiting or seizures"]
  },
  {
    id: "older-adults", ix: "older-adults", title: "Herbs & Fruits for Adults 65+", short: "Adults 65+",
    intro: "Many older adults use herbs safely and enjoy their benefits. But with age, the liver and kidneys clear substances more slowly, and many people take several medicines. That makes interactions, falls and bleeding more likely. A little extra care keeps herbs a blessing rather than a risk.",
    sections: [
      { h: "The golden rules", list: ["Keep an up-to-date list of every medicine, vitamin and herb you take.", "Once a year, bring all your bottles to a pharmacist for a 'brown bag' review.", "Start new herbs at the lowest dose, one at a time.", "Be careful with calming herbs — drowsiness can lead to falls.", "Ask before using herbs that thin the blood if you take aspirin or blood thinners."] },
      { h: "Gentle, nourishing choices", p: "Fresh fruits, herbal teas like rooibos and chamomile, cooking with garlic, turmeric and ginger, and staying hydrated are simple ways to enjoy herbs. Tart cherry and kiwi may support sleep, and prunes support regularity and bone health." }
    ],
    emergency: ["A fall, especially with a head injury", "Unusual bruising or bleeding", "Sudden confusion, weakness or trouble speaking — call emergency services", "Dizziness or fainting after starting something new"]
  },
  {
    id: "surgery", ix: "surgery", title: "Herbs & Supplements Before Surgery", short: "Before Surgery",
    intro: "Some herbs thin the blood, change blood sugar or interact with anesthesia. Taking them right before an operation can cause extra bleeding or complications. Planning ahead keeps your surgery safe.",
    sections: [
      { h: "Before your operation", list: ["Tell your surgeon and anesthesiologist about every herb, vitamin and supplement you take.", "Stop herbal supplements at least 2 weeks before surgery, or as your surgeon advises.", "Food amounts of herbs and spices are fine.", "Don't stop prescribed medicines unless your doctor tells you to."] },
      { h: "After your operation", list: ["Ask your surgeon when it's safe to restart supplements.", "Topical arnica may help bruising — only on unbroken, healed skin.", "Pineapple, berries and protein-rich foods support healing.", "Ginger tea may ease post-operative nausea once your doctor allows."] }
    ],
    emergency: ["Bleeding that won't stop or a rapidly swelling wound", "Fever, spreading redness or pus from the wound", "Chest pain, shortness of breath or calf swelling (possible blood clot)"]
  }
];

// Verses for herb and fruit pages, by category (used when the plant itself isn't named in scripture).
const CATEGORY_VERSES = {
  sleep: TOPIC_GUIDES[0].verse,
  calming: TOPIC_GUIDES[1].verse,
  digestion: TOPIC_GUIDES[2].verse,
  immunity: TOPIC_GUIDES[3].verse,
  respiratory: TOPIC_GUIDES[4].verse,
  heart: TOPIC_GUIDES[5].verse,
  skin: TOPIC_GUIDES[7].verse,
  aches: TOPIC_GUIDES[9].verse,
  energy: TOPIC_GUIDES[10].verse,
  women: TOPIC_GUIDES[12].verse,
  men: TOPIC_GUIDES[14].verse,
  kitchen: { text: "O taste and see that the LORD is good: blessed is the man that trusteth in him.", ref: "Psalm 34:8" }
};
