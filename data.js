// Content for the site. Edit this file to add herbs, reminders or verses.

const HERBS = [
  {
    name: "Chamomile",
    emoji: "🌼",
    tags: ["calming", "sleep", "digestion"],
    description: "Gentle daisy-like flowers traditionally brewed as a soothing evening tea.",
    uses: "Tea before bed; a warm cup after meals.",
    caution: "Avoid if allergic to ragweed or daisies."
  },
  {
    name: "Peppermint",
    emoji: "🌱",
    tags: ["digestion", "energy"],
    description: "Cooling, refreshing leaves often used to settle the stomach.",
    uses: "Fresh leaves in water or tea; a sniff of the leaves for a lift.",
    caution: "May worsen heartburn or acid reflux."
  },
  {
    name: "Ginger",
    emoji: "🫚",
    tags: ["digestion", "immunity"],
    description: "A warming root valued for easing queasiness and adding zest to food.",
    uses: "Sliced into hot water with lemon; grated into cooking.",
    caution: "Large amounts may interact with blood thinners."
  },
  {
    name: "Lavender",
    emoji: "💜",
    tags: ["calming", "sleep", "skin"],
    description: "Fragrant purple flowers loved for their relaxing scent.",
    uses: "Dried sachets by the pillow; a few flowers in a bath.",
    caution: "Do not swallow essential oil; dilute before using on skin."
  },
  {
    name: "Turmeric",
    emoji: "🟡",
    tags: ["immunity", "skin"],
    description: "A golden root used in cooking for centuries, famous in 'golden milk'.",
    uses: "In curries, soups or warm milk with a pinch of black pepper.",
    caution: "Check with a doctor if you have gallbladder issues or take blood thinners."
  },
  {
    name: "Rosemary",
    emoji: "🌿",
    tags: ["energy", "hair"],
    description: "A fragrant evergreen herb associated with focus and remembrance.",
    uses: "In roasted vegetables; a rinse of cooled rosemary tea for hair.",
    caution: "Avoid large medicinal amounts during pregnancy."
  },
  {
    name: "Aloe Vera",
    emoji: "🪴",
    tags: ["skin", "hair"],
    description: "A succulent whose cool inner gel has long been used on the skin.",
    uses: "Fresh gel on sun-warmed skin; in homemade face masks.",
    caution: "For external use; patch-test first. Do not eat the latex layer."
  },
  {
    name: "Hibiscus",
    emoji: "🌺",
    tags: ["heart", "immunity"],
    description: "Tart, ruby-red petals that make a beautiful, refreshing tea.",
    uses: "Brewed hot or iced, lightly sweetened with honey.",
    caution: "May lower blood pressure; take care if on related medicine."
  },
  {
    name: "Lemon Balm",
    emoji: "🍋",
    tags: ["calming", "sleep"],
    description: "A lemony member of the mint family, cheerful and easy to grow.",
    uses: "Fresh leaves in tea or water.",
    caution: "Check with a doctor if you have thyroid conditions."
  },
  {
    name: "Garlic",
    emoji: "🧄",
    tags: ["heart", "immunity"],
    description: "A kitchen staple long honored for supporting overall wellness.",
    uses: "Crushed fresh into meals; let it rest 10 minutes before cooking.",
    caution: "May interact with blood thinners; can upset sensitive stomachs."
  },
  {
    name: "Cinnamon",
    emoji: "🟤",
    tags: ["heart", "energy"],
    description: "A warm, sweet bark that brings comfort to food and drink.",
    uses: "Sprinkled on oats, fruit or in tea.",
    caution: "Cassia cinnamon in large amounts can affect the liver; use moderately."
  },
  {
    name: "Rose",
    emoji: "🌹",
    tags: ["skin", "calming"],
    description: "Beloved for its beauty and scent; rose water is a classic skin refresher.",
    uses: "Rose water as a face mist; petals in tea.",
    caution: "Use roses grown without pesticides."
  }
];

const REMINDERS = [
  "Drink a glass of water before your next meal. 💧",
  "Step outside for five minutes of sunshine and fresh air. ☀️",
  "Stretch your neck and shoulders — slowly, gently. 🙆",
  "Take three deep, slow breaths. Breathe in peace, breathe out worry. 🌬️",
  "Add something green to your next plate. 🥗",
  "Write down one thing you are thankful for today. 🙏",
  "Stand up and walk for a few minutes if you've been sitting. 🚶",
  "Rest your eyes: look at something far away for 20 seconds. 👀",
  "Put your phone down an hour before bed for better sleep. 🌙",
  "Call or message someone you love. 💛",
  "Swap one sugary drink for herbal tea or water. 🍵",
  "Smile — it's good for you and for everyone around you. 😊",
  "Wash your hands and moisturize them with care. 🤲",
  "Take a quiet moment to pray, reflect or simply be still. 🕊️"
];

const DEFAULT_HABITS = [
  "Drink water when I wake up",
  "Eat fruits or vegetables",
  "Move my body for 20 minutes",
  "Spend a moment in gratitude",
  "Get to bed on time"
];

const VERSES = [
  { text: "I praise you because I am fearfully and wonderfully made.", ref: "Psalm 139:14" },
  { text: "He causeth the grass to grow for the cattle, and herb for the service of man.", ref: "Psalm 104:14" },
  { text: "A cheerful heart is good medicine.", ref: "Proverbs 17:22" },
  { text: "Gracious words are a honeycomb, sweet to the soul and healing to the bones.", ref: "Proverbs 16:24" },
  { text: "Let everything that has breath praise the Lord.", ref: "Psalm 150:6" },
  { text: "He has made everything beautiful in its time.", ref: "Ecclesiastes 3:11" }
];
