// Simple herbal recipes. herbs/fruits link to their pages; guide links to the matching wellness guide.
// ingredients: [amount, item]

const RECIPE_TYPES = { tea: "Teas", drink: "Drinks & Smoothies", syrup: "Syrups & Remedies", food: "In the Kitchen", body: "Skin, Hair & Bath" };

const RECIPES = [
  {
    id: "sleepy-time-tea", name: "Sleepy-Time Herbal Tea", type: "tea", time: "10 minutes", yield: "1 mug", guide: "sleep",
    herbs: ["chamomile", "lemon-balm", "lavender"], fruits: [],
    intro: "A gentle, floral bedtime tea that helps you wind down. Chamomile and lemon balm calm the nerves, and a tiny pinch of lavender adds a relaxing aroma.",
    ingredients: [["1 tsp", "dried chamomile flowers"], ["1 tsp", "dried lemon balm leaf"], ["1 small pinch", "dried lavender buds"], ["1 cup (240 ml)", "just-boiled water"], ["1 tsp (optional)", "honey"]],
    steps: ["Put the chamomile, lemon balm and lavender in a tea infuser or teapot.", "Pour the just-boiled water over the herbs.", "Cover the mug or pot (this keeps the calming oils in) and steep for 8–10 minutes.", "Strain, stir in honey if you like, and sip slowly 30–60 minutes before bed."],
    tips: ["Too much lavender tastes soapy — a pinch is plenty.", "Make a jar of the dry blend so it's ready every night."],
    storage: "Store the dry blend in a sealed jar away from light for up to 6 months.",
    safety: "Can add to the drowsiness of sleep medicines and alcohol. Avoid if allergic to ragweed or daisies. If pregnant, ask your midwife first."
  },
  {
    id: "ginger-lemon-honey", name: "Ginger, Lemon & Honey Tea", type: "tea", time: "15 minutes", yield: "2 mugs", guide: "cold-flu",
    herbs: ["ginger"], fruits: ["lemon"],
    intro: "A warming classic for chilly days, scratchy throats and queasy stomachs.",
    ingredients: [["2-inch (5 cm) piece", "fresh ginger, thinly sliced"], ["2 cups (480 ml)", "water"], ["½", "lemon, juiced"], ["1–2 tsp", "raw honey"]],
    steps: ["Add the sliced ginger and water to a small pot.", "Bring to a boil, then simmer gently for 10 minutes.", "Turn off the heat and stir in the lemon juice.", "Pour into mugs, let cool for a minute, then stir in honey."],
    tips: ["For a stronger tea, grate the ginger instead of slicing it.", "Add a cinnamon stick while simmering for extra warmth."],
    storage: "Best fresh. Keeps in the fridge for 2 days — reheat gently.",
    safety: "Never give honey to babies under 1 year. Large amounts of ginger may increase bleeding with blood thinners."
  },
  {
    id: "golden-milk", name: "Golden Milk", type: "drink", time: "10 minutes", yield: "1 mug", guide: "joints",
    herbs: ["turmeric", "ginger", "cinnamon", "black-pepper"], fruits: [],
    intro: "A creamy, comforting drink from Indian tradition. Black pepper and a little fat help your body absorb turmeric's curcumin.",
    ingredients: [["1 cup (240 ml)", "milk (dairy, oat, almond or coconut)"], ["1 tsp", "ground turmeric"], ["½ tsp", "ground ginger"], ["½ tsp", "ground cinnamon"], ["1 pinch", "black pepper"], ["1 tsp", "honey or maple syrup"], ["2 drops (optional)", "vanilla extract"]],
    steps: ["Pour the milk into a small pot over medium-low heat.", "Whisk in the turmeric, ginger, cinnamon and black pepper.", "Heat until steaming, whisking often — don't let it boil.", "Simmer gently for 3–5 minutes, then stir in honey and vanilla and pour into a mug."],
    tips: ["Make a paste of the spices with a little honey to keep in the fridge for quick golden milk.", "Turmeric stains — use a dark mug and wipe spills quickly."],
    storage: "Best fresh. The spice paste keeps in the fridge for 2 weeks.",
    safety: "Avoid large amounts if you have gallstones, take blood thinners or diabetes medicine, or have surgery coming up."
  },
  {
    id: "elderberry-syrup", name: "Homemade Elderberry Syrup", type: "syrup", time: "1 hour", yield: "About 2 cups", guide: "immunity",
    herbs: ["elderberry", "ginger", "cinnamon", "clove"], fruits: [],
    intro: "A rich, spiced syrup to keep on hand for cold and flu season.",
    ingredients: [["⅔ cup", "dried elderberries"], ["3½ cups (840 ml)", "water"], ["2 tbsp", "fresh ginger, sliced"], ["1", "cinnamon stick"], ["4", "whole cloves"], ["1 cup (240 ml)", "raw honey"]],
    steps: ["Add the elderberries, water, ginger, cinnamon and cloves to a pot.", "Bring to a boil, then simmer uncovered for 40–45 minutes until reduced by about half.", "Mash the berries, then strain through a fine sieve or cloth.", "Let cool until just warm (not hot), then stir in the honey.", "Pour into a clean glass jar and refrigerate."],
    tips: ["Adults: 1 tablespoon a day in cold season, or every 3–4 hours for a few days when sick. Children over 1: 1 teaspoon."],
    storage: "Keeps in the fridge for up to 2 months.",
    safety: "Always cook elderberries — raw berries can cause vomiting. Never give honey to babies under 1. Avoid with autoimmune conditions or immune-suppressing medicine."
  },
  {
    id: "thyme-honey-syrup", name: "Thyme & Honey Cough Syrup", type: "syrup", time: "20 minutes", yield: "About 1 cup", guide: "cold-flu",
    herbs: ["thyme"], fruits: ["lemon"],
    intro: "A simple kitchen remedy for coughs and sore throats. Thyme helps loosen mucus and honey coats the throat.",
    ingredients: [["2 tbsp", "dried thyme (or a handful of fresh sprigs)"], ["1 cup (240 ml)", "water"], ["½ cup (120 ml)", "raw honey"], ["1 tbsp", "lemon juice"]],
    steps: ["Bring the water to a boil, add the thyme, cover and turn off the heat.", "Steep for 15 minutes, then strain.", "Let the tea cool until warm, then stir in the honey and lemon juice until smooth.", "Pour into a clean jar."],
    tips: ["Adults: 1 teaspoon to 1 tablespoon as needed, up to 4 times a day. Children over 1: ½–1 teaspoon."],
    storage: "Keeps in the fridge for up to 3 weeks.",
    safety: "Never give honey to babies under 1. See a doctor for a cough lasting over 3 weeks, high fever, chest pain or trouble breathing."
  },
  {
    id: "hibiscus-iced-tea", name: "Ruby Hibiscus Iced Tea", type: "drink", time: "10 minutes + chilling", yield: "4 glasses", guide: "heart",
    herbs: ["hibiscus", "spearmint"], fruits: ["lime"],
    intro: "A tart, ruby-red cooler that's naturally caffeine-free and studied for supporting healthy blood pressure.",
    ingredients: [["¼ cup", "dried hibiscus"], ["4 cups (1 L)", "water"], ["1", "lime, sliced"], ["A few sprigs", "fresh mint"], ["1–2 tbsp (optional)", "honey"]],
    steps: ["Pour 2 cups of just-boiled water over the hibiscus and steep for 10 minutes.", "Strain and stir in honey while warm.", "Add the remaining 2 cups of cold water, the lime and the mint.", "Chill and serve over ice."],
    tips: ["Cold-brew option: steep hibiscus in cold water in the fridge overnight."],
    storage: "Keeps in the fridge for 3 days.",
    safety: "May lower blood pressure further if you take blood pressure medicine. Avoid during pregnancy."
  },
  {
    id: "mint-cucumber-water", name: "Mint, Cucumber & Lemon Water", type: "drink", time: "5 minutes", yield: "1 pitcher", guide: "skin",
    herbs: ["spearmint"], fruits: ["cucumber", "lemon"],
    intro: "A spa-style water that makes it easy to drink more through the day.",
    ingredients: [["½", "cucumber, thinly sliced"], ["½", "lemon, sliced"], ["A handful", "fresh mint leaves"], ["8 cups (2 L)", "cold water"]],
    steps: ["Gently crush the mint leaves in your hand to release their oils.", "Add the mint, cucumber and lemon to a pitcher.", "Fill with cold water and chill for at least 1 hour."],
    tips: ["Refill the pitcher once with water — the flavor lasts for a second round."],
    storage: "Best within 24 hours; remove the lemon after 4 hours to avoid bitterness.",
    safety: "Very safe. Lemon acid can affect tooth enamel — rinse with plain water after."
  },
  {
    id: "blueberry-power-smoothie", name: "Blueberry Power Smoothie", type: "drink", time: "5 minutes", yield: "1 large glass", guide: "memory",
    herbs: ["cinnamon"], fruits: ["blueberry", "banana"],
    intro: "A creamy purple smoothie packed with anthocyanins, fiber and steady energy.",
    ingredients: [["1 cup", "frozen blueberries"], ["1", "ripe banana"], ["1 handful", "spinach"], ["1 tbsp", "ground flaxseed or chia seeds"], ["1 cup (240 ml)", "milk or plain yogurt"], ["½ tsp", "ground cinnamon"]],
    steps: ["Add everything to a blender.", "Blend until smooth, adding a splash of water if it's too thick.", "Pour and enjoy right away."],
    tips: ["Add a scoop of protein powder or Greek yogurt for a filling breakfast."],
    storage: "Best fresh. Freeze leftovers in popsicle molds.",
    safety: "Very safe for most people."
  },
  {
    id: "tart-cherry-sleep-mocktail", name: "Tart Cherry Sleepy Mocktail", type: "drink", time: "3 minutes", yield: "1 glass", guide: "sleep",
    herbs: [], fruits: ["tart-cherry", "lime"],
    intro: "A fizzy evening drink with tart cherry juice, which contains natural melatonin.",
    ingredients: [["½ cup (120 ml)", "unsweetened tart cherry juice"], ["½ cup (120 ml)", "sparkling water"], ["1 squeeze", "lime juice"], ["A few", "ice cubes"]],
    steps: ["Fill a glass with ice.", "Pour in the tart cherry juice and lime.", "Top with sparkling water and stir gently.", "Sip about an hour before bed."],
    tips: ["Add a sprig of mint or a few frozen cherries for garnish."],
    storage: "Make fresh.",
    safety: "Tart cherry juice contains natural sugar — choose unsweetened and watch portions if you have diabetes."
  },
  {
    id: "garden-herb-pesto", name: "Garden Herb Pesto", type: "food", time: "10 minutes", yield: "About 1 cup", guide: "heart",
    herbs: ["basil", "parsley", "garlic"], fruits: ["lemon"],
    intro: "A bright, garlicky sauce full of fresh herbs and heart-healthy olive oil.",
    ingredients: [["2 cups", "fresh basil leaves"], ["½ cup", "fresh parsley"], ["2 cloves", "garlic"], ["⅓ cup", "walnuts or pine nuts"], ["½ cup", "grated Parmesan"], ["½ cup (120 ml)", "extra virgin olive oil"], ["1 tbsp", "lemon juice"], ["To taste", "salt and pepper"]],
    steps: ["Crush the garlic and let it rest for 10 minutes (this boosts allicin).", "Pulse the basil, parsley, garlic and nuts in a food processor.", "Add the Parmesan and lemon juice and pulse again.", "With the motor running, drizzle in the olive oil until smooth. Season to taste."],
    tips: ["Toss with pasta, spread on toast, or drizzle over roasted vegetables and eggs."],
    storage: "Keeps in the fridge for 5 days with a thin layer of oil on top, or freeze in ice cube trays.",
    safety: "Contains nuts and dairy. Basil and parsley are high in vitamin K — keep amounts steady if you take warfarin."
  },
  {
    id: "digestive-fennel-tea", name: "After-Dinner Fennel Tea", type: "tea", time: "10 minutes", yield: "1 mug", guide: "digestion",
    herbs: ["fennel", "peppermint", "ginger"], fruits: [],
    intro: "A sweet, soothing tea to ease bloating and heaviness after a big meal.",
    ingredients: [["1 tsp", "fennel seeds, lightly crushed"], ["1 tsp", "dried peppermint"], ["2 thin slices", "fresh ginger"], ["1 cup (240 ml)", "just-boiled water"]],
    steps: ["Crush the fennel seeds with the back of a spoon to release their oils.", "Add fennel, peppermint and ginger to a mug.", "Pour over the just-boiled water, cover and steep for 8–10 minutes.", "Strain and sip after meals."],
    tips: ["If you have heartburn, leave out the peppermint."],
    storage: "Keep a dry blend of fennel and peppermint in a jar for up to 6 months.",
    safety: "Peppermint can worsen reflux. Fennel has mild estrogen-like effects — check with your doctor if you have a hormone-sensitive condition."
  },
  {
    id: "calendula-salve", name: "Calendula Healing Salve", type: "body", time: "4–6 weeks infusing + 20 minutes", yield: "About 4 small tins", guide: "skin",
    herbs: ["calendula"], fruits: [],
    intro: "A golden, gentle balm for dry hands, chapped lips, minor scrapes and irritated skin.",
    ingredients: [["½ cup", "dried calendula petals"], ["1 cup (240 ml)", "olive oil"], ["2 tbsp (about 1 oz / 28 g)", "beeswax pellets"], ["10 drops (optional)", "vitamin E oil"]],
    steps: ["Fill a clean, dry jar with the calendula petals and cover completely with olive oil.", "Close the jar and leave it in a warm, sunny window for 4–6 weeks, shaking every few days.", "Strain the oil through a cloth, squeezing out every drop.", "Gently melt the beeswax in a double boiler, then stir in ¾ cup of the calendula oil (and vitamin E).", "Pour into small tins or jars and let set before closing."],
    tips: ["Quick method: warm the petals and oil in a double boiler on very low heat for 2–3 hours instead of waiting weeks."],
    storage: "Keeps for about a year in a cool, dark place.",
    safety: "For use on the skin only. Patch-test first and avoid if allergic to daisy-family plants. Not for deep or infected wounds."
  },
  {
    id: "rosemary-hair-rinse", name: "Rosemary Shine Hair Rinse", type: "body", time: "20 minutes + cooling", yield: "2 cups", guide: "hair",
    herbs: ["rosemary"], fruits: [],
    intro: "A simple rinse to finish your wash day, traditionally used for shiny hair and a healthy scalp.",
    ingredients: [["2 tbsp", "dried rosemary (or 3–4 fresh sprigs)"], ["2 cups (480 ml)", "water"], ["1 tbsp (optional)", "apple cider vinegar"]],
    steps: ["Bring the water to a boil, add the rosemary, cover and turn off the heat.", "Steep for 20 minutes, then strain and let cool completely.", "Stir in the vinegar if using.", "After shampooing, pour slowly over your scalp and hair, massage for a minute, and leave it in or rinse lightly."],
    tips: ["Use 2–3 times a week. For a stronger scalp treatment, see rosemary oil on the rosemary page."],
    storage: "Keeps in the fridge for up to 1 week.",
    safety: "For external use. Stop if your scalp becomes irritated. Keep out of eyes."
  },
  {
    id: "soothing-oatmeal-bath", name: "Soothing Oatmeal Bath", type: "body", time: "5 minutes + soaking", yield: "1 bath", guide: "skin",
    herbs: ["oat-straw", "lavender"], fruits: [],
    intro: "A gentle soak for itchy, dry or sun-irritated skin, using the same colloidal oatmeal recommended for eczema.",
    ingredients: [["1 cup", "plain rolled oats"], ["2 tbsp (optional)", "dried lavender or chamomile"], ["1", "clean muslin bag or old sock (optional)"]],
    steps: ["Blend the oats (and flowers) in a blender until they become a very fine powder.", "Test: a spoonful stirred into warm water should turn it milky.", "Sprinkle the powder into a warm (not hot) running bath and stir, or tie it in a muslin bag.", "Soak for 15–20 minutes, then pat skin dry and moisturize."],
    tips: ["The tub can get slippery — be careful getting out."],
    storage: "Keep the oat powder in a sealed jar for up to 3 months.",
    safety: "Very safe. For babies and young children, ask your pediatrician and leave out the flowers."
  }
];
