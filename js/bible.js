// Herbs and fruits of the Bible — only plants named in scripture that have their own page on this site.
// Verses are quoted from the New American Standard Bible® (NASB 1995).
// link: { herb: id } or { fruit: id }; extra: more plants named in the same passage.

const BIBLE_VERSION = "NASB 1995";
const BIBLE_COPYRIGHT = "Scripture quotations taken from the (NASB®) New American Standard Bible®, Copyright © 1960, 1971, 1977, 1995 by The Lockman Foundation. Used by permission. All rights reserved. lockman.org";

const BIBLE_INTRO = { text: "Then God said, \"Behold, I have given you every plant yielding seed that is on the surface of all the earth, and every tree which has fruit yielding seed; it shall be food for you.\"", ref: "Genesis 1:29" };

const BIBLE_PLANTS = [
  // ---------- Herbs ----------
  { kind: "herb", name: "Hyssop", ref: "Psalm 51:7", verse: "Purify me with hyssop, and I shall be clean; Wash me, and I shall be whiter than snow.", note: "Hyssop was used in cleansing rituals and to apply the blood of the Passover lamb. The biblical plant was likely a relative such as Syrian oregano.", link: { herb: "hyssop" } },
  { kind: "herb", name: "Hyssop at the Cross", ref: "John 19:29", verse: "A jar full of sour wine was standing there; so they put a sponge full of the sour wine upon a branch of hyssop and brought it up to His mouth.", note: "Hyssop appears at the Passover in Egypt and again at the crucifixion of Jesus, the Lamb of God.", link: { herb: "hyssop" } },
  { kind: "herb", name: "Mustard Seed", ref: "Matthew 13:31", verse: "The kingdom of heaven is like a mustard seed, which a man took and sowed in his field;", note: "Jesus used the tiny mustard seed, which grows into a large plant, as a picture of the growing kingdom.", link: { herb: "mustard" } },
  { kind: "herb", name: "Mint, Dill & Cummin", ref: "Matthew 23:23", verse: "For you tithe mint and dill and cummin, and have neglected the weightier provisions of the law: justice and mercy and faithfulness;", note: "These everyday garden herbs were so valued that people tithed them — but Jesus taught that justice, mercy and faithfulness matter most.", link: { herb: "peppermint" }, extra: [{ herb: "dill" }, { herb: "cumin" }] },
  { kind: "herb", name: "Dill & Cummin at Harvest", ref: "Isaiah 28:27", verse: "For dill is not threshed with a threshing sledge, Nor is the cartwheel driven over cummin; But dill is beaten out with a rod, and cummin with a club.", note: "The farmer treats each crop gently and wisely — a picture of how God deals with each of us.", link: { herb: "dill" }, extra: [{ herb: "cumin" }] },
  { kind: "herb", name: "Every Garden Herb", ref: "Luke 11:42", verse: "But woe to you Pharisees! For you pay tithe of mint and rue and every kind of garden herb and yet disregard justice and the love of God;", note: "Faithful giving is good, but justice and the love of God come first.", link: { herb: "spearmint" } },
  { kind: "herb", name: "Coriander", ref: "Exodus 16:31", verse: "The house of Israel named it manna, and it was like coriander seed, white, and its taste was like wafers with honey.", note: "Manna, the bread from heaven in the wilderness, was described as looking like coriander seed.", link: { herb: "coriander" } },
  { kind: "herb", name: "Garlic", ref: "Numbers 11:5", verse: "We remember the fish which we used to eat free in Egypt, the cucumbers and the melons and the leeks and the onions and the garlic,", note: "In the wilderness, the Israelites remembered the garlic, cucumbers and melons of Egypt.", link: { herb: "garlic" }, extra: [{ fruit: "cucumber" }, { fruit: "watermelon" }] },
  { kind: "herb", name: "Saffron & Cinnamon", ref: "Song of Solomon 4:14", verse: "Nard and saffron, calamus and cinnamon, With all the trees of frankincense, Myrrh and aloes, along with all the finest spices.", note: "The Song of Solomon describes a garden of the finest spices as a picture of beauty and love.", link: { herb: "saffron" }, extra: [{ herb: "cinnamon" }, { herb: "aloe-vera" }] },
  { kind: "herb", name: "Fragrant Cinnamon", ref: "Exodus 30:23", verse: "Take also for yourself the finest of spices: of flowing myrrh five hundred shekels, and of fragrant cinnamon half as much, two hundred and fifty,", note: "Cinnamon was an ingredient in the holy anointing oil of the tabernacle.", link: { herb: "cinnamon" } },
  { kind: "herb", name: "Aloes", ref: "John 19:39", verse: "Nicodemus, who had first come to Him by night, also came, bringing a mixture of myrrh and aloes, about a hundred pounds weight.", note: "Nicodemus brought aloes to prepare Jesus' body for burial. Biblical 'aloes' may have been fragrant aloeswood rather than aloe vera.", link: { herb: "aloe-vera" } },
  { kind: "herb", name: "Bitter Herbs", ref: "Exodus 12:8", verse: "They shall eat the flesh that same night, roasted with fire, and they shall eat it with unleavened bread and bitter herbs.", note: "Bitter herbs at Passover recall the bitterness of slavery. Chicory, endive and dandelion are among the traditional bitter herbs.", link: { herb: "chicory" }, extra: [{ herb: "dandelion" }] },

  // ---------- Fruits ----------
  { kind: "fruit", name: "Olive Leaf", ref: "Genesis 8:11", verse: "The dove came to him toward evening, and behold, in her beak was a freshly picked olive leaf. So Noah knew that the water was abated from the earth.", note: "The olive leaf brought by the dove after the flood became a lasting symbol of peace and new beginnings.", link: { fruit: "olive" }, extra: [{ herb: "olive-leaf" }] },
  { kind: "fruit", name: "The Green Olive Tree", ref: "Psalm 52:8", verse: "But as for me, I am like a green olive tree in the house of God; I trust in the lovingkindness of God forever and ever.", note: "Olive trees live for centuries — a picture of a life rooted in God.", link: { fruit: "olive" } },
  { kind: "fruit", name: "A Cake of Figs", ref: "Isaiah 38:21", verse: "Now Isaiah had said, \"Let them take a cake of figs and apply it to the boil, that he may recover.\"", note: "King Hezekiah's boil was treated with figs — one of the earliest recorded uses of a fruit as medicine.", link: { fruit: "fig" } },
  { kind: "fruit", name: "The Fig Tree", ref: "Matthew 24:32", verse: "Now learn the parable from the fig tree: when its branch has already become tender and puts forth its leaves, you know that summer is near;", note: "Jesus used the budding fig tree to teach His followers to watch and be ready.", link: { fruit: "fig" } },
  { kind: "fruit", name: "Sycamore Fig", ref: "Luke 19:4", verse: "So he ran on ahead and climbed up into a sycamore tree in order to see Him, for He was about to pass through that way.", note: "Zacchaeus climbed a sycamore — a kind of fig tree — to see Jesus, and his life was changed that day.", link: { fruit: "fig" } },
  { kind: "fruit", name: "Pomegranate", ref: "Exodus 28:34", verse: "a golden bell and a pomegranate, a golden bell and a pomegranate, all around on the hem of the robe.", note: "Pomegranates decorated the high priest's robe and the pillars of Solomon's temple.", link: { fruit: "pomegranate" } },
  { kind: "fruit", name: "The Vine", ref: "John 15:5", verse: "I am the vine, you are the branches; he who abides in Me and I in him, he bears much fruit, for apart from Me you can do nothing.", note: "Jesus used the grapevine to describe our connection to Him.", link: { fruit: "grape" } },
  { kind: "fruit", name: "Grapes of Eshcol", ref: "Numbers 13:23", verse: "Then they came to the valley of Eshcol and from there cut down a branch with a single cluster of grapes; and they carried it on a pole between two men, with some of the pomegranates and the figs.", note: "The spies returned with fruit so large it took two men to carry — proof of the good land God promised.", link: { fruit: "grape" }, extra: [{ fruit: "pomegranate" }, { fruit: "fig" }] },
  { kind: "fruit", name: "Raisins & Apples", ref: "Song of Solomon 2:5", verse: "Sustain me with raisin cakes, Refresh me with apples, Because I am lovesick.", note: "Raisin cakes and apples were treasured foods that brought strength and refreshment.", link: { fruit: "raisin" }, extra: [{ fruit: "apple" }] },
  { kind: "fruit", name: "Apples of Gold", ref: "Proverbs 25:11", verse: "Like apples of gold in settings of silver Is a word spoken in right circumstances.", note: "Kind, timely words are as beautiful as golden fruit. (The Hebrew word may also refer to apricots or citrons.)", link: { fruit: "apple" }, extra: [{ fruit: "apricot" }, { fruit: "citron" }] },
  { kind: "fruit", name: "Date Palm", ref: "Psalm 92:12", verse: "The righteous man will flourish like the palm tree, He will grow like a cedar in Lebanon.", note: "The date palm, tall and fruitful in the desert, is a picture of a flourishing life.", link: { fruit: "date" } },
  { kind: "fruit", name: "The Land of Plenty", ref: "Deuteronomy 8:8", verse: "a land of wheat and barley, of vines and fig trees and pomegranates, a land of olive oil and honey;", note: "The fruits of the Promised Land describe God's abundant provision.", link: { fruit: "pomegranate" }, extra: [{ fruit: "fig" }, { fruit: "grape" }, { fruit: "olive" }, { fruit: "date" }] }
];

// A short reflection for each entry, shown on the Bible page.
const BIBLE_REFLECTIONS = {
  "Hyssop": "What would you like God to wash clean in your life today?",
  "Hyssop at the Cross": "The same humble herb points to God's great rescue — then and now.",
  "Mustard Seed": "Small faith, planted and tended, can grow beyond what you imagine.",
  "Mint, Dill & Cummin": "Faithfulness in small things matters — but never more than mercy and love.",
  "Dill & Cummin at Harvest": "God knows exactly how gently each of us needs to be handled.",
  "Every Garden Herb": "Generosity is good — and so are justice and the love of God.",
  "Coriander": "God provides daily bread, often in ways we don't expect.",
  "Garlic": "When we long for 'the good old days,' remember God is leading somewhere better.",
  "Saffron & Cinnamon": "Love is meant to be a garden — fragrant, abundant and cared for.",
  "Fragrant Cinnamon": "Even everyday spices can be set apart for holy purposes.",
  "Aloes": "Acts of love and courage honor God, even in grief.",
  "Bitter Herbs": "God remembers our hard seasons and leads us into freedom.",
  "Olive Leaf": "After every storm, God offers peace and a new beginning.",
  "The Green Olive Tree": "Put down deep roots in God's lovingkindness, and you'll stay green.",
  "A Cake of Figs": "God cares for our bodies and uses the gifts of creation to heal.",
  "The Fig Tree": "Look for the signs of God's seasons in your life.",
  "Sycamore Fig": "No one is too small or too far away to be seen by Jesus.",
  "Pomegranate": "Beauty and worship belong together.",
  "The Vine": "Stay connected to Jesus, and good fruit will grow.",
  "Grapes of Eshcol": "God's promises are bigger and better than our fears.",
  "Raisins & Apples": "Simple, wholesome food is one of God's ways of refreshing us.",
  "Apples of Gold": "Choose words today that are as lovely as golden fruit.",
  "Date Palm": "Even in dry places, the righteous can flourish.",
  "The Land of Plenty": "Take time to thank God for the food on your table."
};

// Find the Bible entry that names a given herb or fruit.
function bibleEntryFor(kind, id) {
  return BIBLE_PLANTS.find((b) => [b.link, ...(b.extra || [])].some((l) => l && l[kind] === id));
}
