// A 12-week devotional that repeats. Each week has a verse (NASB 1995), a short reflection,
// a prayer, one healthy habit to practice, and an herb, fruit and recipe to enjoy that week.
// The week changes every Monday. Please check each verse against your own NASB 1995 Bible.

const DEVOTIONAL_WEEKS = [
  {
    theme: "Fearfully and wonderfully made",
    ref: "Psalm 139:14",
    text: "I will give thanks to You, for I am fearfully and wonderfully made; Wonderful are Your works, And my soul knows it very well.",
    reflection: "Your body is not an accident or a project to fix — it is a work of God's hands. Caring for it starts with gratitude, not guilt. This week, notice one thing your body does well every day and thank God for it.",
    prayer: "Lord, thank You for the body You gave me. Help me care for it with gratitude and patience.",
    habit: "Each morning, name three things your body did for you yesterday and give thanks.",
    herb: "chamomile", fruit: "apple", recipe: "sleepy-time-tea"
  },
  {
    theme: "Good health, body and soul",
    ref: "3 John 1:2",
    text: "Beloved, I pray that in all respects you may prosper and be in good health, just as your soul prospers.",
    reflection: "John prayed for his friend's health and his soul together. God cares about both. As you build healthy habits this week, let them grow alongside time in prayer and Scripture.",
    prayer: "Father, let my body and soul grow strong together. Make me healthy in every way that pleases You.",
    habit: "Pair one daily habit with prayer — for example, pray while you take a 10-minute walk.",
    herb: "ginger", fruit: "lemon", recipe: "ginger-lemon-honey"
  },
  {
    theme: "Rest for the weary",
    ref: "Matthew 11:28",
    text: "Come to Me, all who are weary and heavy-laden, and I will give you rest.",
    reflection: "Rest is a gift Jesus offers freely. Tiredness is not a failure — it is a signal to come to Him. This week, treat rest as an act of trust rather than something to earn.",
    prayer: "Jesus, I bring You my tiredness. Teach me to rest in You.",
    habit: "Set a screen-off time 30 minutes before bed and keep it every night this week.",
    herb: "lemon-balm", fruit: "tart-cherry", recipe: "tart-cherry-sleep-mocktail"
  },
  {
    theme: "Lying down in peace",
    ref: "Psalm 4:8",
    text: "In peace I will both lie down and sleep, For You alone, O LORD, make me to dwell in safety.",
    reflection: "David could sleep because he trusted who kept him safe. Many of our restless nights come from carrying tomorrow's worries to bed. Hand them over before you lie down.",
    prayer: "Lord, You are my safety. I give You tonight's worries so I can sleep in peace.",
    habit: "Before bed, write down tomorrow's worries on paper, pray over them, and close the notebook.",
    herb: "lavender", fruit: "kiwi", recipe: "sleepy-time-tea"
  },
  {
    theme: "Peace instead of anxiety",
    ref: "Philippians 4:6–7",
    text: "Be anxious for nothing, but in everything by prayer and supplication with thanksgiving let your requests be made known to God. And the peace of God, which surpasses all comprehension, will guard your hearts and your minds in Christ Jesus.",
    reflection: "Paul does not say \"don't feel anything\" — he gives us something to do with anxious feelings: pray, ask, and give thanks. Peace follows prayer like a guard at the door of your heart.",
    prayer: "God, I bring my requests to You with thanks. Guard my heart and mind with Your peace.",
    habit: "When you feel anxious, stop for five slow breaths and a one-sentence prayer of thanks.",
    herb: "holy-basil", fruit: "orange", recipe: "golden-milk"
  },
  {
    theme: "A temple of the Holy Spirit",
    ref: "1 Corinthians 6:19–20",
    text: "Or do you not know that your body is a temple of the Holy Spirit who is in you, whom you have from God, and that you are not your own? For you have been bought with a price: therefore glorify God in your body.",
    reflection: "Your body is a dwelling place for God's Spirit. That makes ordinary choices — what we eat, how we move, how we rest — quiet ways to honor Him.",
    prayer: "Holy Spirit, You live in me. Help me honor You in how I care for this body.",
    habit: "Add one extra serving of vegetables or fruit to a meal every day this week.",
    herb: "parsley", fruit: "blueberry", recipe: "blueberry-power-smoothie"
  },
  {
    theme: "New strength",
    ref: "Isaiah 40:31",
    text: "Yet those who wait for the LORD Will gain new strength; They will mount up with wings like eagles, They will run and not get tired, They will walk and not become weary.",
    reflection: "Real strength comes from waiting on the Lord, not from pushing harder. Gentle, steady habits often renew us more than big bursts of effort.",
    prayer: "Lord, renew my strength as I wait on You. Help me walk and not grow weary.",
    habit: "Take a 15-minute walk outside each day — no phone, just time with God.",
    herb: "green-tea", fruit: "banana", recipe: "hibiscus-iced-tea"
  },
  {
    theme: "A joyful heart",
    ref: "Proverbs 17:22",
    text: "A joyful heart is good medicine, But a broken spirit dries up the bones.",
    reflection: "Joy affects the whole person. Laughter, friendship and worship are not extras — Scripture calls them good medicine. Make room for joy this week on purpose.",
    prayer: "Father, fill my heart with Your joy, and let it spill over to others.",
    habit: "Call or visit one friend this week just to encourage them.",
    herb: "rose", fruit: "pomegranate", recipe: "mint-cucumber-water"
  },
  {
    theme: "Green pastures, quiet waters",
    ref: "Psalm 23:2–3",
    text: "He makes me lie down in green pastures; He leads me beside quiet waters. He restores my soul;",
    reflection: "The Good Shepherd leads His sheep to rest and water. Sometimes the most spiritual thing you can do is drink a glass of water, sit quietly, and let Him restore you.",
    prayer: "Shepherd of my soul, lead me to quiet waters and restore me.",
    habit: "Drink a full glass of water first thing every morning before coffee or screens.",
    herb: "peppermint", fruit: "watermelon", recipe: "mint-cucumber-water"
  },
  {
    theme: "The fruit of the Spirit",
    ref: "Galatians 5:22–23",
    text: "But the fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faithfulness, gentleness, self-control; against such things there is no law.",
    reflection: "Fruit grows slowly and quietly, fed by its roots. Healthy habits are the same — patience and self-control are fruits the Spirit grows in us over time.",
    prayer: "Holy Spirit, grow Your fruit in me — especially patience and self-control this week.",
    habit: "Choose one habit to practice with patience: eat slowly, without screens, at one meal each day.",
    herb: "fennel", fruit: "grape", recipe: "digestive-fennel-tea"
  },
  {
    theme: "New every morning",
    ref: "Lamentations 3:22–23",
    text: "The LORD'S lovingkindnesses indeed never cease, For His compassions never fail. They are new every morning; Great is Your faithfulness.",
    reflection: "Missed a habit? Fallen behind? God's mercies are new every morning, and so is your chance to start again. Don't let one hard day become a hard week.",
    prayer: "Lord, thank You for mercy that is new today. Help me begin again with hope.",
    habit: "Start each day with two minutes of quiet before you check your phone.",
    herb: "rosemary", fruit: "orange", recipe: "rosemary-hair-rinse"
  },
  {
    theme: "Give thanks in everything",
    ref: "1 Thessalonians 5:16–18",
    text: "Rejoice always; pray without ceasing; in everything give thanks; for this is God's will for you in Christ Jesus.",
    reflection: "Gratitude changes how we see each day. Thankful people tend to sleep better, worry less and care for others more. Give thanks for the small gifts — a meal, a breath, a cup of tea.",
    prayer: "Father, teach me to rejoice, to pray, and to give thanks in everything.",
    habit: "Write down one thing you're thankful for at every meal this week.",
    herb: "thyme", fruit: "fig", recipe: "thyme-honey-syrup"
  }
];

// Weeks start on Monday. Week 1 of the cycle began Monday, January 1, 2024.
function devotionalIndex(date = new Date()) {
  const start = Date.UTC(2024, 0, 1);
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const weeks = Math.floor((today - start) / (7 * 86400000));
  return ((weeks % DEVOTIONAL_WEEKS.length) + DEVOTIONAL_WEEKS.length) % DEVOTIONAL_WEEKS.length;
}
const thisWeeksDevotional = () => DEVOTIONAL_WEEKS[devotionalIndex()];
