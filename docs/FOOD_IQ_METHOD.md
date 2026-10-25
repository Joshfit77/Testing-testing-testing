# Narrow Gate Food IQ: method (FIQ-0.1, experimental)

> **Public name: "Nutrition Score".** "Food IQ" is a registered US trademark of another company (see
> `docs/launch-audit/TRADEMARKS.md`), so members never see that name: every screen, link, prompt and spoken label says
> "Nutrition Score" (`NUTRITION_SCORE_LABEL` in `src/lib/food-iq.ts`) until a replacement name is cleared. The method,
> file names, the `FOOD_IQ_SCORE` flag, the `FIQ-0.1` version and the test ids keep their internal names.

**Status: experimental, not yet reviewed. The 0–100 rating is off in production by default** (`FOOD_IQ_SCORE` must be
`on`). When it's on, it's labelled "Experimental · not yet reviewed". Until a qualified reviewer (a registered
dietitian or nutrition scientist) has checked this method, Food IQ shows the established indicators and the
plain-language points instead (see "Before switching it on").

Code: `src/lib/food-iq.ts` (rating, nutrient classes, Fits your goals) and `src/lib/additive-evidence.ts` (ingredient
evidence). Tests: `tests/unit/food-iq.test.ts`, reference foods in `tests/fixtures/food-iq-reference-foods.ts`.

## What the number means

- **What it is:** a nutritional-quality rating per 100 g (or 100 ml for drinks), for comparing products. 75/100 is
  **not** a 75% chance that a food is healthy or safe.
- **What it leaves out:** allergens, additives, processing and personal needs. These are shown separately:
  - "Ingredients worth knowing about";
  - NOVA;
  - allergens;
  - "Fits your goals".
- **Not about portions:** a small serving of a lower-rated food can still fit a plan.

## Research it draws on (and how it differs)

Recognised nutrient-profiling methods were reviewed for what they measure:
- **Nutri-Score:** the 2023 updates for foods and drinks (Santé publique France; Merz et al., Nature Food, 2024);
- **UK Ofcom / FSA:** the nutrient profiling model and front-of-pack "traffic light" guidance (2016);
- **EU nutrition-claim conditions:** Regulation (EC) No 1924/2006, Annex;
- **EU reference intakes:** Regulation (EU) No 1169/2011, Annex XIII;
- **Nutrient-rich food indices:** the idea of crediting nutrients to encourage as well as limiting ones.

Food IQ is an independent, original formula:
- **Not a copy:** it doesn't reproduce Nutri-Score's or any app's point tables, weights or grades.
- **Continuous anchors:** it uses continuous (linear) scales between published regulatory and guidance values.
- **Separate categories:** foods, drinks and fats/oils/nuts each have their own treatment.
- **Explained:** every point is shown to the user.

No other app's code, branding, scoring method, database or interface was used.

## The formula

Each component gives points on a straight line: `lin(x, a, b)` is 0 at or below `a`, 10 at or above `b`, and
proportional in between.

### Foods (per 100 g)

| Component | Points | Anchors and sources |
|---|---|---|
| − Sugars | lin(sugars, 5, 22.5) | 5 g: EU "low sugars"; 22.5 g: UK "high" |
| − Saturated fat | lin(sat fat, 1.5, 5) | 1.5 g: EU "low saturated fat"; 5 g: UK "high" |
| − Salt | lin(salt, 0.3, 1.5) | 0.3 g: UK "low" (= EU "low sodium", 0.12 g sodium); 1.5 g: UK "high" |
| − Calories | 0.5 × lin(kcal, 150, 400) | 400 kcal = 20% of the 2,000 kcal EU reference intake per 100 g. **Half weight** so high-calorie foods aren't marked down much for calories alone |
| + Protein | lin(protein % of energy, 8, 20) | 12% / 20% of energy: EU "source of" / "high protein". Relative to energy, so it isn't a single gram threshold |
| + Fibre | lin(fibre, 0, 6) | 3 g / 6 g: EU "source of" / "high fibre". Missing fibre counts as 0, and the page says so (the rating can only be too low) |
| + Fruit, vegetables, legumes, nuts | lin(%, 40, 80) | From the label value or Open Food Facts' estimate from the ingredients; not counted when unknown (stated) |
| + Mostly unsaturated fat | 0.5 × lin(unsaturated % of fat, 50, 85) | Only for foods with 10 g of fat or more per 100 g (e.g. oily fish, avocado) |

### Drinks (per 100 ml)

| Component | Points | Anchors and sources |
|---|---|---|
| − Sugars | 3 × lin(sugars, 0.5, 11.25) | 0.5 g: EU "sugar-free"; 11.25 g: UK "high" for drinks. Triple weight: sugary drinks are a leading source of free sugars |
| − Calories | 0.5 × lin(kcal, 4, 60) | 4 kcal: EU "energy-free" |
| − Saturated fat | lin(sat fat, 0.75, 2.5) | EU "low" / UK "high" for drinks |
| − Salt | lin(salt, 0.3, 0.75) | UK "low" / "high" for drinks |
| − Non-sugar sweeteners | 10 if present | The WHO (2023) advises against relying on them for weight control (a conditional recommendation). Diet patterns, not a safety finding. Polyols aren't included (the WHO guideline excludes them) |
| + Protein, fibre (0–3 g), fruit/veg share | as for foods | |

### Fats, oils, nuts and seeds (per 100 g)

| Component | Points | Notes |
|---|---|---|
| − Saturated share of the fat | lin(sat ÷ fat %, 15, 60) | The type of fat matters more than the amount: most vegetable oils are under 15%, butter and coconut oil over 60% |
| − Sugars, − Salt | as for foods | |
| + Mostly unsaturated fat | lin(unsaturated %, 50, 85) | |
| + Protein, + Fibre | as for foods | Calories aren't counted for this category |

### Combining

- **N:** the sum of the points of concern.
- **P:** the sum of the positive points, capped at 20, and multiplied by `1 − 0.5 × clamp((N − 5) ÷ 10, 0, 1)`.
  Positives count fully up to 5 points of concern and only half at 15 or more. **This is the protein guard:** protein
  or fibre can't lift a product that's high in sugars, salt or saturated fat into a high band.
- **Foods and fats:** `score = 50 + 2.5 × P − 1.5 × N`. A product with nothing notable either way scores 50.
- **Drinks:** `score = 80 + 2.5 × P − 2 × N`. An unsweetened, energy-free drink scores 80. Plain water (no energy, no
  sugar, no sweeteners) is the reference drink at 100.
- **Rounding:** the result is rounded and clamped to 0–100.

### Bands (and why)

| Band | Score | Meaning in this formula |
|---|---|---|
| Excellent | 85–100 | Strong positives (high fibre and/or protein, fruit/veg) and almost nothing to watch |
| Good | 70–84 | Clear net positives: at least 8 positive points more than the weighted concerns |
| Moderate | 50–69 | Roughly balanced, or a few concerns offset by positives |
| Poor | 30–49 | Net concerns, typically one nutrient at UK "high" level or several at "medium" |
| Very poor | 0–29 | Several high-level concerns (e.g. high in sugar *and* saturated fat) with little to offset them |

The bands proposed in the brief were kept because they line up with the formula's structure. 50 means "neutral" and
each band is about a fixed number of net points away. They are UI bands, not scientific thresholds.

## When there's no rating

- **Missing required values → no rating, and the missing items are named. Nothing is estimated.** Required:
  - energy, sugars, saturated fat, salt (or sodium) and protein;
  - plus total fat for fats and oils.
- **Not rated, with the reason shown:** alcoholic drinks, baby foods and infant formulas, dietary supplements, herbs
  and spices, table salt and table-top sweeteners.

## Checked against reference foods

40 typical foods (values rounded from USDA FoodData Central and typical labels; not specific products).

**What "expected" means:** the range dietary guidance would lead you to expect. These ranges are a sanity check,
**not** validation.

**Result:** all 40 land in their expected ranges. The tests also check orderings and monotonicity:
- wholemeal > white bread; plain > fruit yogurt; olive > coconut oil; unsalted > salted butter;
- oats > sweetened granola > frosted cereal; tea > diet cola > orange juice > cola;
- more sugar, salt or saturated fat never raises a score; more fibre or protein never lowers it (300 random products).

| Food | Group | Score | Band | Expected | N | P |
|---|---|---|---|---|---|---|
| Broccoli, raw | Vegetables | 100 | Excellent | 85–100 | 0 | 20 |
| Apple, raw | Fruit | 80 | Good | 70–100 | 3.1 | 14 |
| Banana, raw | Fruit | 80 | Good | 70–100 | 4.1 | 14.3 |
| Raisins | Fruit | 55 | Moderate | 30–69 | 13 | 9.7 |
| Hummus | Legumes | 91 | Excellent | 70–100 | 5.3 | 19.7 |
| Lentils, boiled | Legumes | 100 | Excellent | 85–100 | 0 | 20 |
| Rolled oats | Whole grains | 80 | Good | 70–100 | 4.6 | 14.9 |
| Wholemeal bread | Whole grains | 83 | Good | 70–100 | 7.5 | 17.5 |
| White bread | Refined grains | 53 | Moderate | 40–69 | 9.8 | 7 |
| Pasta, dry | Refined grains | 69 | Moderate | 50–84 | 4.4 | 10.3 |
| Brown rice, raw | Whole grains | 59 | Moderate | 50–84 | 4.4 | 6.3 |
| Frosted flakes cereal | Sweetened cereals | 27 | Very poor | 0–49 | 17.8 | 1.7 |
| Granola with added sugar | Sweetened cereals | 47 | Poor | 30–69 | 15 | 7.9 |
| Chicken breast, raw | Lean protein | 75 | Good | 70–84 | 0 | 10 |
| Salmon, raw | Oily fish | 74 | Good | 50–84 | 5.8 | 13.2 |
| Eggs, whole | Eggs | 66 | Moderate | 50–84 | 5.4 | 9.8 |
| Bacon, cured | Processed meat | 20 | Very poor | 0–29 | 25 | 3.1 |
| Protein bar (typical) | Protein snacks | 61 | Moderate | 40–69 | 12.8 | 12.2 |
| Greek yogurt, plain 0% | Dairy | 75 | Good | 70–84 | 0 | 10 |
| Fruit yogurt, whole milk | Dairy | 50 | Moderate | 30–69 | 6.8 | 4 |
| Whole milk | Dairy | 73 | Good | 50–84 | 1.1 | 10 |
| Cheddar cheese | Cheese | 25 | Very poor | 0–49 | 25 | 5 |
| Potato crisps | Salty snacks | 37 | Poor | 0–49 | 18.7 | 6.2 |
| Milk chocolate | Confectionery | 20 | Very poor | 0–29 | 25 | 2.9 |
| Dark chocolate 70% | Confectionery | 25 | Very poor | 0–49 | 25 | 5 |
| Instant noodles with seasoning | Ready meals | 19 | Very poor | 0–29 | 25 | 2.5 |
| Tomato ketchup | Condiments | 27 | Very poor | 0–49 | 20 | 2.8 |
| Extra virgin olive oil | Oils | 75 | Good | 70–84 | 0 | 10 |
| Sunflower oil | Oils | 75 | Good | 70–84 | 0 | 10 |
| Coconut oil | Oils | 35 | Poor | 0–49 | 10 | 0 |
| Butter, salted | Animal fats | 20 | Very poor | 0–29 | 20 | 0 |
| Butter, unsalted | Animal fats | 35 | Poor | 0–49 | 10 | 0 |
| Almonds | Nuts | 100 | Excellent | 85–100 | 0 | 20 |
| Peanut butter, sweetened and salted | Nuts | 72 | Good | 50–84 | 10.1 | 14.9 |
| Still spring water | Water | 100 | Excellent | 100–100 | 0 | 0 |
| Unsweetened black tea | Unsweetened drinks | 80 | Good | 70–89 | 0 | 0 |
| Cola | Sugary drinks | 17 | Very poor | 0–29 | 31.6 | 0 |
| Diet cola (sweeteners) | Sweetened drinks | 60 | Moderate | 50–69 | 10 | 0 |
| Orange juice, 100% | Juices | 42 | Poor | 30–49 | 25.7 | 5.4 |
| Sports drink | Sugary drinks | 45 | Poor | 0–49 | 17.3 | 0 |

## Known biases and limitations (for the reviewer)

- **Cheese** scores Very poor or Poor (saturated fat and salt). Its calcium isn't counted; Nutri-Score has a special
  rule for cheese, and this method doesn't.
- **Eggs and oily fish** are held to Moderate or Good by saturated fat; omega-3 fats aren't counted. Fish benefits only
  from the "mostly unsaturated" bonus.
- **Plain starchy staples** (brown rice, pasta) rate Moderate: whole-grain content isn't credited beyond fibre.
- **Processed meats:**
  - the rating is nutritional only, so cured ham can rate Moderate on its protein despite being processed;
  - processing and additives (e.g. nitrites, IARC Group 1 for processed meat) are shown in "Ingredients worth knowing
    about" and NOVA, not folded into the number;
  - **a reviewer should decide whether that separation is right.**
- **Fruit sugars:** natural sugars count like added sugars (labels don't separate them). Fruit is lifted back up by
  the fruit/vegetable component when that data exists, and **underrated when it doesn't.**
- **Condiments and spreads used in small amounts** (ketchup) look worse per 100 g than per serving. The serving view is
  in "Fits your goals".
- **Fortification** (vitamins, minerals) isn't counted.
- **Missing data:** fibre missing → counted as 0 (conservative). Fruit/vegetable share unknown → not counted (can
  underrate).
- **Drink baseline:** an unsweetened drink starts at 80, so flavoured waters without sweeteners rate Good. Sweetened
  "zero" drinks rate Moderate.
- **Open Food Facts data** is crowd-sourced and may be wrong. The rating is only as good as the label data.

## Ingredient evidence

`src/lib/additive-evidence.ts` lists additives that have been reviewed.

**For each:**
- its purpose;
- its regulatory status;
- what the evidence says;
- who may be affected;
- whether the amount matters;
- its sources.

**Classes:**
- Established concern under specified conditions;
- Regulatory warning;
- Evidence mixed or limited;
- No established concern at typical permitted uses;
- Insufficient information.

**Rules:**
- Presence is never treated as harm; hazard and exposure are kept apart.
- Unreviewed additives show "Insufficient information" and no assessment.
- The AI is given only these notes and may not add claims of its own.

**Sources used:**
- Regulation (EC) 1333/2008;
- Regulation (EU) 1169/2011;
- Regulation (EU) 2022/63;
- EFSA opinions and statements:
  - titanium dioxide, 2021;
  - nitrites and nitrates, 2017;
  - carrageenan, 2018;
  - phosphates, 2019;
  - erythritol, 2023;
  - acesulfame K, 2025;
- WHO/IARC/JECFA on aspartame (2023);
- WHO non-sugar sweetener guideline (2023);
- IARC on red and processed meat (2015) and 4-MEI;
- US FDA on Red No. 3 (2025);
- McCann et al. 2007 (Lancet);
- Chassaing et al. 2015 (Nature);
- Witkowski et al. 2023 (Nature Medicine);
- WHO sugars (2015) and sodium (2012) guidelines.

## Nutrient classifications

`nutrientClasses()` labels each statement:
- **EU claim threshold:** legal levels from Regulation 1924/2006 (e.g. "High in protein" = 20% of energy or more;
  "Source of fibre" = 3 g per 100 g or 1.5 g per 100 kcal);
- **UK front-of-pack level:** "High in sugars / salt / saturated fat / fat";
- **Comparison, not a legal term:**
  - "High in carbohydrates" and "Lower in carbohydrates": above or below the 45–65% of energy range for a whole diet
    (US AMDR);
  - "Lower in protein": under 12% of energy;
  - "High in calories": 400 kcal or more per 100 g, i.e. 20% of the reference intake.

Each line gives the amounts per 100 g and per serving.

## Fits your goals (Pro)

Separate from the rating. It uses the member's own saved targets:
- **Contribution per serving:** calories, protein, carbs, fat, fibre and sodium:
  - fibre target: 14 g per 1,000 kcal of their calorie target (US Dietary Guidelines);
  - sodium: the 2,300 mg daily limit (same source);
- **Protein per 100 kcal;**
- **Their main goal;**
- **Conflicts:**
  - diet style (vegan or vegetarian status; carbs against a keto, carnivore or low-carb target);
  - allergens the member has chosen to avoid.

No medical claims.

## Before switching it on (review checklist)

1. A registered dietitian or nutrition scientist reviews:
   - the anchors and weights above;
   - the reference-food table;
   - the known biases, especially cheese, processed meat and fruit.
2. Decide on the open questions:
   - whether processing or additives should affect the number;
   - whether to add calcium, whole-grain or omega-3 credits;
   - whether the drink baseline is right.
3. Re-run the reference foods and add any foods the reviewer flags; update `FOOD_IQ_VERSION`.
4. Check a sample of real Open Food Facts products (needs network access to `world.openfoodfacts.org`).
5. Then set `FOOD_IQ_SCORE=on` in production and change the "Experimental" label only if the reviewer agrees.
