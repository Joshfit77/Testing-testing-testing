// The whole menu lives here. One entry = one item on the Menu page.
// Add, remove or reorder items without touching any HTML.
//
//   id          unique, lowercase-with-dashes
//   name        shown on the card
//   category    one of the keys in MENU_CATEGORIES
//   description one or two sentences
//   price       display text, e.g. "From $55" or "$65 half tray". Leave "" to show "Ask for pricing"
//   sizes       optional choices the customer picks when adding to a request
//   tags        optional labels: "GF", "DF", "Vegetarian", "Top seller", "Healthy"
//   photo       optional path, e.g. "images/chicken-parm.jpg"

window.MENU_CATEGORIES = {
  cakes: "Cakes",
  entrees: "Entrées",
  pasta: "Pasta",
};

const TRAYS = ["Half tray", "Full tray"];

window.MENU = [
  // Cakes
  {
    id: "italian-rainbow-cookie-cake",
    name: "Italian Rainbow Cookie Cake",
    category: "cakes",
    description: "All the almond, raspberry and chocolate of the classic rainbow cookie, in layer-cake form.",
    price: "From $55",
    tags: ["GF", "Top seller"],
  },
  {
    id: "hummingbird-carrot-cake",
    name: "Classic Hummingbird Carrot Cake",
    category: "cakes",
    description: "Carrot, pineapple and banana layers with cream cheese frosting.",
    price: "",
    tags: ["Top seller"],
  },
  {
    id: "boston-cream-bundt",
    name: "Boston Cream Bundt Cake",
    category: "cakes",
    description: "Vanilla bundt filled with pastry cream and finished with chocolate ganache.",
    price: "",
    tags: ["Top seller"],
  },
  {
    id: "chocolate-guinness-cake",
    name: "Chocolate Guinness Cake",
    category: "cakes",
    description: "Dark, moist chocolate stout cake with Baileys frosting.",
    price: "",
    tags: ["Top seller"],
  },
  {
    id: "lemon-blueberry-cake",
    name: "Lemon Blueberry Cake",
    category: "cakes",
    description: "Bright lemon cake studded with blueberries under a vanilla bean glaze.",
    price: "",
    tags: ["Top seller"],
  },
  {
    id: "pineapple-upside-down-cake",
    name: "Pineapple Upside-Down Cake",
    category: "cakes",
    description: "Caramelized pineapple and brown sugar over buttery cake.",
    price: "",
    tags: [],
  },
  {
    id: "german-chocolate-cake",
    name: "German Chocolate Cake",
    category: "cakes",
    description: "Chocolate layers with coconut-pecan frosting.",
    price: "",
    tags: [],
  },
  {
    id: "pistachio-pudding-cake",
    name: "Pistachio Pudding Cake",
    category: "cakes",
    description: "Tender pistachio cake with a light, creamy finish.",
    price: "",
    tags: [],
  },

  // Entrées
  {
    id: "chicken-parm",
    name: "Chicken Parmigiana",
    category: "entrees",
    description: "Breaded cutlets baked with marinara and melted mozzarella.",
    price: "",
    sizes: TRAYS,
    tags: [],
  },
  {
    id: "chicken-marsala",
    name: "Chicken Marsala",
    category: "entrees",
    description: "Tender chicken in a mushroom and Marsala wine sauce.",
    price: "",
    sizes: TRAYS,
    tags: [],
  },

  // Pasta
  {
    id: "penne-alla-vodka",
    name: "Penne alla Vodka",
    category: "pasta",
    description: "Penne in a creamy tomato vodka sauce.",
    price: "",
    sizes: TRAYS,
    tags: ["Vegetarian"],
  },
];
