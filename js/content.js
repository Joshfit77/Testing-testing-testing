// Site content other than herbs: reminders, verses, daily rhythm, seasons and journal articles.

const REMINDERS = [
  "Drink a glass of water before your next meal.",
  "Step outside for five minutes of sunshine and fresh air.",
  "Stretch your neck and shoulders — slowly and gently.",
  "Take three deep, slow breaths. Breathe in peace, breathe out worry.",
  "Add something green to your next plate.",
  "Write down one thing you are thankful for today.",
  "Stand up and walk for a few minutes if you've been sitting.",
  "Rest your eyes: look at something 20 feet away for 20 seconds.",
  "Put your phone away an hour before bed for deeper sleep.",
  "Call or message someone you love.",
  "Swap one sugary drink for herbal tea or water.",
  "Smile — it's good for you and for everyone around you.",
  "Wash your hands, then moisturize them with care.",
  "Take a quiet moment to pray, reflect or simply be still.",
  "Eat slowly and notice the flavors of your food.",
  "Open a window and let fresh air move through your home.",
  "Tidy one small space — a calm space invites a calm mind.",
  "Unclench your jaw and drop your shoulders.",
  "Go to bed fifteen minutes earlier tonight.",
  "Speak one kind word to yourself today."
];

const DEFAULT_HABITS = [
  "Drink water when I wake up",
  "Eat five servings of fruits or vegetables",
  "Move my body for 20 minutes",
  "Spend a moment in prayer or gratitude",
  "Get outside in daylight",
  "Be in bed by a restful hour"
];

const VERSES = [
  { text: "I will give thanks to You, for I am fearfully and wonderfully made.", ref: "Psalm 139:14" },
  { text: "He causes the grass to grow for the cattle, And vegetation for the labor of man, So that he may bring forth food from the earth.", ref: "Psalm 104:14" },
  { text: "A joyful heart is good medicine.", ref: "Proverbs 17:22" },
  { text: "Pleasant words are a honeycomb, Sweet to the soul and healing to the bones.", ref: "Proverbs 16:24" },
  { text: "Let everything that has breath praise the LORD.", ref: "Psalm 150:6" },
  { text: "He has made everything appropriate in its time.", ref: "Ecclesiastes 3:11" },
  { text: "O taste and see that the LORD is good.", ref: "Psalm 34:8" },
  { text: "Come to Me, all who are weary and heavy-laden, and I will give you rest.", ref: "Matthew 11:28" },
  { text: "Observe how the lilies of the field grow; they do not toil nor do they spin.", ref: "Matthew 6:28" }
];

const DAILY_RHYTHM = [
  { time: "Morning", icon: "sunrise", items: ["A glass of water before coffee", "Open the curtains and let in daylight", "A moment of prayer or gratitude", "A protein-rich breakfast"] },
  { time: "Midday", icon: "sun", items: ["Step outside for a short walk", "Fill half your plate with vegetables", "Refill your water bottle", "Peppermint or ginger tea after lunch"] },
  { time: "Afternoon", icon: "leaf", items: ["Stand and stretch every hour", "Swap a sweet snack for fruit and nuts", "Green or tulsi tea for gentle focus", "Rest your eyes from screens"] },
  { time: "Evening", icon: "moon", items: ["Dim the lights after dinner", "Chamomile or lemon balm tea", "Put devices away an hour before bed", "Reflect on three good things from today"] }
];

const SEASONS = [
  { name: "Spring", months: [2, 3, 4], herbs: ["nettle", "dandelion", "chickweed", "violet"], text: "A season of fresh greens and new growth. Enjoy tender wild greens, plant your herb garden, and open the windows to air out your home." },
  { name: "Summer", months: [5, 6, 7], herbs: ["hibiscus", "peppermint", "aloe-vera", "lemon-balm"], text: "Stay hydrated with iced herbal teas, protect your skin from the sun, and harvest herbs in the morning when their oils are strongest." },
  { name: "Autumn", months: [8, 9, 10], herbs: ["elderberry", "rose-hips", "astragalus", "ginger"], text: "Gather and dry the last of the harvest, prepare elderberry syrup, and settle into earlier, cozier evenings for good sleep." },
  { name: "Winter", months: [11, 0, 1], herbs: ["thyme", "cinnamon", "licorice", "echinacea"], text: "Nourish with warming soups and spices, wash hands often, rest well, and soak up whatever daylight you can find." }
];

const ARTICLES = [
  {
    id: "brewing-herbal-tea", title: "A Beginner's Guide to Brewing Herbal Tea", category: "Herbal Basics",
    date: "2026-09-28", read: 5, herb: "chamomile",
    excerpt: "Infusions, decoctions and cold brews — a simple guide to drawing the best flavor and goodness from your herbs.",
    body: [
      { p: "Brewing herbal tea is one of the oldest and simplest ways to enjoy herbs. A few small habits make the difference between a weak, bitter cup and one that is full of aroma and flavor." },
      { h: "Infusions: for leaves and flowers" },
      { p: "Delicate parts like leaves and flowers are best infused. Pour just-boiled water over 1–2 teaspoons of dried herb (or about three times as much fresh herb) per cup, and steep for 5–10 minutes." },
      { p: "Cover your cup or teapot while it steeps. Many herbs, such as chamomile and peppermint, owe their scent to volatile oils that escape with the steam." },
      { h: "Decoctions: for roots, bark and seeds" },
      { p: "Tough parts like ginger, cinnamon bark, licorice root and astragalus need simmering. Add them to cold water, bring to a gentle boil, then simmer covered for 10–20 minutes." },
      { h: "Cold infusions" },
      { p: "Some herbs, like marshmallow root, release their soothing mucilage best in cool water. Hibiscus and mint are also delicious cold-brewed: steep in the fridge overnight." },
      { h: "Quick tips" },
      { list: ["Store dried herbs in airtight jars away from light and heat; most keep their best flavor for about a year.", "Crush seeds like fennel and caraway just before brewing.", "Start with single herbs to learn their flavors, then try blending.", "Sweeten with honey after the tea has cooled slightly, and never give honey to babies under one year."] }
    ]
  },
  {
    id: "calming-evening-routine", title: "Building a Simple, Calming Evening Routine", category: "Healthy Living",
    date: "2026-09-21", read: 4, herb: "lavender",
    excerpt: "Good sleep starts hours before bedtime. Here's a gentle routine to help your body and mind wind down.",
    body: [
      { p: "Our bodies love rhythm. Going to bed and waking at similar times each day helps regulate the internal clock that tells us when to feel alert and when to feel sleepy." },
      { h: "Two hours before bed" },
      { p: "Finish large meals and dim the lights. Bright light in the evening — especially from screens — can delay the release of melatonin, the hormone that helps signal night." },
      { h: "One hour before bed" },
      { p: "Put devices away and choose something restful: a warm bath, light stretching, reading, prayer or journaling. This is a lovely time for a cup of chamomile, lemon balm or linden tea." },
      { h: "At bedtime" },
      { list: ["Keep your bedroom cool, dark and quiet.", "Try a lavender sachet by your pillow.", "Write down tomorrow's to-do list so your mind can let go of it.", "Reflect on three good things from the day."] },
      { p: "If trouble sleeping lasts for weeks or affects your daytime life, talk to your doctor. Ongoing sleep problems can have treatable causes." }
    ]
  },
  {
    id: "kitchen-herb-garden", title: "Ten Herbs Every Kitchen Garden Should Have", category: "Growing",
    date: "2026-09-12", read: 6, herb: "basil",
    excerpt: "Even a sunny windowsill can grow a harvest of flavor. These ten herbs are easy, useful and beautiful.",
    body: [
      { p: "Growing your own herbs is rewarding, saves money and puts fresh flavor at your fingertips. Most culinary herbs need just two things: at least six hours of sun and soil that drains well." },
      { h: "The ten" },
      { list: ["Basil — the summer favorite; pinch off flowers to keep leaves coming.", "Parsley — slow to sprout but generous once established.", "Mint — vigorous; always grow it in its own pot.", "Rosemary — loves sun and hates wet feet.", "Thyme — tough, low and fragrant.", "Sage — beautiful grey leaves and purple flowers.", "Chives — snip often; the purple flowers are edible.", "Oregano — strongest flavor in hot, lean soil.", "Lemon balm — cheerful, easy and loved by bees.", "Chamomile — easy from seed for your own bedtime tea."] },
      { h: "Harvesting" },
      { p: "Harvest in the morning after the dew dries, when aromatic oils are strongest. Never take more than a third of a plant at once, and cut just above a pair of leaves to encourage bushy growth." },
      { h: "Drying" },
      { p: "Tie small bundles and hang them upside down in a warm, dark, airy place for 1–2 weeks, until leaves crumble easily. Store in labeled jars." }
    ]
  },
  {
    id: "using-herbs-safely", title: "How to Use Herbs Safely", category: "Safety",
    date: "2026-09-05", read: 5, herb: "st-johns-wort",
    excerpt: "Natural doesn't always mean harmless. A few essential principles for enjoying herbs wisely.",
    body: [
      { p: "Herbs can be wonderful allies, but many contain active compounds. That's why they can help — and also why they deserve respect." },
      { h: "Talk to your doctor or pharmacist" },
      { p: "Some herbs interact with medicines. St. John's wort can make birth control pills, antidepressants and blood thinners work differently. Ginkgo, garlic and turmeric supplements may increase bleeding risk. Always share what herbs and supplements you take." },
      { h: "Take special care if you are…" },
      { list: ["Pregnant, trying to conceive or breastfeeding", "Giving herbs to babies or children", "Living with a long-term condition such as heart, liver or kidney disease", "Preparing for surgery", "Allergic to plants such as ragweed or daisies"] },
      { h: "Essential oils are concentrated" },
      { p: "A single drop of essential oil can equal many cups of tea. Never swallow essential oils unless directed by a qualified professional, always dilute them for skin, and keep them away from children and pets." },
      { h: "Buy from trusted sources" },
      { p: "Choose reputable brands that test for quality and correct identification. If you forage, be 100% sure of identification — some plants have toxic look-alikes." },
      { p: "Above all, herbs are not a replacement for medical care. If symptoms are severe, sudden or lasting, see a doctor." }
    ]
  },
  {
    id: "gratitude-and-wellbeing", title: "Gratitude and Wellbeing: Why Giving Thanks Is Good for You", category: "Faith & Wellness",
    date: "2026-08-29", read: 4, herb: "rose",
    excerpt: "Researchers have found that a simple habit of gratitude is linked to greater wellbeing. Here's how to begin.",
    body: [
      { p: "'In everything give thanks' (1 Thessalonians 5:18) is an ancient call — and modern research suggests it's good for us too. Studies of gratitude journaling have found links with improved mood, better sleep and greater life satisfaction." },
      { h: "Why it may help" },
      { p: "Gratitude gently shifts our attention toward what is good and present, rather than what is missing. Over time, this practice can change how we notice and remember our days." },
      { h: "Simple ways to start" },
      { list: ["Write down three good things each evening, and why they happened.", "Send a short thank-you note or message to someone each week.", "Pause before meals to give thanks.", "Take a 'gratitude walk' and notice the beauty of creation — trees, flowers, birdsong."] },
      { p: "Gratitude doesn't mean ignoring hardship. It can sit alongside grief and struggle as a quiet reminder that we are held and that beauty remains." }
    ]
  },
  {
    id: "winter-wellness-pantry", title: "Stocking Your Winter Wellness Pantry", category: "Seasonal",
    date: "2026-08-20", read: 5, herb: "elderberry",
    excerpt: "Warming spices, soothing teas and nourishing staples to have on hand before cold season arrives.",
    body: [
      { p: "A well-stocked pantry makes it easy to care for yourself and your family when the weather turns cold. Here are some staples worth gathering in autumn." },
      { h: "Teas and herbs" },
      { list: ["Ginger — fresh root for warming tea with lemon and honey.", "Thyme — a traditional cough tea.", "Elderberry — for homemade syrup.", "Peppermint and eucalyptus — for steam inhalations.", "Chamomile — for restful nights."] },
      { h: "Kitchen staples" },
      { list: ["Raw honey for soothing throats (not for babies under one).", "Garlic and onions for soups and broths.", "Cinnamon, cloves and star anise for warming drinks.", "Citrus fruits for vitamin C.", "Broth and lentils for quick, nourishing meals."] },
      { h: "Healthy habits" },
      { p: "No herb can replace the basics: wash your hands often, sleep well, eat colorful vegetables, keep moving, and stay up to date with the vaccines your doctor recommends. Rest when you're unwell, and see a doctor if symptoms are severe or don't improve." }
    ]
  }
];

// 100 natural reminders for the body, in ten groups of ten (shown on the Healthy Living page).
const BODY_REMINDER_GROUPS = {
  water: { label: "Water", icon: "drop" }, nourish: { label: "Nourish", icon: "apple" }, move: { label: "Move", icon: "sun" },
  breathe: { label: "Breathe", icon: "leaf" }, rest: { label: "Rest & sleep", icon: "moon" }, outdoors: { label: "Sunlight & fresh air", icon: "sunrise" },
  posture: { label: "Posture & stretching", icon: "sparkle" }, care: { label: "Body care", icon: "shield" }, mind: { label: "Mind & stress", icon: "heart" },
  spirit: { label: "Gratitude & spirit", icon: "flower" }
};
const BODY_REMINDERS = [
  ["water", "Drink a glass of water when you wake up — your body has gone hours without any."],
  ["water", "Keep a water bottle where you can see it; you'll drink more without trying."],
  ["water", "Pale yellow urine is a simple sign you're drinking enough."],
  ["water", "Feeling tired or headachy? Try a glass of water first."],
  ["water", "Drink a glass of water with every meal."],
  ["water", "Add lemon, cucumber or mint if plain water feels boring."],
  ["water", "Sip water before, during and after exercise."],
  ["water", "Thirst can feel like hunger — have a drink before reaching for a snack."],
  ["water", "Herbal teas and water-rich foods like watermelon and cucumber count toward your fluids."],
  ["water", "Drink a little extra on hot days and when you're unwell."],
  ["nourish", "Fill half your plate with vegetables and fruit."],
  ["nourish", "Include a source of protein at every meal to stay full longer."],
  ["nourish", "Eat the rainbow — different colors bring different nutrients."],
  ["nourish", "Choose whole grains like oats and brown rice over refined ones most of the time."],
  ["nourish", "Slow down and chew well — digestion starts in the mouth."],
  ["nourish", "Stop eating when you're comfortably satisfied, not stuffed."],
  ["nourish", "Keep fruit on the counter for an easy, naturally sweet snack."],
  ["nourish", "Check labels for added sugar — less is better."],
  ["nourish", "Add a small handful of nuts or seeds for healthy fats."],
  ["nourish", "Cook one simple meal at home today."],
  ["move", "Stand up and move for a few minutes every hour you sit."],
  ["move", "Take a 10-minute walk after a meal."],
  ["move", "Take the stairs when you can."],
  ["move", "Aim for about 150 minutes of moderate activity each week — that's 30 minutes, 5 days."],
  ["move", "Do some strength exercises twice a week — strong muscles support your bones and balance."],
  ["move", "Dance to one song you love."],
  ["move", "Walk while you talk on the phone."],
  ["move", "Park a little farther away and enjoy the extra steps."],
  ["move", "Play — chase the kids, throw a ball, garden. Movement doesn't have to be a workout."],
  ["move", "Balance on one foot while you brush your teeth to build steadiness."],
  ["breathe", "Take three slow, deep breaths before you answer a stressful message."],
  ["breathe", "Breathe in through your nose — it warms and filters the air."],
  ["breathe", "Let your out-breath be a little longer than your in-breath to help your body relax."],
  ["breathe", "Notice if you're holding your breath — then let it go."],
  ["breathe", "Try box breathing: in for 4, hold for 4, out for 4, hold for 4."],
  ["breathe", "Open a window and let fresh air in for a few minutes."],
  ["breathe", "Relax your jaw and drop your shoulders as you breathe out."],
  ["breathe", "Take a one-minute breathing break between tasks."],
  ["breathe", "Sing or hum — it naturally slows your breathing."],
  ["breathe", "Breathe slowly and deeply as you lie down to sleep."],
  ["rest", "Go to bed and wake up at about the same time every day, even on weekends."],
  ["rest", "Aim for 7–9 hours of sleep most nights."],
  ["rest", "Put screens away 30–60 minutes before bed."],
  ["rest", "Keep your bedroom cool, dark and quiet."],
  ["rest", "Enjoy caffeine early in the day, not in the afternoon or evening."],
  ["rest", "A short nap of 20 minutes or less can refresh you without spoiling night sleep."],
  ["rest", "Write tomorrow's to-do list before bed so your mind can rest."],
  ["rest", "A warm shower or a calming cup of tea can signal it's time to wind down."],
  ["rest", "Rest isn't laziness — your body repairs itself while you sleep."],
  ["rest", "Set aside one day each week to truly rest, as God rested on the seventh day."],
  ["outdoors", "Step outside in the morning light to help set your body clock."],
  ["outdoors", "Spend a few minutes in nature — trees, gardens and water can calm the mind."],
  ["outdoors", "Get a little sunshine, and protect your skin with sunscreen when you're out longer."],
  ["outdoors", "Eat lunch outside when the weather allows."],
  ["outdoors", "Open the curtains as soon as you wake up."],
  ["outdoors", "Take a walk in a park, along a trail or by the water this week."],
  ["outdoors", "Grow something — a pot of herbs on the windowsill counts."],
  ["outdoors", "Look up and notice the sky today."],
  ["outdoors", "Dress for the weather and get outside anyway."],
  ["outdoors", "Bring a few plants indoors to brighten your space."],
  ["posture", "Sit back in your chair with your feet flat on the floor."],
  ["posture", "Raise your screen to eye level to spare your neck."],
  ["posture", "Roll your shoulders back and down a few times."],
  ["posture", "Gently tilt your head side to side to stretch your neck."],
  ["posture", "Stand tall — imagine a string gently lifting the top of your head."],
  ["posture", "Stretch your hands and wrists if you type or use your phone a lot."],
  ["posture", "Bend your knees, not your back, when you lift something."],
  ["posture", "Stretch gently for a few minutes each morning to wake up your muscles."],
  ["posture", "Change positions often — the best posture is your next one."],
  ["posture", "Carry bags on both shoulders, or switch sides often."],
  ["care", "Every 20 minutes of screen time, look at something 20 feet away for 20 seconds."],
  ["care", "Blink often when you're looking at screens."],
  ["care", "Wear sunglasses in bright sun to protect your eyes."],
  ["care", "Moisturize right after bathing, while your skin is still a little damp."],
  ["care", "Wash your hands with soap for 20 seconds."],
  ["care", "Brush your teeth twice a day and floss once a day."],
  ["care", "Keep your headphone volume at a comfortable level."],
  ["care", "Check your skin for new or changing moles."],
  ["care", "Wear sunscreen on your face every day."],
  ["care", "Keep up with checkups — your doctor, dentist and eye doctor."],
  ["mind", "Do one thing at a time."],
  ["mind", "Take a short break when you feel overwhelmed."],
  ["mind", "It's okay to say no to something that drains you."],
  ["mind", "Spend time with people who encourage you."],
  ["mind", "Laugh today — a joyful heart is good medicine (Proverbs 17:22)."],
  ["mind", "Put your phone in another room for an hour."],
  ["mind", "Write down what's worrying you, pray over it, then set it aside."],
  ["mind", "Ask for help when you need it — you're not alone. In the U.S., call or text 988 any time."],
  ["mind", "Celebrate your small wins."],
  ["mind", "Speak to yourself as kindly as you would to a friend."],
  ["spirit", "Start the day by thanking God for three things."],
  ["spirit", "Spend a few quiet minutes in prayer this morning."],
  ["spirit", "Remember: you are fearfully and wonderfully made (Psalm 139:14)."],
  ["spirit", "Give thanks before you eat."],
  ["spirit", "Read a short passage of Scripture today."],
  ["spirit", "Do one kind thing for someone else."],
  ["spirit", "Write a thank-you note to someone who has blessed you."],
  ["spirit", "Forgive someone — and let your heart rest."],
  ["spirit", "Sing a hymn or a worship song."],
  ["spirit", "End the day by naming one good thing that happened."]
];
