// The site shows a curated selection of herbs and fruits, so it stays simple and focused.
// To bring an herb or fruit back, add its id to the lists below and run `node scripts/build.js`.
// (All the original data is still in herbs-data.js and fruits-data.js.)

const KEEP_HERBS = [
  "chamomile", "peppermint", "ginger", "turmeric", "lavender", "rosemary", "thyme", "basil", "holy-basil", "fennel",
  "lemon-balm", "garlic", "cinnamon", "fenugreek", "echinacea", "elderberry", "calendula", "hibiscus", "aloe-vera",
  "dandelion", "nettle", "milk-thistle", "ginseng", "ashwagandha", "valerian", "passionflower", "saw-palmetto",
  "green-tea", "black-seed", "tongkat-ali", "shilajit", "maca", "mucuna"
];
const KEEP_FRUITS = [
  "apple", "avocado", "banana", "blackberry", "blueberry", "cherry", "tart-cherry", "coconut", "date", "fig", "grape",
  "grapefruit", "kiwi", "lemon", "lime", "mango", "orange", "papaya", "peach", "pear", "pineapple", "pomegranate",
  "prune", "raspberry", "strawberry", "watermelon", "olive", "tomato", "cucumber", "pumpkin"
];

(function prune() {
  const keepIn = (arr, ok) => { for (let i = arr.length - 1; i >= 0; i--) if (!ok(arr[i])) arr.splice(i, 1); };
  keepIn(HERBS, (h) => KEEP_HERBS.includes(h.id));
  keepIn(FRUITS, (f) => KEEP_FRUITS.includes(f.id));
  const herbOk = (id) => KEEP_HERBS.includes(id);
  const fruitOk = (id) => KEEP_FRUITS.includes(id);
  const keyOk = (k) => k.startsWith("fruit:") ? fruitOk(k.slice(6)) : k.startsWith("food:") ? true : herbOk(k);

  if (typeof INTERACTIONS !== "undefined") INTERACTIONS.forEach((x) => ["avoid", "caution"].forEach((lvl) =>
    Object.keys(x[lvl]).forEach((k) => { if (!keyOk(k)) delete x[lvl][k]; })));
  if (typeof TOPIC_GUIDES !== "undefined") TOPIC_GUIDES.forEach((g) => { keepIn(g.herbs, herbOk); keepIn(g.fruits, fruitOk); });
  if (typeof STACKS !== "undefined") keepIn(STACKS, (st) => st.herbs.every((x) => herbOk(x.id)));
  if (typeof TOPIC_GUIDES !== "undefined" && typeof STACKS !== "undefined") TOPIC_GUIDES.forEach((g) => keepIn(g.stacks, (id) => STACKS.some((s) => s.id === id)));
  if (typeof SEASONS !== "undefined") SEASONS.forEach((s) => keepIn(s.herbs, herbOk));
  if (typeof REMEDIES !== "undefined") REMEDIES.forEach((r) => keepIn(r.items, keyOk));
  if (typeof BIBLE_PLANTS !== "undefined") {
    const linkOk = (l) => l && (l.herb ? herbOk(l.herb) : l.fruit ? fruitOk(l.fruit) : true);
    BIBLE_PLANTS.forEach((b) => { if (b.extra) keepIn(b.extra, linkOk); });
    keepIn(BIBLE_PLANTS, (b) => linkOk(b.link));
  }
  if (typeof ARTICLES !== "undefined") keepIn(ARTICLES, (a) => herbOk(a.herb));
})();
