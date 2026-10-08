// Made by scripts/build.js from the photos in images/herbs/, images/fruits/, images/foods/ and images/scenes/. Don't edit by hand.
const MY_PHOTOS = {
  "fruit:apple": {
    "src": "images/fruits/apple.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:avocado": {
    "src": "images/fruits/avocado.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:banana": {
    "src": "images/fruits/banana.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:blackberry": {
    "src": "images/fruits/blackberry.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:blueberry": {
    "src": "images/fruits/blueberry.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:cherry": {
    "src": "images/fruits/cherry.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:coconut": {
    "src": "images/fruits/coconut.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:cucumber": {
    "src": "images/fruits/cucumber.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:date": {
    "src": "images/fruits/date.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:fig": {
    "src": "images/fruits/fig.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:grape": {
    "src": "images/fruits/grape.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:grapefruit": {
    "src": "images/fruits/grapefruit.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:kiwi": {
    "src": "images/fruits/kiwi.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:lemon": {
    "src": "images/fruits/lemon.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:lime": {
    "src": "images/fruits/lime.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:mango": {
    "src": "images/fruits/mango.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:olive": {
    "src": "images/fruits/olive.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:orange": {
    "src": "images/fruits/orange.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:papaya": {
    "src": "images/fruits/papaya.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:peach": {
    "src": "images/fruits/peach.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:pear": {
    "src": "images/fruits/pear.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:pineapple": {
    "src": "images/fruits/pineapple.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:pomegranate": {
    "src": "images/fruits/pomegranate.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:prune": {
    "src": "images/fruits/prune.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:pumpkin": {
    "src": "images/fruits/pumpkin.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:raspberry": {
    "src": "images/fruits/raspberry.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:strawberry": {
    "src": "images/fruits/strawberry.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:tart-cherry": {
    "src": "images/fruits/tart-cherry.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:tomato": {
    "src": "images/fruits/tomato.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "fruit:watermelon": {
    "src": "images/fruits/watermelon.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:almonds": {
    "src": "images/foods/almonds.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:beets": {
    "src": "images/foods/beets.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:black-beans": {
    "src": "images/foods/black-beans.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:bone-broth": {
    "src": "images/foods/bone-broth.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:broccoli": {
    "src": "images/foods/broccoli.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:carrots": {
    "src": "images/foods/carrots.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:chia-seeds": {
    "src": "images/foods/chia-seeds.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:chicken-breast": {
    "src": "images/foods/chicken-breast.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:chickpeas": {
    "src": "images/foods/chickpeas.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:cottage-cheese": {
    "src": "images/foods/cottage-cheese.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:dark-chocolate": {
    "src": "images/foods/dark-chocolate.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:eggs": {
    "src": "images/foods/eggs.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:flaxseed": {
    "src": "images/foods/flaxseed.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:greek-yogurt": {
    "src": "images/foods/greek-yogurt.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:honey": {
    "src": "images/foods/honey.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:kale": {
    "src": "images/foods/kale.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:kefir": {
    "src": "images/foods/kefir.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:lean-beef": {
    "src": "images/foods/lean-beef.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:lentils": {
    "src": "images/foods/lentils.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:oats": {
    "src": "images/foods/oats.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:olive-oil": {
    "src": "images/foods/olive-oil.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:pumpkin-seeds": {
    "src": "images/foods/pumpkin-seeds.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:quinoa": {
    "src": "images/foods/quinoa.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:salmon": {
    "src": "images/foods/salmon.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:sardines": {
    "src": "images/foods/sardines.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:sauerkraut": {
    "src": "images/foods/sauerkraut.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:spinach": {
    "src": "images/foods/spinach.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:sweet-potato": {
    "src": "images/foods/sweet-potato.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:tofu": {
    "src": "images/foods/tofu.jpg",
    "credit": "Image: Beauty & Praise"
  },
  "food:walnuts": {
    "src": "images/foods/walnuts.jpg",
    "credit": "Image: Beauty & Praise"
  }
};
const MY_SCENES = {};
const MY_ART = {
  "oil-avocado-olive": "images/oil-avocado-olive.jpg",
  "oil-berries": "images/oil-berries.jpg",
  "oil-chamomile": "images/oil-chamomile.jpg",
  "oil-cinnamon": "images/oil-cinnamon.jpg",
  "oil-citrus": "images/oil-citrus.jpg",
  "oil-elderberry": "images/oil-elderberry.jpg",
  "oil-food-abundance": "images/oil-food-abundance.jpg",
  "oil-garlic": "images/oil-garlic.jpg",
  "oil-ginger": "images/oil-ginger.jpg",
  "oil-greens": "images/oil-greens.jpg",
  "oil-herbs": "images/oil-herbs.jpg",
  "oil-honey-lemon": "images/oil-honey-lemon.jpg",
  "oil-honey": "images/oil-honey.jpg",
  "oil-peppermint": "images/oil-peppermint.jpg",
  "oil-pomegranate": "images/oil-pomegranate.jpg",
  "oil-roots": "images/oil-roots.jpg",
  "oil-rosemary": "images/oil-rosemary.jpg",
  "oil-thyme": "images/oil-thyme.jpg",
  "oil-turmeric": "images/oil-turmeric.jpg"
};
