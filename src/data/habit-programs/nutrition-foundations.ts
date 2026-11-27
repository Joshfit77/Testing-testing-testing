import type { HabitActivity, HabitProgram } from "@/lib/domain/habit-programs";
import { checkin, COMPLETION_80, FOOD_FIRST_NOTE, lesson, PROFESSIONAL_NOTE } from "./shared";

const log: HabitActivity = {
  key: "log-food",
  kind: "track_food",
  title: "Log what you eat today",
  detail: "Meals, snacks and drinks in the food diary. Rough portions are fine.",
  href: "/nutrition",
};
const protein: HabitActivity = {
  key: "protein",
  kind: "protein",
  title: "Reach your protein goal",
  detail: "Include a protein food at each meal: eggs, dairy, fish, poultry, meat, beans, lentils, tofu.",
  href: "/nutrition",
};
const veg: HabitActivity = {
  key: "vegetables",
  kind: "vegetables",
  title: "Vegetables or fruit at two meals",
  detail: "Fresh, frozen or tinned all count. Fill about half the plate when you can.",
  href: "/nutrition",
};
const water: HabitActivity = {
  key: "water",
  kind: "water",
  title: "Reach your water goal",
  detail: "Water, milk, tea and coffee all count towards fluids. Keep a bottle in sight.",
  href: "/nutrition",
};

export const NUTRITION_FOUNDATIONS: HabitProgram = {
  slug: "nutrition-foundations",
  name: "Nutrition Foundations",
  summary: "Four weeks to build the basics: honest logging, protein at meals, more plants and better drinks.",
  description:
    "A gentle, beginner-friendly start to eating well. Each week adds one small habit on top of the last: noticing what you eat, building meals around protein, adding vegetables and fruit, and choosing drinks well. There are no banned foods and no diet rules, just steady habits based on mainstream guidance such as the Dietary Guidelines for Americans.",
  category: "nutrition",
  level: "beginner",
  days: 28,
  schedule: "Daily habits for 4 weeks, plus a short lesson and check-in each week",
  equipment: [],
  instructions: [
    "Each week adds one new habit; keep the earlier ones going as best you can.",
    "Log honestly, not perfectly. The food diary is for noticing patterns, not for judging yourself.",
    "Set your protein, water and vegetable goals below; you can change them at any time.",
    "No foods are banned. Favourite foods fit; the aim is a better overall pattern.",
    "If you have a medical condition, are pregnant, or have a history of disordered eating, check with your doctor or a registered dietitian first.",
  ],
  goalFields: [
    { key: "protein_g", label: "Protein", unit: "g/day", min: 40, max: 250, default: 100, help: "Many adults do well on roughly 1.2–1.6 g per kg of body weight; active people often use 1.4–2.0 g/kg." },
    { key: "water_ml", label: "Water", unit: "ml/day", min: 1000, max: 5000, default: 2000, help: "Drinks of around 1.5–2.5 litres suit most adults; more in heat or with exercise. Pale yellow urine is a good guide." },
    { key: "veg_servings", label: "Vegetables and fruit", unit: "servings/day", min: 1, max: 10, default: 5, help: "A serving is about a cupped handful. Five or more a day is a common target." },
  ],
  completion: COMPLETION_80,
  weeks: [
    {
      week: 1,
      title: "Notice what you eat",
      objective: "Log everything you eat and drink for seven days, without changing anything yet.",
      lesson: {
        title: "Awareness comes before change",
        body: [
          "Most of us underestimate how much and how often we eat. Writing it down, even roughly, is one of the most reliable ways to see your real pattern: when you get hungry, which meals are light on protein or vegetables, and where drinks and snacks add up.",
          "This week, change nothing on purpose. Log meals, snacks and drinks in the food diary as close to the time as you can. Estimates are fine; a photo or a quick note is better than nothing.",
          "Treat what you see as information, not a verdict. There are no good or bad days here, only data you will use over the next three weeks.",
          PROFESSIONAL_NOTE,
        ],
      },
      daily: [log],
      weekly: [
        lesson(),
        { key: "set-goals", kind: "habit", title: "Set your goals", detail: "Choose your protein, water and vegetable goals for the weeks ahead.", href: "/nutrition" },
        checkin(["Which meal or time of day was hardest to log?", "What surprised you about your week of eating?"]),
      ],
      milestone: "A full week of food logging: you now know your starting point.",
    },
    {
      week: 2,
      title: "Protein at every meal",
      objective: "Build each meal around a protein food and reach your daily protein goal on most days.",
      lesson: {
        title: "Why protein matters",
        body: [
          "Protein supplies the building blocks for muscle, skin, bones and much else, and it helps you feel full. Many adults eat most of their protein at dinner and very little at breakfast.",
          "A simple approach is to include a palm-sized portion of a protein food at each meal: eggs, Greek yoghurt, milk, cheese, fish, chicken, lean meat, beans, lentils, tofu or tempeh. For most people this lands near 20–40 g per meal.",
          "Your goal is adjustable. Many adults do well on about 1.2–1.6 g per kg of body weight a day, and people who train regularly often use 1.4–2.0 g/kg. Plant and animal proteins both count. " + FOOD_FIRST_NOTE,
        ],
      },
      daily: [log, protein],
      weekly: [
        lesson(),
        { key: "protein-recipes", kind: "habit", title: "Save two protein-rich recipes", detail: "Pick two you would actually cook this month.", href: "/nutrition/recipes" },
        checkin(["Which meal was easiest to add protein to?", "Which protein foods do you enjoy most?"]),
      ],
      milestone: "Protein is now part of every meal, not an afterthought.",
    },
    {
      week: 3,
      title: "Plants and fibre",
      objective: "Add vegetables or fruit to at least two meals a day and notice the effect on fullness.",
      lesson: {
        title: "Colour on the plate",
        body: [
          "Vegetables, fruit, beans and whole grains bring fibre, vitamins, minerals and plenty of volume for relatively few calories. Most adults eat less than the recommended amount; the Dietary Guidelines suggest roughly 2½ cups of vegetables and 2 cups of fruit a day at a 2,000-calorie intake.",
          "Fibre supports digestion and helps you feel satisfied. Adults are generally advised to aim for around 25–34 g a day. Increase gradually and drink enough fluid as you do.",
          "Fresh, frozen and tinned all count. Frozen vegetables and fruit are just as nutritious, cheap and quick. An easy rule: fill about half the plate with vegetables or salad, a quarter with protein and a quarter with whole grains or starchy foods.",
        ],
      },
      daily: [log, protein, veg],
      weekly: [
        lesson(),
        { key: "grocery-plants", kind: "grocery", title: "Add three vegetables or fruits to your list", detail: "Include at least one frozen or tinned option for busy days.", href: "/nutrition/grocery" },
        checkin(["Which vegetables or fruits did you add?", "Did you notice any change in hunger between meals?"]),
      ],
      milestone: "Two meals a day with vegetables or fruit: your plate looks different.",
    },
    {
      week: 4,
      title: "Drinks and putting it together",
      objective: "Reach your water goal, look at what you drink, and plan a few days of meals that combine every habit.",
      lesson: {
        title: "Drinks count too",
        body: [
          "Fluid needs vary with body size, climate and activity. Water is the simplest choice; milk, tea and coffee also count towards your fluids. Pale yellow urine is a useful everyday guide.",
          "Sugar-sweetened drinks and alcohol can add a lot of energy without making you feel full. The guidance is to keep added sugars under about 10% of daily calories and, if you drink alcohol, to keep it moderate. You do not need to cut anything out; swapping some drinks for water or sugar-free options is a good start.",
          "This week you put the pieces together: log, protein at meals, vegetables at two meals and enough water. Planning a few days ahead makes all of it easier, and it is the habit that keeps the others going after the program ends.",
        ],
      },
      daily: [log, protein, veg, water],
      weekly: [
        lesson(),
        { key: "plan-three-days", kind: "meal_plan", title: "Plan three days of meals", detail: "Each meal with a protein food, and vegetables or fruit at two meals.", href: "/nutrition/planner" },
        checkin(["Which habit from these four weeks will you keep?", "What would make the next month easier?", "What drink swap worked for you?"]),
      ],
      milestone: "Program complete: four habits that form the foundation of eating well.",
    },
  ],
  needsProfessionalReview: {
    who: "Registered dietitian",
    why: "Nutrition education with default protein, water and vegetable targets that a dietitian should confirm are appropriate for a general beginner audience.",
  },
};
